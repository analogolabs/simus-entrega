"""Festivales y mercados REALES del libro: SOLO hechos verificados en los datos públicos (siembra-integral/datos/*.json con sus fuentes).

Cada texto está escrito con palabras propias a partir de esos hechos; no se atribuye a nadie nada que la fuente no diga. Los festivales entran como
históricos publicados y sin reclamar (los administra la entidad institucional); la programación, participantes y noticias de demostración NO se
asocian a ellos. `max_ediciones=None` = todas las ediciones documentadas. `excluir` = años cuyo hecho no es una edición (una ley, un acuerdo).
"""
from __future__ import annotations

FESTIVALES = {
    "rock-al-parque": dict(
        max_ediciones=None, excluir=(), numeros={1995: 1}, periodicidad="anual",
        descripcion=("Rock al Parque es un festival gratuito y al aire libre de rock y géneros cercanos, como punk, metal, reggae, ska y blues, que forma parte de la serie Festivales al Parque del Instituto Distrital de las Artes de Bogotá. "
                     "Nació en 1995 con la intención de dar escenario a las bandas locales y de ofrecer a la juventud un espacio de encuentro y convivencia.\n\n"
                     "Su primera edición se realizó del 26 al 29 de mayo de 1995 en cuatro lugares de la ciudad: La Media Torta, el Parque Simón Bolívar, el Parque Estadio Olaya Herrera y la Plaza de Toros La Santamaría. "
                     "Desde 1998 se dejó de usar el escenario de la plaza de toros; en 2001 la programación pasó por los parques El Tunal y El Renacimiento, y desde finales de la década de 2000 el festival se concentra en el Parque Metropolitano Simón Bolívar. "
                     "La época del año ha cambiado con frecuencia: mayo, octubre y noviembre, junio a agosto o noviembre, según el momento.\n\n"
                     "La fuente consultada documenta ediciones entre 1995 y 2026, con vacíos en 1997 y en 2020 y 2021, años en que se suspendió por la pandemia de COVID-19; la de 2022 se extendió a cuatro días, repartidos entre noviembre y diciembre. "
                     "La fecha de 2026 (10 al 12 de octubre) corresponde a lo anunciado y no está contrastada en un sitio oficial.")),
    "festival-de-musica-del-pacifico-petronio-alvarez": dict(
        max_ediciones=None, excluir=(2009,), numeros={2024: 28}, numero_ediciones=28, territorio="marimba", periodicidad="anual",
        descripcion=("El Festival de Música del Pacífico Petronio Álvarez rinde homenaje al compositor que le da nombre y reúne en Cali a las músicas del Pacífico colombiano, tanto del sur como del norte. "
                     "Funciona como concurso con categorías de marimba, chirimía, violín caucano y libre, y su premio principal es el Bombo Golpeador.\n\n"
                     "Según la Alcaldía de Cali, la primera edición se realizó el 9 de agosto de 1997 en el Teatro al Aire Libre Los Cristales; un artículo de opinión ubica el origen en 1996, discrepancia que se mantiene señalada. "
                     "En 2009, el Acuerdo 267 del Concejo Municipal incluyó el festival en el calendario cultural y turístico de la ciudad. "
                     "La Alcaldía registra la edición XXVIII en 2024, con entrega del Bombo Golpeador, y nuevos ganadores en 2025. Lo organiza la Secretaría de Cultura de Cali y se celebra cada año, por lo general en agosto, aunque las fechas exactas de cada edición están por verificar.")),
    "barranquijazz": dict(
        max_ediciones=None, excluir=(), numeros={}, periodicidad="anual",
        descripcion=("Barranquijazz es el festival de jazz de Barranquilla, organizado por la Fundación Cultural Nueva Música con apoyo de la Alcaldía Distrital, la Gobernación del Atlántico y el Ministerio de Cultura. "
                     "Su gala inaugural tuvo lugar el 9 de septiembre de 1997 en el Teatro Amira de la Rosa.\n\n"
                     "El festival se celebra por lo general en septiembre. Según El Heraldo, en 2021 se conmemoraron veinticinco años del festival, con una programación que abrió con talento nacional, y en septiembre de 2024 su apertura se hizo en La Cueva, el emblemático bar de la ciudad. "
                     "No se confirmó el nombre jurídico de la organización más allá de la Fundación Cultural Nueva Música, y los datos de ediciones intermedias quedan pendientes de documentar.")),
    "festival-nacional-de-la-musica-colombiana": dict(
        max_ediciones=None, excluir=(2003,), numeros={1987: 1, 2025: 39, 2026: 40}, numero_ediciones=40, realizadas=(2026,), periodicidad="anual",
        descripcion=("El Festival Nacional de la Música Colombiana de Ibagué nació en 1987 como un homenaje nacional al dueto Garzón y Collazos. Su primera edición se abrió el 21 de marzo de ese año con una serenata inicial en el cementerio San Bonifacio de Ibagué.\n\n"
                     "Desde entonces se celebra cada año en torno al 21 de marzo, fecha del día nacional de la música colombiana, y reúne música andina colombiana, bambuco, pasillo y duetos. "
                     "La Ley 851 de 2003 lo declaró patrimonio cultural y artístico de la Nación. Las fuentes consultadas numeran como edición 39 la de 2025 y como edición 40 la de 2026. "
                     "Lo organiza la Fundación Musical de Colombia.")),
    "festival-nacional-de-gaitas-francisco-llirene": dict(
        max_ediciones=None, excluir=(), numeros={1985: 1, 2024: 40}, numero_ediciones=40, territorio="cantos-pitos-y-tambores", periodicidad="anual",
        descripcion=("El Festival Nacional de Gaitas Francisco Llirene se celebra en Ovejas, en los Montes de María del departamento de Sucre, y reúne a grupos de música de gaitas. "
                     "Su primera edición se realizó el 5 de septiembre de 1985 con diez grupos en dos categorías, según la reseña histórica de Radio Nacional de Colombia.\n\n"
                     "En octubre de 2024 se celebró la edición número cuarenta, que según El Heraldo llevó las gaitas por las calles de Ovejas. El festival fue declarado patrimonio inmaterial de la Nación en 2015. "
                     "Lo organiza una junta organizadora con apoyo del Fondo Mixto de Promoción de la Cultura y las Artes de Sucre. Las fuentes presentan una discrepancia en la numeración de 2021 (edición 36 o 37) que se deja anotada.")),
    "festival-cuna-de-acordeones": dict(
        max_ediciones=None, excluir=(2006,), numeros={2017: 39}, numero_ediciones=39, periodicidad="anual",
        descripcion=("El Festival Cuna de Acordeones es el festival vallenato de Villanueva, en La Guajira. Se celebra en septiembre y fue declarado Patrimonio Cultural y Artístico de la Nación por la Ley 1052 de 2006.\n\n"
                     "La primera edición, según las fuentes consultadas, tuvo lugar en 1979, y en septiembre de 2017 se reseñó como edición 39. Lo organiza la Fundación Festival Cuna de Acordeones. "
                     "El sitio oficial que cita Wikipedia no pudo verificarse, de modo que los datos de cada edición se limitan a los que traen las fuentes periodísticas y legales enlazadas en la ficha.")),
}

