"""Multimedia de toda la siembra integral: enlaza los alias `img.*` de TODOS los libros con el banco de archivos.

Cada tema pidió sus imágenes por alias sin ver el manifiesto del tema multimedia; aquí se resuelven contra él (`siembra/multimedia/manifiesto.csv`)
y, si un alias no existe, `plan.imagenes` (el pool) lo genera con sus reglas y lo anota en el manifiesto.

  contenido        `c.resolver_imagen(alias)`: la noticia o el evento recibe `ImagenRuta` y su vínculo (`NoticiasArchivos`/`EventosAgendaArchivos`).
  festivales       portada, logotipo y galería del festival (`ArchivosDeRegistro` módulo `festivales`), afiche de cada edición (`ediciones-festival`);
                   los mercados no tienen módulo propio: su portada, logotipo y afiche van por edición (`ediciones-mercado`). Los históricos de nivel 1, portada.
  personas         foto del perfil (`PerfilesPublicos.ArchivoFotoId`) SOLO si tiene la autorización `perfil_publico` vigente y perfil visible (si no, la API da 404);
                   logotipo de cada organización (`Entidades.ArchivoFotoId`, siempre público).
  muestra / cuentas  logotipos de las organizaciones de la muestra y fotos de las cuentas externas de validación.
  masivo (N2/N3)   piezas del pool genérico (`img.pool.<clase>.NNN`, elegidas por huella del alias: una fila `Archivos` la usan muchos registros).

La API sirve un archivo a anónimos solo si está vinculado a algo publicado: los vínculos de fichas sin publicar no abren nada al público.
"""
from __future__ import annotations

import hashlib

from nucleo import Ref


def _n(alias: str, modulo: int) -> int:
    return int(hashlib.sha1(alias.encode("utf-8")).hexdigest(), 16) % modulo


def pool_alias(clase: str, alias: str) -> str:
    from pool import CLASES_DEL_POOL
    return f"img.pool.{clase}.{_n(alias, CLASES_DEL_POOL[clase]) + 1:03d}"


def _practica(fe: dict) -> str:
    p = fe.get("practicas") or [""]
    return p[0]


def instalar_resolvedor(c) -> None:
    """Para `contenido_siembra._imagen`: devuelve (ImagenRuta, None → se conserva el alt del libro, ref al archivo)."""
    img = c.plan.imagenes

    def resolver_imagen(alias_img):
        if alias_img.count(".") == 2:   # el libro de contenido cita `img.noticia.<clave>` / `img.evento.<clave>`; el manifiesto usa `….imagen`
            alias_img += ".imagen"
        return img.ruta(alias_img), None, img.ref(alias_img)
    c.resolver_imagen = resolver_imagen


def adjuntar_festivales(c, libro) -> None:
    img = c.plan.imagenes
    for fe in libro.FESTIVALES:
        k, alias = fe["clave"], f"festival.{fe['clave']}"
        meta = dict(nombre=fe["nombre"], departamento=fe["muni"][:2], practica=_practica(fe))
        lote = f"n1-festivales-libro"
        img.vincular("festivales", alias, f"img.festival.{k}.portada", rol="portada", orden=1, lote=lote, nivel=1, subtitulo=fe.get("periodicidad", ""), **meta)
        img.vincular("festivales", alias, f"img.festival.{k}.logo", rol="logo", orden=1, lote=lote, nivel=1, **meta)
        for n in (1, 2, 3):
            img.vincular("festivales", alias, f"img.festival.{k}.galeria.{n}", rol="galeria", orden=n, lote=lote, nivel=1)
        for e in fe["ediciones"]:
            img.vincular("ediciones-festival", f"{alias}.edicion.{e['anio']}", f"img.edicion.{k}-{e['anio']}.afiche", rol="afiche", orden=1, lote=lote, nivel=1,
                         nombre=fe["nombre"], subtitulo=f"Edición {e['anio']}", lineas=[e.get("lema", "")], departamento=fe["muni"][:2], practica=_practica(fe))
    for mk in libro.MERCADOS:
        k, alias = mk["clave"], f"mercado.{mk['clave']}"
        meta = dict(nombre=mk["nombre"], departamento=mk["muni"][:2], practica=_practica(mk))
        lote = "n1-mercados-libro"
        for e in mk["ediciones"]:
            ed = f"{alias}.edicion.{e['anio']}"
            img.vincular("ediciones-mercado", ed, f"img.mercado.{k}.portada", rol="portada", orden=1, lote=lote, nivel=1, **meta)
            img.vincular("ediciones-mercado", ed, f"img.mercado.{k}.logo", rol="logo", orden=1, lote=lote, nivel=1, **meta)
            img.vincular("ediciones-mercado", ed, f"img.edicion.{k}-{e['anio']}.afiche", rol="afiche", orden=1, lote=lote, nivel=1,
                         nombre=mk["nombre"], subtitulo=f"Edición {e['anio']}", lineas=[e.get("lema", "")], departamento=mk["muni"][:2], practica=_practica(mk))
    for h in libro.HISTORICOS:
        if h["nivel"] == 1:
            img.vincular("festivales", f"festival.{h['clave']}", f"img.festival.{h['clave']}.portada", rol="portada", orden=1, lote="n1-festivales-historicos-sinteticos", nivel=1,
                         nombre=h["nombre"], departamento=h["muni"][:2], practica=_practica(h))


