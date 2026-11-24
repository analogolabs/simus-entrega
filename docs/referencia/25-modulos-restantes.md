# 25. Módulos restantes del ecosistema

Propuesta de diseño, **sin código ni migraciones**, para decidir cuáles de los módulos que faltan se
construyen a partir de la base de Festivales y Mercados, en qué orden y con qué patrón. Cubre los módulos de
escuelas, espacios de música en vivo, lutería, redes y documentación, y directorios y mapa, y responde al pedido de la dirección del 10 de noviembre de 2026: «crear
algunos de los otros módulos restantes, como el tema de talleres de lutería».

> **Estado al 20 de noviembre de 2026.** Este documento nació como propuesta y conserva su razonamiento, pero **ya se
> construyeron** Lutería (talleres, §25.7), Espacios para música en vivo (§25.8) y Redes y documentación (§25.9), y los cinco
> procesos del ecosistema comparten el modelo común de [`30`](../desarrollo/30-consola-y-acceso.md) §30.17. **Escuelas de música
> sigue sin construirse**. Las cifras de abajo son las del 10 de noviembre y no se actualizan; las vigentes están en
> [`02`](../desarrollo/02-arquitectura.md), [`05`](../desarrollo/05-base-de-datos.md) y [`08`](../desarrollo/08-api-e-integraciones.md).

Lo que sigue es una **propuesta**: lo que no se construyó no se aplica hasta que la dirección responda las preguntas
de §25.6. Las cifras se midieron sobre `main` el 10 de noviembre de 2026 (`4cdadd1a`).

Documentos que este complementa y no repite: [núcleo reutilizable de procesos](../desarrollo/13-nucleo-de-procesos.md)
(contrato y declaración de un proceso nuevo), [módulos y funcionalidades](../usuario/06-modulos-y-funcionalidades.md),
plan de trabajo restante (Bloque 5) y
backlog de evolución (épica E4).

## 25.1 Inventario: qué existe y qué falta

### Los seis procesos del Ecosistema

| Proceso | Estado hoy | Evidencia |
| --- | --- | --- |
| **Festivales** | Completo, con ediciones | Circuito entero, directorio, ficha, mapa, propuestas, históricos reclamables |
| **Mercados musicales** | Completo, con ediciones | Mismo circuito; sus ediciones no pasan por revisión (`V20260916_01`) |
| Escuelas de música | **Falta.** Sin tabla, sin API, sin pantallas | Retirado en `V20260904_01` y `V20260911_04`; la tarjeta dice «Próximamente» |
| **Espacios para música en vivo** (antes «Escenarios») | **Construido (10 nov 2026):** el lugar, con circuito completo, directorio, ficha y capa en el mapa | Ver §25.8. Su tabla antigua, `dbo.Escenarios`, existió y se retiró vacía; esta es una nueva (`dbo.Espacios`) |
| **Redes y documentación** | **Fase 1 construida (10 nov 2026):** la red o el centro de documentación, con circuito completo, directorio, ficha y capa en el mapa | Ver §25.9 |
| **Lutería** | **Fase 1 construida (10 nov 2026):** el taller, con circuito completo, directorio, ficha y capa en el mapa | Ver §25.7. Estaba separado de Escenarios a propósito (decisión del 25 de agosto de 2026) |

Los retirados **no se perdieron datos**: los guiones de retiro se detienen si la tabla tiene filas.
Lo que se conservó a propósito es el contrato contra el que volverán a implementarse:
`IRegistroDeEcosistema`, `ITieneOrganizacionResponsable` y `AsignarOrganizacionResponsable`
(`SimusDbContext.cs`), que impiden que un registro del ecosistema nazca sin quien responda por él.

### Los demás módulos y superficies

| Módulo | Estado | Quién lo gestiona |
| --- | --- | --- |
| Catálogo Editorial, Noticias, Agenda | Operativos, con circuito propio | Consola |
| Banco de archivos, Páginas y bloques (CMS), Boletín | Operativos | Consola |
| Organizaciones y cuentas | Operativos | La organización y la consola |
| Directorio de personas (perfil público) | Operativo | La propia persona, con moderación |
| Territorios sonoros y Prácticas musicales | Operativos como **catálogos con página pública**, no como procesos | Consola |
| Mapa ecosistémico | Operativo para Festivales, Mercados y Agenda | — |
| El Plan (PNMC) | Operativo como sección de segundo nivel | Consola (CMS) |
| Consulta guiada, importación asistida | Operativos; cubiertos por otros lotes de diseño | — |

