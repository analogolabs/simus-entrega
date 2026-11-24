#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Siembra los contenidos de DEMOSTRACIÓN en la base local: mapa (Festivales, organizaciones y
# agenda), noticias y Festivales históricos sin organización, listos para reclamar.
#
#   ./scripts/demo/sembrar-demo.sh            # todas
#   ./scripts/demo/sembrar-demo.sh mapa       # solo una
#   ./scripts/demo/sembrar-demo.sh noticias
#   ./scripts/demo/sembrar-demo.sh historicos
#   ./scripts/demo/sembrar-demo.sh procesos-historicos   # Mercados, Redes, Lutería y Espacios históricos
#./scripts/demo/sembrar-demo.sh completa # universo completo
#./scripts/demo/sembrar-demo.sh entrega # solo la capa de entrega: siembra limpia y plausible 
#
# `completa` siembra organizaciones con equipo, Festivales y Mercados con todas sus ediciones,
# historial, propuestas y retiro, eventos, noticias, Catálogo Editorial, personas con perfil
# público y las imágenes del Banco de archivos que usan. Retira primero lo suyo (lo reconoce por
# sus correos, slugs `demo-completa-` y códigos `PNMC-ED-DEMO-`), no por la procedencia.
#
# Cada semilla retira lo que ella misma sembró antes (procedencia `siembra`) y vuelve a sembrar:
# se puede repetir sin duplicar. No toca registros de otro origen. `historicos` no retira nada:
# solo inserta los que falten (se reconocen por su clave de demostración).
#
# Por qué van aparte de `seed-local-db.sh`: aquella carga solo datos de REFERENCIA (DIVIPOLA,
# catálogos, roles, acervo editorial). Esto es contenido inventado para enseñar SIMUS en
# pre-entrega. NO PUEDE TOCAR PRODUCCIÓN: `migrar` no aplica `simus-database/seed/`.
#
# Requiere las cuentas de arranque (webmaster@simus.test), que crea la API al iniciar en local. Para
# montar todo desde cero: ./scripts/demo/reconstruir-demo-local.sh
# ---------------------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"
source "$ROOT_DIR/scripts/local/sql-local-comun.sh"

SEMILLAS_DIR="$ROOT_DIR/simus-database/seed"
# EL ORDEN IMPORTA. `procesos-historicos` iba definido pero FUERA de esta lista: la siembra «de todo» (y por tanto
# `reconstruir-demo-local.sh`) dejaba sin históricos de Mercados, Redes, Lutería y Espacios. Va después de `completa`
# (necesita la entidad institucional que la API crea al arrancar) y antes de `sede`, que les asigna su sede principal.
declare -a NOMBRES=(mapa noticias historicos completa procesos-historicos correcciones perfiles sede directorio roles-jerarquicos celebra entrega)
semilla_de() {
  case "$1" in
    mapa)     echo "$SEMILLAS_DIR/V20260912_01__demostracion_mapa_ecosistemico.sql" ;;
    noticias) echo "$SEMILLAS_DIR/V20261104_01__demostracion_noticias.sql" ;;
    historicos) echo "$SEMILLAS_DIR/V20261106_07__festivales_historicos_reclamables_demo.sql" ;;
    # Históricos de Mercados, Redes, Lutería y Espacios, sin responsable (decisión 131).
    procesos-historicos) echo "$SEMILLAS_DIR/V20261117_76__procesos_historicos_demo.sql" ;;
    completa) echo "$SEMILLAS_DIR/V20261106_11__demostracion_completa.sql" ;;
    # LO QUE UNA SIEMBRA ANTERIOR ESCRIBIÓ MAL, arreglado en su sitio y sin volver a sembrar.
    # Va último: corrige filas que las otras pueden haber creado. Idempotente.
    correcciones) echo "$SEMILLAS_DIR/V20261111_31__corregir_lugares_de_demostracion.sql" ;;
    # El perfil público enriquecido (ME): biografía, oficios y las organizaciones que cada persona elige mostrar. Idempotente.
    perfiles) echo "$SEMILLAS_DIR/V20261112_41__demostracion_perfil_enriquecido.sql" ;;
    # La sede principal de todo proceso de la demostración (decisión 119). Va después de las que crean procesos. Idempotente.
    sede) echo "$SEMILLAS_DIR/V20261117_11__demostracion_sede_principal.sql" ;;
    # El directorio de personas (DIR): clasificación de las personas de la demostración y seis personas más. Idempotente.
    directorio) echo "$SEMILLAS_DIR/V20261117_65__demostracion_directorio_de_personas.sql" ;;
    # Roles en categorías y subcategorías (decisión 135): personas con varios roles por categoría. La migración ya siembra
    # los valores; esto solo clasifica a tres personas de la demostración. Va tras `directorio`. Idempotente.
    roles-jerarquicos) echo "$SEMILLAS_DIR/V20261119_01__demostracion_roles_jerarquicos.sql" ;;
    # El micrositio «Celebra la música»: ediciones 2025 y 2026 con su contenido editorial y los eventos y noticias etiquetados con su
    # edición (L7). Retira lo suyo por el prefijo `celebra-demo-` y vuelve a sembrar. Va antes de `entrega`.
    celebra) echo "$SEMILLAS_DIR/V20261120_21__celebra_la_musica_siembra.sql" ;;
    # La capa de ENTREGA: quita los rótulos «demostración», da nombres, organizadores y contactos propios a los
    # Festivales y organizaciones generados para el mapa, reparte sus fechas desde hoy y deja pocas citas, variadas, por artista.
    # Va la última: pule lo que sembraron las demás. Idempotente. Sirve sola sobre una base ya sembrada.
    entrega) echo "$SEMILLAS_DIR/V20261119_90__demostracion_entrega_limpieza.sql" ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# LAS IMÁGENES DE LA SIEMBRA COMPLETA VIAJAN COMO JPEG, NO DENTRO DEL .sql.
