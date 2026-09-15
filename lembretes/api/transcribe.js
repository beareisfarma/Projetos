// Transcrição do áudio gravado no celular. O áudio chega em base64 dentro do JSON
// (um recado de voz tem poucas centenas de KB, bem abaixo do limite de corpo da
// plataforma) — assim não dependemos de multipart nem de stream cru.
//
// Provedor: Groq (whisper-large-v3-turbo) se GROQ_API_KEY estiver definida,
// senão OpenAI. A Claude API não recebe áudio, por isso um serviço à parte.
import { json, erro, autorizado, lerJson, comErros } from './_lib/http.js';

const LIMITE_BYTES = 4 * 1024 * 1024;

const PROVEDORES = [
  {
    nome: 'groq',
    env: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    modelo: process.env.GROQ_MODELO_AUDIO || 'whisper-large-v3-turbo',
  },
  {
    nome: 'openai',
    env: 'OPENAI_API_KEY',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    modelo: process.env.OPENAI_MODELO_AUDIO || 'whisper-1',
  },
];

const extensao = (mime) => ({
  'audio/mp4': 'mp4', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
}[String(mime).split(';')[0]] || 'webm');

export default comErros(async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return erro(res, 405, 'Método não permitido.');
  }
  if (!autorizado(req)) return erro(res, 401, 'PIN inválido.');

  const provedor = PROVEDORES.find((p) => process.env[p.env]);
  if (!provedor) {
    return erro(res, 503, 'Transcrição indisponível: defina GROQ_API_KEY ou OPENAI_API_KEY.');
  }

  const { audio, mime } = await lerJson(req);
  if (!audio) return erro(res, 400, 'Envie o áudio em base64 no campo "audio".');

  const bytes = Buffer.from(audio, 'base64');
  if (bytes.length === 0) return erro(res, 400, 'Áudio vazio.');
  if (bytes.length > LIMITE_BYTES) return erro(res, 413, 'Áudio grande demais — grave até 2 minutos.');

  const tipo = String(mime || 'audio/webm').split(';')[0];
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: tipo }), `recado.${extensao(tipo)}`);
  form.append('model', provedor.modelo);
  form.append('language', 'pt');
  form.append('response_format', 'json');

  const resposta = await fetch(provedor.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env[provedor.env]}` },
    body: form,
  });
  const textoBruto = await resposta.text();
  if (!resposta.ok) {
    console.error(`[transcricao/${provedor.nome}]`, resposta.status, textoBruto.slice(0, 300));
    return erro(res, 502, `Falha ao transcrever (${provedor.nome} ${resposta.status}).`);
  }

  const { text } = JSON.parse(textoBruto);
  const transcrito = String(text || '').trim();
  if (!transcrito) return erro(res, 422, 'Não consegui entender o áudio. Tente de novo ou digite.');

  return json(res, 200, { texto: transcrito, provedor: provedor.nome });
});
