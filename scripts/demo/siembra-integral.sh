#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# KIT DE SIEMBRA INTEGRAL DE DEMOSTRACIÓN. Nunca se ejecuta solo ni lo llama otro guion.
#
#   ./scripts/demo/siembra-integral.sh preparar              # crea dbo.DatosDeDemostracion (solo el kit la crea; idempotente)
#   ./scripts/demo/siembra-integral.sh estado                # cuántos registros de demostración hay por lote, nivel y procedencia
#   ./scripts/demo/siembra-integral.sh identificar [nivel]   # registros de demostración (por omisión nivel 1: los de los videos)
#   ./scripts/demo/siembra-integral.sh plan [opciones]       # genera el plan SQL sin tocar la base (ver siembra/generador/siembra.py --ayuda)
#   ./scripts/demo/siembra-integral.sh sembrar [opciones]    # aplica el plan a la base (exige SIMUS_SIEMBRA_CONFIRMAR=<nombre de la base>)
#   ./scripts/demo/siembra-integral.sh limpiar [--si]        # limpieza controlada (ver siembra/docs/limpieza-controlada.md); sin --si solo muestra el plan
#   ./scripts/demo/siembra-integral.sh completa [--si] [--datos DIR]   # TODO de una vez: respaldo → limpiar → pool → sembrar N0+N1+N2/N3+multimedia → verificar + informe
#   ./scripts/demo/siembra-integral.sh verificar-api [URL]   # contra una API ya levantada sobre ESTA base: fichas y archivos públicos, ETag, ingreso de las cuentas de validación
#
# ORDEN CORRECTO de armado de la base de la demo (ver siembra/README.md): migraciones (schema-local.sh migrar) → seeds de referencia (seed-local-db.sh)
# → usuario del sistema (la API lo crea al arrancar una vez en local) → siembra (`completa`). NUNCA correr seed-local-db.sh DESPUÉS de sembrar cuentas:
# vuelve a escribir tablas de referencia y rompe la limpieza por FK_ProcedenciasDeRegistro_Usuario. Para rehacer: reconstruir desde cero, no re-sembrar encima.
#
# Seguridad: opera solo sobre la base de SIMUS_LOCAL_DB_NAME (por omisión SIMUS_LOCAL) y solo si su nombre empieza por SIMUS_.
# Escribir exige SIMUS_SIEMBRA_CONFIRMAR con el nombre exacto de la base: así una variable de entorno olvidada no siembra la demo
# por accidente. La clave del SA se lee del entorno o de .env y nunca se imprime. No usa red ni servicios institucionales.
# Para ensayar: SIMUS_LOCAL_DB_NAME=SIMUS_MI_PRUEBA SIMUS_LOCAL_SQL_CONTAINER=… SIMUS_LOCAL_SQL_PORT=… ./scripts/demo/siembra-integral.sh …
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/local/load-local-env.sh"
source "$ROOT_DIR/scripts/local/sql-local-comun.sh"

ACCION="${1:-}"
shift || true

uso() { sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit 2; }
[[ -z "$ACCION" ]] && uso

# `plan` no toca ninguna base: no exige conexión.
if [[ "$ACCION" == "plan" ]]; then
  exec python3 -I "$ROOT_DIR/siembra/generador/siembra.py" --solo-plan "$@"
fi

if [[ -z "$SQL_DB_PASSWORD" ]]; then echo "[siembra] Falta SIMUS_LOCAL_SA_PASSWORD." >&2; exit 1; fi
if [[ ! "$SQL_DB_NAME" =~ ^SIMUS_[A-Z0-9_]+$ ]]; then
  echo "[siembra] ABORTADO: '$SQL_DB_NAME' no es una base local de SIMUS (debe empezar por SIMUS_)." >&2; exit 1
fi

exigir_confirmacion() {
  if [[ "${SIMUS_SIEMBRA_CONFIRMAR:-}" != "$SQL_DB_NAME" ]]; then
    echo "[siembra] Esta acción escribe en $SQL_DB_NAME. Confirma con SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME." >&2; exit 2
  fi
}

