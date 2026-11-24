#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# PASADA RÁPIDA DE SQL SERVER: solo las clases de prueba que corren contra el motor real.
#
#   ./scripts/validacion/validar-sqlserver-rapido.sh [ruta-del-repositorio]
#
# POR QUÉ EXISTE. `scripts/validacion/validar-local.sh` corre la suite de la API sobre SQLite, que no tiene los CHECK,
# las claves foráneas ni los índices únicos del esquema real. Lo que escribe bitácora, historial o toca un
# CK solo se comprueba contra SQL Server, y la pasada completa tarda de 15 a 30 minutos: nadie la repite en
# cada fusión. Dos PR de 10 de noviembre de 2026 entraron en verde y dejaron en `main` dos
# pruebas de SQL Server en rojo, porque nadie las corrió después de unirlos.
#
# QUÉ CORRE. Las pruebas cuya clase lleva «SqlServer» en el nombre (`FullyQualifiedName~SqlServer`): son
# exactamente las que escriben bitácora e historial o dependen de una restricción de la base. Es una
# fracción de la suite y no sustituye a la pasada completa antes de un cambio grande (docs/desarrollo/10-pruebas.md §10.3).
#
# CÓMO. Usa el SQL Server del contenedor local (el que levanta `scripts/local/dev-up.sh`) y una base
# desechable con prefijo SIMUS_PRUEBAS_: el arnés NUNCA toca SIMUS_LOCAL. La contraseña se lee de
# SIMUS_LOCAL_SA_PASSWORD (del entorno o, si falta, SOLO esa línea del .env) y no se imprime. NO se carga el
# .env entero en el entorno de las pruebas: rompería las pruebas de entorno.
# ---------------------------------------------------------------------------
set -euo pipefail

RAIZ_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO="${1:-$RAIZ_SCRIPT}"

if [[ ! -f "$REPO/simus-api/tests/SIMUS.Api.Tests/SIMUS.Api.Tests.csproj" ]]; then
  echo "[simus] No encuentro simus-api/tests/SIMUS.Api.Tests en $REPO." >&2
  exit 1
fi

CONTENEDOR="${SIMUS_LOCAL_SQL_CONTAINER:-simus-desarrollo-sqlserver}"
if ! command -v docker >/dev/null 2>&1 || ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTENEDOR"; then
  echo "[simus] El SQL Server local ($CONTENEDOR) no está en marcha: ./scripts/local/dev-up.sh lo levanta." >&2
  echo "[simus] Sin él no hay pasada de SQL Server; la cola no la da por buena." >&2
  exit 1
fi

CLAVE="${SIMUS_LOCAL_SA_PASSWORD:-}"
if [[ -z "$CLAVE" && -f "$RAIZ_SCRIPT/.env" ]]; then
  CLAVE="$(grep -E '^SIMUS_LOCAL_SA_PASSWORD=' "$RAIZ_SCRIPT/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
fi
if [[ -z "$CLAVE" ]]; then
  echo "[simus] Falta SIMUS_LOCAL_SA_PASSWORD (en el entorno o en .env)." >&2
  exit 1
fi

echo "[simus] Pasada rápida de SQL Server (clases con «SqlServer» en el nombre)…"
cd "$REPO/simus-api"
SIMUS_PRUEBAS_SQLSERVER=1 SIMUS_LOCAL_SA_PASSWORD="$CLAVE" \
  dotnet test tests/SIMUS.Api.Tests/SIMUS.Api.Tests.csproj --configuration Release \
  --filter "FullyQualifiedName~SqlServer" --logger "console;verbosity=minimal"
