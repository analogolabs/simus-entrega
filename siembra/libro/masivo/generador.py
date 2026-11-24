"""Motor masivo de los niveles 2 y 3: personas, organizaciones, agrupaciones, festivales y ediciones, mercados, redes,
talleres, espacios y eventos, con redes de relaciones de densidad desigual. Determinista (semilla fija), por lotes e idempotente
(todo se emite como filas simbólicas con alias `<tipo>.n2.<clave>` o `<tipo>.n3.<clave>`).

Uso desde el generador: `masivo.agregar(plan, c, escala)`. El mundo se arma primero (especificaciones y grafo) y luego se redacta y se emite.
"""
from __future__ import annotations

import datetime as dt
import math
import random
import re
import unicodedata
from types import SimpleNamespace

from . import lexico as L
from . import texto as T
from nucleo import Cat, Raw, Ref
from hash_identidad import hash_identidad

CUOTAS = dict(personas=(70, 200), orgs=(45, 120), festivales=(36, 72), mercados=(8, 12), redes=(8, 22), talleres=(12, 28), espacios=(12, 32), eventos=(30, 75))
FRACCION_AGRUPACION = {2: 0.40, 3: 0.42}
ESTADOS_PROCESO = {2: [("publicado", .62), ("en_revision", .10), ("borrador", .08), ("ajustes_solicitados", .08), ("rechazado", .04), ("archivado", .08)],
                   3: [("publicado", .52), ("en_revision", .12), ("borrador", .12), ("ajustes_solicitados", .08), ("rechazado", .06), ("archivado", .10)]}
ESTADOS_ORG = {2: [("activa", .86), ("inactiva", .08), ("pendiente_de_confirmacion", .06)],
               3: [("activa", .74), ("inactiva", .10), ("pendiente_de_confirmacion", .11), ("eliminada", .05)]}
TRAYECTORIAS = {2: {"larga": 20, "media": 20, "interrumpida": 20, "corta": 12, "unica": 6, "futura": 4, "ninguna": 4, "cerrado": 14},
                3: {"ninguna": 22, "unica": 22, "corta": 18, "media": 12, "interrumpida": 8, "larga": 4, "futura": 4, "cerrado": 10}}
HASH = hash_identidad("admin", "masivo")      # una sola derivación (100 000 iteraciones): todas las cuentas del motor comparten clave de demo
FAMOSOS = ["rock al parque", "jazz al parque", "festival petronio alvarez", "petronio alvarez", "mono nunez", "festival de la leyenda vallenata", "leyenda vallenata", "estereo picnic", "festival altavoz", "altavoz",
           "circulart", "bomm", "bogota music market", "carnaval de barranquilla", "feria de cali", "festival vallenato", "cordillera", "festival iberoamericano de teatro", "joropo al parque", "salsa al parque",
           "hip hop al parque", "colombia al parque", "festival de musica del pacifico petronio alvarez", "festival de la musica colombiana", "festival nacional de gaitas", "cuna de acordeones", "ibague festival"]
SERVICIO_DE_ROL = {"interprete": ["presentaciones", "clases"], "cantante": ["presentaciones", "grabacion"], "compositor": ["composicion", "grabacion"], "director": ["direccion", "clases"], "docente": ["clases", "asesoria"],
                   "investigador": ["investigacion", "asesoria"], "luthier": ["luteria"], "sonidista": ["sonido", "grabacion"], "productor": ["grabacion", "gestion"], "gestor": ["gestion", "asesoria"],
                   "cultor": ["presentaciones", "clases"]}
TIPOLOGIA = {"religiosas": "celebracion-religiosa", "populares": "fiesta-popular", "bandas": "fiesta-popular", "campesinas": "fiesta-popular", "comunitarias": "encuentros", "frontera": "encuentros",
             "afro": "encuentros", "originarios": "encuentros", "sonoras": "encuentros"}
FUENTES = ["alcaldia", "gobernacion", "mincultura", "concertacion", "estimulos", "boleteria", "aportes-privados", "estampilla-procultura", "cooperacion-internacional", "contribucion-parafiscal"]
MESES_TXT = T.ALIAS_MESES


class NS(SimpleNamespace):
    """Ficha mutable con igualdad e identidad por referencia (el grafo tiene ciclos)."""
    __eq__ = object.__eq__
    __hash__ = object.__hash__


def _norm(t: str) -> str:
    t = unicodedata.normalize("NFKD", t)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", "".join(c for c in t if not unicodedata.combining(c)).lower())).strip()


def slug(t: str, n: int = 48) -> str:
    return re.sub(r"[^a-z0-9]+", "-", _norm(t)).strip("-")[:n].strip("-")


def pick_w(rng, pares):
    return rng.choices([p for p, _ in pares], weights=[w for _, w in pares])[0]


def titulo_muni(nm: str) -> str:
    if nm in L.NOMBRE_COMUN:
        return L.NOMBRE_COMUN[nm]
    peq = {"DE", "DEL", "LA", "LAS", "LOS", "Y", "EL"}
    pal = nm.title().split()
    return " ".join(p.lower() if p.upper() in peq and i else p for i, p in enumerate(pal))


