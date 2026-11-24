"""Pruebas de la INTEGRACIÓN de los temas de la siembra (reconciliación de alias, multimedia, datos públicos completos):
`python3 -I siembra/generador/pruebas_integracion.py` (sin base de datos ni red; los binarios del pool no hacen falta)."""
from __future__ import annotations

import datetime as dt
import os
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
os.environ.setdefault("SIMUS_SIEMBRA_ASSETS_FALTANTES", "ignorar")
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parents[1] / "siembra" / "libro"))

import datos_publicos as dp  # noqa: E402
import reconciliar_libros  # noqa: E402
import siembra  # noqa: E402
import pruebas_generador as pg  # noqa: E402
from nucleo import Ref  # noqa: E402
from validaciones import validar  # noqa: E402

_PLAN = {}


def plan(masivo=0.0):
    if masivo not in _PLAN:
        _PLAN[masivo] = siembra.construir_plan(20261121, pg.HOY, pg.DATOS, pg.CAT, 6, True, masivo)
    return _PLAN[masivo]


def por_alias(p):
    return {f.alias: f for f in p.filas if f.alias}


class Reconciliacion(unittest.TestCase):
    def test_es_idempotente(self):
        import festivales as L
        reconciliar_libros.aplicar()
        antes = ([o["clave"] for o in L.ORGANIZACIONES], [tuple(x.get("aliadas_org", [])) for x in L.FESTIVALES])
        reconciliar_libros.aplicar()
        despues = ([o["clave"] for o in L.ORGANIZACIONES], [tuple(x.get("aliadas_org", [])) for x in L.FESTIVALES])
        self.assertEqual(antes[0], despues[0])
        self.assertEqual(antes[1], despues[1])

    def test_las_organizadoras_son_las_del_libro_de_personas(self):
        p = plan()
        f = por_alias(p)
        for clave, (org, director) in reconciliar_libros.ORGANIZADORAS.items():
            fila = f.get(f"festival.{clave}") or f.get(f"mercado.{clave}")
            self.assertIsNotNone(fila, clave)
            self.assertEqual(fila.valores["OrganizacionPrincipalId"], Ref(f"org.{org}"))
        baudo = f["festival.festival-de-arrullos-y-alabaos-del-baudo"].valores
        self.assertEqual(baudo["Director"], "Nubia Estela Palacios Mosquera")
        self.assertEqual(baudo["Organizador"], "Corporación Cabildo Sonoro del Atrato")
        # las entidades que el libro de festivales había inventado para esos procesos ya no existen (no hay dos «Nubia» en el Baudó)
        self.assertNotIn("org.corp-alabao-y-bahia", f)
        self.assertNotIn("org.agencia-golfo-en-vivo", f)

    def test_cada_vinculo_de_las_fichas_de_personas_apunta_a_un_proceso_que_existe(self):
        import festivales as L
        from personas.organizaciones import ORGANIZACIONES
        from personas.perfiles import PERFILES
        f = por_alias(plan())
        existentes = {f"n1.festival.{x['clave']}" for x in L.FESTIVALES} | {f"n1.mercado.{x['clave']}" for x in L.MERCADOS}
        vinculos = [v for x in ORGANIZACIONES + PERFILES for v in x["festivales"]]
        self.assertGreaterEqual(len(vinculos), 25)
        for alias, _rol in vinculos:
            self.assertIn(alias, existentes)
            self.assertIn(alias.replace("n1.", "", 1), f)

    def test_las_aliadas_son_relaciones_reales_en_ambos_sentidos(self):
        import festivales as L
        from personas.organizaciones import ORGANIZACIONES
        p = plan()
        filas = [x for x in p.filas if x.tabla == "EntidadesAliadasDeRegistro" and x.valores.get("EntidadId") is not None]
        self.assertGreaterEqual(len(filas), 10)
        entre = {(x.valores["RegistroId"].alias.split(".edicion.")[0], x.valores["EntidadId"].alias) for x in filas}
        for org in ORGANIZACIONES:
            for alias, rol in org["festivales"]:
                if rol == "aliada":
                    self.assertIn((alias.replace("n1.", "", 1), f"org.{org['clave']}"), entre)
                    self.assertIn("Alianza con", " ".join(org["proyectos"]))


