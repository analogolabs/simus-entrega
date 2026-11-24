# 13. Núcleo reutilizable de procesos y trazabilidad

**Decisión:** un proceso nuevo conserva su modelo y sus reglas de negocio propias, pero adopta el
núcleo transversal ya usado por Festivales y Mercados. No se crea una tabla universal de procesos,
no se fuerzan migraciones de los módulos existentes y no se copian sus circuitos sin declarar las
diferencias.

## 13.1 Contrato mínimo

Todo proceso que una organización pueda registrar debe declarar:

| Aspecto | Contrato reutilizable | Decisión propia del proceso |
|---|---|---|
| Identidad transversal | Un valor único en `Modulos` y el par `ModuloId` + `RegistroId` | La tabla y el tipo de su clave primaria |
| Propiedad | Organización responsable y comprobación con `AdministracionDeOrganizacion.PuedeAdministrarAsync` | Si puede ser institucional, reclamable o transferible |
| Ciclo | `borrador` → `en_revision` → `ajustes_solicitados` → `publicado` → `archivado` | Requisitos de completitud y transiciones que no apliquen |
| Revisión | `RevisionesDeRegistro`, observaciones por campo y `EnviosDeRevision` | Secciones, campos revisables y la instantánea que se conserva |
| Cambios posteriores | `PropuestasDeCambio` y sus campos, sin editar la ficha pública en caliente | Qué campos son directos, qué cambios producen una versión y cuáles requieren propuesta |
| Historia | Procedencia (`ProcedenciasDeRegistro`) y bitácora `RegistrosRevisionHistorial` por módulo y registro | Verbos, metadatos y proyección legible del proceso |
| Relaciones de varios | Tablas `…DeRegistro` con módulo y registro | Qué relaciones, catálogos y subregistros usa realmente |
| Lectura pública | DTO público separado y filtro de publicación | Los campos que el proceso decide hacer públicos |

El identificador transversal no reemplaza la integridad del agregado principal. Cada proceso conserva
sus claves foráneas internas —por ejemplo, una edición pertenece a su Festival—; el par genérico se
usa para la trazabilidad y relaciones que pueden servir a más de un proceso.

## 13.2 Piezas existentes

La base no es una propuesta futura: estas piezas ya están en producción de código y son el punto de
partida obligatorio.

| Necesidad | Pieza |
|---|---|
| Vocabulario de módulos | `SIMUS.Domain.Entities.Modulos` |
| Procedencia | `ProcedenciaDeRegistro` y `ProcedenciasDeRegistro` |
| Envío e instantánea | `EnvioDeRevisionRow` y `EnviosDeRevision` |
| Revisión con observaciones | `RevisionDeRegistroRow` y `RevisionDeRegistroObservacionRow` |
| Cambios sobre lo publicado | `PropuestaDeCambioRow` y `PropuestaDeCambioCampoRow` |
| Bitácora de transición | `HistorialRevisionRegistroRow` (tabla `RegistrosRevisionHistorial`) |
| Localizaciones, catálogos, aliados y archivos | `IRelacionDeRegistro` e `IClasificacionDeRegistro` |

Festivales y Mercados son las dos referencias de implementación. Comparten el núcleo, pero no se
obliga a que tengan el mismo formulario, versión pública ni conjunto de relaciones.

## 13.3 Incorporar un proceso nuevo

1. **Decidir el agregado.** Nombrar su tabla principal, responsable, estados y qué se considera un
   subregistro. Si no hay organización responsable o revisión institucional, no es un proceso de
   este núcleo y no debe simularlo.
2. **Registrar su módulo.** Añadir una constante canónica a `Modulos`, al catálogo de navegación o
   permisos solo si corresponde, y a los conjuntos que deban conocerlo. Nunca introducir el nombre
   como literal repartido.
3. **Definir la proyección.** Crear DTO de gestión y DTO público distintos; listar expresamente los
   campos permitidos en el segundo.
4. **Conectar propiedad y escritura.** Resolver la organización desde el registro y aplicar la
   guarda en cada lectura o cambio externo; la ruta no concede acceso por llevar un identificador.
5. **Implementar el circuito.** Reutilizar las tablas genéricas para envío, revisión, propuesta e
   historial. La validación de completitud y el mapeo de campos son del proceso, no del núcleo.
6. **Añadir solo relaciones necesarias.** Usar `…DeRegistro` cuando la relación ya existe; crear
   una tabla específica únicamente si aporta atributos propios que no caben en la relación común.
7. **Probar límites y trazabilidad.** Comprobar propietario permitido, organización ajena rechazada,
   transición inválida rechazada, contenido no publicado invisible y una historia completa legible.

## 13.4 Límites deliberados

- No hay una supertabla `Procesos`: ocultaría reglas, claves y restricciones que pertenecen al
  dominio concreto.