#
# El Banco de archivos guarda los bytes en `dbo.Archivos.Contenido`. Meterlos en hexadecimal en un
# guion versionado lo haría ilegible y el doble de pesado: aquí se lee `demo-imagenes/imagenes.tsv`
# y se escribe un guion temporal con un INSERT por imagen (huella SHA-256, peso y medidas). Son
# ilustraciones generadas por `simus-web/tools/generar-imagenes-demo.mjs`, no fotos de terceros.
# `completa` corre en nueve pasos: retirar las redes, los espacios, los talleres y lo anterior, cargar las
# imágenes, sembrar y añadir los talleres de lutería, los espacios para música en vivo y las redes y
# centros de documentación.
# ---------------------------------------------------------------------------
cargar_imagenes_demo() {
  local carpeta="$SEMILLAS_DIR/demo-imagenes" guion archivo ancho alto alternativo pie ruta huella peso
  guion="$(mktemp -t simus-imagenes-XXXXXX.sql)"
  {
    echo "SET NOCOUNT ON;"
    echo "DECLARE @Carga int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'webmaster@simus.test');"
    tail -n +2 "$carpeta/imagenes.tsv" | while IFS=$'\t' read -r archivo ancho alto alternativo pie; do
      [[ -z "$archivo" ]] && continue
      ruta="$carpeta/$archivo"
      huella="$(shasum -a 256 "$ruta" | cut -d' ' -f1)"
      peso="$(wc -c < "$ruta" | tr -d ' ')"
      alternativo="${alternativo//\'/\'\'}"
      pie="${pie//\'/\'\'}"
      echo "INSERT INTO dbo.Archivos (NombreOriginal, NombreAlmacenado, Extension, TipoMime, PesoBytes, RutaAlmacenamiento, TextoAlternativo, Pie, Credito, IdUsuarioCarga, FechaCarga, Contenido, Huella, Ancho, Alto)"
      echo "VALUES (N'demo-completa-$archivo', N'pnmc-$huella.jpg', N'.jpg', N'image/jpeg', $peso, N'/api/v1/publico/archivos/pnmc-$huella.jpg', N'$alternativo', N'$pie', N'Ilustración generada para la demostración de SIMUS', @Carga, SYSUTCDATETIME(), 0x$(xxd -p "$ruta" | tr -d '\n'), N'$huella', $ancho, $alto);"
    done
  } > "$guion"
  sql_fichero "$guion"
  rm -f "$guion"
}

# ---------------------------------------------------------------------------
# LAS PIEZAS OFICIALES DE «CELEBRA LA MÚSICA» (L7): WebP optimizados y sin metadatos tomados del sitio del Ministerio de Cultura
# (celebralamusica.mincultura.gov.co, con autorización del PNMC), leídos de `celebra-imagenes/imagenes.tsv`. A diferencia de las
# ilustraciones de la demostración, SE CARGAN SIN BORRAR: un archivo ya cargado (mismo NombreOriginal) no se vuelve a insertar, así las
# ediciones que ya lo citan conservan su clave. Cada imagen lleva su crédito en `Archivos.Credito`.
# ---------------------------------------------------------------------------
cargar_imagenes_celebra() {
  local carpeta="$SEMILLAS_DIR/celebra-imagenes" guion archivo ancho alto alternativo credito ruta huella peso
  guion="$(mktemp -t simus-celebra-XXXXXX.sql)"
  {
    echo "SET NOCOUNT ON;"
    echo "DECLARE @Carga int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'webmaster@simus.test');"
    tail -n +2 "$carpeta/imagenes.tsv" | while IFS=$'\t' read -r archivo ancho alto alternativo credito; do
      [[ -z "$archivo" ]] && continue
      ruta="$carpeta/$archivo"
      huella="$(shasum -a 256 "$ruta" | cut -d' ' -f1)"
      peso="$(wc -c < "$ruta" | tr -d ' ')"
      alternativo="${alternativo//\'/\'\'}"
      credito="${credito//\'/\'\'}"
      echo "IF NOT EXISTS (SELECT 1 FROM dbo.Archivos WHERE NombreOriginal = N'$archivo')"
      echo "INSERT INTO dbo.Archivos (NombreOriginal, NombreAlmacenado, Extension, TipoMime, PesoBytes, RutaAlmacenamiento, TextoAlternativo, Pie, Credito, IdUsuarioCarga, FechaCarga, Contenido, Huella, Ancho, Alto)"
      echo "VALUES (N'$archivo', N'pnmc-$huella.webp', N'.webp', N'image/webp', $peso, N'/api/v1/publico/archivos/pnmc-$huella.webp', N'$alternativo', N'$credito', N'$credito', @Carga, SYSUTCDATETIME(), 0x$(xxd -p "$ruta" | tr -d '\n'), N'$huella', $ancho, $alto);"
    done
  } > "$guion"
  sql_fichero "$guion"
  rm -f "$guion"
}

