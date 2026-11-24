"""Constructor del libro de FESTIVALES Y MERCADOS de nivel 1 (siembra/libro/festivales/).

Traduce el libro a filas con las mismas reglas del generador (estados y transiciones reales, fechas coherentes con `plan.hoy`, historiales
crecientes, claves estables `n1.festival.*`, `n1.mercado.*`, `n1.edicion.*`, `n1.historico.*`). Se invoca desde `siembra.py` con `sembrar(c, libro)`.
La multimedia se referencia por alias (`img.festival.<clave>.portada`, …): `inventario_multimedia(libro)` los lista para el agente de multimedia.
"""
from __future__ import annotations

import datetime as dt

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from constructores import momento, slug  # noqa: E402
from nucleo import Cat, INSTITUCIONAL, Ref  # noqa: E402

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
ETIQUETA_PRACTICA = {
    "musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras": "músicas de comunidades negras, afrocolombianas, raizales y palenqueras",
    "musicas-religiosas-rituales-espirituales-y-devocionales": "músicas religiosas, rituales y devocionales",
    "musicas-vocales-corales-y-de-tradicion-cantada": "músicas vocales y de tradición cantada",
    "musicas-populares-tradicionales-regionales-y-patrimoniales": "músicas populares tradicionales y regionales",
    "musicas-campesinas-rurales-y-de-raiz-territorial": "músicas campesinas y rurales",
    "musicas-academicas-de-camara-contemporaneas-experimentales-y-de-vanguardia": "músicas de cámara y académicas",
    "musicas-comunitarias-y-procesos-colectivos-de-practica-musical": "procesos colectivos de práctica musical",
    "expresiones-sonoras-de-pueblos-originarios": "expresiones sonoras de pueblos originarios",
    "musicas-de-frontera-diasporas-migraciones-e-interculturalidad": "músicas de frontera e interculturalidad",
    "musicas-urbanas-alternativas-e-independientes": "músicas urbanas, alternativas e independientes",
    "musicas-electronicas-digitales-produccion-sonora-y-nuevas-tecnologias": "músicas electrónicas y producción sonora",
    "musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales": "músicas populares bailables y tropicales",
    "musicas-sinfonicas-bandas-orquestas-y-grandes-formatos-instrumentales": "bandas y grandes formatos instrumentales",
}
ETIQUETA_CIFRA = dict(agrupaciones="agrupaciones", artistas="artistas en escena", asistentes="asistentes", talleres="talleres", comunidades="comunidades",
                      programadores="programadores", citas="citas realizadas", contratos="contratos cerrados")
PLANTILLAS_CIFRAS = ["Balance de la edición: {x}.", "En cifras: {x}.", "Números que dejó la edición: {x}.", "Lo que se contó al cierre: {x}."]


NOMBRE_MUNICIPIO = {"27077": "Bajo Baudó", "47189": "Ciénaga", "15238": "Duitama", "50313": "Granada", "85250": "Paz de Ariporo", "18001": "Florencia", "88001": "San Andrés",
                    "99001": "Puerto Carreño", "68679": "San Gil", "68079": "Barichara", "68755": "Socorro", "86749": "Sibundoy", "70820": "Santiago de Tolú", "66001": "Pereira", "54001": "Cúcuta"}


def terr_nombre(c, cod: str) -> str:
    return NOMBRE_MUNICIPIO.get(cod, cod)


def fecha_larga(d: dt.date) -> str:
    return f"{DIAS[d.weekday()]} {d.day} de {MESES[d.month - 1]}"


