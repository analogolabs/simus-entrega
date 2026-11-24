# Libro `contenido`: noticias, agenda, campañas y marcas editoriales

. Todo es inventado (autoría, organizaciones, festivales, personas citadas) salvo el acervo editorial, que ya vive en la base y solo se marca.
El generador lo carga con `siembra/generador/contenido_siembra.py` (llamado desde `siembra.py` en lugar de `Constructor.eventos()` y `.noticias()` de la muestra).

## Contenido

| Qué | Cuántos | Dónde |
|---|---|---|
| Noticias N1 (`n1.noticia.<clave>`), 250–500 palabras, autoría, categoría, imagen por alias, práctica/territorio/campaña/etiquetas | 33 (27 publicadas entre 2024 y 2026, 1 programada para el 26 nov 2026, 2 archivadas, 1 en revisión, 1 borrador, 1 rechazada; 3 de ellas institucionales neutras) | `noticias_a.py` (2024), `noticias_b.py` (2025), `noticias_c.py` (2026) |
| Eventos de agenda (2024–2027; 33 departamentos/Bogotá; pasado, presente y futuro; 5 estados) | 60 (15 N1 con `n1.evento.<clave>`, el resto N2) | `eventos_celebra.py` (26), `eventos_campanas.py` (20), `eventos_otros.py` (14) |
| Campañas (proyectos transversales) nuevas, `n1.campana.<codigo>` | 4 | `campanas.py` |
| Celebra la música 2025 / 2026 | 12 / 14 eventos y 2 / 3 noticias, sin crear los proyectos (ya existen por migración) | `eventos_celebra.py` |
| Marcas N1 del catálogo editorial (`n1.editorial.pnmc-ed-0xx`), sin tocar las fichas | 8 | `editorial.py` |

Campañas, hashtags (se usan como etiqueta libre y como proyecto transversal): `ruta-de-los-saberes-sonoros` #SaberesSonoros, `sonidos-de-frontera` #SonidosDeFrontera, `memoria-viva-del-canto` #MemoriaVivaDelCanto, `escenarios-abiertos` #EscenariosAbiertos. Celebra usa la etiqueta `celebra la música` y `#CelebraLaMúsica`.

La «regla de las destacadas» (las tres publicadas más recientes; cinco en «Actualidad» del Inicio) la cumplen las notas del 20, 17, 14, 10 y 6 de noviembre de 2026; la nota del 26 de noviembre está programada y no cuenta hasta su fecha.

## Alias que hay que coordinar

Los eventos se vinculan a procesos **solo si el alias existe en el plan** (si no, se siembran sin vínculo y se avisa). Hoy se usan los de la muestra:
`festival.encuentro-de-chirimia-del-san-juan`, `festival.festival-de-marimba-de-la-ensenada`, `festival.gran-rueda-de-bullerengue`, `mercado.rueda-de-negocios-caribe-sonoro`,
`talleres.taller-de-tiples-y-guitarras`, `talleres.taller-itinerante-de-marimba`, `espacios.sala-de-ensayo-la-ceiba`, `espacios.tarima-del-parque-de-los-cantores`, `redes.red-de-archivos-sonoros-del-llano`.
Los textos nombran estas entidades de la muestra (Corporación Raíz y Tambor, Fundación Voces del Llano, Asociación Bullerengue Vivo, Taller Cuerdas del Eje, Banda Escuela Santandereana, Agencia Ruta Caribe, Colectivo Sonidos del Sur, Orquesta Escuela Pacífico Salsero) y a sus personas (Ismael Cuesta Mosquera, Marisol Quiceno Arango, Yurani Rojas Pinzón, Andrés Felipe Bonilla Ibarra, Luz Dary Mercado Padilla, Camilo Arenas Vélez, Aracely Tapias Cardona, Wilson Gamboa Salcedo, Daniela Cassiani Berrío, Sergio Quintero Lozano). **Si los temas `festivales` o `personas` renombran o retiran alguno, hay que ajustar los textos o los alias.**
Los demás organizadores de eventos (p. ej. «Red Fronteriza de Agrupaciones Musicales», «Colectivo Fandango Corozal») solo aparecen como texto en `EventosAgenda.Organizador`: no son filas del sistema.

Hechos de edición que las noticias dan por ciertos y que las ediciones de `festivales` deberían respetar (fechas y estados):
Encuentro de Chirimía del San Juan: 13–15 jun 2024 y 17–19 jul 2025 (Quibdó), próxima 2027; Festival de Marimba de la Ensenada: 11–14 jul 2024 (Tumaco), 2025 realizada; Rueda Caribe Sonoro: 5–6 sep 2024 (Cartagena), 2025 realizada (21–22 nov, dentro de Celebra), 18–19 mar 2027; Gran Rueda de Bullerengue: 3–5 abr 2025 (Barranquilla); Encuentro Andino Electrónico y Mercado de Músicas del Pacífico Sur: en preparación; Orquesta Escuela Pacífico Salsero: activa en 2025, inactiva desde jun 2026.

## Imágenes

El libro cita un alias por noticia y por evento (`img.noticia.<clave>`, `img.evento.<clave>`) con texto alternativo obligatorio. `imagenes-requeridas.tsv` las lista (93: alias, uso, clave, alt). Si el constructor tiene un método `resolver_imagen(alias)` (lo define el tema multimedia) que devuelva `(ruta_publica, alternativa, ref_archivo)`, se llenan `ImagenRuta` y el pivote `NoticiasArchivos`/`EventosAgendaArchivos` (rol `imagen_principal`); sin él se siembra solo `ImagenAlternativa` y el plan avisa cuántas imágenes esperan.

## Cambios al generador (con pruebas)

- `nucleo.py`/`validaciones.py`: `Fila.solo_marca` (marca en `DatosDeDemostracion` de un registro que ya existe; no inserta nada de negocio y no hace nada si la ficha no está en la base).
- `validaciones.py`: la clave estable no puede pasar de 80 caracteres (la columna es de 80; lo detectó la siembra de prueba).
- `plan_de_limpieza.py`: `ProyectosTransversales` deja de conservarse entero; se conservan los tres de partida y se borran las campañas de la siembra (así volver a sembrar no choca con el código único).
- `siembra.py`: llama a `contenido_siembra.sembrar(c)` en lugar de `c.eventos()` y `c.noticias()`.

## Pendiente

Imágenes reales (tema multimedia); N2/N3 de noticias a escala masiva (tema masivo); relaciones noticia–festival (el modelo no las tiene: se sostienen por categoría, etiquetas y campaña); registros del catálogo editorial complementarios (no se inventan obras reales).
