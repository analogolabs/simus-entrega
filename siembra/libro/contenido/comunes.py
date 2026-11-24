"""Atajos de catálogo compartidos por las noticias y la agenda (los valores son los del catálogo real de SIMUS)."""
PRACTICAS = {
    "afro": "musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras",
    "bandas": "musicas-sinfonicas-bandas-orquestas-y-grandes-formatos-instrumentales",
    "indigena": "expresiones-sonoras-de-pueblos-originarios",
    "electro": "musicas-electronicas-digitales-produccion-sonora-y-nuevas-tecnologias",
    "trad": "musicas-populares-tradicionales-regionales-y-patrimoniales",
    "vocal": "musicas-vocales-corales-y-de-tradicion-cantada",
    "campesina": "musicas-campesinas-rurales-y-de-raiz-territorial",
    "comunitaria": "musicas-comunitarias-y-procesos-colectivos-de-practica-musical",
    "frontera": "musicas-de-frontera-diasporas-migraciones-e-interculturalidad",
    "popular": "musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales",
    "urbanas": "musicas-urbanas-alternativas-e-independientes",
    "sonoras": "practicas-sonoras-arte-sonoro-archivo-investigacion-creacion-y-paisajes-sonoros",
    "academica": "musicas-academicas-de-camara-contemporaneas-experimentales-y-de-vanguardia",
    "religiosa": "musicas-religiosas-rituales-espirituales-y-devocionales",
    "escena": "musicas-para-escena-danza-audiovisual-e-interdisciplinariedad",
    "marcha": "bandas-de-marcha-batucadas-comparsas-y-colectivos-sonoros-en-movimiento",
}

# Autoría de las noticias (periodistas y equipos inventados; no son cuentas del sistema).
LUZ_MARINA = "Luz Marina Ospina Duque"
JULIAN = "Julián David Camacho Rueda"
NATALIA = "Natalia Cifuentes Barrios"
HERNAN = "Hernán Darío Valencia Ortiz"
PAOLA = "Paola Andrea Villamizar Soto"
OSCAR = "Óscar Eduardo Palacio Mena"
REDACCION = "Redacción SIMUS"

# Etiqueta paraguas de la edición de Celebra la música (la misma que usa la siembra oficial) y hashtags de las campañas sintéticas.
CELEBRA = "celebra la música"
H_SABERES = "#SaberesSonoros"
H_FRONTERA = "#SonidosDeFrontera"
H_MEMORIA = "#MemoriaVivaDelCanto"
H_ESCENARIOS = "#EscenariosAbiertos"


def P(*parrafos: str) -> str:
    """Une los párrafos de una nota con una línea en blanco."""
    return "\n\n".join(p.strip() for p in parrafos)
