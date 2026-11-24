"""Núcleo del generador de siembra: filas simbólicas, referencias por alias y emisión de SQL idempotente.

Una `Fila` es una inserción simbólica en una tabla de negocio. Sus referencias a otras filas del plan son `Ref(alias)`, que el SQL
resuelve en el momento por `dbo.DatosDeDemostracion.Alias`: así el plan no conoce identificadores de la base (que cambian entre
entornos) y puede reaplicarse sin duplicar (idempotente por alias).
"""
from __future__ import annotations

import datetime as dt
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

PROCEDENCIAS = ("publico", "sintetico", "hibrido")


@dataclass(frozen=True)
class Ref:
    """Clave de otra fila del plan (por alias). `texto=True` la entrega como cadena (columnas `RegistroId`)."""
    alias: str
    texto: bool = False


@dataclass(frozen=True)
class Cat:
    """Clave de una fila de catálogo, buscada por un valor estable (slug o código) y no por su identificador."""
    tabla: str
    columna_id: str
    columna_clave: str
    clave: str
    filtro: str = ""   # condición adicional fija (p. ej. «CodigoModulo = N'agenda'» cuando el slug se repite entre módulos)


@dataclass(frozen=True)
class Raw:
    """Expresión SQL literal (solo para valores generados por el propio kit, nunca texto de usuario)."""
    sql: str


@dataclass(frozen=True)
class Blob:
    """Contenido binario de un archivo del pool de multimedia (fuera de git). Se lee al emitir el SQL, no al construir el plan."""
    ruta: str

    def leer(self) -> bytes:
        p = Path(self.ruta)
        if not p.exists():
            if os.environ.get("SIMUS_SIEMBRA_ASSETS_FALTANTES") == "ignorar":  # solo para validar planes en máquinas sin pool
                return b""
            raise FileNotFoundError(f"Falta el binario {p}. Construye el pool: python3 siembra/multimedia/construir.py base (o SIMUS_SIEMBRA_ASSETS_FALTANTES=ignorar para solo validar)")
        return p.read_bytes()


# Entidades y usuarios que ya existen en toda base: se citan por consulta, no por alias.
INSTITUCIONAL = Raw("(SELECT TOP 1 IdEntidad FROM dbo.Entidades WHERE EsInstitucional = 1 ORDER BY IdEntidad)")
USUARIO_SISTEMA = Raw("(SELECT TOP 1 IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'sistema@pnmc.local')")


@dataclass
class Fila:
    tabla: str
    valores: dict
    alias: Optional[str] = None            # None solo en pivotes sin identidad (idempotentes por sus valores)
    lote: str = ""
    procedencia: str = "sintetico"
    fuente: Optional[str] = None
    nivel: int = 3
    clave_estable: Optional[str] = None    # solo niveles 0 y 1
    id_expr: Optional[Any] = None          # tablas sin identidad: de dónde sale el IdRegistro (por omisión SCOPE_IDENTITY())
    orden: int = 0
    solo_marca: bool = False               # el registro de negocio YA existe (p. ej. el acervo editorial): solo se anota en DatosDeDemostracion; exige id_expr


@dataclass
class Plan:
    semilla: int
    hoy: dt.date
    filas: list = field(default_factory=list)
    _aliases: set = field(default_factory=set)

    def agregar(self, tabla: str, valores: dict, alias: Optional[str] = None, **meta) -> Fila:
        f = Fila(tabla=tabla, valores=valores, alias=alias, orden=len(self.filas), **meta)
        self.filas.append(f)
        return f

    def lotes(self) -> list:
        vistos: list = []
        for f in self.filas:
            if f.lote not in vistos:
                vistos.append(f.lote)
        return vistos

    def resumen(self) -> dict:
        por_tabla: dict = {}
        por_lote: dict = {}
        for f in self.filas:
            por_tabla[f.tabla] = por_tabla.get(f.tabla, 0) + 1
            clave = f"{f.lote} (nivel {f.nivel}, {f.procedencia})"
            por_lote[clave] = por_lote.get(clave, 0) + 1
        return {"filas": len(self.filas), "por_tabla": por_tabla, "por_lote": por_lote}


# --------------------------------------------------------------------------------------------------------------------
# Emisión de SQL
# --------------------------------------------------------------------------------------------------------------------
def q(texto: str) -> str:
    """Literal Unicode de SQL Server con comillas dobladas. Los saltos de línea viajan como CHAR(10) para que el guion sea portable."""
    partes = str(texto).replace("'", "''").replace("\r", "").split("\n")
    return " + NCHAR(10) + ".join(f"N'{p}'" for p in partes)


