# Puesta en marcha del servidor (Firebase)

Esto se hace **una sola vez**, con calma, en una compu. Son unos 40 minutos. Al terminar, la app queda en un link propio, con usuario y contraseña para cada persona, y los datos guardados en el servidor.

Lo que se aprendió con la app de la escuela, y por qué se hace así:

- **Una cuenta de Google con historia.** Una cuenta de Gmail recién creada que hace mucha actividad técnica de golpe puede ser suspendida por Google. Por eso se usa tu cuenta secundaria, que ya tiene tiempo de uso. Más adelante se puede sumar un Gmail nuevo como dueño principal (está al final).
- **Una segunda dueña desde el primer día.** Si Google suspende una cuenta, la otra sigue pudiendo entrar al proyecto.
- **Ninguna llave descargable.** GitHub publica la app con un pase que dura minutos y sólo sirve para este repositorio. No hay ningún archivo con una clave que se pueda perder.
- **Copia de todas las noches fuera de Firebase,** en el Drive de cada cuenta dueña.

Antes de empezar: abrí Google Chrome con la **cuenta secundaria**. Fijate arriba a la derecha que sea esa en cada página que abras.

---

## 1. Crear el proyecto

1. Entrá a **console.firebase.google.com** y tocá **Crear un proyecto** (o **Comenzar con un proyecto de Firebase**).
2. Nombre: `Licencias Supervision Zona I`. Abajo del nombre aparece el **ID del proyecto** (algo como `licencias-supervision-zona-i`). **Anotalo**: se usa en varios pasos.
3. Google Analytics: **desactivado** (no hace falta).
4. Tocá **Crear proyecto** y esperá a que termine.

El proyecto queda en el plan **Spark**, que es gratis y no pide tarjeta. Para una supervisión sobra.

## 2. Sumar la segunda dueña

1. En la consola de Firebase: el engranaje (arriba a la izquierda) → **Usuarios y permisos**.
2. **Agregar miembro** → el mail de la otra cuenta (por ejemplo, la de Santi) → rol **Propietario** → **Agregar**.
3. A esa persona le llega un mail: tiene que **aceptar la invitación**. Hasta que no la acepte, no es dueña.

## 3. Activar el ingreso con usuario

1. En el menú de la izquierda: **Seguridad → Authentication → Comenzar**.
2. Pestaña **Método de acceso**:
   - **Correo electrónico/contraseña** → activar el primer interruptor → **Guardar**.
   - **Agregar proveedor nuevo → Google** → activar → en "Correo electrónico de asistencia" elegí tu mail → **Guardar**.

## 4. Registrar la app web y copiar su configuración

1. Engranaje → **Configuración del proyecto** → pestaña **General** → abajo, en "Tus apps", el ícono **`</>`** (Web).
2. Apodo: `Licencias`. **No** tildes "Configurar Firebase Hosting" (eso lo hace GitHub). Tocá **Registrar app**.
3. Aparece un bloque que empieza con `const firebaseConfig = {`. **Copialo entero** y mandáselo a Claude. No es secreto: va dentro de la página y la seguridad la ponen las reglas del servidor.
4. En la misma página, más arriba, está el **Número del proyecto** (sólo números). Anotalo también.

## 5. Crear la base de datos

1. Menú de la izquierda: **Bases de datos y almacenamiento → Firestore** (o buscá "Firestore" en **Buscar productos**) → **Crear base de datos**.
2. Edición: **Estándar**, si lo pregunta.
3. Ubicación: **southamerica-east1 (São Paulo)**. Es la más cercana y **no se puede cambiar después**.
4. Modo: **Producción** → **Crear**.

> **Ojo: no es "Realtime Database".** Firebase tiene dos bases de datos con nombres parecidos. La app usa **Firestore**. Realtime Database es otra cosa: sólo ofrece Estados Unidos, Bélgica y Singapur, y por eso no aparece São Paulo. Si la abriste, tocá **Cancelar** y no crees nada ahí.

## 6. Activar el Hosting (donde vive la página)

Menú de la izquierda: **Hosting y sin servidores → Hosting → Comenzar**. Salteá todos los pasos con **Siguiente** y al final **Continuar a la consola**. No hay que instalar nada.

## 7. El pase sin llave para que GitHub publique la app

1. Entrá a **console.cloud.google.com** (con la misma cuenta). Arriba, en el selector de proyectos, elegí el proyecto del paso 1.
2. Arriba a la derecha tocá el ícono **`>_`** (Activar Cloud Shell). Abajo se abre una consola negra. Si pide autorizar, tocá **Autorizar**.
3. Pegá todo esto junto en la consola y apretá Enter (ya tiene el ID del proyecto, `licencias-supervision-zona-i`):

   ```bash
   PROYECTO=licencias-supervision-zona-i
   gcloud config set project "$PROYECTO"
   NUMERO=$(gcloud projects describe "$PROYECTO" --format='value(projectNumber)')
   gcloud services enable iamcredentials.googleapis.com sts.googleapis.com firebasehosting.googleapis.com firebaserules.googleapis.com
   gcloud iam service-accounts create github-publicar --display-name="GitHub publica la app"
   for ROL in roles/firebasehosting.admin roles/firebaserules.admin roles/serviceusage.serviceUsageConsumer; do
     gcloud projects add-iam-policy-binding "$PROYECTO" --member="serviceAccount:github-publicar@$PROYECTO.iam.gserviceaccount.com" --role="$ROL" --condition=None --quiet > /dev/null
   done
   gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"
   gcloud iam workload-identity-pools providers create-oidc supervision \
     --location=global --workload-identity-pool=github --display-name="Supervision" \
     --issuer-uri="https://token.actions.githubusercontent.com" \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
     --attribute-condition="assertion.repository=='santifarah1/Supervision' && assertion.ref=='refs/heads/main'"
   gcloud iam service-accounts add-iam-policy-binding "github-publicar@$PROYECTO.iam.gserviceaccount.com" \
     --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/$NUMERO/locations/global/workloadIdentityPools/github/attribute.repository/santifarah1/Supervision"
   echo "LISTO. Mandale esto a Claude: PROYECTO=$PROYECTO NUMERO=$NUMERO"
   ```

