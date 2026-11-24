# 14. Criterios reutilizables de diseño de interfaz

**Decisión:** SIMUS ya tiene un sistema de diseño: los tokens de `@theme static` en
[`styles.css`](../../simus-web/src/styles.css), las piezas de `shared/components/ui` y los trinquetes de
`simus-web/trinquete/`. Este documento no crea otro. Fija qué se consolida, con qué evidencia y con
qué regla se admite algo nuevo.

Las cifras de este documento se midieron sobre el código el 4 de noviembre de 2026
(`simus-web/src/app`, sin pruebas). Son un punto de partida; el trinquete es la fuente que se
mantiene al día.

## 14.1 Lo que ya está consolidado

| Aspecto | Fuente única | Estado |
|---|---|---|
| Tipografía | Cinco peldaños: `text-dato` 12 px (suelo), `text-cuerpo`, `text-lectura`, `text-destacado`, `text-titulo` | En uso: `text-dato` 549 veces, `text-titulo` 179, `text-cuerpo` 159 |
| Papeles del texto | `--color-rotulo`, `--color-valor`, `--color-prosa`, `--color-seccion`, `--color-aviso` | En uso (5 a 40 veces cada uno) |
| Altura de controles | `--spacing-control-minimo` (24 px, WCAG 2.5.8), `--spacing-control` (36 px), `--spacing-control-comodo` (44 px) | `--spacing-control` en 24 sitios; el mínimo y el cómodo en 4 y 2 |
| Hueco del lanzador flotante | `--spacing-lanzador-flotante` | En uso en 1 sitio (el pie fijo de revisión) |
| Estados | `app-indicador-de-estado` (25 consumidores), `app-estado-de-lista` (22), `app-lista-sin-filas` (8) | `pildoras_de_estado` en 0: no quedan literales |
| Acciones y contenedores | `app-boton` (35), `app-menu-de-acciones` (14), `app-confirmacion` (12), `app-panel-lateral` (8), `app-dialogo-de-formulario` (6) | En uso |
| Listados | `app-barra-de-lista` (12), `app-buscador-de-lista` (11), `app-filtro-desplegable` (10), `app-cabecera-de-tabla` (10), `app-selector-segmentado` (15) | En uso |
| Lectura de datos e historia | `app-dato-en-lectura` (9), `app-historial-de-registro` (9) | En uso |

Esto responde la mitad de «tipografía, espaciado, estados y contenedores»: **ya existen y hay que
usarlos, no redefinirlos**. Una pantalla que se interviene consume estas piezas antes de escribir
clases propias.

## 14.2 Patrones confirmados que faltan consolidar

Un patrón está *confirmado* cuando se repite en varias pantallas **y** hay dos o más versiones en
competencia o un defecto medido. Quedan en orden de prioridad.

### P1. Campo de formulario: dos estilos en competencia

Hay dos conjuntos de clases largas repetidas casi a la letra:

- Borde `slate-300`, foco con anillo (`focus-visible:ring-2`) y borde `verde-medio`: 54 repeticiones
  idénticas de una variante y 17 de otra; `border-slate-300` aparece en 36 ficheros.
- Borde `slate-200`, foco solo con `focus:border-morado`, sin anillo: 30 repeticiones; `border-slate-200`
  aparece en 67 ficheros.

La segunda variante tiene un indicador de foco más débil. **Criterio:** el estado de foco visible
(anillo) es el que prevalece; la altura sale de los tokens de control. La consolidación puede ser una
clase de componente o un componente de campo; la decisión se toma en la implementación según el
número de pantallas que la usen. Se valida con `campos_sin_rotulo` y `rotulos_de_campo_a_mano`
(ya vigilados) y con el barrido de foco visible.

### P2. Rótulo de sección: tres versiones del mismo papel

El rótulo en mayúsculas sobre un bloque se escribe de tres maneras:

| Versión | Repeticiones |
|---|---|
| `font-alternate font-bold text-dato text-seccion tracking-[0.18em] uppercase` | 30 (y 19 más con filete superior) |
| `font-black text-dato text-slate-500 tracking-wider uppercase` | 28 |
| `font-bold text-[11px] text-slate-400 tracking-widest uppercase` | 17 |

La tercera usa 11 px (por debajo del suelo de 12 px) y `slate-400`, un gris de bajo contraste.
**Criterio:** una sola versión, la primera, que ya usa tokens y respeta el suelo. Las otras dos se
retiran al tocar cada pantalla.

### P3. Neutros: `slate-*` de Tailwind frente a los papeles del texto

Hay 1 305 usos de `text-slate-*`, 623 de `border-*` y 240 de `bg-slate-*`, frente a unos 114 de los
tokens de papel. `slate` no coincide con la escala del proyecto: el comentario de `styles.css`
documenta que esa diferencia ya produjo un defecto visible en Solicitudes.

**Criterio, sin migración masiva:** una pantalla que se interviene sustituye los grises que toca por
el papel que corresponde (rótulo, valor, prosa, sección, filete). No se migra todo en una ola, igual
que `styles.css` ya decidió con los colores literales.

### P4. Defecto: `--color-filete` está declarado dos veces

Está en `styles.css` con dos valores en el mismo bloque `@theme static`: `#E3DFE4` (línea 114) y
`#e7eaf0` (línea 217). En CSS prevalece la última declaración, así que el valor efectivo debería ser el frío
`#e7eaf0`, aunque el primero está documentado como «filete sobre blanco» del proyecto. Conviene
confirmarlo en el navegador antes de decidir. **Acción:** decidir cuál es el
filete oficial y borrar el otro; hacerlo con revisión visual, porque cambia 22 usos.

### P5. Tamaños fuera de escala

Hay 250 `text-[…]` arbitrarios en total. Casi todos son `text-[11px]` (141 usos, concentrados en el
mapa ecosistémico, y por debajo del suelo de 12 px). El trinquete `tamanos_fuera_de_escala` cuenta 1
porque solo mide plantillas del panel administrativo. **Criterio:** el suelo es `text-dato`; ampliar
el ámbito de la métrica al mapa requiere decisión aparte, porque son rótulos de visualización.

## 14.3 Observado, y deliberadamente no consolidado

No toda repetición justifica un token. Se registran sin tokenizar porque no hay defecto medido:

- **Radios.** `rounded-xl` (418), `rounded-lg` (359), `rounded-2xl` (177). Es una escala implícita
  de Tailwind; sin un caso de inconsistencia visible, un token solo añadiría una capa.
- **Sombras.** `shadow-sm` (36) domina; `shadow-2xl` (19) responde a diálogos. Mismo criterio.
- **Espaciado arbitrario.** Los `p-[…]`, `gap-[…]` o `mt-[…]` son pocos (los más repetidos aparecen 3
  veces); no es un problema.
- **Colores literales.** Siguen en 793 como deuda reconocida del trinquete. Aquí no se abre otra
  vía: se baja con el techo.

## 14.4 Regla para admitir un token o componente nuevo

Se crea solo si se cumplen **todas**:

1. Aparece en **tres o más pantallas** o ya hay **dos versiones en competencia** (P1 y P2 son el
   modelo).
2. Hay un defecto o riesgo **medido**: contraste, foco, desborde, área táctil, suelo de texto.
3. Se nombra por el papel que cumple, no por el valor (`rotulo`, no `gris-medio`).
4. Su primer consumidor **migra en el mismo cambio**. Un token sin consumidor se retira.
5. Queda vigilado: una métrica nueva del trinquete o una prueba de la pieza.
6. El comentario del token explica el problema que resolvió, como los ya existentes en `styles.css`.

Lo que no cumpla esto se resuelve dentro de la pantalla y no entra al sistema.

## 14.5 Consumidores y validación

| Qué | Cómo se valida |
|---|---|
| Que no crece la deuda | `npm run trinquete` (las doce métricas de interfaz) |
| Que la pieza funciona | `npm test`, con una prueba por componente compartido |
| Que el código está limpio y compila | `npm run lint` y `npm run build` |
| Contraste, foco, desborde y área táctil reales | `npm run auditoria:interfaz`, herramienta local que necesita frontend, API y base |
| Que cada pantalla intervenida se ve bien | Comprobación en navegador a ancho de escritorio y de teléfono (§10.5) |

Al cerrar una consolidación se actualiza esta tabla de consumidores (§14.1) y se aprieta el techo con
`node trinquete/trinquete-interfaz.mjs --sellar`. El techo solo baja.

