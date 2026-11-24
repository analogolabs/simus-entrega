#!/usr/bin/env bash
set -euo pipefail

# Atajo conservado por compatibilidad: siembra solo la demostración del Mapa Ecosistémico
# (Festivales, organizaciones y agenda). Ver scripts/demo/sembrar-demo.sh.
exec "$(cd "$(dirname "$0")" && pwd)/sembrar-demo.sh" mapa
