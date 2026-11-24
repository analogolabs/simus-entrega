#!/usr/bin/env python3
"""Pruebas del sistema de multimedia (no tocan ninguna base): python3 siembra/multimedia/pruebas_multimedia.py (con Pillow; sin él se omiten las de generación)."""
import sys
import tempfile
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parent / "generador"))
import comun as C  # noqa: E402
import pool as P  # noqa: E402
import construir  # noqa: E402
import banco  # noqa: E402
from nucleo import Blob, Plan, valor_sql  # noqa: E402
import datetime as dt  # noqa: E402

CON_PILLOW = P.I is not None


class Manifiesto(unittest.TestCase):
    def test_todo_alias_tiene_forma_y_alt(self):
        m = C.leer_manifiesto()
        self.assertTrue(m, "manifiesto vacío")
        for a in m.values():
            self.assertRegex(a.alias, C.RE_ALIAS)
            if not a.equivale_a:
                self.assertTrue(a.alt.strip(), a.alias)
                self.assertLessEqual(len(a.pie), 500)
                self.assertLessEqual(len(a.credito), 200)
                self.assertIn(a.mime, C.MIMES)
                self.assertTrue(a.fuente)

    def test_alias_del_pool_estable(self):
        self.assertEqual(P.alias_del_pool("organizacion.logo", "k"), P.alias_del_pool("organizacion.logo", "k"))
        self.assertIn(P.alias_del_pool("organizacion.logo", "k"), C.leer_manifiesto())


@unittest.skipUnless(CON_PILLOW, "sin Pillow")
class Generacion(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.TemporaryDirectory()
        self.dir = Path(self.d.name)

    def tearDown(self):
        self.d.cleanup()

    def pool(self, n):
        return P.Pool(str(self.dir / n), manifiesto=self.dir / f"{n}.csv")

    def test_determinista_y_dentro_de_limites(self):
        for alias in ("img.persona.ana-ruiz.retrato", "img.organizacion.casa-del-tambor.logo", "img.festival.x.portada", "img.festival.x.afiche",
                      "img.noticia.y.imagen", "img.taller.z.foto", "img.soporte.r.documento", "img.documento.d.pdf"):
            a, b = self.pool("a").resolver(alias, nombre="Prueba"), self.pool("b").resolver(alias, nombre="Prueba")
            self.assertEqual(a.checksum, b.checksum, alias)
            self.assertTrue(a.alt)
            self.assertLessEqual(a.bytes, C.OBJETIVO_WEB if a.mime != "application/pdf" else C.MAX_PDF)
            self.assertLessEqual(max(a.ancho, a.alto), C.LADO_MAXIMO)

    def test_galeria_equivale_a_foto_del_pool_sin_duplicar(self):
        p = self.pool("g")
        p.assets["img.pool.foto.rock.001"] = C.Asset(alias="img.pool.foto.rock.001", archivo="x", mime="image/jpeg", alt="x" * 30, fuente="f", checksum="1")
        a = p.resolver("img.festival.q.galeria.01")
        self.assertEqual(a.alias, "img.pool.foto.rock.001")

    def test_alias_mal_formado_o_sin_regla(self):
        with self.assertRaises(P.AliasSinAsset):
            self.pool("c").resolver("img.cosa")
        with self.assertRaises(P.AliasSinAsset):
            self.pool("d").resolver("img.persona.x.logo")

    def test_banco_emite_archivo_idempotente_y_valida_limites(self):
        p = self.pool("e")
        plan = Plan(semilla=1, hoy=dt.date(2026, 11, 21))
        b = banco.instalar(plan, p)
        r = b.ref("img.organizacion.casa.logo", nombre="Casa del Tambor")
        b.ref("img.organizacion.casa.logo")
        self.assertEqual(len([f for f in plan.filas if f.tabla == "Archivos"]), 1)
        f = plan.filas[0]
        self.assertEqual(f.valores["Huella"], f.valores["NombreAlmacenado"].split("-")[1].split(".")[0])
        self.assertLessEqual(f.valores["PesoBytes"], C.MAX_IMAGEN)
        from nucleo import sql_de_fila
        sql = sql_de_fila(f, 1)
        self.assertIn("IF NOT EXISTS", sql)
        self.assertIn("0x89504e47", sql)  # firma PNG: el contenido viaja en el guion
        self.assertEqual(r.alias, "img.organizacion.casa.logo")


class Verificador(unittest.TestCase):
    def test_detecta_alt_vacio_y_alias_inexistente(self):
        p = P.Pool(autogenerar=False)
        malo = C.Asset(alias="img.persona.malo.retrato", archivo="no/existe.png", mime="image/png", fuente="generado", checksum="0")
        p.assets["img.persona.malo.retrato"] = malo
        errores, _ = construir.verificar(p, ["img.festival.no-existe.portada"])
        texto = "\n".join(errores)
        self.assertIn("texto alternativo", texto)
        self.assertIn("no existe en el manifiesto", texto)

    def test_blob_ausente_falla_con_instrucciones(self):
        with self.assertRaises(FileNotFoundError):
            valor_sql(Blob("/ruta/que/no/existe.png"))


class FotosLibresDeAgentes(unittest.TestCase):
    """Las fotos del directorio de agentes: licencia libre, trazabilidad, peso ligero y ninguna ilustración antigua."""

    def test_catalogo_licencias_y_pesos(self):
        import json
        catalogo = json.loads((C.IMAGENES_LIBRES / "catalogo.json").read_text(encoding="utf-8"))["fotos"]
        licencias = (C.IMAGENES_LIBRES / "LICENCIAS.md").read_text(encoding="utf-8")
        self.assertGreaterEqual(len(catalogo), 24)
        self.assertEqual([f["n"] for f in catalogo], list(range(1, len(catalogo) + 1)))
        m = C.leer_manifiesto()
        for f in catalogo:
            self.assertIn(f["licencia"], ("CC0", "Public domain"), f["archivo"])   # CC BY / CC BY-SA solo con decisión expresa y atribución visible
            self.assertTrue(f["alt"].strip() and f["url"].startswith("https://commons.wikimedia.org/"), f["archivo"])
            self.assertEqual(f["consulta"], "2026-11-23")
            self.assertIn(f["archivo"], licencias)   # cada imagen está registrada en LICENCIAS.md
            ruta = C.IMAGENES_LIBRES / f["archivo"]
            self.assertLessEqual(ruta.stat().st_size, 150 * 1024, f["archivo"])
            a = m[f"img.pool.agente.{f['n']:03d}"]
            self.assertEqual((a.origen, a.mime, a.checksum), (C.ORIGEN_FOTO_LIBRE, "image/jpeg", C.sha256(ruta.read_bytes())))

    def test_reparto_determinista_y_sin_retratos_ilustrados(self):
        self.assertEqual(P.alias_de_foto_de_agente(7), P.alias_de_foto_de_agente(7))
        self.assertEqual(P.alias_de_foto_de_agente(0), "img.pool.agente.001")
        self.assertEqual(len({P.alias_de_foto_de_agente(i) for i in range(P.total_de_fotos_de_agentes())}), P.total_de_fotos_de_agentes())
        m = C.leer_manifiesto()
        self.assertFalse([k for k in m if k.endswith(".retrato")], "no deben quedar retratos ilustrados en el manifiesto")
        self.assertNotIn("persona.retrato", P.CLASES_DEL_POOL)


if __name__ == "__main__":
    unittest.main(verbosity=1)