## 14.6 Dependencias y siguiente paso

La evidencia sale de la medición del código, no de la auditoría responsive, que sigue pendiente
 y alimenta las correcciones. Cuando esa auditoría entregue sus hallazgos, se revisan
P1 a P5 contra ellos antes de implementar nada.

Implementaciones sugeridas, cada una con su tarea y sin tocar este documento:

1. Retirar el duplicado de `--color-filete` (P4), el cambio más pequeño y seguro.
2. Unificar el rótulo de sección (P2) en las pantallas que ya se intervienen.
3. Consolidar el campo de formulario (P1) a partir de la variante con foco visible.

## 14.7 Qué no incluye

- Rediseñar el portal ni cambiar la identidad de marca.
- Migrar de golpe los colores literales ni las clases `slate`.
- Crear una librería de componentes aparte de la que ya existe.

## 14.8 El directorio de un proceso del Ecosistema (12 nov 2026)

**Es un estándar y vive en un solo componente:** `app-directorio-ecosistema`
(`shared/components/ui/directorio-ecosistema`). Todo directorio público de un proceso —Mercados,
Lutería, Espacios para música en vivo, Redes y documentación— se arma con él y se ve igual que el de
Festivales: columna de búsqueda y filtros a la izquierda, franja de cifras con el conmutador de
vista, «Mostrando 1–12 de N», listado o cuadrícula, estados de carga, error y vacío, y paginación.

**Qué entra por fuera y qué no.** El componente no sabe qué es un taller ni un mercado. Cada
proceso aporta:

| Aporta el proceso | Lo pone el directorio |
|---|---|
| Sus filtros (`FiltroDeDirectorio[]`) y la lógica de filtrar | Encabezado, miga de pan y paso al mapa |
| Sus cifras (`MetricaEcosistema[]`) | Franja de cifras con el conmutador de vista |
| Las dos plantillas del registro (`#listado`, `#tarjeta`) | Búsqueda con «x», orden, «Limpiar filtros (n)» |
| Sus frases (`textosDeDirectorio(singular, plural, femenino)`) | Carga, error y el vacío que dice qué hacer |
| El nombre de su capa del mapa | Paginación de 12 en 12 |

**Piezas de apoyo.** `DirectorioPublicoBase<T>` reúne la lógica común (búsqueda sin tildes,
departamento y municipio dependientes, orden, paginación y las tres primeras cifras): cada proceso
añade solo sus filtros propios y su cuarta cifra. `app-registro-de-directorio` dibuja el registro
estándar, en listado y en tarjeta, para los procesos que no necesitan un marcado propio.

**Reglas que fija.**

1. **Sin mayúsculas sostenidas** (docs/usuario/23-guia-de-estilo-de-textos.md): los rótulos y los botones del directorio llevan
   mayúscula inicial y nada más. Ocupan menos espacio y se leen mejor.
2. **Los filtros salen de lo que hay.** Un departamento, un tipo o una forma de acceso sin registros no
   se ofrece: casi cada elección devolvería una lista vacía.
3. **Cada cambio vuelve a la primera página**, y el municipio se limpia al cambiar de departamento.
4. **Los filtros viajan en la URL** (`?departamento=…`), para que un enlace desde una ficha o desde el
   mapa llegue con el filtro puesto.
5. **El vacío dice qué hacer:** distingue «no hay nada publicado» de «tu consulta no encuentra nada» y,
   en el segundo caso, cuenta cuántos hay y ofrece quitar los filtros.

**Festivales ya es parte del estándar** (DIR-06, decisión 98). Pasó al componente con sus claves del CMS (título, bajada,
región, encabezado de la lista, rótulo del buscador y vacío), que lee la pantalla y le entrega por `titulo`, `subtitulo`,
`etiquetaDeRegion`, `encabezadoDeLista`, `etiquetaBusqueda` y `textos`; la miga de pan puede decir otra cosa que el título
(`migaActual`) y el vacío de una consulta puede traer su propio consejo (`TextosDeDirectorio.vacioConsultaTexto`). El aviso de
una consulta truncada va en el hueco `[directorio-aviso]`. Las fichas de detalle de los cinco procesos comparten una
disposición: lo que es el registro y sus prácticas a la izquierda (dos tercios), sus datos y su presencia pública en la barra
lateral (un tercio) y, debajo, lo que se repite (ediciones, mercados, registro histórico).

## 14.9 Tokens de control y primitivas compartidas (UI-B, 12 nov 2026)

El barrido de diseño de `docs/desarrollo/30-consola-y-acceso.md` midió **129 campos en 59 pantallas**: 8 alturas de búsqueda, 4 de selector
nativo, 5 radios, 8 tratamientos de foco y un borde de campo de 1,29:1 sobre blanco. Esta sección fija la base
común sobre la que migran los lotes UI-C a UI-G; **no migra pantallas completas**.

### Los tokens (en `styles.css`, bloque `@theme static`)

| Token | Valor | Para qué |
|---|---|---|
| `--spacing-control-minimo` / `--spacing-control` / `--spacing-control-comodo` | 24 / 36 / 44 px | Altura del control: celdas y controles en línea; áreas de trabajo; formularios, ingreso y directorios públicos |
| `--radius-control` | 8 px (`rounded-control`) | Un solo radio para todo control, botones incluidos |
| `--color-borde-campo` / `--color-borde-campo-hover` | `#8892a4` / `#5f6b80` | Contorno de un campo: 3,14:1 sobre blanco (WCAG 1.4.11 pide 3:1). El borde decorativo sigue siendo `--color-filete` |
| `--color-foco`, `--anillo-foco-ancho`, `--anillo-foco-separacion` | morado de marca, 2 px, 2 px | El anillo de foco único. La utilidad `foco-simus` lo aplica con `:focus-visible` |
| `--color-peligro` / `--color-peligro-suave` | `#b42318` / `#fef3f2` | Error y acción destructiva: 6,5:1 sobre blanco. Color con función, no decoración |
| `--shadow-menu` | sombra de un menú flotante | La única sombra de la interfaz, junto a la del diálogo |

La escala tipográfica ya existía (`text-dato`, `text-cuerpo`, `text-lectura`, `text-destacado`, `text-titulo`) y no se toca.

### Las primitivas (`shared/components/ui`)

| Pieza | Selector | Qué aporta | Cuándo usarla |
|---|---|---|---|
| Campo de texto | `app-campo-de-texto` | Etiqueta superior enlazada, ayuda, error (`app-error-de-campo`), `aria-invalid`, obligatorio, 36/44 px, lupa y «✕» opcionales, multilínea; funciona con `ngModel` y con formularios reactivos | Todo campo de una línea o de varias de un formulario |
| Campo de selección | `app-campo-de-seleccion` | El `<select>` nativo con etiqueta superior enlazada, ayuda, error, `aria-invalid`, opción vacía y 36/44 px; `ngModel` y formularios reactivos (UI-C) | Una lista **corta** (hasta 7 opciones) dentro de un formulario |
| Buscador de lista | `app-buscador-de-lista` | Espera de 300 ms (0 si se filtra en memoria), «✕», Escape; entrada `tamano` (36/44 px); `etiquetaVisible` cuando la pantalla ya pinta su rótulo | La búsqueda de una barra de lista y la de un directorio |
| Desplegable | `app-filtro-desplegable` | Combobox con teclado, buscador a partir de un umbral; entrada `tamano`, `completo` (a todo el ancho) y `deshabilitado` | Listas medianas y largas y todo filtro de una lista; sustituye al `<select>` |
| Selector múltiple | `app-selector-multiple` | Casillas en el menú y resumen en el control | Varias opciones a la vez |
| Botón | `app-boton` y directiva `appBoton` | 5 importancias, 3 tamaños, `ocupado`, **`motivo`** (por qué está apagado, visible y citado por `aria-describedby`), radio y foco de los tokens | Toda acción |
| Pestañas | `app-pestanas` | `tablist`/`tab`/`aria-selected`/`aria-controls`, flechas, Inicio y Fin, tabulación itinerante, conteo como numeral | **El estado o la vista de una misma lista** (docs/desarrollo/30-consola-y-acceso.md §30.13) |
| Selector segmentado | `app-selector-segmentado` | Dos o tres posiciones de un mismo control | `Lista / Mapa` |
| Chip de filtro | `app-chip-de-filtro` | Valor aplicado con «✕» con nombre accesible | Un filtro activo que se puede quitar |
| Indicador de estado | `app-indicador-de-estado` | Icono + texto, seis tonos | El estado de un registro (nunca una píldora de color) |

