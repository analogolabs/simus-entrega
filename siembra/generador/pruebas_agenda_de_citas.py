"""Pruebas de las agendas de citas de la siembra integral (sin base de datos ni red; los binarios del pool no hacen falta):
`python3 -I siembra/generador/pruebas_agenda_de_citas.py`."""
from __future__ import annotations

import os
import sys
import unittest
from collections import Counter
from pathlib import Path

AQUI = Path(__file__).resolve().parent
os.environ.setdefault("SIMUS_SIEMBRA_ASSETS_FALTANTES", "ignorar")
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parents[1] / "siembra" / "libro"))

import agenda_de_citas as ac  # noqa: E402
import pruebas_integracion as pi  # noqa: E402
from nucleo import sql_de_lote  # noqa: E402
from validaciones import validar  # noqa: E402
import json  # noqa: E402
import datos_publicos as dp  # noqa: E402


def filas(tabla):
    return [f for f in pi.plan().filas if f.tabla == tabla and f.lote == ac.LOTE]


def de(agenda, tabla):
    return [f for f in filas(tabla) if f.alias.startswith(agenda + ".")]


class AgendaDeCitas(unittest.TestCase):
    def test_el_plan_valida_y_el_lote_existe(self):
        p = pi.plan()
        esq = json.loads((AQUI / "esquema-instantanea.json").read_text(encoding="utf-8"))
        cat = json.loads((AQUI / "catalogos-instantanea.json").read_text(encoding="utf-8"))
        errores, _ = validar(p, esq, cat, dp.Territorio(cat["divipola"]))
        self.assertEqual(errores, [])
        self.assertIn(ac.LOTE, p.lotes())

    def test_cuatro_agendas_en_los_estados_pedidos_y_con_claves_estables(self):
        ag = {f.alias: f for f in filas("AgendasDeCitas")}
        self.assertEqual({a.valores["Estado"] for a in ag.values()}, {"abierta", "borrador", "cerrada"})
        self.assertEqual({a.clave_estable for a in ag.values()}, {ac.CLAVE_ABIERTA, ac.CLAVE_BORRADOR, ac.CLAVE_CERRADA, ac.CLAVE_FIJA})
        self.assertEqual(sorted(a.valores["Modo"] for a in ag.values() if a.valores["Estado"] == "abierta"), ["compradores_fijos", "compradores_rotan"])
        self.assertTrue(all(a.nivel == 1 and a.procedencia == "sintetico" for a in ag.values()))

    def test_la_abierta_esta_bien_poblada(self):
        ab = ac.ALIAS_ABIERTA
        self.assertGreaterEqual(len(de(ab, "FranjasDeCitas")), 20)
        parts = de(ab, "ParticipantesDeCitas")
        art = Counter(p.valores["Estado"] for p in parts if p.valores["Rol"] == "artista")
        self.assertGreaterEqual(art["aprobado"], 4)
        for estado in ("pendiente", "lista_de_espera", "rechazado"):
            self.assertGreaterEqual(art[estado], 1, estado)
        compradores = [p for p in parts if p.valores["Rol"] == "comprador"]
        self.assertGreaterEqual(sum(1 for p in compradores if p.valores.get("Espacio")), 3)
        self.assertTrue(any(p.valores["UsuarioId"] is None for p in compradores), "falta la compradora invitada sin cuenta")
        estados = {c.valores["Estado"] for c in de(ab, "CitasDeAgenda")}
        self.assertEqual(estados, {"solicitada", "confirmada", "rechazada", "cancelada", "vencida"})
        cupo = next(a for a in filas("AgendasDeCitas") if a.alias == ab).valores["CupoArtistas"]
        self.assertLessEqual(art["aprobado"], cupo)

    def test_los_artistas_admitidos_de_la_agenda_de_stands_tienen_su_stand(self):
        artistas = [p for p in de(ac.ALIAS_ABIERTA, "ParticipantesDeCitas") if p.valores["Rol"] == "artista"]
        for p in artistas:
            if p.valores["Estado"] == "aprobado":
                self.assertTrue(p.valores["Espacio"], p.alias)
            else:
                self.assertFalse(p.valores.get("Espacio"), p.alias)
        stands = [p.valores["Espacio"] for p in artistas if p.valores["Estado"] == "aprobado"]
        self.assertEqual(len(stands), len(set(stands)), "dos artistas con el mismo stand")

    def test_la_agenda_abierta_de_mesas_fijas_tiene_mesas_y_solicitudes_por_decidir_del_lado_del_comprador(self):
        ag = next(a for a in filas("AgendasDeCitas") if a.alias == ac.ALIAS_FIJA).valores
        self.assertEqual((ag["Estado"], ag["Modo"]), ("abierta", "compradores_fijos"))
        parts = {p.alias: p for p in de(ac.ALIAS_FIJA, "ParticipantesDeCitas")}
        mesas = [p.valores["Espacio"] for p in parts.values() if p.valores["Rol"] == "comprador"]
        self.assertGreaterEqual(len(mesas), 3)
        self.assertTrue(all(mesas))
        self.assertEqual(len(mesas), len(set(mesas)))
        pendientes = [c for c in de(ac.ALIAS_FIJA, "CitasDeAgenda") if c.valores["Estado"] == "solicitada"]
        self.assertGreaterEqual(len(pendientes), 4)
        for c in pendientes:   # quien pide es el artista; quien decide, el comprador
            self.assertEqual(parts[c.valores["AnfitrionId"].alias].valores["Rol"], "comprador")
            self.assertEqual(parts[c.valores["VisitanteId"].alias].valores["Rol"], "artista")
        margarita = [c for c in pendientes if c.valores["AnfitrionId"].alias.endswith("comprador.margarita-buelvas")]
        self.assertTrue({c.valores["VisitanteId"].alias.rsplit(".", 1)[1] for c in margarita} >= {"eliecer-rios"})
        self.assertGreaterEqual(len({c.valores["Estado"] for c in de(ac.ALIAS_FIJA, "CitasDeAgenda")}), 4)

    def test_el_guion_de_stands_solo_rellena_donde_falta_y_es_idempotente(self):
        sql = ac.sql_de_stands()
        self.assertEqual(sql.count("UPDATE p SET"), len(ac.STANDS_ABIERTA))
        self.assertEqual(sql.count("p.Espacio IS NULL"), len(ac.STANDS_ABIERTA))
        self.assertNotIn("DELETE", sql)

    def test_el_borrador_esta_recien_creado(self):
        self.assertEqual(de(ac.ALIAS_BORRADOR, "FranjasDeCitas"), [])
        self.assertEqual(de(ac.ALIAS_BORRADOR, "ParticipantesDeCitas"), [])
        self.assertEqual(de(ac.ALIAS_BORRADOR, "CitasDeAgenda"), [])

    def test_la_cerrada_esta_en_el_pasado_y_sin_solicitudes_vivas(self):
        p = pi.plan()
        cerrada = next(a for a in filas("AgendasDeCitas") if a.alias == ac.ALIAS_CERRADA).valores
        self.assertIsNotNone(cerrada["FechaCierre"])
        self.assertEqual(cerrada["Modo"], "compradores_fijos")
        for f in de(ac.ALIAS_CERRADA, "FranjasDeCitas"):
            self.assertLess(f.valores["FinUtc"].date(), p.hoy)
        self.assertNotIn("solicitada", {c.valores["Estado"] for c in de(ac.ALIAS_CERRADA, "CitasDeAgenda")})

    def test_nadie_tiene_dos_citas_vivas_en_la_misma_franja(self):
        for agenda in (ac.ALIAS_ABIERTA, ac.ALIAS_FIJA, ac.ALIAS_CERRADA):
            vistos = set()
            for c in de(agenda, "CitasDeAgenda"):
                if c.valores["Estado"] not in ("solicitada", "confirmada"):
                    continue
                for lado in ("AnfitrionId", "VisitanteId"):
                    clave = (c.valores["FranjaId"].alias, c.valores[lado].alias)
                    self.assertNotIn(clave, vistos)
                    vistos.add(clave)

    def test_las_cuentas_que_participan_son_externas_y_nuevo_queda_libre(self):
        cuentas = {f.alias: f.valores["CorreoElectronico"] for f in pi.plan().filas if f.tabla == "Usuarios" and not f.solo_marca}
        for p in filas("ParticipantesDeCitas"):
            if p.valores["UsuarioId"] is not None:
                self.assertTrue(cuentas[p.valores["UsuarioId"].alias].endswith("@simus.test"))
        self.assertNotIn("persona.nuevo", {p.valores["UsuarioId"].alias for p in filas("ParticipantesDeCitas") if p.valores["UsuarioId"] is not None})
        self.assertIn("nuevo@simus.test", cuentas.values())
        self.assertFalse(any(p.valores.get("CorreoInvitacion") == "nuevo@simus.test" for p in filas("ParticipantesDeCitas")))

    def test_la_invitada_lleva_foto_privada_e_invitacion_pendiente(self):
        inv = filas("InvitacionesDeAgenda")
        self.assertEqual(len(inv), 1)
        self.assertEqual(inv[0].valores["Estado"], "pendiente")
        self.assertEqual(len(inv[0].valores["HashTestigo"]), 64)
        self.assertEqual(len(ac.testigo_de_invitacion()), 64)
        self.assertTrue(any(f.tabla == "Archivos" and f.alias.startswith("img.participante.") for f in pi.plan().filas))

    def test_el_sql_se_emite_idempotente_por_alias(self):
        sql = sql_de_lote(pi.plan(), ac.LOTE)
        self.assertIn("IF NOT EXISTS (SELECT 1 FROM dbo.DatosDeDemostracion WHERE Alias = N'agenda-de-citas.abierta')", sql)
        self.assertEqual(sql.count("INSERT INTO dbo.CitasDeAgenda"), len(filas("CitasDeAgenda")))


if __name__ == "__main__":
    unittest.main(verbosity=1)
