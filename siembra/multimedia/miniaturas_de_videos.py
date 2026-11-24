#!/usr/bin/env python3
"""Miniaturas propias de los videos de la Galería: se descargan UNA sola vez, al sembrar, y viven en el pool y en el Banco de archivos.

    python3 -I siembra/multimedia/miniaturas_de_videos.py            # descarga las que falten (necesita red) y anota el manifiesto
    python3 -I siembra/multimedia/miniaturas_de_videos.py --revisar  # solo lista lo que falta, sin red

POR QUÉ. El portal NUNCA pide nada a YouTube mientras la persona navega (una petición a `i.ytimg.com` entrega su dirección IP a un tercero): la portada de
cada video es una imagen PROPIA del Banco de archivos. Solo al pulsar «Reproducir» se monta la incrustación `youtube-nocookie.com`. Este guion es el
ÚNICO lugar que habla con `i.ytimg.com`, y lo hace al sembrar, no en el navegador.

Se pide `maxresdefault.jpg` y, si el video no la tiene (404), `hqdefault.jpg`. El binario queda en `<pool>/miniaturas-de-video/` (fuera de git) y la fila
en `manifiesto.csv` (alias `img.galeria.miniatura.<huella del id>`, con el id y la fuente). Repetirlo no vuelve a descargar nada.
"""
from __future__ import annotations

import hashlib
import sys
import urllib.error
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parent / "libro"))
sys.path.insert(0, str(AQUI.parent / "generador"))

import comun as C  # noqa: E402

SUBDIR = "miniaturas-de-video"
VARIANTES = ("maxresdefault", "hqdefault")
MINIMO_BYTES = 4000   # YouTube responde un marcador diminuto cuando no hay imagen: no sirve


def alias_de(video_id: str) -> str:
    """Alias estable en el manifiesto (el id de YouTube lleva mayúsculas y guion bajo, que el alias no admite: va su huella)."""
    return "img.galeria.miniatura." + hashlib.sha1(video_id.encode("utf-8")).hexdigest()[:10]


def medidas_jpeg(datos: bytes) -> tuple:
    """(ancho, alto) de un JPEG leyendo su marcador SOFn (sin Pillow: el guion corre con `python3 -I`)."""
    if datos[:2] != b"\xff\xd8":
        raise ValueError("no es un JPEG")
    i = 2
    while i + 9 < len(datos):
        if datos[i] != 0xFF:
            i += 1
            continue
        marcador = datos[i + 1]
        if marcador in (0xD8, 0x01) or 0xD0 <= marcador <= 0xD7:
            i += 2
            continue
        largo = int.from_bytes(datos[i + 2:i + 4], "big")
        if 0xC0 <= marcador <= 0xCF and marcador not in (0xC4, 0xC8, 0xCC):
            return int.from_bytes(datos[i + 7:i + 9], "big"), int.from_bytes(datos[i + 5:i + 7], "big")
        i += 2 + largo
    raise ValueError("JPEG sin medidas")


def _descargar(video_id: str):
    for variante in VARIANTES:
        url = f"https://i.ytimg.com/vi/{video_id}/{variante}.jpg"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "SIMUS-siembra/1.0"}), timeout=30) as r:
                datos = r.read()
                if r.status == 200 and len(datos) >= MINIMO_BYTES:
                    return datos, url
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
    raise RuntimeError(f"{video_id}: ni maxresdefault ni hqdefault disponibles")


def asegurar(videos: list, pool_dir: str | None = None, descargar: bool = True) -> list:
    """`videos`: [{id, titulo, canal}]. Devuelve los alias que faltaban (y, con `descargar`, ya creados)."""
    assets = C.leer_manifiesto()
    base = C.pool_dir(pool_dir)
    faltan = []
    for v in videos:
        alias = alias_de(v["id"])
        a = assets.get(alias)
        if a is not None and (base / a.archivo).exists():
            continue
        faltan.append(alias)
        if not descargar:
            continue
        datos, url = _descargar(v["id"])
        ancho, alto = medidas_jpeg(datos)
        rel = f"{SUBDIR}/{alias}.jpg"
        (base / SUBDIR).mkdir(parents=True, exist_ok=True)
        (base / rel).write_bytes(datos)
        titulo = " ".join(v["titulo"].split())
        assets[alias] = C.Asset(
            alias=alias, archivo=rel, mime="image/jpeg", ancho=ancho, alto=alto, bytes=len(datos),
            alt=f"Imagen de portada del video «{titulo}»."[:300], pie=titulo[:500], credito=f"{v.get('canal') or 'YouTube'} (miniatura pública del video)"[:200],
            fuente=url, procedencia="publico", origen="miniatura-video", uso="publico", checksum=C.sha256(datos), meta=f'{{"videoId": "{v["id"]}"}}')
        C.escribir_manifiesto(assets)
    return faltan


def main(argv=None) -> int:
    import galeria
    revisar = "--revisar" in (argv if argv is not None else sys.argv[1:])
    videos = galeria.videos_todos()
    faltan = asegurar(videos, descargar=not revisar)
    print(f"[miniaturas] {len(videos)} videos; {'faltan' if revisar else 'descargadas ahora'}: {len(faltan)}")
    return 1 if (revisar and faltan) else 0


if __name__ == "__main__":
    sys.exit(main())
