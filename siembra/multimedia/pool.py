"""El pool de assets de la siembra: resuelve alias `img.*` a binarios, y los genera o importa cuando faltan.

Familias de alias (todas en minúsculas, separadas por puntos):

  img.<tipo>.<slug>.<rol>              → un asset PROPIO de ese registro; si no existe se genera de forma determinista (ver REGLAS).
  img.<tipo>.<slug>.galeria.NN         → una foto real del archivo del proyecto (equivale a un `img.pool.foto.*`; no se duplica el binario).
  img.pool.<clase>.NNN                 → piezas genéricas y reutilizables por muchos registros (N3): retratos, logos, portadas, afiches, imágenes.
  img.pool.foto.congreso.NNN / .rock.NNN   → las fotografías reales del proyecto (`simus-web/public/Galeria/`), optimizadas.
  img.pool.celebra.<pieza>             → las piezas oficiales de Celebra la música ya incluidas en el repo (`simus-database/seed/celebra-imagenes/`).
"""
from __future__ import annotations

import functools
import io
import json
import random
import re
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comun as C  # noqa: E402

try:  # Pillow solo hace falta para CONSTRUIR el pool; leerlo (plan y siembra) no lo necesita.
    from PIL import Image, ImageOps
    import ilustrador as I
except ImportError:  # pragma: no cover
    Image = ImageOps = I = None

GALERIA = C.RAIZ / "simus-web" / "public" / "Galeria"
CELEBRA = C.RAIZ / "simus-database" / "seed" / "celebra-imagenes"
SERIES = {"congreso": ("Congreso Nacional de Música", "Fotografía de la jornada del Congreso Nacional de Música: asistentes, conferencistas y actividades del encuentro (imagen {n} de {t})."),
          "rock": ("Mesa Nacional de Rock - Instalación", "Fotografía de la Mesa Nacional de Rock: músicos, conversatorios y público en el auditorio (imagen {n} de {t}).")}
OBJETIVO_DE_SERIE = {"congreso": 182, "rock": 72}  # alias que usan los libros de la siembra
CREDITO_FOTO = "Archivo fotográfico del proyecto SIMUS"
CREDITO_ILUSTRACION = "Ilustración original del equipo de SIMUS"
CREDITO_CELEBRA = "Ministerio de Cultura de Colombia, Celebra la música"
# Logotipos REALES de los aliados, tomados de la página oficial (sitio institucional del Ministerio; uso: demostración no pública).
# (slug, nombre exacto, URL del logo). El sitio solo publica estos tres logos; el resto de aliados no tiene logo descargable.
SITIO_CELEBRA = "https://celebralamusica.mincultura.gov.co/Paginas"
ALIADOS_OFICIALES = [
    ("fundacion-nacional-batuta", "Fundación Nacional Batuta", f"{SITIO_CELEBRA}/assets/logos/clm-2026-batuta.png"),
    ("asociacion-nacional-de-las-artes", "Asociación Nacional de las Artes", f"{SITIO_CELEBRA}/assets/logos/clm-2026-ana.png"),
    ("fundacion-poliedro", "Fundación Poliedro", f"{SITIO_CELEBRA}/assets/logos/logo-poliedro-2026.png"),
]
FECHA_DESCARGA_ALIADOS = "2026-11-22"

# Tamaño de cada clase del pool genérico (img.pool.<clase>.NNN, NNN de 001 a N). Las fotos de las personas del directorio ya NO son retratos ilustrados:
# son las fotos libres de siembra/imagenes/ (img.pool.agente.NNN, ver importar_fotos_libres).
CLASES_DEL_POOL = {"organizacion.logo": 80, "festival.portada": 40, "festival.afiche": 40, "evento.imagen": 60,
                   "noticia.imagen": 60, "espacio.foto": 24}
FAMILIAS = ("tambor", "marimba", "cuerdas", "flauta", "arcos", "disco", "ondas")
OBJETO = {"tambor": "un tambor", "marimba": "una marimba de teclas largas", "cuerdas": "un instrumento de cuerda pulsada", "flauta": "flautas de caña",
          "arcos": "arcos concéntricos y una batuta", "disco": "un disco de vinilo", "ondas": "barras de un ecualizador"}
