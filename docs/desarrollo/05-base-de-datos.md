# 5. Base de datos

El motor es **SQL Server**, y el modelo está escrito íntegramente en español: tablas, columnas y
restricciones. Hay dos líneas de migraciones, una por base:

- la base propia de la plataforma, administrada con **DbUp** a través de `SIMUS.Migrador`
  (`simus-database/schema/`);
- la base **SIMUS del Ministerio**, administrada con **Flyway** (`simus-database/simus-ministerio/`),
  que lleva el módulo de Festivales heredado al mismo modelo. Se describe en el apartado 5.5.

Las dos producen la misma estructura en las tablas que comparten, y
`scripts/validacion/validar-simus-ministerio.sh --comparar-con-desarrollo` lo comprueba.

**Cifras del esquema (corte del 23 de noviembre de 2026, `main` en `48f36810`).** Aplicando en orden los 171 guiones de
`simus-database/schema/` sobre una base desechable resultan **161 tablas** en el esquema `dbo` (las columnas, claves foráneas y restricciones CHECK
se recuentan con el diccionario de datos; las cifras del 20 de noviembre —1 400, 211 y 251— están desfasadas), sin fallas. **`PerfilesPublicosFestival` y sus ocho
hijas ya no existen** (retiro en `V20261120_10`, decisión 152). El detalle tabla por tabla, el modelo
entidad-relación y las filas que siembra cada guion se regeneran con el diccionario de datos del equipo; las cifras de
arriba se recomprueban con ese mismo procedimiento, no a mano.

## 5.1 Migraciones

El esquema se modifica exclusivamente mediante archivos nuevos en
`simus-database/schema/`. `SIMUS.Migrador` descubre los guiones, los ordena por nombre y
registra cada aplicación en `dbo.SchemaVersions`.

```bash
export SIMUS_MIGRADOR_CONEXION='Server=...;Database=...;...'
dotnet run --project simus-api/src/SIMUS.Migrador -- estado
dotnet run --project simus-api/src/SIMUS.Migrador -- migrar
```

`baseline` solo marca guiones como aplicados y se reserva para incorporar una base
preexistente cuyo esquema ya fue comprobado. No debe usarse en una base nueva.

La orden local equivalente es:

```bash
./scripts/local/schema-local.sh estado
./scripts/local/schema-local.sh migrar
```

Las semillas se mantienen separadas. `seed-local-db.sh` aplica el esquema con DbUp antes
de cargar las semillas autorizadas. Los archivos de demostración no deben ejecutarse en
producción sin una decisión explícita y revisión de su contenido.

### Inventario repetible del esquema

`./scripts/documentos/inventariar-esquema.sh generar --etiqueta antes-de-algo` lee la base local y escribe en
`tmp/inventarios/<etiqueta>/` un `inventario.json` (tablas, columnas, índices, claves foráneas,
restricciones CHECK, vistas, rutinas y migraciones aplicadas) y un `resumen.md`. Después de migrar,
se genera otro y `./scripts/documentos/inventariar-esquema.sh comparar antes.json despues.json` dice con exactitud
qué cambió (sale con código 1 si hay diferencias). Se usa antes y después de cada tanda de catálogos y de
cada ola de convergencia. Necesita `sqlcmd` y el mismo `.env` que los demás guiones.

## 5.2 El patrón común del modelo

Tres decisiones estructurales se repiten en todos los módulos y conviene conocerlas antes de leer
cualquier tabla concreta.

**Un registro se identifica con el par «módulo + identificador».** Las tablas que guardan lo que un
registro tiene *de varios* —localizaciones, prácticas musicales, archivos, aliados— no cuelgan de una
tabla concreta: guardan `ModuloId` y `RegistroId`. Lo mismo hacen la revisión institucional, las
propuestas de cambio, la procedencia y la bitácora de auditoría. Por eso incorporar un proceso nuevo
al Ecosistema no exige crear tablas de relación propias.