### Previstos fuera de los seis procesos

| Tema | Estado |
| --- | --- |
| Directorios y mapa para tipos nuevos | Depende de que exista el primer registro nuevo |
| Micrositios para programas y estrategias | Se evalúa sobre `/pnmc`, que ya funciona como micrositio |
| Identidad institucional y cuentas autorizadas | Aparte; no es un módulo |
| Agrupaciones y Agentes | **Retirados el 30 de agosto de 2026** por decisión de la dirección; no se retoman |

### Restos que el inventario encontró (verificados en el código)

Son defectos pequeños y previos que conviene cerrar **antes** de añadir un módulo, porque el módulo
nuevo se montaría encima de ellos:

1. **Capas del mapa que dicen «Activo» sin datos.** `features/map/domain/mapLayers.ts` marca como
   `Activo` Escuelas de Música, Redes de Documentación y Lutieres, mientras que
   `categorias-ecosistema.config.ts` las marca «Próximamente». El mapa conserva además la lógica de
   conteos (`schoolCount`, `lutierCount` en `map-domain.ts`) y las tarjetas «Talleres de Lutería» y
   «Centros de Documentación» de la capa General, que muestran ceros.
2. **Un enlace a una ruta que no existe.** La página del mapa construye `ecosistema/escuelas/:schoolId`
   para una ficha de tipo `Escuela`; esa ruta no está en el enrutador y lleva a «no encontrado». Es el
   resto residual que el Bloque 5 mandaba retirar.
3. **Listas que prometen lo que no hay.** `procesosProyectados` del panel de la organización lista cuatro
   procesos sin ruta; `ADMIN_ENTITY_TYPES` ofrece `escuela_musica`, `lutier` y `espacio` como tipos de
   entidad; `admin-records-panel` conserva una rama para `luteria`.
4. **Un contrato que anuncia lo que no existe.** `EventosDeOrganizacionContratos.cs` dice que «redes y
   escuelas llegarán por `Tipo`»: hoy solo hay `festival` y `mercado`.

## 25.2 Qué se reutiliza de Festivales y Mercados

El contrato transversal ya está escrito y probado en [docs/13](../desarrollo/13-nucleo-de-procesos.md). Lo
que importa para estimar es **dónde está el costo**:

| Pieza | ¿Se reutiliza? | Cómo |
| --- | --- | --- |
| Organización responsable y guarda de acceso | Sí, tal cual | `ITieneOrganizacionResponsable`, `AdministracionDeOrganizacion.PuedeAdministrarAsync` |
| Ciclo de estados y diccionario | Sí | `borrador` → `en_revision` → `ajustes_solicitados` → `publicado` → `archivado` (más `rechazado`); `core/vocabularios/estados.ts` |
| Revisión por campos, envío e instantánea | Sí, sin tablas nuevas | `RevisionesDeRegistro`, `EnviosDeRevision`, clave `ModuloId` + `RegistroId` |
| Propuestas de cambio sobre lo publicado | Sí | `PropuestasDeCambio` y sus campos; cada módulo declara sus campos proponibles |
| Historial, procedencia y bitácora | Sí | `RegistrosRevisionHistorial`, `ProcedenciasDeRegistro`, `BitacoraAuditoria` (cuidado con los `CHECK` de acción) |
| Localización, aliados, archivos, clasificaciones | Sí | `…DeRegistro` y las cinco tablas de clasificación (`V20260918_02`, `_03`) |
| Territorio | Sí | Las dos claves DIVIPOLA y el mismo `CHECK` de coherencia de cobertura |
| Prácticas musicales y territorios sonoros | Sí | Mismas tablas de catálogo, como en Mercados |
| Eventos de la organización hacia la Agenda | Sí, con un `Tipo` nuevo | Hoy exige un Festival o un Mercado publicado |
| Permisos por módulo de la consola, bandeja, avisos | Sí, con filas nuevas | `ModuloDeUnTramite`, `ModuloDeUnAviso`, `ModulosDeLaConsola` |
| Acciones por estado y confirmación común | Sí | `core/acciones`, `ServicioDeConfirmacion` |
| Traductor de errores, pipe de fechas, indicadores de estado | Sí | `core/formularios`, `shared/components/ui` |
| **Formulario, asistente, ficha de gestión y ficha pública** | **No: se escriben por módulo** | [docs/13](../desarrollo/13-nucleo-de-procesos.md) §13.8 lo deja así a propósito hasta que se repitan en tres procesos |

