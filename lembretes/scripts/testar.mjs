// Runner dos testes. O web-push só fala HTTPS, então o serviço de push falso
// precisa de certificado. Em vez de desligar a verificação de TLS, emitimos um
// certificado local e o adicionamos às CAs confiáveis apenas deste processo.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pasta = mkdtempSync(join(tmpdir(), 'lembretes-tls-'));
const cert = join(pasta, 'cert.pem');
const chave = join(pasta, 'chave.pem');

const openssl = spawnSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
  '-keyout', chave, '-out', cert,
  '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1',
], { encoding: 'utf8' });

const temTls = openssl.status === 0 && existsSync(cert);
if (!temTls) {
  console.warn('⚠️  openssl indisponível: os testes de entrega de push serão pulados.\n');
}

const { status } = spawnSync('node', ['--test', 'tests/*.test.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...(temTls ? { NODE_EXTRA_CA_CERTS: cert, TLS_CERT: cert, TLS_CHAVE: chave } : {}),
  },
});
process.exit(status ?? 1);
