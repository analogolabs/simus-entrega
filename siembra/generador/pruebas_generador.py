"""Pruebas livianas del generador de siembra (sin base de datos ni red): `python3 -I siembra/generador/pruebas_generador.py`."""
from __future__ import annotations

import copy
import datetime as dt
import json
import os
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
os.environ.setdefault("SIMUS_SIEMBRA_ASSETS_FALTANTES", "ignorar")   # las pruebas no necesitan los binarios del pool (están fuera de git)
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parents[1] / "siembra" / "libro"))

import datos_publicos as dp  # noqa: E402
import siembra  # noqa: E402
from hash_identidad import hash_identidad, verificar  # noqa: E402
from nucleo import Plan, Ref, sql_de_lote  # noqa: E402
from validaciones import validar  # noqa: E402

CAT = json.loads((AQUI / "catalogos-instantanea.json").read_text(encoding="utf-8"))
ESQ = json.loads((AQUI / "esquema-instantanea.json").read_text(encoding="utf-8"))
DATOS = dp.cargar(dp.carpeta_de_datos(None))
HOY = dt.date(2026, 11, 21)
TERR = dp.Territorio(CAT["divipola"])


def plan_base(semilla=20261121):
    return siembra.construir_plan(semilla, HOY, DATOS, CAT)


def lotes_sql(plan):
    return "\n".join(sql_de_lote(plan, l) for l in plan.lotes())


class Determinismo(unittest.TestCase):
    def test_mismo_plan_byte_a_byte(self):
        self.assertEqual(lotes_sql(plan_base()), lotes_sql(plan_base()))
        self.assertEqual(siembra.huella(plan_base()), siembra.huella(plan_base()))

    def test_otra_semilla_cambia_el_plan_pero_sigue_siendo_valido(self):
        otro = plan_base(7)
        self.assertNotEqual(siembra.huella(plan_base()), siembra.huella(otro))
        self.assertEqual(validar(otro, ESQ, CAT, TERR)[0], [])


class PlanBase(unittest.TestCase):
    def test_el_plan_de_muestra_valida_sin_errores(self):
        errores, _ = validar(plan_base(), ESQ, CAT, TERR)
        self.assertEqual(errores, [])

    def test_cubre_los_tipos_y_estados(self):
        plan = plan_base()
        tablas = {f.tabla for f in plan.filas}
        for t in ("Usuarios", "PerfilesPublicos", "Entidades", "Festivales", "EdicionesFestival", "Mercados", "EdicionesMercado", "Redes", "Talleres", "Espacios", "EventosAgenda",
                  "Noticias", "UsuariosEntidades", "InvitacionesDeOrganizacion", "Notificaciones", "RegistrosRevisionHistorial", "ReclamacionesAdministracion", "PropuestasDeCambio"):
            self.assertIn(t, tablas)
        estados_festival = {f.valores["EstadoRegistro"] for f in plan.filas if f.tabla == "Festivales"}
        self.assertEqual(estados_festival, {"borrador", "en_revision", "publicado", "ajustes_solicitados", "rechazado", "archivado"})
        self.assertNotIn("aprobado", estados_festival)  # ningún camino del API lo escribe

    def test_nunca_hay_participaciones_ni_etiquetas_visibles(self):
        plan = plan_base()
        self.assertNotIn("Participaciones", {f.tabla for f in plan.filas})
        for f in plan.filas:
            for v in f.valores.values():
                if isinstance(v, str):
                    self.assertNotRegex(v.lower(), r"ficticio|demostraci[oó]n|datos de prueba", f"{f.tabla}:{f.alias}")

    def test_lo_publico_cita_fuente_y_el_nivel_uno_tiene_clave(self):
        for f in plan_base().filas:
            if f.procedencia != "sintetico":
                self.assertTrue(f.fuente, f.alias)
            if f.clave_estable:
                self.assertIn(f.nivel, (0, 1))


