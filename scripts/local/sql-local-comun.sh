#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Funciones compartidas para hablar con el SQL Server LOCAL. Se incluye con `source` desde los
# guiones de siembra y reconstrucción; no se ejecuta solo.
#
# Requiere ROOT_DIR definido y la configuración local cargada (scripts/local/load-local-env.sh).
#
#   sql_fichero  <fichero.sql> [base]   ejecuta un guion (añade GO al final)
#   sql_consulta "<consulta>"  [base]   ejecuta una consulta corta
#
# EL FICHERO VIAJA COMO FICHERO, NUNCA POR STDIN. El sqlcmd de `mssql-tools` lee la entrada
# estándar por trozos y los guiones largos llegaban mutilados: variables «ya declaradas», `JOIN` y
# `WHERE` sueltos. Se monta o se copia el guion y se pasa con `-i`, como en
# `seed-local-db.sh`.
#
# `-I` enciende QUOTED_IDENTIFIER y `-b` hace que un error devuelva un código distinto de cero.
# Sin `-f 65001` en el anfitrión: el `sqlcmd` de Homebrew (go-sqlcmd) lee UTF-8 de serie y rechaza
# esa opción.
# ---------------------------------------------------------------------------

SQL_DB_NAME="${SIMUS_LOCAL_DB_NAME:-SIMUS_LOCAL}"
SQL_DB_PASSWORD="${SIMUS_LOCAL_SA_PASSWORD:-}"
SQL_DB_PORT="${SIMUS_LOCAL_SQL_PORT:-14344}"
SQL_CONTAINER="${SIMUS_LOCAL_SQL_CONTAINER:-simus-desarrollo-sqlserver}"
SQL_TOOLS_IMAGE="${SIMUS_LOCAL_SQL_TOOLS_IMAGE:-mcr.microsoft.com/mssql-tools}"

# Detecta una vez cómo llegar a la base y lo deja en _SQL_MODO y _SQL_RED. Se llama sin `$( )`:
# en una subcapa el resultado se perdería.
_sql_detectar() {
  [[ -n "${_SQL_MODO:-}" ]] && return 0
  _SQL_RED=""
  if command -v sqlcmd >/dev/null 2>&1 \
    && sqlcmd -S "127.0.0.1,$SQL_DB_PORT" -U sa -P "$SQL_DB_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
    _SQL_MODO="anfitrion"
  elif docker exec "$SQL_CONTAINER" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SQL_DB_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
    _SQL_MODO="contenedor"
  else
    _SQL_RED="$(docker inspect "$SQL_CONTAINER" --format '{{range $network, $_ := .NetworkSettings.Networks}}{{$network}}{{end}}' 2>/dev/null || true)"
    if [[ -n "$_SQL_RED" ]]; then _SQL_MODO="herramientas"; else _SQL_MODO="ninguno"; fi
  fi
}

sql_fichero() {
  local fichero="$1" base="${2:-$SQL_DB_NAME}" con_go salida=0
  con_go="$(mktemp -t simus-sql-XXXXXX.sql)"
  { cat "$fichero"; echo ""; echo "GO"; } > "$con_go"
  _sql_detectar
  case "$_SQL_MODO" in
    anfitrion)
      sqlcmd -S "127.0.0.1,$SQL_DB_PORT" -U sa -P "$SQL_DB_PASSWORD" -d "$base" -C -I -b -i "$con_go" || salida=$? ;;
    contenedor)
      docker cp "$con_go" "$SQL_CONTAINER:/tmp/semilla-demo.sql" >/dev/null
      docker exec "$SQL_CONTAINER" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SQL_DB_PASSWORD" \
        -d "$base" -C -I -b -i /tmp/semilla-demo.sql || salida=$?
      docker exec "$SQL_CONTAINER" rm -f /tmp/semilla-demo.sql >/dev/null 2>&1 || true ;;
    herramientas)
      # La imagen `mssql-tools` (no la 18) no admite `-f`; sí `-C` e `-I`, que son los que importan.
      docker run --rm --platform linux/amd64 --network "$_SQL_RED" \
        -v "$con_go:/tmp/semilla-demo.sql:ro" "$SQL_TOOLS_IMAGE" \
        /opt/mssql-tools/bin/sqlcmd -S sqlserver -U sa -P "$SQL_DB_PASSWORD" -d "$base" -C -I -b -i /tmp/semilla-demo.sql || salida=$? ;;
    *)
      echo "[simus] No se encontró sqlcmd ni el contenedor $SQL_CONTAINER. Arranca la base con scripts/local/local-db-up.sh." >&2
      salida=1 ;;
  esac
  rm -f "$con_go"
  return $salida
}

sql_consulta() {
  local consulta="$1" base="${2:-$SQL_DB_NAME}"
  _sql_detectar
  case "$_SQL_MODO" in
    anfitrion)
      sqlcmd -S "127.0.0.1,$SQL_DB_PORT" -U sa -P "$SQL_DB_PASSWORD" -d "$base" -C -I -b -h -1 -W -Q "SET NOCOUNT ON; $consulta" ;;
    contenedor)
      docker exec "$SQL_CONTAINER" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SQL_DB_PASSWORD" \
        -d "$base" -C -I -b -h -1 -W -Q "SET NOCOUNT ON; $consulta" ;;
    herramientas)
      docker run --rm --platform linux/amd64 --network "$_SQL_RED" "$SQL_TOOLS_IMAGE" \
        /opt/mssql-tools/bin/sqlcmd -S sqlserver -U sa -P "$SQL_DB_PASSWORD" -d "$base" -C -I -b -h -1 -W -Q "SET NOCOUNT ON; $consulta" ;;
    *)
      echo "[simus] No se encontró sqlcmd ni el contenedor $SQL_CONTAINER." >&2
      return 1 ;;
  esac
}
