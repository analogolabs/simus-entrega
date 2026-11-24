"""Enlaces de video (YouTube) de la siembra: `vid.demo.NN` → URL. Son videos públicos de canales institucionales (Ministerio de las Culturas, Plan Nacional
de Música para la Convivencia…), verificados con oEmbed (columna `verificacion`). Úsense en campos de enlace (`Url` de ArchivosDeRegistro,
`PerfilesPublicosEnlaces`, `OtroEnlace`…): `videos.url("vid.demo.03")` o `videos.de_clave("n1-festival-x", 2)` para elegir de forma estable."""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comun as C

_cache: dict = {}


def todos() -> dict:
    if not _cache:
        with C.VIDEOS.open(encoding="utf-8", newline="") as f:
            for fila in csv.DictReader(f):
                _cache[fila["alias"]] = fila
    return _cache


def url(alias: str) -> str:
    return todos()[alias]["url"]


def titulo(alias: str) -> str:
    return todos()[alias]["titulo"]


def de_clave(clave: str, k: int = 0) -> str:
    """Alias de video estable para una clave cualquiera (el k-ésimo distinto)."""
    alias = sorted(todos())
    return alias[(C.semilla_de(clave) + k) % len(alias)]
