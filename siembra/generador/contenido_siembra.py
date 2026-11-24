"""Constructores del tema `contenido`: campañas (proyectos transversales), noticias, agenda y marcas del catálogo editorial.

El libro vive en `siembra/libro/contenido/` (paquete `contenido`). Aquí solo se traduce a filas del plan:
- campañas → `ProyectosTransversales` (las de partida —Celebra la música y sus dos ediciones— ya existen: se citan por código);
- noticias → `Noticias` + práctica(s), territorio(s), campaña(s), etiquetas e imagen; historial coherente con el estado;
- eventos → `EventosAgenda` + pivotes; el vínculo a festival/mercado/taller/espacio/red se resuelve SOLO si el alias existe en el plan
  (si otro tema lo renombra, el evento se siembra sin vínculo y se avisa);
- catálogo editorial → marcas N1 sobre fichas que ya existen (no se inserta ni se modifica ninguna ficha).

Imágenes: el libro cita un alias (`img.noticia.<clave>`, `img.evento.<clave>`). Si el constructor tiene `resolver_imagen(alias)` (lo define el tema multimedia)
devuelve `(ruta_publica, alternativa, ref_archivo|None)`; sin él, solo se guarda el texto alternativo y se avisa cuántas imágenes esperan al tema multimedia.
"""
from __future__ import annotations

import datetime as dt
import importlib

from constructores import dep_de, momento, slug
from nucleo import Cat, Ref

PROCESOS = {"festival": ("festival", "FestivalId"), "mercado": ("mercado", "MercadoId"), "taller": ("talleres", "TallerId"),
            "espacio": ("espacios", "EspacioId"), "red": ("redes", "RedId")}
MOTIVO_RECHAZO = "No cumple el criterio editorial: faltan fuentes verificables; puede corregirse y volver a enviarse."


def _fecha(v) -> dt.date:
    return v if isinstance(v, dt.date) else dt.date.fromisoformat(v)


def _hora(v):
    return dt.time.fromisoformat(v) if v else None


def _pasos(c, estado, creacion: dt.date, publicacion: dt.date | None, archivado: dt.date | None):
    """Pasos de estado (anterior, nuevo, momento, motivo) con fechas crecientes que terminan en el estado actual. Borrador no deja pasos."""
    hoy = c.plan.hoy
    envio = min(creacion + dt.timedelta(days=1), hoy)
    pasos = []
    if estado != "borrador":
        pasos.append(("borrador", "en_revision", envio, None))
    if estado == "rechazado":
        pasos.append(("en_revision", "rechazado", min(envio + dt.timedelta(days=2), hoy), MOTIVO_RECHAZO))
    pub_dia = min(max(publicacion or envio, envio), hoy)
    if estado in ("publicado", "archivado"):
        pasos.append(("en_revision", "publicado", pub_dia, None))
    if estado == "archivado":
        pasos.append(("publicado", "archivado", max(archivado, pub_dia), None))
    return [(ant, nuevo, dt.datetime(dia.year, dia.month, dia.day, 9 + k, 15), motivo) for k, (ant, nuevo, dia, motivo) in enumerate(pasos)]


def _emitir_historial(c, alias, modulo, pasos, lote, nivel):
    """Se emite DESPUÉS de la fila del registro (las referencias se resuelven en el orden del plan)."""
    for k, (ant, nuevo, momento_, motivo) in enumerate(pasos):
        c.add("RegistrosRevisionHistorial", {"ModuloId": modulo, "RegistroId": Ref(alias, texto=True), "EstadoAnterior": ant, "EstadoNuevo": nuevo,
                                             "Accion": "EstadoCambiado", "MotivoRechazo": motivo, "IdUsuario": c.gestor, "Fecha": momento_},
              alias=f"{alias}.hist.{k + 1}", lote=lote, nivel=nivel, procedencia="sintetico")


def _campana(c, codigo, campanas_propias):
    return Ref(f"campana.{codigo}") if codigo in campanas_propias else Cat("ProyectosTransversales", "IdProyectoTransversal", "Codigo", codigo)


def _imagen(c, alias_img, alt):
    """(ImagenRuta, ImagenAlternativa, ref_archivo). Sin resolvedor del tema multimedia, solo el texto alternativo."""
    res = getattr(c, "resolver_imagen", None)
    if res and alias_img:
        ruta, alternativa, ref = res(alias_img)
        return ruta, alternativa or alt, ref
    if alias_img:
        c.imagenes_pendientes = getattr(c, "imagenes_pendientes", 0) + 1
    return None, alt, None


