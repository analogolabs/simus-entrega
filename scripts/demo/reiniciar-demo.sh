#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# REINICIO ÚNICO DE LA DEMO CON EL CÓDIGO FINAL: un solo comando.
#
#   ./scripts/demo/reiniciar-demo.sh          # NO hace nada: explica qué haría y con qué puertos y base
#   ./scripts/demo/reiniciar-demo.sh --si     # lo hace (BORRA y reconstruye la base de la demo)
#
# SOLO SE EJECUTA CUANDO EL USUARIO LO AUTORIZA y desde el repositorio principal, en `main`, ya actualizado con
# el código final (`git pull --ff-only`). Es la única vez que la demo (API en 8180, web en 4300) cambia de código:
# hasta entonces corre el de antes de #233.
#
# En orden:
#   1. Comprueba que estás en `main`, sin cambios y al día con origin/main (SIMUS_REINICIO_SIN_COMPROBAR_GIT=1 lo salta).
#   2. Detiene SOLO la API y la web de la demo (sus dos puertos). No para el contenedor de SQL Server: lo comparten
#      las bases desechables de otras pruebas (`dev-down.sh` sí lo para; aquí no conviene).
#   3. INSTANTÁNEA PREVIA (`demo-instantanea.sh crear previa-al-reinicio-<fecha>`, si la base existe) y
#      `reconstruir-demo-local.sh --si`: borra y monta SIMUS_LOCAL (migraciones, referencia y cuentas de arranque; el
#      usuario del sistema lo crea la API al arrancar un momento en un puerto temporal).
#   4. SIEMBRA INTEGRAL (por omisión, si existen sus archivos): `siembra-integral.sh completa --si` con la confirmación de la
#      base, con los datos públicos completos de tmp/siembra/datos si existen
#      (si no, la muestra versionada) y el pool de imágenes de ahí mismo si existe. Orden de armado: migraciones → seeds de
#      referencia → usuario del sistema → siembra. La API de la demo arranca DESPUÉS (paso 5), nunca antes. Si todo sale
#      bien deja la instantánea `sembrada`, punto de restauración entre tomas. SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL=1 la omite y
#      se hace la siembra clásica de `sembrar-demo.sh` (Cantaclaro, Lucía…) como antes.
#   5. Levanta Mailpit (bandeja de correo local en 127.0.0.1:8025, SMTP 1025), la API y la web con el código de este árbol (en segundo plano; registros en tmp/dev/).
#      Instala las dependencias de simus-web si cambió package.json o package-lock.json (hash guardado en node_modules).
#   6. `verificar-demo-sembrada.sh`: consulta la API (y la base) y falla si falta algo; verifica la siembra integral o la clásica según el caso.
#
# Instantáneas: `./scripts/demo/demo-instantanea.sh listar` y `restaurar <nombre> --si` (detén antes la API y la web). Ver docs/operacion/11-operacion-y-mantenimiento.md.
#
# Las variables SIMUS_LOCAL_DB_NAME, SIMUS_LOCAL_API_PORT y SIMUS_LOCAL_WEB_PORT cambian la base y los puertos (así se
# ensaya sobre una base desechable `SIMUS_*` sin tocar la demo). La clave del SA se lee del .env en el momento y no
# se imprime.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"

DB="${SIMUS_LOCAL_DB_NAME:-SIMUS_LOCAL}"
API_PORT="${SIMUS_LOCAL_API_PORT:-8180}"
WEB_PORT="${SIMUS_LOCAL_WEB_PORT:-4300}"
LOG_DIR="$ROOT_DIR/tmp/dev"

# SIEMBRA INTEGRAL: activa por omisión si el árbol trae el kit; SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL=1 la desactiva.
SIEMBRA_INTEGRAL=0
if [[ "${SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL:-0}" != "1" && -f "$ROOT_DIR/scripts/demo/siembra-integral.sh" \
  && -f "$ROOT_DIR/siembra/generador/siembra.py" ]] && command -v python3 >/dev/null 2>&1; then
  SIEMBRA_INTEGRAL=1
