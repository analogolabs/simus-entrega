"""Libro de la Galería pública: álbumes de fotos, de videos y mixtos.

    sembrar(plan)    añade al plan las filas de `GaleriaAlbumes` y `GaleriaItems` (lote `n1-galeria`, nivel 1; los álbumes llevan clave estable).

QUÉ SIEMBRA
  · «Voces y Saberes»: los 4 últimos videos de la serie del canal del Plan Nacional de Música para la Convivencia.
  · «Voces y Saberes · archivo»: los otros 6 videos de la serie.
  · Álbumes de fotos con el pool multimedia existente (`img.pool.foto.congreso.NNN` y `img.pool.foto.rock.NNN`: las fotografías reales del proyecto).
  · Un álbum mixto (fotos del pool y dos videos institucionales de `siembra/multimedia/videos.csv`).

DATOS REALES, NO INVENTADOS. Los títulos, descripciones, fechas y duraciones de los 10 videos salen de `videos-voces-y-saberes.json` (extraídos del
canal el 22 nov 2026); el título se normaliza a «Voces y Saberes: Nombre». Los identificadores de los videos de `videos.csv` se verificaron con oEmbed.
La lista de origen es https://youtube.com/playlist?list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8 (enlace «Ver la lista en YouTube»).

PRIVACIDAD. Cada video lleva una MINIATURA PROPIA en el Banco de archivos (`MiniaturaArchivoId`), descargada UNA sola vez al sembrar por
`siembra/multimedia/miniaturas_de_videos.py` (único lugar que habla con i.ytimg.com): el portal no pide nada a YouTube hasta que la persona pulsa
«Reproducir» (incrustación `youtube-nocookie.com`).

TEXTOS. Los títulos se normalizan a «Voces y Saberes: Nombre». Si la descripción de YouTube pasa de 400 caracteres, `Descripcion` es un resumen editorial
fiel de 1 a 3 frases (`RESUMENES`) y el texto completo queda en `Detalle`, visible en el visor. Nada se inventa.

SIN ÁLBUM. `sueltos()` son fotos y videos que no pertenecen a ningún álbum (`GaleriaAlbumId` nulo, publicados por sí mismos).
"""
from __future__ import annotations

import csv
import unicodedata
import datetime as dt
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parents[1] / "multimedia"))

from nucleo import Ref  # noqa: E402

LOTE = "n1-galeria"
NIVEL = 1
LISTA_VOCES = "https://youtube.com/playlist?list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8"
CANAL = "https://www.youtube.com/@plannacionaldemusica/videos"
CANAL_PNMC = "Plan Nacional de Música para la Convivencia"
FUENTE_FOTOS = "Archivo fotográfico del proyecto (simus-web/public/Galeria)"

# Los 4 últimos y los otros 6 de la serie, por identificador de YouTube.
VOCES_RECIENTES = ["Rv5Oiq8UXi0", "FqTfFxwH8QA", "MHIY0k8ZCmY", "daSil6sGrok"]
VOCES_ARCHIVO = ["Gbobmz_KK9Q", "qGYBlCDaEW4", "t7AeTVIfm1Y", "g2kBMoukBZQ", "JFK9q5uLOgc", "AoPZ-TNzrQs"]

# Resúmenes editoriales de las descripciones largas (>400 caracteres), fieles al texto de YouTube; el texto completo va en `Detalle`.
LIMITE_RESUMEN = 400
RESUMENES = {
    "t7AeTVIfm1Y": "Registro de la evaluación participativa del Plan Especial de Salvaguardia de los Alabaos, Gualíes y Levantamientos de Tumbas, en el marco del fortalecimiento del Territorio Sonoro del Chocó. El Plan Nacional de Música para la Convivencia y la Fundación Cultural Andagoya impulsan la visibilización del aporte de estas músicas a la cohesión social y a una cultura de paz.",
    "JFK9q5uLOgc": "A sus más de 80 años, Mario Gamboa ha dedicado su vida a la formación musical de jóvenes y a la dirección de la Banda de Músicos de Piedecuesta, Santander. Con su esposa Amanda Báez fundó el Colegio Artístico Musical Pentagrama, referente cultural de la región.",
    "qGYBlCDaEW4": "El Ministerio de las Culturas, las Artes y los Saberes reconoce, con Voces y Saberes, la trayectoria del maestro santandereano Henry Sanmiguel Sanabria por su aporte a la técnica del acordeón en la música vallenata, con más de 47 años de experiencia.",
}
_CORRECCIONES = (("de desde el Sumapaz", "desde el Sumapaz"),)


