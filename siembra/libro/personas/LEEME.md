# Libro N1 de personas y organizaciones sintéticas (tema `personas`)

Todo es inventado: nombres colombianos verosímiles que no corresponden a músicos conocidos, correos `@simus.test`, contactos `.test`, teléfonos `+57 300 555 …`, NIT `999.xxx.xxx-d`, reconocimientos de instituciones ficticias. Procedencia de todas las filas: `sintetico`, nivel 1.

## Qué hay

| Archivo | Contenido |
|---|---|
| `perfiles_1.py`, `perfiles_2.py`, `perfiles_3.py` → `perfiles.py` | 18 perfiles N1 (biografía de 360 a 420 palabras, roles, prácticas, clasificaciones, enlaces, portafolio, relaciones, multimedia por alias) |
| `organizaciones_1.py`, `organizaciones_2.py` → `organizaciones.py` | 14 organizaciones N1 (descripción con trayectoria, equipo, proyectos, territorios y agrupaciones; NIT, redes, estado, historial de cambios, invitaciones) |
| `multimedia.py` | Referencias por alias (`persona.<clave>.foto`, `org.<clave>.logo`, `org.<clave>.doc.<slug>`…; las organizaciones no piden portada ni galería) con texto alternativo, para el manifiesto del agente de multimedia |
| `../../generador/n1_personas.py` | Constructor: traduce el libro a filas (tres lotes `n1-libro-personas`, `n1-libro-organizaciones`, `n1-libro-perfiles`); lo llama `siembra.py` entre las cuentas de validación y los festivales |
| `../../generador/pruebas_personas.py` | Pruebas del libro y del plan (`python3 -I siembra/generador/pruebas_personas.py`) |

Claves estables: `n1.persona.<clave>` y `n1.organizacion.<clave>`; alias del plan `persona.<clave>`, `org.<clave>` (`Constructor.persona_id` / `org_id` ya las exponen a los demás temas).

## Personas (18)

| Clave | Municipio | Oficio principal | Organización (rol en consola) |
|---|---|---|---|
| nubia-palacios | Quibdó | cantadora de alabaos, investigadora | corp-cabildo-sonoro-del-atrato (administrador) |
| jhon-fredy-valencia | Guapi | marimbero y luthier | colabora en cabildo y escuela de lutería |
| rosalba-perez | Valledupar | acordeonera, compositora | casa-de-musica-la-candelaria (administrador) |
| hernan-velasquez | Medellín | productor fonográfico | sello-altamira-discos (administrador) |
| margarita-buelvas | Barranquilla | gestora y productora | productora-marea-alta (administrador) |
| luis-ernesto-castano | Armenia | luthier, director de escuela | escuela-de-luteria-el-roble (administrador) |
| claudia-munoz | Popayán | cantante e investigadora | colectivo-tierra-adentro (administrador) |
| eliecer-rios | Yopal | arpista, compositor | corp-musica-del-llano-casanare (administrador) |
| tatiana-cardozo | Leticia | cantante, investigadora de frontera | fund-maloca-sonora (administrador) |
| dennis-bryan | San Andrés | guitarrista, mento y calipso | asoc-sonidos-del-archipielago (administrador) |
| gilberto-pedraza | Sogamoso | director de bandas | corp-bandas-de-boyaca (administrador) |
| martha-rangel | Vélez | tiplista, guabina, docente | corp-guabina-y-tiple (administrador) |
| angela-burbano | Mocoa | etnomusicóloga | corp-tejidos-de-aire (administrador) |
| julian-arboleda | Manizales | compositor | altamira (editor); cofundó colectivo-ensamble-pausa |
| karen-ospina | Bucaramanga | productora y DJ | productora-marea-alta (editor) |
| ruben-trujillo | Neiva | director de orquesta | fund-orquesta-juvenil-alto-magdalena (administrador) |
| olga-mejia | Pereira | compositora coral | corp-guabina-y-tiple (editor); perfil `solo_simus` |
| fabian-rojas | Ipiales | zampoñista y constructor | corp-tejidos-de-aire (editor) |

## Organizaciones (14) y estados

Activas (11), `pendiente_de_confirmacion` (fund-maloca-sonora: recién creada, correo sin confirmar), `inactiva` (corp-bandas-de-boyaca: pausa con acta y archivo) y `eliminada` (colectivo-ensamble-pausa: disuelta por sus socios, sin equipo). Trayectorias desde muy extensas (cabildo, orquesta, productora: 4–7 relaciones) hasta mínimas (archipiélago, maloca).
Historial: filas de `CambiosDeRegistro` (módulo `organizaciones`: descripción, NIT, correo, estado con su motivo); invitaciones en cuatro estados; `ConfirmacionesDeCorreo` (una abierta); `FechaRevisionConsola` en ocho de ellas.

