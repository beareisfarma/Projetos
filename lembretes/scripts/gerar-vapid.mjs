// Gera o par de chaves VAPID que identifica este app junto aos serviços de push
// (Apple, Google, Mozilla). Usa só o crypto do Node — roda antes de qualquer
// npm install. A chave privada é segredo: vai para a Vercel, nunca para o git.
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });

// A chave pública no formato que o navegador espera: ponto não comprimido 0x04||X||Y.
const ponto = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(jwk.x, 'base64url'),
  Buffer.from(jwk.y, 'base64url'),
]);

console.log(`
Chaves VAPID geradas. Guarde as duas na Vercel (Settings → Environment Variables):

VAPID_PUBLIC_KEY=${ponto.toString('base64url')}
VAPID_PRIVATE_KEY=${jwk.d}
VAPID_SUBJECT=mailto:beareisfarma@gmail.com

A pública também é servida pelo /api/subscribe, então não precisa colar no front.
A privada NÃO pode ir para o git.
`);
