# Diagnóstico — Directorio de agentes y actores de la música en Colombia (L3, EC-3 y EC-4)

Fecha: 20 nov 2026 · Base: `origin/main` 6df433d6 · Rama: `feat/ui-directorio-de-agentes`

## 1. Lo que existía

| Capa | Estado real |
|---|---|
| Ruta | `/ecosistema/personas` (lista) y `/ecosistema/personas/:clave` (ficha). Rotulada «Personas» en el título de la ruta, en el hero y en la entrada de la portada del Ecosistema («Buscar personas»). |
| Pantalla | `DirectorioDePersonasPageComponent` montada sobre el directorio estándar de procesos (`app-directorio-ecosistema`): mismo marco que Festivales o Mercados, con `app-registro-de-directorio`. **Sin foto.** Texto, zona, servicio, categoría, rol e instrumento. Lista y cuadrícula, pero ambas sin imagen y casi iguales. |
| Carga | `GET /api/v1/publico/personas` devolvía TODAS las personas visibles en un arreglo; el navegador filtraba, contaba y paginaba (12 fijos). Sin selector de cantidad por página. |
| Esqueleto / vacío | Existían (esqueleto genérico `fila`/`tarjeta`), pero sin la forma de una persona (foto). |
| Ficha | Foto circular de 112 px, nombre, municipio, biografía, oficios, prácticas, organizaciones, portafolio y enlaces; a su lado «Cómo se le encuentra» y «Perfiles similares». «Volver» llevaba siempre a `/ecosistema`. |
| Taxonomía | Tabla `ValoresDeTaxonomiaDePerfiles` (decisiones 133 y 135): dimensiones rol (en categorías y subcategorías, con `IdPadre`), servicio, instrumento y territorio; correspondencia con Soy Cultura en `GrupoSoyCultura`. Selección múltiple, con máximos. Administrable desde la consola. |
| Agenda de citas | Existe como proceso aparte (`/ecosistema/agendas-de-citas`, `AgendamientoDeLasPersonas`): la persona decide si ofrece citas. No está unida al directorio; la ficha no enlaza a ella. |

## 2. Qué datos públicos hay y de dónde salen

Fuente única de «visible»: `PerfilPublicoEndpoints.Visibles` (público) y `VisiblesParaSimus` (con sesión de SIMUS suma los «solo SIMUS»). Un perfil aparece solo si:
- tiene la autorización de datos `perfil_publico` vigente (consentimiento de publicación; retirarla lo saca en el acto),
- no está oculto por moderación,
- su cuenta está activa.

| Dato | Origen | ¿Se muestra? |
|---|---|---|
| Nombre público (`NombreVisible`) | `PerfilesPublicos` | Sí. Es el nombre artístico o público. |
| Nombre civil | `Usuarios` | **No** en el directorio. En la ficha solo si la persona activó «mostrar nombre civil» (`NombreCivilVisible`). |
| Foto | Banco de archivos (`ArchivoFotoId`) servida por `/api/v1/publico/archivos/{id}` con texto alternativo (`AltText`) | Sí. |
| Biografía corta | `PerfilesPublicos` | Sí (en lista). La larga solo en la ficha. |
| Municipio y departamento | **Los del perfil público** (`CodigoMunicipio`, elegido por la persona para mostrar) | Sí. |
| Municipio y departamento de RESIDENCIA | `Usuarios.ResidenciaCodigo*` (§19.14) | **Nunca.** Son privados, con finalidad propia; ningún endpoint público los lee. |
| Roles, servicios, instrumentos, territorios («Actúa en») | `PerfilesPublicosClasificaciones` | Sí. |
| Prácticas musicales | `PerfilesPublicosPracticas` | Sí. |
| Correo, teléfono, documento, rol en una organización | cuenta | **Nunca.** Un test lo comprueba sobre la respuesta cruda. |

Una persona con perfil publicado pero sin roles ni servicios sale como «Perfil por completar» (se encuentra por texto, no por categoría).

## 3. Lo que faltaba

1. Foto en la lista y el mosaico, y un respaldo elegante sin foto.
2. Un directorio de verdad, con identidad propia («agentes y actores»), no «Personas» ni «búsqueda de personas».
3. Paginación y filtrado en el servidor, con conteo por opción coherente con la consulta; selector de cantidad por página.
4. Filtros por categoría y subcategoría de rol con selección múltiple, práctica musical y territorio (departamento, municipio, «Actúa en»).
5. Chips de filtros aplicados con «X» y «Limpiar filtros».
6. Filtros que se pliegan en 390 px.
7. Esqueleto con la forma de una persona; vacío que distingue «directorio vacío» de «consulta sin resultados»; error con motivo y «Reintentar».
8. Volver desde la ficha al directorio conservando la consulta.

## 4. Límites de privacidad que se respetan

- El directorio es la misma población y la misma regla de «visible» que la lista anterior y la ficha: no abre ningún perfil nuevo.
- El endpoint nuevo no lee nada más que lo que ya entrega `CargarAsync` (proyección pública). Ni residencia ni nombre civil ni contacto.
- Con sesión de SIMUS se suman los perfiles «solo SIMUS» (igual que hoy); anónimo, no.
- Los filtros y el orden se resuelven sobre datos públicos; el texto de búsqueda no revela nada que la tarjeta no muestre.
- Cuenta demo: las cuentas `…@…test` y `admin` no se exponen; no se toca ninguna.

## 5. Decisiones y pendientes

- La ruta se conserva (`/ecosistema/personas`): romperla rompería enlaces y la ficha. Solo cambia el nombre en pantalla: «Directorio de agentes y actores de la música» (miga: «Agentes y actores»).
- La taxonomía de roles (categorías y subcategorías) es la propuesta SIMUS pendiente de confirmar con el Ministerio: el directorio la lee de la tabla, así que cambiarla no exige tocar el código.
- Pendiente (fuera de este PR): enlazar la agenda de citas desde la ficha cuando la persona la ofrece; «Contactar» no se añade porque no hay un canal de contacto consentido.
- Se reutilizan las piezas de L2 que existen hoy; al fusionar L2 se cambian el selector de vista (iconos) y el enlace de regreso.
