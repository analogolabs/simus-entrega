#!/usr/bin/env python3
"""Pruebas del libro de la Galería (sin base): python3 -I siembra/generador/pruebas_galeria.py"""
from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parents[1] / "siembra" / "libro"))
sys.path.insert(0, str(AQUI.parents[1] / "siembra" / "multimedia"))

import galeria  # noqa: E402


class PruebasGaleria(unittest.TestCase):
    def test_titulos_normalizados(self):
        self.assertEqual(galeria.titulo_normalizado("VOCES Y SABERES: Carlos Delgado"), "Voces y Saberes: Carlos Delgado")
        self.assertEqual(galeria.titulo_normalizado("Voces y saberes 2024- Mario Gamboa"), "Voces y Saberes: Mario Gamboa")
        self.assertEqual(galeria.titulo_normalizado("Voces y saberes: Lourdes Acosta"), "Voces y Saberes: Lourdes Acosta")
        self.assertEqual(galeria.titulo_normalizado("Alabaos, Gualíes y Levantamiento de Tumbas"), "Alabaos, Gualíes y Levantamiento de Tumbas")

    def test_los_dos_albumes_de_voces_y_saberes(self):
        por_slug = {a["slug"]: a for a in galeria.albumes()}
        ids = lambda a: [x["id"] for t, x in a["items"] if t == "video"]  # noqa: E731
        self.assertEqual(ids(por_slug["voces-y-saberes"]), galeria.VOCES_RECIENTES)
        self.assertEqual(ids(por_slug["voces-y-saberes-archivo"]), galeria.VOCES_ARCHIVO)
        self.assertEqual(por_slug["voces-y-saberes"]["lista"], galeria.LISTA_VOCES)

    def test_tipo_coherente_con_los_items_y_ids_validos(self):
        tipos = set()
        for a in galeria.albumes():
            clases = {t for t, _ in a["items"]}
            tipos.add(a["tipo"])
            if a["tipo"] == "fotos":
                self.assertEqual(clases, {"foto"})
            elif a["tipo"] == "videos":
                self.assertEqual(clases, {"video"})
            else:
                self.assertEqual(clases, {"foto", "video"})
            for t, x in a["items"]:
                if t == "video":
                    self.assertRegex(x["id"], r"^[A-Za-z0-9_-]{11}$")
                    self.assertTrue(x["titulo"])
        self.assertEqual(tipos, {"fotos", "videos", "mixto"})

    def test_no_se_repite_un_video_ni_una_foto_en_un_album(self):
        for a in galeria.albumes():
            claves = [x["id"] if t == "video" else x for t, x in a["items"]]
            self.assertEqual(len(claves), len(set(claves)), a["slug"])

    def test_slugs_validos_y_unicos(self):
        slugs = [a["slug"] for a in galeria.albumes()]
        self.assertEqual(len(slugs), len(set(slugs)))
        for s in slugs:
            self.assertRegex(s, r"^[a-z0-9]+(-[a-z0-9]+)*$")
            self.assertLessEqual(len(f"n1.galeria.{s}"), 80)

    def test_descripciones_largas_llevan_resumen_y_detalle(self):
        for a in galeria.albumes():
            for t, x in a["items"]:
                if t != "video":
                    continue
                self.assertLessEqual(len(x["descripcion"]), galeria.LIMITE_RESUMEN, x["id"])
                if x["detalle"]:
                    self.assertGreater(len(x["detalle"]), len(x["descripcion"]))
        _, detalle = galeria.descripcion_y_detalle("t7AeTVIfm1Y", "x" * 500)
        self.assertEqual(detalle, "x" * 500)
        with self.assertRaises(ValueError):
            galeria.descripcion_y_detalle("AAAAAAAAAAA", "x" * 500)

    def test_texto_limpio_sin_errata_ni_espacios_raros(self):
        self.assertEqual(galeria.limpio("Beatriz\u202fCastaño  Uribe"), "Beatriz Castaño Uribe")
        self.assertIn("desde el Sumapaz", galeria.limpio("tradiciones musicales de desde el Sumapaz."))
        self.assertNotIn("de desde", galeria.limpio("de desde el Sumapaz"))

    def test_hermanos_pulido_es_el_cuarto_de_voces_y_saberes(self):
        a = {a["slug"]: a for a in galeria.albumes()}["voces-y-saberes"]
        self.assertEqual([x["titulo"] for _, x in a["items"]][3], "Voces y Saberes: Hermanos Pulido")

    def test_sin_album_tiene_fotos_y_videos_y_no_repite_los_de_los_albumes(self):
        sueltos = galeria.sueltos()
        self.assertEqual({t for t, _ in sueltos}, {"foto", "video"})
        usados = {x for a in galeria.albumes() for t, x in a["items"] if t == "foto"}
        self.assertFalse(usados & {x for t, x in sueltos if t == "foto"})

    def test_cada_video_tiene_miniatura_propia_con_alias_valido(self):
        videos = galeria.videos_todos()
        self.assertGreaterEqual(len(videos), 12)
        alias = [galeria.alias_de_miniatura(v["id"]) for v in videos]
        self.assertEqual(len(alias), len(set(alias)))
        for a in alias:
            self.assertRegex(a, r"^img\.galeria\.miniatura\.[0-9a-f]{10}$")

    def test_ajustes_sql_solo_actualiza_y_no_borra(self):
        sql = galeria.sql_de_ajustes()
        self.assertIn("MiniaturaArchivoId", sql)
        self.assertNotIn("DELETE", sql.upper())
        self.assertNotIn("DROP", sql.upper())


if __name__ == "__main__":
    unittest.main()
