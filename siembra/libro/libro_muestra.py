"""Libro de personajes y narrativas SINTÉTICO (muestra mínima).

Todo lo de aquí es inventado: nombres de personas y organizaciones que no imitan a nadie real, correos `.test`, teléfonos de rango
ficticio. Sirve de plantilla del libro definitivo (N1: ~25–30 fichas profundas; N2/N3 salen de combinaciones del generador).
Cada ficha de N1 debe poder escribirse aquí con todos los campos; el generador solo las traduce a filas.

Convenciones: `muni` es el código DIVIPOLA de 5 dígitos (el generador lo valida contra el catálogo); `dep` son sus dos primeros dígitos.
"""
from __future__ import annotations

PERSONAS = [
    dict(clave="marisol-quiceno", nombre=("Marisol", "Quiceno", "Arango"), muni="05001", doc="cc", oficio="cantadora y compositora",
         corta="Cantadora y compositora antioqueña; trabaja el torbellino y la trova con escuelas de música de barrio.",
         larga="Marisol creció entre fogones y radios de pilas en el oriente antioqueño. Aprendió el torbellino de su abuela y a los dieciséis ya acompañaba novenas con tiple prestado. "
               "Desde 2012 dirige un proceso de formación con niñas y niños en comunas de Medellín, donde combina cantos de trabajo con arreglos corales. "
               "Ha grabado dos producciones independientes y coordina encuentros de cantadoras. Cree que la memoria sonora se cuida cantándola, no guardándola."),
    dict(clave="ismael-cuesta", nombre=("Ismael", "Cuesta", "Mosquera"), muni="27001", doc="cc", oficio="percusionista y maestro de marimba",
         corta="Maestro de marimba y percusiones del Pacífico chocoano; forma jóvenes en su barrio de Quibdó.",
         larga="Ismael aprendió a tocar el bombo y el cununo en las fiestas patronales de su barrio. Hoy enseña marimba de chonta y construcción de instrumentos a veinte jóvenes cada año, "
               "y ha acompañado agrupaciones en giras por el Pacífico y el interior. Defiende que el aprendizaje comunitario debe tener maestros reconocidos y pagos justos."),
    dict(clave="yurani-rojas", nombre=("Yurani", "Rojas", "Pinzón"), muni="50001", doc="cc", oficio="arpista y gestora cultural",
         corta="Arpista llanera y gestora de encuentros de joropo en el piedemonte del Meta.",
         larga="Arpista desde los doce años, Yurani estudió música en Villavicencio y regresó a trabajar con escuelas rurales de arpa. Organiza un encuentro anual de arpistas jóvenes "
               "y mantiene un archivo de grabaciones de campo con maestros mayores. Le interesa que el joropo dialogue con otras músicas sin perder su pulso."),
    dict(clave="andres-felipe-bonilla", nombre=("Andrés Felipe", "Bonilla", "Ibarra"), muni="52001", doc="cc", oficio="productor y DJ de músicas electrónicas andinas",
         corta="Productor y DJ de Pasto; mezcla sonidos andinos con electrónica en sesiones comunitarias.",
         larga="Andrés Felipe empezó grabando carnavales con una grabadora de cassette y hoy produce piezas que cruzan flautas de pan con ritmos electrónicos. "
               "Coordina laboratorios de producción sonora para jóvenes de barrios periféricos y lleva una sesión mensual en una casa cultural del centro."),
    dict(clave="luz-dary-mercado", nombre=("Luz Dary", "Mercado", "Padilla"), muni="08001", doc="cc", oficio="cantante de bullerengue y docente",
         corta="Cantante de bullerengue y docente de música en colegios del Atlántico.",
         larga="Luz Dary lidera un grupo de mujeres que mantiene viva la tradición del bullerengue sentado en el sur del Atlántico. Combina su trabajo en aula con presentaciones en festivales regionales "
               "y talleres de tambor alegre. Documenta con su colectivo letras y versos que corren el riesgo de perderse."),
    dict(clave="camilo-arenas", nombre=("Camilo", "Arenas", "Vélez"), muni="63001", doc="cc", oficio="luthier y guitarrista",
         corta="Luthier de guitarras y tiples en Armenia; restaura instrumentos tradicionales para escuelas.",
         larga="Camilo aprendió ebanistería con su padre y luego se especializó en lutería de cuerdas. Su taller restaura instrumentos para escuelas de música de varios municipios "
               "y recibe aprendices cada semestre. Mantiene un registro fotográfico de cada restauración para quien quiera aprender el oficio."),
    dict(clave="aracely-tapias", nombre=("Aracely", "Tapias", "Cardona"), muni="94001", doc="cc", oficio="investigadora de músicas amazónicas",
         corta="Investigadora y cantante; acompaña a procesos de pueblos indígenas del Guainía en registro de cantos.",
         larga="Aracely trabaja con familias del Guainía en el registro de cantos de ceremonia y de trabajo, siempre con acuerdos de uso definidos por las propias comunidades. "
               "Ha publicado artículos de divulgación y facilita talleres sobre propiedad colectiva del conocimiento sonoro."),
    dict(clave="wilson-gamboa", nombre=("Wilson", "Gamboa", "Salcedo"), muni="68001", doc="cc", oficio="director de banda sinfónica",
         corta="Director de bandas sinfónicas juveniles en Santander; formador de directores.",
         larga="Wilson dirige una banda juvenil con cuarenta integrantes y forma directores de pueblos pequeños que quieren fundar la suya. Ha impulsado intercambios entre bandas de Santander y Boyacá. "
               "Sus ensayos abiertos se han vuelto un punto de encuentro de familias."),
    dict(clave="daniela-cassiani", nombre=("Daniela", "Cassiani", "Berrío"), muni="13001", doc="cc", oficio="productora de eventos y periodista cultural",
         corta="Periodista cultural y productora de ruedas de negocios para músicas del Caribe.",
         larga="Daniela cubre festivales del Caribe desde hace una década y produce encuentros de programadores y agrupaciones emergentes. "
               "Mantiene un boletín quincenal con convocatorias y tiene especial interés en que las agrupaciones pequeñas lleguen preparadas a una rueda de negocios."),
    dict(clave="sergio-quintero", nombre=("Sergio", "Quintero", "Lozano"), muni="76001", doc="cc", oficio="trombonista y arreglista de salsa",
         corta="Trombonista y arreglista caleño; dirige una orquesta escuela de salsa.",
         larga="Sergio dirige una orquesta escuela donde jóvenes aprenden arreglos de salsa clásica y piezas propias. Ha viajado como invitado a festivales y da clínicas de metales. "
               "Sostiene que la escuela es el mejor escenario para un género que nació en la calle."),
]

