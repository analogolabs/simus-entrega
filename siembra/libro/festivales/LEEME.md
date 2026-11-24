# Libro de nivel 1: festivales y mercados

. Lo consume `siembra/generador/constructor_festivales.py` (enganchado en `siembra.py`). Pruebas: `python3 -I siembra/generador/pruebas_festivales.py`.

## Qué contiene
| Archivo | Contenido |
|---|---|
| `organizaciones.py` | 15 personas y 13 organizaciones sintéticas que producen lo demás (numeración de teléfonos y documentos desde la base 300). |
| `f01_baudo.py` … `f09_guanentina.py` | 10 festivales sintéticos; el libro de cada uno lleva historia, objetivos, identidad, contacto, aliados, enlaces y sus ediciones. |
| `mercados.py` | 4 mercados sintéticos con ediciones. |
| `historicos.py` | 7 festivales históricos sintéticos, publicados y sin reclamar (administra la entidad institucional). |
| `reales.py` | Selección de 6 festivales y 3 mercados reales con hechos citados (descripción propia a partir de `datos/`). |
| `multimedia-solicitada.json` | 116 alias de imagen que las fichas esperan (con texto alternativo sugerido). |

## Trayectorias de los festivales sintéticos
| Festival (clave `n1.festival.…`) | Región | Estado | Ediciones |
|---|---|---|---|
| `festival-de-arrullos-y-alabaos-del-baudo` | Pacífico (Bajo Baudó) | publicado (con ajustes previos) | 14: 2012-2019 y 2022-2026 realizadas, 2027 programada; pausa 2020-2021 |
| `encuentro-de-bullerengue-y-tambor-de-la-cienaga-grande` | Caribe (Ciénaga) | publicado | 7 (2021-2026 + 2027) |
| `festival-cuerdas-del-paramo` | Andes (Duitama) | publicado | 5, con huecos 2020-21 y 2023-24 |
| `encuentro-de-arpas-y-cuatros-del-ariari` | Llanos (Granada, Meta) | ajustes solicitados (dos rondas) | 6 |
| `encuentro-de-coplas-del-cravo-sur` | Llanos (Paz de Ariporo) | en revisión | 3 |
| `muestra-de-cantos-del-rio-caqueta` | Amazonía (Florencia) | publicado | 2 (bianual) |
| `encuentro-de-quadrille-y-calipso-del-cove` | Insular (San Andrés) | borrador | 1 en preparación, sin fechas |
| `encuentro-de-musicas-del-orinoco-y-la-frontera` | Orinoquía (Puerto Carreño) | rechazado | ninguna |
| `festival-del-torbellino-y-el-tiple-de-la-provincia-guanentina` | Andes (San Gil) | archivado | 5: cambia de sede (San Gil, Barichara, Socorro), pausa y edición cancelada en 2023 |
| `encuentro-de-flautas-y-tambores-del-valle-alto` | Andes (Sibundoy) | publicado | 1 programada (2027) |

Mercados (`n1.mercado.…`): `feria-de-circulacion-musical-del-golfo` (publicado, 5 ediciones 2023-2027), `vitrina-cafetera-de-musicas` (publicado, 2), `vitrina-de-musicas-del-llano-y-la-selva` (en revisión, 1 en preparación; se realiza en el marco del encuentro del Ariari), `mercado-de-musicas-de-frontera-del-nororiente` (ajustes solicitados, 2).

Claves estables: `n1.festival.<alias>`, `n1.mercado.<alias>`, `n1.edicion.<alias>-<año>`, `n1.organizacion.<alias>` y `n1.historico.<alias>`. Las ediciones realizadas llevan cifras propias, convocatoria y formación cuando las hubo; las futuras, programación preliminar. Los estados e historiales siguen el circuito real (`borrador → en_revision → publicado | ajustes_solicitados | rechazado`, `archivado`); `aprobado` no se siembra.

