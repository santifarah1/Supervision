// Arma el PDF de la guía a partir de guia.html y las capturas de img/.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.resolve(AQUI, '..', '..', 'docs', 'Guia-Licencias-Supervision-Zona-I.pdf');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + path.join(AQUI, 'guia.html'), { waitUntil: 'load' });
const rotas = await p.$$eval('img', is => is.filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')));
if (rotas.length) { console.error('Faltan imágenes:', rotas); process.exit(1); }
await p.pdf({ path: SALIDA, format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;text-align:center;font:8px system-ui,sans-serif;color:#585e67">Guía de uso — Licencias · Supervisión Secundaria Zona I Valle Inferior · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
  margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' } });
await b.close();
console.log('PDF listo:', path.relative(process.cwd(), SALIDA));