ORGANIZACIONES = [
    dict(clave="corp-raiz-y-tambor", nombre="Corporación Raíz y Tambor", tipo="Comunitario", muni="27001", estado="activa", admin="ismael-cuesta", editor="marisol-quiceno",
         desc="Organización comunitaria de Quibdó dedicada a la formación en marimba, cununo y canto del Pacífico para jóvenes de barrios periféricos; mantiene un taller de construcción de instrumentos y un ciclo de encuentros de cantadoras."),
    dict(clave="fund-voces-del-llano", nombre="Fundación Voces del Llano", tipo="Fundación", muni="50001", estado="activa", admin="yurani-rojas", editor=None,
         desc="Fundación que reúne arpistas, cuatristas y cantantes llaneros; organiza un encuentro anual de joropo joven y mantiene un archivo sonoro de maestros mayores del piedemonte."),
    dict(clave="colectivo-sonidos-del-sur", nombre="Colectivo Sonidos del Sur", tipo="Comunitario", muni="52001", estado="activa", admin="andres-felipe-bonilla", editor=None,
         desc="Colectivo de productores y músicos de Pasto que cruza flautas andinas y electrónica; ofrece laboratorios de producción sonora y una sesión mensual abierta."),
    dict(clave="asoc-bullerengue-vivo", nombre="Asociación Bullerengue Vivo", tipo="Comunitario", muni="08001", estado="activa", admin="luz-dary-mercado", editor=None,
         desc="Asociación de mujeres cantadoras del sur del Atlántico que preserva el bullerengue sentado y organiza talleres de tambor alegre en colegios."),
    dict(clave="taller-cuerdas-del-eje", nombre="Taller Cuerdas del Eje", tipo="Otro", muni="63001", estado="activa", admin="camilo-arenas", editor=None,
         desc="Taller de lutería de cuerdas con sede en Armenia: restaura guitarras, tiples y bandolas para escuelas de música y recibe aprendices cada semestre."),
    dict(clave="casa-de-la-musica-inirida", nombre="Casa de la Música de Inírida", tipo="Casa cultural", muni="94001", estado="pendiente_de_confirmacion", admin="aracely-tapias", editor=None,
         desc="Casa cultural recién registrada que acompaña el registro de cantos amazónicos y ofrecerá talleres sobre derechos colectivos del conocimiento sonoro."),
    dict(clave="banda-escuela-santandereana", nombre="Banda Escuela Santandereana", tipo="Entidad pública / Alcaldía", muni="68001", estado="activa", admin="wilson-gamboa", editor=None,
         desc="Programa de bandas sinfónicas juveniles que forma directores y organiza intercambios entre bandas de Santander y Boyacá."),
    dict(clave="agencia-ruta-caribe", nombre="Agencia Ruta Caribe", tipo="Mixto", muni="13001", estado="activa", admin="daniela-cassiani", editor=None,
         desc="Agencia de producción de ruedas de negocios y circulación para agrupaciones emergentes del Caribe, con un boletín quincenal de convocatorias."),
    dict(clave="orquesta-escuela-pacifico", nombre="Orquesta Escuela Pacífico Salsero", tipo="Fundación", muni="76001", estado="inactiva", admin="sergio-quintero", editor=None,
         desc="Orquesta escuela de salsa y metales de Cali; suspendió actividades por reestructuración y conserva su ficha para la memoria del proceso."),
    dict(clave="red-cantos-de-trabajo", nombre="Red Cantos de Trabajo", tipo="Comunitario", muni="05001", estado="activa", admin="marisol-quiceno", editor=None,
         desc="Red de cantadoras y cantadores de Antioquia que documenta cantos de trabajo y los lleva a escuelas de barrio con apoyo de maestros mayores."),
]