# (tipo, rol) → generador. «foto» y «imagen» son ilustraciones; los retratos son figuras planas.
REGLAS = {("persona", "retrato"): "retrato", ("participante", "foto"): "retrato",
          ("organizacion", "logo"): "logo", ("festival", "logo"): "logo", ("mercado", "logo"): "logo", ("red", "logo"): "logo",
          ("organizacion", "portada"): "portada", ("festival", "portada"): "portada", ("mercado", "portada"): "portada", ("edicion", "portada"): "portada",
          ("festival", "afiche"): "afiche", ("mercado", "afiche"): "afiche", ("edicion", "afiche"): "afiche",
          ("evento", "imagen"): "escena", ("noticia", "imagen"): "escena",
          ("taller", "foto"): "espacio", ("espacio", "foto"): "espacio", ("red", "foto"): "espacio", ("proceso", "foto"): "espacio",
          ("soporte", "documento"): "soporte", ("documento", "pdf"): "pdf"}
TIPOS_CON_GALERIA = {"festival", "mercado", "edicion", "noticia", "organizacion", "evento"}
PRIVADOS = {("soporte", "documento"), ("documento", "pdf"), ("participante", "foto")}


class AliasSinAsset(KeyError):
    pass


def partir(alias: str) -> tuple:
    """(tipo, slug, rol, n) de un alias; n es None salvo en `…galeria.NN`."""
    p = alias.split(".")
    if len(p) >= 5 and p[-2] == "galeria" and p[-1].isdigit():
        return p[1], ".".join(p[2:-2]), "galeria", int(p[-1])
    return p[1], ".".join(p[2:-1]), p[-1], None


