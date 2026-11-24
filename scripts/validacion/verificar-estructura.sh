#!/usr/bin/env bash
set -euo pipefail

# Protege las decisiones estructurales del corte cero. Solo inspecciona el árbol y Git:
# no inicia servicios, no modifica archivos y no necesita dependencias del proyecto.

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$RAIZ"

fallos=0

fallar() {
  printf '  FALLA %s\n' "$1" >&2
  fallos=$((fallos + 1))
}

comprobar_archivo() {
  [[ -f "$1" ]] || fallar "falta el archivo obligatorio: $1"
}

comprobar_carpeta() {
  [[ -d "$1" ]] || fallar "falta la carpeta obligatoria: $1"
}

printf '%s\n' '== Estructura obligatoria =='
# `Archivos basura/` salió del repositorio en el punto de control del 14 de septiembre de 2026:
# era retención temporal y su propio README autorizaba retirarla. El material sigue en la máquina,
# fuera de Git, y el historial lo conserva.
for carpeta in simus-api simus-web simus-database/schema simus-database/seed scripts infra docs; do
  comprobar_carpeta "$carpeta"
done

# LA DOCUMENTACION DE LA ENTREGA SON ONCE DOCUMENTOS NUMERADOS, y ninguno es opcional: si falta uno,
# quien reciba el sistema se queda sin una de las piezas que necesita para comprenderlo u operarlo.
for archivo in \
  README.md CHANGELOG.md .env.example \
  simus-api/SIMUS.Api.sln simus-web/package.json simus-web/package-lock.json \
  docker-compose.local.yml \
  docs/usuario/01-descripcion-general.md docs/desarrollo/02-arquitectura.md docs/desarrollo/03-estructura-del-proyecto.md \
  docs/operacion/04-instalacion-y-configuracion.md docs/desarrollo/05-base-de-datos.md \
  docs/usuario/06-modulos-y-funcionalidades.md docs/usuario/07-roles-y-permisos.md \
  docs/desarrollo/08-api-e-integraciones.md docs/operacion/09-despliegue.md docs/desarrollo/10-pruebas.md \
  docs/operacion/11-operacion-y-mantenimiento.md; do
  comprobar_archivo "$archivo"
done

# EL REPOSITORIO ES LA ENTREGA. Las rutas de abajo llevaban documentación interna de trabajo
# —planes, auditorías, historial, borradores de entrega— o herramientas locales de una sola
# máquina, y salieron del árbol el 21 de septiembre de 2026. Si alguna reaparece, es que volvió
# a versionarse material que no describe el sistema sino cómo se construyó, y eso viaja con cada
# push a quien reciba el proyecto.
# NINGÚN ARCHIVO VERSIONADO LLEVA MARCAS DE CONFLICTO DE UNIÓN. El 12 de noviembre de 2026 entró en `main` una
# unión mal cerrada (HST) con `<<<<<<< HEAD` y `>>>>>>> origin/main` escritas dentro de `CHANGELOG.md` y de
# `docs/referencia/20-decisiones-y-flujos-por-modulo.md`, y ninguna validación lo detectó: ni la de enlaces ni la de mayúsculas leen esas líneas. Solo se
# buscan las líneas de apertura y cierre (con su espacio y su etiqueta), porque `=======` es legítimo en Markdown
# (subrayado de títulos). Los casos de prueba del resolvedor de documentos las llevan a propósito y se excluyen.
printf '%s\n' '== Sin marcas de conflicto de unión =='
marcas="$(git grep -n -E '^(<<<<<<<|>>>>>>>) [^ ]' -- . ':!scripts/tests' 2>/dev/null || true)"
if [[ -n "$marcas" ]]; then
  while IFS= read -r linea; do fallar "marca de conflicto sin resolver: ${linea:0:120}"; done <<< "$marcas"
fi

printf '%s\n' '== Vestigios prohibidos en el árbol activo =='
for retirado in \
  simus-web/pnpm-lock.yaml \
  simus-web/pnpm-workspace.yaml \
  simus-web/yarn.lock \
  simus-database/migrations \
  simus-web/src/app/features/ecosystem \
  output \
  'Iniciar PNMC.command' \
  'Detener PNMC.command' \
  AVANCE_GENERAL.md \
  'AVANCE_GENERAL V2505.md' \
  'Archivos basura' \
  DESPLIEGUE.md \
  docs/calidad \
  docs/arquitectura \
    docs/entregables \
    docs/historial \
    docs/integracion \
    docs/producto/decisiones-abiertas.md \
    scripts/documento-a-word.sh \
    scripts/documento-a-pdf.sh \
    Shortcuts; do
  [[ ! -e "$retirado" ]] || fallar "reapareció una ruta retirada: $retirado"
