"""Libro del tema `contenido`: noticias, agenda, campañas transversales y marcas del catálogo editorial.

Todo lo de aquí es inventado salvo lo citado como público (el acervo editorial, que ya vive en la base y solo se marca). Las entidades que
aparecen (organizaciones, festivales, mercados, talleres, espacios, redes y personas) son las SINTÉTICAS del universo del libro; ver LEEME.md.
"""
from .comunes import PRACTICAS  # noqa: F401
from .campanas import CAMPANAS  # noqa: F401
from .noticias_a import NOTICIAS_A
from .noticias_b import NOTICIAS_B
from .noticias_c import NOTICIAS_C
from .eventos_celebra import EVENTOS_CELEBRA
from .eventos_campanas import EVENTOS_CAMPANAS
from .eventos_otros import EVENTOS_OTROS
from .editorial import EDITORIAL_N1, EDITORIAL_FUENTE  # noqa: F401

NOTICIAS = NOTICIAS_A + NOTICIAS_B + NOTICIAS_C
EVENTOS = EVENTOS_CELEBRA + EVENTOS_CAMPANAS + EVENTOS_OTROS

# Fechas de las ediciones de la muestra que las noticias y la agenda dan por ciertas: el generador las usa en lugar de las fechas derivadas al azar
# (clave `(alias del proceso, año)`; `(None, None)` = sin fechas definitivas). Reconciliado con el libro de festivales: ninguna de estas
# entidades existe en él (la muestra y el libro no comparten procesos), así que no hay otra fuente de fechas que contradiga a las noticias.
import datetime as _dt
_d = _dt.date
FECHAS_DE_EDICION = {
    ("festival.encuentro-de-chirimia-del-san-juan", 2024): (_d(2024, 6, 13), _d(2024, 6, 15)),
    ("festival.encuentro-de-chirimia-del-san-juan", 2025): (_d(2025, 7, 17), _d(2025, 7, 19)),
    ("festival.encuentro-de-chirimia-del-san-juan", 2027): (_d(2027, 6, 11), _d(2027, 6, 13)),
    ("festival.festival-de-marimba-de-la-ensenada", 2024): (_d(2024, 7, 11), _d(2024, 7, 14)),
    ("festival.festival-de-marimba-de-la-ensenada", 2025): (_d(2025, 7, 10), _d(2025, 7, 13)),
    ("festival.gran-rueda-de-bullerengue", 2025): (_d(2025, 4, 3), _d(2025, 4, 5)),
    ("festival.encuentro-andino-electronico", 2026): (None, None),
    ("mercado.rueda-de-negocios-caribe-sonoro", 2024): (_d(2024, 9, 5), _d(2024, 9, 6)),
    ("mercado.rueda-de-negocios-caribe-sonoro", 2025): (_d(2025, 11, 21), _d(2025, 11, 22)),
    ("mercado.rueda-de-negocios-caribe-sonoro", 2027): (_d(2027, 3, 18), _d(2027, 3, 19)),
    ("mercado.mercado-de-musicas-del-pacifico-sur", 2027): (None, None),
}
