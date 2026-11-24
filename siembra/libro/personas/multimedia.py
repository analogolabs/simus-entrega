"""Referencias multimedia por alias de las personas y organizaciones N1 (el agente de multimedia las resuelve contra su manifiesto).

Alias: `persona.<clave>.foto|galeria`, `org.<clave>.logo`, `org.<clave>.doc.<slug>`. Las organizaciones no llevan portada ni galería: `ArchivosDeRegistro` no admite el módulo de entidades (ver `siembra/docs/integracion.md`). Todas llevan texto alternativo."""
from .organizaciones import ORGANIZACIONES
from .perfiles import PERFILES


def referencias() -> list:
    out = []
    for p in PERFILES:
        for rol, alt in p["multimedia"]:
            out.append(dict(alias=f"persona.{p['clave']}.{rol}", tipo="imagen", rol=rol, alt=alt, destino="PerfilesPublicos.ArchivoFotoId" if rol == "foto" else "galeria"))
    for o in ORGANIZACIONES:
        for rol, alt in o["multimedia"]:
            out.append(dict(alias=f"org.{o['clave']}.{rol}", tipo="imagen", rol=rol, alt=alt, destino="Entidades.ArchivoFotoId"))
        for slug, titulo, formato in o["documentos"]:
            out.append(dict(alias=f"org.{o['clave']}.doc.{slug}", tipo=formato, rol="documento", alt=titulo, destino="Archivos.OrganizacionId"))
    return out
