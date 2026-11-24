#!/usr/bin/env python3
"""Inventario repetible del esquema de SQL Server (T-161, carril de datos D0).

Para qué sirve: antes y después de cada migración de catálogos o de ola hay que poder
decir con exactitud qué cambió. El inventario anterior venía de un SchemaSpy externo y no
se podía regenerar. Este guion lo hace desde la propia base: tablas, columnas, claves,
índices, claves foráneas, restricciones CHECK, vistas, rutinas y migraciones aplicadas.

Uso:
  python3 scripts/documentos/inventario_esquema.py generar  --etiqueta ANTES [--salida DIR] [--con-filas]
  python3 scripts/documentos/inventario_esquema.py comparar ANTES.json DESPUES.json
  python3 scripts/documentos/inventario_esquema.py autoprueba

La conexión sale del entorno (el mismo `.env` de los demás guiones): SIMUS_LOCAL_SA_PASSWORD,
SIMUS_LOCAL_DB_NAME (SIMUS_LOCAL) y SIMUS_LOCAL_SQL_PORT (14344). Requiere `sqlcmd` en el PATH.
Nunca escribe credenciales en los archivos que produce.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path

CONSULTAS = {
    "columnas": """
SELECT s.name AS esquema, t.name AS tabla, c.column_id AS orden, c.name AS columna,
       ty.name AS tipo,
       CASE WHEN ty.name IN (N'nchar', N'nvarchar') AND c.max_length > 0 THEN c.max_length / 2
            ELSE c.max_length END AS longitud,
       c.precision AS precision_numerica, c.scale AS escala,
       c.is_nullable AS admite_nulo, c.is_identity AS es_identidad, c.is_computed AS es_calculada,
       dc.definition AS valor_por_defecto
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name, c.column_id
""",
    "indices": """
SELECT s.name AS esquema, t.name AS tabla, i.name AS indice, i.type_desc AS tipo,
       i.is_unique AS es_unico, i.is_primary_key AS es_clave_primaria,
       i.is_unique_constraint AS es_restriccion_unica, i.filter_definition AS filtro,
       (SELECT STRING_AGG(c.name, N',') WITHIN GROUP (ORDER BY ic.key_ordinal)
          FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
         WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0) AS columnas,
       (SELECT STRING_AGG(c.name, N',') WITHIN GROUP (ORDER BY c.name)
          FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
         WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1) AS incluidas
FROM sys.indexes i
JOIN sys.tables t ON t.object_id = i.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE i.index_id > 0 AND i.type > 0 AND t.is_ms_shipped = 0
ORDER BY s.name, t.name, i.name
""",
    "claves_foraneas": """
SELECT sp.name AS esquema, tp.name AS tabla, fk.name AS nombre,
       STRING_AGG(cp.name, N',') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS columnas,
       sr.name AS esquema_referido, tr.name AS tabla_referida,
       STRING_AGG(cr.name, N',') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS columnas_referidas,
       fk.delete_referential_action_desc AS al_borrar, fk.update_referential_action_desc AS al_actualizar,
       fk.is_disabled AS deshabilitada, fk.is_not_trusted AS no_confiable
FROM sys.foreign_keys fk
JOIN sys.tables tp ON tp.object_id = fk.parent_object_id
JOIN sys.schemas sp ON sp.schema_id = tp.schema_id
JOIN sys.tables tr ON tr.object_id = fk.referenced_object_id
JOIN sys.schemas sr ON sr.schema_id = tr.schema_id
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns cp ON cp.object_id = fkc.parent_object_id AND cp.column_id = fkc.parent_column_id
JOIN sys.columns cr ON cr.object_id = fkc.referenced_object_id AND cr.column_id = fkc.referenced_column_id
GROUP BY sp.name, tp.name, fk.name, sr.name, tr.name, fk.delete_referential_action_desc,
         fk.update_referential_action_desc, fk.is_disabled, fk.is_not_trusted
ORDER BY sp.name, tp.name, fk.name
""",
    "restricciones_check": """
SELECT s.name AS esquema, t.name AS tabla, cc.name AS nombre, cc.definition AS definicion,
       cc.is_disabled AS deshabilitada
