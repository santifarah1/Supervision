# Guía de uso en PDF

El PDF final está en [`docs/Guia-Licencias-Supervision-Zona-I.pdf`](../../docs/Guia-Licencias-Supervision-Zona-I.pdf). Es el instructivo para mandarle a quienes usan la app. Esta carpeta tiene lo necesario para rehacerlo cuando cambie la app:

- `guia.html`: el texto de la guía.
- `capturas.mjs`: abre la app contra el emulador de Firebase con datos de ejemplo y tres usuarios (administra, carga y consulta) y saca las capturas en `img/`.
- `pdf.mjs`: arma el PDF a partir de `guia.html` y las capturas.

Para rehacerla, desde la raíz del repo (necesita `npm install` y Java para el emulador):

```bash
npx firebase emulators:exec --only auth,firestore --project demo-licencias "node herramientas/guia/capturas.mjs"
```

```bash
node herramientas/guia/pdf.mjs
```
