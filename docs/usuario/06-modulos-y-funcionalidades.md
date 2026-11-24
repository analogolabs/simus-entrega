# 6. Módulos y funcionalidades

Qué hay dentro del sistema, espacio por espacio.

---

## 6.1 Portal público

SIMUS es el sistema completo: este portal, el espacio de la organización y el espacio
administrativo. El portal se presenta como SIMUS, y el Plan Nacional de Música para la
Convivencia es una sección suya de segundo nivel, al final del menú.

| Sección | Ruta | Estado |
|---|---|---|
| Inicio, portada de SIMUS | `/` | operativo |
| El Plan (PNMC): presentación, ejes, estrategias, actores, hitos, marco normativo y equipo | `/pnmc`, `/pnmc/ejes/:componentSlug` | operativo |
| Catálogo Editorial | `/editorial`, `/editorial/:codigo` | operativo |
| Galería | `/galeria` | operativo |
| Noticias | `/noticias`, `/noticias/:slug` | operativo |
| Agenda | `/agenda` | operativo |
| Mapa ecosistémico | `/mapa-ecosistemico`, `/mapa-ecosistemico/sobre-el-mapa` | operativo |
| Ecosistema · Festivales | `/ecosistema/festivales[/:id]` | operativo |
| Ecosistema · Mercados musicales | `/ecosistema/mercados-musicales[/:id]` | operativo |
| Ecosistema · Lutería (talleres) | `/ecosistema/luteria[/:id]` | operativo |
| Ecosistema · Espacios para música en vivo | `/ecosistema/espacios[/:id]` | operativo |
| Ecosistema · Redes y documentación | `/ecosistema/redes[/:id]` | operativo |
| Ecosistema · Territorios sonoros | `/ecosistema/territorios-sonoros[/:slug]` | operativo |
| Ecosistema · Prácticas musicales | `/ecosistema/practicas-musicales[/:slug]` | operativo |
| Registro e ingreso | `/registro`, `/ingresar` | operativo |

Las direcciones anteriores de El Plan redirigen: `/ejes` a `/pnmc#ejes`, `/ejes/:componentSlug` a
`/pnmc/ejes/:componentSlug`, y `/estrategia/circulacion` y `/estrategia/investigacion` a las anclas
`#celebra-la-musica` y `#territorios-sonoros` de `/pnmc`.

## 6.2 Espacio de la organización

Bajo `/gestion/o/{organizacionId}` —la organización activa va en la dirección (docs/desarrollo/19-cuentas-y-organizaciones.md §19.7)—:
resumen, datos de la organización y su persona responsable, archivos, eventos, solicitudes, equipo y
los procesos que la organización registra —**Festivales**, con sus Ediciones, y **Mercados
musicales**, con las suyas—. Cada proceso tiene su lista (`…/procesos/{proceso}`), su alta (`/nuevo`)
y su ficha (`/:id`). Lo de la persona —Mi espacio, sus organizaciones, perfil público, datos
personales y seguridad— vive en `/gestion/cuenta`.

Una organización **no puede registrar procesos sin correo confirmado**. Mientras no haya proveedor
de correo, la confirmación la hace el equipo del PNMC desde la consola, con motivo y registro.

## 6.3 Consola de gestión administrativa

**Diecisiete secciones en cinco grupos**, bajo `/administracion`. Salen de
`features/admin/domain/navegacion-administrativa.ts`, que es la única lista:

| Grupo | Secciones |
|---|---|
| Bandeja de trabajo | Resumen operativo · Solicitudes y revisiones |
| Ecosistema musical | Festivales y ediciones · Mercados musicales · Procesos del ecosistema · Organizaciones y responsables |
| Publicaciones y mediateca | Catálogo Editorial · Agenda y eventos · Noticias y prensa · Categorías y proyectos · Banco de archivos |
| Sitio web y comunicación | CMS · Boletín informativo |
| Gobierno y control | Análisis y consultas · Auditoría y trazabilidad · Usuarios y roles · Salud del sistema |

**Dos secciones se retiraron y conviene decir por qué.** «Calidad y coincidencias» listaba en tres de
sus cinco pestañas los mismos trámites que la bandeja, leídos de los mismos endpoints: eran dos
pantallas para decidir lo mismo, y sus dos pestañas propias —duplicados y alertas de calidad— entraron
en la bandeja como dos posiciones más de su filtro. «Galería y memoria visual» no tenía detrás ningún
módulo: una entrada de navegación que lleva a una pantalla vacía promete algo que no existe.

