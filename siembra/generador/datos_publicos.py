"""Lectura de los datos públicos verificables (festivales, mercados, organizaciones) y utilidades para llevarlos al modelo.

Los datos reales se buscan en `--datos DIR`, o en `$SIMUS_SIEMBRA_DATOS`, o en la muestra versionada `siembra/muestra/`.
Los archivos completos (`festivales.json`, …) viven fuera de git, en los entregables del proyecto.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
MESES = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6, "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12}

# Etiquetas libres de los datos públicos → categorías del catálogo de prácticas de SIMUS (16 grandes familias).
PRACTICA_POR_PALABRA = [
    ("llanera", "musicas-populares-tradicionales-regionales-y-patrimoniales"), ("joropo", "musicas-populares-tradicionales-regionales-y-patrimoniales"),
    ("vallenat", "musicas-populares-tradicionales-regionales-y-patrimoniales"), ("acordeón", "musicas-populares-tradicionales-regionales-y-patrimoniales"),
    ("andina", "musicas-populares-tradicionales-regionales-y-patrimoniales"), ("bambuco", "musicas-populares-tradicionales-regionales-y-patrimoniales"),
    ("tradicional", "musicas-populares-tradicionales-regionales-y-patrimoniales"), ("folcl", "musicas-populares-tradicionales-regionales-y-patrimoniales"),
    ("gaita", "musicas-populares-tradicionales-regionales-y-patrimoniales"), ("pacífico", "musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras"),
    ("currulao", "musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras"), ("marimba", "musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras"),
    ("bullerengue", "musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras"), ("rock", "musicas-urbanas-alternativas-e-independientes"),
    ("hip hop", "musicas-urbanas-alternativas-e-independientes"), ("rap", "musicas-urbanas-alternativas-e-independientes"), ("indie", "musicas-urbanas-alternativas-e-independientes"),
    ("electrón", "musicas-electronicas-digitales-produccion-sonora-y-nuevas-tecnologias"), ("salsa", "musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales"),
    ("jazz", "musicas-academicas-de-camara-contemporaneas-experimentales-y-de-vanguardia"), ("clásica", "musicas-academicas-de-camara-contemporaneas-experimentales-y-de-vanguardia"),
    ("cámara", "musicas-academicas-de-camara-contemporaneas-experimentales-y-de-vanguardia"), ("sinfónica", "musicas-sinfonicas-bandas-orquestas-y-grandes-formatos-instrumentales"),
    ("sacra", "musicas-religiosas-rituales-espirituales-y-devocionales"), ("religiosa", "musicas-religiosas-rituales-espirituales-y-devocionales"),
    ("coral", "musicas-vocales-corales-y-de-tradicion-cantada"), ("indígena", "expresiones-sonoras-de-pueblos-originarios"),
]


def plano(texto: str) -> str:
    """Minúsculas sin tildes ni puntuación: para comparar nombres de lugares."""
    t = unicodedata.normalize("NFKD", texto or "")
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", t)).strip()


def carpeta_de_datos(arg: str | None) -> Path:
    for candidato in (arg, os.environ.get("SIMUS_SIEMBRA_DATOS"), str(RAIZ / "siembra" / "muestra")):
        if candidato and Path(candidato).is_dir():
            return Path(candidato)
    raise FileNotFoundError("No hay carpeta de datos públicos (usa --datos o SIMUS_SIEMBRA_DATOS).")


def cargar(carpeta: Path) -> dict:
    def leer(nombre):
        ruta = carpeta / nombre
        return json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else []
    datos = {"festivales": leer("festivales.json"), "mercados": leer("mercados.json"), "organizaciones": leer("organizaciones.json")}
    for clave in ("festivales", "mercados"):
        for item in datos[clave]:
            normalizar_anios(item)
    return datos


def normalizar_anios(item: dict) -> None:
    """Las ediciones históricas traen `anio` entero; si llega como texto numérico («2019») se convierte; un rango («2020-2021»)
    o un texto no numérico no es un año de edición: se conserva tal cual y el constructor lo omite (nunca se ordena int contra str)."""
    for e in item.get("ediciones_historicas") or []:
        a = e.get("anio")
        if isinstance(a, str) and a.strip().isdigit():
            e["anio"] = int(a.strip())


class Territorio:
    """Resuelve nombres de departamento y municipio de los datos públicos a códigos DIVIPOLA del catálogo."""

    def __init__(self, divipola: list):
        self.muni = {}
        self.dep = {}
        for fila in divipola:
            self.dep[plano(fila["nd"])] = fila["d"]
            self.muni.setdefault((fila["d"], plano(fila["nm"])), fila["m"])
        self.dep.update({"bogota d c": "11", "bogota": "11", "san andres providencia y santa catalina": "88", "san andres y providencia": "88"})
        self.codigos_muni = {f["m"] for f in divipola}
        self.codigos_dep = {f["d"] for f in divipola}

    def departamento(self, nombre: str):
        return self.dep.get(plano(nombre))

    def municipio(self, nombre: str, departamento: str):
        d = self.departamento(departamento)
        n = plano(re.sub(r"\(.*?\)", "", nombre))
        if d is None:
            return None, None
        if d == "11":
            return d, "11001"
        if (d, n) in self.muni:
            return d, self.muni[(d, n)]
        # «Cali» contra «SANTIAGO DE CALI», «Tumaco» contra «SAN ANDRÉS DE TUMACO»: solo si el nombre es una palabra completa y es el único candidato.
        candidatos = {cod for (dd, nn), cod in self.muni.items() if dd == d and f" {n} " in f" {nn} "}
        if len(candidatos) == 1:
            return d, candidatos.pop()
        return d, None


def practicas_de(etiquetas: str) -> list:
    """Categorías de práctica del catálogo para una lista «a;b;c» de etiquetas libres (sin repetir, orden estable)."""
    out = []
    for et in re.split(r"[;,]", etiquetas or ""):
        e = et.strip().lower()
        for palabra, slug in PRACTICA_POR_PALABRA:
            if palabra in e and slug not in out:
                out.append(slug)
                break
    return out


def parse_fecha(anio: int, texto: str):
    """«26-29 may» → (2026-05-26, 2026-05-29); «30 oct-1 nov»; «9 ago»; «3, 4, 5 y 10 nov». Devuelve (inicio, fin) o (None, None)."""
    t = (texto or "").lower().replace("–", "-").strip()
    if not t:
        return None, None
    m = re.fullmatch(r"(\d{1,2})\s*([a-z]{3})\s*-\s*(\d{1,2})\s*([a-z]{3})", t)
    if m and m[2] in MESES and m[4] in MESES:
        return dt.date(anio, MESES[m[2]], int(m[1])), dt.date(anio, MESES[m[4]], int(m[3]))
    m = re.fullmatch(r"(\d{1,2})\s*-\s*(\d{1,2})\s*([a-z]{3})", t)
    if m and m[3] in MESES:
        return dt.date(anio, MESES[m[3]], int(m[1])), dt.date(anio, MESES[m[3]], int(m[2]))
    m = re.fullmatch(r"(\d{1,2})\s*([a-z]{3})", t)
    if m and m[2] in MESES:
        d = dt.date(anio, MESES[m[2]], int(m[1]))
        return d, d
    m = re.fullmatch(r"((?:\d{1,2}\s*(?:,|y)\s*)+\d{1,2})\s*([a-z]{3})", t)
    if m and m[2] in MESES:
        dias = [int(x) for x in re.findall(r"\d{1,2}", m[1])]
        return dt.date(anio, MESES[m[2]], min(dias)), dt.date(anio, MESES[m[2]], max(dias))
    return None, None
