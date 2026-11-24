#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MODELO DE LA CONSULTA ABIERTA: el servicio `modelo` del proyecto (Ollama en un contenedor), igual que Mailpit.
#
#   ./scripts/local/modelo-local.sh up        # arranca el servicio, descarga el modelo fijado (solo la primera vez) y lo carga en memoria
#   ./scripts/local/modelo-local.sh estado    # responde 0 si el servicio contesta y tiene el modelo fijado
#   ./scripts/local/modelo-local.sh down      # detiene y quita SOLO el contenedor (el volumen con el modelo se conserva)
#   ./scripts/local/modelo-local.sh borrar    # además borra el volumen (la próxima vez se vuelve a descargar)
#
# NO depende del computador de nadie: es un servicio del proyecto con imagen y modelo fijados en infra/modelo/modelo.env.
# La API lo usa con Consulta__Modelo__Habilitado=true y Consulta__Modelo__Url=http://127.0.0.1:$SIMUS_LOCAL_MODELO_PORT (en compose
# interno: http://modelo:11434). Apagado por omisión: sin él, la consulta guiada sigue con sus 35 preguntas.
# Variables: SIMUS_LOCAL_MODELO_PORT (11434), SIMUS_LOCAL_MODELO_CONTAINER, SIMUS_LOCAL_MODELO_PROYECTO, SIMUS_LOCAL_MODELO_CPUS (4),
# SIMUS_LOCAL_MODELO_MEMORIA (8g), SIMUS_LOCAL_MODELO_NOMBRE (para probar otro modelo sin tocar el fijado).
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"
# shellcheck disable=SC1091
source "$ROOT_DIR/infra/modelo/modelo.env"
PUERTO="${SIMUS_LOCAL_MODELO_PORT:-11434}"
NOMBRE="${SIMUS_LOCAL_MODELO_NOMBRE:-$SIMUS_MODELO_NOMBRE}"
export SIMUS_LOCAL_MODELO_PORT="$PUERTO" SIMUS_MODELO_IMAGEN
export SIMUS_LOCAL_MODELO_CPUS="${SIMUS_LOCAL_MODELO_CPUS:-4}" SIMUS_LOCAL_MODELO_MEMORIA="${SIMUS_LOCAL_MODELO_MEMORIA:-8g}"
CONTENEDOR="${SIMUS_LOCAL_MODELO_CONTAINER:-simus-desarrollo-modelo}"
export SIMUS_LOCAL_MODELO_CONTAINER="$CONTENEDOR"
# Compose exige la clave del SA aunque aquí no se use: un valor de relleno, nunca la real.
export SIMUS_LOCAL_SA_PASSWORD="${SIMUS_LOCAL_SA_PASSWORD:-no-se-usa-aqui}"
PROYECTO="${SIMUS_LOCAL_MODELO_PROYECTO:-}"
compose() { docker compose ${PROYECTO:+-p "$PROYECTO"} -f "$COMPOSE_FILE" --profile modelo "$@"; }
responde() { curl -fsS --max-time 3 -o /dev/null "http://127.0.0.1:$PUERTO/api/tags" 2>/dev/null; }
tiene_modelo() { curl -fsS --max-time 3 "http://127.0.0.1:$PUERTO/api/tags" 2>/dev/null | grep -q "\"name\":\"$NOMBRE\""; }

case "${1:-}" in
  up)
    command -v docker >/dev/null 2>&1 || { echo "[simus] Docker no está disponible." >&2; exit 1; }
    compose up -d --quiet-pull modelo >/dev/null || { echo "[simus] No se pudo arrancar el modelo (¿puerto $PUERTO ocupado?)." >&2; exit 1; }
    for _ in $(seq 1 60); do responde && break; sleep 1; done
    responde || { echo "[simus] El servicio del modelo no respondió en http://127.0.0.1:$PUERTO." >&2; exit 1; }
    if ! tiene_modelo; then
      echo "[simus] Descargando el modelo $NOMBRE (solo la primera vez; queda en el volumen)..."
      docker exec "$CONTENEDOR" ollama pull "$NOMBRE" >/dev/null 2>&1 || { echo "[simus] No se pudo descargar el modelo." >&2; exit 1; }
    fi
    ID_REAL="$(docker exec "$CONTENEDOR" ollama list | awk -v n="$NOMBRE" '$1==n {print $2}')"
    if [[ "$NOMBRE" == "$SIMUS_MODELO_NOMBRE" && -n "$ID_REAL" && "$ID_REAL" != "$SIMUS_MODELO_ID" ]]; then
      echo "[simus] AVISO: el modelo descargado ($ID_REAL) no coincide con el fijado ($SIMUS_MODELO_ID). Revisa infra/modelo/modelo.env." >&2
    fi
    # Calentar: cargar el modelo en memoria para que la primera pregunta real no pague el arranque en frío.
    curl -fsS --max-time 120 -o /dev/null -H 'Content-Type: application/json' \
      -d "{\"model\":\"$NOMBRE\",\"prompt\":\"\",\"keep_alive\":\"2h\"}" "http://127.0.0.1:$PUERTO/api/generate" || true
    echo "[simus] Modelo listo: $NOMBRE en http://127.0.0.1:$PUERTO (API: Consulta__Modelo__Habilitado=true Consulta__Modelo__Url=http://127.0.0.1:$PUERTO Consulta__Modelo__Nombre=$NOMBRE)"
    ;;
  estado)
    responde && tiene_modelo && echo "[simus] El modelo $NOMBRE responde en http://127.0.0.1:$PUERTO" \
      || { echo "[simus] El modelo no responde (o falta $NOMBRE) en $PUERTO." >&2; exit 1; }
    ;;
  down)
    compose rm -sf modelo >/dev/null && echo "[simus] Servicio del modelo detenido (el volumen se conserva)."
    ;;
  borrar)
    compose rm -sf modelo >/dev/null; docker volume rm "${PROYECTO:-simus-desarrollo-local}_simus_desarrollo_modelo" >/dev/null 2>&1 \
      && echo "[simus] Servicio y volumen del modelo borrados." || echo "[simus] Servicio detenido; no había volumen que borrar."
    ;;
  *)
    echo "Uso: $0 up|estado|down|borrar" >&2; exit 2 ;;
esac
