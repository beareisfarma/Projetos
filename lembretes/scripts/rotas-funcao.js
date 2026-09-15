// ─── Roteador ────────────────────────────────────────────────────────────────
// Mesma semântica dos endpoints em api/: reminders, subscribe, transcribe, tick.
const MAX_TENTATIVAS = 3;
const ESPERA_RETENTATIVA_MS = 5 * 60000;
const COBRANCA_ATRASO_MS = 2 * 3600000;

async function rotear(req) {
  const url = new URL(req.url);
  // O caminho que chega aqui varia conforme o Supabase roteia: pode vir como
  // /functions/v1/api/reminders, /api/reminders ou só /reminders. Normaliza os
  // três em vez de apostar num.
  const rota = url.pathname
    .replace(/^\/+/, '')
    .replace(/^functions\/v1\/?/, '')
    .replace(/^api\/?/, '')
    .replace(/\/+$/, '');

  if (rota === 'tick') return await tick(req, url);
  if (rota === 'subscribe') return await subscribe(req);
  if (rota === 'transcribe') return await transcribe(req);
  if (rota === 'reminders') return await reminders(req, url);
  if (rota === '' || rota === 'saude') {
    // Diagnóstico sem segredo: diz o que está configurado, nunca os valores.
    return json({
      ok: true,
      banco: armazenamentoConfigurado(),
      push: canaisAtivos().map((c) => c.nome),
      pin: Boolean(process.env.APP_PIN),
      cron: Boolean(process.env.CRON_SECRET),
      audio: Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY),
    });
  }
  return erro(404, 'Rota desconhecida.');
}

async function subscribe(req) {
  if (req.method === 'GET') {
    const chave = process.env.VAPID_PUBLIC_KEY;
    return chave ? json({ chavePublica: chave }) : erro(503, 'VAPID_PUBLIC_KEY ausente.');
  }
  if (req.method !== 'POST') return erro(405, 'Método não permitido.');
  if (!autorizado(req)) return erro(401, 'PIN inválido.');

  const { inscricao, apelido } = await req.json();
  if (!inscricao?.endpoint || !inscricao?.keys?.p256dh || !inscricao?.keys?.auth) {
    return erro(400, 'Inscrição de push incompleta.');
  }
  await guardarInscricao(inscricao, String(apelido || '').slice(0, 60));
  return json({ ok: true }, 201);
}

async function transcribe(req) {
  if (req.method !== 'POST') return erro(405, 'Método não permitido.');
  if (!autorizado(req)) return erro(401, 'PIN inválido.');

  const provedores = [
    { nome: 'groq', chave: process.env.GROQ_API_KEY,
      url: 'https://api.groq.com/openai/v1/audio/transcriptions', modelo: 'whisper-large-v3-turbo' },
    { nome: 'openai', chave: process.env.OPENAI_API_KEY,
      url: 'https://api.openai.com/v1/audio/transcriptions', modelo: 'whisper-1' },
  ];
  const provedor = provedores.find((p) => p.chave);
  if (!provedor) return erro(503, 'Transcrição indisponível: defina GROQ_API_KEY ou OPENAI_API_KEY.');

  const { audio, mime } = await req.json();
  if (!audio) return erro(400, 'Envie o áudio em base64 no campo "audio".');
  const bytes = Buffer.from(audio, 'base64');
  if (!bytes.length) return erro(400, 'Áudio vazio.');
  if (bytes.length > 4 * 1024 * 1024) return erro(413, 'Áudio grande demais — grave até 2 minutos.');

  const tipo = String(mime || 'audio/webm').split(';')[0];
  const extensao = { 'audio/mp4': 'mp4', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a',
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' }[tipo] || 'webm';

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: tipo }), `recado.${extensao}`);
  form.append('model', provedor.modelo);
  form.append('language', 'pt');
  form.append('response_format', 'json');

  const resposta = await fetch(provedor.url, {
    method: 'POST', headers: { Authorization: `Bearer ${provedor.chave}` }, body: form,
  });
  const bruto = await resposta.text();
  if (!resposta.ok) {
    console.error(`[transcricao/${provedor.nome}]`, resposta.status, bruto.slice(0, 300));
    return erro(502, `Falha ao transcrever (${provedor.nome} ${resposta.status}).`);
  }
  const texto = String(JSON.parse(bruto).text || '').trim();
  if (!texto) return erro(422, 'Não consegui entender o áudio. Tente de novo ou digite.');
  return json({ texto, provedor: provedor.nome });
}