Las secciones visibles dependen del **conjunto** de roles de la cuenta, no del rol principal: quien
tenga dos roles ve lo que le permiten los dos.

## 6.4 Los seis procesos del Ecosistema Musical

Escuelas de música · Escenarios · **Festivales** · Mercados musicales · Redes y documentación ·
Lutería.

Hoy **Festivales, Mercados musicales, Lutería, Espacios para música en vivo y Redes y documentación tienen
directorio público, ficha y recuento**, y Escuelas de música quedó fuera por ahora (decisión del 10 nov 2026).
El bloque del Inicio los muestra igualmente, con una raya donde iría la cifra: una raya
dice «no hay dato publicado», un cero diría «no hay ninguno».

El Festival es la entidad principal y **la Edición es un subelemento suyo**, nunca un módulo de
navegación equivalente.

## 6.5 Alcance de cada módulo

Funcionan de punta a punta: Festivales y Ediciones, **Mercados musicales y sus ediciones**, **talleres de lutería**, **espacios para música en vivo**, **redes y centros de documentación**,
Catálogo Editorial, Agenda, Noticias, Galería, Banco de archivos, CMS de páginas y bloques, Boletín,
Organizaciones, Usuarios y roles, Auditoría y el Mapa ecosistémico.

**Mercados musicales recorre el circuito entero**, igual que Festivales: se registra desde el espacio
externo o desde la consola, se envía a revisión, se devuelve campo por campo, se publica, se propone
un cambio sobre lo publicado y se pide su retiro; tiene ediciones con su propio ciclo, ficha pública,
recuento en el Inicio, presencia en el geovisor y consultas propias en la Consulta Guiada. Lo único
que le falta es la importación asistida, que espera una decisión de producto.

**Lutería registra el taller**, no sus procesos: una jornada, una clase o una venta se anuncian
como eventos de la Agenda, sin subregistro. El responsable es **una organización o una persona**: un
lutier independiente registra su taller con su cuenta individual (`/gestion/cuenta/talleres`) y una
organización lo hace desde `/gestion/o/{id}/procesos/luteria`. Recorre el mismo circuito que Mercados
—borrador, revisión del Programa, ajustes, publicación y retiro con motivo— sin revisión por campos ni
propuestas de cambio: una errata en un taller publicado se aplica al instante y un cambio de fondo
(nombre, territorio, modalidad, servicios o familias) lo devuelve a revisión. Los vocabularios
(familias de instrumentos y servicios del taller) nacen «propuestos» a la espera de que el Plan
Nacional de Música para la Convivencia los apruebe ([docs/27](../referencia/27-fuentes-de-luteria.md)). Su capa
«Lutería» alimenta el mapa. Se prueba con `TalleresDeLuteriaTests` y el recorrido
`e2e/luteria-recorrido-del-taller.spec.ts`.

**Espacios para música en vivo registra el lugar** —un bar, una sala, un teatro, una casa de cultura, un
escenario al aire libre—, no lo que ocurre en él: un concierto o un ciclo se anuncian como eventos de la
Agenda, sin subregistro. Sigue el patrón de Lutería: el responsable es **una organización o una persona**
(`/gestion/o/{id}/procesos/espacios` y `/gestion/cuenta/espacios`), el circuito es el de Mercados y
Lutería (borrador, revisión del Programa, ajustes, publicación y retiro con motivo) y una errata en un
espacio publicado se aplica al instante, mientras un cambio de fondo (nombre, ambiente, municipio,
dirección o tipos) lo devuelve a revisión. El espacio siempre está en un municipio, lleva un aforo opcional
y declara su accesibilidad como dato de tres estados (sí, no o no consta). Los vocabularios (tipos de
espacio y equipamiento) nacen «propuestos» a la espera de que el Plan Nacional de Música para la
Convivencia los apruebe. Su capa «Espacios» alimenta el mapa. Se prueba con
`EspaciosParaMusicaEnVivoTests` y el recorrido `e2e/espacios-recorrido-del-espacio.spec.ts`.

