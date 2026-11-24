#!/usr/bin/env bash
# Guardas de seguridad de scripts/demo/demo-instantanea.sh y scripts/demo/siembra-integral.sh: no usan base ni docker (salen antes de conectar).
# Uso: bash scripts/validacion/tests/test_siembra_guardas.sh
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
fallos=0; total=0
# caso <nombre> <código esperado> <fragmento esperado en stderr> -- <orden...>
caso() {
  local nombre=$1 codigo=$2 texto=$3; shift 4
  local salida rc; total=$((total + 1))
  salida="$("$@" 2>&1 >/dev/null)"; rc=$?
  if [ "$rc" != "$codigo" ] || ! printf '%s' "$salida" | grep -qF -- "$texto"; then
    printf '  FALLA %s: código %s (esperado %s), salida: %s\n' "$nombre" "$rc" "$codigo" "$salida"; fallos=$((fallos + 1)); return
  fi
  printf '  OK    %s\n' "$nombre"
}
export SIMUS_LOCAL_SA_PASSWORD=clave-de-prueba-no-real
I="$RAIZ/scripts/demo/demo-instantanea.sh"; S="$RAIZ/scripts/demo/siembra-integral.sh"; C="$RAIZ/scripts/demo/sembrar-celebra-ediciones.sh"
caso "instantánea sin acción muestra el uso" 2 "demo-instantanea.sh" -- "$I"
caso "instantánea rechaza una base que no es SIMUS_" 1 "no es una base local de SIMUS" -- env SIMUS_LOCAL_DB_NAME=master "$I" listar
caso "instantánea rechaza Azure/otro nombre" 1 "no es una base local de SIMUS" -- env SIMUS_LOCAL_DB_NAME=produccion "$I" crear x
caso "siembra sin acción muestra el uso" 2 "siembra-integral.sh" -- "$S"
caso "siembra rechaza una base que no es SIMUS_" 1 "no es una base local de SIMUS" -- env SIMUS_LOCAL_DB_NAME=master "$S" estado
caso "preparar exige la confirmación explícita" 2 "SIMUS_SIEMBRA_CONFIRMAR" -- env -u SIMUS_SIEMBRA_CONFIRMAR SIMUS_LOCAL_DB_NAME=SIMUS_X "$S" preparar
caso "sembrar exige la confirmación explícita" 2 "SIMUS_SIEMBRA_CONFIRMAR" -- env SIMUS_LOCAL_DB_NAME=SIMUS_X SIMUS_SIEMBRA_CONFIRMAR=OTRA "$S" sembrar
caso "limpiar exige la confirmación explícita" 2 "SIMUS_SIEMBRA_CONFIRMAR" -- env -u SIMUS_SIEMBRA_CONFIRMAR SIMUS_LOCAL_DB_NAME=SIMUS_X "$S" limpiar --si
caso "completa exige la confirmación explícita" 2 "SIMUS_SIEMBRA_CONFIRMAR" -- env -u SIMUS_SIEMBRA_CONFIRMAR SIMUS_LOCAL_DB_NAME=SIMUS_X "$S" completa --si
caso "completa sin --si solo explica" 2 "SIN EJECUTAR" -- env SIMUS_LOCAL_DB_NAME=SIMUS_X SIMUS_SIEMBRA_CONFIRMAR=SIMUS_X "$S" completa
caso "sin clave del SA no hace nada" 1 "Falta SIMUS_LOCAL_SA_PASSWORD" -- env SIMUS_LOCAL_SA_PASSWORD= "$S" estado
G="$RAIZ/scripts/demo/sembrar-agenda-de-citas.sh"
caso "agenda de citas rechaza una base que no es SIMUS_" 1 "no es una base local de SIMUS" -- env SIMUS_LOCAL_DB_NAME=master "$G" estado
caso "agenda de citas exige la confirmación explícita" 2 "SIMUS_SIEMBRA_CONFIRMAR" -- env -u SIMUS_SIEMBRA_CONFIRMAR SIMUS_LOCAL_DB_NAME=SIMUS_X "$G" --si
caso "agenda de citas rechaza una confirmación de otra base" 2 "SIMUS_SIEMBRA_CONFIRMAR" -- env SIMUS_LOCAL_DB_NAME=SIMUS_X SIMUS_SIEMBRA_CONFIRMAR=OTRA "$G" --si
caso "agenda de citas rechaza una acción desconocida" 2 "sembrar-agenda-de-citas.sh" -- env SIMUS_LOCAL_DB_NAME=SIMUS_X "$G" borrar
caso "celebra sin --si solo explica" 2 "SIN EJECUTAR" -- env SIMUS_LOCAL_DB_NAME=SIMUS_X "$C"
caso "celebra rechaza una base que no es SIMUS_" 1 "no es una base local de SIMUS" -- env SIMUS_LOCAL_DB_NAME=master "$C" --si
caso "celebra exige la confirmación explícita" 2 "SIMUS_SIEMBRA_CONFIRMAR" -- env -u SIMUS_SIEMBRA_CONFIRMAR SIMUS_LOCAL_DB_NAME=SIMUS_X "$C" --si
caso "celebra rechaza opciones desconocidas" 2 "Opción desconocida" -- env SIMUS_LOCAL_DB_NAME=SIMUS_X "$C" --borrar
printf '\n%s casos, %s fallos\n' "$total" "$fallos"; [ "$fallos" -eq 0 ]
