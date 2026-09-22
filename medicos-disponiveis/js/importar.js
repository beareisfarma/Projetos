/*
 * Importador de base.
 *
 * A base de cada pessoa vem como der: planilha exportada do sistema, CSV,
 * o Word que a Beatriz monta, ou o JSON de um backup. Nenhuma delas tem as
 * mesmas colunas, então NÃO existe layout fixo: o app lê o cabeçalho, chuta o
 * mapeamento, e mostra o que entendeu para a pessoa confirmar. Chutar em
 * silêncio seria pior que não importar — daria um roteiro errado com cara de
 * certo.
 *
 * O que o importador nunca faz: inventar horário que o arquivo não tem. Linha
 * sem hora reconhecível entra na lista de problemas e fica de fora.
 */

import {
  DIAS,
  lerAlvo,
  lerDia,
  lerHora,
  lerTurno,
  semAcento,
  separarEspecialidade,
  texto,
  turnoPelaHora,
} from "./utilidades.js";

/* --------------------------------------------- bibliotecas carregadas na hora */

// 880 KB de leitor de planilha não podem entrar no caminho de abrir o app.
// Só baixa quando alguém realmente importa um arquivo, e o service worker
// guarda depois disso.
function carregarScript(caminho, global) {
  if (globalThis[global]) return Promise.resolve(globalThis[global]);
  return new Promise((resolver, rejeitar) => {
    const etiqueta = document.createElement("script");
    etiqueta.src = caminho;
    etiqueta.onload = () =>
      globalThis[global]
        ? resolver(globalThis[global])
        : rejeitar(new Error(`${caminho} carregou sem expor ${global}`));
    etiqueta.onerror = () => rejeitar(new Error("Não foi possível carregar o leitor de arquivos. Verifique a conexão."));
    document.head.appendChild(etiqueta);
  });
}

const carregarPlanilha = () => carregarScript("vendor/xlsx-0.18.5.min.js", "XLSX");
const carregarZip = () => carregarScript("vendor/fflate-0.8.3.min.js", "fflate");

/* ------------------------------------------------------------------ campos */

export const CAMPOS = [
  { id: "nome", rotulo: "Nome do médico", obrigatorio: true },
  { id: "especialidade", rotulo: "Especialidade" },
  { id: "dia", rotulo: "Dia da semana" },
  { id: "turno", rotulo: "Turno" },
  { id: "inicio", rotulo: "Hora de início" },
  { id: "fim", rotulo: "Hora de fim" },
  { id: "horario", rotulo: "Horário (início e fim juntos)" },
  { id: "bairro", rotulo: "Bairro" },
  { id: "endereco", rotulo: "Endereço" },
  { id: "sala", rotulo: "Sala / complemento" },
  { id: "visitas", rotulo: "Visitas por ciclo (1 ou 2)" },
];

// Palavras que aparecem no cabeçalho de cada campo, em ordem de preferência.
const PISTAS = {
  nome: ["nome do medico", "nome medico", "medico", "nome", "profissional", "doutor", "prescritor"],
  especialidade: ["especialidade", "espec", "area de atuacao", "atuacao", "cbo", "especialista"],
  dia: ["dia da semana", "dia semana", "diasemana", "dia", "semana", "weekday"],
  turno: ["turno", "periodo", "shift"],
  inicio: ["hora inicio", "hora inicial", "horario inicio", "inicio", "entrada", "comeco", "de", "das"],
  fim: ["hora fim", "hora final", "horario fim", "fim", "final", "termino", "saida", "ate", "as"],
  horario: ["horario", "horarios", "atendimento", "faixa", "hora"],
  bairro: ["bairro", "regiao", "zona", "localidade"],
  endereco: ["endereco", "logradouro", "rua", "local", "consultorio", "clinica", "estabelecimento"],
  sala: ["sala", "complemento", "conjunto", "andar", "unidade", "apto"],
  visitas: ["visitas por ciclo", "visitas", "frequencia", "visita"],
};

/* ------------------------------------------------------------ leitura de arquivo */

export async function lerArquivo(arquivo) {
  const nome = (arquivo.name || "").toLowerCase();

  if (nome.endsWith(".json")) return lerJson(await arquivo.text(), arquivo.name);
  if (nome.endsWith(".docx")) return lerWord(await arquivo.arrayBuffer(), arquivo.name);
  if (/\.(xlsx|xlsm|xlsb|xls|csv|tsv|txt)$/.test(nome)) return lerPlanilha(arquivo);

  throw new Error("Formato não reconhecido. Envie .xlsx, .csv, .docx ou .json.");
}

