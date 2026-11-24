#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# RECONSTRUYE DESDE CERO la base local de demostración.
#
#   ./scripts/demo/reconstruir-demo-local.sh          # pide confirmación
#   ./scripts/demo/reconstruir-demo-local.sh --si     # sin preguntar
#
# BORRA TODOS LOS DATOS de la base indicada en SIMUS_LOCAL_DB_NAME (por defecto SIMUS_LOCAL) y la
# vuelve a montar en este orden:
#
#   1. Esquema vigente ............ SIMUS.Migrador `migrar`
#   2. Datos de referencia ........ scripts/local/seed-local-db.sh (DIVIPOLA, catálogos, roles, acervo)
#   3. Cuentas de arranque ........ la API las crea al iniciar en local (webmaster@simus.test, …)
#   4. Contenidos de demostración . scripts/demo/sembrar-demo.sh (mapa, agenda, noticias, históricos y
#                                   el universo completo de #145)
#
# En pre-entrega no hay datos reales: si la base se ensucia o cambia el esquema, se reconstruye.
# Solo acepta bases cuyo nombre empiece por SIMUS_ y nunca se conecta fuera del contenedor local.
# Ver docs/operacion/15-modos-de-ejecucion-y-paso-a-produccion.md.
# ---------------------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"
source "$ROOT_DIR/scripts/local/sql-local-comun.sh"

API_PORT="${SIMUS_LOCAL_API_PORT:-8180}"
PUERTO_TEMPORAL="${SIMUS_RECONSTRUIR_PUERTO_API:-8197}"

if [[ -z "$SQL_DB_PASSWORD" ]]; then
  echo "[simus] Falta SIMUS_LOCAL_SA_PASSWORD en .env." >&2
  exit 1
fi

if [[ ! "$SQL_DB_NAME" =~ ^SIMUS_[A-Z0-9_]+$ ]]; then
  echo "[simus] ABORTADO: '$SQL_DB_NAME' no es una base local de SIMUS (debe empezar por SIMUS_)." >&2
  exit 1
fi

# Con la API abierta sobre la misma base, el borrado la dejaría sirviendo errores.
if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$API_PORT/health/live" 2>/dev/null \
  || curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$API_PORT/health/ready" 2>/dev/null; then
  echo "[simus] La API local está en marcha en el puerto $API_PORT. Detén los servicios antes:" >&2
  echo "[simus]   ./scripts/local/dev-down.sh" >&2
  exit 1
fi

if [[ "${1:-}" != "--si" ]]; then
  echo "[simus] Esto BORRA todos los datos de la base local $SQL_DB_NAME y la reconstruye."
  read -r -p "[simus] Escribe el nombre de la base para confirmar: " respuesta
  if [[ "$respuesta" != "$SQL_DB_NAME" ]]; then
    echo "[simus] Cancelado. No se tocó nada."
    exit 1
  fi
fi

echo "[simus] 1/5 Contenedor SQL Server local..."
"$ROOT_DIR/scripts/local/local-db-up.sh" >/dev/null

echo "[simus] 2/5 Borrando y creando $SQL_DB_NAME..."
sql_consulta "IF DB_ID(N'$SQL_DB_NAME') IS NOT NULL BEGIN ALTER DATABASE [$SQL_DB_NAME] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$SQL_DB_NAME]; END; CREATE DATABASE [$SQL_DB_NAME];" master

echo "[simus] 3/5 Esquema vigente y datos de referencia..."
"$ROOT_DIR/scripts/local/schema-local.sh" migrar | tail -1
"$ROOT_DIR/scripts/local/seed-local-db.sh" | tail -1

