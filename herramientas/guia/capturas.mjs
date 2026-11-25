// Saca las capturas de la guía de uso con la app en la nube (emulador de Firebase).
// Uso (desde la raíz del repo):
//   npx firebase emulators:exec --only auth,firestore --project demo-licencias "node herramientas/guia/capturas.mjs"
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = 'file://' + path.join(RAIZ, 'index.html') + '?emulador';
const SDK = path.join(RAIZ, 'node_modules', 'firebase');
const OUT = path.join(RAIZ, 'herramientas', 'guia', 'img');
const AUTH = 'http://127.0.0.1:9099';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-licencias/databases/(default)/documents';
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const W = 1366;
mkdirSync(OUT, { recursive: true });

async function ponerDoc(ruta, campos) {
  const fields = Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: v }]));
  await fetch(`${FS}/${ruta}`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields }) });
}
async function cuenta(email, nombre, rol) {
  const r = await (await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'secreta1', returnSecureToken: true }) })).json();
  await ponerDoc(`usuarios/${r.localId}`, { nombre, email, rol, activo: true, codigo: 'X' });
}

await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-licencias/databases/(default)/documents', { method: 'DELETE' });
await fetch(`${AUTH}/emulator/v1/projects/demo-licencias/accounts`, { method: 'DELETE' });
await ponerDoc('config/acceso', { codigo: 'ZIGE-7K4P-2QX9' });
await cuenta('admin@supervision.com', 'Administradora', 'admin');
await cuenta('secretario@supervision.com', 'Secretario Técnico', 'carga');
await cuenta('supervisora@supervision.com', 'Supervisora', 'consulta');

const b = await chromium.launch({ args: ['--lang=es-AR'], env: { ...process.env, LANG: 'es_AR.UTF-8', LC_ALL: 'es_AR.UTF-8' } });
const errores = [];
let caido = false;
async function nuevoContexto(ancho = W, alto = 820, escala = 2) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: escala, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  await ctx.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ status: 200, contentType: 'application/javascript',
    body: readFileSync(path.join(SDK, path.basename(new URL(r.request().url()).pathname))) }));
  await ctx.route(/127\.0\.0\.1:(8080|9099)/, r => caido ? r.abort() : r.continue());
  return ctx;
}
async function pagina(ctx) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errores.push(e.message)); p.on('dialog', d => d.accept());
  await p.clock.install({ time: new Date('2026-11-25T10:00:00') });
  await p.goto(APP); await p.waitForSelector('.ingreso'); await p.waitForTimeout(400);
  return p;
}
async function entrar(p, email) {
  await p.fill('input[name=email]', email); await p.fill('input[name=clave]', 'secreta1');
  await p.click('form[data-form="ingreso-entrar"] button');
  await p.waitForFunction(() => NubeDatos.listo && !NubeDatos.pendientes, null, { timeout: 20000 });
  await p.waitForTimeout(600);
}
const espera = p => p.waitForTimeout(450);
// En el emulador la pantalla de ingreso dice "Modo prueba": para la guía se muestra como en la app real
const comoReal = p => p.evaluate(() => document.querySelectorAll('.ingreso-marca .muted').forEach(e => { e.textContent = INSTITUCION; }));
const sinToast = p => p.evaluate(() => document.querySelectorAll('#toast-root *').forEach(e => e.remove()));
const foto = async (p, n, opts = {}) => { await espera(p); await sinToast(p); await p.screenshot({ path: `${OUT}/${n}.png`, ...opts }); console.log('ok', n); };
const recorte = async (p, n, sel, pad = 0) => {
  await espera(p); await sinToast(p); const bb = await p.locator(sel).first().boundingBox();
  const vp = p.viewportSize();
  await p.screenshot({ path: `${OUT}/${n}.png`, clip: { x: Math.max(0, bb.x - pad), y: Math.max(0, bb.y - pad), width: Math.min(vp.width, bb.width + pad * 2), height: bb.height + pad * 2 } });
  console.log('ok', n);
};
const ir = (p, fn, arg) => p.evaluate(fn, arg).then(() => espera(p));
const cerrarModal = async p => { await p.evaluate(() => cerrarModal()); await espera(p); };

