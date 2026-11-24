"""Reconciliación de los libros de la siembra integral: `personas` (18 perfiles, 14 organizaciones) frente a `festivales`.

Cada tema definió sus alias sin ver los de los demás. Aquí se casan por afinidad regional y de práctica, de modo que las fichas queden coherentes
en ambos sentidos (la relación persona/organización–festival no tiene tabla propia: se materializa en `Festivales.Director`, `OrganizacionPrincipalId`
y `EntidadesAliadasDeRegistro.EntidadId` (relación real; en mercados, por edición), y en los textos de las dos fichas):

  * ORGANIZADORAS: la organización del libro de personas pasa a ser la organizadora (OrganizacionPrincipalId) y su persona la directora de la ficha;
    la organización y la persona que el libro de festivales había inventado para ese proceso se retiran (no habría dos «Nubia» en el Baudó).
  * ALIADAS: las demás organizaciones de la región figuran como entidad aliada del festival o mercado y éste figura en su ficha («Alianza con …»).
  * Los alias `n1.festival.*` / `n1.mercado.*` que el libro de personas proponía y no existen se sustituyen por los reales o se retiran.

Es idempotente (aplicar dos veces no cambia nada) y se llama al comienzo de `construir_plan`.
"""
from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "siembra" / "libro"))

_APLICADO = False

# festival o mercado del libro de festivales -> (organización del libro de personas, persona directora)
ORGANIZADORAS = {
    "festival-de-arrullos-y-alabaos-del-baudo": ("corp-cabildo-sonoro-del-atrato", "nubia-palacios"),
    "feria-de-circulacion-musical-del-golfo": ("productora-marea-alta", "margarita-buelvas"),
}
# proceso -> organizaciones aliadas (de la región o la práctica)
ALIADAS = {
    "encuentro-de-bullerengue-y-tambor-de-la-cienaga-grande": ["casa-de-musica-la-candelaria"],
    "festival-cuerdas-del-paramo": ["corp-bandas-de-boyaca"],
    "encuentro-de-arpas-y-cuatros-del-ariari": ["fund-orquesta-juvenil-alto-magdalena"],
    "encuentro-de-coplas-del-cravo-sur": ["corp-musica-del-llano-casanare"],
    "muestra-de-cantos-del-rio-caqueta": ["colectivo-tierra-adentro"],
    "encuentro-de-quadrille-y-calipso-del-cove": ["asoc-sonidos-del-archipielago"],
    "encuentro-de-musicas-del-orinoco-y-la-frontera": ["fund-maloca-sonora"],
    "festival-del-torbellino-y-el-tiple-de-la-provincia-guanentina": ["corp-guabina-y-tiple"],
    "encuentro-de-flautas-y-tambores-del-valle-alto": ["corp-tejidos-de-aire"],
    "vitrina-cafetera-de-musicas": ["sello-altamira-discos", "escuela-de-luteria-el-roble"],
}
# persona del libro de personas -> (proceso, rol en la ficha del proceso)
PERSONAS = {
    "nubia-palacios": ("festival-de-arrullos-y-alabaos-del-baudo", "directora"),
    "jhon-fredy-valencia": ("festival-de-arrullos-y-alabaos-del-baudo", "marimbero invitado"),
    "margarita-buelvas": ("feria-de-circulacion-musical-del-golfo", "directora"),
    "karen-ospina": ("feria-de-circulacion-musical-del-golfo", "programadora de la escena electrónica"),
    "rosalba-perez": ("encuentro-de-bullerengue-y-tambor-de-la-cienaga-grande", "cantadora invitada"),
    "gilberto-pedraza": ("festival-cuerdas-del-paramo", "director invitado de banda"),
    "ruben-trujillo": ("encuentro-de-arpas-y-cuatros-del-ariari", "director invitado de orquesta juvenil"),
    "eliecer-rios": ("encuentro-de-coplas-del-cravo-sur", "arpista invitado"),
    "claudia-munoz": ("muestra-de-cantos-del-rio-caqueta", "investigadora invitada"),
    "dennis-bryan": ("encuentro-de-quadrille-y-calipso-del-cove", "guitarrista invitado"),
    "tatiana-cardozo": ("encuentro-de-musicas-del-orinoco-y-la-frontera", "coordinadora de enlace con la frontera"),
    "martha-rangel": ("festival-del-torbellino-y-el-tiple-de-la-provincia-guanentina", "tiplista invitada"),
    "olga-mejia": ("festival-del-torbellino-y-el-tiple-de-la-provincia-guanentina", "directora coral invitada"),
    "angela-burbano": ("encuentro-de-flautas-y-tambores-del-valle-alto", "coordinadora académica"),
    "fabian-rojas": ("encuentro-de-flautas-y-tambores-del-valle-alto", "constructor invitado"),
    "hernan-velasquez": ("vitrina-cafetera-de-musicas", "programador invitado"),
    "luis-ernesto-castano": ("vitrina-cafetera-de-musicas", "taller de lutería en la vitrina"),
    "julian-arboleda": ("vitrina-cafetera-de-musicas", "compositor invitado"),
}
# Nombres de procesos que el libro de personas citaba en sus textos y que ahora son los del libro de festivales.
RENOMBRES = [
    ("Festival de Chirimía y Alabaos del Atrato, que desde 2015 reúne cada año", "Festival de Arrullos y Alabaos del Baudó, que desde 2012 reúne cada octubre"),
    ("Dirige desde 2015 el Festival de Chirimía y Alabaos del Atrato", "Dirige desde 2012, año de su primera edición, el Festival de Arrullos y Alabaos del Baudó"),
    ("Festival de Chirimía y Alabaos del Atrato", "Festival de Arrullos y Alabaos del Baudó"),
    ("Festival de Chirimía y Alabaos 2025", "Festival de Arrullos y Alabaos del Baudó 2025"),
    ("el Mercado de Músicas del Caribe, que reúne a agencias, sellos y festivales de ocho países de la cuenca",
     "la Feria de Circulación Musical del Golfo, que desde 2023 reúne cada septiembre a programadores y agrupaciones de la costa en Santiago de Tolú"),
    ("Mercado de Músicas del Caribe", "Feria de Circulación Musical del Golfo"),
]
# El texto del libro de festivales habla de «la agencia» organizadora del Golfo; la organizadora ahora es una productora.
TEXTOS_FESTIVALES = [("le hacían a la agencia los grupos del golfo", "le hacían a la productora los grupos del golfo")]