**Dónde está el costo.** Los archivos con «mercado» en el nombre suman unas **15 700 líneas**: cerca de
3 800 en la API, 2 400 en pruebas y **9 000 en la web**. Además, **51 archivos de la API y 73 de la web**
mencionan a Mercados sin llevarlo en el nombre (permisos, auditoría, mapa, consulta guiada, vocabularios,
rutas). Es decir: el núcleo de datos y de revisión ya es genérico y barato; lo caro es la web de cada
módulo y los puntos de enganche repartidos. Esa es la razón de ser del patrón de §25.3.

**Cuándo abstraer.** El módulo que se construya será el tercero con circuito completo. [docs/13](../desarrollo/13-nucleo-de-procesos.md)
§13.8 fija ese momento como el de evaluar un formulario declarativo. Recomendación: construir el primero
**a mano, con la estructura de Mercados**, y extraer lo común solo si el segundo lo confirma. Abstraer antes
volvería a ocultar reglas de cada dominio.

## 25.3 Patrón de «nuevo módulo»

Lista de verificación, en el orden en que conviene hacerla. Cada punto nombra el sitio real donde se toca
hoy para Mercados. Lo que no se pueda marcar como hecho, o como «no aplica» con su razón, impide dar el
módulo por terminado.

**0. Declaración previa** ([docs/13](../desarrollo/13-nucleo-de-procesos.md) §13.9). Datos, permisos y
pruebas del proceso, en la tarea, antes de escribir código. Debe incluir la decisión de la dirección:
implementar en SIMUS, integrar desde otro sistema o mantener fuera.

**1. Base de datos** (`simus-database/schema`, migración aditiva, sin cascadas, `V<fecha>_NN`).
- Tabla principal con `OrganizacionResponsableId` **desde su nacimiento**, nulabilidad decidida con
  intención, `CHECK` de estado y de cobertura.
- Subregistros (ediciones, procesos) solo si el módulo los necesita, con su propio eje de estado.
- Catálogos propios como tablas, no como texto libre; reutilizar los existentes cuando sean los mismos.
- Procedencia desde el primer registro; semillas de demostración con todos los campos (``).
- Incluir el guion en la lista de `scripts/local/seed-local-db.sh` y probar la reconstrucción de la demo.

**2. Dominio y API** (`SIMUS.Domain`, `SIMUS.Contracts`, `SIMUS.Api/Endpoints`).
- Constante en `Modulos.cs` (nunca un literal suelto) y filas en `SimusDbContext`.
- DTO de gestión y DTO **público** distintos, con la lista expresa de campos permitidos.
- Endpoints: lectura pública, alta y edición desde la organización, alta desde la consola, envío,
  revisión por campos, propuestas, retiro, y el filtro `ExigeTestigoDeLaConsola` en toda escritura de
  `/admin`.
- Enganches repartidos: `ModuloDeUnTramite`, `ModuloDeUnAviso`, `ModulosDeLaConsola`,
  `CustodiaDeProcesos`, `AccionesAuditoria`, `EventosDeLaBitacora`, `HistorialDeEstados`,
  `AdminDataEndpoints`, `TiposDeEntidad`.
- Rutas anónimas nuevas, si las hay, contadas y justificadas en `AutorizacionPorDefectoTests`.

**3. Consola** (`features/admin`).
- Sección en `navegacion-administrativa.ts` (la única lista) y su permiso por módulo.
- Lista, ficha con URL propia (`/administracion/:seccion/:id`), revisión por campos, acciones por estado.
- Aparición en la bandeja de Solicitudes y en el resumen operativo.

**4. Panel de la organización** (`features/panel-organizacion`).
- Sección y lista por proceso (`…/procesos/{proceso}`), alta y ficha (`/nuevo`, `/:id`), asistente de
  alta con autoguardado, «qué falta para enviar», propuesta de cambio y retiro.
- Entrada en `core/navegacion/rutas-de-gestion.ts`.

**5. Portal público** (`features/ecosistema`, `app.routes.ts`).
- Directorio y ficha en `/ecosistema/<módulo>[/:id]`, con filtros de la misma forma que Festivales.
- Tarjeta en `categorias-ecosistema.config.ts` con `route`, `countKey` y `altaExterna`; recuento en el
  Inicio; lo no publicado nunca visible.

**6. Mapa, consulta guiada y eventos.**
- Capa en `mapLayers.ts` y en `map-data.service.ts` **solo cuando haya registros**; conteos en
  `core/territorio/conteos-territoriales.ts`. Un solo origen para directorio y mapa.