def pasos(variante: str, d: int) -> list:
    """Recorridos administrativos con fechas crecientes (d = hace cuántos días nació el registro). Formato de `Constructor.historial`."""
    alta = (None, "borrador", "Alta", d, None, None, "org")
    env1 = ("borrador", "en_revision", "EnviadoARevision", max(d - 3, 1), None, None, "org")
    ajustes = ("en_revision", "ajustes_solicitados", "EstadoCambiado", max(d - 8, 1),
               "Faltan las fechas y la sede de las ediciones anteriores y precisar el lugar de las actividades de formación; complete esos campos y vuelva a enviar.", None, "gestion")
    env2 = ("ajustes_solicitados", "en_revision", "EnviadoARevision", max(d - 14, 1), "Se completaron fechas, sedes y descripción de la formación.", None, "org")
    pub = lambda dd, com="Cumple los criterios de la ficha.": ("en_revision", "publicado", "Publicado", max(dd, 1), com, None, "gestion")
    tabla = {
        "directo": [alta, env1, pub(d - 7)],
        "con_ajustes": [alta, env1, ajustes, env2, pub(d - 20, "La ficha quedó completa tras los ajustes pedidos.")],
        "ajustes_vigentes": [alta, env1, ajustes, env2,
                             ("en_revision", "ajustes_solicitados", "EstadoCambiado", max(d - 21, 1), "Aún falta indicar cómo se financia la edición más reciente y cuántas personas asistieron; ajuste y reenvíe.", None, "gestion")],
        "revision": [alta, env1],
        "borrador": [alta],
        "rechazo": [alta, env1, ("en_revision", "rechazado", "RechazadoEnRevision", max(d - 9, 1), None,
                                 "La propuesta no incluye fechas, aliados ni antecedentes del equipo, y no se distingue de las fiestas patronales; puede presentarse de nuevo con esa información.", "gestion")],
        "archivo": [alta, env1, pub(d - 7), ("publicado", "archivado", "Archivado", max(d - 40, 1), "Archivado por la organización: la corporación pausó el festival tras la edición cancelada de 2023.", None, "org")],
    }
    return tabla[variante]


def estado_de(variante: str) -> str:
    return pasos(variante, 100)[-1][1]


def fechas_de(c, p: list) -> dict:
    out = {"FechaCreacion": momento(c.plan, p[0][3])}
    for _, nuevo, _, d, _, _, _ in p:
        if nuevo == "en_revision":
            out["FechaEnvioARevision"] = momento(c.plan, d)
        if nuevo == "publicado":
            out["FechaPublicacion"] = momento(c.plan, d)
        if nuevo == "archivado":
            out["FechaArchivado"] = momento(c.plan, d)
    return out


def _fecha(anio, par):
    return dt.date(anio, par[0], par[1])


def _descripcion_edicion(e: dict, ini, preliminar: bool) -> str:
    partes = [e["resumen"]]
    if e["prog"]:
        base = ini or dt.date(e["anio"], 1, 1)
        filas = []
        for off, hora, titulo, _cat, lugar, texto in e["prog"]:
            cuando = f"{fecha_larga(base + dt.timedelta(days=off))}, {hora}" if ini else f"día {off + 1}, {hora}"
            filas.append(f"• {cuando} · {titulo} ({lugar}). {texto}")
        partes.append(("Programación preliminar:\n" if preliminar else "Programación:\n") + "\n".join(filas))
    if e["formacion"]:
        partes.append("Formación: " + e["formacion"])
    if e["convocatoria"]:
        partes.append("Convocatoria: " + e["convocatoria"])
    if e["cifras"]:
        x = ", ".join(f"{v:,}".replace(",", ".") + f" {ETIQUETA_CIFRA[k]}" for k, v in e["cifras"].items() if k in ETIQUETA_CIFRA)
        partes.append(PLANTILLAS_CIFRAS[(e["anio"] + len(x)) % 4].format(x=x))
    return "\n\n".join(partes)


def _hora(t: str) -> dt.time:
    h, m = (int(x) for x in t.split(":"))
    return dt.time(h, m)


