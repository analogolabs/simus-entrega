"""Fichas descriptivas BREVES de los territorios sonoros y las prácticas musicales del libro de siembra.

REGLAS. Solo definiciones generales y verificables a partir del propio nombre del catálogo: nada de cifras, fechas, nombres de
personas ni afirmaciones que haya que documentar. Todas se siembran con la marca «Definición preliminar»: son un punto de
partida para que el equipo del PNMC las revise y las amplíe desde la sección «Catálogos» de la consola. Los territorios que ya
tienen descripción institucional (migración V20260908_03) no se tocan aquí.

SEPARADO DE LOS DATOS DEL ECOSISTEMA: el generador de la demo trata los catálogos como intactos; esta pieza solo completa fichas
vacías con `aplicar_fichas_catalogos.py`.
"""
from __future__ import annotations

# slug → definición breve (≤ 800 caracteres)
PRACTICAS: dict[str, str] = {
    "expresiones-sonoras-de-pueblos-originarios": "Expresiones sonoras y musicales propias de los pueblos originarios, ligadas a sus cosmovisiones, lenguas, rituales y formas comunitarias de transmisión.",
    "musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras": "Músicas creadas y sostenidas por comunidades negras, afrocolombianas, raizales y palenqueras, con tradiciones propias de canto, percusión y baile que se transmiten en la comunidad.",
    "musicas-campesinas-rurales-y-de-raiz-territorial": "Músicas de los contextos rurales y campesinos, arraigadas en un territorio y en sus formas de vida, que se practican y se transmiten en el ámbito local.",
    "musicas-populares-tradicionales-regionales-y-patrimoniales": "Músicas populares de tradición regional que una comunidad reconoce como parte de su patrimonio y mantiene viva a lo largo del tiempo.",
    "musicas-comunitarias-y-procesos-colectivos-de-practica-musical": "Prácticas musicales que se construyen en colectivo —en la escuela, el barrio o la organización social— como espacio de encuentro, formación y participación.",
    "musicas-de-frontera-diasporas-migraciones-e-interculturalidad": "Músicas que nacen o se transforman en el cruce de fronteras, migraciones y diásporas, y en el diálogo entre culturas.",
    "musicas-urbanas-alternativas-e-independientes": "Músicas de la escena urbana, alternativa e independiente, con frecuencia gestionadas por los propios artistas y colectivos fuera de los circuitos comerciales de mayor escala.",
    "musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales": "Músicas populares de amplia circulación, como las tropicales y bailables, que llegan a públicos numerosos por los medios y los circuitos comerciales.",
    "musicas-vocales-corales-y-de-tradicion-cantada": "Prácticas centradas en la voz: coros, ensambles vocales y tradiciones de canto, con o sin acompañamiento instrumental.",
    "musicas-sinfonicas-bandas-orquestas-y-grandes-formatos-instrumentales": "Músicas interpretadas por agrupaciones numerosas de instrumentos, como orquestas sinfónicas, bandas y otros grandes formatos.",
    "bandas-de-marcha-batucadas-comparsas-y-colectivos-sonoros-en-movimiento": "Colectivos que hacen música en movimiento —en desfiles, carnavales y calles—, como bandas de marcha, batucadas y comparsas.",
    "musicas-academicas-de-camara-contemporaneas-experimentales-y-de-vanguardia": "Músicas de formación académica y de concierto, de cámara, contemporáneas y experimentales, que exploran nuevas formas de composición e interpretación.",
    "musicas-electronicas-digitales-produccion-sonora-y-nuevas-tecnologias": "Músicas y prácticas de producción sonora que usan medios electrónicos y digitales como parte central de la creación.",
    "musicas-religiosas-rituales-espirituales-y-devocionales": "Músicas ligadas a celebraciones religiosas, rituales y devociones, que acompañan prácticas espirituales de una comunidad.",
    "musicas-para-escena-danza-audiovisual-e-interdisciplinariedad": "Músicas creadas para dialogar con otras artes: teatro, danza, cine y medios audiovisuales.",
    "practicas-sonoras-arte-sonoro-archivo-investigacion-creacion-y-paisajes-sonoros": "Prácticas que trabajan con el sonido como material de creación, archivo e investigación, incluidos el arte sonoro y los paisajes sonoros.",
}

# Los territorios sin descripción institucional en V20260908_03. No se afirma su extensión geográfica.
TERRITORIOS: dict[str, str] = {
    "practicas-de-pueblos-indigenas": "Territorio sonoro que reúne las prácticas musicales de los pueblos indígenas del país.",
    "muai": "Territorio sonoro de las Músicas Urbanas, Alternativas e Independientes (MUAI).",
    "comunidades-academicas": "Territorio sonoro de las comunidades académicas, vinculadas a la formación y la investigación musical.",
    "rrom": "Territorio sonoro del pueblo Rrom (gitano) y sus prácticas musicales.",
}