class CuentasDeValidacion(unittest.TestCase):
    def test_seis_cuentas_con_clave_admin_y_correos_simus_test(self):
        plan = plan_base()
        usuarios = {f.valores["CorreoElectronico"]: f for f in plan.filas if f.tabla == "Usuarios" and f.nivel == 0 and not f.solo_marca}
        self.assertEqual(set(usuarios), {"camila.restrepo@simus.test", "editor@simus.test", "reclamante@simus.test", "nuevo@simus.test"})
        # webmaster@ y gestor@simus.test las crea el arranque de la API: la siembra solo las marca
        self.assertEqual({f.alias for f in plan.filas if f.tabla == "Usuarios" and f.solo_marca}, {"cuenta.webmaster", "cuenta.gestor"})
        for correo, f in usuarios.items():
            self.assertTrue(verificar(f.valores["HashContrasena"], "admin"), correo)
            self.assertTrue(f.clave_estable.startswith("n0.cuenta."), correo)
        self.assertEqual(usuarios["camila.restrepo@simus.test"].valores["NombreCompleto"], "Camila Restrepo")

    def test_organizacion_grande_tiene_cinco_tipos_en_seis_estados(self):
        plan = plan_base()
        esperado = {"borrador", "en_revision", "ajustes_solicitados", "publicado", "rechazado", "archivado"}
        for tabla in ("Festivales", "Mercados", "Redes", "Talleres", "Espacios"):
            estados = {f.valores["EstadoRegistro"] for f in plan.filas if f.tabla == tabla and f.valores["OrganizacionPrincipalId"] == Ref("org.camila-grande")}
            self.assertEqual(estados, esperado, tabla)

    def test_las_organizaciones_de_camila(self):
        plan = plan_base()
        orgs = {f.alias: f.valores["EstadoRegistro"] for f in plan.filas if f.tabla == "Entidades" and f.alias.startswith("org.camila-")}
        self.assertEqual(orgs, {"org.camila-grande": "activa", "org.camila-mediana": "activa", "org.camila-nueva": "pendiente_de_confirmacion", "org.camila-vacia": "activa"})
        for vacia in ("org.camila-nueva", "org.camila-vacia"):
            self.assertFalse([f for f in plan.filas if f.valores.get("OrganizacionPrincipalId") == Ref(vacia)])
        roles = {(f.valores["IdUsuario"].alias, f.valores["IdEntidad"].alias): f.valores["RolEntidad"] for f in plan.filas if f.tabla == "UsuariosEntidades"}
        self.assertEqual(roles[("cuenta.externo-camila", "org.fund-voces-del-llano")], "editor")

    def test_el_escenario_ya_reclamado_y_la_unica_reclamacion_activa(self):
        plan = plan_base()
        estados = {f.valores["Estado"] for f in plan.filas if f.tabla == "ReclamacionesAdministracion"}
        self.assertTrue({"requiere_aclaracion", "en_revision", "rechazada", "transferencia_ejecutada", "cancelada", "enviada"} <= estados)
        self.assertEqual(len([f for f in plan.filas if f.tabla == "TransferenciasAdministracion"]), 1)


