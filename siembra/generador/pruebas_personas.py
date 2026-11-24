"""Pruebas del libro N1 de personas y organizaciones (tema `personas`): `python3 -I siembra/generador/pruebas_personas.py`."""
from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parents[1] / "siembra" / "libro"))

import pruebas_generador as pg  # noqa: E402  (reutiliza plan, catálogos y esquema)
from nucleo import Ref  # noqa: E402
from personas.multimedia import referencias  # noqa: E402
from personas.organizaciones import ORGANIZACIONES  # noqa: E402
from personas.perfiles import PERFILES  # noqa: E402

ROLES = {"interprete", "cantante", "compositor", "director", "cultor", "docente", "investigador", "luthier", "sonidista", "productor", "gestor"}
SERVICIOS = {"clases", "presentaciones", "grabacion", "composicion", "luteria", "sonido", "gestion", "direccion", "investigacion", "asesoria"}
INSTRUMENTOS = {"cordofonos", "aerofonos", "membranofonos", "idiofonos", "electrofonos", "voz"}
PORTAFOLIO = {"audio", "video", "texto", "imagen", "enlace"}
ORG = {o["clave"]: o for o in ORGANIZACIONES}
PER = {p["clave"]: p for p in PERFILES}


class LibroDePersonas(unittest.TestCase):
    def test_cantidades_y_claves_unicas(self):
        self.assertEqual((len(PERFILES), len(ORGANIZACIONES)), (18, 14))
        self.assertEqual(len(PER), 18)
        self.assertEqual(len(ORG), 14)

    def test_biografias_extensas_y_dentro_de_los_limites_del_api(self):
        for p in PERFILES:
            palabras = len(p["larga"].split())
            self.assertTrue(300 <= palabras <= 600, f"{p['clave']}: {palabras} palabras")
            self.assertLessEqual(len(p["larga"]), 4000, p["clave"])
            self.assertLessEqual(len(p["corta"]), 280, p["clave"])
            self.assertLessEqual(len(p["roles"]), 8)
            self.assertLessEqual(len(p["enlaces"]), 5)
            self.assertLessEqual(len(p["portafolio"]), 8)
            for url, etiqueta in p["enlaces"]:
                self.assertRegex(url, r"^https://[a-z0-9./-]+\.test(/[a-z0-9./-]*)?$|^https://instagram\.com/[a-z0-9.]+\.test$", p["clave"])
                self.assertLessEqual(len(etiqueta), 60)
            for it in p["portafolio"]:
                self.assertIn(it["tipo"], PORTAFOLIO)
                self.assertLessEqual(len(it["titulo"]), 120)
                self.assertLessEqual(len(it["descripcion"]), 300)
                self.assertTrue(re.fullmatch(r"https://[a-z0-9.-]+\.test(/[a-z0-9./-]*)?", it["url"]), it["url"])
                self.assertTrue(1900 <= it["anio"] <= 2027)

    def test_taxonomia_practicas_y_territorios_del_catalogo(self):
        practicas = {x["slug"] for x in pg.CAT["practicas"]}
        for p in PERFILES:
            self.assertTrue(set(p["practicas"]) <= practicas, p["clave"])
            self.assertTrue(set(p["rol"]) <= ROLES and set(p["servicio"]) <= SERVICIOS and set(p["instrumento"]) <= INSTRUMENTOS, p["clave"])
            for t in p["territorio"]:
                self.assertTrue(t in pg.TERR.codigos_muni or t in pg.TERR.codigos_dep, f"{p['clave']}: territorio {t}")
            self.assertIn(p["muni"], pg.TERR.codigos_muni)

    def test_todas_las_regiones_y_los_oficios_pedidos(self):
        deps = {p["muni"][:2] for p in PERFILES}
        self.assertGreaterEqual(len(deps), 14)
        roles = {r for p in PERFILES for r in p["rol"]}
        self.assertTrue({"interprete", "compositor", "director", "productor", "gestor", "investigador", "luthier", "docente"} <= roles)

    def test_relacion_persona_organizacion_es_reciproca(self):
        for p in PERFILES:
            n = p["nombre"]
            for org, rol, cargo, desde in p["orgs"]:
                self.assertIn(org, ORG, p["clave"])
                desc = ORG[org]["desc"]
                self.assertTrue(f"{n[0]} {n[1]}" in desc or f"{n[0].split()[0]} {n[1]}" in desc, f"{org} no menciona a {p['clave']}")
                if rol == "administrador":
                    self.assertEqual(ORG[org]["admin"], p["clave"])
        for o in ORGANIZACIONES:
            self.assertTrue(any(x[0] == o["clave"] and x[1] == "administrador" for x in PER[o["admin"]]["orgs"]), o["clave"])

    def test_estados_variados_e_historiales(self):
        self.assertEqual({o["estado"] for o in ORGANIZACIONES}, {"activa", "inactiva", "pendiente_de_confirmacion", "eliminada"})
        for o in ORGANIZACIONES:
            self.assertTrue(o["cambios"], o["clave"])
            if o["estado"] in ("inactiva", "eliminada"):
                self.assertEqual(o["cambios"][-1][5], o["estado"], o["clave"])
            if o["nit"]:
                self.assertRegex(o["nit"], r"^999\.\d{3}\.\d{3}-\d$")

    def test_festivales_referenciados_usan_el_alias_documentado(self):
        for p in PERFILES:
            for alias, _ in p["festivales"]:
                self.assertRegex(alias, r"^n1\.(festival|mercado)\.[a-z0-9-]+$")
        leeme = (AQUI.parents[1] / "siembra" / "libro" / "personas" / "LEEME.md").read_text(encoding="utf-8")
        usados = {a for p in PERFILES for a, _ in p["festivales"]} | {a for o in ORGANIZACIONES for a, _ in o["festivales"]}
        for a in usados:
            self.assertIn(a, leeme, a)

    def test_multimedia_con_alt(self):
        refs = referencias()
        self.assertEqual(len({r["alias"] for r in refs}), len(refs))
        self.assertTrue(all(r["alt"] for r in refs))
        self.assertEqual(len([r for r in refs if r["alias"].endswith(".foto")]), 18)

    def test_las_organizaciones_solo_piden_logotipo(self):
        # Entidades no tiene módulo en `ArchivosDeRegistro` ni columna de portada: pedir portada o galería dejaría alias sin destino.
        roles = {r["rol"] for r in referencias() if r["alias"].startswith("org.") and r["tipo"] == "imagen"}
        self.assertEqual(roles, {"logo"})


