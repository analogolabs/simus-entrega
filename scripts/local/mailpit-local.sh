#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MAILPIT LOCAL: la bandeja web donde se ve llegar el correo de SIMUS en la demo y en los videos.
#
#   ./scripts/local/mailpit-local.sh up        # arranca Mailpit (SMTP 127.0.0.1:1025, web http://127.0.0.1:8025) y lo deja vacío
#   ./scripts/local/mailpit-local.sh vaciar    # borra todos los mensajes de la bandeja
#   ./scripts/local/mailpit-local.sh estado    # responde 0 si la web de Mailpit contesta
#   ./scripts/local/mailpit-local.sh down      # detiene y quita SOLO el contenedor de Mailpit
#
# Solo bucle local: no entrega correo a nadie. Puertos y nombre cambian con SIMUS_LOCAL_SMTP_PORT,
# SIMUS_LOCAL_MAILPIT_WEB_PORT y SIMUS_LOCAL_MAILPIT_CONTAINER (así una prueba aislada no toca la demo);
# SIMUS_LOCAL_MAILPIT_PROYECTO cambia el proyecto de compose. No toca SQL Server.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"
SMTP_PORT="${SIMUS_LOCAL_SMTP_PORT:-1025}"
WEB_PORT="${SIMUS_LOCAL_MAILPIT_WEB_PORT:-8025}"
export SIMUS_LOCAL_SMTP_PORT="$SMTP_PORT" SIMUS_LOCAL_MAILPIT_WEB_PORT="$WEB_PORT"
# Compose exige la clave del SA aunque aquí no se use: un valor de relleno, nunca la real.
export SIMUS_LOCAL_SA_PASSWORD="${SIMUS_LOCAL_SA_PASSWORD:-no-se-usa-aqui}"
PROYECTO="${SIMUS_LOCAL_MAILPIT_PROYECTO:-}"
compose() { docker compose ${PROYECTO:+-p "$PROYECTO"} -f "$COMPOSE_FILE" "$@"; }

responde() { curl -fsS --max-time 3 -o /dev/null "http://127.0.0.1:$WEB_PORT/api/v1/info" 2>/dev/null; }

case "${1:-}" in
  up)
    command -v docker >/dev/null 2>&1 || { echo "[simus] Docker no está disponible." >&2; exit 1; }
    # Recrear deja la bandeja vacía (Mailpit guarda en memoria).
    compose up -d --quiet-pull --force-recreate mailpit >/dev/null || { echo "[simus] No se pudo arrancar Mailpit (¿puerto $SMTP_PORT o $WEB_PORT ocupado?)." >&2; exit 1; }
    for _ in $(seq 1 30); do responde && break; sleep 1; done
    responde || { echo "[simus] Mailpit no respondió en http://127.0.0.1:$WEB_PORT." >&2; exit 1; }
    echo "[simus] Mailpit listo: SMTP 127.0.0.1:$SMTP_PORT, bandeja http://127.0.0.1:$WEB_PORT"
    ;;
  vaciar)
    curl -fsS --max-time 5 -X DELETE "http://127.0.0.1:$WEB_PORT/api/v1/messages" >/dev/null \
      && echo "[simus] Bandeja de Mailpit vaciada." \
      || { echo "[simus] Mailpit no responde en $WEB_PORT." >&2; exit 1; }
    ;;
  estado)
    responde && echo "[simus] Mailpit responde en http://127.0.0.1:$WEB_PORT" || { echo "[simus] Mailpit no responde en $WEB_PORT." >&2; exit 1; }
    ;;
  down)
    compose rm -sf mailpit >/dev/null && echo "[simus] Mailpit detenido."
    ;;
  *)
    echo "Uso: $0 up|vaciar|estado|down" >&2; exit 2 ;;
esac
