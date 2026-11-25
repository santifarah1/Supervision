// Pruebas de la app con usuarios y datos en la nube, contra el emulador de Firebase.
// Se corren con `npm test` (prende el emulador solo).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { navegador, contexto, pagina, entrar, esperar, vaciarEmulador, ponerDoc, crearCuenta, contarDocs, APP } from './ayuda.mjs';

const CODIGO = 'ESRN-PRUE-BA42';
const DIR = mkdtempSync(path.join(tmpdir(), 'licencias-nube-'));
let b;
before(async () => {
  await vaciarEmulador();
  await ponerDoc('config/acceso', { codigo: CODIGO });
  await crearCuenta('santi@prueba.com', 'Santi Admin', 'admin');
  await crearCuenta('mama@prueba.com', 'Marta Carga', 'carga');
  b = await navegador();
});
after(async () => { await b.close(); });
const sinErrores = p => assert.deepEqual(p.errores, [], 'errores en la página: ' + p.errores.join(' | '));
const salir = async (p, cual = 'salir') => {
  await p.click('#btn-usuario'); await p.click(`.modal [data-x="${cual}"]`);
  // al salir la página se recarga: se espera a que termine
  await p.waitForSelector('.ingreso', { timeout: 15000 });
  await p.waitForTimeout(2500); await p.waitForLoadState();
  await p.waitForSelector('.ingreso', { timeout: 15000 });
};

test('Registro: con código equivocado no entra; con el código bien entra como consulta y no puede cargar', async () => {
  const ctx = await contexto(b);
  const p = await pagina(ctx, APP + '?emulador');
  await p.waitForSelector('.ingreso');
  await p.click('[data-act="ingreso-tab"][data-v="registro"]');
  await p.fill('input[name=nombre]', 'Directora Prueba'); await p.fill('input[name=email]', 'dire@prueba.com');
  await p.fill('input[name=clave]', 'secreta1'); await p.check('input[name=rol][value=consulta]');
  await p.fill('input[name=codigo]', 'ESRN-MAL-0000');
  await p.click('form[data-form="ingreso-registro"] button');
  await p.waitForSelector('.ingreso .msg.err', { timeout: 15000 });
  assert.equal(await p.locator('.ingreso').count(), 1);
  // el mismo mail con el código bien (en minúsculas y con espacios: se acomoda solo)
  await p.fill('input[name=clave]', 'secreta1'); await p.fill('input[name=codigo]', ' esrn-prue-ba42 ');
  await p.click('form[data-form="ingreso-registro"] button');
  await p.waitForFunction(() => !document.querySelector('.ingreso') && NubeDatos.listo, null, { timeout: 20000 });
  assert.ok(!(await p.locator('#btn-nueva').isVisible()), 'consulta no debería ver "+ Licencia"');
  // aunque lo intente por debajo, el servidor no le deja escribir
  const n = await contarDocs('agentes');
  await p.evaluate(() => mutar(e => { e.agentes.push(sellar({ apellido: 'Intruso', nombre: 'X', regimen: '233', cargos: [] })); }));
  await p.waitForTimeout(2500);
  assert.equal(await contarDocs('agentes'), n);
  await ctx.close();
});

