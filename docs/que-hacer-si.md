# Qué hacer si…

Guía para cuando algo no anda. Está pensada para leerla con calma en el momento del problema, sin tener que acordarse de nada.

**Datos a mano**

- App: **https://licencias-supervision-zona-i.web.app**
- Link de respaldo (guarda sólo en la compu): **https://santifarah1.github.io/Supervision/**
- Consola de Firebase: **console.firebase.google.com** → proyecto **Licencias Supervision Zona I** (`licencias-supervision-zona-i`, número `697446325681`)
- Copias de todas las noches: Drive de cada cuenta dueña → carpeta **Copias Licencias Supervisión**
- Repositorio: **github.com/santifarah1/Supervision**

---

## La página no abre o dice "Sitio no encontrado"

Lo más probable es que Google haya suspendido el proyecto o la cuenta dueña. Los datos no se pierden: quedan en el servidor y vuelven cuando se levanta la suspensión.

**Para seguir trabajando mientras tanto** (en la compu donde se carga siempre):

1. Abrí la app. Si aparece la pantalla de ingreso, abajo va a estar **"¿No anda el servidor? Usar la copia de esta compu"**. Tocalo.
2. Si la página ni siquiera abre, usá el **link de respaldo** y cargá ahí. Guarda sólo en esa compu, pero no se pierde.
3. En los dos casos, al terminar el día tocá **Exportar copia** y guardá el archivo en un pendrive o mandátelo por mail.

**Cuando vuelve a andar:**

1. En la compu donde se cargó en emergencia (o en el link de respaldo): **Exportar copia**.
2. Entrá a la app normal → **Ajustes → Datos y respaldo → Sumar una copia…** y elegí ese archivo.
3. Se agregan las licencias nuevas y los cambios, sin borrar nada de lo que había en el servidor. Si se suma dos veces la misma copia, no se duplica.

**Para recuperar la cuenta:** entrá a gmail.com con la cuenta dueña. Si dice que está inhabilitada, seguí el botón para apelar y explicá que es una cuenta para una app de una supervisión escolar. Mientras tanto, la **otra cuenta dueña** puede entrar a la consola de Firebase y ver si el proyecto aparece suspendido y por qué.

## No hay internet

No hace falta hacer nada. La app sigue andando con lo último que cargó y guarda lo nuevo en la compu. Arriba dice **"Sin conexión"**. Cuando vuelve internet, se sube solo. No cierres sesión mientras no haya internet, porque lo que no se subió todavía se perdería.

## Alguien borró o cargó algo mal

- **Una licencia o una persona puntual**: se corrige a mano en la app, como siempre.
- **Se rompió mucho** (por ejemplo, se importó una copia equivocada):
  1. Buscá en el Drive, en **Copias Licencias Supervisión**, la copia de la noche anterior al problema (`copia-automatica-AAAA-MM-DD.json`) y bajala.
  2. Como administradora: **Ajustes → Datos y respaldo → Importar copia…** y elegí ese archivo.
  3. **Ojo:** "Importar copia" **reemplaza todo**, así que se pierde lo que se cargó después de esa noche. Si sólo querés recuperar cosas que faltan, usá **Sumar una copia…**.

## Una persona aparece dos veces

Cada persona tiene que tener **una sola ficha**, aunque trabaje en dos CEPJA. Si alguien quedó cargado dos veces (por ejemplo, sin DNI), pasá sus licencias a una de las dos fichas (en cada licencia, cambiá el agente), sumale a esa ficha los cargos de la otra y después borrá la ficha que sobra.

## Me olvidé la contraseña

En la pantalla de ingreso, escribí el mail y tocá **Olvidé mi contraseña**. Llega un mail para elegir una nueva (mirá en spam). Si entrás con Google, no hay contraseña: se usa la de Gmail.

## Se rompió o se cambió la compu

Los datos están en el servidor, no en la compu. En la compu nueva se abre la app y se entra con el mismo usuario. Si la compu vieja la va a usar otra persona, entrá en ella y usá **Salir y borrar esta compu**, desde el botón del usuario, arriba a la derecha.

## Entra alguien nuevo o alguien se va

- **Alguien nuevo**: pasale el link y el **código de la supervisión** (lo ves en **Ajustes → Usuarios**). Al crear su cuenta elige si carga o sólo consulta. Lo podés cambiar después.
- **Alguien se va**: en **Ajustes → Usuarios**, **Dar de baja**. Desde ese momento el servidor no le deja ver ni cargar nada.
- **El código se pasó a quien no tenía que tenerlo**: **Ajustes → Usuarios → Generar uno nuevo**. El viejo deja de servir para crear cuentas; los que ya tienen cuenta siguen entrando.

## Hay un CEPJA nuevo, o uno cierra

**Ajustes → Pestañas** (sólo quien administra). **Agregar pestaña** crea una nueva; **Archivar** la oculta sin borrar a nadie, y se puede recuperar.

## Las copias de la noche dejaron de llegar

1. Entrá a **script.google.com** con la cuenta dueña → proyecto **Copia diaria Licencias Supervisión** → **Ejecuciones** (el ícono de la lista).
2. Si hay corridas con error, abrí la última y fijate el mensaje. Los errores comunes y su arreglo están en [`herramientas/copia-diaria/LEEME.md`](../herramientas/copia-diaria/LEEME.md).
3. Si no hay ninguna corrida, ejecutá de nuevo la función `instalar`.

## GitHub muestra una cruz roja

- **En un PR, en "Pruebas"**: alguna prueba automática falló, o sea que ese cambio rompe algo. No lo mergees hasta que esté en verde.
- **En main, en "Publicar en Firebase"**: no se pudo publicar la versión nueva. La app sigue andando con la versión anterior. Abrí la corrida en la pestaña **Actions** y mirá el error. Si dice "suspended" o "permission denied", es el caso de "La página no abre" de arriba.
