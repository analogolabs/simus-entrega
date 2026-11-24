"""Ilustrador procedural de la siembra: retratos ilustrados, logotipos, portadas, afiches e imágenes editoriales.

Solo usa Pillow. Todo sale de una semilla (`semilla_de(alias)`): mismo alias + mismos parámetros + misma versión de Pillow y misma tipografía =
mismos píxeles. NADA es fotográfico y ningún rostro imita a una persona real: los retratos son figuras planas estilizadas.
"""
from __future__ import annotations

import io
import math
import random
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

# --------------------------------------------------------------------------------------------------------------------
# Paletas por región: (fondo claro, primario, secundario, acento, tinta oscura)
# --------------------------------------------------------------------------------------------------------------------
PALETAS = {
    "caribe": [("#fff1d6", "#e8590c", "#0b7285", "#fcc419", "#1b2a41"), ("#ffe8cc", "#d6336c", "#1098ad", "#ffd43b", "#2b1d3a"),
               ("#e3fafc", "#f76707", "#1864ab", "#fab005", "#14213d")],
    "pacifico": [("#e6fcf5", "#087f5b", "#f59f00", "#e03131", "#10261c"), ("#ebfbee", "#2b8a3e", "#fd7e14", "#1c7ed6", "#14281d"),
                 ("#fff9db", "#0ca678", "#e8590c", "#5f3dc4", "#0f2a24")],
    "andina": [("#f8f0e3", "#a61e4d", "#5c940d", "#f08c00", "#2a1a2e"), ("#f4eadc", "#c2255c", "#364fc7", "#e67700", "#26201c"),
               ("#fdf3e7", "#9c36b5", "#2f9e44", "#f59f00", "#2b1d36")],
    "orinoquia": [("#fff4e6", "#e67700", "#2f9e44", "#c92a2a", "#2f2013"), ("#fff9db", "#d9480f", "#5c7cfa", "#74b816", "#2b1a0f"),
                  ("#f4fce3", "#66a80f", "#e8590c", "#1c7ed6", "#1f2a12")],
    "amazonia": [("#ebfbee", "#2b8a3e", "#c2255c", "#fab005", "#0f2a17"), ("#e6fcf5", "#0b7285", "#e67700", "#74b816", "#0d2a2d"),
                 ("#f1f8e9", "#37b24d", "#7048e8", "#ff922b", "#12301a")],
    "insular": [("#e7f5ff", "#1971c2", "#f03e3e", "#ffd43b", "#102a43"), ("#e3fafc", "#0c8599", "#f76707", "#fcc419", "#0b2a35"),
                ("#edf2ff", "#3b5bdb", "#e64980", "#ffa94d", "#1c2541")],
}
PIELES = ["#f3d2b3", "#e5b48c", "#cf9568", "#b07650", "#8a583a", "#62402b"]
PELOS = ["#1c1714", "#2f241d", "#4a3324", "#6e4a2b", "#8c8f94", "#a8793a"]
TIPOGRAFIAS = ["/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
               "/Library/Fonts/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"]