**Reglas de uso.** Una sola acción primaria por pantalla; el botón apagado dice por qué; nunca dos filas de pestañas ni dos menús
del mismo tipo en una página; el rótulo del campo va siempre encima y enlazado (nunca un `placeholder` haciendo de rótulo); un
estado no se pinta con un chip ni con una píldora.

**El `<select>` que queda (UI-C).** Cualquier `<select>` nativo del producto lo viste una regla única de `styles.css`
(`:where(select:not([multiple]):not([size]))`, fuera de las capas y de especificidad cero): 36 px, radio de 8 px, borde de 3:1,
flecha propia y anillo de foco único; `data-tamano="menudo"` lo baja a 24 px en una celda de tabla, y `.simus-campo` o un
`<form>` lo suben a 44 px. Así, aunque una pantalla escriba su `<select>` a mano, no puede medir otra cosa; pero el estándar
sigue siendo la pieza: `app-campo-de-seleccion` para una lista corta en un formulario y `app-filtro-desplegable` para todo
filtro y toda lista mediana o larga. **Un filtro de lista = barra de lista** (`app-barra-de-lista` con `app-buscador-de-lista` y
`app-filtro-desplegable`) **+ pestañas de estado** (`app-pestanas`, con conteo si se conoce); el tipo, el territorio y el
responsable son filtros, nunca una segunda fila de pestañas.

**UI-D (15 nov 2026): botones, tipografía y formularios.**

- **Botón: un solo juego.** `clasesDeBoton(importancia, tamano)` es la única fuente de las clases. `app-boton` lo usa; la directiva `appBoton` (`<button appBoton="secundaria" tamano="menudo">`,
  también sobre `<a>`) lo aplica a un elemento nativo que necesita conservar `data-testid`, `aria-*`, `form` o `routerLink`. Se migran los botones con relleno o borde y relleno propios; un enlace de texto
  dentro de un párrafo, una pestaña, un conmutador y un botón de icono no son una acción de la jerarquía y no se tocan. 36 px en panel y consola; 44 px en ingreso, registro y diálogos.
- **Sin mayúscula sostenida** (docs/usuario/23-guia-de-estilo-de-textos.md) en rótulos, botones, pestañas, avisos y cabeceras de tabla de panel, consola y piezas compartidas. Solo los títulos `h1` a `h3` pueden conservarla; las siglas
  se escriben ya en mayúscula. El trinquete `mayuscula_sostenida_en_plantillas` solo baja.
- **`app-campo-de-seleccion` con las opciones dentro** (`<app-campo-de-seleccion etiqueta="…" name="…" [(ngModel)]="…"><option value="">…</option>@for …</app-campo-de-seleccion>`): el `name` viaja al
  `<select>` real, `comoNumero` y `vacioComoNulo` traducen el valor (no se admite `[ngValue]` aquí), `pruebaId`, `invalido` y `descritoPorExterno` cubren un error pintado fuera y `(salir)` sustituye a `(blur)`.
- **`app-filtro-desplegable` en un formulario.** Admite `ngModel`, `required`, `obligatorio`, `invalido`, `idDelControl` (el `id` del botón, para el `<label for>`) y `(salir)`; sus opciones salen de una lista
  con el pipe `opcionesDesde:'valor':'texto':'Selecciona'[:true para nombre propio]`. Una persona lo usa abriéndolo y pulsando una opción; las pruebas, con `elegirEnDesplegable` (`e2e/apoyo/desplegable.ts`).
- **`app-buscador-de-lista`** añade el tono `oscuro` (cabecera de la consola) y la entrada `combobox` (ARIA de una lista de resultados que pinta la pantalla).

**UI-E (16 nov 2026): una estructura para consola y panel.**

- **La rejilla es una sola.** Cabecera (`cabecera.css`), barra lateral y contenido (`estructura.css`) viven en `shared/components/layout/espacio-de-trabajo/` y las usan la consola y el panel de la organización. Una pantalla
  de gestión nueva (un espacio con varias secciones) **no escribe su propia barra**: usa `.foundation-sidebar`, `.sidebar-secciones` (con `appIndicaMas`), `.sidebar-grupo-titulo`, `.sidebar-item` y `.sidebar-portal`.
- **Qué lleva la barra.** Arriba y fija, el contexto (la organización activa con su rol; en la consola, nada); después un `<nav>` con nombre y grupos plegables (el título es un botón con `aria-expanded`; el grupo con la sección
  que se ve no se pliega; la elección se recuerda por cuenta con `grupos-plegables-de-la-barra.ts` y su propia clave); al pie, el portal público. Lo único que se desplaza es la lista.
- **Nada se sale.** La barra recorta (`overflow: hidden`), el pie tiene altura de control y aire de abajo, un rótulo largo se corta con puntos suspensivos y el contenido lleva `min-width: 0`. Se mide con `getBoundingClientRect`
  (último destino alcanzable, pie dentro de la ventana, cero desborde lateral) a ventanas bajas y estrechas.
- **Cabecera.** Marca, búsqueda de secciones (`app-buscador-de-lista` en tono `oscuro` con `combobox`), avisos y un solo menú de cuenta. Sin «Actuando como»: la persona está en el menú y el contexto, en la barra.

**UI-F (16 nov 2026): accesibilidad.** Reglas que las piezas ya cumplen y que una pantalla nueva no debe romper (se vigilan con `e2e/accesibilidad-axe.spec.ts` y `e2e/accesibilidad-teclado.spec.ts`):

- **El nombre accesible contiene el texto que se ve** (WCAG 2.5.3): un control con texto visible no lleva un `aria-label` que no lo incluya; si hace falta contexto, va como `<span class="sr-only">` dentro del control.
  `app-filtro-desplegable` dice «Departamento: Antioquia»; un botón de icono lleva `aria-label` (y `aria-hidden` en el icono).
- **Todo campo tiene nombre que no sea su `placeholder`**: `<label for>` o `aria-label`. `app-buscador-de-lista` con `etiquetaVisible` pone el suyo si la pantalla no enlazó el `<label>`.
- **Un `<dl>` solo lleva `dt`/`dd` o un `div` que los agrupe**: para una pareja rótulo-valor se usa `<div app-dato-en-lectura rotulo="…" [valor]="…">`, nunca un elemento propio ni un `<p>`.
- **Nada interactivo dentro de otro** (`role="button"` con un enlace dentro) y ningún `role` que el elemento no admita (`<button role="listitem">`). Una opción de lista de `role="listbox"` es el `button role="option"` dentro de un `li role="presentation"`.
- **Grises de texto**: `text-slate-500` y `text-slate-400` ya cumplen 4,5:1 por el tema; un color de marca como texto se oscurece (`color-mix(in srgb, <color>, #000 55%)`); no se baja la opacidad de un texto.
- **Objetivos de 24 px** como mínimo en un enlace o botón de icono (`size-6`); los encabezados bajan de uno en uno (h1 → h2 → h3).

### El catálogo y cómo se vigila

- **Catálogo (solo desarrollo):** `/desarrollo/componentes`, que no existe en producción (el entorno se sustituye). El guion
  `e2e-audit/catalogo-de-componentes.mjs` deja las capturas a 1440×900 y 1280×800 y **mide** con `getBoundingClientRect` la altura
  de cada campo, buscador, desplegable y botón, el número de radios, el contraste del borde y el anillo de foco; sale con código 1
  si algo no mide lo que dicen los tokens. Es la herramienta para repetir la medición del anexo A de `docs/desarrollo/30-consola-y-acceso.md` tras cada lote.
- **`trinquete:tokens`** (`trinquete/trinquete-tokens.mjs`): falla si falta un token, si el radio o las alturas se mueven sin
  decisión, o si un contraste baja de la norma; y vigila con techos que solo bajan los literales antiguos en CSS
  (`#dfe3ea`, el radio `.7rem`, `text-transform: uppercase`).
- **`trinquete:interfaz`** suma cinco métricas de máximo: `selectores_nativos`, `acentos_laterales`,
  `mayuscula_sostenida_en_plantillas`, `degradados_en_plantillas` y `tarjetas_anidadas` (recorrido de etiquetas; es una
  heurística y se queda corta a propósito: el barrido dinámico encuentra el resto). Cada lote de migración **sella** aquí su bajada.

