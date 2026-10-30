// La web publica /catalogo-huella.json con el sha256 de catalogo/es.json (CRLF→LF), como huella() de
// chat-widget/scripts/sync-catalogo.mjs. Usopp lo compara con el chat y el teléfono: si no coincide con el
// fichero fuente, el aviso de desfase sería falso. Se ejecuta tras el build.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const fuente = readFileSync('src/_data/catalogo/es.json', 'utf8').replace(/\r\n/g, '\n');
const esperado = createHash('sha256').update(fuente).digest('hex');
const publicado = JSON.parse(readFileSync('_site/catalogo-huella.json', 'utf8'));

const fallos = [];
if (!/^[0-9a-f]{64}$/.test(publicado.sha256 ?? '')) fallos.push(`sha256 no válido: ${publicado.sha256}`);
if (publicado.sha256 !== esperado) fallos.push(`publicado ${publicado.sha256} ≠ fuente ${esperado}`);
if (readFileSync('_site/sitemap.xml', 'utf8').includes('catalogo-huella')) fallos.push('aparece en el sitemap');

if (fallos.length) {
  console.error('check-huella: FALLA\n- ' + fallos.join('\n- '));
  process.exit(1);
}
console.log(`check-huella: OK (${esperado.slice(0, 8)}…)`);