def _eventos(c, e, ini, alias_reg, columna_proceso, festival_estado_publico, org_nombre, practica, clave, lote, nivel, nombre_proceso):
    base = ini
    if not base:
        return
    for k, (off, hora, titulo, cat, lugar, texto) in enumerate(e["prog"]):
        dia = base + dt.timedelta(days=off)
        publico = festival_estado_publico
        estado = "publicado" if publico else "borrador"
        alias = f"evento.{clave[:40]}-{e['anio']}-{k + 1}"
        h = _hora(hora)
        fin = dt.time(min(h.hour + 2, 23), h.minute)
        dias_creacion = max((c.plan.hoy - dia).days + 25, 25) if dia <= c.plan.hoy else 45
        c.add("EventosAgenda", {
            "Slug": f"{slug(clave)[:36]}-{e['anio']}-{slug(titulo)[:48]}-{k + 1}", "Titulo": titulo, "Descripcion": f"{texto} {nombre_proceso}, {fecha_larga(dia)} de {dia.year}."[:1000],
            "FechaInicio": dia, "HoraInicio": h, "HoraFin": fin, "Modalidad": "presencial", "Lugar": f"{lugar}, {e['_ciudad']}", "CodigoDepartamento": e["_depto"], "CodigoMunicipio": e["_muni"],
            "Estado": estado, "FechaCreacion": momento(c.plan, dias_creacion), "FechaActualizacion": momento(c.plan, max(dias_creacion - 12, 1)), "Organizador": org_nombre,
            "DescripcionLarga": f"{titulo}. {texto} Hace parte de {nombre_proceso} ({e['lema']}), con entrada libre hasta completar el aforo del lugar.",
            "NivelCobertura": "municipal", "CategoriaId": Cat("Categorias", "IdCategoria", "Slug", cat, "CodigoModulo = N'agenda'"), columna_proceso: Ref(alias_reg),
        }, alias=alias, lote=lote, nivel=nivel, procedencia="sintetico")
        c.historial_simple(alias, "agenda", estado, dias_creacion - 6, lote, nivel=nivel)
        c.add("EventosAgendaPracticasMusicales", {"EventoAgendaId": Ref(alias), "PracticaMusicalId": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", practica)},
              alias=None, lote=lote, nivel=nivel, procedencia="sintetico")


def _envios(c, alias, modulo, p, org_alias, admin, datos, meta):
    n = 0
    for ant, nuevo, accion, dias, *_ in p:
        if accion == "EnviadoARevision":
            n += 1
            c.add("EnviosDeRevision", {"NumeroEnvio": n, "IdUsuarioRemitente": admin, "IdOrganizacion": Ref(org_alias), "EstadoAnterior": ant, "DatosJson": datos,
                                       "FechaEnvio": momento(c.plan, dias), "ModuloId": modulo, "RegistroId": Ref(alias, texto=True)}, alias=f"{alias}.envio.{n}", **meta)


# ---------------------------------------------------------------------------------------------------------------------
def festival(c, fe: dict, idx: int, lote="n1-festivales-libro"):
    clave = fe["clave"]
    alias = f"festival.{clave}"
    org = c.org_spec[fe["org"]]
    org_alias = c.org_id[fe["org"]]
    admin = Ref(c.persona_id[org["admin"]])
    d, m = fe["muni"][:2], fe["muni"]
    nivel = 1
    meta = dict(lote=lote, nivel=nivel, procedencia="sintetico")
    dias = fe.get("dias", 600 - 11 * idx)
    p = pasos(fe["trayectoria"], dias)
    estado = p[-1][1]
    f_est = fechas_de(c, p)
    co = fe["contacto"]
    eds = fe["ediciones"]
    hoy = c.plan.hoy
    realizadas = [e for e in eds if e["estado"] == "realizada"]
    ult = max(realizadas, key=lambda e: e["anio"], default=None)
    vigente = next((e for e in eds if e["anio"] == hoy.year), None)
    cob = fe["cobertura"]
    vals = {
        "NombreFestival": fe["nombre"], "NumeroEdiciones": max((e["num"] for e in realizadas), default=None), "FechaUltimaEdicion": _fecha(ult["anio"], ult["fechas"][1]) if ult and ult["fechas"] else None,
        "Descripcion": fe["desc"], "Organizador": org["nombre"], "CorreoOrganizador": co["correo_organizador"], "TelefonoOrganizador": co["telefono_organizador"], "SitioWebOrganizador": co["sitio_organizador"],
        "CorreoFestival": f"info@{slug(clave)[:50]}.test", "InstagramFestival": co["instagram"], "FacebookFestival": co["facebook"], "SitioWebFestival": f"https://{slug(clave)[:50]}.test", "OtroEnlaceFestival": co["otro"],
        "TelefonoFestival": co["telefono"], "TieneEdicionVigenteAnoActual": bool(vigente), "EstadoEdicionAnoActual": vigente["estado"] if vigente else None,
        "FechaInicioEdicionActual": _fecha(vigente["anio"], vigente["fechas"][0]) if vigente and vigente["fechas"] else None, "FechaFinEdicionActual": _fecha(vigente["anio"], vigente["fechas"][1]) if vigente and vigente["fechas"] else None,
        "NivelCobertura": cob, "CodigoDepartamento": d if cob != "nacional" else None, "CodigoMunicipio": m if cob == "municipal" else None, "EstadoRegistro": estado,
        "FechaCreacion": f_est["FechaCreacion"], "FechaActualizacion": momento(c.plan, max(p[-1][3] - 2, 1)), "OrganizacionPrincipalId": Ref(org_alias), "Periodicidad": fe["periodicidad"],
        "ObservacionesContacto": co["obs"], "PeriodicidadDetalle": fe["periodicidad_detalle"], "SedeCodigoDepartamento": d, "SedeCodigoMunicipio": m, "Director": fe["director"],
        "TipoOrganizadorId": Cat("TiposOrganizador", "IdTipoOrganizador", "Slug", fe["tipo_organizador"]),
    }
    c.add("Festivales", vals, alias=alias, clave_estable=f"n1.festival.{clave}", **meta)
    c.practicas("PracticasMusicalesDeRegistro", alias, fe["practicas"], lote, nivel, "sintetico", modulo="festivales")
    if fe["territorio"]:
        c.add("TerritoriosSonorosDeRegistro", {"ModuloId": "festivales", "RegistroId": Ref(alias, texto=True), "IdTerritorioSonoro": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", fe["territorio"])}, alias=None, **meta)
    c.add("LocalizacionesDeRegistro", {"ModuloId": "festivales", "RegistroId": Ref(alias, texto=True), "CodigoDepartamento": d, "CodigoMunicipio": m}, alias=None, **meta)
    for k, nombre in enumerate(fe["aliados"]):
        c.add("EntidadesAliadasDeRegistro", {"ModuloId": "festivales", "RegistroId": Ref(alias, texto=True), "NombreEntidadAliada": nombre}, alias=None, **meta)
    for org_k in fe.get("aliadas_org", ()):   # aliadas con ficha propia: relación real (`EntidadId`), ver reconciliar_libros.py
        c.add("EntidadesAliadasDeRegistro", {"ModuloId": "festivales", "RegistroId": Ref(alias, texto=True), "NombreEntidadAliada": c.org_spec[org_k]["nombre"], "EntidadId": Ref(c.org_id[org_k])}, alias=None, **meta)
    for k, (url, desc) in enumerate(fe["enlaces"], 1):
        c.add("ArchivosDeRegistro", {"ModuloId": "festivales", "RegistroId": Ref(alias, texto=True), "Url": url, "RolArchivo": "material", "DescripcionArchivo": desc, "OrdenVisualizacion": k}, alias=None, **meta)
    c.historial(alias, "festivales", p, org_alias, org["nombre"], lote, nivel, "sintetico", None, admin)
    _envios(c, alias, "festivales", p, org_alias, admin, {"nombre": fe["nombre"], "municipio": m, "estado": "en_revision"}, meta)

    publicado = estado == "publicado"
    reg_vis = {"publicado": ("publicado", "publicada"), "archivado": ("archivado", "archivada"), "en_revision": ("en_revision", "borrador"),
               "ajustes_solicitados": ("ajustes_solicitados", "borrador"), "borrador": ("borrador", "borrador"), "rechazado": ("borrador", "borrador")}[estado]
    for e in eds:
        lm = e.get("lugar_muni", m)
        e["_muni"], e["_depto"], e["_ciudad"] = lm, lm[:2], terr_nombre(c, lm)
        ini = _fecha(e["anio"], e["fechas"][0]) if e["fechas"] else None
        fin = _fecha(e["anio"], e["fechas"][1]) if e["fechas"] else None
        eal = f"{alias}.edicion.{e['anio']}"
        preliminar = e["estado"] in ("programada", "en_preparacion")
        reg, vis = reg_vis
        c.add("EdicionesFestival", {
            "FestivalId": Ref(alias), "Anio": e["anio"], "NumeroEdicion": e["num"], "Nombre": f"{fe['nombre']} {e['anio']}: {e['lema']}"[:240], "Descripcion": _descripcion_edicion(e, ini, preliminar),
            "FechaInicio": ini, "FechaFin": fin, "Estado": e["estado"], "FechaCreacion": f_est["FechaCreacion"], "Director": e.get("director", fe["director"]), "EstadoRegistro": reg, "EstadoVisibilidad": vis,
            "TipologiaFestivalId": Cat("TipologiasFestival", "IdTipologiaFestival", "Slug", e["tipologia"]) if e.get("tipologia") else None,
            "FuenteFinanciacionPrimariaId": Cat("FuentesFinanciacion", "IdFuenteFinanciacion", "Slug", e["fuente1"]) if e.get("fuente1") else None,
            "FuenteFinanciacionSecundariaId": Cat("FuentesFinanciacion", "IdFuenteFinanciacion", "Slug", e["fuente2"]) if e.get("fuente2") else None,
            "UsaEstampillaProcultura": bool(e.get("estampilla", False)),
            "PracticasMusicalesQueCongrega": "; ".join(ETIQUETA_PRACTICA.get(s, s) for s in fe["practicas"])[:500],
        }, alias=eal, clave_estable=f"n1.edicion.{clave}-{e['anio']}", **meta)
        c.practicas("PracticasMusicalesDeRegistro", eal, fe["practicas"], lote, nivel, "sintetico", modulo="ediciones-festival")
        if fe["territorio"]:
            c.add("TerritoriosSonorosDeRegistro", {"ModuloId": "ediciones-festival", "RegistroId": Ref(eal, texto=True), "IdTerritorioSonoro": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", fe["territorio"])}, alias=None, **meta)
        c.add("LocalizacionesDeRegistro", {"ModuloId": "ediciones-festival", "RegistroId": Ref(eal, texto=True), "CodigoDepartamento": lm[:2], "CodigoMunicipio": lm}, alias=None, **meta)
        if e.get("agenda") or e["anio"] == (ult or {}).get("anio"):
            c.add("ArchivosDeRegistro", {"ModuloId": "ediciones-festival", "RegistroId": Ref(eal, texto=True), "Url": f"https://{slug(clave)[:50]}.test/ediciones/{e['anio']}/programa.pdf", "RolArchivo": "material",
                                         "DescripcionArchivo": f"Programa de la edición {e['anio']}.", "OrdenVisualizacion": 1}, alias=None, **meta)
        if e.get("agenda") and e["prog"]:
            _eventos(c, e, ini, alias, "FestivalId", publicado and reg == "publicado", org["nombre"], fe["practicas"][0], clave, "n1-agenda-festivales", nivel, fe["nombre"])
    return alias


def mercado(c, mk: dict, idx: int, lote="n1-mercados-libro"):
    clave = mk["clave"]
    alias = f"mercado.{clave}"
    org = c.org_spec[mk["org"]]
    org_alias = c.org_id[mk["org"]]
    admin = Ref(c.persona_id[org["admin"]])
    d, m = mk["muni"][:2], mk["muni"]
    nivel = 1
    meta = dict(lote=lote, nivel=nivel, procedencia="sintetico")
    dias = mk.get("dias", 420 - 17 * idx)
    p = pasos(mk["trayectoria"], dias)
    estado = p[-1][1]
    f_est = fechas_de(c, p)
    co = mk["contacto"]
    cob = mk["cobertura"]
    marco = mk.get("festival")
    vals = {"NombreMercado": mk["nombre"], "Descripcion": mk["desc"], "AlcanceMercadoId": Cat("AlcancesMercado", "IdAlcanceMercado", "Slug", mk["alcance"]),
            "ModalidadMercadoId": Cat("ModalidadesMercado", "IdModalidadMercado", "Slug", mk["modalidad"]), "Periodicidad": mk["periodicidad"], "PeriodicidadDetalle": mk["periodicidad_detalle"][:240],
            "CorreoMercado": co["correo"], "TelefonoMercado": co["telefono"], "SitioWebMercado": co["sitio"], "InstagramMercado": co["instagram"], "FacebookMercado": co["facebook"], "OtroEnlaceMercado": co["otro"],
            "ObservacionesContacto": co["obs"], "NivelCobertura": cob, "CodigoDepartamento": d if cob != "nacional" else None, "CodigoMunicipio": m if cob == "municipal" else None,
            "LugarEspecifico": mk["lugar"], "SeRealizaEnElMarcoDeUnFestival": bool(marco), "FestivalId": Ref(f"festival.{marco}") if marco else None,
            "OrganizacionPrincipalId": Ref(org_alias), "EstadoRegistro": estado, "Activo": estado != "archivado", "IdUsuarioCreador": admin, "SedeCodigoDepartamento": d, "SedeCodigoMunicipio": m}
    vals.update({k: v for k, v in f_est.items() if k in ("FechaCreacion", "FechaEnvioARevision", "FechaPublicacion", "FechaArchivado")})
    vals["FechaActualizacion"] = momento(c.plan, max(p[-1][3] - 2, 1))
    c.add("Mercados", vals, alias=alias, clave_estable=f"n1.mercado.{clave}", **meta)
    c.practicas("MercadosPracticasMusicales", alias, mk["practicas"], lote, nivel, "sintetico", col_registro="MercadoId", col_practica="PracticaMusicalId")
    for t in mk["territorios"]:
        c.add("MercadosTerritoriosSonoros", {"MercadoId": Ref(alias), "TerritorioSonoroId": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", t)}, alias=None, **meta)
    c.historial(alias, "mercados", p, org_alias, org["nombre"], lote, nivel, "sintetico", None, admin)
    _envios(c, alias, "mercados", p, org_alias, admin, {"nombre": mk["nombre"], "municipio": m, "estado": "en_revision"}, meta)
    publicado = estado == "publicado"
    for e in mk["ediciones"]:
        e["_muni"], e["_depto"], e["_ciudad"] = m, d, terr_nombre(c, m)
        ini = _fecha(e["anio"], e["fechas"][0]) if e["fechas"] else None
        fin = _fecha(e["anio"], e["fechas"][1]) if e["fechas"] else None
        eal = f"{alias}.edicion.{e['anio']}"
        c.add("EdicionesMercado", {
            "MercadoId": Ref(alias), "Anio": e["anio"], "NumeroEdicion": e["num"], "Nombre": f"{mk['nombre']} {e['anio']}: {e['lema']}"[:240],
            "Descripcion": _descripcion_edicion(e, ini, e["estado"] in ("programada", "en_preparacion")), "FechaInicio": ini, "FechaFin": fin, "CodigoDepartamento": d, "CodigoMunicipio": m,
            "LugarEspecifico": e["sede"][:300], "Estado": e["estado"], "EstadoVisibilidad": "publicado" if publicado else "borrador", "IdUsuarioCreador": admin,
            "FechaCreacion": f_est["FechaCreacion"], "FechaPublicacion": f_est.get("FechaPublicacion") if publicado else None,
        }, alias=eal, clave_estable=f"n1.edicion.{clave}-{e['anio']}", **meta)
        for org_k in mk.get("aliadas_org", ()):   # los mercados las declaran en cada edición (el módulo `ediciones-mercado` sí admite aliadas)
            c.add("EntidadesAliadasDeRegistro", {"ModuloId": "ediciones-mercado", "RegistroId": Ref(eal, texto=True), "NombreEntidadAliada": c.org_spec[org_k]["nombre"], "EntidadId": Ref(c.org_id[org_k])}, alias=None, **meta)
        if e.get("agenda") and e["prog"]:
            _eventos(c, e, ini, alias, "MercadoId", publicado, org["nombre"], mk["practicas"][0], clave, "n1-agenda-mercados", nivel, mk["nombre"])
    return alias


def historico(c, h: dict, idx: int):
    clave = h["clave"]
    alias = f"festival.{clave}"
    nivel = h["nivel"]
    lote = "n1-festivales-historicos-sinteticos"
    d, m = h["muni"][:2], h["muni"]
    dias = 640 - 9 * idx
    meta = dict(lote=lote, nivel=nivel, procedencia="sintetico")
    ult = max((a for a, _ in h["ediciones"]), default=None)
    c.add("Festivales", {
        "NombreFestival": h["nombre"], "NumeroEdiciones": len(h["ediciones"]) or None, "Descripcion": h["desc"], "Organizador": h["organizador"], "TieneEdicionVigenteAnoActual": False,
        "NivelCobertura": "municipal", "CodigoDepartamento": d, "CodigoMunicipio": m, "EstadoRegistro": "publicado", "FechaCreacion": momento(c.plan, dias), "FechaActualizacion": momento(c.plan, dias - 30),
        "OrganizacionPrincipalId": INSTITUCIONAL, "Periodicidad": h["periodicidad"], "SedeCodigoDepartamento": d, "SedeCodigoMunicipio": m,
    }, alias=alias, clave_estable=f"n1.historico.{clave}" if nivel == 1 else None, **meta)
    c.practicas("PracticasMusicalesDeRegistro", alias, h["practicas"], lote, nivel, "sintetico", modulo="festivales")
    c.add("RegistrosRevisionHistorial", {"ModuloId": "festivales", "RegistroId": Ref(alias, texto=True), "EstadoAnterior": None, "EstadoNuevo": "publicado", "Accion": "Alta",
                                         "Comentario": "Registro histórico publicado al cargarse.", "IdUsuario": c.gestor, "Fecha": momento(c.plan, dias)}, alias=f"{alias}.hist.1", **meta)
    for anio, sede in h["ediciones"]:
        c.add("EdicionesFestival", {"FestivalId": Ref(alias), "Anio": anio, "Nombre": f"{h['nombre']} {anio}", "Descripcion": f"Edición {anio} de {h['nombre']}. Sede: {sede}.", "Estado": "realizada",
                                    "FechaCreacion": momento(c.plan, dias), "EstadoRegistro": "publicado", "EstadoVisibilidad": "publicada"},
              alias=f"{alias}.edicion.{anio}", clave_estable=f"n1.edicion.{clave}-{anio}" if nivel == 1 else None, **meta)


# ---------------------------------------------------------------------------------------------------------------------
def sembrar(c, libro):
    """Personas y organizaciones del libro, festivales, mercados e históricos sintéticos. Devuelve los alias de los históricos (para reclamaciones)."""
    c.personas(items=libro.PERSONAS, base=300, lote="n2-personas-festivales")
    c.organizaciones(items=libro.ORGANIZACIONES, forzar=(1, "n1-organizaciones-festivales"), base=300)
    for i, fe in enumerate(libro.FESTIVALES):
        festival(c, fe, i)
    for i, mk in enumerate(libro.MERCADOS):
        mercado(c, mk, i)
    for i, h in enumerate(libro.HISTORICOS):
        historico(c, h, i)
    c.historicos_sinteticos = {h["clave"]: (f"festival.{h['clave']}", h["escenario"]) for h in libro.HISTORICOS}
    return c.historicos_sinteticos


def inventario_multimedia(libro) -> list:
    """Alias de imagen que las fichas del libro esperan del agente de multimedia (con el texto alternativo sugerido; el alt es obligatorio)."""
    out = []
    for fe in libro.FESTIVALES:
        k = fe["clave"]
        out.append(dict(alias=f"img.festival.{k}.portada", para=f"n1.festival.{k}", rol="portada", alt=f"Escena del {fe['nombre']}: público y agrupaciones en el escenario principal."))
        out.append(dict(alias=f"img.festival.{k}.logo", para=f"n1.festival.{k}", rol="logo", alt=f"Logotipo del {fe['nombre']}."))
        for n in (1, 2, 3):
            out.append(dict(alias=f"img.festival.{k}.galeria.{n}", para=f"n1.festival.{k}", rol="galeria", alt=f"Imagen {n} de la galería del {fe['nombre']}."))
        for e in fe["ediciones"]:
            out.append(dict(alias=f"img.edicion.{k}-{e['anio']}.afiche", para=f"n1.edicion.{k}-{e['anio']}", rol="afiche", alt=f"Afiche de la edición {e['anio']} del {fe['nombre']}, «{e['lema']}»."))
    for mk in libro.MERCADOS:
        k = mk["clave"]
        out.append(dict(alias=f"img.mercado.{k}.portada", para=f"n1.mercado.{k}", rol="portada", alt=f"Citas de negocio y presentaciones en {mk['nombre']}."))
        out.append(dict(alias=f"img.mercado.{k}.logo", para=f"n1.mercado.{k}", rol="logo", alt=f"Logotipo de {mk['nombre']}."))
        for e in mk["ediciones"]:
            out.append(dict(alias=f"img.edicion.{k}-{e['anio']}.afiche", para=f"n1.edicion.{k}-{e['anio']}", rol="afiche", alt=f"Afiche de la edición {e['anio']} de {mk['nombre']}, «{e['lema']}»."))
    for h in libro.HISTORICOS:
        if h["nivel"] == 1:
            out.append(dict(alias=f"img.festival.{h['clave']}.portada", para=f"n1.historico.{h['clave']}", rol="portada", alt=f"Archivo fotográfico del {h['nombre']}."))
    return out


if __name__ == "__main__":   # python3 -I siembra/generador/constructor_festivales.py  → reescribe siembra/libro/festivales/multimedia-solicitada.json
    import json
    import sys
    from pathlib import Path
    aqui = Path(__file__).resolve().parent
    sys.path.insert(0, str(aqui.parents[1] / "siembra" / "libro"))
    import festivales as _libro
    destino = aqui.parents[1] / "siembra" / "libro" / "festivales" / "multimedia-solicitada.json"
    destino.write_text(json.dumps(inventario_multimedia(_libro), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{destino} ({len(inventario_multimedia(_libro))} alias)")