echo "[simus] 4/5 Cuentas de arranque (la API se inicia un momento en el puerto $PUERTO_TEMPORAL)..."
REGISTRO_API="$(mktemp -t simus-api-XXXXXX.log)"
detener_api() { pkill -f "urls http://127.0.0.1:$PUERTO_TEMPORAL" >/dev/null 2>&1 || true; }
trap detener_api EXIT
# Un puerto temporal ocupado haría que la sonda leyera la salud de OTRO proceso (o que el nuestro
# muriera al enlazar) y el fallo saldría disfrazado de «no arrancó».
if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$PUERTO_TEMPORAL/health/live" 2>/dev/null; then
  echo "[simus] El puerto temporal $PUERTO_TEMPORAL ya está ocupado. Define SIMUS_RECONSTRUIR_PUERTO_API con otro." >&2
  exit 1
fi
# COMPILA ANTES, FUERA DEL PLAZO. `dotnet run` compila y arranca dentro de la espera: en un árbol
# recién creado (o tras cambiar de rama) la compilación en frío se comía los 180 s y el guion
# declaraba «la API no arrancó» sin que la API hubiera fallado. La compilación va aparte y su error,
# si lo hay, se muestra tal cual.
# Se compila DESDE simus-api, igual que api-local.sh: lanzado desde otro directorio, dotnet resuelve mal
# las referencias entre proyectos (CS0006/CS0246) y el humo de navegador de la cola fallaba así.
if ! (cd "$ROOT_DIR/simus-api" && dotnet build src/SIMUS.Api/SIMUS.Api.csproj --nologo -v q) >"$REGISTRO_API" 2>&1; then
  echo "[simus] La API no compila; no se pueden crear las cuentas. Salida:" >&2
  tail -30 "$REGISTRO_API" >&2
  exit 1
fi
SIMUS_LOCAL_API_PORT="$PUERTO_TEMPORAL" "$ROOT_DIR/scripts/local/api-local.sh" >"$REGISTRO_API" 2>&1 &
PID_API=$!
lista=""
for _ in $(seq 1 90); do
  if [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$PUERTO_TEMPORAL/health/ready" 2>/dev/null)" == "200" ]]; then
    lista="si"; break
  fi
  # Si el proceso ya murió (puerto, conexión, configuración) no tiene sentido esperar los 180 s.
  if ! kill -0 "$PID_API" 2>/dev/null; then break; fi
  sleep 2
done
detener_api
if [[ -z "$lista" ]]; then
  echo "[simus] La API no arrancó para crear las cuentas. Registro: $REGISTRO_API" >&2
  tail -20 "$REGISTRO_API" >&2
  exit 1
fi
rm -f "$REGISTRO_API"

# SIMUS_RECONSTRUIR_SIN_SEMBRAR_DEMO=1 deja la base en el punto previo a toda siembra (migraciones, referencia y cuentas de
# arranque): es la base que espera la siembra integral (siembra/README.md) y la usa `reiniciar-demo.sh` cuando está activa.
if [[ "${SIMUS_RECONSTRUIR_SIN_SEMBRAR_DEMO:-0}" == "1" ]]; then
  echo "[simus] 5/5 Sin siembra clásica (SIMUS_RECONSTRUIR_SIN_SEMBRAR_DEMO=1): la base queda lista para la siembra integral."
else
  echo "[simus] 5/5 Contenidos de demostración..."
  "$ROOT_DIR/scripts/demo/sembrar-demo.sh" >/dev/null
fi

echo "[simus] Base $SQL_DB_NAME reconstruida:"
sql_consulta "SELECT CONCAT('  Festivales publicados: ', (SELECT COUNT(*) FROM dbo.Festivales WHERE EstadoRegistro = N'publicado'),
  CHAR(10), '  Eventos de agenda:     ', (SELECT COUNT(*) FROM dbo.EventosAgenda),
  CHAR(10), '  Noticias:              ', (SELECT COUNT(*) FROM dbo.Noticias),
  CHAR(10), '  Organizaciones:        ', (SELECT COUNT(*) FROM dbo.Entidades),
  CHAR(10), '  Municipios (DIVIPOLA): ', (SELECT COUNT(*) FROM dbo.Divipola))"
echo "[simus] Inicia SIMUS con ./scripts/local/dev-up.sh. Cuenta de consola: webmaster@simus.test / admin"
