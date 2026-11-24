#!/usr/bin/env python3
"""Genera el SQL idempotente que completa las fichas VACÍAS de los catálogos con las definiciones breves del libro.

Uso:  python3 -I siembra/generador/aplicar_fichas_catalogos.py > /ruta/fichas.sql      (NO se conecta a ninguna base)
      scripts/demo/aplicar-fichas-catalogos.sh                                                  (lo aplica a la base LOCAL de demo)

GARANTÍAS. Solo hace UPDATE sobre fichas cuyo DefinicionBreve es NULL o vacío y cuyo elemento existe; nunca pisa lo que el equipo
ya escribió en la consola, nunca inserta ni borra catálogos ni vínculos, y marca la ficha como «Definición preliminar».
Correrlo dos veces no cambia nada la segunda vez.
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parents[0] / "libro" / "catalogos"))

from fichas_catalogos import PRACTICAS, TERRITORIOS  # noqa: E402


def literal(texto: str) -> str:
    return "N'" + texto.replace("'", "''") + "'"


def bloque(tabla_catalogo: str, id_catalogo: str, tabla_ficha: str, id_ficha: str, datos: dict[str, str]) -> str:
    filas = ",\n".join(f"    ({literal(slug)}, {literal(texto)})" for slug, texto in datos.items())
    return f"""UPDATE f SET f.DefinicionBreve = d.Texto, f.EsPreliminar = 1, f.FechaActualizacion = SYSUTCDATETIME()
FROM dbo.{tabla_ficha} f
JOIN dbo.{tabla_catalogo} c ON c.{id_catalogo} = f.{id_ficha}
JOIN (VALUES
{filas}
) d(Slug, Texto) ON d.Slug = c.Slug
WHERE f.DefinicionBreve IS NULL OR LTRIM(RTRIM(f.DefinicionBreve)) = N'';
"""


def sql() -> str:
    return (
        "-- Fichas breves de catálogos (definición preliminar). Idempotente: solo completa fichas vacías.\n"
        "SET NOCOUNT ON;\n"
        + bloque("PracticasMusicales", "IdPracticaMusical", "FichasConceptualesPracticasMusicales", "PracticaMusicalId", PRACTICAS)
        + "\n"
        + bloque("TerritoriosSonoros", "IdTerritorioSonoro", "FichasConceptualesTerritoriosSonoros", "TerritorioSonoroId", TERRITORIOS)
    )


if __name__ == "__main__":
    sys.stdout.write(sql())