- Preguntas propias en `ConsultaGuiada/CatalogoDeConsultas.cs`.
- Nuevo `Tipo` en los eventos de la organización, si el módulo puede enmarcar eventos.

**7. Textos, estilo y CMS.** Textos por omisión en el registro del CMS según [docs/23](../usuario/23-guia-de-estilo-de-textos.md);
traducciones en `traductor-de-errores.ts`; diccionario de estados.

**8. Contrato y pruebas.** OpenAPI regenerado; las pruebas de [docs/13](../desarrollo/13-nucleo-de-procesos.md)
§13.9 y §13.10, **más** una pasada contra SQL Server (los `CHECK` de bitácora no existen en SQLite), una
prueba de componente por pantalla y un recorrido `@backend` de Playwright: registrar, enviar, revisar,
publicar, verlo en el directorio, proponer un cambio y retirarlo.

**9. Documentación.** Una fila en [docs/06](../usuario/06-modulos-y-funcionalidades.md) §6.4–6.5, el contraste de
[docs/13](../desarrollo/13-nucleo-de-procesos.md) §13.6, la matriz de
[auditoría por superficie](../desarrollo/12-acceso-por-superficie.md) y la demostración de
.

## 25.4 Fichas de los módulos que faltan

Escala de esfuerzo, **relativa a Mercados (L = un Mercado completo, unas 15 000 líneas)**: **S** menos de
una cuarta parte, **M** entre un tercio y la mitad, **L** parecido a Mercados. Son estimaciones a revisar al
abrir cada tarea; no hay un módulo medido todavía.

### Lutería: talleres y procesos de lutería

**Qué es.** El oficio de construir, reparar y restaurar instrumentos, y los saberes que lo sostienen. El
backlog (SIMUS-028 y 029) pide decidir si «talleres» y «procesos» son registros distintos.

**Quién lo gestiona.** Una organización responsable (taller constituido, colectivo, escuela-taller). El
caso del **lutier independiente** sin organización es la decisión más delicada (pregunta 2): las cuentas
individuales existen ([docs/19](../desarrollo/19-cuentas-y-organizaciones.md)), pero el núcleo exige que todo
proceso tenga organización responsable.

**Datos mínimos propuestos.**
- Identidad: nombre, descripción, contacto público (correo, teléfono, sitio, redes).
- Territorio: nivel de cobertura, departamento, municipio, dirección y coordenadas.
- Oficio, **en listas y no en texto libre**: tipo de taller (construcción, reparación, restauración,
  formación, mixto), familias de instrumentos y saberes tradicionales (catálogos propios), materiales
  y técnicas si la dirección los quiere publicar.
- Modalidad: taller fijo, itinerante o colectivo; si recibe aprendices.
- Reutilizados: prácticas musicales, territorios sonoros, aliados, archivos (fotos del taller).

**Ciclo y publicación.** El del núcleo. Revisión institucional del taller; los procesos, si existen,
**sin revisión propia** como las ediciones de Mercados (el control está en la puerta de entrada).

**Qué se reutiliza.** Todo el núcleo de §25.2. **Qué es nuevo.** Los dos catálogos (oficios, familias de
instrumentos), el modelo de «procesos» si se confirma, la ficha y el directorio con sus filtros por
oficio e instrumento.

**Modelo recomendado.** Primero el **taller** como único agregado (Fase 1). Los procesos de lutería
—una jornada de construcción colectiva, un ciclo de formación— se anuncian por **eventos de la
Agenda** con un `Tipo` nuevo. Un subregistro «proceso» análogo a la edición solo se añade (Fase 2) si la
dirección lo confirma, porque abarata el primer módulo y no cierra el segundo.

**Esfuerzo.** Fase 1: **M**. Fase 2 (procesos como subregistro): **S–M**.

**Riesgos.** Taxonomía sin fuente oficial (oficios, instrumentos, saberes): el riesgo de publicar un
catálogo que luego haya que rehacer; el lutier sin organización; confusión con Escuelas si el taller
también forma.

### Escenarios, espacios para música en vivo

**Qué es.** Salas, teatros, casas de cultura y otros lugares donde se hace música en vivo. Era el sexto
proceso y el único «sin absolutamente nada» (`V20260825_05`).

**Quién lo gestiona.** La organización que administra el espacio.

