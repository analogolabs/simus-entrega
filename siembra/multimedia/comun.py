"""Piezas comunes del sistema de multimedia de la siembra: rutas, manifiesto, alias y regiones.

El POOL de binarios vive FUERA de git (por omisión `tmp/siembra/assets/`, o `$SIMUS_SIEMBRA_ASSETS`).
Lo que sí se versiona es el MANIFIESTO (`manifiesto.csv`): una fila por alias con su archivo, tipo, medidas, texto alternativo, pie, crédito,
fuente, procedencia y checksum SHA-256. El generador de la siembra solo lee el manifiesto y los binarios del pool.
"""
from __future__ import annotations

import csv
import hashlib
import os
import re
from dataclasses import dataclass, asdict, fields
from pathlib import Path
from typing import Optional

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
MANIFIESTO = AQUI / "manifiesto.csv"
VIDEOS = AQUI / "videos.csv"
POOL_POR_OMISION = RAIZ / "tmp" / "siembra" / "assets"

# Límites del banco de archivos (CK_Archivos_PesoPorTipo, MediosWebContrato): 2 MiB por imagen, 20 MiB por PDF.
MAX_IMAGEN = 2 * 1024 * 1024
MAX_PDF = 20 * 1024 * 1024
# Objetivos de la siembra (más estrictos que el banco, para que la demo cargue rápido).
OBJETIVO_WEB = 200 * 1024
LADO_MAXIMO = 1600
MIMES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "application/pdf": ".pdf"}
RE_ALIAS = re.compile(r"^img\.[a-z0-9]+(?:\.[a-z0-9][a-z0-9-]*){2,}$")
RE_ALIAS_EN_TEXTO = re.compile(r"""["'](img\.[a-z0-9]+(?:\.[a-z0-9][a-z0-9-]*)+)["']""")
RE_VIDEO = re.compile(r"^vid\.[a-z0-9]+(?:\.[a-z0-9][a-z0-9-]*)+$")

COLUMNAS = ["alias", "archivo", "mime", "ancho", "alto", "bytes", "alt", "pie", "credito", "fuente", "procedencia", "origen", "uso",
            "checksum", "miniatura", "equivale_a", "meta"]


def pool_dir(explicito: Optional[str] = None) -> Path:
    return Path(explicito or os.environ.get("SIMUS_SIEMBRA_ASSETS") or POOL_POR_OMISION).expanduser()


IMAGENES_LIBRES = RAIZ / "siembra" / "imagenes"   # fotos de licencia libre (CC0/dominio público) SÍ versionadas: ver LICENCIAS.md
ORIGEN_FOTO_LIBRE = "foto-libre"


def ruta_del_asset(a: "Asset", directorio_pool: Path) -> Path:
    """Dónde está el binario: las fotos libres viven en el repositorio (`archivo` relativo a `siembra/imagenes/`); el resto, en el pool externo."""
    return (IMAGENES_LIBRES / a.archivo) if a.origen == ORIGEN_FOTO_LIBRE else (directorio_pool / a.archivo)


def sha256(datos: bytes) -> str:
    return hashlib.sha256(datos).hexdigest()


def semilla_de(alias: str, base: int = 20261121) -> int:
    return int(hashlib.sha256(f"{base}:{alias}".encode()).hexdigest()[:12], 16)


@dataclass
class Asset:
    alias: str
    archivo: str = ""          # ruta relativa al pool
    mime: str = ""
    ancho: int = 0
    alto: int = 0
    bytes: int = 0
    alt: str = ""
    pie: str = ""
    credito: str = ""
    fuente: str = ""           # URL o «generado»
    procedencia: str = "sintetico"   # sintetico | publico | hibrido (la de la siembra: DatosDeDemostracion)
    origen: str = "generado"   # generado | foto-proyecto | celebra-oficial | foto-libre (fotos de licencia libre versionadas en siembra/imagenes/)
    uso: str = "publico"       # publico | privado (intención de uso; la visibilidad real la decide el vínculo)
    checksum: str = ""
    miniatura: str = ""
    equivale_a: str = ""       # si no está vacío, este alias reutiliza la fila de archivo de otro alias
    meta: str = ""             # JSON con lo usado para generarlo (nombre, región, práctica…)


def leer_manifiesto(ruta: Path = MANIFIESTO) -> dict:
    if not ruta.exists():
        return {}
    with ruta.open(encoding="utf-8", newline="") as f:
        out = {}
        for fila in csv.DictReader(f):
            a = Asset(**{k: fila.get(k, "") for k in COLUMNAS})
            a.ancho, a.alto, a.bytes = int(a.ancho or 0), int(a.alto or 0), int(a.bytes or 0)
            out[a.alias] = a
        return out


def escribir_manifiesto(assets: dict, ruta: Path = MANIFIESTO) -> None:
    with ruta.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS, lineterminator="\n")
        w.writeheader()
        for alias in sorted(assets):
            w.writerow({k: getattr(assets[alias], k) for k in COLUMNAS})


# Región cultural por departamento (DIVIPOLA): decide la paleta de las piezas generadas.
REGION_DE_DEPARTAMENTO = {
    "05": "andina", "08": "caribe", "11": "andina", "13": "caribe", "15": "andina", "17": "andina", "18": "amazonia", "19": "pacifico",
    "20": "caribe", "23": "caribe", "25": "andina", "27": "pacifico", "41": "andina", "44": "caribe", "47": "caribe", "50": "orinoquia",
    "52": "pacifico", "54": "andina", "63": "andina", "66": "andina", "68": "andina", "70": "caribe", "73": "andina", "76": "pacifico",
    "81": "orinoquia", "85": "orinoquia", "86": "amazonia", "88": "insular", "91": "amazonia", "94": "amazonia", "95": "amazonia",
    "97": "amazonia", "99": "orinoquia",
}
REGIONES = ("caribe", "pacifico", "andina", "orinoquia", "amazonia", "insular")


def region_de(codigo: str) -> str:
    """Región de un código de departamento (2 dígitos) o de municipio (5 dígitos)."""
    return REGION_DE_DEPARTAMENTO.get(str(codigo)[:2], "andina")


def familia_de_practica(slug: str) -> str:
    """Familia visual (motivo y ritmo del diseño) a partir de un slug del catálogo real de prácticas."""
    s = slug or ""
    for clave, fam in (("afro", "marimba"), ("pueblos-originarios", "flauta"), ("campesinas", "cuerdas"), ("populares-tradicionales", "cuerdas"),
                       ("sinfonicas", "arcos"), ("academicas", "arcos"), ("electronicas", "disco"), ("sonoras", "ondas"), ("urbanas", "disco"),
                       ("bandas-de-marcha", "tambor"), ("religiosas", "ondas"), ("vocales", "ondas"), ("tropicales", "tambor"),
                       ("comunitarias", "tambor"), ("frontera", "flauta"), ("escena", "arcos")):
        if clave in s:
            return fam
    return "tambor"
