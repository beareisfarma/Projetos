/*
 * Estado do app e sincronização.
 *
 * Regra que organiza tudo: o aparelho é a cópia de trabalho, a nuvem é o
 * arquivo. Toda ação escreve local e volta na hora; a subida acontece depois,
 * quando houver rede. Assim marcar visita no elevador nunca falha.
 *
 * Conflito entre aparelho e servidor é resolvido por "quem escreveu por último
 * ganha" (campo atualizado_em). É uma conta por pessoa, então disputa de
 * verdade é rara; o que não pode é perder a marcação feita offline.
 */

import * as deposito from "./deposito.js";
import * as nuvem from "./nuvem.js";
import { normalizarConteudo } from "./importar.js";
import { DIAS, TURNOS, hojeISO, texto, turnoPelaHora } from "./utilidades.js";

export const estado = {
  sessao: null,
  base: null,
  ciclo: null,
  historico: [],
  sincronizando: false,
  pendente: false,
  podeConvidar: false,
  ultimoErro: "",
};

let aoMudar = () => {};

export function observar(callback) {
  aoMudar = callback;
}

function avisarMudanca() {
  aoMudar(estado);
}

/* ------------------------------------------------- identidade das linhas */

// Cada disponibilidade ganha um id próprio para poder ser editada e apagada.
// Bases antigas (e a que já está na nuvem) não têm: o id é criado na primeira
// vez que a base passa por aqui.
function novoId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function garantirIds(base) {
  if (!base?.conteudo?.agenda) return false;
  let mudou = false;
  for (const item of base.conteudo.agenda) {
    if (!item.id) {
      item.id = novoId();
      mudou = true;
    }
  }
  return mudou;
}

// A agenda é mantida na mesma ordem que o importador produz: dia, turno,
// bairro, endereço, hora. Sem reordenar depois de editar, a linha alterada
// aparecia fora de lugar na lista.
function ordenarAgenda(agenda) {
  agenda.sort(
    (a, b) =>
      // Incompleto no fim: sem dia, `DIAS.indexOf("")` é -1 e o médico subiria
      // para antes de segunda, atravessado no meio da semana.
      Number(Boolean(a.incompleto)) - Number(Boolean(b.incompleto)) ||
      DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia) ||
      (a.turno === b.turno ? 0 : a.turno === "Manhã" ? -1 : 1) ||
      (a.bairro || "").localeCompare(b.bairro || "", "pt-BR") ||
      (a.endereco || "").localeCompare(b.endereco || "", "pt-BR") ||
      (a.inicio || "").localeCompare(b.inicio || ""),
  );
}

/* ------------------------------------------------------------- persistência */

async function guardarLocal() {
  await deposito.guardar("base", estado.base);
  await deposito.guardar("ciclo", estado.ciclo);
  await deposito.guardar("historico", estado.historico);
}

export async function carregarLocal() {
  estado.base = await deposito.ler("base");
  garantirIds(estado.base);
  estado.ciclo = await deposito.ler("ciclo");
  estado.historico = (await deposito.ler("historico")) || [];
  estado.pendente = Boolean(
    estado.base?.localEm || estado.ciclo?.localEm || estado.historico.some((c) => c.localEm),
  );
  avisarMudanca();
}

export async function limparLocal() {
  estado.base = null;
  estado.ciclo = null;
  estado.historico = [];
  estado.pendente = false;
  await deposito.apagar("base");
  await deposito.apagar("ciclo");
  await deposito.apagar("historico");
  avisarMudanca();
}

// localEm marca o que mudou aqui e ainda não subiu. É por ele que a
// sincronização sabe o que empurrar, e o que pode ser sobrescrito pelo servidor.
function marcarSujo(documento) {
  documento.localEm = new Date().toISOString();
  estado.pendente = true;
}

/* -------------------------------------------------------------- sincronização */