**Datos mínimos propuestos** (ya razonados en el diseño del 25 de agosto de 2026): tipo de escenario,
descripción, contacto, territorio y dirección con coordenadas, **aforo**, **accesibilidad como dato de
tres estados** (sí, no, no consta: un `bit NOT NULL` afirmaría que ningún escenario es accesible) y
**dotación**.

**Ciclo.** El del núcleo, sin subregistros.

**Qué se reutiliza.** Todo §25.2. **Qué es nuevo.** Los tres campos propios y la ficha. Es el módulo de
**menor incertidumbre**: su modelo ya estaba pensado y no depende de catálogos externos.

**Valor añadido.** Un escenario puede ser el **lugar** de un evento de la Agenda y de una edición de
Festival o Mercado, lo que enlaza con el piloto de agendamiento de mercados.

**Esfuerzo.** **M** (menos que Mercados: no tiene ediciones).

**Riesgos.** El nombre público: la tarea dice «espacios para música en vivo», el producto decía
«Escenarios» (pregunta 8); superposición con locales que ya aparecen como «lugar» libre en eventos;
publicar la dirección de un espacio que sea también una vivienda.

### Escuelas de música

**Qué es.** Escuelas y procesos formativos. Es el más cercano a la política del Estado: el Plan nació de
la consolidación de las Escuelas Municipales de Música, y es probable que existan registros oficiales de
ellas fuera de SIMUS (hay que confirmarlo con la dirección).

**Quién lo gestiona.** La organización que la administra (escuela municipal, fundación, academia).

**Datos mínimos propuestos.** Naturaleza (oficial, privada, comunitaria), niveles y énfasis, oferta de
programas, territorio, y **capacidad** (estudiantes, docentes, instrumentos, conectividad): son las cifras
que el mapa ya sabía leer antes del retiro.

**Esfuerzo.** **M–L**: es el de más datos y el que más probablemente exija **importación** de datos
oficiales, no solo alta manual.

**Riesgos.** Duplicar un registro oficial que ya existe en otro sistema; cifras de capacidad que se
desactualizan; datos de menores si se publican nóminas. **Decisión previa obligatoria:** implementar,
integrar o mantener fuera (pregunta 4). Sin ella no debe abrirse una tarea de implementación.

### Redes y documentación

**Qué es.** Organizaciones y nodos de investigación, archivo y documentación musical.

**Quién lo gestiona.** La organización responsable de la red o el archivo.

**Datos mínimos propuestos.** Tipo de nodo, acervos o colecciones, formas de acceso y consulta, formatos,
territorio de referencia y contacto.

**Esfuerzo.** **S–M** si se resuelve como un **tipo de organización** con ficha ampliada; **M** si es un
proceso con circuito propio.

**Riesgos.** **Solapamiento con el Catálogo Editorial** (que ya cataloga publicaciones y fuentes) y con
Organizaciones: puede que no requiera un módulo, sino un tipo y una relación. Es el candidato más claro a
«no construir» y resolver con lo existente (pregunta 5).

## 25.5 Orden recomendado y qué cabe en esta entrega

El MVP de noviembre 2026 está a semanas. Un módulo con circuito completo, web incluida, es
**un lote grande**; dos en paralelo son posibles solo si el modelo de cada uno ya está decidido.

| Paso | Qué | Esfuerzo | ¿Esta entrega? |
| --- | --- | --- | --- |
| 0 | Cerrar los cuatro restos de §25.1 (capas del mapa, enlace a `/ecosistema/escuelas`, listas y contrato) | S | **Sí, antes de cualquier módulo** |
| 1 | Decisiones de §25.6 (modelo de lutería, lutier independiente, catálogos) | — | **Sí: bloquea todo lo demás** |
| 2 | **Lutería, Fase 1 (taller)** como módulo piloto, a mano y con la estructura de Mercados | M | **Sí, un módulo** |
| 3 | **Escenarios**, en paralelo o inmediatamente después | M | Solo si el paso 1 quedó resuelto y hay capacidad |
| 4 | Evaluar la extracción de lo común (formulario declarativo) con dos módulos nuevos construidos | S | Después |
| 5 | Lutería Fase 2 (procesos), si se confirma | S–M | Después |
| 6 | Redes y documentación, como módulo propio | M | **Hecho el 10 nov 2026 (§25.9)**, con el patrón de Lutería |
| 7 | Escuelas | M–L | Después, y solo con decisión de integración |

