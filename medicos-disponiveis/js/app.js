/*
 * Interface. Quatro telas: entrar, nova senha, base e app.
 *
 * O app só desenha a partir do estado em dados.js — nenhuma tela guarda verdade
 * própria. Toda ação chama dados.* e o redesenho vem do observador, que é o que
 * impede a tela e o banco local de discordarem.
 */

import * as dados from "./dados.js";
import * as nuvem from "./nuvem.js";
import * as importar from "./importar.js";
import * as deposito from "./deposito.js";
import {
  DIAS,
  TURNOS,
  agrupar,
  casa,
  chaveBusca,
  dataCurta,
  dataLonga,
  diaDeHoje,
  esc,
  hojeISO,
} from "./utilidades.js";

const el = (id) => document.getElementById(id);

const tela = {
  entrar: el("telaEntrar"),
  senha: el("telaSenha"),
  base: el("telaBase"),
  app: el("telaApp"),
};

const visao = {
  atual: "entrar",
  aba: "disponiveis",
  dia: diaDeHoje(),
  turno: new Date().getHours() < 12 ? "Manhã" : "Tarde",
  busca: "",
  selecionados: new Set(),
  modoBase: "nova",
  nomeNovoCiclo: "",
  arquivoLido: null,
  mapa: {},
  tokenRecuperacao: null,
  assinatura: "",
};

let avisoBase = "";
let avisoArmazenamento = "";

/* ---------------------------------------------------------------- mensagens */

function avisar() {
  const texto = avisoArmazenamento || avisoBase;
  el("avisoTexto").textContent = texto;
  el("aviso").hidden = !texto;
}

function dizer(alvo, texto) {
  const campo = el(alvo);
  campo.textContent = texto;
  campo.hidden = !texto;
}

/* ------------------------------------------------------------------- telas */

function mostrar(nome) {
  visao.atual = nome;
  for (const [chave, no] of Object.entries(tela)) no.hidden = chave !== nome;
  el("botaoConta").hidden = !dados.estado.sessao || nome === "entrar";
  if (nome !== "app") el("painelConta").hidden = true;
  desenhar();
}

function decidirTela() {
  if (visao.tokenRecuperacao) return mostrar("senha");
  if (!dados.estado.sessao) return mostrar("entrar");
  if (!dados.estado.base) return mostrar("base");
  return mostrar("app");
}

/* ------------------------------------------------------------------ acesso */

el("abaEntrar").addEventListener("click", () => trocarFormaDeAcesso("entrar"));
el("abaCriar").addEventListener("click", () => trocarFormaDeAcesso("criar"));

function trocarFormaDeAcesso(qual) {
  el("abaEntrar").setAttribute("aria-selected", String(qual === "entrar"));
  el("abaCriar").setAttribute("aria-selected", String(qual === "criar"));
  el("formEntrar").hidden = qual !== "entrar";
  el("formCriar").hidden = qual !== "criar";
  dizer("mensagemAcesso", "");
}

el("formEntrar").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = evento.target.querySelector("button[type=submit]");
  botao.disabled = true;
  dizer("mensagemAcesso", "Entrando…");
  try {
    await nuvem.entrar({ email: el("entrarEmail").value, senha: el("entrarSenha").value });
    el("entrarSenha").value = "";
    dizer("mensagemAcesso", "");
    await dados.carregarLocal();
    await dados.sincronizar({ silencioso: false });
    decidirTela();
  } catch (erro) {
    dizer("mensagemAcesso", erro.message);
  } finally {
    botao.disabled = false;
  }
});

el("formCriar").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = evento.target.querySelector("button[type=submit]");
  botao.disabled = true;
  dizer("mensagemAcesso", "Criando a conta…");
  try {
    const email = el("criarEmail").value;
    const senha = el("criarSenha").value;
    await nuvem.cadastrar({ email, senha, codigo: el("criarCodigo").value });
    await nuvem.entrar({ email, senha });
    el("criarSenha").value = "";
    el("criarCodigo").value = "";
    dizer("mensagemAcesso", "");
    await dados.carregarLocal();
    await dados.sincronizar({ silencioso: false });
    decidirTela();
  } catch (erro) {
    dizer("mensagemAcesso", erro.message);
  } finally {
    botao.disabled = false;
  }
});

el("esqueciSenha").addEventListener("click", async () => {
  const email = el("entrarEmail").value.trim();
  if (!email) {
    dizer("mensagemAcesso", "Escreva o e-mail da conta primeiro.");
    return;
  }
  try {
    await nuvem.pedirRecuperacao(email);
    dizer("mensagemAcesso", "Enviei um link de redefinição para esse e-mail.");
  } catch (erro) {
    dizer("mensagemAcesso", erro.message);
  }
});

/* ------------------------------------------------------------- nova senha */