# Festivales ficticios (NO imitan nombres reales). `estado` recorre el circuito; `ediciones` son (año, estado) sembrados.
FESTIVALES = [
    dict(clave="encuentro-de-chirimia-del-san-juan", nombre="Encuentro de Chirimía del San Juan", org="corp-raiz-y-tambor", muni="27001", estado="publicado", periodicidad="anual",
         practicas=["musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras"], territorio="chirimia", director="Ismael Cuesta Mosquera",
         desc="Encuentro de agrupaciones de chirimía y marimba que recorre barrios de Quibdó durante tres noches; combina presentaciones, talleres de construcción de instrumentos y un cabildo de maestros mayores.",
         ediciones=[(2019, "realizada"), (2021, "realizada"), (2022, "realizada"), (2023, "realizada"), (2024, "realizada"), (2025, "realizada"), (2027, "programada")]),
    dict(clave="festival-de-marimba-de-la-ensenada", nombre="Festival de Marimba de la Ensenada", org="colectivo-sonidos-del-sur", muni="52835", estado="publicado", periodicidad="anual",
         practicas=["musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras"], territorio="marimba", director=None,
         desc="Festival costero de marimba y cantos de arrullo con escuelas del litoral nariñense; incluye una muestra de lutería de chonta y un concierto de cierre en la playa.",
         ediciones=[(2024, "realizada"), (2025, "realizada")]),
    dict(clave="encuentro-andino-electronico", nombre="Encuentro Andino Electrónico", org="colectivo-sonidos-del-sur", muni="63001", estado="en_revision", periodicidad="bianual",
         practicas=["musicas-electronicas-digitales-produccion-sonora-y-nuevas-tecnologias"], territorio=None, director=None,
         desc="Laboratorio y muestra de músicas que cruzan instrumentos andinos con producción electrónica; propone residencias de composición y una sesión abierta en la plaza central.",
         ediciones=[(2026, "en_preparacion")]),
    dict(clave="gran-rueda-de-bullerengue", nombre="Gran Rueda de Bullerengue", org="asoc-bullerengue-vivo", muni="08001", estado="ajustes_solicitados", periodicidad="anual",
         practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales"], territorio="cantos-pitos-y-tambores", director="Luz Dary Mercado Padilla",
         desc="Reunión de cantadoras y tamboreras del Caribe en torno al bullerengue sentado; incluye talleres de tambor alegre en colegios y una noche de versos.",
         ediciones=[(2025, "realizada")]),
    dict(clave="muestra-de-bandas-del-oriente", nombre="Muestra de Bandas del Oriente", org="banda-escuela-santandereana", muni="68001", estado="rechazado", periodicidad="anual",
         practicas=["musicas-sinfonicas-bandas-orquestas-y-grandes-formatos-instrumentales"], territorio=None, director=None,
         desc="Muestra de bandas juveniles de Santander y Boyacá con ensayos abiertos y clínicas para directores.", ediciones=[]),
    dict(clave="semana-de-la-guitarra-del-eje", nombre="Semana de la Guitarra del Eje", org="taller-cuerdas-del-eje", muni="63001", estado="archivado", periodicidad="anual",
         practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales"], territorio=None, director=None,
         desc="Semana dedicada a la guitarra y el tiple con conciertos en salas pequeñas y talleres de lutería; hizo tres ediciones antes de cambiar de sede y pausarse.",
         ediciones=[(2018, "realizada"), (2019, "realizada"), (2023, "cancelada")]),
    dict(clave="festival-del-canto-amazonico", nombre="Festival del Canto Amazónico", org="casa-de-la-musica-inirida", muni="94001", estado="borrador", periodicidad="anual",
         practicas=["expresiones-sonoras-de-pueblos-originarios"], territorio="amazonas", director=None,
         desc="Propuesta de festival de cantos de ceremonia y de trabajo con familias del Guainía, bajo acuerdos de uso definidos por cada comunidad.", ediciones=[]),
]

