#!/usr/bin/env python3
"""Avisa de sustantivos comunes escritos con mayúscula a mitad de frase en las plantillas.

Regla (docs/usuario/23-guia-de-estilo-de-textos.md): la mayúscula inicial va al comienzo de la frase y en
nombres propios. «edición», «organización», «evento»… son sustantivos comunes y, a mitad de frase,
van en minúscula. Los títulos y los nombres de sección o de módulo (Agenda, Noticias, Solicitudes)
quedan fuera de esta regla, y también los nombres de entidad que el producto escribe con mayúscula
(Festival, Mercado).

Es un chequeo LIGERO y heurístico, pensado para no dar falsos positivos molestos:

- Solo mira el texto visible de las plantillas `.html` (contenido entre etiquetas y los atributos
  `placeholder`, `title`, `aria-label`, `label`, `alt`, `text`), no el código.
- Solo avisa de una lista corta de sustantivos comunes (`SUSTANTIVOS`) precedidos por una palabra en
  minúscula, sin signo de puntuación entre las dos.
- Se salta lo que esté dentro de `<h1>`..`<h6>` y de las etiquetas `<th>`, `<legend>`, `<summary>`,
  `<title>` y los rótulos con la clase `titulo`.
- Las excepciones van en `scripts/documentos/mayusculas-excepciones.txt`, una por línea: `ruta:texto` (la ruta
  puede ser parcial). Las líneas que empiezan por `#` son comentarios.

Uso:   python3 scripts/documentos/comprobar-mayusculas.py
Salida: 0 si no hay avisos nuevos; 1 si los hay (se listan archivo, línea y texto).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PLANTILLAS = RAIZ / "simus-web" / "src"
EXCEPCIONES = Path(__file__).resolve().parent / "mayusculas-excepciones.txt"

SUSTANTIVOS = (
    "Edición|Ediciones|Organización|Organizaciones|Evento|Eventos|Archivo|Archivos|"
    "Propuesta|Propuestas|Ajuste|Ajustes|Equipo|Solicitud|Responsable|Persona|Personas|Sesión|Calendario"
)
PLANTILLA_EN_LINEA = re.compile(r"template:\s*`(.*?)`", re.S)
# palabra en minúscula + espacio + sustantivo en mayúscula. El `(?<![.:¿¡?!»—\-])` impide avisar al
# empezar una frase o tras un guion largo.
PATRON = re.compile(rf"(?<![.:¿¡?!»—])\b([a-záéíóúñ]{{2,}}) ({SUSTANTIVOS})\b")
ATRIBUTOS = re.compile(r'\b(?:placeholder|title|aria-label|label|alt|text)\s*=\s*"([^"]+)"')
BLOQUES_DE_TITULO = re.compile(r"<(h[1-6]|th|legend|summary|title)\b[^>]*>.*?</\1>", re.S | re.I)
CLASE_TITULO = re.compile(r"<[^>]+class\s*=\s*\"[^\"]*\btitulo[^\"]*\"[^>]*>.*?</[^>]+>", re.S | re.I)
ETIQUETA = re.compile(r"<[^>]+>")
INTERPOLACION = re.compile(r"\{\{.*?\}\}", re.S)
COMENTARIO = re.compile(r"<!--.*?-->", re.S)


def cargar_excepciones() -> list[tuple[str, str]]:
    if not EXCEPCIONES.exists():
        return []
    salida = []
    for linea in EXCEPCIONES.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#"):
            continue
        ruta, _, texto = linea.partition(":")
        salida.append((ruta.strip(), texto.strip()))
    return salida


def textos_visibles(contenido: str):
    """Rinde (línea, texto) de lo que ve la persona, sin comentarios ni títulos."""
    limpio = COMENTARIO.sub(lambda m: "\n" * m.group(0).count("\n"), contenido)
    limpio = BLOQUES_DE_TITULO.sub(lambda m: "\n" * m.group(0).count("\n"), limpio)
    limpio = CLASE_TITULO.sub(lambda m: "\n" * m.group(0).count("\n"), limpio)
    for m in ATRIBUTOS.finditer(limpio):
        yield limpio.count("\n", 0, m.start()) + 1, m.group(1)
    sin_etiquetas = ETIQUETA.sub(lambda m: " " * len(m.group(0)) if "\n" not in m.group(0) else "\n" * m.group(0).count("\n"), limpio)
    sin_etiquetas = INTERPOLACION.sub(lambda m: " " * len(m.group(0)) if "\n" not in m.group(0) else "\n" * m.group(0).count("\n"), sin_etiquetas)
    for numero, linea in enumerate(sin_etiquetas.splitlines(), 1):
        if linea.strip():
            yield numero, linea


def plantillas():
    """Rinde (ruta, contenido) de cada plantilla: los `.html` y las plantillas en línea de los `.ts`.

    Las plantillas en línea conservan su número de línea relativo al archivo, no al bloque, porque se
    rellena con saltos de línea lo que precede al bloque.
    """
    for ruta in sorted(PLANTILLAS.rglob("*.html")):
        yield ruta, ruta.read_text(encoding="utf-8")
    for ruta in sorted(PLANTILLAS.rglob("*.ts")):
        if ruta.name.endswith(".spec.ts"):
            continue
        codigo = ruta.read_text(encoding="utf-8")
        for bloque in PLANTILLA_EN_LINEA.finditer(codigo):
            antes = "\n" * codigo.count("\n", 0, bloque.start(1))
            yield ruta, antes + bloque.group(1)


def main() -> int:
    excepciones = cargar_excepciones()
    avisos: list[str] = []
    for ruta, contenido in plantillas():
        relativa = ruta.relative_to(RAIZ).as_posix()
        for numero, texto in textos_visibles(contenido):
            for m in PATRON.finditer(texto):
                hallado = m.group(0)
                if any(e_ruta in relativa and e_txt == hallado for e_ruta, e_txt in excepciones):
                    continue
                avisos.append(f"{relativa}:{numero}: «{hallado}»")
    if avisos:
        print("Mayúsculas a mitad de frase (ver docs/usuario/23-guia-de-estilo-de-textos.md):")
        for a in avisos:
            print("  " + a)
        print(f"\n{len(avisos)} aviso(s). Corrige el texto o, si es un nombre propio, añade la excepción a "
              "scripts/documentos/mayusculas-excepciones.txt.")
        return 1
    print("Mayúsculas: sin avisos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
