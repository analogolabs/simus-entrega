#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SIEMBRA SOLO LAS EDICIONES 2025 Y 2026 DE «CELEBRA LA MÚSICA» EN UNA DEMO YA SEMBRADA.
#
#   ./scripts/demo/sembrar-celebra-ediciones.sh          # sin --si: explica qué haría y no toca nada
#   SIMUS_SIEMBRA_CONFIRMAR=SIMUS_LOCAL ./scripts/demo/sembrar-celebra-ediciones.sh --si
#
# Qué hace: aplica el plan mínimo del libro `celebra` (siembra/libro/celebra, lote `n1-celebra`): las dos ediciones publicadas con portada,
# colores, textos, cifras, categorías, caja de herramientas, preguntas frecuentes, galería y aliados con logotipo, más los 16 archivos del
# Banco que citan. Las noticias y los eventos de cada edición NO se tocan: ya los trae la siembra integral con el proyecto transversal de
# la edición, y el micrositio los filtra por él.
#
# Qué NO hace: no borra nada, no limpia, no toca cuentas, fichas, estados de revisión, solicitudes ni historiales. Solo INSERTA filas nuevas en
# las tablas Celebra* y dbo.Archivos (y su marca en dbo.DatosDeDemostracion, con lote n1-celebra, nivel 1, procedencia híbrida).
#
# --solo-aliados: el mismo flujo, pensado para una demo que ya tiene las ediciones. Además de insertar lo que falte (los logos reales de los aliados
# —Batuta, Asociación Nacional de las Artes y Poliedro, tomados de la página oficial— y su grupo «Aliados»), apunta los recursos «Aliados» ya
# existentes al logo real (siembra/kit/20_celebra_logos_de_aliados.sql). No borra nada ni toca el resto de lo sembrado. Sin la opción, el SQL
# de logos también se aplica (es idempotente), de modo que ambas formas dejan el mismo resultado.
#
# IDEMPOTENTE: cada fila lleva su alias en dbo.DatosDeDemostracion; volver a ejecutarlo no duplica nada. Cada lote va en una transacción.
# Antes de escribir hace una instantánea del respaldo (`antes-de-celebra-<fecha>`; SIMUS_CELEBRA_SIN_RESPALDO=1 la omite) y, al terminar, comprueba
# las restricciones de las tablas Celebra* y cuenta lo sembrado. Si ya existe una edición 2025 o 2026 que NO viene de la siembra (cargada a mano o
# por la siembra clásica), se detiene sin escribir: no se pisa lo ajeno.
#
# Seguridad: solo la base de SIMUS_LOCAL_DB_NAME (por omisión SIMUS_LOCAL) y solo si su nombre empieza por SIMUS_; escribir exige
# SIMUS_SIEMBRA_CONFIRMAR con el nombre exacto de la base. La clave del SA sale del entorno o de .env y nunca se imprime.
# Para ensayar: SIMUS_LOCAL_DB_NAME=SIMUS_MI_PRUEBA SIMUS_LOCAL_SQL_CONTAINER=… SIMUS_LOCAL_SQL_PORT=… ./scripts/demo/sembrar-celebra-ediciones.sh --si
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"
# En un árbol enlazado el .env vive en el repositorio principal (fuera de git); la clave se lee sin imprimirla.
if [[ -z "${SIMUS_LOCAL_SA_PASSWORD:-}" ]]; then
  principal="$(git -C "$ROOT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's#/\.git$##')"
  if [[ -n "$principal" && -f "$principal/.env" ]]; then
    SIMUS_LOCAL_SA_PASSWORD="$(grep -E '^SIMUS_LOCAL_SA_PASSWORD=' "$principal/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"; export SIMUS_LOCAL_SA_PASSWORD
  fi
fi
source "$ROOT_DIR/scripts/local/sql-local-comun.sh"

