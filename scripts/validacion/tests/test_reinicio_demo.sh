#!/usr/bin/env bash
# Pruebas livianas, sin base ni docker, del reinicio de la demo con la siembra integral:
# reiniciar-demo.sh (ayuda según la siembra activa), verificar-demo-sembrada.sh (modos y guardas), listas del acceso rápido y
# contratos estáticos de reconstruir-demo-local.sh / local-db-up.sh. Nunca ejecutan `reiniciar-demo.sh --si`.
# Uso: bash scripts/validacion/tests/test_reinicio_demo.sh
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
fallos=0; total=0
ok() { total=$((total + 1)); printf '  OK    %s\n' "$1"; }
mal() { total=$((total + 1)); fallos=$((fallos + 1)); printf '  FALLA %s%s\n' "$1" "${2:+ ($2)}"; }
contiene() { if printf '%s' "$2" | grep -qF -- "$3"; then ok "$1"; else mal "$1" "no aparece: $3"; fi; }
no_contiene() { if printf '%s' "$2" | grep -qF -- "$3"; then mal "$1" "aparece y no debería: $3"; else ok "$1"; fi; }
igual() { if [[ "$2" == "$3" ]]; then ok "$1"; else mal "$1" "esperaba [$3], obtuve [$2]"; fi; }
export SIMUS_LOCAL_SA_PASSWORD=clave-de-prueba-no-real

echo "== reiniciar-demo.sh sin --si (solo explica; no toca nada) =="
SALIDA="$(env -u SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL "$RAIZ/scripts/demo/reiniciar-demo.sh" 2>&1)"; RC=$?
igual "sin --si sale con 2" "$RC" "2"
contiene "anuncia la siembra integral por omisión" "$SALIDA" "siembra integral (completa --si"
contiene "anuncia la instantánea previa" "$SALIDA" "instantánea previa"
contiene "anuncia la instalación condicional de dependencias" "$SALIDA" "instalando dependencias de la web si cambiaron"
SALIDA="$(SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL=1 "$RAIZ/scripts/demo/reiniciar-demo.sh" 2>&1)"; RC=$?
igual "con SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL=1 también sale con 2" "$RC" "2"
contiene "con la variable, anuncia la siembra clásica" "$SALIDA" "siembra clásica de demostración"
no_contiene "con la variable, no anuncia la integral" "$SALIDA" "siembra integral (completa --si"

echo "== reiniciar-demo.sh: contrato del orden de armado =="
R="$(tr -d '\r' < "$RAIZ/scripts/demo/reiniciar-demo.sh")"
pos() { printf '%s' "$R" | grep -n -F -- "$1" | head -1 | cut -d: -f1; }
P_PREVIA="$(pos 'demo-instantanea.sh" crear "$PREVIA"')"; P_RECON="$(pos 'reconstruir-demo-local.sh" --si')"
P_SIEMBRA="$(pos 'siembra-integral.sh" completa --si')"; P_API="$(pos 'nohup "$ROOT_DIR/scripts/local/api-local.sh"')"; P_VERIF="$(pos 'verificar-demo-sembrada.sh"')"
if [[ -n "$P_PREVIA" && -n "$P_RECON" && -n "$P_SIEMBRA" && -n "$P_API" && -n "$P_VERIF" && "$P_PREVIA" -lt "$P_RECON" && "$P_RECON" -lt "$P_SIEMBRA" && "$P_SIEMBRA" -lt "$P_API" && "$P_API" -lt "$P_VERIF" ]]; then
  ok "orden: instantánea previa → reconstruir → siembra integral → API → verificar"
else mal "orden de los pasos de reiniciar-demo.sh" "$P_PREVIA $P_RECON $P_SIEMBRA $P_API $P_VERIF"; fi
contiene "la siembra se confirma con el nombre de la base" "$R" 'SIMUS_SIEMBRA_CONFIRMAR="$DB"'
contiene "se omite con SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL=1" "$R" 'SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL:-0'
contiene "usa los datos completos solo si existen" "$R" 'festivales.json'
contiene "la instalación de la web depende del hash de package.json y el lock" "$R" '.simus-instalado-hash'
contiene "el verificador recibe el modo" "$R" 'SIMUS_VERIFICAR_MODO="$MODO_VERIFICACION"'
contiene "Mailpit sigue en el reinicio" "$R" 'mailpit-local.sh" up'
contiene "el acceso rápido sigue en el reinicio" "$R" 'acceso-rapido-demo.sh" escribir'
RC_TXT="$(tr -d '\r' < "$RAIZ/scripts/demo/reconstruir-demo-local.sh")"
contiene "reconstruir puede omitir la siembra clásica" "$RC_TXT" 'SIMUS_RECONSTRUIR_SIN_SEMBRAR_DEMO'
LDU="$(tr -d '\r' < "$RAIZ/scripts/local/local-db-up.sh")"
contiene "local-db-up no recrea el SQL de la demo si el contenedor es otro" "$LDU" 'simus-desarrollo-sqlserver" && "$(docker inspect'

