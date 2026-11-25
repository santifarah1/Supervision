// Ayudas para las pruebas de la app en el navegador (Playwright).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP = 'file://' + path.join(RAIZ, 'index.html');
const SDK = path.join(RAIZ, 'node_modules', 'firebase');

export const EMU_AUTH = 'http://127.0.0.1:9099';
export const EMU_FS = 'http://127.0.0.1:8080/v1/projects/demo-licencias/databases/(default)/documents';
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

export async function navegador() {
  // Idioma argentino: fechas dd/mm/aaaa como las ve la escuela
  return chromium.launch({ args: ['--lang=es-AR'], env: { ...process.env, LANG: 'es_AR.UTF-8', LC_ALL: 'es_AR.UTF-8' } });
}

/* Contexto con el SDK de Firebase servido desde node_modules (sin internet) */
export async function contexto(b, opciones = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true, ...opciones });
  await ctx.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({
    status: 200, contentType: 'application/javascript',
    body: readFileSync(path.join(SDK, path.basename(new URL(r.request().url()).pathname))),
  }));
  return ctx;
}

/* Página con los errores de JavaScript anotados en p.errores */
export async function pagina(ctx, url = APP) {
  const p = await ctx.newPage();
  p.errores = [];
  p.on('pageerror', e => p.errores.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(url);
  await p.waitForFunction(() => typeof estado === 'object' && estado !== null || document.querySelector('.ingreso'));
  return p;
}

/* ---------- Emulador ---------- */
export async function vaciarEmulador() {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-licencias/databases/(default)/documents', { method: 'DELETE' });
  await fetch(`${EMU_AUTH}/emulator/v1/projects/demo-licencias/accounts`, { method: 'DELETE' });
}
export async function ponerDoc(ruta, campos) {
  const v = x => typeof x === 'string' ? { stringValue: x } : typeof x === 'boolean' ? { booleanValue: x } : typeof x === 'number' ? { integerValue: String(x) } : { nullValue: null };
  const r = await fetch(`${EMU_FS}/${ruta}`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(campos).map(([k, x]) => [k, v(x)])) }) });
  if (!r.ok) throw new Error('No se pudo escribir ' + ruta + ': ' + r.status);
}
export async function crearCuenta(email, nombre, rol) {
  const r = await (await fetch(`${EMU_AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'secreta1', returnSecureToken: true }),
  })).json();
  await ponerDoc(`usuarios/${r.localId}`, { nombre, email, rol, activo: true, codigo: 'X' });
  return r.localId;
}
export async function contarDocs(col) {
  let n = 0, tok = '';
  do {
    const r = await (await fetch(`${EMU_FS}/datos/${col}/registros?pageSize=300${tok ? '&pageToken=' + tok : ''}`, { headers: OWNER })).json();
    n += (r.documents || []).length; tok = r.nextPageToken || '';
  } while (tok);
  return n;
}
/* Entra con mail y contraseña y espera a que lleguen los datos */
export async function entrar(ctx, email) {
  const p = await pagina(ctx, APP + '?emulador');
  await p.waitForSelector('form[data-form="ingreso-entrar"]');
  await p.fill('input[name=email]', email); await p.fill('input[name=clave]', 'secreta1');
  await p.click('form[data-form="ingreso-entrar"] button');
  await p.waitForFunction(() => typeof NubeDatos === 'object' && NubeDatos.listo, null, { timeout: 20000 });
  return p;
}
/* Espera a que una condición en la página se cumpla (para cambios que llegan del servidor) */
export function esperar(p, fn, arg, timeout = 15000) {
  return p.waitForFunction(fn, arg, { timeout, polling: 200 });
}