SI=""
SOLO_ALIADOS=""
for a in "$@"; do
  case "$a" in
    --si) SI=1 ;;
    --solo-aliados) SOLO_ALIADOS=1 ;;
    -h|--ayuda) sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "[celebra] Opción desconocida: $a (usa --si, --solo-aliados o --ayuda)." >&2; exit 2 ;;
  esac
done

if [[ -z "$SQL_DB_PASSWORD" ]]; then echo "[celebra] Falta SIMUS_LOCAL_SA_PASSWORD." >&2; exit 1; fi
if [[ ! "$SQL_DB_NAME" =~ ^SIMUS_[A-Z0-9_]+$ ]]; then
  echo "[celebra] ABORTADO: '$SQL_DB_NAME' no es una base local de SIMUS (debe empezar por SIMUS_)." >&2; exit 1
fi

if [[ -z "$SI" ]]; then
  cat >&2 <<EOF
[celebra] Sembraría en $SQL_DB_NAME las ediciones publicadas 2025 y 2026 de Celebra la música (portada, colores, textos, categorías, caja de herramientas,
[celebra] preguntas frecuentes, galería y aliados con logotipo) y los 16 archivos que citan. Solo inserta; no borra ni cambia nada más. Idempotente.
[celebra] (SIN EJECUTAR) Para ejecutarlo: SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME $0 --si
EOF
  exit 2
fi
if [[ "${SIMUS_SIEMBRA_CONFIRMAR:-}" != "$SQL_DB_NAME" ]]; then
  echo "[celebra] Esta acción escribe en $SQL_DB_NAME. Confirma con SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME." >&2; exit 2
fi

echo "[celebra] 1/4 Comprobando la base $SQL_DB_NAME"
hay() { sql_consulta "SET NOCOUNT ON; $1" | tr -dc '0-9'; }
if [[ "$(hay "SELECT CASE WHEN OBJECT_ID(N'dbo.DatosDeDemostracion', N'U') IS NULL THEN 0 ELSE 1 END")" != "1" ]]; then
  echo "[celebra] La base no tiene dbo.DatosDeDemostracion: no es una demo sembrada con la siembra integral (scripts/demo/siembra-integral.sh)." >&2; exit 1
fi
if [[ "$(hay "SELECT CASE WHEN OBJECT_ID(N'dbo.CelebraEdiciones', N'U') IS NULL THEN 0 ELSE 1 END")" != "1" ]]; then
  echo "[celebra] Falta la tabla dbo.CelebraEdiciones: aplica antes las migraciones (scripts/local/schema-local.sh migrar)." >&2; exit 1
fi
if [[ "$(hay "SELECT COUNT(*) FROM dbo.ProyectosTransversales WHERE Codigo IN (N'celebra-la-musica-2025', N'celebra-la-musica-2026')")" != "2" ]]; then
  echo "[celebra] Faltan los proyectos transversales celebra-la-musica-2025 y celebra-la-musica-2026 (los crea la migración V20261120_20)." >&2; exit 1
fi
if [[ "$(hay "SELECT COUNT(*) FROM dbo.Usuarios WHERE CorreoElectronico = N'sistema@pnmc.local'")" == "0" ]]; then
  echo "[celebra] Falta el usuario del sistema (la API lo crea al arrancar una vez en local)." >&2; exit 1
fi
ajenas="$(hay "SELECT COUNT(*) FROM dbo.CelebraEdiciones e WHERE e.Anio IN (2025, 2026) AND NOT EXISTS (SELECT 1 FROM dbo.DatosDeDemostracion d WHERE d.Tabla = N'CelebraEdiciones' AND d.IdRegistro = CAST(e.IdCelebraEdicion AS nvarchar(120)))")"
if [[ "${ajenas:-0}" != "0" ]]; then
  echo "[celebra] Ya existe una edición 2025 o 2026 que no viene de la siembra: no se escribe nada. Retírala a mano (o restaura una instantánea) y vuelve a intentarlo." >&2; exit 1