class Fechas(unittest.TestCase):
    def test_las_ediciones_de_las_noticias_tienen_las_fechas_que_las_noticias_dan_por_ciertas(self):
        f = por_alias(plan())
        ed = f["festival.encuentro-de-chirimia-del-san-juan.edicion.2025"].valores
        self.assertEqual((ed["FechaInicio"], ed["FechaFin"]), (dt.date(2025, 7, 17), dt.date(2025, 7, 19)))
        ed = f["mercado.rueda-de-negocios-caribe-sonoro.edicion.2025"].valores
        self.assertEqual((ed["FechaInicio"], ed["FechaFin"]), (dt.date(2025, 11, 21), dt.date(2025, 11, 22)))
        ed = f["festival.gran-rueda-de-bullerengue.edicion.2025"].valores
        self.assertEqual((ed["FechaInicio"], ed["FechaFin"]), (dt.date(2025, 4, 3), dt.date(2025, 4, 5)))

    def test_anio_como_texto_no_rompe_los_datos_publicos(self):
        datos = {"festivales": [{"nombre": "X", "ediciones_historicas": [{"anio": "2019"}, {"anio": 2018}, {"anio": "2020-2021"}]}], "mercados": []}
        for item in datos["festivales"]:
            dp.normalizar_anios(item)
        self.assertEqual([e["anio"] for e in datos["festivales"][0]["ediciones_historicas"]], [2019, 2018, "2020-2021"])


class Multimedia(unittest.TestCase):
    def test_todo_alias_citado_por_los_libros_tiene_asset_en_el_manifiesto(self):
        sys.path.insert(0, str(AQUI.parents[1] / "siembra" / "multimedia"))
        import construir
        import pool as P
        faltan = [a for a in construir.aliases_en_libros() if not P.Pool(autogenerar=False).existe(a) and ".pool." not in a]
        self.assertEqual(faltan, [])

    def test_la_foto_de_perfil_solo_con_autorizacion_perfil_publico_vigente(self):
        p = plan(1.0)
        f = por_alias(p)
        con_foto = [x for x in p.filas if x.tabla == "PerfilesPublicos" and x.valores.get("ArchivoFotoId") is not None]
        self.assertGreater(len(con_foto), 150)
        for x in con_foto:
            aut = f.get(x.alias[: -len(".perfil")] + ".autorizacion.perfil_publico")
            self.assertIsNotNone(aut, x.alias)
            self.assertIsNone(aut.valores.get("FechaRevocacion"))
            self.assertEqual(x.valores["Visibilidad"], "publico")
            self.assertIsNot(f[x.alias[: -len(".perfil")]].valores.get("Activo"), False)   # la API no sirve la foto de una cuenta inactiva

    def test_el_plan_completo_valida_sin_errores(self):
        errores, _ = validar(plan(1.0), pg.ESQ, pg.CAT, pg.TERR)
        self.assertEqual(errores, [])

    def test_noticias_y_eventos_publicados_llevan_imagen_y_vinculo(self):
        p = plan()
        noticias = [x for x in p.filas if x.tabla == "Noticias" and x.valores.get("Estado") == "publicado"]
        self.assertGreaterEqual(len(noticias), 20)
        self.assertTrue(all(n.valores.get("ImagenRuta") is not None and n.valores.get("ImagenAlternativa") for n in noticias))
        self.assertGreaterEqual(sum(1 for x in p.filas if x.tabla == "NoticiasArchivos"), 30)


if __name__ == "__main__":
    unittest.main()
