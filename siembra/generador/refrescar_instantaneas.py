"""Refresca las instantáneas que el generador usa SIN base de datos (modo `--solo-plan`):

- `esquema-instantanea.json`: columnas, claves, FK y CHECK de las tablas sembrables (de `esquema.py`, que solo LEE).
- `catalogos-instantanea.json`: divisiones territoriales (DIVIPOLA) y códigos de los catálogos que el generador cita por «slug».

    python3 siembra/generador/refrescar_instantaneas.py          # contra la base de SIMUS_LOCAL_* (usa una base de PRUEBA)
    python3 siembra/generador/refrescar_instantaneas.py --comprobar   # compara la instantánea con la base y falla si difieren

Solo lee. Corre tras una migración de esquema: la comparación evita sembrar contra un esquema que ya no es el de la instantánea.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import esquema  # noqa: E402
from mapa_de_campos import TIPOS  # noqa: E402

AQUI = Path(__file__).resolve().parent
ESQUEMA = AQUI / "esquema-instantanea.json"
CATALOGOS = AQUI / "catalogos-instantanea.json"

CATALOGOS_SQL = {
    "divipola": "SELECT CodigoDepartamento AS d, NombreDepartamento AS nd, CodigoMunicipio AS m, NombreMunicipio AS nm FROM dbo.Divipola",
    "practicas": "SELECT Slug AS slug FROM dbo.PracticasMusicales",
    "territorios": "SELECT Slug AS slug FROM dbo.TerritoriosSonoros",
    "periodicidades": "SELECT CodigoPeriodicidad AS slug FROM dbo.Periodicidades",
    "tipologias_festival": "SELECT Slug AS slug FROM dbo.TipologiasFestival",
    "fuentes_financiacion": "SELECT Slug AS slug FROM dbo.FuentesFinanciacion",
    "tipos_organizador": "SELECT Slug AS slug FROM dbo.TiposOrganizador",
    "alcances_mercado": "SELECT Slug AS slug FROM dbo.AlcancesMercado",
    "modalidades_mercado": "SELECT Slug AS slug FROM dbo.ModalidadesMercado",
    "categorias": "SELECT CodigoModulo AS modulo, Slug AS slug FROM dbo.Categorias",
    "estados_contenido": "SELECT CodigoEstado AS slug FROM dbo.EstadosContenido",
    "tipos_documento": "SELECT CodigoTipoDocumento AS slug FROM dbo.TiposDocumento",
}


def sembrables() -> set:
    return {t for _, _, tablas, _ in TIPOS for t in tablas}


def leer() -> tuple:
    inv = esquema.inventario()
    s = sembrables()
    recorte = {k: [f for f in filas if f["tabla"] in s] for k, filas in inv.items()}
    cat = {nombre: esquema.consultar(sql) for nombre, sql in CATALOGOS_SQL.items()}
    return recorte, cat


def main() -> int:
    esquema_nuevo, cat_nuevo = leer()
    if "--comprobar" in sys.argv:
        viejo = json.loads(ESQUEMA.read_text(encoding="utf-8"))
        igual = viejo == json.loads(json.dumps(esquema_nuevo))
        print("esquema:", "igual" if igual else "DIFERENTE (refresca la instantánea)")
        return 0 if igual else 1
    ESQUEMA.write_text(json.dumps(esquema_nuevo, ensure_ascii=False, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    CATALOGOS.write_text(json.dumps(cat_nuevo, ensure_ascii=False, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    print(f"{ESQUEMA.name}: {ESQUEMA.stat().st_size // 1024} KiB; {CATALOGOS.name}: {CATALOGOS.stat().st_size // 1024} KiB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
