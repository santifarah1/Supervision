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

test('Una persona en dos CEPJA: una sola ficha, aparece en las dos pestañas y el art. 1 se cuenta junto', async () => {
  const p = await nueva();
  const r = await p.evaluate(() => {
    const c11 = sellar({ pestana: 'cepja-11', catedra: 'Matemática', idCargo: '104512' }), c14 = sellar({ pestana: 'cepja-14', catedra: 'Matemática', idCargo: '207720' });
    const ag = sellar({ apellido: 'Prueba', nombre: 'Doble', regimen: '233', cargos: [c11, c14] }); estado.agentes.push(ag);
    // enfermedad en los dos cargos: 15 días en marzo y 4 en noviembre (19 de 20, contando todo junto)
    estado.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-1', desde: '2026-03-02', hasta: '2026-03-20', cargos: [], tramites: {} }));
    estado.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-1', desde: '2026-11-02', hasta: '2026-11-05', cargos: [], tramites: {} }));
    const en = pes => contexto(estado, pes);
    const fila = resumenAgente(ag, 2026, '2026-11-20', en('')).find(x => x.art.id === '233-1');
    const v = validarLicencia({ agenteId: ag.id, articuloId: '233-1', desde: '2026-11-09', hasta: '2026-11-10', cargos: [] }, en('cepja-14'));
    return {
      en11: en('cepja-11').agentes.length, en14: en('cepja-14').agentes.length, en35: en('cepja-35').agentes.length,
      lic11: en('cepja-11').licencias.length, lic14: en('cepja-14').licencias.length,
      usados: fila.totalAnio, quedan: fila.disponibles, filas233_1: resumenAgente(ag, 2026, '2026-11-20', en('')).filter(x => x.art.id === '233-1').length,
      aviso: v.avisos.join(' '),
    };
  });
  assert.deepEqual([r.en11, r.en14, r.en35, r.lic11, r.lic14], [1, 1, 0, 2, 2]);
  assert.deepEqual([r.usados, r.quedan, r.filas233_1], [19, 1, 1]);
  assert.match(r.aviso, /Supera el tope anual del art\. 1° en 2026: ya tiene cargados 19 de 20/);
  sinErrores(p); await p.close();
});

test('20° b por cargo: cada cargo tiene su tope y la licencia se ve sólo en la pestaña de ese cargo', async () => {
  const p = await nueva();
  const r = await p.evaluate(() => {
    const a = sellar({ pestana: 'cepja-11', catedra: 'Matemática', idCargo: '1' }), b = sellar({ pestana: 'cepja-11', catedra: 'Física', idCargo: '2' }), c = sellar({ pestana: 'cepja-14', catedra: 'Matemática', idCargo: '3' });
    const ag = sellar({ apellido: 'Prueba', nombre: 'Tres', regimen: '233', cargos: [a, b, c] }); estado.agentes.push(ag);
    // 6 días en el cargo a (2 por mes), ninguno en b ni en c
    for (const [d, h] of [['2026-03-09', '2026-03-10'], ['2026-05-11', '2026-05-12'], ['2026-08-12', '2026-08-13']])
      estado.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-20b', desde: d, hasta: h, cargos: [a.id], tramites: {} }));
    const ctx = contexto(estado, '');
    const filas = resumenAgente(ag, 2026, '2026-11-20', ctx).filter(x => x.art.id === '233-20b').map(x => [x.cargo.idCargo, x.totalAnio, x.disponibles]);
    const enA = validarLicencia({ agenteId: ag.id, articuloId: '233-20b', desde: '2026-11-25', hasta: '2026-11-25', cargos: [a.id] }, ctx);
    const enC = validarLicencia({ agenteId: ag.id, articuloId: '233-20b', desde: '2026-11-25', hasta: '2026-11-25', cargos: [c.id] }, ctx);
    estado.licencias.push(sellar({ agenteId: ag.id, articuloId: '233-20b', desde: '2026-11-24', hasta: '2026-11-24', cargos: [c.id], tramites: {} }));
    return {
      filas, avisoA: enA.avisos.join(' '), avisosC: enC.avisos.length, infoC: enC.info.join(' '),
      en11: contexto(estado, 'cepja-11').licencias.length, en14: contexto(estado, 'cepja-14').licencias.length,
    };
  });
  assert.deepEqual(r.filas, [['1', 6, 0], ['2', 0, 6], ['3', 0, 6]]);
  assert.match(r.avisoA, /Matemática · ID 1 \(CEPJA 11\).*Supera el tope anual/);
  assert.equal(r.avisosC, 0);
  assert.match(r.infoC, /tiene cargados 0 de 6/);
  assert.deepEqual([r.en11, r.en14], [3, 1]);
  sinErrores(p); await p.close();
});

