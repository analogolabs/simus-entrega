# 30. Diseño de la consola y del acceso externo

**Estado: propuesta con las decisiones 1 a 6 aprobadas, en buena parte ya construida** (a 20 de noviembre de 2026 el registro de versiones llega a la 1.38: pieza común de listas, menús de acción por fila, modelo común de los cinco procesos de §30.17, etc.; las medidas de §30.1 son las del 12 de noviembre, previas a esas obras) (12 nov 2026, lote UI1; versión 1.1 añade los principios de estética, la regla única de pestañas y la medición del desborde). Es un documento de auditoría y de diseño: no cambia código. Revisa el diseño, los botones y los componentes de la consola (`/administracion`) y del acceso externo (ingreso, registro, panel de la organización y Mi espacio), propone una estructura de barra lateral y un sistema de componentes, y deja un plan por lotes y las decisiones que necesitan respuesta.

Las capturas y las maquetas **no están en el repositorio**: viven en una carpeta propia del equipo (`<carpeta-de-informes>/ui1-consola-y-acceso/`, con `index.html`, `png/`, `antes/` y `maquetas/`) y aquí se citan por nombre (ver §30.9 y el anexo B).

## 30.1 Resumen

| Qué se vio | Dato medido |
|---|---|
| La «barrita con sombra» al inicio de la barra lateral | Es un degradado de desplazamiento que queda fijo; hay cuatro degradados superpuestos y dos contenedores con hueco de desplazamiento reservado (la barra mide 276 px y la lista 275) |
| Desborde de la barra lateral | Sin desborde horizontal (barra y página no se desplazan al lado). Vertical: el contenido mide 833 px; la lista dispone de 661 px a 1280×800 (desborda 172) y de 761 px a 1440×900 (desborda 72); el pie «Ver el portal público» queda siempre visible. Entre 1 y 3 entradas se parten según la tipografía cargada («Organizaciones y responsables» siempre). En el panel externo el rótulo «Actuando como Corporación Cultural Cantaclaro» se corta (208 de 228 px visibles) |
| «Fichas de IA» | En 47 pantallas: 32 tarjetas dentro de tarjetas (Mi espacio 15, panel de la organización 9, portal 7), 15 contenedores con sombra y borde a la vez, 24 iconos en círculo de color, 21 degradados (19 son el fondo de la barra lateral) y 2 acentos laterales de color (panel de la organización) |
| Pestañas y menús repetidos | 5 pantallas con dos menús apilados o pestañas que son filtros; el panel de la organización usa 7 pestañas horizontales como segundo nivel de menú (§30.13) |
| Menús dobles en la bandeja | Dos filas de pestañas una sobre otra: estado («Pendientes», «Resueltas») y tipo («Todo», «Registros nuevos», «Eventos», «Cambios a lo publicado», «Eliminaciones», «Más tipos»), más un orden desplegable |
| Campos de búsqueda, selectores y desplegables sin estándar | 129 campos medidos en 59 pantallas: las búsquedas tienen 8 alturas distintas (21 a 48 px), los selectores nativos 4 (21, 40, 44 y 47 px) y hay 5 radios de borde distintos |
| Botones | 431 medidos: 50 combinaciones de altura, radio, mayúsculas, tamaño y tipografía; 56 con mayúscula sostenida |
| Foco | 36 controles medidos: 8 tratamientos distintos del estado de foco |
| Contraste | El borde de los campos (`#dfe3ea`) tiene 1,29:1 sobre blanco (el criterio de componentes pide 3:1); el texto suave (`#817A84`) tiene 4,16:1 (el de texto pide 4,5:1) |

Lo que **ya está bien**: la consola es la zona más ordenada (casi todo en 36–37 px, rótulos de las secciones con icono, acciones por estado), y el producto ya trae los tokens de altura (24, 36 y 44 px) y un conjunto de componentes compartidos (`app-boton`, `app-filtro-desplegable`, `app-selector-multiple`, `app-buscador-de-lista`, `app-barra-de-lista`, `app-selector-segmentado`). El problema no es la falta de sistema, sino que casi nada lo usa.

## 30.2 Método y límites

- **Entorno:** base propia `SIMUS_UI1`, API 8236 y web 4356 (no se tocó la demo del usuario), con la siembra completa y las cuentas: `webmaster@simus.test`, `lucia.ramirez@cantaclaro.test` y `valentina.ocampo@correo.test` (contraseña `admin`).
- **Medición:** un guion de Playwright recorre el portal, el acceso externo, Mi espacio, el panel de la organización y las 19 secciones de la consola a 1440×900, y mide con `getBoundingClientRect` y `getComputedStyle` cada campo de búsqueda, selector y desplegable; otro mide botones, cabeceras y pestañas; otro mide el foco; otro la geometría de la barra lateral.
- **Contraste:** calculado con la fórmula de WCAG 2.2 a partir de los tokens de `simus-web/src/styles.css`, no con muestras de píxeles.
- **No evaluado:** estados de error y deshabilitado forzados en cada campo (se revisaron en el código y en los ejemplos que aparecen solos); diálogos abiertos de todas las acciones; lectores de pantalla reales; móvil y táctil (el alcance es escritorio); tema oscuro.
- Hay lotes en vuelo que tocan zonas cercanas: **G1** (consola: fichas con dirección propia, formularios), **G7** (menú PNMC, botones de componente y mayúsculas del portal y del mapa), **ACC2** (entrada, selector de modo y menú de cuenta), **HST** (Festivales históricos), **ME** (Mi espacio y perfil público) y **DIR** (directorios estándar). Este documento no repite sus hallazgos; los cita donde se solapan.

## 30.3 Hallazgos de diseño

Prioridad: **alta** (se nota al primer uso o rompe la coherencia en muchas pantallas), **media**, **baja**.

| Id | Prioridad | Zona y ruta | Qué se ve | Por qué es un problema | Propuesta | Componente |
|---|---|---|---|---|---|---|
| UI-01 | alta | Consola, barra lateral (todas las rutas) | Una barrita pequeña con sombra arriba y otra sombra fija sobre «Ver el portal público» | Son los degradados `scroll` de, pintados siempre sobre la lista; se ven como una pieza superpuesta y no como una señal de «hay más» | Quitar los cuatro degradados; indicar «hay más» con un desvanecido de 28 px solo al final y solo si hay contenido por recorrer (`mask-image`), sin sombra superior | `admin-shell-layout.component.css` (`.sidebar-secciones`) |
| UI-02 | media | Consola, barra lateral | La barra mide 276 px y la lista 275, con el hueco de desplazamiento reservado dos veces | Los dos contenedores (`.foundation-sidebar` y `.sidebar-secciones`) declaran `scrollbar-gutter: stable`: se reserva el hueco dos veces y hay un desplazamiento propio duplicado | Un solo contenedor con desplazamiento (la lista), un solo hueco, barra fina que aparece al pasar el cursor | `admin-shell-layout.component.css` |
| UI-03 | media | Consola, barra lateral | Rótulos de grupo en mayúscula sostenida con 0,96 px de espaciado | Contra la guía de estilo (`docs/usuario/23-guia-de-estilo-de-textos.md`); ocupan más ancho y se leen peor | Mayúscula inicial, 12 px, peso 700, sin espaciado | `admin-shell-layout.component.css` (`.sidebar-group > p`) |
| UI-04 | media | Consola, barra lateral | Entre una y tres entradas se parten en dos líneas y miden 46 px en vez de 36 (medido con la tipografía ya cargada: «Organizaciones y responsables»; con la de respaldo, también «Solicitudes y revisiones» y «Espacios para música en vivo») | El ancho útil no alcanza; la fila deja de seguir el ritmo de las demás | Ancho de 272 px, insignia compacta y rótulos más cortos donde se puede («Organizaciones», «Espacios»); el nombre completo en el título de la página | Modelo de navegación + CSS |
| UI-05 | **alta** | Consola, `/administracion/solicitudes` | Dos filas de pestañas apiladas (estado y tipo), «Más tipos» desplegable y un orden desplegable | Dos menús del mismo tipo uno sobre otro: no se sabe cuál manda ni cuál cambia qué; el tipo se disfraza de navegación | Una sola fila de pestañas (estado: «Pendientes», «Resueltas (30 días)»); el tipo y el responsable como **filtros** desplegables con conteo; el orden en la cabecera de la tabla | `admin-solicitudes-panel` |
| UI-06 | media | Consola, barra lateral a 1280×800 | El contenido mide 833 px y la lista 661: desborda 172 px (a 1440×900 la lista tiene 761 y desborda 72); sin desborde lateral | Con 19 entradas hay desplazamiento inevitable en portátiles; sin señal clara se esconde «Gobierno y control» | Densidad (34 px por fila) y **grupos plegables con la elección recordada (decisión 1, aprobada)**; con dos grupos plegados todo cabe a 1280×800 sin desplazamiento | Barra lateral |
| UI-07 | **alta** | Todo el producto | 8 alturas de búsqueda (21, 36, 37, 40, 42, 44, 46 y 48 px), 4 de selector nativo (21, 40, 44 y 47 px), 5 radios | No hay un estándar visible: el mismo filtro cambia de tamaño al pasar de una pantalla a otra | Estándar de §30.6: 36 px de trabajo y 44 px cómodo, radio 8 | Todos los campos |
| UI-08 | **alta** | Panel de la organización, `/gestion/o/{id}/procesos` | La búsqueda y el selector «Tipo» miden **21 px** y no tienen radio | Son los «finísimos»: más pequeños que cualquier norma, sin foco claro | Pasar al estándar normal (36 px) | `procesos-gestion-page` |
| UI-09 | media | Portal y consola | Directorios públicos en 44–47 px; Agenda y Noticias en 36–37 px; consola en 36–37 px | El mismo tipo de filtro (búsqueda + desplegables) cambia según el módulo | Una sola barra de lista (`app-barra-de-lista`) con el tamaño por contexto (§30.6) | Directorios (lote DIR), Agenda y Noticias |
| UI-10 | media | Todo el producto | 8 tratamientos distintos de foco (borde amarillo, borde oscuro, anillo de 3 px blanco, etc.) | Quien navega con teclado no encuentra un patrón; algunos son poco visibles | Un solo anillo: 2 px morado con 2 px de separación, visible por teclado | Estilos globales |
| UI-11 | media | Todo el producto | 431 botones con 50 combinaciones; 56 con mayúscula sostenida; alturas de 20 a 50 px | Jerarquía poco clara y tamaño desigual | 3 tamaños × 4 importancias con `app-boton`; sin mayúscula sostenida; migrar los botones de plantilla | `app-boton` y plantillas |
| UI-12 | media | Portal, Mi espacio, panel de la organización | Cabeceras (h1) en Oswald mayúscula de 30 y 56 px; en la consola, Oswald sin mayúscula de 32,8 px; títulos de tarjeta y pestañas en mayúscula condensada | Dos escalas tipográficas; la mayúscula sostenida ocupa más y cansa; contra `docs/usuario/23-guia-de-estilo-de-textos.md` | Una escala (h1 28–32 px, h2 20, h3 16) con mayúscula inicial | Estilos globales |
| UI-13 | media | Consola y panel de la organización | Las pestañas no llevan `role="tab"` (solo las del portal) | Los lectores de pantalla no las anuncian como pestañas; sin flechas | Un componente de pestañas con `role`, `aria-selected` y navegación por flechas | Pestañas |
| UI-14 | media | Contraste | Borde de campo 1,29:1 sobre blanco; texto suave 4,16:1 | Los criterios de WCAG 2.2 piden 3:1 para el borde de un componente y 4,5:1 para el texto | Borde `#8892a4` (3,14:1) y texto suave `#6b6470` (5,70:1) | Tokens de color |
| UI-15 | media | Consola, lista de Festivales y similares | Filtros con estilos mezclados (el rótulo «Estado:» dentro del control en unos, etiqueta superior en otros), un chip «Borradores», acciones sueltas (actualizar, «…», «Nuevo Festival») en otra fila y cabeceras de tabla en mayúscula | La barra de lista no es un patrón; el botón principal cambia de sitio | Patrón de lista de §30.5: búsqueda y filtros a la izquierda, «Limpiar filtros» y la acción principal a la derecha en la misma fila | `app-barra-de-lista` |
| UI-16 | baja | Consola, tablas | Celdas truncadas («Corporación Music…») sin indicación | Se pierde el dato | Ancho mínimo y `title` con el texto completo | `app-tabla` |
| UI-17 | baja | Panel de la organización | «Actuando como», título en mayúscula, siete pestañas horizontales, burbuja de ayuda flotante que cubre cifras de abajo a la derecha | Es otro diseño que el de la consola; la burbuja tapa contenido | Barra lateral con la organización y su rol (el lote ACC2 hace el nombre y el rol); la ayuda al pie de la barra | Panel de la organización |
| UI-18 | baja | Ingreso | Título en mayúscula grande y selector «Ingresar / Registrarse» en mayúscula | Es correcto en estructura, pero repite el patrón de mayúscula sostenida | Título en minúscula con 24–28 px; pestañas con mayúscula inicial | `external-access-page` |
| UI-19 | media | Mi espacio, panel de la organización, portal | 32 tarjetas dentro de tarjetas (Mi espacio 15, panel 9, portal 7) | Capas de caja sobre caja: ruido, poca jerarquía | Una sola superficie por bloque; separar con espacio y líneas finas (§30.12) | Plantillas |
| UI-20 | media | Panel de la organización, `/procesos` | Dos tarjetas con borde izquierdo grueso de color (Festivales, Mercados) | Acento decorativo que no comunica estado | Fila con título, cifra en línea y enlace; sin acento | `procesos-gestion-page` |
| UI-21 | media | Portal y panel de la organización | 24 iconos en círculo de color (portal 14, panel 10) y 15 contenedores con sombra y borde a la vez | Decoración repetida sin función; se lee como plantilla generada | Icono sin círculo, en tinta o morado, solo si ayuda a reconocer; sombra o borde, nunca ambos | Plantillas |
| UI-22 | alta | Consola, Agenda y Banco de archivos; panel de la organización; Mi espacio | Pestañas usadas como filtro (categorías de la Agenda, dueño en el Banco) y siete u cuatro pestañas como segundo menú del panel y de Mi espacio | Dos menús del mismo tipo en una zona; el atributo se disfraza de navegación | Regla única de §30.13: pestañas = estado o vista; filtros = atributos; un menú por zona | Pestañas y barra lateral |
| UI-23 | media | Panel de la organización, cabecera | «Actuando como Corporación Cultural Cantaclaro» se corta (208 de 228 px) y «Gestión de la organización» queda en 1 px | La organización activa no se lee completa | Nombre en dos líneas con corte controlado, rol aparte y «Cambiar» (maqueta `acceso-panel-organizacion-despues`) | Panel de la organización |

