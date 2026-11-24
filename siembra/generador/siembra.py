#!/usr/bin/env python3
"""Generador determinista de la siembra de demostración.

    python3 siembra/generador/siembra.py --solo-plan            # valida y escribe el plan SQL por lotes; NO toca ninguna base
    python3 siembra/generador/siembra.py --aplicar              # lo anterior + ejecuta cada lote (exige SIMUS_SIEMBRA_CONFIRMAR, ver scripts/demo/siembra-integral.sh)

Opciones: --semilla N (20261121) · --hoy AAAA-MM-DD (2026-11-21: la «fecha de referencia» de todos los estados y fechas) ·
--datos DIR (datos públicos; por omisión $SIMUS_SIEMBRA_DATOS o la muestra versionada) · --salida DIR (plan SQL; por omisión
`siembra/plan-generado/`, ignorado por git) · --max-ediciones N (6) · --sin-cuentas · --masivo ESCALA (1.0: motor masivo de N2/N3 completo; 0: sin él).

Mismo semilla + mismos datos + misma fecha de referencia = mismo plan, byte a byte. Aplicarlo dos veces no duplica nada (idempotente por alias).
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib
import json
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(RAIZ / "siembra" / "libro"))
sys.path.insert(0, str(RAIZ / "siembra" / "multimedia"))

import datos_publicos as dp  # noqa: E402
import contenido_siembra  # noqa: E402
import cuentas_validacion  # noqa: E402
import libro_muestra  # noqa: E402
import banco as multimedia  # noqa: E402  (assets: siembra/multimedia/)
import festivales as libro_festivales  # noqa: E402  (siembra/libro/festivales)
import galeria as libro_galeria  # noqa: E402  (siembra/libro/galeria)
import constructor_festivales  # noqa: E402
import celebra_ediciones  # noqa: E402
import n1_personas  # noqa: E402
import reconciliar_libros  # noqa: E402
import multimedia_integral  # noqa: E402
import agenda_de_citas  # noqa: E402
from constructores import Constructor  # noqa: E402
from nucleo import Plan, escribir_plan  # noqa: E402
from validaciones import validar  # noqa: E402


def construir_plan(semilla: int, hoy: dt.date, datos: dict, catalogos: dict, max_ediciones: int = 6, con_cuentas: bool = True, masivo: float = 0.0) -> Plan:
    reconciliar_libros.aplicar()   # casa los alias de personas y festivales (cada tema definió los suyos)
    plan = Plan(semilla=semilla, hoy=hoy)
    plan.avisos = []
    multimedia.instalar(plan)   # los constructores piden imágenes con plan.imagenes.ref("img.…")
    territorio = dp.Territorio(catalogos["divipola"])
    c = Constructor(plan, datos, territorio, libro_muestra, n1={"encuentro-de-chirimia-del-san-juan", "ismael-cuesta", "corp-raiz-y-tambor", "rueda-de-negocios-caribe-sonoro"})
    if con_cuentas:
        gestor = cuentas_validacion.administrativas(plan, c)
        c.gestor = gestor
    c.avisos = plan.avisos
    c.fechas_fijas = getattr(importlib.import_module("contenido"), "FECHAS_DE_EDICION", {})   # fechas de ediciones que las noticias dan por ciertas
    c.personas()
    c.organizaciones()
    if con_cuentas:
        cuentas_validacion.externas_base(plan, c)
    n1_personas.sembrar(plan, c)   # libro N1 de personas y organizaciones (tema `personas`); antes de los festivales para que puedan citarlas
    # El tercer festival histórico real ya fue reclamado por la organización de la cuenta «reclamante» (escenario «ya reclamado»).
    c.festivales_publicos(max_ediciones=max_ediciones, reclamado={2: "reclamante-org"} if con_cuentas else None, reales=libro_festivales.REALES_FESTIVALES)
    c.festivales_sinteticos()
    constructor_festivales.sembrar(c, libro_festivales)   # libro de festivales y mercados de nivel 1 (siembra/libro/festivales)
    multimedia_integral.adjuntar_festivales(c, libro_festivales)
    if con_cuentas:
        cuentas_validacion.externas_procesos(plan, c)
    c.mercados(reales=libro_festivales.REALES_MERCADOS)
    c.redes_talleres_espacios()
    multimedia_integral.instalar_resolvedor(c)
    contenido_siembra.sembrar(c)   # campañas, noticias, agenda y marcas editoriales del libro `contenido` (sustituye a c.eventos()/c.noticias() de la muestra)
    celebra_ediciones.sembrar(plan)   # ediciones publicadas 2025 y 2026 del micrositio Celebra la música (siembra/libro/celebra); sus eventos y noticias ya los dio `contenido`
    c.invitaciones_y_notificaciones()
    c.reclamaciones()
    multimedia_integral.adjuntar_organizaciones_y_perfiles(c)
    if masivo:  # motor masivo de N2/N3 (siembra/libro/masivo): se emite al final, por tipo y nivel, para que sus referencias se resuelvan en orden de lotes
        import masivo as motor_masivo  # noqa: PLC0415
        motor_masivo.agregar(plan, c, masivo)
        multimedia_integral.adjuntar_masivo(c)
    libro_galeria.sembrar(plan)   # álbumes de fotos, de videos y mixtos de la Galería pública (lote n1-galeria; solo pide imágenes del pool)
    if con_cuentas:
        agenda_de_citas.sembrar(plan, c)   # agendas de citas de mercados (dos abiertas, borrador y cerrada) sobre el Mercado de la organización de las cuentas de validación
    plan.avisos += [f"multimedia: asset creado al vuelo y anotado en el manifiesto: {a}" for a in plan.imagenes.cerrar()]
    for f in plan.filas:  # el lote lleva el nivel: n1-festivales, n2-festivales, n3-…; las cuentas (nivel 0) conservan su lote
        if f.lote.startswith("n") and f.lote[1:2].isdigit():
            f.lote = f"n{f.nivel}-{f.lote.split('-', 1)[1]}"
    # El SQL se emite lote por lote: el orden del plan es el de los lotes (estable), y las referencias deben resolverse en ESE orden.
    multimedia.ordenar(plan)  # lotes en orden de aparición, con el de archivos (n3-multimedia) primero: no depende de nada
    return plan


def construir_plan_de_galeria(semilla: int, hoy: dt.date) -> Plan:
    """Plan MÍNIMO con solo la Galería (y los `Archivos` que sus fotos piden): para aplicarla a una demo ya sembrada (scripts/demo/sembrar-galeria.sh).
    Es idempotente por alias: lo que ya esté en `DatosDeDemostracion` no se vuelve a insertar."""
    plan = Plan(semilla=semilla, hoy=hoy)
    plan.avisos = []
    multimedia.instalar(plan)
    libro_galeria.sembrar(plan)
    pedidos = libro_galeria.archivos_pedidos(plan)
    plan.filas = [f for f in plan.filas if f.lote == libro_galeria.LOTE or (f.tabla == "Archivos" and f.alias in pedidos)]
    plan.avisos += [f"multimedia: asset creado al vuelo y anotado en el manifiesto: {a}" for a in plan.imagenes.cerrar()]
    multimedia.ordenar(plan)
    return plan


def fotos_de_agentes_de_la_siembra(semilla: int, hoy: dt.date, datos: dict, catalogos: dict, max_ediciones: int = 6, con_cuentas: bool = True, masivo: float = 1.0) -> dict:
    """Perfil → foto libre (`img.pool.agente.NNN`) que la siembra completa asigna a cada ficha del directorio de agentes. No escribe nada."""
    return dict(getattr(construir_plan(semilla, hoy, datos, catalogos, max_ediciones, con_cuentas, masivo), "fotos_de_agentes", {}))


def construir_plan_de_fotos_de_agentes(semilla: int, hoy: dt.date) -> Plan:
    """Plan MÍNIMO con solo las fotos libres de agentes (las filas `Archivos` de `img.pool.agente.NNN`): para aplicarlas a una demo ya sembrada
    (scripts/demo/sembrar-fotos-agentes.sh). Es idempotente por alias; el vínculo con cada ficha lo pone `sql_ajustes_fotos_agentes`."""
    from pool import total_de_fotos_de_agentes  # noqa: PLC0415
    plan = Plan(semilla=semilla, hoy=hoy)
    plan.avisos = []
    multimedia.instalar(plan)
    for n in range(1, total_de_fotos_de_agentes() + 1):
        plan.imagenes.ref(f"img.pool.agente.{n:03d}")
    plan.avisos += [f"multimedia: asset creado al vuelo y anotado en el manifiesto: {a}" for a in plan.imagenes.cerrar()]
    multimedia.ordenar(plan)
    return plan


def sql_ajustes_fotos_agentes(mapa: dict, trozo: int = 400) -> str:
    """UPDATE idempotentes que ponen a cada ficha del directorio de agentes (PerfilesPublicos) su foto libre en una demo YA sembrada con retratos ilustrados.
    Solo toca perfiles que el kit registró en `DatosDeDemostracion` y cuya foto libre ya está cargada; las ilustraciones antiguas quedan sin vínculo (no se sirven)."""
    def q(t: str) -> str:
        return "N'" + t.replace("'", "''") + "'"
    partes = ["SET NOCOUNT ON;"]
    pares = sorted(mapa.items())
    for i in range(0, len(pares), trozo):
        valores = ", ".join(f"({q(perfil)}, {q(foto)})" for perfil, foto in pares[i:i + trozo])
        partes.append(
            "UPDATE p SET p.ArchivoFotoId = CAST(df.IdRegistro AS bigint)\n"
            "FROM dbo.PerfilesPublicos p\n"
            "JOIN dbo.DatosDeDemostracion dp ON dp.Tabla = N'PerfilesPublicos' AND dp.IdRegistro = CAST(p.IdUsuario AS nvarchar(120))\n"
            f"JOIN (VALUES {valores}) v(Perfil, Foto) ON v.Perfil = dp.Alias\n"
            "JOIN dbo.DatosDeDemostracion df ON df.Tabla = N'Archivos' AND df.Alias = v.Foto\n"
            "WHERE ISNULL(p.ArchivoFotoId, 0) <> CAST(df.IdRegistro AS bigint);")
    return "\n".join(partes) + "\n"


def huella(plan: Plan) -> str:
    from nucleo import sql_de_lote
    h = hashlib.sha256()
    for lote in plan.lotes():
        h.update(sql_de_lote(plan, lote).encode("utf-8"))
    return h.hexdigest()[:16]


def ejecutar_lote(ruta: Path) -> int:
    orden = f'ROOT_DIR="{RAIZ}"; source "$ROOT_DIR/scripts/local/load-local-env.sh"; source "$ROOT_DIR/scripts/local/sql-local-comun.sh"; sql_fichero "$1"'
    p = subprocess.run(["bash", "-c", orden, "bash", str(ruta)], text=True, capture_output=True)
    if p.returncode != 0:
        print(f"[siembra] FALLÓ {ruta.name}:\n{p.stdout.strip()}\n{p.stderr.strip()}", file=sys.stderr)
    return p.returncode


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--solo-plan", action="store_true")
    ap.add_argument("--aplicar", action="store_true")
    ap.add_argument("--semilla", type=int, default=20261121)
    ap.add_argument("--hoy", default="2026-11-21")
    ap.add_argument("--datos")
    ap.add_argument("--salida")
    ap.add_argument("--max-ediciones", type=int, default=6)
    ap.add_argument("--sin-cuentas", action="store_true")
    ap.add_argument("--masivo", type=float, default=1.0, help="escala del motor masivo de N2/N3 (1.0 completo, 0 sin él)")
    ap.add_argument("--solo-celebra", action="store_true", help="plan mínimo con SOLO las ediciones 2025 y 2026 de Celebra la música y los archivos que citan (para aplicarlas a una demo ya sembrada: scripts/demo/sembrar-celebra-ediciones.sh)")
    ap.add_argument("--esperados", help="escribe `lote<TAB>filas con alias` (lo que debe quedar en dbo.DatosDeDemostracion) para que el kit lo compare con la base")
    ap.add_argument("--solo-galeria", action="store_true", help="solo los álbumes de la Galería (para una demo ya sembrada); lo usa scripts/demo/sembrar-galeria.sh")
    ap.add_argument("--sql-ajustes-galeria", metavar="RUTA", help="escribe los UPDATE idempotentes que ponen miniaturas, portadas y textos a los videos de una demo ya sembrada (los usa scripts/demo/sembrar-galeria.sh)")
    ap.add_argument("--solo-fotos-agentes", action="store_true", help="solo las filas `Archivos` de las fotos libres de agentes (para una demo ya sembrada); lo usa scripts/demo/sembrar-fotos-agentes.sh")
    ap.add_argument("--sql-ajustes-fotos-agentes", metavar="RUTA", help="escribe los UPDATE idempotentes que ponen a cada ficha del directorio de agentes su foto libre (los usa scripts/demo/sembrar-fotos-agentes.sh)")
    ap.add_argument("--json", action="store_true", help="resumen en JSON")
    a = ap.parse_args(argv)
    if a.solo_plan == a.aplicar and not a.sql_ajustes_galeria and not a.sql_ajustes_fotos_agentes:
        ap.error("elige exactamente una: --solo-plan o --aplicar")
    if a.sql_ajustes_galeria:
        Path(a.sql_ajustes_galeria).write_text(libro_galeria.sql_de_ajustes(), encoding="utf-8")
        return 0
    hoy = dt.date.fromisoformat(a.hoy)
    carpeta = dp.carpeta_de_datos(a.datos)
    datos = dp.cargar(carpeta)
    catalogos = json.loads((AQUI / "catalogos-instantanea.json").read_text(encoding="utf-8"))
    if a.sql_ajustes_fotos_agentes:
        mapa = fotos_de_agentes_de_la_siembra(a.semilla, hoy, datos, catalogos, a.max_ediciones, not a.sin_cuentas, a.masivo)
        Path(a.sql_ajustes_fotos_agentes).write_text(sql_ajustes_fotos_agentes(mapa), encoding="utf-8")
        print(f"[siembra] {len(mapa)} fichas del directorio de agentes con foto libre ({len(set(mapa.values()))} fotos distintas).")
        return 0
    esquema = json.loads((AQUI / "esquema-instantanea.json").read_text(encoding="utf-8"))
    if a.solo_galeria:
        plan = construir_plan_de_galeria(a.semilla, hoy)
    elif a.solo_fotos_agentes:
        plan = construir_plan_de_fotos_de_agentes(a.semilla, hoy)
    elif a.solo_celebra:
        plan = celebra_ediciones.plan_solo(a.semilla, hoy)
    else:
        plan = construir_plan(a.semilla, hoy, datos, catalogos, a.max_ediciones, not a.sin_cuentas, a.masivo)
    errores, avisos = validar(plan, esquema, catalogos, dp.Territorio(catalogos["divipola"]))
    res = plan.resumen()
    if a.json:
        print(json.dumps({"huella": huella(plan), **res, "errores": errores, "avisos": avisos}, ensure_ascii=False, indent=1))
    else:
        print(f"[siembra] semilla {a.semilla}, fecha de referencia {hoy}, datos de {carpeta}")
        print(f"[siembra] plan: {res['filas']} filas en {len(plan.lotes())} lotes; huella {huella(plan)}")
        for k, v in sorted(res["por_lote"].items()):
            print(f"  {v:5d}  {k}")
        for k, v in sorted(res["por_tabla"].items(), key=lambda x: -x[1]):
            print(f"  {v:5d}  {k}", file=sys.stderr if False else sys.stdout)
        for m in avisos + plan.avisos:
            print(f"[aviso] {m}")
    if errores:
        for m in errores:
            print(f"[ERROR] {m}", file=sys.stderr)
        print(f"[siembra] {len(errores)} errores de validación: no se escribe ni se aplica nada.", file=sys.stderr)
        return 1
    if a.esperados:
        from collections import Counter
        conteo = Counter(f.lote for f in plan.filas if f.alias)
        Path(a.esperados).write_text("".join(f"{lote}\t{n}\n" for lote, n in sorted(conteo.items())), encoding="utf-8")
    salida = Path(a.salida) if a.salida else RAIZ / "siembra" / "plan-generado"
    rutas = escribir_plan(plan, salida)
    print(f"[siembra] plan escrito en {salida} ({len(rutas)} lotes)")
    if a.solo_plan:
        return 0
    for ruta in rutas:
        print(f"[siembra] aplicando {ruta.name} …")
        if ejecutar_lote(ruta) != 0:
            return 2
    print("[siembra] siembra aplicada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