test('Datos compartidos: lo que sube el admin lo ve la de carga, y lo que ella carga le llega al admin al instante', async () => {
  const ctxA = await contexto(b), ctxM = await contexto(b);
  const A = await entrar(ctxA, 'santi@prueba.com');
  // el admin carga el ejemplo y queda en el servidor
  await A.evaluate(() => { cargarEjemplo(); });
  await esperar(A, () => !NubeDatos.pendientes);
  const agentes = await A.evaluate(() => vivos(estado.agentes).length);
  assert.ok(agentes > 0);
  assert.equal(await contarDocs('agentes'), await A.evaluate(() => estado.agentes.length));
  const M = await entrar(ctxM, 'mama@prueba.com');
  await esperar(M, n => vivos(estado.agentes).length === n, agentes);
  // los cálculos dan igual en las dos compus
  const resumen = p => p.evaluate(() => { const ctx = contexto(); return vivos(estado.agentes).sort((x, y) => x.id < y.id ? -1 : 1).map(a => a.id + ':' + resumenAgente(a, 2026, '2026-11-20', ctx).map(f => f.totalAnio).join(',')).join('|'); });
  assert.equal(await resumen(M), await resumen(A));
  // mamá carga una licencia → le aparece al admin sin recargar
  await M.evaluate(() => { const ag = vivos(estado.agentes)[0]; mutar(e => { e.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-1', desde: '2026-11-23', hasta: '2026-11-23', cargos: [], tramites: {}, obs: 'desde la compu de mamá' })); }); });
  await esperar(A, () => estado.licencias.some(l => l.obs === 'desde la compu de mamá'));
  // el admin borra un agente → a mamá se le va
  const id = await A.evaluate(() => { const ag = vivos(estado.agentes).at(-1); mutar(() => { ag.borrado = true; tocar(ag); }); return ag.id; });
  await esperar(M, id => estado.agentes.find(a => a.id === id)?.borrado === true, id);
  sinErrores(A); sinErrores(M);
  await ctxA.close(); await ctxM.close();
});

test('Sin internet: lo cargado queda guardado y se sube solo al volver', async () => {
  const ctx = await contexto(b);
  const M = await entrar(ctx, 'mama@prueba.com');
  await esperar(M, () => vivos(estado.agentes).length > 0);
  await ctx.setOffline(true);
  await M.evaluate(() => { const ag = vivos(estado.agentes)[0]; mutar(e => { e.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-1', desde: '2026-11-26', hasta: '2026-11-26', cargos: [], tramites: {}, obs: 'sin internet' })); }); });
  await M.waitForTimeout(1500);
  const buscar = async () => {
    const { EMU_FS } = await import('./ayuda.mjs');
    const r = await (await fetch(`${EMU_FS}/datos/licencias/registros?pageSize=300`, { headers: { Authorization: 'Bearer owner' } })).json();
    return (r.documents || []).some(d => d.fields?.obs?.stringValue === 'sin internet');
  };
  assert.equal(await buscar(), false);
  await ctx.setOffline(false);
  for (let i = 0; i < 40 && !(await buscar()); i++) await M.waitForTimeout(500);
  assert.equal(await buscar(), true, 'no se subió al volver internet');
  sinErrores(M); await ctx.close();
});

test('Emergencia: con el servidor caído se sigue con la copia de la compu, y el admin la suma al volver', async () => {
  const ctxM = await contexto(b);
  let caido = false;
  await ctxM.route(/127\.0\.0\.1:(8080|9099)/, r => caido ? r.abort() : r.continue());
  const M = await entrar(ctxM, 'mama@prueba.com');
  await esperar(M, () => vivos(estado.agentes).length > 0);
  // la copia en la compu se guarda sola a los 20 segundos
  await esperar(M, () => !!leerCopiaEnCompu(), undefined, 40000);
  await salir(M);
  assert.ok(await M.evaluate(() => !!leerCopiaEnCompu()), '"Salir" no debería borrar la copia');
  caido = true;
  await M.goto(APP + '?emulador');
  await M.waitForSelector('[data-act="emergencia-entrar"]', { timeout: 15000 });
  await M.click('[data-act="emergencia-entrar"]');
  await M.waitForSelector('#banners .banner.err');
  assert.ok(new URL(M.url()).searchParams.has('emergencia'));
  await M.evaluate(() => { const ag = vivos(estado.agentes)[0]; mutar(e => { e.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-1', desde: '2026-11-27', hasta: '2026-11-27', cargos: [], tramites: {}, obs: 'cargada en emergencia' })); }); });
  await M.reload();
  await M.waitForFunction(() => typeof estado === 'object' && estado?.licencias.some(l => l.obs === 'cargada en emergencia'));
  const [dl] = await Promise.all([M.waitForEvent('download'), M.click('#banners [data-act="exportar"]')]);
  const archivo = path.join(DIR, 'copia-emergencia.json'); await dl.saveAs(archivo);
  // vuelve el servidor: el admin suma la copia
  caido = false;
  const ctxA = await contexto(b);
  const A = await entrar(ctxA, 'santi@prueba.com');
  const agentesAntes = await contarDocs('agentes'), licAntes = await contarDocs('licencias');
  await A.evaluate(() => { ui.modoImportar = 'sumar'; });
  await A.setInputFiles('#file-import', archivo);
  await A.waitForSelector('.modal .btn.primary');
  await A.click('.modal .btn.primary');
  await esperar(A, () => estado.licencias.some(l => l.obs === 'cargada en emergencia') && !NubeDatos.pendientes);
  await A.waitForTimeout(1000);
  assert.equal(await contarDocs('licencias'), licAntes + 1);
  assert.equal(await contarDocs('agentes'), agentesAntes, 'sumar no debería borrar ni agregar agentes');
  // "Salir y borrar esta compu" se lleva la copia
  const M2 = await entrar(ctxM, 'mama@prueba.com');
  await salir(M2, 'salir-borrar');
  assert.equal(await M2.evaluate(() => !!leerCopiaEnCompu()), false);
  assert.equal(await M2.locator('[data-act="emergencia-entrar"]').count(), 0);
  sinErrores(A);
  await ctxA.close(); await ctxM.close();
});

test('Barra de arriba con usuario: entra en todos los anchos, con nombre largo, sin cortar "+ Licencia"', async () => {
  await crearCuenta('largo@prueba.com', 'Maximiliano Fernández Administrador', 'admin');
  const ctx = await contexto(b);
  const p = await entrar(ctx, 'largo@prueba.com');
  // letra ancha a propósito, para tener margen con cualquier compu
  await p.addStyleTag({ content: '*{font-family:"DejaVu Sans",sans-serif!important}' });
  const malos = [];
  for (const w of [1920, 1600, 1536, 1440, 1366, 1280, 1100, 1024, 900, 820, 600, 390, 360]) {
    await p.setViewportSize({ width: w, height: 800 });
    for (const v of ['inicio', 'agentes', 'reportes', 'ajustes']) {
      const r = await p.evaluate(v => { location.hash = '#' + v; render();
        return { sw: document.documentElement.scrollWidth, der: document.querySelector('#btn-nueva').getBoundingClientRect().right }; }, v);
      if (r.sw > w || r.der > w) malos.push(`${v} a ${w}px (ancho ${r.sw}, botón hasta ${Math.round(r.der)})`);
    }
  }
  assert.deepEqual(malos, []);
  sinErrores(p); await ctx.close();
});

test('Copias: quien carga puede "Sumar una copia" pero no "Importar copia"; consulta, ninguna', async () => {
  const ctx = await contexto(b);
  const M = await entrar(ctx, 'mama@prueba.com');
  await esperar(M, () => vivos(estado.agentes).length > 0);
  await M.evaluate(() => { ui.ajustesTab = 'datos'; location.hash = '#ajustes'; render(); });
  assert.equal(await M.locator('[data-act="importar-sumar"]').count(), 1, 'carga debería ver "Sumar una copia"');
  assert.equal(await M.locator('#main [data-act="importar"]').count(), 0, 'carga no debería ver "Importar copia"');
  // arma una copia con una licencia nueva y la suma
  const archivo = path.join(DIR, 'copia-carga.json');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(archivo, await M.evaluate(() => {
    const c = structuredClone(estado); const ag = vivos(c.agentes)[0];
    c.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-1', desde: '2026-12-01', hasta: '2026-12-01', cargos: [], tramites: {}, obs: 'sumada por carga' }));
    return JSON.stringify(c);
  }));
  const antes = await contarDocs('licencias');
  await M.click('[data-act="importar-sumar"]').catch(() => {});
  await M.setInputFiles('#file-import', archivo);
  await M.waitForSelector('.modal .btn.primary'); await M.click('.modal .btn.primary');
  await esperar(M, () => estado.licencias.some(l => l.obs === 'sumada por carga') && !NubeDatos.pendientes);
  for (let i = 0; i < 20 && (await contarDocs('licencias')) === antes; i++) await M.waitForTimeout(300);
  assert.equal(await contarDocs('licencias'), antes + 1);
  // aunque se fuerce, reemplazar todo no se deja
  await M.evaluate(() => { ui.modoImportar = 'reemplazar'; });
  await M.setInputFiles('#file-import', archivo);
  await M.waitForTimeout(500);
  assert.equal(await M.locator('.modal').count(), 0, 'no debería ofrecer reemplazar todo');
  sinErrores(M); await ctx.close();
  // consulta no ve ninguna de las dos
  const ctxD = await contexto(b);
  const D = await entrar(ctxD, 'dire@prueba.com');
  await D.evaluate(() => { ui.ajustesTab = 'datos'; location.hash = '#ajustes'; render(); });
  assert.equal(await D.locator('[data-act="importar-sumar"], #main [data-act="importar"]').count(), 0);
  await ctxD.close();
});