MERCADOS = [
    dict(clave="rueda-de-negocios-caribe-sonoro", nombre="Rueda Caribe Sonoro", org="agencia-ruta-caribe", muni="13001", estado="publicado", alcance="regional", modalidad="presencial",
         desc="Rueda de negocios para agrupaciones emergentes del Caribe: citas de 20 minutos con programadores, showcases y una mesa de asesoría en derechos de autor.",
         ediciones=[(2024, "realizada"), (2025, "realizada"), (2027, "programada")]),
    dict(clave="mercado-de-musicas-del-pacifico-sur", nombre="Mercado de Músicas del Pacífico Sur", org="colectivo-sonidos-del-sur", muni="52001", estado="en_revision", alcance="regional", modalidad="mixta",
         desc="Vitrina de agrupaciones del suroccidente con programadores de festivales y salas; propone una jornada virtual previa para preparar a las agrupaciones.",
         ediciones=[(2027, "en_preparacion")]),
]

REDES = [
    dict(clave="red-de-archivos-sonoros-del-llano", nombre="Red de Archivos Sonoros del Llano", org="fund-voces-del-llano", muni="50001", estado="publicado", tipo="red",
         desc="Red de colecciones de grabaciones de campo de maestros mayores del piedemonte llanero, con acceso abierto a catálogos y copias de preservación."),
    dict(clave="centro-de-documentacion-del-pacifico", nombre="Centro de Documentación Musical del Pacífico", org="corp-raiz-y-tambor", muni="27001", estado="publicado", tipo="centro_de_documentacion",
         desc="Centro que reúne partituras orales, fotografías y entrevistas sobre chirimía y marimba; atiende consultas de investigadores y escuelas."),
    dict(clave="grupo-de-investigacion-cantos-amazonicos", nombre="Grupo de Investigación Cantos Amazónicos", org="casa-de-la-musica-inirida", muni="94001", estado="en_revision", tipo="grupo_de_investigacion",
         desc="Grupo que acompaña el registro de cantos con pueblos amazónicos bajo acuerdos comunitarios de uso del conocimiento."),
    dict(clave="coleccion-de-bandas-santandereanas", nombre="Colección de Bandas Santandereanas", org="banda-escuela-santandereana", muni="68001", estado="ajustes_solicitados", tipo="coleccion",
         desc="Colección de repertorios, programas de mano y fotografías de bandas sinfónicas de Santander desde mediados del siglo XX."),
]