el("formSenha").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const nova = el("senhaNova").value;
  if (nova.length < 8) {
    dizer("mensagemSenha", "A senha precisa de pelo menos 8 caracteres.");
    return;
  }
  const botao = evento.target.querySelector("button[type=submit]");
  botao.disabled = true;
  try {
    // Com a sessão aberta, a senha atual é conferida antes: celular
    // desbloqueado na mão de outra pessoa não pode virar troca de senha.
    if (!visao.tokenRecuperacao) {
      const atual = el("senhaAtual").value;
      if (!atual) throw new Error("Informe a senha atual.");
      await nuvem.entrar({ email: dados.estado.sessao.usuario.email, senha: atual });
    }
    await nuvem.definirSenha(nova, visao.tokenRecuperacao);
    visao.tokenRecuperacao = null;
    el("senhaNova").value = "";
    el("senhaAtual").value = "";
    dizer("mensagemSenha", "");
    history.replaceState(null, "", location.pathname);
    if (dados.estado.sessao) {
      await dados.carregarLocal();
      await dados.sincronizar();
      decidirTela();
    } else {
      mostrar("entrar");
      dizer("mensagemAcesso", "Senha trocada. Entre com a nova senha.");
    }
  } catch (erro) {
    dizer("mensagemSenha", erro.message);
  } finally {
    botao.disabled = false;
  }
});

el("cancelarSenha").addEventListener("click", () => {
  visao.tokenRecuperacao = null;
  history.replaceState(null, "", location.pathname);
  dizer("mensagemSenha", "");
  decidirTela();
});

/* -------------------------------------------------------------- painel conta */

el("botaoConta").addEventListener("click", () => {
  const painel = el("painelConta");
  painel.hidden = !painel.hidden;
  if (!painel.hidden) desenharConta();
});

el("sincronizarAgora").addEventListener("click", async () => {
  await dados.sincronizar({ silencioso: false });
  desenharConta();
});

el("abrirTrocaSenha").addEventListener("click", () => {
  el("painelConta").hidden = true;
  el("campoSenhaAtual").hidden = false;
  el("tituloSenha").textContent = "Trocar senha";
  mostrar("senha");
});

el("trocarBase").addEventListener("click", () => {
  el("painelConta").hidden = true;
  abrirTelaDeBase();
});

el("sairConta").addEventListener("click", async () => {
  if (!confirm("Sair da conta? As marcações já sincronizadas continuam guardadas na sua conta.")) return;
  await dados.sairDaConta();
  mostrar("entrar");
});

function desenharConta() {
  el("contaEmail").textContent = dados.estado.sessao?.usuario?.email || "";
  const partes = [];
  if (dados.estado.base) {
    partes.push(`${dados.estado.base.conteudo.medicos.length} médicos na base "${dados.estado.base.nome}"`);
  }
  partes.push(dados.estado.pendente ? "há marcações ainda não sincronizadas" : "tudo sincronizado");
  if (dados.estado.ultimoErro) partes.push(dados.estado.ultimoErro);
  el("contaDetalhe").textContent = partes.join(" · ");
}

/* --------------------------------------------------------------- tela da base */

function abrirTelaDeBase() {
  visao.arquivoLido = null;
  visao.mapa = {};
  const temBase = Boolean(dados.estado.base);
  el("modoBase").hidden = !temBase;
  el("voltarDaBase").hidden = !temBase;
  el("tituloBase").textContent = temBase ? "Trocar ou atualizar a base" : "Envie a sua planilha";
  el("passoArquivo").hidden = false;
  el("passoMapa").hidden = true;
  dizer("mensagemBase", "");
  mostrar("base");
}

el("voltarDaBase").addEventListener("click", () => decidirTela());

for (const botao of document.querySelectorAll("#modoBase .modo")) {
  botao.addEventListener("click", () => {
    visao.modoBase = botao.dataset.modo;
    for (const outro of document.querySelectorAll("#modoBase .modo")) {
      outro.setAttribute("aria-pressed", String(outro === botao));
    }
    el("explicacaoBase").textContent =
      visao.modoBase === "merge"
        ? "Envie um arquivo só com os médicos que mudaram. Quem vier no arquivo é atualizado; o resto da base fica intacto."
        : "Aceita planilha (.xlsx, .csv), o Word do roteiro semanal (.docx) e backup em .json. O app mostra o que entendeu antes de aplicar.";
  });
}

el("areaArquivo").addEventListener("click", () => el("arquivoBase").click());
el("arquivoBase").addEventListener("change", () => {
  const arquivo = el("arquivoBase").files?.[0];
  el("arquivoBase").value = "";
  if (arquivo) receberArquivo(arquivo);
});

for (const evento of ["dragover", "dragenter"]) {
  el("areaArquivo").addEventListener(evento, (e) => {
    e.preventDefault();
    el("areaArquivo").classList.add("arrastando");
  });
}
for (const evento of ["dragleave", "drop"]) {
  el("areaArquivo").addEventListener(evento, (e) => {
    e.preventDefault();
    el("areaArquivo").classList.remove("arrastando");
  });
}
el("areaArquivo").addEventListener("drop", (e) => {
  const arquivo = e.dataTransfer?.files?.[0];
  if (arquivo) receberArquivo(arquivo);
});