## 14.10 El esqueleto de carga (CAR, 17 nov 2026)

`app-esqueleto` (`shared/components/ui/esqueleto/`) es la única pieza para decir «está cargando». Decisión 117 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`; regla completa en `docs/desarrollo/30-consola-y-acceso.md` §30.15.

| Entrada | Valores | Para qué |
|---|---|---|
| `variante` | `tarjeta`, `fila`, `ficha`, `tabla`, `encabezado`, `noticias`, `persona`, `formulario`, `concepto`, `articulo` (por omisión `fila`) | La forma de lo que reemplaza, con sus medidas finales |
| `cantidad` | número (por omisión 3 tarjetas, 5 filas, 6 filas de tabla) | Cuántas piezas se dibujan |
| `etiqueta` | texto (por omisión «Cargando…») | El único texto que oye un lector de pantalla |

**Uso.** `@if (cargando()) { <app-esqueleto variante="fila" [cantidad]="4" etiqueta="Cargando las redes…" /> } @else if (error()) {…} @else if (vacio()) {…} @else {…}`, con `cargando = signal(true)`. En una lista de la consola basta `<app-estado-de-lista tipo="cargando" titulo="Consultando las redes…" />`, que la usa por dentro. Al reemplazarlo, `class="aparece"` en el contenido (fundido de 120 ms).

**Qué la hace distinta de lo anterior.** Reserva el tamaño final (sin salto de diseño), aparece en el primer fotograma, anima con opacidad 1,2 s y se apaga con `prefers-reduced-motion`, y tiene `aria-busy` y un solo texto para lector. Sustituye a `app-loading-state`, al círculo de `app-estado-de-lista` y a los párrafos «Cargando…».

**Vigilancia.** `trinquete:interfaz`, métrica `cargando_sueltos` (máximo): cuenta los párrafos «Cargando…» o «Consultando…» y los `animate-spin` y `animate-pulse` de las plantillas; solo baja. Pruebas: `esqueleto.component.spec.ts`, `directorio-ecosistema.component.spec.ts` y `e2e/carga-sin-vacio.spec.ts`.

## 14.12 Búsqueda y filtros comunes (L2, 20 nov 2026; B-1, B-2, A-1, A-3, A-4, A-7, M-2)

Cinco piezas y un patrón que adoptan Agenda, Noticias, Editorial, los directorios y el mapa. Se ven con todos sus estados en `/desarrollo/componentes`.

| Pieza | Selector | Qué resuelve | Regla de uso |
|---|---|---|---|
| Buscador | `app-buscador-de-lista` | **B-1, B-2.** Busca al hacer una pausa (RxJS: `switchMap` + `timer`, 300 ms; Intro adelanta), no repite un texto ya avisado, «X» DENTRO del campo que aparece al instante, Escape borra, entrada `cargando` (indicador, `aria-busy`, aviso «Buscando») | `espera` 300 si consulta al servidor, `0` si filtra en memoria. Es el único buscador: ningún `<input type="search">` suelto. |
| Consulta cancelable | `consultaCancelable()` en `shared/utils/` | La otra mitad de B-1: al llegar un texto nuevo se cancela la petición anterior; las respuestas no llegan desordenadas | Se crea en un contexto de inyección; `cargando()` alimenta `[cargando]` del buscador. |
| Desplegable | `app-filtro-desplegable`, `app-selector-multiple` | **A-3.** El panel se ancla con `position: fixed` contra la ventana (`appPanelAnclado`): flip arriba/abajo, `max-height` igual al espacio disponible con scroll interno (el buscador queda fijo), empuje hacia dentro si se sale por la derecha, opción activa siempre visible, `aria-activedescendant`, Escape y clic fuera cierran, Tab cierra | Nunca `position: absolute` para un panel que puede salirse de su contenedor. Capa `--z-desplegable` (60 mientras no esté declarado). |
| Filtros aplicados | `app-filtros-activos` | **A-1.** Un chip con «X» por filtro (día, mes, rango, departamento…) y «Limpiar filtros» al final de la misma fila, desde el primer filtro | Va JUNTO a los filtros (bajo la barra), no al pie. Sin filtros no pinta nada. El foco pasa al chip siguiente al quitar; región de estado anuncia el cambio. |
| Selector de vista | `app-selector-segmentado [soloIconos]` | **A-4, M-2.** Modos de vista solo con icono (lista, mosaico, mapa, gráfico, tabla, calendario), sutil: elegido = fondo del filete + icono morado | `etiqueta` obligatoria (nombre accesible y tooltip). Va a la DERECHA, en la línea del título: `flex flex-wrap items-end justify-between` y `margin-left: auto`. |
| Enlace de regreso | `app-enlace-de-regreso` | **A-7.** Una sola forma de «volver» desde un detalle: flecha de iconos + «Volver a …», conserva los filtros (`queryParams`) | Arriba a la izquierda, sobre el título. Sustituye a «← Agenda», a «Volver a Festivales» y a los terciarios de consola. |

**Censo de buscadores (20 nov 2026).** Con la pieza común: los 27 usos de la consola, el panel de la organización, el mapa y los directorios del Ecosistema (en memoria, `espera=0`). Quedan fuera de la pieza, por pertenecer a una etapa posterior (Agenda, Noticias y Editorial reescriben su barra): `agenda-page`, `noticias-page`, `editorial-page` (el principal y tres de búsqueda avanzada) y las dos búsquedas de faceta del catálogo editorial de la consola. En todo `simus-web` no queda ningún `debounceTime`: la pausa vive dentro de la pieza.

## 14.11 Capas, barra superior y redes del pie (L1, 20 nov 2026)

**Escala única de capas.** Los `z-index` del portal viven como tokens `--z-*` en `:root` de `simus-web/src/styles.css` y nadie escribe un `z-[NNNN]` nuevo (`z-(--z-dialogo)` en Tailwind, `var(--z-dialogo)` en CSS): `contenido` 10, `barra-de-filtros` 40, `desplegable` y `flotante` 60, `barra-superior` 3000, `dialogo` 3100, `dialogo-sobre-dialogo` 3300, `dialogo-de-gestion` 4500 (`-encima` 4600), `aviso` 9000 (`aviso-de-confirmacion` 9500) y `salto` 10000. El mapa (`features/map`) conserva sus capas internas dentro de su propio contexto. Un `<dialog>` nativo con `showModal()` va en la capa superior del navegador y no depende de estos números.

**Un diálogo no puede quedar dentro de un contexto de apilamiento más bajo que la barra.** Un ancestro con `relative z-10`, `transform`, `opacity < 1` o `isolate` encierra el `z-index` del diálogo: el del boletín (3100) quedaba bajo la barra (3000) porque su contenedor llevaba `z-10`. `e2e/capas-y-estructura-del-portal.spec.ts` lo fija midiendo qué elemento pinta en la zona de la barra.

**Barra superior y filtros.** La barra de navegación es `fixed` en todo el portal y las páginas reservan `--alto-barra-superior` (72 px). Las columnas de filtro de Agenda y Editorial son `sticky` bajo la barra (`top` y alto con ese token, `dvh`) en escritorio y van en flujo en móvil; el pie aparece solo al terminar el scroll en todas las páginas públicas.

**Redes institucionales.** `core/config/redes-institucionales.ts` es la única fuente de YouTube, Instagram, Facebook y X (pie y franja del inicio). La cuenta de X queda PENDIENTE DE CONFIRMAR con comunicaciones del Ministerio.

## 14.13 Noticias y Actualidad (20 nov 2026)

**La regla de las noticias destacadas (N-1).** Se leyó del servidor (`NoticiasEndpoints.ListarPublicas`) y se escribió una sola vez en `features/news/destacadas-de-noticias.ts`. No existe una marca «destacada» en la base ni una fecha de vencimiento: la lista pública trae solo las noticias `publicado` con fecha de publicación llegada, de la más reciente a la más antigua (a igual fecha, la última creada), y **las destacadas son las tres primeras**: la grande y las dos que la acompañan en `/noticias`. Consecuencias: al publicarse una noticia nueva pasa al primer lugar y la tercera baja al listado; una noticia programada (fecha futura) entra el día de su fecha; cambiar la fecha de publicación cambia su lugar; un borrador, una noticia en revisión, rechazada o archivada no ocupa lugar. La regla es clara y no cambia el producto, por eso no lleva decisión nueva en `docs/referencia/20-decisiones-y-flujos-por-modulo.md`. Se muestra en tres sitios: bajo «Narrativas destacadas» del portal (texto editable, clave `noticias_destacadas_regla`, sección «Noticias» del panel de textos), sobre la tabla de la consola de Noticias (texto fijo) y, en esa misma tabla, la marca «Destacada hoy en el portal» en las tres que hoy están arriba. Si se quisiera que el equipo ELIJA las destacadas (una marca y un orden manual), es una decisión de producto aparte: cambia la base y el contrato de la API.

**Inicio, bloque «Actualidad» (H-3).** Medido a 1280 px con la siembra de demostración, Noticias medía 567 px y Próximamente 745 px: 178 px de hueco a la izquierda. Se compararon tres variantes (comparador `revision-visual/noticias-actualidad/comparador-noticias.html`):

| Variante | Altura de Noticias | Lectura |
|---|---|---|
| **A · Más noticias** (la principal y CUATRO secundarias en dos filas) | 709 px (36 px menos que la agenda) | **Elegida.** Llena la altura sin perder la jerarquía (una principal, cuatro iguales) y conserva el ritmo de dos columnas. Con 390 px se siguen viendo dos, como antes |
| B · Descripción de las dos actuales (a todo el ancho, miniatura mayor y resumen) | 775 px (30 px de más) | Más legible por noticia, pero las secundarias pesan casi como la principal y se pierde la jerarquía; sobrepasa la agenda |
| C · Tarjeta principal alta (imagen 4:5) | 764 px (19 px de más) | La foto se recorta mucho y la columna de texto queda con un hueco grande arriba y abajo |

El Inicio pide ahora cinco noticias (`NOTICIAS_EN_INICIO`); las tres primeras coinciden con las destacadas de la página de Noticias.

**Página de Noticias.** Buscador común (`espera` 0, el filtrado es en memoria) con «X», selector de vista solo con iconos, chips con «X» y «Limpiar filtros» (`app-filtros-activos`), filtro por campaña (`?proyecto=<código>`, el mismo código que acepta `/publico/noticias?proyecto=`). Con una campaña elegida es una vista de resultados: sale de TODAS las noticias (también las que hoy son destacadas) y no se pintan las destacadas ni el boletín. El filtro solo se ofrece si alguna noticia cargada (las 50 más recientes) pertenece a una campaña. La pantalla de carga y la de error leen señales (`isLoading()`, `isError()`): con campos sueltos la lista cargada no repintaba el esqueleto en el servidor de desarrollo.

**Animaciones (N-2).** Discretas y con un solo criterio: las fotos de las tarjetas hacen `scale-105` en 500 ms con `--ease-soft` (antes `scale-110` en 700 ms y 1000 ms), el listado entra con `.aparece` (fundido de 120 ms) cada vez que cambian los filtros, la página o la vista, y las transiciones de color, borde y fondo ya no usan `transition-all`. Todo respeta `prefers-reduced-motion` (el bloque global de `styles.css` y `.aparece`).

## 14.14 Movimiento: tokens, transiciones y esqueletos (20 nov 2026)

**Una escala de movimiento.** Duraciones, distancia y escalonado viven como tokens en `:root` de `simus-web/src/styles.css` y nadie escribe un `duration-[…]`, un `cubic-bezier(…)` ni un `animation: … 0.8s` propio:

| Token | Valor | Para qué |
|---|---|---|
| `--dur-rapida` | 120 ms | relevo de esqueleto a datos (`.aparece`), color al pasar el puntero |
| `--dur-media` | 200 ms | transición de interfaz: botón, menú que abre, pestaña, entrada de la página |
| `--dur-entrada` | 500 ms | entrada de un bloque al desplazarse (`appRevelar`, `.anim-entrada`); nada supera 600 ms |
| `--dur-latido` | 1200 ms | el único parpadeo de esqueletos e indicadores (`animate-pulse` ya lo usa) |
| `--distancia-entrada` | 1 rem | cuánto sube un bloque al entrar |
| `--escalon` / `--escalon-tope` | 70 ms / 420 ms | espera entre elementos de una lista y tope (el elemento 20 no espera 1,4 s) |
| `--ease-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | la única curva |