fi
# Datos públicos completos (fuera de git): solo si están; si no, la siembra usa la muestra versionada.
DATOS_INTEGRAL=""
_dir_datos="${SIMUS_SIEMBRA_DATOS:-$ROOT_DIR/tmp/siembra/datos}"
[[ -f "$_dir_datos/festivales.json" ]] && DATOS_INTEGRAL="$_dir_datos"

# En un árbol enlazado el .env vive en el repositorio principal (está fuera de git).
if [[ -z "${SIMUS_LOCAL_SA_PASSWORD:-}" ]]; then
  PRINCIPAL="$(git -C "$ROOT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's#/\.git$##')"
  if [[ -n "$PRINCIPAL" && -f "$PRINCIPAL/.env" ]]; then
    SIMUS_LOCAL_SA_PASSWORD="$(grep -E '^SIMUS_LOCAL_SA_PASSWORD=' "$PRINCIPAL/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
    export SIMUS_LOCAL_SA_PASSWORD
  fi
fi

# Después de resolver la clave: sql-local-comun.sh la lee al incluirse.
source "$ROOT_DIR/scripts/local/sql-local-comun.sh"

if [[ "${1:-}" != "--si" ]]; then
  cat <<EOF
[simus] Reinicio de la demo (SIN EJECUTAR). Con --si haría, en $ROOT_DIR:
  1. comprobar que estás en main, sin cambios y al día con origin/main
  2. detener la API ($API_PORT) y la web ($WEB_PORT); el contenedor de SQL Server se conserva
  3. instantánea previa de la base y BORRAR y reconstruir $DB (esquema, referencia y cuentas de arranque)
  4. $( [[ "$SIEMBRA_INTEGRAL" == "1" ]] && echo "siembra integral (completa --si; datos: $([[ -n "$DATOS_INTEGRAL" ]] && echo "completos" || echo "muestra versionada"))" || echo "siembra clásica de demostración (la integral está desactivada o no está en este árbol)" )
  5. levantar Mailpit, API y web con este código (instalando dependencias de la web si cambiaron)
  6. verificar la demo sembrada consultando la API
Autorización del usuario requerida: ./scripts/demo/reiniciar-demo.sh --si
EOF
  exit 2
fi

if [[ -z "${SIMUS_LOCAL_SA_PASSWORD:-}" ]]; then
  echo "[simus] Falta SIMUS_LOCAL_SA_PASSWORD (entorno o .env)." >&2
  exit 1
fi

# 1/5 El código que se va a dejar corriendo es el de este árbol: que sea el final.
if [[ "${SIMUS_REINICIO_SIN_COMPROBAR_GIT:-0}" != "1" ]]; then
  echo "[simus] 1/6 Comprobando el código..."
  rama="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
  if [[ "$rama" != "main" ]]; then echo "[simus] ABORTADO: estás en '$rama', no en main." >&2; exit 1; fi
  if [[ -n "$(git -C "$ROOT_DIR" status --porcelain --untracked-files=no)" ]]; then
    echo "[simus] ABORTADO: hay cambios sin confirmar en el árbol." >&2; exit 1
  fi
  git -C "$ROOT_DIR" fetch -q origin main || { echo "[simus] ABORTADO: no pude consultar origin/main." >&2; exit 1; }
  if [[ "$(git -C "$ROOT_DIR" rev-parse HEAD)" != "$(git -C "$ROOT_DIR" rev-parse origin/main)" ]]; then
    echo "[simus] ABORTADO: main no está al día con origin/main (git pull --ff-only)." >&2; exit 1
  fi
fi

# 2/5 Solo lo propio de la demo: las dos escuchas. Sin `dev-down.sh`: pararía el SQL Server compartido.
echo "[simus] 2/6 Deteniendo la API ($API_PORT) y la web ($WEB_PORT)..."
for puerto in "$API_PORT" "$WEB_PORT"; do
  pids="$(lsof -tiTCP:"$puerto" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -n "$pids" ]] && kill $pids 2>/dev/null