function lerJson(bruto, origem) {
  let lido;
  try {
    lido = JSON.parse(bruto);
  } catch {
    throw new Error("Esse arquivo JSON está corrompido.");
  }

  // Backup do próprio app, ou um conteúdo de base já no formato final.
  const conteudo = lido?.conteudo ?? lido;
  if (conteudo && Array.isArray(conteudo.agenda)) {
    return {
      formato: "base",
      origem,
      base: normalizarConteudo(conteudo),
    };
  }

  // A base antiga do site vinha como lista achatada em inglês.
  if (Array.isArray(lido) && lido.length && ("name" in lido[0] || "nome" in lido[0])) {
    return { formato: "tabela", origem, tabela: tabelaDeObjetos(lido) };
  }

  throw new Error("Não reconheci esse JSON como uma base de médicos.");
}

function tabelaDeObjetos(objetos) {
  const cabecalhos = [...new Set(objetos.flatMap((o) => Object.keys(o)))];
  const linhas = objetos.map((o) => cabecalhos.map((c) => o[c]));
  return { cabecalhos, linhas };
}

async function lerPlanilha(arquivo) {
  const XLSX = await carregarPlanilha();
  const nome = (arquivo.name || "").toLowerCase();
  let pasta;

  if (/\.(csv|tsv|txt)$/.test(nome)) {
    // Sistemas antigos exportam CSV em windows-1252, e o TextDecoder estrito
    // é o que denuncia isso — decodificar errado troca "João" por "Jo?o".
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    let conteudo;
    try {
      conteudo = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      conteudo = new TextDecoder("windows-1252").decode(bytes);
    }
    pasta = XLSX.read(conteudo, { type: "string", raw: false });
  } else {
    pasta = XLSX.read(new Uint8Array(await arquivo.arrayBuffer()), { type: "array", cellDates: false });
  }

  const primeira = pasta.SheetNames[0];
  if (!primeira) throw new Error("A planilha está vazia.");
  const matriz = XLSX.utils.sheet_to_json(pasta.Sheets[primeira], { header: 1, blankrows: false, defval: "" });

  // Algumas exportações põem título e logo antes da tabela: o cabeçalho é a
  // primeira linha com pelo menos duas células preenchidas.
  const inicio = matriz.findIndex((linha) => linha.filter((c) => texto(c) !== "").length >= 2);
  if (inicio < 0) throw new Error("Não encontrei uma tabela nessa planilha.");

  const cabecalhos = matriz[inicio].map((c) => texto(c));
  const linhas = matriz.slice(inicio + 1).filter((linha) => linha.some((c) => texto(c) !== ""));

  return { formato: "tabela", origem: arquivo.name, tabela: { cabecalhos, linhas, aba: primeira } };
}

/* ------------------------------------------------------------------- Word */

// O documento da Beatriz tem uma estrutura própria e estável:
//   SEGUNDA-FEIRA / MANHÃ — n médicos / 📍 Bairro / Endereço /
//   • 08:00–12:00 — Nome — sala/complemento 101 ⚠
const LINHA_MEDICO =
  /^[••\-]\s*(\d{1,2}[:h]\d{2})\s*[–-]\s*(\d{1,2}[:h]\d{2})\s*[—-]\s*(.+?)(?:\s*[—-]\s*(?:sala\/complemento|sala|complemento)\s*(.+?))?(?:\s*[—-]\s*(?:especialidade|esp\.?)\s*:?\s*(.+?))?\s*(⚠)?$/i;