def _filas(plan) -> dict:
    return {f.alias: f for f in plan.filas if f.alias}


def perfil_visible(filas: dict, perfil) -> bool:
    """El criterio de la API (`PerfilPublicoEndpoints.Visibles`): perfil «publico», cuenta activa, sin ocultar por moderación y con la autorización
    `perfil_publico` vigente. Solo entonces se sirve su foto a anónimos; en otro caso daría 404."""
    base = perfil.alias[: -len(".perfil")]
    cuenta, aut = filas.get(base), filas.get(f"{base}.autorizacion.perfil_publico")
    return (cuenta is not None and cuenta.valores.get("Activo") is not False and aut is not None and not aut.valores.get("FechaRevocacion")
            and perfil.valores.get("Visibilidad") == "publico" and not perfil.valores.get("OcultoPorModeracion"))


def _asignar_foto_de_agente(c, fila, alias: str, posicion: int) -> None:
    """Pone la foto libre `img.pool.agente.NNN` a un perfil y lo anota en `plan.fotos_de_agentes` (perfil → foto), que usa scripts/demo/sembrar-fotos-agentes.sh."""
    from pool import alias_de_foto_de_agente
    foto = alias_de_foto_de_agente(posicion)
    fila.valores["ArchivoFotoId"] = c.plan.imagenes.ref(foto, lote=fila.lote, nivel=fila.nivel)
    if not hasattr(c.plan, "fotos_de_agentes"):
        c.plan.fotos_de_agentes = {}
    c.plan.fotos_de_agentes[alias] = foto


def adjuntar_organizaciones_y_perfiles(c, libro_personas_claves=None) -> None:
    """Logotipo de TODA organización con ficha propia de nivel 0/1 (libro de personas, libro de festivales, muestra) y foto de los perfiles N1 con autorización."""
    plan, img = c.plan, c.plan.imagenes
    filas = _filas(plan)
    for alias, f in filas.items():
        if f.tabla == "Entidades" and f.nivel <= 1 and alias.startswith("org.") and ".n2." not in alias and ".n3." not in alias:
            clave = alias[len("org."):]
            if f.valores.get("ArchivoFotoId") is None:
                f.valores["ArchivoFotoId"] = img.ref(f"img.organizacion.{clave}.logo", lote=f.lote, nivel=f.nivel, nombre=f.valores.get("Nombre"), departamento=f.valores.get("CodigoDepartamentoSede"))
        if f.tabla == "PerfilesPublicos" and f.nivel <= 1:
            if not perfil_visible(filas, f) or f.valores.get("ArchivoFotoId") is not None:
                continue
            # Foto libre (instrumentos, CC0/dominio público) en vez de un retrato ilustrado: las fichas del directorio se ven reales y sin rostros.
            # Las de nivel 0/1 reciben fotos consecutivas (no se repite ninguna hasta agotar las 31); el orden del plan es estable.
            _asignar_foto_de_agente(c, f, alias, len(getattr(plan, "fotos_de_agentes", {})))


def adjuntar_masivo(c) -> None:
    """Piezas del pool genérico para N2/N3: la mayoría de las fichas publicadas lleva imagen y una parte de las organizaciones, logotipo."""
    plan, img = c.plan, c.plan.imagenes
    filas = _filas(plan)
    for alias, f in filas.items():
        if not f.lote.startswith(("n2-masivo", "n3-masivo")):
            continue
        v = f.valores
        if f.tabla == "PerfilesPublicos":
            if perfil_visible(filas, f) and _n(alias, 100) < 70:
                _asignar_foto_de_agente(c, f, alias, _n(alias, 10_000))
        elif f.tabla == "Entidades" and alias.startswith("org.") and _n(alias, 100) < 65:
            v["ArchivoFotoId"] = img.ref(pool_alias("organizacion.logo", alias), lote=f.lote, nivel=f.nivel)
        elif f.tabla == "Festivales" and v.get("EstadoRegistro") == "publicado" and _n(alias, 100) < 80:
            img.vincular("festivales", alias, pool_alias("festival.portada", alias), rol="portada", orden=1, lote=f.lote, nivel=f.nivel)
        elif f.tabla == "EventosAgenda" and v.get("Estado") == "publicado" and _n(alias, 100) < 70:
            img.vincular_evento(alias, pool_alias("evento.imagen", alias), lote=f.lote, nivel=f.nivel)
            v["ImagenRuta"] = img.ruta(pool_alias("evento.imagen", alias), lote=f.lote, nivel=f.nivel)
            v["ImagenAlternativa"] = img.alt(pool_alias("evento.imagen", alias))
        elif f.tabla in ("Talleres", "Espacios", "Redes") and v.get("EstadoRegistro") == "publicado" and _n(alias, 100) < 60:
            v["ArchivoFotoId"] = img.ref(pool_alias("espacio.foto", alias), lote=f.lote, nivel=f.nivel)
