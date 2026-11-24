#!/usr/bin/env python3
"""Pruebas de las fichas breves de catálogos (sin base): python3 -I siembra/generador/pruebas_fichas_catalogos.py"""
from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parents[0] / "libro" / "catalogos"))

import aplicar_fichas_catalogos as aplicar  # noqa: E402
from fichas_catalogos import PRACTICAS, TERRITORIOS  # noqa: E402

SEMILLA = AQUI.parents[1] / "simus-database" / "seed" / "V20260519_01__maestras_estaticas_seed.sql"


class PruebasFichasDeCatalogos(unittest.TestCase):
    def test_cada_practica_del_catalogo_tiene_ficha_y_ninguna_sobra(self):
        slugs = set(re.findall(r"\(N'[^']+', N'([a-z0-9-]+)', NULL, \d+\)", SEMILLA.read_text(encoding="utf-8")))
        self.assertTrue(set(PRACTICAS) <= slugs)
        self.assertTrue(set(TERRITORIOS) <= slugs)
        self.assertEqual(len(PRACTICAS), 16)

    def test_textos_breves_sin_cifras_ni_comillas_sueltas(self):
        for slug, texto in {**PRACTICAS, **TERRITORIOS}.items():
            self.assertLessEqual(len(texto), 800, slug)
            self.assertFalse(re.search(r"\d", texto), f"{slug}: sin cifras que haya que documentar")
            self.assertTrue(texto.endswith("."), slug)

    def test_el_sql_solo_completa_fichas_vacias_y_nunca_borra_ni_inserta(self):
        s = aplicar.sql()
        self.assertEqual(s.count("WHERE f.DefinicionBreve IS NULL"), 2)
        self.assertNotRegex(s.upper(), r"\b(DELETE|DROP|TRUNCATE|INSERT)\b")
        self.assertIn("f.EsPreliminar = 1", s)

    def test_escapa_comillas(self):
        self.assertEqual(aplicar.literal("D'Arco"), "N'D''Arco'")


if __name__ == "__main__":
    unittest.main()