async function receberArquivo(arquivo) {
  dizer("mensagemBase", "Lendo o arquivo…");
  try {
    const lido = await importar.lerArquivo(arquivo);
    visao.arquivoLido = lido;
    dizer("mensagemBase", "");

    if (lido.formato === "base") {
      // Word e JSON já vêm prontos: não há coluna para mapear.
      visao.mapa = {};
      mostrarConfirmacao(lido.base, lido.problemas || [], `${lido.origem}`);
      return;
    }

    visao.mapa = importar.sugerirMapa(lido.tabela.cabecalhos);
    desenharMapa();
  } catch (erro) {
    dizer("mensagemBase", erro.message);
  }
}

function desenharMapa() {
  const { cabecalhos, linhas } = visao.arquivoLido.tabela;
  el("passoArquivo").hidden = true;
  el("passoMapa").hidden = false;
  el("tituloMapa").textContent = "Confira as colunas";
  el("resumoArquivo").textContent =
    `${visao.arquivoLido.origem} · ${linhas.length} linhas · ${cabecalhos.length} colunas` +
    (visao.mapa.colunasDeDia ? " · encontrei uma coluna por dia da semana" : "");

  const opcoes = (selecionado) =>
    [
      `<option value="">— não tem —</option>`,
      ...cabecalhos.map(
        (cabecalho, indice) =>
          `<option value="${indice}"${Number(selecionado) === indice ? " selected" : ""}>${esc(
            cabecalho || `coluna ${indice + 1}`,
          )}</option>`,
      ),
    ].join("");

  el("mapa").innerHTML = importar.CAMPOS.map((campo) => {
    if (campo.id === "dia" && visao.mapa.colunasDeDia) {
      const nomes = Object.keys(visao.mapa.colunasDeDia).join(", ");
      return `<label class="linha-mapa"><span>${esc(campo.rotulo)}</span>
        <em class="mapa-auto">colunas por dia: ${esc(nomes)}</em></label>`;
    }
    return `<label class="linha-mapa"><span>${esc(campo.rotulo)}${campo.obrigatorio ? " *" : ""}</span>
      <select data-campo="${campo.id}">${opcoes(visao.mapa[campo.id])}</select></label>`;
  }).join("");

  for (const selecao of el("mapa").querySelectorAll("select")) {
    selecao.addEventListener("change", () => {
      const valor = selecao.value === "" ? null : Number(selecao.value);
      visao.mapa = { ...visao.mapa, [selecao.dataset.campo]: valor };
      if (valor == null) delete visao.mapa[selecao.dataset.campo];
      desenharPrevia();
    });
  }

  desenharPrevia();
  el("nomeBase").value = el("nomeBase").value || nomeSugerido(visao.arquivoLido.origem);
}

function nomeSugerido(origem) {
  const limpo = String(origem || "").replace(/\.[a-z0-9]+$/i, "");
  return limpo.slice(0, 60) || "Base de médicos";
}

function desenharPrevia() {
  const montada = importar.montarBase(visao.arquivoLido.tabela, visao.mapa);
  visao.baseMontada = montada;

  const amostra = montada.agenda.slice(0, 6);
  el("previa").innerHTML = amostra.length
    ? `<h4>Prévia</h4><div class="previa-linhas">${amostra
        .map(
          (item) => `<div class="previa-linha">
            <strong>${esc(item.nome)}</strong>
            <span>${esc(item.dia)} · ${esc(item.turno)} · ${esc(item.inicio)}–${esc(item.fim)}</span>
            <span>${esc([item.bairro, item.endereco, item.sala].filter(Boolean).join(" · "))}</span>
          </div>`,
        )
        .join("")}</div>
      <p class="conta-detalhe">${montada.agenda.length} disponibilidades · ${montada.medicos.length} médicos${
        montada.medicos.some((m) => m.especialidade) ? " · com especialidade" : " · sem especialidade na base"
      }</p>`
    : `<p class="save-message">Com esse mapeamento eu não consegui montar nenhuma linha. Confira a coluna do nome, do dia e do horário.</p>`;

  const problemas = montada.problemas || [];
  el("problemas").hidden = problemas.length === 0;
  if (problemas.length) {
    el("problemas").innerHTML = `<h4>${problemas.length} linha(s) fora</h4>
      <ul>${problemas
        .slice(0, 8)
        .map((p) => `<li>Linha ${p.linha}: ${esc(p.motivo)}</li>`)
        .join("")}</ul>
      ${problemas.length > 8 ? `<p class="conta-detalhe">e mais ${problemas.length - 8}…</p>` : ""}
      <p class="conta-detalhe">Linha sem horário reconhecível fica de fora em vez de entrar com hora inventada.</p>`;
  }

  el("aplicarBase").disabled = montada.agenda.length === 0;
}

