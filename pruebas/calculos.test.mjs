// Pruebas de los cálculos y pantallas de la app (sin servidor).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { navegador, contexto, pagina } from './ayuda.mjs';

let b, ctx;
before(async () => { b = await navegador(); ctx = await contexto(b); });
after(async () => { await b.close(); });

/* Página con el reloj en una fecha fija y datos vacíos */
async function nueva(fecha = '2026-11-20T10:00:00') {
  const p = await ctx.newPage();
  p.errores = []; p.on('pageerror', e => p.errores.push(e.message)); p.on('dialog', d => d.accept());
  await p.clock.install({ time: new Date(fecha) });
  await p.goto((await import('./ayuda.mjs')).APP);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForFunction(() => typeof estado === 'object' && estado !== null);
  return p;
}
const sinErrores = p => assert.deepEqual(p.errores, [], 'errores en la página: ' + p.errores.join(' | '));

test('20° b: lo programado cuenta para el tope y el aviso coincide con el resumen', async () => {
  const p = await nueva();
  const r = await p.evaluate(() => {
    const ag = sellar({ apellido: 'Prueba', nombre: 'Docente', regimen: '233', cargos: [] }); estado.agentes.push(ag);
    for (const [d, h] of [['2026-03-09', '2026-03-10'], ['2026-05-11', '2026-05-12'], ['2026-08-12', '2026-08-12'], ['2026-11-25', '2026-11-25']])
      estado.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-20b', desde: d, hasta: h, cargos: [], tramites: {} }));
    const ctx = contexto();
    const f = resumenAgente(ag, 2026, '2026-11-20', ctx).find(x => x.art.id === '233-20b');
    const v = validarLicencia({ agenteId: ag.id, articuloId: '233-20b', desde: '2026-12-01', hasta: '2026-12-01' }, ctx);
    return { usados: f.totalAnio, hastaHoy: f.total, prog: f.programados, quedan: f.disponibles, aviso: v.avisos[0] || '' };
  });
  assert.deepEqual([r.usados, r.hastaHoy, r.prog, r.quedan], [6, 5, 1, 0]);
  assert.match(r.aviso, /6 de 6/);
  sinErrores(p); await p.close();
});

test('Feriados por régimen: el 11/09 no cuenta para docentes y sí para PSA', async () => {
  const p = await nueva();
  const r = await p.evaluate(() => {
    const doc = sellar({ apellido: 'Doc', nombre: 'P', regimen: '233', cargos: [sellar({ catedra: 'Historia', horario: { 5: { m: { desde: '08:00', hasta: '12:00' } } } })] });
    const psa = sellar({ apellido: 'Psa', nombre: 'P', regimen: '3487', cargos: [sellar({ catedra: 'Aux', horario: { 5: { m: { desde: '08:00', hasta: '12:00' } } } })] });
    estado.agentes.push(doc, psa);
    const ld = sellar({ agenteId: doc.id, articuloId: '233-1', desde: '2026-09-10', hasta: '2026-09-14', cargos: [], tramites: {} });
    const lp = sellar({ agenteId: psa.id, articuloId: '3487-32', desde: '2026-09-10', hasta: '2026-09-14', cargos: [], tramites: {} });
    estado.licencias.push(ld, lp);
    const ctx = contexto();
    return {
      doc: diasLicencia(ld, ctx.arts.get('233-1'), ctx), psa: diasLicencia(lp, ctx.arts.get('3487-32'), ctx),
      trabDoc: diasDeTrabajoEn(ld, doc, ctx), trabPsa: diasDeTrabajoEn(lp, psa, ctx),
      hastaDoc: calcularHasta('2026-09-10', 2, ctx.arts.get('233-1'), ctx), hastaPsa: calcularHasta('2026-09-10', 2, ctx.arts.get('3487-32'), ctx),
    };
  });
  assert.deepEqual(r, { doc: 2, psa: 3, trabDoc: 0, trabPsa: 1, hastaDoc: '2026-09-14', hastaPsa: '2026-09-11' });
  sinErrores(p); await p.close();
});

test('Ciclo lectivo: días de clase, trabajados y faltas', async () => {
  const p = await nueva();
  const r = await p.evaluate(() => {
    estado.config.ciclos = { 2026: { inicio: '2026-03-02', fin: '2026-12-18' } };
    const ag = sellar({ apellido: 'Prueba', nombre: 'D', regimen: '233', cargos: [] }); estado.agentes.push(ag);
    estado.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-28', desde: '2026-01-05', hasta: '2026-01-30', cargos: [], tramites: {} })); // fuera del ciclo
    estado.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-1', desde: '2026-04-06', hasta: '2026-04-08', cargos: [], tramites: {} }));
    const ctx = contexto();
    return { clase: diasClase('2026-03-02', '2026-12-18', ctx), falto: faltasClase(ag.id, '2026-03-02', '2026-11-20', ctx) };
  });
  assert.equal(r.clase, 194); // 195 hábiles menos el Día del Maestro
  assert.equal(r.falto, 3);  // la licencia anual de enero no cuenta
  sinErrores(p); await p.close();
});

