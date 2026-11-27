// Pruebas de "Importar planta (POF)": se arma una POF inventada en PDF, con el mismo formato
// que la del Ministerio, y se importa con la app (sin servidor). No usa datos reales.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { navegador, contexto, APP } from './ayuda.mjs';

const PDFJS = path.resolve('node_modules/pdfjs-dist/build');
const DIR = mkdtempSync(path.join(tmpdir(), 'pof-'));
let b, ctx;

// Columnas como en la POF real (en puntos): x de cada encabezado
const COL = { agente: 36, legajo: 146, id: 181, cod: 194, cargo: 216, anio: 324, div: 338, tur: 351, hs: 365, asig: 374, orient: 468, plan: 545, nro: 604, altaPof: 635, estado: 681, rev: 701, altaPon: 712 };
// Renglones inventados: [agente (con | donde corta la línea), legajo, id, cargo, hs, asignatura, revista, alta]
const FILAS = [
  ['PEREZ GOMEZ JUAN|CARLOS', '111111', '40', 'HORA SECUNDARIA', '8', 'Historia', 'I', '23/02/2026'],
  ['PEREZ GOMEZ JUAN|CARLOS', '111111', '41', 'HORA SECUNDARIA', '8', 'Historia', 'I', '23/02/2026'],
  ['LOPEZ ANA', '222222', '61', 'HORA SECUNDARIA', '4', 'Idioma Extranjero', 'I', '17/02/2023'],
  ['ROSSI MARTA DEL CARMEN', '333333', '61', 'HORA SECUNDARIA', '4', 'Idioma Extranjero', 'S', '12/02/2026'],
  ['ROSSI MARTA DEL CARMEN', '333333', '29', 'PRECEPTOR SECUNDARIO', '0', '', 'Z', '01/09/2026'],
  ['VEGA LUIS', '444444', '23', 'PROSECRETARIO ESCUELA|SECUNDARIA', '0', '', 'C', '13/03/2017'],
];
function htmlPOF(filas, anexo = '35') {
  const t = (x, y, s, extra = '') => `<div style="position:absolute;left:${x}pt;top:${y}pt;${extra}">${s}</div>`;
  let h = t(312, 20, 'Planta Orgánica Nominal') + t(36, 60, 'Delegación:VALLE INFERIOR - VIEDMA')
    + t(194, 75, `Establecimiento:CENTRO EDUCATIVO PARA JOVENES Y ADULTOS - VIEDMA - ANEXO ${anexo}`);
  const enc = { agente: 'Agente', legajo: 'Legajo', id: 'Id', cod: 'Cod', cargo: 'Cargo', anio: 'Año', div: 'Div', tur: 'Tur', hs: 'Hs', asig: 'Asignaturas / U. Curricular', orient: 'Orientación', plan: 'Plan', nro: 'Nro', altaPof: 'Alta Pof', estado: 'Estad', rev: 'Rev', altaPon: 'Alta Pon' };
  for (const [k, v] of Object.entries(enc)) h += t(COL[k], 90, v);
  let y = 115;
  for (const [ag, leg, id, cargo, hs, asig, rev, alta] of filas) {
    const [ag1, ag2] = ag.split('|'), [ca1, ca2] = cargo.split('|');
    const vals = { agente: ag1, legajo: leg, id, cod: '1-1', cargo: ca1, anio: '0', div: '0', tur: 'E', hs, asig, orient: asig ? 'Formación Básica -' : '', plan: asig ? '3165/15' : '', nro: '1276/21', altaPof: '09/02/2021', estado: 'A', rev, altaPon: alta };
    for (const [k, v] of Object.entries(vals)) if (v) h += t(COL[k], y, v);
    if (ag2) h += t(COL.agente, y + 9, ag2);
    if (ca2) h += t(COL.cargo, y + 9, ca2);
    if (asig) h += t(COL.orient, y + 9, 'Ciencias Naturales,');
    y += 36;
  }
  h += t(36, 540, '27/11/2026') + t(330, 540, 'Página 1 de 1');
  return `<!doctype html><html><body style="margin:0;font:7pt Arial,sans-serif;width:792pt;height:612pt;position:relative">${h}</body></html>`;
}
async function pdfPOF(nombre, filas, anexo) {
  const p = await ctx.newPage();
  await p.setContent(htmlPOF(filas, anexo));
  const archivo = path.join(DIR, nombre);
  await p.pdf({ path: archivo, width: '11in', height: '8.5in', printBackground: true });
  await p.close();
  return archivo;
}
async function app() {
  const p = await ctx.newPage();
  p.errores = []; p.on('pageerror', e => p.errores.push(e.message)); p.on('dialog', d => d.accept());
  await p.clock.install({ time: new Date('2026-11-27T10:00:00') });
  await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => typeof estado === 'object' && estado !== null);
  await p.evaluate(() => { elegirPestana('cepja-35'); ir('agentes'); });
  return p;
}
async function importar(p, archivo, antes = null) {
  await p.setInputFiles('#file-pof', archivo);
  await p.waitForSelector('.modal .pof-lista', { timeout: 20000 });
  if (antes) await antes(p);
  await p.click('.modal [data-x=importar]');
  await p.waitForTimeout(300);
}
const sinErrores = p => assert.deepEqual(p.errores, [], 'errores en la página: ' + p.errores.join(' | '));

