"""Pruebas del libro de festivales y mercados de nivel 1 (sin base ni red): `python3 -I siembra/generador/pruebas_festivales.py`."""
from __future__ import annotations

import datetime as dt
import json
import re
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parents[1] / "siembra" / "libro"))

import datos_publicos as dp  # noqa: E402
import festivales as libro  # noqa: E402
import siembra  # noqa: E402
from constructor_festivales import inventario_multimedia  # noqa: E402
from nucleo import Cat, Plan  # noqa: E402
from validaciones import validar  # noqa: E402

CAT = json.loads((AQUI / "catalogos-instantanea.json").read_text(encoding="utf-8"))
ESQ = json.loads((AQUI / "esquema-instantanea.json").read_text(encoding="utf-8"))
HOY = dt.date(2026, 11, 21)
TERR = dp.Territorio(CAT["divipola"])
PLAN = siembra.construir_plan(20261121, HOY, dp.cargar(dp.carpeta_de_datos(None)), CAT)


def filas(tabla, **filtro):
    return [f for f in PLAN.filas if f.tabla == tabla and all(f.valores.get(k) == v for k, v in filtro.items())]


class Libro(unittest.TestCase):
    def test_el_plan_con_el_libro_valida(self):
        self.assertEqual(validar(PLAN, ESQ, CAT, TERR)[0], [])

    def test_conteos_y_trayectorias(self):
        self.assertEqual(len(libro.FESTIVALES), 10)
        self.assertEqual(len(libro.MERCADOS), 4)
        n = sorted(len(f["ediciones"]) for f in libro.FESTIVALES)
        self.assertEqual(n, [0, 1, 1, 2, 3, 5, 5, 6, 7, 14])   # 14, 5-7, 3, 2, 1 y ninguna
        estados = {f["trayectoria"] for f in libro.FESTIVALES + libro.MERCADOS}
        self.assertTrue({"directo", "con_ajustes", "ajustes_vigentes", "revision", "borrador", "rechazo", "archivo"} <= estados)

    def test_textos_largos_y_sin_marcas_visibles(self):
        for f in libro.FESTIVALES + libro.MERCADOS:
            self.assertGreaterEqual(len(f["desc"].split()), 150, f["clave"])
            self.assertLessEqual(len(f["desc"].split()), 400, f["clave"])
            self.assertNotRegex(f["desc"].lower(), r"ficticio|demostraci[oó]n|datos de prueba")
        textos = [e["resumen"] for f in libro.FESTIVALES + libro.MERCADOS for e in f["ediciones"]]
        self.assertEqual(len(textos), len(set(textos)))

    def test_claves_estables_unicas_y_coherentes(self):
        claves = [f.clave_estable for f in PLAN.filas if f.clave_estable]
        self.assertEqual(len(claves), len(set(claves)))
        for f in libro.FESTIVALES:
            self.assertIn(f"n1.festival.{f['clave']}", claves)
            for e in f["ediciones"]:
                self.assertIn(f"n1.edicion.{f['clave']}-{e['anio']}", claves)
        for m in libro.MERCADOS:
            self.assertIn(f"n1.mercado.{m['clave']}", claves)
        for h in libro.HISTORICOS:
            if h["nivel"] == 1:
                self.assertIn(f"n1.historico.{h['clave']}", claves)

    def test_estados_de_edicion_y_fechas(self):
        for f in filas("EdicionesFestival") + filas("EdicionesMercado"):
            est, ini, fin = f.valores.get("Estado"), f.valores.get("FechaInicio"), f.valores.get("FechaFin")
            if est == "realizada" and fin:
                self.assertLessEqual(fin, HOY, f.alias)
            if est in ("programada", "en_preparacion") and ini:
                self.assertGreater(ini, HOY, f.alias)

    def test_hay_programacion_en_la_agenda(self):
        n = 0
        for f in PLAN.filas:
            if f.tabla == "EventosAgenda" and f.lote.startswith("n1-agenda-"):
                n += 1
                self.assertTrue(f.valores["Titulo"] and f.valores["Lugar"])
        self.assertGreaterEqual(n, 25)

    def test_coincidencias_con_historicos_sinteticos(self):
        esc = {h["escenario"] for h in libro.HISTORICOS}
        self.assertTrue({"clara", "parcial", "varios-candidatos", "ninguna"} <= esc)
        varios = [h for h in libro.HISTORICOS if h["escenario"] == "varios-candidatos"]
        self.assertGreaterEqual(len(varios), 3)     # más el festival activo «Festival Cuerdas del Páramo»

    def test_multimedia_referenciada_por_alias_con_alt(self):
        inv = inventario_multimedia(libro)
        self.assertTrue(all(i["alt"] and i["alias"].startswith("img.") for i in inv))
        self.assertEqual(len({i["alias"] for i in inv}), len(inv))

    def test_la_validacion_distingue_valores_de_catalogo(self):
        plan = Plan(semilla=1, hoy=HOY)
        base = {"FestivalId": 1, "Anio": 2025, "EstadoRegistro": "borrador", "EstadoVisibilidad": "borrador"}
        distintas = dict(base, FuenteFinanciacionPrimariaId=Cat("FuentesFinanciacion", "IdFuenteFinanciacion", "Slug", "alcaldia"),
                         FuenteFinanciacionSecundariaId=Cat("FuentesFinanciacion", "IdFuenteFinanciacion", "Slug", "gobernacion"))
        iguales = dict(base, FuenteFinanciacionPrimariaId=Cat("FuentesFinanciacion", "IdFuenteFinanciacion", "Slug", "alcaldia"),
                       FuenteFinanciacionSecundariaId=Cat("FuentesFinanciacion", "IdFuenteFinanciacion", "Slug", "alcaldia"))
        plan.agregar("EdicionesFestival", distintas, alias="a", lote="n1-x", nivel=3)
        plan.agregar("EdicionesFestival", iguales, alias="b", lote="n1-x", nivel=3)
        errores = [e for e in validar(plan, ESQ, CAT, TERR)[0] if "FuentesDistintas" in e]
        self.assertEqual(len(errores), 1)
        self.assertIn("[b]", errores[0])


if __name__ == "__main__":
    unittest.main(verbosity=1)