def campanas(c, items, lote="n1-campanas"):
    for i, it in enumerate(items):
        alias = f"campana.{it['codigo']}"
        c.add("ProyectosTransversales", {"Codigo": it["codigo"], "Nombre": it["nombre"], "Descripcion": it["descripcion"], "Activo": it.get("activo", True),
                                         "OrdenVisualizacion": 10 + i, "FechaCreacion": momento(c.plan, 400 - 30 * i, 11)},
              alias=alias, lote=lote, nivel=1, procedencia="sintetico", clave_estable=f"n1.campana.{it['codigo']}"[:80])


def noticias(c, items, lote="n2-noticias"):
    propias = {x["codigo"] for x in c.libro_contenido.CAMPANAS}
    hoy = c.plan.hoy
    for it in items:
        clave, estado = it["clave"], it["estado"]
        alias = f"noticia.{clave}"
        nivel = it.get("nivel", 1)
        pub = _fecha(it["fecha"]) if it.get("fecha") else None
        creacion = (pub - dt.timedelta(days=4)) if pub else hoy - dt.timedelta(days=it.get("dias", 20))
        creacion = min(creacion, hoy - dt.timedelta(days=2))
        arch = _fecha(it["archivada"]) if it.get("archivada") else (min(pub + dt.timedelta(days=200), hoy - dt.timedelta(days=15)) if estado == "archivado" else None)
        ruta, alt, ref_arch = _imagen(c, it.get("imagen"), it.get("alt"))
        pasos = _pasos(c, estado, creacion, pub, arch)
        ultimo = pasos[-1][2] if pasos else None
        actualizacion = max(ultimo or dt.datetime.combine(creacion, dt.time(10)), dt.datetime.combine(creacion, dt.time(10)))
        c.add("Noticias", {"Slug": slug(clave), "Titulo": it["titulo"], "Resumen": it["resumen"], "Cuerpo": it["cuerpo"], "FechaPublicacion": pub if estado in ("publicado", "archivado") else None,
                           "ImagenRuta": ruta, "ImagenAlternativa": alt, "AutoriaNombre": it["autoria"], "Estado": estado,
                           "FechaCreacion": dt.datetime.combine(creacion, dt.time(10)), "FechaActualizacion": actualizacion,
                           "CategoriaId": Cat("Categorias", "IdCategoria", "Slug", it["cat"], "CodigoModulo = N'noticias'")},
              alias=alias, lote=lote, nivel=nivel, procedencia="sintetico", clave_estable=c.clave_est(nivel, "noticia", clave))
        _emitir_historial(c, alias, "noticias", pasos, lote, nivel)
        for p in it.get("practicas", []):
            c.add("NoticiasPracticasMusicales", {"NoticiaId": Ref(alias), "PracticaMusicalId": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", c.libro_contenido.PRACTICAS[p])},
                  alias=None, lote=lote, nivel=nivel, procedencia="sintetico")
        for t in it.get("territorios", []):
            c.add("NoticiasTerritoriosSonoros", {"NoticiaId": Ref(alias), "TerritorioSonoroId": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", t)},
                  alias=None, lote=lote, nivel=nivel, procedencia="sintetico")
        for cod in it.get("campanas", []):
            c.add("NoticiasProyectosTransversales", {"NoticiaId": Ref(alias), "ProyectoTransversalId": _campana(c, cod, propias)}, alias=None, lote=lote, nivel=nivel, procedencia="sintetico")
        for t in it.get("etiquetas", []):
            c.add("EtiquetasNoticia", {"NoticiaId": Ref(alias), "Termino": t}, alias=None, lote=lote, nivel=nivel, procedencia="sintetico")
        if ref_arch is not None:
            c.add("NoticiasArchivos", {"NoticiaId": Ref(alias), "ArchivoId": ref_arch, "RolArchivo": "imagen_principal", "OrdenVisualizacion": 1}, alias=None, lote=lote, nivel=nivel, procedencia="sintetico")


def eventos(c, items, existentes: set, lote="n2-agenda"):
    propias = {x["codigo"] for x in c.libro_contenido.CAMPANAS}
    hoy = c.plan.hoy
    for it in items:
        clave, estado = it["clave"], it["estado"]
        alias = f"evento.{clave}"
        nivel = it.get("nivel", 2)
        inicio = _fecha(it["inicio"])
        fin = _fecha(it["fin"]) if it.get("fin") else None
        modalidad = it["modalidad"]
        creacion = min(inicio - dt.timedelta(days=45), hoy - dt.timedelta(days=12))
        publicacion = creacion + dt.timedelta(days=3)
        arch = None
        if estado == "archivado":
            arch = min((fin or inicio) + dt.timedelta(days=20), hoy - dt.timedelta(days=3))
        ruta, alt, ref_arch = _imagen(c, it.get("imagen"), it.get("alt"))
        pasos = _pasos(c, estado, creacion, publicacion, arch)
        ultimo = pasos[-1][2] if pasos else None
        muni, dep = it.get("muni"), it.get("dep")
        if muni:
            nivel_cob, dep, cod_muni = "municipal", dep_de(muni), muni
        elif dep:
            nivel_cob, cod_muni = "departamental", None
        else:
            nivel_cob, dep, cod_muni = "nacional", None, None
        vals = {"Slug": slug(clave), "Titulo": it["titulo"], "Descripcion": it["desc"], "FechaInicio": inicio, "FechaFin": fin, "HoraInicio": _hora(it.get("hi")), "HoraFin": _hora(it.get("hf")),
                "Modalidad": modalidad, "Lugar": it.get("lugar"), "CodigoDepartamento": dep, "CodigoMunicipio": cod_muni, "Url": it.get("url"), "ImagenRuta": ruta, "ImagenAlternativa": alt,
                "Estado": estado, "FechaCreacion": dt.datetime.combine(creacion, dt.time(10)),
                "FechaActualizacion": max(ultimo or dt.datetime.combine(creacion, dt.time(10)), dt.datetime.combine(creacion, dt.time(10))),
                "Organizador": it["organizador"], "DescripcionLarga": it["largo"], "NivelCobertura": nivel_cob,
                "CategoriaId": Cat("Categorias", "IdCategoria", "Slug", it["cat"], "CodigoModulo = N'agenda'")}
        if it.get("cancelado"):
            vals.update({"Cancelado": True, "MotivoCancelacion": it["cancelado"], "FechaCancelacion": dt.datetime.combine(inicio - dt.timedelta(days=3), dt.time(15))})
        proceso = it.get("proceso")
        if proceso:
            tipo, clave_proceso = proceso
            prefijo, columna = PROCESOS[tipo]
            alias_proceso = f"{prefijo}.{clave_proceso}"
            if alias_proceso in existentes:
                vals[columna] = Ref(alias_proceso)
            else:
                c.avisos.append(f"contenido: el evento «{clave}» no se vinculó: no existe {alias_proceso} en el plan")
        c.add("EventosAgenda", vals, alias=alias, lote=lote, nivel=nivel, procedencia="sintetico", clave_estable=c.clave_est(nivel, "evento", clave))
        _emitir_historial(c, alias, "agenda", pasos, lote, nivel)
        for p in it.get("practicas", []):
            c.add("EventosAgendaPracticasMusicales", {"EventoAgendaId": Ref(alias), "PracticaMusicalId": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", c.libro_contenido.PRACTICAS[p])},
                  alias=None, lote=lote, nivel=nivel, procedencia="sintetico")
        for t in it.get("territorios", []):
            c.add("EventosAgendaTerritoriosSonoros", {"EventoAgendaId": Ref(alias), "TerritorioSonoroId": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", t)},
                  alias=None, lote=lote, nivel=nivel, procedencia="sintetico")
        for cod in it.get("campanas", []):
            c.add("EventosAgendaProyectosTransversales", {"EventoAgendaId": Ref(alias), "ProyectoTransversalId": _campana(c, cod, propias)}, alias=None, lote=lote, nivel=nivel, procedencia="sintetico")
        for t in it.get("etiquetas", []):
            c.add("EtiquetasEventoAgenda", {"EventoAgendaId": Ref(alias), "Termino": t}, alias=None, lote=lote, nivel=nivel, procedencia="sintetico")
        if ref_arch is not None:
            c.add("EventosAgendaArchivos", {"EventoAgendaId": Ref(alias), "ArchivoId": ref_arch, "RolArchivo": "imagen_principal", "OrdenVisualizacion": 1}, alias=None, lote=lote, nivel=nivel, procedencia="sintetico")


def editorial(c, codigos, fuente, lote="n1-editorial"):
    """Marca N1 de fichas del acervo que ya existen (no inserta ni cambia nada de negocio)."""
    for cod in codigos:
        k = slug(cod)
        c.add("PublicacionesEditoriales", {}, alias=f"editorial.{k}", lote=lote, nivel=1, procedencia="publico", fuente=fuente, clave_estable=f"n1.editorial.{k}",
              id_expr=Cat("PublicacionesEditoriales", "IdPublicacionEditorial", "Codigo", cod), solo_marca=True)


def sembrar(c):
    """Punto de entrada: sustituye a `Constructor.eventos()` y `Constructor.noticias()` de la muestra."""
    L = importlib.import_module("contenido")
    c.libro_contenido = L
    existentes = {f.alias for f in c.plan.filas if f.alias}
    campanas(c, L.CAMPANAS)
    noticias(c, L.NOTICIAS)
    eventos(c, L.EVENTOS, existentes)
    editorial(c, L.EDITORIAL_N1, L.EDITORIAL_FUENTE)
    pend = getattr(c, "imagenes_pendientes", 0)
    if pend:
        c.avisos.append(f"contenido: {pend} imágenes citadas por alias esperan el resolvedor del tema multimedia (se siembran solo con su texto alternativo)")
