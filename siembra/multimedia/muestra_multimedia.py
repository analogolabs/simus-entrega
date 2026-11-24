#!/usr/bin/env python3
"""Muestra de multimedia sobre el plan de muestra: comprueba de punta a punta que los assets entran al banco de archivos y
que la API los sirve a anónimos solo cuando corresponde.

    python3 siembra/multimedia/muestra_multimedia.py --solo-plan                      # arma, valida y escribe el plan (no toca ninguna base)
    SIMUS_SIEMBRA_CONFIRMAR=<base> python3 siembra/multimedia/muestra_multimedia.py --aplicar   # siembra la muestra (base de pruebas SIMUS_*)
    python3 siembra/multimedia/muestra_multimedia.py --comprobar-api http://127.0.0.1:PUERTO     # pide cada archivo a la API sin sesión

Escribe `siembra/plan-generado/esperados-multimedia.tsv` (alias, vínculo, ¿lo ve el público?) para `--comprobar-api`.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(RAIZ / "siembra" / "generador"))
sys.path.insert(0, str(AQUI))
import banco  # noqa: E402
import datos_publicos as dp  # noqa: E402
import siembra  # noqa: E402
from nucleo import escribir_plan  # noqa: E402
from validaciones import validar  # noqa: E402

SALIDA = RAIZ / "siembra" / "plan-generado"


def adjuntar(plan) -> list:
    """Añade imágenes a fichas del plan de muestra. Devuelve (alias del archivo, vínculo, lo ve el público)."""
    img = plan.imagenes
    f = {x.alias: x for x in plan.filas if x.alias}
    esperados = []

    def puesto(alias_img, vinculo, publico, **meta):
        esperados.append((alias_img, vinculo, publico))
        return img.ref(alias_img, **meta)

    # Fotos de organización (siempre públicas) y de perfil de persona (públicas mientras el perfil se ve).
    f["org.corp-raiz-y-tambor"].valores["ArchivoFotoId"] = puesto("img.organizacion.corp-raiz-y-tambor.logo", "Entidades.ArchivoFotoId (organización)", True, nombre="Corporación Raíz y Tambor", departamento="27", practica="comunidades-negras")
    f["org.fund-voces-del-llano"].valores["ArchivoFotoId"] = puesto("img.organizacion.fund-voces-del-llano.logo", "Entidades.ArchivoFotoId (organización)", True, nombre="Fundación Voces del Llano", departamento="50", practica="campesinas")
    f["cuenta.externo-camila.perfil"].valores["ArchivoFotoId"] = puesto("img.persona.externo-camila.retrato", "PerfilesPublicos.ArchivoFotoId (perfil público con autorización vigente)", True, nombre="Camila Externa", departamento="11")
    # OJO: un perfil sin la autorización `perfil_publico` vigente NO es visible, y su foto tampoco (la API responde 404).
    f["persona.marisol-quiceno.perfil"].valores["ArchivoFotoId"] = puesto("img.persona.marisol-quiceno.retrato", "PerfilesPublicos.ArchivoFotoId (perfil SIN autorización perfil_publico)", False, nombre="Marisol Quiceño Arango", departamento="05")
    # Festival sintético PUBLICADO: portada, afiche y galería con fotos reales del archivo.
    pub = "festival.festival-de-marimba-de-la-ensenada"
    img.vincular("festivales", pub, "img.festival.festival-de-marimba-de-la-ensenada.portada", rol="portada", orden=1, lote=f[pub].lote, nivel=f[pub].nivel, nombre="Festival de Marimba de La Ensenada", subtitulo="Pacífico nariñense", departamento="52", practica="comunidades-negras")
    esperados.append(("img.festival.festival-de-marimba-de-la-ensenada.portada", "ArchivosDeRegistro festivales (publicado)", True))
    img.vincular("festivales", pub, "img.festival.festival-de-marimba-de-la-ensenada.afiche", rol="afiche", orden=1, lote=f[pub].lote, nivel=f[pub].nivel, nombre="Festival de Marimba de La Ensenada", subtitulo="Edición 2026", lineas=["Tumaco, Nariño"], departamento="52", practica="comunidades-negras")
    esperados.append(("img.festival.festival-de-marimba-de-la-ensenada.afiche", "ArchivosDeRegistro festivales (publicado)", True))
    for n in (1, 2, 3):
        a = f"img.festival.festival-de-marimba-de-la-ensenada.galeria.{n:02d}"
        img.vincular("festivales", pub, a, rol="galeria", orden=n, lote=f[pub].lote, nivel=f[pub].nivel)
        esperados.append((img.pool.resolver(a).alias, "ArchivosDeRegistro festivales galería (publicado)", True))
    # Festival en BORRADOR: su imagen no es pública.
    bor = "festival.festival-del-canto-amazonico"
    img.vincular("festivales", bor, "img.festival.festival-del-canto-amazonico.portada", rol="portada", orden=1, lote=f[bor].lote, nivel=f[bor].nivel, nombre="Festival del Canto Amazónico", departamento="91", practica="pueblos-originarios")
    esperados.append(("img.festival.festival-del-canto-amazonico.portada", "ArchivosDeRegistro festivales (borrador)", False))
    # Noticia publicada y noticia en borrador.
    n_pub = "noticia.abren-inscripciones-al-encuentro-de-chirimia-del-san-juan"
    f[n_pub].valores["ImagenRuta"] = img.ruta("img.noticia.abren-inscripciones-chirimia.imagen", departamento="27", practica="comunidades-negras")
    f[n_pub].valores["ImagenAlternativa"] = img.alt("img.noticia.abren-inscripciones-chirimia.imagen")
    img.vincular_noticia(n_pub, "img.noticia.abren-inscripciones-chirimia.imagen", lote=f[n_pub].lote, nivel=f[n_pub].nivel)
    esperados.append(("img.noticia.abren-inscripciones-chirimia.imagen", "NoticiasArchivos (publicada)", True))
    n_bor = "noticia.formacion-de-directores-de-banda-en-santander"
    img.vincular_noticia(n_bor, "img.pool.noticia.imagen.007", lote=f[n_bor].lote, nivel=f[n_bor].nivel)
    esperados.append(("img.pool.noticia.imagen.007", "NoticiasArchivos (borrador)", False))
    # Evento publicado (pieza del pool genérico, reutilizable).
    ev = "evento.encuentro-de-arpistas-jovenes"
    img.vincular_evento(ev, "img.pool.evento.imagen.012", lote=f[ev].lote, nivel=f[ev].nivel)
    esperados.append(("img.pool.evento.imagen.012", "EventosAgendaArchivos (publicado)", True))
    # Un archivo cargado sin ningún vínculo: la lectura pública devuelve 404.
    puesto("img.pool.agente.001", "sin vínculo", False)
    # Soporte de una reclamación: privado por diseño (solo organización dueña y consola).
    rec = next(x.alias for x in plan.filas if x.tabla == "ReclamacionesAdministracion")
    img.vincular("reclamaciones-administracion", rec, "img.soporte.reclamacion-muestra.documento", rol="soporte", orden=1, lote=f[rec].lote, nivel=f[rec].nivel, nombre="Carta de solicitud")
    esperados.append(("img.soporte.reclamacion-muestra.documento", "ArchivosDeRegistro reclamaciones (soporte)", False))
    return esperados


def construir() -> tuple:
    catalogos = json.loads((RAIZ / "siembra" / "generador" / "catalogos-instantanea.json").read_text(encoding="utf-8"))
    esquema = json.loads((RAIZ / "siembra" / "generador" / "esquema-instantanea.json").read_text(encoding="utf-8"))
    plan = siembra.construir_plan(20261121, dt.date(2026, 11, 21), dp.cargar(dp.carpeta_de_datos(None)), catalogos, 6, True)
    esperados = adjuntar(plan)
    plan.imagenes.cerrar()
    banco.ordenar(plan)
    errores, avisos = validar(plan, esquema, catalogos, dp.Territorio(catalogos["divipola"]))
    return plan, esperados, errores, avisos


def comprobar_api(base: str, esperados_tsv: Path, ids: dict) -> int:
    malos = 0
    for linea in esperados_tsv.read_text(encoding="utf-8").splitlines():
        alias, vinculo, publico = linea.split("\t")
        id_ = ids.get(alias)
        if id_ is None:
            print(f"[FALLA] {alias}: no está en la base"); malos += 1; continue
        try:
            r = urllib.request.urlopen(f"{base}/api/v1/publico/archivos/{id_}", timeout=20)
            cuerpo = r.read()
            codigo, tipo, peso, etag = r.status, r.headers.get("Content-Type"), len(cuerpo), r.headers.get("ETag")
            if hashlib.sha256(cuerpo).hexdigest() != (etag or "").strip('"'):
                print(f"[FALLA] {alias}: el cuerpo servido no coincide con la huella (ETag)"); malos += 1
        except urllib.error.HTTPError as e:
            codigo, tipo, peso, etag = e.code, None, 0, None
        esperado = 200 if publico == "True" else 404
        ok = codigo == esperado
        malos += not ok
        print(f"[{'ok' if ok else 'FALLA'}] {codigo} (esperado {esperado}) id {id_} {alias} · {vinculo} · {tipo or ''} {peso} B {etag or ''}")
    return 1 if malos else 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--solo-plan", action="store_true")
    g.add_argument("--aplicar", action="store_true")
    g.add_argument("--comprobar-api")
    a = ap.parse_args(argv)
    tsv = SALIDA / "esperados-multimedia.tsv"
    if a.comprobar_api:
        orden = f'ROOT_DIR="{RAIZ}"; source "$ROOT_DIR/scripts/local/load-local-env.sh"; source "$ROOT_DIR/scripts/local/sql-local-comun.sh"; sql_consulta "SELECT Alias + N\'|\' + IdRegistro FROM dbo.DatosDeDemostracion WHERE Tabla = N\'Archivos\'"'
        salida = subprocess.run(["bash", "-c", orden], capture_output=True, text=True).stdout
        ids = dict(l.strip().split("|") for l in salida.splitlines() if "|" in l)
        return comprobar_api(a.comprobar_api, tsv, ids)
    plan, esperados, errores, avisos = construir()
    for m in avisos:
        print(f"[aviso] {m}")
    for m in errores:
        print(f"[ERROR] {m}", file=sys.stderr)
    if errores:
        return 1
    SALIDA.mkdir(parents=True, exist_ok=True)
    tsv.write_text("\n".join(f"{al}\t{v}\t{p}" for al, v, p in esperados) + "\n", encoding="utf-8")
    rutas = escribir_plan(plan, SALIDA)
    print(f"[multimedia] muestra: {len(plan.filas)} filas, {sum(1 for f in plan.filas if f.tabla == 'Archivos')} archivos, plan en {SALIDA}")
    if a.solo_plan:
        return 0
    for ruta in rutas:
        print(f"[multimedia] aplicando {ruta.name} …")
        if siembra.ejecutar_lote(ruta) != 0:
            return 2
    print("[multimedia] muestra sembrada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