function mostrarConfirmacao(base, problemas, origem) {
  visao.baseMontada = { ...base, problemas };
  el("passoArquivo").hidden = true;
  el("passoMapa").hidden = false;
  el("tituloMapa").textContent = "Confira o que eu li";
  el("resumoArquivo").textContent = `${origem} · ${base.agenda.length} disponibilidades · ${base.medicos.length} médicos`;
  el("mapa").innerHTML = "";
  el("nomeBase").value = el("nomeBase").value || nomeSugerido(origem);
  const guardado = visao.arquivoLido;
  visao.arquivoLido = { ...guardado, tabela: null };
  el("previa").innerHTML = `<h4>Prévia</h4><div class="previa-linhas">${base.agenda
    .slice(0, 6)
    .map(
      (item) => `<div class="previa-linha">
        <strong>${esc(item.nome)}</strong>
        <span>${esc(item.dia)} · ${esc(item.turno)} · ${esc(item.inicio)}–${esc(item.fim)}</span>
        <span>${esc([item.bairro, item.endereco, item.sala].filter(Boolean).join(" · "))}</span>
      </div>`,
    )
    .join("")}</div>`;
  el("problemas").hidden = !problemas.length;
  if (problemas.length) {
    el("problemas").innerHTML = `<h4>${problemas.length} linha(s) fora</h4><ul>${problemas
      .slice(0, 8)
      .map((p) => `<li>Linha ${p.linha}: ${esc(p.motivo)}</li>`)
      .join("")}</ul>`;
  }
  el("aplicarBase").disabled = base.agenda.length === 0;
}

el("cancelarBase").addEventListener("click", () => abrirTelaDeBase());

el("aplicarBase").addEventListener("click", async () => {
  const montada = visao.baseMontada;
  if (!montada?.agenda?.length) return;
  el("aplicarBase").disabled = true;
  dizer("mensagemBase", "Aplicando…");
  try {
    const conteudo = { medicos: montada.medicos, agenda: montada.agenda };
    if (visao.modoBase === "merge" && dados.estado.base) {
      const resultado = importar.mesclar(dados.estado.base.conteudo, conteudo);
      await dados.trocarConteudoDaBase(resultado.conteudo, el("nomeBase").value);
      dizer(
        "mensagem",
        `Base atualizada: ${resultado.atualizados} médico(s) alterado(s), ${resultado.acrescentados} novo(s).`,
      );
    } else {
      await dados.definirBase({
        nome: el("nomeBase").value,
        origem: visao.arquivoLido?.origem || "",
        conteudo,
      });
      dizer("mensagem", `Base aplicada: ${conteudo.medicos.length} médicos.`);
    }
    visao.modoBase = "nova";
    decidirTela();
  } catch (erro) {
    dizer("mensagemBase", erro.message);
  } finally {
    el("aplicarBase").disabled = false;
  }
});

/* ------------------------------------------------------------------- abas */

el("abaDisponiveis").addEventListener("click", () => trocarAba("disponiveis"));
el("abaRoteiro").addEventListener("click", () => trocarAba("roteiro"));
el("abaCiclo").addEventListener("click", () => trocarAba("ciclo"));

function trocarAba(qual) {
  visao.aba = qual;
  visao.selecionados = new Set();
  dizer("mensagem", "");
  desenhar();
}

el("dias").addEventListener("click", (evento) => {
  const botao = evento.target.closest("button[data-dia]");
  if (!botao) return;
  visao.dia = botao.dataset.dia;
  visao.selecionados = new Set();
  dizer("mensagem", "");
  desenhar();
});

el("turnos").addEventListener("click", (evento) => {
  const botao = evento.target.closest("button[data-turno]");
  if (!botao) return;
  visao.turno = botao.dataset.turno;
  visao.selecionados = new Set();
  dizer("mensagem", "");
  desenhar();
});

el("busca").addEventListener("input", () => {
  visao.busca = el("busca").value;
  desenhar();
});

el("adicionarRoteiro").addEventListener("click", async () => {
  const nomes = [...visao.selecionados];
  if (!nomes.length) return;
  await dados.adicionarAoRoteiro(nomes, visao.dia, visao.turno);
  visao.selecionados = new Set();
  visao.aba = "roteiro";
  dizer("mensagem", nomes.length === 1 ? "Médico adicionado ao roteiro." : `${nomes.length} médicos adicionados.`);
  desenhar();
});

/* ------------------------------------------------------------ ações na lista */

el("lista").addEventListener("click", async (evento) => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;
  const { acao, nome, dia, turno } = botao.dataset;
  dizer("mensagem", "");

  switch (acao) {
    case "visitar":
      await dados.registrarVisita(nome);
      break;
    case "desfazer":
      await dados.desfazerVisita(nome);
      break;
    case "nao-encontrei":
      await dados.alternarNaoVisitado(nome);
      break;
    case "selecionar":
      if (visao.selecionados.has(nome)) visao.selecionados.delete(nome);
      else visao.selecionados.add(nome);
      desenhar();
      break;
    case "retirar":
      await dados.removerDoRoteiro(nome, dia || visao.dia, turno);
      break;
    case "concluir-ciclo":
      await concluirCiclo();
      break;
    case "novo-ciclo":
      await dados.iniciarCiclo(el("nomeNovoCiclo")?.value || visao.nomeNovoCiclo);
      visao.nomeNovoCiclo = "";
      dizer("mensagem", "Novo ciclo aberto.");
      break;
    case "nova-base-ciclo":
      abrirTelaDeBase();
      break;
    case "baixar-resumo":
      baixarResumo(nome);
      break;
    case "baixar-copia":
      baixarCopia();
      break;
  }
});

