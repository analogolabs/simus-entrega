#!/usr/bin/env python3
"""Verificación de la siembra contra una API ya levantada sobre la base sembrada. No escribe nada.

    python3 -I siembra/generador/verificar_api.py URL ARCHIVO_DE_IDS

`ARCHIVO_DE_IDS` (lo arma `scripts/demo/siembra-integral.sh verificar-api` consultando la base) tiene líneas `clave<TAB>valor`:
festival, organizacion, persona, noticia, evento, img_publica (varias), img_borrador (404 esperado), img_soporte (404 esperado).
Comprueba: fichas públicas (festival N1, sus ediciones, organización, persona, noticia, evento), imágenes públicas (200 y ETag = huella del cuerpo),
imágenes de fichas sin publicar o de soporte (404) y el ingreso de las seis cuentas de validación («admin»).
"""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.error
import urllib.request

CUENTAS = [("externo", "camila.restrepo@simus.test"), ("externo", "editor@simus.test"), ("externo", "reclamante@simus.test"), ("externo", "nuevo@simus.test"),
           ("admin", "webmaster@simus.test"), ("admin", "gestor@simus.test")]
CLAVE = "admin"


def pedir(url, datos=None):
    req = urllib.request.Request(url, data=json.dumps(datos).encode() if datos is not None else None, headers={"Content-Type": "application/json"} if datos is not None else {})
    try:
        r = urllib.request.urlopen(req, timeout=60)
        return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def main(argv) -> int:
    base, ruta = argv[0].rstrip("/"), argv[1]
    ids: dict = {}
    for linea in open(ruta, encoding="utf-8").read().splitlines():
        if "\t" in linea:
            k, v = linea.split("\t", 1)
            ids.setdefault(k, []).append(v.strip())
    malos = 0

    def chequear(nombre, ok, detalle=""):
        nonlocal malos
        malos += not ok
        print(f"[{'ok' if ok else 'FALLA'}] {nombre} {detalle}")

    fid = ids["festival"][0]
    c, cuerpo, _ = pedir(f"{base}/api/v1/publico/festivales/{fid}")
    ficha = json.loads(cuerpo) if c == 200 else {}
    chequear("ficha pública del festival N1", c == 200 and bool(ficha), f"({c}, festival {fid}, {len(cuerpo)} B)")
    c, cuerpo, _ = pedir(f"{base}/api/v1/publico/festivales/{fid}/ediciones")
    ed = json.loads(cuerpo) if c == 200 else []
    n = len(ed if isinstance(ed, list) else ed.get("items", ed.get("ediciones", [])))
    chequear("ediciones del festival", c == 200 and n >= 3, f"({c}, {n} ediciones)")
    c, cuerpo, _ = pedir(f"{base}/api/v1/publico/organizaciones/{ids['organizacion'][0]}")
    chequear("ficha pública de la organización", c == 200, f"({c})")
    c, cuerpo, _ = pedir(f"{base}/api/v1/publico/personas/{ids['persona'][0]}")
    chequear("perfil público de la persona", c == 200, f"({c})")
    c, cuerpo, _ = pedir(f"{base}/api/v1/publico/noticias/{ids['noticia'][0]}")
    chequear("noticia publicada", c == 200, f"({c})")
    c, cuerpo, _ = pedir(f"{base}/api/v1/publico/agenda/{ids['evento'][0]}")
    chequear("evento publicado", c == 200, f"({c})")
    for i in ids.get("img_publica", []):
        c, cuerpo, h = pedir(f"{base}/api/v1/publico/archivos/{i}")
        etag = (h.get("ETag") or h.get("Etag") or "").strip('"')
        chequear(f"imagen pública {i}", c == 200 and etag == hashlib.sha256(cuerpo).hexdigest(), f"({c}, {len(cuerpo)} B, ETag {'coincide con la huella' if etag == hashlib.sha256(cuerpo).hexdigest() else 'NO coincide'})")
    for clave in ("img_borrador", "img_soporte"):
        for i in ids.get(clave, []):
            c, _, _ = pedir(f"{base}/api/v1/publico/archivos/{i}")
            chequear(f"archivo {clave[4:]} {i} no es público", c == 404, f"({c})")
    for canal, correo in CUENTAS:
        c, cuerpo, _ = pedir(f"{base}/api/v1/{'externo' if canal == 'externo' else 'admin'}/auth/login", {"email": correo, "password": CLAVE})
        chequear(f"ingreso de {correo}", c == 200, f"({c})")
    print(f"[verificar-api] {'TODO CORRECTO' if not malos else str(malos) + ' fallas'}")
    return 1 if malos else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
