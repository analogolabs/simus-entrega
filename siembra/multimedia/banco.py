"""Entrada de los assets al banco de archivos de la demo: filas `Archivos` idempotentes y vínculos por alias.

Uso desde cualquier constructor del plan (los libros de los demás temas):

    img = plan.imagenes                       # lo instala siembra.py; también `banco.instalar(plan)`
    foto = img.ref("img.persona.marisol-quiceno.retrato", lote="n1-personas", nombre="Marisol Quiceño Arango", departamento="05")
    valores["ArchivoFotoId"] = foto           # Ref al alias: el SQL resuelve el IdArchivo de ESTA base
    valores["ImagenRuta"] = img.ruta("img.noticia.mi-noticia.imagen", lote=lote)        # '/api/v1/publico/archivos/<id>' (Raw)
    valores["ImagenAlternativa"] = img.alt("img.noticia.mi-noticia.imagen")
    img.vincular("festivales", "fest-alias", "img.festival.x.portada", rol="portada", orden=1, lote=lote)   # ArchivosDeRegistro
    img.vincular_noticia("noticia-alias", "img.noticia.x.imagen", lote=lote)                                 # NoticiasArchivos
    img.vincular_evento("evento-alias", "img.evento.x.imagen", lote=lote)                                    # EventosAgendaArchivos

La fila `Archivos` se crea UNA vez por alias (Alias único en `dbo.DatosDeDemostracion`), en el lote `n3-multimedia`, que el generador emite
PRIMERO; aplicar la siembra dos veces no duplica nada. Todo archivo es institucional (OrganizacionId nulo) y lo carga el usuario del sistema.

Visibilidad: la API sirve un archivo a anónimos SOLO si está vinculado a algo publicado (ver `VinculosAsync` en BancoDeArchivosEndpoints.cs). No hay
bandera: lo que cuenta es a qué se vincule. Una foto de persona se ve si su perfil es público; la de un participante de una agenda de citas o un
soporte de reclamación, solo con sesión.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parents[0] / "generador"))

import comun as C  # noqa: E402
import pool as P  # noqa: E402
from nucleo import Blob, Raw, Ref, USUARIO_SISTEMA  # noqa: E402

LOTE_ARCHIVOS = "n3-multimedia"
RUTA_PUBLICA = "/api/v1/publico/archivos/"
MODULOS_DE_REGISTRO = ("festivales", "ediciones-festival", "ediciones-mercado", "reclamaciones-administracion")


class Banco:
    def __init__(self, plan, pool: Optional[P.Pool] = None):
        self.plan = plan
        self.pool = pool or P.Pool()
        self.filas: dict = {}
        plan.imagenes = self

    # ------------------------------------------------------------------ archivos
    def ref(self, alias: str, lote: str = LOTE_ARCHIVOS, nivel: int = 3, **meta) -> Ref:
        """Ref a la fila `Archivos` del alias (la crea si es la primera vez). `meta`: nombre, departamento, region, practica, subtitulo, lineas."""
        a = self.pool.resolver(alias, **meta)
        if a.alias not in self.filas:
            self._agregar(a)
        self.plan.multimedia_pedidos = getattr(self.plan, "multimedia_pedidos", set()) | {alias}
        return Ref(a.alias)

    def _agregar(self, a: C.Asset) -> None:
        ext = C.MIMES[a.mime]
        nombre_alm = f"pnmc-{a.checksum}{ext}"
        valores = {
            "NombreOriginal": f"{a.alias}{ext}"[:260],
            "NombreAlmacenado": nombre_alm,
            "Extension": ext,
            "TipoMime": a.mime,
            "PesoBytes": a.bytes,
            "RutaAlmacenamiento": RUTA_PUBLICA + nombre_alm,
            "TextoAlternativo": a.alt,
            "Pie": a.pie or None,
            "Credito": a.credito or None,
            "IdUsuarioCarga": USUARIO_SISTEMA,
            "Contenido": Blob(str(C.ruta_del_asset(a, self.pool.dir))),
            "Huella": a.checksum,
            "Ancho": a.ancho or None,
            "Alto": a.alto or None,
        }
        fuente = a.fuente if a.fuente and a.fuente != "generado" else None
        if a.procedencia != "sintetico" and not fuente:
            fuente = "generado"
        fila = self.plan.agregar("Archivos", valores, alias=a.alias, lote=LOTE_ARCHIVOS, nivel=3, procedencia=a.procedencia,
                                 fuente=fuente or ("generado: siembra/multimedia" if a.procedencia != "sintetico" else None))
        self.filas[a.alias] = fila

    def alt(self, alias: str, **meta) -> str:
        return self.pool.resolver(alias, **meta).alt

    def pie(self, alias: str, **meta) -> str:
        return self.pool.resolver(alias, **meta).pie

    def ruta(self, alias: str, **meta) -> Raw:
        """Valor de `ImagenRuta`: la URL pública de lectura del archivo, resuelta por alias al sembrar."""
        r = self.ref(alias, **meta)
        return Raw(f"(N'{RUTA_PUBLICA}' + CAST((SELECT IdRegistro FROM dbo.DatosDeDemostracion WHERE Alias = N'{r.alias}') AS nvarchar(20)))")

    # ------------------------------------------------------------------ vínculos
    def vincular(self, modulo: str, registro_alias: str, alias_img: str, rol: str = "material", orden: int = 1, lote: str = "",
                 nivel: int = 3, descripcion: Optional[str] = None, procedencia: str = "sintetico", fuente: Optional[str] = None, **meta):
        """Fila de `ArchivosDeRegistro` (festivales, ediciones, soportes). `orden` empieza en 1 y es único por (módulo, registro, rol)."""
        if modulo not in MODULOS_DE_REGISTRO:
            raise ValueError(f"módulo no admitido por CK_ArchivosDeRegistro_Modulo: {modulo}")
        valores = {"ModuloId": modulo, "RegistroId": Ref(registro_alias, texto=True), "ArchivoId": self.ref(alias_img, lote=lote or LOTE_ARCHIVOS, nivel=nivel, **meta),
                   "RolArchivo": rol, "DescripcionArchivo": (descripcion or self.alt(alias_img))[:1000], "OrdenVisualizacion": orden}
        return self.plan.agregar("ArchivosDeRegistro", valores, lote=lote or LOTE_ARCHIVOS, nivel=nivel, procedencia=procedencia, fuente=fuente)

    def vincular_noticia(self, noticia_alias: str, alias_img: str, rol: str = "imagen_principal", orden: int = 1, lote: str = "", nivel: int = 3, **meta):
        valores = {"NoticiaId": Ref(noticia_alias), "ArchivoId": self.ref(alias_img, lote=lote or LOTE_ARCHIVOS, nivel=nivel, **meta), "RolArchivo": rol, "OrdenVisualizacion": orden}
        return self.plan.agregar("NoticiasArchivos", valores, lote=lote or LOTE_ARCHIVOS, nivel=nivel)

    def vincular_evento(self, evento_alias: str, alias_img: str, rol: str = "imagen_principal", orden: int = 1, lote: str = "", nivel: int = 3, **meta):
        valores = {"EventoAgendaId": Ref(evento_alias), "ArchivoId": self.ref(alias_img, lote=lote or LOTE_ARCHIVOS, nivel=nivel, **meta), "RolArchivo": rol, "OrdenVisualizacion": orden}
        return self.plan.agregar("EventosAgendaArchivos", valores, lote=lote or LOTE_ARCHIVOS, nivel=nivel)

    def cerrar(self) -> list:
        """Guarda el manifiesto si hubo alias nuevos y devuelve los alias creados."""
        nuevos = list(self.pool.nuevos)
        if nuevos:
            self.pool.guardar_manifiesto()
        return nuevos


def ordenar(plan) -> None:
    """Ordena el plan por lotes (orden de primera aparición) dejando SIEMPRE primero el lote de archivos: no depende de nada y todos lo citan."""
    orden = {l: i for i, l in enumerate(plan.lotes())}
    plan.filas.sort(key=lambda f: (0 if f.lote == LOTE_ARCHIVOS else 1, orden[f.lote], f.orden))


def instalar(plan, pool: Optional[P.Pool] = None) -> Banco:
    return Banco(plan, pool)
