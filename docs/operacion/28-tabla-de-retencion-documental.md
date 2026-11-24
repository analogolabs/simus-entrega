# 28. Propuesta de tabla de retención documental y gestión del almacenamiento

**Estado: el borrado automático está prohibido; la política vigente es «no borrar nunca de forma automática»**
(versión 1.2, 11 nov 2026). Una persona autorizada sí puede borrar de forma manual, con confirmación y
registro en la bitácora (§28.0). Documento de investigación y diseño: no cambia código ni migraciones. Propone las
series documentales de SIMUS con sus plazos y disposiciones (§28.5 a §28.9), que la entidad podrá llevar a su tabla
de retención documental (TRD) cuando decida, y diseña cómo **gastar menos almacenamiento sin borrar de forma
automática** (§28.11 a §28.19).

**Lo que este documento no es.** No es la TRD del Ministerio ni la sustituye. La TRD la aprueba la entidad
y la convalida el Archivo General de la Nación (§28.3). Aquí se ofrece el insumo técnico: qué documentos
produce SIMUS, dónde viven y qué plazos se proponen. Los plazos son **propuestas** hasta que la entidad
decida.

Se apoya en el diseño de versionamiento y gobierno del dato ([`docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md`](../desarrollo/24-versionamiento-y-gobierno-del-dato.md)),
que define el registro de cambios y la clasificación de los datos personales por campo, y ya está en parte
implementado. Si ese diseño cambia, las series de §28.5 que dependen del registro de cambios se ajustan sin
cambiar el resto. También parte de [`docs/operacion/11-operacion-y-mantenimiento.md`](11-operacion-y-mantenimiento.md) §11.4 y §11.5 (autorizaciones y
retención de importaciones), de [`docs/desarrollo/19-cuentas-y-organizaciones.md`](../desarrollo/19-cuentas-y-organizaciones.md) y de
[`docs/referencia/20-decisiones-y-flujos-por-modulo.md`](../referencia/20-decisiones-y-flujos-por-modulo.md).

## 28.0 Decisión vigente (11 nov 2026)

La dirección decidió tres cosas que reordenan este documento:

1. **«No borrar nunca» significa que NADA SE BORRA DE FORMA AUTOMÁTICA.** Está prohibido todo borrado
   automático: tareas de retención, depuraciones programadas y limpieza por antigüedad. Esto es lo que la dirección
   aprobó y rige sobre cualquier otra lectura.
2. **El borrado manual sí está permitido** a quien tiene permiso para hacerlo, siempre con **diálogo de
   confirmación**, **motivo** cuando aplique, **línea en la bitácora** con el contrato único de `docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md` y, cuando
   proceda, **evidencia** (por ejemplo, el acta o la huella de lo borrado). Una persona decide y deja constancia;
   el sistema no decide por su cuenta.
3. **Lo que importa hoy es la gestión de los archivos,** porque son lo que más consume almacenamiento.
4. **La tabla de retención se revisa más adelante,** con el Ministerio, por medio del Plan Nacional de Música
   para la Convivencia.

**Regla para decidir si algo es válido.**

| Pregunta | Si la respuesta es sí | Si es no |
|---|---|---|
| ¿Lo dispara el tiempo, un proceso programado o una regla de antigüedad, sin que una persona lo pida? | **Prohibido.** Debe eliminarse del diseño o convertirse en archivado (mover a un nivel más barato, sin borrar) | Sigue |
| ¿Lo pide una persona con permiso, con confirmación, motivo si aplica y línea de bitácora? | **Válido**, aunque borre de forma física | Falta confirmación o bitácora: es un defecto que corregir, no un cambio de política |

| Parte del documento | Estado |
|---|---|
| Disposiciones de **eliminación** (**E**) y de **selección** que eliminan, de §28.5 | **En suspenso** como proceso automático: no se aplican ni se programan. Se mantienen como insumo para la revisión con el Ministerio. El borrado manual sigue la regla de arriba |
| **Supresión del titular** (§28.6) | La atiende una persona con permiso por la consola: puede limitar el acceso, ocultar el dato y, cuando proceda y con confirmación y bitácora, borrarlo a mano. Lo que no existe es un borrado automático por plazo. El diseño definitivo se hace después (`docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md` fase 3) |
| **Implementación de la retención** (§28.7), con tarea de retención, actas de eliminación y archivo central | **En suspenso** la tarea automática. Se conservan las piezas que sirven para conservar con orden: el catálogo de series, el bloqueo legal y el acta para el borrado manual |
| **Gestión del almacenamiento de archivos** (§28.11 a §28.19) | **Vigente y es lo que se puede construir ya.** Archiva a un nivel más barato, deduplica, optimiza y verifica; no borra de forma automática |

**Qué significa esto para los archivos.** Un archivo puede cambiar de lugar (de la base a un almacén frío) y de
estado (activo, sin uso, retirado, archivado). Retirarlo con borrado físico, a mano y con confirmación, es válido;
lo que no se admite es que una regla lo borre sola. **Archivar en frío** es una opción posterior de **ahorro de
almacenamiento**, no una corrección. Dos sitios del código conviene mirar con esta regla (§28.12): el retiro del Banco
(manual: válido, le faltan confirmación y bitácora) y la depuración a los 30 días de las previsualizaciones de
importación (automática: excepción que se debe justificar por escrito, §28.18).

## 28.1 Cómo leer las marcas

Cada afirmación normativa lleva una marca. Importa leerlas con su alcance real: la investigación se hizo
con **búsqueda web** y no fue posible abrir cada texto oficial completo, de modo que «verificado» significa
«lo confirman fuentes oficiales o compilaciones normativas de entidades públicas en los resultados», no
«se leyó el artículo íntegro».

| Marca | Significado |
|---|---|
| **[Verificado]** | Lo confirman una o varias fuentes oficiales o compilaciones públicas encontradas en la búsqueda. Conviene igualmente leer el texto antes de citarlo en un acto administrativo. |
| **[No verificado]** | Se conoce de forma general o aparece citado de pasada, pero no se pudo confirmar. Debe revisarlo quien tenga criterio jurídico o archivístico antes de apoyarse en ello. |
| **[Propuesta]** | Es una propuesta técnica de este documento; no es norma ni decisión. |
| **[Código]** | Se comprobó leyendo el repositorio (código, migraciones o plantillas de despliegue); lo que no se midió en una base real se dice. |
| **[Decisión de la entidad]** | Corresponde al Ministerio (comité, gestión documental, jurídica o la dirección) y no puede resolverse desde el desarrollo. |

## 28.2 Marco normativo