TALLERES = [
    dict(clave="taller-de-tiples-y-guitarras", nombre="Taller de Tiples y Guitarras de Armenia", org="taller-cuerdas-del-eje", muni="63001", estado="publicado", modalidad="fijo",
         desc="Taller de construcción y restauración de tiples, guitarras y bandolas; recibe aprendices cada semestre y repara instrumentos para escuelas."),
    dict(clave="taller-itinerante-de-marimba", nombre="Taller Itinerante de Marimba de Chonta", org="corp-raiz-y-tambor", muni="27001", estado="publicado", modalidad="itinerante",
         desc="Taller que viaja a comunidades del Chocó para enseñar construcción y afinación de marimbas de chonta con maestros constructores."),
    dict(clave="taller-colectivo-de-tambores", nombre="Taller Colectivo de Tambores del Caribe", org="asoc-bullerengue-vivo", muni="08001", estado="borrador", modalidad="colectivo",
         desc="Espacio colectivo de construcción de tambores alegres y llamadores con cueros y maderas de la región."),
]

ESPACIOS = [
    dict(clave="sala-de-ensayo-la-ceiba", nombre="Sala de Ensayo La Ceiba", org="colectivo-sonidos-del-sur", muni="52001", estado="publicado", ambiente="cerrado", aforo=60,
         desc="Sala de ensayo y pequeño concierto con equipo de sonido básico y horario nocturno; sede de la sesión mensual del colectivo."),
    dict(clave="tarima-del-parque-de-los-cantores", nombre="Tarima del Parque de los Cantores", org="fund-voces-del-llano", muni="50001", estado="publicado", ambiente="abierto", aforo=800,
         desc="Tarima municipal al aire libre usada para encuentros de joropo y conciertos escolares; cuenta con camerinos y baños accesibles."),
    dict(clave="salon-comunal-de-bocas", nombre="Salón Comunal de Bocas del Atrato", org="corp-raiz-y-tambor", muni="27001", estado="en_revision", ambiente="mixto", aforo=150,
         desc="Salón comunal con patio abierto donde se hacen ensayos de chirimía y reuniones del cabildo; solicita aprobación de su ficha."),
]

