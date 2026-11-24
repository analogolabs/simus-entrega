"""Plan de limpieza controlada de la demo: qué se vacía, qué se conserva y en qué orden.

    python3 siembra/generador/plan_de_limpieza.py --resumen            # tablas por categoría, leídas de la base (solo lee)
    python3 siembra/generador/plan_de_limpieza.py --sql SALIDA.sql      # escribe el guion de limpieza (no lo ejecuta)
    python3 siembra/generador/plan_de_limpieza.py --inventario inv.json --resumen   # sin base: con un inventario de `esquema.py`

Lo ejecuta `scripts/demo/siembra-integral.sh limpiar` (respaldo previo con `demo-instantanea.sh`, una sola transacción, verificación posterior).

REGLAS
- SE CONSERVAN: catálogos y tablas de referencia, divisiones territoriales, roles y permisos, categorías, configuración del sitio y menú, el diario de
  migraciones, el acervo editorial y los proyectos transversales de partida.
- CUENTAS: se conservan las cuentas de arranque (webmaster, gestor, externo y participantes de prueba, y el usuario del sistema `@pnmc.local`) y la entidad institucional.
  Las cuentas de la siembra (`@simus.test`) y todo lo demás de Usuarios y Entidades se borra.
- Todo lo demás se vacía, EXCEPTO las filas que una tabla conservada referencia (p. ej. un archivo citado por el acervo editorial).
- ORDEN: de hijos a padres según las FK reales (calculado aquí); las FK a sí mismas se resuelven en una sola sentencia.
- VERIFICACIÓN: los conteos de las tablas conservadas no cambian (salvo las filtradas, que quedan con lo conservado), ninguna FK queda rota y `dbo.DatosDeDemostracion` queda vacía.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mapa_de_campos import CATALOGOS, NO_SEMBRAR, TIPOS  # noqa: E402

# Del acervo editorial y de la configuración: se conservan completos.
EDITORIAL = next(t for tid, _, t, _ in TIPOS if tid == "editorial")
PRESERVAR = (set(CATALOGOS) | set(EDITORIAL) | set(NO_SEMBRAR["Contenido del sitio y configuración"]) | {
    "TitulacionesColectivas", "MediosWeb", "MediosWebHistorial", "SchemaVersions", "Categorias", "Etiquetas"}) - {"ModulosPorCuenta"}
# Tablas con una parte que se conserva: predicado de lo que SE CONSERVA.
FILTROS = {
    "Usuarios": "CorreoElectronico LIKE N'%@pnmc.local' OR CorreoElectronico IN (N'webmaster@simus.test', N'gestor@simus.test', N'externo@simus.test', N'participante.dos@simus.test', N'participante.tres@simus.test')",
    "Entidades": "EsInstitucional = 1",
    "ProcedenciasDeRegistro": "ModuloId = N'catalogo-editorial'",   # la procedencia del acervo editorial viene de las migraciones
    # los proyectos transversales de partida (migraciones); las campañas que añade la siembra se retiran con ella
    "ProyectosTransversales": "Codigo IN (N'celebra-la-musica', N'celebra-la-musica-2025', N'celebra-la-musica-2026')",
}
# Tablas que cuelgan de una cuenta o de una entidad conservada y deben seguir con ella (se borra solo lo de las cuentas/entidades que se van).
ESTRUCTURALES = {"UsuariosRoles", "ModulosPorCuenta", "EntidadesResponsable"}
# Ciclos de FK que se rompen antes de borrar: (tabla, columna que se pone en NULL, tabla padre filtrada). La arista no cuenta para el orden.
CICLOS = [("Archivos", "OrganizacionId", "Entidades")]


PK = {"Entidades": "IdEntidad", "Usuarios": "IdUsuario"}


def cargar(ruta):
    if ruta:
        return json.loads(Path(ruta).read_text(encoding="utf-8"))
    import esquema
    return esquema.inventario()


def clasificar(inv: dict) -> dict:
    tablas = sorted({c["tabla"] for c in inv["columnas"]})
    fks = defaultdict(list)  # hija → [(columna, padre, columna_padre)]
    for f in inv["foraneas"]:
        fks[f["tabla"]].append((f["columna"], f["tabla_referida"], f["columna_referida"]))
    limpiar = [t for t in tablas if t not in PRESERVAR]
    # orden de borrado: una tabla va antes que aquellas a las que referencia (hijos primero)
    ignorar = {(h, p) for h, _, p in CICLOS}
    pendientes = {t: {h for h in limpiar if h != t and any(p == t and (h, p) not in ignorar for _, p, _ in fks[h])} for t in limpiar}  # hijas que aún dependen de t
    orden, resto = [], dict(pendientes)
    while resto:
        listas = sorted(t for t, hijas in resto.items() if not (hijas - set(orden)))
        if not listas:
            listas = [sorted(resto)[0]]  # ciclo (no debería haber más allá de las FK a sí mismas)
        for t in listas:
            orden.append(t)
            resto.pop(t)
    return {"tablas": tablas, "preservar": sorted(set(tablas) & PRESERVAR), "limpiar": orden, "fks": fks}


def condicion(t: str, cl: dict) -> str:
    """WHERE de lo que se BORRA en la tabla t."""
    partes = []
    if t in FILTROS:
        partes.append(f"NOT ({FILTROS[t]})")
    for hija, fks in cl["fks"].items():
        for col, padre, col_padre in fks:
            if padre == t and hija in PRESERVAR:
                partes.append(f"{col_padre} NOT IN (SELECT {col} FROM dbo.{hija} WHERE {col} IS NOT NULL)")
    if t in ESTRUCTURALES:
        for col, padre, col_padre in cl["fks"][t]:
            if padre in FILTROS:
                partes.append(f"{col} IN (SELECT {col_padre} FROM dbo.{padre} WHERE NOT ({FILTROS[padre]}))")
    return " AND ".join(partes) if partes else "1 = 1"


def sql(cl: dict) -> str:
    out = ["/* Limpieza controlada de la demo. Generado por siembra/generador/plan_de_limpieza.py. NO ejecutar sin respaldo previo. */",
           "SET NOCOUNT ON;", "SET XACT_ABORT ON;", "BEGIN TRANSACTION;",
           "CREATE TABLE #antes (Tabla sysname PRIMARY KEY, Filas bigint NOT NULL);"]
    for t in cl["preservar"]:
        out.append(f"INSERT INTO #antes SELECT N'{t}', COUNT_BIG(*) FROM dbo.{t};")
    for hija, col, padre in CICLOS:
        out.append(f"UPDATE dbo.{hija} SET {col} = NULL WHERE {col} IN (SELECT {PK[padre]} FROM dbo.{padre} WHERE NOT ({FILTROS[padre]}));  -- rompe el ciclo {hija} ↔ {padre}")
    for t in cl["limpiar"]:
        out.append(f"DELETE FROM dbo.{t} WHERE {condicion(t, cl)};  -- {t}")
    out += ["IF OBJECT_ID(N'dbo.DatosDeDemostracion') IS NOT NULL DELETE FROM dbo.DatosDeDemostracion;",
            "-- verificación 1: los conteos de las tablas conservadas no cambian",
            "DECLARE @cambios nvarchar(max) = N'';"]
    for t in cl["preservar"]:
        out.append(f"IF (SELECT COUNT_BIG(*) FROM dbo.{t}) <> (SELECT Filas FROM #antes WHERE Tabla = N'{t}') SET @cambios += N'{t} ';")
    out += ["IF @cambios <> N'' THROW 52991, N'La limpieza cambió tablas conservadas; se revierte.', 1;",
            "-- verificación 2: ninguna restricción rota",
            "CREATE TABLE #rotas (Tabla nvarchar(256), Restriccion nvarchar(256), Donde nvarchar(max));",
            "INSERT INTO #rotas EXEC (N'DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS, NO_INFOMSGS');",
            "IF EXISTS (SELECT 1 FROM #rotas) THROW 52992, N'Quedaron restricciones rotas; se revierte.', 1;",
            "COMMIT TRANSACTION;", "SELECT N'limpieza aplicada: ' + CAST((SELECT COUNT(*) FROM sys.tables) AS nvarchar(10)) + N' tablas revisadas';"]
    return "\n".join(out) + "\n"


def resumen(cl: dict) -> str:
    l = [f"Tablas en la base: {len(cl['tablas'])}", f"Se CONSERVAN ({len(cl['preservar'])}): " + ", ".join(cl["preservar"]),
         f"Se VACÍAN ({len(cl['limpiar'])}), en este orden (hijos primero):"]
    for i, t in enumerate(cl["limpiar"], 1):
        extra = "" if condicion(t, cl) == "1 = 1" else f"   [solo donde {condicion(t, cl)}]"
        l.append(f"  {i:3d}. {t}{extra}")
    return "\n".join(l)


def main(argv) -> int:
    args = list(argv)
    inv_ruta = args[args.index("--inventario") + 1] if "--inventario" in args else None
    cl = clasificar(cargar(inv_ruta))
    if "--sql" in args:
        destino = Path(args[args.index("--sql") + 1])
        destino.write_text(sql(cl), encoding="utf-8")
        print(f"[limpieza] guion escrito en {destino} ({len(cl['limpiar'])} tablas a vaciar, {len(cl['preservar'])} conservadas)")
    if "--resumen" in args or "--sql" not in args:
        print(resumen(cl))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
