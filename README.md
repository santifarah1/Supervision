# Licencias · Supervisión Secundaria Zona I Valle Inferior

> **Instructivo para quienes usan la app:** [Guía de uso en PDF](docs/Guia-Licencias-Supervision-Zona-I.pdf).
> Si algo no anda (la página no abre, se cargó algo mal, alguien olvidó la contraseña…), mirá **[Qué hacer si…](docs/que-hacer-si.md)**.

App para llevar las licencias del personal que depende de la supervisión: directores, equipo supervisivo y docentes de los CEPJA. Es la misma idea que la app de Licencias de la ESRN Rural Virtual (de ahí viene el código), adaptada para varios grupos "juntos pero separados".

Es un solo archivo, `index.html`. No hay que instalar nada para usarla: se abre en el navegador (mejor Google Chrome o Microsoft Edge).

## Cómo está organizada

**Pestañas.** Arriba hay una pestaña por grupo: Directores, Equipo supervisivo, CEPJA 11 (B° Mi Bandera), CEPJA 14 (Guardia Mitre), CEPJA 35 (Penal) y CEPJA 53 (Fuerte San Javier). Cada pestaña muestra sólo su gente, sus licencias y sus notas. La pestaña **Todos** muestra todo junto, con una tabla que resume cada pestaña.

**Una ficha por persona.** Cada persona tiene una sola ficha, aunque trabaje en dos lugares. Lo que dice dónde está son sus **cargos**: cada cargo pertenece a una pestaña. Un docente con Matemática en el CEPJA 11 y en el CEPJA 14 aparece en las dos pestañas (con la etiqueta "también en CEPJA 14"), pero es la misma ficha.

- En los CEPJA, cada cargo lleva la **cátedra** y el **ID**. Puede haber varios ID en un mismo CEPJA.
- En Directores, cada cargo dice a qué **escuela** pertenece.

**Topes por persona o por cargo.** Cada artículo dice cómo se cuenta el tope (Ajustes → Artículos y topes):

- **Por persona** (la mayoría, por ejemplo el 1° enfermedad y el 13° familiar enfermo): se suman los días de todos sus cargos, en todas las pestañas.
- **Por cargo** (por ahora, sólo el 20° b): cada cargo tiene su propio tope de 6 días por año y 2 por mes.

Al cargar una licencia se marcan los cargos en los que la persona falta. Una licencia aparece en la pestaña de cada cargo marcado: una enfermedad que toca los dos CEPJA se ve en los dos; un 20° b en un solo cargo se ve sólo en la pestaña de ese cargo.

**Notas del día.** Una nota escrita dentro de una pestaña se ve en esa pestaña y en Todos. Una nota escrita en Todos se ve en todas.

**Agregar o quitar una pestaña.** En Ajustes → Pestañas. "Archivar" oculta la pestaña sin borrar a nadie, y se puede recuperar.

Sólo hay docentes de la Res. 233/98 (no hay PSA). El calendario de feriados y asuetos es el de la provincia, igual para todas las pestañas.

## Dónde se guardan los datos

**Con servidor (Firebase).** En el link propio de la app (**https://licencias-supervision-zona-i.web.app**) se entra con usuario y contraseña y los datos quedan en el servidor, compartidos entre todas las compus. Hay tres tipos de usuario:

| Tipo | Quién | Qué puede hacer |
|---|---|---|
| Administra | Quien maneja la app | Todo, más los usuarios, el código de la supervisión y las pestañas |
| Carga | Los secretarios | Cargar y editar personas, licencias y notas |
| Consulta | La supervisora | Ver todo, sin modificar |

Para crear una cuenta hace falta el **código de la supervisión**, que controla el servidor (`firestore.rules`). Sigue andando sin internet y tiene modo emergencia con la copia guardada en la compu. Además hay una copia de todas las noches en el Drive de cada cuenta dueña ([`herramientas/copia-diaria`](herramientas/copia-diaria/LEEME.md)).

Cómo se crea el proyecto, paso a paso: **[Puesta en marcha](docs/puesta-en-marcha.md)**. El proyecto es `licencias-supervision-zona-i`; sus datos están en `FIREBASE_CONFIG`, dentro de `index.html`.

**Sin servidor (plan B).** Abriendo `index.html` en la compu, o en el link de respaldo de GitHub Pages, la app guarda en el navegador y, si se elige, en un archivo de una carpeta de Google Drive u OneDrive (Ajustes → Datos y respaldo). Conviene tocar **Exportar copia** seguido.

**Publicación.** Cada vez que se mergea algo a `main`, GitHub publica la app y las reglas en Firebase (`.github/workflows/publicar-firebase.yml`), sin ninguna llave guardada: usa un pase que dura minutos y sólo sirve para este repositorio desde `main`.

## Pruebas automáticas

GitHub corre todas las pruebas en cada PR (`.github/workflows/pruebas.yml`): si algo se rompe, el PR aparece con una cruz roja y no hay que mergearlo.

- Todo junto: `npm install` y después `npm test` (necesita Java para el emulador de Firebase).
- Sólo los cálculos, sin emulador: `npm run test:calculos`.
- `pruebas/calculos.test.mjs`: topes, pestañas, persona en dos CEPJA, 20° b por cargo, ciclo lectivo, copias y que las pantallas entren en la compu y en el celular.
- `pruebas/nube.test.mjs` y `pruebas/reglas.test.mjs`: usuarios y reglas de seguridad contra el emulador (listos para cuando se sume el servidor).
