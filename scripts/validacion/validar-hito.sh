#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# VALIDACIÓN DE HITO: la validación COMPLETA sobre origin/main (o sobre otra referencia), sin PR.
#
#   ./scripts/validacion/validar-hito.sh [referencia]      # por omisión origin/main
#   SIMUS_API_PARTICIONES=4 ./scripts/validacion/validar-hito.sh
#   SIMUS_HITO_SIN_SQL=1 / SIMUS_HITO_SIN_NAVEGADOR=1   # omite esa pasada (el informe lo dice)
#
# Corre, en un worktree desechable: validar-local.sh con la suite de API COMPLETA partida en procesos paralelos y el
# frontend completo, la pasada de SQL Server y el humo de navegador. Deja el informe en
# <carpeta-de-informes>/validacion-de-hito/<fecha>-<commit>.md. Úsala al cerrar cada tanda de ajustes,
# antes de lotes grandes, de la siembra final y de cada entrega (docs/desarrollo/10-pruebas.md). No toca ningún PR.
# ---------------------------------------------------------------------------
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REF="${1:-origin/main}"
git -C "$RAIZ" fetch -q origin main 2>/dev/null || echo "aviso: no pude traer origin/main; uso lo que hay"
SHA="$(git -C "$RAIZ" rev-parse --short "$REF")" || { echo "referencia desconocida: $REF" >&2; exit 2; }
SALIDA="${SIMUS_INFORMES:-$RAIZ/tmp/informes}/validacion-de-hito"; mkdir -p "$SALIDA"
INFORME="$SALIDA/$(date +%Y-%m-%d-%H%M)-$SHA.md"
WT="$(mktemp -d "${TMPDIR:-/tmp}/hito.XXXXXX")/hito"
git -C "$RAIZ" worktree add -q --detach "$WT" "$REF" || exit 1
trap 'git -C "$RAIZ" worktree remove --force "$WT" >/dev/null 2>&1' EXIT
export SIMUS_VALIDAR_API=completa SIMUS_VALIDAR_WEB=completa
inicio=$(date +%s); resultados=()
etapa(){ local nombre=$1; shift; local t=$(date +%s) estado=VERDE; echo "▶ hito: $nombre"
  "$@" || estado=ROJO
  resultados+=("| $nombre | $estado | $(( ($(date +%s) - t) / 60 )) min |"); echo "  $nombre: $estado"; }
etapa "validación local completa (web + API completa en ${SIMUS_API_PARTICIONES:-3} procesos)" "$RAIZ/scripts/validacion/validar-local.sh" "$WT"
if [ -z "${SIMUS_HITO_SIN_SQL:-}" ]; then etapa "pasada de SQL Server" "$RAIZ/scripts/validacion/validar-sqlserver-rapido.sh" "$WT"; else resultados+=("| pasada de SQL Server | OMITIDA | - |"); fi
if [ -z "${SIMUS_HITO_SIN_NAVEGADOR:-}" ]; then etapa "humo de navegador" "$RAIZ/scripts/validacion/humo-de-navegador.sh" "$WT"; else resultados+=("| humo de navegador | OMITIDO | - |"); fi
rojo=0; printf '%s\n' "${resultados[@]}" | grep -q ROJO && rojo=1
{ echo "# Validación de hito — $SHA"
  echo; echo "- Referencia: \`$REF\` ($SHA)"; echo "- Fecha: $(date '+%Y-%m-%d %H:%M')"
  echo "- Duración total: $(( ($(date +%s) - inicio) / 60 )) min"; echo "- Resultado: $([ $rojo = 0 ] && echo VERDE || echo ROJO)"
  echo; echo "| Etapa | Resultado | Tiempo |"; echo "|---|---|---|"; printf '%s\n' "${resultados[@]}"
  echo; echo "Los registros de cada etapa están en las carpetas que imprimió la ejecución (validar-local.XXXXXX, pruebas-api.XXXXXX)."
} > "$INFORME"
echo "Informe: $INFORME"; exit $rojo