## Reales (solo hechos citados)
Festivales: Rock al Parque (29 ediciones documentadas, 1995-2026), Festival de Música del Pacífico Petronio Álvarez, Barranquijazz, Festival Nacional de la Música Colombiana (Ibagué), Festival Nacional de Gaitas Francisco Llirene (Ovejas) y Festival Cuna de Acordeones. Mercados: Circulart, Bogotá Music Market (BOmm) y Mercado Cultural del Caribe (certeza media en los datos; se incluyó por su fuente de 2026). Entran como históricos publicados sin reclamar; las fuentes quedan como materiales de la ficha. Sin programación, participantes ni noticias asociadas. Los datos completos se leen con `--datos` o `SIMUS_SIEMBRA_DATOS`; la muestra versionada trae menos.

## Históricos sintéticos y coincidencias (convención `n1.historico.*`)
Pensados para el recorrido de coincidencias y reclamaciones; el tema de reclamaciones puede citar estos alias (`c.historicos_sinteticos` los expone tras `sembrar`):
| Escenario | Históricos | Nombre de borrador sugerido para provocar la coincidencia |
|---|---|---|
| Clara (un candidato alto) | `n1.historico.festival-de-gaitas-del-alto-sinu` (Tierralta) | «Festival de Gaitas del Alto Sinú», Tierralta |
| Parcial | `n1.historico.encuentro-de-bandas-del-valle-de-tenza` (Garagoa) | «Festival de Bandas de Tenza», Guateque |
| Varios candidatos | `n1.historico.encuentro-de-cuerdas-del-paramo` (Tunja), `n1.historico.festival-de-cuerdas-y-paramo` (Villa de Leyva), histórico sin clave `muestra-cuerdas-del-paramo` (Sogamoso) y el festival activo `n1.festival.festival-cuerdas-del-paramo` (Duitama) | «Festival de Cuerdas del Páramo», Boyacá |
| Ninguna | `reunion-de-marimberos-del-micay`, `encuentro-de-trova-y-parranda-de-jerico` | cualquier nombre sin parecido |

La plataforma decide por sí misma qué es una coincidencia; esta tabla es la intención del libro, no un resultado simulado.

## Multimedia
No hay imágenes en este tema. Cada ficha referencia sus imágenes por alias: `img.festival.<alias>.portada|logo|galeria.1..3`, `img.edicion.<alias>-<año>.afiche`, `img.mercado.<alias>.portada|logo`, `img.festival.<alias>.portada` para los históricos de nivel 1. La lista completa y el alt sugerido están en `multimedia-solicitada.json` (se regenera con `python3 -I siembra/generador/constructor_festivales.py`). El agente de multimedia debe resolverlos y ligarlos con `Archivos`, `ArchivosDeRegistro` (`ArchivoId`) y `EventosAgenda.ImagenRuta`. Los documentos y enlaces de las fichas ya están sembrados como `ArchivosDeRegistro.Url` con dominios `.test`.

## Para el tema de relaciones y perfiles
Agrupaciones que la programación menciona solo como texto (sin ficha): Cantadoras de Piedra Honda, Coro de las Madres del Río, Grupo Alabanza de Pizarro, Los Hijos del Bajo Baudó, Cununeros del Baudó Medio (Baudó); Las Palmeras del Caño, Mujeres de la Marea (Ciénaga); Dueto Alba Fría, Cuarteto Piedra y Frailejón (Páramo); Los Hijos del Ariari (Ariari); Los Hermanos Carvajal del Orteguaza, Grupo Aire de Monte (Caquetá); Cuerdas del Mesón, Dueto Bejuco y Madera (Guanentina); La Banda Marinera, Gaiteros de Playa Honda (Golfo). Relaciones ya sembradas: festival y mercado → organización responsable; mercado del Llano → festival del Ariari (misma organización); eventos de agenda → festival o mercado.

## Cambios al generador (con pruebas)
`Constructor.personas/organizaciones` aceptan `items` y `base`; `festivales_publicos` y `mercados` aceptan `reales` (nivel 1, ediciones numeradas, fuentes visibles); la validación distingue valores de catálogo distintos (antes dos `Cat` se leían iguales y rechazaba fuentes de financiación diferentes).
