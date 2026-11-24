"""Festivales HISTÓRICOS sintéticos, publicados y sin reclamar (los administra la entidad institucional), con nombres pensados para demostrar coincidencias.

Convención de claves estables: `n1.historico.<alias>` (la fila es un festival; el prefijo indica que es un histórico para recorridos de reclamación).
Escenarios (véase LEEME.md): clara, parcial, varios candidatos, ninguna.
"""
from __future__ import annotations

HISTORICOS = [
    # Varios candidatos: tres históricos de nombres casi idénticos + el festival activo «Festival Cuerdas del Páramo» (Duitama).
    dict(clave="encuentro-de-cuerdas-del-paramo", nombre="Encuentro de Cuerdas del Páramo", muni="15001", nivel=1, escenario="varios-candidatos",
         organizador="Estudiantina Universitaria de Tunja (según registros históricos)", practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales"], periodicidad="anual",
         desc=("Encuentro de estudiantinas y duetos de cuerdas que se celebró en Tunja a comienzos de la década pasada. Reunía cada año a ocho o diez agrupaciones de la ciudad y de provincia en un auditorio universitario, con un concierto final de tiples y bandolas. "
               "Durante varios años fue una de las pocas citas regulares de música de cuerdas en la capital boyacense y dejó un archivo de programas impresos que hoy se conserva en una biblioteca de la ciudad."),
         ediciones=[(2011, "Auditorio universitario de Tunja"), (2012, "Auditorio universitario de Tunja"), (2014, "Teatro de la Casa de la Cultura de Tunja")]),
    dict(clave="festival-de-cuerdas-y-paramo", nombre="Festival de Cuerdas y Páramo", muni="15407", nivel=1, escenario="varios-candidatos",
         organizador="Junta cultural de Villa de Leyva (según registros históricos)", practicas=["musicas-campesinas-rurales-y-de-raiz-territorial"], periodicidad="anual",
         desc=("Festival de pueblo que ofrecía conciertos de cuerdas en la plaza mayor durante un fin de semana de agosto. Se recuerda por sus tardes de duetos y por las clases abiertas de requinto que ofrecía a los visitantes. "
               "Dejó de realizarse cuando la junta cultural que lo organizaba pasó su responsabilidad a otras actividades de temporada turística."),
         ediciones=[(2010, "Plaza mayor de Villa de Leyva"), (2013, "Plaza mayor de Villa de Leyva")]),
    dict(clave="muestra-cuerdas-del-paramo", nombre="Muestra Cuerdas del Páramo", muni="15759", nivel=3, escenario="varios-candidatos",
         organizador="Casa de la Cultura de Sogamoso (según registros históricos)", practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales"], periodicidad="anual",
         desc=("Pequeña muestra de estudiantinas y duetos organizada por la casa de cultura de Sogamoso. Se celebraba en un salón comunal y daba espacio a los grupos de las veredas cercanas que no tenían otra oportunidad de presentarse en el pueblo."),
         ediciones=[(2015, "Salón comunal de Sogamoso")]),
    # Coincidencia clara: un único candidato con nombre muy parecido a «Festival de Gaitas del Alto Sinú».
    dict(clave="festival-de-gaitas-del-alto-sinu", nombre="Festival de Gaitas del Alto Sinú", muni="23807", nivel=1, escenario="clara",
         organizador="Asociación de Gaiteros del Alto Sinú (según registros históricos)", practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-campesinas-rurales-y-de-raiz-territorial"], periodicidad="anual",
         desc=("Festival de gaitas largas y cortas que se celebró varios años en Tierralta, con grupos de la zona del Alto Sinú y de veredas ribereñas. Incluía un concurso de composición, una noche de cumbia y un taller de elaboración de gaitas con maestros constructores. "
               "Los registros que se conservan muestran grupos de entre ocho y doce integrantes, con una participación significativa de jóvenes. La ficha se mantiene en la plataforma como referencia histórica para que la organización que lo produjo pueda reclamar su administración."),
         ediciones=[(2013, "Parque principal de Tierralta"), (2014, "Parque principal de Tierralta"), (2016, "Coliseo de Tierralta")]),
    # Coincidencia parcial: «Festival de Bandas de Tenza» (Guateque) frente a este nombre, que comparte territorio y práctica pero no el nombre completo.
    dict(clave="encuentro-de-bandas-del-valle-de-tenza", nombre="Encuentro de Bandas del Valle de Tenza", muni="15299", nivel=1, escenario="parcial",
         organizador="Escuela de Bandas de Garagoa (según registros históricos)", practicas=["musicas-sinfonicas-bandas-orquestas-y-grandes-formatos-instrumentales"], periodicidad="anual",
         desc=("Encuentro de bandas de música de los municipios del Valle de Tenza, celebrado en Garagoa con desfile inaugural, conciertos en el parque y un intercambio de directores. Participaban entre seis y nueve bandas de pueblo, algunas con más de cuarenta integrantes. "
               "El encuentro terminó cuando la escuela de bandas que lo producía redujo su plantilla, pero sus programas y afiches siguen siendo referencia de la vida musical de la región."),
         ediciones=[(2012, "Parque principal de Garagoa"), (2013, "Parque principal de Garagoa")]),
    # Sin ningún parecido: útil como «ninguna coincidencia».
    dict(clave="reunion-de-marimberos-del-micay", nombre="Reunión de Marimberos del Micay", muni="19418", nivel=3, escenario="ninguna",
         organizador="Cabildo de marimberos del río Micay (según registros históricos)", practicas=["musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras"], periodicidad="intermitente",
         desc=("Reunión de marimberos y cantadoras de las comunidades del río Micay que se hizo en dos ocasiones, con una jornada de ensayos abiertos y una noche de arrullos. Los registros indican que fue una iniciativa de las propias comunidades, sin respaldo institucional estable."),
         ediciones=[(2017, "Casa comunal de López de Micay")]),
    dict(clave="encuentro-de-trova-y-parranda-de-jerico", nombre="Encuentro de Trova y Parranda de Jericó", muni="05368", nivel=3, escenario="ninguna",
         organizador="Casa de la Cultura de Jericó (según registros históricos)", practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-vocales-corales-y-de-tradicion-cantada"], periodicidad="anual",
         desc=("Encuentro de troveros y grupos de parranda que se celebraba en Jericó durante el puente de diciembre. Los troveros improvisaban versos en la plaza y las parrandas recorrían las calles hasta la madrugada."),
         ediciones=[(2008, "Plaza principal de Jericó"), (2009, "Plaza principal de Jericó"), (2010, "Plaza principal de Jericó")]),
]