Hallazgos que **otros lotes ya atienden** y no se repiten: menú PNMC y mayúsculas del mapa (G7), «Actuando como», selector de modo y menú de cuenta (ACC2), Mi espacio y su perfil público, incluida la mitad de pantalla de «Datos personales y seguridad» (ME), y el bloque de Festivales históricos (HST).

## 30.4 La barra lateral propuesta

**Estructura.** Un solo nivel de navegación por zona: la barra lateral lleva a una **sección**; las pestañas de la página cambian el **estado** de la lista; los filtros afinan lo que se ve. Los cinco grupos actuales se mantienen, con las mismas secciones y orden (`navegacion-administrativa.ts`):

1. Bandeja de trabajo: Resumen operativo; Solicitudes y revisiones.
2. Ecosistema musical: Festivales; Mercados; Lutería; Espacios para música en vivo; Redes y documentación; Organizaciones.
3. Publicaciones: Catálogo editorial; Agenda; Noticias; Banco de archivos; Categorías.
4. Sitio web y comunicación: Textos y páginas; Boletín.
5. Gobierno y control: Análisis; Auditoría; Usuarios y módulos; Sistema.

**Reglas de diseño**

- Fondo blanco, filete a la derecha, **sin sombras ni degradados superpuestos** y **un solo contenedor** con desplazamiento (la lista), con barra fina que solo aparece al pasar el cursor.
- Fila de 34 px, icono de 17 px, rótulo de una línea (truncado con `title` si no cabe) y, a la derecha, la insignia **solo donde hay trabajo que atender** (hoy, «Solicitudes y revisiones»); las demás secciones no llevan cifra.
- Rótulos de grupo en minúscula (12 px, peso 700, color de rótulo), sin filete entre grupos: el espacio los separa.
- La sección activa va con fondo lila claro y texto morado.
- «Ver el portal público» queda **fijo al pie**, separado por un filete, como destino y no como utilidad.
- Cuando hay más contenido por recorrer, un **desvanecido de 28 px al final**; no hay sombra arriba.
- **Colapso:** por debajo de 1100 px de ancho la barra pasa a un cajón que se abre desde la cabecera, como hoy; no se propone una barra de iconos.

**Contadores sin ruido.** Una cifra es una promesa de trabajo pendiente. Solo la tiene la bandeja (el total de asuntos que esperan decisión). Las pestañas de la página llevan su conteo (por ejemplo «Pendientes 12») porque describen la lista que se ve; los filtros llevan el conteo entre paréntesis cuando ayuda a decidir.

**Desbordamiento (medido).** Horizontal: ninguno; los rótulos largos se truncan con elipsis y `title`, con `overflow-x: hidden`. Vertical: el contenido actual mide 833 px; con la lista de 661 px a 1280×800 desborda 172 px y a 1440×900 (761 px) 72 px. Con filas de 34 px el contenido baja a unos 790 px. **Decisión 1 aprobada: grupos plegables con la elección recordada.** Por omisión quedan plegados «Sitio web y comunicación» y «Gobierno y control» (salvo que contengan la sección activa); así a 1280×800 todo cabe sin desplazar. Cuando algo se desplaza hay **un solo contenedor con scroll** (la lista), el pie «Ver el portal público» es fijo y no hay barra con sombra superpuesta ni doble desplazamiento. En el panel externo el selector de organización pasa a dos líneas con corte controlado (UI-23). La maqueta `consola-sidebar-antes-despues` lo muestra a 1280×800.

## 30.5 Reglas de navegación y sistema de componentes

**¿Menú, pestañas, filtro o chips?**

| Si el elemento… | Usa | Ejemplo |
|---|---|---|
| Lleva a otra sección o módulo | Barra lateral | «Festivales», «Agenda» |
| Cambia el **estado** de la misma lista y es excluyente | Pestañas (una sola fila) | «Pendientes» / «Resueltas» |
| Afina lo que se ve de esa lista (tipo, territorio, responsable) | Filtro desplegable con conteo | «Tipo de asunto: Todos (12)» |
| Alterna entre 2 o 3 vistas de lo mismo | Selector segmentado | «Lista» / «Mapa» |
| Muestra un valor y se puede quitar | Chip | un filtro activo |
| Es una acción sobre una fila | Menú de acciones o botón de fila | «Revisar», «Abrir» |

Nunca dos filas de pestañas ni dos menús del mismo tipo en la misma página.

**Botones** (`app-boton`): tres tamaños por la altura (`menudo` 24 px, `normal` 36 px, `comodo` 44 px) y cuatro importancias (primaria, secundaria, de texto, peligrosa). Una sola acción primaria por pantalla; el botón deshabilitado dice **por qué** justo debajo; sin mayúscula sostenida; icono opcional a la izquierda. La acción peligrosa va con contorno rojo y abre un diálogo de confirmación.

**Pestañas:** un componente con `role="tablist"`, `role="tab"`, `aria-selected`, flechas y `Inicio/Fin`; subrayado de 2 px en morado; el conteo es un numeral junto al rótulo, no una píldora.

**Chips de estado:** el vocabulario de `core/vocabularios/estados.ts` con tres tonos (en curso, bien, atención) y siempre con texto, no solo color.

**Tablas** (`app-tabla`): cabecera con mayúscula inicial y orden por clic con indicador, fila de 44 px, celdas con `title`, paginación abajo con «Mostrando 1–5 de N», acción de fila a la derecha.

**Diálogos** (`app-confirmacion`): título como pregunta, una línea de consecuencia, motivo obligatorio cuando aplica, «Cancelar» a la izquierda y la acción a la derecha, y la acción desactivada hasta que haya motivo.

**Patrón de lista:** título y subtítulo; una fila de pestañas de estado; una fila de filtros (búsqueda, hasta tres desplegables, «Limpiar filtros») con la acción principal a la derecha; la tabla o la rejilla; la paginación.

## 30.6 Estándar de búsquedas, filtros y selectores

**Tamaños.** El producto ya tiene tres alturas; se usan por contexto y no por pantalla:

| Contexto | Altura | Ejemplos |
|---|---|---|
| Áreas de trabajo: consola, panel de la organización, filtros de listas | **36 px** (`normal`) | búsqueda y filtros de la consola y del panel |
| Entrada de datos, acceso y primer contacto: formularios, ingreso, registro, directorios públicos | **44 px** (`cómodo`) | ingreso, datos personales, búsqueda del directorio público |
| Celdas de tabla y controles en línea | **24 px** (`menudo`) | casilla de fila, cantidad editable |

Radio 8 px, borde de 1 px `#8892a4`, letra de 14 px (la de 16 px solo en móvil, para evitar el zoom), etiqueta **superior** de 12 px y peso 700, texto de ayuda de 12 px debajo, error en rojo con una frase que dice qué hacer, icono de 16 px.

**Por tipo de control**

