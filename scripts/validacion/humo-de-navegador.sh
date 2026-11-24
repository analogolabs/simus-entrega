#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# PASADA DE HUMO DE NAVEGADOR: un conjunto corto de recorridos Playwright (`@backend`) contra un entorno
# efímero levantado desde el código de la ruta indicada.
#
#   ./scripts/validacion/humo-de-navegador.sh [ruta-del-repositorio]
#
# POR QUÉ EXISTE. `scripts/validacion/validar-local.sh` no abre un navegador: Karma usa una API simulada y la API corre
# sobre SQLite. Entre el 10 y el 13 de noviembre de 2026 entraron a `main` más de 25 PR que cambian pantallas,
# y nueve pruebas de navegador quedaron rotas sin que ningún PR lo supiera (, barrido de navegador).
# Esta pasada cubre lo que ninguna otra ve: que la consola, el panel, el portal, el ingreso y un flujo de
# escritura siguen funcionando con la API y la base reales.
#
# QUÉ CORRE (8 recorridos, unos dos minutos de pruebas; con la base y los servidores, de 8 a 12 minutos):
#   ingreso y panel .......... organizacion-activa-en-la-url, sesion-con-nombre-simus
#   consola .................. consola-arquitectura-de-informacion, acciones-por-estado
#   portal ................... portal-publico-enlaces-y-agenda, directorios-estandar
#   escritura de punta a punta recorrido-del-festival, festivales-y-ediciones
# Es OPCIONAL y viene apagada: cada PR tardaría ese tiempo de más. Para un cambio de pantallas, o antes de una
# entrega, conviene activarla; el barrido completo de las 35 pruebas es `scripts/` + docs/desarrollo/10-pruebas.md §10.7.
#
# CÓMO. Reconstruye una base DESECHABLE `SIMUS_PRUEBAS_HUMO` (nunca SIMUS_LOCAL; otro nombre con SIMUS_HUMO_BASE),
# levanta la API (8241) y la web (4361) desde la ruta indicada, corre los recorridos y, al terminar, apaga los servidores y borra la base.
# Usa el SQL Server del contenedor local. La clave se lee de SIMUS_LOCAL_SA_PASSWORD (entorno o, si falta,
# SOLO esa línea del .env) y no se imprime. No toca los puertos 8180 y 4300 ni los contenedores.
#
# LA WEB ES EL BUILD DE PRODUCCIÓN SERVIDO ESTÁTICO (D-08), no `ng serve`: lo que se verifica es el artefacto que se
# despliega, sin la capa de anotación de desarrollo ni las cuentas de desarrollo, y sin las peticiones fallidas a
# servicios locales que `ng serve` deja en la consola. `tools/servidor-estatico.mjs --api <puerto>` reenvía `/api`
# a la API de esta pasada, de modo que el puerto del API sale de aquí y no de `proxy.conf.cjs`.
# ---------------------------------------------------------------------------
set -uo pipefail

RAIZ_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO="${1:-$RAIZ_SCRIPT}"
BASE="${SIMUS_HUMO_BASE:-SIMUS_PRUEBAS_HUMO}"
API_PUERTO="${SIMUS_HUMO_API_PUERTO:-8241}"
WEB_PUERTO="${SIMUS_HUMO_WEB_PUERTO:-4361}"
ESPECIFICACIONES=(
  e2e/organizacion-activa-en-la-url.spec.ts
  e2e/sesion-con-nombre-simus.spec.ts
  e2e/consola-arquitectura-de-informacion.spec.ts
  e2e/acciones-por-estado.spec.ts
  e2e/portal-publico-enlaces-y-agenda.spec.ts
  e2e/directorios-estandar.spec.ts
  e2e/recorrido-del-festival.spec.ts
  e2e/festivales-y-ediciones.spec.ts
)

if [[ ! -f "$REPO/simus-web/playwright.config.ts" ]]; then
  echo "[simus] No encuentro simus-web/playwright.config.ts en $REPO." >&2
  exit 1
fi

CONTENEDOR="${SIMUS_LOCAL_SQL_CONTAINER:-simus-desarrollo-sqlserver}"
if ! command -v docker >/dev/null 2>&1 || ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTENEDOR"; then
  echo "[simus] El SQL Server local ($CONTENEDOR) no está en marcha: ./scripts/local/dev-up.sh lo levanta." >&2
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