def alt_limpio(alt: str) -> str:
    """El alt del pool termina en «(imagen N de T)», un número del archivo del proyecto que en la Galería no significa nada: se quita."""
    return re.sub(r"\s*\(imagen \d+ de \d+\)", "", alt or "").strip()


def limpio(texto: str) -> str:
    """Texto de YouTube listo para mostrar: NFC, espacios raros fuera, líneas sin cola y una errata evidente corregida."""
    t = unicodedata.normalize("NFC", texto or "").replace("\u202f", " ").replace("\u00a0", " ")
    for malo, bueno in _CORRECCIONES:
        t = t.replace(malo, bueno)
    return "\n".join(re.sub(r"[ \t]+", " ", linea).strip() for linea in t.strip().splitlines())


def descripcion_y_detalle(video_id: str, texto: str) -> tuple:
    """(descripcion, detalle): una descripción corta se queda como está; una larga se resume y el texto completo va en el detalle."""
    t = limpio(texto)
    if len(t) <= LIMITE_RESUMEN:
        return t, None
    if video_id not in RESUMENES:
        raise ValueError(f"{video_id}: descripción de {len(t)} caracteres sin resumen editorial en RESUMENES")
    return RESUMENES[video_id], t


_NOMBRE = re.compile(r"^voces y saberes(?:\s+2024)?\s*[:\-]\s*(.+)$", re.IGNORECASE)


def titulo_normalizado(titulo: str) -> str:
    """«VOCES Y SABERES: Carlos Delgado» y «Voces y saberes 2024- Mario Gamboa» → «Voces y Saberes: …». Otro título se deja como está."""
    t = unicodedata.normalize("NFC", " ".join(titulo.split()))
    m = _NOMBRE.match(t)
    return f"Voces y Saberes: {m.group(1).strip()}" if m else t


def _videos_de_voces() -> dict:
    datos = json.loads((AQUI / "videos-voces-y-saberes.json").read_text(encoding="utf-8"))
    return {v["id"]: v for v in datos}


def _id_de_youtube(url: str) -> str:
    return re.search(r"[?&]v=([A-Za-z0-9_-]{11})", url).group(1)


def _videos_institucionales() -> dict:
    """`vid.demo.NN` de siembra/multimedia/videos.csv: id, título y canal (verificados con oEmbed)."""
    with (AQUI.parents[1] / "multimedia" / "videos.csv").open(encoding="utf-8", newline="") as f:
        return {fila["alias"]: fila for fila in csv.DictReader(f)}


def _foto(slug_pool: str, desde: int, hasta: int) -> list:
    return [f"img.pool.foto.{slug_pool}.{n:03d}" for n in range(desde, hasta + 1)]


