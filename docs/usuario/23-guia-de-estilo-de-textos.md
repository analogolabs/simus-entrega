# 23. Guía de estilo de textos

Cómo se escriben los textos que lee una persona en SIMUS: botones, menús, etiquetas, pestañas, avisos,
ayudas, estados, mensajes vacíos y mensajes de error de la API. Pretende que el portal, el panel de la
organización y la consola se lean como una sola voz.

La regla de fondo: **la mayúscula inicial va al comenzar la frase y en los nombres propios.** Todo lo demás
va en minúscula.

## 23.1 Qué lleva mayúscula

| Va con mayúscula | Ejemplos |
| --- | --- |
| Nombres propios, instituciones y siglas | SIMUS, PNMC, Ministerio de las Culturas, las Artes y los Saberes, Festival Macizo |
| Las entidades con nombre propio del producto | un **Festival**, un **Mercado**, el **Ecosistema** (como módulo del portal), el **Plan** |
| El nombre de una sección o de un módulo, cuando se nombra como lugar | «en **Solicitudes**», «desde **Agenda**», «el **Catálogo Editorial**», «el **Banco de archivos**» |
| Lo que abre una frase, un botón o una etiqueta | «Cargar archivo de datos», «Volver al inicio de sesión» |

Dentro del nombre de una sección solo lleva mayúscula la primera palabra y los nombres propios: «Banco de
archivos», no «Banco de Archivos».

## 23.2 Qué va en minúscula

Los sustantivos comunes, aunque nombren algo central del producto, van en minúscula a mitad de frase:

| Incorrecto | Correcto |
| --- | --- |
| Señala qué hay que corregir de esta **Edición** | Señala qué hay que corregir de esta **edición** |
| Aún no hay **Ediciones** registradas | Aún no hay **ediciones** registradas |
| Volver a las **Ediciones** | Volver a las **ediciones** |
| Número de **Edición**, si aplica | Número de **edición**, si aplica |
| Añadir a mi **Calendario** | Añadir a mi **calendario** |
| Volver al **Inicio de Sesión** | Volver al **inicio de sesión** |
| Cargar **Archivo** de **Datos** | Cargar **archivo** de **datos** |
| Previsualización **Real** en **Vivo** | Previsualización **real** en **vivo** |

Son sustantivos comunes, entre otros: edición, organización, evento, solicitud (la cosa que se pide),
propuesta, ajuste, archivo, equipo, cuenta, persona, sesión, calendario, responsable, sede.

La diferencia entre «una solicitud» (común) y «Solicitudes» (la sección donde se atienden) es la misma
que entre «una noticia» y «Noticias»: la primera nombra una cosa, la segunda, un lugar.

## 23.3 Títulos

Los **títulos** (encabezados de página y de sección: `h1`–`h6`, cabeceras de tabla y similares) **se dejan
como están** en lo que se refiere a la mayúscula **inicial** de las palabras (la mayúscula sostenida del portal se trata en §23.3.1): hoy mezclan criterios y reescribirlos todos sería un cambio de diseño, no de redacción. Para
los **títulos nuevos** se recomienda la misma regla que para el resto del texto («Observaciones sobre la
edición»). El detector (§23.5) no mira los títulos.

### 23.3.1 Mayúsculas sostenidas en el portal (decisión 76 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`; G7, 12 nov 2026)

La mayúscula sostenida (todo el texto en mayúsculas, ya sea escrita o por CSS con `uppercase` o
`text-transform: uppercase`) **ocupa más espacio y se lee peor**. En el **portal público** (inicio, Noticias,
Agenda, Editorial, PNMC, Ecosistema y sus directorios, mapa, accesos y políticas):

- **Solo los títulos grandes** la conservan: `.tipo-seccion`, `.tipo-titulo-grande`, `.tipo-titulo`, los
  `<h1>` y los `<h2>`/`<h3>` de tamaño `text-2xl` o mayor.
- **Todo lo demás** va con mayúscula inicial solo al comienzo de la frase: antetítulos (`.tipo-etiqueta`),
  enlaces y botones (`.tipo-enlace`), filtros, listas, pestañas, rótulos de campo y de sección en el mapa,
  pistas, subtítulos pequeños y menús. El espaciado ancho entre letras (`tracking-*`, `letter-spacing`
  alto) iba con las mayúsculas y se va con ellas.
- **Excepción cartográfica:** los nombres de países del mapa (`.country-label-marker`) siguen en
  mayúscula por convención cartográfica.
- **El panel de la organización y la consola quedan fuera de esta regla:** tienen su propio diseño
  (`.rotulo-de-seccion`, `.campo__rotulo`, tablas administrativas). En el mapa, que es del portal, esas dos
  clases llevan `normal-case`.