class ContenidoSembrado(unittest.TestCase):
    """Tema `contenido`: noticias, agenda, campañas y marcas editoriales."""

    @classmethod
    def setUpClass(cls):
        cls.plan = plan_base()
        import contenido
        cls.libro = contenido
        cls.eventos = [f for f in cls.plan.filas if f.tabla == "EventosAgenda" and f.alias.removeprefix("evento.") in {e["clave"] for e in contenido.EVENTOS}]
        cls.noticias = [f for f in cls.plan.filas if f.tabla == "Noticias"]

    def test_volumen_y_cuerpos_de_nota_periodistica(self):
        self.assertGreaterEqual(len(self.noticias), 30)
        self.assertEqual(len(self.eventos), 60)
        for n in self.libro.NOTICIAS:
            self.assertTrue(250 <= len(n["cuerpo"].split()) <= 500, n["clave"])
            self.assertLessEqual(len(n["resumen"]), 500)
            self.assertTrue(n["autoria"] and n.get("imagen") and n.get("alt"), n["clave"])

    def test_todos_los_departamentos_y_los_cuatro_estados_de_publicacion(self):
        deps = {f.valores["CodigoDepartamento"] for f in self.eventos} - {None}
        self.assertEqual(len(deps), 33)  # 32 departamentos + Bogotá D. C.
        self.assertTrue({"publicado", "en_revision", "borrador", "rechazado", "archivado"} <= {f.valores["Estado"] for f in self.eventos})
        años = {f.valores["FechaInicio"].year for f in self.eventos}
        self.assertTrue({2024, 2025, 2026, 2027} <= años)
        self.assertTrue(any(f.valores["FechaInicio"] < HOY for f in self.eventos) and any(f.valores["FechaInicio"] > HOY for f in self.eventos))

    def test_celebra_tiene_al_menos_doce_eventos_por_edicion(self):
        cuenta = {}
        for f in self.plan.filas:
            if f.tabla == "EventosAgendaProyectosTransversales" and hasattr(f.valores["ProyectoTransversalId"], "clave"):
                cuenta[f.valores["ProyectoTransversalId"].clave] = cuenta.get(f.valores["ProyectoTransversalId"].clave, 0) + 1
        self.assertGreaterEqual(cuenta["celebra-la-musica-2025"], 12)
        self.assertGreaterEqual(cuenta["celebra-la-musica-2026"], 12)
        creadas = {f.valores["Codigo"] for f in self.plan.filas if f.tabla == "ProyectosTransversales"}
        self.assertTrue(creadas.isdisjoint({"celebra-la-musica", "celebra-la-musica-2025", "celebra-la-musica-2026"}))  # ya existen: no se duplican
        self.assertEqual(len(creadas), 4)

    def test_las_cinco_destacadas_del_inicio_son_recientes_y_hay_una_programada(self):
        publicadas = sorted((f.valores["FechaPublicacion"], f.alias) for f in self.noticias if f.valores["Estado"] == "publicado")
        vigentes = [p for p in publicadas if p[0] <= HOY]
        self.assertGreaterEqual((HOY - vigentes[-5][0]).days, 0)
        self.assertLessEqual((HOY - vigentes[-5][0]).days, 20)  # las cinco de «Actualidad» son de las últimas semanas
        self.assertTrue(any(p[0] > HOY for p in publicadas))     # una programada: no cuenta hasta su fecha

    def test_claves_estables_n1_y_marcas_editoriales(self):
        claves = {f.clave_estable for f in self.plan.filas if f.clave_estable}
        self.assertTrue(all(len(c) <= 80 for c in claves))
        self.assertIn("n1.editorial.pnmc-ed-010", claves)
        marcas = [f for f in self.plan.filas if f.solo_marca and f.tabla == "PublicacionesEditoriales"]
        self.assertEqual(len(marcas), len(self.libro.EDITORIAL_N1))
        self.assertTrue(all(not f.valores and f.procedencia == "publico" and f.fuente for f in marcas))
        sql = lotes_sql(self.plan)
        self.assertIn("AND (SELECT IdPublicacionEditorial FROM dbo.PublicacionesEditoriales WHERE Codigo = N'PNMC-ED-008') IS NOT NULL", sql)
        self.assertNotIn("INSERT INTO dbo.PublicacionesEditoriales", sql)  # el acervo no se toca

    def test_el_historial_termina_en_el_estado_y_nada_dice_ficticio(self):
        validos = {f.alias for f in self.noticias} | {f.alias for f in self.eventos}
        for f in self.plan.filas:
            if f.tabla == "RegistrosRevisionHistorial" and f.alias.rsplit(".hist.", 1)[0] in validos:
                self.assertEqual(f.valores["Accion"], "EstadoCambiado")
        for it in self.libro.NOTICIAS + self.libro.EVENTOS:
            for v in it.values():
                if isinstance(v, str):
                    self.assertNotRegex(v.lower(), r"ficticio|demostraci[oó]n|demostrativ|datos de prueba|lorem")


