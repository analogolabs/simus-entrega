#!/usr/bin/env python3
"""Avisa de mayúsculas sostenidas por CSS (`uppercase`, `text-transform: uppercase`) en el PORTAL público.

Regla (docs/usuario/23-guia-de-estilo-de-textos.md, «Mayúsculas sostenidas»; docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 76): en el portal solo los TÍTULOS grandes
(`.tipo-seccion`, `.tipo-titulo-grande`, `.tipo-titulo`) van en mayúscula sostenida. Antetítulos,
enlaces, filtros, listas, rótulos y pistas se escriben con mayúscula inicial solo al comienzo de la
frase: la mayúscula sostenida ocupa más espacio y se lee peor.

Qué mira:
- Plantillas (`.html` y `template:` en línea): la clase `uppercase`, salvo en los TÍTULOS (`<h1>`, o `<h2>`/`<h3>` con `text-2xl` o más).
- Estilos (`.css` y `styles:` en línea): `text-transform: uppercase`.
- `simus-web/src/styles.css`: solo se permite en las clases de título y en las excepciones listadas.

Zonas: las del portal público. El panel de la organización y la consola de administración quedan
FUERA de esta regla a propósito (tienen su propio diseño; ver docs/usuario/23-guia-de-estilo-de-textos.md).

Excepciones: `scripts/documentos/uppercase-excepciones.txt`, una por línea, `ruta-parcial: motivo`. Las líneas con
`#` son comentarios. Una excepción sin motivo no vale.

Uso:   python3 scripts/documentos/comprobar-sin-uppercase.py
Salida: 0 si no hay avisos; 1 si los hay (archivo, línea y texto).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
APP = RAIZ / "simus-web" / "src" / "app"
ESTILOS = RAIZ / "simus-web" / "src" / "styles.css"
EXCEPCIONES = Path(__file__).resolve().parent / "uppercase-excepciones.txt"

ZONAS = [
    "features/agenda", "features/content", "features/ecosistema", "features/editorial",
    "features/external-access", "features/gallery", "features/home", "features/map",
    "features/news", "features/not-found", "features/pnmc", "features/politicas",
    "shared/components/layout",
    "shared/components/ui/remote-state", "shared/components/ui/page-hero",
    "shared/components/ui/compact-hero", "shared/components/ui/hero-eyebrow",
    "shared/components/ui/acceso-mapa-ecosistema", "shared/components/ui/franja-metricas-ecosistema",
    "shared/components/ui/recurso-no-encontrado", "shared/components/ui/tag",
    "shared/components/ui/floating-button",
]
CLASE = re.compile(r"(?<![\w-])uppercase(?![\w-])")
# Un TÍTULO es un <h1>, o un <h2>/<h3> con text-2xl o más (en cualquier punto de corte): puede ir en
# mayúscula sostenida. Los subtítulos pequeños (text-xs, text-sm, text-base) no.
TITULO = re.compile(r'<(h[1-3])\s+[^>]*?class="([^"]*)"[^>]*>')
GRANDE = re.compile(r"(?<![\w-])(?:[a-z]+:)?text-(?:2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)(?![\w-])")


def sin_titulos(linea: str) -> str:
    """Quita de la línea los encabezados que son títulos, para no avisar de su mayúscula."""
    def quitar(m: re.Match) -> str:
        return "" if (m.group(1) == "h1" or GRANDE.search(m.group(2))) else m.group(0)
    return TITULO.sub(quitar, linea)
DECLARACION = re.compile(r"text-transform\s*:\s*uppercase")
# En styles.css se permite en: las clases de TÍTULO del portal; la cartografía (nombres de países, por
# convención cartográfica); y el diseño propio del panel de la organización y de la consola, que queda
# fuera de la regla del portal (docs/usuario/23-guia-de-estilo-de-textos.md).
PERMITIDAS_EN_ESTILOS = (
    ".tipo-seccion", ".tipo-titulo-grande", ".tipo-titulo",
    ".country-label-marker",
    ".tabla-administrativa", ".titulo-de-apartado", ".tabla-de-categorias", ".rotulo-de-seccion",
    ".dialogo__contexto", ".cabecera__contexto", ".panel__contexto", ".campo",
)


def cargar_excepciones() -> list[tuple[str, str]]:
    salida: list[tuple[str, str]] = []
    if not EXCEPCIONES.exists():
        return salida
    for linea in EXCEPCIONES.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#"):
            continue
        ruta, _, motivo = linea.partition(":")
        if ruta.strip() and motivo.strip():
            salida.append((ruta.strip(), motivo.strip()))
    return salida


def exceptuado(ruta: str, excepciones: list[tuple[str, str]]) -> bool:
    return any(parcial in ruta for parcial, _ in excepciones)


def main() -> int:
    excepciones = cargar_excepciones()
    avisos: list[str] = []

    for zona in ZONAS:
        base = APP / zona
        if not base.exists():
            continue
        for ruta in sorted(base.rglob("*")):
            if not ruta.is_file() or ruta.name.endswith(".spec.ts") or ruta.suffix not in (".html", ".ts", ".css"):
                continue
            rel = ruta.relative_to(RAIZ).as_posix()
            if exceptuado(rel, excepciones):
                continue
            for n, linea in enumerate(ruta.read_text(encoding="utf-8").splitlines(), 1):
                visible = linea.strip()
                if visible.startswith(("//", "*", "/*", "<!--")):
                    continue  # comentarios
                if ruta.suffix == ".css" or ruta.suffix == ".ts":
                    if DECLARACION.search(linea):
                        avisos.append(f"{rel}:{n}: text-transform: uppercase → {visible[:90]}")
                if ruta.suffix in (".html", ".ts") and CLASE.search(sin_titulos(linea)):
                    avisos.append(f"{rel}:{n}: clase uppercase → {visible[:90]}")

    if ESTILOS.exists():
        texto = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), ESTILOS.read_text(encoding="utf-8"), flags=re.S)
        for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", texto):
            if not DECLARACION.search(m.group(2)):
                continue
            selector = " ".join(m.group(1).split())
            if any(p in selector for p in PERMITIDAS_EN_ESTILOS):
                continue
            n = texto.count("\n", 0, m.start(2)) + 1
            avisos.append(f"simus-web/src/styles.css:{n}: text-transform: uppercase en «{selector[:70]}» (no es título ni excepción)")

    if avisos:
        print("Mayúsculas sostenidas en el portal (docs/usuario/23-guia-de-estilo-de-textos.md). Quita `uppercase` o justifica la excepción en scripts/documentos/uppercase-excepciones.txt:")
        for a in avisos[:40]:
            print("  " + a)
        if len(avisos) > 40:
            print(f"  … y {len(avisos) - 40} más")
        return 1
    print("Mayúsculas sostenidas: sin avisos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
