#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Las mismas comprobaciones que «Comprobaciones SIMUS» de GitHub, en esta máquina.
#
#   ./scripts/validacion/validar-local.sh [carpeta]   # por omisión, este repositorio
#
# Desde noviembre de 2026 las comprobaciones de GitHub solo se lanzan a mano: cada ejecución
# gastaba unos 20 minutos del cupo gratuito. Se valida aquí y el resultado se anota en el PR.
# Sale con 0 solo si todo pasa. No necesita SQL Server.
# ---------------------------------------------------------------------------
set -uo pipefail
RAIZ="$(cd "${1:-$(dirname "${BASH_SOURCE[0]}")/../..}" && pwd)"
fallos=()
# UNA CARPETA DE REGISTROS POR EJECUCIÓN. Con nombres fijos en /tmp, dos validaciones en paralelo
# (dos ramas, dos agentes) se pisaban los registros y uno podía leer el fallo del otro.
REGISTROS="$(mktemp -d "${TMPDIR:-/tmp}/validar-local.XXXXXX")"
echo "Registros en $REGISTROS"
paso(){ local nombre=$1; shift; local registro="$REGISTROS/${nombre// /_}.log"; echo "▶ $nombre"; if ( "$@" ) > "$registro" 2>&1; then echo "  ✔ $nombre"; else echo "  ✘ $nombre (ver $registro)"; fallos+=("$nombre"); fi; }

paso "estructura y enlaces" bash -c "cd '$RAIZ' && ./scripts/validacion/verificar-estructura.sh"

# SOLO DOCUMENTOS: si el diff contra origin/main no toca simus-web/, simus-api/, simus-database/, scripts/, infra/ ni
# los archivos de la raíz que alimentan la compilación, el frontend que se probaría es el mismo que ya validó main:
# se omiten npm ci, lint, trinquete, Karma y build (varios minutos). SIMUS_VALIDAR_WEB=completa los fuerza.
omitir_web=0
if [ "${SIMUS_VALIDAR_WEB:-}" != "completa" ] && git -C "$RAIZ" rev-parse --verify -q origin/main >/dev/null; then
  if ! git -C "$RAIZ" diff --name-only origin/main 2>/dev/null | grep -qvE '^(docs/|CHANGELOG\.md$|README\.md$)'; then omitir_web=1; fi
fi
if [ "$omitir_web" = 1 ]; then
  echo "▶ web: se omite (el diff solo toca documentos; SIMUS_VALIDAR_WEB=completa la fuerza)"
else
cd "$RAIZ/simus-web"
paso "npm ci" npm ci --no-audit --no-fund
paso "lint" npm run lint
paso "trinquete" npm run trinquete
paso "pruebas web" npm test -- --watch=false --browsers=ChromeHeadless
paso "build web" npm run build
fi

# SOLO WEB: si la carpeta es un resultado unido a main y NADA cambió en simus-api/,
# simus-database/ ni en ficheros FUERA de la API que sus pruebas leen (scripts/validacion/rutas-que-leen-las-pruebas-de-api.txt)
# respecto de origin/main, el API que se probaría es el mismo que ya se validó al fusionar main: se omite su
# compilación y su suite (~40 min). Si el diff toca uno de esos ficheros ajenos (p. ej. la navegación de la consola
# que lee ModulosDeLaConsolaTests) corre SOLO las clases que lo leen. SIMUS_VALIDAR_API=1 (o «completa») fuerza la suite
# completa. SIMUS_VALIDAR_API=dirigida hace lo mismo cuando el diff SÍ toca simus-api/ o
# simus-database/: corre solo las clases relacionadas con lo cambiado y, ante un fichero transversal o sin mapa, la completa.
# La decisión vive en scripts/validacion/decidir-alcance-de-api.sh, que verificar-estructura.sh prueba con casos fijos.
modo_api=""; filtro_api=""
while IFS= read -r linea; do
  case "$linea" in
    modo=*) modo_api="${linea#modo=}";;
    filtro=*) filtro_api="${linea#filtro=}";;
    motivo=*) echo "  api: ${linea#motivo=}";;
  esac
done < <("$RAIZ/scripts/validacion/decidir-alcance-de-api.sh" "$RAIZ")
if [ "$modo_api" = "omitir" ]; then
  echo "▶ api: se omite (SIMUS_VALIDAR_API=completa la fuerza completa)"
else
cd "$RAIZ/simus-api"
[ "$modo_api" = "completa" ] && echo "▶ api: suite COMPLETA"
# Sin las variables de SQL: el carril de SQL Server se valida aparte cuando se pide.
filtro_final="FullyQualifiedName!~CarrilDeSqlServerNoSeOlvida"
if [ "$modo_api" = "dirigida" ] && [ -n "$filtro_api" ]; then
  echo "▶ api: suite DIRIGIDA a las clases relacionadas con lo cambiado $filtro_api"
  filtro_final="$filtro_api&$filtro_final"
fi
paso "build api" dotnet build SIMUS.Api.sln --configuration Release
if [ "$modo_api" = "completa" ] || [ -z "$filtro_api" ]; then
  # Suite completa: repartida en SIMUS_API_PARTICIONES procesos (por omisión 3; 1 = un solo `dotnet test`).
  # Cobertura exacta verificada en scripts/validacion/pruebas-api-en-paralelo.sh.
  paso "pruebas api" "$RAIZ/scripts/validacion/pruebas-api-en-paralelo.sh"
else
  paso "pruebas api" env -u SIMUS_PRUEBAS_SQLSERVER dotnet test tests/SIMUS.Api.Tests/SIMUS.Api.Tests.csproj --configuration Release --no-build \
    --filter "$filtro_final"
fi
fi

if [ ${#fallos[@]} -eq 0 ]; then echo "VALIDACIÓN LOCAL: VERDE"; exit 0; fi
echo "VALIDACIÓN LOCAL: ROJO (${fallos[*]})"; exit 1