class PlanDeLimpieza(unittest.TestCase):
    def test_clasificacion_y_orden_con_las_fk_reales(self):
        import plan_de_limpieza as pl
        cl = pl.clasificar(ESQ)  # la instantánea solo trae las tablas sembrables: alcanza para el orden entre ellas
        self.assertTrue(set(cl["preservar"]).isdisjoint(cl["limpiar"]))
        for t in ("Usuarios", "Entidades", "Festivales", "Notificaciones", "ReclamacionesAdministracion"):
            self.assertIn(t, cl["limpiar"])
        for t in ("Divipola", "PracticasMusicales", "Roles", "Categorias", "Etiquetas", "PublicacionesEditoriales"):
            self.assertIn(t, pl.PRESERVAR)
        self.assertIn("ProyectosTransversales", cl["limpiar"])  # solo se conservan los de partida (filtro): las campañas de la siembra se retiran
        self.assertIn("celebra-la-musica-2026", pl.FILTROS["ProyectosTransversales"])
        pos = {t: i for i, t in enumerate(cl["limpiar"])}
        ignoradas = {(h, p) for h, _, p in pl.CICLOS}
        for f in ESQ["foraneas"]:
            h, p = f["tabla"], f["tabla_referida"]
            if h in pos and p in pos and h != p and (h, p) not in ignoradas:
                self.assertLess(pos[h], pos[p], f"{h} debe borrarse antes que {p}")

    def test_el_guion_conserva_cuentas_de_arranque_y_verifica(self):
        import plan_de_limpieza as pl
        guion = pl.sql(pl.clasificar(ESQ))
        self.assertIn("NOT (CorreoElectronico LIKE N'%@pnmc.local' OR CorreoElectronico IN (N'webmaster@simus.test', N'gestor@simus.test', N'externo@simus.test', N'participante.dos@simus.test', N'participante.tres@simus.test'))", guion)
        self.assertIn("NOT (EsInstitucional = 1)", guion)
        self.assertIn("DBCC CHECKCONSTRAINTS", guion)
        self.assertIn("BEGIN TRANSACTION", guion)
        self.assertNotIn("DELETE FROM dbo.Divipola", guion)
        self.assertNotIn("DELETE FROM dbo.Roles", guion)


class ValidacionesDetectan(unittest.TestCase):
    def _con(self, mutar):
        plan = plan_base()
        mutar(plan)
        return "\n".join(validar(plan, ESQ, CAT, TERR)[0])

    def test_estado_fuera_del_check(self):
        def m(p): next(f for f in p.filas if f.tabla == "Festivales" and f.alias).valores["EstadoRegistro"] = "aprobadito"
        self.assertIn("no admitido por CHECK", self._con(m))

    def test_obligatoria_faltante(self):
        def m(p): del next(f for f in p.filas if f.tabla == "Entidades").valores["Nombre"]
        self.assertIn("falta la columna obligatoria Nombre", self._con(m))

    def test_referencia_sin_resolver(self):
        def m(p): next(f for f in p.filas if f.tabla == "EdicionesFestival").valores["FestivalId"] = Ref("festival.no-existe")
        self.assertIn("referencia sin resolver", self._con(m))

    def test_alias_repetido(self):
        def m(p): p.agregar("Etiquetas", {"Nombre": "x"}, alias=next(f for f in p.filas if f.alias).alias, lote="n3-x", nivel=3)
        self.assertIn("alias repetido", self._con(m))

    def test_check_de_un_solo_responsable(self):
        from nucleo import USUARIO_SISTEMA
        def m(p): next(f for f in p.filas if f.tabla == "Redes").valores["UsuarioResponsableId"] = USUARIO_SISTEMA
        self.assertIn("CK_Redes_UnSoloResponsable", self._con(m))

    def test_edicion_realizada_con_fecha_futura(self):
        def m(p):
            f = next(f for f in p.filas if f.tabla == "EdicionesFestival" and f.valores["Estado"] == "realizada" and f.valores.get("FechaFin"))
            f.valores["FechaInicio"], f.valores["FechaFin"] = dt.date(2027, 1, 1), dt.date(2027, 1, 2)
        self.assertIn("realizada con fin futuro", self._con(m))

    def test_historial_que_no_termina_en_el_estado_actual(self):
        def m(p): next(f for f in p.filas if f.tabla == "Festivales" and f.valores["EstadoRegistro"] == "publicado" and f.procedencia == "sintetico").valores["EstadoRegistro"] = "borrador"
        self.assertIn("historial de", self._con(m))

    def test_texto_repetido_y_municipio_inexistente(self):
        def m(p):
            fs = [f for f in p.filas if f.tabla == "Noticias"]
            fs[1].valores["Cuerpo"] = fs[0].valores["Cuerpo"]
        self.assertIn("texto repetido", self._con(m))
        def m2(p): next(f for f in p.filas if f.tabla == "Entidades").valores["CodigoMunicipio"] = "99999"
        self.assertIn("no existe en DIVIPOLA", self._con(lambda p: next(f for f in p.filas if f.tabla == "Entidades").valores.update(CodigoMunicipioSede="99999")))

    def test_columna_calculada_o_identidad_no_se_inserta(self):
        def m(p): next(f for f in p.filas if f.tabla == "ReclamacionesAdministracion").valores["EsActiva"] = True
        self.assertIn("columna calculada", self._con(m))

    def test_correo_real(self):
        def m(p): next(f for f in p.filas if f.tabla == "Usuarios" and not f.solo_marca).valores["CorreoElectronico"] = "alguien@gmail.com"
        self.assertIn("no termina en .test", self._con(m))