done
for _ in $(seq 1 15); do
  if [[ -z "$(lsof -tiTCP:"$API_PORT" -sTCP:LISTEN 2>/dev/null)" && -z "$(lsof -tiTCP:"$WEB_PORT" -sTCP:LISTEN 2>/dev/null)" ]]; then break; fi
  sleep 1
done
for puerto in "$API_PORT" "$WEB_PORT"; do
  if [[ -n "$(lsof -tiTCP:"$puerto" -sTCP:LISTEN 2>/dev/null)" ]]; then
    echo "[simus] ABORTADO: el puerto $puerto sigue ocupado." >&2; exit 1
  fi
done

# 3/6 Instantánea previa y reconstrucción. La instantánea se toma ANTES de borrar: es el camino de vuelta
# (`demo-instantanea.sh restaurar previa-al-reinicio-<fecha> --si`). SIMUS_REINICIO_SIN_INSTANTANEA=1 la omite.
if [[ "${SIMUS_REINICIO_SIN_INSTANTANEA:-0}" != "1" ]]; then
  "$ROOT_DIR/scripts/local/local-db-up.sh" >/dev/null 2>&1 || true
  existe="$(sql_consulta "SELECT CAST(DB_ID(N'$DB') AS varchar(12))" master 2>/dev/null | tr -dc '0-9')"
  if [[ -n "$existe" ]]; then
    PREVIA="previa-al-reinicio-$(date +%Y%m%d-%H%M%S)"
    echo "[simus] 3/6 Instantánea previa de $DB: $PREVIA"
    "$ROOT_DIR/scripts/demo/demo-instantanea.sh" crear "$PREVIA" \
      || { echo "[simus] ABORTADO: sin instantánea previa no se borra la base (SIMUS_REINICIO_SIN_INSTANTANEA=1 la omite)." >&2; exit 1; }
  else
    echo "[simus] 3/6 La base $DB no existe todavía: no hay instantánea previa que tomar."
  fi
fi
echo "[simus] 3/6 Reconstruyendo $DB ($( [[ "$SIEMBRA_INTEGRAL" == "1" ]] && echo "migraciones, referencia y cuentas de arranque; la siembra es la integral" || echo "con la siembra clásica" ))..."
SIMUS_RECONSTRUIR_SIN_SEMBRAR_DEMO="$SIEMBRA_INTEGRAL" "$ROOT_DIR/scripts/demo/reconstruir-demo-local.sh" --si \
  || { echo "[simus] La reconstrucción falló; no se levanta nada." >&2; exit 1; }

# 4/6 Siembra integral (la API de la demo todavía NO corre: arranca en el paso 5 y ve la base ya sembrada).
MODO_VERIFICACION="clasica"
if [[ "$SIEMBRA_INTEGRAL" == "1" ]]; then
  MODO_VERIFICACION="integral"
  echo "[simus] 4/6 Siembra integral en $DB (completa --si; datos: ${DATOS_INTEGRAL:-muestra versionada})..."
  SIMUS_SIEMBRA_CONFIRMAR="$DB" "$ROOT_DIR/scripts/demo/siembra-integral.sh" completa --si ${DATOS_INTEGRAL:+--datos "$DATOS_INTEGRAL"} \
    || { echo "[simus] La siembra integral no terminó bien; no se levanta nada. Respaldo y detalle: ver el informe de carga y 'demo-instantanea.sh listar'." >&2; exit 1; }
  # Punto de restauración entre tomas (se sobrescribe en cada reinicio): restaurar sembrada --si.
  "$ROOT_DIR/scripts/demo/demo-instantanea.sh" crear sembrada \
    || echo "[simus] Aviso: no pude crear la instantánea «sembrada» (no es grave)." >&2
else
  echo "[simus] 4/6 Siembra integral omitida (SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL=1 o sin kit): queda la siembra clásica."