before(async () => {
  b = await navegador(); ctx = await contexto(b);
  await ctx.route('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/**', r => r.fulfill({
    status: 200, contentType: 'application/javascript', body: readFileSync(path.join(PDFJS, path.basename(new URL(r.request().url()).pathname))) }));
});
after(async () => { await b.close(); });

test('POF: lee personas, cargos, nombres en dos renglones, revista y alta', async () => {
  const p = await app();
  const archivo = await pdfPOF('pof.pdf', FILAS);
  await p.setInputFiles('#file-pof', archivo);
  await p.waitForSelector('.modal .pof-lista', { timeout: 20000 });
  assert.deepEqual(await p.$$eval('[data-pof-nombre]', is => is.map(i => i.value)),
    ['Perez Gomez, Juan Carlos', 'Lopez, Ana', 'Rossi, Marta Del Carmen', 'Vega, Luis']);
  // se corrige un nombre antes de importar
  await p.fill('[data-pof-nombre="111111"]', 'Pérez Gómez, Juan Carlos');
  await p.click('.modal [data-x=importar]'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => vivos(estado.agentes).map(a => ({ ap: a.apellido, no: a.nombre, leg: a.legajoPersonal,
    cargos: vivos(a.cargos).map(c => [c.pestana, c.idCargo, c.catedra, c.hs, c.caracter, c.alta].join('|')) })));
  assert.deepEqual(r, [
    { ap: 'Pérez Gómez', no: 'Juan Carlos', leg: '111111', cargos: ['cepja-35|40|Historia|8|Interino|2026-02-23', 'cepja-35|41|Historia|8|Interino|2026-02-23'] },
    { ap: 'Lopez', no: 'Ana', leg: '222222', cargos: ['cepja-35|61|Idioma Extranjero|4|Interino|2023-02-17'] },
    { ap: 'Rossi', no: 'Marta Del Carmen', leg: '333333', cargos: ['cepja-35|61|Idioma Extranjero|4|Suplente|2026-02-12', 'cepja-35|29|Preceptor secundario||Suplente Condicional|2026-09-01'] },
    { ap: 'Vega', no: 'Luis', leg: '444444', cargos: ['cepja-35|23|Prosecretario escuela secundaria||Interino Condicional|2017-03-13'] },
  ]);
  sinErrores(p); await p.close();
});

