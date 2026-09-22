/*
 * Médicos disponíveis — roteiro de visitas.
 *
 * A versão original (ChatGPT Sites) guardava visitas e roteiros num banco
 * Cloudflare D1, identificando a pessoa pelos cabeçalhos `oai-authenticated-user-*`.
 * Fora daquela hospedagem nada disso existe, então aqui a mesma informação mora
 * no localStorage do aparelho — é app de uma pessoa só, e assim funciona offline,
 * que é o cenário real (prédio de consultório, elevador, sem sinal).
 * A contrapartida é que os dados são daquele navegador: por isso existem
 * Backup e Restaurar.
 */
(() => {
  "use strict";

  const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
  const TURNOS = ["Manhã", "Tarde"];
  const ROTULO_STATUS = { pending: "Pendente", visited: "Visitado", not_visited: "Não visitado" };
  const CHAVE = "medicos-disponiveis:v1";

  let medicos = [];
  let estado = { visitas: {}, roteiro: [] };
  let dia = diaDeHoje();
  let turno = new Date().getHours() < 12 ? "Manhã" : "Tarde";
  let busca = "";
  let vista = "available";
  let selecionados = new Set();

  const el = {
    dias: document.getElementById("dias"),
    turnos: document.getElementById("turnos"),
    abaDisponiveis: document.getElementById("abaDisponiveis"),
    abaRoteiros: document.getElementById("abaRoteiros"),
    contaRoteiro: document.getElementById("contaRoteiro"),
    caixaBusca: document.getElementById("caixaBusca"),
    busca: document.getElementById("busca"),
    adicionarRoteiro: document.getElementById("adicionarRoteiro"),
    mensagem: document.getElementById("mensagem"),
    eyebrow: document.getElementById("eyebrowResultados"),
    titulo: document.getElementById("tituloResultados"),
    progresso: document.getElementById("progresso"),
    contagem: document.getElementById("contagem"),
    lista: document.getElementById("lista"),
    aviso: document.getElementById("aviso"),
    avisoTexto: document.getElementById("avisoTexto"),
    instalar: document.getElementById("instalar"),
    backup: document.getElementById("backup"),
    restaurar: document.getElementById("restaurar"),
    arquivoBackup: document.getElementById("arquivoBackup"),
    novaSemana: document.getElementById("novaSemana"),
  };

  /* ---------------------------------------------------------------- utilidades */

  function diaDeHoje() {
    // Fim de semana cai em Segunda, que é onde o planejamento começa.
    const mapa = { 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta" };
    return mapa[new Date().getDay()] || "Segunda";
  }

  function semAcento(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  // A pontuação dos nomes não pode atrapalhar quem digita com pressa:
  // "Sant'anna" precisa aparecer buscando "sant anna" e também "santanna".
  function chaveBusca(texto) {
    return semAcento(texto)
      .replace(/[^\p{L}\p{N} ]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function casa(alvo, procurado) {
    if (!procurado) return true;
    return alvo.includes(procurado) || alvo.replace(/ /g, "").includes(procurado.replace(/ /g, ""));
  }

  function esc(valor) {
    return String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function agrupar(itens, chave) {
    return itens.reduce((acumulado, item) => {
      const k = chave(item);
      (acumulado[k] ??= []).push(item);
      return acumulado;
    }, {});
  }

  function hojeISO() {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const diaDoMes = String(agora.getDate()).padStart(2, "0");
    return `${agora.getFullYear()}-${mes}-${diaDoMes}`;
  }

  function dataCurta(iso) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return partes ? `${partes[3]}/${partes[2]}` : "";
  }

  // Dois avisos que não podem se sobrescrever: falhar em carregar a base de
  // médicos é uma coisa; o aparelho não guardar as marcações é outra, e pior.
  let avisoBase = "";
  let avisoArmazenamento = "";

  function avisar() {
    const texto = avisoArmazenamento || avisoBase;
    el.avisoTexto.textContent = texto;
    el.aviso.hidden = !texto;
  }

  function mensagem(texto) {
    el.mensagem.textContent = texto;
    el.mensagem.hidden = !texto;
  }

  /* ------------------------------------------------------------- persistência */

  function carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (!bruto) return;
      const lido = JSON.parse(bruto);
      estado = normalizar(lido);
    } catch {
      // Navegação privada ou armazenamento bloqueado: segue com o estado vazio.
      avisoArmazenamento = "Este navegador não está guardando as marcações. Use Backup antes de fechar o app.";
      avisar();
    }
  }

  function normalizar(lido) {
    const visitas = {};
    if (lido && typeof lido.visitas === "object" && lido.visitas) {
      for (const [nome, data] of Object.entries(lido.visitas)) {
        if (typeof nome === "string" && nome) visitas[nome] = typeof data === "string" ? data : hojeISO();
      }
    }
    // Backup antigo/de outra origem pode trazer só a lista de nomes visitados.
    if (Array.isArray(lido?.visitados)) {
      for (const nome of lido.visitados) if (typeof nome === "string" && nome) visitas[nome] ??= hojeISO();
    }
    const roteiro = [];
    const vistos = new Set();
    for (const item of Array.isArray(lido?.roteiro) ? lido.roteiro : []) {
      const nome = item?.nome ?? item?.doctorName;
      const d = item?.dia ?? item?.day;
      const t = item?.turno ?? item?.shift;
      if (!nome || !DIAS.includes(d) || !TURNOS.includes(t)) continue;
      const chave = `${nome}|${d}|${t}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const status = ROTULO_STATUS[item?.status] ? item.status : "pending";
      roteiro.push({ nome, dia: d, turno: t, status });
    }
    return { visitas, roteiro };
  }

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
      if (avisoArmazenamento) {
        avisoArmazenamento = "";
        avisar();
      }
      return true;
    } catch {
      avisoArmazenamento = "Este navegador não está guardando as marcações. Use Backup antes de fechar o app.";
      avisar();
      return false;
    }
  }

  /* ------------------------------------------------------------------- ações */

  function visitado(nome) {
    return Object.prototype.hasOwnProperty.call(estado.visitas, nome);
  }

  function alternarVisita(nome) {
    if (visitado(nome)) {
      delete estado.visitas[nome];
      // Desfazer a visita devolve o item do roteiro para pendente.
      for (const item of estado.roteiro) if (item.nome === nome && item.status === "visited") item.status = "pending";
    } else {
      estado.visitas[nome] = hojeISO();
      for (const item of estado.roteiro) if (item.nome === nome) item.status = "visited";
    }
    salvar();
    render();
  }

  function adicionarAoRoteiro() {
    const nomes = [...selecionados];
    if (!nomes.length) return;
    for (const nome of nomes) {
      const existe = estado.roteiro.some((i) => i.nome === nome && i.dia === dia && i.turno === turno);
      if (!existe) estado.roteiro.push({ nome, dia, turno, status: visitado(nome) ? "visited" : "pending" });
    }
    selecionados = new Set();
    salvar();
    vista = "routes";
    render();
    mensagem(nomes.length === 1 ? "Médico adicionado ao roteiro." : `${nomes.length} médicos adicionados ao roteiro.`);
  }

  function removerDoRoteiro(nome) {
    estado.roteiro = estado.roteiro.filter((i) => !(i.nome === nome && i.dia === dia && i.turno === turno));
    salvar();
    render();
  }

  function definirStatus(nome, status) {
    for (const item of estado.roteiro) {
      if (item.nome === nome && item.dia === dia && item.turno === turno) item.status = status;
    }
    if (status === "visited") estado.visitas[nome] ??= hojeISO();
    else delete estado.visitas[nome];
    salvar();
    render();
  }

  function novaSemana() {
    const visitas = Object.keys(estado.visitas).length;
    if (visitas === 0 && estado.roteiro.every((i) => i.status === "pending")) {
      mensagem("Nada a zerar: nenhuma visita marcada.");
      return;
    }
    const aviso =
      `Zerar as marcações de visita para começar a semana?\n\n` +
      `• ${visitas} ${visitas === 1 ? "médico marcado" : "médicos marcados"} como visitado voltam a pendente\n` +
      `• os roteiros montados por dia e turno são mantidos`;
    if (!confirm(aviso)) return;
    estado.visitas = {};
    for (const item of estado.roteiro) item.status = "pending";
    salvar();
    render();
    mensagem("Semana zerada. Os roteiros continuam montados.");
  }

  function baixarBackup() {
    const conteudo = JSON.stringify({ app: "medicos-disponiveis", versao: 1, em: new Date().toISOString(), ...estado }, null, 2);
    const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `medicos-backup-${hojeISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    mensagem("Backup gerado.");
  }

  async function lerBackup(arquivo) {
    if (!arquivo) return;
    try {
      const lido = JSON.parse(await arquivo.text());
      const novo = normalizar(lido);
      if (!Object.keys(novo.visitas).length && !novo.roteiro.length) {
        mensagem("O arquivo não tem marcações reconhecíveis.");
        return;
      }
      if (!confirm("Restaurar substitui as marcações atuais deste aparelho. Continuar?")) return;
      estado = novo;
      selecionados = new Set();
      salvar();
      render();
      mensagem("Backup restaurado.");
    } catch {
      mensagem("Não foi possível ler esse arquivo de backup.");
    }
  }

  /* ------------------------------------------------------------------ desenho */

  function controles() {
    el.dias.innerHTML = DIAS.map(
      (d) => `<button type="button" data-dia="${esc(d)}" aria-pressed="${d === dia}">${esc(d.slice(0, 3))}</button>`
    ).join("");
    el.turnos.innerHTML = TURNOS.map(
      (t) =>
        `<button type="button" data-turno="${esc(t)}" aria-pressed="${t === turno}">${t === "Manhã" ? "☀&nbsp; Manhã" : "◐&nbsp; Tarde"}</button>`
    ).join("");
  }

  function doMomento() {
    const q = chaveBusca(busca);
    return medicos.filter((m) => m.day === dia && m.shift === turno && casa(m.chaveBusca, q));
  }

  function roteiroDoMomento() {
    return estado.roteiro.filter((i) => i.dia === dia && i.turno === turno);
  }

  function informacao(nome) {
    return (
      medicos.find((m) => m.name === nome && m.day === dia && m.shift === turno) ||
      medicos.find((m) => m.name === nome) ||
      null
    );
  }

  function cartaoMedico(medico, noRoteiro) {
    const feito = visitado(medico.name);
    const escolhido = selecionados.has(medico.name);
    const nome = esc(medico.name);
    const botaoRoteiro = noRoteiro
      ? `<button type="button" class="route-toggle already" data-acao="retirar" data-nome="${nome}"><span>−</span>Retirar deste roteiro</button>`
      : `<button type="button" class="route-toggle" data-acao="selecionar" data-nome="${nome}" aria-pressed="${escolhido}"><span>${escolhido ? "✓" : "+"}</span>${escolhido ? "Selecionado — desfazer" : "Selecionar para roteiro"}</button>`;
    return `<article class="doctor-card${feito ? " visited" : ""}">
      <div class="time">${esc(medico.start)}<span>até ${esc(medico.end)}</span></div>
      <div>
        <span class="doctor-name">${nome}</span>
        ${medico.room ? `<div class="room">Sala/complemento: ${esc(medico.room)}</div>` : ""}
        <div class="doctor-actions">
          <button type="button" class="visit-toggle" data-acao="visita" data-nome="${nome}" aria-pressed="${feito}"><span>✓</span>${feito ? "Visitado — desfazer" : "Marcar como visitado"}</button>
          ${botaoRoteiro}
        </div>
        ${feito ? `<span class="visita-em">Visitado em ${esc(dataCurta(estado.visitas[medico.name]))}</span>` : ""}
        ${medico.warning ? `<span class="warning">⚠ Conferir horário cadastrado</span>` : ""}
      </div>
    </article>`;
  }

  function vazio(texto) {
    return `<div class="empty-state"><span>○</span><h3>Nenhum médico neste roteiro</h3><p>${esc(texto)}</p></div>`;
  }

  function listaDisponiveis(filtrados) {
    if (!filtrados.length) return vazio("Tente outro dia, turno ou termo de busca.");
    const doRoteiro = new Set(roteiroDoMomento().map((i) => i.nome));
    const bairros = agrupar(filtrados, (m) => m.neighborhood);
    return Object.entries(bairros)
      .map(([bairro, lista]) => {
        const enderecos = Object.entries(agrupar(lista, (m) => m.address))
          .map(([endereco, medicosDoEndereco]) => {
            const quantos = medicosDoEndereco.length;
            return `<div class="address-group">
              <div class="address-title">
                <span class="address-name"><span>⌖</span>${esc(endereco)}</span>
                <span class="address-count">${quantos} ${quantos === 1 ? "médico" : "médicos"}</span>
              </div>
              ${medicosDoEndereco.map((m) => cartaoMedico(m, doRoteiro.has(m.name))).join("")}
            </div>`;
          })
          .join("");
        return `<section class="neighborhood"><h3 class="neighborhood-title">${esc(bairro)}</h3>${enderecos}</section>`;
      })
      .join("");
  }

  function listaRoteiro(itens) {
    if (!itens.length) return vazio("Selecione médicos em Disponíveis e adicione-os a este roteiro.");
    const cartoes = itens
      .map((item) => {
        const info = informacao(item.nome);
        const nome = esc(item.nome);
        const botoes = ["pending", "visited", "not_visited"]
          .map(
            (status) =>
              `<button type="button" class="status-button ${status}" data-acao="status" data-nome="${nome}" data-status="${status}" aria-pressed="${item.status === status}">${esc(ROTULO_STATUS[status])}</button>`
          )
          .join("");
        return `<article class="route-card status-${esc(item.status)}">
          <div class="route-main">
            <div class="route-time">${esc(info?.start || "—")}<span>${info?.end ? `até ${esc(info.end)}` : ""}</span></div>
            <div>
              <h3 class="${visitado(item.nome) ? "struck" : ""}">${nome}</h3>
              <p>${esc(info?.address || "Endereço não encontrado")}${info?.room ? ` · ${esc(info.room)}` : ""}</p>
            </div>
          </div>
          <div class="status-actions">${botoes}</div>
          <button type="button" class="remove-button" data-acao="remover" data-nome="${nome}">Remover</button>
        </article>`;
      })
      .join("");
    return `<div class="route-list">${cartoes}</div>`;
  }

  let ultimaAssinatura = "";

  function render() {
    controles();
    const filtrados = doMomento();
    const doRoteiro = roteiroDoMomento();

    el.abaDisponiveis.setAttribute("aria-selected", String(vista === "available"));
    el.abaRoteiros.setAttribute("aria-selected", String(vista === "routes"));
    el.contaRoteiro.textContent = String(estado.roteiro.length);
    el.caixaBusca.hidden = vista !== "available";

    el.eyebrow.textContent = vista === "available" ? "DISPONIBILIDADE" : "MEU ROTEIRO";
    el.titulo.textContent = `${dia} · ${turno}`;
    el.contagem.textContent = `${vista === "available" ? filtrados.length : doRoteiro.length} médicos`;

    const base = vista === "available" ? filtrados : doRoteiro.map((i) => ({ name: i.nome }));
    const feitos = base.filter((m) => visitado(m.name)).length;
    el.progresso.innerHTML = base.length ? `<b>${feitos}</b> de ${base.length} já visitados neste turno` : "";

    const selecionando = vista === "available" && selecionados.size > 0;
    if (selecionando) {
      el.adicionarRoteiro.hidden = false;
      el.adicionarRoteiro.textContent = `Adicionar ${selecionados.size} ao roteiro de ${dia} · ${turno}`;
    } else {
      el.adicionarRoteiro.hidden = true;
    }
    // No celular o botão passa a flutuar no rodapé; a classe abre espaço para ele.
    document.body.classList.toggle("selecionando", selecionando);

    // A animação de entrada só faz sentido quando muda o contexto; num simples
    // "marcar como visitado" ela faria a lista inteira piscar.
    const assinatura = `${dia}|${turno}|${busca.trim()}|${vista}`;
    el.lista.classList.toggle("animar", assinatura !== ultimaAssinatura);
    ultimaAssinatura = assinatura;

    el.lista.innerHTML = vista === "available" ? listaDisponiveis(filtrados) : listaRoteiro(doRoteiro);
  }

  /* ------------------------------------------------------------------ eventos */

  el.dias.addEventListener("click", (evento) => {
    const escolhido = evento.target.closest("button[data-dia]");
    if (!escolhido) return;
    dia = escolhido.dataset.dia;
    selecionados = new Set();
    mensagem("");
    render();
  });

  el.turnos.addEventListener("click", (evento) => {
    const escolhido = evento.target.closest("button[data-turno]");
    if (!escolhido) return;
    turno = escolhido.dataset.turno;
    selecionados = new Set();
    mensagem("");
    render();
  });

  el.abaDisponiveis.addEventListener("click", () => {
    vista = "available";
    mensagem("");
    render();
  });

  el.abaRoteiros.addEventListener("click", () => {
    vista = "routes";
    mensagem("");
    render();
  });

  el.busca.addEventListener("input", () => {
    busca = el.busca.value;
    render();
  });

  el.adicionarRoteiro.addEventListener("click", adicionarAoRoteiro);
  el.backup.addEventListener("click", baixarBackup);
  el.restaurar.addEventListener("click", () => el.arquivoBackup.click());
  el.arquivoBackup.addEventListener("change", () => {
    lerBackup(el.arquivoBackup.files?.[0]);
    el.arquivoBackup.value = "";
  });
  el.novaSemana.addEventListener("click", novaSemana);

  el.lista.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-acao]");
    if (!botao) return;
    const nome = botao.dataset.nome;
    mensagem("");
    switch (botao.dataset.acao) {
      case "visita":
        alternarVisita(nome);
        break;
      case "selecionar":
        if (selecionados.has(nome)) selecionados.delete(nome);
        else selecionados.add(nome);
        render();
        break;
      case "retirar":
      case "remover":
        removerDoRoteiro(nome);
        break;
      case "status":
        definirStatus(nome, botao.dataset.status);
        break;
    }
  });

  /* ---------------------------------------------------------- instalação PWA */

  let convite = null;
  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    convite = evento;
    el.instalar.hidden = false;
  });

  el.instalar.addEventListener("click", async () => {
    if (!convite) return;
    el.instalar.hidden = true;
    convite.prompt();
    await convite.userChoice;
    convite = null;
  });

  window.addEventListener("appinstalled", () => {
    el.instalar.hidden = true;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  /* ------------------------------------------------------------------- início */

  carregar();
  render();

  fetch("medicos.json")
    .then((resposta) => (resposta.ok ? resposta.json() : Promise.reject(new Error("falhou"))))
    .then((lista) => {
      medicos = (Array.isArray(lista) ? lista : []).map((m) => ({
        ...m,
        chaveBusca: chaveBusca(`${m.name} ${m.neighborhood} ${m.address} ${m.room}`),
      }));
      avisoBase = "";
      avisar();
      render();
    })
    .catch(() => {
      avisoBase = "Não foi possível carregar a lista de médicos. Abra o app uma vez com internet para guardá-la no aparelho.";
      avisar();
    });
})();