// ---------- 1) Ingreso y registro ----------
const ctxNueva = await nuevoContexto();
let p = await pagina(ctxNueva);
await comoReal(p);
await recorte(p, '01-ingresar', '.ingreso', 24);
await p.click('[data-act="ingreso-tab"][data-v="registro"]');
await p.fill('input[name=nombre]', 'Secretaria Técnica'); await p.fill('input[name=email]', 'secretaria@supervision.com');
await p.fill('input[name=clave]', 'secreta1'); await p.check('input[name=rol][value=carga]'); await p.fill('input[name=codigo]', 'ZIGE-7K4P-2QX9');
await comoReal(p);
await recorte(p, '02-registro', '.ingreso', 24);
await ctxNueva.close();

// ---------- 2) Administradora: datos de ejemplo, usuarios, pestañas, respaldo ----------
const ctxAdmin = await nuevoContexto();
const A = await pagina(ctxAdmin);
await entrar(A, 'admin@supervision.com');
await A.evaluate(() => {
  cargarEjemplo();
  // Para la guía, sin la palabra "Ejemplo" ni el aviso de datos de prueba
  mutar(e => {
    e.agentes.forEach(a => { a.apellido = a.apellido.replace('Ejemplo ', ''); delete a.ejemplo; tocar(a); });
    e.licencias.forEach(l => { delete l.ejemplo; }); e.notas.forEach(n => { delete n.ejemplo; });
    e.config.ciclos = { 2026: { inicio: '2026-03-02', fin: '2026-12-18' } };
  });
});
await A.waitForFunction(() => !NubeDatos.pendientes, null, { timeout: 20000 }); await A.waitForTimeout(800);
await ir(A, () => { ui.ajustesTab = 'usuarios'; location.hash = '#ajustes'; render(); });
await A.waitForSelector('#main table.t tbody tr'); await A.waitForTimeout(600);
await foto(A, '18-usuarios', { clip: { x: 0, y: 0, width: W, height: 640 } });
await ir(A, () => { ui.ajustesTab = 'pestanas'; render(); });
await foto(A, '17-pestanas', { clip: { x: 0, y: 0, width: W, height: 640 } });
await ir(A, () => { ui.ajustesTab = 'datos'; render(); });
await foto(A, '19-respaldo', { clip: { x: 0, y: 0, width: W, height: 640 } });

// ---------- 3) Secretario: el uso de todos los días ----------
const ctxCarga = await nuevoContexto();
p = await pagina(ctxCarga);
await entrar(p, 'secretario@supervision.com');
await ir(p, () => { elegirPestana(''); ui.fecha = hoyISO(); ir('inicio'); });
await recorte(p, '03-barra', 'header.top');
await recorte(p, '03b-pestanas', '#pestanas');
await p.click('#btn-usuario'); await recorte(p, '04-menu-usuario', '.modal'); await cerrarModal(p);
await foto(p, '05-todos', { fullPage: true });
await ir(p, () => { elegirPestana('cepja-11'); ir('inicio'); });
await foto(p, '06-inicio-cepja', { clip: { x: 0, y: 0, width: W, height: 820 } });
await ir(p, () => { ir('agentes'); });
await foto(p, '07-lista-cepja', { clip: { x: 0, y: 0, width: W, height: 640 } });

// Nueva persona en un CEPJA
await p.click('[data-act="nuevo-agente"]'); await espera(p);
await p.fill('.modal [data-a=apellido]', 'Pérez'); await p.fill('.modal [data-a=nombre]', 'Juana'); await p.fill('.modal [data-a=dni]', '30123456');
await p.fill('.modal [data-c=catedra]', 'Química'); await p.fill('.modal [data-c=idCargo]', '108344'); await p.fill('.modal [data-c=hs]', '4'); await p.fill('.modal [data-c=cursoDiv]', '3° 1ª');
await p.setViewportSize({ width: W, height: 1700 }); await espera(p);
await recorte(p, '08-nuevo-agente', '.modal');
await p.setViewportSize({ width: W, height: 820 });
await cerrarModal(p);
// Un cargo de directores, con escuela
await ir(p, () => { elegirPestana('directores'); });
await p.setViewportSize({ width: W, height: 1700 });
await p.evaluate(() => abrirFormAgente(estado.agentes.find(a => a.apellido === 'Álvarez').id)); await espera(p);
{ const bb = await p.locator('.modal [data-cargo]').first().boundingBox(); await sinToast(p);
  await p.screenshot({ path: `${OUT}/08b-cargo-escuela.png`, clip: { x: bb.x, y: bb.y, width: bb.width, height: 170 } }); console.log('ok 08b'); }
