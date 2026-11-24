# Integración de los cinco temas de la siembra 

Cada tema (festivales, personas, contenido, masivo, multimedia) se escribió sin ver los alias de los demás. Este documento recoge lo que se reconcilió al fusionarlos y lo que quedó como decisión.

## Personas y organizaciones frente a festivales y mercados

La relación persona/organización–festival no tiene tabla propia: se materializa en `Festivales.Director`, `OrganizacionPrincipalId` y en `EntidadesAliadasDeRegistro` (que sí tiene FK real `EntidadId` → `Entidades`; en mercados, por edición con el módulo `ediciones-mercado`). `generador/reconciliar_libros.py` aplica, al comienzo del plan y de forma idempotente:

| Proceso del libro de festivales | Relación con el libro de personas |
|---|---|
| Festival de Arrullos y Alabaos del Baudó | **Organizadora**: Corporación Cabildo Sonoro del Atrato; directora Nubia Estela Palacios Mosquera (se retiran la corporación y la persona que el libro de festivales había inventado para él) |
| Feria de Circulación Musical del Golfo (mercado) | **Organizadora**: Productora Marea Alta (Margarita Buelvas); se retira la agencia inventada |
| Los otros 10 procesos (Ciénaga, Páramo, Ariari, Cravo, Caquetá, Cove, Orinoco, Guanentina, Valle Alto, Vitrina cafetera) | **Aliadas** de la región o la práctica (11 organizaciones), con vínculo real y «Alianza con …» en su ficha |

Las 18 personas figuran en la ficha del proceso con su rol (directora, invitada, coordinadora…). Los 12+2 alias `n1.festival.*`/`n1.mercado.*` que proponía el libro de personas y que no existían se sustituyeron por los reales; los textos que citaban sus festivales propios se reescribieron al festival real (año de inicio, mes y duración del libro de festivales). La organización de Popayán, Valledupar, Neiva y las demás conservan en su prosa los eventos propios que no están registrados en la plataforma.

## Contenido frente a la muestra

Noticias y agenda citan procesos, organizaciones y personas de la **muestra** (`siembra/libro/libro_muestra.py`): Encuentro de Chirimía del San Juan, Marimba de la Ensenada, Gran Rueda de Bullerengue, Rueda Caribe Sonoro, talleres, espacios y redes. También dependen de ellos las cuentas de validación y las reclamaciones. Se verificó que ningún alias, correo, documento, nombre de proceso, organización o persona se repite entre la muestra y el libro. Se reconcilió así:

- **Fechas**: las ediciones de la muestra que las noticias dan por ciertas llevan ahora esas fechas (`FECHAS_DE_EDICION` en `libro/contenido/__init__.py`, usado por `Constructor.fechas_fijas`): chirimía 13–15 jun 2024 y 17–19 jul 2025 (2027 programada para junio), marimba 2024 y 2025, Gran Rueda 3–5 abr 2025, Rueda Caribe Sonoro 5–6 sep 2024, 21–22 nov 2025 y 18–19 mar 2027; el Encuentro Andino Electrónico y el Mercado del Pacífico Sur siguen «en preparación» sin fechas (este último pasó de 2026 a 2027, como dicen las notas).
- **Solapes temáticos** (no de identidad) que se conservan a propósito: Quibdó (Raíz y Tambor y su chirimía, de la muestra, frente al Cabildo Sonoro del Atrato y el festival del Baudó, del libro: dos procesos distintos del Chocó, de barrios y de río), Armenia (Taller Cuerdas del Eje frente a la Escuela de Lutería El Roble) y Barranquilla (Bullerengue Vivo frente a Marea Alta). Retirarlos obligaría a reescribir decenas de textos de noticias y eventos, las reclamaciones y las cuentas de validación, que dependen de la muestra. Si se decide retirarlos, es un cambio de contenido, no de integración.

## Multimedia

`generador/multimedia_integral.py` resuelve contra `siembra/multimedia/manifiesto.csv` los `img.*` de todos los libros:

- **festivales**: portada, logotipo y 3 de galería del festival (`ArchivosDeRegistro`, módulo `festivales`), afiche por edición (`ediciones-festival`); los mercados no tienen módulo propio, así que portada, logotipo y afiche van por edición (`ediciones-mercado`); la API las sirve a anónimos solo con la edición y el mercado publicados (404 si no) y las lista en `GET /publico/mercados/{id}/ediciones/imagenes`.
- **personas**: foto del perfil (`PerfilesPublicos.ArchivoFotoId`) solo si hay autorización `perfil_publico` vigente y perfil visible; logotipo de cada organización (`Entidades.ArchivoFotoId`). Las organizaciones solo llevan logotipo: `ArchivosDeRegistro` no admite el módulo de entidades y `Entidades` no tiene columna de portada, así que el libro de personas ya no pide portada ni galería de organización (decisión: no ampliar el modelo por una imagen decorativa; habría que añadir una migración, el vínculo en el Banco y la ficha pública de la organización). Los mercados sí sirven sus imágenes: portada, logotipo y afiche por edición (`ediciones-mercado`) se ven a anónimos cuando la edición y el mercado están publicados, y la ficha pública del mercado las muestra en cada edición.
- **contenido**: `img.noticia.<clave>` / `img.evento.<clave>` se resuelven como `….imagen` (el libro no escribe el rol) con `NoticiasArchivos` y `EventosAgendaArchivos`.
- **masivo**: piezas del pool genérico (`img.pool.*`) por huella del alias: foto en ~70 % de los perfiles públicos con autorización, logotipo en ~65 % de las organizaciones, portada en ~80 % de los festivales publicados, imagen en ~70 % de los eventos publicados y foto en ~60 % de talleres, espacios y redes publicados.
- Se añadieron `construir.py reparar` (regenera, con el meta del manifiesto, los binarios generados que falten en este pool) y la deduplicación de logotipos idénticos (dos organizaciones con las mismas iniciales, región y forma daban el mismo archivo).

## Defectos corregidos

- Con los datos públicos completos, `festivales_publicos` fallaba al ordenar ediciones cuyo `anio` llega como texto (`"2019"`, `"2020-2021"`): `datos_publicos.normalizar_anios` convierte el texto numérico a entero; un rango no es un año de edición y el constructor lo omite.
- `validaciones.py`: se conservó la variante de la rama masiva (compara referencias y catálogos como tuplas); la de festivales era equivalente.