Cómo se hace cumplir: `scripts/documentos/comprobar-sin-uppercase.py` (§23.5) y la prueba de navegador
`e2e/portal-visual-menu-botones-y-mayusculas.spec.ts`, que recorre las páginas del portal y falla si algo
que no es título sale en mayúscula sostenida.

## 23.4 Dónde se aplica

- **Plantillas de la web** (`.html` y plantillas en línea de los componentes): botones, menús, etiquetas,
  pestañas, `placeholder`, `title`, `aria-label`, textos de estado y de «no hay nada».
- **Mensajes de la API que llegan a la persona** (errores, avisos, descripciones): la misma regla.
- **Valores por omisión del CMS** (`registro-de-textos-web.ts`): los propios del producto siguen esta guía.
  Los que reproducen **textos oficiales** (marco normativo, hitos y actores del Plan, nombres de entidades
  del Estado) conservan la escritura de la fuente. No se migran textos que una persona ya editó desde el
  CMS: lo que cambia es solo el valor por omisión.
- **Comentarios del código y documentos**: no son «textos de la web» y no se normalizan con esta guía; se
  escriben con las convenciones de `docs/operacion/11-operacion-y-mantenimiento.md`.

## 23.5 Chequeo automático

`scripts/documentos/comprobar-mayusculas.py` avisa de **un sustantivo común escrito con mayúscula a mitad de frase** en
las plantillas. Corre dentro de `scripts/validacion/verificar-estructura.sh`, y por tanto dentro de
`scripts/validacion/validar-local.sh`.

Es un chequeo **ligero a propósito**, para no dar falsos positivos molestos:

- Mira solo el texto visible de las plantillas y los atributos `placeholder`, `title`, `aria-label`, `label`,
  `alt` y `text`. No mira el código, los comentarios, los títulos ni las interpolaciones.
- Solo avisa de una lista corta de sustantivos comunes (`SUSTANTIVOS`, al comienzo del script), precedidos por
  una palabra en minúscula. No intenta adivinar si una palabra cualquiera debería ir en minúscula.
- Si una palabra de la lista es un nombre propio en un caso concreto, se añade a
  `scripts/documentos/mayusculas-excepciones.txt` con la forma `ruta:texto` y un comentario que diga por qué.

**Segundo chequeo: mayúsculas sostenidas por CSS.** `scripts/documentos/comprobar-sin-uppercase.py` avisa de la clase
`uppercase` y de `text-transform: uppercase` en las plantillas y los estilos de las zonas del portal, salvo en
los títulos grandes (§23.3.1). En `simus-web/src/styles.css` solo permite la mayúscula sostenida en las clases
de título, en la cartografía y en el diseño propio del panel y la consola. Las excepciones justificadas van en
`scripts/documentos/uppercase-excepciones.txt` (`ruta-parcial: motivo`; sin motivo no valen). También corre dentro de
`scripts/validacion/verificar-estructura.sh`.

No cubre los mensajes de la API ni los valores por omisión del CMS; esos se revisan con esta guía al
cambiarlos. Para ampliar la cobertura, basta con añadir sustantivos a la lista.

## 23.7 «PNMC», no «el Programa» (PERF, 17 nov 2026)

De cara a quien usa SIMUS (portal, acceso, Mi espacio, panel de la organización, avisos, mensajes de error y de ayuda del
servidor) no se dice «el Programa»: se dice **PNMC** (Plan Nacional de Música para la Convivencia), con mayúscula inicial solo
al comienzo de frase («Solo salen las que el PNMC ya revisó»; «Te avisaremos cuando el PNMC decida»). «Equipo del PNMC» y las
cuentas `@pnmc.local` se quedan; el texto legal del agente individual no se modifica. En la consola interna vale lo mismo
cuando «el Programa» es el PNMC. «Programa Nacional de …» y «Programa Editorial» son otros nombres y no cuentan.

Cómo se hace cumplir: `npm run trinquete:textos` (`simus-web/trinquete/trinquete-textos.mjs`, con su prueba) lee plantillas,
servicios, endpoints, contratos y pruebas, sin comentarios, y falla si reaparece. Está dentro de `npm run trinquete`.

## 23.6 Casos dudosos y decisiones abiertas

- **«Ecosistema» / «ecosistema».** Como módulo del portal («directorios del Ecosistema») va con mayúscula;
  como idea general («el ecosistema musical») va en minúscula. Hoy ambas formas conviven en algunos
  textos; se unifican cuando se toquen.
- **«Hero» y «Home» en el editor de textos de la consola** son los nombres técnicos que usa el editor para
  la portada. Se dejan como están.
- **Festival y Mercado.** Se escriben con mayúscula porque así los escriben todos los documentos del
  proyecto y los nombra el producto como entidades; **edición** se escribe en
  minúscula, como en esos mismos documentos.