test('Datos viejos: los horarios pasan a turnos, el sábado se descarta y el Día del Maestro queda sólo para docentes', async () => {
  const p = await nueva();
  const r = await p.evaluate(() => {
    const d = estadoInicial(); d.version = 8;
    d.calendario.forEach(c => { delete c.para; });
    d.agentes.push({ id: 'a1', apellido: 'X', nombre: 'Y', regimen: '233', cargos: [{ id: 'c1', catedra: 'H', horario: {
      1: { desde: '07:45', hasta: '12:05' }, 2: { desde: '13:30', hasta: '17:30' }, 3: { desde: '', hasta: '' }, 4: { desde: '19:00', hasta: '22:00' }, 6: { desde: '08:00', hasta: '12:00' } } }] });
    const m = migrar(d, { persistir: false });
    return { version: m.version, horario: m.agentes[0].cargos[0].horario, maestro: m.calendario.filter(c => c.fecha.endsWith('-09-11')).map(c => c.para) };
  });
  assert.equal(r.version, 10);
  assert.deepEqual(Object.keys(r.horario), ['1', '2', '3', '4']);
  assert.deepEqual([Object.keys(r.horario[1]), Object.keys(r.horario[2]), Object.keys(r.horario[3]), Object.keys(r.horario[4])], [['m'], ['t'], ['m'], ['n']]);
  assert.deepEqual(r.maestro, ['233', '233']);
  sinErrores(p); await p.close();
});

test('Artículos: están los gremiales G22 y G26 y el 20° dividido en a y b', async () => {
  const p = await nueva();
  const ids = await p.evaluate(() => vivos(estado.articulos).map(a => a.id));
  for (const id of ['146-22', '146-26', '233-20a', '233-20b']) assert.ok(ids.includes(id), 'falta ' + id);
  assert.ok(!ids.includes('233-20'), 'el 20° sin dividir no debería estar');
  sinErrores(p); await p.close();
});

test('Importar: rechaza una copia vacía y "Sumar una copia" no borra ni duplica', async () => {
  const p = await nueva();
  const dir = mkdtempSync(path.join(tmpdir(), 'licencias-'));
  const vacia = path.join(dir, 'vacia.json');
  writeFileSync(vacia, JSON.stringify({ version: 1, meta: {}, config: {}, agentes: [], licencias: [], notas: [], articulos: [], calendario: [] }));
  await p.evaluate(() => { cargarEjemplo(); });
  const antes = await p.evaluate(() => vivos(estado.agentes).length);
  await p.setInputFiles('#file-import', vacia);
  await p.waitForSelector('.modal h2');
  assert.equal(await p.locator('.modal h2').innerText(), 'Esta copia está vacía');
  await p.click('.modal .btn.primary, .modal .btn');
  assert.equal(await p.evaluate(() => vivos(estado.agentes).length), antes);
  // copia con una licencia nueva y un teléfono cambiado
  const copia = path.join(dir, 'copia.json');
  writeFileSync(copia, await p.evaluate(() => {
    const c = structuredClone(estado);
    const ag = c.agentes[0]; ag.telefono = '2920-123456'; ag.modificado = new Date(Date.now() + 60000).toISOString();
    c.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-1', desde: '2026-11-23', hasta: '2026-11-23', cargos: [], tramites: {} }));
    return JSON.stringify(c);
  }));
  const licAntes = await p.evaluate(() => vivos(estado.licencias).length);
  for (let vez = 1; vez <= 2; vez++) {
    await p.evaluate(() => { ui.modoImportar = 'sumar'; });
    await p.setInputFiles('#file-import', copia);
    await p.waitForSelector('.modal h2');
    await p.click('.modal .btn.primary');
    await p.waitForTimeout(200);
  }
  const r = await p.evaluate(() => ({ lic: vivos(estado.licencias).length, ag: vivos(estado.agentes).length, tel: estado.agentes[0].telefono }));
  assert.deepEqual(r, { lic: licAntes + 1, ag: antes, tel: '2920-123456' });
  sinErrores(p); await p.close();
});

test('Pantallas: todas abren sin errores y sin salirse del ancho, en compu y celular', async () => {
  for (const ancho of [1366, 1100, 390]) {
    const p = await nueva();
    await p.setViewportSize({ width: ancho, height: 860 });
    await p.evaluate(() => { cargarEjemplo(); });
    for (const v of ['inicio', 'agentes', 'reportes', 'ajustes']) {
      await p.evaluate(v => { location.hash = '#' + v; render(); }, v);
      assert.ok(!(await p.evaluate(a => document.documentElement.scrollWidth > a, ancho)), `${v} se sale del ancho a ${ancho}px`);
    }
    await p.evaluate(() => { ui.repTab = 'nomina'; location.hash = '#reportes'; render(); });
    assert.ok(await p.locator('table.nomina').count(), 'no se ve la nómina');
    await p.evaluate(() => { const a = estado.agentes.find(x => !x.borrado); ui.anio = 2026; location.hash = '#agente/' + a.id; render(); });
    assert.ok(await p.locator('table.planilla').count(), 'no se ve la planilla');
    sinErrores(p); await p.close();
  }
});
