/*
 * Conversa com o Supabase: contas e leitura/escrita das tabelas.
 *
 * Não usa a biblioteca oficial de propósito — são quatro rotas REST e a
 * biblioteca traria 100 KB para o app carregar offline. O que protege os dados
 * não é esta camada: é o RLS no banco, que só entrega as linhas de quem pede
 * (policy `usuario = auth.uid()`). A chave que vai no navegador é a publicável,
 * feita para isso; a service_role só existe dentro da Edge Function.
 */

import { CONFIG } from "../config.js";

const AUTH = `${CONFIG.url}/auth/v1`;
const REST = `${CONFIG.url}/rest/v1`;
const FUNCOES = `${CONFIG.url}/functions/v1`;

let sessao = null;
let aoTrocarSessao = () => {};

export function definirSessao(nova) {
  sessao = nova;
}

export function sessaoAtual() {
  return sessao;
}

export function observarSessao(callback) {
  aoTrocarSessao = callback;
}

function montarSessao(resposta) {
  return {
    token: resposta.access_token,
    renovacao: resposta.refresh_token,
    // 60 s de folga: token que expira no meio do pedido derruba a tela.
    expiraEm: Date.now() + Math.max(0, (resposta.expires_in ?? 3600) - 60) * 1000,
    usuario: { id: resposta.user?.id, email: resposta.user?.email },
  };
}

async function corpo(resposta) {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return { erro: texto };
  }
}

function mensagemDeErro(dados, padrao) {
  const bruta = dados?.erro || dados?.error_description || dados?.msg || dados?.message || dados?.error;
  if (!bruta) return padrao;
  if (/invalid login credentials/i.test(bruta)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(bruta)) return "Conta ainda não confirmada.";
  if (/rate limit|too many/i.test(bruta)) return "Muitas tentativas. Espere alguns minutos.";
  if (/password should be at least/i.test(bruta)) return "A senha precisa de pelo menos 8 caracteres.";
  return bruta;
}

/* --------------------------------------------------------------------- contas */

export async function cadastrar({ email, senha, codigo }) {
  const resposta = await fetch(`${FUNCOES}/cadastrar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CONFIG.chave },
    body: JSON.stringify({ email, senha, codigo }),
  });
  const dados = await corpo(resposta);
  if (!resposta.ok) throw new Error(mensagemDeErro(dados, "Não foi possível criar a conta."));
  return dados;
}

export async function entrar({ email, senha }) {
  const resposta = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CONFIG.chave },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password: senha }),
  });
  const dados = await corpo(resposta);
  if (!resposta.ok) throw new Error(mensagemDeErro(dados, "Não foi possível entrar."));
  sessao = montarSessao(dados);
  aoTrocarSessao(sessao);
  return sessao;
}

export async function renovar() {
  if (!sessao?.renovacao) throw new Error("Sessão expirada.");
  const resposta = await fetch(`${AUTH}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CONFIG.chave },
    body: JSON.stringify({ refresh_token: sessao.renovacao }),
  });
  const dados = await corpo(resposta);
  if (!resposta.ok) {
    sessao = null;
    aoTrocarSessao(null);
    throw new Error("Sessão expirada. Entre novamente.");
  }
  sessao = montarSessao(dados);
  aoTrocarSessao(sessao);
  return sessao;
}

