# 24. Versionamiento y gobierno del dato

**Estado: decidido y en construcción** (10 nov 2026). Las fases 0 y 1 están implementadas
(§24.10); las fases 2 a 4 siguen planificadas. El documento nació como propuesta: audita cómo se guarda
hoy el historial de cada registro, nombra las brechas y propone un modelo único y reutilizable. Las
respuestas de la dirección a sus preguntas están en §24.8 y mandan sobre las recomendaciones originales.

Se apoya en [`docs/referencia/20-decisiones-y-flujos-por-modulo.md`](../referencia/20-decisiones-y-flujos-por-modulo.md) (quién crea, revisa y publica; cinco
mecanismos), [`docs/desarrollo/13-nucleo-de-procesos.md`](13-nucleo-de-procesos.md) (el núcleo de procesos),
[`docs/desarrollo/05-base-de-datos.md`](05-base-de-datos.md) (el modelo de datos), [`docs/operacion/11-operacion-y-mantenimiento.md`](../operacion/11-operacion-y-mantenimiento.md)
(datos personales y retención) y [`docs/desarrollo/19-cuentas-y-organizaciones.md`](19-cuentas-y-organizaciones.md) (cuentas y
organizaciones). No los sustituye: si se aprueba, las decisiones pasan a `docs/referencia/20-decisiones-y-flujos-por-modulo.md` como una versión nueva.

## 24.1 Qué se pidió

Hoy el sistema versiona con rigor **una sola cosa**: el perfil público del Festival. Se pidió pensar
cómo se versiona y se gobierna el dato en **todos** los registros: ediciones, organizaciones, registros
individuales (persona y cuenta), Festivales, Mercados y el resto. Las preguntas que ordenan el
documento:

1. ¿Qué valía este campo el día X, quién lo cambió y por qué?
2. ¿Qué parte de ese historial puede ver el público, la organización y la consola?
3. ¿Cómo se conserva, cuánto tiempo y cómo se protege cuando hay datos personales?
4. ¿Se puede volver atrás?
5. ¿Quién vio el dato? (auditoría de acceso)

## 24.2 Cómo se guarda hoy

Hay ocho mecanismos. Cada uno resuelve una pregunta distinta, y ninguno es un historial completo.

| # | Mecanismo | Tablas | Qué responde | Qué no responde |
|---|---|---|---|---|
| 1 | **Estado** del registro | `EstadoRegistro` en cada tabla; `EstadosContenido` | En qué punto del ciclo está ahora | Cómo llegó ahí |
| 2 | **Versión pública** | `VersionesFestival` (`NumeroVersion`, `EsVigente`) y sus tablas hijas `VersionesFestival…` (archivos, localizaciones, modalidades, entidades socias y otras relaciones) | Qué decía la ficha pública en cada versión, completa | Solo existe para Festivales; no dice quién cambió cada campo |
| 3 | **Propuesta de cambio** | `PropuestasDeCambio` y `PropuestasDeCambioCampos` (`ValorAnterior`, `ValorPropuesto`, motivo, quién propone, quién decide) | Campo a campo, qué se pidió cambiar de lo publicado y con qué resultado | Solo cubre cambios a lo ya publicado; un cambio directo no pasa por aquí |
| 4 | **Instantánea de cada envío a revisión** | `EnviosDeRevision` (`NumeroEnvio`, `DatosJson`) | Cómo estaba el registro el día que se envió | Lo que ocurre entre dos envíos |
| 5 | **Historial de transiciones** | `RegistrosRevisionHistorial` (estado anterior y nuevo, acción, comentario, motivo, campos observados, `MetadataJson`, y copia del nombre de la organización, del responsable y del actor al escribir) | Quién movió el registro de estado, cuándo y por qué | Qué datos tenía; no guarda valores de campos |
| 6 | **Bitácora de auditoría** | `BitacoraAuditoria` (`IdUsuario`, tabla, registro, `Accion`, `ValoresAnteriores`, `ValoresNuevos`, `FechaAccion`) | Que alguien hizo algo sobre una fila | Depende de quien la escribe: unas veces guarda `antes` y `después`, otras solo el nombre del evento |
| 7 | **Historial de contenidos web** | `TextosSitioHistorial` y `MediosWebHistorial` (el historial de la nómina del equipo está por confirmar) | Quién, cuándo, qué acción y el valor nuevo | Tope de 6 entradas por clave; las imágenes guardan solo las señas, no el archivo |
| 8 | **Procedencia y autorizaciones** | `ProcedenciasDeRegistro`; `AutorizacionesDatos`, `PoliticasDatos` | De dónde viene un registro; qué autorizó una persona y en qué versión del texto | Las autorizaciones nunca se borran: están bien resueltas |

Dos propiedades del diseño actual que **conviene conservar**:

- **La instantánea se copia al escribir, no se resuelve al leer.** `RegistrosRevisionHistorial` guarda el
  nombre de la organización y del actor tal como eran. Si se renombra la organización, su historial no
  se reescribe en silencio. Las filas anteriores a ese cambio quedan vacías y no se rellenan: «una fila
  vacía dice la verdad».
- **El número de documento no se copia al historial.** Una entrada de historial no lo necesita para ser
  veraz, y copiarlo multiplicaría el dato personal. Vive una sola vez, en `EntidadesResponsable`.

## 24.3 Matriz por entidad

Leyenda: **●** se puede reconstruir; **◐** parcialmente; **○** no. «Campos» es la pregunta «qué valía este
campo el día X». «Quién y por qué» es la pregunta de autoría. «Lectura» dice quién puede leer hoy el
historial. Lo que no verifiqué en el código queda marcado «por confirmar».