**Utilidades.** `.anim-fundido` (relevo corto), `.anim-entrada` con `style="--i: n"` (entrada escalonada sin esperar a verse), `.anim-desplegable` (menús que salen de un control), `.transicion-ui` y `.transicion-rapida` (transición solo de color, fondo, borde, sombra, opacidad y transformación). Las clases `animate-in fade-in slide-in-from-top-N zoom-in-95` que ya estaban escritas en la barra de navegación y el mapa no hacían nada porque ninguna hoja las definía; ahora existen, con los mismos tokens.

**Solo `opacity` y `transform`.** No se anima `height`, `width`, `top`, `margin` ni `max-height` (el desplegado de Agenda y Editorial con `max-h-[…] transition-all` es la excepción pendiente; ver `coordinacion.md`). `transition: all` desaparece de los botones globales. Toda animación de entrada lleva `backwards`, nunca `forwards` ni `both`: una animación que se queda «en efecto» vuelve al elemento un contexto de apilamiento (la causa del defecto que cubría la barra con el modal de Festival).

**Entre pantallas.** `withViewTransitions` (`app.config.ts`) hace un fundido cruzado de 200 ms con la API nativa de transiciones de vista, solo cuando cambia la PANTALLA (la misma definición de `identidadDePantalla` que decide el desplazamiento: filtrar, paginar o abrir una ficha sin pantalla no anima), nunca con «reducir movimiento» y sin efecto en navegadores sin la API. La entrada de la página (`.animate-page-entrance`) pasó de 600 a 200 ms: un fundido de `<main>` retrasa el LCP.

**Modo reducido.** El bloque global de `styles.css` fija 0,001 ms a toda animación y transición; `appRevelar` no oculta nada y la transición de vista se salta. Lo fijan `e2e/movimiento-y-transiciones.spec.ts` y `shared/directives/revelar.spec.ts`.

**Medición.** `node tools/medir-movimiento.mjs --dist <build> --api <API> --salida <json>` sirve el build con proxy y mide LCP, CLS, animaciones vivas y modo reducido en las 10 rutas públicas principales. Informe y comparador: `<carpeta-de-informes>/revision-visual/O2D-animaciones/`.

**Esqueletos.** Se añadieron las variantes `concepto` (tarjetas de solo texto, Territorios sonoros y Prácticas musicales) y `articulo` (ficha conceptual). Las fichas conceptuales mostraban un «Cargando…» suelto y las listas, una rejilla vacía que saltaba al llegar los datos.

## 14.15 Base visual de la gestión externa: paneles planos y filas con línea solo entre filas (P1, 21 nov 2026)

`app-panel-de-seccion` (`shared/components/ui/panel-de-seccion/`) deja de ser una caja: sin borde, sin sombra y sin relleno propios, con un encabezado de sección (`font-alternate`, 1,375 rem, morado; 1,125 rem en densidad compacta). El fondo sutil lo pone la zona de la pantalla (la banda blanca y la columna lateral `#F3F0EE` del Inicio), no el panel. Una lista dentro del panel con la clase `filas-de-panel` separa cada fila de la siguiente con un filete suave y nunca arriba de la primera ni debajo de la última. `tono="atencion"` conserva un fondo ámbar suave para lo que espera una acción. Las pantallas que quieran que su área de trabajo llegue a los bordes del contenido lo hacen devolviendo el relleno del armazón con márgenes negativos (ver `panel-resumen.component.css`); el armazón no cambia.

Inicio (`panel-resumen`, `agenda-del-inicio`): la distribución en dos columnas se decide por el ancho del contenedor (consulta de contenedor a 60 rem), no por el de la ventana. «Requiere atención» no incluye el archivo sin usar (se descartó en el prototipo); «Últimas acciones» no nombra a la persona que actuó, porque la lectura de solicitudes no trae la autoría.

## 14.16 Menú lateral del espacio externo

