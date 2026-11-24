#!/usr/bin/env bash
# Completa las fichas VACÍAS de territorios sonoros y prácticas musicales de la base LOCAL de demo con las definiciones breves
# del libro de siembra (marcadas «Definición preliminar»). Idempotente: no pisa fichas ya escritas ni borra nada.
# Requiere la configuración local (scripts/local/load-local-env.sh) y que la migración V20261123_30 ya esté aplicada.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=load-local-env.sh
source "$ROOT_DIR/scripts/local/load-local-env.sh"
# shellcheck source=sql-local-comun.sh
source "$ROOT_DIR/scripts/local/sql-local-comun.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
python3 -I "$ROOT_DIR/siembra/generador/aplicar_fichas_catalogos.py" > "$TMP/fichas.sql"
sql_fichero "$TMP/fichas.sql" "${1:-$SQL_DB_NAME}"
echo "Fichas breves de catálogos aplicadas (solo las que estaban vacías)."