export async function sincronizar({ silencioso = true } = {}) {
  if (!nuvem.sessaoAtual() || estado.sincronizando) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  estado.sincronizando = true;
  estado.ultimoErro = "";
  if (!silencioso) avisarMudanca();

  try {
    // 1. Sobe o que foi feito aqui.
    if (estado.base?.localEm) {
      const salvo = estado.base.id
        ? await nuvem.atualizarBase(estado.base.id, {
            nome: estado.base.nome,
            origem: estado.base.origem,
            conteudo: estado.base.conteudo,
          })
        : await nuvem.criarBase(estado.base);
      if (salvo) estado.base = { ...salvo, localEm: null };
    }

    if (estado.ciclo?.localEm) {
      const campos = {
        nome: estado.ciclo.nome,
        base_id: estado.ciclo.base_id ?? estado.base?.id ?? null,
        inicio: estado.ciclo.inicio,
        fim: estado.ciclo.fim,
        estado: estado.ciclo.estado,
        visitas: estado.ciclo.visitas,
        roteiro: estado.ciclo.roteiro,
        resumo: estado.ciclo.resumo,
      };
      const salvo = estado.ciclo.id
        ? await nuvem.atualizarCiclo(estado.ciclo.id, campos)
        : await nuvem.criarCiclo(campos);
      if (salvo) estado.ciclo = { ...salvo, localEm: null };
    }

    // 2. Sobe os ciclos do histórico que ainda têm trabalho local.
    //
    // Aqui morava um bug sério: pular todo item que já tinha id deixava a
    // CONCLUSÃO sem subir. O servidor continuava com o ciclo "aberto", a leitura
    // seguinte o trazia de volta como ciclo em andamento e o histórico
    // desaparecia — ou seja, fechar o ciclo se desfazia sozinho.
    for (const [indice, antigo] of estado.historico.entries()) {
      if (antigo.id && !antigo.localEm) continue;
      const campos = {
        nome: antigo.nome,
        base_id: antigo.base_id ?? null,
        inicio: antigo.inicio,
        fim: antigo.fim,
        estado: "concluido",
        visitas: antigo.visitas,
        roteiro: antigo.roteiro,
        resumo: antigo.resumo,
      };
      const salvo = antigo.id ? await nuvem.atualizarCiclo(antigo.id, campos) : await nuvem.criarCiclo(campos);
      if (salvo) estado.historico[indice] = { ...salvo, localEm: null };
    }

    // 3. Desce o que está lá e é mais novo.
    const [bases, ciclos, perfil] = await Promise.all([
      nuvem.listarBases(),
      nuvem.listarCiclos(),
      nuvem.lerPerfil().catch(() => null),
    ]);
    estado.podeConvidar = Boolean(perfil?.pode_convidar);

    const aberto = ciclos.find((c) => c.estado === "aberto") || null;
    const concluidos = ciclos.filter((c) => c.estado === "concluido");

    const baseDoCiclo = aberto?.base_id ? bases.find((b) => b.id === aberto.base_id) : null;
    const remota = baseDoCiclo || bases[0] || null;
    if (remota && maisNova(remota, estado.base)) {
      estado.base = { ...remota, localEm: null };
      // Base vinda da nuvem pode não ter os ids das linhas ainda.
      if (garantirIds(estado.base)) marcarSujo(estado.base);
    }

    if (aberto && maisNova(aberto, estado.ciclo)) estado.ciclo = { ...aberto, localEm: null };
    // O ciclo local já foi concluído no servidor por outro aparelho.
    if (!aberto && estado.ciclo && !estado.ciclo.localEm) estado.ciclo = null;

    // O que não subiu ainda não pode ser apagado pela lista do servidor.
    const naoEnviados = estado.historico.filter((c) => c.localEm);
    estado.historico = [...naoEnviados, ...concluidos.filter((c) => !naoEnviados.some((p) => p.id === c.id))];
    estado.pendente = Boolean(
      estado.base?.localEm || estado.ciclo?.localEm || estado.historico.some((c) => c.localEm),
    );
    await guardarLocal();
    return true;
  } catch (erro) {
    estado.ultimoErro = erro.message || "Falha ao sincronizar.";
    return false;
  } finally {
    estado.sincronizando = false;
    avisarMudanca();
  }
}

function maisNova(remoto, local) {
  if (!local) return true;
  if (local.localEm) return false; // há trabalho local não enviado: ele manda
  if (local.id !== remoto.id) return new Date(remoto.atualizado_em) > new Date(local.atualizado_em || 0);
  return new Date(remoto.atualizado_em) > new Date(local.atualizado_em || 0);
}

// Sobe em segundo plano, agrupando rajadas de cliques numa só subida.
let agendado = null;
function subirDepois() {
  clearTimeout(agendado);
  agendado = setTimeout(() => sincronizar().catch(() => {}), 1200);
}

async function aplicar(mudanca) {
  mudanca();
  await guardarLocal();
  avisarMudanca();
  subirDepois();
}

/* --------------------------------------------------------------------- base */

export async function definirBase({ nome, origem, conteudo }) {
  const limpo = normalizarConteudo(conteudo);
  await aplicar(() => {
    estado.base = {
      id: null,
      nome: texto(nome) || "Base de médicos",
      origem: texto(origem),
      conteudo: limpo,
      atualizado_em: new Date().toISOString(),
    };
    // Base recém-importada também precisa dos ids das linhas, senão editar um
    // horário não acha a linha para alterar.
    garantirIds(estado.base);
    marcarSujo(estado.base);
    // Base nova é começo de vida: o ciclo aberto passa a apontar para ela.
    if (estado.ciclo) {
      estado.ciclo.base_id = null;
      marcarSujo(estado.ciclo);
    }
  });
  return estado.base;
}