`app-armazon-de-gestion` (panel de la organización y Mi espacio) decide la forma del menú con `menu-lateral.ts`, por el ancho de la ventana: menos de 700 px, barra inferior con los cuatro primeros destinos de `grupos` y «Más» (el resto agrupado y el portal público); de 700 a 1099 px, riel de iconos con expansión superpuesta a demanda; desde 1100 px, columna abierta o riel (sin elección, riel por debajo de 1280 px; con elección, manda la elección, guardada en `simus.gestion.menu-lateral` junto con el ancho y descartada si el ancho cambia en más de 400 px). El único control es el botón del pie, «Contraer menú» / «Expandir menú». En riel los destinos conservan su rótulo para lectores de pantalla y muestran uno emergente al pasar el puntero o al enfocar con el teclado (Escape lo descarta). Entradas nuevas: `nombreDeLaIdentidad` (de él salen las iniciales del riel) y `etiquetaCorta` en `EnlaceDeGestion` (nombre de la barra inferior). Los botones flotantes de la esquina inferior derecha suman `--alto-barra-inferior`, que el armazón declara en móvil, para no tapar «Más».

## 14.17 Listas de gestión: tipo, herramientas y tabla (P3, 21 nov 2026)

Solicitudes, Procesos y Eventos eran tres maneras de hacer la misma lista (una fila de pestañas, uno o dos buscadores sueltos, filas de enlaces, tabla con tres botones por fila). Las cinco piezas siguientes las unifican y son la API que reutilizan Equipo y Archivos (`shared/components/ui/`).

**`app-barra-de-tipo`.** Entradas: `opciones` (id, etiqueta, conteo), `elegida`, `etiquetaDelGrupo`, `rotulo` («Tipo») y `controla` (el `id` de la lista, que lleva `role="tabpanel"`). Salida: `elegir`. Pinta los segmentos si caben en el ancho del contenedor (los mide con una copia invisible y un `ResizeObserver`) y, si no, un `app-filtro-desplegable`; no hay punto de corte en píxeles. `opcionesDeTipoDeProceso({ conteos, total, tipos, conOtras })` arma las opciones de procesos con la misma fuente que `app-pestanas-de-tipo`.

**`app-orden-de-lista`.** Entradas: `columnas` (`OpcionDeOrden`: id, etiqueta y `tipo` de valor), `orden` (`EstadoDeOrden`), `etiquetaDeLaLista`. Salida: `cambiar`. La dirección se escribe con palabras según el tipo («A–Z», «Más reciente primero», «Más cercana primero», «Más urgente primero», «Menor primero»). Elegir otra columna reinicia a ascendente. `orden-de-lista.ts` trae `alternarOrden` (regla única del encabezado) y `ordenarFilas` (sin tildes ni mayúsculas, vacíos al final).

**`app-barra-de-herramientas`.** Entradas: `etiqueta`, `tipos`/`tipo`/`etiquetaDelTipo`/`controla` (opcionales), `mostradas`, `total`, `hayFiltros`. Salidas: `elegirTipo`, `quitarFiltros`. Proyecta `app-buscador-de-lista`, `app-filtro-desplegable`, `app-conmutador-de-ojo`, `app-orden-de-lista` y `[extremo]`, colocados por tipo. La cuenta es un `role="status"`; «Quitar filtros» solo existe si algo filtra y la pantalla decide qué reinicia. El orden no es un filtro. En móvil cada control ocupa su línea.

**`app-tabla-de-gestion`.** Entradas: `etiqueta`, `columnas` (`ColumnaDeGestion`: id, etiqueta, `ancho` principal/estado/fecha/media/corta, `ordenable`), `filas`, `clave`, `orden`, `acciones` (función por fila; sin ella no hay columna «Acciones»), `descripcionDeFila`, `atributosDeFila`, `filaAbre`, `detalleAbierto`. Salidas: `ordenar`, `accion`, `abrir`. El contenido de las celdas lo pinta la pantalla con `<ng-template appCelda="id" let-fila>`; el detalle desplegable, con `appDetalleDeFila`. Reglas: rejilla fija para que el estado y la fecha queden alineados; `aria-sort` solo en columnas que ordenan (una que no ordena no lleva botón); el camino accesible a la ficha es el enlace de la celda principal (`tg-titulo`) y el menú, el clic de la fila es un atajo; por debajo de 40 rem del contenedor (no de la ventana) los encabezados desaparecen y cada fila es una tarjeta sin borde, con «Ordenar por» como único control de orden. Clases para las celdas: `tg-rotulo`, `tg-titulo`, `tg-detalle`, `tg-aparte`.

**`app-acciones-de-fila`.** Entradas: `acciones` (`AccionDeFila`: lo de `AccionDeRegistro` más `confirmacion`) y `descripcion`. Salida: `elegida` (`{ id, motivo }`). Un solo control por fila (`app-menu-de-acciones`: la esperada primero, lo irreversible al final y en rojo, lo que no se puede hacer apagado con su motivo escrito). Una acción con `confirmacion`, o de `tono: 'peligro'` (que recibe una por omisión), abre el diálogo común (`ServicioDeConfirmacion`) y solo se emite si se confirma; quien consume recibe la acción ya confirmada, con su motivo.

Consumidores: Solicitudes (`app-lista-de-solicitudes`, también en Mi actividad), Procesos y Eventos del panel de la organización. Specs de cada pieza junto a su código; ejemplo vivo en el catálogo de componentes (`/desarrollo/componentes`).

## 14.18 Biblioteca de archivos, dato con icono y Equipo con tablas de gestión (P4, 21 nov 2026)

P4 de la gestión externa cierra las pantallas secundarias del panel de la organización con las piezas de P3 y dos nuevas.

**Equipo** (`seccion-equipo`). Miembros e invitaciones son `app-tabla-de-gestion` con `tarjetasBajo="estrecho"`; Miembros añade `app-barra-de-herramientas` (buscador `app-buscador-de-lista` y `app-orden-de-lista`). La columna «Acciones» es `app-acciones-de-fila`: las acciones destructivas llevan su `confirmacion` (quitar, salir, revocar) y la pantalla ejecuta `quitarConfirmado`, `salirConfirmado` o `revocar` solo cuando ya se confirmó; `quitar()` y `salir()` conservan la pregunta propia para quien las llame sin pasar por el menú. La regla de la última persona que administra se anticipa: «Cambiar a editor» y «Salir de la organización» salen apagadas con `MOTIVO_CORTO_DE_ULTIMA_ADMINISTRACION`, y la frase completa se lee bajo el nombre.

**Biblioteca de archivos** (`features/panel-organizacion/seccion-archivos/biblioteca-de-archivos.component.ts`). Lee el banco por el canal externo (`BancoDeArchivosService.listar('externo', …)`) de cien en cien páginas hasta tener todos los archivos de la organización (el servidor le fija una cuota de decenas), y la búsqueda, el orden y los filtros se resuelven en el cliente sobre el total, con `ordenarFilas`. La vista (cuadrícula o lista) usa `app-selector-segmentado` con `soloIconos`; la lista es `app-tabla-de-gestion` con la fila que abre la ficha; la ficha es `app-panel-lateral`. Las funciones de lectura (`pesoLegible`, `tipoLegible`, `dimensionesLegibles`) viven en `shared/utils/datos-de-archivo.ts`. No hay barra de cuota (decisión de producto del 13 de septiembre de 2026). La consola sigue con `app-gestion-del-banco`, que no cambió; si algún día ambas deben coincidir, la biblioteca es la candidata a absorberla.

**`app-dato-con-icono`** (`shared/components/ui/dato-con-icono/`). Selector `div[app-dato-con-icono]` dentro de un `<dl>`. Entradas: `rotulo`, `valor`, `icono` (`direccion`, `telefono`, `correo` o un `TipoDeEnlace`), `enlace` (el valor es una dirección web) y `vinculoDe` (`mailto` o `tel`). Un valor es un enlace solo si, completado con `https://`, pasa `esUrlValida`; si no, se lee como texto. Lo que falta se dice «Sin registrar».

**`app-tabla-de-gestion`.** Nueva entrada `tarjetasBajo` (`normal` por omisión, 40 rem; `estrecho`, 28 rem): las reglas de tarjetas se escriben dos veces en los estilos del componente, escopadas a `.tg:not(.tg--estrecha)` y `.tg.tg--estrecha`, porque Angular exige estilos literales; si cambias unas, cambia las otras.

## 14.19 Panel de sección: apartados en vez de filetes (PANEL3, 21 nov 2026)