fi

# 5/6 Levantar con el código de este árbol.
echo "[simus] 5/6 Levantando Mailpit, API y web..."
mkdir -p "$LOG_DIR"
# MAILPIT: la bandeja local donde se ve llegar el correo (confirmación, invitaciones, recuperación...). Arranca
# vacía y la API envía por SMTP a 127.0.0.1 (solo bucle local, no sale nada a nadie). SIMUS_DEMO_SIN_MAILPIT=1
# lo omite y la API deja los correos en la cola de dbo.Notificaciones (comportamiento de siempre).
SMTP_PORT="${SIMUS_LOCAL_SMTP_PORT:-1025}"
MAILPIT_WEB_PORT="${SIMUS_LOCAL_MAILPIT_WEB_PORT:-8025}"
MAILPIT_ACTIVO=0
if [[ "${SIMUS_DEMO_SIN_MAILPIT:-0}" != "1" ]]; then
  if "$ROOT_DIR/scripts/local/mailpit-local.sh" up; then
    MAILPIT_ACTIVO=1
    export Correo__Proveedor=Smtp
    export Correo__UrlPublica="http://127.0.0.1:$WEB_PORT"
    export Correo__Remitente="no-responder@simus.local"
    export Correo__Smtp__Servidor=127.0.0.1
    export Correo__Smtp__Puerto="$SMTP_PORT"
    export Correo__Smtp__UsarTls=false
    export Correo__IntervaloSegundos=5
    export Correo__MaximoIntentos=20
  else
    echo "[simus] AVISO: Mailpit no arrancó; la demo sigue sin envío de correo (cola en dbo.Notificaciones)." >&2
  fi
fi
# MODELO DE LA CONSULTA ABIERTA (opcional, APAGADO por omisión): SIMUS_DEMO_CON_MODELO=1 levanta el servicio `modelo` del proyecto
# (scripts/local/modelo-local.sh; la primera vez descarga el modelo fijado en infra/modelo/modelo.env) y enciende la consulta abierta.
if [[ "${SIMUS_DEMO_CON_MODELO:-0}" == "1" ]]; then
  if "$ROOT_DIR/scripts/local/modelo-local.sh" up; then
    export Consulta__Modelo__Habilitado=true
    export Consulta__Modelo__Url="http://127.0.0.1:${SIMUS_LOCAL_MODELO_PORT:-11434}"
    export Consulta__Modelo__Nombre="${SIMUS_LOCAL_MODELO_NOMBRE:-$(grep -E '^SIMUS_MODELO_NOMBRE=' "$ROOT_DIR/infra/modelo/modelo.env" | cut -d= -f2-)}"
  else
    echo "[simus] AVISO: el modelo no arrancó; la demo sigue con las preguntas verificadas (consulta abierta apagada)." >&2
  fi
fi
# Acceso rápido de cuentas de demostración (temporal): SIMUS_DEMO_SIN_ACCESO_RAPIDO=1 lo omite; ver docs/operacion/11-operacion-y-mantenimiento.md §11.6 ter.
if [[ -z "${SIMUS_DEMO_CUENTAS_ACCESO_RAPIDO:-}" ]]; then
  # Con la siembra integral, las cuentas de validación; con la clásica, las de Cantaclaro y compañía.
  SIMUS_DEMO_CUENTAS_ACCESO_RAPIDO="$ROOT_DIR/scripts/demo/acceso-rapido-demo-cuentas.tsv"
  [[ "$MODO_VERIFICACION" == "clasica" ]] && SIMUS_DEMO_CUENTAS_ACCESO_RAPIDO="$ROOT_DIR/scripts/demo/acceso-rapido-demo-cuentas-clasica.tsv"
  export SIMUS_DEMO_CUENTAS_ACCESO_RAPIDO
