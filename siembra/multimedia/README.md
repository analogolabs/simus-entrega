# Multimedia de la siembra integral 

Sistema de imágenes, documentos y enlaces de video para la siembra de demostración. **Los binarios no viven en git**: el repositorio solo guarda el
**manifiesto** (`manifiesto.csv`, una fila por alias con archivo, MIME, ancho×alto, bytes, texto alternativo, pie, crédito, fuente, procedencia y
checksum SHA-256) y `videos.csv`. El pool está en `tmp/siembra/assets/` (o `$SIMUS_SIEMBRA_ASSETS`).

| Comando (Pillow necesario solo para construir) | Qué hace |
|---|---|
| `python3 siembra/multimedia/construir.py base` | Importa las fotos reales de `simus-web/public/Galeria/` (re-codificadas a ≤1600 px y ≤200 KB, sin EXIF), las piezas oficiales de Celebra y genera el pool genérico; reescribe el manifiesto. Idempotente. |
| `construir.py completar` | Construye el plan y crea al vuelo lo que los constructores pidan y falte. |
| `construir.py pedir ALIAS --nombre … --departamento 27 --practica …` | Crea uno o varios alias. |
| `construir.py verificar [--plan]` | Alt obligatorio, límites del banco (2 MiB imagen / 20 MiB PDF), 1600 px, checksums, binarios presentes, alias referenciados que existen, videos. |
| `construir.py resumen` | Conteos, peso total y tiempo de descarga estimado. |
| `python3 siembra/multimedia/pruebas_multimedia.py` | Pruebas (no tocan base). |
| `muestra_multimedia.py --solo-plan / --aplicar / --comprobar-api URL` | Muestra de punta a punta contra una base aislada. |

**Cómo entran al banco:** `banco.py` (instalado por `siembra.py` como `plan.imagenes`) añade una fila `Archivos` por alias en el lote `n3-multimedia` (se emite
primero; idempotente por alias en `DatosDeDemostracion`) con `Contenido` en hexadecimal, `Huella` = SHA-256 (es el ETag), ruta `/api/v1/publico/archivos/pnmc-<huella>.<ext>`,
usuario del sistema y dueño institucional. Los vínculos (`ArchivoFotoId`, `ArchivosDeRegistro`, `NoticiasArchivos`, `EventosAgendaArchivos`, `ImagenRuta`) se resuelven por alias.
La API sirve un archivo a anónimos solo si está vinculado a algo publicado: ver `COORDINACION.md`.

Sin pool (p. ej. para solo validar un plan): `SIMUS_SIEMBRA_ASSETS_FALTANTES=ignorar`.
Los assets generados son deterministas por alias (misma tipografía del sistema y misma versión de Pillow); el manifiesto con checksums es la fuente de verdad del pool ya construido.
