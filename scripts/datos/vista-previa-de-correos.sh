#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# VISTA PREVIA DE LOS CORREOS DEL SISTEMA: envía un ejemplo de cada correo (invitaciones, cuenta,
# contraseña, Festivales, boletín) a un Mailpit LOCAL y, si se pide, deja capturas a 390 px.
#
#   ./scripts/datos/vista-previa-de-correos.sh                 # envía los ejemplos y dice dónde verlos
#   ./scripts/datos/vista-previa-de-correos.sh --capturas DIR  # además guarda capturas a 390 px + index.html
#   ./scripts/datos/vista-previa-de-correos.sh --bajar         # al terminar, detiene el Mailpit que levantó
#
# Solo bucle local: el transporte rechaza cualquier servidor que no sea 127.0.0.1 y Mailpit guarda en
# memoria. Para NO tocar la bandeja de la demo, defina otros puertos y otro contenedor:
#   SIMUS_LOCAL_SMTP_PORT=11025 SIMUS_LOCAL_MAILPIT_WEB_PORT=18025 \
#   SIMUS_LOCAL_MAILPIT_CONTAINER=simus-vista-previa SIMUS_LOCAL_MAILPIT_PROYECTO=simus-vista-previa \
#   ./scripts/datos/vista-previa-de-correos.sh --capturas <carpeta-de-informes>/revision-visual/correos
# Las capturas necesitan Playwright: se busca en simus-web/node_modules (o SIMUS_PLAYWRIGHT_DIR).
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SMTP_PORT="${SIMUS_LOCAL_SMTP_PORT:-1025}"
WEB_PORT="${SIMUS_LOCAL_MAILPIT_WEB_PORT:-8025}"
CAPTURAS=""
BAJAR=0
while [ $# -gt 0 ]; do
  case "$1" in
    --capturas) CAPTURAS="${2:?falta el directorio}"; shift 2 ;;
    --bajar) BAJAR=1; shift ;;
    *) echo "Uso: $0 [--capturas DIR] [--bajar]" >&2; exit 2 ;;
  esac
done

# NUNCA SOBRE LA BANDEJA DE LA DEMO: «up» recrea el contenedor y vacía su bandeja, y «down» lo quita.
# Por eso se exige un contenedor propio (SIMUS_LOCAL_MAILPIT_CONTAINER); con el nombre de la demo se rechaza.
if [ -z "${SIMUS_LOCAL_MAILPIT_CONTAINER:-}" ] || [ "${SIMUS_LOCAL_MAILPIT_CONTAINER}" = "simus-desarrollo-mailpit" ]; then
  echo "[simus] Defina SIMUS_LOCAL_MAILPIT_CONTAINER (y puertos propios): no se usa la bandeja de la demo." >&2
  exit 2
fi
"$ROOT_DIR/scripts/local/mailpit-local.sh" up || exit 1
trap '[ "$BAJAR" = 1 ] && "$ROOT_DIR/scripts/local/mailpit-local.sh" down' EXIT

dotnet run --project "$ROOT_DIR/simus-api/tools/VistaPreviaDeCorreos" -- "$SMTP_PORT" || exit 1
echo "[simus] Bandeja: http://127.0.0.1:$WEB_PORT"

if [ -n "$CAPTURAS" ]; then
  PW="${SIMUS_PLAYWRIGHT_DIR:-$ROOT_DIR/simus-web}"
  [ -d "$PW/node_modules/playwright-core" ] || { echo "[simus] No hay Playwright en $PW/node_modules (defina SIMUS_PLAYWRIGHT_DIR)." >&2; exit 1; }
  SIMUS_MAILPIT_WEB="http://127.0.0.1:$WEB_PORT" node "$ROOT_DIR/scripts/datos/capturas-de-correos.mjs" "$PW" "$CAPTURAS"
fi