| Tipo | Estándar |
|---|---|
| Búsqueda de texto | Altura por contexto; icono de lupa a la izquierda; botón «✕» para limpiar cuando hay texto; marcador «Buscar por nombre, municipio…» (qué se busca, no «Buscar»); espera de 300 ms; ancho mínimo 260 px, el primero de la fila |
| Selector nativo | Solo para listas cortas (hasta 7 opciones) y en móvil; mismo alto, radio y flecha que el desplegable; nunca con rótulo dentro del control |
| Desplegable personalizado (`app-filtro-desplegable`) | Listas medianas; el menú mide como mínimo el ancho del control, 8 filas visibles (320 px) y desplaza dentro; opción activa con marca; teclado: flechas, Inicio/Fin, Enter, Escape; estado vacío «Sin resultados»; «Todos» como primera opción |
| Selector con búsqueda | Listas largas (departamento, municipio, catálogo): el mismo desplegable con un campo de búsqueda arriba; coincidencia sin tildes |
| Selector múltiple (`app-selector-multiple`) | Casillas en el menú, resumen en el control («Casanare, Meta» o «2 seleccionados») y píldora con el conteo |
| Fecha | Mismo alto; formato local `dd/mm/aaaa`; selector de mes y año con los nombres de mes (como en la Agenda); rango con dos campos y separador |

**Fila de filtros estándar.** Una cuadrícula: búsqueda (1,6 fracciones) + hasta tres desplegables (1 fracción cada uno) + «Limpiar filtros» alineados por la base; las etiquetas arriba; la acción principal de la lista a la derecha. Ver la maqueta `filtros-antes-despues`.

**Estados.** Foco: anillo de 2 px morado con 2 px de separación, visible con teclado; sobre el control, el borde pasa a morado. Hover: borde un tono más oscuro. Deshabilitado: fondo gris claro, texto suave y la razón en el texto de ayuda. Error: borde y texto de ayuda en rojo, mensaje que dice cómo corregir.

**Convergencia con lo que ya existe.** No hace falta un componente nuevo por tipo; hace falta migrar. Estado a revisar al fusionar los lotes en vuelo:

- `app-filtro-desplegable` (medido: 36–37 px, radio 11,2): es el candidato a desplegable estándar; falta el campo de búsqueda para listas largas y alinear el radio a 8.
- `app-buscador-de-lista` y `app-barra-de-lista`: es la barra de lista; el panel de búsqueda del lote DIR y los selectores que G6 dejó en la Agenda y Noticias deben apoyarse en ella y no duplicarla.
- `app-selector-multiple` y `app-selector-segmentado`: se quedan.
- El **campo de texto estándar** con etiqueta, ayuda y error (`app-campo-de-texto`, UI-B) y su par para listas cortas, **`app-campo-de-seleccion`** (UI-C), son las piezas que más reducen las variantes de radio y de altura.
- 51 archivos usan `<select>` nativo; la migración se hace por pantalla, empezando por las que más se ven (panel de la organización y directorios). **UI-C (13 nov 2026):** hecho para los directorios, el mapa, la barra de procesos del panel y las listas de la consola que aún tenían controles sueltos; ver §30.14.

## 30.7 Plan por lotes de implementación

| Lote | Qué | Esfuerzo | Riesgo | Depende de |
|---|---|---|---|---|
| **UI-A** · Barra lateral y bandeja | UI-01 a UI-06: quitar sombras y degradados, un solo desplazamiento, rótulos en minúscula, ancho 272, una fila de pestañas en la bandeja con el tipo como filtro, densidad | S–M (2 a 3 días) | Bajo: es CSS y una pantalla; hay pruebas de navegación | Decisión 1 y 3 |
| **UI-B** · Tokens y primitivas | UI-10, UI-13, UI-14: anillo de foco único, color del borde y del texto suave, componente de pestañas con rol, campo de texto estándar | M (3 a 4 días) | Medio: toca estilos globales; se valida con las pruebas de componente y una pasada visual | Decisión 2 |
| **UI-C** · Búsquedas, selectores y desplegables | UI-07 a UI-09, UI-15: migrar los 51 archivos con `<select>`, el panel de la organización (21 px) y la barra de lista | L (5 a 8 días, por tandas de pantallas) | Medio: muchas pantallas; conviene por tandas y con la medición como prueba automática | UI-B; coordinar con DIR y G6 |
| **UI-D** · Botones y tipografía | UI-11, UI-12, UI-17, UI-18: migrar los botones de plantilla a `app-boton`, escala tipográfica, sin mayúscula sostenida | M (3 a 5 días) | Medio: es transversal; la guía de estilo y su chequeo automático ya existen (`comprobar-mayusculas.py`) | Decisión 4; coordinar con G7 |
| **UI-E** · Panel de la organización con barra lateral | Llevar al panel externo la estructura de la consola (UI-17) y alinear Mi espacio | M–L (4 a 6 días) | Medio: rutas y permisos del panel | ACC2 y ME fusionados; decisión 5 |
| **UI-F** · Accesibilidad y contraste | Revisión con lector de pantalla, orden de tabulación y contrastes restantes | S (1 a 2 días) | Bajo | UI-B |
| **UI-G** · Anti-patrones de tarjetas y acentos | UI-19 a UI-21: quitar tarjetas anidadas, acentos laterales, iconos en círculo y sombra con borde; añadir las métricas del trinquete (§30.12) | M (3 a 4 días) | Bajo–medio: son plantillas; el trinquete impide volver atrás | UI-B; después de UI-E en Mi espacio y panel |

Las decisiones 1 a 6 están **aprobadas**, de modo que UI-A a UI-G pueden planearse sin consulta adicional. UI-A incluye ahora las pestañas de la bandeja y los grupos plegables; UI-E incluye la regla de pestañas (§30.13) en el panel y en Mi espacio.

**Orden recomendado:** UI-A → UI-B → UI-C y UI-D en paralelo por zonas distintas → UI-E → UI-G → UI-F. Al terminar cada lote se **repite la medición** del anexo A: la meta es que los campos de búsqueda, selector y desplegable tengan solo las alturas 24, 36 y 44 px, un radio y un foco. Esa medición queda como un guion reutilizable (`medir.cjs` del anexo C).

## 30.8 Decisiones de la dirección

**Estado: las seis están APROBADAS con la opción recomendada (12 nov 2026).**

1. **Barra lateral y desbordamiento:** ¿grupos plegables con la elección recordada (**recomendado**) o desplazamiento corto sin plegar?
2. **Tamaños:** ¿36 px en las áreas de trabajo y 44 px en formularios, ingreso y directorios públicos (**recomendado**) o una sola altura en todo el producto?
3. **Bandeja:** ¿una sola fila de pestañas de estado y el tipo como filtro desplegable con conteo (**recomendado**)? Cambia cómo se encuentran los «Eventos» y las «Eliminaciones».
4. **Tipografía:** ¿se abandona la mayúscula sostenida en títulos, tarjetas, pestañas y botones, dejando la tipografía de títulos sin transformar (**recomendado**)?
5. **Panel de la organización:** ¿se lleva a una barra lateral con la misma estructura que la consola (**recomendado**) o se mantiene con pestañas horizontales?
6. **Rótulos más cortos** en la barra lateral («Organizaciones» en lugar de «Organizaciones y responsables», «Espacios» en lugar de «Espacios para música en vivo»), con el nombre completo en el título de la página.

## 30.9 Anexo A: inventario medido de búsquedas, filtros, selectores y desplegables

Medido a 1440×900 con la siembra completa. **129 campos en 59 pantallas.** El detalle por pantalla, los casos extremos y los datos en bruto están en `anexo-inventario.md` y en `medicion.json` de la carpeta de entregables.

**Por tipo**

| Tipo | Campos | Altura mín. | Mediana | Altura máx. | Alturas distintas (px) | Radios (px) | Letras (px) |
|---|---:|---:|---:|---:|---|---|---|
| Desplegable personalizado | 42 | 36 | 37 | 37 | 36, 37 | 11,2 | 12, 14 |
| Selector nativo | 36 | 21 | 47 | 47 | 21, 40, 44, 47 | 0, 8, 12 | 12, 14, 16 |
| Búsqueda de texto | 28 | 21 | 41 | 48 | 21, 36, 37, 40, 42, 44, 46, 48 | 0, 8, 11,2, 12 | 12, 14 |
| Campo de texto | 20 | 44 | 46 | 47 | 44, 46, 47 | 8, 12 | 14, 16 |
| Área de texto | 2 | 62 | 74 | 86 | 62, 86 | 8, 12 | 14 |
| Fecha | 1 | 36 | 36 | 36 | 36 | 11,2 | 14 |

**Frente a la norma (24, 36 y 44 px)**

| Tipo | ≤ 29 px | 30–39 px | 40–49 px | ≥ 50 px | Sin icono |
|---|---:|---:|---:|---:|---:|
| Desplegable personalizado | 0 | 42 | 0 | 0 | 0 |
| Selector nativo | 2 | 0 | 34 | 0 | 36 |
| Búsqueda de texto | 2 | 11 | 15 | 0 | 13 |
| Campo de texto | 0 | 0 | 20 | 0 | 19 |

**Por zona**

| Zona | Campos | Mediana | Rango (px) | Lectura |
|---|---:|---:|---|---|
| Consola | 54 | 37 | 36–62 | La más ordenada |
| Portal público | 45 | 47 | 36–48 | Directorios en 44–47; Agenda y Noticias en 36–37 |
| Mi espacio | 17 | 46 | 44–47 | Formularios cómodos |
| Panel de la organización | 13 | 44 | 21–86 | La búsqueda y el selector de «Procesos» miden 21 px |

**Casos más alejados:** panel de la organización, `/gestion/o/{id}/procesos`: búsqueda y selector «Tipo» de 21 px y radio 0; consola, `/administracion/analisis`: la pregunta al asistente de 62 px; panel de la organización, nuevo Festival: la descripción de 86 px (es un área de texto, correcto).

**Botones:** 431 medidos, 50 combinaciones; la más común, 32 px con radio 9,6 y letra 14 px/500 (77); la mayor dispersión está entre 20 y 50 px de altura; 56 con mayúscula sostenida. **Cabeceras (h1):** Oswald en mayúscula de 30 px (portal y Mi espacio) y de 56 px (portal); Oswald sin mayúscula de 32,8 px (consola). **Foco:** 8 tratamientos distintos en 36 controles.

## 30.10 Anexo B: maquetas

Las maquetas son HTML estático (no tocan el código de la aplicación) renderizado a PNG a 1440×900 y a 1280×800, y están en `maquetas/` y `png/` de la carpeta de entregables:

- `consola-sidebar-antes-despues`: la barra lateral antes (réplica fiel del CSS actual) y después.
- `consola-bandeja-despues`: «Solicitudes y revisiones» con una sola fila de pestañas y filtros.
- `consola-lista-despues`: lista con pestañas, filtros estándar y tabla.
- `consola-ficha-despues`: ficha con acciones por estado y «siguiente acción».
- `consola-dialogo-despues`: diálogo de confirmación con motivo.
- `filtros-antes-despues`: la fila de filtros estándar frente a alturas reales de ejemplo.
- `acceso-ingreso-despues`, `acceso-panel-organizacion-despues` y `acceso-mi-espacio-despues`: el ingreso, el panel con barra lateral (organización, rol y «Cambiar» sin fichas) y Mi espacio.
- `sistema-de-componentes`: botones, campos, selectores, pestañas, chips y tabla.
- `anti-patrones-antes-despues` y `regla-pestanas-y-filtros`: los patrones a evitar frente a su reemplazo, y la regla única de pestañas, filtros y menús.