**Por qué Lutería primero.** La dirección la nombró, y construirla fuerza el patrón completo con un
dominio distinto al de los eventos. **Por qué Escenarios como respaldo.** Si el catálogo de oficios e
instrumentos no se decide a tiempo, Escenarios no depende de ninguna taxonomía y puede ocupar su lugar
sin perder la entrega.

**Qué no cabe y por qué.** Escuelas necesita una decisión de integración que no es técnica; Redes puede
resultar innecesario como módulo; y construir tres módulos a la vez repetiría Mercados tres veces sin
haber confirmado el patrón.

## 25.6 Preguntas para la dirección

Cada una trae la recomendación que se propone.

1. **Lutería: ¿uno o dos registros?** Un taller como único agregado, con los procesos como eventos de la
   Agenda (recomendado); un taller con procesos como subregistro; o dos módulos independientes.
2. **¿Puede un lutier independiente registrar su taller sin organización?** Recomendado: **no**; que cree
   una organización (aunque sea unipersonal), para no abrir una excepción al núcleo. La alternativa exige
   decidir quién revisa, quién reclama y qué pasa si la persona deja la cuenta.
3. **Oficios, familias de instrumentos y saberes: ¿qué fuente y quién los aprueba?** Sin un catálogo
   aprobado no se debe publicar ninguno; puede arrancar con un conjunto corto y ampliarse.
4. **Escuelas: ¿implementar en SIMUS, integrar desde otro sistema o mantener fuera?**
5. **Redes y documentación: ¿módulo propio o tipo de organización con ficha ampliada?** Recomendado lo
   segundo, y revisar el solapamiento con el Catálogo Editorial.
6. **¿Los procesos o ediciones de los módulos nuevos pasan por revisión institucional?** Recomendado: no,
   como en Mercados; el control está en la entrada del registro.
7. **¿Cuántos módulos nuevos en esta entrega?** Recomendado: uno (Lutería), y Escenarios solo si hay
   capacidad y decisiones resueltas.
8. **Nombre público de Escenarios:** «Escenarios» o «Espacios para música en vivo».
9. **¿Se cierran ahora los restos del paso 0** (capas del mapa en «Activo», enlace a una ruta
   inexistente, listas y contrato que prometen lo que no hay)? Recomendado: sí, como cambio aparte.

## 25.7 Estado de Lutería, Fase 1 (10 nov 2026)

La dirección decidió el 10 de noviembre de 2026: el **taller** es lo que se registra; sus procesos
(talleres, clases, ventas) son eventos de la Agenda; un **lutier independiente puede registrarlo sin
organización**; los módulos nuevos **no pasan por revisión por campos**; no hay origen de la madera ni
validación de saberes; Escuelas queda fuera. Decisión 27 de [docs/20](20-decisiones-y-flujos-por-modulo.md).

**Lo construido**, siguiendo la lista de verificación de §25.3:

| Capa | Qué hay |
| --- | --- |
| Base | `V20261110_50` (talleres, servicios, familias, relaciones; un solo responsable por `CHECK`; territorio con la misma foránea a DIVIPOLA) y `V20261110_51` (vocabularios propuestos de [docs/27](27-fuentes-de-luteria.md)) |
| API | `TalleresEndpoints`: lectura pública, alta y edición del responsable (organización o persona), envío, retiro, y decisión de la consola con motivo; registro de cambios por campo y bitácora con el contrato único (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md) |
| Panel | `/gestion/o/{id}/procesos/luteria` y `/gestion/cuenta/talleres`: lista, ficha y alta en una sola pantalla; el cambio de fondo en un taller publicado se avisa antes de guardar |
| Consola | `/administracion/talleres`: lista con filtros y ficha por URL; publicar, pedir ajustes, rechazar y retirar con el diálogo de confirmación común; el aviso de «taller recibido» abre la ficha |
| Portal | `/ecosistema/luteria` y su ficha; **no lleva el nombre de la persona**; capa «Lutería» en el mapa; el Inicio del Ecosistema la cuenta |
| Permisos y avisos | Módulo de consola `talleres`; avisos al Programa y al responsable (organización o persona) |
| Pruebas | API (SQLite y SQL Server), Karma y el recorrido `@backend` `e2e/luteria-recorrido-del-taller.spec.ts` |
| Demostración | Cinco talleres en todos los estados, uno de ellos de un lutier independiente (`scripts/demo/sembrar-demo.sh completa`) |

**Pendiente (no cabía sin dejarlo a medias).**