test('Ficha: con DNI repetido avisa que la persona ya existe y en qué pestaña está', async () => {
  const p = await nueva();
  await p.evaluate(() => { estado.agentes.push(sellar({ apellido: 'Repetida', nombre: 'Ana', regimen: '233', dni: '30111222', cargos: [sellar({ pestana: 'cepja-35', catedra: 'Lengua' })] })); elegirPestana('cepja-53'); abrirFormAgente(); });
  await p.fill('.modal [data-a=apellido]', 'Repetida'); await p.fill('.modal [data-a=nombre]', 'Ana'); await p.fill('.modal [data-a=dni]', '30.111.222');
  assert.equal(await p.inputValue('.modal [data-c=pestana]'), 'cepja-53', 'el cargo nuevo va en la pestaña que se está mirando');
  await p.click('.modal [data-x=guardar]');
  assert.match(await p.locator('.modal [data-f=msgs]').innerText(), /Ya hay una ficha con DNI 30111222: REPETIDA, Ana \(CEPJA 35\)/);
  sinErrores(p); await p.close();
});

test('Pestañas: se agregan, se renombran y se archivan sin perder a nadie', async () => {
  const p = await nueva();
  const r = await p.evaluate(() => {
    cargarEjemplo();
    const antes = pestanas().length;
    acciones['pes-nueva']();
    const nueva = pestanas().at(-1);
    cambiarPestanas(ps => { ps.find(x => x.id === nueva.id).nombre = 'CEPJA 99'; });
    acciones['pes-archivar']({ dataset: { v: 'cepja-35' } });
    const visibles = pestanas().map(x => x.nombre);
    elegirPestana('cepja-35'); // archivada: vuelve a "Todos"
    return { antes, despues: visibles.length, tiene99: visibles.includes('CEPJA 99'), tiene35: visibles.includes('CEPJA 35'), actual: pestanaActual(), personas: vivos(estado.agentes).length };
  });
  assert.deepEqual(r, { antes: 6, despues: 6, tiene99: true, tiene35: false, actual: '', personas: 11 });
  // queda guardado en la compu
  await p.reload(); await p.waitForFunction(() => typeof estado === 'object' && estado !== null);
  assert.ok(await p.evaluate(() => pestanas().some(x => x.nombre === 'CEPJA 99')));
  sinErrores(p); await p.close();
});

test('Formulario de licencia: el 20° b marca sólo los cargos de la pestaña; el 1° marca todos', async () => {
  const p = await nueva();
  await p.evaluate(() => { cargarEjemplo(); elegirPestana('cepja-14'); formLicencia({ agenteId: estado.agentes.find(a => a.apellido.includes('Benítez')).id }); });
  await p.selectOption('.modal [data-f=articulo]', '233-20b');
  assert.deepEqual(await p.$$eval('.modal [data-f=cargos] input', is => is.map(i => i.checked)), [false, false, true]);
  await p.selectOption('.modal [data-f=articulo]', '233-1');
  assert.deepEqual(await p.$$eval('.modal [data-f=cargos] input', is => is.map(i => i.checked)), [true, true, true]);
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
  assert.equal(r.version, 11);
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
    for (const pes of ['', 'directores', 'cepja-11']) for (const v of ['inicio', 'agentes', 'reportes', 'ajustes']) {
      await p.evaluate(([v, pes]) => { ui.pestana = pes; location.hash = '#' + v; render(); }, [v, pes]);
      assert.ok(!(await p.evaluate(a => document.documentElement.scrollWidth > a, ancho)), `${v} (${pes || 'Todos'}) se sale del ancho a ${ancho}px`);
    }
    await p.evaluate(() => { ui.repTab = 'nomina'; location.hash = '#reportes'; render(); });
    assert.ok(await p.locator('table.nomina').count(), 'no se ve la nómina');
    await p.evaluate(() => { const a = estado.agentes.find(x => !x.borrado); ui.anio = 2026; location.hash = '#agente/' + a.id; render(); });
    assert.ok(await p.locator('table.planilla').count(), 'no se ve la planilla');
    sinErrores(p); await p.close();
  }
});