- No toda entidad versiona igual. Un Festival puede crear una versión pública; un Mercado puede
  aplicar una propuesta sobre su ficha. El núcleo registra el expediente, no impone la estrategia
  de versión.
- No toda relación debe hacerse genérica. La reutilización termina donde se pierden garantías de
  integridad o se vuelve ambiguo el dueño del dato.
- No se modifica el esquema de módulos actuales por adoptar este contrato. Cualquier convergencia
  posterior necesita una tarea propia, inventario antes/después y decisión de migración.

## 13.5 Evidencia de mantenimiento

La incorporación se valida con las pruebas del proceso nuevo y, como mínimo, con los trinquetes ya
existentes para vocabulario de módulos, procedencia, revisión y autorización. Festivales y Mercados
mantienen pruebas de referencia para propiedad, revisión por campos y propuestas de cambio; una
capacidad nueva debe demostrar los mismos límites, no solo su camino exitoso.

## 13.6 Contraste con lo existente

Contraste hecho sobre el código y el esquema vigentes, sin proponer migraciones. «Núcleo» significa
usar las tablas genéricas de §13.2.

| Módulo | Responsable | Estado | Revisión por campos y envío | Historia | Cambio posterior |
|---|---|---|---|---|---|
| Festivales | `OrganizacionPrincipalId`; guarda `AdministracionDeOrganizacion` | Ciclo completo de §13.1 | Núcleo | Núcleo, con instantánea de organización | Versión pública y `PropuestasDeCambio` |
| Ediciones de Festival | Las hereda del Festival: el acceso se resuelve por `FestivalId` | Tres ejes: `EstadoRegistro`, `EstadoVisibilidad` y `Estado` operativo | Núcleo | Núcleo; sus acciones también quedan en `BitacoraAuditoria` | Dentro de su revisión |
| Mercados y sus ediciones | `OrganizacionPrincipalId` (obligatoria) | Ciclo completo; ediciones con eje operativo propio | Núcleo | Núcleo | `PropuestasDeCambio` aplicada a la ficha |
| Organizaciones | Son el dueño, no tienen uno | Propio: `pendiente_de_confirmacion`, `activa`, `inactiva`, `eliminada` | No aplica: no se publican ni se aprueban | Bitácora de auditoría y reclamaciones de administración | Edición directa de quien la administra |
| Catálogo Editorial | Sin organización: lo gestiona la consola | Dos ejes: catalogación y publicación | Sin observaciones por campo; anotaciones en `RegistrosRevisionHistorial` (`docs/referencia/20-decisiones-y-flujos-por-modulo.md` §20.5) | Núcleo (`RegistrosRevisionHistorial`) | `Version` de concurrencia |
| Noticias y Agenda | Sin organización | `borrador`, `en_revision`, `publicado`, `archivado` | No | Solo `BitacoraAuditoria` (auditoría); no escriben `RegistrosRevisionHistorial`. Comparten `Modulos`, procedencia y clasificación | `Version` de concurrencia |
| Textos del sitio (CMS) | Sin organización | Borrador / publicado / retirado | No | `HistorialDeContenidoWeb`: guarda el valor nuevo de cada acción | `Version` de concurrencia |

Lectura del contraste:

- Solo Festivales y Mercados cumplen el contrato completo. Son los únicos con organización
  responsable *y* revisión institucional; es la condición de entrada de §13.3.1.
- El estado de una organización **no es** el ciclo editorial. Forzarlo borraría la diferencia entre
  «tener cuenta verificada» y «tener una ficha aprobada».
- Los contenidos del sitio (noticias, agenda, textos) son del equipo institucional. Adoptan del
  núcleo solo lo que les sirve —vocabulario de módulos, procedencia, clasificación— y no deben
  simular propiedad externa. Su rastro es de auditoría o de valores, no un expediente de revisión.
- Un módulo con más de un eje de estado (ediciones, catálogo) los declara por separado y la
  bitácora dice cuál se movió; no traduce sus palabras al ciclo común.

## 13.7 Reglas universales y reglas por módulo

**Universales** (no negociables para un proceso del núcleo):

1. Identidad: constante en `Modulos` y par `ModuloId` + `RegistroId`; nunca literales sueltos.
2. Propiedad resuelta desde el registro y comprobada en cada lectura o escritura externa.
3. Nace en `borrador`; lo no publicado nunca aparece en lectura pública.
4. Un registro `en_revision` no lo edita su responsable.
5. Lo publicado no se edita en caliente: cambia por versión o propuesta.
6. Lo que llegó a publicarse se archiva, no se borra; solo se elimina un borrador nunca publicado.
7. Cada transición escribe una fila de historia con quién, cuándo, estado anterior y nuevo.
8. Las observaciones de revisión son por campo, no un comentario general.

**Propias del módulo** (se declaran, no se heredan):

