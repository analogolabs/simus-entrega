#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Suite completa de la API repartida en N procesos `dotnet test` paralelos.
#
#   cd simus-api && ../scripts/validacion/pruebas-api-en-paralelo.sh [filtro-extra]
#
# Requiere la API ya compilada en Release (validar-local.sh la compila antes). Variables:
#   SIMUS_API_PARTICIONES=N   procesos paralelos (por omisión 3; 1 = un solo `dotnet test`, como antes)
#   SIMUS_API_HILOS=H         tope de hilos de xUnit por proceso (por omisión: el de xUnit, un hilo por núcleo)
#   SIMUS_API_PESOS=archivo   segundos medidos por clase para equilibrar (por omisión scripts/pesos-de-pruebas-de-api.txt si existe)
#   SIMUS_API_REGISTROS=dir   dónde dejar filtros, registros y .trx (por omisión una carpeta nueva bajo TMPDIR)
#   SIMUS_API_SOLO_PLAN=1     solo lista, reparte y verifica la cobertura; no corre las pruebas
#   SIMUS_API_LISTA=archivo   usa esta salida de `--list-tests` en vez de generarla (pruebas del reparto)
#
# Cada proceso corre su grupo de clases con `--no-build --filter`, con su propio TMPDIR (las pruebas ya usan
# nombres únicos, esto es un seguro) y su propio registro. Sale con 0 solo si TODOS pasan; muestra las pruebas
# que fallaron de todos. El carril de SQL Server no se enciende aquí (se valida aparte).
# ---------------------------------------------------------------------------
set -uo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROYECTO="${SIMUS_API_PROYECTO:-tests/SIMUS.Api.Tests/SIMUS.Api.Tests.csproj}"
N="${SIMUS_API_PARTICIONES:-3}"
case "$N" in ''|*[!0-9]*|0) echo "SIMUS_API_PARTICIONES debe ser un entero >= 1 (vale «${N}»)" >&2; exit 2;; esac
EXCLUSION="FullyQualifiedName!~CarrilDeSqlServerNoSeOlvida"
HILOS=()
[ -n "${SIMUS_API_HILOS:-}" ] && HILOS=(-- "xUnit.MaxParallelThreads=$SIMUS_API_HILOS")

if [ "$N" -eq 1 ] && [ -z "${SIMUS_API_SOLO_PLAN:-}" ]; then
  echo "▶ pruebas api: 1 proceso (SIMUS_API_PARTICIONES=1)"
  exec env -u SIMUS_PRUEBAS_SQLSERVER dotnet test "$PROYECTO" --configuration Release --no-build --filter "$EXCLUSION" ${HILOS[@]+"${HILOS[@]}"}
fi

REG="${SIMUS_API_REGISTROS:-$(mktemp -d "${TMPDIR:-/tmp}/pruebas-api.XXXXXX")}"; mkdir -p "$REG"
LISTA="${SIMUS_API_LISTA:-$REG/lista.txt}"
if [ -z "${SIMUS_API_LISTA:-}" ]; then
  echo "▶ pruebas api: descubriendo pruebas"
  env -u SIMUS_PRUEBAS_SQLSERVER DOTNET_CLI_UI_LANGUAGE=en VSLANG=1033 dotnet test "$PROYECTO" --configuration Release --no-build --list-tests > "$LISTA" 2>&1 \
    || { echo "  ✘ no se pudieron listar las pruebas (ver $LISTA)" >&2; exit 1; }
fi
PESOS="${SIMUS_API_PESOS:-$AQUI/pesos-de-pruebas-de-api.txt}"
ARG_PESOS=(); [ -f "$PESOS" ] && ARG_PESOS=(--pesos "$PESOS")
python3 -I "$AQUI/repartir-pruebas-de-api.py" repartir "$N" "$LISTA" "$REG" ${ARG_PESOS[@]+"${ARG_PESOS[@]}"} || exit 1
[ -n "${SIMUS_API_SOLO_PLAN:-}" ] && { echo "Plan en $REG"; exit 0; }
GRUPOS=$(ls "$REG"/grupo-*.filtro | wc -l | tr -d ' ')

echo "▶ pruebas api: $GRUPOS procesos en paralelo (registros en $REG)"
pids=()
for i in $(seq 1 "$GRUPOS"); do
  mkdir -p "$REG/tmp-$i"
  (
    export TMPDIR="$REG/tmp-$i" DOTNET_CLI_UI_LANGUAGE=en VSLANG=1033   # salida en inglés: el resumen y los «Failed» se buscan por texto
    exec env -u SIMUS_PRUEBAS_SQLSERVER dotnet test "$PROYECTO" --configuration Release --no-build \
      --filter "$(cat "$REG/grupo-$i.filtro")&$EXCLUSION" \
      --logger "trx;LogFileName=grupo-$i.trx" --results-directory "$REG/resultados-$i" \
      ${HILOS[@]+"${HILOS[@]}"}
  ) > "$REG/grupo-$i.log" 2>&1 &
  pids+=($!)
done

rojo=0
for i in $(seq 1 "$GRUPOS"); do
  if wait "${pids[$((i - 1))]}"; then estado="verde"; else estado="ROJO"; rojo=1; fi
  resumen="$(grep -E '^(Passed!|Failed!)' "$REG/grupo-$i.log" | tail -1)"
  echo "  grupo $i: $estado ${resumen:+— $resumen}"
  rm -rf "$REG/tmp-$i"
done

if [ "$rojo" -ne 0 ]; then
  echo "Pruebas que fallaron (todos los grupos):"
  grep -hE '^\s+Failed ' "$REG"/grupo-*.log | sort -u | sed 's/^ */  /'
  echo "Detalle: $REG/grupo-N.log"
  exit 1
fi
echo "  ✔ pruebas api: los $GRUPOS grupos en verde"
