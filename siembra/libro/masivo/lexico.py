"""Léxico del motor masivo (N2 y N3): territorio, prácticas, nombres y vocabulario para la gramática combinatoria.

Todo es material de composición: no describe entidades reales. Las regiones y departamentos aportan solo hechos geográficos generales
(ríos, serranías, subregiones) y los géneros musicales son los de uso común en cada región; las fichas combinan estos elementos con
nombres inventados.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------------------------------------------------
# Territorio: región, adjetivo, anclas geográficas y peso de concentración (desigual pero con presencia mínima en todos)
# ---------------------------------------------------------------------------------------------------------------------
REGION = {"05": "andina", "08": "caribe", "11": "andina", "13": "caribe", "15": "andina", "17": "andina", "18": "amazonia", "19": "andina", "20": "caribe", "23": "caribe",
          "25": "andina", "27": "pacifico", "41": "andina", "44": "caribe", "47": "caribe", "50": "orinoquia", "52": "andina", "54": "andina", "63": "andina", "66": "andina",
          "68": "andina", "70": "caribe", "73": "andina", "76": "andina", "81": "orinoquia", "85": "orinoquia", "86": "amazonia", "88": "insular", "91": "amazonia",
          "94": "amazonia", "95": "amazonia", "97": "amazonia", "99": "orinoquia"}
# Departamentos con costa o franja pacífica (afro y marimba tienen sentido allí)
PACIFICO = {"27", "19", "52", "76"}

DEPTO = {
    "05": dict(n="Antioquia", adj="antioqueña", peso=11.0, geo=["las montañas antioqueñas", "los pueblos de la cordillera de Antioquia", "los valles y cañones de Antioquia"]),
    "08": dict(n="Atlántico", adj="atlanticense", peso=6.0, geo=["el litoral del Atlántico", "los pueblos de la ribera atlanticense del Magdalena", "las tierras llanas del Atlántico"]),
    "11": dict(n="Bogotá", adj="bogotana", peso=14.0, geo=["los cerros orientales", "las localidades de Bogotá", "la sabana de Bogotá"]),
    "13": dict(n="Bolívar", adj="bolivarense", peso=5.0, geo=["las tierras de Bolívar", "el Caribe bolivarense", "los pueblos de Bolívar entre el mar y el río Magdalena"]),
    "15": dict(n="Boyacá", adj="boyacense", peso=4.0, geo=["el altiplano y los valles de Boyacá", "las montañas boyacenses", "los pueblos de Boyacá"]),
    "17": dict(n="Caldas", adj="caldense", peso=3.0, geo=["las montañas de Caldas", "la zona cafetera caldense", "los pueblos de ladera de Caldas"]),
    "18": dict(n="Caquetá", adj="caqueteña", peso=1.5, geo=["el piedemonte amazónico del Caquetá", "la selva caqueteña", "los ríos del Caquetá"]),
    "19": dict(n="Cauca", adj="caucana", peso=5.0, geo=["las montañas del Cauca", "los pueblos del Cauca entre dos cordilleras", "el territorio caucano"]),
    "20": dict(n="Cesar", adj="cesarense", peso=3.0, geo=["las tierras del Cesar", "el valle y las serranías del Cesar", "los pueblos cesarenses"]),
    "23": dict(n="Córdoba", adj="cordobesa", peso=3.0, geo=["las sabanas y ríos de Córdoba", "las tierras cordobesas", "los pueblos de Córdoba"]),
    "25": dict(n="Cundinamarca", adj="cundinamarquesa", peso=3.5, geo=["las montañas de Cundinamarca", "los pueblos de Cundinamarca", "las tierras cundinamarquesas"]),
    "27": dict(n="Chocó", adj="chocoana", peso=3.0, geo=["la selva y los ríos del Chocó", "las comunidades chocoanas", "el territorio chocoano"]),
    "41": dict(n="Huila", adj="huilense", peso=4.0, geo=["el valle alto del Magdalena en el Huila", "las montañas huilenses", "los pueblos del Huila"]),
    "44": dict(n="La Guajira", adj="guajira", peso=2.0, geo=["las tierras de La Guajira", "el desierto y la serranía guajira", "las rancherías y pueblos de La Guajira"]),
    "47": dict(n="Magdalena", adj="magdalenense", peso=3.0, geo=["las tierras del Magdalena", "el Caribe magdalenense", "los pueblos del Magdalena"]),
    "50": dict(n="Meta", adj="metense", peso=2.5, geo=["los llanos del Meta", "el piedemonte y la altillanura del Meta", "las sabanas metenses"]),
    "52": dict(n="Nariño", adj="nariñense", peso=5.0, geo=["las montañas de Nariño", "el altiplano y los valles de Nariño", "el territorio nariñense"]),
    "54": dict(n="Norte de Santander", adj="nortesantandereana", peso=3.0, geo=["las tierras de Norte de Santander", "la frontera nortesantandereana", "los pueblos de Norte de Santander"]),
    "63": dict(n="Quindío", adj="quindiana", peso=2.0, geo=["el Paisaje Cultural Cafetero quindiano", "las laderas cafeteras del Quindío", "los pueblos del Quindío"]),
    "66": dict(n="Risaralda", adj="risaraldense", peso=2.5, geo=["el Eje Cafetero risaraldense", "las montañas de Risaralda", "los pueblos de Risaralda"]),
    "68": dict(n="Santander", adj="santandereana", peso=5.0, geo=["las montañas de Santander", "los cañones y mesetas de Santander", "los pueblos santandereanos"]),
    "70": dict(n="Sucre", adj="sucreña", peso=2.5, geo=["las sabanas y serranías de Sucre", "las tierras sucreñas", "los pueblos de Sucre"]),
    "73": dict(n="Tolima", adj="tolimense", peso=3.5, geo=["el valle del Magdalena tolimense", "las montañas del Tolima", "los pueblos del Tolima"]),
    "76": dict(n="Valle del Cauca", adj="vallecaucana", peso=9.0, geo=["los valles y montañas del Valle del Cauca", "el territorio vallecaucano", "los pueblos del Valle del Cauca"]),
    "81": dict(n="Arauca", adj="araucana", peso=1.5, geo=["las sabanas araucanas", "el piedemonte y la frontera de Arauca", "los pueblos de Arauca"]),
    "85": dict(n="Casanare", adj="casanareña", peso=1.5, geo=["las sabanas del Casanare", "el piedemonte llanero casanareño", "los pueblos de Casanare"]),
    "86": dict(n="Putumayo", adj="putumayense", peso=1.5, geo=["el piedemonte y la selva del Putumayo", "el territorio putumayense", "los pueblos del Putumayo"]),
    "88": dict(n="San Andrés y Providencia", adj="raizal", peso=1.2, geo=["el archipiélago de San Andrés y Providencia", "la comunidad raizal del archipiélago", "las islas del Caribe colombiano"]),
    "91": dict(n="Amazonas", adj="amazonense", peso=1.0, geo=["la selva del Amazonas", "las comunidades ribereñas del Amazonas", "el sur amazónico de Colombia"]),
    "94": dict(n="Guainía", adj="guainiana", peso=0.6, geo=["las comunidades del Guainía", "la selva y los ríos del Guainía", "el oriente amazónico y orinocense"]),
    "95": dict(n="Guaviare", adj="guaviarense", peso=0.6, geo=["la selva y las sabanas del Guaviare", "el territorio guaviarense", "las comunidades del Guaviare"]),
    "97": dict(n="Vaupés", adj="vaupense", peso=0.5, geo=["la selva del Vaupés", "las comunidades del Vaupés", "los ríos del Vaupés"]),
    "99": dict(n="Vichada", adj="vichadense", peso=0.6, geo=["las sabanas del Vichada", "el territorio vichadense", "los ríos y sabanas de la Orinoquia"]),
}

# Capitales y ciudades intermedias (códigos DIVIPOLA verificados al validar); el resto de municipios se sortea de todo el catálogo
CIUDADES = {
    "05": ["05001", "05615", "05266", "05088", "05360", "05045", "05837", "05642"], "08": ["08001", "08758", "08433", "08573"], "11": ["11001"],
    "13": ["13001", "13430", "13244", "13836", "13654"], "15": ["15001", "15238", "15759", "15693", "15491"], "17": ["17001", "17174", "17380"],
    "18": ["18001", "18753"], "19": ["19001", "19698", "19548", "19532"], "20": ["20001", "20011", "20178"], "23": ["23001", "23417", "23162", "23660"],
    "25": ["25175", "25754", "25899", "25269", "25307", "25290"], "27": ["27001", "27800", "27361"], "41": ["41001", "41551", "41396", "41298"],
    "44": ["44001", "44430", "44847"], "47": ["47001", "47189", "47245"], "50": ["50001", "50006", "50313"], "52": ["52001", "52835", "52356", "52399"],
    "54": ["54001", "54498", "54518", "54405"], "63": ["63001", "63130", "63594"], "66": ["66001", "66170", "66682"], "68": ["68001", "68276", "68679", "68755", "68081"],
    "70": ["70001", "70215", "70713"], "73": ["73001", "73268", "73449", "73349"], "76": ["76001", "76109", "76834", "76520", "76111", "76364"],
    "81": ["81001", "81736"], "85": ["85001", "85010"], "86": ["86001", "86568"], "88": ["88001"], "91": ["91001"], "94": ["94001"], "95": ["95001"], "97": ["97001"], "99": ["99001"],
}

GEO_CIUDAD = {"05001": ["el Valle de Aburrá", "las laderas de Medellín"], "08001": ["la desembocadura del Magdalena"], "11001": ["los cerros orientales", "la sabana de Bogotá"], "13001": ["la bahía de Cartagena"],
              "15001": ["el altiplano cundiboyacense"], "17001": ["la zona cafetera"], "18001": ["el piedemonte amazónico"], "19001": ["la meseta de Popayán"], "20001": ["el valle del río Cesar"],
              "23001": ["la ribera del río Sinú"], "27001": ["la ribera del Atrato"], "41001": ["el valle del Magdalena"], "44001": ["el litoral de La Guajira"], "47001": ["la Sierra Nevada de Santa Marta"],
              "50001": ["el piedemonte llanero"], "52001": ["el valle de Atriz"], "54001": ["la frontera con Venezuela"], "63001": ["el Paisaje Cultural Cafetero"], "66001": ["el Eje Cafetero"],
              "68001": ["la meseta de Bucaramanga"], "70001": ["las sabanas de Sucre"], "73001": ["la cordillera Central"], "76001": ["el valle geográfico del río Cauca"], "81001": ["la ribera del río Arauca"],
              "85001": ["las sabanas del Casanare"], "86001": ["el piedemonte amazónico"], "88001": ["el mar de los siete colores"], "91001": ["el río Amazonas"], "94001": ["el río Inírida"],
              "95001": ["el río Guaviare"], "97001": ["el río Vaupés"], "99001": ["el río Orinoco"]}


def geo_de(dep: str, cod: str, rng) -> str:
    """Ancla geográfica válida para ese lugar: la específica si es una capital conocida; si no, una de escala departamental."""
    esp = GEO_CIUDAD.get(cod)
    if esp and rng.random() < 0.7:
        return rng.choice(esp)
    return rng.choice(DEPTO[dep]["geo"])


NOMBRE_COMUN = {"SANTIAGO DE CALI": "Cali", "SAN ANDRÉS DE TUMACO": "Tumaco", "CARTAGENA DE INDIAS": "Cartagena", "BOGOTÁ, D.C.": "Bogotá", "SAN JOSÉ DE CÚCUTA": "Cúcuta",
                "SAN JUAN DE PASTO": "Pasto", "SAN JOSÉ DEL GUAVIARE": "San José del Guaviare", "SAN ANDRÉS": "San Andrés", "SANTA MARTA": "Santa Marta"}

VEREDAS = ["La Esperanza", "El Carmelo", "San Isidro", "Buenavista", "La Palma", "El Playón", "Los Naranjos", "La Floresta", "Santa Rita", "El Recreo", "La Cumbre", "El Tablazo",
           "Alto del Roble", "La Candelaria", "Piedras Blancas", "El Diamante", "Mata de Guadua", "La Unión", "Campo Alegre", "El Bosque", "La Ceiba", "Brisas del Río", "El Paraíso", "Aguas Claras"]

# ---------------------------------------------------------------------------------------------------------------------
# Prácticas: las 16 familias del catálogo real de SIMUS, con géneros por región, instrumentos, agentes y vocabulario
# ---------------------------------------------------------------------------------------------------------------------
P = "musicas-populares-tradicionales-regionales-y-patrimoniales"
FAMILIAS = {
    "tradicionales": dict(
        slug=P, pesos={"andina": 8, "caribe": 8, "orinoquia": 7, "pacifico": 2, "amazonia": 3, "insular": 3},
        gen={"andina": ["bambuco", "pasillo", "guabina", "torbellino", "rajaleña", "sanjuanero", "música de cuerda", "música de carranga"],
             "caribe": ["gaita", "cumbia", "porro", "vallenato", "chandé", "música de acordeón", "décima y verso", "música de millo"],
             "orinoquia": ["joropo", "pasaje llanero", "contrapunteo", "música de arpa, cuatro y maracas", "galerón", "corrido llanero"],
             "pacifico": ["chirimía", "décima cantada", "música de cuerda de la costa", "arrullos y cantos de velorio"],
             "amazonia": ["música de cuerda del piedemonte", "bambuco de colonos", "música de frontera amazónica", "cantos de río"],
             "insular": ["calipso", "mento", "schottische", "polca", "mazurca", "música de cuerda isleña"]},
        instr={"andina": ["tiple", "bandola", "guitarra", "requinto", "flauta traversa", "carrasca", "esterilla"], "caribe": ["tambor alegre", "llamador", "gaita hembra y macho", "maracas", "acordeón", "caja vallenata", "guacharaca", "millo"],
               "orinoquia": ["arpa llanera", "cuatro", "maracas", "bandola llanera", "capachos"], "pacifico": ["clarinete", "bombo", "platillos", "redoblante", "guitarra"],
               "amazonia": ["guitarra", "tiple", "flautas de carrizo", "bombo", "violín"], "insular": ["mandolina", "guitarra", "quijada de burro", "tina de lavar", "violín", "acordeón"]},
        agentes=["cantadoras y cantadores", "maestros de cuerda", "tamboreros", "decimeros", "arpistas", "acordeoneros", "compositores de la región", "juglares"],
        acts=["rondas de cantos", "contrapuntos", "tomas de plaza", "desfiles de agrupaciones", "serenatas", "clínicas de instrumentos", "trovas improvisadas"],
        epitetos=["Cantos de Guadua", "Raíces de Palma", "Trovas del Camino", "Coplas de Aguacero", "Sones de Ceiba", "Voces de Cañaduzal", "Cuerdas de Lluvia", "Tonadas del Alto", "Aires de Sabana", "Memorias de Fogón",
                  "Retretas de Esquina", "Contrapunto de Brisa", "Zarzo y Cuerda", "Paisajes de Tiple"],
        roles=["interprete", "cultor", "cantante", "compositor", "director"], inst_cod=["cordofonos", "voz", "membranofonos", "aerofonos"]),
    "afro": dict(
        slug="musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras", pesos={"pacifico": 9, "caribe": 6, "insular": 6, "andina": 2, "orinoquia": 0.3, "amazonia": 0.3},
        gen={"pacifico": ["currulao", "chirimía chocoana", "alabaos y gualíes", "bunde", "berroche", "arrullos", "juga", "marimba de chonta"],
             "caribe": ["bullerengue sentado", "son de negro", "lumbalú", "música de tambora", "chalupa", "champeta", "tambor alegre"],
             "insular": ["calipso", "mento", "cantos de iglesia raizal", "schottische", "polca"],
             "andina": ["currulao", "música del norte del Cauca", "bambuco viejo afrocaucano", "chirimía de pueblo", "bunde"],
             "orinoquia": ["cantos de trabajo", "música afrollanera"], "amazonia": ["cantos de trabajo", "música afrocolombiana de frontera"]},
        instr={"pacifico": ["marimba de chonta", "cununo macho y hembra", "bombo", "guasá", "clarinete", "platillos"], "caribe": ["tambor alegre", "llamador", "tambora", "maracas", "gaita"],
               "insular": ["mandolina", "guitarra", "quijada de burro", "tina de lavar"], "andina": ["bombo", "cununo", "guasá", "flauta de millo"], "orinoquia": ["tambor", "maracas"], "amazonia": ["tambor", "guitarra"]},
        agentes=["cantadoras", "tamboreras y tamboreros", "marimberos", "maestras de arrullo", "constructores de tambores", "bailadores", "mayores sabedoras"],
        acts=["rondas de cantos", "ruedas de tambor", "cantos de velorio", "talleres de construcción de instrumentos", "muestras de baile", "conversatorios de mayores"],
        epitetos=["Tambores de Río", "Raíces de Manglar", "Voces de Marea", "Marimba y Monte", "Cantos de Ceiba", "Sones de Playa", "Alabao y Luna", "Tamboras del Palenque", "Cununos de Estero", "Arrullos de Atardecer"],
        roles=["cultor", "cantante", "interprete", "investigador", "docente"], inst_cod=["membranofonos", "idiofonos", "voz", "aerofonos"]),
    "originarios": dict(
        slug="expresiones-sonoras-de-pueblos-originarios", pesos={"amazonia": 8, "andina": 3, "caribe": 4, "orinoquia": 4, "pacifico": 3, "insular": 0.1},
        gen={"amazonia": ["música de flautas y maracas", "música de las malocas", "cantos de trabajo comunitario", "repertorios de danza propia", "encuentros de música de pueblos originarios"],
             "*": ["música de flautas y maracas", "cantos de trabajo comunitario", "repertorios de danza propia", "música de pueblos de resguardo", "encuentros de música de pueblos originarios"]},
        instr={"*": ["flautas de carrizo", "maracas", "tambores de la comunidad", "pitos de caña", "sonajeros", "gaitas indígenas"]},
        agentes=["mayores", "mayoras", "jóvenes de las comunidades", "maestros de flauta", "cantadoras tradicionales", "autoridades del resguardo"],
        acts=["encuentros de saberes entre generaciones", "rondas de música compartidas con autorización de cada comunidad", "talleres de construcción de instrumentos", "tertulias de mayores", "jornadas de registro bajo acuerdo comunitario"],
        epitetos=["Cantos del Río Grande", "Flautas de la Maloca", "Voces de los Mayores", "Memoria del Resguardo", "Sonajeros de Selva", "Tejido de Voces", "Aire de Carrizo", "Palabra y Tambor"],
        roles=["cultor", "investigador", "docente", "interprete"], inst_cod=["aerofonos", "idiofonos", "voz", "membranofonos"]),
    "academicas": dict(
        slug="musicas-academicas-de-camara-contemporaneas-experimentales-y-de-vanguardia", pesos={"andina": 8, "caribe": 3, "orinoquia": 1, "pacifico": 1, "amazonia": 0.3, "insular": 0.5},
        gen={"*": ["música de cámara", "repertorio contemporáneo", "música antigua", "jazz", "música experimental", "composición para cuarteto de cuerdas", "música coral de concierto", "repertorio latinoamericano para piano"]},
        instr={"*": ["violín", "violonchelo", "piano", "flauta traversa", "clarinete", "guitarra clásica", "contrabajo", "saxofón"]},
        agentes=["cuartetos de cuerdas", "pianistas", "compositores jóvenes", "ensambles de cámara", "docentes de conservatorio", "ensambles de jazz"],
        acts=["ciclos de conciertos de cámara", "clases magistrales", "estrenos de obras", "conciertos didácticos", "residencias de composición", "recitales en salas pequeñas"],
        epitetos=["Cámara de Montaña", "Estrenos del Sur", "Cuerdas de Medianoche", "Voces de Cámara", "Atril Abierto", "Sala de Cuatro Cuerdas", "Contrapunto Joven", "Partitura y Territorio"],
        roles=["interprete", "compositor", "director", "docente"], inst_cod=["cordofonos", "aerofonos", "electrofonos", "idiofonos"]),
    "campesinas": dict(
        slug="musicas-campesinas-rurales-y-de-raiz-territorial", pesos={"andina": 8, "caribe": 3, "orinoquia": 3, "pacifico": 1, "amazonia": 3, "insular": 0.5},
        gen={"andina": ["música carranguera", "trova campesina", "música de parranda", "rajaleña", "música de cuerda campesina", "cantos de cosecha"], "caribe": ["música de sabana", "décimas campesinas", "música de gaita de monte", "cantos de vaquería"],
             "orinoquia": ["cantos de vaquería", "música de hato", "joropo campesino", "coplas de sabana"], "pacifico": ["cantos de trabajo en el río", "décimas de campo", "arrullos de vereda"],
             "amazonia": ["música de colonos", "cantos de chagra", "trova de piedemonte"], "insular": ["cantos de pescadores", "música de las fiestas rurales"]},
        instr={"*": ["tiple", "guitarra", "requinto", "guacharaca", "carrasca", "bandola", "cuatro", "acordeón"]},
        agentes=["campesinos músicos", "mujeres de las veredas", "trovadores", "maestros de escuela rural", "juntas de acción comunal", "familias de músicos"],
        acts=["parrandas veredales", "trovas y contrapuntos", "tomas de caseta comunal", "cabalgatas con música", "ferias de la cosecha", "talleres en escuelas rurales"],
        epitetos=["Cantos de Cosecha", "Parranda de Surco", "Coplas de Vereda", "Trovas del Cafetal", "Música de Terrón", "Tonadas de Rastrojo", "Cuerdas de Finca", "Sones de Mayo"],
        roles=["cultor", "interprete", "cantante", "compositor"], inst_cod=["cordofonos", "voz", "idiofonos", "membranofonos"]),
    "comunitarias": dict(
        slug="musicas-comunitarias-y-procesos-colectivos-de-practica-musical", pesos={"andina": 7, "caribe": 5, "orinoquia": 3, "pacifico": 4, "amazonia": 3, "insular": 2},
        gen={"*": ["procesos de formación musical comunitaria", "orquestas de barrio", "coros comunitarios", "bandas escolares", "semilleros de música tradicional", "escuelas de música populares", "ensambles de vecinos"]},
        instr={"*": ["instrumentos de viento", "percusión menor", "guitarras prestadas", "tiples", "flautas dulces", "tambores"]},
        agentes=["niñas y niños del barrio", "docentes comunitarios", "madres cantoras", "jóvenes de colegio", "vecinos músicos", "líderes culturales"],
        acts=["ensayos abiertos", "muestras de fin de año", "intercambios entre barrios", "clínicas de instrumentos", "conciertos en la cancha", "ferias de escuelas de música"],
        epitetos=["Música de Barrio", "Cuerdas del Vecindario", "Semillas de Compás", "Voces de la Cuadra", "Ensayo Abierto", "Tambores de Esquina", "Compás Comunal", "Sonidos de Manzana"],
        roles=["docente", "director", "gestor", "interprete"], inst_cod=["cordofonos", "aerofonos", "membranofonos", "voz"]),
    "frontera": dict(
        slug="musicas-de-frontera-diasporas-migraciones-e-interculturalidad", pesos={"andina": 4, "caribe": 4, "orinoquia": 3, "pacifico": 2, "amazonia": 5, "insular": 3},
        gen={"*": ["músicas de frontera", "repertorios de comunidades migrantes", "cruces entre cumbia y ritmos andinos", "música de la diáspora", "repertorios compartidos entre países vecinos", "cantos de mezcla intercultural"]},
        instr={"*": ["charango", "cuatro", "acordeón", "guitarra", "quena", "percusión latina", "bandoneón"]},
        agentes=["músicos migrantes", "familias de frontera", "colectivos binacionales", "cantautores viajeros", "jóvenes de segunda generación"],
        acts=["encuentros binacionales", "noches de intercambio", "ruedas de repertorio compartido", "talleres de cruce de géneros", "conciertos en el puente"],
        epitetos=["Cruce de Caminos", "Voces sin Frontera", "Línea de Mojón", "Puente Sonoro", "Orillas Compartidas", "Músicas del Otro Lado", "Mestizaje de Cuerdas"],
        roles=["interprete", "investigador", "gestor", "cantante"], inst_cod=["cordofonos", "aerofonos", "voz", "membranofonos"]),
    "electronicas": dict(
        slug="musicas-electronicas-digitales-produccion-sonora-y-nuevas-tecnologias", pesos={"andina": 8, "caribe": 4, "orinoquia": 1, "pacifico": 2, "amazonia": 0.5, "insular": 1},
        gen={"*": ["música electrónica con instrumentos de la región", "producción de beats con muestras de campo", "live coding", "paisajes sonoros con sintetizadores", "electrónica bailable", "sonido generativo", "remezclas de música tradicional"]},
        instr={"*": ["sintetizadores", "controladores MIDI", "cajas de ritmos", "estaciones de producción", "mezcladores", "grabadoras de campo"]},
        agentes=["productores", "diyéis", "programadores de sonido", "colectivos de producción", "estudiantes de audio", "bedmakers jóvenes"],
        acts=["sesiones abiertas", "talleres de producción", "noches de improvisación", "laboratorios de sonido", "intercambios de muestras", "conciertos audiovisuales"],
        epitetos=["Circuito de Cumbre", "Pulso Digital", "Onda Corta", "Señal de Montaña", "Laboratorio de Brisa", "Frecuencia Local", "Muestra y Rastro", "Voltaje de Barrio"],
        roles=["productor", "sonidista", "compositor", "docente"], inst_cod=["electrofonos", "voz", "membranofonos"]),
    "escena": dict(
        slug="musicas-para-escena-danza-audiovisual-e-interdisciplinariedad", pesos={"andina": 6, "caribe": 4, "orinoquia": 1, "pacifico": 2, "amazonia": 0.5, "insular": 1},
        gen={"*": ["música para teatro", "bandas sonoras para cine documental", "música para danza contemporánea", "sonorización de obras escénicas", "composición para títeres", "música para circo", "creación sonora para video"]},
        instr={"*": ["percusión menor", "guitarra", "teclados", "objetos sonoros", "violonchelo", "clarinete"]},
        agentes=["compositores de escena", "bailarines y músicos", "directores de teatro", "realizadores audiovisuales", "titiriteros", "músicos de cine"],
        acts=["funciones con música en vivo", "residencias de creación", "proyecciones con orquesta", "talleres de música para escena", "laboratorios interdisciplinarios"],
        epitetos=["Telón y Cuerda", "Escena Sonora", "Cuerpo y Compás", "Cine con Orquesta", "Telón de Bambú", "Pie de Foto Sonoro", "Función de Viento"],
        roles=["compositor", "interprete", "director", "productor"], inst_cod=["cordofonos", "idiofonos", "aerofonos", "electrofonos"]),
    "populares": dict(
        slug="musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales", pesos={"andina": 6, "caribe": 9, "orinoquia": 2, "pacifico": 4, "amazonia": 1.5, "insular": 2},
        gen={"*": ["salsa", "cumbia", "merengue", "música tropical bailable", "champeta", "vallenato romántico", "música popular de plancha", "orquestas de baile", "boleros y tangos de barrio", "reggaetón local"]},
        instr={"*": ["trompetas", "trombones", "congas", "timbales", "bajo eléctrico", "teclados", "güiro", "acordeón"]},
        agentes=["orquestas de baile", "cantantes de salón", "coristas", "bailarines de salsa", "técnicos de sonido", "pregoneros de baile"],
        acts=["noches de baile", "concursos de orquestas", "salsatones", "verbenas", "bailes al aire libre", "caravanas de orquestas"],
        epitetos=["Bailadero de Esquina", "Sabor de Plancha", "Orquesta de Barrio", "Tropical de Domingo", "Clave y Calle", "Verbena de Mayo", "Congas del Puerto", "Salón de Ceiba"],
        roles=["cantante", "interprete", "director", "productor"], inst_cod=["membranofonos", "aerofonos", "voz", "electrofonos"]),
    "religiosas": dict(
        slug="musicas-religiosas-rituales-espirituales-y-devocionales", pesos={"andina": 8, "caribe": 4, "orinoquia": 2, "pacifico": 3, "amazonia": 1.5, "insular": 3},
        gen={"*": ["música de Semana Santa", "cantos de novena", "alabaos y alabanzas", "coros de iglesia", "música sacra barroca", "gospel comunitario", "cantos de velorio", "villancicos y aguinaldos"]},
        instr={"*": ["órgano", "violines", "trompetas", "guitarras", "tambores de procesión", "campanas"]},
        agentes=["coros parroquiales", "cantores de novena", "maestros de capilla", "devotos", "matachines", "cofradías"],
        acts=["procesiones con música", "ciclos de música sacra", "novenas cantadas", "misas campesinas", "conciertos de cuaresma", "rondas de aguinaldos"],
        epitetos=["Cantos de Cuaresma", "Aguinaldo de Altura", "Campanas del Valle", "Alabanza y Fuego", "Novenario de Cuerda", "Voces de Capilla", "Gloria de Sabana"],
        roles=["cultor", "cantante", "director", "interprete"], inst_cod=["voz", "cordofonos", "aerofonos", "idiofonos"]),
    "sinfonicas": dict(
        slug="musicas-sinfonicas-bandas-orquestas-y-grandes-formatos-instrumentales", pesos={"andina": 9, "caribe": 4, "orinoquia": 2, "pacifico": 2, "amazonia": 1, "insular": 1},
        gen={"*": ["banda sinfónica", "orquesta juvenil", "banda de vientos", "orquesta de cámara regional", "big band", "ensamble de metales", "orquesta infantil"]},
        instr={"*": ["clarinetes", "trompetas", "trombones", "tubas", "flautas", "percusión sinfónica", "saxofones", "violonchelos"]},
        agentes=["directores de banda", "músicos de banda municipal", "jóvenes de banda escolar", "docentes de vientos", "luthiers de reparación", "jóvenes de orquesta"],
        acts=["conciertos de gala", "clínicas de vientos", "encuentros de bandas", "retretas en el parque", "festivales de orquestas juveniles", "ensayos abiertos"],
        epitetos=["Bronces de Cordillera", "Vientos del Páramo", "Retreta de Domingo", "Orquesta de Cañón", "Metales de Sabana", "Gran Banda del Valle", "Clarín de Montaña"],
        roles=["director", "interprete", "docente", "luthier"], inst_cod=["aerofonos", "membranofonos", "cordofonos"]),
    "urbanas": dict(
        slug="musicas-urbanas-alternativas-e-independientes", pesos={"andina": 8, "caribe": 4, "orinoquia": 1.5, "pacifico": 3, "amazonia": 1, "insular": 1.5},
        gen={"*": ["rock alternativo", "hip hop", "punk", "metal", "reggae", "indie", "ska", "funk local", "trap de barrio", "fusión urbana", "rap en lengua propia"]},
        instr={"*": ["guitarra eléctrica", "bajo", "batería", "tornamesas", "micrófonos de mano", "samplers", "teclados"]},
        agentes=["bandas de garaje", "raperos y raperas", "colectivos de grafiti y música", "productores independientes", "cantautores", "dj de barrio"],
        acts=["tocatas", "batallas de rap", "conciertos de garaje", "ferias de discos", "ruedas de freestyle", "festivales de bandas emergentes"],
        epitetos=["Ruido de Garaje", "Cuadra Eléctrica", "Rima de Esquina", "Volumen de Barrio", "Distorsión y Brisa", "Tornamesa Libre", "Acordes de Concreto", "Cancha Eléctrica"],
        roles=["interprete", "cantante", "productor", "compositor"], inst_cod=["electrofonos", "cordofonos", "membranofonos", "voz"]),
    "vocales": dict(
        slug="musicas-vocales-corales-y-de-tradicion-cantada", pesos={"andina": 8, "caribe": 4, "orinoquia": 2, "pacifico": 4, "amazonia": 2, "insular": 3},
        gen={"*": ["coros polifónicos", "música vocal a capela", "cantos de tradición oral", "coros infantiles", "canto lírico", "cuartetos vocales", "voces de cantaoras", "coros de adultos mayores"]},
        instr={"*": ["piano acompañante", "guitarra", "percusión menor", "diapasón"]},
        agentes=["coristas", "directores de coro", "cantadoras", "cantantes líricos", "niñas y niños coralistas", "adultos mayores cantores"],
        acts=["encuentros de coros", "ensayos abiertos", "conciertos de voces", "talleres de técnica vocal", "intercambios corales", "rondas de cantos de tradición oral"],
        epitetos=["Voces de Cámara", "Canto Largo", "Coro de Montaña", "Garganta de Río", "Armonía de Esquina", "Voz y Territorio", "Cantos de Medianoche", "Ronda de Voces"],
        roles=["cantante", "director", "docente", "cultor"], inst_cod=["voz", "cordofonos"]),
    "sonoras": dict(
        slug="practicas-sonoras-arte-sonoro-archivo-investigacion-creacion-y-paisajes-sonoros", pesos={"andina": 7, "caribe": 3, "orinoquia": 1, "pacifico": 2, "amazonia": 2, "insular": 1},
        gen={"*": ["paisajes sonoros", "arte sonoro", "archivo de grabaciones de campo", "escucha profunda", "instalaciones sonoras", "fonografía", "mapeo sonoro del territorio"]},
        instr={"*": ["grabadoras de campo", "hidrófonos", "micrófonos de contacto", "objetos resonantes", "sintetizadores modulares"]},
        agentes=["investigadores del sonido", "archivistas", "artistas sonoros", "biólogos y músicos", "documentalistas", "estudiantes de comunicación"],
        acts=["caminatas de escucha", "talleres de grabación de campo", "sesiones de archivo abierto", "instalaciones sonoras", "laboratorios de paisaje sonoro"],
        epitetos=["Escucha de Páramo", "Archivo de Río", "Mapa Sonoro", "Oído de Selva", "Ruta de Escucha", "Rastro de Campo", "Memoria Acústica", "Paisaje en Voz Baja"],
        roles=["investigador", "productor", "docente", "compositor"], inst_cod=["electrofonos", "idiofonos", "voz"]),
    "bandas": dict(
        slug="bandas-de-marcha-batucadas-comparsas-y-colectivos-sonoros-en-movimiento", pesos={"andina": 6, "caribe": 8, "orinoquia": 2, "pacifico": 4, "amazonia": 1, "insular": 3},
        gen={"*": ["bandas de marcha", "batucadas", "comparsas", "chirimías de pueblo", "bandas de guerra escolares", "murgas", "cuadrillas de tambores", "colectivos sonoros en movimiento"]},
        instr={"*": ["redoblantes", "bombos", "platillos", "liras", "tambores de carnaval", "trompetas", "congas"]},
        agentes=["bandas escolares", "comparseros", "murgueros", "tamboreros de carnaval", "batuteras", "cuadrillas de barrio"],
        acts=["desfiles", "retos de batucadas", "encuentros de bandas escolares", "comparsas de barrio", "ensayos de calle", "tomas de plaza con música"],
        epitetos=["Redoble de Esquina", "Comparsa de Domingo", "Platillo y Bombo", "Murga de Pueblo", "Marcha de Barrio", "Tambores en Desfile", "Batuta Joven", "Cuadrilla de Plaza"],
        roles=["director", "interprete", "docente", "gestor"], inst_cod=["membranofonos", "aerofonos", "idiofonos"]),
}
CLAVES_FAMILIA = list(FAMILIAS)

# Territorios sonoros del catálogo (slug) según región/departamento
def territorios_sonoros(dep: str, familia: str):
    r = REGION[dep]
    if familia == "originarios":
        return ["practicas-de-pueblos-indigenas"]
    if familia == "academicas":
        return ["comunidades-academicas"]
    if r == "caribe":
        return ["cantos-pitos-y-tambores"]
    if r == "orinoquia":
        return ["joropo"]
    if r == "insular":
        return ["insular"]
    if r == "amazonia":
        return ["amazonas"]
    if dep == "27":
        return ["chirimia", "marimba"]
    if dep in ("19", "76") and familia == "afro":
        return ["marimba"]
    if dep in ("52", "19"):
        return ["flautas-cuerdas-y-tambores-surenos"]
    if dep in ("15", "68"):
        return ["canta-y-torbellino"]
    if dep in ("41", "73"):
        return ["rajalena-y-cucamba"]
    if dep in ("05", "17", "66", "63"):
        return ["trova-y-parranda"]
    return []

# ---------------------------------------------------------------------------------------------------------------------
# Nombres de personas (inventados; se evitan combinaciones de músicos conocidos)
# ---------------------------------------------------------------------------------------------------------------------
NOMBRES_F = ["María", "Luz", "Ana", "Lucía", "Marcela", "Yuliana", "Paola", "Sandra", "Diana", "Johana", "Natalia", "Carolina", "Daniela", "Laura", "Andrea", "Liliana", "Gloria", "Nubia", "Mariela", "Rosalba",
             "Yesenia", "Dayana", "Estefanía", "Valentina", "Sofía", "Isabel", "Clara", "Teresa", "Amparo", "Olga", "Esperanza", "Constanza", "Magaly", "Nancy", "Leidy", "Katherine", "Yolanda", "Edith", "Beatriz",
             "Cecilia", "Fanny", "Gladys", "Hilda", "Irma", "Jackeline", "Karen", "Lorena", "Mónica", "Nelly", "Ofelia", "Patricia", "Rocío", "Stella", "Tatiana", "Viviana", "Ximena", "Yamile", "Zulma", "Aura",
             "Berta", "Dora", "Elvira", "Flor", "Graciela", "Inés", "Judith", "Lilia", "Matilde", "Norma", "Pilar", "Rosa", "Sara", "Tulia", "Vanessa", "Wendy", "Yadira", "Arleth", "Brigitte", "Candelaria", "Dilia"]
NOMBRES_M = ["Juan", "Carlos", "Luis", "José", "Andrés", "Camilo", "Felipe", "Jhon", "Edwin", "Wilson", "Fabián", "Hernán", "Gustavo", "Álvaro", "Mauricio", "Néstor", "Óscar", "Pedro", "Ramiro", "Rubén", "Sergio",
             "Tomás", "Víctor", "William", "Yeison", "Adolfo", "Bernardo", "César", "Darío", "Efraín", "Fredy", "Germán", "Heriberto", "Iván", "Jairo", "Kevin", "Leonardo", "Manuel", "Nicolás", "Orlando", "Pablo",
             "Rafael", "Santiago", "Teófilo", "Alexánder", "Brayan", "Cristian", "Diego", "Eduardo", "Fernando", "Guillermo", "Humberto", "Jorge", "Lisandro", "Marco", "Nelson", "Omar", "Policarpo", "Reinaldo",
             "Saúl", "Tobías", "Uriel", "Vicente", "Wálter", "Yamid", "Aníbal", "Baltazar", "Cipriano", "Dagoberto", "Eliécer", "Froilán", "Gilberto", "Hugo", "Jesús", "Libardo", "Moisés", "Norberto"]
SEGUNDOS = ["María", "Fernanda", "Alejandra", "Patricia", "Lucía", "del Carmen", "Andrea", "Camila", "Yineth", "Dary", "Marcela", "Elena", "Cristina", "Stella", "Eugenia", "Felipe", "Alberto", "Antonio", "David", "Esteban",
            "Javier", "Enrique", "Ernesto", "Alonso", "Mauricio", "Ricardo", "Eliécer", "Leonardo", "Rodrigo", "Augusto"]
APELLIDOS = ["Arango", "Cardona", "Ibarra", "Salcedo", "Berrío", "Padilla", "Pinzón", "Lozano", "Vélez", "Restrepo", "Ospina", "Giraldo", "Zapata", "Betancur", "Jaramillo", "Montoya", "Londoño", "Hoyos", "Tobón", "Duque",
             "Rendón", "Echeverri", "Cadavid", "Ramírez", "Gómez", "Torres", "Rojas", "Herrera", "Castro", "Vargas", "Rincón", "Suárez", "Mendivelso", "Gutiérrez", "Pardo", "Bejarano", "Cuervo", "Sandoval", "Bustos", "Moncada",
             "Quintana", "Valderrama", "Peñaranda", "Barragán", "Villamizar", "Carrillo", "Ordóñez", "Chaparro", "Almanza", "Becerra", "Cortés", "Dueñas", "Espitia", "Forero", "Galindo", "Hurtado", "Leal", "Mahecha",
             "Niño", "Oviedo", "Parra", "Rueda", "Silva", "Téllez", "Uribe", "Vega", "Yepes", "Zambrano", "Aponte", "Bohórquez", "Camargo", "Delgado", "Escobar", "Fajardo", "Garzón", "Hernández", "Lara", "Medina", "Navarro",
             "Ortega", "Prieto", "Quiroga", "Ruiz", "Santamaría", "Trujillo", "Urrego", "Villarreal", "Acosta", "Benavides", "Cabrera", "Díaz", "Estrada", "Flórez", "González", "Guerrero", "Jiménez", "López", "Martínez", "Muñoz"]
APELLIDOS_REGION = {
    "caribe": ["Pertuz", "Caballero", "Orozco", "Mendoza", "Barrios", "Charris", "De la Hoz", "Cantillo", "Maestre", "Peñaloza", "Meza", "Ospino", "Redondo", "Zúñiga", "Acuña", "Berdugo", "Cervantes", "Galván", "Jiménez", "Lugo",
               "Manjarrés", "Noriega", "Pacheco", "Racines", "Sarmiento", "Tapia", "Valdelamar", "Villalba", "Altamar", "Bolaño", "Cassiani", "Doria", "Epalza", "Fontalvo"],
    "pacifico": ["Córdoba", "Palacios", "Rentería", "Moreno", "Murillo", "Valencia", "Caicedo", "Angulo", "Perea", "Asprilla", "Hinestroza", "Lemos", "Arboleda", "Banguera", "Mosquera", "Cuesta", "Mena", "Potes", "Micolta", "Obregón",
                 "Ibargüen", "Lucumí", "Minota", "Preciado", "Quiñones", "Riascos", "Sinisterra", "Torres", "Zúñiga", "Estupiñán"],
    "orinoquia": ["Rangel", "Sanabria", "Pérez", "Camejo", "Jaimes", "Barrera", "Cisneros", "Guarín", "Ibáñez", "Linares", "Macías", "Nieto", "Ortiz", "Pulido", "Roa", "Sierra", "Tovar", "Urdaneta", "Velandia", "Yanes"],
    "amazonia": ["Mamián", "Chindoy", "Jacanamijoy", "Tisoy", "Llanos", "Piaguaje", "Yagarí", "Silva", "Cabrera", "Mutumbajoy", "Agreda", "Gómez", "Rodríguez", "Pinto", "Becerra", "Cuéllar", "Rojas", "Tapiero", "Murcia", "Perdomo"],
    "insular": ["Archbold", "Bowie", "Hooker", "Livingston", "Robinson", "Steele", "Taylor", "Pomare", "Gordon", "Newball", "McLaughlin", "Howard", "Forbes", "Britton", "Gallardo", "Francis", "Corpus", "Davis", "Julio", "Whitaker"],
    "andina": ["Quiroz", "Mejía", "Ruge", "Pinilla", "Cifuentes", "Gaitán", "Báez", "Alfonso", "Ariza", "Calderón", "Murcia", "Fonseca", "Salamanca", "Sierra", "Lancheros", "Pedraza", "Vanegas", "Moyano", "Cuéllar", "Perdomo",
               "Tello", "Ramos", "Burbano", "Chamorro", "Erazo", "Insuasty", "Jojoa", "López", "Narváez", "Paz", "Quenguan", "Rosero", "Santacruz", "Timaná", "Yela"],
}
# Combinaciones (nombre, primer apellido) de músicos reconocidos: NUNCA se generan (se compara sin tildes y en minúsculas)
VETADOS = {("carlos", "vives"), ("juan", "londono"), ("juan", "aristizabal"), ("shakira", "mebarak"), ("jose", "osorio"), ("andres", "cepeda"), ("silvestre", "dangond"), ("jorge", "celedon"),
           ("diomedes", "diaz"), ("rafael", "escalona"), ("leandro", "diaz"), ("joe", "arroyo"), ("yuri", "buenaventura"), ("petrona", "martinez"), ("sonia", "bazanta"), ("luis", "bermudez"),
           ("alejo", "duran"), ("jorge", "velosa"), ("egidio", "cuadrado"), ("lisandro", "meza"), ("carlos", "huertas"), ("pedro", "ramayá"), ("totó", "momposina"), ("martin", "elias"), ("rafael", "orozco"),
           ("kaleth", "morales"), ("peter", "manjarres"), ("iván", "villazón"), ("ivan", "villazon"), ("poncho", "zuleta"), ("jorge", "oñate"), ("jorge", "onate"), ("juan", "fernando"), ("cesar", "betancur"),
           ("mario", "gareña"), ("fonseca", ""), ("mauricio", "silva"), ("gustavo", "cerati"), ("francisco", "zumaqué"), ("francisco", "zumaque"), ("antonio", "arnedo"), ("alfredo", "gutierrez"), ("lucho", "bermudez"),
           ("pacho", "galan"), ("anibal", "velasquez"), ("diego", "garcia"), ("gerardo", "gutierrez"), ("otoniel", "rojas"), ("jhon", "alex"), ("alexis", "play"), ("camilo", "echeverry"), ("julieta", "venegas")}

# ---------------------------------------------------------------------------------------------------------------------
# Piezas de composición de nombres de entidades
# ---------------------------------------------------------------------------------------------------------------------
TIPOS_ORG = ["Corporación", "Fundación", "Asociación", "Colectivo", "Cooperativa", "Corporación Cultural", "Fundación Cultural", "Asociación Cultural", "Escuela", "Taller", "Casa", "Centro"]
SUSTANTIVOS_ORG = ["Cantares", "Raíces", "Tamboras", "Voces", "Ceibas", "Guaduales", "Resonancias", "Pregones", "Brújula Sonora", "Puentes Musicales", "Semilleros", "Aires", "Cuerdas Vivas", "Vientos", "Mareas",
                   "Cordilleras", "Alboradas", "Tonadas", "Compases", "Altavoces", "Armonías", "Retumbos", "Cadencias", "Ecos", "Madrugadas", "Senderos", "Fogones", "Rondas", "Pentagramas", "Estribillos"]
TIPOS_AGRUPACION = ["Orquesta", "Banda", "Ensamble", "Cuarteto", "Coro", "Conjunto", "Grupo", "Agrupación", "Trío", "Comparsa", "Batucada", "Chirimía", "Cuadrilla", "Murga", "Sexteto"]
TERMINOS_AGRUPACION = ["Los Hijos de", "Las Voces de", "Tres Aguas", "Sabor a", "Cuerdas de", "Tambores de", "Los de", "Brisas de", "Compás de", "Retumbar de"]
FESTIVAL_TIPOS = ["Festival", "Encuentro", "Muestra", "Jornadas", "Cumbre", "Ruta", "Convite", "Concurso", "Fiesta", "Gran Rueda", "Semana", "Cita", "Carnaval", "Feria", "Noches"]
PREPS = ["de", "del", "de la", "de los", "de las"]
MERCADO_TIPOS = ["Mercado", "Rueda de negocios", "Vitrina", "Encuentro de circulación", "Bazar sonoro", "Plataforma", "Feria profesional"]
RED_NOMBRES = ["Red", "Nodo", "Archivo", "Colección", "Centro de documentación", "Grupo de investigación", "Observatorio"]
TALLER_TIPOS = ["Taller", "Luthería", "Laboratorio", "Banco de instrumentos", "Escuela-taller", "Casa de instrumentos", "Atelier"]
ESPACIO_TIPOS = ["Sala", "Tarima", "Salón", "Patio", "Auditorio", "Casa", "Estudio", "Teatro", "Cancha", "Kiosco"]

CALLES = ["Carrera", "Calle", "Avenida", "Diagonal", "Transversal", "Carrera"]
BARRIOS = ["Centro", "El Prado", "La Candelaria", "San Antonio", "Los Libertadores", "El Recreo", "Villa Nueva", "La Esperanza", "San José", "Las Palmas", "El Bosque", "La Floresta", "Santa Ana", "El Carmen", "Policarpa",
           "San Fernando", "Alameda", "Los Almendros", "Buenos Aires", "Nuevo Horizonte", "El Paraíso", "San Rafael", "La Pradera", "Chapinero Bajo", "El Jardín", "Villa del Río"]

TIPOS_AGRUPACION_FAMILIA = {"tradicionales": ["Conjunto", "Grupo", "Agrupación", "Trío", "Cuarteto", "Sexteto"], "afro": ["Grupo", "Conjunto", "Chirimía", "Cuadrilla", "Agrupación"], "originarios": ["Grupo", "Agrupación"],
                            "academicas": ["Cuarteto", "Ensamble", "Orquesta", "Trío", "Coro"], "campesinas": ["Conjunto", "Grupo", "Cuadrilla", "Agrupación"], "comunitarias": ["Orquesta", "Banda", "Coro", "Ensamble"],
                            "frontera": ["Grupo", "Ensamble", "Agrupación"], "electronicas": ["Grupo", "Ensamble"], "escena": ["Ensamble", "Grupo"], "populares": ["Orquesta", "Grupo", "Conjunto", "Sexteto"],
                            "religiosas": ["Coro", "Grupo", "Conjunto"], "sinfonicas": ["Orquesta", "Banda", "Ensamble"], "urbanas": ["Grupo", "Banda", "Trío", "Cuarteto"], "vocales": ["Coro", "Cuarteto", "Ensamble", "Trío"],
                            "sonoras": ["Ensamble", "Grupo"], "bandas": ["Banda", "Batucada", "Comparsa", "Murga", "Cuadrilla"]}
TIPO_MERCADO_ART = {"Mercado": "un mercado", "Rueda de negocios": "una rueda de negocios", "Vitrina": "una vitrina", "Encuentro de circulación": "un encuentro de circulación", "Bazar sonoro": "un bazar sonoro",
                    "Plataforma": "una plataforma", "Feria profesional": "una feria profesional"}
ESPACIO_POR_AMBIENTE = {"cerrado": ["Sala", "Auditorio", "Estudio", "Teatro", "Salón", "Casa"], "abierto": ["Tarima", "Cancha", "Kiosco", "Patio"], "mixto": ["Casa", "Patio", "Salón", "Teatro"]}
AFORO_POR_AMBIENTE = {"cerrado": [40, 60, 80, 120, 150, 250], "abierto": [200, 400, 800, 1500], "mixto": [80, 120, 150, 250, 400]}
FAMILIAS_ARCHIVO = ["sonoras", "tradicionales", "afro", "campesinas", "originarios", "comunitarias", "vocales", "academicas"]
FAMILIAS_LUTERIA = ["tradicionales", "afro", "campesinas", "comunitarias", "sinfonicas", "populares", "originarios", "academicas", "bandas"]