def albumes() -> list:
    """Definición de los álbumes, en el orden en que aparecen en la Galería. Cada ítem es ('foto', alias_img) o ('video', dict)."""
    voces = _videos_de_voces()
    inst = _videos_institucionales()

    def v_voces(i: str) -> tuple:
        d = voces[i]
        desc, detalle = descripcion_y_detalle(i, d["descripcion"])
        return ("video", dict(id=i, titulo=titulo_normalizado(d["titulo"]), descripcion=desc, detalle=detalle, fecha=d["fecha"], segundos=d["segundos"],
                              canal=d.get("canal") or CANAL_PNMC, fuente=f"https://www.youtube.com/watch?v={i}"))

    def v_inst(alias: str) -> tuple:
        fila = inst[alias]
        i = _id_de_youtube(fila["url"])
        titulo = " ".join(unicodedata.normalize("NFC", fila["titulo"]).split())
        return ("video", dict(id=i, titulo=titulo, descripcion=f"«{titulo}», publicado por {fila['canal']} en YouTube.", detalle=None, fecha=None, segundos=None,
                              canal=fila["canal"], fuente=fila["url"]))

    return [
        dict(slug="voces-y-saberes", titulo="Voces y Saberes", tipo="videos", orden=1, fecha="2026-08-06", lista=LISTA_VOCES, fuente=LISTA_VOCES,
             descripcion="Entrevistas a músicas y músicos de tradición de Colombia, de la serie «Voces y Saberes» del Plan Nacional de Música para la Convivencia. Los cuatro videos más recientes.",
             items=[v_voces(i) for i in VOCES_RECIENTES]),
        dict(slug="voces-y-saberes-archivo", titulo="Voces y Saberes · archivo", tipo="videos", orden=2, fecha="2025-07-31", lista=LISTA_VOCES, fuente=LISTA_VOCES,
             descripcion="Las entrevistas anteriores de la serie «Voces y Saberes»: sabedoras y sabedores de distintas regiones, con su música y su memoria.",
             items=[v_voces(i) for i in VOCES_ARCHIVO]),
        dict(slug="archivo-del-pnmc-fotos-y-videos", titulo="Archivo del PNMC: fotos y videos", tipo="mixto", orden=3, fecha="2025-09-11", lista=None, fuente=FUENTE_FOTOS,
             descripcion="Un recorrido mezclado por el archivo del PNMC: fotografías de la jornada del Congreso Nacional de Música y dos videos institucionales.",
             items=[("foto", a) for a in _foto("congreso", 1, 4)] + [v_inst("vid.demo.04")] + [("foto", a) for a in _foto("congreso", 5, 8)] + [v_inst("vid.demo.02")]),
        dict(slug="mesa-nacional-de-rock-registro-1", titulo="Mesa Nacional de Rock: registro fotográfico, primera parte", tipo="fotos", orden=4, fecha="2026-04-07", lista=None,
             fuente=FUENTE_FOTOS,
             descripcion="Fotografías de la Mesa Nacional de Rock: músicos, conversatorios y público en el auditorio.", items=[("foto", a) for a in _foto("rock", 1, 18)]),
        dict(slug="mesa-nacional-de-rock-registro-2", titulo="Mesa Nacional de Rock: registro fotográfico, segunda parte", tipo="fotos", orden=5, fecha="2026-04-07", lista=None,
             fuente=FUENTE_FOTOS,
             descripcion="Más fotografías de la Mesa Nacional de Rock: músicos, conversatorios y público en el auditorio.", items=[("foto", a) for a in _foto("rock", 19, 36)]),
        dict(slug="congreso-nacional-de-musica-registro-1", titulo="Congreso Nacional de Música: registro fotográfico, primera parte", tipo="fotos", orden=6, fecha="2025-09-11",
             lista=None, fuente=FUENTE_FOTOS,
             descripcion="Fotografías de la jornada del Congreso Nacional de Música: asistentes, conferencistas y actividades del encuentro.",
             items=[("foto", a) for a in _foto("congreso", 9, 32)]),
        dict(slug="congreso-nacional-de-musica-registro-2", titulo="Congreso Nacional de Música: registro fotográfico, segunda parte", tipo="fotos", orden=7, fecha="2025-09-11",
             lista=None, fuente=FUENTE_FOTOS,
             descripcion="Más fotografías de la jornada del Congreso Nacional de Música: asistentes, conferencistas y actividades del encuentro.",
             items=[("foto", a) for a in _foto("congreso", 33, 56)]),
    ]


def sueltos() -> list:
    """Ítems SIN ÁLBUM (pestaña «Sin álbum»): fotos del pool que ningún álbum usa y dos videos institucionales. Cada uno es ('foto', alias_img) o ('video', dict)."""
    inst = _videos_institucionales()

    def v_inst(alias: str) -> tuple:
        fila = inst[alias]
        i = _id_de_youtube(fila["url"])
        titulo = " ".join(unicodedata.normalize("NFC", fila["titulo"]).split())
        return ("video", dict(id=i, titulo=titulo, descripcion=f"«{titulo}», publicado por {fila['canal']} en YouTube.", detalle=None, fecha=None, segundos=None,
                              canal=fila["canal"], fuente=fila["url"]))
    return ([("foto", a) for a in _foto("congreso", 57, 62)] + [v_inst("vid.demo.03")] + [("foto", a) for a in _foto("rock", 37, 40)] + [v_inst("vid.demo.06")])