el("lista").addEventListener("change", async (evento) => {
  const selecao = evento.target.closest("select[data-acao='alvo']");
  if (!selecao) return;
  await dados.definirAlvo(selecao.dataset.nome, Number(selecao.value));
});

// A lista é redesenhada por inteiro a cada mudança de estado — inclusive quando
// uma sincronização em segundo plano termina. Sem guardar o que está sendo
// digitado, o nome do novo ciclo era apagado no meio da digitação.
el("lista").addEventListener("input", (evento) => {
  if (evento.target.id === "nomeNovoCiclo") visao.nomeNovoCiclo = evento.target.value;
});

async function concluirCiclo() {
  const resumo = dados.resumoDoCiclo();
  if (!resumo) return;
  const confirmacao =
    `Concluir "${resumo.nome}"?\n\n` +
    `• ${resumo.medicosVisitados} médicos visitados (${resumo.totalVisitas} visitas)\n` +
    `• ${resumo.medicosConcluidos} com a meta de visitas batida\n` +
    `• ${resumo.medicosNoRoteiro} estavam no roteiro\n\n` +
    `O ciclo fica guardado no histórico e um novo começa em branco.`;
  if (!confirm(confirmacao)) return;
  await dados.concluirCiclo();
  dizer("mensagem", "Ciclo concluído e guardado no histórico.");
  desenhar();
}