NOTICIAS = [
    ("Abren inscripciones al Encuentro de Chirimía del San Juan", "institucional", "Las agrupaciones de chirimía del Pacífico pueden inscribirse hasta fin de mes para las jornadas de la próxima edición.",
     "El Encuentro de Chirimía del San Juan abrió su convocatoria para agrupaciones de todo el Pacífico. Las propuestas deben incluir una presentación breve, una grabación de campo y el nombre del maestro que las acompaña. "
     "Los organizadores recordaron que habrá un cabildo de maestros mayores y talleres de construcción de instrumentos abiertos al público.", "publicado"),
    ("Un taller de marimba que viaja de comunidad en comunidad", "procesos-territoriales", "El taller itinerante llegó a tres veredas del Chocó con instrumentos propios y maestros constructores.",
     "Durante dos semanas el taller itinerante de marimba de chonta visitó tres comunidades. Jóvenes de entre doce y veinte años aprendieron a cortar, curar y afinar las tablas con maestros de la región. "
     "Los participantes se llevaron una marimba pequeña para continuar el proceso en sus casas.", "publicado"),
    ("Lo que dejó la rueda de negocios del Caribe", "eventos-y-circulacion", "Veinte agrupaciones tuvieron citas con programadores en dos días de rueda de negocios.",
     "La rueda de negocios del Caribe cerró con más de cuarenta citas entre programadores y agrupaciones emergentes. Las conversaciones giraron en torno a condiciones técnicas, tarifas y calendarios de circulación. "
     "Los organizadores publicaron una guía con recomendaciones para la próxima edición.", "publicado"),
    ("Cantadoras del Atlántico documentan versos de bullerengue", "memoria-y-patrimonio", "Un grupo de mujeres reúne versos y cantos para conservarlos con sus propias reglas de uso.",
     "Un grupo de cantadoras del sur del Atlántico inició un registro colectivo de versos y cantos de bullerengue sentado. El archivo será custodiado por las mismas comunidades y consultado bajo acuerdos previos. "
     "El proceso incluye talleres en colegios para que niñas y niños aprendan los versos de viva voz.", "publicado"),
    ("Convocatoria de residencias de composición electrónica andina", "convocatorias-y-oportunidades", "Se abren cinco cupos para residencias que cruzan instrumentos andinos y producción electrónica.",
     "El colectivo de Pasto abrió cinco cupos para residencias de composición. Las personas seleccionadas trabajarán durante dos semanas con flautistas y productores, y presentarán sus piezas en una sesión pública. "
     "No se requiere experiencia previa en producción, pero sí interés en trabajar con instrumentos acústicos.", "en_revision"),
    ("Formación de directores de banda en Santander", "formacion", "Quince directores de pueblos pequeños participan en un curso de dirección y gestión de bandas.",
     "El programa de bandas sinfónicas juveniles realiza un curso para directores de municipios que quieren fundar la suya. Se trabaja repertorio, ensayo con instrumentistas principiantes y sostenibilidad de la banda. "
     "La próxima sesión será abierta para familias.", "borrador"),
    ("Reconocimiento a una maestra de arpa del piedemonte", "reconocimientos", "La fundación reconoció a una maestra de arpa por cuatro décadas de enseñanza en escuelas rurales.",
     "En una ceremonia sencilla, la fundación entregó un reconocimiento a una maestra de arpa que formó a generaciones de arpistas en escuelas rurales del piedemonte. "
     "Sus estudiantes tocaron un repertorio que ella misma había compilado.", "publicado"),
    ("Ajustes al calendario del festival de bullerengue", "institucional", "La organización pidió corregir fechas y sede antes de publicar la nueva edición.",
     "El calendario del festival de bullerengue está en revisión. Falta confirmar la sede del cierre y el cupo de talleres. "
     "Se informará cuando la ficha quede completa.", "rechazado"),
    ("Un balance de dos años de la red de archivos del Llano", "memoria-y-patrimonio", "La red de archivos sonoros hizo copias de preservación de 300 grabaciones de campo.",
     "En dos años, la red digitalizó y respaldó trescientas grabaciones de maestros mayores del piedemonte. Cada archivo conserva la ficha del maestro, el lugar y la fecha de la grabación. "
     "Los catálogos son de acceso abierto; los audios se consultan con solicitud.", "archivado"),
    ("Un salón comunal que también es sala de ensayo", "procesos-territoriales", "La comunidad adecuó su salón para ensayos de chirimía y reuniones del cabildo.",
     "El salón comunal de Bocas del Atrato recibió una mano de pintura, sillas y una pequeña tarima. Los jóvenes ensayan ahora tres tardes por semana. "
     "La junta pidió ayuda para completar el equipo de sonido.", "publicado"),
]

EVENTOS = [
    ("Noche de marimba en el barrio", "conciertos-y-presentaciones", "presencial", "27001", "Salón comunal de Bocas del Atrato", 20, 0, "publicado"),
    ("Cabildo de maestros mayores de chirimía", "encuentros-y-dialogos", "presencial", "27001", "Casa de la cultura de Quibdó", -45, 0, "publicado"),
    ("Taller abierto de afinación de marimba", "formacion", "mixta", "27001", "Taller de la corporación, Quibdó", 35, 1, "publicado"),
    ("Sesión mensual de electrónica andina", "conciertos-y-presentaciones", "presencial", "52001", "Sala de Ensayo La Ceiba, Pasto", 9, 0, "publicado"),
    ("Convocatoria de residencias andinas: charla informativa", "convocatorias", "virtual", "52001", None, 14, 0, "publicado"),
    ("Encuentro de arpistas jóvenes", "festivales", "presencial", "50001", "Tarima del Parque de los Cantores, Villavicencio", 70, 2, "publicado"),
    ("Clínica de metales para bandas", "formacion", "presencial", "68001", "Auditorio municipal de Bucaramanga", -20, 0, "publicado"),
    ("Rueda de versos de bullerengue", "conciertos-y-presentaciones", "presencial", "08001", "Casa de la cultura de Barranquilla", 50, 0, "en_revision"),
    ("Charla: derechos colectivos del conocimiento sonoro", "encuentros-y-dialogos", "virtual", "94001", None, -90, 0, "archivado"),
    ("Concierto de cierre del festival de guitarra", "festivales", "presencial", "63001", "Teatro municipal de Armenia", -200, 0, "borrador"),
]

