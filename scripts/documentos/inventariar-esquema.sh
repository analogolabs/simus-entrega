#!/usr/bin/env bash
set -euo pipefail

# Inventario repetible del esquema de la base local (carril de datos, T-161).
#   ./scripts/documentos/inventariar-esquema.sh generar --etiqueta antes-catalogos [--con-filas]
#   ./scripts/documentos/inventariar-esquema.sh comparar tmp/inventarios/antes/inventario.json tmp/inventarios/despues/inventario.json
#   ./scripts/documentos/inventariar-esquema.sh autoprueba
# Lee la conexión del mismo .env que los demás guiones; no escribe credenciales.

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"

if ! command -v sqlcmd >/dev/null 2>&1 && [[ "${1:-}" != "autoprueba" && "${1:-}" != "comparar" ]]; then
  echo "[inventario] Falta 'sqlcmd' en el PATH (brew install sqlcmd)." >&2
  exit 1
fi

exec python3 "$ROOT_DIR/scripts/documentos/inventario_esquema.py" "$@"