- Campos requeridos para enviar y reglas de completitud.
- Qué campos son contacto directo y cuáles exigen propuesta.
- Estrategia de versión pública (versión nueva o propuesta aplicada).
- Ejes de estado adicionales, subregistros y relaciones.
- Duplicados y reclamación de registros históricos.
- Campos del DTO público.

## 13.8 Estructura para un formulario nuevo

Sin crear un generador de formularios: cada proceso escribe su formulario y solo comparte la
*forma* de declararlo. Un formulario nuevo se organiza en secciones, y cada sección fija:

| Elemento | Qué declara |
|---|---|
| Sección | Nombre y orden; es la unidad que revisa el equipo |
| Campo | Clave estable (la misma que usan observaciones y propuestas), tipo y si es requerido para enviar |
| Régimen del campo | `directo` (se corrige sin aprobación), `propuesta` (cambio sobre lo publicado) o `solo_gestión` |
| Visibilidad | Si pasa al DTO público |
| Relación | Tabla `…DeRegistro` o específica, y por qué |

La clave estable del campo es el punto que conecta formulario, revisión y propuestas. Cuando se
repitan tres procesos con la misma declaración, será el momento de evaluar abstraerla; antes sería
una abstracción prematura.

## 13.9 Declaración que acompaña a cada proceso nuevo

El tarea o la ficha técnica de un proceso nuevo incluye esta declaración antes de implementarlo.

**Datos**

- Tabla principal, clave y agregado; subregistros.
- Módulo(s) añadidos a `Modulos` y a los conjuntos que los usan.
- Estados y ejes, con sus `CHECK`.
- Relaciones comunes usadas y las específicas justificadas.
- Datos personales o sensibles, y qué se copia a la historia (no se copian documentos de identidad).
- Procedencia: contexto de origen y quién puede crear.

**Permisos**

- Quién registra, edita, envía, decide y retira: organización responsable, gestión y rol.
- Permiso de decisión nuevo, si aplica, o razón para reutilizar uno existente.
- Módulo de consola que lo gobierna, si se concede por cuenta.
- Filas nuevas en la [matriz de auditoría por superficie](12-acceso-por-superficie.md).

**Pruebas**

- Propietario permitido y organización ajena rechazada (lectura y escritura).
- Cuenta sin correo confirmado rechazada.
- Transición inválida rechazada.
- Contenido no publicado invisible en el DTO y en el directorio público.
- Observaciones por campo y propuesta campo a campo.
- Historia completa y legible, con instantánea que no cambia al renombrar la organización.
- Vocabulario de módulos y procedencia cubiertos por sus pruebas de referencia.
- Si usa SQL Server, `CHECK` y claves cubiertos en su prueba contra la base.

## 13.10 Cobertura de pruebas de referencia

Cada prueba de §13.9 se contrastó con las pruebas existentes (`simus-api/tests/SIMUS.Api.Tests`).
«Cubierta» indica que hay una prueba con nombre propio; no equivale a haberla ejecutado.

| Prueba exigida | Festivales | Mercados |
|---|---|---|
| Organización ajena rechazada | `RevisionPorCamposTests` (cambios de un festival ajeno), `EdicionesDelFestivalTests` (ediciones en festival ajeno) | `MercadosDesdeLaOrganizacionTests`, `RevisionPorCamposDeMercadoTests` |
| Cuenta sin correo confirmado | `LaOrganizacionYSusProcesosTests` (`correo_sin_confirmar`) | Sin prueba propia; depende de la puerta compartida |
| Transición inválida | Solo se solicitan cambios a lo que está en revisión | Solo se devuelve lo que está en revisión; no se envía dos veces |
| No publicado invisible | `Pnmc054LecturaPublicaTests`, `EstadoDelFestivalTests` | `MercadosMusicalesTests` (no se abre por su dirección; consulta pública solo publicados) |
| Observaciones por campo | `RevisionPorCamposTests` | `RevisionPorCamposDeMercadoTests` |
| Propuesta campo a campo | `CircuitoDePropuestasSqlServerTests` | `PropuestasDeCambioDeMercadoTests` |
| Historia legible | `ApiIntegrationTests` (instantánea que no varía al renombrar) | `MercadosDesdeLaOrganizacionTests` (historial del circuito) |

Huecos detectados, para tareas de seguimiento y no para este:

1. **Propuestas de Festival con organización ajena.** Hay un caso en `ApiIntegrationTests`, pero
   no una prueba con nombre dedicada como la de Mercados. Conviene confirmar que cubre lectura y
   escritura.
2. **Correo sin confirmar en Mercados.** Se cubre solo en Festivales; un proceso nuevo debe probar
   la puerta en su propio punto de entrada.
3. **Noticias, Agenda y Catálogo Editorial** tienen pruebas de circuito (`NoticiasCircuitoTests`,
   `AgendaCircuitoTests`, `CatalogoEditorialCircuitoTests`) pero ninguna de propiedad, porque
   no tienen organización responsable; es coherente con §13.6, no un defecto.