class Piezas(unittest.TestCase):
    def test_hash_compatible_con_identity(self):
        h = hash_identidad("admin", "a@simus.test")
        self.assertTrue(verificar(h, "admin"))
        self.assertFalse(verificar(h, "Admin"))
        self.assertEqual(h, hash_identidad("admin", "a@simus.test"))
        self.assertEqual(len(__import__("base64").b64decode(h)), 61)

    def test_fechas_y_municipios_publicos(self):
        self.assertEqual(dp.parse_fecha(2025, "21-23 jun"), (dt.date(2025, 6, 21), dt.date(2025, 6, 23)))
        self.assertEqual(dp.parse_fecha(2024, "30 oct-1 nov"), (dt.date(2024, 10, 30), dt.date(2024, 11, 1)))
        self.assertEqual(dp.parse_fecha(2007, "3, 4, 5 y 10 nov"), (dt.date(2007, 11, 3), dt.date(2007, 11, 10)))
        self.assertEqual(dp.parse_fecha(2025, ""), (None, None))
        self.assertEqual(TERR.municipio("Bogotá", "Bogotá D. C."), ("11", "11001"))
        self.assertEqual(TERR.municipio("Popayán", "Cauca")[1], "19001")

    def test_sql_escapa_comillas_y_saltos(self):
        from nucleo import q
        self.assertEqual(q("O'Hara\nlinea"), "N'O''Hara' + NCHAR(10) + N'linea'")