| Norma | Qué aporta a esta propuesta | Marca |
|---|---|---|
| **Ley 594 de 2000** (Ley General de Archivos). Publicada en el Diario Oficial 44084 del 14 de julio de 2000. | Su artículo 24, titulado «Obligatoriedad de las tablas de retención», obliga a las entidades del Estado a elaborar y adoptar sus TRD. Las definiciones de la ley describen la TRD como el listado de series con sus tipos documentales, a las que se asigna un tiempo de permanencia en cada etapa del ciclo vital. El artículo 22 figura bajo «Procesos archivísticos»: su texto no apareció en los resultados. | **[Verificado]** el artículo 24 y las definiciones. **[No verificado]** el contenido literal del artículo 22 y los artículos 19 y 21 (soporte documental y programas de gestión documental). |
| **Acuerdo 001 de 2024 del AGN** («Acuerdo Único de la Función Archivística»), expedido el 29 de febrero de 2024 y publicado en el Diario Oficial 52.723 del 10 de abril de 2024. | Es hoy el marco archivístico general. Según las compilaciones consultadas, su artículo 10.1 **deroga el Acuerdo 004 de 2019** y el **Acuerdo 003 de 2015**. Permite tomar como referencia, para elaborar las TRD, los nombres de series y subseries, los tiempos de retención y la disposición final del Banco Terminológico del AGN. | **[Verificado]** la existencia, la fecha, la derogatoria de los acuerdos 004/2019 y 003/2015 según las compilaciones, y la referencia al Banco Terminológico. **[No verificado]** el articulado completo sobre elaboración, aprobación y convalidación bajo el acuerdo nuevo. |
| **Acuerdo 004 de 2019 del AGN** (derogado por el anterior). | Fue el reglamento de elaboración, aprobación, evaluación, convalidación, publicación e inscripción de TRD y TVD. Exigía la aprobación por el Comité Institucional de Gestión y Desempeño (artículo 9), la publicación en el sitio web de la entidad (artículo 18) y la inscripción en el Registro Único de Series Documentales (RUSD) en los treinta días hábiles siguientes a la convalidación (artículo 19). Se recoge solo como antecedente: el procedimiento vigente debe leerse en el Acuerdo 001 de 2024. | **[Verificado]** el texto original de los artículos 9, 18 y 19. **[No verificado]** que el acuerdo vigente conserve esa misma mecánica. |
| **Acuerdo 003 de 2015 del AGN** (derogado, según las mismas compilaciones). | Lineamientos de documentos y expedientes electrónicos: fijaba el expediente electrónico mínimo (documentos de archivo, foliado electrónico, índice electrónico, firma del índice y metadatos). Sirve como referencia conceptual del «expediente» de SIMUS; no como norma vigente. | **[Verificado]** el contenido original y su derogatoria. |
| **Decreto 1080 de 2015** (Decreto Único Reglamentario del sector cultura) y **Decreto 2609 de 2012**. | Reglamentan la gestión documental. Aparecen citados por las resoluciones de las entidades y por el certificado de convalidación del Ministerio. La numeración exacta del título de gestión documental dentro del Decreto 1080 no se confirmó. | **[Verificado]** que se citan como base de las TRD. **[No verificado]** la numeración de los artículos. |
| **Ley 1712 de 2014** (transparencia y acceso a la información pública) y **Decreto 103 de 2015**. | El artículo 15 obliga a los sujetos obligados a adoptar un Programa de Gestión Documental (PGD), con los lineamientos del AGN. El decreto lo reglamenta y lo ubica hoy dentro del Decreto 1080 de 2015. Los artículos 18 y 19 regulan la información exceptuada (clasificada, por daño a derechos de personas; reservada, por daño a intereses públicos), y la reserva exige prueba de daño. | **[Verificado]** el artículo 15 y el PGD, y la estructura de los artículos 18 y 19. **[No verificado]** la redacción literal de los artículos 18 y 19 y cuál literal cubre la intimidad. |
| **Ley 1581 de 2012** (protección de datos personales). | Define los datos sensibles (artículo 5) y su tratamiento (artículo 6). Su artículo 8, literal e), reconoce al titular el derecho a revocar la autorización y solicitar la supresión del dato. La Corte Constitucional lo declaró exequible condicionado: la supresión procede **cuando no exista un deber legal o contractual de permanecer en la base de datos**. | **[Verificado]** los artículos 5, 6 y 8 e), y la lectura condicionada por la Corte. |
| **Decreto 1377 de 2013** (reglamentario parcial de la Ley 1581). | Su artículo 9 permite al titular pedir en todo momento la supresión o revocar la autorización mediante reclamo (artículo 15 de la ley); la excepción por deber legal o contractual ya está recogida en `docs/operacion/11-operacion-y-mantenimiento.md` §11.4. Hoy se encuentra compilado en el Decreto 1074 de 2015. | **[Verificado]** el reclamo, la referencia al artículo 15 y la atribución al artículo 9. **[No verificado]** la redacción literal de la excepción y el artículo del Decreto 1074 que lo compila. |
| **Resolución 0163 de 2024 del Ministerio de las Culturas, las Artes y los Saberes** (23 de abril de 2024). | Aprueba y adopta la actualización de las TRD del Ministerio. Los considerandos citan el AGN como convalidador y las disposiciones del Acuerdo 004 de 2019. El certificado de convalidación del AGN es del 11 de abril de 2024. Es la TRD en la que habría que **insertar** las series de SIMUS. | **[Verificado]** la existencia, las fechas y los considerandos. **[No verificado]** su articulado y si se ha modificado después. |
| **Política de Gobierno Digital** (Decreto 767 de 2022) y lineamientos de seguridad y privacidad de la información. | Pueden exigir inventario de activos de información, esquema de publicación y gestión de incidentes que se cruzan con la retención. | **[No verificado]**: no aparecieron resultados. |

**Hallazgo que condiciona el resto.** El procedimiento que describen casi todos los documentos públicos de
las entidades (aprobación por el comité, convalidación del AGN, publicación e inscripción en el RUSD)
proviene del Acuerdo 004 de 2019, hoy derogado. Antes de abrir el trámite hay que leer el Acuerdo 001 de
2024 y preguntar al Grupo de Gestión Documental del Ministerio qué mecánica aplica hoy.

## 28.3 Qué es una TRD y cómo se aprueba

Una **tabla de retención documental** es el instrumento archivístico que lista las **series y subseries**
documentales de una entidad, con los **tipos documentales** que las componen, y asigna a cada una un
**tiempo de permanencia** en las etapas del ciclo vital del documento y una **disposición final**.
**[Verificado]** (definición de la Ley 594 de 2000).

- **Series y subseries.** Una serie es un conjunto de documentos que produce una misma función
  (por ejemplo, «Solicitudes de reclamación de Festivales»); una subserie, una división de ella.
- **Ciclo vital.** Etapas por las que pasa un documento: archivo de gestión (se usa en el trámite),
  archivo central (se conserva por su valor administrativo o legal) y archivo histórico (se conserva
  de forma permanente por su valor cultural o de investigación). **[Verificado]** en lo general; la
  duración de cada etapa la fija cada TRD.
- **Disposición final.** Lo que ocurre al terminar los plazos. En la práctica colombiana: conservación
  total, eliminación, selección y reproducción en otro soporte (digitalización o microfilmación).
  **[No verificado]** la denominación y las siglas exactas del formato vigente.

**Quién aprueba.** Con el procedimiento del Acuerdo 004 de 2019, la TRD la aprobaba el **Comité
Institucional de Gestión y Desempeño** (o quien hiciera sus veces), con el sustento en el acta; la
evaluaba y convalidaba el **Comité Evaluador de Documentos del AGN** (con una etapa previa de sustentación
ante un pre-comité); la entidad la **publicaba** en su sitio web y la **inscribía en el RUSD**.
**[Verificado]** como procedimiento histórico; **[No verificado]** como procedimiento vigente (§28.2).

**Ruta propuesta para SIMUS.** **[Propuesta]**

1. El equipo de SIMUS entrega este documento ajustado al Grupo de Gestión Documental del Ministerio.
2. El grupo decide si las series de SIMUS entran como un **ajuste de la TRD vigente** (Resolución 0163 de
   2024) o en la próxima actualización.
3. El comité institucional las aprueba y se envían a convalidación.
4. Con la TRD vigente, SIMUS carga las series en su catálogo (§28.7) y activa la retención.

Mientras no exista ese acto, **no se elimina nada de forma automática** (decisión vigente en `docs/operacion/11-operacion-y-mantenimiento.md`
§11.5 y en `docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md` §24.5.6). El borrado manual por una persona autorizada, con confirmación y bitácora, sí está
permitido (§28.0).