export async function trocarConteudoDaBase(conteudo, rotulo) {
  await aplicar(() => {
    estado.base.conteudo = normalizarConteudo(conteudo);
    garantirIds(estado.base);
    if (rotulo) estado.base.origem = rotulo;
    estado.base.atualizado_em = new Date().toISOString();
    marcarSujo(estado.base);
  });
}

function medicoOuNovo(nome) {
  const lista = estado.base.conteudo.medicos;
  let medico = lista.find((m) => m.nome === nome);
  if (!medico) {
    medico = { nome, especialidade: "", visitas: 1 };
    lista.push(medico);
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  return medico;
}

// Editar uma disponibilidade: dia, turno, horário, endereço, sala. O NOME não
// entra aqui de propósito — ele é a chave das visitas já registradas, e trocá-lo
// transformaria o médico em outra pessoa aos olhos do ciclo.
export async function editarHorario(id, campos) {
  await aplicar(() => {
    const item = estado.base.conteudo.agenda.find((h) => h.id === id);
    if (!item) return;
    Object.assign(item, {
      dia: campos.dia,
      turno: campos.turno || turnoPelaHora(campos.inicio) || item.turno,
      inicio: campos.inicio,
      fim: campos.fim || campos.inicio,
      bairro: texto(campos.bairro),
      endereco: texto(campos.endereco),
      sala: texto(campos.sala),
      alerta: !campos.fim || campos.fim === campos.inicio,
      // Completar dia e hora é o que tira a marca de "faltam dados".
      incompleto: !campos.dia || !campos.inicio,
    });
    if (campos.especialidade !== undefined) medicoOuNovo(item.nome).especialidade = texto(campos.especialidade);
    ordenarAgenda(estado.base.conteudo.agenda);
    estado.base.atualizado_em = new Date().toISOString();
    marcarSujo(estado.base);
  });
}

export async function acrescentarHorario(campos) {
  const nome = texto(campos.nome);
  if (!nome) return null;
  await aplicar(() => {
    estado.base.conteudo.agenda.push({
      id: novoId(),
      nome,
      dia: campos.dia,
      turno: campos.turno || turnoPelaHora(campos.inicio) || "Manhã",
      bairro: texto(campos.bairro),
      endereco: texto(campos.endereco),
      inicio: campos.inicio,
      fim: campos.fim || campos.inicio,
      sala: texto(campos.sala),
      alerta: !campos.fim || campos.fim === campos.inicio,
      incompleto: !campos.dia || !campos.inicio,
    });
    const medico = medicoOuNovo(nome);
    if (campos.especialidade !== undefined) medico.especialidade = texto(campos.especialidade);
    ordenarAgenda(estado.base.conteudo.agenda);
    estado.base.atualizado_em = new Date().toISOString();
    marcarSujo(estado.base);
  });
  return nome;
}

export async function removerHorario(id) {
  await aplicar(() => {
    const item = estado.base.conteudo.agenda.find((h) => h.id === id);
    if (!item) return;
    estado.base.conteudo.agenda = estado.base.conteudo.agenda.filter((h) => h.id !== id);
    // Médico sem nenhum horário sai da lista, senão a base vai acumulando
    // gente que não atende mais.
    const aindaAtende = estado.base.conteudo.agenda.some((h) => h.nome === item.nome);
    if (!aindaAtende) {
      estado.base.conteudo.medicos = estado.base.conteudo.medicos.filter((m) => m.nome !== item.nome);
    }
    estado.base.atualizado_em = new Date().toISOString();
    marcarSujo(estado.base);
    // O roteiro do ciclo não pode apontar para um horário que não existe mais.
    if (estado.ciclo) {
      const antes = estado.ciclo.roteiro.length;
      estado.ciclo.roteiro = estado.ciclo.roteiro.filter(
        (i) => !(i.nome === item.nome && i.dia === item.dia && i.turno === item.turno && !aindaAtende),
      );
      if (estado.ciclo.roteiro.length !== antes) {
        estado.ciclo.atualizado_em = new Date().toISOString();
        marcarSujo(estado.ciclo);
      }
    }
  });
}

export function horarioPorId(id) {
  return estado.base?.conteudo.agenda.find((h) => h.id === id) || null;
}

export async function definirAlvo(nome, alvo) {
  await aplicar(() => {
    const medico = estado.base.conteudo.medicos.find((m) => m.nome === nome);
    if (medico) medico.visitas = alvo === 2 ? 2 : 1;
    estado.base.atualizado_em = new Date().toISOString();
    marcarSujo(estado.base);
  });
}

/* -------------------------------------------------------------------- ciclo */

function cicloNovo(nome) {
  return {
    id: null,
    base_id: estado.base?.id ?? null,
    nome: texto(nome) || `Ciclo de ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
    inicio: hojeISO(),
    fim: null,
    estado: "aberto",
    visitas: {},
    roteiro: [],
    resumo: null,
    atualizado_em: new Date().toISOString(),
  };
}

export async function garantirCiclo(nome) {
  if (estado.ciclo) return estado.ciclo;
  await aplicar(() => {
    estado.ciclo = cicloNovo(nome);
    marcarSujo(estado.ciclo);
  });
  return estado.ciclo;
}

export function alvoDe(nome) {
  return estado.base?.conteudo.medicos.find((m) => m.nome === nome)?.visitas === 2 ? 2 : 1;
}

export function visitaDe(nome) {
  return estado.ciclo?.visitas?.[nome] || { registros: [], naoVisitado: false };
}

export function feitasDe(nome) {
  return visitaDe(nome).registros.length;
}

export function situacaoDe(nome) {
  const registro = visitaDe(nome);
  const feitas = registro.registros.length;
  const alvo = alvoDe(nome);
  if (feitas >= alvo) return "concluido";
  if (feitas > 0) return "parcial";
  if (registro.naoVisitado) return "nao_visitado";
  return "pendente";
}

export async function registrarVisita(nome) {
  await garantirCiclo();
  await aplicar(() => {
    const atual = estado.ciclo.visitas[nome] || { registros: [], naoVisitado: false };
    // Trava no alvo: 3/2 não significa nada e estragaria o resumo do ciclo.
    if (atual.registros.length >= alvoDe(nome)) return;
    atual.registros = [...atual.registros, hojeISO()];
    atual.naoVisitado = false;
    estado.ciclo.visitas[nome] = atual;
    estado.ciclo.atualizado_em = new Date().toISOString();
    marcarSujo(estado.ciclo);
  });
}

export async function desfazerVisita(nome) {
  if (!estado.ciclo) return;
  await aplicar(() => {
    const atual = estado.ciclo.visitas[nome];
    if (!atual?.registros.length) return;
    atual.registros = atual.registros.slice(0, -1);
    if (!atual.registros.length && !atual.naoVisitado) delete estado.ciclo.visitas[nome];
    estado.ciclo.atualizado_em = new Date().toISOString();
    marcarSujo(estado.ciclo);
  });
}

export async function alternarNaoVisitado(nome) {
  await garantirCiclo();
  await aplicar(() => {
    const atual = estado.ciclo.visitas[nome] || { registros: [], naoVisitado: false };
    atual.naoVisitado = !atual.naoVisitado;
    if (!atual.naoVisitado && !atual.registros.length) delete estado.ciclo.visitas[nome];
    else estado.ciclo.visitas[nome] = atual;
    estado.ciclo.atualizado_em = new Date().toISOString();
    marcarSujo(estado.ciclo);
  });
}

export async function adicionarAoRoteiro(nomes, dia, turno) {
  await garantirCiclo();
  await aplicar(() => {
    for (const nome of nomes) {
      const existe = estado.ciclo.roteiro.some((i) => i.nome === nome && i.dia === dia && i.turno === turno);
      if (!existe) estado.ciclo.roteiro.push({ nome, dia, turno });
    }
    estado.ciclo.atualizado_em = new Date().toISOString();
    marcarSujo(estado.ciclo);
  });
}

export async function removerDoRoteiro(nome, dia, turno) {
  if (!estado.ciclo) return;
  await aplicar(() => {
    estado.ciclo.roteiro = estado.ciclo.roteiro.filter(
      (i) => !(i.nome === nome && i.dia === dia && (turno ? i.turno === turno : true)),
    );
    estado.ciclo.atualizado_em = new Date().toISOString();
    marcarSujo(estado.ciclo);
  });
}

export function roteiroDoDia(dia) {
  const itens = (estado.ciclo?.roteiro || []).filter((i) => i.dia === dia);
  return TURNOS.map((turno) => ({
    turno,
    itens: itens
      .filter((i) => i.turno === turno)
      .sort((a, b) => (horarioDe(a) || "").localeCompare(horarioDe(b) || "")),
  }));
}

export function disponibilidade(nome, dia, turno) {
  const agenda = estado.base?.conteudo.agenda || [];
  return (
    agenda.find((i) => i.nome === nome && i.dia === dia && i.turno === turno) ||
    agenda.find((i) => i.nome === nome) ||
    null
  );
}

function horarioDe(item) {
  return disponibilidade(item.nome, item.dia, item.turno)?.inicio || "";
}

// Médicos com alguma linha sem dia ou sem hora. A conta é por PESSOA, não por
// linha: o que ela precisa saber é de quantos médicos faltam dados.
// Onde este médico já está escalado no ciclo, na ordem em que a semana anda.
// A tela usa isto para avisar que ele já está em OUTRO dia — sem isso ela só
// descobriria a escala dupla montando o roteiro do dia seguinte.
export function roteirosDe(nome) {
  const ordem = (i) => DIAS.indexOf(i.dia) * 2 + (i.turno === "Manhã" ? 0 : 1);
  return (estado.ciclo?.roteiro || [])
    .filter((i) => i.nome === nome)
    .map((i) => ({ dia: i.dia, turno: i.turno }))
    .sort((a, b) => ordem(a) - ordem(b));
}

export function medicosIncompletos() {
  const agenda = estado.base?.conteudo.agenda || [];
  return [...new Set(agenda.filter((item) => item.incompleto).map((item) => item.nome))];
}

export function medicoDe(nome) {
  return estado.base?.conteudo.medicos.find((m) => m.nome === nome) || { nome, especialidade: "", visitas: 1 };
}

/* ------------------------------------------------------- resumo e conclusão */

export function resumoDoCiclo(ciclo = estado.ciclo) {
  if (!ciclo) return null;
  const nomes = Object.keys(ciclo.visitas || {});
  const visitados = nomes.filter((nome) => (ciclo.visitas[nome].registros || []).length > 0);
  const totalVisitas = nomes.reduce((soma, nome) => soma + (ciclo.visitas[nome].registros || []).length, 0);
  const concluidos = visitados.filter((nome) => (ciclo.visitas[nome].registros || []).length >= alvoDe(nome));
  const naoEncontrados = nomes.filter(
    (nome) => ciclo.visitas[nome].naoVisitado && !(ciclo.visitas[nome].registros || []).length,
  );

  const noRoteiro = new Set((ciclo.roteiro || []).map((i) => i.nome));
  const porDia = DIAS.map((dia) => ({
    dia,
    total: (ciclo.roteiro || []).filter((i) => i.dia === dia).length,
  })).filter((linha) => linha.total > 0);

  return {
    nome: ciclo.nome,
    inicio: ciclo.inicio,
    fim: ciclo.fim || hojeISO(),
    medicosNaBase: estado.base?.conteudo.medicos.length ?? 0,
    medicosNoRoteiro: noRoteiro.size,
    medicosVisitados: visitados.length,
    medicosConcluidos: concluidos.length,
    naoEncontrados: naoEncontrados.length,
    totalVisitas,
    porDia,
    roteiro: ciclo.roteiro || [],
    detalhe: visitados
      .map((nome) => ({
        nome,
        especialidade: medicoDe(nome).especialidade,
        alvo: alvoDe(nome),
        feitas: ciclo.visitas[nome].registros.length,
        datas: ciclo.visitas[nome].registros,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

export async function concluirCiclo() {
  if (!estado.ciclo) return null;
  const resumo = resumoDoCiclo();
  await aplicar(() => {
    estado.ciclo.estado = "concluido";
    estado.ciclo.fim = hojeISO();
    estado.ciclo.resumo = resumo;
    estado.ciclo.atualizado_em = new Date().toISOString();
    marcarSujo(estado.ciclo);
    estado.historico = [{ ...estado.ciclo }, ...estado.historico];
    estado.ciclo = null;
  });
  // Sobe na hora: um ciclo fechado é o registro do trabalho do mês.
  await sincronizar();
  return resumo;
}

export async function iniciarCiclo(nome) {
  await aplicar(() => {
    estado.ciclo = cicloNovo(nome);
    marcarSujo(estado.ciclo);
  });
  return estado.ciclo;
}

/* -------------------------------------------------------------------- conta */

export function ligarSessao() {
  nuvem.observarSessao((sessao) => {
    estado.sessao = sessao;
    deposito.guardarSessao(sessao);
    avisarMudanca();
  });

  const guardada = deposito.lerSessao();
  if (guardada?.renovacao) {
    nuvem.definirSessao(guardada);
    estado.sessao = guardada;
  }
  return estado.sessao;
}

export async function sairDaConta() {
  await nuvem.sair();
  estado.podeConvidar = false;
  await limparLocal();
}
