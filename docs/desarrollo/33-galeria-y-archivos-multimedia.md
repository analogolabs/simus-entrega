# 33. La Galería y los archivos multimedia, de punta a punta

Este documento dice dónde vive cada cosa relacionada con imágenes, documentos y videos: lo que es código, lo que son
archivos estáticos del portal, lo que es material de siembra y lo que se genera al ejecutar. El detalle del Banco de archivos
(cuotas, vínculos, retiro, copias) está en [Gestión de archivos](../operacion/29-gestion-de-archivos.md).

## 33.1 Mapa rápido

| Qué | Dónde | Va en git | Quién lo produce |
|---|---|---|---|
| Código de la Galería, API | `simus-api/src/SIMUS.Api/Endpoints/GaleriaEndpoints.cs` (público y consola) | sí | desarrollo |
| Código de la Galería, web | `simus-web/src/app/features/gallery/` (página, muro, visor, reproductor) y `core/services/galeria*.ts` | sí | desarrollo |
| Esquema | `simus-database/schema/V20261122_10__galeria_albumes_y_videos.sql` (`GaleriaAlbumes`, `GaleriaItems`) | sí | desarrollo |
| Fotos estáticas del portal | `simus-web/public/Galeria/` (solo las que la web referencia como imagen por omisión) | sí | proyecto |
| Portadas del Catálogo Editorial | `simus-web/public/editorial/` | sí | proyecto |
| Documentos y marca estáticos | `simus-web/public/assets/`, `fonts/` y los iconos de `public/` | sí | proyecto |
| Imágenes de la siembra con licencia libre | `siembra/imagenes/` (31 fotos de instrumentos) y `siembra/imagenes/LICENCIAS.md` | sí | siembra |
| Piezas oficiales de Celebra la música | `simus-database/seed/celebra-imagenes/` | sí | proyecto |
| Archivos subidos por las personas (Banco de archivos) | tabla `dbo.Archivos` de la base de datos (columna `Contenido`) | no: es dato | personas, en ejecución |
| Pool de imágenes de demostración | `tmp/siembra/assets/` (o `$SIMUS_SIEMBRA_ASSETS`) | no: `tmp/` está ignorado | la siembra, al vuelo |

## 33.2 Cómo funciona la Galería

1. **Álbumes y videos.** Un álbum es de tipo `fotos`, `videos` o `mixto`. Sus ítems son fotos (un archivo del Banco con texto
   alternativo obligatorio) o videos (un identificador de YouTube de 11 caracteres y un título). También hay ítems sueltos,
   sin álbum.
2. **El video es un identificador, no un archivo.** El portal no pide nada a YouTube hasta que la persona pulsa «Reproducir»;
   entonces monta la incrustación sin cookies (`youtube-nocookie.com`). La portada de un video es una imagen propia del Banco
   (`MiniaturaArchivoId`), cargada una sola vez, de modo que navegar la Galería no entrega la dirección IP a terceros.
3. **Solo se ve lo publicado.** Un álbum en borrador responde 404 al público y sus fotos tampoco se sirven: la API entrega un archivo
   a una persona anónima únicamente si está vinculado a algo publicado.
4. **Rutas.** Público y anónimo: `/api/v1/publico/galeria/albumes`, `/albumes/{slug}` e `/items`. Consola (con sesión y rol
   de la sección Galería): lectura, `PUT /albumes/{slug}` (guarda el álbum completo, con auditoría), orden, estado, eliminación
   y los ítems sin álbum. El contrato completo está en `simus-api/openapi.yaml`.
5. **Archivos.** Toda foto sale del Banco de archivos: se sube por la consola (`/api/v1/institucional/archivos`), por una
   organización o por la propia persona (solo su foto). Imágenes PNG, JPEG o WebP hasta 2 MiB y PDF hasta 20 MiB; el tipo se
   reconoce por la firma del archivo y se sirve con ETag desde `/api/v1/publico/archivos/pnmc-<huella>.<ext>`.
6. **Gestión.** En la consola, la sección «Galería» crea y ordena álbumes, sube fotos al Banco, agrega videos y publica.

## 33.3 Dónde van los archivos

- **Un archivo de contenido** (foto de un álbum, adjunto, logo) se sube desde la interfaz y queda **en la base de datos**
  (`dbo.Archivos.Contenido`). No existe una carpeta de disco que configurar: lo que se respalda con la base es lo que viaja. El
  peso se controla con los topes anteriores y con la cuota por organización (50 MiB).
- **Un archivo estático del producto** (imagen por omisión del portal, portada del catálogo, documento del Plan, icono)
  se versiona en `simus-web/public/` y se publica con la aplicación. El registro de imágenes del CMS
  (`core/cms/registro-de-imagenes-web.ts`) declara cuáles ranuras del portal las usan y
  `core/services/catalogo-de-imagenes-de-galeria.ts` lista las fotos de `public/Galeria/` que sirven de respaldo.
  Para cambiar una, se reemplaza el archivo conservando su nombre, o se sube una propia desde el CMS.
- **El material de demostración** nunca se versiona: se genera (ver abajo) y se carga a la base con la siembra.

## 33.4 Imágenes de la demostración

El comando `./scripts/demo/cargar-siembra.sh --si` genera todo lo necesario; no hay binarios de demostración en el repositorio
más allá de las 31 fotos libres de `siembra/imagenes/`, cuya procedencia y licencia están en `siembra/imagenes/LICENCIAS.md`.

- `siembra/multimedia/construir.py base` arma el pool en `tmp/siembra/assets/`: las fotos de `public/Galeria/`
  re-codificadas (≤ 1600 px, ≤ 200 KB, sin EXIF), las piezas de Celebra, las 31 fotos libres y el resto **generado de forma
  determinista** (retratos, logos, portadas, afiches, soportes y PDF) con `ilustrador.py`. Si no hay red, los logos de los
  aliados de Celebra se generan en lugar de descargarse.
- `siembra/multimedia/manifiesto.csv` lista cada pieza con su texto alternativo, crédito, fuente y checksum; es la fuente de verdad
  del pool ya construido. `construir.py verificar --plan` comprueba textos, límites, checksums y que todo alias referenciado exista.
- Los álbumes de video de la demostración (`siembra/libro/galeria/videos-voces-y-saberes.json`) son **enlaces de YouTube**
  con miniatura propia: no se copia ningún video al repositorio ni a la base.

## 33.5 Reglas para quien modifica

- No versionar fotos de eventos, videos ni dumps. Lo pesado se sube desde la interfaz, no a git.
- Todo `public/` nuevo declara su procedencia (crédito y, si aplica, licencia) y no supera 200 KB por imagen del portal.
- Toda imagen lleva texto alternativo; la Galería rechaza una foto sin él.
- Un cambio en el pool o en los libros se valida con `python3 -I siembra/multimedia/pruebas_multimedia.py` y
  `python3 -I siembra/generador/pruebas_generador.py`.