fi

if [[ "${SIMUS_CELEBRA_SIN_RESPALDO:-0}" != "1" ]]; then
  echo "[celebra] 2/4 Respaldo (instantánea)"
  respaldo="antes-de-celebra-$(date +%Y%m%d-%H%M%S)"
  "$ROOT_DIR/scripts/demo/demo-instantanea.sh" crear "$respaldo" || { echo "[celebra] Sin respaldo no se continúa (SIMUS_CELEBRA_SIN_RESPALDO=1 lo omite)." >&2; exit 1; }
else
  echo "[celebra] 2/4 Respaldo omitido (SIMUS_CELEBRA_SIN_RESPALDO=1)"
fi

echo "[celebra] 3/4 Aplicando el plan mínimo de las ediciones"
SALIDA_PLAN="$(mktemp -d -t simus-celebra-XXXXXX)"   # el plan lleva los binarios en hexadecimal: se borra al terminar
trap 'rm -rf "$SALIDA_PLAN"' EXIT
python3 -I "$ROOT_DIR/siembra/generador/siembra.py" --aplicar --solo-celebra --salida "$SALIDA_PLAN" || {
  echo "[celebra] La siembra falló (cada lote es una transacción: no quedó nada a medias)${respaldo:+. Respaldo: $respaldo}." >&2; exit 1; }

echo "[celebra] ${SOLO_ALIADOS:+Aliados: }logos reales de los aliados (sin borrar nada)"
sql_fichero "$ROOT_DIR/siembra/kit/20_celebra_logos_de_aliados.sql" || {
  echo "[celebra] No se pudieron actualizar los logos de los aliados${respaldo:+. Respaldo: $respaldo}." >&2; exit 1; }

echo "[celebra] 4/4 Verificación"
rotas="$(sql_consulta "SET NOCOUNT ON; CREATE TABLE #r (Tabla nvarchar(256), Restriccion nvarchar(256), Donde nvarchar(max));
INSERT INTO #r EXEC (N'DBCC CHECKCONSTRAINTS (N''dbo.CelebraEdiciones'') WITH ALL_CONSTRAINTS, NO_INFOMSGS');
INSERT INTO #r EXEC (N'DBCC CHECKCONSTRAINTS (N''dbo.CelebraRecursos'') WITH ALL_CONSTRAINTS, NO_INFOMSGS');
INSERT INTO #r EXEC (N'DBCC CHECKCONSTRAINTS (N''dbo.CelebraGaleria'') WITH ALL_CONSTRAINTS, NO_INFOMSGS');
SELECT COUNT(*) FROM #r" | tr -dc '0-9')"
resumen="$(sql_consulta "SET NOCOUNT ON; SELECT CONCAT((SELECT COUNT(*) FROM dbo.CelebraEdiciones WHERE Publicada = 1), N' ediciones publicadas, ',
 (SELECT COUNT(*) FROM dbo.CelebraCategorias), N' categorías, ', (SELECT COUNT(*) FROM dbo.CelebraRecursos), N' recursos, ',
 (SELECT COUNT(*) FROM dbo.CelebraPreguntas), N' preguntas, ', (SELECT COUNT(*) FROM dbo.CelebraGaleria), N' imágenes de galería')" | tr -d '\r' | grep -F 'ediciones publicadas' | sed 's/ *$//')"
echo "[celebra] $resumen"
if [[ "${rotas:-1}" != "0" ]]; then echo "[celebra] ATENCIÓN: hay restricciones rotas en las tablas Celebra* (${rotas:-?}). Restaura ${respaldo:-la instantánea} con demo-instantanea.sh." >&2; exit 1; fi
echo "[celebra] Listo. Comprueba con: ./scripts/demo/verificar-demo-sembrada.sh (API) o abre /pnmc/estrategias/celebra-la-musica/2026."