limpiar_ya() {   # limpieza en UNA transacción (sin respaldo: lo hace quien la llama)
  local guion; guion="$(mktemp -t simus-limpieza-XXXXXX.sql)"
  python3 -I "$ROOT_DIR/siembra/generador/plan_de_limpieza.py" --sql "$guion" || { rm -f "$guion"; return 1; }
  if sql_fichero "$guion"; then rm -f "$guion"; return 0; else rm -f "$guion"; return 1; fi
}

# ---- completa: respaldo → limpiar → pool → sembrar → verificar (con informe) ------------------------------------------------------------
INFORME="${SIMUS_SIEMBRA_INFORME:-$ROOT_DIR/tmp/siembra/informe-de-carga.md}"
completa() {
  local si="" datos=() resto=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --si) si=1 ;;
      --datos) datos=(--datos "$2"); shift ;;
      *) resto+=("$1") ;;
    esac
    shift
  done
  if [[ -z "$si" ]]; then
    cat >&2 <<EOF
[siembra] «completa» hace, sobre $SQL_DB_NAME: respaldo → limpieza controlada → pool de imágenes (si falta) → siembra de N0, N1, N2/N3 y multimedia → verificación.
[siembra] Antes asegúrate de que la base tenga, en este orden: migraciones, seeds de referencia y el usuario del sistema (ver la cabecera de este guion).
[siembra] (SIN EJECUTAR) Para ejecutarla: SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME $0 completa --si [--datos DIR]
EOF
    exit 2
  fi
  local t_ini; t_ini=$(date +%s); local -a nombres=() tiempos=()
  paso() { nombres+=("$1"); tiempos+=("$(date +%s)"); echo "[siembra] $1"; }
  local ok=1 informe_extra=""

  paso "0/6 Comprobando el orden de armado (referencia + usuario del sistema)"
  local sis ref
  sis="$(sql_consulta "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.Usuarios WHERE CorreoElectronico = N'sistema@pnmc.local'" | tr -dc '0-9')"
  ref="$(sql_consulta "SET NOCOUNT ON; SELECT (SELECT COUNT(*) FROM dbo.Roles) + (SELECT COUNT(*) FROM dbo.PracticasMusicales) + (SELECT COUNT(*) FROM dbo.Divipola)" | tr -dc '0-9')"
  if [[ "${sis:-0}" == "0" || "${ref:-0}" == "0" ]]; then
    echo "[siembra] La base no tiene el usuario del sistema o los datos de referencia. Orden: migrar → seed-local-db.sh → arrancar la API una vez (crea al usuario del sistema) → completa." >&2; exit 1
  fi
  sql_fichero "$ROOT_DIR/siembra/kit/00_procedencia.sql" || exit 1

  paso "1/6 Respaldo (instantánea)"
  local respaldo="antes-de-completa-$(date +%Y%m%d-%H%M%S)"
  "$ROOT_DIR/scripts/demo/demo-instantanea.sh" crear "$respaldo" || { echo "[siembra] Sin respaldo no se continúa." >&2; exit 1; }

  paso "2/6 Limpieza controlada"
  limpiar_ya || { echo "[siembra] La limpieza se revirtió. Respaldo: $respaldo" >&2; exit 1; }

  paso "3/6 Pool de imágenes (fuera de git)"
  if ! python3 "$ROOT_DIR/siembra/multimedia/construir.py" verificar --plan >/dev/null 2>&1; then
    python3 "$ROOT_DIR/siembra/multimedia/construir.py" base | tail -2 && python3 "$ROOT_DIR/siembra/multimedia/construir.py" reparar | tail -1 \
      && python3 "$ROOT_DIR/siembra/multimedia/construir.py" completar | tail -1 || { echo "[siembra] No se pudo construir el pool (¿Pillow?)." >&2; exit 1; }
  fi

  paso "4/6 Siembra (N0 cuentas, N1, N2/N3, multimedia)"
  local esperados; esperados="$(mktemp -t simus-esperados-XXXXXX.tsv)"
  python3 -I "$ROOT_DIR/siembra/generador/siembra.py" --aplicar --esperados "$esperados" ${datos[@]+"${datos[@]}"} ${resto[@]+"${resto[@]}"} || { echo "[siembra] La siembra falló. Respaldo: $respaldo (restaurar con demo-instantanea.sh)." >&2; exit 1; }

  paso "5/6 Verificación"
  local v_masivo v_multimedia v_dbcc v_conteo
  v_masivo="$(python3 -I "$ROOT_DIR/siembra/libro/masivo/verificador.py" ${datos[@]+"${datos[@]}"} 2>&1)" || ok=0
  v_multimedia="$(python3 "$ROOT_DIR/siembra/multimedia/construir.py" verificar --plan 2>&1)" || ok=0
  v_dbcc="$(sql_consulta "SET NOCOUNT ON; DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS, NO_INFOMSGS" 2>&1)"
  [[ -n "$(echo "$v_dbcc" | tr -d '[:space:]')" ]] && ok=0
  v_conteo="$(sql_consulta "SET NOCOUNT ON; SELECT Lote + CHAR(9) + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.DatosDeDemostracion GROUP BY Lote ORDER BY Lote" 2>&1 | tr -d '\r' | sed 's/ *$//' | grep -F "$(printf '\t')" | sort)"
  local falta_conteo; falta_conteo="$(diff <(sort "$esperados") <(echo "$v_conteo") || true)"
  [[ -n "$falta_conteo" ]] && ok=0

  paso "6/6 Informe"
  local fin; fin=$(date +%s)
  mkdir -p "$(dirname "$INFORME")"
  {
    echo "# Informe de carga de la siembra integral"; echo
    echo "Base: \`$SQL_DB_NAME\` · fecha: $(date '+%Y-%m-%d %H:%M') · semilla/fecha de referencia: ver siembra.py · respaldo previo: \`$respaldo\`"; echo
    echo "Resultado: **$([[ $ok == 1 ]] && echo 'CORRECTO' || echo 'CON HALLAZGOS')** · tiempo total: $((fin - t_ini)) s"; echo
    echo "## Tiempos por fase"; echo
    local i; for i in "${!nombres[@]}"; do
      local sig=$(( i + 1 )); local t_sig=$fin; [[ $sig -lt ${#tiempos[@]} ]] && t_sig=${tiempos[$sig]}
      echo "- ${nombres[$i]}: $(( t_sig - ${tiempos[$i]} )) s"
    done; echo
    echo "## Registros por lote, nivel y procedencia"; echo; echo '```'
    sql_consulta "SET NOCOUNT ON; SELECT CONCAT(N'nivel ', Nivel, N'  ', Procedencia, N'  ', Lote, N'  ', COUNT(*)) FROM dbo.DatosDeDemostracion GROUP BY Nivel, Procedencia, Lote ORDER BY Nivel, Lote, Procedencia" | sed 's/ *$//' | grep -v '^$'; echo '```'; echo
    echo "## Registros por nivel y tabla de negocio"; echo; echo '```'
    sql_consulta "SET NOCOUNT ON; SELECT CONCAT(N'nivel ', Nivel, N'  ', Tabla, N'  ', COUNT(*)) FROM dbo.DatosDeDemostracion GROUP BY Nivel, Tabla ORDER BY Nivel, Tabla" | sed 's/ *$//' | grep -v '^$'; echo '```'; echo
    echo "## Tamaño"; echo; echo '```'
    sql_consulta "SET NOCOUNT ON; SELECT CONCAT(N'base: ', CAST(SUM(size) * 8 / 1024 AS int), N' MB (datos + registro); archivos del banco: ', (SELECT COUNT(*) FROM dbo.Archivos), N' filas, ', (SELECT CAST(ISNULL(SUM(PesoBytes),0) / 1048576.0 AS decimal(9,1)) FROM dbo.Archivos), N' MB de contenido') FROM sys.database_files"; echo '```'; echo
    echo "## Verificación"; echo
    echo "- DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS: $([[ -z "$(echo "$v_dbcc" | tr -d '[:space:]')" ]] && echo 'sin violaciones' || echo 'VIOLACIONES (ver abajo)')"
    echo "- Conteos por lote (plan frente a base): $([[ -z "$falta_conteo" ]] && echo 'coinciden' || echo 'DIFIEREN (ver abajo)')"
    echo "- Verificador del motor masivo:"; echo '```'; echo "$v_masivo" | tail -12; echo '```'
    echo "- Verificador de multimedia:"; echo '```'; echo "$v_multimedia" | tail -8; echo '```'
    [[ -n "$(echo "$v_dbcc" | tr -d '[:space:]')" ]] && { echo "DBCC:"; echo '```'; echo "$v_dbcc" | head -40; echo '```'; }
    [[ -n "$falta_conteo" ]] && { echo "Diferencias de conteo (< esperado del plan · > base):"; echo '```'; echo "$falta_conteo" | head -40; echo '```'; }
  } > "$INFORME"
  rm -f "$esperados"
  echo "[siembra] Informe: $INFORME"
  if [[ $ok == 1 ]]; then echo "[siembra] Siembra completa y verificada en $((fin - t_ini)) s. Respaldo previo: $respaldo."; else echo "[siembra] Terminó CON HALLAZGOS (ver el informe). Respaldo previo: $respaldo." >&2; exit 3; fi
}

case "$ACCION" in
  preparar)
    exigir_confirmacion
    sql_fichero "$ROOT_DIR/siembra/kit/00_procedencia.sql" && echo "[siembra] Tabla dbo.DatosDeDemostracion lista en $SQL_DB_NAME."
    ;;
  estado)
    sql_consulta "IF OBJECT_ID(N'dbo.DatosDeDemostracion') IS NULL SELECT N'(sin kit de demostración en esta base)' ELSE