class Mundo:
    def __init__(self, semilla: int, hoy: dt.date, divipola: list, escala: float = 1.0, reales: list | None = None):
        self.semilla, self.hoy, self.escala = semilla, hoy, escala
        self.rng = random.Random(f"{semilla}:masivo")
        self.banco = T.Banco()
        self.munis: dict = {}
        self.muni_nombre: dict = {}
        for f in divipola:
            self.munis.setdefault(f["d"], []).append(f["m"])
            self.muni_nombre[f["m"]] = titulo_muni(f["nm"])
        self.reales = [_norm(x) for x in (reales or [])] + FAMOSOS
        self.reales_tok = [set(r.split()) for r in self.reales]
        self.nombres_usados: set = set()
        self.claves: set = set()
        self.correos: set = set()
        self.personas: list = []
        self.orgs: list = []
        self.festivales: list = []
        self.mercados: list = []
        self.procesos = {"redes": [], "talleres": [], "espacios": []}
        self.eventos: list = []
        self.aristas_participa: list = []     # (agrupación, festival)
        self.contador_doc = 0

    # ----------------------------------------------------------- utilidades
    def cuota(self, clave: str, nivel: int) -> int:
        n = CUOTAS[clave][0 if nivel == 2 else 1]
        return 0 if self.escala <= 0 else max(1, round(n * self.escala))

    def nombre_muni(self, cod: str) -> str:
        return self.muni_nombre[cod]

    def gen(self, alias: str):
        return NS(rng=random.Random(f"{self.semilla}:masivo:{alias}"), banco=self.banco, nombre_muni=self.nombre_muni)

    def dias_de(self, fecha: dt.date) -> int:
        return max((self.hoy - fecha).days, 0)

    def choca(self, nombre: str) -> bool:
        n = _norm(nombre)
        if n in self.nombres_usados:
            return True
        tok = set(n.split())
        for r, rt in zip(self.reales, self.reales_tok):
            if n == r or (len(r) > 6 and (r in n or n in r)):
                return True
            if len(tok | rt) and len(tok & rt) / len(tok | rt) >= 0.6:
                return True
        return False

    def nombre_unico(self, fabrica, intentos: int = 80) -> str:
        for _ in range(intentos):
            n = fabrica()
            if not self.choca(n):
                self.nombres_usados.add(_norm(n))
                return n
        n = fabrica() + f" {len(self.nombres_usados) % 97 + 2}"
        self.nombres_usados.add(_norm(n))
        return n

    def clave_unica(self, nivel: int, base: str) -> str:
        c = f"n{nivel}.{slug(base, 44)}"
        k, i = c, 2
        while k in self.claves:
            k = f"{c}-{i}"
            i += 1
        self.claves.add(k)
        return k

    # ----------------------------------------------------------- territorio
    def lugares(self, rng, n: int, minimo: int) -> list:
        if n <= 0:
            return []
        deps = list(L.DEPTO)
        pesos = [L.DEPTO[d]["peso"] for d in deps]
        if minimo and n >= len(deps) * minimo:
            base = deps * minimo
        elif minimo:
            base = sorted(deps, key=lambda d: -L.DEPTO[d]["peso"] * rng.random())[:n]
        else:
            base = []
        lst = base + rng.choices(deps, weights=pesos, k=n - len(base))
        rng.shuffle(lst)
        return [self.sitio(rng, d) for d in lst]

    def sitio(self, rng, dep: str):
        ciudades = L.CIUDADES[dep]
        if dep == "11" or rng.random() < 0.55:
            cod = rng.choices(ciudades, weights=[3] + [1] * (len(ciudades) - 1))[0]
            return dep, cod, False
        otros = [m for m in self.munis[dep] if m not in ciudades] or self.munis[dep]
        return dep, rng.choice(otros), rng.random() < 0.5

    def familia(self, rng, dep: str) -> str:
        reg = L.REGION[dep]
        pesos = [L.FAMILIAS[k]["pesos"].get("pacifico" if (k == "afro" and dep in L.PACIFICO) else reg, 1) for k in L.CLAVES_FAMILIA]
        return rng.choices(L.CLAVES_FAMILIA, weights=pesos)[0]

    # ----------------------------------------------------------- personas
    def nombre_persona(self, rng, dep: str, fem: bool):
        reg = L.REGION[dep]
        for _ in range(60):
            primer = rng.choice(L.NOMBRES_F if fem else L.NOMBRES_M)
            segundo = rng.choice(L.SEGUNDOS) if rng.random() < 0.35 else None
            pool = L.APELLIDOS_REGION[reg] if rng.random() < 0.55 else L.APELLIDOS
            a1, a2 = rng.choice(pool), rng.choice(L.APELLIDOS)
            if (_norm(primer), _norm(a1)) in {(_norm(a), _norm(b)) for a, b in L.VETADOS} or a1 == a2:
                continue
            nombre = f"{primer}{' ' + segundo if segundo else ''} {a1} {a2}"
            if _norm(nombre) not in self.nombres_usados:
                self.nombres_usados.add(_norm(nombre))
                return primer, segundo, a1, a2
        raise RuntimeError("sin nombres disponibles")

    def crear_personas(self):
        for nivel in (2, 3):
            rng = random.Random(f"{self.semilla}:masivo:personas:{nivel}")
            for dep, cod, rural in self.lugares(rng, self.cuota("personas", nivel), 1 if nivel == 2 else 3):
                fam = self.familia(rng, dep)
                fem = rng.random() < 0.48
                primer, segundo, a1, a2 = self.nombre_persona(rng, dep, fem)
                clave = self.clave_unica(nivel, f"{primer} {a1} {a2}")
                self.contador_doc += 1
                u = rng.random()
                p = NS(tipo="persona", clave=clave, alias=f"persona.{clave}", nivel=nivel, primer=primer, segundo=segundo, a1=a1, a2=a2, fem=fem, dep=dep, cod=cod, rural=rural, fam=fam,
                       rol=rng.choice(L.FAMILIAS[fam]["roles"]), dias=int(rng.triangular(40, 3000, 900)), doc=f"DEMO-M{self.contador_doc:05d}",
                       tipo_doc="cc" if u < .93 else ("ce" if u < .97 else "pep"), tel=f"+57 {rng.choice(['300', '301', '310', '312', '320'])} 555 {self.contador_doc % 10000:04d}",
                       hub=rng.random() < 0.12, n_orgs=0, orgs=[], activa=rng.random() > 0.03, confirmada=(nivel == 2 and rng.random() > 0.01) or (nivel == 3 and rng.random() > 0.04),
                       ini=rng.randint(1992, 2022), visibilidad="solo_simus" if rng.random() < 0.06 else "publico", moderada=(nivel == 3 and rng.random() < 0.02),
                       n_larga=(nivel == 2) or rng.random() < 0.65, rng=rng)
                p.correo = self.correo_unico(p)
                self.personas.append(p)
        self.por_dep: dict = {}
        for i, p in enumerate(self.personas):
            self.por_dep.setdefault(p.dep, []).append(i)

    def correo_unico(self, p) -> str:
        base = f"{slug(p.primer, 14)}.{slug(p.a1, 14)}"
        i = 1
        while True:
            c = f"{base}.{i:03d}@simus.test"
            if c not in self.correos:
                self.correos.add(c)
                return c
            i += 1

    def elegir_persona(self, rng, dep: str, nivel: int, excluir=(), solo_activas=True, cerca=0.78):
        def ok(p):
            return (p.activa and p.confirmada) or not solo_activas
        cand = [self.personas[i] for i in self.por_dep.get(dep, []) if ok(self.personas[i]) and self.personas[i] not in excluir] if rng.random() < cerca else []
        if not cand:
            cand = [p for p in self.personas if ok(p) and p not in excluir and (L.REGION[p.dep] == L.REGION[dep] or rng.random() < 0.2)]
        if not cand:
            cand = [p for p in self.personas if ok(p) and p not in excluir]
        pesos = [(1 + 5 * p.hub) / (1 + 0.6 * p.n_orgs) * (1.4 if p.nivel == nivel else 1) for p in cand]
        return rng.choices(cand, weights=pesos)[0]

    # ----------------------------------------------------------- organizaciones y agrupaciones
    def nombre_org(self, rng, dep, cod, fam_key, es_agrup: bool) -> str:
        d, fam, muni = L.DEPTO[dep], L.FAMILIAS[fam_key], self.nombre_muni(cod)
        def f():
            if es_agrup:
                t = rng.choice(L.TIPOS_AGRUPACION_FAMILIA[fam_key])
                v = rng.random()
                if v < .34:
                    return f"{t} {rng.choice(fam['epitetos'])}"
                if v < .56:
                    return f"{t} {rng.choice(L.SUSTANTIVOS_ORG)} {T.de(L.geo_de(dep, cod, rng))}"
                if v < .78:
                    return f"{rng.choice(L.TERMINOS_AGRUPACION)} {muni if rng.random() < .5 else T.de(L.geo_de(dep, cod, rng)).split(' ', 1)[1]}".replace("Los de del", "Los del")
                return f"Los {rng.choice(L.APELLIDOS_REGION[L.REGION[dep]])} de {muni}"
            t = rng.choice(L.TIPOS_ORG)
            v = rng.random()
            if v < .36:
                return f"{t} {rng.choice(L.SUSTANTIVOS_ORG)} {T.de(L.geo_de(dep, cod, rng))}"
            if v < .62:
                return f"{t} {rng.choice(L.SUSTANTIVOS_ORG)} de {muni}"
            if v < .86:
                return f"{t} {rng.choice(fam['epitetos'])}"
            return f"{t} {rng.choice(L.SUSTANTIVOS_ORG)} y {rng.choice(L.SUSTANTIVOS_ORG)}"
        return self.nombre_unico(f)

    def crear_orgs(self):
        for nivel in (2, 3):
            rng = random.Random(f"{self.semilla}:masivo:orgs:{nivel}")
            for dep, cod, rural in self.lugares(rng, self.cuota("orgs", nivel), 1 if nivel == 2 else 2):
                fam = self.familia(rng, dep)
                agrup = rng.random() < FRACCION_AGRUPACION[nivel]
                nombre = self.nombre_org(rng, dep, cod, fam, agrup)
                clave = self.clave_unica(nivel, nombre)
                admin = self.elegir_persona(rng, dep, nivel)
                estado = pick_w(rng, ESTADOS_ORG[nivel])
                dias = rng.randint(8, max(9, min(2900, admin.dias - 6)))
                o = NS(tipo="agrupacion" if agrup else "organizacion", clave=clave, alias=f"org.{clave}", nivel=nivel, nombre=nombre, dep=dep, cod=cod, rural=rural, fam=fam, estado=estado, admin=admin, editores=[],
                       dias=dias, ini=rng.randint(2000, max(2001, self.hoy.year - max(1, dias // 365))), carga=0, procs=[], aliados=[], festis=[], rng=rng, tel=f"+57 {rng.choice(['601', '602', '604', '605', '607', '608'])} 555 {rng.randint(0, 9999):04d}",
                       barrio=rng.choice(L.BARRIOS), calle=rng.choice(L.CALLES), dir_n=(rng.randint(1, 99), rng.randint(1, 99), rng.randint(1, 99)))
                admin.n_orgs += 1
                admin.orgs.append(o)
                n_ed = rng.choice([1, 1, 2, 2, 3, 4, 5]) if agrup else rng.choice([0, 0, 0, 1, 1, 2, 3])
                if estado == "eliminada":
                    n_ed = 0
                excl = {admin}
                for _ in range(n_ed):
                    e = self.elegir_persona(rng, dep, nivel, excluir=excl, cerca=0.7)
                    excl.add(e)
                    o.editores.append(e)
                    e.n_orgs += 1
                    e.orgs.append(o)
                self.orgs.append(o)

    def orgs_posibles(self, estado: str, agrup_ok=False):
        def ok(o):
            if o.tipo == "agrupacion" and not agrup_ok:
                return False
            if estado == "archivado":
                return o.estado in ("activa", "inactiva")
            if estado == "borrador":
                return o.estado in ("activa", "pendiente_de_confirmacion")
            return o.estado == "activa"
        return [o for o in self.orgs if ok(o)]

    def elegir_org(self, rng, dep, estado, agrup_ok=False):
        pool = self.orgs_posibles(estado, agrup_ok and rng.random() < 0.12)
        cerca = [o for o in pool if o.dep == dep]
        cand = cerca if (cerca and rng.random() < 0.8) else pool
        if not cand:
            cand = self.orgs_posibles("publicado") or self.orgs
        return rng.choices(cand, weights=[(1 + o.carga) ** 1.15 if o.carga < 8 else 3 for o in cand])[0]

    # ----------------------------------------------------------- historiales
    def pasos(self, rng, estado: str, dias: int, rico: bool) -> list:
        """Recorrido con fechas decrecientes (hace cuántos días) y actores; lleva siempre al estado actual."""
        seq = {"borrador": ["alta"], "en_revision": ["alta", "envio"], "publicado": ["alta", "envio", "pub"], "ajustes_solicitados": ["alta", "envio", "aj"], "rechazado": ["alta", "envio", "rech"],
               "archivado": ["alta", "envio", "pub", "arch"]}[estado]
        if rico and estado in ("publicado", "archivado", "rechazado", "ajustes_solicitados") and rng.random() < 0.7:
            i = seq.index("pub") if "pub" in seq else (seq.index("rech") if "rech" in seq else seq.index("aj"))
            seq = seq[:i] + (["aj", "envio"] if estado != "ajustes_solicitados" else ["aj", "envio"]) + seq[i:]
        n = len(seq)
        extra = sorted((rng.randint(0, max(dias - 1, 0)) for _ in range(n - 1)), reverse=True)
        tiempos = [dias] + extra
        pasos, actual, comentarios = [], None, {
            "aj": ["Falta confirmar las fechas de la última edición; complete ese dato y vuelva a enviar.", "La descripción no explica el alcance real del proceso; amplíela antes de reenviar.", "Verifique el municipio y la sede indicados.",
                   "Agregue la organización responsable y un medio de contacto vigente.", "Se pide precisar las prácticas musicales que se trabajan.", "Faltan datos de contacto; añádalos y envíe de nuevo.",
                   "Revise la periodicidad: no coincide con las ediciones registradas.", "Complete la descripción con la población que participa."],
            "pub": ["Cumple los criterios de la ficha.", "Información completa y coherente; se publica.", "Revisada sin observaciones.", "Ajustes atendidos; queda publicada."],
        }
        for i, paso in enumerate(seq):
            d = tiempos[i]
            if paso == "alta":
                nuevo, accion, coment, motivo, actor = "borrador", "Alta", None, None, "org"
            elif paso == "envio":
                nuevo, accion, coment, motivo, actor = "en_revision", "EnviadoARevision", None, None, "org"
            elif paso == "pub":
                nuevo, accion, coment, motivo, actor = "publicado", "Publicado", rng.choice(comentarios["pub"]), None, "gestion"
            elif paso == "aj":
                nuevo, accion, coment, motivo, actor = "ajustes_solicitados", "EstadoCambiado", rng.choice(comentarios["aj"]), None, "gestion"
            elif paso == "rech":
                nuevo, accion, coment, motivo, actor = "rechazado", "RechazadoEnRevision", None, rng.choice(["La ficha no describe un proceso musical de alcance territorial; puede presentar otra con más detalle.",
                                                                                                          "El registro duplica una ficha existente; se sugiere solicitar la vinculación a esa ficha.", "La información entregada no permite identificar la organización responsable."]), "gestion"
            else:
                nuevo, accion, coment, motivo, actor = "archivado", "Archivado", rng.choice(["Archivado por la organización: el proceso se pausó.", "Archivado: la edición más reciente concluyó y no hay nuevas fechas.", "La organización archivó la ficha mientras define su calendario."]), None, "org"
            pasos.append((actual, nuevo, accion, d, coment, motivo, actor))
            actual = nuevo
        return pasos

    @staticmethod
    def fechas_de_pasos(plan_momento, pasos) -> dict:
        out = {}
        for _, nuevo, _, d, _, _, _ in pasos:
            if nuevo == "en_revision":
                out["FechaEnvioARevision"] = plan_momento(d)
            elif nuevo == "publicado":
                out["FechaPublicacion"] = plan_momento(d)
            elif nuevo == "archivado":
                out["FechaArchivado"] = plan_momento(d)
        return out

    # ----------------------------------------------------------- festivales y ediciones
    def serie(self, rng, tray: str, per: str, mes: int, dia: int, dur: int, estado: str, ini_f: int) -> tuple:
        hoy = self.hoy
        step = 2 if per == "bienal" else 1
        yf = hoy.year if rng.random() < 0.6 else hoy.year + 1
        if tray == "ninguna":
            ys = []
        elif tray == "futura":
            ys = [hoy.year + 1]
        elif tray == "cerrado":          # ciclo que terminó: ediciones entre 2018 y un año ya pasado
            y1 = rng.randint(2021, hoy.year - 2)
            ys = [y for y in (y1 - k * step for k in range(rng.randint(2, 5))) if y >= 2018][::-1]
        else:
            n = {"larga": rng.randint(6, 9), "media": rng.randint(3, 4), "corta": 2, "unica": 1, "interrumpida": rng.randint(5, 7)}[tray]
            n = min(n, (yf - 2018) // step + 1)
            ys = [yf - k * step for k in range(n)][::-1]
            if tray == "interrumpida" and len(ys) >= 4:
                ys.pop(rng.randint(1, len(ys) - 2))
        eds = []
        for y in ys:
            m = min(12, max(1, mes + rng.choice([0, 0, 0, 1, -1])))
            d = max(1, min(26, dia + rng.randint(-3, 3)))
            ini = dt.date(y, m, d)
            fin = ini + dt.timedelta(days=dur - 1)
            est = "realizada"
            if y > hoy.year:
                est = "programada" if rng.random() < 0.7 else "en_preparacion"
                if est == "en_preparacion" and rng.random() < 0.55:
                    ini = fin = None
            elif y == hoy.year:
                if fin >= hoy:
                    if ini > hoy:
                        est = "programada"
                    else:
                        ini = hoy + dt.timedelta(days=rng.randint(6, 36))
                        fin = ini + dt.timedelta(days=dur - 1)
                        est = "programada"
            if est == "realizada" and ((y == 2020 and rng.random() < 0.65) or (y == 2021 and rng.random() < 0.2) or rng.random() < 0.05):
                est = "cancelada"
            eds.append(NS(anio=y, estado=est, ini=ini, fin=fin))
        if estado == "archivado":
            eds = [e for e in eds if e.estado in ("realizada", "cancelada")]
        elif estado in ("borrador", "en_revision", "ajustes_solicitados", "rechazado"):
            eds = eds[-2:]
        previas = 0
        if eds:
            previas = max(0, (eds[0].anio - ini_f) // step) if ini_f < eds[0].anio else 0
        k = previas
        for e in eds:
            if e.estado == "cancelada":
                e.num = None
            else:
                k += 1
                e.num = k
        return eds, previas

    def crear_festivales(self):
        for nivel in (2, 3):
            rng = random.Random(f"{self.semilla}:masivo:festivales:{nivel}")
            for dep, cod, rural in self.lugares(rng, self.cuota("festivales", nivel), 1):
                fam = self.familia(rng, dep)
                estado = pick_w(rng, ESTADOS_PROCESO[nivel])
                org = self.elegir_org(rng, dep, estado, agrup_ok=True)
                org.carga += 1
                tray = pick_w(rng, list(TRAYECTORIAS[nivel].items()))
                if estado == "archivado" and tray in ("futura",):
                    tray = "cerrado"
                per = "bienal" if rng.random() < 0.10 else ("intermitente" if tray == "interrumpida" and rng.random() < 0.4 else "anual")
                mes, dia, dur = rng.choice([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), rng.randint(2, 24), rng.choice([1, 2, 2, 3, 3, 4])
                ini_f = rng.randint(2004, 2024)
                eds, previas = self.serie(rng, tray, per, mes, dia, dur, estado, ini_f)
                if eds:
                    ini_f = min(ini_f, eds[0].anio)
                nombre = self.nombre_festival(rng, dep, cod, fam)
                clave = self.clave_unica(nivel, nombre)
                cob = "municipal"
                if not rural and rng.random() < (0.15 if nivel == 2 else 0.08):
                    cob = rng.choice(["departamental", "departamental", "nacional"])
                dias = rng.randint(3, max(4, min(org.dias - 4, 2800)))
                f = NS(tipo="festival", clave=clave, alias=f"festival.{clave}", nivel=nivel, nombre=nombre, dep=dep, cod=cod, rural=rural, fam=fam, estado=estado, org=org, dias=dias, ini=ini_f, per=per,
                       tray=tray, eds=eds, previas=previas, mes=mes, dir=None, aliados=[], parts=[], cob=cob, rng=rng, tipologia=TIPOLOGIA.get(fam, "festival-de-musica"), dur=dur,
                       equipo=[org.admin] + org.editores, previas_n=previas)
                f.dir = rng.choice(f.equipo)
                # aliados: otras organizaciones activas, preferentemente de la misma región
                n_al = rng.choice([0, 1, 1, 2, 3]) if nivel == 2 else rng.choice([0, 0, 0, 1, 1, 2])
                cand = [o for o in self.orgs if o is not org and o.tipo == "organizacion" and o.estado == "activa"]
                cand.sort(key=lambda o: (0 if o.dep == dep else (1 if L.REGION[o.dep] == L.REGION[dep] else 2), rng.random()))
                f.aliados = cand[:n_al] if rng.random() < 0.8 else rng.sample(cand, min(n_al, len(cand)))
                for a in f.aliados:
                    a.carga += 0.5
                    org.aliados.append(a)
                    a.aliados.append(org)
                self.festivales.append(f)
        # participación de agrupaciones (simétrica por construcción: cada arista se menciona en ambos textos)
        agr = [o for o in self.orgs if o.tipo == "agrupacion" and o.estado in ("activa", "inactiva")]
        rng = random.Random(f"{self.semilla}:masivo:participan")
        for f in self.festivales:
            if f.estado not in ("publicado", "archivado"):
                continue
            n_p = rng.choice([1, 2, 2, 3]) if f.nivel == 2 else rng.choice([0, 0, 1, 1, 2])
            cand = [o for o in agr if len(o.festis) < 2 and L.REGION[o.dep] == L.REGION[f.dep]]
            cand.sort(key=lambda o: (0 if o.dep == f.dep else 1, rng.random()))
            for o in cand[:n_p]:
                f.parts.append(o)
                o.festis.append(f)
                self.aristas_participa.append((o, f))

    def nombre_festival(self, rng, dep, cod, fam_key) -> str:
        d, fam, muni = L.DEPTO[dep], L.FAMILIAS[fam_key], self.nombre_muni(cod)
        def f():
            t = rng.choice(L.FESTIVAL_TIPOS)
            v = rng.random()
            if t in ("Noches", "Semana", "Cita", "Ruta", "Gran Rueda", "Carnaval", "Feria", "Fiesta", "Concurso", "Jornadas"):
                gen = rng.choice(fam["gen"].get("pacifico" if (fam_key == "afro" and dep in L.PACIFICO) else L.REGION[dep]) or fam["gen"].get("*"))
                return f"{t} de {gen}".replace("de música", "de la música") + (f" {T.de(L.geo_de(dep, cod, rng))}" if v < .5 else f" de {muni}")
            if v < .45:
                return f"{t} {rng.choice(fam['epitetos'])}"
            if v < .75:
                return f"{t} {rng.choice(fam['epitetos'])} de {muni}"
            return f"{t} {rng.choice(fam['epitetos'])} {T.de(L.geo_de(dep, cod, rng))}"
        return self.nombre_unico(f)

    # ----------------------------------------------------------- mercados
    def crear_mercados(self):
        for nivel in (2, 3):
            rng = random.Random(f"{self.semilla}:masivo:mercados:{nivel}")
            for dep, cod, rural in self.lugares(rng, self.cuota("mercados", nivel), 0):
                fam = self.familia(rng, dep)
                estado = pick_w(rng, [("publicado", .6), ("en_revision", .12), ("borrador", .1), ("ajustes_solicitados", .08), ("archivado", .06), ("rechazado", .04)])
                fest = None
                if rng.random() < 0.3:
                    cand = [f for f in self.festivales if f.estado == "publicado" and f.org.estado == "activa" and f.nivel == nivel] or [f for f in self.festivales if f.estado == "publicado" and f.org.estado == "activa"]
                    if cand:
                        fest = rng.choice(cand)
                        dep, cod, rural, fam = fest.dep, fest.cod, fest.rural, fest.fam
                org = fest.org if fest else self.elegir_org(rng, dep, estado)
                org.carga += 1
                d = L.DEPTO[dep]
                nombre = self.nombre_unico(lambda: f"{rng.choice(L.MERCADO_TIPOS)} {rng.choice(['Sonoro', 'Musical', 'de Músicas', 'de Circulación Musical', 'de Industrias Musicales'])} {T.de(L.geo_de(dep, cod, rng))}"
                                           if rng.random() < .6 else f"{rng.choice(L.MERCADO_TIPOS)} {rng.choice(L.FAMILIAS[fam]['epitetos'])}")
                clave = self.clave_unica(nivel, nombre)
                n_ed = rng.choice([1, 2, 2, 3, 4]) if nivel == 2 else rng.choice([0, 1, 1, 2])
                yf = self.hoy.year + (1 if rng.random() < .4 else 0)
                anios = [yf - k for k in range(n_ed)][::-1]
                anios = [a for a in anios if a >= 2018]
                ini_m = rng.randint(2010, 2024)
                if estado == "archivado":
                    anios = [a for a in anios if a <= self.hoy.year]
                if estado in ("borrador", "en_revision", "ajustes_solicitados", "rechazado"):
                    anios = anios[-1:]
                m = NS(tipo="mercado", clave=clave, alias=f"mercado.{clave}", nivel=nivel, nombre=nombre, dep=dep, cod=cod, rural=rural, fam=fam, estado=estado, org=org, fest=fest, anios=anios,
                       dias=rng.randint(3, max(4, min(org.dias - 4, 2500))), ini=min([ini_m] + anios), rng=rng, modalidad=pick_w(rng, [("presencial", 60), ("mixta", 25), ("virtual", 15)]),
                       alcance=pick_w(rng, [("local", 20), ("regional", 45), ("nacional", 30), ("internacional", 5)]), mes=rng.randint(3, 10), dia=rng.randint(2, 24))
                self.mercados.append(m)

    # ----------------------------------------------------------- redes, talleres, espacios
    def crear_simples(self):
        spec = {"redes": ("redes", {"red": 40, "archivo": 15, "coleccion": 15, "centro_de_documentacion": 15, "grupo_de_investigacion": 15}),
                "talleres": ("talleres", {"fijo": 55, "itinerante": 20, "colectivo": 25}), "espacios": ("espacios", {"cerrado": 50, "abierto": 30, "mixto": 20})}
        for clave_t, (tabla, variantes) in spec.items():
            for nivel in (2, 3):
                rng = random.Random(f"{self.semilla}:masivo:{clave_t}:{nivel}")
                for dep, cod, rural in self.lugares(rng, self.cuota(clave_t, nivel), 0):
                    fam = self.familia(rng, dep)
                    variante = pick_w(rng, list(variantes.items()))
                    if clave_t == "redes" and variante != "red" and fam not in L.FAMILIAS_ARCHIVO:
                        fam = rng.choice(L.FAMILIAS_ARCHIVO)
                    if clave_t == "talleres" and fam not in L.FAMILIAS_LUTERIA:
                        fam = rng.choice(L.FAMILIAS_LUTERIA)
                    estado = pick_w(rng, ESTADOS_PROCESO[nivel])
                    persona = None
                    org = None
                    if rng.random() < 0.35:
                        persona = self.elegir_persona(rng, dep, nivel)
                        persona.n_orgs += 0
                    else:
                        org = self.elegir_org(rng, dep, estado)
                        org.carga += 1
                    nombre = self.nombre_simple(rng, clave_t, variante, dep, cod, fam)
                    clave = self.clave_unica(nivel, nombre)
                    base_dias = (org.dias if org else persona.dias)
                    p = NS(tipo=clave_t, clave=clave, alias=f"{tabla}.{clave}", nivel=nivel, nombre=nombre, dep=dep, cod=cod, rural=rural, fam=fam, estado=estado, org=org, persona=persona, variante=variante,
                           dias=rng.randint(3, max(4, min(base_dias - 4, 2500))), ini=rng.randint(2008, 2024), rng=rng, aforo=rng.choice(L.AFORO_POR_AMBIENTE.get(variante, [80])))
                    self.procesos[clave_t].append(p)

    def nombre_simple(self, rng, tipo, variante, dep, cod, fam_key) -> str:
        d, fam, muni = L.DEPTO[dep], L.FAMILIAS[fam_key], self.nombre_muni(cod)
        reg = "pacifico" if (fam_key == "afro" and dep in L.PACIFICO) else L.REGION[dep]
        ins = rng.choice(fam["instr"].get(reg) or fam["instr"].get("*") or fam["instr"]["andina"])
        def f():
            v = rng.random()
            if tipo == "redes":
                tema = {"red": ["de Músicos", "de Escuelas de Música", "de Gestores Musicales", "de Maestros y Aprendices"], "archivo": ["Sonoro", "Sonoro y Fotográfico", "de Memoria Musical"],
                        "coleccion": ["de Discos y Partituras", "de Programas de Mano", "de Casetes y Cintas"], "centro_de_documentacion": ["de Documentación Musical"],
                        "grupo_de_investigacion": ["de Investigación en Músicas"]}[variante]
                base = {"red": "Red", "archivo": "Archivo", "coleccion": "Colección", "centro_de_documentacion": "Centro", "grupo_de_investigacion": "Grupo"}[variante]
                return f"{base} {rng.choice(tema)} {T.de(L.geo_de(dep, cod, rng))}" if v < .6 else f"{base} {rng.choice(tema)} {rng.choice(fam['epitetos'])}"
            if tipo == "talleres":
                t = rng.choice(L.TALLER_TIPOS)
                return f"{t} de {ins} {T.de(L.geo_de(dep, cod, rng))}" if v < .4 else (f"{t} {rng.choice(L.SUSTANTIVOS_ORG)} de {muni}" if v < .75 else f"{t} {rng.choice(fam['epitetos'])}")
            t = rng.choice(L.ESPACIO_POR_AMBIENTE[variante])
            return f"{t} {rng.choice(fam['epitetos'])}" if v < .5 else (f"{t} {rng.choice(L.SUSTANTIVOS_ORG)} de {muni}" if v < .8 else f"{t} {rng.choice(L.SUSTANTIVOS_ORG)} {T.de(L.geo_de(dep, cod, rng))}")
        return self.nombre_unico(f)

    # ----------------------------------------------------------- eventos
    def crear_eventos(self):
        padres = [("festival", f) for f in self.festivales if f.estado in ("publicado", "archivado")] + [("mercado", m) for m in self.mercados if m.estado == "publicado"] + \
                 [("taller", p) for p in self.procesos["talleres"] if p.estado == "publicado"] + [("espacio", p) for p in self.procesos["espacios"] if p.estado == "publicado"] + \
                 [("red", p) for p in self.procesos["redes"] if p.estado == "publicado"]
        usados_slug: set = set()
        for nivel in (2, 3):
            rng = random.Random(f"{self.semilla}:masivo:eventos:{nivel}")
            for dep, cod, rural in self.lugares(rng, self.cuota("eventos", nivel), 1 if nivel == 3 else 0):
                vinculo = None
                if padres and rng.random() < 0.7:
                    cercanos = [p for p in padres if p[1].dep == dep] or padres
                    vinculo = rng.choice(cercanos) if rng.random() < 0.8 else rng.choice(padres)
                    dep, cod, rural = vinculo[1].dep, vinculo[1].cod, vinculo[1].rural
                fam = vinculo[1].fam if vinculo else self.familia(rng, dep)
                cat = {"festival": "festivales", "mercado": rng.choice(["encuentros-y-dialogos", "conciertos-y-presentaciones"]), "taller": "formacion", "espacio": "conciertos-y-presentaciones",
                       "red": "encuentros-y-dialogos", None: None}[vinculo[0] if vinculo else None] or pick_w(rng, [("conciertos-y-presentaciones", 38), ("formacion", 24), ("encuentros-y-dialogos", 20), ("convocatorias", 10), ("festivales", 8)])
                # fecha: dentro de una edición del festival vinculado, o a lo largo de 2018-2027 con más peso reciente
                inicio = fin = None
                if vinculo and vinculo[0] == "festival" and [e for e in vinculo[1].eds if e.ini]:
                    e = rng.choice([e for e in vinculo[1].eds if e.ini])
                    inicio = e.ini + dt.timedelta(days=rng.randint(0, max((e.fin - e.ini).days, 0)))
                    fin = inicio if rng.random() < 0.7 else min(e.fin, inicio + dt.timedelta(days=1))
                if inicio is None:
                    if rng.random() < 0.24:      # próximos meses
                        base = self.hoy + dt.timedelta(days=rng.randint(3, 300))
                    else:                        # pasado, con más peso reciente
                        base = dt.date(2018, 1, 15) + dt.timedelta(days=int(rng.triangular(0, (self.hoy - dt.date(2018, 1, 15)).days - 3, 3000)))
                    inicio, fin = base, (base + dt.timedelta(days=rng.choice([1, 2])) if rng.random() < 0.2 else None)
                futuro = inicio > self.hoy
                if futuro:
                    estado = pick_w(rng, [("publicado", 55), ("en_revision", 15), ("borrador", 20), ("rechazado", 5), ("archivado", 5)]) if inicio > self.hoy + dt.timedelta(days=60) else pick_w(rng, [("publicado", 80), ("en_revision", 12), ("borrador", 8)])
                    if estado == "archivado":
                        estado = "publicado"
                else:
                    estado = pick_w(rng, [("publicado", 80), ("archivado", 14), ("rechazado", 3), ("borrador", 3)])
                org = vinculo[1].org if vinculo else None
                persona = vinculo[1].persona if (vinculo and getattr(vinculo[1], "persona", None)) else None
                if org is None and persona is None:
                    cand = [o for o in self.orgs if o.dep == dep and o.estado == "activa"] or [o for o in self.orgs if o.estado == "activa"]
                    org = rng.choice(cand)
                modalidad = pick_w(rng, [("presencial", 80), ("mixta", 8), ("virtual", 12)])
                ev = NS(tipo="evento", nivel=nivel, dep=dep, cod=cod, rural=rural, fam=fam, cat=cat, vinculo=vinculo, inicio=inicio, fin=fin, estado=estado, org=org, persona=persona, modalidad=modalidad, rng=rng,
                        cancelado=(estado == "publicado" and rng.random() < 0.06), n_ref=len(self.eventos))
                self.eventos.append(ev)

    # ----------------------------------------------------------- redacción (textos) una vez armado el grafo
    def contexto(self, e, alias: str):
        g = self.gen(alias)
        x = T.preparar(g, e.dep, e.cod, e.fam, e.rural)
        return g, x

    def lista_nombres(self, objs, tope: int) -> str:
        return T.lista([f"«{o.nombre}»" for o in objs[:tope]])

    def redactar(self):
        for p in self.personas:
            g, x = self.contexto(p, p.alias)
            x.update(rol=p.rol, fem=p.fem, primer=p.primer, ini=p.ini, lugar_o=g.rng.choice([f"el barrio {p.rng.choice(L.BARRIOS)} de {x['muni']}", f"la vereda {x['vereda']}", f"una finca cerca de {x['muni']}", f"el casco urbano de {x['muni']}"]))
            nombres_orgs = [o.nombre for o in p.orgs if o.estado in ("activa", "inactiva")][:2]
            x["orgs"] = T.lista([f"«{n}»" for n in nombres_orgs]) if nombres_orgs else ""
            p.x = x
            p.corta = T.persona_corta(g, x)
            p.larga = T.persona_larga(g, x, breve=(p.nivel == 3)) if p.n_larga else None
        for o in self.orgs:
            g, x = self.contexto(o, o.alias)
            x.update(nombre=o.nombre, ini=o.ini, admin=o.admin.primer + " " + o.admin.a1 + " " + o.admin.a2)
            procs = [f for f in self.festivales if f.org is o and f.estado in ("publicado", "archivado")] + [m for m in self.mercados if m.org is o and m.estado == "publicado"] + \
                    [p for t in self.procesos.values() for p in t if p.org is o and p.estado in ("publicado", "archivado")]
            x["procs"] = self.lista_nombres(procs, 3) if procs else ""
            vistos, al = set(), []
            for a in o.aliados:
                if a.estado == "activa" and a.nombre not in vistos:
                    vistos.add(a.nombre)
                    al.append(a)
            x["aliados"] = self.lista_nombres(al, 2) if al else ""
            x["festis"] = self.lista_nombres(o.festis, 2) if o.festis else ""
            o.x = x
            o.desc = T.agrupacion_desc(g, x, o.nivel) if o.tipo == "agrupacion" else T.org_desc(g, x, o.nivel)
        for f in self.festivales:
            g, x = self.contexto(f, f.alias)
            r = g.rng
            x.update(nombre=f.nombre, ini=f.ini, org=f"«{f.org.nombre}»", aliados=self.lista_nombres(f.aliados, 3) if f.aliados else "", parts=self.lista_nombres(f.parts, 3) if f.parts else "",
                     traj=T.trayectoria_txt(g, [e.anio for e in f.eds], [e.estado for e in f.eds], f.nombre) if f.eds and f.nivel == 2 else "")
            f.x = x
            f.desc = T.festival_desc(g, x, f.nivel)
            f.per_detalle = {"anual": f"Se realiza cada año, por lo general en {MESES_TXT[f.mes - 1]}; la fecha exacta se anuncia con la convocatoria.", "bienal": f"Se realiza cada dos años, en {MESES_TXT[f.mes - 1]} del año de la edición.",
                             "intermitente": f"Se ha realizado de forma intermitente; cuando hay edición suele ser en {MESES_TXT[f.mes - 1]}."}[f.per]
            lugares_ed = []
            for k, e in enumerate(f.eds):
                ge = self.gen(f"{f.alias}.edicion.{e.anio}")
                re_ = ge.rng
                e.lugar = T.lugar_de(re_, f.rural)
                nov = re_.choice(T.NOVEDADES)
                v = re_.choice(T.NOVEDAD_VERBOS)
                hecho = re_.choice([f"{v[0]} {nov}"] * 3 + T.CAMBIOS_SEDE)
                xe = dict(anio=e.anio, nombre=f.nombre, Nombre=f.nombre, ordinal=e.num or "", lugar=e.lugar, acts=x["acts"] if k % 2 == 0 else x["acts2"], lema=re_.choice(T.LEMAS), hecho=hecho, hecho_f=f"el festival {v[1]} {nov}",
                          hecho_f2=f"el festival {hecho}", Hecho_c=f"El festival {hecho}", n_ag=re_.randint(6, 28), n_tall=re_.randint(1, 6), publico=re_.choice([300, 450, 800, 1200, 2500, 4000]), dias=re_.randint(1, 4),
                          motivo=re_.choice(T.MOTIVOS_CANCELACION), muni=x["muni"])
                if e.estado == "cancelada" and e.anio == 2020:
                    xe["motivo"] = "la emergencia sanitaria"
                e.desc = T.edicion_desc(ge, xe, e.estado, f.nivel)
                e.director = f.dir
                e.fuente1 = re_.choice(FUENTES)
                e.fuente2 = re_.choice([x_ for x_ in FUENTES if x_ != e.fuente1])
                e.fuente2_usa = re_.random() < 0.5
                e.estampilla = re_.random() < 0.3
        for m in self.mercados:
            g, x = self.contexto(m, m.alias)
            x.update(nombre=m.nombre, ini=m.ini, un_tipo=next((v for k, v in L.TIPO_MERCADO_ART.items() if m.nombre.startswith(k)), "una plataforma"), modalidad=m.modalidad, alcance=m.alcance,
                     festival=f"«{m.fest.nombre}»" if m.fest else "", org=m.org.nombre)
            m.x = x
            m.desc = T.mercado_desc(g, x, m.nivel)
            m.eds_desc = {}
            for a in m.anios:
                ge = self.gen(f"{m.alias}.edicion.{a}")
                m.eds_desc[a] = T.edicion_desc(ge, dict(anio=a, nombre=m.nombre, Nombre=m.nombre, ordinal=a - m.ini + 1, lugar=T.lugar_de(ge.rng, m.rural), acts=x["acts"], lema=ge.rng.choice(T.LEMAS),
                                                      hecho=f"abrió {ge.rng.choice(T.NOVEDADES)}", hecho_f=f"el mercado abrirá {ge.rng.choice(T.NOVEDADES)}", hecho_f2="el mercado creció", Hecho_c="El mercado creció",
                                                      n_ag=ge.rng.randint(20, 80), n_tall=ge.rng.randint(1, 5), publico=ge.rng.choice([200, 350, 600]), dias=ge.rng.randint(1, 3), motivo=ge.rng.choice(T.MOTIVOS_CANCELACION)),
                                                 "programada" if a > self.hoy.year else "realizada", m.nivel)
        for t, lst in self.procesos.items():
            for p in lst:
                g, x = self.contexto(p, p.alias)
                x.update(ini=p.ini, org=p.org.nombre if p.org else "")
                if t == "redes":
                    x.update(tipo=p.variante)
                    p.desc = T.red_desc(g, x, p.nivel)
                elif t == "talleres":
                    x.update(modalidad_txt={"fijo": "fijo", "itinerante": "itinerante", "colectivo": "colectivo"}[p.variante])
                    p.desc = T.taller_desc(g, x, p.nivel)
                else:
                    tp = p.nombre.split(" ")[0]
                    fem = tp in ("Sala", "Tarima", "Casa", "Cancha")
                    x.update(tipo=tp, tipo_l=tp.lower(), amb_txt={"cerrado": "cerrada" if fem else "cerrado", "abierto": "al aire libre", "mixto": "mixta" if fem else "mixto"}[p.variante],
                             amb_m={"cerrado": "cerrado", "abierto": "al aire libre", "mixto": "mixto"}[p.variante], aforo=p.aforo)
                    p.desc = T.espacio_desc(g, x, p.nivel)
                p.x = x
        for ev in self.eventos:
            alias = f"evento.n{ev.nivel}.{ev.n_ref:03d}"
            ev.alias = alias
            g, x = self.contexto(ev, alias)
            r = g.rng
            x.update(Gen=T.cap(x["gen"]), lugar_t=x["lugar"], tema=r.choice(T.TEMAS_DIALOGO), n_ag=r.randint(25, 220))
            ev.titulo = g.banco.producir("EventosAgenda.Titulo", lambda: r.choice(T.TITULOS_EVENTO[ev.cat]).format(**x), 290)
            ev.organizador = (ev.org.nombre if ev.org else f"{ev.persona.primer} {ev.persona.a1} {ev.persona.a2}")
            x["organizador"] = ev.organizador
            x["lugar_txt"] = x["lugar"]
            x["titulo"] = ev.titulo
            ev.x = x
            ev.desc = T.evento_desc(g, x)
            ev.largo = T.evento_largo(g, x)
            s = slug(f"{ev.titulo} {x['muni']} {ev.inicio.year}", 150)
            k, i = s, 2
            while k in getattr(self, "_slugs", set()):
                k = f"{s}-{i}"
                i += 1
            self._slugs = getattr(self, "_slugs", set()) | {k}
            ev.slug = k

    def construir(self):
        self.crear_personas()
        self.crear_orgs()
        self.crear_festivales()
        self.crear_mercados()
        self.crear_simples()
        self.crear_eventos()
        self.redactar()
        return self

    # ----------------------------------------------------------- emisión de filas
    def emitir(self, plan, c):
        from constructores import momento
        self.plan, self.c = plan, c
        hoy = plan.hoy
        M = lambda d, h=10: momento(plan, max(int(d), 0), h)
        gestor = c.gestor

        def meta(nivel, tipo):
            return dict(lote=f"n{nivel}-masivo-{tipo}", nivel=nivel, procedencia="sintetico")

        def fecha_en(d: dt.date) -> int:
            return max((hoy - d).days, 0)

        def practicas_fam(fam_key):
            return [L.FAMILIAS[fam_key]["slug"]]

        # ---- personas (cuentas)
        for nivel in (2, 3):
            for p in (x for x in self.personas if x.nivel == nivel):
                m = meta(nivel, "personas")
                r = p.rng
                nombre_completo = f"{p.primer}{' ' + p.segundo if p.segundo else ''} {p.a1} {p.a2}"
                c.add("Usuarios", {
                    "NombreCompleto": nombre_completo, "CorreoElectronico": p.correo, "HashContrasena": HASH, "CanalAcceso": "externo", "TipoPerfil": "individual", "Activo": p.activa,
                    "FechaCreacion": M(p.dias), "UltimoAcceso": M(r.randint(0, 120), 15) if (p.activa and p.confirmada) else None, "Telefono": p.tel, "Identificacion": p.doc, "CodigoTipoDocumento": p.tipo_doc,
                    "CorreoConfirmado": p.confirmada, "FechaConfirmacionCorreo": M(p.dias - 1, 11) if p.confirmada else None, "PrimerNombre": p.primer, "SegundoNombre": p.segundo,
                    "PrimerApellido": p.a1, "SegundoApellido": p.a2, "DebeCambiarContrasena": not p.confirmada, "PerfilCompletado": p.confirmada, "ResidenciaCodigoDepartamento": p.dep,
                    "ResidenciaCodigoMunicipio": p.cod, "CanalDeContactoPreferido": r.choice(["correo", "correo", "telefono"]),
                }, alias=p.alias, **m)
                c.add("UsuariosRoles", {"IdUsuario": Ref(p.alias), "IdRol": Cat("Roles", "IdRol", "NombreRol", "externo")}, **m)

        # ---- organizaciones y agrupaciones
        for nivel in (2, 3):
            for o in (x for x in self.orgs if x.nivel == nivel):
                m = meta(nivel, "organizaciones")
                r = o.rng
                dom = slug(o.nombre, 50)
                x = o.x
                direccion = f"Vereda {x['vereda']}, {x['muni']}" if o.rural else f"{o.calle} {o.dir_n[0]} # {o.dir_n[1]}-{o.dir_n[2]}, barrio {o.barrio}"
                vals = {"TipoEntidad": "organizacion", "Nombre": o.nombre, "NombreLegal": o.nombre, "Descripcion": o.desc, "CorreoContacto": f"contacto@{dom}.test", "TelefonoContacto": o.tel,
                        "SitioWeb": f"https://{dom}.test" if (nivel == 2 or r.random() < 0.6) else None,
                        "Instagram": f"https://instagram.com/{dom[:28]}.test" if (nivel == 2 or r.random() < 0.5) else None, "Facebook": f"https://facebook.com/{dom[:40]}.test" if nivel == 2 and r.random() < 0.6 else None,
                        "Direccion": direccion if (nivel == 2 or r.random() < 0.6) else None, "EstadoRegistro": o.estado, "Activo": o.estado in ("activa", "pendiente_de_confirmacion"),
                        "IdUsuarioCreador": Ref(o.admin.alias), "IdUsuarioResponsable": Ref(o.admin.alias), "FechaCreacion": M(o.dias), "FechaActualizacion": M(o.dias - r.randint(5, 120)),
                        "EsInstitucional": False, "CodigoDepartamentoSede": o.dep, "CodigoMunicipioSede": o.cod}
                if o.estado in ("activa", "inactiva"):
                    vals.update(FechaRevision=M(o.dias - 3), FechaAprobacion=M(o.dias - 4), FechaPublicacion=M(o.dias - 4))
                    if r.random() < 0.4:
                        vals.update(FechaRevisionConsola=M(o.dias - 3), IdUsuarioRevisionConsola=gestor)
                c.add("Entidades", vals, alias=o.alias, **m)
                c.add("UsuariosEntidades", {"IdUsuario": Ref(o.admin.alias), "IdEntidad": Ref(o.alias), "RolEntidad": "administrador", "Activo": True, "FechaCreacion": M(o.dias)}, **m)
                for e in o.editores:
                    c.add("UsuariosEntidades", {"IdUsuario": Ref(e.alias), "IdEntidad": Ref(o.alias), "RolEntidad": "editor", "Activo": True, "FechaCreacion": M(max(o.dias - r.randint(2, 200), 0))}, **m)
                a = o.admin
                c.add("EntidadesResponsable", {
                    "IdEntidad": Ref(o.alias), "ResponsableNombre": f"{a.primer}{' ' + a.segundo if a.segundo else ''} {a.a1} {a.a2}", "ResponsableTipoDocumento": a.tipo_doc, "ResponsableNumeroDocumento": a.doc,
                    "ResponsableCorreo": a.correo, "ResponsableTelefono": a.tel, "ResponsableAutorizacionDatos": True, "ResponsableDesde": M(o.dias), "ResponsablePrimerNombre": a.primer,
                    "ResponsableSegundoNombre": a.segundo, "ResponsablePrimerApellido": a.a1, "ResponsableSegundoApellido": a.a2}, alias=None, **m)

        # ---- perfiles públicos (después de las organizaciones: citan sus identificadores)
        for nivel in (2, 3):
            for p in (x for x in self.personas if x.nivel == nivel and x.confirmada):
                m = meta(nivel, "perfiles")
                r = p.rng
                roles = [p.rol] + ([r.choice([k for k in L.FAMILIAS[p.fam]["roles"] if k != p.rol])] if r.random() < (0.7 if nivel == 2 else 0.3) else [])
                etiquetas_rol = [T.cap(T.OFICIOS[k][1 if p.fem else 0]) for k in roles]
                port = []
                if nivel == 2 or r.random() < 0.3:
                    for k in range(r.randint(1, 3) if nivel == 2 else 1):
                        tipo = r.choice(["audio", "video", "texto", "imagen", "enlace"])
                        titulo = {"audio": f"Registro de {p.x['gen']} en {p.x['muni']}", "video": f"Ensayo abierto de {p.x['gen2']}", "texto": f"Notas sobre {p.x['gen']} {p.x['en_geo']}",
                                  "imagen": f"Fotografías de {p.x['acts']}", "enlace": "Archivo personal de proyectos"}[tipo]
                        port.append({"tipo": tipo, "titulo": titulo, "url": f"https://archivo.simus.test/{slug(p.primer + p.a1, 30)}/{k + 1}", "descripcion": f"Material de trabajo reunido entre {p.ini + 2 * k} y {min(p.ini + 2 * k + 3, hoy.year)}.",
                                     "anio": min(p.ini + 2 * k + 2, hoy.year)})
                orgs_vis = [o for o in p.orgs if o.estado == "activa"][:3]
                v = {"IdUsuario": Ref(p.alias), "NombreVisible": f"{p.primer} {p.a1}", "CodigoMunicipio": p.cod, "FechaCreacion": M(p.dias - 1), "FechaActualizacion": M(r.randint(2, max(3, min(p.dias - 2, 400)))),
                     "NombreCivilVisible": r.random() < 0.6, "BiografiaCorta": p.corta, "BiografiaLarga": p.larga, "Visibilidad": p.visibilidad, "RolesJson": etiquetas_rol, "PortafolioJson": port or None}
                if orgs_vis:
                    v["OrganizacionesVisiblesJson"] = Raw("N'[' + " + " + N',' + ".join(f"CAST((SELECT IdRegistro FROM dbo.DatosDeDemostracion WHERE Alias = N'{o.alias}') AS nvarchar(20))" for o in orgs_vis) + " + N']'")
                if p.moderada:
                    v.update(OcultoPorModeracion=True, MotivoModeracion="El perfil incluía datos de contacto de terceras personas sin su consentimiento; se oculta hasta que se corrija.", FechaModeracion=M(r.randint(3, 60)), IdUsuarioModera=gestor)
                c.add("PerfilesPublicos", v, alias=f"{p.alias}.perfil", id_expr=Ref(p.alias), **m)
                fams = [p.fam] + ([self.familia(r, p.dep)] if r.random() < (0.55 if nivel == 2 else 0.2) else [])
                for s in dict.fromkeys(L.FAMILIAS[k]["slug"] for k in fams):
                    c.add("PerfilesPublicosPracticas", {"IdUsuario": Ref(p.alias), "IdPracticaMusical": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", s)}, alias=None, **m)
                clas = [("rol", k) for k in roles] + [("instrumento", k) for k in r.sample(L.FAMILIAS[p.fam]["inst_cod"], min(len(L.FAMILIAS[p.fam]["inst_cod"]), r.randint(1, 2)))]
                clas += [("servicio", s) for s in (SERVICIO_DE_ROL[p.rol] if nivel == 2 else SERVICIO_DE_ROL[p.rol][:1])]
                for dim, cod in dict.fromkeys(clas):
                    c.add("PerfilesPublicosClasificaciones", {"IdUsuario": Ref(p.alias), "Dimension": dim, "Codigo": cod}, alias=None, **m)
                if nivel == 2:
                    base = slug(p.primer + " " + p.a1, 30)
                    enlaces = [(f"https://{base}.simus.test", "Sitio personal"), (f"https://archivo.simus.test/{base}", "Archivo"), (f"https://instagram.com/{base}.test", "Instagram")]
                    for i, (url, et) in enumerate(enlaces[:r.randint(1, 3)], 1):
                        c.add("PerfilesPublicosEnlaces", {"IdUsuario": Ref(p.alias), "Orden": i, "Url": url, "Etiqueta": et}, alias=None, **m)
                for fin in (("perfil_publico", "terminos", "tratamiento") if nivel == 2 else ("perfil_publico",)):
                    c.add("AutorizacionesDatos", {"Finalidad": fin, "IdPolitica": Raw(f"(SELECT TOP 1 IdPolitica FROM dbo.PoliticasDatos WHERE Clave = N'{fin}' ORDER BY IdPolitica)"), "Version": "1.0",
                                                  "TextoAceptado": "Texto de la política vigente al momento de la aceptación.", "IdUsuario": Ref(p.alias), "Origen": "cuenta", "FechaOtorgada": M(p.dias - 1)},
                          alias=f"{p.alias}.autorizacion.{fin}", **m)

        def tipo_org(o):
            w = o.nombre.split(" ")[0]
            return {"Fundación": "fundacion", "Casa": "casa-cultural", "Colectivo": "comunitario", "Asociación": "comunitario"}.get(w, "comunitario" if o.tipo == "agrupacion" else "otro")

        def estampa_fechas(pasos):
            return Mundo.fechas_de_pasos(M, pasos)

        # ---- festivales y ediciones
        for nivel in (2, 3):
            for f in (x for x in self.festivales if x.nivel == nivel):
                m = meta(nivel, "festivales")
                r = f.rng
                dom = slug(f.nombre, 50)
                org = f.org
                vigentes = [e for e in f.eds if e.anio == hoy.year]
                ult = [e for e in f.eds if e.estado == "realizada" and e.fin]
                x = f.x
                nombre_dir = f"{f.dir.primer} {f.dir.a1} {f.dir.a2}"
                reales = sum(1 for e in f.eds if e.estado == "realizada")
                vals = {"NombreFestival": f.nombre, "NumeroEdiciones": (f.previas + reales) or None, "FechaUltimaEdicion": max((e.fin for e in ult), default=None), "Descripcion": f.desc,
                        "Organizador": org.nombre, "CorreoOrganizador": f"contacto@{slug(org.nombre, 50)}.test" if nivel == 2 else None, "CorreoFestival": f"info@{dom}.test",
                        "SitioWebFestival": f"https://{dom}.test" if (nivel == 2 or r.random() < 0.5) else None, "InstagramFestival": f"https://instagram.com/{dom[:28]}.test" if r.random() < (0.6 if nivel == 2 else 0.3) else None,
                        "TieneEdicionVigenteAnoActual": any(e.anio >= hoy.year and e.estado != "cancelada" for e in f.eds), "EstadoEdicionAnoActual": vigentes[0].estado if vigentes else None,
                        "FechaInicioEdicionActual": vigentes[0].ini if vigentes else None, "FechaFinEdicionActual": vigentes[0].fin if vigentes else None, "NivelCobertura": f.cob,
                        "CodigoDepartamento": None if f.cob == "nacional" else f.dep, "CodigoMunicipio": f.cod if f.cob == "municipal" else None, "EstadoRegistro": f.estado, "FechaCreacion": M(f.dias),
                        "FechaActualizacion": M(f.dias - r.randint(5, 200)), "OrganizacionPrincipalId": Ref(org.alias), "Periodicidad": f.per, "PeriodicidadDetalle": f.per_detalle,
                        "SedeCodigoDepartamento": f.dep, "SedeCodigoMunicipio": f.cod, "Director": nombre_dir, "TipoOrganizadorId": Cat("TiposOrganizador", "IdTipoOrganizador", "Slug", tipo_org(org))}
                c.add("Festivales", vals, alias=f.alias, **m)
                sl = practicas_fam(f.fam) + ([L.FAMILIAS[x2]["slug"] for x2 in [self.familia(r, f.dep)]] if r.random() < 0.3 else [])
                c.practicas("PracticasMusicalesDeRegistro", f.alias, list(dict.fromkeys(sl)), m["lote"], nivel, "sintetico", modulo="festivales")
                for ts in L.territorios_sonoros(f.dep, f.fam):
                    c.add("TerritoriosSonorosDeRegistro", {"ModuloId": "festivales", "RegistroId": Ref(f.alias, texto=True), "IdTerritorioSonoro": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", ts)}, alias=None, **m)
                pasos = self.pasos(r, f.estado, f.dias, rico=(nivel == 2 or r.random() < 0.3))
                c.historial(f.alias, "festivales", pasos, org.alias, org.nombre, m["lote"], nivel, "sintetico", None, Ref(org.admin.alias))
                n_envio = 0
                for i, (ant, nuevo, _, d, _, _, _) in enumerate(pasos):
                    if nuevo == "en_revision":
                        n_envio += 1
                        c.add("EnviosDeRevision", {"NumeroEnvio": n_envio, "IdUsuarioRemitente": Ref(org.admin.alias), "IdOrganizacion": Ref(org.alias), "EstadoAnterior": ant or "borrador",
                                                   "DatosJson": {"nombre": f.nombre, "municipio": f.cod, "estado": "en_revision"}, "FechaEnvio": M(d, 9 + i), "ModuloId": "festivales",
                                                   "RegistroId": Ref(f.alias, texto=True)}, alias=f"{f.alias}.envio.{n_envio}", **m)
                for a in f.aliados:
                    c.add("EntidadesAliadasDeRegistro", {"ModuloId": "festivales", "RegistroId": Ref(f.alias, texto=True), "NombreEntidadAliada": a.nombre, "EntidadId": Ref(a.alias)}, alias=None, **m)
                reg_e, vis_e = {"publicado": ("publicado", "publicada"), "archivado": ("archivado", "archivada"), "en_revision": ("en_revision", "borrador"), "ajustes_solicitados": ("ajustes_solicitados", "borrador")}.get(f.estado, ("borrador", "borrador"))
                fecha_f = hoy - dt.timedelta(days=f.dias)
                for e in f.eds:
                    re_ = self.gen(f"{f.alias}.edicion.{e.anio}.v").rng
                    cand = (e.ini - dt.timedelta(days=re_.randint(60, 200))) if e.ini else hoy - dt.timedelta(days=re_.randint(10, 90))
                    fe = max(fecha_f, min(cand, hoy - dt.timedelta(days=1)))
                    d_ed = fecha_en(fe)
                    alias_e = f"{f.alias}.edicion.{e.anio}"
                    ev = {"FestivalId": Ref(f.alias), "Anio": e.anio, "NumeroEdicion": e.num, "Nombre": f"{f.nombre} {e.anio}", "Descripcion": e.desc, "FechaInicio": e.ini, "FechaFin": e.fin, "Estado": e.estado,
                          "FechaCreacion": M(d_ed), "FechaActualizacion": M(d_ed - re_.randint(1, 60)), "Director": nombre_dir, "EstadoRegistro": reg_e, "EstadoVisibilidad": vis_e,
                          "TipologiaFestivalId": Cat("TipologiasFestival", "IdTipologiaFestival", "Slug", f.tipologia)}
                    if nivel == 2 or re_.random() < 0.25:
                        ev.update(FuenteFinanciacionPrimariaId=Cat("FuentesFinanciacion", "IdFuenteFinanciacion", "Slug", e.fuente1), UsaEstampillaProcultura=e.estampilla,
                                  PracticasMusicalesQueCongrega=f"{x['gen']}; {x['gen2']}"[:480])
                        if e.fuente2_usa:
                            ev["FuenteFinanciacionSecundariaId"] = Cat("FuentesFinanciacion", "IdFuenteFinanciacion", "Slug", e.fuente2)
                    c.add("EdicionesFestival", ev, alias=alias_e, **m)
                    c.practicas("PracticasMusicalesDeRegistro", alias_e, list(dict.fromkeys(sl)), m["lote"], nivel, "sintetico", modulo="ediciones-festival")
                    if f.aliados and nivel == 2 and re_.random() < 0.5:
                        a = f.aliados[0]
                        c.add("EntidadesAliadasDeRegistro", {"ModuloId": "ediciones-festival", "RegistroId": Ref(alias_e, texto=True), "NombreEntidadAliada": a.nombre, "EntidadId": Ref(a.alias)}, alias=None, **m)

        # ---- mercados y sus ediciones
        for nivel in (2, 3):
            for mk in (x for x in self.mercados if x.nivel == nivel):
                m = meta(nivel, "mercados")
                r = mk.rng
                org = mk.org
                dom = slug(mk.nombre, 50)
                pasos = self.pasos(r, mk.estado, mk.dias, rico=(nivel == 2))
                fch = estampa_fechas(pasos)
                vals = {"NombreMercado": mk.nombre, "Descripcion": mk.desc, "AlcanceMercadoId": Cat("AlcancesMercado", "IdAlcanceMercado", "Slug", mk.alcance),
                        "ModalidadMercadoId": Cat("ModalidadesMercado", "IdModalidadMercado", "Slug", mk.modalidad), "Periodicidad": "anual", "CorreoMercado": f"mercado@{dom}.test",
                        "SitioWebMercado": f"https://{dom}.test" if (nivel == 2 or r.random() < .5) else None, "NivelCobertura": "municipal", "CodigoDepartamento": mk.dep, "CodigoMunicipio": mk.cod,
                        "LugarEspecifico": T.cap(mk.x["lugar"]) if nivel == 2 else None, "SeRealizaEnElMarcoDeUnFestival": bool(mk.fest), "FestivalId": Ref(mk.fest.alias) if mk.fest else None,
                        "OrganizacionPrincipalId": Ref(org.alias), "EstadoRegistro": mk.estado, "Activo": True, "IdUsuarioCreador": Ref(org.admin.alias), "SedeCodigoDepartamento": mk.dep, "SedeCodigoMunicipio": mk.cod,
                        "FechaCreacion": M(mk.dias), "FechaActualizacion": M(mk.dias - r.randint(3, 100))}
                vals.update({k: v for k, v in fch.items()})
                c.add("Mercados", vals, alias=mk.alias, **m)
                c.historial(mk.alias, "mercados", pasos, org.alias, org.nombre, m["lote"], nivel, "sintetico", None, Ref(org.admin.alias))
                c.add("MercadosPracticasMusicales", {"MercadoId": Ref(mk.alias), "PracticaMusicalId": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", L.FAMILIAS[mk.fam]["slug"])}, alias=None, **m)
                for ts in L.territorios_sonoros(mk.dep, mk.fam)[:1]:
                    c.add("MercadosTerritoriosSonoros", {"MercadoId": Ref(mk.alias), "TerritorioSonoroId": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", ts)}, alias=None, **m)
                fecha_m = hoy - dt.timedelta(days=mk.dias)
                for a in mk.anios:
                    ini = dt.date(a, mk.mes, mk.dia)
                    fin = ini + dt.timedelta(days=1)
                    est = "realizada"
                    if a > hoy.year or ini > hoy:
                        est = "programada"
                    elif fin >= hoy:
                        ini = hoy + dt.timedelta(days=12)
                        fin = ini + dt.timedelta(days=1)
                        est = "programada"
                    if est == "programada" and a == hoy.year and ini > dt.date(a, 12, 31):
                        ini, fin = dt.date(a, 12, 28), dt.date(a, 12, 29)
                    fe = max(fecha_m, min(ini - dt.timedelta(days=100), hoy - dt.timedelta(days=1)))
                    pub = mk.estado == "publicado"
                    vis = "publicado" if pub else ("archivado" if mk.estado == "archivado" else "borrador")
                    c.add("EdicionesMercado", {"MercadoId": Ref(mk.alias), "Anio": a, "NumeroEdicion": a - mk.ini + 1, "Nombre": f"{mk.nombre} {a}", "Descripcion": mk.eds_desc[a], "FechaInicio": ini, "FechaFin": fin,
                                               "CodigoDepartamento": mk.dep, "CodigoMunicipio": mk.cod, "LugarEspecifico": T.cap(T.lugar_de(r, mk.rural)) if nivel == 2 else None, "Estado": est, "EstadoVisibilidad": vis,
                                               "IdUsuarioCreador": Ref(org.admin.alias), "FechaCreacion": M(fecha_en(fe)), "FechaActualizacion": M(fecha_en(fe) - 5),
                                               "FechaPublicacion": M(fecha_en(fe) - 3) if pub else None}, alias=f"{mk.alias}.edicion.{a}", **m)

        # ---- redes, talleres y espacios
        for t, (tabla, col_nombre, pivote, col_piv) in {"redes": ("Redes", "NombreRed", "RedesPracticasMusicales", "RedId"), "talleres": ("Talleres", "NombreTaller", "TalleresPracticasMusicales", "TallerId"),
                                                        "espacios": ("Espacios", "NombreEspacio", "EspaciosPracticasMusicales", "EspacioId")}.items():
            sufijo = {"redes": "Red", "talleres": "Taller", "espacios": "Espacio"}[t]
            for nivel in (2, 3):
                for p in (x for x in self.procesos[t] if x.nivel == nivel):
                    m = meta(nivel, t)
                    r = p.rng
                    dom = slug(p.nombre, 50)
                    creador = Ref(p.org.admin.alias) if p.org else Ref(p.persona.alias)
                    pasos = self.pasos(r, p.estado, p.dias, rico=(nivel == 2))
                    vals = {col_nombre: p.nombre, "Descripcion": p.desc, "NivelCobertura": "municipal", "CodigoDepartamento": p.dep, "CodigoMunicipio": p.cod, "EstadoRegistro": p.estado, "Activo": True,
                            "IdUsuarioCreador": creador, "SedeCodigoDepartamento": p.dep, "SedeCodigoMunicipio": p.cod, f"Correo{sufijo}": f"{t[:-1] if t != 'redes' else 'red'}@{dom}.test",
                            "FechaCreacion": M(p.dias), "FechaActualizacion": M(p.dias - r.randint(2, 90))}
                    vals["OrganizacionPrincipalId" if p.org else "UsuarioResponsableId"] = Ref((p.org or p.persona).alias)
                    vals.update(estampa_fechas(pasos))
                    for _, nuevo, _, _, coment, motivo, _ in pasos:
                        if nuevo == "ajustes_solicitados":
                            vals["MotivoDeLaDecision"] = coment
                        if nuevo == "rechazado":
                            vals["MotivoDeLaDecision"] = motivo
                    if t == "redes":
                        vals.update(TipoDeNodo=p.variante, AccesoAbierto=r.random() < 0.6, SitioWebRed=f"https://{dom}.test" if nivel == 2 else None)
                        if nivel == 2:
                            vals["AcervosYColecciones"] = self.banco.producir("Redes.AcervosYColecciones", lambda: f"{r.randint(30, 900)} grabaciones de campo de {p.x['gen']}, {r.randint(40, 1500)} fotografías, {r.randint(5, 120)} partituras y fondos de {p.x['gen2']} donados por familias de {p.x['muni']}.")
                            vals["LugarEspecifico"] = T.cap(p.x["lugar"])
                    elif t == "talleres":
                        vals.update(Modalidad=p.variante, RecibeAprendices=r.random() < 0.7, SitioWebTaller=f"https://{dom}.test" if nivel == 2 else None)
                        if nivel == 2:
                            vals["SaberesYTecnicas"] = self.banco.producir("Talleres.Saberes", lambda: f"Selección y curado de maderas de la región, {r.choice(['encolado y prensado', 'tallado de cajas y mástiles', 'tensado de cueros', 'barnizado a la muñeca', 'diseño de cuerdas y trastes'])}, "
                                                                                                          f"afinación de {p.x['instr']} y {p.x['instr2']}, {r.choice(['restauración de instrumentos antiguos', 'mantenimiento de instrumentos escolares', 'ajustes de sonido para agrupaciones'])}.")
                            vals["LugarEspecifico"] = T.cap(p.x["lugar"])
                    else:
                        vals.update(Ambiente=p.variante, AforoMaximo=p.aforo, EsAccesible=r.random() < 0.55, SitioWebEspacio=f"https://{dom}.test" if nivel == 2 else None)
                        if nivel == 2:
                            vals["HorarioYProgramacion"] = self.banco.producir("Espacios.Horario", lambda: f"{r.choice(['Martes a domingo', 'Jueves a sábado', 'Lunes a viernes', 'Fines de semana'])} de {r.choice(['2 p. m.', '4 p. m.', '6 p. m.'])} a {r.choice(['8 p. m.', '9 p. m.', '10 p. m.'])}; "
                                                                                                           f"programación de {p.x['gen']} {r.choice(['cada semana', 'cada quince días', 'una vez al mes', 'según agenda de las agrupaciones'])}.")
                            vals["LugarEspecifico"] = T.cap(p.x["lugar"])
                    c.add(tabla, vals, alias=p.alias, **m)
                    c.historial(p.alias, t, pasos, p.org.alias if p.org else None, p.org.nombre if p.org else None, m["lote"], nivel, "sintetico", None, creador)
                    c.add(pivote, {col_piv: Ref(p.alias), "PracticaMusicalId": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", L.FAMILIAS[p.fam]["slug"])}, alias=None, **m)

        # ---- eventos de la agenda
        for nivel in (2, 3):
            for ev in (x for x in self.eventos if x.nivel == nivel):
                m = meta(nivel, "eventos")
                r = ev.rng
                x = ev.x
                presencial = ev.modalidad in ("presencial", "mixta")
                lugar = f"{T.cap(x['lugar'])}, {x['muni']}" if presencial else None
                h0 = r.choice([9, 10, 15, 17, 18, 19])
                dias_dur = (ev.fin - ev.inicio).days if ev.fin else 0
                creada = max(min(ev.inicio - dt.timedelta(days=r.randint(20, 110)), hoy - dt.timedelta(days=2)), hoy - dt.timedelta(days=2900))
                pad = ev.vinculo[1] if ev.vinculo else None
                if pad is not None:
                    creada = max(creada, hoy - dt.timedelta(days=pad.dias - 1))
                    creada = min(creada, hoy - dt.timedelta(days=2))
                d_cr = fecha_en(creada)
                vals = {"Slug": ev.slug, "Titulo": ev.titulo, "Descripcion": ev.desc, "FechaInicio": ev.inicio, "FechaFin": ev.fin, "HoraInicio": dt.time(h0, 0), "HoraFin": dt.time(min(h0 + r.choice([2, 3, 4]), 23), 0),
                        "Modalidad": ev.modalidad, "Lugar": lugar, "CodigoDepartamento": ev.dep, "CodigoMunicipio": ev.cod, "Url": f"https://agenda.simus.test/{ev.slug}"[:500] if ev.modalidad in ("virtual", "mixta") else None,
                        "Estado": ev.estado, "FechaCreacion": M(d_cr), "FechaActualizacion": M(max(d_cr - r.randint(1, 25), 0)), "Organizador": ev.organizador[:220], "DescripcionLarga": ev.largo, "NivelCobertura": "municipal",
                        "CategoriaId": Cat("Categorias", "IdCategoria", "Slug", ev.cat, "CodigoModulo = N'agenda'")}
                if ev.vinculo:
                    tipo_v = ev.vinculo[0]
                    vals[{"festival": "FestivalId", "mercado": "MercadoId", "taller": "TallerId", "espacio": "EspacioId", "red": "RedId"}[tipo_v]] = Ref(ev.vinculo[1].alias)
                if ev.cancelado:
                    vals.update(Cancelado=True, MotivoCancelacion=r.choice(T.MOTIVOS_CANCELACION).capitalize() + ".", FechaCancelacion=M(max(d_cr - r.randint(0, 20), 0) if ev.inicio <= hoy else r.randint(1, 20)))
                c.add("EventosAgenda", vals, alias=ev.alias, **m)
                c.historial_simple(ev.alias, "agenda", ev.estado, max(d_cr, 3), m["lote"], nivel)
                c.add("EventosAgendaPracticasMusicales", {"EventoAgendaId": Ref(ev.alias), "PracticaMusicalId": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", L.FAMILIAS[ev.fam]["slug"])}, alias=None, **m)
                for ts in L.territorios_sonoros(ev.dep, ev.fam)[:1]:
                    c.add("EventosAgendaTerritoriosSonoros", {"EventoAgendaId": Ref(ev.alias), "TerritorioSonoroId": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", ts)}, alias=None, **m)
                for tag in dict.fromkeys([x["gen"], x["depto"].lower(), ev.cat.split("-")[0]]):
                    c.add("EtiquetasEventoAgenda", {"EventoAgendaId": Ref(ev.alias), "Termino": tag[:120]}, alias=None, **m)


def agregar(plan, c, escala: float = 1.0):
    """Punto de entrada del generador: construye el mundo masivo y emite sus filas al plan. `escala` 1.0 = carga completa; 0 = nada."""
    import json
    from pathlib import Path
    if escala <= 0:
        return None
    cat = json.loads((Path(__file__).resolve().parents[2] / "generador" / "catalogos-instantanea.json").read_text(encoding="utf-8"))
    reales = [d.get("nombre", "") for tipo in ("festivales", "mercados", "organizaciones") for d in (getattr(c, "datos", {}) or {}).get(tipo, [])]
    mundo = Mundo(plan.semilla, plan.hoy, cat["divipola"], escala, reales).construir()
    mundo.emitir(plan, c)
    return mundo