class CelebraEdiciones(unittest.TestCase):
    """Las ediciones 2025 y 2026 de Celebra la música (libro `celebra`, lote `n1-celebra`)."""

    @classmethod
    def setUpClass(cls):
        import celebra_ediciones
        cls.plan = celebra_ediciones.plan_solo(20261121, HOY)
        cls.filas = [f for f in cls.plan.filas if f.lote == "n1-celebra"]

    def test_el_plan_solo_valida_contra_el_esquema_y_es_determinista(self):
        import celebra_ediciones
        errores, _ = validar(self.plan, ESQ, CAT, TERR)
        self.assertEqual(errores, [])
        self.assertEqual(lotes_sql(self.plan), lotes_sql(celebra_ediciones.plan_solo(20261121, HOY)))

    def test_solo_inserta_tablas_celebra_y_archivos(self):
        self.assertEqual({f.tabla for f in self.plan.filas}, {"CelebraEdiciones", "CelebraCategorias", "CelebraRecursos", "CelebraPreguntas", "CelebraGaleria", "Archivos"})
        self.assertTrue(all(f.alias for f in self.plan.filas), "toda fila lleva alias: así el plan es idempotente")
        self.assertTrue(all(f.nivel == 1 and f.procedencia == "hibrido" and f.fuente for f in self.filas))

    def test_dos_ediciones_publicadas_una_sola_vigente_con_su_proyecto(self):
        ed = {f.valores["Anio"]: f.valores for f in self.filas if f.tabla == "CelebraEdiciones"}
        self.assertEqual(sorted(ed), [2025, 2026])
        self.assertTrue(all(v["Publicada"] and not v["PendienteDeValidar"] for v in ed.values()))
        self.assertEqual([a for a, v in ed.items() if v["Actual"]], [2026])
        for anio, v in ed.items():
            self.assertEqual(v["ProyectoTransversalId"].clave, f"celebra-la-musica-{anio}")
            self.assertNotIn("consultado", json.dumps(v, default=str, ensure_ascii=False).lower())

    def test_cada_edicion_cubre_todos_los_bloques_de_la_pagina(self):
        for anio in (2025, 2026):
            hijas = {t: [f for f in self.filas if f.tabla == t and f.alias.startswith(f"celebra.{anio}.")] for t in ("CelebraCategorias", "CelebraRecursos", "CelebraPreguntas", "CelebraGaleria")}
            self.assertGreaterEqual(len(hijas["CelebraCategorias"]), 3)
            self.assertGreaterEqual(len(hijas["CelebraPreguntas"]), 2)
            self.assertEqual(len(hijas["CelebraGaleria"]), 6)
            self.assertTrue(all(g.valores["TextoAlternativo"] and g.valores["Credito"] for g in hijas["CelebraGaleria"]))
            grupos = {r.valores["Grupo"] for r in hijas["CelebraRecursos"]}
            self.assertGreaterEqual(len(grupos - {"Aliados"}), 2, "la caja de herramientas tiene al menos dos grupos además de los logotipos")
            for r in hijas["CelebraRecursos"]:   # un recurso lleva archivo o enlace https, nunca ambos ni ninguno
                self.assertEqual((r.valores["ArchivoId"] is None), (r.valores["Url"] is not None))
                self.assertTrue(r.valores["Url"] is None or r.valores["Url"].startswith("https://"))

    def test_los_aliados_llevan_su_logotipo_real_de_la_pagina_oficial(self):
        # Aliados: Batuta y la Asociación Nacional de las Artes en 2025; esas dos y Poliedro en 2026 (logos del sitio del Ministerio, manifiesto con la URL
        # de origen). El Ministerio y el PNMC organizan: no son aliados ni llevan logo en este grupo.
        import comun as C
        manifiesto = C.leer_manifiesto()
        batuta_y_ana = {"Fundación Nacional Batuta", "Asociación Nacional de las Artes"}
        por_anio = {2025: batuta_y_ana, 2026: batuta_y_ana | {"Fundación Poliedro"}}
        for anio, esperados in por_anio.items():
            logos = [f for f in self.filas if f.tabla == "CelebraRecursos" and f.alias.startswith(f"celebra.{anio}.") and f.valores["Grupo"] == "Aliados"]
            self.assertEqual({f.valores["Titulo"] for f in logos}, esperados)
            for f in logos:
                self.assertIsNone(f.valores["Url"])
                self.assertIsNotNone(f.valores["ArchivoId"])
            ed = next(f for f in self.filas if f.tabla == "CelebraEdiciones" and f.valores["Anio"] == anio)
            self.assertTrue(all(n in ed.valores["Aliados"] for n in esperados), "el texto de aliados nombra a los mismos que tienen logo")
            self.assertNotIn("organizaciones aliadas", ed.valores["Aliados"])
            if anio == 2025:
                self.assertNotIn("Poliedro", ed.valores["Aliados"])
        for a in manifiesto.values():
            if a.origen == "celebra-aliado-oficial":
                self.assertTrue(a.fuente.startswith("https://celebralamusica.mincultura.gov.co/"))
                self.assertEqual(a.procedencia, "publico")
        self.assertEqual(sum(1 for a in manifiesto.values() if a.origen == "celebra-aliado-oficial"), 3)

    def test_la_limpieza_ya_no_conserva_celebra_porque_ahora_lo_siembra_la_siembra(self):
        import plan_de_limpieza as pl
        for t in ("CelebraEdiciones", "CelebraCategorias", "CelebraRecursos", "CelebraPreguntas", "CelebraGaleria"):
            self.assertNotIn(t, pl.PRESERVAR)
            self.assertIn(t, pl.clasificar(ESQ)["limpiar"])
        self.assertIn("celebra-la-musica-2025", pl.FILTROS["ProyectosTransversales"])   # los proyectos de cada edición sí se conservan

    def test_el_plan_completo_incluye_las_ediciones_y_el_orden_resuelve_sus_referencias(self):
        plan = plan_base()
        errores, _ = validar(plan, ESQ, CAT, TERR)
        self.assertEqual(errores, [])
        self.assertEqual(sum(1 for f in plan.filas if f.tabla == "CelebraEdiciones"), 2)


if __name__ == "__main__":
    unittest.main(verbosity=1)