fi
"$ROOT_DIR/scripts/demo/acceso-rapido-demo.sh" escribir || echo "[simus] Aviso: no pude escribir el acceso rápido de demostración (no es grave)." >&2
export Demo__PermitirOperacionSinCorreoConfirmado="${Demo__PermitirOperacionSinCorreoConfirmado:-true}"
# DEPENDENCIAS DE LA WEB: se instalan si cambió package.json o package-lock.json desde la última instalación (hash guardado en
# node_modules/.simus-instalado-hash). Evita «Cannot find module» tras un PR que añade una dependencia (pasó con echarts).
(
  cd "$ROOT_DIR/simus-web" || exit 1
  hash_actual="$(cat package.json package-lock.json 2>/dev/null | shasum -a 256 | cut -d' ' -f1)"
  if [[ ! -d node_modules || "$(cat node_modules/.simus-instalado-hash 2>/dev/null)" != "$hash_actual" ]]; then
    echo "[simus] Instalando dependencias de simus-web (package.json o el lock cambiaron)..."
    if npm ci --no-audit --no-fund >"$LOG_DIR/npm.log" 2>&1 || npm install --no-audit --no-fund >>"$LOG_DIR/npm.log" 2>&1; then
      echo "$hash_actual" > node_modules/.simus-instalado-hash
    else
      echo "[simus] ABORTADO: no se pudieron instalar las dependencias de simus-web (ver $LOG_DIR/npm.log)." >&2; exit 1
    fi
  else
    echo "[simus] Dependencias de simus-web al día."
  fi
) || exit 1
nohup "$ROOT_DIR/scripts/local/api-local.sh" >"$LOG_DIR/api.stdout.log" 2>"$LOG_DIR/api.stderr.log" </dev/null &
echo "$!" > "$LOG_DIR/api.pid"
(
  cd "$ROOT_DIR/simus-web" || exit 1
  printf '{ "/api": { "target": "http://localhost:%s", "secure": false, "changeOrigin": false, "logLevel": "warn" } }\n' "$API_PORT" >"$LOG_DIR/proxy.json"
  nohup npx ng serve --host 127.0.0.1 --port "$WEB_PORT" --proxy-config "$LOG_DIR/proxy.json" \
    >"$LOG_DIR/frontend.stdout.log" 2>"$LOG_DIR/frontend.stderr.log" </dev/null &
  echo "$!" > "$LOG_DIR/frontend.pid"
)
listo=0
for _ in $(seq 1 90); do
  api="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$API_PORT/health/ready" 2>/dev/null)"
  web="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$WEB_PORT" 2>/dev/null)"
  if [[ "$api" == "200" && "$web" == "200" ]]; then listo=1; break; fi
  sleep 4
done
if [[ "$listo" != "1" ]]; then
  echo "[simus] Los servicios no quedaron listos (api=$api web=$web). Registros en $LOG_DIR." >&2
  exit 1
fi

# 6/6 Verificar.
echo "[simus] 6/6 Verificando la demo sembrada ($MODO_VERIFICACION)..."
SIMUS_VERIFICAR_MODO="$MODO_VERIFICACION" SIMUS_VERIFICAR_MAILPIT="$MAILPIT_ACTIVO" "$ROOT_DIR/scripts/demo/verificar-demo-sembrada.sh" "http://127.0.0.1:$API_PORT" || exit 1

echo "[simus] Demo reiniciada con el código final. Web: http://127.0.0.1:$WEB_PORT  API: http://127.0.0.1:$API_PORT/swagger"
[[ "$MAILPIT_ACTIVO" == "1" ]] && echo "[simus] Correos de la demo: http://127.0.0.1:$MAILPIT_WEB_PORT (Mailpit; vacío al reiniciar)."
[[ "$MODO_VERIFICACION" == "integral" ]] && echo "[simus] Entre tomas: ./scripts/demo/demo-instantanea.sh restaurar sembrada --si (detén antes la API y la web). Ver: ./scripts/demo/demo-instantanea.sh listar."
echo "[simus] Siguiente: ver docs/operacion/11-operacion-y-mantenimiento.md §11.7 (revisión final): capturas, comparador e informe."