if [[ -z "$SQL_DB_PASSWORD" ]]; then
  echo "[simus-demo] Falta SIMUS_LOCAL_SA_PASSWORD." >&2
  exit 1
fi

# `git worktree` aísla el código y no la base. Un árbol atrasado escribiendo en la base compartida
# revivió esquema retirado el 24 de agosto de 2026 sin que ninguna prueba lo viera.
if git -C "$ROOT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  GIT_DIR_PROPIO="$(git -C "$ROOT_DIR" rev-parse --absolute-git-dir)"
  GIT_DIR_COMUN="$(git -C "$ROOT_DIR" rev-parse --path-format=absolute --git-common-dir)"
  if [ "$GIT_DIR_PROPIO" != "$GIT_DIR_COMUN" ] \
    && [ "$SQL_DB_NAME" = "SIMUS_LOCAL" ] \
    && [ "${SIMUS_PERMITIR_SIEMBRA_DESDE_WORKTREE:-0}" != "1" ]; then
    echo "[simus-demo] ABORTADO: árbol enlazado sobre la base compartida SIMUS_LOCAL." >&2
    echo "[simus-demo]   Siembra una base propia:  SIMUS_LOCAL_DB_NAME=SIMUS_MI_RAMA $0" >&2
    exit 1
  fi
fi

pedidas=("$@")
[[ ${#pedidas[@]} -eq 0 ]] && pedidas=("${NOMBRES[@]}")

for nombre in "${pedidas[@]}"; do
  if ! fichero="$(semilla_de "$nombre")"; then
    echo "[simus-demo] Semilla desconocida: $nombre. Opciones: ${NOMBRES[*]}" >&2
    exit 2
  fi
  echo "[simus-demo] Sembrando $nombre en $SQL_DB_NAME..."
  if [[ "$nombre" == "completa" ]]; then
    # LOS TALLERES DE LUTERÍA CUELGAN DE LAS ORGANIZACIONES Y DE LAS CUENTAS que retira el paso
    # siguiente, así que se retiran primero.
    sql_fichero "$SEMILLAS_DIR/V20261110_82__demostracion_espacios_retiro.sql"
    sql_fichero "$SEMILLAS_DIR/V20261110_52__demostracion_talleres_retiro.sql"
    # LA AGENDA DE CITAS CUELGA DE UNA ORGANIZACION DE LA DEMOSTRACION (docs/referencia/26-agenda-de-citas-y-mercados.md): se retira antes de ella.
    sql_fichero "$SEMILLAS_DIR/V20261115_71__demostracion_agenda_de_citas_retiro.sql"
    # LO MISMO LAS REDES Y CENTROS DE DOCUMENTACIÓN.
    sql_fichero "$SEMILLAS_DIR/V20261110_72__demostracion_redes_retiro.sql"
    sql_fichero "$SEMILLAS_DIR/V20261106_10__demostracion_completa_retiro.sql"
    cargar_imagenes_demo
  fi
  if [[ "$nombre" == "celebra" ]]; then
    cargar_imagenes_celebra
  fi
  sql_fichero "$fichero"
  if [[ "$nombre" == "completa" ]]; then
    # Y SE SIEMBRAN DESPUÉS: necesitan el universo que acaba de crear `completa`.
    sql_fichero "$SEMILLAS_DIR/V20261110_53__demostracion_talleres.sql"
    # Y LA AGENDA DE CITAS DEL MERCADO DEL VALLE: artistas, bookers invitados y citas en tres estados.
    sql_fichero "$SEMILLAS_DIR/V20261115_72__demostracion_agenda_de_citas.sql"
    # LOS ESPACIOS PARA MÚSICA EN VIVO, IGUAL QUE LOS TALLERES: necesitan el mismo universo (docs/referencia/25-modulos-restantes.md).
    sql_fichero "$SEMILLAS_DIR/V20261110_83__demostracion_espacios.sql"
    sql_fichero "$SEMILLAS_DIR/V20261110_73__demostracion_redes.sql"
    # Y LA SEDE PRINCIPAL DE TODO LO SEMBRADO, para que el mapa lo sitúe (decisión 119).
    sql_fichero "$SEMILLAS_DIR/V20261117_11__demostracion_sede_principal.sql"
  fi
done

echo "[simus-demo] Listo. Para retirarla o renovarla, vuelve a ejecutar el guion."