async function lerWord(buffer, origem) {
  const fflate = await carregarZip();
  let xml;
  try {
    const arquivos = fflate.unzipSync(new Uint8Array(buffer), { filter: (a) => a.name === "word/document.xml" });
    const bruto = arquivos["word/document.xml"];
    if (!bruto) throw new Error("sem document.xml");
    xml = new TextDecoder("utf-8").decode(bruto);
  } catch {
    throw new Error("Não consegui abrir esse .docx. Ele pode estar corrompido ou ser .doc antigo.");
  }

  const documento = new DOMParser().parseFromString(xml, "application/xml");
  const paragrafos = [...documento.getElementsByTagName("w:p")].map((p) =>
    texto([...p.getElementsByTagName("w:t")].map((t) => t.textContent || "").join("")),
  );

  const agenda = [];
  const problemas = [];
  let dia = null;
  let turno = null;
  let bairro = null;
  let endereco = null;

  paragrafos.forEach((linha, indice) => {
    if (!linha) return;

    const comoDia = /^(SEGUNDA|TERÇA|TERCA|QUARTA|QUINTA|SEXTA)[- ]?FEIRA$/i.exec(linha);
    if (comoDia) {
      dia = lerDia(comoDia[1]);
      turno = bairro = endereco = null;
      return;
    }
    // Sem a borda Unicode isto nunca casava: o `\b` do JavaScript é ASCII e não
    // reconhece limite depois de "Ã", então a manhã inteira ficava sem turno.
    if (/^MANH[ÃA](?![\p{L}\p{N}])/iu.test(linha)) {
      turno = "Manhã";
      bairro = endereco = null;
      return;
    }
    if (/^TARDE(?![\p{L}\p{N}])/iu.test(linha)) {
      turno = "Tarde";
      bairro = endereco = null;
      return;
    }
    if (linha.startsWith("📍")) {
      bairro = texto(linha.slice(2));
      endereco = null;
      return;
    }

    const medico = LINHA_MEDICO.exec(linha);
    if (!medico) {
      // Dentro de um bairro, linha solta que não é médico é o endereço.
      if (dia && turno && bairro && !/^(Dia|Base|Crit|Aten|Roteiro|Organizado)/i.test(linha)) endereco = linha;
      return;
    }

    if (!dia || !turno) {
      problemas.push({ linha: indice + 1, motivo: "médico fora de um dia/turno", conteudo: linha });
      return;
    }

    const inicio = lerHora(medico[1]);
    const fim = lerHora(medico[2]);
    const nome = texto(medico[3]);
    if (!nome || !inicio) {
      problemas.push({ linha: indice + 1, motivo: "sem nome ou sem horário", conteudo: linha });
      return;
    }

    agenda.push({
      nome,
      dia,
      turno,
      bairro: bairro || "",
      endereco: endereco || "",
      inicio,
      fim: fim || inicio,
      sala: texto(medico[4] || ""),
      alerta: Boolean(medico[6]) || fim === inicio,
      especialidade: texto(medico[5] || ""),
    });
  });

  if (!agenda.length) throw new Error("Não encontrei linhas de médico nesse documento.");
  return { formato: "base", origem, base: montarConteudo(agenda), problemas };
}

/* -------------------------------------------------- mapeamento de colunas */

export function sugerirMapa(cabecalhos) {
  const normalizados = cabecalhos.map((c) => semAcento(c).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim());
  const mapa = {};
  const usados = new Set();

  // Duas passadas, e a ordem importa: primeiro só igualdade exata, depois
  // pedaço de palavra — e apenas para pistas longas. Com uma passada só,
  // "Visitas" era capturada pelo campo "fim" (contém "as") e a meta de visitas
  // se perdia calada.
  const procurar = (campo, comparar) => {
    if (mapa[campo] != null) return;
    for (const pista of PISTAS[campo] || []) {
      const indice = normalizados.findIndex((cabecalho, i) => !usados.has(i) && comparar(cabecalho, pista));
      if (indice >= 0) {
        mapa[campo] = indice;
        usados.add(indice);
        return;
      }
    }
  };

  for (const campo of CAMPOS) procurar(campo.id, (cabecalho, pista) => cabecalho === pista);
  for (const campo of CAMPOS) {
    procurar(campo.id, (cabecalho, pista) => pista.length >= 5 && cabecalho.includes(pista));
  }

  // Formato largo: uma coluna por dia da semana, com o horário na célula.
  const colunasDeDia = {};
  normalizados.forEach((cabecalho, indice) => {
    if (usados.has(indice)) return;
    const dia = lerDia(cabecalho);
    if (dia && !colunasDeDia[dia]) colunasDeDia[dia] = indice;
  });
  if (Object.keys(colunasDeDia).length >= 2 && mapa.dia == null) mapa.colunasDeDia = colunasDeDia;

  return mapa;
}