4. Tiene que terminar con la línea `LISTO. Mandale esto a Claude: …`. Copiala y mandala.

Esto crea una "cuenta de servicio" que sólo puede publicar la página y las reglas, y le dice a Google que la deje usar **sólo** a este repositorio de GitHub y **sólo** desde `main` (lo que ya está mergeado). No se descarga ninguna clave.

Si algún comando dice `already exists` (ya existe), es porque se corrió dos veces: no pasa nada, seguí.

## 8. Claude completa los datos y vos mergeás

Los datos del proyecto ya están completos en la app, en el workflow de publicación y en la copia nocturna. **Mergeá ese PR recién después de terminar el paso 7**: al mergearlo, GitHub publica la app sola en **https://licencias-supervision-zona-i.web.app** y sube las reglas de seguridad. Lo ves en GitHub → **Actions → Publicar en Firebase**: tiene que quedar en verde.

## 9. El código de la supervisión

Sin este código nadie puede crear una cuenta. Las reglas del servidor lo comparan sin mostrarlo nunca en la página.

1. Consola de Firebase → **Firestore Database → Datos → Iniciar colección**.
2. ID de la colección: `config` → **Siguiente**.
3. ID del documento: `acceso`. Campo: `codigo`, tipo **string**, valor: un código en mayúsculas, por ejemplo `ZIGE-7K4P-2QX9` (inventá uno, sin O ni 0 para no confundirlas). **Guardar**.

## 10. Tu usuario de administradora

1. Abrí la app (el link del paso 8) → **Crear cuenta** → tu nombre, mail y una contraseña → elegí **Cargo licencias** → el código del paso 9 → **Crear cuenta**.
2. En la consola de Firebase → **Firestore Database → Datos → usuarios** → tocá tu documento (el que tiene tu mail) → en el campo `rol`, el lápiz → cambiá `carga` por `admin` → **Actualizar**.
3. Recargá la app: en **Ajustes** aparece la sección **Usuarios**. Desde ahí se maneja todo lo demás: el código, los tipos de usuario y las bajas.

## 11. Los demás usuarios

Pasale a cada persona el link de la app y el código (lo ves en **Ajustes → Usuarios**):

- **Los secretarios**: al crear la cuenta eligen **Cargo licencias**.
- **La supervisora**: elige **Solo consulto**. Ve todo y no puede modificar nada.

Si alguien se equivoca de tipo, lo cambiás vos en **Ajustes → Usuarios**.

## 12. Pasar los datos que ya están cargados en una compu

Si antes de tener el servidor ya se cargaron datos en una compu: en esa compu, **Ajustes → Datos y respaldo → Exportar copia**. Después, en la app con tu usuario de administradora: **Ajustes → Datos y respaldo → Importar copia** y elegí ese archivo. Ojo: reemplaza todo lo que haya en el servidor, así que se hace una sola vez, al principio.

## 13. La copia de todas las noches

Seguí [`herramientas/copia-diaria/LEEME.md`](../herramientas/copia-diaria/LEEME.md) con **las dos cuentas dueñas**. Así hay copias en dos Drives distintos.

## 14. El link de respaldo (plan B)

Si un día no anda el servidor, se puede seguir trabajando con una copia de la app que guarda sólo en la compu:

1. En GitHub: el repositorio → **Settings → Pages**.
2. En "Branch" elegí **main** y la carpeta **/ (root)** → **Save**.
3. A los pocos minutos queda en **https://santifarah1.github.io/Supervision/**. Ese link no pide usuario: guarda en el navegador de la compu, como la app antes del servidor, y avisa arriba que es el respaldo.

Además, dentro de la app con usuario está el **modo emergencia**: si el servidor no responde, la pantalla de ingreso ofrece "Usar la copia de esta compu". Está explicado en [Qué hacer si…](que-hacer-si.md).

---

## Más adelante: un Gmail nuevo como dueño principal

Cuando tengan el Gmail nuevo de la supervisión:

1. Dejalo un tiempo usándose normalmente (mails, Drive) antes de darle tareas técnicas.
2. Sumalo como **Propietario** (paso 2) y que acepte la invitación.
3. Instalá la copia de todas las noches también con esa cuenta (paso 13).

No hace falta mover ni copiar nada: el proyecto es el mismo, sólo se suma una dueña. Tu cuenta secundaria puede quedar como segunda dueña o salir después, desde la misma pantalla de **Usuarios y permisos**.
