#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Decide cuánto de la API valida scripts/validacion/validar-local.sh. Imprime tres líneas:
#   modo=omitir | completa | dirigida
#   filtro=<--filter de dotnet test, solo si modo=dirigida>
#   motivo=<texto para el registro>   (puede repetirse)
#
#   ./scripts/validacion/decidir-alcance-de-api.sh [raiz]
#
# Para probar sin Git: SIMUS_ARCHIVOS_CAMBIADOS="ruta1<LF>ruta2" sustituye al diff contra origin/main
# (vacío = diff vacío); SIMUS_LINEAS_CAMBIADAS="..." sustituye al diff de líneas de simus-api/src (solo para pruebas).
#
# SIMUS_VALIDAR_API:  1 o completa  -> fuerza la suite completa.
#                     dirigida      -> si el diff toca simus-api/ o simus-database/, corre SOLO las clases de prueba
#                                      relacionadas (ver «Modo dirigido» abajo); ante la duda, completa.
#                     (sin definir) -> el comportamiento de siempre: cualquier cambio en simus-api/ o simus-database/
#                                      corre la suite completa.
#                     rapida        -> MODO RÁPIDO: como «dirigida» pero SIN el respaldo
#                                      a la suite completa (lo transversal o sin mapa solo suma el subconjunto fijo de abajo)
#                                      y siempre con ese subconjunto (autorización, contrato, testigos de escrituras)
#                                      cuando el diff toca simus-api/ o simus-database/. El riesgo está en docs/desarrollo/10-pruebas.md.
# Reglas de las rutas ajenas a la API: scripts/validacion/rutas-que-leen-las-pruebas-de-api.txt.
# ---------------------------------------------------------------------------
set -uo pipefail
RAIZ="$(cd "${1:-$(dirname "${BASH_SOURCE[0]}")/../..}" && pwd)"
LISTA="$RAIZ/scripts/validacion/rutas-que-leen-las-pruebas-de-api.txt"

MODO_VALIDAR="${SIMUS_VALIDAR_API:-}"
RAPIDA=0; [ "$MODO_VALIDAR" = "rapida" ] && { RAPIDA=1; MODO_VALIDAR=dirigida; }
# Subconjunto fijo del modo rápido: autorización por defecto y por ruta, contrato OpenAPI y testigos de escrituras.
FIJAS_RAPIDAS="AutorizacionPorDefectoTests AutorizacionPorRutaDeLaConsolaTests ContratoOpenApiTests TestigoGlobalDeEscriturasTests TestigoDeLasEscriturasDeLaConsolaTests TestigoDeLasEscriturasDeFestivalesTests"
if [ "$MODO_VALIDAR" = "1" ] || [ "$MODO_VALIDAR" = "completa" ]; then
  echo "modo=completa"; echo "filtro="; echo "motivo=SIMUS_VALIDAR_API=$MODO_VALIDAR lo fuerza"; exit 0
fi

if [ "${SIMUS_ARCHIVOS_CAMBIADOS+x}" = "x" ]; then
  cambiados="$SIMUS_ARCHIVOS_CAMBIADOS"
elif git -C "$RAIZ" rev-parse --verify -q origin/main >/dev/null; then
  cambiados="$(git -C "$RAIZ" diff --name-only origin/main 2>/dev/null)"
else
  echo "modo=completa"; echo "filtro="; echo "motivo=no hay origin/main con qué comparar"; exit 0
fi