SELECT Lote + N'  nivel ' + CAST(Nivel AS nvarchar(3)) + N'  ' + Procedencia + N'  ' + CAST(COUNT(*) AS nvarchar(12)) FROM dbo.DatosDeDemostracion GROUP BY Lote, Nivel, Procedencia ORDER BY Nivel, Lote, Procedencia"
    ;;
  identificar)
    nivel="${1:-1}"
    [[ "$nivel" =~ ^[0-3]$ ]] || { echo "[siembra] Nivel no válido (0 a 3)." >&2; exit 2; }
    sql_consulta "SELECT COALESCE(ClaveEstable, N'-') + N'  ' + Tabla + N'#' + IdRegistro + N'  ' + Procedencia + N'  ' + Lote FROM dbo.DatosDeDemostracion WHERE Nivel = $nivel ORDER BY Tabla, ClaveEstable"
    ;;
  sembrar)
    exigir_confirmacion
    exec python3 -I "$ROOT_DIR/siembra/generador/siembra.py" --aplicar "$@"
    ;;
  limpiar)
    exigir_confirmacion
    if [[ "${1:-}" != "--si" ]]; then
      python3 -I "$ROOT_DIR/siembra/generador/plan_de_limpieza.py" --resumen
      echo "[siembra] (SIN EJECUTAR) Para limpiar $SQL_DB_NAME: SIMUS_SIEMBRA_CONFIRMAR=$SQL_DB_NAME $0 limpiar --si" >&2; exit 2
    fi
    respaldo="antes-de-limpiar-$(date +%Y%m%d-%H%M%S)"
    "$ROOT_DIR/scripts/demo/demo-instantanea.sh" crear "$respaldo" || { echo "[siembra] Sin respaldo no se limpia." >&2; exit 1; }
    if limpiar_ya; then
      echo "[siembra] Limpieza aplicada y verificada. Para deshacerla: scripts/demo/demo-instantanea.sh restaurar $respaldo --si"
    else
      echo "[siembra] La limpieza se revirtió (una sola transacción). Respaldo disponible: $respaldo" >&2; exit 1
    fi
    ;;
  completa)
    exigir_confirmacion
    completa "$@"
    ;;
  verificar-api)
    # La API ya debe estar levantada sobre ESTA base (por ejemplo SIMUS_LOCAL_API_PORT=… scripts/local/api-local.sh). Solo lee.
    url="${1:-http://127.0.0.1:${SIMUS_LOCAL_API_PORT:-8180}}"
    ids="$(mktemp -t simus-ids-XXXXXX.tsv)"
    {
      sql_consulta "SELECT N'festival' + CHAR(9) + IdRegistro FROM dbo.DatosDeDemostracion WHERE ClaveEstable = N'n1.festival.festival-de-arrullos-y-alabaos-del-baudo'"
      sql_consulta "SELECT N'organizacion' + CHAR(9) + IdRegistro FROM dbo.DatosDeDemostracion WHERE Alias = N'org.corp-cabildo-sonoro-del-atrato'"
      sql_consulta "SELECT N'persona' + CHAR(9) + CAST(ClavePublica AS nvarchar(40)) FROM dbo.PerfilesPublicos WHERE IdUsuario = (SELECT CAST(IdRegistro AS int) FROM dbo.DatosDeDemostracion WHERE Alias = N'persona.nubia-palacios')"
      sql_consulta "SELECT TOP 1 N'noticia' + CHAR(9) + Slug FROM dbo.Noticias WHERE Estado = N'publicado' AND FechaPublicacion <= CAST(SYSDATETIME() AS date) ORDER BY FechaPublicacion DESC, IdNoticia DESC"
      sql_consulta "SELECT TOP 1 N'evento' + CHAR(9) + Slug FROM dbo.EventosAgenda WHERE Estado = N'publicado' ORDER BY FechaInicio DESC, IdEventoAgenda DESC"
      sql_consulta "SELECT N'img_publica' + CHAR(9) + CAST(ArchivoId AS nvarchar(20)) FROM dbo.ArchivosDeRegistro WHERE ModuloId = N'festivales' AND ArchivoId IS NOT NULL AND RegistroId = (SELECT IdRegistro FROM dbo.DatosDeDemostracion WHERE Alias = N'festival.festival-de-arrullos-y-alabaos-del-baudo') AND RolArchivo IN (N'portada', N'logo')"
      sql_consulta "SELECT N'img_publica' + CHAR(9) + CAST(ArchivoFotoId AS nvarchar(20)) FROM dbo.PerfilesPublicos WHERE ArchivoFotoId IS NOT NULL AND IdUsuario = (SELECT CAST(IdRegistro AS int) FROM dbo.DatosDeDemostracion WHERE Alias = N'persona.nubia-palacios')"
      sql_consulta "SELECT N'img_publica' + CHAR(9) + CAST(ArchivoFotoId AS nvarchar(20)) FROM dbo.Entidades WHERE ArchivoFotoId IS NOT NULL AND IdEntidad = (SELECT CAST(IdRegistro AS int) FROM dbo.DatosDeDemostracion WHERE Alias = N'org.corp-cabildo-sonoro-del-atrato')"
      sql_consulta "SELECT TOP 1 N'img_publica' + CHAR(9) + CAST(ArchivoId AS nvarchar(20)) FROM dbo.NoticiasArchivos WHERE NoticiaId IN (SELECT IdNoticia FROM dbo.Noticias WHERE Estado = N'publicado') ORDER BY NoticiaId DESC"
      sql_consulta "SELECT TOP 2 N'img_borrador' + CHAR(9) + CAST(a.ArchivoId AS nvarchar(20)) FROM dbo.ArchivosDeRegistro a JOIN dbo.Festivales f ON CAST(f.IdFestival AS nvarchar(120)) = a.RegistroId WHERE a.ModuloId = N'festivales' AND a.ArchivoId IS NOT NULL AND f.EstadoRegistro = N'borrador' AND NOT EXISTS (SELECT 1 FROM dbo.ArchivosDeRegistro b JOIN dbo.Festivales g ON CAST(g.IdFestival AS nvarchar(120)) = b.RegistroId WHERE b.ArchivoId = a.ArchivoId AND b.ModuloId = N'festivales' AND g.EstadoRegistro = N'publicado') ORDER BY a.ArchivoId"
    } | tr -d '\r' | grep -F "$(printf '\t')" > "$ids"
    python3 -I "$ROOT_DIR/siembra/generador/verificar_api.py" "$url" "$ids"; salida=$?
    rm -f "$ids"; exit $salida
    ;;
  *) uso ;;
esac