async function reminders(req, url) {
  if (!armazenamentoConfigurado()) return erro(503, 'Banco não configurado.');
  if (!autorizado(req)) return erro(401, 'PIN inválido.');

  const id = url.searchParams.get('id');
  const agora = Date.now();

  if (req.method === 'GET') {
    const [pendentes, feitos] = await Promise.all([listarPendentes(), listarFeitosRecentes(20)]);
    return json({
      agora: new Date(agora).toISOString(),
      pendentes: pendentes.map((l) => enriquecer(l, agora)),
      feitos: feitos.map((l) => enriquecer(l, agora)),
    });
  }

  if (req.method === 'POST') {
    const corpo = await req.json();
    let lembrete;
    if (corpo.recado) {
      lembrete = criarLembrete({ ...interpretar(corpo.recado, new Date(agora)),
        origem: corpo.origem || 'texto', antecedencias: corpo.antecedencias, agora: new Date(agora) });
    } else if (corpo.titulo && corpo.prazo) {
      const prazo = new Date(corpo.prazo);
      if (Number.isNaN(prazo.getTime())) return erro(400, 'Prazo inválido.');
      lembrete = criarLembrete({ titulo: String(corpo.titulo).slice(0, 120),
        detalhes: String(corpo.detalhes || '').slice(0, 500), prazo,
        origem: corpo.origem || 'texto', antecedencias: corpo.antecedencias, agora: new Date(agora) });
    } else {
      return erro(400, 'Envie "recado" (texto livre) ou "titulo" + "prazo".');
    }
    await salvar(lembrete);
    return json({ lembrete: enriquecer(lembrete, agora) }, 201);
  }

  if (!id) return erro(400, 'Informe ?id=');
  const lembrete = await obter(id);
  if (!lembrete) return erro(404, 'Lembrete não encontrado.');

  if (req.method === 'DELETE') { await remover(lembrete); return json({ removido: id }); }
  if (req.method !== 'PATCH') return erro(405, 'Método não permitido.');

  const corpo = await req.json();
  switch (corpo.acao) {
    case 'concluir':
      return json({ lembrete: enriquecer(await concluir(lembrete), agora) });

    case 'adiar': {
      // Adiar move o AVISO, nunca o prazo.
      const minutos = Number(corpo.minutos);
      if (!Number.isFinite(minutos) || minutos <= 0 || minutos > 60 * 24 * 30) {
        return erro(400, 'Informe "minutos" entre 1 e 43200.');
      }
      const soneca = { chave: `soneca-${agora.toString(36)}`,
        em: new Date(agora + minutos * 60000).toISOString(),
        rotulo: 'Você pediu para lembrar de novo' };
      return json({ lembrete: enriquecer(await reagendar(lembrete, [...lembrete.avisos, soneca]), agora) });
    }

    case 'reabrir': {
      const reaberto = { ...lembrete, status: 'pendente', concluidoEm: undefined };
      return json({ lembrete: enriquecer(await reagendar(reaberto,
        montarAvisos(Date.parse(reaberto.prazo), agora, reaberto.antecedencias)), agora) });
    }

    case 'editar': {
      const titulo = corpo.titulo !== undefined ? String(corpo.titulo).slice(0, 120) : lembrete.titulo;
      const detalhes = corpo.detalhes !== undefined ? String(corpo.detalhes).slice(0, 500) : lembrete.detalhes;
      if (!titulo.trim()) return erro(400, 'O título não pode ficar vazio.');
      let prazo = lembrete.prazo;
      if (corpo.prazo) {
        const novo = new Date(corpo.prazo);
        if (Number.isNaN(novo.getTime())) return erro(400, 'Prazo inválido.');
        prazo = novo.toISOString();
      }
      const antecedencias = corpo.antecedencias !== undefined
        ? normalizarAntecedencias(corpo.antecedencias) : lembrete.antecedencias;
      // Mudou prazo ou antecedência? A escada antiga deixou de fazer sentido.
      const mudou = corpo.prazo !== undefined || corpo.antecedencias !== undefined;
      const avisos = mudou ? montarAvisos(Date.parse(prazo), agora, antecedencias) : lembrete.avisos;
      return json({ lembrete: enriquecer(await reagendar(
        { ...lembrete, titulo, detalhes, prazo, antecedencias, confianca: 'alta', observacao: '' },
        avisos), agora) });
    }
    default:
      return erro(400, 'Ação desconhecida. Use concluir, adiar, reabrir ou editar.');
  }
}