1. ~~**Eventos de los procesos del taller.**~~ **Hecho el 15 nov 2026** (LUT-01, decisión 104 de [docs/20](20-decisiones-y-flujos-por-modulo.md),
): el taller publicado enmarca eventos de la Agenda normal (`TallerId`, migración `V20261115_10`), también el del lutier
   independiente desde «Mi espacio → Mis eventos», con la misma regla de errata, retiro y cancelación.
2. ~~**Historial para el lutier independiente.**~~ **Hecho** (LUT-02): `/externo/mis-registros/historial/…` sirve la misma línea de tiempo a la persona
   que responde por el taller, el espacio, la red o el evento.
3. **Fotos del taller** (Banco de archivos), **propuestas de cambio** con revisión, **consulta guiada**
   e **importación asistida**: no se construyeron; una errata se corrige al instante y un cambio de
   fondo vuelve a revisión.
4. **Bandeja de Solicitudes.** El taller en revisión llega por aviso y por su lista en la consola; no
   está aún en la bandeja unificada de «Solicitudes y revisiones».
5. **Aprobación de los vocabularios** por el Plan Nacional de Música para la Convivencia y
   **instrumentos tradicionales regionales**, que esperan fuente ([docs/27](27-fuentes-de-luteria.md)).

## 25.8 Estado de Espacios para música en vivo (10 nov 2026)

La dirección decidió el 10 de noviembre de 2026: el **espacio** (bar, sala, teatro, casa de cultura, escenario al
aire libre) es lo que se registra; lo que ocurre dentro son eventos de la Agenda; una **persona responsable
independiente puede registrarlo sin organización**; los módulos nuevos no pasan por revisión por campos;
el nombre público es «Espacios para música en vivo»; Escuelas queda fuera. Decisiones 34 y 35 de
[docs/20](20-decisiones-y-flujos-por-modulo.md). Se construyó clonando el patrón de Lutería (§25.7).

**Lo construido**, siguiendo la lista de verificación de §25.3:

| Capa | Qué hay |
| --- | --- |
| Base | `V20261110_80` (espacios, relaciones con tipos, equipamiento y prácticas musicales; un solo responsable por `CHECK`; aforo positivo; accesibilidad de tres estados; territorio con la misma foránea a DIVIPOLA) y `V20261110_81` (vocabularios propuestos: ocho tipos de espacio y seis elementos de equipamiento) |
| API | `EspaciosEndpoints`: lectura pública, alta y edición del responsable (organización o persona), envío, retiro y decisión de la consola con motivo; registro de cambios por campo y bitácora con contrato único; módulo de consola `espacios` |
| Panel | `/gestion/o/{id}/procesos/espacios` y `/gestion/cuenta/espacios`: lista, ficha y alta en una sola pantalla; el cambio de fondo en un espacio publicado se avisa antes de guardar |
| Consola | `/administracion/espacios`: lista con filtros y ficha por URL; publicar, pedir ajustes, rechazar y retirar con el diálogo de confirmación común |
| Portal | `/ecosistema/espacios` y su ficha (no lleva el nombre de la persona); capa «Espacios» en el mapa; el Inicio del Ecosistema la cuenta; entrada «Disponible» en `categorias-ecosistema.config.ts` |
| Pruebas | API (SQLite y SQL Server), Karma y el recorrido `@backend` `e2e/espacios-recorrido-del-espacio.spec.ts` |
| Demostración | Cinco espacios en distintos estados, uno de ellos de una responsable independiente (`scripts/demo/sembrar-demo.sh completa`) |

**Decisiones conservadoras tomadas** (se dejaron como pregunta en el PR): el espacio está siempre en un municipio;
el aforo es opcional; la accesibilidad tiene tres estados (sí, no o no consta) para no afirmar lo que no se sabe;
el equipamiento es opcional y el tipo, no; la dirección hace falta para enviarlo a revisión.

**Pendiente (no cabía sin dejarlo a medias).**

1. ~~**Eventos del espacio en la Agenda.**~~ **Hecho el 15 nov 2026** (LUT-01, decisión 104): `EspacioId` en `dbo.EventosAgenda` y el camino de la
   persona responsable independiente («Mi espacio → Mis eventos»).
2. **Coordenadas y dirección en el mapa.** El mapa sitúa el espacio por su municipio; no hay coordenadas.
3. ~~**Historial para la persona responsable independiente.**~~ **Hecho** (LUT-02), igual que en Lutería.
4. **Fotos del espacio**, **propuestas de cambio**, **consulta guiada** e **importación asistida**.
5. **Bandeja de Solicitudes.** El espacio en revisión llega por aviso y por su lista en la consola.
6. **Aprobación de los vocabularios** por el Plan Nacional de Música para la Convivencia.

