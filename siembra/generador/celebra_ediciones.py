"""Constructor del tema `celebra`: las ediciones publicadas 2025 y 2026 de «Celebra la música».

El libro vive en `siembra/libro/celebra/`. Aquí se traduce a filas del plan (lote `n1-celebra`, nivel 1, procedencia híbrida):

  CelebraEdiciones    una por año, con colores, portada (pool multimedia), textos, cifras, aliados y fuente. La de 2026 es la vigente.
  CelebraCategorias   las categorías de la edición.
  CelebraRecursos     la caja de herramientas: piezas descargables del Banco de archivos (con vista previa), enlaces oficiales y, en el grupo
                      «Aliados», el logotipo de cada aliado (el título del recurso es el nombre que la página busca en el texto de aliados).
  CelebraPreguntas    las preguntas frecuentes.
  CelebraGaleria      las seis piezas de cada edición (texto alternativo y crédito del propio archivo).

Los eventos y las noticias de cada edición NO viven aquí: ya los siembra el libro `contenido` con el proyecto transversal de la edición
(`celebra-la-musica-2025` / `celebra-la-musica-2026`, que existen por migración y la limpieza conserva); el micrositio los filtra por ese proyecto.

Solo toca tablas de Celebra y los `Archivos` que cita, por eso puede aplicarse sola sobre una demo ya sembrada (`scripts/demo/sembrar-celebra-ediciones.sh`).
"""
from __future__ import annotations

import datetime as dt
import importlib

from nucleo import Cat, Ref

LOTE = "n1-celebra"
NIVEL = 1
PROCEDENCIA = "hibrido"
FUENTE_FILAS = "Sitio oficial de Celebra la música (Ministerio de Cultura de Colombia) más contenido ilustrativo de demostración"


def _fila(plan, tabla, valores, alias, clave_estable=None):
    return plan.agregar(tabla, valores, alias=alias, lote=LOTE, nivel=NIVEL, procedencia=PROCEDENCIA, fuente=FUENTE_FILAS, clave_estable=clave_estable)


def sembrar(plan) -> None:
    """Agrega al plan las ediciones del libro. Exige `plan.imagenes` (el banco multimedia ya instalado)."""
    L = importlib.import_module("celebra")
    img = plan.imagenes
    for e in L.EDICIONES:
        anio, base = e["anio"], f"celebra.{e['anio']}"
        c = e["cifras"]
        _fila(plan, "CelebraEdiciones", {
            "Anio": anio, "Nombre": e["nombre"], "Hashtag": None,
            "ProyectoTransversalId": Cat("ProyectosTransversales", "IdProyectoTransversal", "Codigo", e["proyecto"]),
            "FechaInicio": dt.date.fromisoformat(e["inicio"]), "FechaFin": dt.date.fromisoformat(e["fin"]),
            "Resumen": e["resumen"], "Presentacion": e["presentacion"], "Aliados": e["aliados"],
            "Actividades": c["actividades"], "Municipios": c["municipios"], "Departamentos": c["departamentos"],
            "Organizaciones": c["organizaciones"], "Musicos": c["musicos"],
            "ColorPrincipal": e["color_principal"], "ColorSecundario": e["color_secundario"],
            "ImagenPortadaArchivoId": img.ref(e["portada"], lote=LOTE, nivel=NIVEL),
            "Actual": e["actual"], "Publicada": e["publicada"], "Fuente": e["fuente"], "PendienteDeValidar": False,
            "FechaCreacion": dt.datetime.fromisoformat(e["creada"]), "FechaActualizacion": dt.datetime.fromisoformat(e["actualizada"]),
        }, alias=base, clave_estable=f"n1.celebra.edicion.{anio}")
        for i, (nombre, descripcion) in enumerate(e["categorias"], 1):
            _fila(plan, "CelebraCategorias", {"CelebraEdicionId": Ref(base), "Nombre": nombre, "Descripcion": descripcion, "Orden": i}, f"{base}.categoria.{i}")
        orden = 0
        for grupo, titulo, descripcion, alias_pieza in e["piezas"]:   # descargables del Banco (con vista previa); primero, para que sean la primera pestaña
            orden += 1
            _fila(plan, "CelebraRecursos", {"CelebraEdicionId": Ref(base), "Grupo": grupo, "Titulo": titulo, "Descripcion": f"{descripcion} Edición {anio}.",
                                            "ArchivoId": img.ref(alias_pieza, lote=LOTE, nivel=NIVEL), "Url": None, "Orden": orden}, f"{base}.recurso.{orden}")
        for grupo, titulo, descripcion, url in e["recursos"]:   # enlaces oficiales
            orden += 1
            _fila(plan, "CelebraRecursos", {"CelebraEdicionId": Ref(base), "Grupo": grupo, "Titulo": titulo, "Descripcion": f"{titulo}. {descripcion}"[:600],
                                            "ArchivoId": None, "Url": url, "Orden": orden}, f"{base}.recurso.{orden}")
        for clave, nombre in [(c, dict(L.ALIADOS)[c]) for c in e["aliados_logos"]]:   # logotipo REAL del aliado (pool: logos de la página oficial): grupo «Aliados», título = nombre tal como aparece en el texto de aliados
            orden += 1
            _fila(plan, "CelebraRecursos", {"CelebraEdicionId": Ref(base), "Grupo": "Aliados", "Titulo": nombre,
                                            "Descripcion": f"Logotipo de {nombre}, aliado de la edición {anio}.",
                                            "ArchivoId": img.ref(f"img.organizacion.{clave}.logo", lote=LOTE, nivel=NIVEL, nombre=nombre), "Url": None, "Orden": orden}, f"{base}.recurso.{orden}")
        for i, (pregunta, respuesta) in enumerate(e["preguntas"], 1):
            _fila(plan, "CelebraPreguntas", {"CelebraEdicionId": Ref(base), "Pregunta": pregunta, "Respuesta": respuesta, "Orden": i}, f"{base}.pregunta.{i}")
        for i, alias_pieza in enumerate(e["galeria"], 1):
            activo = img.pool.resolver(alias_pieza)
            _fila(plan, "CelebraGaleria", {"CelebraEdicionId": Ref(base), "ArchivoId": img.ref(alias_pieza, lote=LOTE, nivel=NIVEL),
                                           "TextoAlternativo": activo.alt, "Credito": (activo.credito or "Ministerio de Cultura de Colombia, Celebra la música")[:250], "Orden": i},
                  f"{base}.galeria.{i}")


def plan_solo(semilla: int, hoy: dt.date):
    """Plan mínimo con SOLO las ediciones (y los archivos que citan): para aplicarlo a una demo ya sembrada sin tocar nada más."""
    import banco as multimedia
    from nucleo import Plan
    plan = Plan(semilla=semilla, hoy=hoy)
    plan.avisos = []
    multimedia.instalar(plan)
    sembrar(plan)
    plan.avisos += [f"multimedia: asset creado al vuelo y anotado en el manifiesto: {a}" for a in plan.imagenes.cerrar()]
    multimedia.ordenar(plan)
    return plan