async function tick(req, url) {
  if (!autorizadoCron(req, url)) return erro(401, 'Segredo do cron inválido.');
  if (!armazenamentoConfigurado()) return erro(503, 'Banco não configurado.');

  const agora = Date.now();
  // Pega e remove os vencidos num passo atômico dentro do banco.
  const vencidos = await avisosVencidos(agora);
  if (!vencidos.length) {
    return json({ agora: new Date(agora).toISOString(), disparados: 0,
      canais: canaisAtivos().map((c) => c.nome) });
  }

  const relatorio = [];
  for (const vencido of vencidos) {
    const lembrete = await obter(vencido.id);
    if (!lembrete) { relatorio.push({ id: vencido.id, resultado: 'lembrete inexistente' }); continue; }
    if (lembrete.status !== 'pendente') { relatorio.push({ id: vencido.id, resultado: 'já concluído' }); continue; }
    const aviso = lembrete.avisos.find((a) => a.chave === vencido.chave);
    if (!aviso) { relatorio.push({ id: vencido.id, resultado: 'aviso desconhecido' }); continue; }
    if (aviso.enviadoEm) { relatorio.push({ id: vencido.id, resultado: 'já enviado' }); continue; }

    const resultados = await despachar(textoDoAviso(lembrete, aviso));
    const entregues = resultados.reduce((t, r) => t + (r.enviados || 0), 0);
    const tentativas = (aviso.tentativas || 0) + 1;

    if (entregues === 0 && tentativas < MAX_TENTATIVAS) {
      // Ninguém recebeu: tenta de novo em vez de engolir o lembrete.
      await gravarAvisos(lembrete, lembrete.avisos.map((a) =>
        a.chave === aviso.chave ? { ...a, tentativas } : a));
      await reenfileirar(lembrete.id, aviso.chave, agora + ESPERA_RETENTATIVA_MS);
      relatorio.push({ id: lembrete.id, chave: aviso.chave,
        resultado: 'sem entrega, retentativa agendada', tentativas });
      continue;
    }

    const avisos = lembrete.avisos.map((a) => a.chave === aviso.chave
      ? { ...a, tentativas, enviadoEm: new Date(agora).toISOString(), entregues } : a);

    // Prazo estourado e ainda pendente: cobra uma vez, duas horas depois.
    let cobranca = null;
    if (aviso.chave === 'prazo' && entregues > 0) {
      cobranca = { chave: 'atraso', em: new Date(agora + COBRANCA_ATRASO_MS).toISOString(),
        rotulo: 'Passou do prazo e ainda está pendente' };
      avisos.push(cobranca);
    }
    await gravarAvisos(lembrete, avisos);
    if (cobranca) await reenfileirar(lembrete.id, cobranca.chave, Date.parse(cobranca.em));

    relatorio.push({ id: lembrete.id, chave: aviso.chave, titulo: lembrete.titulo,
      resultado: entregues > 0 ? 'entregue' : 'desistiu após 3 tentativas', entregues });
  }

  return json({ agora: new Date(agora).toISOString(), disparados: relatorio.length,
    canais: canaisAtivos().map((c) => c.nome), relatorio });
}