def _reemplazar(obj, pares):
    """Reemplaza texto en cadenas dentro de dicts/listas/tuplas (devuelve el objeto nuevo; los contenedores mutables se modifican en su sitio)."""
    if isinstance(obj, str):
        for a, b in pares:
            obj = obj.replace(a, b)
        return obj
    if isinstance(obj, list):
        obj[:] = [_reemplazar(x, pares) for x in obj]
        return obj
    if isinstance(obj, dict):
        for k in list(obj):
            obj[k] = _reemplazar(obj[k], pares)
        return obj
    if isinstance(obj, tuple):
        return tuple(_reemplazar(x, pares) for x in obj)
    return obj


def aplicar():
    global _APLICADO
    if _APLICADO:
        return
    import festivales as L
    from personas.organizaciones import ORGANIZACIONES as ORGS_P
    from personas.perfiles import PERFILES
    orgs_p = {o["clave"]: o for o in ORGS_P}
    per_p = {p["clave"]: p for p in PERFILES}
    procesos = {x["clave"]: x for x in L.FESTIVALES + L.MERCADOS}
    nombre_completo = lambda p: " ".join(p["nombre"])  # noqa: E731
    # 1. Organizadoras
    retirar_orgs, retirar_personas = set(), set()
    for clave, (org_k, dir_k) in ORGANIZADORAS.items():
        x, o, d = procesos[clave], orgs_p[org_k], per_p[dir_k]
        viejo = next(o2 for o2 in L.ORGANIZACIONES if o2["clave"] == x["org"])
        retirar_orgs.add(viejo["clave"])
        retirar_personas.add(viejo["admin"])
        x["org"] = org_k
        if "director" in x:
            viejo_dir = x["director"]
            x["director"] = nombre_completo(d)
            for e in x["ediciones"]:
                if e.get("director") == viejo_dir:
                    e["director"] = x["director"]
            co = x["contacto"]
            co["correo_organizador"], co["telefono_organizador"], co["sitio_organizador"] = f"contacto@{o['dominio']}", o["telefono"], f"https://{o['dominio']}"
    L.ORGANIZACIONES[:] = [o for o in L.ORGANIZACIONES if o["clave"] not in retirar_orgs]
    L.PERSONAS[:] = [p for p in L.PERSONAS if p["clave"] not in retirar_personas]
    # 2. Aliadas (en el proceso) y vínculos de cada ficha de persona/organización (en el libro de personas)
    for clave, aliadas in ALIADAS.items():
        x = procesos[clave]
        for org_k in aliadas:
            if org_k not in x.setdefault("aliadas_org", []):
                x["aliadas_org"].append(org_k)
    for o in ORGS_P:
        o["festivales"] = []
    for clave, (org_k, _d) in ORGANIZADORAS.items():
        tipo = "mercado" if clave in {m["clave"] for m in L.MERCADOS} else "festival"
        orgs_p[org_k]["festivales"].append((f"n1.{tipo}.{clave}", "organizadora"))
    for clave, aliadas in ALIADAS.items():
        tipo = "mercado" if clave in {m["clave"] for m in L.MERCADOS} else "festival"
        for org_k in aliadas:
            o = orgs_p[org_k]
            o["festivales"].append((f"n1.{tipo}.{clave}", "aliada"))
            texto = f"Alianza con el {procesos[clave]['nombre']}" if tipo == "festival" else f"Alianza con la {procesos[clave]['nombre']}" if procesos[clave]["nombre"].startswith(("Feria", "Vitrina")) else f"Alianza con el {procesos[clave]['nombre']}"
            if texto not in o["proyectos"]:
                o["proyectos"].append(texto)
    for p in PERFILES:
        p["festivales"] = []
    for per_k, (clave, rol) in PERSONAS.items():
        tipo = "mercado" if clave in {m["clave"] for m in L.MERCADOS} else "festival"
        per_p[per_k]["festivales"].append((f"n1.{tipo}.{clave}", rol))
    # 3. Textos: nombres de procesos que el libro de personas citaba y ahora son los reales
    _reemplazar(ORGS_P, RENOMBRES)
    _reemplazar(PERFILES, RENOMBRES)
    _reemplazar(procesos[next(iter(ORGANIZADORAS))], [])  # (sin cambios: la ficha del Baudó ya habla de «la corporación»)
    _reemplazar(procesos["feria-de-circulacion-musical-del-golfo"], TEXTOS_FESTIVALES)
    _APLICADO = True


def vinculos() -> dict:
    """Para pruebas: organizadoras, aliadas y personas tal como quedaron."""
    aplicar()
    return dict(organizadoras=ORGANIZADORAS, aliadas=ALIADAS, personas=PERSONAS)