done

# NINGUNA PIEZA ACTIVA PUEDE APUNTAR A LO RETIRADO, ni al material archivado ni a la trazabilidad
# interna: si una ruta de estas aparece en el producto, es que algo volvió a depender de lo que se
# sacó del repositorio.
referencias_retiradas="$(git grep -n -I -E 'Archivos basura/|\.interno/' -- \
  simus-api simus-web simus-database scripts infra docker-compose.local.yml azure-pipelines.yml \
  ':!scripts/validacion/verificar-estructura.sh' 2>/dev/null || true)"
if [[ -n "$referencias_retiradas" ]]; then
  fallar 'el producto activo depende de material retirado o de la trazabilidad interna'
  printf '%s\n' "$referencias_retiradas" | sed -n '1,20p' >&2
fi

printf '%s\n' '== La trazabilidad interna no se versiona =='
internos_versionados="$(git ls-files -- '.interno/*' 2>/dev/null || true)"
if [[ -n "$internos_versionados" ]]; then
  fallar 'hay trazabilidad interna dentro del control de versiones'
  printf '%s\n' "$internos_versionados" | sed -n '1,20p' >&2
fi

printf '%s\n' '== Archivos regenerables fuera de Git =='
basura_versionada="$(git ls-files | grep -E '(^|/)(node_modules|dist|dist-ssr|bin|obj|tmp|\.angular|\.DS_Store)(/|$)|(^|/)\.DS_Store$' || true)"
if [[ -n "$basura_versionada" ]]; then
  fallar 'hay salidas generadas o archivos de sistema versionados'
  printf '%s\n' "$basura_versionada" >&2
fi

archivos_de_sistema="$(find . -path './.git' -prune -o -name '.DS_Store' -print)"
if [[ -n "$archivos_de_sistema" ]]; then
  fallar 'hay archivos .DS_Store en el árbol de trabajo'
  printf '%s\n' "$archivos_de_sistema" >&2
fi

printf '%s\n' '== Enlaces entre documentos =='
salida_enlaces="$(python3 -I scripts/documentos/comprobar-enlaces-docs.py 2>&1)" || { fallar 'hay enlaces rotos entre documentos'; printf '%s\n' "$salida_enlaces" | sed -n '1,20p' >&2; }

printf '%s\n' '== Mayúsculas en los textos (docs/usuario/23-guia-de-estilo-de-textos.md) =='
salida_mayusculas="$(python3 -I scripts/documentos/comprobar-mayusculas.py 2>&1)" || { fallar 'hay sustantivos comunes con mayúscula a mitad de frase (docs/usuario/23-guia-de-estilo-de-textos.md)'; printf '%s\n' "$salida_mayusculas" | sed -n '1,20p' >&2; }

printf '%s\n' '== Mayúsculas sostenidas en el portal (docs/usuario/23-guia-de-estilo-de-textos.md) =='
salida_uppercase="$(python3 -I scripts/documentos/comprobar-sin-uppercase.py 2>&1)" || { fallar 'hay mayúsculas sostenidas por CSS en el portal (docs/usuario/23-guia-de-estilo-de-textos.md)'; printf '%s\n' "$salida_uppercase" | sed -n '1,20p' >&2; }

printf '%s\n' '== Rutas que leen las pruebas de API (omisión segura de la suite) =='
salida_rutas="$(./scripts/validacion/verificar-rutas-que-leen-las-pruebas-de-api.sh 2>&1)" || { fallar 'la lista de rutas que leen las pruebas de API está desactualizada'; printf '%s\n' "$salida_rutas" | sed -n '1,20p' >&2; }

if [[ "$fallos" -ne 0 ]]; then
  printf '\nEstructura inválida: %s hallazgo(s).\n' "$fallos" >&2
  exit 1
fi

printf '%s\n' 'Estructura válida.'