// "08:00 às 12:00", "das 8h às 12h", "8h-12h", "09:00 a 11:30" → dois horários.
// Não uso `\b` de propósito: ele é ASCII e não casa antes de "às"/"até".
function partirHorario(valor) {
  const bruto = texto(valor).replace(/^\s*(?:das|de|entre)\s+/i, "");
  if (!bruto) return [null, null];
  const marcado = bruto
    .replace(/\s+(?:as|às|ate|até|a|e)\s+/giu, "|")
    .replace(/\s*[–—\/\-]\s*/g, "|");
  const partes = marcado.split("|").map((parte) => parte.trim()).filter(Boolean);
  if (partes.length >= 2) return [lerHora(partes[0]), lerHora(partes[1])];
  return [lerHora(bruto), null];
}

export function montarBase({ cabecalhos, linhas }, mapa) {
  const agenda = [];
  const problemas = [];
  const pegar = (linha, campo) => (mapa[campo] == null ? "" : linha[mapa[campo]]);

  linhas.forEach((linha, indice) => {
    const numero = indice + 2; // +1 do cabeçalho, +1 porque planilha conta de 1
    const nome = texto(pegar(linha, "nome"));
    if (!nome) {
      problemas.push({ linha: numero, motivo: "sem nome de médico" });
      return;
    }

    const comum = {
      nome,
      especialidade: texto(pegar(linha, "especialidade")),
      bairro: texto(pegar(linha, "bairro")),
      endereco: texto(pegar(linha, "endereco")),
      sala: texto(pegar(linha, "sala")),
      visitas: mapa.visitas == null ? 1 : lerAlvo(pegar(linha, "visitas")),
    };

    // Formato largo: cada coluna de dia gera uma disponibilidade.
    if (mapa.colunasDeDia) {
      let gerou = false;
      for (const [dia, coluna] of Object.entries(mapa.colunasDeDia)) {
        const celula = texto(linha[coluna]);
        if (!celula) continue;
        const [inicio, fim] = partirHorario(celula);
        if (!inicio) {
          problemas.push({ linha: numero, motivo: `${dia}: "${celula}" não é um horário` });
          continue;
        }
        agenda.push({
          ...comum,
          dia,
          turno: lerTurno(celula) || turnoPelaHora(inicio),
          inicio,
          fim: fim || inicio,
          alerta: !fim || fim === inicio,
        });
        gerou = true;
      }
      if (!gerou) problemas.push({ linha: numero, motivo: "nenhum dia com horário" });
      return;
    }

    const dia = lerDia(pegar(linha, "dia"));
    if (!dia) {
      problemas.push({ linha: numero, motivo: "dia da semana não reconhecido" });
      return;
    }

    let [inicio, fim] = mapa.horario != null ? partirHorario(pegar(linha, "horario")) : [null, null];
    inicio = lerHora(pegar(linha, "inicio")) || inicio;
    fim = lerHora(pegar(linha, "fim")) || fim;

    if (!inicio) {
      problemas.push({ linha: numero, motivo: "sem hora de início" });
      return;
    }

    agenda.push({
      ...comum,
      dia,
      turno: lerTurno(pegar(linha, "turno")) || turnoPelaHora(inicio),
      inicio,
      fim: fim || inicio,
      alerta: !fim || fim === inicio,
    });
  });

  return { ...montarConteudo(agenda), problemas };
}

/* ------------------------------------------------- montagem e normalização */

// O nome é a identidade do médico (é o que a base tem). Por isso a especialidade
// e o número de visitas vivem numa lista separada, uma entrada por pessoa, e não
// repetidos em cada linha de horário.
function montarConteudo(agenda) {
  const medicos = new Map();

  for (const item of agenda) {
    // "Fulano (CARDIOLOGIA)": a especialidade sai do nome. Se ficasse colada
    // nele, o nome do médico mudaria e as visitas já registradas no ciclo — que
    // são guardadas por nome — deixariam de casar.
    if (!item.especialidade) {
      const separado = separarEspecialidade(item.nome);
      if (separado.especialidade) {
        item.nome = separado.nome;
        item.especialidade = separado.especialidade;
      }
    }

    const atual = medicos.get(item.nome) || { nome: item.nome, especialidade: "", visitas: 1 };
    if (item.especialidade && !atual.especialidade) atual.especialidade = item.especialidade;
    if (item.visitas === 2) atual.visitas = 2;
    medicos.set(item.nome, atual);
    delete item.especialidade;
    delete item.visitas;
  }

  agenda.sort(
    (a, b) =>
      DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia) ||
      (a.turno === b.turno ? 0 : a.turno === "Manhã" ? -1 : 1) ||
      a.bairro.localeCompare(b.bairro, "pt-BR") ||
      a.endereco.localeCompare(b.endereco, "pt-BR") ||
      a.inicio.localeCompare(b.inicio),
  );

  return { medicos: [...medicos.values()], agenda };
}