class PlanDePersonas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = pg.plan_base()

    def test_valida_sin_errores(self):
        errores, _ = pg.validar(self.plan, pg.ESQ, pg.CAT, pg.TERR)
        self.assertEqual(errores, [])

    def test_claves_estables_de_nivel_uno(self):
        claves = {f.clave_estable for f in self.plan.filas if f.clave_estable}
        for k in PER:
            self.assertIn(f"n1.persona.{k}", claves)
        for k in ORG:
            self.assertIn(f"n1.organizacion.{k}", claves)

    def test_camila_figura_como_editor_sin_tocar_sus_datos_base(self):
        roles = {(f.valores["IdUsuario"].alias, f.valores["IdEntidad"].alias): f.valores["RolEntidad"] for f in self.plan.filas if f.tabla == "UsuariosEntidades"}
        for org in ("corp-cabildo-sonoro-del-atrato", "escuela-de-luteria-el-roble", "colectivo-tierra-adentro"):
            self.assertEqual(roles[("cuenta.externo-camila", f"org.{org}")], "editor")
        camila = [f for f in self.plan.filas if f.alias == "cuenta.externo-camila"]
        self.assertEqual(len(camila), 1)
        self.assertEqual(camila[0].nivel, 0)

    def test_perfil_enlaza_a_las_organizaciones_visibles_y_no_a_las_eliminadas(self):
        perfil = next(f for f in self.plan.filas if f.alias == "persona.julian-arboleda.perfil")
        self.assertNotIn("colectivo-ensamble-pausa", perfil.valores["OrganizacionesVisiblesJson"].sql)
        self.assertIn("sello-altamira-discos", perfil.valores["OrganizacionesVisiblesJson"].sql)
        self.assertEqual(next(f for f in self.plan.filas if f.alias == "persona.olga-mejia.perfil").valores["Visibilidad"], "solo_simus")

    def test_organizacion_eliminada_sin_equipo_y_pendiente_con_confirmacion_abierta(self):
        equipo = [f for f in self.plan.filas if f.tabla == "UsuariosEntidades" and f.valores["IdEntidad"] == Ref("org.colectivo-ensamble-pausa")]
        self.assertEqual(equipo, [])
        conf = next(f for f in self.plan.filas if f.alias == "org.fund-maloca-sonora.confirmacion")
        self.assertIsNone(conf.valores["FechaUso"])

    def test_sin_etiquetas_visibles_y_correos_simus_test(self):
        for f in self.plan.filas:
            if f.lote.startswith("n1-libro"):
                for v in f.valores.values():
                    if isinstance(v, str):
                        self.assertNotRegex(v.lower(), r"ficticio|demostraci[oó]n|datos de prueba|\bejemplo\b")
            if f.tabla == "Usuarios" and f.lote == "n1-libro-personas":
                self.assertTrue(f.valores["CorreoElectronico"].endswith("@simus.test"))


if __name__ == "__main__":
    unittest.main(verbosity=1)