MERCADOS = {
    "circulart": dict(
        excluir=(2021,), numeros={2026: 17}, practicas=["musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales", "musicas-urbanas-alternativas-e-independientes", "musicas-populares-tradicionales-regionales-y-patrimoniales"],
        descripcion=("Circulart es el mercado de las músicas de Iberoamérica que se realiza en Medellín. Combina ruedas de negocios, presentaciones en vivo (showcases) y charlas, y según las fuentes nació a raíz de la Cumbre Iberoamericana de Cultura. "
                     "Cuenta con el apoyo de la Alcaldía de Medellín, a través de la Secretaría de Cultura Ciudadana, aunque no está aclarada la relación jurídica entre las dos partes.\n\n"
                     "En 2020 se realizó una edición digital con unas cincuenta presentaciones y más de ciento setenta representantes. En 2021 hubo una alianza con el Bogotá Music Market (BOmm). La edición 17 se celebró del 4 al 7 de junio de 2026 en Medellín, con conciertos gratuitos. "
                     "Suele organizarse en junio, aunque en 2023 se hizo en noviembre. No se conoce con certeza el año de la primera edición; la numeración sugiere 2009 o 2010, pero no está verificado."),
        ),
    "bogota-music-market-bomm": dict(
        excluir=(2021, 2023), numeros={2025: 14, 2026: 15}, realizadas=(2026,), practicas=["musicas-urbanas-alternativas-e-independientes", "musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales"],
        descripcion=("El Bogotá Music Market (BOmm) es el mercado musical de la Cámara de Comercio de Bogotá, creado para profesionalizar el sector con presentaciones en vivo, citas de negocio y una convocatoria abierta a artistas. Trabaja con aliados como el Instituto Distrital de las Artes (Idartes).\n\n"
                     "Las fuentes ubican la primera edición en 2012. En 2021 hubo una alianza con Circulart, y en 2023 se lanzó Ventana, un componente de enfoque territorial. La edición 14 se celebró del 9 al 12 de septiembre de 2025 en Bogotá. "
                     "En 2026, año de la edición 15, la Cámara abrió por primera vez su convocatoria a proyectos internacionales y reportó 160 proyectos de 18 países (114 colombianos y 46 internacionales). "
                     "No se encontró la nota de prensa de la primera edición, y el año 2012 se respalda en la numeración y en un artículo de Semana.")),
    "mercado-cultural-del-caribe": dict(
        excluir=(), numeros={2013: 6}, practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical"],
        descripcion=("El Mercado Cultural del Caribe es una plataforma de formación, circulación y memoria de las músicas del Caribe colombiano, con presentaciones, ruedas de negocios y talleres. Se realiza en Cartagena de Indias, y sus talleres se han desarrollado con la Universidad Tecnológica de Bolívar.\n\n"
                     "Según El Heraldo, en 2013 se reseñó su sexta edición. En 2026, El Universal informó sobre su realización en septiembre. No se verificó el año de la primera edición, y la ficha conserva por eso un nivel de certeza medio respecto de las demás.")),
}