La versión 1.1 de las maquetas (v2) quita de los «después» las fichas, los degradados, los acentos laterales y los iconos en círculo: la jerarquía se hace con tipografía, espacio y líneas finas, y el color solo marca estado o la acción primaria.

Las capturas «antes» reales (`antes/`) incluyen las 59 pantallas medidas y la barra lateral arriba, en medio y abajo.

## 30.11 Anexo C: cómo repetir la medición

Los guiones de medición (`medir.cjs`, `medir-foco.cjs`, `medir-botones.cjs`, `medir-barra.cjs`, `medir-patrones.cjs`, `medir-desborde.cjs`, `resumir.py` y `resumir-patrones.py`) están en `guiones/` de la carpeta de entregables. Necesitan un entorno propio (base `SIMUS_UI1`, API 8236 y web 4356, con `scripts/demo/reconstruir-demo-local.sh` y variables de puerto y base propias) y se ejecutan con el Playwright de `simus-web/node_modules`. Convertir la medición en una prueba automática (que falle si aparece una altura fuera de 24, 36 y 44 px) es parte del lote UI-C.

## 30.12 Principios de estética y anti-patrones

**Principio.** Una pantalla se ordena con tipografía, espacio, líneas finas y alineación. El color tiene función (estado, acción primaria, enlace); la decoración no. Se conserva la línea visual actual de consola y portal (morado, hueso, Nunito y Oswald); lo que cambia es cuántas cajas hay.

| Sí | No |
|---|---|
| Un bloque, una superficie; se separa con 24–32 px de espacio y un filete de 1 px | Tarjeta dentro de tarjeta; tres cajas para tres datos |
| Datos como lista de definición (rótulo a la izquierda, valor a la derecha) con filetes | Una ficha por dato |
| Cifras en línea, separadas por reglas finas | Cuadros de color con una cifra y un icono |
| Estado = punto de color + texto | Chip relleno repetido en cada fila |
| Icono suelto, en tinta o morado, solo si ayuda a reconocer | Icono dentro de un círculo de color |
| Borde fino **o** sombra suave, nunca ambos | Sombra y borde a la vez |
| Énfasis con peso y tamaño del texto | Cuadro con borde izquierdo grueso de color |
| Fondo plano; el morado sólido solo en cabecera y primario | Degradados sin función |

**Antes y después** (maqueta `anti-patrones-antes-despues`): la tarjeta de proceso del panel («Festivales», con acento morado, círculo con la inicial, cifra y botón dentro de otra tarjeta) pasa a una fila con título, descripción, cifra en línea y enlace «Administrar»; el resumen de la barra del panel («Actuando como…», ficha de organización, chips de rol y botones) pasa a nombre de la organización en dos líneas, rol en texto y «Cambiar» como enlace; «Datos personales y seguridad» de Mi espacio pasa de siete tarjetas anidadas a una lista de definición con filetes.

### Inventario medido (1440×900, 47 pantallas)

| Zona | Pantallas | Acento lateral | Tarjetas anidadas | Sombra y borde | Iconos en círculo | Degradados | Chips |
|---|---:|---:|---:|---:|---:|---:|---:|
| Acceso (ingreso y registro) | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| Mi espacio | 7 | 0 | 15 | 0 | 0 | 0 | 0 |
| Panel de la organización | 12 | 2 | 9 | 2 | 10 | 0 | 2 |
| Consola | 19 | 0 | 1 | 0 | 0 | 19* | 19 |
| Portal público | 7 | 0 | 7 | 13 | 14 | 2 | 1 |
| **Total** | **47** | **2** | **32** | **15** | **24** | **21** | **22** |

\* Es el fondo de la barra lateral (UI-01), contado una vez por pantalla; fuera de él la consola no tiene degradados. Mejor estado: el acceso (0 en todo); la consola solo tiene una tarjeta anidada (`/administracion/analisis`, «Consulta guiada»).

**Pantallas con más casos:** portal `/mapa-ecosistemico` (13 con sombra y borde, 5 círculos); Mi espacio `/gestion/cuenta/seguridad` (12 anidadas); portal `/pnmc` (9 círculos, 2 degradados); panel `/gestion/o/{id}/procesos` (2 acentos, 2 anidadas, 2 sombras); panel `/equipo` (4 anidadas); portal `/ecosistema/luteria` (4) y `/editorial` (3); panel, nuevo Festival (3 anidadas). Cada panel de la organización lleva además un círculo con icono en la cabecera. El detalle por ruta y los ejemplos de texto están en `anexo-antipatrones.md` (carpeta de entregables).

**Chips redundantes.** En la consola hay 19 chips de «píldora» (casi todos el estado repetido en cada fila de las tablas): se reemplazan por punto de color más texto (`.est`).

### Reemplazo propuesto

| Anti-patrón | Reemplazo | Lote |
|---|---|---|
| Tarjeta anidada | Quitar la tarjeta interior; separar con espacio y filete | UI-G |
| Acento lateral | Título y cifra en línea; el estado, con punto y texto | UI-G |
| Icono en círculo | Icono suelto de 16–20 px en morado o tinta | UI-G |
| Sombra con borde | Solo borde de 1 px (superficies) o solo sombra (elementos que flotan: menús, diálogos) | UI-G |
| Degradado | Fondo plano (`--hueso` o blanco); desvanecido solo como señal de «hay más» | UI-A |
| Chip de estado en tabla | Punto de color + texto | UI-D |

### Detección automática

El trinquete de interfaz (`simus-web/trinquete/trinquete-interfaz.mjs`, techo en `techo-interfaz.json`) ya cuenta estáticamente patrones de las plantillas y falla si la deuda sube. Se añaden métricas de tipo «máximo» (la deuda solo baja) con la línea base actual:

| Métrica | Qué cuenta | Línea base |
|---|---|---:|
| `acentoLateral` | `border-left`/`border-l-[2-9]` con color de marca o `border-l-4` en plantillas y estilos | 4 declaraciones |
| `degradados` | `linear-gradient`, `radial-gradient` y `bg-gradient-*` | 14 |
| `circuloConIcono` | `rounded-full` con `bg-*-50/100/200` en una plantilla con `<svg>` | 19 plantillas |
| `sombraConBorde` | una clase con `shadow-*` y `border` a la vez | por medir al implementar |
| `mayusculaSostenida` | `uppercase` | 131 archivos, 805 líneas (ya cubierta por `comprobar-mayusculas.py`) |

Además, el barrido dinámico `medir-patrones.cjs` (anexo C) se incorporaría a `e2e-audit/` (`auditoria-dom.ts`) como herramienta local que mide lo que la estática no ve (tarjetas anidadas, círculos y degradados calculados). **Excepciones:** se declaran por escrito en el propio techo (archivo, motivo y quién lo aprobó): por ejemplo, un degradado que sea parte de una ilustración o un mapa, o un acento lateral en una cita editorial. Sin motivo escrito, no se admite.

## 30.13 Regla única de pestañas, filtros y menús

Con la bandeja aprobada (pestañas de estado «Pendientes» y «Resueltas» y el tipo como filtro) se aplica la misma regla en todo el producto:

1. **Un solo nivel de menú por zona.** La barra lateral lleva a secciones; dentro de una sección no hay otro menú del mismo tipo.
2. **Pestañas = estado o vista de la misma lista.** Una sola fila, excluyentes, con conteo como numeral; componente único con `role="tablist"`/`role="tab"` y flechas.
3. **Filtros = atributos** (tipo, categoría, dueño, territorio): desplegable con conteo.
4. **Selector segmentado = modo de visualización** (Lista/Cuadrícula, Día/Mes/Rango).
5. **Pestañas de áreas de una sola ficha** se permiten en una fila de hasta 6; más de 6 pasan a barra lateral de la ficha.

### Inventario y aplicación

| Zona y pantalla | Hoy | Aplicación |
|---|---|---|
| Consola, `/solicitudes` | Dos filas apiladas: estado (Pendientes, Resueltas (30 días)) y tipo (Todo 13, Registros nuevos 9, Eventos 2, Cambios a lo publicado 1, Eliminaciones 1, «Más tipos») más orden | Una fila de pestañas de estado; tipo y responsable como filtros con conteo; orden en la cabecera de la tabla (UI-A) |
| Consola, `/agenda` | Pestañas «Todas 469» y categorías usadas como filtro | Filtro de categoría con conteo; pestañas solo si hay estados (UI-C) |
| Consola, `/banco-de-archivos` | Todos, Del Programa, De organizaciones, De personas | Filtro «Dueño» (UI-C) |
| Consola, `/gestion-del-sitio` | 6 pestañas de áreas | Se conservan (regla 5) |
| Consola, `/usuarios`, `/auditoria` | Administrativas/Externas; Actuaciones/Accesos | Se conservan como vistas (una fila) |
| Consola, `/catalogo-editorial` | Lista/Mosaico | Selector segmentado (modo de visualización) |
| Panel de la organización | 7 pestañas horizontales (Resumen, Procesos, Eventos, Solicitudes, Datos, Archivos, Equipo) como segundo menú | Barra lateral del panel con esas secciones (UI-E, decisión 5): **hecho** (§30.14) |
| Mi espacio | 4 pestañas (Mi espacio, Mis organizaciones, Perfil público, Datos personales y seguridad) | Barra lateral de Mi espacio (UI-E; coordinar con ME) |
| Portal, mapa | Directorio/Agenda | Selector segmentado de vista |
| Portal, agenda | Día/Mes/Rango | Selector segmentado de vista |
| Portal, festivales | Listado/Cuadrícula | Selector segmentado de vista |

Los falsos positivos de la detección (botones Cancelar/Siguiente, «Generar enlace nuevo»/«Revocar», migas de pan, «Verlo solo»/«Ir a mi ritmo») no se tocan. Maqueta: `regla-pestanas-y-filtros`.

## 30.14 Estado de la implementación

