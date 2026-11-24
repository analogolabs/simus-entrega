#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# PROBAR SIMUS CON DATOS DE DEMOSTRACIÓN: un solo comando.
#
#   ./scripts/demo/cargar-siembra.sh          # no hace nada: explica qué haría
#   ./scripts/demo/cargar-siembra.sh --si     # lo hace
#
# El repositorio no trae datos cargados: este guion los GENERA al vuelo con el generador determinista
# (`siembra/generador`, `siembra/libro`) y deja una demostración completa lista para usar. En orden:
#   1. Comprueba las herramientas (Docker, .NET, Node, Python 3 con Pillow) y prepara `.env` si falta
#      (con una contraseña de SQL Server generada para esta máquina).
#   2. Instala las dependencias de la web si faltan.
#   3. Levanta SQL Server en Docker, BORRA y reconstruye la base local (migraciones, catálogos y cuentas de arranque).
#   4. Genera el pool de imágenes de demostración en `tmp/siembra/assets/` (ignorado por git; sintético, más las
#      31 fotos libres de `siembra/imagenes/`) y siembra todo: cuentas, festivales, mercados, talleres, espacios, redes, agenda,
#      noticias, Galería (álbumes de fotos y de videos de YouTube) y Celebra la música.
#   5. Levanta Mailpit (correo local), la API y la web, y verifica la demostración consultando la API.
#
# Variables útiles: SIMUS_LOCAL_DB_NAME, SIMUS_LOCAL_SQL_PORT, SIMUS_LOCAL_API_PORT, SIMUS_LOCAL_WEB_PORT (cambian base y puertos),
# SIMUS_SIEMBRA_ASSETS (carpeta del pool), SIMUS_DEMO_CON_MODELO=1 (activa el Asistente con modelo local; descarga el modelo).
# Las cuentas de la demostración parten de la clave «admin»: SOLO para esta máquina; no las expongas en una red pública.
# ---------------------------------------------------------------------------
set -uo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${SIMUS_LOCAL_API_PORT:-8180}"
WEB_PORT="${SIMUS_LOCAL_WEB_PORT:-4300}"
DB="${SIMUS_LOCAL_DB_NAME:-SIMUS_LOCAL}"

if [[ "${1:-}" != "--si" ]]; then
  cat <<EOF
[simus] Carga de la demostración (SIN EJECUTAR). Con --si haría, en $ROOT_DIR:
  1. comprobar herramientas y crear .env si falta
  2. instalar las dependencias de simus-web si faltan
  3. levantar SQL Server en Docker y BORRAR y reconstruir la base $DB
  4. generar el pool de imágenes (tmp/siembra/assets) y sembrar la demostración completa
  5. levantar Mailpit, la API ($API_PORT) y la web ($WEB_PORT), y verificar
Para ejecutarlo: ./scripts/demo/cargar-siembra.sh --si
EOF
  exit 2
fi

faltan=()
for h in docker dotnet node npm python3; do command -v "$h" >/dev/null 2>&1 || faltan+=("$h"); done
if (( ${#faltan[@]} )); then echo "[simus] Faltan herramientas: ${faltan[*]}. Ver el README (Requisitos)." >&2; exit 1; fi
docker info >/dev/null 2>&1 || { echo "[simus] Docker no responde: abre Docker Desktop y vuelve a intentarlo." >&2; exit 1; }
python3 -c "import PIL" 2>/dev/null || { echo "[simus] Falta Pillow (genera las imágenes de demostración): python3 -m pip install --user Pillow" >&2; exit 1; }

# .env con contraseña propia de esta máquina (el archivo no se versiona).
if [[ ! -f .env ]]; then
  cp .env.example .env
fi
if grep -q '^SIMUS_LOCAL_SA_PASSWORD=__SET_LOCALLY__' .env; then
  clave="$(python3 -c "import secrets; print('Sm' + secrets.token_hex(8) + '-Ax9!')")"
  python3 - "$clave" <<'PY'
import re, sys
p = ".env"; t = open(p, encoding="utf-8").read()
open(p, "w", encoding="utf-8").write(re.sub(r"^SIMUS_LOCAL_SA_PASSWORD=__SET_LOCALLY__", "SIMUS_LOCAL_SA_PASSWORD=" + sys.argv[1], t, flags=re.M))
PY
  echo "[simus] .env creado con una contraseña de SQL Server generada para esta máquina."
fi

[[ -d simus-web/node_modules ]] || npm ci --prefix simus-web --no-audit --no-fund || { echo "[simus] npm ci falló." >&2; exit 1; }

# Accesos iniciales seguros: las dos cuentas administrativas (webmaster@ y gestor@simus.test) obligan a cambiar la clave «admin»
# en el primer ingreso (mínimo 12 caracteres). Ver docs/accesos-iniciales.md.
export Database__BootstrapExigirCambioDeClave="${Database__BootstrapExigirCambioDeClave:-true}"
export SIMUS_SIEMBRA_EXIGIR_CAMBIO_DE_CLAVE="${SIMUS_SIEMBRA_EXIGIR_CAMBIO_DE_CLAVE:-1}"
export SIMUS_REINICIO_SIN_COMPROBAR_GIT=1      # el árbol de entrega no sigue a ningún origen
export SIMUS_REINICIO_SIN_INSTANTANEA=1        # primera carga: no hay base previa que respaldar
export SIMUS_SIEMBRA_ASSETS="${SIMUS_SIEMBRA_ASSETS:-$ROOT_DIR/tmp/siembra/assets}"
mkdir -p "$SIMUS_SIEMBRA_ASSETS"

./scripts/demo/reiniciar-demo.sh --si || { echo "[simus] La carga no terminó bien. Registros en tmp/dev/ y en tmp/siembra/informe-de-carga.md." >&2; exit 1; }

cat <<EOF

[simus] Demostración lista.
  Portal y consola ..... http://127.0.0.1:$WEB_PORT
  API (documentación) .. http://localhost:$API_PORT/swagger
  Correo local ......... http://127.0.0.1:8025   (Mailpit: confirmaciones, invitaciones, recuperación)

  Cuentas de prueba (clave inicial «admin», solo en esta máquina; ver docs/accesos-iniciales.md):
    webmaster@simus.test          Webmaster SIMUS: administración (cambio de clave OBLIGATORIO en el primer ingreso, 12+ caracteres)
    gestor@simus.test             Gestor institucional SIMUS (igual)
    camila.restrepo@simus.test    persona y organizaciones (espacio externo)
    editor@simus.test             equipo de una organización
    reclamante@simus.test         reclamaciones en varios estados
    nuevo@simus.test              cuenta sin datos
  Si publicas esto en internet: entra de inmediato a cambiar las claves iniciales y desactiva el acceso rápido de demostración.
  Para detener todo: ./scripts/local/dev-down.sh
EOF
