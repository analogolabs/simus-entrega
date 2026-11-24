#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# INSTANTÁNEAS DE LA BASE DE LA DEMO: respaldar y restaurar en menos de un minuto entre tomas de video.
#
#   ./scripts/demo/demo-instantanea.sh listar
#   ./scripts/demo/demo-instantanea.sh crear <nombre>            # respalda la base en el contenedor SQL
#   ./scripts/demo/demo-instantanea.sh restaurar <nombre> --si   # devuelve la base a ese punto (SIN --si solo explica)
#   ./scripts/demo/demo-instantanea.sh borrar <nombre> --si
#
# Qué hace: BACKUP/RESTORE DATABASE de SQL Server DENTRO del contenedor (`/var/opt/mssql/instantaneas/<nombre>.bak`), sin
# copiar nada al anfitrión: por eso tarda segundos. Solo opera sobre la base de SIMUS_LOCAL_DB_NAME (por defecto SIMUS_LOCAL,
# nombre que EXIGE ser invocado de forma explícita: este guion nunca se ejecuta solo ni lo llama otro guion). Acepta únicamente
# bases cuyo nombre empiece por SIMUS_; no sirve contra Azure ni producción (solo habla con el contenedor local).
#
# Para ensayar sin tocar la demo: SIMUS_LOCAL_DB_NAME=SIMUS_MI_PRUEBA SIMUS_LOCAL_SQL_CONTAINER=... SIMUS_LOCAL_SQL_PORT=... \
#   ./scripts/demo/demo-instantanea.sh crear antes
#
# Antes de restaurar, detén la API y la web de la demo (o acepta que sus conexiones se cierren de golpe): la restauración
# desconecta a todos. La API vuelve a conectar sola en la siguiente petición.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"
source "$ROOT_DIR/scripts/local/sql-local-comun.sh"

CARPETA="${SIMUS_INSTANTANEAS_DIR:-/var/opt/mssql/instantaneas}"
ACCION="${1:-}"
NOMBRE="${2:-}"
CONFIRMA="${3:-}"

uso() {
  sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

[[ -z "$ACCION" ]] && uso
if [[ -z "$SQL_DB_PASSWORD" ]]; then echo "[instantanea] Falta SIMUS_LOCAL_SA_PASSWORD." >&2; exit 1; fi
if [[ ! "$SQL_DB_NAME" =~ ^SIMUS_[A-Z0-9_]+$ ]]; then
  echo "[instantanea] ABORTADO: '$SQL_DB_NAME' no es una base local de SIMUS (debe empezar por SIMUS_)." >&2; exit 1
fi
if ! docker inspect "$SQL_CONTAINER" >/dev/null 2>&1; then
  echo "[instantanea] No existe el contenedor $SQL_CONTAINER. Arranca la base con scripts/local/local-db-up.sh." >&2; exit 1
fi

# El nombre de la instantánea va al nombre de un archivo y a una sentencia SQL: solo letras, números, punto, guion y guion bajo.
if [[ "$ACCION" != "listar" ]]; then
  if [[ ! "$NOMBRE" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$ ]]; then
    echo "[instantanea] Nombre no válido (letras, números, punto, guion y guion bajo; hasta 60)." >&2; uso
  fi
fi
RUTA="$CARPETA/${SQL_DB_NAME}__${NOMBRE}.bak"

en_contenedor() { docker exec "$SQL_CONTAINER" "$@"; }

case "$ACCION" in
  listar)
    echo "[instantanea] Instantáneas de $SQL_DB_NAME en $SQL_CONTAINER:"
    en_contenedor sh -c "mkdir -p '$CARPETA'; ls -l '$CARPETA' 2>/dev/null | grep -F '${SQL_DB_NAME}__' || true" \
      | awk '{ n=$NF; sub(/^.*__/,"",n); sub(/\.bak$/,"",n); printf "  %-30s %8.1f MB  %s %s %s\n", n, $5/1048576, $6, $7, $8 }'
    ;;
  crear)
    en_contenedor mkdir -p "$CARPETA"
    inicio=$SECONDS
    # COMPRESSION no existe en todas las ediciones (Azure SQL Edge): se intenta y, si falla, se repite sin ella.
    if ! sql_consulta "BACKUP DATABASE [$SQL_DB_NAME] TO DISK = N'$RUTA' WITH INIT, CHECKSUM, COMPRESSION, STATS = 100;" master >/dev/null 2>&1; then
      sql_consulta "BACKUP DATABASE [$SQL_DB_NAME] TO DISK = N'$RUTA' WITH INIT, CHECKSUM, STATS = 100;" master >/dev/null || { echo "[instantanea] El respaldo falló." >&2; exit 1; }
    fi
    en_contenedor sh -c "ls -l '$RUTA'" | awk -v t=$((SECONDS - inicio)) '{ printf "[instantanea] Creada \"%s\" (%.1f MB) en %d s.\n", "'"$NOMBRE"'", $5/1048576, t }'
    ;;
  restaurar)
    if ! en_contenedor test -f "$RUTA"; then echo "[instantanea] No existe la instantánea \"$NOMBRE\" de $SQL_DB_NAME. Usa: listar." >&2; exit 1; fi
    if [[ "$CONFIRMA" != "--si" ]]; then
      echo "[instantanea] (SIN EJECUTAR) Restauraría $SQL_DB_NAME desde \"$NOMBRE\", descartando todo lo escrito después."
      echo "[instantanea] Para hacerlo: $0 restaurar $NOMBRE --si"; exit 2
    fi
    inicio=$SECONDS
    # Se restaura SOBRE la misma base con REPLACE: rutas físicas y nombre de la base no cambian. SINGLE_USER echa a las conexiones abiertas.
    sql_consulta "IF DB_ID(N'$SQL_DB_NAME') IS NOT NULL ALTER DATABASE [$SQL_DB_NAME] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
RESTORE DATABASE [$SQL_DB_NAME] FROM DISK = N'$RUTA' WITH REPLACE, RECOVERY, STATS = 100;
ALTER DATABASE [$SQL_DB_NAME] SET MULTI_USER;" master >/dev/null || {
      echo "[instantanea] La restauración falló; devolviendo la base a multiusuario." >&2
      sql_consulta "ALTER DATABASE [$SQL_DB_NAME] SET MULTI_USER;" master >/dev/null 2>&1
      exit 1
    }
    estado="$(sql_consulta "SELECT state_desc FROM sys.databases WHERE name = N'$SQL_DB_NAME'" master | tr -d '[:space:]')"
    echo "[instantanea] Restaurada \"$NOMBRE\" en $((SECONDS - inicio)) s. Base $SQL_DB_NAME: $estado."
    ;;
  borrar)
    if [[ "$CONFIRMA" != "--si" ]]; then echo "[instantanea] (SIN EJECUTAR) Borraría \"$NOMBRE\". Añade --si." >&2; exit 2; fi
    en_contenedor rm -f "$RUTA" && echo "[instantanea] Borrada \"$NOMBRE\"."
    ;;
  *) uso ;;
esac