for puerto in "$API_PUERTO" "$WEB_PUERTO"; do
  if lsof -ti "tcp:$puerto" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[simus] El puerto $puerto está ocupado: otra pasada de humo en curso o un servicio ajeno. No se toca." >&2
    exit 1
  fi
done

TMP="$(mktemp -d)"
export SIMUS_LOCAL_SA_PASSWORD="$CLAVE"
export SIMUS_LOCAL_DB_NAME="$BASE"
export SIMUS_LOCAL_API_PORT="$API_PUERTO"
export SIMUS_RECONSTRUIR_PUERTO_API="$((API_PUERTO + 1))"

# Apaga SOLO lo que esta pasada levantó (sus dos puertos exclusivos) y borra la base desechable.
limpiar() {
  local pids
  for puerto in "$API_PUERTO" "$WEB_PUERTO" "$((API_PUERTO + 1))"; do
    pids="$(lsof -ti "tcp:$puerto" -sTCP:LISTEN 2>/dev/null || true)"
    [[ -n "$pids" ]] && kill $pids 2>/dev/null
  done
  # shellcheck disable=SC1091
  ROOT_DIR="$REPO" source "$REPO/scripts/local/sql-local-comun.sh" 2>/dev/null \
    && sql_consulta "IF DB_ID(N'$BASE') IS NOT NULL BEGIN ALTER DATABASE [$BASE] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$BASE]; END" master >/dev/null 2>&1
  echo "[simus] Humo de navegador: servidores apagados y base $BASE retirada. Registros en $TMP"
}
trap limpiar EXIT

echo "[simus] Humo de navegador 1/4: reconstruyendo la base desechable ${BASE}…"
if ! "$REPO/scripts/demo/reconstruir-demo-local.sh" --si > "$TMP/reconstruir.log" 2>&1; then
  echo "[simus] No se pudo reconstruir la base:" >&2
  tail -n 15 "$TMP/reconstruir.log" >&2
  exit 1
fi

echo "[simus] Humo de navegador 2/4: API en $API_PUERTO y web (build de producción) en ${WEB_PUERTO}…"
export Demo__PermitirOperacionSinCorreoConfirmado=true
"$REPO/scripts/local/api-local.sh" > "$TMP/api.log" 2>&1 &
cd "$REPO/simus-web" || exit 1
if [[ ! -d node_modules ]]; then
  npm ci --no-audit --no-fund > "$TMP/npm.log" 2>&1 || { echo "[simus] npm ci falló (ver $TMP/npm.log)." >&2; exit 1; }
fi
# El build se hace en un directorio propio de la pasada: no pisa el `dist/` de quien tenga el árbol abierto.
if ! npx ng build --output-path "$TMP/web" > "$TMP/build.log" 2>&1; then
  echo "[simus] El build de producción falló (ver $TMP/build.log)." >&2
  tail -n 15 "$TMP/build.log" >&2
  exit 1
fi
node tools/servidor-estatico.mjs --puerto "$WEB_PUERTO" --api "$API_PUERTO" --raiz "$TMP/web/browser" > "$TMP/web.log" 2>&1 &

listo=0
for _ in $(seq 1 90); do
  api="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$API_PUERTO/health/live")"
  web="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$WEB_PUERTO")"
  if [[ "$api" == "200" && "$web" == "200" ]]; then listo=1; break; fi
  sleep 4
done
if [[ "$listo" != "1" ]]; then
  echo "[simus] El entorno no quedó listo (api=$api web=$web). Ver $TMP/api.log y $TMP/web.log." >&2
  exit 1
fi

echo "[simus] Humo de navegador 3/4: ${#ESPECIFICACIONES[@]} recorridos…"
SIMUS_BASE_URL="http://127.0.0.1:$WEB_PUERTO" npx playwright test "${ESPECIFICACIONES[@]}" --reporter=list
resultado=$?

echo "[simus] Humo de navegador 4/4: $([[ $resultado -eq 0 ]] && echo 'en verde' || echo 'EN ROJO')."
exit "$resultado"