# 1) Cambios en la propia API o en la base de datos: suite completa, salvo en modo dirigido.
propios="$(printf '%s\n' "$cambiados" | grep -E '^(simus-api|simus-database)/' | head -1 || true)"
clases=""; motivos=""
if [ -n "$propios" ]; then
  if [ "$MODO_VALIDAR" != "dirigida" ]; then
    echo "modo=completa"; echo "filtro="; echo "motivo=el diff toca $propios (simus-api/ o simus-database/)"; exit 0
  fi
  # ---- Modo dirigido -------------------------------------------------------------------------------------------
  # Cada fichero cambiado de simus-api/ o simus-database/ debe tener una relación CONOCIDA con clases de prueba; si
  # UNO solo no la tiene, o es transversal, se corre la suite completa (respaldo conservador). Orden de decisión:
  #   a) documentación (*.md) dentro de esas carpetas: no cuenta.
  #   b) TRANSVERSAL -> completa: simus-database/ (DbUp, esquema, siembra), Program.cs, openapi.yaml, *.csproj, .sln,
  #      Directory.Build.props, appsettings*, Security/ (incluye CSRF), Bootstrap/, Observability/, Assets/, scripts de
  #      la API, SIMUS.Contracts/, SIMUS.Domain/, SIMUS.Infrastructure/, SIMUS.Migrador/, los auxiliares de pruebas
  #      (los que no terminan en «Tests.cs»), y cualquier línea cambiada que añada o quite una ruta (.MapGet, .MapPost,
  #      .MapPut, .MapPatch, .MapDelete, .MapGroup, .MapMethods): las pruebas que cuentan rutas dependen de eso.
  #   c) reglas explícitas de scripts/validacion/mapa-de-pruebas-de-api.txt (mismo formato que rutas-que-leen-las-pruebas...).
  #   d) por nombre: Endpoints/X.cs, ConsultaGuiada/X.cs e ImportacionAsistida/DominioDeX.cs -> pruebas cuyo nombre de
  #      fichero contiene X (sin «Endpoints»/«DominioDe»), más las que citan un tipo declarado en el fichero.
  #   e) un fichero de prueba cambiado (*Tests.cs) -> su propia clase.
  #   f) cualquier otra cosa (Services/, Historial/, ...) -> completa, salvo que una regla del mapa la cubra.
  # El riesgo (una prueba de otra clase que ejercite el cambio sin nombrarlo) está en docs/desarrollo/10-pruebas.md.
  PRUEBAS="$RAIZ/simus-api/tests/SIMUS.Api.Tests"
  MAPA="${SIMUS_MAPA_DE_PRUEBAS:-$RAIZ/scripts/validacion/mapa-de-pruebas-de-api.txt}"   # la variable es solo para pruebas
  completa=""
  # escalar «motivo»: en modo normal pide la suite completa (devuelve 0 -> el llamador corta); en modo rápido solo lo anota.
  escalar(){ if [ "$RAPIDA" = 1 ]; then motivos="$motivos
motivo=$1: en modo rápido NO se escala a la suite completa"; return 1; fi; completa="$1"; return 0; }
  agregar_clases(){ local c; for c in "$@"; do case " $clases " in *" $c "*) ;; *) clases="$clases $c";; esac; done; }
  if [ "${SIMUS_LINEAS_CAMBIADAS+x}" = "x" ]; then lineas="$SIMUS_LINEAS_CAMBIADAS"
  else lineas="$(git -C "$RAIZ" diff -U0 origin/main -- simus-api/src 2>/dev/null | grep -E '^[+-][^+-]' || true)"; fi
  if printf '%s\n' "$lineas" | grep -qE '\.Map(Get|Post|Put|Patch|Delete|Group|Methods)\('; then
    escalar "el diff añade o quita una ruta (.Map*): las pruebas que cuentan rutas lo leen"
  fi
  while IFS= read -r ruta && [ -z "$completa" ]; do
    case "$ruta" in simus-api/*|simus-database/*) ;; *) continue;; esac
    case "$ruta" in *.md) continue;; esac
    case "$ruta" in
      simus-database/*) escalar "$ruta es la base de datos (DbUp, esquema o siembra)" && break; continue;;
      simus-api/openapi.yaml|simus-api/Directory.Build.props|simus-api/SIMUS.Api.sln|*.csproj|*/Program.cs|*/appsettings*)
        escalar "$ruta es transversal (contrato, compilación, arranque o configuración)" && break; continue;;
      */SIMUS.Api/Security/*|*/SIMUS.Api/Bootstrap/*|*/SIMUS.Api/Observability/*|*/SIMUS.Api/Assets/*|simus-api/scripts/*)
        escalar "$ruta es transversal (seguridad, CSRF, arranque o activos)" && break; continue;;
      */SIMUS.Contracts/*|*/SIMUS.Domain/*|*/SIMUS.Infrastructure/*|*/SIMUS.Migrador/*)
        escalar "$ruta es transversal (contratos, dominio o persistencia)" && break; continue;;
    esac
    # c) reglas explícitas del mapa
    regla=""
    if [ -f "$MAPA" ]; then
      while IFS= read -r linea; do
        case "$linea" in ''|'#'*) continue;; esac
        patron="$(printf '%s' "${linea%%|*}" | sed 's/[[:space:]]*$//')"
        [ -n "$patron" ] || continue
        case "$patron" in
          */) case "$ruta" in "$patron"*) regla="${linea#*|}";; esac;;
          *)  [ "$ruta" = "$patron" ] && regla="${linea#*|}";;
        esac
        [ -n "$regla" ] && break
      done < "$MAPA"
    fi
    if [ -n "$regla" ]; then
      agregar_clases $regla; motivos="$motivos
