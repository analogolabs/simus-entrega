"""Pruebas del motor masivo (sin base de datos ni red): `python3 -I siembra/libro/masivo/pruebas_masivo.py`."""
from __future__ import annotations

import datetime as dt
import json
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[2]
sys.path.insert(0, str(RAIZ / "siembra" / "generador"))
sys.path.insert(0, str(RAIZ / "siembra" / "libro"))

import datos_publicos as dp  # noqa: E402
import siembra  # noqa: E402
from masivo import texto as T  # noqa: E402
from masivo import verificador  # noqa: E402
from nucleo import sql_de_lote  # noqa: E402
from validaciones import validar  # noqa: E402

CAT = json.loads((RAIZ / "siembra" / "generador" / "catalogos-instantanea.json").read_text(encoding="utf-8"))
ESQ = json.loads((RAIZ / "siembra" / "generador" / "esquema-instantanea.json").read_text(encoding="utf-8"))
DATOS = dp.cargar(dp.carpeta_de_datos(None))
HOY = dt.date(2026, 11, 21)
TERR = dp.Territorio(CAT["divipola"])
_CACHE: dict = {}


def plan(escala=1.0, semilla=20261121):
    k = (escala, semilla)
    if k not in _CACHE:
        _CACHE[k] = siembra.construir_plan(semilla, HOY, DATOS, CAT, masivo=escala)
    return _CACHE[k]


class Motor(unittest.TestCase):
    def test_carga_completa_pasa_el_verificador(self):
        r = verificador.verificar(plan(1.0), ESQ, CAT, TERR)
        self.assertEqual(r["fallas"], [], r["fallas"])
        n = r["conteo"]["registros_por_nivel"]
        self.assertTrue(150 <= n[2] <= 250, n)
        self.assertTrue(450 <= n[3] <= 650, n)
        self.assertEqual(r["territorio"]["departamentos_cubiertos"], "33/33")
        self.assertEqual(r["practicas"]["familias_presentes"], "16/16")

    def test_muestra_de_300_registros(self):
        r = verificador.verificar(plan(0.38), ESQ, CAT, TERR)
        self.assertEqual(r["fallas"], [], r["fallas"])
        self.assertTrue(250 <= sum(r["conteo"]["registros_por_nivel"].values()) <= 350)

    def test_determinista_e_idempotente(self):
        a = siembra.construir_plan(20261121, HOY, DATOS, CAT, masivo=0.3)
        b = siembra.construir_plan(20261121, HOY, DATOS, CAT, masivo=0.3)
        self.assertEqual(siembra.huella(a), siembra.huella(b))
        sql = "\n".join(sql_de_lote(a, l) for l in a.lotes())
        n_filas = len(a.filas)
        self.assertGreaterEqual(sql.count("IF NOT EXISTS"), n_filas)   # cada fila lleva su guarda: reaplicar no duplica
        self.assertNotEqual(siembra.huella(a), siembra.huella(siembra.construir_plan(7, HOY, DATOS, CAT, masivo=0.3)))

    def test_otra_semilla_sigue_siendo_valida(self):
        p = plan(1.0, 99)
        self.assertEqual(validar(p, ESQ, CAT, TERR)[0], [])
        r = verificador.verificar(p, ESQ, CAT, TERR)
        self.assertEqual(r["fallas"], [], r["fallas"])

    def test_prefijos_de_alias_y_lotes(self):
        p = plan(1.0)
        mios = [f for f in p.filas if "-masivo-" in f.lote]
        self.assertTrue(mios)
        for f in mios:
            self.assertRegex(f.lote, r"^n[23]-masivo-[a-z]+$")
            self.assertEqual(f.nivel, int(f.lote[1]))
            if f.alias:
                self.assertTrue(".n2." in f.alias or ".n3." in f.alias, f.alias)
                self.assertLessEqual(len(f.alias), 120)
            self.assertEqual(f.procedencia, "sintetico")
            self.assertIsNone(f.clave_estable)            # claves estables solo en N0/N1
        base = [f for f in p.filas if "-masivo-" not in f.lote and f.alias]
        self.assertFalse([f.alias for f in base if ".n2." in f.alias or ".n3." in f.alias])

    def test_el_motor_apagado_no_cambia_el_plan_base(self):
        sin = siembra.construir_plan(20261121, HOY, DATOS, CAT)
        con = plan(1.0)
        # las imágenes del pool para N2/N3 (lote n3-multimedia y filas de los lotes del motor) las añade `multimedia_integral`, no el motor
        base_con = [f for f in con.filas if "-masivo-" not in f.lote and f.lote != "n3-multimedia"]
        base_sin = [f for f in sin.filas if f.lote != "n3-multimedia"]
        self.assertEqual(len(base_sin), len(base_con))
        self.assertEqual(sorted(f.tabla for f in base_sin), sorted(f.tabla for f in base_con))

    def test_el_banco_rechaza_textos_casi_iguales(self):
        b = T.Banco(umbral=0.5)
        self.assertEqual(b.producir("c", lambda: "una frase larga con bastantes palabras distintas para comparar"), "una frase larga con bastantes palabras distintas para comparar")
        salidas = iter(["una frase larga con bastantes palabras distintas para comparar", "otro texto totalmente diferente sobre festivales de gaita en la costa"])
        self.assertTrue(b.producir("c", lambda: next(salidas)).startswith("otro texto"))

    def test_sin_etiquetas_visibles_ni_correos_reales(self):
        malas = ("ficticio", "demostración", "demostracion", "ejemplo", "lorem")
        for f in plan(1.0).filas:
            if "-masivo-" not in f.lote:
                continue
            for k, v in f.valores.items():
                if isinstance(v, str) and k not in ("Slug", "HashContrasena", "MotivoModeracion"):
                    self.assertFalse(any(m in v.lower() for m in malas), (f.alias, k, v[:80]))


if __name__ == "__main__":
    unittest.main(verbosity=1)
