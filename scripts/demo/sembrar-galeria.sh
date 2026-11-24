#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SIEMBRA SOLO LA GALERÍA PÚBLICA en una demo YA SEMBRADA. Nunca se ejecuta sola ni la llama otro guion.
#
#   ./scripts/demo/sembrar-galeria.sh            # sin --si: valida el plan (sin tocar la base) y explica qué haría
#   ./scripts/demo/sembrar-galeria.sh --si       # aplica SOLO los álbumes (exige SIMUS_SIEMBRA_CONFIRMAR=<nombre de la base>)
#
# Qué añade: los álbumes de fotos, de videos y mixtos del libro `siembra/libro/galeria` (incluidos «Voces y Saberes» y «Voces y Saberes · archivo»), con las
# filas de `Archivos` que sus fotos piden (pool multimedia, fuera de git), todo registrado en `dbo.DatosDeDemostracion` (lote `n1-galeria`).
# También: la MINIATURA PROPIA de cada video (se descarga UNA vez de i.ytimg.com a siembra/multimedia, fuera de git, y se inserta en `Archivos`; el navegador nunca
# pide nada a YouTube hasta «Reproducir»), los ítems «Sin álbum» y los títulos y resúmenes mejorados de los videos. Sobre una demo ya sembrada con la versión
# anterior aplica además UPDATE idempotentes (miniatura, portada de los álbumes de video, textos); no borra nada. Solo se necesita red si faltan miniaturas en el pool.
# Es IDEMPOTENTE por alias: repetirlo no duplica nada y no toca el resto de la demo. No hace limpieza ni respaldo: solo añade.
#
# Antes: las migraciones V20261122_10 y V20261122_30 (tablas de la Galería, ítems sin álbum y miniatura de video) deben estar aplicadas (`scripts/local/schema-local.sh migrar`) y la demo, sembrada.
# Seguridad: opera solo sobre la base de SIMUS_LOCAL_DB_NAME y solo si su nombre empieza por SIMUS_. No usa red ni servicios institucionales.
# La clave del SA se lee del entorno o de .env y nunca se imprime.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"
source "$ROOT_DIR/scripts/local/sql-local-comun.sh"

APLICAR=""
for arg in "$@"; do
  case "$arg" in
    --si) APLICAR=1 ;;
    -h|--help) sed -n 2,21p "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "[galeria] Opción desconocida: $arg (usa --si o --help)." >&2; exit 2 ;;
  esac
done

if [[ -z "$APLICAR" ]]; then
  # Sin --si no se toca ninguna base: solo se valida el plan.
  python3 -I "$ROOT_DIR/siembra/multimedia/miniaturas_de_videos.py" --revisar || echo "[galeria] Faltan miniaturas en el pool: con --si se descargan (necesita red, una sola vez)." >&2
  python3 -I "$ROOT_DIR/siembra/generador/siembra.py" --solo-plan --solo-galeria || exit 1
  echo "[galeria] (SIN EJECUTAR) Para aplicarlo: SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME $0 --si" >&2
  exit 2
fi

if [[ -z "$SQL_DB_PASSWORD" ]]; then echo "[galeria] Falta SIMUS_LOCAL_SA_PASSWORD." >&2; exit 1; fi
if [[ ! "$SQL_DB_NAME" =~ ^SIMUS_[A-Z0-9_]+$ ]]; then
  echo "[galeria] ABORTADO: '$SQL_DB_NAME' no es una base local de SIMUS (debe empezar por SIMUS_)." >&2; exit 1
fi
if [[ "${SIMUS_SIEMBRA_CONFIRMAR:-}" != "$SQL_DB_NAME" ]]; then
  echo "[galeria] Esto escribe en $SQL_DB_NAME. Confirma con SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME." >&2; exit 2
fi

tablas="$(sql_consulta "SET NOCOUNT ON; SELECT (CASE WHEN OBJECT_ID(N'dbo.GaleriaAlbumes', N'U') IS NULL THEN 0 ELSE 1 END) + (CASE WHEN COL_LENGTH(N'dbo.GaleriaItems', N'MiniaturaArchivoId') IS NULL THEN 0 ELSE 1 END)" | tr -dc '0-9')"
if [[ "${tablas:-0}" != "2" ]]; then
  echo "[galeria] Faltan las tablas o columnas de la Galería: aplica antes las migraciones V20261122_10 y V20261122_30 (scripts/local/schema-local.sh migrar)." >&2; exit 1
fi
sembrada="$(sql_consulta "SET NOCOUNT ON; SELECT CASE WHEN OBJECT_ID(N'dbo.DatosDeDemostracion', N'U') IS NULL THEN 0 ELSE 1 END" | tr -dc '0-9')"
sis="$(sql_consulta "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.Usuarios WHERE CorreoElectronico = N'sistema@pnmc.local'" | tr -dc '0-9')"
if [[ "${sembrada:-0}" == "0" || "${sis:-0}" == "0" ]]; then
  echo "[galeria] La base no tiene la tabla del kit de demostración (dbo.DatosDeDemostracion) ni el usuario del sistema: primero la siembra integral (siembra-integral.sh preparar / completa)." >&2; exit 1
fi
if [[ ! -d "$(python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); import comun; print(comun.pool_dir(None))' "$ROOT_DIR/siembra/multimedia")" ]]; then
  echo "[galeria] Falta el pool de imágenes (siembra/multimedia/construir.py base)." >&2; exit 1
fi

python3 -I "$ROOT_DIR/siembra/multimedia/miniaturas_de_videos.py" || { echo "[galeria] No se pudieron obtener las miniaturas de los videos (¿sin red?). Nada se escribió en la base." >&2; exit 1; }
python3 -I "$ROOT_DIR/siembra/generador/siembra.py" --aplicar --solo-galeria || { echo "[galeria] La siembra de la Galería falló (cada lote va en una transacción)." >&2; exit 1; }

ajustes="$(mktemp -t simus-galeria-ajustes-XXXXXX.sql)"
python3 -I "$ROOT_DIR/siembra/generador/siembra.py" --sql-ajustes-galeria "$ajustes" || { rm -f "$ajustes"; exit 1; }
if sql_fichero "$ajustes"; then rm -f "$ajustes"; else rm -f "$ajustes"; echo "[galeria] Los ajustes de miniaturas y textos fallaron." >&2; exit 1; fi

echo "[galeria] Verificación:"
sql_consulta "SELECT a.Slug + N'  ' + a.Tipo + N'  publicado=' + CAST(a.Publicado AS nvarchar(1)) + N'  fotos=' + CAST((SELECT COUNT(*) FROM dbo.GaleriaItems i WHERE i.GaleriaAlbumId = a.IdGaleriaAlbum AND i.TipoItem = N'foto') AS nvarchar(6)) + N'  videos=' + CAST((SELECT COUNT(*) FROM dbo.GaleriaItems i WHERE i.GaleriaAlbumId = a.IdGaleriaAlbum AND i.TipoItem = N'video') AS nvarchar(6)) FROM dbo.GaleriaAlbumes a ORDER BY a.Orden"
sql_consulta "SELECT N'sin álbum: ' + CAST(COUNT(*) AS nvarchar(6)) + N' ítems; videos con miniatura: ' + CAST((SELECT COUNT(*) FROM dbo.GaleriaItems WHERE TipoItem = N'video' AND MiniaturaArchivoId IS NOT NULL) AS nvarchar(6)) FROM dbo.GaleriaItems WHERE GaleriaAlbumId IS NULL"
echo "[galeria] Listo. Para comprobarlo en la API: GET /api/v1/publico/galeria/albumes"
