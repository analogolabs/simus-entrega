#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"
DB_NAME="${SIMUS_LOCAL_DB_NAME:-SIMUS_LOCAL}"
DB_PASSWORD="${SIMUS_LOCAL_SA_PASSWORD:-}"
DB_PORT="${SIMUS_LOCAL_SQL_PORT:-14344}"
SQL_CONTAINER="${SIMUS_LOCAL_SQL_CONTAINER:-simus-desarrollo-sqlserver}"
SQL_TOOLS_IMAGE="${SIMUS_LOCAL_SQL_TOOLS_IMAGE:-mcr.microsoft.com/mssql-tools}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[simus] Docker CLI no esta disponible."
  echo "[simus] Abre Docker Desktop y espera a que termine de iniciar."
  exit 1
fi

if [[ -z "$DB_PASSWORD" ]]; then
  echo "[simus] Falta SIMUS_LOCAL_SA_PASSWORD. Definela en el entorno antes de iniciar la base."
  exit 1
fi

# Un contenedor SQL con OTRO nombre (una pila aislada de pruebas, creada aparte) se usa tal cual: `compose up` solo
# gestiona simus-desarrollo-sqlserver y, con otro puerto en el entorno, lo recrearía y tocaría la demo.
if [[ "$SQL_CONTAINER" != "simus-desarrollo-sqlserver" && "$(docker inspect -f '{{.State.Running}}' "$SQL_CONTAINER" 2>/dev/null)" == "true" ]]; then
  echo "[simus] Usando el contenedor SQL Server ya en marcha: $SQL_CONTAINER (sin compose)."
else
  echo "[simus] Iniciando SQL Server local..."
  docker compose -f "$COMPOSE_FILE" up -d sqlserver
fi
SQL_NETWORK="$(docker inspect "$SQL_CONTAINER" --format '{{range $network, $_ := .NetworkSettings.Networks}}{{$network}}{{end}}')"

if [[ -z "$SQL_NETWORK" ]]; then
  echo "[simus] No se pudo determinar la red del contenedor SQL Server."
  exit 1
fi

echo "[simus] Esperando conexion con SQL Server..."
for _ in {1..90}; do
  if command -v sqlcmd >/dev/null 2>&1 \
    && sqlcmd -S "127.0.0.1,$DB_PORT" -U sa -P "$DB_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
    SQLCMD_MODE="host"
    SQLCMD="$(command -v sqlcmd)"
    break
  fi

  if docker exec "$SQL_CONTAINER" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$DB_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
    SQLCMD_MODE="container"
    SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
    break
  fi

  if docker exec "$SQL_CONTAINER" /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "$DB_PASSWORD" -Q "SELECT 1" >/dev/null 2>&1; then
    SQLCMD_MODE="container"
    SQLCMD="/opt/mssql-tools/bin/sqlcmd"
    break
  fi

  # Azure SQL Edge ya no incluye sqlcmd en todas sus variantes. En ese caso,
  # se usa el cliente oficial en un contenedor efimero dentro de la red del SQL.
  if docker run --rm --platform linux/amd64 --network "$SQL_NETWORK" "$SQL_TOOLS_IMAGE" \
    /opt/mssql-tools/bin/sqlcmd -S sqlserver -U sa -P "$DB_PASSWORD" -C -l 5 -Q "SELECT 1" >/dev/null 2>&1; then
    SQLCMD_MODE="tools-container"
    SQLCMD="/opt/mssql-tools/bin/sqlcmd"
    break
  fi

  sleep 2
done

if [[ -z "${SQLCMD:-}" ]]; then
  echo "[simus] No fue posible conectar con SQL Server local."
  echo "[simus] En Mac con Apple Silicon, revisa que Docker Desktop permita emulacion x86_64/Rosetta."
  exit 1
fi

echo "[simus] Creando/verificando base $DB_NAME..."
if [[ "${SQLCMD_MODE:-}" == "host" ]]; then
  sqlcmd -S "127.0.0.1,$DB_PORT" -U sa -P "$DB_PASSWORD" -C \
    -Q "IF DB_ID(N'$DB_NAME') IS NULL CREATE DATABASE [$DB_NAME];"
else
  if [[ "${SQLCMD_MODE:-}" == "tools-container" ]]; then
    docker run --rm --platform linux/amd64 --network "$SQL_NETWORK" "$SQL_TOOLS_IMAGE" \
      /opt/mssql-tools/bin/sqlcmd \
      -S sqlserver \
      -U sa \
      -P "$DB_PASSWORD" \
      -C \
      -Q "IF DB_ID(N'$DB_NAME') IS NULL CREATE DATABASE [$DB_NAME];"
    echo "[simus] Base local lista."
    echo "[simus] Host: 127.0.0.1,$DB_PORT"
    echo "[simus] Database: $DB_NAME"
    echo "[simus] User: sa"
    exit 0
  fi

  docker exec "$SQL_CONTAINER" "$SQLCMD" \
    -S localhost \
    -U sa \
    -P "$DB_PASSWORD" \
    -C \
    -Q "IF DB_ID(N'$DB_NAME') IS NULL CREATE DATABASE [$DB_NAME];"
fi

echo "[simus] Base local lista."
echo "[simus] Host: 127.0.0.1,$DB_PORT"
echo "[simus] Database: $DB_NAME"
echo "[simus] User: sa"