def videos_todos() -> list:
    """Todos los videos que siembra este libro (álbumes y sueltos), sin repetir: [{id, titulo, canal}]. Los usa el descargador de miniaturas."""
    vistos, out = set(), []
    for items in [a["items"] for a in albumes()] + [sueltos()]:
        for t, x in items:
            if t == "video" and x["id"] not in vistos:
                vistos.add(x["id"])
                out.append({"id": x["id"], "titulo": x["titulo"], "canal": x["canal"]})
    return out


def alias_de_miniatura(video_id: str) -> str:
    from miniaturas_de_videos import alias_de
    return alias_de(video_id)


def _sql_texto(v) -> str:
    return "NULL" if v is None else "N'" + str(v).replace("'", "''") + "'"


def _sql_alt(alias_item: str, alt: str) -> str:
    return ("UPDATE i SET i.TextoAlternativo = " + _sql_texto(alt) + " FROM dbo.GaleriaItems i JOIN dbo.DatosDeDemostracion di ON di.Tabla = N'GaleriaItems' AND di.IdRegistro = i.IdGaleriaItem "
            "AND di.Alias = " + _sql_texto(alias_item) + " WHERE i.TipoItem = N'foto';")


def sql_de_ajustes() -> str:
    """UPDATE idempotentes para una demo YA sembrada con la versión anterior del libro: miniatura propia de cada video, portada de los álbumes de video,
    títulos y descripciones mejorados. Solo toca filas que el kit ya registró en `DatosDeDemostracion` y solo rellena lo que falta; no borra nada."""
    from pool import Pool  # noqa: PLC0415
    pool = Pool(autogenerar=False)
    partes = ["SET NOCOUNT ON;"]
    for n, (t, x) in enumerate(sueltos(), 1):
        if t == "foto":
            partes.append(_sql_alt(f"galeria.sin-album.item.{n:02d}", alt_limpio(pool.resolver(x).alt)))
        else:
            partes.append(
                "UPDATE i SET i.MiniaturaArchivoId = COALESCE(i.MiniaturaArchivoId, (SELECT d.IdRegistro FROM dbo.DatosDeDemostracion d WHERE d.Alias = " + _sql_texto(alias_de_miniatura(x["id"])) + ")) "
                "FROM dbo.GaleriaItems i JOIN dbo.DatosDeDemostracion di ON di.Tabla = N'GaleriaItems' AND di.IdRegistro = i.IdGaleriaItem AND di.Alias = " + _sql_texto(f"galeria.sin-album.item.{n:02d}") + ";")
    for a in albumes():
        alias = f"galeria.{a['slug']}"
        videos = [x for t, x in a["items"] if t == "video"]
        for n, (t, x) in enumerate(a["items"], 1):
            if t == "foto":
                partes.append(_sql_alt(f"{alias}.item.{n:02d}", alt_limpio(pool.resolver(x).alt)))
                continue
            item = f"{alias}.item.{n:02d}"
            mini = alias_de_miniatura(x["id"])
            partes.append(
                "UPDATE i SET i.MiniaturaArchivoId = COALESCE(i.MiniaturaArchivoId, (SELECT d.IdRegistro FROM dbo.DatosDeDemostracion d WHERE d.Alias = " + _sql_texto(mini) + ")), "
                f"i.Titulo = {_sql_texto(x['titulo'])}, i.Descripcion = {_sql_texto(x['descripcion'])}, i.Detalle = {_sql_texto(x['detalle'])} "
                "FROM dbo.GaleriaItems i JOIN dbo.DatosDeDemostracion di ON di.Tabla = N'GaleriaItems' AND di.IdRegistro = i.IdGaleriaItem AND di.Alias = " + _sql_texto(item) + ";")
        if a["tipo"] == "videos" and videos:
            mini = alias_de_miniatura(videos[0]["id"])
            partes.append(
                "UPDATE g SET g.PortadaArchivoId = (SELECT d.IdRegistro FROM dbo.DatosDeDemostracion d WHERE d.Alias = " + _sql_texto(mini) + ") "
                f"FROM dbo.GaleriaAlbumes g WHERE g.Slug = {_sql_texto(a['slug'])} AND g.PortadaArchivoId IS NULL "
                "AND EXISTS (SELECT 1 FROM dbo.DatosDeDemostracion d WHERE d.Alias = " + _sql_texto(mini) + ");")
    return "\n".join(partes) + "\n"