`app-panel-de-seccion` (`shared/components/ui/panel-de-seccion/`) es la pieza común de un apartado del espacio de gestión. Antes cada bloque era un título y una lista entre dos filetes (`divide-y border-y`); la pantalla se leía como una hoja rayada y no se sentían las secciones. Ahora el panel agrupa lo que va junto con fondo blanco sobre el lienzo de la página, borde de 1 px y aire interior.

Reglas: (1) un solo nivel, sin paneles ni tarjetas con borde dentro de un panel; las filas se agrupan con espacio o con un fondo suave, nunca con filetes; (2) borde sin sombra; (3) el título es un encabezado real (`nivel` 2 por omisión, 3 si vive dentro de otra sección) y nombra la región con `aria-labelledby`; (4) `tono="atencion"` tiñe de ámbar lo que espera una acción y es el único color de estado del panel; (5) la acción se proyecta con el atributo `accion` y el contador es una cantidad breve. Consumidores: Inicio, Herramientas y Datos de la organización del panel de la organización. Spec: `panel-de-seccion.component.spec.ts`; ejemplo vivo en el catálogo de componentes.

## 14.20 Módulos del gestor

**Catálogo** (`features/admin/domain/modulos-del-gestor.ts`). Sale de `navegacion-administrativa.ts` (nombre y descripción de la barra) y expande «procesos» en `talleres`, `espacios` y `redes`; marca como `fijo` los dos que van siempre y como `soloWebmaster` los que `rolesPermitidos` limita al webmaster. `MODULOS_CONCEDIBLES` es lo que se puede dar a un Gestor (15). Los perfiles (`PERFILES_DE_MODULOS`) no son roles ni se guardan: aplicar uno guarda la lista de módulos de la cuenta con un solo `PUT /admin/usuarios/{id}/modulos`, que queda como un único cambio en la Auditoría.

**Pantalla** (`features/admin/admin-modulos-del-gestor/`). `app-modulos-del-gestor` se monta dentro de `app-admin-users-panel` cuando la pestaña es «Módulos del gestor». Usa `app-tabla-de-gestion` con acciones «⋯», `app-barra-de-herramientas` con `app-buscador-de-lista`, `app-panel-lateral` y `app-interruptor`; quitar acceso o aplicar un perfil que quita pasa por `ServicioDeConfirmacion`. Los webmasters no se listan como gestores (los tienen todos siempre); el cajón de un módulo los cuenta aparte.

**Servidor** (`PermisosDeModuloEndpoints`). El interruptor y el `PUT` del conjunto comparten `GuardarConjuntoAsync`, que escribe la bitácora y el registro de cambios (clase «contacto», actor y valores antes y después). Solo el webmaster llega a estas rutas (`ExigeModulo("usuarios")`); un Gestor no puede darse módulos ni dárselos a otros.

## 14.21 Consulta abierta sobre datos públicos con un modelo local

, decisión 171. Plan de origen: «consulta guiada semántica», con la corrección de alcance del 23 de noviembre de 2026 (preguntar lo que sea, no ampliar el banco).

**Principio.** El modelo SOLO interpreta. Cada cifra sale de una lectura determinista de registros publicados; el modelo no ve filas, no escribe SQL y no redacta números. Un resumen en lenguaje natural redactado por el modelo se descartó: la tabla es la respuesta, y el resumen que sí se muestra se construye en el servidor desde la propia tabla, por lo que no puede discrepar de ella.

**Flujo.** (1) El cajón intenta primero la vía rápida: reconocer parámetros contra los catálogos y ejecutar una de las 35 plantillas (`POST /publico/consulta-guiada/consultar`); el servidor también resuelve sin modelo una pregunta idéntica a una plantilla sin parámetros. (2) Si no la reconoce y el servidor declara el modelo disponible, envía el texto a `POST /publico/consulta-abierta/consultar`. (3) El servidor mira su caché de interpretaciones (6 horas, 2.000 entradas, clave = pregunta sin tildes ni signos); si falla, `IInterpreteDeConsultas` llama al modelo. (4) `ValidadorDeConsulta` valida y normaliza; (5) `CargadorDeEntidades` lee la entidad con las lecturas públicas ya existentes; (6) `EjecutorDeConsulta` filtra, agrupa, calcula y ordena en memoria; (7) la respuesta lleva `estado` (`ok`, `sin_modelo`, `no_entendida`, `fuera_de_catalogo`, `ocupado`), `via` (`plantilla`, `modelo`, `consulta_editada`), consulta entendida, «cómo entendí», tabla con fuente, filtros y destinos por fila, `grafico` sugerido (`barras` o `linea`) y sugerencias de preguntas cercanas. Quitar un chip reenvía la consulta estructurada corregida (`consulta`), que se valida de nuevo y no pasa por el modelo.

**Capa semántica pública** (`CatalogoSemantico`). Siete entidades declarativas: `procesos` (festivales, mercados, talleres, espacios y redes, con el campo `tipo`), `festivales` (con prácticas, territorios y periodicidad), `eventos`, `noticias`, `organizaciones` (solo con ficha pública, con su número de procesos), `practicas` y `territorios`. Cada campo declara su tipo, si se agrupa y si se suma. NO hay entidad de personas ni de cuentas, ni campos de contacto, correo, teléfono, organizador, estado de revisión o borrador. Las lecturas son las mismas que usan el portal y la consulta guiada (procesos publicados, agenda y noticias publicadas, organizaciones con ficha pública), de modo que el ámbito público no se reimplementa. El ámbito lo fija el endpoint; ni la pregunta ni el modelo lo pueden ampliar.

**Consulta estructurada y validador.** Esquema: `entidad`, `filtros[{campo, operador, valor}]`, `agrupar[]`, `metrica{funcion, campo}`, `orden{campo, direccion}`, `limite`. Operadores `eq`, `neq`, `in` (valores separados por «|»), `contiene`, `gt`, `gte`, `lt`, `lte`, según el tipo del campo; funciones `count`, `sum`, `avg`, `min`, `max` (las cuatro últimas solo sobre campos sumables). Topes: 6 filtros, 2 agrupaciones, valores de hasta 80 caracteres sin caracteres de control, 50 filas (20 por omisión). Los valores de campos de catálogo se RESUELVEN contra el catálogo: lugares contra DIVIPOLA (nombre, nombre corriente como «Cali» o «Cartagena», o código; un municipio dicho como departamento se corrige y se avisa; un nombre repetido pide precisión), prácticas, territorios, organizaciones con ficha pública y tipos de proceso; lo que no existe se rechaza con un mensaje claro. Se rechazan entidades, campos, operadores y funciones fuera de la lista blanca. Por tolerancia con los tropiezos habituales del modelo, y sin ampliar nada de lo permitido, se descartan con aviso los filtros sin valor y los repetidos, la agrupación por campos que no se agrupan (nombre, título) y el orden por un campo que no aplica, y «contiene» sobre un catálogo se toma como «igual».

**Ejecutor.** Sin SQL dinámico, sin expresiones y sin texto del modelo ejecutado: cada operador es una comparación escrita en código sobre filas ya leídas con consultas fijas (el volumen público es de cientos de filas). Un valor de texto como «'; DROP TABLE x; --» es un literal que no coincide con nada. Los campos múltiples (prácticas, territorios) se expanden al agrupar; los meses se leen por su nombre.

**Intérprete.** `IInterpreteDeConsultas` con tres proveedores: `InterpreteOllama` (HTTP al servicio `modelo`, formato JSON restringido por esquema, temperatura 0, `think=false`, salida de unos 60 tokens, tiempo máximo de 25 s configurable, un reintento solo si el JSON es inválido, como máximo 2 interpretaciones simultáneas con espera de 3 s antes de responder «ocupado», disponibilidad sondeada cada 15 s), `InterpreteDesactivado` (valor por omisión) y `InterpreteDoble` (pruebas). El prompt lleva el catálogo, reglas, unos veinte ejemplos y la pregunta marcada como texto del usuario; el prefijo es idéntico entre llamadas, así que Ollama reutiliza su caché. Configuración: `Consulta__Modelo__Habilitado` (false), `Proveedor` (ollama), `Url` (URL INTERNA del servicio; en compose `http://modelo:11434`), `Nombre`, `TimeoutSegundos` (25), `Reintentos` (1), `Hilos` (0 = automático), `MaximoSimultaneas` (2), `MantenerCargado` (30m).