| Lote | Estado | Qué se hizo |
|---|---|---|
| **UI-A** · Barra lateral y bandeja | **Hecho** (12 nov 2026, decisiones 84 y 85 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`) | UI-01 a UI-06 y UI-22 en la bandeja: sin degradados ni sombras, un solo contenedor con desplazamiento, grupos plegables con la elección recordada, rótulos cortos de una línea, barra de 272 px y una sola fila de pestañas de estado con el tipo como filtro. Por omisión no hay desborde a 1280×800 ni a 1440×900. |
| **UI-B** · Tokens y primitivas | **Hecho** (12 nov 2026, decisiones 88, 89 y 93) | Alturas 36/44 px, un radio, un foco, borde de 3:1; campo de texto, pestañas, chip de filtro; catálogo en `/desarrollo/componentes`. |
| **UI-C** · Búsquedas, selectores y desplegables | **Hecho en lo que se ve más; el resto, por pantalla** (13 nov 2026, decisión 100 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`) | Ver «UI-C: qué se migró y qué queda» abajo. |
| **UI-D** · Botones, tipografía y formularios | **Hecho en panel y consola** (15 nov 2026, decisión 101 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`) | Ver «UI-D: botones, tipografía y formularios» abajo. |
| **UI-E** · Panel con barra lateral | **Hecho para el panel de la organización** (16 nov 2026, decisión 107 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`) | Ver «UI-E: el panel con la estructura de la consola» abajo. Mi espacio se difiere. |
| **UI-F** · Accesibilidad | **Hecho** (16 nov 2026, decisión 111) | WCAG 2.2 AA en escritorio medida con axe y teclado. |
| **UI-G** · Anti-patrones y regiones | **Hecho** (17 nov 2026, decisión 121 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`) | Acentos laterales 39 a 8, degradados 6 a 2, tarjetas anidadas 77 a 10, sin filete superior de color en los directorios del Ecosistema, y un solo `<main>` por pantalla con la cabecera y la navegación fuera de él (`PortalLayoutComponent` y armazones propios). Quedan los casos aprobados (G6) y los marcadores de pestaña activa. |

### UI-C: qué se migró y qué queda

**Dos mecanismos, a propósito.** (1) **La pieza**: en las pantallas donde el control es un filtro o una búsqueda se sustituyó por
las primitivas (`app-buscador-de-lista`, `app-filtro-desplegable`, `app-pestanas`, `app-barra-de-lista`). (2) **La regla única**:
un solo bloque de `styles.css` (`:where(select:not([multiple]):not([size]))`, fuera de las capas) viste a **todo** `<select>`
nativo que queda con 36 px, radio de 8, borde de 3:1, flecha propia y el anillo de foco; ninguna utilidad suelta (`rounded-xl`,
`py-3`) puede moverlo, y `data-tamano="menudo"` lo baja a 24 px. Así, lo que aún no se migró no vuelve a medir 21, 40 o 47 px.

| Zona y pantalla | Antes | Después |
|---|---|---|
| Directorios del Ecosistema (`app-directorio-ecosistema`: Mercados, Lutería, Espacios, Redes y, desde SEG, Festivales) | Un `<input>` en una caja con radio de 16 y 3 o 4 `<select>` con radio de 12 y borde de 1,29:1 | Buscador a 44 px y 3 o 4 desplegables a 44 px a todo el ancho, con el rótulo arriba; el municipio apagado dice «Elige un departamento primero» |
| Directorio de Festivales | Escrito aparte (5 `<select>`) | Lo migró SEG al directorio estándar, así que recibe estas mismas piezas |
| Mapa, panel de filtros | `<input>` y 2 `<select>` de 40 px, radio 12, sin anillo de foco | Buscador y 2 desplegables a 36 px |
| Panel de la organización, `/procesos` | Búsqueda, territorio, tipo y estado de **21 px y radio 0** (`.campo__rotulo` sin estilo de control) | Barra de lista a 36 px (2 buscadores y el tipo como filtro) y **pestañas de estado con conteo** |
| Consola, Espacios, Redes y Talleres | 1 `<input>` y 2 `<select>` de 40 px con `rounded-lg border-slate-300` | Barra de lista (buscador y «Responsable») y pestañas de estado; la consulta se hace al escribir, con espera de 300 ms |
| Consola, textos del sitio y perfiles públicos; panel, Festivales históricos | `<input type="search">` con su caja | `app-buscador-de-lista` con el rótulo visible de la pantalla |

**Lo que queda (UI-D y por pantalla).** Los ~108 `<select>` de **campos de formulario** (fichas de Festival, Mercado, Espacio,
Red y Taller; asistentes; ingreso y registro; altas de la consola) siguen siendo nativos con la regla única: medirlos de nuevo da
36 o 44 px y un solo radio. Falta pasar a `app-campo-de-seleccion` los de lista corta y a `app-filtro-desplegable` los de
departamento y municipio, que requiere reescribir los recorridos Playwright que hacen `selectOption`. Tampoco se tocaron la
Agenda, Noticias y el Catálogo editorial del portal, cuyo diseño aprobó G6. **Lo hizo UI-D** (abajo), salvo esos tres.
**Medida automática:** `selectores_nativos` del trinquete baja de 124 a 108 y no puede volver a subir.

### UI-D: botones, tipografía y formularios

**Botones.** Un solo juego: las cinco importancias de `clasesDeBoton` (principal, secundaria, terciaria, confirmar y destructiva) por tres alturas de los
tokens (24, 36 y 44 px). `app-boton` se queda para lo que no lleva atributos propios; los **188 botones y enlaces escritos a mano** con firmas de
clases propias (`rounded-lg border border-slate-300 px-4 py-2…`) pasan a la directiva **`appBoton`** (`<button appBoton="secundaria" tamano="menudo">`), que
viste el elemento nativo con la **misma** función de clases y por eso conserva `data-testid`, `aria-*`, `form` y `routerLink`. En panel y consola el tamaño
es el normal (36 px); el cómodo (44 px) queda para ingreso, registro y diálogos. Los botones que son un enlace dentro de un texto, una pestaña, un conmutador
o un icono no se tocan (no son una acción de la jerarquía).

**Tipografía.** La mayúscula sostenida sale de panel, consola y piezas compartidas: se quitó `uppercase` (y el `tracking` que la acompañaba) de rótulos de campo, botones,
pestañas, avisos y cabeceras de tabla, y `text-transform: uppercase` de los estilos de esas pantallas. **Se conservan los títulos** (`<h1>` a `<h3>`) y los archivos de
Agenda, Noticias y Catálogo editorial (G6). `mayuscula_sostenida_en_plantillas` baja de **419 a 157**.

**Formularios.** 81 `<select>` de campos de formulario pasan a las piezas (56 usos de `app-campo-de-seleccion` y 27 de `app-filtro-desplegable`, que incluyen los nuevos): las listas cortas a `app-campo-de-seleccion` (las opciones se escriben dentro de la
etiqueta, con su `@for`; `comoNumero` y `vacioComoNulo` reemplazan a `[ngValue]`) y departamento y municipio a `app-filtro-desplegable`, que ahora es también un
campo de formulario (`ngModel`, `required`, `[invalido]`, buscador desde nueve opciones) y recibe sus listas con el pipe `opcionesDesde`. Quedan nativos los de Agenda y
Catálogo editorial (G6), los de celdas de tabla y los que llevan el valor enlazado a mano. `selectores_nativos` baja de **108 a 27**. Los recorridos Playwright usan
`e2e/apoyo/desplegable.ts` (`elegirEnDesplegable`: se abre y se pulsa la opción por posición, texto o valor); los `select[name=…]` de las listas cortas siguen valiendo porque el
`name` viaja al `<select>` real.

**Búsqueda de la cabecera de la consola.** Pasa a `app-buscador-de-lista` con el tono `oscuro` y los atributos de `combobox` (`combobox` como entrada); el listado de secciones y sus
flechas siguen en la pantalla.

**Lo que se difiere.** Los 16 `<select>` de Agenda y Catálogo editorial (G6), los selectores de celda (rol del equipo, estado de una edición) y la reducción de los 157 usos de
mayúscula sostenida que quedan en títulos; el CSS muerto de `.header-search` en `admin-shell-header.component.css` se retira en UI-G con el resto de anti-patrones.

### UI-E: el panel con la estructura de la consola

**Una sola estructura para las dos áreas.** El panel de la organización (`/gestion/o/{id}/…`) pasa de «barra pública + cabecera de la organización + siete pestañas
horizontales» a la rejilla de la consola: **cabecera propia** (marca, búsqueda de secciones, avisos y menú de cuenta), **barra lateral** con la organización activa arriba y
grupos plegables, y el **contenido a la derecha**. El armazón de la aplicación ya no pinta la barra pública ni el pie en esas direcciones (`NavigationService.enPanelDeOrganizacion`);
Mi espacio y la pantalla de entrada siguen con la barra pública.

| Pieza | Qué es | Dónde vive |
|---|---|---|
| Hojas de la estructura | `cabecera.css` y `estructura.css`, **las mismas** que usa la consola (se movieron de `features/admin/admin-shell-page` a `shared/components/layout/espacio-de-trabajo/`) | Una sola definición de alturas, foco, buscador oscuro, menú de cuenta, rejilla de 272 px, grupos, destinos y pie |
| Cabecera del panel | `app-cabecera-del-panel`: marca de texto, `app-buscador-de-lista` en tono oscuro con atributos de `combobox`, campana de avisos (tono `oscuro`) y menú de cuenta (Mi espacio, Perfil público, Datos personales y seguridad, Mis organizaciones y Cerrar sesión; conserva los `data-menu-*` de antes) | `features/panel-organizacion/` |
| Barra lateral | La organización arriba y fija (nombre en dos líneas como máximo, **solo el rol**, ubicación y, con varias, `app-campo-de-seleccion` «Cambiar de organización» con `id="selector-organizacion"`), `<nav>` con tres grupos plegables y «Ver el portal público» al pie | `panel-organizacion-page.component` |
| Secciones y grupos | `secciones-del-panel.ts`: **Trabajo** (Resumen, Solicitudes), **Procesos y herramientas** (Procesos, Eventos, Herramientas) y **La organización** (Datos de la organización, Archivos de la organización, Equipo). Las etiquetas y las rutas no cambian; es la lista del menú, del buscador y de las pruebas | `features/panel-organizacion/secciones-del-panel.ts` |
| Plegado | La lógica de la consola (`grupos-plegables-de-la-barra.ts`) con clave y omisión propias: se recuerda por cuenta (`simus.panel.grupos-plegados.{cuenta}`), ningún grupo nace plegado y el que contiene la sección que se ve no se pliega nunca | `features/admin/domain/` |

**Sin «Actuando como», sin distintivo.** La cabecera dice quién eres (el menú de cuenta) y la barra dice en qué organización estás y con qué rol (`Administrador` o `Editor`). Se quitó el distintivo
de iniciales con degradado: el nombre ya identifica a la organización. Los avisos de la parte superior del contenido (cambio de organización, bienvenida a quien aceptó una invitación o registró la
organización, error del perfil) son un cuadro de un solo borde y sin acentos.

**Lo que se limpió en el panel.** 67 apariciones de acento lateral (`border-l-2/4`, en avisos y citas) pasan a un borde completo con el color del estado (`acentos_laterales` 106 → 39); las dos filas de
la ficha de Festival y de Mercado que marcan la pestaña activa de su barra vertical se conservan (es una selección, no un adorno).

**Desborde de la barra lateral (abajo y al lado), en las dos áreas.** La estructura compartida garantiza: (1) la barra mide siempre el alto de la ventana menos la cabecera y recorta (`overflow: hidden`);
(2) **solo se desplaza la lista**, en vertical, con el último destino siempre alcanzable; (3) el pie («Ver el portal público») es un hermano de alto fijo con su aire de abajo —antes su texto caía a
10 px del borde y con una ventana baja parecía cortado—; (4) ningún rótulo, título de grupo ni insignia se sale por el lado: el rótulo se corta con puntos suspensivos; (5) el contenido tiene
`min-width: 0`, así que una tabla ancha no empuja la página. Medido a 1280×560, 1280×640, 900×700 y 1440×480, con todos los grupos de la consola desplegados y un nombre de organización de 100 caracteres:
**cero desborde lateral, último destino alcanzable y pie dentro de la ventana** (`<carpeta-de-informes>/ui-e/`, `guiones/estres.cjs`).

**Lo que se difiere.** **Mi espacio** (cuatro pestañas: coordinar con ME) y los avisos y las tablas internas de cada sección del panel, que siguen con su diseño. Las dos fichas verticales
de Festival y de Mercado conservan su barra interna. ~~La insignia de Solicitudes pendientes en la barra del panel~~ (hecha en SOL: `GET /externo/organizaciones/{id}/solicitudes/conteo`). UI-F (accesibilidad) y UI-G
(el resto de tarjetas y acentos) siguen pendientes.

### UI-F: accesibilidad (WCAG 2.2 AA, escritorio)

Revisión en el navegador con axe-core (40 pantallas de consola, panel de la organización, acceso externo, Mi espacio y portal) y con teclado; los hallazgos, lo corregido y lo que queda están y la decisión en `docs/referencia/20-decisiones-y-flujos-por-modulo.md` (111).

| UI de este documento | Qué se hizo |
|---|---|
| UI-10 (foco) | **Verificado**: el anillo único se ve en los primeros destinos de Tab de portal, consola y panel; el enlace de salto lleva al contenido; menú de cuenta, diálogo y desplegable devuelven el foco al cerrar |
| UI-13 (pestañas, menús) | El desplegable de filtro tiene nombre con el valor elegido («Departamento: Antioquia») y su lista es válida para ARIA; el menú de cuenta y el diálogo se recorren con teclado |
| UI-14 (contraste) | `slate-500` y `slate-400` del tema se oscurecen (`#4f5f78` y `#5b6c85`); el color de marca como texto se oscurece con `color-mix`; el 404 con botón claro sobre fondo oscuro |
| Piezas | `app-buscador-de-lista` nombra su campo si la pantalla no enlazó un `<label for>`; `div[app-dato-en-lectura]` es el hijo válido de un `<dl>`; los botones de icono llevan nombre; los enlaces de icono miden 24 px |

**Se queda fuera:** separar el banner y la navegación del `<main>` global en la consola y el panel, los encabezados de las fichas del panel, lector de pantalla real, móvil y tema oscuro.
La pasada automática se repite con `e2e/accesibilidad-axe.spec.ts` y `e2e/accesibilidad-teclado.spec.ts` (`SIMUS_BASE_URL` apunta al entorno con la siembra de demostración).

## 30.15 Estándar de estados de carga (lote CAR, 17 nov 2026)

Decisión 117 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`; hallazgos y mediciones Es la regla para cualquier lista, ficha, tabla o encabezado que espera datos, en el portal, la consola y el panel.

1. **La estructura siempre está.** Mientras llegan los datos se dibuja `app-esqueleto` con la variante de lo que reemplaza: `tarjeta` (noticia, directorio en cuadrícula), `fila` (lista), `ficha` (portada y párrafos), `tabla` (cabecera y filas) o `encabezado`. Reserva el mismo tamaño que el contenido final: no hay salto de diseño al llegar los datos.
2. **Aparece de inmediato.** La señal de carga parte en `true` desde su valor inicial, no desde `ngOnInit`; no hay retardo ni «esperar 300 ms antes de mostrarlo».
3. **Animación sutil y corta.** Un parpadeo de opacidad de 1,2 s, sin barrido de luz ni círculos que giran; con `prefers-reduced-motion` no hay animación.
4. **Accesible.** `aria-busy="true"` en el esqueleto y **un solo** texto para lector de pantalla (`etiqueta`), no uno por bloque. La etiqueta dice qué se carga («Cargando las noticias…»).
5. **El vacío real, solo al terminar.** El orden es siempre `@if (cargando) { esqueleto } @else if (error) { error } @else if (vacio) { «no hay resultados» } @else { datos }`. Las cifras («0 de 0 publicados», «Mostrando 0–0 de 0») no se enseñan mientras carga: llevan un guion.
6. **Transición breve.** El contenido que reemplaza al esqueleto entra con `.aparece` (fundido de 120 ms, nunca más de 150).
7. **Agilidad sin engaño.** Se piden en paralelo las peticiones independientes; lo que una lista ya trajo se reutiliza al abrir su ficha **y se revalida en segundo plano**; las pantallas del portal se precargan en segundo plano (no la consola); no se precargan datos por si acaso.
8. **Prohibido** un párrafo suelto «Cargando…» o «Consultando…», un `animate-spin` o `animate-pulse` hechos a mano. Las listas de la consola usan `app-estado-de-lista tipo="cargando"`, que ya usa la pieza. El trinquete lo vigila (`cargando_sueltos`).

## 30.16 El mapa del portal: vistas, consulta y exportación

Decisión 116 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`; hallazgos

- **Un solo conjunto de filtros.** Buscar, departamento, municipio, capa y lente están en la columna izquierda en las tres vistas y en la dirección (`?vista=tabla&capa=Festivales&departamento=…`). Cambiar de vista no los pierde.
- **Un solo conmutador.** Mapa / Gráfico / Tabla es el selector segmentado común (forma `segmentado`: un objeto con borde y posiciones dentro, sin subrayado) que también usa la Agenda para Día / Mes / Rango. La forma `subrayado` queda para las pestañas de estado de las bandejas (regla 2 de §30.13).
- **Gráfico.** Siete lecturas en la tira de cifras; una sola figura por lectura (barras) y «Exportar» (PNG, SVG, CSV).
- **Tabla de consulta.** Columnas elegibles, orden, paginación (25/50/100) y exportación (CSV y Excel) de todo el resultado, no solo de la página. Solo datos públicos.
- **Exportación.** Todo archivo trae título, filtros aplicados, fecha de generación y la fuente: «Sistema de Información de la Música (SIMUS) — Plan Nacional de Música para la Convivencia».
- **Tarjetas.** La del directorio y la del evento comparten medidas: título primero, una línea de contexto, sin acentos laterales ni tarjetas anidadas. El evento no muestra su proceso ni su organizador; se leen en su ficha.
- **Selector segmentado.** Ocupa todo el ancho de su bloque, con segmentos de igual ancho y el texto centrado (decisión 130).
- **Agenda.** Sin filtro «Tipo de proceso»: un evento ocurre en el marco de un proceso, no es un festival ni un mercado.
- **Recorrido guiado (18 nov 2026, sin decisión nueva).** El recorrido del mapa se actualizó a la versión final y pasó a **16 pasos**: bienvenida, capas, filtros compartidos, lente, los tres dibujos (coropleta, símbolos, calor), leyenda, lectura por departamento y municipio, las tres vistas, el gráfico (lecturas y exportación con fuente), las barras por departamento, la composición, la tabla de consulta con su exportación, teclado y lector de pantalla, y el directorio con la agenda. Cada paso deja puesta la vista que explica y señala un apartado marcado con `data-tuto`; la tabla gana el suyo (`consulta`). La tarjeta usa la escala tipográfica común, anuncia el paso nuevo en una región viva y respeta `prefers-reduced-motion` por la regla global. Los filtros del mapa son los territoriales (departamento y municipio), la búsqueda, la capa y el lente: **no hay filtro por sede en el mapa** (la sede principal se filtra en la consola, §30.17), y el recorrido no lo anuncia.
- **Textos editables del recorrido y claves de respaldo.** El recorrido lee las claves nuevas `map_recorrido_1_title` a `map_recorrido_16_desc` (grupo «Recorrido guiado del mapa»). Las claves `map_tutorial_1_title` a `_18_desc` **no se borran ni se renumeran**: quedan como respaldo (grupo «Recorrido anterior (respaldo, ya no se muestra)»), con su contenido intacto, porque la siembra del catálogo no pisa lo publicado y un texto editado bajo `map_tutorial_13` a `_18` habría caído en otro paso al renumerar en. Ninguna pantalla las lee; `npm run cms:huerfanas` las exime por nombre de grupo (`GRUPOS_DE_RESPALDO`). El modo explorar sigue el mismo criterio: `map_explorar_capas` (que decía «solo Festivales y Agenda» y cuatro capas «en preparación») queda como respaldo y la pantalla lee `map_explorar_capas_2`. La entradilla de la vista general del mapa (`mapLayersConfig.ts`, texto fijo en código, sin clave de CMS) nombraba solo Festivales, Mercados y Agenda y se corrigió en su sitio. Revisados los textos del sitio, del catálogo y de la siembra: no queda otra afirmación vigente de capas «en preparación» (las etiquetas «Próximamente» son dinámicas y hoy ningún proceso las lleva) y «el Programa» solo sobrevive en comentarios de código. Retirarlas es una decisión aparte, después de comprobar que ninguna tenga texto publicado. El catálogo `web-content-catalog.json`, que había quedado sin regenerar tras (traía los pasos 17 y 18 y `map_explorar_figura`), se regeneró con `npm run cms:catalog`; las filas ya sembradas en la base siguen ahí.

## 30.17 Modelo común de procesos

Principio de la dirección (17 nov 2026): Festivales, Mercados, Lutería, Espacios para música en vivo y Redes y documentación no son desarrollos aparte; parten de un modelo y un funcionamiento comunes, con diferencias solo donde el tipo lo exige. Medido sobre `main` el 17 nov 2026.

| Capacidad | Festival | Mercado | Taller | Espacio | Red | ¿Común? |
|---|---|---|---|---|---|---|
| Estados (borrador, en revisión, ajustes, publicado, rechazado, archivado) | Sí | Sí | Sí | Sí | Sí | Vocabulario común (`etiquetasDeEstados`) |
| Alta y edición en el panel | `ficha-de-festival-page` (804 líneas) | `ficha-de-mercado-page` (969) | `FichaDeProcesoBase` + ficha propia | idem | idem | **B2 hecha** para Taller, Espacio y Red (circuito, territorios, foto y mensajes en la base); Festival y Mercado siguen con su ficha propia (brecha B2b); **lo publicado y las propuestas de Festival ya usan el modelo común** (decisión 153) |
| Responsable | Organización | Organización | Organización o persona | Organización o persona | Organización o persona | Difiere por decisión |
| Revisión por campos y propuestas de cambio | Sí | Sí | **Propuestas de cambio** (decisión 122): errata al instante, cambio de fondo se propone | **Ídem** | **Ídem** | **B3 hecha**: un solo circuito (`PropuestasDeCambioDeProcesoEndpoints`) para Mercado, Taller, Espacio y Red; **Festival también** desde el retiro del perfil público (decisión 153: `FestivalConPropuestas` escribe la cabecera) |
| Ediciones | Sí | Sí | No (sus procesos son eventos) | No | No | Difiere por el tipo |
| Eventos de la Agenda | Sí | Sí | Sí (decisión 104) | Sí | Sí | Común |
| Foto del proceso | Material de la edición | Sin foto propia | **Sí** (decisión 115, `app-foto-del-proceso`) | **Sí** (decisión 120) | **Sí** (decisión 120) | B1 cerrada para Taller, Espacio y Red; falta definir la de Festival y Mercado |
| Importación asistida | `DominioDeFestivales` | `DominioDeMercados` | **`DominioDeTalleres`** (decisión 120) | **`DominioDeEspacios`** (decisión 123) | **`DominioDeRedes`** (decisión 123) | **B4 hecha**; las reglas comunes viven en `ReglasDeProceso` |
| Historial y registro de cambios | Sí | Sí | Sí (también para la persona) | Sí | Sí | Común |
| Lista del panel | Lista única de procesos con filtro de tipo | idem | idem | idem (la lista por tipo de la organización redirige a la única, decisión 122) | idem | Común (decisión 110); la persona sin organización conserva su lista. **En la consola**, Taller, Espacio y Red tienen una lista única con el tipo como pestaña (decisión 132); Festival y Mercado conservan la suya |
| Ficha pública y mapa | Sí | Sí | Sí | Sí | Sí | Común |
| Retiro y archivo con motivo, sin borrar | Sí | Sí | Sí | Sí | Sí | Común; **también al dar de baja la organización** (liberar o archivar, con el conteo previo de eventos de la Agenda; decisión 137) |
| Consulta guiada | Sí | Sí | Sí (decisión 123) | Sí | Sí | **B5 hecha**: `ProcesosConsultables`, una sola implementación |
| Bandeja de Solicitudes | Sí | Sí | Sí (decisión 123) | Sí | Sí | **B6 hecha**: `ProcesosDeLaConsolaService`; «Mi actividad» y la insignia son de SOL |

**Brechas, en orden.** ~~B1~~ foto en Espacio y Red: hecha (decisión 120). ~~B2~~ ficha base para taller, espacio y red: hecha en la lógica (el marcado de los campos sigue en cada plantilla; Festival y Mercado quedan aparte, B2b). ~~B3~~ propuestas de cambio de Taller, Espacio y Red: hecha (decisión 122). ~~B4~~ importación asistida de espacios y redes: hecha (decisión 123). ~~B5~~ consulta guiada de los tres: hecha. ~~B6~~ bandeja de Solicitudes de la consola: hecha. Queda B2b (fichas de Festival y Mercado en el panel; **en lo que toca a la ficha pública y a la propuesta de Festival, cerrada con el retiro de `PerfilesPublicosFestival`, decisión 153**).

**Las listas por tipo de la consola (decisión 132).** Con la bandeja de Solicitudes (B6) y una lista única de procesos en `/administracion/procesos` (pestañas por tipo, estado como filtro, búsqueda, responsable, sede, importación y plantilla), las tres listas de Talleres, Espacios y Redes de la consola se retiraron; sus direcciones antiguas redirigen con `?tipo=` y la ficha de cada registro conserva su dirección. Festival y Mercado siguen con su lista y su ficha propias (B2b).

## 30.18 El espacio externo como un todo: panel de la organización y Mi espacio (PANEL, 17 nov 2026)

Decisión 126 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`; hallazgos y pruebas Responde a una observación textual de la dirección de producto sobre el panel de la organización
tras UI-E (§30.14): «está casi copiándose el diseño del espacio de administración […] no aprovecha el espacio, no es tan claro […] además tiene un montón de mensajes
repetidos. Hay cosas que funcionan muy bien, como tener a la izquierda el rol, el nombre de la entidad y la ciudad; el resto no funciona tan bien». Y a cuatro
comentarios posteriores: profundizar el rediseño, tomar Mi espacio como referencia, invertir pestañas y filtros, una sola escala tipográfica, y que todo el espacio
externo se sienta parte de un todo.

### Antes y después: los problemas (auditoría honesta)

| # | Problema medido o leído en el panel tras UI-E | Qué se hizo |
|---|---|---|
| P1 | **Texto repetido.** El armazón pintaba una descripción de sección («Consulta las prioridades…») sobre cada pantalla, la pantalla repetía su título en un `h2`, y un `h1` oculto decía «Gestión de la organización» en todas; «Resumen» aparecía en el menú, en el título y en la descripción; cada lista de proceso repetía «Procesos · Ecosistema» y «¿Necesitas registrar otro tipo de proceso?»; cada cifra llevaba rótulo y una frase («Registros / Talleres registrados.»); la última actualización se decía dos veces | **Cada pantalla dice una sola vez lo que es**, con `app-encabezado-de-pantalla` (el único `h1`, una frase y un contador discreto en texto). El armazón ya no pone descripción ni `h1`; fuera los kickers, los avisos de «otro tipo de proceso» y las frases por cifra |
| P2 | **Espacio desaprovechado.** El Resumen eran dos columnas con tres cuartas partes vacías («No tienes acciones pendientes.» en un lienzo en blanco); Solicitudes, igual; contenido hasta 106 rem pero sin usar el ancho | Resumen rediseñado como **Inicio** (§ abajo) a todo el ancho; contenido hasta 120 rem con aire lateral que crece; listas y tablas densas |
| P3 | **Navegación poco clara.** Las pestañas de Procesos eran de ESTADO y el tipo estaba escondido en un desplegable; Solicitudes tenía cuatro pestañas heterogéneas («Esperan tu acción», «Actividad reciente»…) y otro filtro de tipo; Eventos no tenía ni lo uno ni lo otro; tres vocabularios para lo mismo | **Pestañas = tipo de proceso; estado = filtro** en Procesos, Solicitudes, Eventos y «Mi actividad y solicitudes», con una sola implementación (`app-pestanas-de-tipo`) y un catálogo único (`tipos-de-proceso.ts`, orden de la decisión 118) |
| P4 | **Copia de la consola sin sentido para una organización externa.** Grupos «Trabajo / Procesos y herramientas / La organización» con la jerarquía administrativa, descripciones al estilo de la consola, tres tamaños de título por pantalla, cajas de cifras | Grupos por lo que la organización hace: **Trabajo, Mis procesos, Mi organización**; se conserva lo que funcionaba (bloque izquierdo con rol, nombre y ciudad, grupos plegables con la elección recordada, filas de proceso) |
| P5 | **Dos sistemas.** Mi espacio llevaba la barra pública, un encabezado de persona con avatar y una caja de navegación; el panel, la estructura de la consola | **Un solo armazón** (`app-armazon-de-gestion`): cabecera, barra lateral con la identidad arriba, grupos, ancho y pie son los mismos; solo cambia el contenido. «¿Cómo quieres entrar?» usa el mismo lenguaje (lista plana, mismos títulos) |
| P6 | **Cajas y líneas.** Tarjetas dentro de tarjetas en Datos personales, Perfil público, Equipo y asistentes; un filete bajo el título y tres recuadros con cifras en Mis espacios, Talleres, Redes, Festivales y Mercados | Se aplanan: una línea fina entre bloques, ninguna caja dentro de otra; los recuadros de cifras pasan a un contador en texto bajo el título |
| P7 | **Tipografía suelta.** 40 combinaciones de familia, tamaño, peso y mayúscula en los encabezados del panel (`font-alternate uppercase tracking-widest`, `text-sm`, `text-titulo`, `text-2xl`…) | **Una escala** (§ Escala tipográfica), aplicada por elemento: ninguna pantalla escribe ya un tamaño de título |
| P8 | **El estado de la cuenta siempre visible.** En el Resumen de Mi espacio, un recuadro con barra de avance y tres tarjetas «Hecho» al inicio aunque todo estuviera completo | Solo aparece cuando **falta** algo (correo o datos); con todo completo no se pinta nada |

**Lo que funcionaba y se conserva:** el bloque izquierdo con el rol, el nombre de la entidad y la ciudad; la barra con grupos plegables y la insignia de Solicitudes; la fila de proceso de la lista única de Procesos; la lista común de solicitudes (SOL).

### Decisiones de diseño

1. **Un armazón para el espacio externo.** `app-armazon-de-gestion` (cabecera propia con búsqueda y menú de cuenta, barra lateral con `identidad`, grupos plegables, contenido a 120 rem como máximo). El panel de la organización y Mi espacio lo usan; cada uno declara sus grupos con `GrupoDeGestion` (`core/navegacion/grupos-de-gestion.ts`). El armazón de la aplicación oculta la barra pública y el pie también en `/gestion/cuenta` (`NavigationService.enPanelDeOrganizacion`).
2. **Identidad arriba de la barra.** Panel: rol, nombre de la entidad (dos líneas) y ciudad; con varias, «Cambiar de organización». Mi espacio: «Mi espacio», nombre y correo. Misma forma, misma hoja.
3. **Grupos por tarea.** Panel: *Trabajo* (Inicio, Solicitudes), *Mis procesos* (Procesos, Eventos, Herramientas), *Mi organización* (Datos, Archivos, Equipo). Mi espacio: *Trabajo* (Inicio, Mi actividad y solicitudes), *Mis procesos* (Procesos, Mis eventos), *Mi cuenta* (perfil público, datos, seguridad, organizaciones, agenda de citas). Los dos primeros grupos se llaman igual.
4. **«Resumen» pasa a «Inicio»** y deja de ser un tablero de cuatro cifras: lo que **requiere acción** (las solicitudes que esperan a la organización, de la misma fuente que Solicitudes), **cómo van los procesos** por tipo y estado (tabla densa con enlaces a la pestaña del tipo), **próximos eventos**, **accesos rápidos** (registrar, anunciar, invitar, editar) y **actividad reciente**. No repite el menú. Los avisos (correo sin confirmar, datos que faltan, registro sin terminar) solo aparecen si hay algo pendiente.
5. **Pestañas por tipo, estado como filtro** (actualiza la regla de §30.13 para estas cuatro pantallas): Todos, Festivales, Mercados, Redes y documentación, Lutería, Espacios para música en vivo (orden fijo del Ecosistema, decisión 118, confirmado por la dirección de producto; «Citas e invitaciones» solo en solicitudes). El estado es un `app-filtro-desplegable` con conteos dentro del tipo elegido. **Las pestañas van primero y los filtros debajo**, en la barra siguiente (buscadores y estado), por indicación de la dirección de producto; Agenda de la consola no se toca. `?tipo=` abre la pestaña (el Inicio enlaza así).
6. **Encabezado único de pantalla.** `app-encabezado-de-pantalla`: `h1`, una frase, contador discreto en texto («7 procesos · 1 en revisión») y acciones a la derecha. Sin filetes ni recuadros de cifras.
7. **Sin cajas dentro de cajas.** Bloques separados por espacio y, si hace falta, una línea fina; las listas son filas con filetes.
8. **Textos con «PNMC»**, no «el Programa», en el panel y Mi espacio. Los textos que genera el servidor (p. ej. «El Programa pidió ajustes») quedan para el lote de API.
9. **Una escala tipográfica** en tokens (`--tipo-*`, `styles.css`) y clases `.t-rotulo`, `.t-texto`, `.t-ayuda`; los `h1`, `h2` y `h3` dentro de `.armazon-de-gestion` la toman por elemento.
10. **Mi espacio con una sola lista de procesos.** Talleres, espacios y redes propios son las pestañas de `/gestion/cuenta/procesos` (el mismo componente que la lista del panel, solo con los tres tipos que la persona registra a título propio). Las direcciones de las tres listas redirigen a su pestaña (`/gestion/cuenta/talleres` → `?tipo=luteria`); las fichas conservan la suya y el menú resalta «Procesos» en ellas.
11. **Los botones flotantes nunca cubren contenido.** El contenido reserva 5,5 rem a la derecha en pantalla ancha, donde flotan la consulta guiada y la ayuda (prueba E2E `boton-flotante-no-cubre`).
12. **Rutas.** No se mueve ninguna; `Resumen` conserva `/resumen`. La etiqueta del menú pasa a «Inicio».

### Escala tipográfica del espacio externo

| Nivel | Token | Familia, tamaño, peso | Uso |
|---|---|---|---|
| H1 | `--tipo-h1-*` | Oswald 28 px / 34, 700, mayúscula inicial | Título de la pantalla (uno por pantalla) |
| H2 | `--tipo-h2-*` | Nunito 18 px / 26, 800 | Bloque de una pantalla |
| H3 | `--tipo-h3-*` | Nunito 16 px / 24, 700 | Título de una fila o de un subbloque |
| Rótulo | `--tipo-rotulo-*` | Nunito 12 px / 17, 700 | Etiquetas de campo y de fila (`.t-rotulo`) |
| Texto | `--tipo-texto-*` | Nunito 14 px / 22, 400 | Cuerpo y descripciones (`.t-texto`) |
| Ayuda | `--tipo-ayuda-*` | Nunito 12 px / 17, 400 | Ayudas, fechas, contadores (`.t-ayuda`) |

Ningún peldaño baja de 12 px (§30.4). La consola puede adoptarla bajo `.armazon-de-gestion` cuando se decida; hoy no se toca.

### Guía breve: qué menú para qué

| Se usa… | Cuando… | Ejemplo |
|---|---|---|
| **Pestaña** (`app-pestanas`, `app-pestanas-de-tipo`) | Cambia la vista o el tipo de contenido de una misma lista; son excluyentes y llevan conteo | Tipo de proceso en Procesos, Solicitudes y Eventos |
| **Lista o menú vertical** (barra lateral) | Es navegación entre secciones | Trabajo, Mis procesos, Mi organización |
| **Filtro desplegable** (`app-filtro-desplegable`) | Afina una lista por un atributo: estado, territorio, responsable | Estado con conteos |
| **Selector segmentado** (`app-selector-segmentado`) | Alterna entre dos o tres modos de visualizar lo mismo | Lista / Mapa; Mapa / Gráfico / Tabla |

Una zona, un menú de cada clase como máximo.

### Qué se comprueba

Karma (armazón, pestañas de tipo, lista de solicitudes, Inicio de la organización y de Mi espacio, rutas), la pasada axe (`e2e/accesibilidad-axe.spec.ts`, ahora con las pantallas del panel y de Mi espacio) y el trinquete: `titulos_con_clases_ad_hoc` (máximo) cuenta los `h1`–`h3` que aún llevan clases de tamaño, familia, peso o mayúscula; baja y no puede subir. Capturas antes y después en `<carpeta-de-informes>/panel/` (1440×900; panel y Mi espacio).

### Segunda vuelta (PANEL2, 18 nov 2026): lo visual, tras la revisión de la dirección

Sin decisión nueva: aplica lo ya decidido (escala única, sin cajas anidadas, piezas comunes) a cuatro observaciones textuales de la dirección de producto.

| Pantalla | Observación | Qué se hizo |
|---|---|---|
| Inicio del panel | «Dejaría los accesos rápidos como iconos con texto debajo […] y con una separación clara entre las diferentes secciones» | Pieza común `app-acceso-rapido` (círculo con el icono de la barra lateral y el texto debajo; sin caja). Los accesos pasan arriba de la columna derecha. Entre secciones hay una línea fina y aire, y una línea vertical entre las dos columnas |
| Inicio de Mi espacio | «Un poco más visual» | Mismo lenguaje: accesos rápidos con icono; cada organización con el círculo de sus iniciales; los tres procesos propios con el icono de su tipo (taller, espacio, red); mismas separaciones |
| Herramientas | «Mejorar el listado de mercados […] y que la gestión de agenda esté dentro de “Agenda de citas”» | Herramientas solo presenta las herramientas, todas con la misma forma (icono, nombre, una frase, «Abrir»). «Agenda de citas» tiene entrada propia (`herramientas/agenda-de-citas`): el listado de ediciones se agrupa por Mercado, con el nombre del Mercado como título del grupo, y el contador resume Mercados, ediciones y agendas. Las rutas de gestión de cada agenda no cambian |
| Datos de la organización | «No entiendo por qué ese tipo de títulos en azul» | Los grupos (Identificación, Contacto, Dónde encontrarla, Qué hace la organización; y en Persona responsable, Quién responde y Su relación con el PNMC) dejan `rotulo-de-seccion` (azul, solo de la consola) y toman H2 y H3 de la escala. La pantalla pasa a dos columnas: el título del grupo a la izquierda y sus datos a la derecha. Las leyendas del formulario de edición usan el rótulo de la escala |

Capturas antes y después (1440 px y 390 px) y comparador en `<carpeta-de-informes>/panel2-resumen/revision-panel2.html`. El trinquete no sube ningún máximo.

### Listados homogéneos: una sola pieza de búsqueda y filtros (LIS2, 18 nov 2026)

Comentarios textuales de la dirección de producto sobre el panel y Mi espacio: estandarizar Eventos y Solicitudes «como en Procesos», separar con más claridad las pestañas del buscador en Procesos «para que no se sienta cortado», y que Espacios, Lutería, Mercados y Redes se parezcan entre sí tomando **Festivales** como referencia. No hay decisión nueva: aplica las decisiones 118, 126 y 132.

- **Una pieza.** `app-herramientas-de-lista` junta las pestañas por tipo (`app-pestanas-de-tipo`, solo si la lista las tiene) y la barra (`app-barra-de-lista`: buscador, filtros y acciones al extremo). La usan Procesos, Solicitudes, Eventos, Festivales, Mercados, «Mi actividad y solicitudes», «Mis eventos» y «Mis organizaciones» de Mi espacio. Las pestañas y la barra van separadas por 1,25 rem; el filete de las pestañas ya no toca a los campos.
- **Mismo orden en todas.** Encabezado (`app-encabezado-de-pantalla`) → herramientas (pestañas de tipo si hay varios tipos; buscador; filtro de estado) → lista. Solicitudes y Eventos ganan el buscador que Procesos ya tenía; Festivales y Mercados ganan buscador y estado.
- **Mismos estados.** Carga con `app-esqueleto`; vacío, «sin coincidencias» y error con `app-estado-de-lista`; ningún párrafo suelto. Mercados usa la misma fila que Festivales (nombre con su indicador de estado, organización y territorio, ediciones y fecha, descripción, «Ver ficha»).
- **Lutería, Espacios y Redes** ya no tienen lista propia (decisión 132 y PANEL): son pestañas de la lista única de Procesos, que es la misma pieza y la misma fila para los tres tipos en el panel y en Mi espacio.
- **Menú de acciones por fila en Mercados (LIS3, 18 nov 2026).** La fila de Mercados ya lleva el mismo menú «Acciones» (`app-menu-de-acciones`) que la de Festivales, alimentado por el mismo modelo de acciones por estado (`accionesDeProceso`, tipo `mercado`): mismos verbos, mismo orden, lo no disponible apagado con su motivo escrito (por ejemplo, enviar a revisión a quien solo edita). Enviar a revisión, retirar de revisión, eliminar el borrador y solicitar el retiro (con motivo obligatorio y la cuenta de eventos de la Agenda que se archivarían) se hacen en la propia lista, con la confirmación común y los endpoints que la ficha ya usa; continuar el registro, atender ajustes, proponer cambios, editar el contacto, ver ediciones e historial abren la ficha en su sección; «Agenda de citas» (solo con el Mercado publicado) abre la herramienta de la organización. La lista de Mercados no trae el estado de la propuesta ni si hay un retiro en trámite, por lo que «Proponer cambios» y «Solicitar retiro» se ofrecen para empezar y la ficha, que sí los conoce, decide el resto; no se añadió ningún campo ni endpoint. No hay acción de «errata» propia de Mercados: la corrección menor de lo publicado es «Editar contacto». Mi espacio no tiene lista de Mercados (sus procesos son los propios: taller, espacio y red), por lo que no cambia.
- **Código sin ruta retirado.** Los componentes `seccion-talleres`, `seccion-espacios` y `seccion-redes`, sin ruta desde la decisión 132 y sin uso en plantillas, rutas ni pruebas, se eliminan. Su baja mueve el mínimo `enlaces_de_router` del trinquete de 216 a 213 (sello `_resellado_mercados_18_nov_2026`); ningún otro mínimo baja ni máximo sube.

### Diferido y preguntas abiertas

- Los textos de las filas que construye el servidor («El Programa pidió ajustes») dicen «el Programa»: cambio de API, otro lote.
- Fichas de Festival y de Mercado, y asistentes de alta: heredan la escala de los encabezados pero conservan su barra interna y sus campos; el rediseño profundo de las fichas es otro lote.
- La consola no adopta la escala hasta que se decida.
- Resuelto con la dirección: el orden es el de la decisión 118 y la pestaña se llama «Citas e invitaciones».

## 30.19 Una herramienta de búsqueda no abre con lista: procesos históricos (lote HIST, 17 nov 2026)

Una herramienta cuyo trabajo es **encontrar** algo entre muchos registros ajenos no abre con una lista ni con sugerencias: abre con el buscador y una instrucción, y los resultados salen cuando la persona busca. La excepción es una **coincidencia fuerte** que decide el servidor y explica con su motivo en lenguaje claro; sin ella, el estado inicial es limpio (decisión 129).

- **Cinco tipos (decisión 131).** La misma herramienta lista y reclama Festivales, Mercados, Redes, Lutería y Espacios; la ficha pública de cada uno ofrece pedir su administración con `app-aviso-de-registro-historico`.
- **Piezas.** `app-buscador-de-lista` (nombre u organizador anterior), `app-filtro-desplegable` (tipo, departamento y municipio, este apagado hasta elegir departamento) y `app-esqueleto`; el vacío «no hay coincidencias» solo se pinta al terminar la carga (§30.15).
- **La URL.** Los filtros viven en la dirección (`buscar`, `tipo`, `departamento`, `municipio`): se comparten, se recargan y vuelven con «atrás». Cada cambio reemplaza la entrada (`replaceUrl`).
- **Lo destacado.** Una tarjeta con coincidencia fuerte lleva una etiqueta con el motivo («Coincide con tu organización: …»); no se oculta nada ni se reordena lo que la persona buscó, salvo que la coincidencia fuerte va primero.
- **Accesibilidad.** El formulario es `role="search"`; el cambio de resultados se anuncia con una región `aria-live="polite"`.