**Redes y documentación** registra la red, el archivo, el centro de documentación, la colección o el grupo
de investigación: qué acervos tiene y cómo se consultan, no cada documento (eso es el Catálogo Editorial).
Es un **módulo propio**, no un tipo de organización. Como Lutería, el responsable es **una organización o
una persona** (`/gestion/o/{id}/procesos/redes` o `/gestion/cuenta/redes`) y recorre el mismo circuito —borrador,
revisión del Programa, ajustes, publicación y retiro con motivo— sin revisión por campos: una errata se
aplica al instante y un cambio de fondo (nombre, territorio, tipo de nodo, formas de acceso o formatos) lo
devuelve a revisión. Las jornadas y los conversatorios son eventos de la Agenda. Las formas de acceso y los
formatos de documentación nacen «propuestos» a la espera del Plan Nacional de Música para la Convivencia. Su
capa «Redes doc.» alimenta el mapa. Se prueba con `RedesDeDocumentacionTests` y el recorrido
`e2e/redes-recorrido-de-la-red.spec.ts`.

El **envío de correo** está construido por completo y expone un único punto de conexión con el
proveedor; mientras no haya proveedor contratado, las notificaciones se registran en el sistema y no
se simula su entrega.

---


---

## 6.6 El flujo de revisión y publicación

Es el mismo para cualquier proceso del Ecosistema, y es lo que define el producto.

### Los estados

| Estado | Qué significa |
|---|---|
| `borrador` | en elaboración, visible solo para quien lo trabaja |
| `en_revision` | enviado, a la espera de decisión institucional |
| `ajustes_solicitados` | devuelto con observaciones concretas |
| `publicado` | visible en el portal |
| `archivado` | retirado del flujo activo, sin borrarse |

### El recorrido

1. **Registro.** Una organización crea el proceso desde su espacio, o el equipo lo incorpora desde la
   consola. Nace en `borrador` y admite autoguardado: el formulario se puede dejar a medias.
2. **Comprobación de duplicados.** Al registrar, el sistema busca coincidencias con registros
   históricos reclamables y con los ya registrados, para que la misma realidad no entre dos veces.
3. **Envío a revisión.** Cuando el registro está completo, su responsable lo envía y queda
   `en_revision`. A partir de ahí no puede editarlo.
4. **Revisión campo por campo.** El equipo revisa por secciones y deja observaciones **sobre campos
   concretos**, no un comentario general. Puede aprobar o devolver.
5. **Ajustes.** Si se devuelve, el responsable ve exactamente qué campos hay que corregir, los
   atiende uno a uno y vuelve a enviar.
6. **Publicación.** Aprobado, el registro se publica y aparece en el portal. Queda guardada la
   versión publicada de la ficha.

### Sobre lo ya publicado

Un registro publicado **no se edita directamente**. Se distingue entre dos cosas:

- **Corregir el contacto público** —correo, teléfono y enlaces— es directo y no necesita aprobación:
  son datos operativos que deben poder actualizarse el mismo día.
- **Cambiar cualquier otro dato** exige una **propuesta de cambio**, que se registra campo por campo
  con el valor anterior y el propuesto. El equipo acepta o rechaza **cada campo**, y solo lo aceptado
  se aplica.

### Retirar un registro

Un borrador que nunca se publicó se elimina. **Lo que llegó a publicarse en algún momento se
archiva**, no se borra: quedó a la vista del público y su rastro debe poder consultarse. El sistema
lo decide por el historial del registro, no por su estado actual.

### Incorporar un proceso nuevo

El [núcleo reutilizable de procesos](../desarrollo/13-nucleo-de-procesos.md) define qué se reutiliza
—propiedad, revisión, historial, propuestas y relaciones— y qué sigue siendo propio de cada dominio.
Es la guía obligatoria antes de crear un proceso nuevo; evita copiar Festivales o Mercados sin
declarar sus diferencias.

## 6.7 Herramientas

El apartado **Herramientas** reúne lo que una organización puede habilitar sobre una edición de uno de sus procesos.
No es un proceso del Ecosistema: no tiene ficha pública ni revisión. La primera herramienta es la **agenda de citas
entre artistas y compradores o bookers** de un Mercado (`/gestion/o/{id}/herramientas`; quien participa la ve en
`/gestion/cuenta/agenda-de-citas`; el portal dice cuáles están abiertas en `/ecosistema/agenda-de-citas`, sin enseñar
a ninguna persona). Diseño, reglas y lo que quedó fuera: [26](../referencia/26-agenda-de-citas-y-mercados.md).