**Los vocabularios son cerrados y viven en catálogos.** Ningún campo con vocabulario controlado se
guarda como texto libre. Cuando un valor no está en la lista, el registro admite un campo «otra»
junto al catálogo, en vez de abrir el vocabulario.

**El territorio tiene una sola fuente.** Departamentos y municipios se leen de `Divipola`, con
codificación oficial del DANE. Ninguna tabla mantiene su propia lista territorial.

## 5.3 El modelo de organizaciones, procesos y ediciones

El módulo de Festivales registra los festivales de música del país, sus realizaciones anuales y el
circuito por el que pasan desde que se registran hasta que se publican.

### Las tres entidades

**`Festivales`** es la entidad permanente: el festival como tal, que existe año tras año. Guarda su
nombre, descripción, periodicidad, ámbito territorial —nivel de cobertura, departamento y
municipio—, los datos de contacto del festival y de su organizador, la organización responsable y el
estado del registro.

**`EdicionesFestival`** es cada realización concreta. Pertenece a un festival y añade lo que cambia
de una a otra: el año y el número de edición, las fechas de inicio y fin, la tipología, las fuentes
de financiación primaria y secundaria, si usa estampilla Procultura, el director y las prácticas
musicales que congrega.

**Lo publicado de un Festival es su cabecera.** La tabla `PerfilesPublicosFestival` (antes `VersionesFestival`)
**se retiró** (decisiones 139 a 153 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`): el portal lee `dbo.Festivales` y sus listas, igual que lee
`Mercados`, `Talleres`, `Espacios` y `Redes`, y una propuesta de cambio aprobada escribe esa cabecera por el
circuito común de propuestas. La cabecera guarda también los cinco datos del organizador (`Director`,
`TipoOrganizadorId`, `OtroTipoOrganizador`, `PerteneceAOrganizacionColectiva`, `NombreOrganizacionColectiva`).
**No es historia:** «versión de Festival» dejó de existir como concepto el 10 de noviembre de 2026; la historia
—qué cambió y quién lo cambió— vive en `CambiosDeRegistro` (abajo), y la migración `V20261110_12` pasó a esa tabla
lo que las versiones ya contaban. Las filas hijas con módulo `perfiles-publicos-festival` desaparecieron con la
tabla y ese módulo ya no es admisible. Las copias de seguridad del retiro viven en el esquema `respaldo` (tablas
`respaldo.*` con sufijo de fecha) hasta que se retiren (`docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md`, «Estado final del retiro»). Quedan sin clave
foránea, como referencias lógicas de historia, `CambiosDeRegistro.PerfilPublicoFestivalId` y
`PropuestasDeCambio.SubregistroId` y `SubregistroResultanteId`.

**`CambiosDeRegistro`** (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md) guarda una fila por campo que cambia en un registro: `ModuloId` y
`RegistroId` identifican al dueño, `CampoId` y `CampoEtiqueta` el campo, `ClaseDato` (`publico`, `organizacion`, `contacto`,
`identificacion`, `sensible`) quién puede leerlo, `ValorAnterior` y `ValorNuevo` lo que valía y lo que vale (si es un código de catálogo, `NombreAnterior` y
`NombreNuevo` guardan el nombre que tenía ese día: la pantalla lee el nombre),
`Origen` de dónde vino el cambio, y el autor, su rol, el motivo y la fecha. `IdGrupo` junta los campos de un
mismo guardado y `OrganizacionId` copia la organización responsable al escribir. Se llena desde la API en la
misma transacción que el cambio, sin disparadores, y no se borra con el registro. Los datos personales guardan
su valor; solo la consola con el módulo de Auditoría los lee.

La jerarquía no es negociable: **el festival es la entidad principal y la edición es un subelemento
suyo**. Una edición no existe sin su festival.

### Las relaciones del registro

Ocho tablas guardan lo que un registro tiene *de varios*. No cuelgan de una tabla concreta:
identifican a su dueño con el par **`ModuloId` + `RegistroId`**, de modo que sirven a cualquier
proceso del Ecosistema Musical sin duplicarse.

| Tabla | Qué guarda |
|---|---|
| `LocalizacionesDeRegistro` | dónde ocurre: departamento, municipio, zona urbana o rural y titulación colectiva |
| `PracticasMusicalesDeRegistro` | las prácticas musicales que congrega |
| `ExpresionesArtisticasDeRegistro` | las expresiones artísticas que incluye |
| `ModalidadesParticipacionDeRegistro` | cómo se participa en él |
| `TiposIngresoDeRegistro` | cómo se accede: entrada libre, gratuita con boletería, boletería paga o sin público |
| `TerritoriosSonorosDeRegistro` | los territorios sonoros con que se relaciona |
| `EntidadesAliadasDeRegistro` | las organizaciones aliadas |
| `ArchivosDeRegistro` | los materiales: imágenes, documentos y su ficha |

### Los catálogos

> **Por qué cada catálogo es como es** —decisiones, alternativas consideradas y fuentes— está en [`catalogos-decisiones-y-fuentes.md`](../referencia/31-catalogos-decisiones-y-fuentes.md). Se actualiza con cada cambio de un catálogo.

Los vocabularios son cerrados y viven en tablas propias, no como texto libre: `TipologiasFestival`,
`FuentesFinanciacion`, `TiposOrganizador`, `NaturalezasEntidad`, `ExpresionesArtisticas`,
`ModalidadesParticipacion`, `PracticasMusicales`, `TiposIngreso`, `TerritoriosSonoros`,
`RegionesOcad`, `ZonasUrbanoRural` y `TitulacionesColectivas`.

Cuando un valor no está en la lista, el registro admite un campo «otra» junto al catálogo
—`OtraTipologia`, `OtraFuenteFinanciacionPrimaria`, `OtraModalidadParticipacion`— en vez de abrir el
vocabulario.

El territorio no tiene catálogo propio: se lee de `Divipola`, que es la fuente única de
departamentos y municipios del sistema. La **región OCAD** tampoco se captura: se deriva del
departamento de cada localización mediante `DepartamentosRegionOcad`, que asigna cada uno de los 33
departamentos a una de las seis regiones del Sistema General de Regalías.
Para revisarla a ojo existe la vista `VistaDepartamentosPorRegionOcad` (región, código y nombre del
departamento). Un departamento está en **una sola** región: la clave primaria de la tabla lo impide.
El reparto sigue la Ley 2056 de 2020, art. 45, y las regiones llevan sus nombres oficiales
(«Centro Sur Amazonía» y «Llanos»).

`ZonasUrbanoRural` sigue las tres **clases** del territorio del DANE (cabecera municipal, centro
poblado y rural disperso). Los tipos de documento toman sus rótulos del RUT de la DIAN; la naturaleza de la entidad
(pública, privada, mixta) coincide con la casilla 62 del RUT y no lleva descripción.

**Idiomas.** El modelo operativo aprobado conserva dos tablas: `Idiomas` y `PublicacionesEditorialesIdiomas`. El catálogo tiene seis columnas: `CodigoIdioma`, `NombreIdioma`, `CodigoIso6391`, `Verificacion`, `Descripcion` y `Activo`. Los códigos son claves internas; el formulario muestra una lista de nombres con búsqueda, sin categorías. Las publicaciones guardan uno o varios idiomas en la relación y conservan el orden. Los nombres alternativos y sus fuentes se documentan en el anexo v05, fuera de las tablas operativas. La importación conserva y señala los términos desconocidos para revisión, sin descartarlos. La migración `V20261009_01` pasó dos ejecuciones en una copia SQL Server 2022. Código y base deben desplegarse juntos; el despliegue institucional sigue pendiente. El corte documental contiene 266 idiomas, confirmados por exportación real.

**Catálogos demográficos.** `Sexos`, `IdentidadesGenero`, `OrientacionesSexuales`,
`PertenenciasEtnicas`, `TiposDiscapacidad` y `EnfoquesDiferenciales` son listas de valores (clave: su código `Codigo<X>`) con su
fuente en la descripción (Guía del DANE V2 2026, Resolución 1197 de 2024). **Ninguna tabla las
referencia todavía ni hay formulario que las capture**: son datos sensibles (Ley 1581) y cada
captura exigirá su finalidad y consentimiento. `Barrismo social` está sembrado inactivo.

`TerritoriosSonoros` y `PracticasMusicales` son catálogos **transversales**: no pertenecen a
Festivales, y cualquier módulo los enlaza por su tabla «…DeRegistro». Cada valor tiene además una
ficha conceptual (`FichasConceptualesTerritoriosSonoros`, `FichasConceptualesPracticasMusicales`).

### El ciclo de vida

Festival y edición guardan su estado editorial en `EstadoRegistro`, y la base solo admite
estos valores:

| Estado | Qué significa |
|---|---|
| `borrador` | en elaboración, visible solo para quien lo registra |
| `en_revision` | enviado para revisión institucional |
| `ajustes_solicitados` | devuelto al responsable con observaciones |
| `aprobado` | aprobado sin publicar todavía; no es un paso obligatorio |
| `publicado` | visible en el portal |
| `rechazado` | revisado y no aprobado |
| `archivado` | retirado de la vista pública sin eliminarlo |

Las ediciones tienen además dos ejes separados. **`Estado`** dice en qué punto está la realización
—`en_preparacion`, `programada`, `realizada` o `cancelada`—, y **`EstadoVisibilidad`** dice si se
muestra —`borrador`, `publicada` o `archivada`—. Son cosas distintas y no se mezclan: una edición ya
realizada puede seguir publicada.

El vocabulario completo de estados del sistema está en `EstadosContenido`, con su código, su nombre
y su descripción.

### La revisión institucional

Cuando un registro se envía a revisión, `EnviosDeRevision` guarda el envío y `RevisionesDeRegistro`
la revisión que abre el equipo. Las observaciones se registran **por sección y por campo** en
`RevisionesDeRegistroObservaciones`, de manera que quien recibe la devolución sabe exactamente qué
corregir y dónde.

La revisión termina en aprobación, que publica el registro, o en devolución con ajustes solicitados.

### Las propuestas de cambio

Sobre un registro **ya publicado** no se edita directamente: se propone. `PropuestasDeCambio` guarda
la propuesta y `PropuestasDeCambioCampos` el detalle campo por campo, con el valor anterior y el
propuesto. El equipo acepta o rechaza cada campo, y solo lo aceptado se aplica al registro público.

Esa es la diferencia entre **corregir** —un registro en borrador, que su responsable edita— y
**proponer** —un registro publicado, cuyo cambio pasa por revisión—.

### Procedencia y trazabilidad

Cada registro guarda en `ProcedenciasDeRegistro` de dónde viene, separando tres cosas que no se
confunden:

- **el contexto de origen**, que dice si lo incorporó el equipo desde la consola o lo registró una
  organización desde el espacio externo;
- **la organización de procedencia**, la entidad que lo incorporó al sistema;
- **la cuenta que ejecutó la acción**, con su fecha.

La organización responsable de un festival —quien lo desarrolla— es un dato distinto, y vive en
`OrganizacionPrincipalId`, sobre la propia tabla `Festivales`.

`FestivalesReferenciasHistoricas` vincula un festival con las organizaciones que lo tenían
registrado en la información histórica incorporada.


## 5.4 Semillas

Las semillas viven en `simus-database/seed/` y se aplican después del esquema. Distinguen dos cosas
que no deben mezclarse: los **catálogos institucionales**, que forman parte del sistema, y los
**datos de demostración**, que no deben ejecutarse en un ambiente servido sin decisión expresa.

## 5.5 La base SIMUS del Ministerio

La base SIMUS del Ministerio tenía su propio módulo de Festivales: 22 tablas `ART_MUS_*` con una sola
tabla ancha por versión, catálogos locales y campos de texto libre. `simus-database/simus-ministerio/`
es la línea de migraciones **Flyway** que lleva esa base al modelo descrito en este capítulo, sin
tocar las tablas heredadas.

| Migración | Tipo | Contenido |
|---|---|---|
| `V1__estado_inicial_simus` | estructura y catálogos | Las 22 tablas `ART_MUS_*` tal como existen en SIMUS. En la base del Ministerio no se ejecuta: se registra como línea base. |
| `V2__maestras_transversales` | estructura | Estados, tipos de documento, DIVIPOLA, usuarios, organizaciones, archivos, procedencia y `CorrespondenciasHeredadas`. |
| `V3__catalogos_transversales` | estructura | Territorios sonoros y prácticas musicales con sus fichas, regiones OCAD, zonas, titulaciones y naturalezas. |
| `V4__divipola` | datos | DIVIPOLA del DANE, MGN 2025: 33 departamentos y 1 122 municipios. |
| `V5__datos_maestros_transversales` | datos | Estados, tipos de documento, entidad institucional, catálogos transversales y su correspondencia con los heredados. |
| `V6__modulo_festivales` | estructura | Catálogos de Festivales, festival, versión, edición, relaciones del registro y ciclo de revisión. |
| `V7__catalogos_festivales` | datos | Tipologías, expresiones, fuentes, modalidades, tipos de ingreso y de organizador, con su correspondencia. |
| `V8__traslado_de_festivales_heredados` | procedimiento | La lista `TrasladosHeredadosFestival` y el procedimiento `TrasladarFestivalesHeredados`. No traslada nada por sí misma. |
| `V9__periodicidades_como_catalogo` | estructura | La lista `Periodicidades` enlazada por clave foránea a las columnas de texto que guardan la periodicidad de un festival o un mercado; no cambia el tipo ni el contenido de esas columnas. |

**Los identificadores heredados no se reutilizan.** Cada catálogo nuevo se carga con sus propios
identificadores y el par «identificador heredado → identificador nuevo» queda en
`CorrespondenciasHeredadas`, que es también la tabla que usa el traslado.

**Los registros heredados se trasladan solo cuando se piden.** Los festivales que hoy contiene
`ART_MUS_FESTIVALES` son de prueba y no se incorporan. Para trasladar un festival real se inscribe
su identificador en `TrasladosHeredadosFestival` y se ejecuta `dbo.TrasladarFestivalesHeredados`.
El detalle de lo que hace con cada campo está en `simus-database/simus-ministerio/README.md`.

## 5.6 Versión del esquema y versión del producto

Son dos numeraciones distintas y no se derivan una de otra. La **versión del esquema** es la última
migración aplicada a una base —`V20261120_10` en la cadena DbUp, `9` en la línea Flyway— y solo dice
qué transformaciones ha recibido esa base. La **versión del producto** sigue SemVer en
`CHANGELOG.md` y dice qué puede hacer el sistema y si un cambio rompe la compatibilidad.

Se relacionan en un solo sentido: cada entrada del `CHANGELOG.md` que cambia la base indica la
migración mínima que exige en cada línea. Que Flyway llegue a `V2` no significa que el producto sea
la 2.0.0.


**Clasificación editorial (2026-10-09).** Categorias incorpora CategoriaPadreId; PublicacionesEditoriales reutiliza CategoriaId e incorpora SubcategoriaEditorialId. Jerarquía editorial de dos niveles: 9 categorías principales y 20 subcategorías. La API exige raíz editorial y subcategoría del mismo padre; la FK compuesta protege el parentesco. Ruta y nombres actuales se calculan en lectura; los textos originales se conservan como referencia administrativa. 171 fichas conservadas, 170 con categoría y 70 con subcategoría explícita; 143 vínculos de prácticas en 126 fichas. Tipología (798 vínculos) e idiomas (178) intactos. Migración interna V20261009_03; la recarga vigente excluye la semilla editorial V20261009_02 que restablecía el catálogo. V20261009_03 de seed no modifica categorías editoriales; V20261009_04 clasifica únicamente las fichas recién insertadas. V20261009_05 utiliza ProcedenciasDeRegistro.ModuloId vigente. Integración institucional y decisiones editoriales ambiguas pendientes.