def valor_sql(v: Any) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, dt.datetime):
        return f"'{v.strftime('%Y-%m-%dT%H:%M:%S')}'"
    if isinstance(v, dt.date):
        return f"'{v.isoformat()}'"
    if isinstance(v, dt.time):
        return f"'{v.strftime('%H:%M:%S')}'"
    if isinstance(v, Ref):
        base = f"(SELECT IdRegistro FROM dbo.DatosDeDemostracion WHERE Alias = N'{v.alias}')"
        return base if v.texto else f"CAST({base} AS bigint)"
    if isinstance(v, Cat):
        extra = f" AND {v.filtro}" if v.filtro else ""
        return f"(SELECT {v.columna_id} FROM dbo.{v.tabla} WHERE {v.columna_clave} = N'{v.clave}'{extra})"
    if isinstance(v, Raw):
        return v.sql
    if isinstance(v, Blob):
        datos = v.leer()
        return "0x" + datos.hex() if datos else "NULL"
    if isinstance(v, (dict, list)):
        return q(json.dumps(v, ensure_ascii=False, separators=(",", ":")))
    if isinstance(v, bytes):
        return "0x" + v.hex()
    return q(str(v))


def sql_de_fila(f: Fila, semilla: int) -> str:
    if f.solo_marca:  # marca de un registro preexistente: no inserta nada de negocio y no hace nada si el registro no está en la base
        fuente_m = "NULL" if f.fuente is None else q(f.fuente)
        clave_m = "NULL" if f.clave_estable is None else q(f.clave_estable)
        id_m = valor_sql(f.id_expr)
        return (f"IF NOT EXISTS (SELECT 1 FROM dbo.DatosDeDemostracion WHERE Alias = {q(f.alias)}) AND {id_m} IS NOT NULL\nBEGIN\n    INSERT INTO dbo.DatosDeDemostracion "
                "(Tabla, IdRegistro, Alias, Lote, Procedencia, Fuente, Nivel, ClaveEstable, Semilla) VALUES "
                f"(N'{f.tabla}', CAST({id_m} AS nvarchar(120)), {q(f.alias)}, {q(f.lote)}, N'{f.procedencia}', {fuente_m}, {f.nivel}, {clave_m}, {semilla});\nEND;")
    cols = ", ".join(f.valores)
    vals = ", ".join(valor_sql(v) for v in f.valores.values())
    insert = f"INSERT INTO dbo.{f.tabla} ({cols}) VALUES ({vals});"
    if f.alias is None:  # pivote: idempotente por el contenido de sus columnas
        pred = " AND ".join(
            f"{c} IS NULL" if v is None else f"{c} = {valor_sql(v)}" for c, v in f.valores.items())
        return f"IF NOT EXISTS (SELECT 1 FROM dbo.{f.tabla} WHERE {pred})\n    {insert}"
    id_sql = "CAST(SCOPE_IDENTITY() AS nvarchar(120))" if f.id_expr is None else f"CAST({valor_sql(f.id_expr)} AS nvarchar(120))"
    fuente = "NULL" if f.fuente is None else q(f.fuente)
    clave = "NULL" if f.clave_estable is None else q(f.clave_estable)
    registro = (
        "INSERT INTO dbo.DatosDeDemostracion (Tabla, IdRegistro, Alias, Lote, Procedencia, Fuente, Nivel, ClaveEstable, Semilla) VALUES "
        f"(N'{f.tabla}', {id_sql}, {q(f.alias)}, {q(f.lote)}, N'{f.procedencia}', {fuente}, {f.nivel}, {clave}, {semilla});"
    )
    return (f"IF NOT EXISTS (SELECT 1 FROM dbo.DatosDeDemostracion WHERE Alias = {q(f.alias)})\nBEGIN\n    {insert}\n    {registro}\nEND;")


def sql_de_lote(plan: Plan, lote: str) -> str:
    filas = [f for f in plan.filas if f.lote == lote]
    cab = (
        f"/* Siembra de demostración · lote «{lote}» · semilla {plan.semilla} · {len(filas)} filas. Generado por siembra/generador/siembra.py. */\n"
        "SET NOCOUNT ON;\nSET XACT_ABORT ON;\nBEGIN TRANSACTION;\n"
        "IF OBJECT_ID(N'dbo.DatosDeDemostracion') IS NULL THROW 52990, N'Falta dbo.DatosDeDemostracion: ejecuta scripts/demo/siembra-integral.sh preparar.', 1;\n"
    )
    cuerpo = "\n".join(sql_de_fila(f, plan.semilla) for f in filas)
    return cab + cuerpo + "\nCOMMIT TRANSACTION;\n"


def escribir_plan(plan: Plan, carpeta: Path) -> list:
    carpeta.mkdir(parents=True, exist_ok=True)
    rutas = []
    for i, lote in enumerate(plan.lotes(), 1):
        ruta = carpeta / f"{i:02d}-{lote}.sql"
        ruta.write_text(sql_de_lote(plan, lote), encoding="utf-8")
        rutas.append(ruta)
    return rutas