## 28.4 Principios de la propuesta

**[Propuesta]**

1. **Lo que se declara se aplica.** Cada tabla con datos del negocio pertenece a una serie; si no tiene
   serie, no entra en producción.
2. **Dos etapas dentro de SIMUS.** El **archivo de gestión** es la base operativa, con acceso normal. El
   **archivo central** es una base o esquema de archivo con acceso restringido a la consola con permiso
   y lectura registrada. Un registro cambia de etapa sin perder su identidad.
3. **Valor histórico antes que ahorro de espacio.** SIMUS documenta festivales, mercados y organizaciones
   del ecosistema musical: sus fichas publicadas y sus versiones son memoria institucional del Estado y
   se proponen para **conservación total**.
4. **Minimización de los datos personales.** El dato personal se conserva lo mínimo necesario y, al
   terminar la finalidad, se **anonimiza** conservando el hecho (que alguien con cierto rol hizo cierto
   cambio en cierta fecha), como ya hace el diseño de `docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md` §24.5.5.
5. **Evidencia de todo lo que se elimina o se anonimiza.** Una eliminación sin acta no se ejecuta.
6. **El historial cuenta también.** La bitácora y el registro de cambios son documentos de archivo, no
   un subproducto técnico.

## 28.5 Series documentales propuestas

> **En suspenso como proceso automático (§28.0).** Las disposiciones **E** (eliminación) y la parte de **S** (selección) que elimina no se aplican solas: hoy está prohibido todo borrado automático. La tabla se mantiene como insumo para la revisión con el Ministerio; un borrado manual autorizado, con confirmación y bitácora, sigue siendo válido. La serie 13 (archivos del Banco) tiene su propia política vigente en §28.11 a §28.19.

Las columnas de plazo cuentan desde un **hecho de cierre** que se declara por serie (por ejemplo, el cierre
de la cuenta o la publicación de una edición), no desde la creación. «G» es la permanencia en el archivo de
gestión (base operativa) y «C» en el archivo central; los años son **propuestas** y deben ajustarse por la
entidad. Disposición: **CT** conservación total, **E** eliminación, **S** selección, **D** digitalización o
migración de soporte. Todos los plazos son **[Propuesta]** y **[Decisión de la entidad]**.

