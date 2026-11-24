#!/usr/bin/env bash
set -euo pipefail

# Punto unico para consultar o aplicar el esquema local mediante DbUp. Este
# guion nunca escribe una clave en el repositorio y no reemplaza el bootstrap
# del API hasta que la paridad se haya probado sobre SQL Server real.

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"

ACTION="${1:-estado}"

if [[ "$ACTION" == "ayuda" || "$ACTION" == "--help" || "$ACTION" == "-h" ]]; then
  exec dotnet run --project "$ROOT_DIR/simus-api/src/SIMUS.Migrador/SIMUS.Migrador.csproj" -- ayuda
fi

case "$ACTION" in
  estado|migrar|baseline|divipola-mgn-2025|divipola-mgn-2025-si-falta) ;;
  *)
    echo "Uso: $0 {estado|migrar|baseline|divipola-mgn-2025|divipola-mgn-2025-si-falta|ayuda}" >&2
    exit 2
    ;;
esac

if [[ "$ACTION" == "baseline" && "${SIMUS_CONFIRMAR_BASELINE:-}" != "SI" ]]; then
  echo "[pnmc-schema] 'baseline' solo marca guiones como aplicados y no debe usarse en una base nueva." >&2
  echo "[pnmc-schema] Confirma de forma explicita con SIMUS_CONFIRMAR_BASELINE=SI." >&2
  exit 2
fi

DB_PASSWORD="${SIMUS_LOCAL_SA_PASSWORD:-}"
DB_NAME="${SIMUS_LOCAL_DB_NAME:-SIMUS_LOCAL}"
DB_PORT="${SIMUS_LOCAL_SQL_PORT:-14344}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "[pnmc-schema] Falta SIMUS_LOCAL_SA_PASSWORD. Definela en el entorno o en .env." >&2
  exit 1
fi

CONNECTION="Server=127.0.0.1,$DB_PORT;Initial Catalog=$DB_NAME;Persist Security Info=False;User ID=sa;Password=$DB_PASSWORD;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=True;Connection Timeout=30;"

exec dotnet run --project "$ROOT_DIR/simus-api/src/SIMUS.Migrador/SIMUS.Migrador.csproj" -- \
  "$ACTION" --conexion "$CONNECTION"
