// Pruebas de las reglas de seguridad (firestore.rules) contra el emulador de Firebase.
// Cómo correrlas:  npm install  →  npm run test:reglas
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';

const CODIGO = 'ESRN-PRUEBA-7Q4K';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-licencias',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });

// Estado inicial de cada prueba: el código cargado, un admin, una de carga, una de consulta y una dada de baja.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/acceso'), { codigo: CODIGO });
    const p = (rol, activo = true) => ({ nombre: rol, email: `${rol}@x.com`, rol, activo, codigo: CODIGO, creado: new Date() });
    await setDoc(doc(db, 'usuarios/santi'), p('admin'));
    await setDoc(doc(db, 'usuarios/mama'), p('carga'));
    await setDoc(doc(db, 'usuarios/dire'), p('consulta'));
    await setDoc(doc(db, 'usuarios/ex'), p('carga', false));
    await setDoc(doc(db, 'datos/licencias/registros/l1'), { desde: '2026-11-20' });
  });
});

const como = (uid, email = `${uid}@x.com`) => env.authenticatedContext(uid, { email }).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const alta = (uid, extra = {}) => ({ nombre: 'Nueva', email: `${uid}@x.com`, rol: 'carga', activo: true, codigo: CODIGO, creado: serverTimestamp(), ...extra });

// ---------- Registro ----------
test('registro con el código correcto, eligiendo carga o consulta', async () => {
  await assertSucceeds(setDoc(doc(como('n1'), 'usuarios/n1'), alta('n1')));
  await assertSucceeds(setDoc(doc(como('n2'), 'usuarios/n2'), alta('n2', { rol: 'consulta' })));
});
test('registro con código incorrecto o sin código: rechazado', async () => {
  await assertFails(setDoc(doc(como('n1'), 'usuarios/n1'), alta('n1', { codigo: 'otro' })));
  const { codigo, ...sinCodigo } = alta('n1');
  await assertFails(setDoc(doc(como('n1'), 'usuarios/n1'), sinCodigo));
});
test('nadie se puede registrar como admin ni ya dado de baja', async () => {
  await assertFails(setDoc(doc(como('n1'), 'usuarios/n1'), alta('n1', { rol: 'admin' })));
  await assertFails(setDoc(doc(como('n1'), 'usuarios/n1'), alta('n1', { activo: false })));
});
test('no se puede crear el perfil de otra persona ni con otro mail', async () => {
  await assertFails(setDoc(doc(como('n1'), 'usuarios/n2'), alta('n2')));
  await assertFails(setDoc(doc(como('n1'), 'usuarios/n1'), alta('n1', { email: 'otro@x.com' })));
});
test('sin iniciar sesión no se puede registrar', async () => {
  await assertFails(setDoc(doc(anonimo(), 'usuarios/n1'), alta('n1')));
});
test('si todavía no hay código cargado, nadie se puede registrar', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'config/acceso')); });
  await assertFails(setDoc(doc(como('n1'), 'usuarios/n1'), alta('n1')));
});

// ---------- Código de la escuela ----------
test('sólo el admin ve y cambia el código', async () => {
  await assertSucceeds(getDoc(doc(como('santi'), 'config/acceso')));
  await assertSucceeds(setDoc(doc(como('santi'), 'config/acceso'), { codigo: 'NUEVO-1234' }));
  for (const u of ['mama', 'dire', 'ex', 'n1']) {
    await assertFails(getDoc(doc(como(u), 'config/acceso')));
    await assertFails(setDoc(doc(como(u), 'config/acceso'), { codigo: 'x' }));
  }
  await assertFails(getDoc(doc(anonimo(), 'config/acceso')));
});

// ---------- Perfiles ----------
test('cada uno lee sólo su perfil; el admin lee todos', async () => {
  await assertSucceeds(getDoc(doc(como('mama'), 'usuarios/mama')));
  await assertFails(getDoc(doc(como('mama'), 'usuarios/dire')));
  await assertFails(getDocs(collection(como('mama'), 'usuarios')));
  await assertSucceeds(getDocs(collection(como('santi'), 'usuarios')));
});
test('cada uno puede cambiar su nombre, pero no su tipo ni reactivarse', async () => {
  await assertSucceeds(updateDoc(doc(como('mama'), 'usuarios/mama'), { nombre: 'Mamá' }));
  await assertFails(updateDoc(doc(como('dire'), 'usuarios/dire'), { rol: 'carga' }));
  await assertFails(updateDoc(doc(como('mama'), 'usuarios/mama'), { rol: 'admin' }));
  await assertFails(updateDoc(doc(como('ex'), 'usuarios/ex'), { activo: true }));
});
test('el admin cambia tipos, da de baja y borra perfiles', async () => {
  await assertSucceeds(updateDoc(doc(como('santi'), 'usuarios/dire'), { rol: 'carga' }));
  await assertSucceeds(updateDoc(doc(como('santi'), 'usuarios/mama'), { activo: false }));
  await assertSucceeds(deleteDoc(doc(como('santi'), 'usuarios/ex')));
  await assertFails(deleteDoc(doc(como('mama'), 'usuarios/dire')));
});

// ---------- Datos de la escuela ----------
test('carga y admin leen y escriben datos', async () => {
  for (const u of ['mama', 'santi']) {
    await assertSucceeds(getDoc(doc(como(u), 'datos/licencias/registros/l1')));
    await assertSucceeds(setDoc(doc(como(u), `datos/licencias/registros/${u}`), { desde: '2026-11-21' }));
  }
});
test('consulta sólo lee datos', async () => {
  await assertSucceeds(getDoc(doc(como('dire'), 'datos/licencias/registros/l1')));
  await assertFails(setDoc(doc(como('dire'), 'datos/licencias/registros/x'), { desde: '2026-11-21' }));
});
test('dados de baja, sin perfil o sin sesión: no ven ni escriben nada', async () => {
  for (const db of [como('ex'), como('n1'), anonimo()]) {
    await assertFails(getDoc(doc(db, 'datos/licencias/registros/l1')));
    await assertFails(setDoc(doc(db, 'datos/licencias/registros/x'), { desde: '2026-11-21' }));
  }
});
test('cualquier otra ruta está cerrada', async () => {
  await assertFails(getDoc(doc(como('santi'), 'otra/cosa')));
  await assertFails(setDoc(doc(como('santi'), 'otra/cosa'), { a: 1 }));
});
