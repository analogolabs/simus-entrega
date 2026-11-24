#!/usr/bin/env bash
# Pruebas del modo DIRIGIDO de scripts/validacion/decidir-alcance-de-api.sh (SIMUS_VALIDAR_API=dirigida).
# No compilan nada ni usan Git: sustituyen el diff con SIMUS_ARCHIVOS_CAMBIADOS y SIMUS_LINEAS_CAMBIADAS.
# Uso: bash scripts/validacion/tests/test_decidir_alcance_api.sh   (también dentro de run-script-tests.sh)
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
D="$RAIZ/scripts/validacion/decidir-alcance-de-api.sh"
fallos=0; total=0
# caso <nombre> <modo esperado> <fragmento esperado en la salida (o '')> <archivos> [líneas] [valor de SIMUS_VALIDAR_API]
caso(){
  local nombre=$1 modo=$2 contiene=$3 archivos=$4 lineas=${5:-} validar=${6-dirigida} salida
  total=$((total + 1))
  if [ -n "$validar" ]; then
    salida="$(SIMUS_VALIDAR_API="$validar" SIMUS_ARCHIVOS_CAMBIADOS="$archivos" SIMUS_LINEAS_CAMBIADAS="$lineas" "$D" "$RAIZ")"
  else
    salida="$(env -u SIMUS_VALIDAR_API SIMUS_ARCHIVOS_CAMBIADOS="$archivos" SIMUS_LINEAS_CAMBIADAS="$lineas" "$D" "$RAIZ")"
  fi
  if ! printf '%s\n' "$salida" | grep -qx "modo=$modo"; then
    printf '  FALLA %s: se esperaba modo=%s y salió: %s\n' "$nombre" "$modo" "$(printf '%s' "$salida" | tr '\n' ' ')"; fallos=$((fallos + 1)); return
  fi
  if [ -n "$contiene" ] && ! printf '%s\n' "$salida" | grep -qF -- "$contiene"; then
    printf '  FALLA %s: la salida no contiene «%s»: %s\n' "$nombre" "$contiene" "$(printf '%s' "$salida" | tr '\n' ' ')"; fallos=$((fallos + 1)); return
  fi
  printf '  OK    %s\n' "$nombre"
}
E=simus-api/src/SIMUS.Api/Endpoints
caso 'endpoint con pruebas por nombre'  dirigida 'FullyQualifiedName~TalleresDeLuteriaTests' "$E/TalleresEndpoints.cs" '+        var x = 1;'
caso 'agenda: varias clases'            dirigida 'FullyQualifiedName~AgendaCircuitoTests' "$E/AgendaEndpoints.cs" '+  linea'
caso 'dos endpoints, unión de clases'   dirigida 'FullyQualifiedName~EspaciosParaMusicaEnVivoTests' $'simus-api/src/SIMUS.Api/Endpoints/EspaciosEndpoints.cs\nsimus-api/src/SIMUS.Api/Endpoints/TalleresEndpoints.cs' ''
caso 'una clase de prueba cambiada'     dirigida 'FullyQualifiedName~ImportacionAsistidaTests' 'simus-api/tests/SIMUS.Api.Tests/ImportacionAsistidaTests.cs'
MAPA_FALSO="$(mktemp)"; printf '%s\n' '# regla de prueba' 'simus-api/src/SIMUS.Api/Services/Uno.cs | AgendaCircuitoTests' 'simus-api/src/SIMUS.Api/Historial/ | HistorialNoticiasAgendaTests' > "$MAPA_FALSO"
export SIMUS_MAPA_DE_PRUEBAS="$MAPA_FALSO"
caso 'el mapa explícito, fichero exacto' dirigida 'FullyQualifiedName~AgendaCircuitoTests' 'simus-api/src/SIMUS.Api/Services/Uno.cs'
caso 'el mapa explícito, prefijo'        dirigida 'FullyQualifiedName~HistorialNoticiasAgendaTests' 'simus-api/src/SIMUS.Api/Historial/Cualquiera.cs'
unset SIMUS_MAPA_DE_PRUEBAS; rm -f "$MAPA_FALSO"
caso 'dominio de importación por nombre' dirigida 'FullyQualifiedName~ImportacionDeTalleresTests' 'simus-api/src/SIMUS.Api/ImportacionAsistida/DominioDeTalleres.cs'
caso 'se suman las reglas de ficheros ajenos' dirigida 'FullyQualifiedName~SiembraSinBaseCableadaTests' $'scripts/local/seed-local-db.sh\nsimus-api/src/SIMUS.Api/Endpoints/TalleresEndpoints.cs'
caso 'solo documentación de la API'     omitir   '' 'simus-api/README.md'
caso 'Program.cs es transversal'        completa 'Program.cs' 'simus-api/src/SIMUS.Api/Program.cs'
caso 'un contrato es transversal'       completa 'transversal' 'simus-api/src/SIMUS.Contracts/TalleresContratos.cs'
caso 'openapi es transversal'           completa 'openapi' 'simus-api/openapi.yaml'
caso 'seguridad y CSRF'                 completa 'transversal' 'simus-api/src/SIMUS.Api/Security/Csrf.cs'
caso 'persistencia'                     completa 'transversal' 'simus-api/src/SIMUS.Infrastructure/Datos/Algo.cs'
caso 'DbUp y esquema'                   completa 'base de datos' 'simus-database/schema/V1.sql'
caso 'un auxiliar de pruebas'           completa 'auxiliar' 'simus-api/tests/SIMUS.Api.Tests/TestWebApplicationFactory.cs'
caso 'un servicio sin regla'            completa 'mapa de pruebas conocido' 'simus-api/src/SIMUS.Api/Services/AlgoNuevoService.cs'
caso 'un endpoint sin pruebas por nombre' completa 'identificables' "$E/ZzzInexistenteEndpoints.cs"
caso 'un nombre demasiado corto'        completa 'identificables' "$E/Ab.cs"
caso 'una ruta añadida manda a completa' completa 'ruta' "$E/TalleresEndpoints.cs" '+    grupo.MapGet("/nuevo", () => 1);'
caso 'una ruta quitada manda a completa' completa 'ruta' "$E/TalleresEndpoints.cs" '-    grupo.MapPost("/viejo", () => 1);'
caso 'un fichero transversal gana a los mapeables' completa 'Program.cs' $'simus-api/src/SIMUS.Api/Endpoints/TalleresEndpoints.cs\nsimus-api/src/SIMUS.Api/Program.cs'
caso 'sin modo: la API completa de siempre' completa 'simus-api/' "$E/TalleresEndpoints.cs" '' ''
caso 'SIMUS_VALIDAR_API=completa fuerza'   completa 'completa lo fuerza' "$E/TalleresEndpoints.cs" '' completa
caso 'SIMUS_VALIDAR_API=1 sigue forzando'  completa 'lo fuerza' "$E/TalleresEndpoints.cs" '' 1
caso 'solo web con modo dirigido'          omitir '' 'simus-web/src/app/app.ts'
# Modo rápido: nunca escala a la completa y siempre suma el subconjunto fijo.
caso 'rápido: Program.cs no escala'        dirigida 'FullyQualifiedName~ContratoOpenApiTests' 'simus-api/src/SIMUS.Api/Program.cs' '' rapida
caso 'rápido: transversal suma autorización' dirigida 'FullyQualifiedName~AutorizacionPorDefectoTests' 'simus-api/src/SIMUS.Api/Security/Csrf.cs' '' rapida
caso 'rápido: ruta añadida no escala'      dirigida 'FullyQualifiedName~TalleresDeLuteriaTests' "$E/TalleresEndpoints.cs" '+    grupo.MapGet("/nuevo", () => 1);' rapida
caso 'rápido: servicio sin regla no escala' dirigida 'FullyQualifiedName~TestigoGlobalDeEscriturasTests' 'simus-api/src/SIMUS.Api/Services/AlgoNuevoService.cs' '' rapida
caso 'rápido: mapeado + fijas'             dirigida 'FullyQualifiedName~AgendaCircuitoTests' "$E/AgendaEndpoints.cs" '+  linea' rapida
caso 'rápido: solo documentos omite'       omitir '' 'simus-api/README.md' '' rapida
caso 'rápido: solo web omite'              omitir '' 'simus-web/src/app/app.ts' '' rapida
if [ "$fallos" -ne 0 ]; then printf 'Modo dirigido de la API: %s de %s casos fallan.\n' "$fallos" "$total" >&2; exit 1; fi
printf 'Modo dirigido de la API: %s casos en verde.\n' "$total"