await p.setViewportSize({ width: W, height: 820 });
await cerrarModal(p);

// Licencia de 20° b en un cargo
await ir(p, () => { elegirPestana('cepja-11'); ir('agentes'); });
await p.evaluate(() => formLicencia({ agenteId: estado.agentes.find(a => a.apellido === 'Benítez').id })); await espera(p);
await p.selectOption('.modal [data-f="articulo"]', '233-20b'); await p.locator('.modal [data-f="articulo"]').dispatchEvent('change'); await espera(p);
// sólo Física (el segundo cargo del CEPJA 11)
await p.locator('.modal [data-f=cargos] input').nth(0).uncheck(); await espera(p);
await p.fill('.modal [data-f="desde"]', '2026-11-30'); await p.locator('.modal [data-f="desde"]').dispatchEvent('change'); await espera(p);
await p.fill('.modal [data-f="cant"]', '1'); await p.locator('.modal [data-f="cant"]').dispatchEvent('input'); await espera(p);
await p.setViewportSize({ width: W, height: 1500 }); await espera(p);
await recorte(p, '09-licencia', '.modal');
await p.setViewportSize({ width: W, height: 820 });
await cerrarModal(p);

// Ficha
await ir(p, () => { ui.anio = 2026; ui.fichaTab = 'planilla'; ir('agente/' + estado.agentes.find(a => a.apellido === 'Benítez').id); });
await foto(p, '10-ficha', { fullPage: true });
await p.click('[data-act="ficha-tab"][data-v="articulos"]'); await espera(p);
await recorte(p, '11-ficha-articulos', '#main [data-tab="articulos"]');

// Nota
await ir(p, () => { ir('inicio'); });
await p.locator('[data-act="nueva-nota"]').first().click(); await espera(p);
await p.locator('.modal textarea').fill('Pedir certificado a Benítez');
await recorte(p, '12-nota', '.modal'); await cerrarModal(p);

// Reportes y nómina
await ir(p, () => { ui.repTab = 'licencias'; ui.rep.desde = '2026-01-01'; ui.rep.hasta = '2026-12-31'; ir('reportes'); });
await foto(p, '13-reportes', { clip: { x: 0, y: 0, width: W, height: 700 } });
await ir(p, () => { ui.repTab = 'nomina'; render(); });
await foto(p, '14-nomina', { clip: { x: 0, y: 0, width: W, height: 560 } });

// Ajustes
await ir(p, () => { ui.ajustesTab = 'calendario'; ui.calAnio = 2026; ir('ajustes'); });
await foto(p, '15-calendario', { clip: { x: 0, y: 0, width: W, height: 760 } });
await ir(p, () => { ui.ajustesTab = 'articulos'; render(); });
{ const fila = p.locator('#main tr[data-art="233-20b"]'); await fila.scrollIntoViewIfNeeded(); await espera(p);
  const bb = await fila.boundingBox(); const tabla = await fila.locator('xpath=ancestor::table[1]').boundingBox();
  await sinToast(p);
  await p.screenshot({ path: `${OUT}/16-articulos.png`, clip: { x: tabla.x, y: Math.max(0, bb.y - 150), width: tabla.width, height: 300 } }); console.log('ok 16'); }

// ---------- 4) En el celular ----------
const ctxCelu = await nuevoContexto(390, 844, 2);
const C = await pagina(ctxCelu);
await entrar(C, 'supervisora@supervision.com');
await ir(C, () => { elegirPestana('cepja-11'); ir('agentes'); });
await foto(C, '22-celu-lista');
await ctxCelu.close();

// ---------- 5) Servidor caído: modo emergencia ----------
await p.waitForFunction(() => !!leerCopiaEnCompu(), null, { timeout: 40000 });
await p.click('#btn-usuario'); await p.click('.modal [data-x="salir"]');
await p.waitForTimeout(3000); await p.waitForLoadState();
caido = true;
await p.goto(APP); await p.waitForSelector('[data-act="emergencia-entrar"]', { timeout: 20000 });
await comoReal(p);
await recorte(p, '20-ingreso-emergencia', '.ingreso', 24);
await p.click('[data-act="emergencia-entrar"]'); await p.waitForSelector('#banners .banner.err'); await espera(p);
await foto(p, '21-emergencia', { clip: { x: 0, y: 0, width: W, height: 420 } });

console.log(errores.length ? errores : 'sin errores');
await b.close();