motivo=$ruta (regla del mapa de pruebas de API): clases$regla"; continue
    fi
    base="$(basename "$ruta" .cs)"
    case "$ruta" in
      simus-api/tests/SIMUS.Api.Tests/*Tests.cs)
        agregar_clases "$base"; motivos="$motivos
motivo=$ruta es una clase de prueba: se corre ella misma"; continue;;
      simus-api/tests/*) escalar "$ruta es un auxiliar de pruebas que usan muchas clases" && break; continue;;
      */SIMUS.Api/Endpoints/*.cs|*/SIMUS.Api/ConsultaGuiada/*.cs|*/SIMUS.Api/ImportacionAsistida/DominioDe*.cs)
        raiz_nombre="$base"
        for sufijo in Endpoints DominioDe; do raiz_nombre="${raiz_nombre#$sufijo}"; raiz_nombre="${raiz_nombre%$sufijo}"; done
        encontradas=""
        if [ "${#raiz_nombre}" -ge 5 ] && [ -d "$PRUEBAS" ]; then
          for f in "$PRUEBAS"/*Tests.cs; do
            [ -e "$f" ] || continue; n="$(basename "$f" .cs)"
            case "$n" in *"$raiz_nombre"*) encontradas="$encontradas $n";; esac
          done
          # tipos declarados en el fichero que alguna prueba cita por su nombre
          if [ -f "$RAIZ/$ruta" ]; then
            for tipo in $(grep -oE '(class|record|interface|enum|struct) [A-Z][A-Za-z0-9_]+' "$RAIZ/$ruta" | awk '{print $2}' | sort -u); do
              [ "${#tipo}" -ge 8 ] || continue
              for f in $(grep -lw -- "$tipo" "$PRUEBAS"/*Tests.cs 2>/dev/null || true); do encontradas="$encontradas $(basename "$f" .cs)"; done
            done
          fi
        fi
        if [ -z "$encontradas" ]; then escalar "$ruta no tiene pruebas identificables por nombre ni por tipo" && break; continue; fi
        agregar_clases $encontradas; motivos="$motivos
motivo=$ruta (por nombre «${raiz_nombre}» y por tipos citados): clases$encontradas"; continue;;
      *) escalar "$ruta no tiene un mapa de pruebas conocido" && break; continue;;
    esac
  done <<< "$cambiados"
  nclases=0; for c in $clases; do nclases=$((nclases + 1)); done
  if [ -z "$completa" ] && [ "$RAPIDA" = 0 ] && [ "$nclases" -gt 40 ]; then completa="el diff relaciona $nclases clases: sale más barato la suite completa"; fi
  if [ -n "$completa" ]; then
    echo "modo=completa"; echo "filtro="; echo "motivo=SIMUS_VALIDAR_API=dirigida, pero $completa"; exit 0
  fi
  if [ "$RAPIDA" = 1 ] && printf '%s\n' "$cambiados" | grep -E '^(simus-api|simus-database)/' | grep -qv '\.md$'; then
    agregar_clases $FIJAS_RAPIDAS; motivos="$motivos
motivo=modo rápido: subconjunto fijo (autorización, contrato OpenAPI y testigos de escrituras): $FIJAS_RAPIDAS"
  fi
  # si el diff solo tocó documentación dentro de esas carpetas y nada más, cae al paso 2 (omitir o ficheros ajenos)
fi

# 2) Cambios en ficheros que las pruebas de API leen: solo esas clases (se suman a las del modo dirigido).
if [ -f "$LISTA" ]; then
  while IFS= read -r linea; do
    case "$linea" in ''|'#'*) continue;; esac
    patron="$(printf '%s' "${linea%%|*}" | sed 's/[[:space:]]*$//')"
    lista_clases="${linea#*|}"
    [ -n "$patron" ] || continue
    coincide=""
    while IFS= read -r ruta; do
      [ -n "$ruta" ] || continue
      case "$patron" in
        */) case "$ruta" in "$patron"*) coincide="$ruta";; esac;;
        *)  [ "$ruta" = "$patron" ] && coincide="$ruta";;
      esac
      [ -n "$coincide" ] && break
    done <<< "$cambiados"
    if [ -n "$coincide" ]; then
      motivos="$motivos
motivo=el diff toca $coincide (patrón «${patron}» de rutas-que-leen-las-pruebas-de-api.txt): clases$lista_clases"
      for c in $lista_clases; do
        case " $clases " in *" $c "*) ;; *) clases="$clases $c";; esac
      done
    fi
  done < "$LISTA"
fi

if [ -n "$clases" ]; then
  filtro=""
  for c in $clases; do filtro="${filtro:+$filtro|}FullyQualifiedName~$c"; done
  echo "modo=dirigida"; echo "filtro=($filtro)"; printf '%s\n' "${motivos#?}"; exit 0
fi

echo "modo=omitir"; echo "filtro="
echo "motivo=sin cambios en simus-api/, simus-database/ ni en ficheros que las pruebas de API leen"
