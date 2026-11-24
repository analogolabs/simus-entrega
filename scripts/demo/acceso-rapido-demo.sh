#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ACCESO RÁPIDO DE CUENTAS DE DEMOSTRACIÓN (TEMPORAL; docs/operacion/11-operacion-y-mantenimiento.md §11.6 ter).
#
#   ./scripts/demo/acceso-rapido-demo.sh escribir   # crea simus-web/public/config-demo.js con las cuentas de scripts/demo/acceso-rapido-demo-cuentas.tsv
#   ./scripts/demo/acceso-rapido-demo.sh quitar     # borra ese archivo: la interfaz vuelve a no mostrar nada
#
# El archivo está ignorado por git y solo lo lee un build de desarrollo desde localhost. SIMUS_DEMO_SIN_ACCESO_RAPIDO=1
# hace que `escribir` no cree nada (y quite el que hubiera). La clave sale de SIMUS_DEMO_CLAVE (por omisión «admin»).
# ---------------------------------------------------------------------------
set -uo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESTINO="$ROOT_DIR/simus-web/public/config-demo.js"
CUENTAS="${SIMUS_DEMO_CUENTAS_ACCESO_RAPIDO:-$ROOT_DIR/scripts/demo/acceso-rapido-demo-cuentas.tsv}"

case "${1:-}" in
  quitar) rm -f "$DESTINO"; echo "[simus] Acceso rápido de demostración quitado."; exit 0 ;;
  escribir) ;;
  *) echo "Uso: $0 escribir|quitar" >&2; exit 2 ;;
esac

if [[ "${SIMUS_DEMO_SIN_ACCESO_RAPIDO:-0}" == "1" ]]; then
  rm -f "$DESTINO"; echo "[simus] SIMUS_DEMO_SIN_ACCESO_RAPIDO=1: sin acceso rápido de demostración."; exit 0
fi
[[ -f "$CUENTAS" ]] || { echo "[simus] No existe $CUENTAS." >&2; exit 1; }
command -v python3 >/dev/null || { echo "[simus] Falta python3." >&2; exit 1; }

SIMUS_DEMO_CLAVE="${SIMUS_DEMO_CLAVE:-admin}" python3 -I - "$CUENTAS" "$DESTINO" <<'PY'
import json, os, sys
cuentas = []
for linea in open(sys.argv[1], encoding="utf-8"):
    linea = linea.rstrip("\n")
    if not linea.strip() or linea.lstrip().startswith("#"):
        continue
    ambito, rotulo, correo = linea.split("\t")[:3]
    cuentas.append({"rotulo": rotulo, "correo": correo, "clave": os.environ["SIMUS_DEMO_CLAVE"], "ambito": ambito})
cfg = {"accesoRapido": True, "cuentas": cuentas}
with open(sys.argv[2], "w", encoding="utf-8") as f:
    f.write("// Generado por scripts/demo/acceso-rapido-demo.sh. TEMPORAL: no se versiona. Para quitarlo, bórralo.\n")
    f.write("window.__SIMUS_DEMO__ = " + json.dumps(cfg, ensure_ascii=False, indent=2) + ";\n")
print(f"[simus] Acceso rápido de demostración: {len(cuentas)} cuentas en {sys.argv[2]}")
PY