| # | Serie | Subseries y tablas principales | Valor | G | C | Disposición | Datos personales y anonimización |
|---|---|---|---|---|---|---|---|
| 1 | **Cuentas y personas** | Cuentas externas e internas, identidad de la persona (`Usuarios`, `EntidadesResponsable`), perfil público de la persona | Administrativo y legal | Mientras la cuenta esté activa o tenga procesos inscritos | 5 años desde el cierre | **E** de los datos personales tras anonimizar; el hecho se conserva en la bitácora | Alto. Al cierre: nombres, correo y teléfono se reemplazan por el marcador «persona anonimizada»; el documento de identidad se elimina |
| 2 | **Autorizaciones de datos** | `AutorizacionesDatos`, `PoliticasDatos`, `DocumentosLegales`, `AceptacionesDocumentosLegales` | Legal (prueba de consentimiento) | Mientras la autorización esté vigente | Plazo de prueba: lo fija jurídica (ver §28.9, pregunta 3) | **CT** de la fila de autorización (nunca se borra, solo se anonimiza la persona) | Se conserva que se otorgó y se retiró, con fecha y versión del texto |
| 3 | **Organizaciones** | Ficha de la organización, sedes, responsable, membresías, roles, invitaciones | Administrativo e histórico | Mientras exista la organización activa | 10 años desde su baja | **S**: se conserva la ficha pública y su historial; se eliminan los datos de contacto personales | Medio. Contactos personales se anonimizan; el nombre y los datos públicos de la organización se conservan |
| 4 | **Festivales** | Ficha (lo publicado es la cabecera; `VersionesFestival` se retiró, decisión 153 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`), propuestas de cambio, envíos a revisión, historial de revisión | Histórico y administrativo | Mientras el Festival esté publicado o en proceso | 10 años desde la baja o archivo | **CT** de fichas y versiones publicadas; **E** de borradores y propuestas rechazadas tras el plazo | Bajo en la ficha; las propuestas y el historial copian nombres de actores: se anonimizan |
| 5 | **Ediciones de Festival** | `EdicionesFestival` y relaciones, versiones y registro de cambios | Histórico | Mientras la edición esté vigente | 10 años | **CT** | Bajo; el registro de cambios sigue la clase de dato de cada campo |
| 6 | **Mercados y sus ediciones** | `Mercados`, `EdicionesMercado`, propuestas, historial | Histórico y administrativo | Mientras estén publicados | 10 años | **CT** de fichas y ediciones publicadas; **E** de borradores | Igual que el Festival |
| 7 | **Eventos y Agenda** | `EventosAgenda`, `Agenda`, archivos de evento | Informativo, con valor documental limitado | Hasta un año después de su realización | 3 años | **S**: se conserva el registro mínimo (qué, cuándo, dónde, quién); se eliminan imágenes y descripciones largas | Bajo |
| 8 | **Noticias y comunicaciones** | Noticias, errata, borradores | Informativo e histórico | Mientras estén publicadas | 5 años | **S**: se conserva la versión publicada; se eliminan borradores | Bajo |
| 9 | **Catálogo editorial** | Fichas, fuentes, derechos y su historial | Histórico y legal (derechos) | Mientras esté publicado | 10 años desde el retiro | **CT** de lo publicado y de la evidencia de derechos | Bajo; los derechos de terceros se documentan por separado |
| 10 | **Contenido del sitio (CMS)** | Textos, medios, equipo y su historial (`ContenidoWeb`, `MediosWeb`, `EquipoWeb`) | Administrativo | Vigente | Tope vigente (6 entradas por clave) | **E** al exceder el tope (decisión ya tomada) | Medio en la nómina del equipo (nombres, fotos): se anonimiza al cerrar la persona |
| 11 | **Bitácora de auditoría** | `BitacoraAuditoria` | Legal y de seguridad | 2 años en línea | 8 años | **CT** del contrato mínimo (evento, actor anonimizable, fecha); **E** de valores personales | Alto: valores personales siguen la serie 1 |
| 12 | **Registro de cambios por campo** | `CambiosDeRegistro` (según `docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md`) | Legal e histórico | Mientras el registro esté vigente | Igual que la serie del registro dueño | Igual que la serie dueña; **E** de los valores personales cuando esa serie los elimine | Alto en campos de contacto e identificación; el valor se anonimiza, el hecho no |
| 13 | **Archivos del Banco** | `Archivos`, `ArchivosDeRegistro`, soportes de reclamación | Administrativo y probatorio | Mientras el dueño esté activo o el soporte esté citado | 5 años desde que deja de citarse | **E** (el archivo); se conserva la huella y el rastro de que existió | Medio: pueden contener datos personales dentro del documento |
| 14 | **Solicitudes de reclamación y fusión** | Solicitudes, decisiones, aclaraciones, fusiones de históricos | Legal y administrativo | Mientras el Festival exista | 10 años | **CT** de la decisión y su motivo; **E** de los soportes cuando la serie 13 los elimine | Medio: justificaciones y soportes de personas |
| 15 | **Importaciones asistidas** | `LotesImportacion`, `FilasImportacion`, `DecisionesImportacion`, `HallazgosImportacion` | Administrativo | Previsualizaciones: plazo actual | Cabeceras, decisiones y auditoría: 10 años | **E** de previsualizaciones (ya automático); **CT** de cabeceras y decisiones | Medio: las filas pueden traer datos personales hasta depurarse |
| 16 | **Notificaciones y correos** | Códigos de verificación, confirmaciones de correo, restablecimientos, boletín (`BoletinSuscripciones`, `UsuariosCodigosVerificacion`, `ConfirmacionesDeCorreo`) | Operativo | Hasta que venza o se use | 1 año | **E** | Alto en la dirección de correo; los códigos y testigos ya se guardan como huella |
| 17 | **Bitácoras de acceso y lectura** | Lecturas de datos de identificación; ingresos | Seguridad | 1 año en línea | 4 años | **E** | Alto: contienen quién leyó qué |
| 18 | **Copias de respaldo** | Respaldos de la base y de los archivos | Continuidad del servicio | 30 a 90 días | — | **E** por rotación | Contienen todo lo anterior: se necesita un procedimiento de supresión en copias (§28.6) |

**Cómo se llegó a estos números.** **[Propuesta]** No se apoyan en un plazo legal verificado: se eligieron
por su función (probatorio, administrativo, histórico) y para que sean fáciles de explicar. Hay dos
referencias que la entidad debe contrastar y que **no se verificaron**: el Banco Terminológico del AGN
(que el Acuerdo 001 de 2024 permite tomar como referencia para series y plazos) y el término de
prescripción de las acciones que pueden surgir de un proceso inscrito, que determina cuánto tiempo hay
que conservar la prueba. **[No verificado]**

## 28.6 Supresión pedida por el titular frente a la conservación

> **Sin borrado automático (§28.0).** Una solicitud de supresión la atiende una persona con permiso por la consola: se evalúa, se limita el acceso al dato, se oculta de las pantallas públicas y, cuando proceda, se borra **a mano**, con diálogo de confirmación, motivo y línea de bitácora. Lo que no existe es un borrado por plazo o por antigüedad.

La Ley 1581 permite pedir la supresión cuando **no exista un deber legal o contractual de permanecer en la
base** **[Verificado]**, y la normativa archivística obliga a conservar lo que la TRD declara.
Esos dos deberes se resuelven por serie y por situación, no en bloque. **[Propuesta]**

| Situación de la persona | Qué ocurre con sus datos | Base |
|---|---|---|
| Pide suprimir y **no tiene procesos inscritos ni deberes pendientes** | Se anonimizan los datos personales de las series 1, 3, 12 y 13; se conserva el hecho en la bitácora; se acredita con un acta de anonimización | Supresión sin deber de permanecer **[Verificado]** |
| Pide suprimir y **responde por una organización con procesos inscritos** (es lo que ya recoge `docs/operacion/11-operacion-y-mantenimiento.md` §11.4) | No procede la supresión total: se explican los datos que se retienen y por qué, y se ofrece rectificar lo que sea inexacto | Deber de permanecer **[Verificado]** en la excepción, **[Propuesta]** en cómo se comunica |
| Pide suprimir un dato que figura en una **ficha publicada** de valor histórico | Se evalúa caso por caso: si es un dato de la persona, se anonimiza; si es un dato de la organización, se conserva | **[Decisión de la entidad]**; la intimidad y el habeas data limitan la publicidad (Ley 1712, artículos 18 y 19) **[No verificado]** en su literalidad |
| Revoca la autorización del boletín | Se elimina o anonimiza el correo de `BoletinSuscripciones`; la fila de autorización permanece con fecha de retiro | Ya implementado en la práctica de `docs/operacion/11-operacion-y-mantenimiento.md` §11.4 |
| La información está bajo **bloqueo legal** (proceso, investigación, requerimiento) | No se elimina nada, aunque venza el plazo, hasta que el bloqueo se levante | **[Propuesta]** |

**Copias de respaldo.** Una supresión no alcanza a las copias ya hechas. **[Propuesta]** Se lleva un registro
de supresiones (fecha, serie, identificador anonimizado) y, al restaurar una copia, se vuelve a aplicar
antes de reabrir el sistema. La rotación de la serie 18 limita el tiempo en que un dato suprimido sigue
existiendo en una copia.

**Plazos de respuesta.** La Ley 1581 y su decreto fijan términos para atender consultas y reclamos.
**[No verificado]** (los resultados no los reprodujeron): quien atienda las solicitudes debe confirmarlos antes
de escribir el procedimiento.

## 28.7 Propuesta de implementación técnica

> **En suspenso (§28.0).** No se construye la **tarea de retención automática** (paso 3) ni su aplicación por plazo. Sí pueden construirse el catálogo de series (paso 1), la marca de serie (paso 2), el bloqueo legal (paso 5) y el acta para el borrado manual (paso 4, solo para borrados que una persona decide), porque sirven para conservar con orden. El almacenamiento escalonado que sí se construye está en §28.14.

**[Propuesta]** Nada de esto se construye hasta que la entidad decida (§28.9). El orden sugerido es de menor a
mayor riesgo.

**1. Catálogo de series.** Una tabla `SeriesDocumentales` con código de serie, nombre, valor, plazos en
gestión y central, disposición, hecho que inicia el plazo, versión de la TRD y acto que la aprobó. Cada
tabla del negocio declara su serie en un solo lugar (un atributo o un registro de configuración), y una
prueba de contrato falla si aparece una tabla nueva sin serie.

**2. Marca de serie y fecha de cierre.** Las tablas dueñas de una serie guardan el hecho de cierre (fecha
de baja, de archivo, de cierre de cuenta). Es lo único que se necesita para calcular los plazos sin tocar
el resto del esquema.

**3. Tarea de retención.** Un proceso programado que, para cada serie, calcula qué registros cumplieron su
plazo y los **propone**, sin ejecutar. Nace en modo de **simulación** y entrega un informe. Pasar a modo de
aplicación exige una decisión registrada.

**4. Acta y doble aprobación.** Toda eliminación o anonimización masiva exige un acta firmada por dos
personas con permiso (una de gestión documental y una de la consola). El acta guarda la TRD vigente, la
serie, el criterio, el número de registros y una lista de huellas, no de datos.

**5. Bloqueo legal.** Una tabla `BloqueosLegales` (serie o registro, motivo, quién lo pone, quién lo
levanta). La tarea de retención no toca nada bloqueado.

**6. Anonimización por clase de dato.** Un servicio único, apoyado en la clasificación por campo del
registro de cambios (`docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md` §24.5.5), que reemplaza el valor por un marcador y conserva el hecho. Debe
poder aplicarse a la bitácora, al registro de cambios y a los historiales de revisión que copian el
nombre del actor.

**7. Archivo central.** Un esquema o base separada, con acceso restringido y lectura registrada, a la que
pasan los registros al cumplir su plazo en gestión. Las consultas de la consola lo incluyen solo con
permiso.

**8. Informe.** Una vista en la consola con, por serie: volumen, próximos vencimientos, bloqueos, actas
emitidas y solicitudes de supresión atendidas. Es la evidencia que pide cualquier auditoría archivística o
de protección de datos.

**9. Respaldos.** Rotación acorde con la serie 18 y reaplicación del registro de supresiones al restaurar.

Cada uno de estos pasos escribe en la bitácora con el contrato único de `docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md` y se prueba contra SQL
Server, porque los CK de la bitácora no se aplican en SQLite.

## 28.8 Qué decide cada parte

| Tema | Propuesta técnica (este documento) | Decisión de la entidad |
|---|---|---|
| Qué series existen y cómo se llaman | Lista de §28.5, tomada de las tablas del sistema | Si coinciden con el cuadro de clasificación del Ministerio y con el Banco Terminológico del AGN |
| Plazos de gestión y central | Valores de §28.5, con la lógica de cada serie | Los plazos definitivos, con jurídica y gestión documental |
| Disposición final | CT, S, E, D por serie | Las que apruebe el comité y convalide el AGN |
| Anonimización frente a eliminación | Regla por clase de dato | Cuándo basta anonimizar y cuándo hay que eliminar |
| Supresión del titular | Árbol de §28.6 | El procedimiento, los plazos de respuesta y quién responde |
| Respaldos | Rotación y reaplicación | Plazo máximo de permanencia de un dato suprimido en copias |
| Archivo central | Esquema separado con acceso restringido | Si el Ministerio exige otro repositorio institucional |
| Automatizar o no | Simulación primero, aplicación con doble aprobación | Cuándo se activa la aplicación real |

## 28.9 Preguntas para la dirección

Cada una trae mi recomendación, para que pueda contestarse con «sí».

1. **¿Se presentan las series de SIMUS al Grupo de Gestión Documental como ajuste de la TRD vigente o en la
   próxima actualización?** *Recomiendo:* presentarlas ahora para saber qué procedimiento aplica bajo el
   Acuerdo 001 de 2024; no esperar a la próxima actualización.
2. **¿Quién es la contraparte en el Ministerio** (gestión documental, jurídica, oficial de protección de
   datos)? Sin ella, esto queda como borrador técnico.
3. **¿Qué plazo de conservación aplica a la prueba de una autorización de datos?** *Recomiendo:* que lo
   fije jurídica, con el término de prescripción que corresponda; no se verificó aquí.
4. **¿Los datos personales de una persona que cierra su cuenta se anonimizan a los cinco años o antes?**
   *Recomiendo:* anonimizar de inmediato lo que no sea necesario y retener cinco años solo lo que sirva
   de prueba.
5. **¿Qué se conserva para siempre?** *Recomiendo:* fichas y versiones publicadas de Festivales, Mercados y
   Catálogo, y las decisiones de reclamación y fusión, como memoria institucional.
6. **¿Se acepta un archivo central separado dentro de SIMUS** o el Ministerio quiere llevar lo cumplido a
   un repositorio propio? *Recomiendo:* esquema separado dentro de SIMUS, con exportación periódica.
7. **¿Cuándo se activa la aplicación real** de la retención? *Recomiendo:* después de una vuelta completa
   de simulación con informes revisados por gestión documental.
8. **¿Quién firma las actas de eliminación y anonimización?** *Recomiendo:* una persona de gestión documental
   y una de la consola, nunca la misma.
9. **¿Se publica la TRD de SIMUS?** La publicación en el sitio de la entidad era un deber del acuerdo
   anterior. *Recomiendo:* sí, dentro de la publicación de la TRD del Ministerio, y un resumen legible en
   la sección de transparencia de SIMUS.
10. **¿Qué se hace con los datos ya existentes**, anteriores a la TRD? *Recomiendo:* asignarles serie y
    fecha de cierre por la última actividad conocida, y no aplicar eliminación a nada anterior hasta
    después de la primera simulación.

## 28.10 Lo que queda por verificar

Antes de convertir esta propuesta en un acto, conviene confirmar con las fuentes originales:

- El **articulado del Acuerdo 001 de 2024** sobre elaboración, aprobación, convalidación, publicación y
  registro de TRD, y qué parte del Acuerdo 004 de 2019 conserva.
- El **articulado de la Resolución 0163 de 2024** del Ministerio y si hay una versión posterior.
- Los **artículos 19, 21 y 22 de la Ley 594 de 2000** y cómo tratan los documentos electrónicos.
- La redacción de la **excepción por deber legal o contractual** en el Decreto 1377 de 2013 y su ubicación en
  el Decreto 1074 de 2015.
- Los **plazos de respuesta** a consultas y reclamos de la Ley 1581.
- La numeración del título de gestión documental dentro del **Decreto 1080 de 2015** y la aplicación del
  **Decreto 767 de 2022**.
- El **Banco Terminológico del AGN**, para alinear nombres de series y plazos de referencia.

El resultado de esa revisión cambia las marcas **[No verificado]** de este documento a **[Verificado]**
(o corrige el texto), y no la estructura de la propuesta.

## 28.11 El problema y la decisión

Los archivos son lo único de SIMUS que crece sin que nadie lo escriba: imágenes de Festivales, eventos y
noticias, documentos PDF, soportes de reclamaciones, materiales de ediciones y medios del sitio. La dirección
decidió que **nada se borra de forma automática** (§28.0), así que el sistema no puede ahorrar espacio eliminando por
su cuenta. Lo que sí puede es **pagar menos por guardar lo mismo**: no repetir bytes, servir versiones livianas y
mover lo que casi nadie consulta a un almacenamiento más barato, con el original intacto y recuperable. Una persona
autorizada puede borrar a mano, con confirmación y bitácora; eso es una decisión suya, no del sistema.

**[Propuesta]** Principios:

1. **El sistema no borra solo.** Ninguna regla, tarea programada ni limpieza por antigüedad elimina un archivo ni un
   dato. Todo derivado (miniatura, formato moderno) se puede regenerar a partir del original.
2. **Cambiar de lugar no es borrar.** Un archivo archivado conserva su fila, su huella, su historial y la ruta
   para recuperarlo. **Borrar a mano es una acción distinta**: la hace una persona con permiso, con diálogo de
   confirmación, motivo cuando aplique, línea de bitácora y, cuando proceda, evidencia.
3. **Primero medir, después mover.** Ninguna regla de archivado se activa sin un informe que diga cuánto pesa
   cada cosa y cuánto se ahorraría.
4. **Todo movimiento deja rastro.** Cada archivado, restauración y verificación queda en la bitácora con el
   contrato único de `docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md`.
5. **Lo público sigue funcionando.** Una imagen que se muestra en el portal no puede quedar en un nivel que tarde
   horas en responder.

## 28.12 Dónde se guardan hoy los archivos

**Hallazgo central.** **[Código]** Los bytes viven **dentro de la base de datos** (columnas `varbinary(max)`), no
en un disco ni en un servicio de objetos. Fue una decisión deliberada (comentario de
`V20260911_11__banco_de_archivos_y_agenda.sql`) y la plantilla de Azure lo repite: «Sin Blob Storage —el API no
escribe ficheros—» (`infra/main.bicep`, líneas 4 y 5). Por eso el tamaño de los archivos es el tamaño de la base y
de sus respaldos.

| # | Qué | Dónde | Tope y reglas | Observación |
|---|---|---|---|---|
| 1 | **Banco de archivos** (imágenes y PDF de consola, de organizaciones y de personas) | `dbo.Archivos`: `Contenido varbinary(max)`, `Huella char(64)` (SHA-256), `PesoBytes`, `TipoMime`, `Ancho`, `Alto` | Imagen hasta **2 MiB**, PDF hasta **20 MiB** (`CK_Archivos_PesoPorTipo`); formato reconocido por su firma (PNG, JPEG, WebP, PDF). Cuota de **50 MiB por organización** (`CuotaPorOrganizacion`, solo para archivos de organización: el Programa y las personas no tienen cuota) | La ruta que se guarda es una URL pública (`/api/v1/publico/archivos/…`), no una ruta de disco. La deduplicación existe pero **por dueño** (misma huella y mismo dueño), no entre dueños |
| 2 | **Retiro de un archivo del Banco** | `RetirarAsync` en `BancoDeArchivosEndpoints.cs` | Comprueba los vínculos y, si no hay, ejecuta `db.Files.Remove(fila)` | **Elimina la fila y sus bytes de forma física.** Es una **acción manual** de quien tiene permiso: **válida** (§28.0). Le faltan el diálogo de confirmación y la línea de bitácora. Archivar en frío es una opción posterior de ahorro, no una corrección (§28.14) |
| 3 | **Imágenes y medios del sitio (CMS)** | `dbo.MediosWeb`: `BorradorContenido`, `BorradorMiniatura`, `PublicadoContenido`, `PublicadoMiniatura` (todas `varbinary(max)`) con sus huellas | Hasta 2 MiB por imagen; hasta cuatro copias por medio | Ya guarda **miniatura**. El historial (`dbo.MediosWebHistorial`) **dejó de guardar el archivo** (`V20260829_03`): reemplazar una imagen borra la anterior para siempre, por un criterio de entonces («siempre se reemplaza, y si se reemplaza desaparece»). Es una **acción manual** y por tanto válida (§28.0); conviene valorar dejar una copia en frío **como opción**, sin imponerla (§28.18) |
| 4 | **Soportes de reclamación** | Los mismos bytes del Banco de la organización (`dbo.Archivos`), vinculados por `dbo.ArchivosDeRegistro` con módulo `reclamaciones-administracion` (`V20261106_09`) | Hasta cinco PDF o imágenes por solicitud, dentro de la cuota de la organización | No se retiran del Banco mientras la solicitud los cite |
| 5 | **Materiales de ediciones y de eventos** | `dbo.EdicionesFestivalMateriales`, `dbo.EventosAgendaArchivos`, `dbo.NoticiasArchivos` y `dbo.ArchivosDeRegistro` apuntan a `dbo.Archivos` (o a una URL externa) | Los del Banco, como en la fila 1 | Son vínculos, no copias: el peso real está en la fila 1 |
| 6 | **Portadas de documentos importados** | Al leer un PDF de Agenda o Catálogo se renderiza una portada PNG y se guarda en `dbo.Archivos` (`ImportacionDeDocumentos.cs`), deduplicada por huella | El PDF original **no se guarda** | La portada sí queda; el documento fuente no |
| 7 | **Previsualizaciones de importación** | `dbo.FilasImportacion.ContenidoNormalizadoJson` (`nvarchar(max)`) | **Se depuran a los 30 días** (`DepuradorImportaciones`, `V20260911_03`); la cabecera y los conteos se conservan | No son archivos, pero es un **borrado automático** por antigüedad: choca con §28.0. Debe justificarse por escrito como excepción (son temporales y sin valor de registro) o convertirse en archivado (§28.18, decisión 5) |
| 8 | **Respaldos** | Azure SQL gestionado: `requestedBackupStorageRedundancy: 'Local'` (`infra/main.bicep`, línea 196). En local, el volumen de Docker | La oferta gratuita de Azure SQL incluye 32 GB de respaldo y recuperación a un punto en el tiempo de siete días **[Verificado]** en resultados de búsqueda (§28.15) | El respaldo copia también los archivos: el tamaño de la base se paga dos veces |

## 28.13 Cuánto pesa y cuánto puede crecer

**Lo medido.** Las 27 imágenes que usa la siembra de demostración pesan en conjunto unos **1,05 MiB**
(`simus-database/seed/demo-imagenes`, 28 archivos, 1072 KiB; unos 38 KiB por imagen). La base local de demostración
no se midió con consulta en este lote.

**Lo que dicen los topes.** **[Propuesta]** Estimaciones de orden de magnitud con los topes del código. Los supuestos
se declaran para que se puedan discutir; ninguno es un dato medido de producción.

| Escenario | Supuesto | Peso aproximado |
|---|---|---|
| Hoy, demostración | 27 imágenes de siembra | ~1 MiB |
| Uso moderado | 100 organizaciones × 10 archivos × 300 KiB | ~300 MiB |
| Uso intenso | 300 organizaciones × 20 archivos × 500 KiB | ~3 GiB |
| Techo teórico por la cuota | 640 organizaciones × 50 MiB | ~31 GiB |
| Medios del sitio, peor caso | 45 claves × 4 copias × 2 MiB | ~360 MiB |

**Cómo se lee.** El techo teórico por cuota de 50 MiB se acerca a los 32 GB de datos de la oferta gratuita de Azure SQL
**[Verificado]** en resultados de búsqueda, sin contar el resto de las tablas ni la parte de la cuota que usan el
Programa y las personas, que no tienen tope. Es poco probable llegar al techo, pero **hoy no existe ninguna medida
ni alarma** que avise cuánto se usa. Esa es la primera pieza que falta (§28.16, fase 0).

**Dos efectos que conviene tener presentes.**

- Los archivos no usados no se ven: un afiche que ya no cita nadie sigue ocupando lo mismo.
- Optimizar una imagen **no libera espacio si el original se conserva**. Ahorra ancho de banda y tiempo de carga;
  el espacio se libera solo cuando el original sale de la base hacia un nivel más barato (§28.14, §28.15).

## 28.14 Diseño: sin borrado automático, gastar menos

**[Propuesta]** Seis piezas, en el orden en que conviene construirlas. Ninguna borra de forma automática (§28.0).

**1. Informe de almacenamiento (sin tocar datos).** Una vista de la consola, solo lectura, con bytes por tabla,
por dueño, por tipo, por estado y por antigüedad; archivos sin uso y duplicados entre dueños; y el crecimiento por
mes. Es lo que permite decidir con números y activar una alarma (por ejemplo, al 50 % del tope de la base).

**2. Retiro manual con confirmación y bitácora, y estados del archivo.** Hoy «retirar» ejecuta `db.Files.Remove`:
es una **acción manual** de quien tiene permiso y es **válida** (§28.0). Lo que falta es el **diálogo de
confirmación** (con el aviso de que es irreversible, y de qué vínculos lo usan) y la **línea de bitácora**
. Como **opción posterior**, el retiro puede ofrecer dos caminos a quien lo hace: *borrar* (como
hoy) o *archivar* (marcar el estado `retirado`, conservar la fila y los bytes y permitir restaurar). Los estados
son `activo`, `sin_uso`, `retirado` y `archivado` (movido a frío). Es una opción de ahorro de almacenamiento y de
reversibilidad, no una corrección de un defecto (§28.17).

**3. Deduplicación entre dueños.** Hoy dos organizaciones que suben el mismo logotipo guardan dos copias. Se
propone un **almacén de contenidos** indexado por huella (una fila por contenido) al que apuntan los archivos de
cada dueño. La clave debe ser el SHA-256 que ya se calcula. Condición de seguridad: la deduplicación es interna;
ningún mensaje ni tiempo de respuesta debe revelar que otro dueño ya subió ese mismo archivo.

**4. Derivados livianos, original intacto.** Para cada imagen se generan, a partir del original, versiones por
tamaño (por ejemplo 320, 640 y 1280 px de ancho) y en un formato moderno (WebP; el sistema ya lo acepta). El portal sirve
siempre el derivado; el original queda como fuente. El CMS ya guarda una miniatura por medio; se extiende el
criterio al Banco. **Esta pieza ahorra transferencia, no espacio**, y suma bytes de derivados mientras el original
siga en la base.

**5. Niveles de almacenamiento.** Tres niveles lógicos, sin atarlos todavía a un proveedor:

| Nivel | Qué guarda | Latencia | Quién lo lee |
|---|---|---|---|
| **Caliente** | Lo que se muestra en el portal o se usa a diario: derivados y archivos activos | Inmediata | Público y usuarios |
| **Frío** | Originales que no se muestran, archivos sin uso o retirados, soportes de solicitudes decididas | Segundos a minutos | La consola con permiso y el dueño por solicitud |
| **Archivo** | Lo que nadie ha pedido en años y se conserva por memoria institucional | Horas | Solo la consola con permiso |

El archivado mueve el **contenido** al nivel frío y deja en la base la fila con huella, tamaño, tipo, estado,
ubicación y fecha. Reglas iniciales propuestas: `sin_uso` a los **90 días** sin vínculos; `retirado` a los **30 días**
(la ventana sirve para deshacer); soporte de solicitud decidida a los **180 días**; y, una vez archivado, la
restauración a pedido devuelve el contenido a caliente sin perder la fila. Los umbrales son parámetros de
configuración, no valores en el código. **Archivar por antigüedad es mover, no borrar:** el contenido sigue
existiendo y se recupera, así que no choca con §28.0. Lo que no se hace por antigüedad es eliminar. Es una **opción
posterior de ahorro de almacenamiento**, que se activa solo cuando el informe de la pieza 1 lo justifique.

**6. Integridad, respaldos y acceso.**

- **Integridad.** Al mover un archivo se compara su SHA-256 antes y después; la huella ya existe en `dbo.Archivos` y en
  `dbo.MediosWeb`. Además, una verificación periódica (completa cada trimestre o por muestreo mensual) registra el
  resultado y alerta si una huella no coincide.
- **Respaldos.** Sacar los bytes de la base reduce el tamaño de sus respaldos, pero el almacén frío necesita su propia
  protección (copia redundante, recuperación de borrados accidentales, inmutabilidad opcional). Los respaldos
  de la base no sustituyen un archivo: su retención es corta (siete días en la oferta gratuita **[Verificado]**).
- **Cuotas.** La cuota por organización (50 MiB) pasa a contar solo lo caliente, para que archivar libere espacio al
  dueño. Se añaden una cuota razonable para las personas y un aviso, no un tope, para el Programa. Superar la cuota
  bloquea subidas nuevas; nunca elimina nada.
- **Acceso.** Los archivos públicos se sirven desde caliente. El frío no es público: restaurar exige permiso y la
  lectura queda registrada. Los soportes pueden contener datos personales (cédulas, actas), así que su lectura
  desde la consola sigue la regla de `docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md`: se registra la consulta con los nombres de los campos, no con los
  valores.
- **Bitácora.** Eventos nuevos con el contrato único (`{ evento, antes, despues, motivo, origen }`): `archivo.retirado`,
  `archivo.archivado`, `archivo.restaurado`, `archivo.verificado`, `archivo.verificacion_fallida`,
  `archivo.reemplazado`. Nunca se guarda el binario en la bitácora, solo huella, tamaño, estado y nivel.

### 28.14.1 El estándar de almacenamiento (17 nov 2026)

La dirección pidió un estándar «configurado de modo que no sea molesto». Es el siguiente, y vale para el informe de la pieza 1 (`GET /api/v1/institucional/archivos/almacenamiento`).

| Qué | Regla |
|---|---|
| Tope | Es **del entorno**: `Almacenamiento:TopeDeLaBaseBytes`. La demo lo fija en 32 GiB (`infra/main.bicep` (el despliegue de la demo; `appsettings.Demo.json` y `Production.json` deben ser idénticos, así que el valor no va ahí)). Si un entorno no trae valor, el informe da **solo la cifra**, sin porcentaje, sin nivel y sin proyección: no se inventa un tope |
| Niveles | Menos del 80 %: **solo la cifra**, sin aviso. Del 80 % al 90 %: **atención**. Desde el 90 %: **alarma**. Los umbrales son configurables (`:UmbralDeAtencion` 0,8 y `:UmbralDeAlarma` 0,9) |
| Proyección | Con los últimos doce meses: el promedio mensual de bytes subidos, contado desde el primer mes con datos. Si al ritmo actual se llegaría al umbral de alarma en **menos de seis meses** (o ya se pasó), el informe lo marca (`proyeccion.avisaDeLlegadaPronta`). Es una estimación: no descuenta lo que se retire |
| Quién lo ve | Solo la consola con el módulo **Auditoría** (además del Banco). Sin él, 403. Las organizaciones y el público no tienen ruta |
| Dónde se avisa | Una línea en la gestión del Banco (atención, alarma o proyección próxima) y un **punto discreto en el Resumen operativo solo en alarma**. Ambos se pueden ocultar **siete días**; el descarte se guarda en el navegador, por cuenta. Sin correos |

**Provisional.** El tope de 32 GiB es provisional: se fija por entorno en producción mediante `Almacenamiento:TopeDeLaBaseBytes`.

Los medios del sitio (`dbo.MediosWeb`) se informan aparte (`mediosDelSitio`) y no suman al total ni al nivel.

Lo que no cambia: mide solo el Banco (el porcentaje es un mínimo), y nada se borra ni se mueve por sí solo.

## 28.15 Niveles de almacenamiento y costos de referencia

Lo que se pudo confirmar con búsqueda web (sin abrir los textos oficiales completos; las marcas siguen §28.1):

| Dato | Marca |
|---|---|
| Azure Blob Storage tiene niveles **caliente, frío (cool), muy frío (cold) y archivo**. El mínimo de permanencia es de **30 días** en cool, **90** en cold y **180** en archive; hot no tiene mínimo. Salir antes cobra los días restantes: es una regla de facturación, no un bloqueo técnico | **[Verificado]** en la documentación de Microsoft Learn y compilaciones en resultados |
| Los niveles caliente, frío y muy frío se leen de inmediato (milisegundos). El nivel **archivo** está fuera de línea: hay que «rehidratarlo» antes de leerlo, y eso tarda **horas** | **[Verificado]** |
| La rehidratación tarda **hasta 15 horas** en prioridad estándar y **menos de una hora** en prioridad alta, a mayor costo | **[No verificado]**: la cifra salió de un blog de terceros y no de la documentación oficial |
| La oferta gratuita de **Azure SQL Database** incluye 100 000 segundos de vCore, **32 GB de datos y 32 GB de respaldo** al mes, con recuperación a un punto en el tiempo limitada a **siete días** | **[Verificado]** en resultados de búsqueda; es la que usa la plantilla de la demostración |
| **FILESTREAM** (archivos fuera de las páginas de la base, pero dentro de la transacción) conviene para objetos grandes y poco leídos; para objetos pequeños, `varbinary(max)` suele rendir mejor. Exige un grupo de archivos especial | **[Verificado]** en documentación de SQL Server. **[No verificado]** si el servicio de Azure SQL que usa SIMUS lo admite: no debe darse por hecho |
| Precios por GB de cada nivel y de las operaciones | **[No verificado]**: no aparecieron cifras fiables en los resultados. Se calculan con la calculadora de precios de Azure y la región elegida |

**Cómo se calcula el costo (cuando haya precios).** **[Propuesta]** El costo mensual es, aproximadamente, `GB en
caliente × precio de la base + GB en frío × precio del frío + operaciones de lectura y escritura`. El frío solo
compensa si lo archivado es una parte grande del total y se lee poco. Con los tamaños de §28.13 (megas o pocos
gigas), **el ahorro monetario hoy es pequeño**: la razón para hacerlo pronto es el orden (no perder nada, no depender
de una base que crece sin control) y la oferta gratuita, cuyo tope es de 32 GB.

**Dos caminos para el nivel frío.** **[Propuesta]**

| | A. Almacenamiento de objetos (por ejemplo, Azure Blob con cool, cold y archive) | B. Esquema o base de archivo dentro de SQL |
|---|---|---|
| Qué cambia | Cuenta de almacenamiento nueva, identidad administrada y una interfaz de almacén con dos implementaciones (base y objetos) | Un esquema con acceso restringido en la misma base, o una segunda base |
| Costo y límites | Más barato por GB para lo frío **[No verificado]**; revierte la decisión de «sin Blob» de `infra/main.bicep` | Sin servicio nuevo, pero el tamaño sigue contando en la misma base o en otra del mismo precio |
| Riesgo | Mayor (infraestructura, permisos, redundancia) | Menor; no resuelve el crecimiento de fondo |
| Cuándo | Cuando el volumen se acerque al tope o la entidad exija un repositorio propio | Mientras el volumen sea de megas |

**Recomendación.** Empezar por las piezas 1 y 2 de §28.14, que no necesitan infraestructura, y decidir A o B cuando el
informe de almacenamiento pase un umbral acordado (propuesta: la mitad del tope de la base).

## 28.16 Plan por fases

Las cifras de esfuerzo son relativas y por validar: **S** unos 1 a 2 días, **M** de 3 a 5, **L** una a dos semanas.
**[Propuesta]**

| Fase | Qué | Esfuerzo | Riesgo | ¿Se puede construir ya? |
|---|---|---|---|---|
| **0** | Informe de almacenamiento y alarma (§28.14, pieza 1) | S | Bajo: solo lectura | **Hecho** el 16 nov 2026: `GET /institucional/archivos/almacenamiento` y resumen en la gestión del banco de la consola; mide el Banco, no los medios del sitio |
| **1** | Retiro manual con diálogo de confirmación y bitácora y, como opción posterior, estados del archivo y retiro que archiva con restaurar desde la consola (pieza 2) | S (confirmación y bitácora); S a M (estados y archivar) | Bajo la confirmación; medio la opción de archivar, porque exige migración con restricción de estado | **Sí**; lo de archivar, tras la decisión 1 de §28.18 |
| **2** | Opción para el CMS: conservar una copia en frío de la imagen reemplazada, sin imponerlo | S a M | Bajo | **Sí**, tras la decisión 2 |
| **3** | Derivados livianos por tamaño y formato (pieza 4) | M | Bajo a medio | **Sí** |
| **4** | Deduplicación entre dueños con almacén de contenidos (pieza 3) y cuotas que cuentan solo lo caliente | M | Medio: toca el modelo y la privacidad | Después de 0 y 1 |
| **5** | Interfaz de almacén con dos implementaciones, archivado automático a frío, restauración a pedido, verificación periódica (piezas 5 y 6) | L | Alto: infraestructura, permisos y copias | Tras decidir el camino A o B (decisión 3) |

**Riesgos transversales.** Una migración mal hecha puede dejar archivos sin contenido; por eso el movimiento a frío
copia, verifica la huella y solo entonces deja de servir desde la base (el sistema no borra el original por su
cuenta: lo retira de la base una persona, con confirmación, una vez verificado el destino). Las pruebas de todo lo que escriba bitácora o
historial se hacen contra SQL Server, porque sus restricciones no se aplican en SQLite.

## 28.17 Cómo se conecta con ARC-01, ARC-02 y docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md

- ** (bitácora del retiro) y (filtro «Sin usar» en el servidor).** Los trabaja sobre
  `BancoDeArchivosEndpoints.cs`. Este documento **no los duplica**: la fase 1 reutiliza (el predicado de «sin
  uso» es la lista de candidatos al archivado) y suma eventos de bitácora a los que introduce.
- **, reclasificado.** El retiro del Banco (`RetirarAsync`) elimina físicamente la fila y los bytes. Es una
  acción manual y **es válido** (§28.0): lo que falta es el diálogo de confirmación y la línea de bitácora, que es
  justamente. «Archivar en frío» queda como **opción posterior** de ahorro de almacenamiento, no
  como corrección. Si se construye, toca la misma función que G5: conviene hacerlo **después** de, en un PR
  aparte.
- **`docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md` (registro de cambios).** El estado y la ubicación de un archivo (`activo`, `retirado`, `archivado`; caliente,
  frío) son campos con historial en `CambiosDeRegistro`, con clase de dato técnica. La lectura de un soporte que
  contenga datos personales usa el verbo `consultar` de la bitácora.
- **Serie 13 de §28.5 (archivos del Banco).** La disposición **E** deja de aplicarse como proceso automático
  mientras dure la suspensión: su política vigente es la de este capítulo (retiro manual con confirmación y
  bitácora; archivado como opción).

## 28.18 Decisiones abiertas

Cada una trae mi recomendación, para que pueda contestarse con «sí».

1. **¿El retiro del Banco ofrece, además de borrar, la opción de archivar?** El borrado manual es válido hoy
   (§28.0): lo que falta es la confirmación y la bitácora. *Recomiendo:* añadir primero eso y ofrecer
   archivar más adelante, cuando el informe de almacenamiento lo justifique.
2. **¿Se deja, como opción, una copia en frío de la imagen del CMS que se reemplaza?** El reemplazo es una acción manual
   y es válido. *Recomiendo:* ofrecerlo como opción, sin imponerlo; el criterio de `V20260829_03` («si se reemplaza,
   desaparece») sigue siendo aceptable.
3. **¿Se abre un almacenamiento de objetos (camino A) o un esquema de archivo dentro de SQL (camino B)?** *Recomiendo:*
   no decidirlo todavía; construir las fases 0 y 1 y decidir cuando el informe pase la mitad del tope de la base.
4. **¿Se aceptan los umbrales de archivado?** *Recomiendo:* sin uso a 90 días, retirado a 30 y soporte de solicitud decidida a
   180, como parámetros de configuración.
5. **¿Qué se hace con las previsualizaciones de importación, que hoy se depuran solas a los 30 días?** Es un
   **borrado automático por antigüedad** y choca con §28.0. Hay dos caminos: **(a)** documentarlo como **excepción
   justificada por escrito**, con el argumento de que son temporales, sin valor de registro y reconstruibles
   volviendo a cargar el archivo (la cabecera, los conteos y las decisiones sí se conservan); o **(b)** convertir
   la depuración en **archivado** (mover el contenido comprimido a frío). *Recomiendo:* (a), con la justificación en
   `docs/operacion/11-operacion-y-mantenimiento.md` §11.5, y pasar a (b) solo si la dirección no admite ninguna excepción.
6. **¿Cuota para personas y para el Programa?** *Recomiendo:* una cuota para personas (por ejemplo 10 MiB) y solo un aviso
   para el Programa.
7. **¿Quién puede pedir la restauración y en cuánto tiempo?** *Recomiendo:* la consola con permiso de Auditoría, y el
   dueño por solicitud; objetivo de minutos en frío y de horas en archivo, que solo se usa para lo que lleve años sin
   pedirse.
8. **¿Qué protección tiene el almacén frío** (redundancia, recuperación de borrados, inmutabilidad)? *Recomiendo:* copia
   redundante y recuperación de borrados activas desde el primer día.
9. **¿Se publica en la sección de transparencia que SIMUS no borra información de forma automática?** *Recomiendo:*
   sí, en una línea clara; sirve de respuesta estándar a las solicitudes de supresión mientras la tabla esté en
   suspenso (el borrado manual lo decide una persona autorizada, con confirmación y bitácora).

## 28.19 Qué queda por verificar del almacenamiento

- **Precios** por GB y por operación de los niveles de Azure en la región elegida, y el costo real de una restauración.
- La **rehidratación del nivel archivo** (tiempos y destinos permitidos) en la documentación oficial.
- Si el servicio de **Azure SQL** que usa SIMUS admite **FILESTREAM**, o si hay que ir a objetos.
- El **tamaño real** de la base de producción y su distribución por tabla (fase 0).
- Cómo respaldar y proteger el almacén frío (redundancia, recuperación, inmutabilidad) en la oferta elegida.
- Si la deduplicación entre dueños tiene implicaciones de **privacidad** que exijan análisis jurídico.