## Relación con Camila (cuenta de validación, nivel 0)

No se tocan sus datos base. Figura como **editor** de `corp-cabildo-sonoro-del-atrato`, `escuela-de-luteria-el-roble` y `colectivo-tierra-adentro`, y los textos recogen lo que ya dice su perfil: el documental de la lutería de Armenia (2024) y el registro de cantos del alto Cauca (2023). Su perfil es coherente con este universo (Bogotá, lutería de cuerdas, cantos de trabajo, documentación de festivales); no requiere cambios.

## Alias de festivales y mercados propuestos (por resolver con el tema `festivales`)

El tema `festivales` aún no publica su LEEME. Estos son los alias que las fichas de este libro citan; si festivales usa otros, basta con renombrarlos en `festivales=[…]` de `perfiles_*.py` y `organizaciones_*.py`. La relación persona–festival no tiene tabla propia: se materializa en `Festivales.Director` (texto) y `OrganizacionPrincipalId`; por eso se pide que el director sea el nombre completo de la persona y la organización la del libro.

| Alias | Organización principal | Director / coordinación | Estado sugerido |
|---|---|---|---|
| `n1.festival.festival-de-chirimia-y-alabaos-del-atrato` | corp-cabildo-sonoro-del-atrato | Nubia Estela Palacios Mosquera | publicado, muchas ediciones desde 2015 |
| `n1.festival.encuentro-de-acordeoneras-y-cantadoras-del-cesar` | casa-de-musica-la-candelaria | Rosalba del Carmen Pérez Ortega | publicado |
| `n1.festival.carnaval-sonoro-marea-alta` | productora-marea-alta | Margarita Inés Buelvas Támara | publicado, con 2027 programada |
| `n1.festival.festival-de-musicas-del-archipielago` | asoc-sonidos-del-archipielago | Dennis Wilfred Bryan Forbes | publicado, pocas ediciones |
| `n1.festival.encuentro-nacional-de-luteria-y-cuerdas` | escuela-de-luteria-el-roble | Luis Ernesto Castaño Ríos | publicado |
| `n1.festival.festival-de-bandas-de-paz-de-boyaca` | corp-bandas-de-boyaca | Gilberto Alfonso Pedraza Suárez | archivado (pausa 2024) |
| `n1.festival.festival-sinfonico-del-alto-magdalena` | fund-orquesta-juvenil-alto-magdalena | Rubén Darío Trujillo Cabrera | publicado, desde 2012 |
| `n1.festival.encuentro-de-cantos-de-trabajo-de-popayan` | colectivo-tierra-adentro | Claudia Patricia Muñoz Bolaños | publicado |
| `n1.festival.festival-de-guabina-y-tiple-de-velez` | corp-guabina-y-tiple | Martha Lucía Rangel Ardila | publicado |
| `n1.festival.encuentro-de-musicas-de-las-tres-fronteras` | fund-maloca-sonora | Tatiana Lucía Cardozo Ferreira | borrador (sin ediciones) |
| `n1.festival.encuentro-de-flautas-del-piedemonte-amazonico` | corp-tejidos-de-aire | Ángela Rocío Burbano Delgado | en_revision o publicado, pocas ediciones |
| `n1.festival.festival-llanero-de-arpa-y-cuatro-del-casanare` | corp-musica-del-llano-casanare | Eliécer Antonio Ríos Barragán | publicado, 16 años de historia |
| `n1.mercado.rueda-de-sellos-y-circulacion-del-noroccidente` | sello-altamira-discos | Hernán Darío Velásquez Zapata | publicado |
| `n1.mercado.mercado-de-musicas-del-caribe-marea-alta` | productora-marea-alta | Margarita Inés Buelvas Támara | publicado |

## Lo que el modelo no contempla (y por tanto no se siembra)

- **Agrupaciones musicales vinculadas, proyectos, contactos, oportunidades y leads** de una organización: no hay tablas. Las agrupaciones y los proyectos viven en el texto de la descripción y en `agrupaciones=[…]`/`proyectos=[…]` del libro (insumo para cuando exista el modelo).
- **Documentos y multimedia**: pendientes del manifiesto de `siembra/multimedia/`; el libro declara los alias en `multimedia.py` y el constructor no escribe `Archivos` ni `ArchivoFotoId` hasta que existan.
- **Participaciones** de personas en ediciones: la tabla `Participaciones` es de formularios públicos y no se siembra.