test('POF: la suplencia de un ID sale de las fechas de alta y se ve en la lista', async () => {
  const p = await app();
  await importar(p, await pdfPOF('pof.pdf', FILAS));
  const sup = await p.evaluate(() => { const ctx = contexto(); return vivos(estado.agentes).flatMap(a => vivos(a.cargos).map(c => suplenciaDe(a, c, ctx)).filter(Boolean)); });
  assert.deepEqual(sup, ['Interino/a, de licencia: la/lo suplanta ROSSI, Marta Del Carmen (alta 12/02/2026)', 'Suplente de LOPEZ, Ana (alta 17/02/2023)']);
  assert.match(await p.locator('#lista-agentes').innerText(), /Suplente de LOPEZ, Ana/);
  sinErrores(p); await p.close();
});

test('POF: importarla de nuevo no duplica; los cambios se actualizan y lo que ya no figura queda con baja', async () => {
  const p = await app();
  // alguien que ya estaba en otro CEPJA, con el mismo legajo: recibe el cargo en su misma ficha
  await p.evaluate(() => { estado.agentes.push(sellar({ apellido: 'Vega', nombre: 'Luis', regimen: '233', legajoPersonal: '444444', cargos: [sellar({ pestana: 'cepja-11', catedra: 'Lengua', idCargo: '9001' })] })); guardar(); });
  await importar(p, await pdfPOF('pof.pdf', FILAS));
  assert.equal(await p.evaluate(() => vivos(estado.agentes).filter(a => a.apellido === 'Vega').length), 1, 'no tiene que crear otra ficha');
  assert.deepEqual(await p.evaluate(() => pestanasDe(estado.agentes.find(a => a.apellido === 'Vega'))), ['cepja-11', 'cepja-35']);
  const contar = () => p.evaluate(() => ({ personas: vivos(estado.agentes).length, cargos: vivos(estado.agentes).flatMap(a => vivos(a.cargos)).length }));
  const antes = await contar();
  // la misma POF otra vez: todo "Igual"
  await p.setInputFiles('#file-pof', await pdfPOF('pof2.pdf', FILAS));
  await p.waitForSelector('.modal .pof-lista', { timeout: 20000 });
  assert.match(await p.locator('.modal').innerText(), /0 personas nuevas, 0 cargos nuevos y 0 cargos que cambian/);
  await p.click('.modal [data-x=importar]'); await p.waitForTimeout(300);
  assert.deepEqual(await contar(), antes);
  // POF nueva: Pérez pasa a 4 hs en el ID 40 y deja el ID 41
  const nuevas = FILAS.filter(f => f[2] !== '41').map(f => f[2] === '40' ? [...f.slice(0, 4), '4', ...f.slice(5)] : f);
  await importar(p, await pdfPOF('pof3.pdf', nuevas));
  const perez = await p.evaluate(() => vivos(estado.agentes.find(a => a.apellido.startsWith('Perez')).cargos).map(c => [c.idCargo, c.hs, c.baja || ''].join('|')));
  assert.deepEqual(perez, ['40|4|', '41|8|2026-11-27']);
  sinErrores(p); await p.close();
});

test('POF: avisa si el anexo no coincide con la pestaña, y no importa si no es una POF', async () => {
  const p = await app();
  await p.setInputFiles('#file-pof', await pdfPOF('otra.pdf', FILAS, '14'));
  await p.waitForSelector('.modal .pof-lista', { timeout: 20000 });
  assert.match(await p.locator('.modal .msg.err').innerText(), /Anexo 14.*CEPJA 35/);
  await p.click('.modal [data-x=cerrar]');
  const vacio = path.join(DIR, 'nada.pdf');
  { const q = await ctx.newPage(); await q.setContent('<p>Hola</p>'); await q.pdf({ path: vacio }); await q.close(); }
  await p.setInputFiles('#file-pof', vacio);
  await p.waitForSelector('.modal h2');
  assert.equal(await p.locator('.modal h2').innerText(), 'No encontré la planta');
  assert.equal(await p.evaluate(() => vivos(estado.agentes).length), 0);
  sinErrores(p); await p.close();
});
