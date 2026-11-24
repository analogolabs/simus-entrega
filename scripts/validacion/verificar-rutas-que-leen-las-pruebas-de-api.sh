#!/usr/bin/env bash
# Mantiene sana la lista scripts/validacion/rutas-que-leen-las-pruebas-de-api.txt y prueba la política de omisión de la API.
#   1) Toda prueba de API que lea fuera de simus-api/ (scripts/, simus-web/, docs/, infra/, .github/, la raíz,
#      o subiendo tres carpetas o más sin ir a simus-database/) debe estar en la lista.
#   2) Cada patrón de la lista existe y cada clase listada existe.
#   3) La decisión de scripts/validacion/decidir-alcance-de-api.sh da lo esperado en casos fijos.
# Solo lee el árbol; no necesita dotnet ni servicios.
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"
PRUEBAS="simus-api/tests/SIMUS.Api.Tests"
LISTA="scripts/validacion/rutas-que-leen-las-pruebas-de-api.txt"
fallos=0
fallar(){ printf '  FALLA %s\n' "$1" >&2; fallos=$((fallos+1)); }

[ -f "$LISTA" ] || { fallar "falta $LISTA"; exit 1; }
clases_listadas=" $(grep -vE '^[[:space:]]*(#|$)' "$LISTA" | sed 's/^[^|]*|//' | tr '\n' ' ') "

# 2) patrones y clases vigentes
while IFS= read -r linea; do
  case "$linea" in ''|'#'*) continue;; esac
  patron="$(printf '%s' "${linea%%|*}" | sed 's/[[:space:]]*$//')"
  [ -e "$patron" ] || fallar "el patrón «${patron}» de $LISTA ya no existe"
  for c in ${linea#*|}; do
    [ -f "$PRUEBAS/$c.cs" ] || fallar "la clase «${c}» de $LISTA no existe en $PRUEBAS"
  done
done < "$LISTA"

# 1) lecturas fuera de simus-api no listadas
for f in "$PRUEBAS"/*.cs "$PRUEBAS"/*/*.cs; do
  [ -f "$f" ] || continue
  clase="$(basename "$f" .cs)"
  # Código sin comentarios de línea ni de documentación.
  # Las líneas que apuntan a simus-database/ no cuentan: ese directorio ya fuerza la suite completa.
  codigo="$(grep -vE '^[[:space:]]*//' "$f" | grep -v '"simus-database"')"
  fuera=0
  printf '%s\n' "$codigo" | grep -qE '"(simus-web|scripts|docs|infra|\.github|trinquete|README\.md|CHANGELOG\.md|package\.json|docker-compose[^"]*|\.env[^"]*)"' && fuera=1
  # Subir tres carpetas o más desde la prueba sale de simus-api; vale solo si va a simus-database.
  if printf '%s\n' "$codigo" | grep -qE '"\.\.",[[:space:]]*"\.\.",[[:space:]]*"\.\."' && ! printf '%s\n' "$codigo" | grep -q '"simus-database"'; then fuera=1; fi
  # Raiz() con otra cosa que simus-api o simus-database en la misma línea.
  printf '%s\n' "$codigo" | grep 'Raiz()' | grep -vqE '"simus-(api|database)"' && [ "$clase" != "RutasDelRepositorio" ] && fuera=1
  if [ "$fuera" = 1 ]; then
    case "$clases_listadas" in *" $clase "*) ;; *) fallar "$clase lee ficheros fuera de simus-api/ y no está en $LISTA";; esac
  fi
done

# 3) casos de la política
# La cola exporta SIMUS_VALIDAR_API=dirigida; los casos fijos no deben heredar el entorno (solo el último lo fija a propósito).
unset SIMUS_VALIDAR_API
caso(){ # nombre esperado_modo esperado_en_motivo/filtro cambiados
  local nombre=$1 modo=$2 contiene=$3 cambiados=$4 salida
  salida="$(SIMUS_ARCHIVOS_CAMBIADOS="$cambiados" ./scripts/validacion/decidir-alcance-de-api.sh "$RAIZ")"
  printf '%s\n' "$salida" | grep -qx "modo=$modo" || { fallar "caso «${nombre}»: se esperaba modo=$modo y salió: $(printf '%s' "$salida" | tr '\n' ' ')"; return; }
  [ -z "$contiene" ] || printf '%s\n' "$salida" | grep -qF "$contiene" || fallar "caso «${nombre}»: la salida no contiene «${contiene}»"
}
caso 'diff vacío'                 omitir   ''                              ''
caso 'solo web ajeno'             omitir   ''                              $'simus-web/src/app/app.ts\ndocs/referencia/20-decisiones-y-flujos-por-modulo.md'
caso 'toca la navegación'         dirigida 'FullyQualifiedName~ModulosDeLaConsolaTests' $'simus-web/src/app/features/admin/domain/navegacion-administrativa.ts'
caso 'toca un script leído'       dirigida 'FullyQualifiedName~SiembraSinBaseCableadaTests' $'scripts/local/seed-local-db.sh'
caso 'toca la API'                completa 'simus-api/'                    $'simus-api/src/SIMUS.Api/Program.cs\nsimus-web/src/app/app.ts'
caso 'toca la base de datos'      completa 'simus-database/'               $'simus-database/schema/V1.sql'
caso 'varios patrones'            dirigida 'FullyQualifiedName~SemillasDeDemostracionTests' $'scripts/demo/sembrar-demo.sh\nscripts/local/sql-local-comun.sh'
[ "$(SIMUS_VALIDAR_API=1 SIMUS_ARCHIVOS_CAMBIADOS='' ./scripts/validacion/decidir-alcance-de-api.sh "$RAIZ" | head -1)" = "modo=completa" ] || fallar 'SIMUS_VALIDAR_API=1 no fuerza la suite completa'

if [ "$fallos" -ne 0 ]; then printf 'Rutas que leen las pruebas de API: %s hallazgo(s).\n' "$fallos" >&2; exit 1; fi
echo 'Rutas que leen las pruebas de API: al día.'
