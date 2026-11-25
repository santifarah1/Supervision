# Copia de todas las noches (Google Apps Script)

Todas las noches, cerca de las 3, guarda una copia de todos los datos en el Drive de la cuenta que la instala. Queda en la carpeta **Copias Licencias Supervisión**, con un archivo por día (`copia-automatica-AAAA-MM-DD.json`). Se guardan las últimas 60 y las más viejas van a la papelera.

Cada copia tiene el mismo formato que "Exportar copia" de la app. Para volver a una copia: en la app, como administradora, **Ajustes → Datos y respaldo → Importar copia** (reemplaza todo) o **Sumar una copia** (agrega lo que falta, sin borrar).

No cuesta nada: usa la cuota gratis de Apps Script.

Conviene instalarla en **las dos cuentas dueñas** del proyecto de Firebase: si Google suspende una cuenta, la otra sigue teniendo sus copias.

## Instalación (una vez por cuenta, unos 10 minutos)

1. Entrá a **script.google.com** con la cuenta dueña (revisá arriba a la derecha que sea esa) → **Nuevo proyecto**. Arriba a la izquierda, cambiale el nombre a `Copia diaria Licencias Supervisión`.
2. Tocá el engranaje (**Configuración del proyecto**) y tildá **"Mostrar el archivo de manifiesto «appsscript.json» en el editor"**.
3. Volvé al editor (el ícono `< >`):
   - En **Código.gs**, borrá todo y pegá el contenido de [`Codigo.gs`](Codigo.gs). En la línea 10, `PROYECTO` tiene que tener el ID del proyecto de Firebase entre comillas (si está vacío, escribilo).
   - En **appsscript.json**, borrá todo y pegá el contenido de [`appsscript.json`](appsscript.json).
   - Guardá con el ícono del disquete.
4. Arriba, en la lista de funciones, elegí **`instalar`** y tocá **Ejecutar**.
5. Google pide permiso:
   - **Revisar permisos** y elegí la cuenta.
   - Si dice **"Google no verificó esta app"**: **Configuración avanzada → Ir a Copia diaria… (no seguro)**. Es normal: el script es tuyo y no está publicado.
   - **Permitir**.
6. En el **Registro de ejecución** de abajo tiene que aparecer algo como `Copia copia-automatica-2026-12-01.json: 40 agentes, 120 licencias.`
7. En el **Drive** de esa cuenta tiene que estar la carpeta **Copias Licencias Supervisión** con la primera copia.

Desde ahí corre sola. Para ver que siga andando: script.google.com → el proyecto → **Ejecuciones** (el ícono de la lista).

## Si da error

- **`… has not been used in project … or it is disabled`**: hay que conectar el script al proyecto de Firebase.
  1. En la consola de Firebase: engranaje → **Configuración del proyecto** → **General** → copiá el **Número del proyecto**.
  2. En el script: engranaje → **Proyecto de Google Cloud** → **Cambiar proyecto** → pegá el número → confirmá.
  3. Si pide configurar la **pantalla de consentimiento de OAuth**, seguí el enlace y completá sólo lo obligatorio: nombre `Copia diaria Licencias Supervisión`, tu mail en los dos campos de mail, tipo **Externo** y, en "Usuarios de prueba", tu mail. Después volvé a ejecutar `instalar`.
- **`… PERMISSION_DENIED`**: el script se está ejecutando con una cuenta que no es dueña del proyecto. Revisá arriba a la derecha.
- **`Falta escribir el ID del proyecto…`**: completá `PROYECTO` en la línea 10 (paso 3).
- **Otro error**: copiá el mensaje del Registro de ejecución y pasáselo a Claude o a Santi.