echo "== verificar-demo-sembrada.sh: modos y guardas =="
V="$RAIZ/scripts/demo/verificar-demo-sembrada.sh"
SALIDA="$("$V" http://127.0.0.1:39799 2>&1)"; RC=$?
igual "sin API sale con 2" "$RC" "2"
contiene "sin API explica" "$SALIDA" "La API no responde"
if command -v node >/dev/null 2>&1; then
  PUERTO=39798
  node -e 'require("http").createServer((q,s)=>{s.writeHead(200);s.end("{}")}).listen('"$PUERTO"',"127.0.0.1");setTimeout(()=>process.exit(0),20000)' >/dev/null 2>&1 &
  PID=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PUERTO" && break; sleep 0.5; done
  SALIDA="$(SIMUS_VERIFICAR_MODO=otro "$V" "http://127.0.0.1:$PUERTO" 2>&1)"; RC=$?
  igual "un modo desconocido sale con 2" "$RC" "2"
  contiene "un modo desconocido explica las opciones" "$SALIDA" "integral o clasica"
  kill "$PID" 2>/dev/null
else
  printf '  OMITE modos del verificador (node no disponible)\n'
fi
VT="$(tr -d '\r' < "$V")"
contiene "el modo clásico se elige con SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL=1" "$VT" 'SIMUS_DEMO_SIN_SIEMBRA_INTEGRAL:-0'
contiene "el modo integral comprueba las seis cuentas de validación" "$VT" 'webmaster@simus.test'
contiene "el modo integral comprueba las imágenes con ETag" "$VT" 'huella SHA-256'

echo "== acceso rápido de cuentas =="
verificar_lista() { # <archivo> <nombre> <mínimo de cuentas> <correo que debe estar>...
  local archivo=$1 nombre=$2 minimo=$3; shift 3
  local n; n="$(grep -vE '^\s*(#|$)' "$archivo" | wc -l | tr -d ' ')"
  local malas; malas="$(grep -vE '^\s*(#|$)' "$archivo" | awk -F'\t' 'NF < 3 || ($1 != "administrativo" && $1 != "externo") || $2 == "" || $3 !~ /@/' | wc -l | tr -d ' ')"
  local repetidos; repetidos="$(grep -vE '^\s*(#|$)' "$archivo" | cut -f3 | sort | uniq -d | wc -l | tr -d ' ')"
  if [[ "$n" -ge "$minimo" && "$malas" == "0" && "$repetidos" == "0" ]]; then ok "$nombre: $n cuentas bien formadas y sin repetir"; else mal "$nombre" "cuentas=$n mal formadas=$malas repetidas=$repetidos"; fi
  local correo; for correo in "$@"; do
    if grep -qP "^(administrativo|externo)\t[^\t]+\t$correo\$" "$archivo" 2>/dev/null || grep -E "^(administrativo|externo)	[^	]+	$correo\$" "$archivo" >/dev/null; then ok "$nombre incluye $correo"; else mal "$nombre incluye $correo"; fi
  done
}
verificar_lista "$RAIZ/scripts/demo/acceso-rapido-demo-cuentas.tsv" "lista integral" 7 \
  camila.restrepo@simus.test webmaster@simus.test gestor@simus.test editor@simus.test reclamante@simus.test nuevo@simus.test webmaster@simus.test gestor@simus.test
verificar_lista "$RAIZ/scripts/demo/acceso-rapido-demo-cuentas-clasica.tsv" "lista clásica" 10 lucia.ramirez@cantaclaro.test webmaster@simus.test externo@simus.test
for correo in $(grep -vE '^\s*(#|$)' "$RAIZ/scripts/demo/acceso-rapido-demo-cuentas.tsv" | cut -f3 | grep '@simus.test' | grep -v '^externo@'); do
  if grep -q "'$correo'\|\"$correo\"" "$RAIZ/siembra/generador/cuentas_validacion.py"; then ok "$correo existe en cuentas_validacion.py"; else mal "$correo existe en cuentas_validacion.py"; fi
done

echo
printf '%s comprobaciones, %s fallos\n' "$total" "$fallos"; [ "$fallos" -eq 0 ]