def _fila_item(plan, img, alias_album, n, tipo, x, alias_item):
    """Una fila de `GaleriaItems`: de un álbum (`alias_album`) o suelta (`None`)."""
    base = dict(GaleriaAlbumId=Ref(alias_album) if alias_album else None, Orden=n, Publicado=True)
    if tipo == "foto":
        valores = dict(base, TipoItem="foto", Titulo=None, Descripcion=None, Detalle=None, Fecha=None, Credito=img.pool.resolver(x).credito or None,
                       TextoAlternativo=alt_limpio(img.alt(x)), ArchivoId=img.ref(x, lote=LOTE, nivel=NIVEL), VideoId=None, DuracionSegundos=None, MiniaturaArchivoId=None)
        fuente = FUENTE_FOTOS
    else:
        valores = dict(base, TipoItem="video", Titulo=x["titulo"], Descripcion=x["descripcion"], Detalle=x["detalle"],
                       Fecha=dt.date.fromisoformat(x["fecha"]) if x["fecha"] else None, Credito=x["canal"], TextoAlternativo=None, ArchivoId=None,
                       VideoId=x["id"], DuracionSegundos=x["segundos"], MiniaturaArchivoId=img.ref(alias_de_miniatura(x["id"]), lote=LOTE, nivel=NIVEL))
        fuente = x["fuente"]
    plan.agregar("GaleriaItems", valores, alias=alias_item, lote=LOTE, nivel=NIVEL, procedencia="publico", fuente=fuente)


def sembrar(plan) -> None:
    img = plan.imagenes
    for a in albumes():
        alias = f"galeria.{a['slug']}"
        fotos = [x for t, x in a["items"] if t == "foto"]
        videos = [x for t, x in a["items"] if t == "video"]
        portada = img.ref(fotos[0], lote=LOTE, nivel=NIVEL) if fotos else (img.ref(alias_de_miniatura(videos[0]["id"]), lote=LOTE, nivel=NIVEL) if videos else None)
        plan.agregar("GaleriaAlbumes", dict(
            Slug=a["slug"], Titulo=a["titulo"], Descripcion=a["descripcion"], Tipo=a["tipo"], Lugar=None, FechaReferencia=dt.date.fromisoformat(a["fecha"]),
            PortadaArchivoId=portada, ListaOrigenUrl=a["lista"], Orden=a["orden"], Publicado=True,
        ), alias=alias, lote=LOTE, nivel=NIVEL, procedencia="publico", fuente=a["fuente"], clave_estable=f"n1.galeria.{a['slug']}")
        for n, (tipo, x) in enumerate(a["items"], 1):
            _fila_item(plan, img, alias, n, tipo, x, f"{alias}.item.{n:02d}")
    for n, (tipo, x) in enumerate(sueltos(), 1):
        _fila_item(plan, img, None, n, tipo, x, f"galeria.sin-album.item.{n:02d}")


def archivos_pedidos(plan) -> set:
    """Alias de `Archivos` que piden las filas de este libro (para la siembra aislada de scripts/demo/sembrar-galeria.sh)."""
    pedidos = set()
    for f in plan.filas:
        if f.lote == LOTE:
            for v in f.valores.values():
                if isinstance(v, Ref) and not v.alias.startswith("galeria."):
                    pedidos.add(v.alias)
    return pedidos