class Pool:
    def __init__(self, directorio: Optional[str] = None, manifiesto: Path = C.MANIFIESTO, autogenerar: bool = True):
        self.dir = C.pool_dir(directorio)
        self.ruta_manifiesto = manifiesto
        self.assets = C.leer_manifiesto(manifiesto)
        self.autogenerar = autogenerar
        self.nuevos: list = []
        self.pedidos: set = set()

    # ------------------------------------------------------------------ lectura
    def existe(self, alias: str) -> bool:
        return alias in self.assets

    def resolver(self, alias: str, **meta) -> C.Asset:
        """Asset final de un alias (siguiendo `equivale_a`). Si falta y `autogenerar`, lo crea."""
        self.pedidos.add(alias)
        a = self.assets.get(alias)
        if a is None:
            if not C.RE_ALIAS.match(alias):
                raise AliasSinAsset(f"alias mal formado: {alias} (esperado img.<tipo>.<slug>.<rol>)")
            if not self.autogenerar:
                raise AliasSinAsset(f"el alias {alias} no está en el manifiesto")
            a = self._crear(alias, meta)
        return self.assets[a.equivale_a] if a.equivale_a else a

    def contenido(self, a: C.Asset) -> bytes:
        ruta = C.ruta_del_asset(a, self.dir)
        if not ruta.exists():
            raise FileNotFoundError(f"Falta el binario {ruta}. Construye el pool: python3 siembra/multimedia/construir.py base")
        return ruta.read_bytes()

    def reparar(self) -> int:
        """Regenera los assets GENERADOS cuyo binario falta (otro equipo/otro disco): mismo alias y mismo meta = mismo resultado. Las fotos reales no se tocan."""
        faltan = [a for a in self.assets.values() if not a.equivale_a and a.origen not in ("foto-proyecto", C.ORIGEN_FOTO_LIBRE) and not (self.dir / a.archivo).exists() and a.origen not in ("celebra-oficial", "celebra-aliado-oficial")]
        for a in faltan:
            meta = json.loads(a.meta) if a.meta else {}
            del self.assets[a.alias]
            self.resolver(a.alias, **meta)
        return len(faltan)

    # ------------------------------------------------------------------ escritura
    def guardar_manifiesto(self) -> None:
        C.escribir_manifiesto(self.assets, self.ruta_manifiesto)

    def _registrar(self, alias, datos: bytes, mime: str, ancho: int, alto: int, alt: str, pie: str, credito: str, fuente: str, procedencia: str,
                   origen: str, uso: str, im_mini: Optional[Image.Image], meta: dict, subdir: str) -> C.Asset:
        limite = C.MAX_PDF if mime == "application/pdf" else C.MAX_IMAGEN
        if len(datos) > limite:
            raise ValueError(f"{alias}: {len(datos)} bytes superan el tope del banco ({limite})")
        if not alt or len(alt) > 300:
            raise ValueError(f"{alias}: el texto alternativo es obligatorio y de hasta 300 caracteres")
        rel = f"{subdir}/{alias}{C.MIMES[mime]}"
        (self.dir / subdir).mkdir(parents=True, exist_ok=True)
        (self.dir / rel).write_bytes(datos)
        mini = ""
        if im_mini is not None:
            mini = f"miniaturas/{alias}.webp"
            (self.dir / "miniaturas").mkdir(parents=True, exist_ok=True)
            (self.dir / mini).write_bytes(I.miniatura(im_mini))
        a = C.Asset(alias=alias, archivo=rel, mime=mime, ancho=ancho, alto=alto, bytes=len(datos), alt=alt, pie=pie[:500], credito=credito[:200],
                    fuente=fuente, procedencia=procedencia, origen=origen, uso=uso, checksum=C.sha256(datos), miniatura=mini,
                    meta=json.dumps(meta, ensure_ascii=False, sort_keys=True) if meta else "")
        self.assets[alias] = a
        self.nuevos.append(alias)
        return a

    # ------------------------------------------------------------------ generación determinista
    @staticmethod
    def _requiere_pillow() -> None:
        if I is None:
            raise AliasSinAsset("Falta Pillow para generar assets (pip install Pillow) o el alias no está en el manifiesto; el pool ya construido no lo necesita.")

    def _crear(self, alias: str, meta: dict) -> C.Asset:
        self._requiere_pillow()
        tipo, slug, rol, n = partir(alias)
        if tipo == "pool":
            return self._crear_del_pool(alias)
        if rol == "galeria":
            if tipo not in TIPOS_CON_GALERIA:
                raise AliasSinAsset(f"{alias}: el tipo «{tipo}» no tiene galería")
            return self._galeria(alias, slug, n)
        if alias.startswith("img.galeria.miniatura."):
            sem = C.semilla_de(alias)
            familia = FAMILIAS[sem % len(FAMILIAS)]
            im = I.escena(sem, C.REGIONES[sem % 6], familia, 1280, 720)
            return self._registrar(alias, I.a_jpeg(im), "image/jpeg", im.size[0], im.size[1], "Portada ilustrada de un video de la Galería: telón, haces de luz y un instrumento.",
                                   "Portada de un video.", CREDITO_ILUSTRACION, "generado", "sintetico", "generado", "publico", im, {"miniatura_de_video": True}, "miniaturas-de-video")
        regla = REGLAS.get((tipo, rol))
        if regla is None:
            raise AliasSinAsset(f"{alias}: combinación tipo/rol sin regla (ver REGLAS en pool.py)")
        return self._generar(alias, regla, tipo, slug, rol, meta)

    def _galeria(self, alias: str, slug: str, n: int) -> C.Asset:
        todas = sorted(x for x in self.assets if x.startswith("img.pool.foto."))
        if not todas:
            raise AliasSinAsset(f"{alias}: no hay fotos en el pool; ejecuta construir.py base")
        rng = random.Random(C.semilla_de(f"galeria:{slug}"))
        paso = rng.choice([p for p in (7, 11, 13, 17, 19, 23) if len(todas) % p])
        elegida = todas[(rng.randrange(len(todas)) + (n - 1) * paso) % len(todas)]
        a = C.Asset(alias=alias, equivale_a=elegida, procedencia="publico", origen="foto-proyecto", fuente=self.assets[elegida].fuente,
                    meta=json.dumps({"galeria": slug, "n": n}))
        self.assets[alias] = a
        self.nuevos.append(alias)
        return a

    def _crear_del_pool(self, alias: str) -> C.Asset:
        p = alias.split(".")
        if p[2] in ("foto", "celebra"):
            raise AliasSinAsset(f"{alias}: las fotos y piezas oficiales las importa `construir.py base`")
        clase, num = ".".join(p[2:-1]), p[-1]
        if clase not in CLASES_DEL_POOL or not num.isdigit() or not 1 <= int(num) <= CLASES_DEL_POOL[clase]:
            raise AliasSinAsset(f"{alias}: clase o número fuera del pool (clases: {sorted(CLASES_DEL_POOL)})")
        tipo, rol = clase.split(".")
        regla = {"retrato": "retrato", "logo": "logo", "portada": "portada", "afiche": "afiche", "imagen": "escena", "foto": "espacio"}[rol]
        i = int(num)
        meta = {"region": C.REGIONES[i % 6], "familia": FAMILIAS[(i // 3) % len(FAMILIAS)], "generico": True}
        return self._generar(alias, regla, tipo, f"generico-{num}", rol, meta)

    def _generar(self, alias: str, regla: str, tipo: str, slug: str, rol: str, meta: dict) -> C.Asset:
        sem = C.semilla_de(alias)
        rng = random.Random(sem)
        nombre = "" if meta.get("generico") else (meta.get("nombre") or I.titulo_de_slug(slug))
        region = meta.get("region") or (C.region_de(meta["departamento"]) if meta.get("departamento") else rng.choice(C.REGIONES))
        familia = meta.get("familia") or (C.familia_de_practica(meta.get("practica", "")) if meta.get("practica") else rng.choice(FAMILIAS))
        sujeto = nombre or "una organización cultural"
        uso = "privado" if (tipo, rol) in PRIVADOS else "publico"
        guardar = {k: v for k, v in meta.items() if k in ("nombre", "region", "familia", "practica", "departamento", "generico", "subtitulo", "lineas")}
        credito, fuente = CREDITO_ILUSTRACION, "generado"
        if regla == "retrato":
            im, rasgos = I.retrato(sem, region)
            datos, mime = I.a_png(im, 96), "image/png"
            alt = (f"Retrato ilustrado de {nombre}: figura estilizada con {rasgos}." if nombre else f"Retrato ilustrado de una persona: figura estilizada con {rasgos}.")
            pie = f"Retrato de {nombre}." if nombre else "Retrato ilustrado."
        elif regla == "logo":
            im, forma = I.logotipo(sem, nombre, region, familia)
            datos, mime = I.a_png(im, 96), "image/png"
            usados = {x.checksum for x in self.assets.values()}
            for k in range(1, 40):   # dos organizaciones con las mismas iniciales, región, forma y motivo darían el mismo archivo: la ruta del banco es única por huella
                if C.sha256(datos) not in usados:
                    break
                im, forma = I.logotipo(sem + 7919 * k, nombre, region, familia)
                datos = I.a_png(im, 96)
            if nombre:
                alt = f"Logotipo de {nombre}: monograma «{I.iniciales(nombre)}» sobre una forma {forma} con la silueta de {OBJETO[familia]}."
            else:
                alt = f"Logotipo abstracto sobre una forma {forma} con la silueta de {OBJETO[familia]}, en colores de la región {region}."
            pie = f"Logotipo de {nombre}." if nombre else "Logotipo."
        elif regla == "portada":
            im = I.portada(sem, nombre, meta.get("subtitulo", ""), region, familia)
            datos, mime = I.a_webp(im), "image/webp"
            alt = (f"Portada de {nombre}: el nombre en letras grandes sobre un fondo de círculos concéntricos y la silueta de {OBJETO[familia]}."
                   if nombre else f"Portada abstracta de círculos concéntricos con la silueta de {OBJETO[familia]}, en colores de la región {region}.")
            pie = f"Portada de {nombre}." if nombre else "Portada ilustrada."
        elif regla == "afiche":
            im = I.afiche(sem, nombre, meta.get("subtitulo", ""), list(meta.get("lineas", [])), region, familia)
            datos, mime = I.a_webp(im), "image/webp"
            alt = (f"Afiche vertical de {nombre}: título, datos del encuentro y la silueta de {OBJETO[familia]} sobre fondos de color."
                   if nombre else f"Afiche vertical abstracto con la silueta de {OBJETO[familia]} sobre fondos de color de la región {region}.")
            pie = f"Afiche de {nombre}." if nombre else "Afiche ilustrado."
        elif regla == "escena":
            im = I.escena(sem, region, familia, 1200, 675)
            datos, mime = I.a_webp(im), "image/webp"
            alt = f"Ilustración de un paisaje de la región {region} con {OBJETO[familia]} en primer plano y un sol grande al fondo."
            pie = meta.get("pie") or "Ilustración editorial."
        elif regla == "espacio":
            im = I.foto_de_espacio(sem, region, familia, 1200, 800)
            datos, mime = I.a_webp(im), "image/webp"
            alt = f"Ilustración de un escenario con telones y haces de luz, y {OBJETO[familia]} en el centro."
            pie = f"Imagen de {nombre}." if nombre else "Ilustración de un espacio."
        elif regla == "soporte":
            im = I.soporte(sem, nombre or "Documento de soporte")
            datos, mime = I.a_png(im, 32), "image/png"
            alt = "Hoja de un documento de soporte con encabezado de color, párrafos de texto y un sello circular en la esquina inferior."
            pie, credito = "Soporte de una solicitud.", "Documento adjunto por la organización"
        elif regla == "pdf":
            paginas = [I.soporte(sem + k, (nombre or "Documento") + (f" ({k + 1})" if k else "")) for k in range(3)]
            im = paginas[0]
            datos, mime = I.a_pdf(paginas), "application/pdf"
            alt = "Documento PDF de tres hojas con encabezado de color, párrafos y un sello circular."
            pie, credito = f"Documento de {nombre}." if nombre else "Documento.", "Documento de SIMUS"
        else:
            raise AliasSinAsset(regla)
        return self._registrar(alias, datos, mime, im.size[0], im.size[1], alt, pie, credito, fuente, "sintetico", "generado", uso, im, guardar, tipo)

    # ------------------------------------------------------------------ importación de lo real
    def importar_fotos(self, limite: Optional[int] = None) -> int:
        self._requiere_pillow()
        n_total = 0
        for clave, (carpeta, plantilla) in SERIES.items():
            fuentes = sorted(p for p in (GALERIA / carpeta).iterdir() if p.suffix.lower() in (".jpg", ".jpeg"))
            if limite:
                fuentes = fuentes[:limite]
            for i, ruta in enumerate(fuentes, 1):
                alias = f"img.pool.foto.{clave}.{i:03d}"
                if alias in self.assets and (self.dir / self.assets[alias].archivo).exists():
                    continue
                im = ImageOps.exif_transpose(Image.open(ruta)).convert("RGB")  # sin EXIF: se re-codifica
                im.thumbnail((C.LADO_MAXIMO, C.LADO_MAXIMO), Image.LANCZOS)
                datos = I.a_jpeg(im)
                self._registrar(alias, datos, "image/jpeg", im.size[0], im.size[1], plantilla.format(n=i, t=len(fuentes)),
                                f"{carpeta}.", CREDITO_FOTO, f"simus-web/public/Galeria/{carpeta}/{ruta.name}", "publico", "foto-proyecto", "publico", im, {"serie": clave, "orden": i}, "fotos")
                n_total += 1
            for i in range(len(fuentes) + 1, OBJETIVO_DE_SERIE.get(clave, 0) + 1):  # sin las fotos de trabajo: ilustración determinista
                alias = f"img.pool.foto.{clave}.{i:03d}"
                if alias in self.assets and (self.dir / self.assets[alias].archivo).exists():
                    continue
                familia = FAMILIAS[(i // 3) % len(FAMILIAS)]
                im = I.foto_de_espacio(C.semilla_de(alias), C.REGIONES[i % 6], familia, 1600, 1070)
                self._registrar(alias, I.a_jpeg(im), "image/jpeg", im.size[0], im.size[1],
                                f"Ilustración de un escenario con telones y haces de luz, y {OBJETO[familia]} en el centro (imagen {i} de {OBJETIVO_DE_SERIE[clave]}).",
                                f"{carpeta}.", CREDITO_ILUSTRACION, "generado", "sintetico", "generado", "publico", im, {"serie": clave, "orden": i, "sintetica": True}, "fotos")
                n_total += 1
        return n_total

    def importar_celebra(self) -> int:
        tsv = (CELEBRA / "imagenes.tsv").read_text(encoding="utf-8").splitlines()[1:]
        n = 0
        for linea in tsv:
            archivo, ancho, alto, alt, credito = linea.split("\t")
            nombre = archivo.replace("celebra-oficial-", "").rsplit(".", 1)[0]
            alias = f"img.pool.celebra.{nombre}"
            if alias in self.assets and (self.dir / self.assets[alias].archivo).exists():
                continue
            datos = (CELEBRA / archivo).read_bytes()
            im = Image.open(io.BytesIO(datos))
            url = re.search(r"https?://\S+", credito)
            self._registrar(alias, datos, "image/webp", im.size[0], im.size[1], alt, "Pieza oficial de Celebra la música.", CREDITO_CELEBRA,
                            url.group(0) if url else "simus-database/seed/celebra-imagenes", "publico", "celebra-oficial", "publico", im, {"archivo": archivo}, "celebra")
            n += 1
        return n

    def importar_aliados(self) -> int:
        """Logos reales de los aliados de Celebra: `organizacion/aliado-<slug>.png` en el pool (se descargan una vez si faltan; sin recortar ni deformar)."""
        import urllib.request
        n = 0
        for slug, nombre, url in ALIADOS_OFICIALES:
            alias = f"img.organizacion.aliado-{slug}.logo"
            rel = f"organizacion/aliado-{slug}.png"
            ruta = self.dir / rel
            if alias in self.assets and ruta.exists():
                continue
            if not ruta.exists():
                ruta.parent.mkdir(parents=True, exist_ok=True)
                req = urllib.request.Request(url, headers={"User-Agent": "simus-siembra/1.0"})
                try:
                    with urllib.request.urlopen(req, timeout=30) as r:
                        ruta.write_bytes(r.read())
                except OSError as e:  # sin red: el logo se genera como los demás del pool
                    print(f"aviso: no se pudo descargar el logo de {nombre} ({e}); se genera uno sintético", file=sys.stderr)
                    continue
            datos = ruta.read_bytes()
            im = Image.open(io.BytesIO(datos))
            if im.format != "PNG":
                raise ValueError(f"{alias}: se esperaba PNG y llegó {im.format}")
            self.assets[alias] = C.Asset(
                alias=alias, archivo=rel, mime="image/png", ancho=im.size[0], alto=im.size[1], bytes=len(datos),
                alt=f"Logotipo de {nombre}", pie=f"Logotipo de {nombre}, aliado de Celebra la música.", credito=CREDITO_CELEBRA,
                fuente=url, procedencia="publico", origen="celebra-aliado-oficial", uso="publico", checksum=C.sha256(datos), miniatura="",
                meta=json.dumps({"nombre": nombre, "descargado": FECHA_DESCARGA_ALIADOS, "url": url}, ensure_ascii=False, sort_keys=True))
            self.nuevos.append(alias)
            n += 1
        return n

    def importar_fotos_libres(self) -> int:
        """Fotos de licencia libre (CC0 / dominio público) de `siembra/imagenes/`: alias `img.pool.agente.NNN`, uno por foto de `catalogo.json`.
        Los binarios están versionados (≈100 KB cada uno) y la procedencia de cada una, en `siembra/imagenes/LICENCIAS.md`. No necesita Pillow ni red."""
        catalogo = json.loads((C.IMAGENES_LIBRES / "catalogo.json").read_text(encoding="utf-8"))
        n = 0
        for f in catalogo["fotos"]:
            alias = f"img.pool.agente.{f['n']:03d}"
            datos = (C.IMAGENES_LIBRES / f["archivo"]).read_bytes()
            nueva = C.Asset(
                alias=alias, archivo=f["archivo"], mime="image/jpeg", ancho=f["ancho"], alto=f["alto"], bytes=len(datos), alt=f["alt"], pie=f["pie"],
                credito=f["credito"], fuente=f["url"], procedencia="publico", origen=C.ORIGEN_FOTO_LIBRE, uso="publico", checksum=C.sha256(datos), miniatura="",
                meta=json.dumps({"licencia": f["licencia"], "consulta": f["consulta"], "etiquetas": f["etiquetas"]}, ensure_ascii=False, sort_keys=True))
            if self.assets.get(alias) != nueva:
                self.assets[alias] = nueva
                n += 1
        return n

    def construir_pool_generico(self) -> int:
        n = 0
        for clase, total in CLASES_DEL_POOL.items():
            for i in range(1, total + 1):
                alias = f"img.pool.{clase}.{i:03d}"
                if alias in self.assets and (self.dir / self.assets[alias].archivo).exists():
                    continue
                self.autogenerar = True
                self._crear_del_pool(alias)
                n += 1
        return n


def alias_del_pool(clase: str, clave: str) -> str:
    """Alias estable del pool genérico para una clave cualquiera (N3): `alias_del_pool("organizacion.logo", "n3-org-0042")`."""
    total = CLASES_DEL_POOL[clase]
    return f"img.pool.{clase}.{(C.semilla_de(clave) % total) + 1:03d}"


@functools.lru_cache(maxsize=1)
def total_de_fotos_de_agentes() -> int:
    return len(json.loads((C.IMAGENES_LIBRES / "catalogo.json").read_text(encoding="utf-8"))["fotos"])


def alias_de_foto_de_agente(posicion: int) -> str:
    """Alias de la foto libre número `posicion` (módulo el total de fotos): las fichas de agentes reparten las fotos de `siembra/imagenes/`."""
    return f"img.pool.agente.{(posicion % total_de_fotos_de_agentes()) + 1:03d}"