## 25.9 Estado de Redes y documentación, Fase 1 (10 nov 2026)

La dirección decidió el 10 de noviembre de 2026: Redes y documentación es un **módulo propio**, no un
tipo de organización; sus procesos no pasan por revisión institucional; el registro de la red sigue el
circuito de Festivales, Mercados y Lutería; Escuelas queda fuera. Decisiones 61 y 62 de
[docs/20](20-decisiones-y-flujos-por-modulo.md). Es el segundo módulo construido con el patrón de
[§25.3](#253-patrón-de-nuevo-módulo) tras Lutería, que sirvió de molde.

**Qué es una «red»** (la decisión más conservadora donde el documento era ambiguo, abierta como pregunta
en el PR): un nodo de investigación, archivo y documentación musical. Se registra **qué acervos tiene y
cómo se consultan**, no cada documento: eso es el Catálogo Editorial y duplicarlo era el riesgo que
señalaba §25.4. Los acervos son texto libre; el tipo de nodo (red, centro de documentación, archivo,
colección o grupo de investigación), las formas de acceso y los formatos de documentación son listas.

**Lo construido:**

| Capa | Qué hay |
| --- | --- |
| Base | `V20261110_70` (redes, formas de acceso, formatos y relaciones; un solo responsable por `CHECK`; territorio con la misma foránea a DIVIPOLA) y `V20261110_71` (vocabularios propuestos) |
| API | `RedesEndpoints`: lectura pública, alta y edición del responsable (organización o persona), envío, retiro y decisión de la consola con motivo; registro de cambios por campo y bitácora con el contrato único (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md) |
| Panel | `/gestion/o/{id}/procesos/redes` y `/gestion/cuenta/redes`: lista, ficha y alta; el cambio de fondo en una red publicada se avisa antes de guardar |
| Consola | `/administracion/redes`: lista con filtros y ficha por URL; publicar, pedir ajustes, rechazar y retirar con el diálogo de confirmación común; el aviso de «red recibida» abre la ficha |
| Portal | `/ecosistema/redes` y su ficha; **no lleva el nombre de la persona**; capa «Redes doc.» en el mapa; el Inicio del Ecosistema la cuenta |
| Permisos y avisos | Módulo de consola `redes`; avisos al Programa y al responsable |
| Pruebas | API (SQLite y SQL Server), Karma y el recorrido `@backend` `e2e/redes-recorrido-de-la-red.spec.ts` |
| Demostración | Cinco redes en todos los estados, una de ellas de una persona sin organización (`scripts/demo/sembrar-demo.sh completa`) |

**Pendiente (no cabía sin dejarlo a medias), igual que en Lutería.**

1. ~~**Eventos de la red en la Agenda.**~~ **Hecho el 15 nov 2026** (LUT-01, decisión 104): `RedId` en `dbo.EventosAgenda` y el camino de la persona sin
   organización («Mi espacio → Mis eventos»).
2. ~~**Historial para la persona sin organización.**~~ **Hecho** (LUT-02), igual que en Lutería.
3. **Fotos de la red** (Banco de archivos), **propuestas de cambio**, **consulta guiada** e **importación asistida**.
4. **Bandeja de Solicitudes.** La red en revisión llega por aviso y por su lista en la consola.
5. **Aprobación de los vocabularios** por el Plan Nacional de Música para la Convivencia. Las formas de acceso y
   los formatos son una propuesta técnica, sin fuente oficial.
6. **Relación con el Catálogo Editorial:** enlazar una red con las fichas editoriales que custodia.
## 25.10 Las herramientas no son un proceso: la agenda de citas (11 nov 2026)

El apartado «Herramientas» (docs/referencia/26-agenda-de-citas-y-mercados.md) **no es un séptimo proceso del Ecosistema**: no tiene ficha pública, no pasa por
revisión y no se registra como un Festival o un Taller. Es una capacidad que una organización habilita sobre una
edición de su Mercado. La primera, la **agenda de citas entre artistas y compradores o bookers**, quedó construida en
el lote AGE: cuatro tablas, API, panel de la organización, espacio de la persona, lista pública sin personas y
siembra de demostración. Lo que quedó fuera, y por qué, está en [docs/26](26-agenda-de-citas-y-mercados.md) §26.12.
Decisiones 56 a 58 de [docs/20](20-decisiones-y-flujos-por-modulo.md).