function baixar(nomeArquivo, conteudo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baixarResumo(id) {
  const ciclo = dados.estado.historico.find((c) => String(c.id) === String(id));
  if (!ciclo) return;
  baixar(`ciclo-${ciclo.inicio}-a-${ciclo.fim || hojeISO()}.json`, JSON.stringify(ciclo, null, 2));
}

function baixarCopia() {
  baixar(
    `medicos-copia-${hojeISO()}.json`,
    JSON.stringify(
      { app: "medicos-disponiveis", versao: 2, em: new Date().toISOString(), base: dados.estado.base, ciclo: dados.estado.ciclo, historico: dados.estado.historico },
      null,
      2,
    ),
  );
}

/* ---------------------------------------------------------------- desenho */

function desenhar() {
  if (visao.atual !== "app") {
    desenharRodape();
    return;
  }

  const ciclo = dados.estado.ciclo;
  el("tituloCiclo").textContent = ciclo ? ciclo.nome : "Nenhum ciclo aberto";

  el("abaDisponiveis").setAttribute("aria-selected", String(visao.aba === "disponiveis"));
  el("abaRoteiro").setAttribute("aria-selected", String(visao.aba === "roteiro"));
  el("abaCiclo").setAttribute("aria-selected", String(visao.aba === "ciclo"));
  el("contaRoteiro").textContent = String(ciclo?.roteiro?.length || 0);

  el("grupoDias").hidden = visao.aba === "ciclo";
  el("grupoTurnos").hidden = visao.aba !== "disponiveis";
  el("caixaBusca").hidden = visao.aba !== "disponiveis";

  desenharControles();
  desenharEstadoSinc();
  desenharRodape();

  if (visao.aba === "disponiveis") desenharDisponiveis();
  else if (visao.aba === "roteiro") desenharRoteiro();
  else desenharCiclo();

  const selecionando = visao.aba === "disponiveis" && visao.selecionados.size > 0;
  el("adicionarRoteiro").hidden = !selecionando;
  if (selecionando) {
    el("adicionarRoteiro").textContent = `Adicionar ${visao.selecionados.size} ao roteiro de ${visao.dia} · ${visao.turno}`;
  }
  document.body.classList.toggle("selecionando", selecionando);
}

function desenharControles() {
  el("dias").innerHTML = DIAS.map(
    (dia) => `<button type="button" data-dia="${esc(dia)}" aria-pressed="${dia === visao.dia}">${esc(dia.slice(0, 3))}</button>`,
  ).join("");
  el("turnos").innerHTML = TURNOS.map(
    (turno) =>
      `<button type="button" data-turno="${esc(turno)}" aria-pressed="${turno === visao.turno}">${
        turno === "Manhã" ? "☀&nbsp; Manhã" : "◐&nbsp; Tarde"
      }</button>`,
  ).join("");
}

function desenharEstadoSinc() {
  const marca = el("estadoSinc");
  if (!dados.estado.sessao) {
    marca.hidden = true;
    return;
  }
  marca.hidden = false;
  if (dados.estado.sincronizando) {
    marca.textContent = "sincronizando…";
    marca.className = "estado-sinc";
  } else if (dados.estado.pendente) {
    marca.textContent = "pendente";
    marca.className = "estado-sinc pendente";
  } else {
    marca.textContent = "sincronizado";
    marca.className = "estado-sinc ok";
  }
}

function desenharRodape() {
  const base = dados.estado.base;
  el("rodapeBase").textContent = base
    ? `${base.nome} · ${base.conteudo.medicos.length} médicos · ${base.conteudo.agenda.length} disponibilidades`
    : "Nenhuma base carregada.";
}

/* ------------------------------------------------------- aba: disponíveis */

function agendaFiltrada() {
  const agenda = dados.estado.base?.conteudo.agenda || [];
  const procurado = chaveBusca(visao.busca);
  return agenda.filter((item) => {
    if (item.dia !== visao.dia || item.turno !== visao.turno) return false;
    if (!procurado) return true;
    const medico = dados.medicoDe(item.nome);
    return casa(
      chaveBusca(`${item.nome} ${medico.especialidade} ${item.bairro} ${item.endereco} ${item.sala}`),
      procurado,
    );
  });
}

function fichaVisitas(nome) {
  const feitas = dados.feitasDe(nome);
  const alvo = dados.alvoDe(nome);
  const situacao = dados.situacaoDe(nome);
  return `<span class="contador ${situacao}" title="visitas registradas neste ciclo">${feitas}/${alvo}</span>`;
}

function botoesDeVisita(nome) {
  const feitas = dados.feitasDe(nome);
  const alvo = dados.alvoDe(nome);
  const registro = dados.visitaDe(nome);
  const nomeEsc = esc(nome);

  const principal =
    feitas >= alvo
      ? `<button type="button" class="visit-toggle" aria-pressed="true" disabled><span>✓</span>Meta batida</button>`
      : `<button type="button" class="visit-toggle" data-acao="visitar" data-nome="${nomeEsc}" aria-pressed="${feitas > 0}"><span>✓</span>${
          feitas > 0 ? "Registrar 2ª visita" : "Registrar visita"
        }</button>`;

  const desfazer = feitas
    ? `<button type="button" class="route-toggle" data-acao="desfazer" data-nome="${nomeEsc}"><span>−</span>Desfazer visita</button>`
    : "";

  const naoEncontrei = `<button type="button" class="route-toggle${registro.naoVisitado ? " already" : ""}" data-acao="nao-encontrei" data-nome="${nomeEsc}" aria-pressed="${registro.naoVisitado}"><span>!</span>${
    registro.naoVisitado ? "Não encontrei — desfazer" : "Não encontrei"
  }</button>`;

  return `${principal}${desfazer}${naoEncontrei}`;
}

function cartaoDisponivel(item, noRoteiro) {
  const nome = esc(item.nome);
  const medico = dados.medicoDe(item.nome);
  const situacao = dados.situacaoDe(item.nome);
  const escolhido = visao.selecionados.has(item.nome);
  const ultima = dados.visitaDe(item.nome).registros.at(-1);

  const botaoRoteiro = noRoteiro
    ? `<button type="button" class="route-toggle already" data-acao="retirar" data-nome="${nome}" data-dia="${esc(item.dia)}" data-turno="${esc(item.turno)}"><span>−</span>Retirar do roteiro</button>`
    : `<button type="button" class="route-toggle" data-acao="selecionar" data-nome="${nome}" aria-pressed="${escolhido}"><span>${
        escolhido ? "✓" : "+"
      }</span>${escolhido ? "Selecionado — desfazer" : "Selecionar para roteiro"}</button>`;

  return `<article class="doctor-card situacao-${situacao}">
    <div class="time">${esc(item.inicio)}<span>até ${esc(item.fim)}</span></div>
    <div>
      <span class="doctor-name">${nome}</span>
      ${fichaVisitas(item.nome)}
      ${medico.especialidade ? `<div class="especialidade">${esc(medico.especialidade)}</div>` : ""}
      ${item.sala ? `<div class="room">Sala/complemento: ${esc(item.sala)}</div>` : ""}
      <div class="doctor-actions">${botoesDeVisita(item.nome)}${botaoRoteiro}</div>
      <div class="linha-meta">
        <label class="meta"><span>Meta do ciclo</span>
          <select data-acao="alvo" data-nome="${nome}">
            <option value="1"${medico.visitas === 2 ? "" : " selected"}>1 visita</option>
            <option value="2"${medico.visitas === 2 ? " selected" : ""}>2 visitas</option>
          </select>
        </label>
        ${ultima ? `<span class="visita-em">Última visita em ${esc(dataCurta(ultima))}</span>` : ""}
      </div>
      ${item.alerta ? `<span class="warning">⚠ Conferir horário cadastrado</span>` : ""}
    </div>
  </article>`;
}

function vazio(titulo, texto) {
  return `<div class="empty-state"><span>○</span><h3>${esc(titulo)}</h3><p>${esc(texto)}</p></div>`;
}

let ultimaPintura = "";

// Repintar a lista à toa tem dois custos reais: apaga o que a pessoa está
// digitando (o nome do novo ciclo) e faz a animação de entrada dos cartões
// piscar na tela inteira. Então só pinta quando o HTML mudou de verdade, e a
// animação só roda quando muda o contexto (dia, turno, busca ou aba).
function pintar(html) {
  const assinatura = `${visao.aba}|${visao.dia}|${visao.turno}|${visao.busca.trim()}`;
  if (html === ultimaPintura) {
    el("lista").classList.remove("animar");
    return;
  }
  el("lista").classList.toggle("animar", assinatura !== visao.assinatura);
  visao.assinatura = assinatura;
  ultimaPintura = html;
  el("lista").innerHTML = html;
  const campoCiclo = el("nomeNovoCiclo");
  if (campoCiclo) campoCiclo.value = visao.nomeNovoCiclo || "";
}

function desenharDisponiveis() {
  const filtrada = agendaFiltrada();
  el("eyebrowResultados").textContent = "DISPONIBILIDADE";
  el("tituloResultados").textContent = `${visao.dia} · ${visao.turno}`;
  el("contagem").textContent = `${filtrada.length} médicos`;

  const nomes = [...new Set(filtrada.map((i) => i.nome))];
  const concluidos = nomes.filter((nome) => dados.situacaoDe(nome) === "concluido").length;
  el("progresso").innerHTML = nomes.length
    ? `<b>${concluidos}</b> de ${nomes.length} com a meta batida neste turno`
    : "";

  if (!filtrada.length) {
    pintar(vazio("Nenhum médico aqui", "Tente outro dia, turno ou termo de busca."));
    return;
  }

  const doRoteiro = new Set(
    (dados.estado.ciclo?.roteiro || [])
      .filter((i) => i.dia === visao.dia && i.turno === visao.turno)
      .map((i) => i.nome),
  );

  const bairros = agrupar(filtrada, (item) => item.bairro || "Sem bairro");
  pintar(Object.entries(bairros)
    .map(([bairro, lista]) => {
      const enderecos = Object.entries(agrupar(lista, (item) => item.endereco || "Sem endereço"))
        .map(([endereco, doEndereco]) => {
          const quantos = doEndereco.length;
          return `<div class="address-group">
            <div class="address-title">
              <span class="address-name"><span>⌖</span>${esc(endereco)}</span>
              <span class="address-count">${quantos} ${quantos === 1 ? "médico" : "médicos"}</span>
            </div>
            ${doEndereco.map((item) => cartaoDisponivel(item, doRoteiro.has(item.nome))).join("")}
          </div>`;
        })
        .join("");
      return `<section class="neighborhood"><h3 class="neighborhood-title">${esc(bairro)}</h3>${enderecos}</section>`;
    })
    .join(""));
}

/* ----------------------------------------------------------- aba: roteiro */

// O pedido que originou esta tela: ver o dia inteiro de uma vez. Manhã e tarde
// aparecem juntas, em seções, sem precisar trocar de turno para saber quem é de
// qual período.
function desenharRoteiro() {
  const secoes = dados.roteiroDoDia(visao.dia);
  const total = secoes.reduce((soma, s) => soma + s.itens.length, 0);

  el("eyebrowResultados").textContent = "MEU ROTEIRO";
  el("tituloResultados").textContent = `${visao.dia} · dia inteiro`;
  el("contagem").textContent = `${total} médicos`;

  const nomes = secoes.flatMap((s) => s.itens.map((i) => i.nome));
  const concluidos = new Set(nomes.filter((nome) => dados.situacaoDe(nome) === "concluido"));
  el("progresso").innerHTML = total
    ? `<b>${concluidos.size}</b> de ${new Set(nomes).size} com a meta batida neste dia`
    : "";

  if (!total) {
    pintar(
      vazio(
        "Roteiro vazio neste dia",
        "Vá em Disponíveis, selecione os médicos da manhã e da tarde e adicione-os. Eles aparecem aqui separados por turno.",
      ),
    );
    return;
  }

  pintar(secoes
    .map((secao) => {
      if (!secao.itens.length) {
        return `<section class="turno-secao vazia">
          <h3 class="turno-titulo">${secao.turno === "Manhã" ? "☀" : "◐"} ${esc(secao.turno)} <span>0</span></h3>
          <p class="conta-detalhe">Nenhum médico neste turno.</p>
        </section>`;
      }
      const cartoes = secao.itens
        .map((item) => {
          const info = dados.disponibilidade(item.nome, item.dia, item.turno);
          const medico = dados.medicoDe(item.nome);
          const situacao = dados.situacaoDe(item.nome);
          const nome = esc(item.nome);
          return `<article class="route-card situacao-${situacao}">
            <div class="route-main">
              <div class="route-time">${esc(info?.inicio || "—")}<span>${info?.fim ? `até ${esc(info.fim)}` : ""}</span></div>
              <div>
                <h3>${nome} ${fichaVisitas(item.nome)}</h3>
                <p>${esc(
                  [medico.especialidade, info?.bairro, info?.endereco, info?.sala && `sala ${info.sala}`]
                    .filter(Boolean)
                    .join(" · ") || "Endereço não encontrado",
                )}</p>
              </div>
            </div>
            <div class="doctor-actions">${botoesDeVisita(item.nome)}</div>
            <button type="button" class="remove-button" data-acao="retirar" data-nome="${nome}" data-dia="${esc(
              item.dia,
            )}" data-turno="${esc(item.turno)}">Remover</button>
          </article>`;
        })
        .join("");
      return `<section class="turno-secao">
        <h3 class="turno-titulo">${secao.turno === "Manhã" ? "☀" : "◐"} ${esc(secao.turno)} <span>${secao.itens.length}</span></h3>
        <div class="route-list">${cartoes}</div>
      </section>`;
    })
    .join(""));
}

/* ------------------------------------------------------------- aba: ciclo */

function desenharCiclo() {
  el("eyebrowResultados").textContent = "CICLO";
  el("tituloResultados").textContent = dados.estado.ciclo ? dados.estado.ciclo.nome : "Nenhum ciclo aberto";
  el("contagem").textContent = "";
  el("progresso").innerHTML = "";

  const resumo = dados.resumoDoCiclo();
  const partes = [];

  if (resumo) {
    partes.push(`<div class="numeros">
      ${numero(resumo.medicosVisitados, "médicos visitados")}
      ${numero(resumo.totalVisitas, "visitas registradas")}
      ${numero(resumo.medicosConcluidos, "com a meta batida")}
      ${numero(resumo.medicosNoRoteiro, "no roteiro")}
      ${numero(resumo.naoEncontrados, "não encontrados")}
      ${numero(resumo.medicosNaBase, "médicos na base")}
    </div>
    <p class="conta-detalhe">Aberto em ${esc(dataLonga(resumo.inicio))}.</p>
    ${
      resumo.porDia.length
        ? `<p class="conta-detalhe">Roteiro: ${resumo.porDia.map((l) => `${esc(l.dia)} (${l.total})`).join(" · ")}</p>`
        : ""
    }
    <div class="ciclo-acoes">
      <button type="button" class="add-route" data-acao="concluir-ciclo">Concluir ciclo e guardar resumo</button>
      <button type="button" class="text-button" data-acao="baixar-copia">Baixar cópia de tudo (JSON)</button>
    </div>`);
  } else {
    partes.push(`<div class="empty-state"><span>○</span><h3>Nenhum ciclo aberto</h3>
      <p>Comece um ciclo para registrar visitas e montar roteiros.</p></div>
      <label class="campo"><span>Nome do novo ciclo</span>
        <input type="text" id="nomeNovoCiclo" maxlength="60" placeholder="Ex.: Ciclo de outubro"></label>
      <div class="ciclo-acoes">
        <button type="button" class="add-route" data-acao="novo-ciclo">Começar ciclo com a base atual</button>
        <button type="button" class="text-button" data-acao="nova-base-ciclo">Começar enviando uma base nova</button>
      </div>`);
  }

  if (dados.estado.historico.length) {
    partes.push(`<h3 class="secao-titulo">Ciclos concluídos</h3>
      <div class="historico">${dados.estado.historico
        .map((ciclo) => {
          const r = ciclo.resumo || {};
          return `<article class="historico-item">
            <div>
              <strong>${esc(ciclo.nome)}</strong>
              <p class="conta-detalhe">${esc(dataLonga(ciclo.inicio))} a ${esc(dataLonga(ciclo.fim))} · ${
                r.medicosVisitados ?? 0
              } médicos · ${r.totalVisitas ?? 0} visitas · ${r.medicosConcluidos ?? 0} com meta batida</p>
            </div>
            <button type="button" class="text-button" data-acao="baixar-resumo" data-nome="${esc(ciclo.id)}">Baixar</button>
          </article>`;
        })
        .join("")}</div>`);
  }

  pintar(partes.join(""));
}

function numero(valor, rotulo) {
  return `<div class="numero"><strong>${valor}</strong><span>${esc(rotulo)}</span></div>`;
}

/* ------------------------------------------------------------- PWA e início */

let convite = null;
window.addEventListener("beforeinstallprompt", (evento) => {
  evento.preventDefault();
  convite = evento;
  el("instalar").hidden = false;
});

el("instalar").addEventListener("click", async () => {
  if (!convite) return;
  el("instalar").hidden = true;
  convite.prompt();
  await convite.userChoice;
  convite = null;
});

window.addEventListener("appinstalled", () => {
  el("instalar").hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

window.addEventListener("online", () => dados.sincronizar().catch(() => {}));

// Link de redefinição de senha chega com o token no fragmento da URL.
function lerTokenDoLink() {
  const bruto = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  if (!bruto) return null;
  const parametros = new URLSearchParams(bruto);
  if (parametros.get("type") !== "recovery") return null;
  return parametros.get("access_token");
}

dados.observar(() => {
  if (visao.atual === "app") {
    // Redesenha sem apagar o que a pessoa está digitando na busca.
    desenhar();
  } else if (visao.atual === "base") {
    desenharRodape();
  }
  if (!el("painelConta").hidden) desenharConta();
});

(async function iniciar() {
  if (!(await deposito.funciona())) {
    avisoArmazenamento = "Este navegador não está guardando dados (navegação privada?). O app funciona, mas nada fica salvo no aparelho.";
    avisar();
  }

  visao.tokenRecuperacao = lerTokenDoLink();
  if (visao.tokenRecuperacao) {
    el("campoSenhaAtual").hidden = true;
    el("tituloSenha").textContent = "Definir nova senha";
    mostrar("senha");
    return;
  }

  dados.ligarSessao();
  await dados.carregarLocal();
  decidirTela();

  if (dados.estado.sessao) {
    const foi = await dados.sincronizar({ silencioso: false });
    if (!foi && dados.estado.ultimoErro && !dados.estado.base) {
      avisoBase = `Não consegui falar com a nuvem agora (${dados.estado.ultimoErro}).`;
      avisar();
    } else {
      avisoBase = "";
      avisar();
    }
    decidirTela();
  }
})();