TIPOGRAFIAS_TITULO = ["/System/Library/Fonts/Supplemental/Arial Black.ttf", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"] + TIPOGRAFIAS
PALABRAS_VACIAS = {"de", "del", "la", "las", "el", "los", "y", "e", "en", "a", "para", "por", "con", "al", "un", "una"}


def _rgb(h: str) -> tuple:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _mezcla(a: str, b: str, t: float) -> tuple:
    ca, cb = _rgb(a), _rgb(b)
    return tuple(int(ca[i] + (cb[i] - ca[i]) * t) for i in range(3))


def fuente(tamano: int, titulo: bool = False):
    for ruta in (TIPOGRAFIAS_TITULO if titulo else TIPOGRAFIAS):
        if Path(ruta).exists():
            try:
                return ImageFont.truetype(ruta, tamano)
            except OSError:
                continue
    return ImageFont.load_default(tamano)


def paleta(region: str, rng: random.Random) -> dict:
    p = rng.choice(PALETAS.get(region, PALETAS["andina"]))
    return dict(fondo=p[0], primario=p[1], secundario=p[2], acento=p[3], tinta=p[4])


def iniciales(nombre: str, n: int = 2) -> str:
    palabras = [w for w in re.split(r"[\s\-]+", nombre) if w and w.lower() not in PALABRAS_VACIAS and not w.isdigit()]
    if not palabras:
        return (nombre[:n] or "S").upper()
    return "".join(w[0] for w in palabras[:n]).upper()


def titulo_de_slug(slug: str) -> str:
    return " ".join(w.capitalize() if w not in PALABRAS_VACIAS else w for w in slug.replace("_", "-").split("-"))


def limpio(texto: str) -> str:
    """Las tipografías del sistema no traen todos los signos: se sustituyen los que faltan."""
    return (texto or "").replace("·", "|").replace("\u2014", "-").replace("\u2013", "-")


def ajustar(d: ImageDraw.ImageDraw, texto: str, ancho: int, alto: int, max_tam: int, min_tam: int = 18, titulo: bool = True, interlineado: float = 1.12):
    """Elige el mayor tamaño con que `texto` cabe en (ancho, alto) partiéndolo en líneas. Devuelve (fuente, líneas)."""
    for tam in range(max_tam, min_tam - 1, -2):
        f = fuente(tam, titulo)
        lineas, actual = [], ""
        for palabra in texto.split():
            prueba = (actual + " " + palabra).strip()
            if d.textlength(prueba, font=f) <= ancho or not actual:
                actual = prueba
            else:
                lineas.append(actual)
                actual = palabra
        lineas.append(actual)
        if all(d.textlength(l, font=f) <= ancho for l in lineas) and len(lineas) * tam * interlineado <= alto:
            return f, lineas
    f = fuente(min_tam, titulo)
    return f, [texto[:40]]


def texto_centrado(d, texto, caja, color, max_tam, min_tam=18, titulo=True, sombra=None, ancla_v="centro"):
    x0, y0, x1, y1 = caja
    texto = limpio(texto)
    f, lineas = ajustar(d, texto, x1 - x0, y1 - y0, max_tam, min_tam, titulo)
    alto_l = int(f.size * 1.12)
    total = alto_l * len(lineas)
    y = y0 + ((y1 - y0 - total) // 2 if ancla_v == "centro" else 0)
    for l in lineas:
        w = d.textlength(l, font=f)
        x = x0 + (x1 - x0 - w) / 2
        if sombra:
            d.text((x + max(2, f.size // 22), y + max(2, f.size // 22)), l, font=f, fill=sombra)
        d.text((x, y), l, font=f, fill=color)
        y += alto_l
    return y


def _lienzo(w: int, h: int, color) -> tuple:
    im = Image.new("RGB", (w, h), color if isinstance(color, tuple) else _rgb(color))
    return im, ImageDraw.Draw(im)


def _degradado(w: int, h: int, arriba: str, abajo: str) -> Image.Image:
    base = Image.new("RGB", (1, h))
    for y in range(h):
        base.putpixel((0, y), _mezcla(arriba, abajo, y / max(1, h - 1)))
    return base.resize((w, h))


# --------------------------------------------------------------------------------------------------------------------
# Motivos de instrumentos (siluetas planas) — se dibujan sobre un ImageDraw en una caja cuadrada (cx, cy, r)
# --------------------------------------------------------------------------------------------------------------------
def motivo(d: ImageDraw.ImageDraw, familia: str, cx: int, cy: int, r: int, color, color2, rng: random.Random) -> None:
    if familia == "tambor":
        d.ellipse([cx - r * .6, cy - r * .62, cx + r * .6, cy - r * .28], fill=color2)
        d.polygon([(cx - r * .6, cy - r * .45), (cx + r * .6, cy - r * .45), (cx + r * .46, cy + r * .6), (cx - r * .46, cy + r * .6)], fill=color)
        d.ellipse([cx - r * .46, cy + r * .45, cx + r * .46, cy + r * .75], fill=color)
        for i in range(-2, 3):
            d.line([(cx + i * r * .22, cy - r * .4), (cx + i * r * .16, cy + r * .6)], fill=color2, width=max(2, r // 28))
    elif familia == "marimba":
        n = 8
        for i in range(n):
            x = cx - r + i * (2 * r / n)
            alto = r * (1.0 - i * 0.07)
            d.rounded_rectangle([x + r * .02, cy - alto * .35, x + 2 * r / n - r * .02, cy + alto * .35], radius=r // 14, fill=color)
            d.rectangle([x + r / n * .6, cy + alto * .35, x + r / n * 1.4, cy + r * .62 - i * r * .03], fill=color2)
        d.line([(cx - r, cy + r * .62), (cx + r, cy + r * .5)], fill=color2, width=max(3, r // 20))
    elif familia == "cuerdas":
        d.ellipse([cx - r * .5, cy - r * .02, cx + r * .5, cy + r * .78], fill=color)
        d.ellipse([cx - r * .38, cy - r * .5, cx + r * .38, cy + r * .12], fill=color)
        d.ellipse([cx - r * .1, cy + r * .24, cx + r * .1, cy + r * .44], fill=color2)
        d.rectangle([cx - r * .06, cy - r * 1.0, cx + r * .06, cy - r * .2], fill=color2)
        d.rounded_rectangle([cx - r * .14, cy - r * 1.18, cx + r * .14, cy - r * .94], radius=r // 14, fill=color)
    elif familia == "flauta":
        for i in range(5):
            x = cx - r * .8 + i * r * .4
            alto = r * (1.4 - i * .18)
            d.rounded_rectangle([x - r * .13, cy - alto / 2 + (i * r * .08), x + r * .13, cy + alto / 2 + (i * r * .08)], radius=r // 8, fill=color)
            d.ellipse([x - r * .07, cy - alto / 2 + i * r * .08 + r * .05, x + r * .07, cy - alto / 2 + i * r * .08 + r * .19], fill=color2)
        d.line([(cx - r * .9, cy + r * .1), (cx + r * .9, cy + r * .28)], fill=color2, width=max(3, r // 18))
    elif familia == "arcos":
        for i in range(5):
            rr = r * (1.0 - i * .17)
            d.arc([cx - rr, cy - rr * .9, cx + rr, cy + rr * 1.1], 200, 340, fill=color if i % 2 == 0 else color2, width=max(6, r // 9))
        d.line([(cx - r * .2, cy + r * .9), (cx + r * .6, cy - r * .3)], fill=color2, width=max(4, r // 20))
        d.ellipse([cx + r * .52, cy - r * .38, cx + r * .68, cy - r * .22], fill=color)
    elif familia == "disco":
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
        for k in (.82, .64, .46):
            d.ellipse([cx - r * k, cy - r * k, cx + r * k, cy + r * k], outline=color2, width=max(2, r // 40))
        d.ellipse([cx - r * .28, cy - r * .28, cx + r * .28, cy + r * .28], fill=color2)
        d.ellipse([cx - r * .05, cy - r * .05, cx + r * .05, cy + r * .05], fill=color)
    else:  # ondas: barras de ecualizador
        n = 11
        for i in range(n):
            x = cx - r + i * (2 * r / n)
            alto = r * (.25 + .75 * abs(math.sin(i * .9 + rng.random())))
            d.rounded_rectangle([x, cy - alto, x + r * .13, cy + alto], radius=r // 22, fill=color if i % 3 else color2)


# --------------------------------------------------------------------------------------------------------------------
# Piezas
# --------------------------------------------------------------------------------------------------------------------
NOMBRES_PIEL = ["piel clara", "piel trigueña clara", "piel trigueña", "piel morena", "piel morena oscura", "piel oscura"]
NOMBRES_PELO = ["cabello negro", "cabello castaño oscuro", "cabello castaño", "cabello castaño cobrizo", "cabello canoso", "cabello rubio oscuro"]


def retrato(semilla: int, region: str = "andina", lado: int = 512) -> tuple:
    """Retrato ilustrado plano de una persona sintética (no fotográfico). Devuelve (imagen, descripción de rasgos para el texto alternativo)."""
    rng = random.Random(semilla)
    pal = paleta(region, rng)
    S = lado * 2
    im, d = _lienzo(S, S, _mezcla(pal["fondo"], pal["secundario"], .18))
    for _ in range(4):  # círculos de fondo
        r = rng.randint(S // 6, S // 3)
        x, y = rng.randint(0, S), rng.randint(0, S)
        d.ellipse([x - r, y - r, x + r, y + r], fill=_mezcla(pal["fondo"], rng.choice([pal["primario"], pal["secundario"], pal["acento"]]), .22))
    i_piel, i_pelo = rng.randrange(len(PIELES)), rng.randrange(len(PELOS))
    piel, pelo = _rgb(PIELES[i_piel]), _rgb(PELOS[i_pelo])
    rasgos = [NOMBRES_PIEL[i_piel]]
    sombra_piel = tuple(int(c * .86) for c in piel)
    ropa = _rgb(rng.choice([pal["primario"], pal["secundario"], pal["tinta"]]))
    cx = S // 2
    # torso y cuello
    d.ellipse([cx - S * .36, S * .70, cx + S * .36, S * 1.35], fill=ropa)
    d.rectangle([cx - S * .07, S * .56, cx + S * .07, S * .76], fill=sombra_piel)
    d.polygon([(cx - S * .1, S * .72), (cx + S * .1, S * .72), (cx, S * .83)], fill=sombra_piel)
    detalle = rng.choice(["cuello", "franja", "collar", "liso"])
    if detalle == "franja":
        d.rectangle([cx - S * .36, S * .93, cx + S * .36, S * .97], fill=_rgb(pal["acento"]))
    elif detalle == "collar":
        for i in range(9):
            a = math.pi * (.15 + .7 * i / 8)
            d.ellipse([cx + math.cos(a) * S * .13 - S * .014, S * .73 + math.sin(a) * S * .09 - S * .014, cx + math.cos(a) * S * .13 + S * .014, S * .73 + math.sin(a) * S * .09 + S * .014], fill=_rgb(pal["acento"]))
    # cabello detrás
    estilo = rng.choice(["corto", "largo", "mono", "rizado", "gorra", "calvo", "trenza"])
    rasgos.append({"corto": NOMBRES_PELO[i_pelo] + " corto", "largo": NOMBRES_PELO[i_pelo] + " largo y suelto", "mono": NOMBRES_PELO[i_pelo] + " recogido en moño",
                   "rizado": NOMBRES_PELO[i_pelo] + " rizado y voluminoso", "gorra": "gorra de color liso", "calvo": "cabeza rapada", "trenza": NOMBRES_PELO[i_pelo] + " en dos trenzas"}[estilo])
    ancho_c, alto_c = S * .27, S * .32
    cy = S * .46
    if estilo == "largo":
        d.rounded_rectangle([cx - ancho_c * 1.18, cy - alto_c * .8, cx + ancho_c * 1.18, cy + alto_c * 1.6], radius=int(S * .12), fill=pelo)
    elif estilo == "trenza":
        d.rounded_rectangle([cx + ancho_c * .8, cy, cx + ancho_c * 1.15, cy + alto_c * 2], radius=int(S * .05), fill=pelo)
        d.rounded_rectangle([cx - ancho_c * 1.15, cy, cx - ancho_c * .8, cy + alto_c * 2], radius=int(S * .05), fill=pelo)
    elif estilo == "rizado":
        for i in range(14):
            a = math.pi * (1.0 + i / 13)
            x, y = cx + math.cos(a) * ancho_c * 1.15, cy - alto_c * .15 + math.sin(a) * alto_c * 1.05
            d.ellipse([x - S * .07, y - S * .07, x + S * .07, y + S * .07], fill=pelo)
    # orejas y cabeza
    for lado_o in (-1, 1):
        d.ellipse([cx + lado_o * ancho_c * .98 - S * .035, cy - S * .03, cx + lado_o * ancho_c * .98 + S * .035, cy + S * .08], fill=sombra_piel)
    d.ellipse([cx - ancho_c, cy - alto_c, cx + ancho_c, cy + alto_c], fill=piel)
    # cabello delante
    if estilo in ("corto", "largo", "trenza", "mono"):
        d.pieslice([cx - ancho_c * 1.04, cy - alto_c * 1.08, cx + ancho_c * 1.04, cy + alto_c * .5], 180, 360, fill=pelo)
        d.polygon([(cx - ancho_c * 1.0, cy - alto_c * .05), (cx - ancho_c * .4, cy - alto_c * .75), (cx + ancho_c * .1, cy - alto_c * .35),
                   (cx + ancho_c * 1.0, cy - alto_c * .05), (cx + ancho_c * 1.0, cy - alto_c * .5), (cx, cy - alto_c * 1.05), (cx - ancho_c * 1.0, cy - alto_c * .5)], fill=pelo)
    if estilo == "mono":
        d.ellipse([cx - S * .09, cy - alto_c * 1.45, cx + S * .09, cy - alto_c * 1.1], fill=pelo)
    if estilo == "rizado":
        d.pieslice([cx - ancho_c * 1.06, cy - alto_c * 1.12, cx + ancho_c * 1.06, cy + alto_c * .35], 185, 355, fill=pelo)
    if estilo == "gorra":
        gorra = _rgb(rng.choice([pal["acento"], pal["primario"], pal["tinta"]]))
        d.pieslice([cx - ancho_c * 1.05, cy - alto_c * 1.15, cx + ancho_c * 1.05, cy + alto_c * .35], 180, 360, fill=gorra)
        d.rounded_rectangle([cx - ancho_c * 1.15, cy - alto_c * .42, cx + ancho_c * 1.4, cy - alto_c * .26], radius=int(S * .02), fill=tuple(int(c * .8) for c in gorra))
    # rostro
    ojos_y = cy - alto_c * .05
    for lado_o in (-1, 1):
        x = cx + lado_o * ancho_c * .42
        d.ellipse([x - S * .018, ojos_y - S * .022, x + S * .018, ojos_y + S * .022], fill=_rgb(pal["tinta"]))
        d.line([(x - S * .04, ojos_y - S * .06 + lado_o * S * .004), (x + S * .04, ojos_y - S * .065 - lado_o * S * .004)], fill=pelo if estilo != "calvo" else sombra_piel, width=int(S * .01))
    d.line([(cx, cy + alto_c * .0), (cx - S * .012, cy + alto_c * .28), (cx + S * .014, cy + alto_c * .3)], fill=sombra_piel, width=int(S * .008))
    if rng.random() < .75:
        d.arc([cx - ancho_c * .38, cy + alto_c * .32, cx + ancho_c * .38, cy + alto_c * .72], 20, 160, fill=_rgb(pal["tinta"]), width=int(S * .01))
    else:
        d.ellipse([cx - ancho_c * .14, cy + alto_c * .5, cx + ancho_c * .14, cy + alto_c * .62], fill=_rgb(pal["tinta"]))
    barba = rng.random() < .28
    if barba:  # barba
        d.pieslice([cx - ancho_c * .98, cy - alto_c * .15, cx + ancho_c * .98, cy + alto_c * 1.05], 20, 160, fill=pelo)
        d.arc([cx - ancho_c * .38, cy + alto_c * .32, cx + ancho_c * .38, cy + alto_c * .72], 20, 160, fill=piel, width=int(S * .012))
    gafas = rng.random() < .3
    if barba:
        rasgos.append("barba")
    if gafas:
        rasgos.append("gafas redondas")
    if gafas:  # gafas
        for lado_o in (-1, 1):
            x = cx + lado_o * ancho_c * .42
            d.ellipse([x - S * .06, ojos_y - S * .05, x + S * .06, ojos_y + S * .05], outline=_rgb(pal["tinta"]), width=int(S * .009))
        d.line([(cx - ancho_c * .1, ojos_y), (cx + ancho_c * .1, ojos_y)], fill=_rgb(pal["tinta"]), width=int(S * .008))
    return im.resize((lado, lado), Image.LANCZOS), ", ".join(rasgos)


def logotipo(semilla: int, nombre: str, region: str = "andina", familia: str = "tambor", lado: int = 512) -> tuple:
    """Logotipo sintético: forma + iniciales + motivo discreto (sin nombre: el motivo ocupa el centro). Devuelve (imagen, forma)."""
    rng = random.Random(semilla)
    pal = paleta(region, rng)
    S = lado * 2
    im, d = _lienzo(S, S, pal["fondo"])
    forma = rng.choice(["circulo", "cuadrado", "escudo", "hexagono"])
    c0 = _rgb(pal["primario"])
    c1 = _rgb(pal["secundario"] if rng.random() < .5 else pal["tinta"])
    cx = cy = S // 2
    R = int(S * .4)
    if forma == "circulo":
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=c0)
        d.ellipse([cx - R * .88, cy - R * .88, cx + R * .88, cy + R * .88], outline=_rgb(pal["fondo"]), width=int(S * .012))
    elif forma == "cuadrado":
        d.rounded_rectangle([cx - R, cy - R, cx + R, cy + R], radius=int(S * .1), fill=c0)
        d.rounded_rectangle([cx - R * .9, cy - R * .9, cx + R * .9, cy + R * .9], radius=int(S * .08), outline=_rgb(pal["fondo"]), width=int(S * .012))
    elif forma == "escudo":
        d.polygon([(cx - R, cy - R), (cx + R, cy - R), (cx + R, cy + R * .1), (cx, cy + R * 1.1), (cx - R, cy + R * .1)], fill=c0)
    else:
        d.polygon([(cx + R * math.cos(math.radians(a)), cy + R * math.sin(math.radians(a))) for a in range(30, 390, 60)], fill=c0)
    # banda inferior con motivo
    d.pieslice([cx - R * .95, cy - R * .95, cx + R * .95, cy + R * .95], 25, 155, fill=c1) if forma == "circulo" else d.rectangle([cx - R * .98, cy + R * .46, cx + R * .98, cy + R * .62], fill=c1)
    if not nombre:
        motivo(d, familia, cx, int(cy - R * .12), int(R * .42), _rgb(pal["acento"]), _rgb(pal["fondo"]), rng)
        for _ in range(rng.randint(4, 9)):  # puntos de variación: sin nombre, dos logos con la misma forma y paleta no deben ser idénticos
            a = rng.uniform(0, 6.283)
            x, y, t = cx + math.cos(a) * R * rng.uniform(.55, .8), cy + math.sin(a) * R * rng.uniform(.15, .55) + R * .1, rng.randint(int(S * .008), int(S * .022))
            d.ellipse([x - t, y - t, x + t, y + t], fill=_rgb(pal["fondo"]))
        return im.resize((lado, lado), Image.LANCZOS), forma
    motivo(d, familia, cx, int(cy + R * .52), int(R * .2), _rgb(pal["acento"]), _rgb(pal["fondo"]), rng)
    ini = iniciales(nombre, 2)
    f = fuente(int(S * (.30 if len(ini) == 2 else .38)), True)
    w = d.textlength(ini, font=f)
    d.text((cx - w / 2 + S * .006, cy - R * .52 + S * .008), ini, font=f, fill=tuple(int(c * .55) for c in c0))
    d.text((cx - w / 2, cy - R * .52), ini, font=f, fill=_rgb(pal["fondo"]))
    return im.resize((lado, lado), Image.LANCZOS), forma


def _paisaje(d, w: int, h: int, pal: dict, rng: random.Random, horizonte: float = .62) -> None:
    sol_x, sol_y, sol_r = rng.randint(int(w * .2), int(w * .8)), int(h * rng.uniform(.18, .38)), int(min(w, h) * rng.uniform(.09, .15))
    for k in (2.4, 1.8, 1.35):
        d.ellipse([sol_x - sol_r * k, sol_y - sol_r * k, sol_x + sol_r * k, sol_y + sol_r * k], fill=_mezcla(pal["fondo"], pal["acento"], .16 / k * 1.6))
    d.ellipse([sol_x - sol_r, sol_y - sol_r, sol_x + sol_r, sol_y + sol_r], fill=_rgb(pal["acento"]))
    for capa in range(3):
        base = h * (horizonte + capa * .1)
        fase, amp, frec = rng.uniform(0, 6.28), h * rng.uniform(.04, .1), rng.uniform(.8, 2.4)
        pts = [(0, h)] + [(x, base - amp * math.sin(fase + frec * x / w * 6.28)) for x in range(0, w + 24, 24)] + [(w, h)]
        d.polygon(pts, fill=_mezcla(pal["secundario"] if capa % 2 == 0 else pal["primario"], pal["tinta"], .12 + capa * .22))


def escena(semilla: int, region: str, familia: str, ancho: int = 1600, alto: int = 900) -> Image.Image:
    """Ilustración editorial sin texto: paisaje de la región con la silueta de un instrumento (noticias, eventos)."""
    rng = random.Random(semilla)
    pal = paleta(region, rng)
    im = _degradado(ancho, alto, pal["fondo"], "#%02x%02x%02x" % _mezcla(pal["fondo"], pal["acento"], .45))
    d = ImageDraw.Draw(im)
    _paisaje(d, ancho, alto, pal, rng)
    r = int(min(ancho, alto) * rng.uniform(.2, .27))
    motivo(d, familia, int(ancho * rng.uniform(.28, .72)), int(alto * .6), r, _rgb(pal["tinta"]), _rgb(pal["primario"]), rng)
    for _ in range(rng.randint(8, 16)):  # notas / confeti
        x, y, t = rng.randint(0, ancho), rng.randint(0, int(alto * .5)), rng.randint(6, 16)
        d.ellipse([x, y, x + t, y + t], fill=_rgb(rng.choice([pal["primario"], pal["secundario"], pal["acento"]])))
    return im


def portada(semilla: int, titulo: str, subtitulo: str, region: str, familia: str, ancho: int = 1600, alto: int = 900) -> Image.Image:
    """Portada con tipografía: título grande sobre paisaje y motivo (festivales, mercados, organizaciones)."""
    rng = random.Random(semilla)
    pal = paleta(region, rng)
    im = _degradado(ancho, alto, pal["primario"], "#%02x%02x%02x" % _mezcla(pal["primario"], pal["tinta"], .7))
    d = ImageDraw.Draw(im, "RGBA")
    for _ in range(7):  # círculos concéntricos tipo tambor/onda
        cx, cy = rng.randint(0, ancho), rng.randint(0, alto)
        for k in range(6):
            rr = 60 + k * 70
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=_rgb(pal["fondo"]) + (26,), width=4)
    d.rectangle([0, int(alto * .78), ancho, alto], fill=_rgb(pal["tinta"]) + (150,))
    motivo(d, familia, int(ancho * .82), int(alto * .42), int(alto * .27), _rgb(pal["acento"]) + (235,), _rgb(pal["fondo"]) + (235,), rng)
    if titulo:
        texto_centrado(d, titulo, (int(ancho * .06), int(alto * .16), int(ancho * .62), int(alto * .6)), _rgb(pal["fondo"]), int(alto * .17), 40, True, sombra=_rgb(pal["tinta"]))
    d.rectangle([int(ancho * .06), int(alto * .64), int(ancho * .06) + 160, int(alto * .64) + 10], fill=_rgb(pal["acento"]))
    if subtitulo:
        texto_centrado(d, subtitulo, (int(ancho * .06), int(alto * .8), int(ancho * .94), int(alto * .96)), _rgb(pal["fondo"]), int(alto * .06), 22, False)
    return im.convert("RGB")


def afiche(semilla: int, titulo: str, subtitulo: str, lineas: list, region: str, familia: str, ancho: int = 1000, alto: int = 1414) -> Image.Image:
    """Afiche vertical tipográfico: título, edición, lugar y fechas sobre fondo de formas."""
    rng = random.Random(semilla)
    pal = paleta(region, rng)
    im, d = _lienzo(ancho, alto, pal["fondo"])
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle([0, 0, ancho, int(alto * .56)], fill=_rgb(pal["primario"]))
    for k in range(9):
        r = 120 + k * 80
        d.ellipse([ancho * .72 - r, alto * .22 - r, ancho * .72 + r, alto * .22 + r], outline=_rgb(pal["fondo"]) + (34,), width=5)
    d.polygon([(0, int(alto * .56)), (ancho, int(alto * .5)), (ancho, int(alto * .6)), (0, int(alto * .66))], fill=_rgb(pal["secundario"]))
    motivo(d, familia, int(ancho * .5), int(alto * .27), int(ancho * .22), _rgb(pal["acento"]) + (240,), _rgb(pal["fondo"]) + (240,), rng)
    if titulo:
        texto_centrado(d, titulo, (int(ancho * .08), int(alto * .43), int(ancho * .92), int(alto * .6)), _rgb(pal["fondo"]), 100, 40, True, sombra=_rgb(pal["tinta"]))
    y = int(alto * .68)
    if subtitulo:
        y = texto_centrado(d, subtitulo, (int(ancho * .08), y, int(ancho * .92), y + int(alto * .1)), _rgb(pal["tinta"]), 80, 32, True, ancla_v="arriba") + 18
    for l in lineas:
        y = texto_centrado(d, l, (int(ancho * .08), y, int(ancho * .92), y + int(alto * .06)), _rgb(pal["tinta"]), 46, 24, False, ancla_v="arriba") + 8
    d.rectangle([0, int(alto * .94), ancho, alto], fill=_rgb(pal["tinta"]))
    for i in range(14):
        x = int(ancho * .08) + i * 36
        d.rounded_rectangle([x, int(alto * .965) - int(10 + 26 * abs(math.sin(i * .8 + rng.random()))), x + 16, int(alto * .965)], radius=5, fill=_rgb(pal["acento"]))
    return im.convert("RGB")


def foto_de_espacio(semilla: int, region: str, familia: str, ancho: int = 1200, alto: int = 800) -> Image.Image:
    """Ilustración de escenario (talleres, espacios, redes): telón, luces y silueta de instrumento."""
    rng = random.Random(semilla)
    pal = paleta(region, rng)
    im, d = _lienzo(ancho, alto, _mezcla(pal["tinta"], pal["primario"], .25))
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle([0, int(alto * .72), ancho, alto], fill=_rgb(pal["tinta"]))
    for i in range(rng.randint(3, 5)):  # haces de luz
        x = int(ancho * (.12 + .76 * i / 4))
        d.polygon([(x, 0), (x - 120, int(alto * .72)), (x + 120, int(alto * .72))], fill=_rgb(rng.choice([pal["acento"], pal["fondo"], pal["secundario"]])) + (46,))
    d.rectangle([int(ancho * .08), int(alto * .1), int(ancho * .12), int(alto * .72)], fill=_rgb(pal["primario"]))
    d.rectangle([int(ancho * .88), int(alto * .1), int(ancho * .92), int(alto * .72)], fill=_rgb(pal["primario"]))
    motivo(d, familia, ancho // 2, int(alto * .52), int(alto * .27), _rgb(pal["fondo"]), _rgb(pal["acento"]), rng)
    return im.convert("RGB")


def soporte(semilla: int, titulo: str, ancho: int = 1000, alto: int = 1294) -> Image.Image:
    """Hoja ilustrada de un documento de soporte (privado): encabezado, párrafos como barras y un sello."""
    rng = random.Random(semilla)
    pal = paleta("andina", rng)
    im, d = _lienzo(ancho, alto, "#ffffff")
    d.rectangle([0, 0, ancho, 150], fill=_rgb(pal["primario"]))
    texto_centrado(d, titulo, (60, 20, ancho - 60, 135), _rgb(pal["fondo"]), 56, 26, True)
    y = 210
    for _ in range(rng.randint(5, 7)):
        for _ in range(rng.randint(3, 5)):
            d.rounded_rectangle([70, y, ancho - 70 - rng.randint(0, 260), y + 16], radius=8, fill=(206, 212, 218))
            y += 40
        y += 36
    d.ellipse([ancho - 330, alto - 330, ancho - 90, alto - 90], outline=_rgb(pal["secundario"]), width=9)
    d.ellipse([ancho - 300, alto - 300, ancho - 120, alto - 120], outline=_rgb(pal["secundario"]), width=3)
    return im


# --------------------------------------------------------------------------------------------------------------------
# Codificación
# --------------------------------------------------------------------------------------------------------------------
def a_png(im: Image.Image, colores: int = 96) -> bytes:
    q = im.convert("RGB").quantize(colors=colores, method=Image.MEDIANCUT, dither=Image.NONE)
    b = io.BytesIO()
    q.save(b, "PNG", optimize=True)
    return b.getvalue()


def a_webp(im: Image.Image, objetivo: int = 190 * 1024) -> bytes:
    for q in (88, 82, 76, 70, 62, 55, 48):
        b = io.BytesIO()
        im.convert("RGB").save(b, "WEBP", quality=q, method=6)
        if b.tell() <= objetivo:
            break
    return b.getvalue()


def a_jpeg(im: Image.Image, objetivo: int = 190 * 1024) -> bytes:
    im = im.convert("RGB")
    while True:
        for q in (86, 80, 74, 68, 62, 56, 50, 44):
            b = io.BytesIO()
            im.save(b, "JPEG", quality=q, optimize=True, progressive=True)
            if b.tell() <= objetivo:
                return b.getvalue()
        im = im.resize((int(im.size[0] * .92), int(im.size[1] * .92)), Image.LANCZOS)


def a_pdf(paginas: list) -> bytes:
    b = io.BytesIO()
    paginas[0].convert("RGB").save(b, "PDF", save_all=True, append_images=[p.convert("RGB") for p in paginas[1:]], resolution=100.0)
    return b.getvalue()


def miniatura(im: Image.Image, lado: int = 320) -> bytes:
    t = im.convert("RGB").copy()
    t.thumbnail((lado, lado), Image.LANCZOS)
    b = io.BytesIO()
    t.save(b, "WEBP", quality=72, method=6)
    return b.getvalue()
