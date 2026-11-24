"""Lectura del esquema real de SQL Server para el kit de siembra (columnas, claves, CHECK, FK, únicos).

Habla con la base por `scripts/local/sql-local-comun.sh` (la misma vía que los demás guiones: sqlcmd del anfitrión, del contenedor o
de la imagen de herramientas), de modo que la base y el contenedor salen de las variables SIMUS_LOCAL_* del entorno. Solo LEE.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]

CONSULTAS = {
    "columnas": """SELECT t.name AS tabla, c.column_id AS orden, c.name AS columna, ty.name AS tipo,
  CASE WHEN ty.name IN (N'nchar', N'nvarchar') AND c.max_length > 0 THEN c.max_length / 2 ELSE c.max_length END AS longitud,
  c.is_nullable AS admite_nulo, c.is_identity AS es_identidad, c.is_computed AS es_calculada,  CASE WHEN dc.object_id IS NULL THEN 0 ELSE 1 END AS tiene_defecto
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id JOIN sys.types ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE t.is_ms_shipped = 0""",
    "claves": """SELECT t.name AS tabla, i.name AS indice, i.is_primary_key AS es_pk, i.is_unique AS es_unico, i.filter_definition AS filtro,
  (SELECT STRING_AGG(c.name, N',') WITHIN GROUP (ORDER BY ic.key_ordinal) FROM sys.index_columns ic
     JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0) AS columnas
FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
WHERE i.is_unique = 1 AND i.type > 0 AND t.is_ms_shipped = 0""",
    "foraneas": """SELECT t.name AS tabla, fk.name AS restriccion, pc.name AS columna, rt.name AS tabla_referida, rc.name AS columna_referida
FROM sys.foreign_keys fk JOIN sys.tables t ON t.object_id = fk.parent_object_id
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id""",
    # Las definiciones largas viajan en tramos de 80 caracteres: sqlcmd corta cada línea de salida en 256.
    "checks": """SELECT t.name AS tabla, cc.name AS restriccion, v.number AS seq, SUBSTRING(cc.definition, v.number * 80 + 1, 80) AS trozo
FROM sys.check_constraints cc JOIN sys.tables t ON t.object_id = cc.parent_object_id
JOIN master.dbo.spt_values v ON v.type = N'P' AND v.number * 80 < LEN(cc.definition)""",
    "defectos": """SELECT t.name AS tabla, c.name AS columna, v.number AS seq, SUBSTRING(dc.definition, v.number * 80 + 1, 80) AS trozo
FROM sys.default_constraints dc JOIN sys.tables t ON t.object_id = dc.parent_object_id
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
JOIN master.dbo.spt_values v ON v.type = N'P' AND v.number * 80 < LEN(dc.definition)""",
}


def consultar(sql: str) -> list:
    """Ejecuta una consulta que devuelve JSON (FOR JSON PATH) y la entrega como lista de dicts. sqlcmd parte el JSON largo en
    líneas de ~2033 caracteres: se unen SIN separador."""
    # Una fila por línea: cada registro viaja como su propio JSON (corto), así el corte de sqlcmd cada ~2033 caracteres no lo parte.
    sql = f"SELECT (SELECT x.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) FROM ({sql}) AS x"
    orden = f'ROOT_DIR="{RAIZ}"; source "$ROOT_DIR/scripts/local/load-local-env.sh"; source "$ROOT_DIR/scripts/local/sql-local-comun.sh"; sql_consulta "$1"'
    p = subprocess.run(["bash", "-c", orden, "bash", sql], capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"consulta fallida: {p.stderr.strip() or p.stdout.strip()}")
    # sqlcmd corta en líneas de 256 caracteres y a veces junta varias filas en una línea: se extraen objetos JSON completos del flujo.
    flujo, filas, dec = "".join(p.stdout.replace("\x00", "").splitlines()), [], json.JSONDecoder()
    pos = 0
    while pos < len(flujo):
        if flujo[pos].isspace():
            pos += 1
            continue
        try:
            obj, pos = dec.raw_decode(flujo, pos)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"salida de sqlcmd truncada o corrupta cerca de: {flujo[pos:pos + 100]!r}") from e
        filas.append(obj)
    return filas


def inventario() -> dict:
    inv = {nombre: consultar(sql) for nombre, sql in CONSULTAS.items()}
    for clave, id_cols, campo in (("checks", ("tabla", "restriccion"), "definicion"), ("defectos", ("tabla", "columna"), "definicion")):
        trozos: dict = {}
        for f in sorted(inv[clave], key=lambda f: f["seq"]):
            trozos.setdefault(tuple(f[c] for c in id_cols), []).append(f["trozo"])
        inv[clave] = [dict(zip(id_cols, k), **{campo: "".join(v)}) for k, v in trozos.items()]
    for filas in inv.values():  # sin ORDER BY en SQL (no cabe en una subconsulta): se ordena aquí
        filas.sort(key=lambda f: (f["tabla"], f.get("orden", 0), f.get("restriccion") or f.get("indice") or f.get("columna") or ""))
    return inv


if __name__ == "__main__":
    import sys
    destino = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("inventario-esquema.json")
    inv = inventario()
    destino.write_text(json.dumps(inv, ensure_ascii=False), encoding="utf-8")
    print({k: len(v) for k, v in inv.items()}, "->", destino)