| Entidad | Qué se guarda hoy | Campos | Quién y por qué | Lectura | Reversión | Brecha principal |
|---|---|---|---|---|---|---|
| **Festival** (perfil público) | Versión pública numerada, propuestas con valores, instantánea por envío, historial de estados | ● | ● | Consola y organización; **nada público** | ○ (solo con una propuesta inversa) | Es el modelo de referencia; falta una lectura pública citable |
| **Edición de Festival** | Una sola fila; estado de registro, de visibilidad y operativo; historial de transiciones; la bitácora anota el cambio de visibilidad | ○ | ◐ (transiciones) | Consola; la organización lee el historial de su Festival | ○ | **Una edición publicada se corrige sobre sí misma (decisión 13 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`): el valor anterior se pierde** |
| **Mercado** | Propuesta aprobada que se aplica a la ficha; historial; bitácora con `antes` y `después` | ◐ (lo que pasó por propuesta) | ● | Consola y organización | ○ | Sin versión pública (decisión 5); los cambios directos de borrador no dejan valores |
| **Edición de Mercado** | Estado propio; las de un Mercado publicado no se revisan una a una | ○ | ◐ | Por confirmar | ○ | Mismo hueco que la edición de Festival |
| **Organización** (ficha y responsable) | La bitácora anota el evento («actualizó el perfil de la organización») **sin valores**; reclamaciones y transferencias de administración con su propio rastro; `FechaRevisionConsola` con autor | ○ | ◐ | Consola | ○ | No hay historia de la ficha propia: nadie puede decir qué correo o sede tenía hace seis meses |
| **Persona y cuenta** (`Usuarios`, `EntidadesResponsable`) | La bitácora anota «actualizar» al cambiar datos personales o la contraseña, sin valores; el perfil público de la persona sí guarda `antes` y `después` | ○ (por diseño en datos personales) | ◐ | Consola | ○ | Falta decidir qué es correcto guardar de un dato personal (§24.5.5) |
| **Membresías, roles e invitaciones** | Por confirmar: invitaciones con estado y fechas; cambios de rol por la bitácora | por confirmar | por confirmar | por confirmar | ○ | Auditar quién concedió o retiró un rol |
| **Evento de organización** | Historial de estados; bitácora con estado anterior | ○ | ● (transiciones) | Organización y consola | ○ | Mismo patrón que las ediciones |
| **Agenda** (consola) | Historial de estados (`docs/referencia/20-decisiones-y-flujos-por-modulo.md`, decisión 1); bitácora | ○ | ● | Consola | ○ | No quedan los valores de lo que se corrige |
| **Noticia** | Historial de estados; bitácora con `antes` y `después` de **título, resumen y fecha**; `Version` de concurrencia; errata marcada | ◐ | ● | Consola | ○ | **El cuerpo no queda en ningún historial**: una errata, o un cambio de fondo, no se puede comparar |
| **Catálogo editorial** | Historial de estados y anotaciones; `Version` de concurrencia; derechos y fuentes con historial | ◐ | ● | Consola | ○ | Igual que Noticias para el contenido de la ficha |
| **Textos del sitio (CMS)** | Valor nuevo de cada acción; autor y hora | ◐ | ◐ (sin motivo) | Consola | ◐ **(se puede volver a escribir el valor viejo a mano, mientras esté dentro del tope)** | Tope de 6 entradas por clave: el pasado se poda |
| **Imágenes (CMS)** | Señas de la imagen (tipo, peso, medidas, huella); no el archivo | ○ | ◐ | Consola | ○ **(deliberado)** | Criterio de producto: reemplazar una imagen la borra |
| **Autorizaciones de datos** | Cada otorgamiento y retiro, con fecha y versión del texto; nunca se borran | ● | ● | La persona y la consola | n. a. | Es el patrón a imitar |
| **Archivos de registro** | Dueño y huella; deduplicado por dueño; una solicitud de reclamación impide retirar un soporte citado | ◐ | ◐ | Por confirmar | ○ | Reemplazo de un archivo sin rastro del anterior |
| **Importaciones** | Cabecera del lote, decisiones humanas y auditoría conservadas; previsualizaciones depuradas al vencer | ● | ● | Consola | ○ | Retención automática solo de previsualizaciones |
| **Reclamaciones y fusiones de Festivales históricos** | Bitácora de los dos registros y de cada solicitud trasladada; el absorbido se conserva con `FusionadoEnId` | ● | ● | Consola | ○ (una fusión no se deshace) | La reversibilidad de una fusión no está definida |

## 24.4 Brechas

Ordenadas por impacto en la pregunta «¿qué valía esto el día X y quién lo cambió?».

**G1 · Las ediciones no se versionan.** Es la brecha que motiva este documento. Una edición es el dato
que más se corrige (fechas, sedes, director, cifras) y se corrige sobre la misma fila. El historial
registra que se publicó, pero no lo que valía antes. La decisión 13 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md` (la organización publica
sus ediciones sin revisión) hace que el cambio directo sea correcto, y por eso mismo el rastro tiene
que venir de otro lado.

**G2 · La organización no tiene historia propia.** La bitácora conserva el nombre del evento
(«actualizó el perfil») pero ni un valor. Sí existe la instantánea de la organización dentro del
historial de los procesos, que es la parte bien resuelta.

**G3 · La bitácora no tiene un contrato.** Cada módulo la escribe a su manera: algunos con `antes` y
`después`, otros con solo el estado, otros sin valores. El CHECK de `Accion` admite trece verbos, y los
eventos nuevos viajan en el JSON con nombres libres (`contrasena_cambiada`,
`actualizar_perfil_organizacion`). Hoy no se puede preguntar a la bitácora de forma uniforme.

**G4 · El contenido largo no se guarda.** El cuerpo de una noticia, de una ficha editorial o de un
evento no queda en ningún historial. Para una errata esto no importa; para un cambio de fondo, sí.

**G5 · El CMS poda su pasado.** Seis entradas por clave, sin motivo, sin restauración. Es una decisión
tomada («si se reemplaza, desaparece») y se respeta; lo que falta es que la poda no borre el rastro de
que algo se cambió.

**G6 · No hay lectura pública del pasado.** `docs/desarrollo/05-base-de-datos.md` promete que `VersionesFestival` permite «saber qué
decía un registro antes de una corrección», pero ninguna ruta pública entrega una versión anterior ni
hay un identificador citable. Un informe del Ministerio no puede decir «según la ficha, versión 3».

**G7 · No hay política de retención ni de derechos del titular.** `docs/operacion/11-operacion-y-mantenimiento.md` §11.5 dice que no se
automatiza ninguna eliminación mientras la Tabla de Retención Documental institucional no defina serie,
tiempo y disposición. Es la decisión correcta mientras no exista esa tabla, pero deja sin respuesta:
cuánto se conserva el historial de una persona que cierra su cuenta; qué pasa con el nombre del actor
copiado en el historial; cómo se atiende una solicitud de rectificación o supresión. Hoy la persona
puede revocar el boletín y editar su perfil, y nada más.

**G8 · No hay reversión.** Volver a una versión anterior es siempre una propuesta nueva escrita a mano.

**G9 · Auditoría de acceso.** No encontré un registro de **lecturas** de datos personales (quién abrió
la ficha de una persona o el documento de un responsable). Lo que existe audita escrituras. Por confirmar
con una búsqueda más profunda antes de afirmarlo en un documento externo.

**G10 · Tiempo de registro frente a tiempo de vigencia.** Si el 10 de noviembre se corrige la fecha de una
edición de 2024, el historial dice «cambió el 10 de nov» y el dato dice «2024». Son dos relojes y hoy
solo uno se registra de forma sistemática. No hace falta un modelo bitemporal completo, pero sí decidir
cuándo importa.

## 24.5 Modelo propuesto

Una idea ordena todo: **separar tres cosas que hoy se mezclan.**

| Capa | Qué es | Quién la lee | Qué garantiza |
|---|---|---|---|
| **Versión publicada** | Lo que el público vio, completo y citable | Público, organización, consola | Inmutable una vez publicada; número y huella |
| **Registro de cambios** | Qué campo cambió, de qué valor a cuál, por quién y por qué | Consola; la organización, de lo suyo | Se escribe en la misma transacción que el cambio |
| **Bitácora de auditoría** | Hechos de seguridad y de gestión: ingresos, permisos, decisiones, lecturas sensibles | Consola con permiso | Contrato único; no es el historial del dato |

### 24.5.1 Registro de cambios por campo (`CambiosDeRegistro`)

Una tabla genérica, en la línea de `docs/desarrollo/13-nucleo-de-procesos.md`: el par `ModuloId` + `RegistroId` identifica al dueño y
cada proceso conserva sus propias claves. Una fila por campo cambiado.

| Columna | Para qué |
|---|---|
| `ModuloId`, `RegistroId`, `SubregistroId` | A qué registro pertenece (la edición es subregistro del Festival) |
| `CampoId`, `CampoEtiqueta` | Qué campo; los mismos identificadores que ya usan la revisión por campos y las propuestas |
| `ValorAnterior`, `ValorNuevo` | Según la clase de dato (§24.5.5); nulo cuando el dato no se guarda |
| `Origen` | `directo`, `propuesta`, `importacion`, `fusion`, `sistema` |
| `PropuestaId`, `EnvioId`, `VersionId` | Enlaces opcionales al resto del expediente |
| `ActorId`, `ActorNombre`, `ActorRol` | Quién; el nombre se copia al escribir, como hoy |
| `Motivo` | Obligatorio en los cambios que decide una persona de la consola; opcional en las erratas |
| `Fecha` (registro) y `VigenteDesde` (vigencia, opcional) | Resuelve G10 solo donde importa |

**Cómo se llena.** Con **un servicio central** que cada endpoint llama antes de guardar, no con
disparadores de base de datos ni con un interceptor global. Es coherente con cómo ya trabaja el
proyecto (`HistorialDeEstados.Registrar`, `RecordHistoryAsync`) y deja que cada proceso decida qué
campos vigila. El servicio compara la fila original con la nueva a partir de una lista declarada de
campos del proceso, y escribe en el mismo `SaveChanges`.

### 24.5.2 Versión publicada (`VersionesDeRegistro`)

Generaliza lo que hoy es `VersionesFestival`, sin tocarlo.

- Para **Festivales** no se migra: se conservan `VersionesFestival` y sus tablas hijas, y se expone con
  un adaptador a la forma común.
- Para **Mercados, ediciones y organizaciones públicas** se crea una tabla nueva con la forma
  (`ModuloId`, `RegistroId`, `NumeroVersion`, `EsVigente`, `InstantaneaJson`, `EsquemaVersion`,
  `Huella`, `PropuestaId`, `FechaPublicacion`).
- La instantánea es un **JSON con esquema versionado** (`EsquemaVersion`), no una tabla ancha por
  módulo: cambiar un campo de una edición no obliga a migrar nada y las versiones viejas se siguen
  leyendo con el esquema con el que se escribieron.
- Una versión publicada **no se edita**. Una corrección posterior es una versión nueva.

### 24.5.3 Estados e historial

No cambia. `RegistrosRevisionHistorial` sigue siendo el expediente de transiciones y
`EnviosDeRevision` la instantánea por envío. El registro de cambios se **enlaza** a ellos, no los
reemplaza.

### 24.5.4 Bitácora con contrato

Se mantienen los trece verbos del CHECK (cambiarlos exige migrar). Lo nuevo es un **contrato del JSON**
que todo escritor cumple:

```
{ "evento": "<nombre estable>", "antes": {...}, "despues": {...}, "motivo": "...", "origen": "..." }
```

Un catálogo único de eventos (en código, con una prueba que falla si un escritor inventa uno) reemplaza
los nombres libres. La bitácora deja de intentar ser el historial de datos: ese papel pasa al registro
de cambios.

### 24.5.5 Datos personales: qué se guarda de cada campo

Se reutiliza la clasificación que ya existe para los registros técnicos
(`RedaccionDatosPersonales.ClaseDato`: público, correo, documento, teléfono, persona, dirección) y se
declara **por campo**, en el mismo lugar donde se declara qué campos vigila cada proceso.

| Clase de dato | Qué guarda el registro de cambios | Ejemplo |
|---|---|---|
| Público | Valor anterior y nuevo | Nombre de un Festival, fechas de una edición |
| Personal de contacto | Solo «cambió» y la fecha; el valor se guarda cifrado o no se guarda (decisión 2 de §24.8) | Correo, teléfono |
| Identificación | **Nunca el valor**; «cambió» y quién | Número de documento |
| Sensible o poblacional | Nunca el valor | Cualquier dato de enfoque diferencial |

Con esto se cumple lo que ya está dicho en el código (no multiplicar la cédula por todo el historial) y se
extiende a todo el sistema.

**Anonimización.** Cuando una persona ejerza supresión, se reemplazan `ActorNombre`, los nombres de
persona copiados en historiales y los valores personales por un marcador (`persona anonimizada`) y se
**conserva el hecho**: que alguien con ese rol hizo ese cambio ese día. Es la misma lógica por la que una
autorización revocada se conserva con fecha de retiro. El procedimiento y el plazo requieren decisión
jurídica (§24.8).

### 24.5.6 Retención propuesta

Mientras no exista la Tabla de Retención Documental, no se purga nada automáticamente (decisión vigente).
Se propone **declarar** la retención por tabla desde ya, para que la TRD la confirme o ajuste:

| Material | Propuesta | Razón |
|---|---|---|
| Versiones publicadas | Indefinida | Es evidencia de lo que el público vio |
| Historial de transiciones y envíos | Indefinida | Es evidencia administrativa |
| Registro de cambios de datos públicos | Indefinida | Responde «qué valía el día X» |
| Registro de cambios con datos personales | Mientras la persona tenga cuenta o proceso activo; luego, anonimizar (plazo: jurídico) | Minimización |
| Bitácora de auditoría | Indefinida hasta la TRD | Seguridad y rendición de cuentas |
| Historial de textos del CMS | Tope actual (6 por clave) | Decisión de producto ya tomada; se anota que el tope existe |
| Previsualizaciones de importación | Plazo actual, depuración automática | Ya implementado |

### 24.5.7 Lectura y consulta

- **Línea de tiempo interna única**: `GET /api/v1/admin/registros/{modulo}/{id}/linea-de-tiempo` junta
  versiones, transiciones, cambios y bitácora en orden cronológico, con el permiso del módulo. La
  organización tiene una vista de lo suyo (`/externo/organizaciones/{org}/…`), limitada por la guarda de
  propiedad que ya existe. Un solo componente de interfaz (`Historial`) la muestra en todas las fichas.
- **Lectura pública de versiones**: `GET /api/v1/publico/{modulo}/{id}/versiones/{numero}`, solo de
  versiones publicadas, con el número y la huella como cita estable. Las versiones no publicadas y el
  registro de cambios **nunca** salen por la superficie pública.

### 24.5.8 Reversión

«Restaurar» nunca escribe sobre lo publicado:

1. El usuario elige una versión o un valor anterior.
2. El sistema crea un **borrador** o una **propuesta** con ese contenido.
3. Pasa por el mismo circuito que cualquier cambio.

Para el CMS, «restaurar» es cargar el valor de una entrada del historial como borrador, mientras la
entrada no se haya podado. Las imágenes siguen sin restauración, por decisión de producto.

### 24.5.9 Auditoría de acceso

Se propone registrar, en la bitácora y con el mismo contrato, solo las **lecturas de datos de
identificación** (la ficha de una persona responsable, un documento), no cada lectura de una ficha
pública. Es acotado, sirve para habeas data y no multiplica el volumen. Por decidir (§24.8).

## 24.6 Cómo queda cada entidad

| Entidad | Versión publicada | Registro de cambios | Notas |
|---|---|---|---|
| Festival | `VersionesFestival` (existe) | Para los campos que hoy no pasan por propuesta | Se enlaza a la propuesta |
| Edición de Festival | `VersionesDeRegistro` | Sí, por campo | Resuelve G1 |
| Mercado | No (decisión 5); se mantiene la propuesta aplicada | Sí, por campo | Si se quiere versión pública, sería una decisión nueva |
| Edición de Mercado | Como la de Festival, si se aprueba | Sí | |
| Organización | Solo si se hace pública (ya lo exige `FechaRevisionConsola`) | Sí, con clase de dato | Resuelve G2 |
| Persona y cuenta | No | Solo «cambió» para contacto e identificación | |
| Evento y Agenda | No | Sí, para el contenido relevante | |
| Noticia y Catálogo | No | Cuerpo y metadatos, con huella del cuerpo | Resuelve G4 sin guardar el texto completo dos veces: se guarda el texto en la tabla de cambios solo si la edición es «de fondo» |
| CMS | No | Se mantiene su historial | Sin cambios |

## 24.7 Plan por fases

Los esfuerzos son relativos (S = días, M = una a dos semanas, L = más). La entrega de noviembre llega
hasta la fase 1.

| Fase | Contenido | Esfuerzo | Riesgo | Entra en esta entrega |
|---|---|---|---|---|
| **0 · Contrato** | Catálogo de eventos de la bitácora y su prueba; servicio central `RegistradorDeCambios` sin tablas nuevas; `ClaseDato` por campo | S | Bajo | **Sí** |
| **1 · Registro de cambios en lo que más duele** | `CambiosDeRegistro`; se conecta a **Ediciones de Festival**, **Organización** y el cuerpo de **Noticias**; vista «Historial» en las tres fichas de la consola | M | Medio: toca endpoints de escritura de varios módulos | **Sí, con las ediciones primero** |
| **2 · Versión publicada generalizada** | `VersionesDeRegistro` para ediciones y Mercados; lectura pública citable | M a L | Medio: define el contrato público | Después, si la dirección lo pide |
| **3 · Datos personales** | Anonimización, retención declarada, solicitud de rectificación y supresión, auditoría de lecturas de identificación | M a L | **Alto: depende de decisión jurídica y de la TRD** | Después |
| **4 · Reversión** | «Restaurar como borrador» desde la línea de tiempo | M | Bajo | Después |

**Migraciones previstas** (ninguna renombra ni altera lo existente):

- `V…__cambios_de_registro.sql`: tabla `CambiosDeRegistro` con índices por (`ModuloId`, `RegistroId`,
  `Fecha`), CHECK de `Origen`, y CHECK de que `ValorAnterior` y `ValorNuevo` sean nulos para las clases de
  dato que no se guardan.
- `V…__versiones_de_registro.sql`: tabla `VersionesDeRegistro` con índice único filtrado de la versión
  vigente por registro.
- Sin relleno hacia atrás: el historial empieza el día de la migración y lo dice la propia interfaz
  («sin historial anterior al 10 nov 2026»). Se aplica el mismo criterio que ya se usa en
  `RegistrosRevisionHistorial`: una fila vacía dice la verdad.

**Riesgos.**

- *Volumen.* Una fila por campo por cambio crece rápido; se compensa vigilando solo los campos
  declarados y con índices por registro, no por fecha global.
- *Datos personales en el historial.* Se mitiga con la clase de dato declarada por campo y una prueba que
  falla si un campo de identificación declara guardar valor.
- *Transacción.* El registro de cambios debe entrar en el mismo `SaveChanges`; en SQL Server hay que
  probarlo contra el CHECK de la bitácora, que SQLite no aplica.
- *Cambios masivos.* Importaciones y fusiones escriben decenas de filas: necesitan `Origen` propio y un
  modo que resuma por lote.
- *Consistencia entre módulos.* El riesgo más probable es que cada módulo declare campos distintos; la
  prueba de contrato de la fase 0 lo vigila.

## 24.8 Preguntas para la dirección

Cada una trae mi recomendación, para que pueda contestarse con «sí». **La dirección las contestó el 10 de
noviembre de 2026** (resumen al final de la sección); donde difiere de la recomendación, manda la
respuesta.

1. **¿Una edición publicada debe poder citarse por versión** (por ejemplo en un informe al Ministerio)?
   *Recomiendo:* sí, pero en la fase 2; en la fase 1 basta el historial interno.
2. **¿Qué dato personal puede guardar su valor en el historial?** *Recomiendo:* nunca el documento;
   correo y teléfono solo «cambió». Los nombres de persona, solo con el nombre copiado del actor, como
   hoy.
3. **¿Se espera a la Tabla de Retención Documental para fijar plazos?** *Recomiendo:* sí; mientras
   tanto, la retención declarada de §24.5.6 como propuesta.
4. **¿Se habilita en esta entrega la solicitud de rectificación y supresión del titular?**
   *Recomiendo:* dejar el diseño y la anonimización para la fase 3, y atender mientras tanto las
   solicitudes por la consola con un procedimiento escrito. Requiere criterio jurídico (Ley 1581 de 2012
   y su decreto reglamentario).
5. **¿La organización ve el historial completo de sus registros o solo estados y versiones publicadas?**
   *Recomiendo:* ve estados, versiones y cambios de datos públicos; no ve las anotaciones internas de la
   consola.
6. **¿Quién puede restaurar una versión?** *Recomiendo:* la organización la restaura como borrador de
   propuesta; la consola, como borrador o directamente en lo que administra.
7. **¿Alcance de esta entrega?** *Recomiendo:* fases 0 y 1, con las ediciones de Festival como primer
   módulo, y dejar el resto planificado.
8. **¿Se acepta que el historial empiece el día de la migración**, sin reconstruir lo anterior?
   *Recomiendo:* sí. Reconstruir hacia atrás sería inventar.
9. **¿Se audita la lectura de datos de identificación?** *Recomiendo:* sí, acotada, en la fase 3.
10. **¿Una fusión de Festivales históricos debe poder deshacerse?** Hoy no. *Recomiendo:* no, y dejarlo
    escrito, porque el absorbido se conserva archivado y se puede reponer a mano.

**Respuestas de la dirección (10 nov 2026).**

| # | Pregunta | Decisión |
|---|---|---|
| 1 | ¿Citar una edición por versión? | **Después** (fase 2). La pregunta no estaba clara: es poder decir «según la ficha, versión 3» en un informe. Se retoma cuando se haga la versión publicada generalizada. |
| 2 | ¿Qué dato personal guarda su valor? | **Todos guardan su valor**, también el documento: «es importante para el gobierno del dato». Cambia la recomendación: lo que protege el dato es **quién lo lee** (§24.10), no que falte. |
| 3 | ¿Se espera a la TRD para fijar plazos? | **Sí.** Se explicó: la Tabla de Retención Documental es el documento institucional que dice cuánto tiempo se conserva cada serie documental y qué se hace después (conservar, eliminar, transferir). **Hoy se guarda todo, sin plazo de borrado.** |
| 4 | ¿Rectificación y supresión del titular? | **Se diseña después** (fase 3). |
| 5 | ¿Qué ve la organización? | **Estados, versiones publicadas y cambios de datos públicos de lo suyo**; nunca datos personales ni quién trabaja en la consola. |
| 6 | ¿Quién restaura? | La organización como propuesta y la consola como borrador. **No entra en esta entrega** (fase 4). |
| 7 | Alcance de esta entrega | **Fases 0 y 1.** |
| 8 | ¿El historial empieza el día de la migración? | **Sí**, con una excepción: la historia de las versiones de Festival, que ya estaba guardada, se pasa a esta capa (§24.10). |
| 9 | ¿Se audita la lectura de datos de identificación? | **Sí, acotada**: leer un dato personal desde la consola deja una línea «consultar» en la bitácora, con los nombres de los campos y nunca los valores. |
| 10 | ¿Se deshace una fusión de Festivales históricos? | **No, de momento.** |

## 24.9 Qué no se propone

- **Una supertabla de versiones por módulo.** `docs/desarrollo/13-nucleo-de-procesos.md` ya lo descarta: ocultaría reglas y claves del
  dominio.
- **Disparadores de base de datos o interceptores globales.** Registrarían campos que nadie decidió
  vigilar, incluidos datos personales.
- **Retirar `VersionesFestival` en este corte.** Guarda el perfil publicado que lee el portal (§24.10);
  lo que se retira es su papel de historial.
- **Guardar los archivos de imágenes reemplazadas.** Es una decisión de producto vigente.
- **Reconstruir historia anterior.** Se aplica la regla de no inventar.

## 24.10 Lo que se construyó (fases 0 y 1)

### Contrato de la bitácora (fase 0)

- **Verbo nuevo `consultar`** en `CK_BitacoraAuditoria_Accion` (`V20261110_11`): la lectura de datos
  personales deja rastro. Los demás verbos no cambian.
- **Contrato único** (`ContratoDeBitacora`): toda línea nueva lleva
  `{ evento, antes, despues, motivo, origen }`. El evento tiene que estar en el catálogo
  (`EventosDeLaBitacora`): uno que no esté **no se escribe**, falla al construir la línea y una prueba lo
  vigila. Las líneas anteriores no se reescriben; la lectura sigue entendiendo sus dos formas.
- **La bitácora no es el historial del dato.** `antes` y `despues` llevan lo mínimo que explica el
  hecho (nombres de campo, estados), nunca valores personales.

### Registro de cambios por campo (fase 1)

- **`dbo.CambiosDeRegistro`** (`V20261110_10`): una fila por campo que cambia —módulo, registro,
  organización responsable al escribir, campo, **clase de dato**, valor anterior y nuevo, origen
  (`directo`, `propuesta`, `importacion`, `fusion`, `sistema`, `migracion`), autor, rol, motivo, fecha y el
  grupo del guardado—. Sin cascadas ni disparadores.
- **Servicio central** (`RegistradorDeCambios`): se toma una foto de los campos vigilados antes de
  asignar, y después se compara; las filas entran en el mismo guardado. Un guardado sin cambios no escribe
  nada. Cada proceso declara los campos que vigila (`CampoVigilado`); una prueba falla si repite alguno.
- **Dónde está conectado:**

| Módulo | Qué guarda | Clase de dato |
|---|---|---|
| Edición de Festival | Los campos escalares de la edición (año, número, nombre, descripción, fechas, director, tipología y fuentes de financiación —como código—, estampilla, prácticas, otras modalidades y expresiones, estado de realización) | Pública |
| Edición de Mercado | Año, número, nombre, descripción, fechas, territorio, lugar, estados | Pública |
| Festival (perfil público) | Los 14 campos de la versión; se escribe al **publicar una propuesta**, con la propuesta y la versión de las que viene | Pública; correo y teléfono de contacto son **contacto** |
| Organización (ficha) | Nombre, nombre legal, descripción, enlaces, sede (con el **nombre** del municipio y del departamento), imagen; correo, teléfono y dirección; NIT | Pública / **contacto** / **organización** (NIT) |
| Persona responsable de la organización | Nombre, teléfono; tipo y número de documento | **contacto** / **identificación** |
| Noticia | Título, resumen, **cuerpo completo**, fecha, imagen, autoría, categoría | Pública |
| Evento (de la organización **y de la consola**) | Título, descripciones, fechas, horas, modalidad, lugar, territorio, enlace, Festival o Mercado | Pública |
| Ficha de Mercado (organización y consola) | Nombre, descripción, periodicidad, contacto del mercado, enlaces, cobertura, territorio, lugar, Festival | Pública / **contacto** |
| Ficha del Catálogo editorial (consola) | Título, subtítulo, volumen, serie, resumen, fechas, tipo, categoría, ámbito, formato, páginas, duración, portada | Pública |
| Equipo de una organización | Quién entra, quién sale y quién cambia de rol (`miembro.{id}`, con el rol como valor) | **organización** |
| Listas de una edición de Festival | Prácticas musicales, territorios sonoros, expresiones artísticas, modalidades de participación, tipos de ingreso (código ordenado y nombres de ese día) | Pública |
| Lugares, entidades aliadas y materiales de una edición de Festival | Una fila por lista: el valor es la lista ordenada, el nombre lleva «Municipio (DEPARTAMENTO)»; el orden no cuenta | Pública (lugares y materiales) / **contacto** (entidades aliadas: llevan el correo) |
| Propuesta aprobada de Mercado | Los campos que cambia, con origen `propuesta`, su propuesta y quién la aprobó | Pública / **contacto** |
| Perfil público (al publicar una propuesta) | Además de los 14 campos: las listas de prácticas musicales y de territorios sonoros | Pública |
| Nómina del equipo de la web | Un integrante es un campo (`integrante.{id}`): entra, sale o cambia nombre, cargo, grupo, correo o foto. **La foto nunca se copia: va una huella** | **contacto** |
| Módulos de una cuenta de la consola | `modulos`: la lista antes y después, con quién la concedió | **contacto** |

- **Quién lee qué.** El historial se lee desde dos puertas:
  - **Consola** (`GET /admin/historial/{modulo}/{registro}`): hace falta el módulo de la consola al que
    pertenece el registro. Los datos que no son públicos solo llegan con el módulo de **Auditoría**; sin
    él se cuentan (`camposOcultos`) y no se entregan. **Leerlos queda en la bitácora** (verbo `consultar`,
    evento `ConsultaDeDatosPersonales`, solo nombres de campo).
  - **Organización** (`GET /externo/organizaciones/{id}/historial/{modulo}/{registro}`): solo quien
    administra o edita esa organización, y solo las filas de clase **pública** y **organización** (lo
    público y lo que es de la propia organización, como su NIT). **La historia sigue a la administración:**
    la organización que administra el registro **ahora** lo ve entero, también lo escrito antes de que lo
    administrara; la que ya no lo administra no recibe nada (la misma respuesta que un registro sin
    historia). Lo que hizo la consola se firma «Equipo del Programa».
- **El historial empieza el 10 de noviembre de 2026.** La respuesta lo dice (`inicioDelRegistro`) y la
  pantalla también: lo anterior no se reconstruye, salvo lo de las versiones de Festival (abajo).
- **Lo que quedó fuera** (tras V2 y H1): las «Observaciones» y decisiones de revisión como historial de datos;
  los archivos de las propuestas de reclamación; los materiales y archivos del propio perfil público; y
  restaurar versiones. **Los eventos que cambian «por propuesta» no necesitan nada más:** un evento publicado
  se corrige al instante o vuelve a revisión con el cambio ya aplicado (decisión 24), y ese cambio ya se
  registra al guardarlo.

### Ampliación del 10 de noviembre de 2026

Decisiones de la dirección sobre lo que dejó la primera etapa:

1. **«Versión de Festival» deja de existir como concepto.** `dbo.VersionesFestival` pasa a
   `dbo.PerfilesPublicosFestival` (`V20261110_31`, solo nombres: sus filas, columnas, restricciones e
   índices se renombran con ella). La historia vive solo en `CambiosDeRegistro`. Ver «El perfil público».
2. **El NIT es dato de la organización**, no personal: clase nueva `organizacion` (`V20261110_30`). La
   organización y la consola (sin Auditoría) lo leen; lo personal sigue siendo solo de Auditoría.
3. **El código de catálogo es interno; la persona lee el nombre.** Cada fila guarda el código y **el nombre
   que tenía ese día** (`NombreAnterior`, `NombreNuevo`), y la pantalla muestra el nombre. Lo que ya estaba
   escrito se completó (departamentos y municipios) en la misma migración. Catálogos resueltos:
   departamento, municipio, archivo, tipología, fuente de financiación, tipo de organizador, Festival,
   Mercado y categoría.
4. **La nueva organización administradora ve el historial anterior** (arriba).
5. **El registro se amplía a lo que faltaba**, por etapas pequeñas: Agenda desde la consola, Catálogo editorial,
   ficha de Mercado, equipo de la organización (`CambiosDeMembresia`) y las listas de catálogo de una
   edición (`ListasDeLaEdicion`; un guardado, un grupo). El historial se enseña en esas pantallas de la
   consola.

### Ampliación del 12 de noviembre de 2026

1. **«Versión» sale del vocabulario de los Festivales.** Las seis columnas de `dbo.Festivales` que
   contaban ediciones se llaman ahora «edición» (`V20261112_10`), y con ellas el contrato (`editionsCount`,
   `festivalEditions`), el modelo, la web, las siembras, el texto «desde el perfil público actual» y el nombre del
   permiso «Normalizar ediciones». Los encabezados del censo original que la gente ya tiene («¿Cuántas versiones
   lleva el festival?») se siguen leyendo en la importación del mapa.
2. **La migración se probó sobre datos.** SQL Server no deja renombrar una columna que usa una restricción
   `CHECK`: la migración las quita, renombra y recrea con el nombre nuevo y las mismas reglas, validando las filas
   que existen. Una prueba de SQL Server construye la base «de antes», mete un Festival, una solicitud de
   participación y el permiso con los nombres antiguos, aplica el guion dos veces y comprueba valores, restricciones
   «de confianza» y que el segundo paso no cambia nada.
3. **Lo que entró en el registro de cambios:** los lugares, las entidades aliadas y los
   materiales de una edición; la propuesta aprobada de Mercado; las listas del perfil público al publicar; la
   nómina del equipo de la web; y los módulos que se conceden a una cuenta de la consola. Ver la tabla de arriba.
4. **Decidido el 19 de noviembre de 2026 (decisión 96 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`):** el NIT de una organización es
   opcional y solo admite un NIT de persona jurídica (una cédula no entra); el nombre de la persona en los cambios
   de membresía es dato de contacto, y el cambio de un NIT guardado que no tiene forma de NIT se clasifica como
   identificación. Ambos solo los lee la consola con el módulo de Auditoría (`V20261119_30` reclasifica lo ya
   escrito, con respaldo). El NIT con forma de NIT sigue siendo de la organización.

### El perfil público

El perfil público de un Festival es lo que el sitio publica de él y contra lo que se compara una propuesta
de cambios; solo uno está vigente por Festival. **No es historia**: la historia son las filas de
`CambiosDeRegistro`, por campo y con autoría.

| Antes | Ahora |
|---|---|
| Tabla `VersionesFestival`, `IdVersionFestival`, `NumeroVersion` | `PerfilesPublicosFestival`, `IdPerfilPublicoFestival`, `NumeroPublicacion` (la enésima publicación) |
| Módulo `versiones-festival` en las tablas hijas | `perfiles-publicos-festival` (`V20261110_32`, filas y restricciones) |
| Rutas `/externo/festivales/{id}/versiones`, `/externo/versiones/{id}`, `/institucional/festivales/{id}/versiones` | `…/perfiles-publicos`, `/externo/perfiles-publicos/{id}` |
| `versionVigente`, `VersionOrigenId`, `VersionNuevaId` en las propuestas | `perfilPublico`, `PerfilOrigenId`, `PerfilNuevoId` |
| Notas de revisión `perfilVersionado.<campo>` | `perfilPublico.<campo>` (migradas) |
| `CambiosDeRegistro.VersionFestivalId` | `PerfilPublicoFestivalId` |

**Lo que se renombró después (12 nov 2026).** `Festivales.NumeroVersiones`, `FechaUltimaVersion`,
`TieneVersionVigenteAnoActual`, `EstadoVersionAnoActual`, `FechaInicioVersionActual` y `FechaFinVersionActual`
contaban **ediciones**, no versiones: pasaron a `NumeroEdiciones`, `FechaUltimaEdicion`,
`TieneEdicionVigenteAnoActual`, `EstadoEdicionAnoActual`, `FechaInicioEdicionActual` y `FechaFinEdicionActual`
(`V20261112_10`; ver «Ampliación del 12 de noviembre»). El campo `festivalVersions` de la solicitud de participación
pasó a `festivalEditions`. Las migraciones ya aplicadas conservan sus nombres (DbUp las registra por nombre).

### La «versión» de Festival: lo que se retiró y lo que no

La versión del perfil público de un Festival (`dbo.VersionesFestival`) hacía **dos cosas distintas**.
Verificado en código y pantalla (10 nov 2026):

1. **Guardaba el perfil publicado.** La ficha pública se lee de la versión vigente
   (`LecturaFestivalesPublicados`) y la revisión institucional de una propuesta compara contra ella. Es la
   separación entre lo que la organización edita y lo que el público ve: sin ella, cambiar un teléfono en el
   borrador lo cambiaría en la ficha publicada saltándose la revisión.
2. **Contaba la historia.** «Versión N.º» en una lista y en una comparación.

**La segunda función se reemplazó por completo por el sistema único; la primera no se puede retirar sin
mover dónde vive el perfil publicado**, y eso cambia lo que ve el público y el circuito de revisión de
propuestas, que esta entrega no toca.

| Qué | Antes | Ahora |
|---|---|---|
| Historia entre versiones | Había que comparar dos versiones a mano | `CambiosDeRegistro`, campo por campo y con autoría; **migrada** con `V20261110_12` (origen `migracion`, sin inventar quién editó) |
| Publicar una propuesta | Creaba la versión nueva | Además escribe sus cambios con la propuesta y la versión de las que vienen |
| Panel «Historial» de la consola | Lista «Versión N · nombre · estado» | «Qué cambió», leído del sistema único |
| Comparación de una propuesta | «Comparación con la versión publicada N.º 3» | «Comparación con lo publicado» (el dato comparado sigue siendo el publicado) |
| Lecturas `perfiles-versionados` | Dos rutas | **Retiradas** (nada las llama) |
| `VersionesFestival` | Perfil publicado + historia | `PerfilesPublicosFestival`: solo el perfil publicado (V2); **retirada el 20 nov 2026, lo publicado es la cabecera** (decisión 153) |

**Ruta para retirar el perfil público como contenedor: ejecutada** (19 y 20 nov 2026, decisiones 139 a 153 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`).
La API ya había soltado el grupo `PerfilesPublicosFestivalExternosEndpoints`; la tabla
se retiró en los PR que siguen. La tabla de arriba y la de «El perfil público» describen el estado de ese día y se
conservan como historia: hoy `PerfilesPublicosFestival` **ya no existe**. Para que las ediciones y los Mercados
compartan una instantánea (§24.5.2, `VersionesDeRegistro`) no hizo falta: lo publicado quedó en la cabecera, como en
los demás procesos.

### Estado final del retiro de `PerfilesPublicosFestival` (20 nov 2026)

Qué retiró cada PR (todos con «» o; los de datos con respaldo, idempotentes y de una sola transacción):

| PR | Número | Decisión | Qué hizo |
|---|---|---|---|
| PR-1 | | 139 | Añadió a `Festivales` los cinco datos del organizador (`V20261119_10`), con relleno prudente; dejó los guiones de respaldo y de validación. Solo aditivo. |
| PR-2 | | 140 | Espejo de escritura del perfil en la cabecera y diagnóstico de divergencia (API y guion). **Retirados en PR-6.** |
| PR-3 | | 141 | `V20261119_20`: la cabecera queda igual a lo publicado, con historia `migracion` y respaldo de lo sobrescrito; datos de edición solo a campos vacíos. |
| PR-4 | | 142 | La lectura pública sale de la cabecera, con el interruptor `Festivales:LecturaDesdePerfilLegado` y prueba dorada byte a byte. **Interruptor retirado en PR-6.** |
| PR-5a | | 143 | Las propuestas de Festival se proyectan y se escriben sobre la cabecera por el circuito común (`FestivalConPropuestas`); historia sin crear versión. |
| PR-5b | | 144 | `V20261119_30`: notas de revisión y propuestas en vuelo dejan de apuntar a un perfil (`festival.<campo>`, sin `SubregistroId`); reversa en `simus-database/scripts/`. |
| PR-6 | | 145 | Nada escribe ni lee la tabla: se retiran la normalización de perfiles históricos, el espejo, el diagnóstico, la ruta `perfiles-publicos` de propuestas, el interruptor y la lectura legada; se añade el candado. |
| PR-7 | | — (aplica 143 y 145) | Siembras, contrato y web sin el concepto: el detalle de una propuesta de Festival habla de `publicado`, sin `perfilOrigenId`/`perfilNuevoId`. |
| PR-8 | | 152 | `V20261120_10`: retira la tabla, sus hijas y el módulo de los CHECK, con precondiciones que abortan (50081 a 50087) y reversa. |
| PR-9 | este | 153 | Solo documentación y cierre. |

**Cómo funciona hoy.** La ficha pública, el listado, las ediciones públicas y la analítica leen `dbo.Festivales` y sus
listas. Una propuesta de cambio de Festival copia su «antes» de la cabecera al guardar y al enviar, se compara contra
lo publicado campo por campo y, al aprobarse, escribe la cabecera y sus listas y deja la historia en
`CambiosDeRegistro` (origen `propuesta`); si un campo propuesto ya no vale su «antes», aprobar responde 409 con los
campos nombrados. Las notas de revisión cuelgan de la ficha. Un Festival se comporta como los otros cuatro tipos de
proceso; la ficha propia de Festival en el panel sigue siendo la brecha B2b de `docs/desarrollo/30-consola-y-acceso.md` §30.17.

**El respaldo `respaldo.*` y su plazo.** El esquema `respaldo` guarda, con sufijo de fecha (`AAAAMMDD` o `_V…` según
el guion): la tabla de perfiles y sus ocho hijas (`respaldo_perfiles_publicos_festival.sql`), las columnas de
`Festivales`, `EdicionesFestival` y las listas que PR-3 sobrescribió, las notas y propuestas que PR-5b reescribió. PR-8
se niega a correr si esa copia falta o no cuadra. **PR-10 (retirar el respaldo) queda PENDIENTE hasta 90 días después
de que PR-8 se aplique en cada base**; la fecha de aplicación y la de retiro de cada base se anotan aquí al fusionar
PR-8:

| Base | PR-8 aplicado | Respaldo retirable desde |
|---|---|---|
| Demostración local | por fijar | aplicación + 90 días |
| Azure (demostración pública) | por fijar | aplicación + 90 días |
| Institucional | por fijar | aplicación + 90 días |

**Cómo revertir.** Con la API parada: `sqlcmd -S <servidor> -d <base> -i simus-database/scripts/reversa_retiro_perfiles_publicos_festival.sql`.
Exige el respaldo y que la tabla no exista (si no, aborta con 50101); recrea la tabla con su definición final,
reabre el módulo en los CHECK, devuelve los archivos al perfil y repuebla tabla e hijas con sus mismos
identificadores. Para volver a *usar* la tabla hay que desplegar también el código anterior a PR-8. La reversa de
PR-5b es `reversa_notas_y_propuestas_en_vuelo.sql`. El respaldo previo a aplicar en una base real es
`respaldo_perfiles_publicos_festival.sql` (más una exportación a CSV fuera del repositorio).

**Menciones históricas que se conservan a propósito** (no son deuda; no hay que «limpiarlas»):

- Este documento: las secciones de la propuesta original (§24.1 a §24.10), la ampliación del 10 de noviembre, la tabla «Antes | Ahora» de «El perfil público» y «La «versión» de Festival: lo que se retiró y lo que no».
- `docs/referencia/20-decisiones-y-flujos-por-modulo.md`: decisiones 28, 109 y 139 a 152 y las filas viejas del registro de versiones.
-: el informe fechado (§1 y la tabla de hallazgos), la sección 44 y la sección 67; la sección 72 recoge el cierre.
- y `docs/operacion/28-tabla-de-retencion-documental.md`: propuestas y planes anteriores.
- `docs/atlas-main` (`02` y `05`): corte fechado del código; cada mención lleva una nota de vigencia.
- `CHANGELOG.md`: las entradas de los PR 261 a 275.
- `simus-database/schema/` (migraciones ya aplicadas, que DbUp registra por nombre) y `simus-database/scripts/` (respaldo, validación, diagnóstico y reversas).
- Pruebas: `CandadoPerfilesPublicosFestivalTests` (impide volver a nombrar la tabla), `RetiroDePerfilesPublicosFestivalSqlServerTests` y las del carril SQL Server que construyen la base «de antes».
- No confundir con las tablas de **personas** (`PerfilesPublicos`, `/perfiles-publicos`, `admin-perfiles-publicos`), que siguen vigentes.

### Pruebas

Contra SQLite (`HistorialDeCambiosTests`) y contra SQL Server (`HistorialDeCambiosSqlServerTests` y el
circuito de propuestas): las que escriben bitácora o historial se prueban siempre contra el motor, porque
SQLite no aplica los `CK` (el verbo nuevo, el JSON válido, las clases de dato). En el navegador:
`e2e/historial-de-cambios.spec.ts` (@backend) corrige una edición y lee su historial.