export function normalizarConteudo(conteudo) {
  const agenda = (Array.isArray(conteudo?.agenda) ? conteudo.agenda : [])
    .map((item) => ({
      // O id da linha, quando já existe, é preservado: é por ele que a tela de
      // edição encontra o horário para alterar.
      ...(item.id ? { id: item.id } : {}),
      nome: separarEspecialidade(item.nome ?? item.name).nome,
      dia: lerDia(item.dia ?? item.day),
      turno: lerTurno(item.turno ?? item.shift) || turnoPelaHora(lerHora(item.inicio ?? item.start)),
      bairro: texto(item.bairro ?? item.neighborhood),
      endereco: texto(item.endereco ?? item.address),
      inicio: lerHora(item.inicio ?? item.start),
      fim: lerHora(item.fim ?? item.end),
      sala: texto(item.sala ?? item.room),
      alerta: Boolean(item.alerta ?? item.warning),
    }))
    .filter((item) => item.nome && item.dia && item.inicio)
    .map((item) => ({ ...item, fim: item.fim || item.inicio }));

  const medicos = new Map();
  for (const item of Array.isArray(conteudo?.medicos) ? conteudo.medicos : []) {
    const separado = separarEspecialidade(item.nome ?? item.name);
    if (!separado.nome) continue;
    medicos.set(separado.nome, {
      nome: separado.nome,
      especialidade: texto(item.especialidade) || separado.especialidade,
      visitas: item.visitas === 2 ? 2 : 1,
    });
  }
  // Médico que aparece na agenda mas não na lista: entra com o padrão.
  for (const item of agenda) {
    if (!medicos.has(item.nome)) medicos.set(item.nome, { nome: item.nome, especialidade: "", visitas: 1 });
  }

  return { medicos: [...medicos.values()], agenda };
}

/* ------------------------------------------------------------------ mesclagem */

// Atualizar um ou mais médicos: quem vem no arquivo é substituído por inteiro
// (dados e horários); quem não vem fica exatamente como estava. Isso é o que
// permite mandar um arquivo com três linhas para corrigir três médicos.
export function mesclar(conteudoAtual, conteudoNovo) {
  const atual = normalizarConteudo(conteudoAtual);
  const novo = normalizarConteudo(conteudoNovo);

  const nomesNovos = new Set(novo.medicos.map((m) => m.nome));
  const comAgendaNova = new Set(novo.agenda.map((a) => a.nome));

  const medicos = new Map(atual.medicos.map((m) => [m.nome, m]));
  let atualizados = 0;
  let acrescentados = 0;

  for (const medico of novo.medicos) {
    if (medicos.has(medico.nome)) {
      const antigo = medicos.get(medico.nome);
      medicos.set(medico.nome, {
        nome: medico.nome,
        // Campo vazio no arquivo não apaga o que já havia: quem manda três
        // linhas para corrigir horário não quer perder a especialidade.
        especialidade: medico.especialidade || antigo.especialidade,
        visitas: medico.visitas,
      });
      atualizados += 1;
    } else {
      medicos.set(medico.nome, medico);
      acrescentados += 1;
    }
  }

  const agenda = [
    ...atual.agenda.filter((item) => !comAgendaNova.has(item.nome)),
    ...novo.agenda,
  ];

  const resultado = montarConteudo(
    agenda.map((item) => ({ ...item, especialidade: "", visitas: medicos.get(item.nome)?.visitas ?? 1 })),
  );

  // montarConteudo recria a lista de médicos a partir da agenda; a lista
  // mesclada é a boa (tem especialidade e quem não tem horário nenhum).
  const finais = new Map(resultado.medicos.map((m) => [m.nome, m]));
  for (const [nome, medico] of medicos) finais.set(nome, medico);

  return {
    conteudo: { medicos: [...finais.values()], agenda: resultado.agenda },
    atualizados,
    acrescentados,
    semAgenda: [...nomesNovos].filter((nome) => !comAgendaNova.has(nome)).length,
  };
}
