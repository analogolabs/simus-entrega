#!/usr/bin/env bash
# Pruebas del reparto de la suite de API en procesos paralelos, sin compilar.
# Uso: bash scripts/validacion/tests/test_reparto_y_lote.sh   (también dentro de run-script-tests.sh)
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
T="$(mktemp -d)"; fallos=0; total=0
ok(){ total=$((total + 1)); printf '  OK    %s\n' "$1"; }
mal(){ total=$((total + 1)); fallos=$((fallos + 1)); printf '  FALLA %s\n' "$1"; }
eq(){ if [ "$2" = "$3" ]; then ok "$1"; else mal "$1 (esperaba [$3], salió [$2])"; fi; }

# --- reparto -----------------------------------------------------------------
{ echo "The following Tests are available:"
  for i in $(seq 1 14); do for j in $(seq 1 $((i % 5 + 1))); do echo "    SIMUS.Api.Tests.Clase$i.Metodo$j"; done; done
  # un nombre que es prefijo de otro, una teoría con puntos en los argumentos y la clase excluida
  echo "    SIMUS.Api.Tests.Agenda.Uno"; echo "    SIMUS.Api.Tests.AgendaSqlServer.Uno"
  echo '    SIMUS.Api.Tests.Teoria.Caso(valor: "a.b.c")'; echo "    SIMUS.Api.Tests.CarrilDeSqlServerNoSeOlvidaTests.Siempre"
} > "$T/lista.txt"
for n in 1 2 3 5; do
  mkdir -p "$T/n$n"
  salida="$(python3 -I "$RAIZ/scripts/validacion/repartir-pruebas-de-api.py" repartir "$n" "$T/lista.txt" "$T/n$n" 2>&1)"; rc=$?
  eq "reparto en $n grupos: cobertura exacta (salida 0)" "$rc" "0"
  eq "reparto en $n grupos: escribe $n filtros" "$(ls "$T/n$n"/grupo-*.filtro | wc -l | tr -d ' ')" "$n"
done
todos="$(cat "$T"/n3/grupo-*.filtro | tr '|' '\n' | sort)"
eq "ninguna clase repetida entre grupos" "$(printf '%s\n' "$todos" | uniq -d | wc -l | tr -d ' ')" "0"
eq "17 clases repartidas (la excluida no aparece)" "$(printf '%s\n' "$todos" | wc -l | tr -d ' ')" "17"
case "$todos" in *CarrilDeSqlServerNoSeOlvida*) mal "el carril de SQL Server queda fuera";; *) ok "el carril de SQL Server queda fuera";; esac
case "$todos" in *"Agenda."*) ok "el filtro de Agenda lleva punto final (no atrapa AgendaSqlServer)";; *) mal "filtro con punto final";; esac
# equilibrio: el grupo más pesado no pasa del promedio más la clase mayor
mayor="$(python3 -I - "$T/n3" <<'PY'
import glob,sys
print(max(len(open(f).read().split("|")) for f in glob.glob(sys.argv[1]+"/grupo-*.filtro")) - min(len(open(f).read().split("|")) for f in glob.glob(sys.argv[1]+"/grupo-*.filtro")))
PY
)"
[ "$mayor" -le 3 ] && ok "los grupos quedan equilibrados (diferencia de clases $mayor)" || mal "equilibrio ($mayor)"
# la verificación detecta una cobertura rota (un grupo sin una clase)
python3 -I - "$RAIZ/scripts" "$T/lista.txt" <<'PY' && ok "la verificación detecta una clase sin cubrir y una cubierta dos veces" || mal "la verificación no detecta cobertura rota"
import importlib.util,sys
sp=importlib.util.spec_from_file_location("r",sys.argv[1]+"/validacion/repartir-pruebas-de-api.py"); m=importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
p=m.leer_lista(sys.argv[2]); g,_,_=m.repartir(3,p,{})
g1=[list(x) for x in g]; g1[0].pop()
g2=[list(x) for x in g]; g2[1].append(g2[0][0])
sys.exit(0 if m.verificar(g1,p) and m.verificar(g2,p) and not m.verificar(g,p) else 1)
PY
salida="$(SIMUS_API_SOLO_PLAN=1 SIMUS_API_LISTA="$T/lista.txt" SIMUS_API_REGISTROS="$T/plan" SIMUS_API_PARTICIONES=3 bash "$RAIZ/scripts/validacion/pruebas-api-en-paralelo.sh" 2>&1)"
eq "el ejecutor en modo plan sale 0" "$?" "0"
case "$salida" in *"cobertura verificada"*) ok "el ejecutor muestra la verificación de cobertura";; *) mal "el ejecutor muestra la verificación";; esac
eq "SIMUS_API_PARTICIONES=0 se rechaza" "$(SIMUS_API_PARTICIONES=0 bash "$RAIZ/scripts/validacion/pruebas-api-en-paralelo.sh" >/dev/null 2>&1; echo $?)" "2"

rm -rf "$T"
if [ "$fallos" -ne 0 ]; then printf 'Reparto y lotes: %s de %s casos fallan.\n' "$fallos" "$total" >&2; exit 1; fi
printf 'Reparto y lotes: %s casos en verde.\n' "$total"