**Límites.** Solo lectura de lo publicado; 10 consultas por minuto y origen; 200 caracteres por pregunta; 50 filas; sin joins libres (las relaciones están declaradas en las entidades: procesos y organizaciones, festivales con prácticas y territorios, eventos con el proceso que los enmarca); sin series ni comparaciones entre entidades en una sola consulta; el modelo no conoce los valores de los catálogos, solo los resuelve el validador. No se registra el texto de las preguntas (solo estado, vía, entidad y latencia).

**Riesgos y mitigaciones.** (1) Alucinación de interpretación: el modelo puede entender mal, y una consulta válida pero distinta de la pedida es el riesgo real (en la medición, de 5 a 10 de 47 preguntas según el modelo). Se mitiga mostrando SIEMPRE «Cómo entendí tu pregunta» con filtros que se quitan con un clic, el orden, el cálculo y el origen («un modelo local interpretó la pregunta»), y rechazando todo lo que no esté en el catálogo en lugar de adivinar. (2) Inyección de instrucciones: la pregunta es texto no confiable; solo puede producir una consulta que el validador contrasta, y el modelo no tiene herramientas ni acceso a datos. Los datos publicados NO llegan al modelo (solo el catálogo de campos); si en el futuro se le mostraran filas (por ejemplo para resumir), habría que tratarlas como no confiables y verificar las cifras contra la tabla. (3) Fuga de datos: no hay entidades ni campos personales y el ámbito lo fija el endpoint; las pruebas comprueban que no sale contacto, organizador ni registros en revisión. (4) Abuso y costo: cupo por origen, tope de longitud, concurrencia limitada, caché de interpretaciones y vía rápida para lo común. (5) Cadena de suministro y licencia: imagen fijada por digest y modelo por nombre, cuantización e identificador; el modelo de 3.000 millones de Qwen2.5 NO se usa porque su licencia es de investigación. (6) Disponibilidad: si el servicio no responde, tarda o devuelve algo inválido, la consulta abierta dice «sin modelo» u «ocupado» y el cajón sigue funcionando con las plantillas.

**Elección del modelo (medición).** 55 preguntas en español colombiano (47 con respuesta esperada, 8 fuera de alcance o intentos de abuso que deben rechazarse), en un contenedor limitado a 4 CPU y 4 hilos sobre un equipo Apple Silicon (Docker, sin GPU), temperatura 0, JSON por esquema. Un acierto exige coincidir en entidad, filtros, agrupación y función tras validar; el orden y el límite se miden aparte. El prompt final no repite preguntas del conjunto, aunque sí hay plantillas análogas (mismo patrón con otro departamento), así que la cifra es optimista frente a preguntas realmente nuevas.

| Modelo | Licencia | Peso | Aciertos de 47 | Válida pero distinta | Rechazada | Fuera de alcance rechazadas (de 8) | Mediana | p90 |
|---|---|---|---|---|---|---|---|---|
| Qwen2.5 1.5B Q4 | Apache-2.0 | 0,99 GB | 15 (31,9 %) | 19 | 13 | 6 | 1,4 s | 2,6 s |
| Qwen3 1.7B Q4 | Apache-2.0 | 1,4 GB | 32 (68,1 %) | 8 | 7 | 7 | 1,3 s | 2,0 s |
| Qwen2.5 3B Q4 | investigación (no comercial) | 1,9 GB | 37 (78,7 %) | 6 | 4 | 7 | 1,4 s | 2,3 s |
| **Qwen3 4B Instruct 2507 Q4_K_M** | **Apache-2.0** | **2,5 GB** | **36 (76,6 %)** | 10 | 1 | 8 | 2,5 s | 4,1 s |
| Qwen2.5 7B Q4 | Apache-2.0 | 4,7 GB | 40 (85,1 %) | 5 | 2 | 8 | 2,7 s | 4,2 s |

Con una primera versión del prompt (menos ejemplos, algunos coincidían con preguntas del conjunto) los aciertos fueron 42,6 %, 63,8 %, 72,3 %, 70,2 % y 85,1 % en el mismo orden, y las tolerancias del validador (descartar filtros vacíos, agrupaciones inaplicables, etc.) subieron el modelo de 3.000 millones de 51 % a 72 %. Los tres modelos de menos de 2.000 millones no se recomiendan por precisión. Se elige Qwen3 4B por licencia, memoria (unos 3,3 GiB en ejecución, 6 GB de contenedor como mínimo) y porque rechaza en vez de adivinar; Qwen2.5 7B sube la precisión unos 8 puntos con 5,5 GiB y una latencia comparable en este equipo (en un servidor x86 de 4 vCPU se espera entre 1,5 y 3 veces más lenta; no medido). Arranque en frío con el modelo en disco: unos 4,5 s; la primera descarga es de 2,5 GB. Una consulta completa de extremo a extremo (interpretación, validación, ejecución) tardó entre 1,6 y 2,9 s sin caché y 2 ms con caché. La evaluación se repite con `SIMUS_EVAL_URL=http://127.0.0.1:<puerto> SIMUS_EVAL_MODELO=<modelo> dotnet test --filter EvaluacionDelModelo` (no hace nada sin esa variable, no es prueba de cola) y deja un TSV con cada pregunta, la consulta esperada y la obtenida.

**Despliegue: el modelo es un servicio del proyecto.** La API solo conoce `Consulta__Modelo__Url`; la misma configuración sirve en local, servidor y Azure. (a) Local y demo: `./scripts/local/modelo-local.sh up` (o `SIMUS_DEMO_CON_MODELO=1 ./scripts/demo/reiniciar-demo.sh`), contenedor `simus-desarrollo-modelo` en `127.0.0.1:11434`, límites 4 CPU y 8 GB (`SIMUS_LOCAL_MODELO_CPUS`, `SIMUS_LOCAL_MODELO_MEMORIA`). (b) Servidor con compose: el mismo servicio `modelo` sin publicar el puerto, en la red interna de la API, con un volumen persistente para `/root/.ollama` y `Consulta__Modelo__Url=http://modelo:11434`. (c) Azure Container Apps: una aplicación `modelo` con ingreso solo interno, 4 vCPU y 8 GiB, una réplica mínima (evita el arranque en frío y mantiene el modelo cargado), volumen de Azure Files para los pesos o una imagen propia que los traiga horneados (la imagen sube a unos 10 GB pero se elimina la descarga al arrancar), y `Consulta__Modelo__Url` apuntando a su nombre interno. (d) VM: igual que (b). Tamaño mínimo: 4 vCPU y 8 GB de RAM (el modelo ocupa unos 3,3 GiB), unos 10 GB de disco (la imagen de Ollama pesa unos 7 GB y los pesos 2,5 GB); sin GPU. Con GPU la latencia bajaría de segundos a décimas, pero con el uso actual (preguntas esporádicas, caché y vía rápida) no se justifica; no se estimó el costo en dinero porque depende del proveedor y la región. Actualizar el modelo: cambiar `infra/modelo/modelo.env`, volver a correr la evaluación, comparar con la tabla y desplegar. Apagarlo: `Consulta__Modelo__Habilitado=false` (la API deja de llamarlo y el cajón vuelve a las plantillas) y, si se quiere liberar recursos, `./scripts/local/modelo-local.sh down` o escalar la aplicación `modelo` a cero; no hay datos que migrar. Nada en el repositorio asume que el modelo corre en el computador de quien desarrolla.

**Inferencia en proceso (descartada por ahora).** LLamaSharp (llama.cpp) u ONNX Runtime GenAI dentro de la API evitarían un contenedor, pero acoplan 3 a 4 GB de memoria y la carga del modelo al proceso web (cada reinicio o despliegue recarga el modelo y compite con las peticiones normales), exigen binarios nativos por plataforma y no permiten escalar ni apagar el modelo por separado; el esquema JSON obligatorio es más directo con el servicio. No se midieron: es una valoración de arquitectura, no una comparación con números propios. Como `IInterpreteDeConsultas` es una interfaz, se puede añadir un proveedor en proceso sin tocar el resto.

**Qué no incluye.** Resumen en lenguaje natural redactado por el modelo (descartado, ver el principio); entidad de personas (si se quisiera, solo perfiles públicos y sin contacto, con su propia decisión); preguntas dentro de los espacios de gestión (siguen con su catálogo y sus permisos); emparejamiento semántico con embeddings (la vía rápida usa coincidencia léxica y plantillas); un conjunto de evaluación más grande y con preguntas de usuarios reales, que conviene reunir con la demo.
