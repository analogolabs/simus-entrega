"""Perfiles N1 (1 a 6): Pacífico chocoano y caucano, Caribe vallenato, Antioquia, Atlántico y Quindío. Todo inventado."""

PERFILES = [
    dict(
        clave="nubia-palacios", nombre=("Nubia Estela", "Palacios", "Mosquera"), muni="27001", doc="cc", nacimiento=1968,
        corta="Cantadora de alabaos y gualíes, docente e investigadora de las músicas del Pacífico chocoano; dirige el Cabildo Sonoro del Atrato en Quibdó.",
        larga=(
            "Nubia Estela Palacios Mosquera nació en un caserío del medio Atrato y llegó a Quibdó a los once años, cuando su familia se mudó detrás de un trabajo en el aserrío. "
            "Aprendió los alabaos de su abuela materna, que los cantaba en los velorios sin acompañamiento de instrumentos, y los gualíes en las novenas del barrio Medrano. Se formó como maestra normalista, "
            "estudió una licenciatura en pedagogía musical en Medellín y durante veinte años enseñó música en tres colegios públicos de Quibdó, donde armó coros de niñas y niños que cantaban versos recogidos en los patios de las casas.\n\n"
            "En 2004 fundó con otros maestros el Cabildo Sonoro del Atrato, hoy una corporación con sede propia que forma a unos cien jóvenes al año en canto, chirimía y percusión, y que sostiene un archivo de cantos de velorio grabados "
            "con mujeres mayores del río. De ese archivo salió su primer trabajo de investigación, «Cuando el muerto se despide cantando», una compilación de ciento doce alabaos con sus contextos de uso, que se distribuye gratis en escuelas "
            "y casas culturales del Pacífico. Más tarde coordinó con una universidad regional un diplomado para maestros de música de comunidades negras, del que se graduaron cuarenta y dos docentes de siete municipios.\n\n"
            "Como cantante ha participado en encuentros en Tumaco, Cali, Medellín y Bogotá, casi siempre como invitada de grupos de chirimía que quieren abrir la jornada con un alabao. Dirige desde 2015 el Festival de Chirimía y Alabaos del Atrato, "
            "que en cada edición reúne a las agrupaciones del río y de la costa en tres noches de música, conversatorios de mayores y talleres de construcción de instrumentos. Es defensora de que los cantos funerarios no se escenifiquen como espectáculo "
            "sin el permiso de las familias que los conservan, y ha redactado con su corporación un protocolo de uso que hoy citan otros procesos del país.\n\n"
            "Su trabajo ha recibido el reconocimiento «Raíz de Oro» a la labor formadora que entrega cada año una red de organizaciones afro del Pacífico (2019), la beca departamental de investigación en música tradicional (2021) y la mención de honor "
            "«Voz del Río» del encuentro de cantadoras del Bajo Baudó (2023). Actualmente prepara, junto con una productora de Medellín, el primer disco de alabaos de su corporación con grabaciones de campo remasterizadas y notas escritas por las propias cantadoras. "
            "Cuando no está en reuniones o en el aula, camina el malecón de Quibdó con una grabadora pequeña, por si el río le regala un canto."
        ),
        roles=["Cantadora de alabaos y gualíes", "Docente de música", "Investigadora de músicas del Pacífico", "Directora de festival", "Gestora cultural"],
        practicas=["musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras", "musicas-vocales-corales-y-de-tradicion-cantada", "musicas-religiosas-rituales-espirituales-y-devocionales"],
        rol=["cantante", "docente", "investigador", "gestor"], servicio=["clases", "presentaciones", "investigacion", "direccion"], instrumento=["voz", "membranofonos"], territorio=["27001", "27"],
        enlaces=[("https://nubiapalacios.test", "Sitio personal"), ("https://cabildosonoro.test", "Cabildo Sonoro del Atrato"), ("https://archivo.cabildosonoro.test/alabaos", "Archivo de alabaos"), ("https://instagram.com/nubia.palacios.test", "Instagram")],
        portafolio=[
            dict(tipo="texto", titulo="Cuando el muerto se despide cantando", url="https://archivo.cabildosonoro.test/publicaciones/cuando-el-muerto-se-despide-cantando", descripcion="Compilación de 112 alabaos con sus contextos de uso, recogidos entre 2008 y 2018 con cantadoras del medio Atrato.", anio=2018),
            dict(tipo="audio", titulo="Alabaos del medio Atrato (grabaciones de campo)", url="https://archivo.cabildosonoro.test/audio/alabaos-medio-atrato", descripcion="Selección de veinte cantos de velorio con consentimiento de las familias.", anio=2020),
            dict(tipo="video", titulo="Una noche de gualí en Medrano", url="https://archivo.cabildosonoro.test/video/gual-en-medrano", descripcion="Registro de una novena cantada con vecinas del barrio y el coro infantil de la corporación.", anio=2022),
            dict(tipo="texto", titulo="Protocolo de uso de cantos funerarios", url="https://archivo.cabildosonoro.test/documentos/protocolo-de-uso", descripcion="Acuerdos de la corporación para la circulación respetuosa de cantos de velorio.", anio=2021),
            dict(tipo="imagen", titulo="Galería del Festival de Chirimía y Alabaos 2025", url="https://archivo.cabildosonoro.test/galeria/festival-2025", descripcion="Cuarenta fotografías de las tres noches de la edición de 2025.", anio=2025),
        ],
        orgs=[("corp-cabildo-sonoro-del-atrato", "administrador", "Directora y fundadora", 2004)],
        festivales=[("n1.festival.festival-de-chirimia-y-alabaos-del-atrato", "directora")],
        multimedia=[("foto", "Retrato de Nubia Palacios cantando con la mano sobre el pecho, sentada en un patio de madera en Quibdó"), ("galeria", "Nubia dirigiendo un coro infantil en el patio de la sede del Cabildo Sonoro")],
    ),
    dict(
        clave="jhon-fredy-valencia", nombre=("Jhon Fredy", "Valencia", "Angulo"), muni="19318", doc="cc", nacimiento=1981,
        corta="Marimbero y constructor de marimbas de chonta en Guapi; enseña el oficio completo, de la tala de la palma a la afinación de las tablas.",
        larga=(
            "Jhon Fredy Valencia Angulo aprendió a tocar la marimba mirando a su tío en las fiestas de San Antonio, en una vereda del río Guapi, y a los quince años ya acompañaba arrullos con el bombo. "
            "Su verdadera escuela fue el taller de un maestro constructor que le enseñó a escoger la palma de chonta en menguante, a curarla durante meses y a afinar cada tabla raspándola por debajo hasta que suene en su nota. "
            "Desde 2008 construye marimbas de entre diez y veinte tablas, con resonadores de guadua, que se tocan hoy en agrupaciones del Pacífico caucano y nariñense y en varias escuelas de música de Cali.\n\n"
            "Tocó durante una década con una agrupación de música de marimba que recorrió festivales del litoral y llegó a presentarse en escenarios de Bogotá y Medellín. Dejó la gira cuando nació su segunda hija, "
            "y decidió dedicarse a enseñar. En 2016 abrió en Guapi un taller abierto donde recibe cada año a doce aprendices, la mayoría jóvenes que vienen de veredas del río, a quienes les cobra con trabajo: "
            "cada uno se lleva la marimba que construyó y deja otra para la escuela de su comunidad. Lleva un cuaderno con las medidas y afinaciones de cada instrumento, una especie de archivo técnico que le gustaría convertir en manual.\n\n"
            "Colabora con la Corporación Cabildo Sonoro del Atrato en un taller itinerante de marimba que viaja por comunidades del Chocó, y asesora a la productora de un festival de marimba en la costa nariñense. "
            "Es además cantaor de arrullos y chigualos, un repertorio que aprendió de su madre y que no suele grabar: prefiere cantarlo en las velaciones y en las clases, donde lo ven sus alumnos.\n\n"
            "Ha recibido el reconocimiento «Maestro de la Palma» que otorga la asamblea de constructores del Pacífico sur (2020) y una beca de dotación de herramientas para su taller (2022). "
            "En 2025 viajó invitado a un encuentro de lutería en el Eje Cafetero, donde conoció el trabajo de la Escuela de Lutería El Roble, con la que intercambia saberes sobre maderas y tratamientos. "
            "Su próximo proyecto es un manual ilustrado de construcción de marimba de chonta, escrito en lenguaje sencillo y con fotografías de cada paso, para que otros constructores puedan consultarlo sin depender de nadie."
        ),
        roles=["Marimbero", "Constructor de marimbas de chonta", "Cantaor de arrullos y chigualos", "Maestro formador"],
        practicas=["musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical", "musicas-campesinas-rurales-y-de-raiz-territorial"],
        rol=["interprete", "luthier", "docente", "cultor"], servicio=["luteria", "clases", "presentaciones"], instrumento=["idiofonos", "membranofonos", "voz"], territorio=["19318", "19", "52"],
        enlaces=[("https://marimbasdeguapi.test", "Taller de marimbas"), ("https://archivo.marimbasdeguapi.test/cuaderno", "Cuaderno de medidas"), ("https://instagram.com/jhonfredy.marimba.test", "Instagram")],
        portafolio=[
            dict(tipo="video", titulo="De la palma a la tabla: construcción de una marimba", url="https://archivo.marimbasdeguapi.test/video/de-la-palma-a-la-tabla", descripcion="Seguimiento de seis meses de la construcción de una marimba de dieciocho tablas.", anio=2021),
            dict(tipo="audio", titulo="Arrullos y chigualos de Guapi", url="https://archivo.marimbasdeguapi.test/audio/arrullos", descripcion="Cantos de velación con marimba y cununo grabados en una casa de Guapi.", anio=2019),
            dict(tipo="imagen", titulo="El taller abierto, doce aprendices", url="https://archivo.marimbasdeguapi.test/galeria/taller-abierto", descripcion="Fotografías de una jornada de afinación con los aprendices de 2025.", anio=2025),
            dict(tipo="texto", titulo="Medidas y afinaciones de la marimba de chonta", url="https://archivo.marimbasdeguapi.test/documentos/medidas-y-afinaciones", descripcion="Borrador del manual técnico con tablas de longitudes y notas por tabla.", anio=2026),
        ],
        orgs=[("corp-cabildo-sonoro-del-atrato", None, "Colaborador del taller itinerante de marimba", 2017), ("escuela-de-luteria-el-roble", None, "Intercambio de saberes sobre maderas", 2025)],
        festivales=[("n1.festival.festival-de-chirimia-y-alabaos-del-atrato", "maestro invitado")],
        multimedia=[("foto", "Jhon Fredy Valencia afinando una tabla de marimba de chonta en su taller de Guapi"), ("galeria", "Aprendices del taller de Guapi con las marimbas que construyeron")],
    ),
    dict(
        clave="rosalba-perez", nombre=("Rosalba del Carmen", "Pérez", "Ortega"), muni="20001", doc="cc", nacimiento=1974,
        corta="Acordeonera, cantante y compositora vallenata; dirige la Casa de la Música La Candelaria y forma niñas y mujeres acordeoneras en Valledupar.",
        larga=(
            "Rosalba del Carmen Pérez Ortega cuenta que el acordeón llegó a su casa por equivocación: su padre lo compró para su hermano mayor, que nunca lo tocó, y ella lo descolgó de un clavo a los nueve años para aprender de oído "
            "los paseos que sonaban en la radio. En un ambiente donde el instrumento era casi coto masculino, tuvo que ganarse el derecho a tocar en las parrandas del barrio, y lo hizo con una digitación rápida y una voz grave "
            "que se volvió su sello. Estudió música en la universidad de la región, se especializó en pedagogía del acordeón y empezó a dar clases en una escuela de barrio de Valledupar en 1999.\n\n"
            "Ha grabado cuatro discos, entre ellos «Cuerda de arena» (2012), con composiciones propias que mezclan paseos, merengues y puyas con historias de mujeres del valle del río Cesar. Sus letras, que durante años circularon sólo entre parranderas, "
            "han sido recogidas en un cancionero ilustrado que su casa de cultura reparte en colegios. Con su agrupación, integrada por acordeón, caja, guacharaca y coros, ha tocado en festivales del Caribe, en Bogotá y en un encuentro de músicas del mundo en Cartagena.\n\n"
            "En 2011 abrió la Casa de la Música La Candelaria, que comenzó con una sala prestada y hoy funciona en una casona restaurada del centro, con aulas de acordeón, caja y guacharaca, un auditorio pequeño y una biblioteca de partituras de oído "
            "escritas por sus estudiantes. Su programa «Acordeonas» ha formado a más de trescientas niñas y mujeres, algunas de las cuales ya dirigen sus propios grupos. Organiza además un encuentro anual de acordeoneras y cantadoras "
            "que reúne a intérpretes del Cesar, La Guajira y Magdalena en una semana de conciertos, clínicas y rondas de composición.\n\n"
            "Le han otorgado el reconocimiento «Acordeón de Plata» de una asociación de parranderos de la región (2016), la beca de creación en música tradicional del departamento (2018) y el homenaje «Mujer que Canta» del festival de mujeres del Valle (2022). "
            "Mantiene una línea de trabajo con jóvenes compositores, a quienes ayuda a registrar sus obras y a entender cómo se reparten los derechos de una canción. "
            "Su preocupación actual es qué pasa con las parrandas cuando las muchachas de su escuela se vayan a estudiar a otras ciudades, y por eso está armando una red de acordeoneras que se acompañen a distancia."
        ),
        roles=["Acordeonera", "Cantante y compositora", "Docente de acordeón", "Directora de casa de cultura"],
        practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical"],
        rol=["interprete", "cantante", "compositor", "docente", "director"], servicio=["clases", "presentaciones", "composicion", "direccion"], instrumento=["aerofonos", "membranofonos", "idiofonos", "voz"], territorio=["20001", "20"],
        enlaces=[("https://rosalbaperez.test", "Sitio personal"), ("https://lacandelaria.test", "Casa de la Música La Candelaria"), ("https://instagram.com/rosalba.acordeon.test", "Instagram"), ("https://archivo.lacandelaria.test/cancionero", "Cancionero")],
        portafolio=[
            dict(tipo="audio", titulo="Cuerda de arena (disco completo)", url="https://archivo.lacandelaria.test/audio/cuerda-de-arena", descripcion="Doce canciones propias, grabadas en 2012 con acordeón, caja, guacharaca y coros.", anio=2012),
            dict(tipo="texto", titulo="Cancionero Acordeonas", url="https://archivo.lacandelaria.test/publicaciones/cancionero-acordeonas", descripcion="Letras y acordes de cuarenta canciones escritas por niñas y mujeres del programa Acordeonas.", anio=2020),
            dict(tipo="video", titulo="Concierto de apertura del encuentro de acordeoneras", url="https://archivo.lacandelaria.test/video/apertura-encuentro", descripcion="Registro del concierto inaugural de la edición 2024.", anio=2024),
            dict(tipo="imagen", titulo="La casona de La Candelaria", url="https://archivo.lacandelaria.test/galeria/la-casona", descripcion="Antes y después de la restauración de la sede.", anio=2017),
            dict(tipo="enlace", titulo="Red de acordeoneras a distancia", url="https://acordeonas.lacandelaria.test", descripcion="Plataforma de acompañamiento entre ex alumnas que viven fuera de Valledupar.", anio=2026),
        ],
        orgs=[("casa-de-musica-la-candelaria", "administrador", "Directora y fundadora", 2011)],
        festivales=[("n1.festival.encuentro-de-acordeoneras-y-cantadoras-del-cesar", "directora")],
        multimedia=[("foto", "Rosalba Pérez tocando acordeón en el patio de la Casa de la Música La Candelaria"), ("galeria", "Estudiantes del programa Acordeonas ensayando en un salón con ventanas abiertas")],
    ),
    dict(
        clave="hernan-velasquez", nombre=("Hernán Darío", "Velásquez", "Zapata"), muni="05001", doc="cc", nacimiento=1976,
        corta="Productor fonográfico e ingeniero de sonido en Medellín; dirige Altamira Discos, un sello independiente de músicas tradicionales y alternativas.",
        larga=(
            "Hernán Darío Velásquez Zapata empezó a grabar a los dieciséis años, con un par de micrófonos prestados y una casetera, a los músicos de rock y música carrilera de su barrio en el occidente de Medellín. "
            "Estudió ingeniería de sonido, trabajó una década como técnico en estudios de grabación de la ciudad y descubrió que lo que más disfrutaba era sentarse con un artista a decidir cómo debía sonar un disco, no tanto manejar la consola. "
            "En 2009 fundó Altamira Discos junto con dos socios, con la idea de publicar música que no encontraba espacio en los catálogos comerciales: bambucos, torbellinos, música de cuerdas, rock instrumental, folclor urbano.\n\n"
            "El sello ha publicado cuarenta y un álbumes, diecisiete de ellos de agrupaciones de regiones distintas a Antioquia: un disco de chirimía del Pacífico, otro de arpa llanera, una grabación en vivo de bandas sinfónicas de Santander. "
            "Cada producción incluye un cuadernillo con notas escritas por los propios músicos y una ficha técnica que explica cómo se grabó. Hernán produjo personalmente más de la mitad, entre ellas el trabajo de una cantadora de alabaos del Chocó "
            "que se encuentra en preparación, y firma como ingeniero de masterización de otras treinta. Desarrolló además un modelo de contratos transparentes, en el que los artistas conservan sus derechos y el sello cobra un porcentaje solamente sobre las ventas.\n\n"
            "Dicta un taller anual de producción fonográfica para agrupaciones emergentes, en alianza con una caja de compensación, y es jurado frecuente de convocatorias de circulación. "
            "Coordina la Rueda de Sellos y Circulación del Noroccidente, un mercado que reúne a sellos, programadores y agrupaciones para tejer redes de distribución. Mantiene un archivo de cintas originales de grabaciones de campo que recibe en custodia de músicos mayores, "
            "digitalizadas con equipo propio y catalogadas con un sistema que desarrolló con un amigo programador.\n\n"
            "Su trabajo ha sido reconocido con el «Disco de Barro» del encuentro de sellos independientes de Colombia (2017), el premio de mejor producción regional en una feria de la música del Eje Cafetero (2019) y la nominación a la mejor ingeniería de sonido en un festival de cine y audio de Bogotá (2022). "
            "Sigue grabando en el estudio de la calle Colombia donde empezó, con una mesa de madera que fue de su abuelo carpintero. Dice que un buen disco debe sonar como la sala donde se grabó y no como un estudio cualquiera."
        ),
        roles=["Productor fonográfico", "Ingeniero de sonido", "Director de sello discográfico", "Docente de producción musical"],
        practicas=["musicas-urbanas-alternativas-e-independientes", "musicas-populares-tradicionales-regionales-y-patrimoniales", "practicas-sonoras-arte-sonoro-archivo-investigacion-creacion-y-paisajes-sonoros"],
        rol=["productor", "sonidista", "docente", "gestor"], servicio=["grabacion", "sonido", "asesoria", "gestion", "clases"], instrumento=["electrofonos", "cordofonos"], territorio=["05001", "05"],
        enlaces=[("https://altamiradiscos.test", "Altamira Discos"), ("https://archivo.altamiradiscos.test/cintas", "Archivo de cintas"), ("https://hernanvelasquez.test", "Sitio personal"), ("https://instagram.com/altamira.discos.test", "Instagram")],
        portafolio=[
            dict(tipo="audio", titulo="Catálogo sonoro de Altamira Discos (selección)", url="https://altamiradiscos.test/catalogo/seleccion", descripcion="Veinte fragmentos de producciones propias, de torbellinos a rock instrumental.", anio=2024),
            dict(tipo="texto", titulo="Guía de contratos claros para agrupaciones", url="https://altamiradiscos.test/guias/contratos-claros", descripcion="Modelo de contrato de edición fonográfica con comentarios línea por línea.", anio=2021),
            dict(tipo="video", titulo="Grabando una banda sinfónica en vivo", url="https://altamiradiscos.test/video/banda-en-vivo", descripcion="Documental breve sobre la grabación en Bucaramanga de una banda de cuarenta integrantes.", anio=2023),
            dict(tipo="imagen", titulo="Estudio de la calle Colombia", url="https://altamiradiscos.test/galeria/estudio", descripcion="Fotografías del estudio y de la mesa de madera de su abuelo.", anio=2020),
            dict(tipo="enlace", titulo="Rueda de Sellos y Circulación del Noroccidente", url="https://ruedadesellos.test", descripcion="Sitio del mercado que coordina cada año.", anio=2026),
        ],
        orgs=[("sello-altamira-discos", "administrador", "Director y cofundador", 2009), ("corp-cabildo-sonoro-del-atrato", None, "Productor del disco de alabaos", 2025)],
        festivales=[("n1.mercado.rueda-de-sellos-y-circulacion-del-noroccidente", "coordinador")],
        multimedia=[("foto", "Hernán Velásquez con audífonos frente a una consola de grabación en su estudio de Medellín"), ("galeria", "Músicos grabando en vivo en la sala del estudio de Altamira Discos")],
    ),
    dict(
        clave="margarita-buelvas", nombre=("Margarita Inés", "Buelvas", "Támara"), muni="08001", doc="cc", nacimiento=1979,
        corta="Gestora cultural y productora de festivales y ruedas de negocios en Barranquilla; dirige Marea Alta, productora de circulación para músicas del Caribe.",
        larga=(
            "Margarita Inés Buelvas Támara estudió comunicación social y empezó su carrera como periodista de una emisora cultural de Barranquilla, donde le tocó cubrir carnavales, festivales y ruedas de negocios antes de entender cómo se organizaban. "
            "A los veintiséis años pasó a producir: primero tarimas de carnaval, después giras pequeñas de agrupaciones de gaitas y tambores, y desde 2013 festivales completos. Esa mezcla de mirada periodística y manejo de presupuestos la convirtió en una de las productoras más solicitadas de la región.\n\n"
            "En 2014 fundó Marea Alta, una productora que hoy tiene un equipo de once personas y una red de cincuenta agrupaciones asociadas. Produce el Carnaval Sonoro Marea Alta, un festival de cuatro días que combina conciertos barriales con una rueda de negocios para programadores nacionales, "
            "y el Mercado de Músicas del Caribe, que reúne a agencias, sellos y festivales de ocho países de la cuenca. Cada edición incluye una mesa de asesoría legal y un ciclo de talleres sobre tarifas, contratos y derechos conexos, que ella misma diseñó "
            "después de ver cómo muchas agrupaciones aceptaban condiciones desfavorables por falta de información.\n\n"
            "Ha producido más de ochenta eventos, entre ellos giras de bandas de música de gaitas por el interior del país, tres ediciones de un festival de bullerengue y un ciclo de conciertos de cámara en patios coloniales. Dirige además un boletín quincenal de convocatorias "
            "que llega a cuatro mil suscriptores y escribe una columna mensual sobre economía de la música en un diario regional. Es madre de dos hijos y confiesa que lleva siempre en el bolso un cargador de celular, una libreta y unos tapones para los oídos.\n\n"
            "Los reconocimientos que ha recibido incluyen la mención «Caracol de Oro» a la gestión cultural del Caribe (2018), el premio «Productora del Año» de una asociación de empresarios de espectáculos (2020) y la distinción «Ola Larga» de un festival de música de las islas (2024). "
            "Es integrante de la junta de varias organizaciones de la región y asesora a grupos que preparan su primera participación en una rueda de negocios. Su proyecto más reciente es una plataforma de citas preprogramadas que permite a las agrupaciones preparar su showcase con dos meses de anticipación. "
            "Defiende que un festival bien producido es el que paga a tiempo, cuida a sus técnicos y deja algo útil en el barrio donde se monta."
        ),
        roles=["Gestora cultural", "Productora de eventos", "Periodista cultural", "Directora de productora"],
        practicas=["musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales", "musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-de-frontera-diasporas-migraciones-e-interculturalidad"],
        rol=["gestor", "productor"], servicio=["gestion", "asesoria", "direccion"], instrumento=[], territorio=["08001", "08", "13", "47"],
        enlaces=[("https://mareaalta.test", "Marea Alta"), ("https://margaritabuelvas.test", "Sitio personal"), ("https://boletin.mareaalta.test", "Boletín de convocatorias"), ("https://instagram.com/margarita.mareaalta.test", "Instagram")],
        portafolio=[
            dict(tipo="texto", titulo="Guía para llegar preparados a una rueda de negocios", url="https://mareaalta.test/guias/rueda-de-negocios", descripcion="Manual de veinte páginas con ejemplos de dosieres, tarifas y rider técnico.", anio=2022),
            dict(tipo="video", titulo="Carnaval Sonoro Marea Alta: documental de la edición 2025", url="https://mareaalta.test/video/carnaval-2025", descripcion="Cuatro días de producción vistos desde la bodega hasta la tarima.", anio=2025),
            dict(tipo="imagen", titulo="Archivo fotográfico de producción", url="https://mareaalta.test/galeria/produccion", descripcion="Fotografías de montaje, pruebas de sonido y ruedas de negocios, 2014 a 2025.", anio=2025),
            dict(tipo="enlace", titulo="Plataforma de citas preprogramadas", url="https://citas.mareaalta.test", descripcion="Herramienta para agendar reuniones entre agrupaciones y programadores.", anio=2026),
        ],
        orgs=[("productora-marea-alta", "administrador", "Directora y fundadora", 2014)],
        festivales=[("n1.festival.carnaval-sonoro-marea-alta", "directora"), ("n1.mercado.mercado-de-musicas-del-caribe-marea-alta", "directora")],
        multimedia=[("foto", "Margarita Buelvas coordinando el montaje de una tarima con un radio en la mano"), ("galeria", "Equipo de producción de Marea Alta repasando el cronograma antes de abrir puertas")],
    ),
    dict(
        clave="luis-ernesto-castano", nombre=("Luis Ernesto", "Castaño", "Ríos"), muni="63001", doc="cc", nacimiento=1962,
        corta="Maestro luthier de cuerdas en Armenia; funda y dirige la Escuela de Lutería El Roble, donde se aprende a construir tiples, guitarras y bandolas.",
        larga=(
            "Luis Ernesto Castaño Ríos creció en un taller de carpintería de Calarcá, donde su padre fabricaba muebles y, en los ratos libres, tiples para los vecinos. "
            "A los diecinueve años construyó su primera guitarra a partir de un manual fotocopiado, y a los veintitrés viajó a Bogotá a trabajar con un maestro luthier de origen español, con quien aprendió durante seis años a seleccionar tapas, a encolar con cola caliente "
            "y a restaurar instrumentos antiguos. Regresó al Quindío en 1992 y abrió un taller que hoy reconoce cualquiera que toque cuerdas tradicionales en el Eje Cafetero.\n\n"
            "Ha construido más de seiscientos instrumentos, desde tiples y requintos hasta guitarras clásicas y bandolas andinas, y restaurado cerca de mil cuatrocientos. Una parte importante de su trabajo es restaurar instrumentos para escuelas de música de municipios pequeños, a quienes cobra solamente los materiales. "
            "Con ese principio nació en 2007 la Escuela de Lutería El Roble, una institución de formación en oficios con tres niveles: acercamiento, construcción y restauración. Cada año reciben a veinticuatro aprendices y tienen una lista de espera de casi el doble. "
            "La escuela cuenta con un taller de maderas, un cuarto de barnices, una sala de pruebas acústicas y una pequeña biblioteca técnica.\n\n"
            "Su metodología combina el saber del taller con instrumentos de medición actuales: usa un analizador de espectro para comparar las respuestas de distintas tapas y una cámara termográfica para estudiar cómo se seca la madera. "
            "Documentó cada paso de la restauración de una bandola de 1920 en un registro fotográfico y audiovisual que se ha vuelto un recurso para otros luthiers. En 2024, una gestora cultural de Bogotá, Camila Restrepo, grabó en su taller un documental corto sobre ese proceso, "
            "que se proyecta en las clases de la escuela y que Luis Ernesto agradece porque, dice, «por fin sus alumnos ven a qué hora hay que soltar la prensa».\n\n"
            "Se le ha reconocido con el «Cedro Mayor» de la Asociación de Constructores de Instrumentos del Eje (2015), el premio «Taller que Enseña» del programa de oficios de una caja de compensación (2019) y la medalla «Manos de Armenia» del concejo municipal (2023). "
            "Organiza el Encuentro Nacional de Lutería y Cuerdas, una feria con exposición de instrumentos, clínicas de restauración y concierto de cierre. Su gran deseo es que la escuela sobreviva a su generación, y por eso está formando a tres antiguos alumnos como docentes."
        ),
        roles=["Luthier de cuerdas", "Restaurador de instrumentos", "Docente de lutería", "Director de escuela de oficios", "Guitarrista"],
        practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-campesinas-rurales-y-de-raiz-territorial", "musicas-academicas-de-camara-contemporaneas-experimentales-y-de-vanguardia"],
        rol=["luthier", "docente", "interprete"], servicio=["luteria", "clases", "asesoria"], instrumento=["cordofonos"], territorio=["63001", "63", "66"],
        enlaces=[("https://luteriaelroble.test", "Escuela de Lutería El Roble"), ("https://luisernestocastano.test", "Sitio personal"), ("https://archivo.luteriaelroble.test/restauraciones", "Registro de restauraciones"), ("https://instagram.com/luteria.elroble.test", "Instagram")],
        portafolio=[
            dict(tipo="video", titulo="Restauración de una bandola de 1920", url="https://archivo.luteriaelroble.test/video/bandola-1920", descripcion="Documental corto sobre el proceso de restauración, grabado en el taller en 2024.", anio=2024),
            dict(tipo="texto", titulo="Manual de restauración de cuerdas tradicionales", url="https://archivo.luteriaelroble.test/documentos/manual-restauracion", descripcion="Pasos, herramientas y materiales para recuperar tiples y bandolas con fisuras.", anio=2022),
            dict(tipo="imagen", titulo="Registro fotográfico de mil instrumentos restaurados", url="https://archivo.luteriaelroble.test/galeria/restauraciones", descripcion="Fichas con fotografías de antes y después de instrumentos intervenidos desde 1992.", anio=2025),
            dict(tipo="audio", titulo="Un mismo repertorio en cinco tapas distintas", url="https://archivo.luteriaelroble.test/audio/cinco-tapas", descripcion="Comparación sonora de guitarras construidas con tapas de abeto, cedro y pino.", anio=2023),
            dict(tipo="enlace", titulo="Encuentro Nacional de Lutería y Cuerdas", url="https://encuentro.luteriaelroble.test", descripcion="Programa e inscripción de la feria anual.", anio=2026),
        ],
        orgs=[("escuela-de-luteria-el-roble", "administrador", "Director y fundador", 2007)],
        festivales=[("n1.festival.encuentro-nacional-de-luteria-y-cuerdas", "director")],
        multimedia=[("foto", "Luis Ernesto Castaño sosteniendo la tapa armónica de una guitarra frente a la ventana de su taller"), ("galeria", "Aprendices de la Escuela El Roble tallando el brazo de una bandola")],
    ),
]