FROM sys.check_constraints cc
JOIN sys.tables t ON t.object_id = cc.parent_object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name, cc.name
""",
    "vistas": """
SELECT s.name AS esquema, v.name AS nombre FROM sys.views v
JOIN sys.schemas s ON s.schema_id = v.schema_id WHERE v.is_ms_shipped = 0 ORDER BY s.name, v.name
""",
    "rutinas": """
SELECT s.name AS esquema, o.name AS nombre, o.type_desc AS tipo FROM sys.objects o
JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('P','FN','IF','TF') AND o.is_ms_shipped = 0 ORDER BY s.name, o.name
""",
    "migraciones_aplicadas": """
SELECT ScriptName AS guion FROM dbo.SchemaVersions ORDER BY ScriptName
""",
}

CONSULTA_FILAS = """
SELECT s.name AS esquema, t.name AS tabla, SUM(ps.row_count) AS filas
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.dm_db_partition_stats ps ON ps.object_id = t.object_id AND ps.index_id IN (0, 1)
WHERE t.is_ms_shipped = 0
GROUP BY s.name, t.name
"""


def variable(nombre: str, defecto: str = "") -> str:
    """Lee SIMUS_*; si no está, el nombre anterior PNMC_* (transición #68)."""
    return os.environ.get(nombre) or os.environ.get("PNMC_" + nombre[len("SIMUS_"):]) or defecto


def ejecutar_json(consulta: str) -> list[dict]:
    """Ejecuta una consulta con `FOR JSON PATH` y devuelve las filas."""
    password = variable("SIMUS_LOCAL_SA_PASSWORD")
    if not password:
        sys.exit("Falta SIMUS_LOCAL_SA_PASSWORD (defínela en el entorno o en .env).")
    puerto = variable("SIMUS_LOCAL_SQL_PORT", "14344")
    base = variable("SIMUS_LOCAL_DB_NAME", "SIMUS_LOCAL")
    sql = "SET NOCOUNT ON; " + consulta.strip().rstrip(";") + " FOR JSON PATH, INCLUDE_NULL_VALUES"
    proceso = subprocess.run(
        ["sqlcmd", "-S", f"127.0.0.1,{puerto}", "-U", "sa", "-P", password, "-d", base, "-C",
         "-h", "-1", "-W", "-y", "0", "-Q", sql],
        capture_output=True, text=True, check=False,
    )
    if proceso.returncode != 0:
        sys.exit(f"sqlcmd falló: {proceso.stderr.strip() or proceso.stdout.strip()}")
    texto = "".join(proceso.stdout.splitlines()).strip()
    if not texto:
        return []
    try:
        return json.loads(texto)
    except json.JSONDecodeError as error:
        sys.exit(f"Respuesta no interpretable de sqlcmd ({error}): {texto[:200]}")


def clave(fila: dict) -> str:
    return f"{fila['esquema']}.{fila['tabla']}"


def generar(etiqueta: str, salida: Path, con_filas: bool) -> Path:
    datos = {nombre: ejecutar_json(consulta) for nombre, consulta in CONSULTAS.items()}
    tablas: dict[str, dict] = {}
    for fila in datos["columnas"]:
        tablas.setdefault(clave(fila), {"columnas": [], "indices": [], "claves_foraneas": [], "restricciones_check": []})
        tablas[clave(fila)]["columnas"].append({k: v for k, v in fila.items() if k not in ("esquema", "tabla")})
    for seccion in ("indices", "claves_foraneas", "restricciones_check"):
        for fila in datos[seccion]:
            destino = tablas.setdefault(clave(fila), {"columnas": [], "indices": [], "claves_foraneas": [], "restricciones_check": []})
            destino[seccion].append({k: v for k, v in fila.items() if k not in ("esquema", "tabla")})
    if con_filas:
        for fila in ejecutar_json(CONSULTA_FILAS):
            if clave(fila) in tablas:
                tablas[clave(fila)]["filas"] = fila["filas"]
    inventario = {
        "etiqueta": etiqueta,
        "generado_en": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "base": variable("SIMUS_LOCAL_DB_NAME", "SIMUS_LOCAL"),
        "tablas": dict(sorted(tablas.items())),
        "vistas": [f"{v['esquema']}.{v['nombre']}" for v in datos["vistas"]],
        "rutinas": [f"{r['esquema']}.{r['nombre']} ({r['tipo']})" for r in datos["rutinas"]],
        "migraciones_aplicadas": [m["guion"] for m in datos["migraciones_aplicadas"]],
    }
    salida.mkdir(parents=True, exist_ok=True)
    ruta = salida / "inventario.json"
    ruta.write_text(json.dumps(inventario, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (salida / "resumen.md").write_text(resumen(inventario), encoding="utf-8")
    return ruta


def resumen(inv: dict) -> str:
    tablas = inv["tablas"]
    total = lambda k: sum(len(t[k]) for t in tablas.values())  # noqa: E731
    lineas = [
        f"# Inventario del esquema · {inv['etiqueta']}",
        "",
        f"Base `{inv['base']}` · generado el {inv['generado_en']}",
        "",
        "| Elemento | Cantidad |", "|---|---:|",
        f"| Tablas | {len(tablas)} |",
        f"| Columnas | {total('columnas')} |",
        f"| Índices | {total('indices')} |",
        f"| Claves foráneas | {total('claves_foraneas')} |",
        f"| Restricciones CHECK | {total('restricciones_check')} |",
        f"| Vistas | {len(inv['vistas'])} |",
        f"| Rutinas | {len(inv['rutinas'])} |",
        f"| Migraciones aplicadas | {len(inv['migraciones_aplicadas'])} |",
        "",
        "## Tablas",
        "",
        "| Tabla | Columnas | Índices | FK | CHECK |", "|---|---:|---:|---:|---:|",
    ]
    for nombre, t in tablas.items():
        lineas.append(f"| `{nombre}` | {len(t['columnas'])} | {len(t['indices'])} | {len(t['claves_foraneas'])} | {len(t['restricciones_check'])} |")
    return "\n".join(lineas) + "\n"


def indexar(lista: list[dict], campo: str) -> dict[str, dict]:
    return {str(x[campo]): x for x in lista}


def comparar_inventarios(antes: dict, despues: dict) -> list[str]:
    """Devuelve las diferencias en lenguaje llano; lista vacía si el esquema es idéntico."""
    diferencias: list[str] = []
    ta, td = antes["tablas"], despues["tablas"]
    for nombre in sorted(set(td) - set(ta)):
        diferencias.append(f"+ tabla nueva: {nombre} ({len(td[nombre]['columnas'])} columnas)")
    for nombre in sorted(set(ta) - set(td)):
        diferencias.append(f"- tabla retirada: {nombre}")
    for nombre in sorted(set(ta) & set(td)):
        a, d = ta[nombre], td[nombre]
        ca, cd = indexar(a["columnas"], "columna"), indexar(d["columnas"], "columna")
        for col in sorted(set(cd) - set(ca)):
            diferencias.append(f"+ {nombre}: columna nueva {col} ({cd[col]['tipo']})")
        for col in sorted(set(ca) - set(cd)):
            diferencias.append(f"- {nombre}: columna retirada {col}")
        for col in sorted(set(ca) & set(cd)):
            campos = ("tipo", "longitud", "precision_numerica", "escala", "admite_nulo", "es_identidad", "valor_por_defecto")
            cambios = [f"{c}: {ca[col].get(c)!r} → {cd[col].get(c)!r}" for c in campos if ca[col].get(c) != cd[col].get(c)]
            if cambios:
                diferencias.append(f"~ {nombre}.{col}: " + "; ".join(cambios))
        for seccion, campo, rotulo in (("indices", "indice", "índice"), ("claves_foraneas", "nombre", "clave foránea"), ("restricciones_check", "nombre", "CHECK")):
            ia, idd = indexar(a[seccion], campo), indexar(d[seccion], campo)
            for n in sorted(set(idd) - set(ia)):
                diferencias.append(f"+ {nombre}: {rotulo} nuevo {n}")
            for n in sorted(set(ia) - set(idd)):
                diferencias.append(f"- {nombre}: {rotulo} retirado {n}")
            for n in sorted(set(ia) & set(idd)):
                if {k: v for k, v in ia[n].items()} != {k: v for k, v in idd[n].items()}:
                    diferencias.append(f"~ {nombre}: {rotulo} modificado {n}")
    for seccion, rotulo in (("vistas", "vista"), ("rutinas", "rutina")):
        for n in sorted(set(despues[seccion]) - set(antes[seccion])):
            diferencias.append(f"+ {rotulo} nueva: {n}")
        for n in sorted(set(antes[seccion]) - set(despues[seccion])):
            diferencias.append(f"- {rotulo} retirada: {n}")
    for n in sorted(set(despues["migraciones_aplicadas"]) - set(antes["migraciones_aplicadas"])):
        diferencias.append(f"+ migración aplicada: {n}")
    for n in sorted(set(antes["migraciones_aplicadas"]) - set(despues["migraciones_aplicadas"])):
        diferencias.append(f"- migración ya no figura: {n}")
    return diferencias


def autoprueba() -> int:
    """Comprueba la comparación con inventarios sintéticos; no necesita base de datos."""
    def col(nombre, tipo="int", nulo=False):
        return {"columna": nombre, "orden": 1, "tipo": tipo, "longitud": 4, "precision_numerica": 10, "escala": 0,
                "admite_nulo": nulo, "es_identidad": False, "es_calculada": False, "valor_por_defecto": None}
    base = {"tablas": {"dbo.A": {"columnas": [col("Id")], "indices": [], "claves_foraneas": [], "restricciones_check": []}},
            "vistas": [], "rutinas": [], "migraciones_aplicadas": ["V1"]}
    igual = json.loads(json.dumps(base))
    assert comparar_inventarios(base, igual) == [], "dos inventarios iguales no deben dar diferencias"
    nuevo = json.loads(json.dumps(base))
    nuevo["tablas"]["dbo.A"]["columnas"].append(col("Codigo", "nvarchar", True))
    nuevo["tablas"]["dbo.B"] = {"columnas": [col("Id")], "indices": [], "claves_foraneas": [], "restricciones_check": []}
    nuevo["tablas"]["dbo.A"]["columnas"][0]["tipo"] = "bigint"
    nuevo["migraciones_aplicadas"].append("V2")
    texto = "\n".join(comparar_inventarios(base, nuevo))
    for esperado in ("+ tabla nueva: dbo.B", "+ dbo.A: columna nueva Codigo", "~ dbo.A.Id: tipo: 'int' → 'bigint'", "+ migración aplicada: V2"):
        assert esperado in texto, f"falta «{esperado}» en:\n{texto}"
    retirada = json.loads(json.dumps(base))
    del retirada["tablas"]["dbo.A"]
    assert "- tabla retirada: dbo.A" in "\n".join(comparar_inventarios(base, retirada))
    print("autoprueba: OK")
    return 0


def main() -> int:
    analizador = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = analizador.add_subparsers(dest="orden", required=True)
    g = sub.add_parser("generar", help="Genera inventario.json y resumen.md")
    g.add_argument("--etiqueta", required=True, help="Nombre del estado, p. ej. antes-catalogos")
    g.add_argument("--salida", help="Carpeta de salida (por defecto tmp/inventarios/<etiqueta>)")
    g.add_argument("--con-filas", action="store_true", help="Incluye el número de filas por tabla")
    c = sub.add_parser("comparar", help="Compara dos inventarios .json")
    c.add_argument("antes"); c.add_argument("despues")
    sub.add_parser("autoprueba", help="Pruebas internas, sin base de datos")
    args = analizador.parse_args()
    if args.orden == "autoprueba":
        return autoprueba()
    if args.orden == "generar":
        salida = Path(args.salida) if args.salida else Path(__file__).resolve().parent.parent / "tmp" / "inventarios" / args.etiqueta
        ruta = generar(args.etiqueta, salida, args.con_filas)
        print(f"Inventario escrito en {ruta}")
        return 0
    antes = json.loads(Path(args.antes).read_text(encoding="utf-8"))
    despues = json.loads(Path(args.despues).read_text(encoding="utf-8"))
    diferencias = comparar_inventarios(antes, despues)
    if not diferencias:
        print("Sin diferencias de esquema.")
        return 0
    print(f"{len(diferencias)} diferencia(s):")
    print("\n".join(diferencias))
    return 1


if __name__ == "__main__":
    sys.exit(main())
