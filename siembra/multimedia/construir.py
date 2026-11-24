#!/usr/bin/env python3
"""Construye y comprueba el pool de assets de la siembra. Ver `siembra/multimedia/README.md`.

    python3 siembra/multimedia/construir.py base                  # fotos reales + piezas de Celebra + pool genérico (idempotente) y reescribe el manifiesto
    python3 siembra/multimedia/construir.py pedir ALIAS [...]     # asegura (genera si falta) uno o varios alias; --nombre/--region/--practica/--departamento
    python3 siembra/multimedia/construir.py desde-libros          # busca alias `img.*` en siembra/libro/ y los asegura
    python3 siembra/multimedia/construir.py completar             # construye el plan de la siembra y crea lo que los constructores pidan y falte
    python3 siembra/multimedia/construir.py verificar [--plan]    # alt, checksums, límites, alias referenciados; con --plan construye el plan y comprueba lo que pide
    python3 siembra/multimedia/construir.py resumen               # conteos, peso total y tiempo de carga estimado

Pool: --pool DIR, `$SIMUS_SIEMBRA_ASSETS` o `tmp/siembra/assets/` (fuera de git).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import comun as C  # noqa: E402
import pool as P  # noqa: E402

# Conexión supuesta para estimar la carga (Mbit/s); la demo se ve desde navegadores de oficina y de casa.
CONEXIONES = (("móvil 4G (10 Mbit/s)", 10), ("banda ancha (50 Mbit/s)", 50))


def verificar(pool: P.Pool, aliases_pedidos=()) -> tuple:
    errores, avisos = [], []
    vistos_checksum: dict = {}
    for alias, a in sorted(pool.assets.items()):
        if not C.RE_ALIAS.match(alias):
            errores.append(f"{alias}: alias mal formado")
        if a.equivale_a:
            if a.equivale_a not in pool.assets or pool.assets[a.equivale_a].equivale_a:
                errores.append(f"{alias}: equivale_a «{a.equivale_a}» no existe o encadena otro alias")
            continue
        if not a.alt.strip() or len(a.alt) > 300:
            errores.append(f"{alias}: texto alternativo obligatorio (1 a 300 caracteres)")
        elif len(a.alt) < 25:
            avisos.append(f"{alias}: texto alternativo muy corto")
        if len(a.pie) > 500:
            errores.append(f"{alias}: pie de más de 500 caracteres")
        if len(a.credito) > 200:
            errores.append(f"{alias}: crédito de más de 200 caracteres")
        if not a.fuente:
            errores.append(f"{alias}: sin fuente (URL o «generado»)")
        if a.procedencia not in ("publico", "sintetico", "hibrido"):
            errores.append(f"{alias}: procedencia no válida")
        if a.mime not in C.MIMES:
            errores.append(f"{alias}: tipo MIME no admitido por el banco ({a.mime})")
        limite = C.MAX_PDF if a.mime == "application/pdf" else C.MAX_IMAGEN
        if a.bytes > limite:
            errores.append(f"{alias}: {a.bytes} bytes superan el tope del banco ({limite})")
        elif a.mime != "application/pdf" and a.bytes > C.OBJETIVO_WEB and a.origen != "celebra-oficial":
            avisos.append(f"{alias}: {a.bytes // 1024} KB superan el objetivo web de 200 KB")
        if max(a.ancho, a.alto) > C.LADO_MAXIMO and a.mime != "application/pdf":
            errores.append(f"{alias}: {a.ancho}x{a.alto} supera los {C.LADO_MAXIMO} px")
        ruta = C.ruta_del_asset(a, pool.dir)
        if not ruta.exists():
            errores.append(f"{alias}: falta el binario {a.archivo}")
        else:
            datos = ruta.read_bytes()
            if C.sha256(datos) != a.checksum:
                errores.append(f"{alias}: el checksum no coincide con el archivo")
            if len(datos) != a.bytes:
                errores.append(f"{alias}: bytes del manifiesto != bytes del archivo")
        if a.checksum in vistos_checksum:
            errores.append(f"{alias}: contenido idéntico a {vistos_checksum[a.checksum]} (la ruta del banco es única por huella)")
        vistos_checksum[a.checksum] = alias
    import re
    vistos_url = set()
    if C.VIDEOS.exists():
        import csv
        with C.VIDEOS.open(encoding="utf-8", newline="") as fv:
            filas_video = list(csv.DictReader(fv))
        for fila in filas_video:
            if not C.RE_VIDEO.match(fila["alias"]) or not re.match(r"^https://www\.youtube\.com/watch\?v=[\w-]{11}$", fila["url"]) or not fila["titulo"] or fila["url"] in vistos_url:
                errores.append(f"videos.csv: fila no válida o repetida {fila['alias']}")
            vistos_url.add(fila["url"])
    for alias in aliases_pedidos:
        if alias not in pool.assets:
            errores.append(f"alias referenciado que no existe en el manifiesto: {alias}")
    return errores, avisos


def resumen(pool: P.Pool, solo=None) -> dict:
    propios = [a for a in pool.assets.values() if not a.equivale_a and (solo is None or a.alias in solo)]
    por_origen: dict = {}
    for a in propios:
        d = por_origen.setdefault(a.origen, [0, 0])
        d[0] += 1
        d[1] += a.bytes
    total = sum(a.bytes for a in propios)
    return {"assets": len(propios), "alias": len(pool.assets), "bytes": total, "por_origen": por_origen,
            "segundos": {n: round(total * 8 / (mbit * 1e6), 1) for n, mbit in CONEXIONES}}


def imprimir_resumen(r: dict, titulo: str) -> None:
    print(f"[multimedia] {titulo}: {r['assets']} binarios ({r['alias']} alias), {r['bytes'] / 1048576:.1f} MiB")
    for o, (n, b) in sorted(r["por_origen"].items()):
        print(f"   {o:16s} {n:5d} archivos  {b / 1048576:7.1f} MiB  (media {b // max(n, 1) // 1024} KB)")
    for n, s in r["segundos"].items():
        print(f"   descarga completa estimada, {n}: {s} s (las fichas piden pocas imágenes a la vez; esto es el peor caso de bajarlo todo)")


def aliases_en_libros() -> set:
    encontrados = set()
    for ruta in (C.RAIZ / "siembra" / "libro").rglob("*"):
        if ruta.suffix in (".py", ".json", ".csv", ".md") and ruta.is_file():
            encontrados |= set(C.RE_ALIAS_EN_TEXTO.findall(ruta.read_text(encoding="utf-8", errors="ignore")))
    # el libro de contenido cita `img.noticia.<clave>` / `img.evento.<clave>` sin rol: el manifiesto los guarda como `….imagen`
    return {a + ".imagen" if a.count(".") == 2 else a for a in encontrados}


def _plan(pool: P.Pool, autogenerar: bool):
    """Construye el plan de la siembra usando ESTE pool (con o sin creación al vuelo)."""
    import datetime as dt
    import json
    sys.path.insert(0, str(C.RAIZ / "siembra" / "generador"))
    import siembra  # noqa: E402
    import datos_publicos as dp  # noqa: E402
    import banco  # noqa: E402
    pool.autogenerar = autogenerar
    original = banco.Banco.__init__

    def con_este_pool(self, plan, p=None):
        original(self, plan, pool)
    banco.Banco.__init__ = con_este_pool
    try:
        catalogos = json.loads((C.RAIZ / "siembra" / "generador" / "catalogos-instantanea.json").read_text(encoding="utf-8"))
        return siembra.construir_plan(20261121, dt.date(2026, 11, 21), dp.cargar(dp.carpeta_de_datos(None)), catalogos, 6, True, 1.0)
    finally:
        banco.Banco.__init__ = original


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("accion", choices=["base", "pedir", "desde-libros", "completar", "verificar", "resumen", "reparar"])
    ap.add_argument("aliases", nargs="*")
    ap.add_argument("--pool")
    ap.add_argument("--plan", action="store_true", help="verificar: construye el plan y comprueba los alias que pide")
    ap.add_argument("--nombre"); ap.add_argument("--region"); ap.add_argument("--practica"); ap.add_argument("--departamento")
    a = ap.parse_args(argv)
    pool = P.Pool(a.pool)
    if a.accion == "base":
        print(f"[multimedia] pool en {pool.dir}")
        n1, n2, n4, n3 = pool.importar_fotos(), pool.importar_celebra(), pool.importar_aliados(), pool.construir_pool_generico()
        n5 = pool.importar_fotos_libres()
        pool.guardar_manifiesto()
        print(f"[multimedia] nuevos: {n1} fotos, {n2} piezas de Celebra, {n4} logos de aliados, {n3} piezas genéricas, {n5} fotos libres de agentes")
        imprimir_resumen(resumen(pool), "pool completo")
        return 0
    if a.accion in ("pedir", "desde-libros"):
        alias = a.aliases if a.accion == "pedir" else sorted(aliases_en_libros())
        meta = {k: v for k, v in dict(nombre=a.nombre, region=a.region, practica=a.practica, departamento=a.departamento).items() if v}
        for x in alias:
            pool.resolver(x, **meta)
        pool.guardar_manifiesto()
        print(f"[multimedia] {len(alias)} alias asegurados ({len(pool.nuevos)} creados ahora)")
        return 0
    if a.accion == "reparar":   # regenera (de forma determinista, con el meta del manifiesto) los binarios generados que falten en este pool
        n = pool.reparar()
        pool.guardar_manifiesto()
        print(f"[multimedia] {n} binarios regenerados")
        return 0
    if a.accion == "resumen":
        imprimir_resumen(resumen(pool), "manifiesto")
        return 0
    if a.accion == "completar":
        plan = _plan(pool, autogenerar=True)
        creados = plan.imagenes.cerrar()
        print(f"[multimedia] el plan pide {len(plan.multimedia_pedidos)} alias; {len(creados)} creados ahora")
        return 0
    pedidos = set(aliases_en_libros())
    solo = None
    if a.plan:
        plan = _plan(pool, autogenerar=False)
        pedidos |= set(getattr(plan, "multimedia_pedidos", ()))
        solo = {f.alias for f in plan.filas if f.tabla == "Archivos"}
    errores, avisos = verificar(pool, pedidos)
    for m in avisos:
        print(f"[aviso] {m}")
    for m in errores:
        print(f"[ERROR] {m}", file=sys.stderr)
    imprimir_resumen(resumen(pool, solo), "siembra del plan" if solo is not None else "manifiesto")
    print(f"[multimedia] verificación: {len(errores)} errores, {len(avisos)} avisos")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