export async function sair() {
  const token = sessao?.token;
  sessao = null;
  aoTrocarSessao(null);
  if (!token) return;
  // Falhar aqui não importa: a sessão local já foi descartada.
  await fetch(`${AUTH}/logout`, {
    method: "POST",
    headers: { apikey: CONFIG.chave, Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

export async function pedirRecuperacao(email) {
  const resposta = await fetch(`${AUTH}/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CONFIG.chave },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!resposta.ok) throw new Error(mensagemDeErro(await corpo(resposta), "Não foi possível enviar o e-mail."));
  return true;
}

// Usada tanto na redefinição por e-mail (token vindo do link) quanto na troca
// de senha com a sessão aberta.
export async function definirSenha(novaSenha, tokenDoLink) {
  const token = tokenDoLink || sessao?.token;
  if (!token) throw new Error("Sessão expirada.");
  const resposta = await fetch(`${AUTH}/user`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", apikey: CONFIG.chave, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password: novaSenha }),
  });
  if (!resposta.ok) throw new Error(mensagemDeErro(await corpo(resposta), "Não foi possível trocar a senha."));
  return true;
}

/* ---------------------------------------------------------------- tabelas */

async function rest(caminho, opcoes = {}, jaRenovou = false) {
  if (!sessao) throw new Error("Sem sessão.");
  if (Date.now() > sessao.expiraEm && !jaRenovou) await renovar();

  const resposta = await fetch(`${REST}${caminho}`, {
    ...opcoes,
    headers: {
      apikey: CONFIG.chave,
      Authorization: `Bearer ${sessao.token}`,
      "Content-Type": "application/json",
      ...(opcoes.headers || {}),
    },
  });

  // Token recusado: uma tentativa de renovar, e só uma (senão vira laço).
  if (resposta.status === 401 && !jaRenovou) {
    await renovar();
    return rest(caminho, opcoes, true);
  }

  const dados = await corpo(resposta);
  if (!resposta.ok) throw new Error(mensagemDeErro(dados, `Falha na nuvem (${resposta.status}).`));
  return dados;
}

// Chamada às funções de borda com a identidade de quem está logado. Quem
// decide o que a pessoa pode fazer é o SQL lá dentro, não esta camada.
async function funcao(nome, pedido, jaRenovou = false) {
  if (!sessao) throw new Error("Sem sessão.");
  if (Date.now() > sessao.expiraEm && !jaRenovou) await renovar();

  const resposta = await fetch(`${FUNCOES}/${nome}`, {
    method: "POST",
    headers: {
      apikey: CONFIG.chave,
      Authorization: `Bearer ${sessao.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pedido),
  });

  if (resposta.status === 401 && !jaRenovou) {
    await renovar();
    return funcao(nome, pedido, true);
  }

  const dados = await corpo(resposta);
  if (!resposta.ok) throw new Error(mensagemDeErro(dados, "Não foi possível falar com o servidor."));
  return dados;
}

export const convites = {
  listar: () => funcao("convites", { acao: "listar" }),
  criar: (nota) => funcao("convites", { acao: "criar", nota }),
  revogar: (codigo) => funcao("convites", { acao: "revogar", codigo }),
};

const CAMPOS_BASE = "id,nome,origem,conteudo,criado_em,atualizado_em";
const CAMPOS_CICLO = "id,base_id,nome,inicio,fim,estado,visitas,roteiro,resumo,criado_em,atualizado_em";

// A permissão de convidar vem do banco, nunca de um palpite da tela.
export async function lerPerfil() {
  const linhas = await rest("/perfis?select=pode_convidar&limit=1");
  return linhas?.[0] ?? null;
}

export function listarBases() {
  return rest(`/bases?select=${CAMPOS_BASE}&order=atualizado_em.desc`);
}

export async function criarBase({ nome, origem, conteudo }) {
  const criado = await rest("/bases", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ nome, origem, conteudo }),
  });
  return criado?.[0] ?? null;
}

export async function atualizarBase(id, campos) {
  const salvo = await rest(`/bases?id=eq.${encodeURIComponent(id)}&select=${CAMPOS_BASE}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(campos),
  });
  return salvo?.[0] ?? null;
}

export function listarCiclos() {
  return rest(`/ciclos?select=${CAMPOS_CICLO}&order=criado_em.desc`);
}

export async function criarCiclo(ciclo) {
  const criado = await rest("/ciclos", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(ciclo),
  });
  return criado?.[0] ?? null;
}

export async function atualizarCiclo(id, campos) {
  const salvo = await rest(`/ciclos?id=eq.${encodeURIComponent(id)}&select=${CAMPOS_CICLO}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(campos),
  });
  return salvo?.[0] ?? null;
}
