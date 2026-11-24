"""Perfiles N1 (12 a 18): Santander, piedemonte amazónico, Caldas, Neiva, Pereira y Nariño. Todo inventado."""

PERFILES = [
    dict(
        clave="martha-rangel", nombre=("Martha Lucía", "Rangel", "Ardila"), muni="68861", doc="cc", nacimiento=1969,
        corta="Tiplista, cantante de guabina y docente en Vélez; dirige la Corporación Guabina y Tiple y el festival del mismo nombre.",
        larga=(
            "Martha Lucía Rangel Ardila nació en una vereda de la provincia de Vélez, entre cultivos de guayaba y caminos de herradura, y aprendió la guabina en las veladas familiares de su casa, donde se cantaban las coplas con tiple y requinto después del rosario. "
            "Se hizo maestra de escuela, y durante veintiocho años dio clases en colegios rurales de la provincia, donde puso a los niños a recoger coplas de abuelos y a escribirlas en cuadernos que ella guardaba. Llegó a reunir mil trescientas coplas, "
            "que clasificó por tema: amor, cosecha, burla, política, difuntos.\n\n"
            "En 2006 fundó la Corporación Guabina y Tiple, que hoy mantiene una escuela de tiple, requinto, bandola y canto con noventa estudiantes de seis veredas y de la cabecera municipal. "
            "La escuela funciona los sábados en un colegio prestado y los miércoles por la tarde en una casa rural, y sus estudiantes tocan en las fiestas de la parroquia, en encuentros regionales y en el festival que organiza la corporación. "
            "Ha editado dos libros con coplas recogidas y un disco de guabinas veleñas grabado con sus estudiantes, que se reparte gratuitamente en escuelas de la provincia.\n\n"
            "Su trabajo como investigadora se concentra en las diferencias entre la guabina veleña y la de otras regiones, y en cómo la tradición se transforma cuando se pasa de la sala de la casa al escenario. "
            "Participó en un diplomado de patrimonio inmaterial, y dicta talleres de coplas y de tiple en universidades de Bucaramanga y Tunja. Colabora con una compositora coral de Pereira, Olga Mejía, que escribió arreglos corales de guabinas para el coro de la corporación, "
            "y mantiene un intercambio con la Corporación Música del Llano en Yopal, de donde han salido encuentros de tiple y arpa.\n\n"
            "Le han concedido el reconocimiento «Tiple de Honor» de una federación de músicos andinos (2014), el premio «Maestra Rural del Año» de una fundación educativa de Santander (2018) y el galardón «Guabina Mayor» en un festival de música andina en Boyacá (2022). "
            "Se jubiló del magisterio en 2023 para dedicarse por completo a la corporación. Sostiene que la guabina se canta para decir lo que no se puede decir de frente, y que por eso las coplas más antiguas siempre tienen un doble fondo que hay que descubrir. "
            "Para 2027 prepara la grabación de un disco con cuarenta coplas inéditas, cantadas por cuatro generaciones de su familia."
        ),
        roles=["Tiplista", "Cantante de guabina", "Docente rural", "Directora de corporación", "Recopiladora de coplas"],
        practicas=["musicas-campesinas-rurales-y-de-raiz-territorial", "musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-vocales-corales-y-de-tradicion-cantada"],
        rol=["interprete", "cantante", "docente", "investigador", "gestor"], servicio=["clases", "presentaciones", "investigacion", "direccion"], instrumento=["cordofonos", "voz"], territorio=["68861", "68", "15"],
        enlaces=[("https://guabinaytiple.test", "Corporación Guabina y Tiple"), ("https://marthalrangel.test", "Sitio personal"), ("https://archivo.guabinaytiple.test/coplas", "Archivo de coplas"), ("https://instagram.com/guabinaytiple.test", "Instagram")],
        portafolio=[
            dict(tipo="texto", titulo="Mil trescientas coplas de la provincia de Vélez", url="https://archivo.guabinaytiple.test/publicaciones/mil-trescientas-coplas", descripcion="Selección de coplas clasificadas por tema, recogidas por estudiantes entre 1998 y 2018.", anio=2019),
            dict(tipo="audio", titulo="Guabinas veleñas con estudiantes", url="https://archivo.guabinaytiple.test/audio/guabinas-velenas", descripcion="Disco grabado en una casa de campo con el coro de la corporación.", anio=2021),
            dict(tipo="video", titulo="Una velada de coplas en la vereda", url="https://archivo.guabinaytiple.test/video/velada-de-coplas", descripcion="Registro de una noche de guabina con tiple, requinto y coplas improvisadas.", anio=2023),
            dict(tipo="imagen", titulo="La escuela de tiple de los sábados", url="https://archivo.guabinaytiple.test/galeria/escuela-de-tiple", descripcion="Fotografías de las clases en el colegio prestado.", anio=2025),
        ],
        orgs=[("corp-guabina-y-tiple", "administrador", "Directora y fundadora", 2006), ("corp-musica-del-llano-casanare", None, "Intercambio de tiple y arpa", 2024)],
        festivales=[("n1.festival.festival-de-guabina-y-tiple-de-velez", "directora")],
        multimedia=[("foto", "Martha Rangel sentada con un tiple en el corredor de una casa de campo de Vélez"), ("galeria", "Estudiantes de la escuela de tiple tocando en círculo en un salón de colegio rural")],
    ),
    dict(
        clave="angela-burbano", nombre=("Ángela Rocío", "Burbano", "Delgado"), muni="86001", doc="cc", nacimiento=1980,
        corta="Etnomusicóloga que acompaña, bajo acuerdos con autoridades de pueblos originarios del piedemonte, el registro y la circulación de sus músicas desde Mocoa.",
        larga=(
            "Ángela Rocío Burbano Delgado estudió música en Pasto y una maestría en etnomusicología en una universidad del interior, donde su tesis versó sobre el modo en que las comunidades deciden qué se graba y qué se guarda en un archivo sonoro. "
            "Llegó a Mocoa en 2008 contratada por una escuela de música municipal, y desde entonces ha trabajado siempre en alianza con las autoridades y mayores de pueblos originarios del piedemonte amazónico, "
            "quienes definen los términos de cada proyecto: qué cantos se pueden registrar, quién los custodia, quién puede escucharlos y bajo qué condiciones. Esa manera de trabajar, lenta y con muchas reuniones, es la base de su método.\n\n"
            "En 2019 fundó, junto con integrantes de varios pueblos, docentes y jóvenes artistas, la Corporación Tejidos de Aire. Su misión es acompañar procesos de transmisión de flautas, cantos y músicas de ceremonia en escuelas y casas de saber, sin reemplazar el rol de los mayores. "
            "La corporación mantiene un fondo documental con acuerdos de uso firmados, ofrece talleres de construcción de flautas con maestros de la región y organiza el Encuentro de Flautas del Piedemonte Amazónico, "
            "que cada año reúne a intérpretes y constructores de Putumayo, Nariño, Cauca y Caquetá. Una parte de los materiales no se publica jamás: se conserva en la comunidad y sólo se consulta en reuniones con sus custodios.\n\n"
            "Como investigadora ha publicado artículos sobre propiedad colectiva del conocimiento sonoro y sobre los protocolos de consentimiento en el trabajo de campo, que se usan hoy en cursos universitarios. Dirige un semillero de jóvenes investigadores de Mocoa y asesora a otras organizaciones que quieren documentar sus músicas sin vulnerar derechos colectivos. "
            "Es también flautista y toca con un ensamble pequeño de flautas de pan y percusión, que se presenta en el Encuentro y en escuelas de la región.\n\n"
            "Ha recibido el reconocimiento «Palabra que Camina» de una red de procesos de memoria del piedemonte (2021), la beca de investigación en patrimonio inmaterial de la gobernación (2022) y el premio «Mejor Práctica de Consentimiento» de un congreso latinoamericano de archivos sonoros (2024). "
            "Reconoce que lo más importante que ha aprendido no está en los libros sino en las reuniones donde, antes de abrir la grabadora, alguien pregunta si todos están de acuerdo. "
            "Prepara con la corporación una guía abierta de acuerdos de uso para otras comunidades, que se publicará solo después de ser revisada por las autoridades con las que trabajó."
        ),
        roles=["Etnomusicóloga", "Flautista", "Investigadora de consentimiento y archivos sonoros", "Directora de corporación", "Docente universitaria"],
        practicas=["expresiones-sonoras-de-pueblos-originarios", "practicas-sonoras-arte-sonoro-archivo-investigacion-creacion-y-paisajes-sonoros", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical"],
        rol=["investigador", "interprete", "docente", "gestor"], servicio=["investigacion", "clases", "asesoria", "direccion"], instrumento=["aerofonos", "membranofonos", "voz"], territorio=["86001", "86", "52", "19"],
        enlaces=[("https://tejidosdeaire.test", "Corporación Tejidos de Aire"), ("https://angelaburbano.test", "Sitio personal"), ("https://archivo.tejidosdeaire.test/acuerdos", "Acuerdos de uso (guía)"), ("https://instagram.com/tejidosdeaire.test", "Instagram")],
        portafolio=[
            dict(tipo="texto", titulo="Antes de abrir la grabadora: protocolos de consentimiento en el trabajo de campo", url="https://archivo.tejidosdeaire.test/publicaciones/antes-de-abrir-la-grabadora", descripcion="Artículo sobre cómo se negocia qué se registra, quién custodia y quién escucha.", anio=2022),
            dict(tipo="texto", titulo="Guía abierta de acuerdos de uso (borrador para consulta)", url="https://archivo.tejidosdeaire.test/documentos/guia-de-acuerdos", descripcion="Modelo de acuerdo con ejemplos y comentarios, en revisión con autoridades.", anio=2026),
            dict(tipo="video", titulo="Taller de construcción de flautas con maestros del piedemonte", url="https://archivo.tejidosdeaire.test/video/taller-de-flautas", descripcion="Una semana de taller con constructores de tres municipios.", anio=2024),
            dict(tipo="imagen", titulo="Encuentro de Flautas del Piedemonte Amazónico", url="https://archivo.tejidosdeaire.test/galeria/encuentro-de-flautas", descripcion="Fotografías de las jornadas, con permiso de las comunidades participantes.", anio=2025),
        ],
        orgs=[("corp-tejidos-de-aire", "administrador", "Directora y cofundadora", 2019), ("colectivo-tierra-adentro", None, "Asesora en consentimiento y archivo", 2023)],
        festivales=[("n1.festival.encuentro-de-flautas-del-piedemonte-amazonico", "directora")],
        multimedia=[("foto", "Ángela Burbano tocando una flauta de caña en un patio con vegetación del piedemonte"), ("galeria", "Constructores y aprendices durante el taller de flautas de la corporación")],
    ),
    dict(
        clave="julian-arboleda", nombre=("Julián David", "Arboleda", "Cifuentes"), muni="17001", doc="cc", nacimiento=1983,
        corta="Compositor y director de ensambles de música contemporánea en Manizales; cofundó y disolvió el Colectivo Ensamble Pausa y hoy produce obras por encargo.",
        larga=(
            "Julián David Arboleda Cifuentes estudió composición en una universidad de Manizales y completó una maestría en música contemporánea en Bogotá, con una tesis sobre el uso de grabaciones de campo como material de partitura. "
            "Su música ocupa un lugar incómodo entre la sala de concierto y la instalación sonora: escribe para cuarteto de cuerdas y electrónica, para coro y objetos domésticos, para instrumentos acústicos y grabaciones de mercados de plaza. "
            "Ha estrenado más de cincuenta obras, varias de ellas por encargo de festivales y escuelas, y algunas se han tocado en salas del Eje Cafetero, Bogotá, Medellín y Cali.\n\n"
            "En 2014 cofundó el Colectivo Ensamble Pausa, un grupo de ocho músicos y diseñadores sonoros que durante seis años presentó conciertos-instalación en casas, fábricas y plazas de Manizales y Pereira. "
            "El ensamble trabajó con apoyos de convocatorias pequeñas y de funciones de entrada voluntaria, y llegó a editar un disco de piezas colectivas. Con la pandemia perdió a varios integrantes que se fueron a vivir a otras ciudades, "
            "y en 2023 los socios acordaron disolver el colectivo: la organización se cerró formalmente y su ficha en el sistema fue dada de baja por sus propios miembros, dejando constancia de lo hecho. "
            "Julián dice que fue una despedida tranquila, con un último concierto en una bodega y un archivo que quedó disponible en línea para quien quiera consultarlo.\n\n"
            "Hoy trabaja por encargo para orquestas juveniles, coros y compañías de danza, y dicta un curso de composición con grabaciones de campo en la universidad. Es el autor de «Mercado, siete de la mañana», una obra para cuarteto y paisaje sonoro que se estrenó en 2022 y que usa grabaciones de plazas de seis ciudades; "
            "la obra se grabó para un disco que publicó Altamira Discos en Medellín, sello con el que colabora como autor y como miembro del consejo de producción. También ha escrito piezas para bandas sinfónicas juveniles, en diálogo con directores de Boyacá y el Huila.\n\n"
            "Recibió una mención en un concurso de composición para orquesta de cámara convocado por una fundación de Bogotá (2016), la beca de creación para compositores del departamento de Caldas (2019) y el reconocimiento «Oído Abierto» de un festival de música contemporánea del Eje Cafetero (2024). "
            "Piensa que el trabajo de un compositor es parecido al de un carpintero que trabaja con lo que encuentra: el material es la ciudad, y la técnica consiste en no estorbarle. "
            "Prepara una obra para banda sinfónica y voces de niños de una escuela rural, que estrenará en 2027."
        ),
        roles=["Compositor", "Director de ensambles", "Diseñador sonoro", "Docente universitario"],
        practicas=["musicas-academicas-de-camara-contemporaneas-experimentales-y-de-vanguardia", "practicas-sonoras-arte-sonoro-archivo-investigacion-creacion-y-paisajes-sonoros", "musicas-para-escena-danza-audiovisual-e-interdisciplinariedad"],
        rol=["compositor", "director", "docente", "productor"], servicio=["composicion", "direccion", "clases", "grabacion"], instrumento=["cordofonos", "electrofonos"], territorio=["17001", "17", "66"],
        enlaces=[("https://julianarboleda.test", "Sitio personal"), ("https://archivo.ensamblepausa.test", "Archivo del Ensamble Pausa"), ("https://instagram.com/julian.arboleda.test", "Instagram")],
        portafolio=[
            dict(tipo="audio", titulo="Mercado, siete de la mañana (cuarteto y paisaje sonoro)", url="https://archivo.ensamblepausa.test/audio/mercado-siete-de-la-manana", descripcion="Obra de 24 minutos que usa grabaciones de plazas de mercado de seis ciudades.", anio=2022),
            dict(tipo="video", titulo="Último concierto del Ensamble Pausa en una bodega", url="https://archivo.ensamblepausa.test/video/ultimo-concierto", descripcion="Registro de la despedida del colectivo, con piezas de seis años de trabajo.", anio=2023),
            dict(tipo="texto", titulo="Grabaciones de campo como material de partitura", url="https://archivo.ensamblepausa.test/publicaciones/grabaciones-como-partitura", descripcion="Resumen de la tesis de maestría con ejemplos de notación.", anio=2015),
            dict(tipo="audio", titulo="Piezas colectivas del Ensamble Pausa", url="https://archivo.ensamblepausa.test/audio/piezas-colectivas", descripcion="Disco de ocho piezas creadas colectivamente entre 2016 y 2019.", anio=2019),
            dict(tipo="imagen", titulo="Conciertos-instalación en casas de Manizales", url="https://archivo.ensamblepausa.test/galeria/conciertos-en-casas", descripcion="Fotografías de las funciones de entrada voluntaria.", anio=2018),
        ],
        orgs=[("colectivo-ensamble-pausa", "administrador", "Cofundador (organización disuelta en 2023)", 2014), ("sello-altamira-discos", "editor", "Autor y miembro del consejo de producción", 2021)],
        festivales=[],
        multimedia=[("foto", "Julián Arboleda frente a un atril con una partitura y un micrófono de campo en una sala de ensayo"), ("galeria", "El Ensamble Pausa tocando entre las mesas de una bodega en Manizales")],
    ),
    dict(
        clave="karen-ospina", nombre=("Karen Daniela", "Ospina", "Gaitán"), muni="68001", doc="cc", nacimiento=1993,
        corta="Productora y DJ de músicas electrónicas y urbanas en Bucaramanga; mezcla cumbia, champeta y beats en sesiones barriales y produce showcases para ruedas de negocios.",
        larga=(
            "Karen Daniela Ospina Gaitán empezó a mezclar a los diecisiete años con dos reproductores de CD que su tío le prestó, en fiestas de colegio del norte de Bucaramanga. Estudió diseño de sonido y producción, trabajó en un estudio de publicidad durante tres años y descubrió "
            "que lo que quería era producir su propia música, sin tener que pasar por el filtro de una agencia. Hoy es una de las productoras más activas de la escena electrónica santandereana, con un sonido que mezcla cumbia, champeta, house y sonidos de mercados que ella misma graba.\n\n"
            "Su proyecto «Terral» combina sets en vivo con sintetizadores analógicos, samplers y una voz procesada que repite fragmentos de coplas grabadas en la provincia de Vélez. Ha publicado tres EP y un álbum en plataformas independientes, "
            "y sus presentaciones han pasado por festivales y clubes de Bucaramanga, Medellín, Cali y Barranquilla. Cada año dicta un taller de producción electrónica para mujeres jóvenes de barrios periféricos, donde se enseña desde el manejo de una interfaz de audio hasta cómo cobrar una presentación.\n\n"
            "Desde 2022 colabora con Marea Alta, la productora barranquillera de Margarita Buelvas, como programadora de la escena electrónica del Mercado de Músicas del Caribe, un trabajo que le ha permitido conectar a decenas de jóvenes productores con programadores de festivales. "
            "Fue showcase en dos ediciones del Carnaval Sonoro y coordinó una sesión de microfonía y mezcla para agrupaciones de gaitas que querían explorar el cruce con electrónica. "
            "Participa además en un colectivo de mujeres productoras del nororiente, que se reúnen cada mes para intercambiar equipos, archivos y trabajos.\n\n"
            "Su trabajo ha sido distinguido con el «Pulso Joven» de un festival de música electrónica de los Santanderes (2019), la beca de circulación para artistas emergentes del departamento (2021) y el reconocimiento «Productora Sonora» de un encuentro latinoamericano de mujeres en la música (2024). "
            "En el escenario lleva siempre una libreta con ideas sueltas y un par de audífonos viejos que le sirven de amuleto. Dice que prefiere tocar para cincuenta personas que bailan que para quinientas que graban con el celular. "
            "En 2027 publicará un disco hecho íntegramente con grabaciones de sus recorridos en bus por barrios de Bucaramanga."
        ),
        roles=["Productora musical", "DJ", "Docente de producción electrónica", "Programadora de escenas electrónicas"],
        practicas=["musicas-electronicas-digitales-produccion-sonora-y-nuevas-tecnologias", "musicas-urbanas-alternativas-e-independientes", "musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales"],
        rol=["productor", "interprete", "docente", "compositor"], servicio=["grabacion", "presentaciones", "clases", "composicion"], instrumento=["electrofonos", "voz"], territorio=["68001", "68", "08"],
        enlaces=[("https://karenospina.test", "Sitio personal"), ("https://terral.karenospina.test", "Proyecto Terral"), ("https://instagram.com/karen.terral.test", "Instagram")],
        portafolio=[
            dict(tipo="audio", titulo="Terral (álbum)", url="https://terral.karenospina.test/audio/terral-album", descripcion="Nueve piezas de cumbia, champeta y house con grabaciones de campo de la provincia de Vélez.", anio=2023),
            dict(tipo="video", titulo="Set en vivo en un patio de Bucaramanga", url="https://terral.karenospina.test/video/set-en-patio", descripcion="Sesión de cincuenta minutos con sintetizadores analógicos y samplers.", anio=2024),
            dict(tipo="texto", titulo="Cómo cobrar una presentación: guía para jóvenes productoras", url="https://terral.karenospina.test/guias/como-cobrar", descripcion="Documento del taller con ejemplos de tarifas y condiciones técnicas.", anio=2022),
            dict(tipo="imagen", titulo="Taller de producción para mujeres jóvenes", url="https://terral.karenospina.test/galeria/taller-de-produccion", descripcion="Fotografías de la edición 2025 del taller anual.", anio=2025),
        ],
        orgs=[("productora-marea-alta", "editor", "Programadora de la escena electrónica", 2022)],
        festivales=[("n1.mercado.mercado-de-musicas-del-caribe-marea-alta", "programadora electrónica")],
        multimedia=[("foto", "Karen Ospina detrás de una mesa de mezcla con sintetizadores en una sala con luces azules"), ("galeria", "Jóvenes productoras aprendiendo a usar una interfaz de audio durante el taller anual")],
    ),
    dict(
        clave="ruben-trujillo", nombre=("Rubén Darío", "Trujillo", "Cabrera"), muni="41001", doc="cc", nacimiento=1972,
        corta="Director de orquesta y violinista en Neiva; dirige la Orquesta Sinfónica Juvenil del Alto Magdalena y el festival sinfónico de la región.",
        larga=(
            "Rubén Darío Trujillo Cabrera aprendió a tocar el violín a los ocho años con una profesora de colegio que llevaba el instrumento en una funda de costal. Estudió en el conservatorio de Ibagué, se perfeccionó en Bogotá y trabajó como violinista de orquestas sinfónicas del interior durante quince años. "
            "En 2005 regresó a Neiva con una idea que muchos le dijeron que no funcionaría: crear una orquesta juvenil donde pudieran tocar chicos de todos los barrios, sin audiciones excluyentes y con instrumentos prestados.\n\n"
            "Esa idea se volvió la Fundación Orquesta Sinfónica Juvenil del Alto Magdalena, hoy con trescientos cincuenta niños y jóvenes distribuidos en tres niveles de orquesta, una banda de vientos y un coro. "
            "La fundación tiene sede en una casa adaptada en el barrio Calixto, un parque de instrumentos de ciento veinte unidades y un equipo de veintidós docentes. Ha presentado más de doscientos conciertos en Neiva, Pitalito, Garzón y La Plata, y ha realizado giras a Bogotá, Medellín y Cali. "
            "En 2012 comenzó el Festival Sinfónico del Alto Magdalena, una semana de conciertos, clínicas y encuentros de orquestas juveniles de la región.\n\n"
            "Rubén Darío dirige además un programa de formación de directores para bandas y orquestas de municipios pequeños, en el que ha participado Gilberto Pedraza, director de bandas de Boyacá, como invitado y asesor. "
            "Ha trabajado con compositores del Huila y del Eje Cafetero para encargar obras que combinen música sinfónica con repertorio tradicional: bambucos para orquesta de cuerdas, rajaleñas con ensamble de vientos y un concierto para arpa y orquesta que está en preparación con Eliécer Ríos, el arpista llanero.\n\n"
            "Ha recibido la distinción «Batuta de Bronce» del encuentro de orquestas del sur colombiano (2011), el reconocimiento «Maestro que Siembra» de la gobernación (2017) y el premio «Orquesta del Año» de una asociación de directores de orquesta (2023). "
            "Le preocupa la sostenibilidad económica de las orquestas juveniles, que dependen de convocatorias anuales, y trabaja con otras fundaciones de la región en un modelo de financiación compartida. "
            "Sigue tocando el violín los domingos con un cuarteto de amigos, para no olvidar lo que es estar sentado entre los músicos y no de pie frente a ellos."
        ),
        roles=["Director de orquesta", "Violinista", "Docente de cuerdas", "Gestor de orquestas juveniles", "Director de festival"],
        practicas=["musicas-sinfonicas-bandas-orquestas-y-grandes-formatos-instrumentales", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical", "musicas-academicas-de-camara-contemporaneas-experimentales-y-de-vanguardia"],
        rol=["director", "interprete", "docente", "gestor"], servicio=["direccion", "clases", "presentaciones", "gestion"], instrumento=["cordofonos", "aerofonos"], territorio=["41001", "41", "73"],
        enlaces=[("https://orquestaaltomagdalena.test", "Fundación Orquesta Sinfónica Juvenil"), ("https://rubentrujillo.test", "Sitio personal"), ("https://festival.orquestaaltomagdalena.test", "Festival Sinfónico"), ("https://instagram.com/orquesta.altomagdalena.test", "Instagram")],
        portafolio=[
            dict(tipo="video", titulo="Concierto de gala: veinte años de orquesta", url="https://orquestaaltomagdalena.test/video/concierto-de-gala", descripcion="Registro del concierto de aniversario con trescientos músicos en escena.", anio=2025),
            dict(tipo="audio", titulo="Bambucos y rajaleñas para orquesta", url="https://orquestaaltomagdalena.test/audio/bambucos-y-rajalenas", descripcion="Obras por encargo de compositores del Huila, grabadas por la orquesta de segundo nivel.", anio=2022),
            dict(tipo="texto", titulo="Un modelo de orquesta sin audiciones excluyentes", url="https://orquestaaltomagdalena.test/publicaciones/modelo-sin-audiciones", descripcion="Documento pedagógico sobre la organización de niveles y la entrega de instrumentos.", anio=2018),
            dict(tipo="imagen", titulo="La casa del barrio Calixto", url="https://orquestaaltomagdalena.test/galeria/casa-de-calixto", descripcion="Fotografías de la sede, los salones y el parque de instrumentos.", anio=2024),
            dict(tipo="enlace", titulo="Programa del Festival Sinfónico", url="https://festival.orquestaaltomagdalena.test/programa", descripcion="Calendario y sedes de la edición vigente.", anio=2026),
        ],
        orgs=[("fund-orquesta-juvenil-alto-magdalena", "administrador", "Director y fundador", 2005)],
        festivales=[("n1.festival.festival-sinfonico-del-alto-magdalena", "director")],
        multimedia=[("foto", "Rubén Trujillo dirigiendo una orquesta juvenil en un auditorio con la batuta levantada"), ("galeria", "Niños de la orquesta alistando sus violines antes de un concierto")],
    ),
    dict(
        clave="olga-mejia", nombre=("Olga Patricia", "Mejía", "Echeverri"), muni="66001", doc="cc", nacimiento=1959,
        corta="Compositora coral, directora de coros y docente en Pereira; escribe arreglos de músicas andinas para voces y acompaña coros comunitarios del Eje Cafetero.",
        larga=(
            "Olga Patricia Mejía Echeverri empezó a cantar en el coro de un colegio de monjas y no ha vuelto a parar. Estudió música en una universidad de Pereira, dirigió coros universitarios durante dos décadas y desde 2003 dedica buena parte de su tiempo a escribir arreglos corales de músicas tradicionales colombianas, "
            "con la convicción de que un coro puede ser el mejor vehículo para que una canción de torbellino o de guabina circule fuera de su región. Ha escrito más de trescientos arreglos, publicados en cuatro cuadernos que se distribuyen en escuelas de música y coros comunitarios.\n\n"
            "Su método parte de grabaciones de campo que le prestan investigadores y cultores: antes de arreglar una melodía, la escucha en la voz de quien la canta, aprende los giros que no aparecen en la partitura y los conserva en su escritura. "
            "Así nacieron sus arreglos de guabinas veleñas para el coro de la Corporación Guabina y Tiple, con quien trabaja desde 2019, y los de cantos de trabajo del Cauca para el coro del Colectivo Tierra Adentro, entre otros. "
            "Con ambos procesos mantiene un acuerdo según el cual las melodías y los textos siguen perteneciendo a las comunidades que los conservan, y sus arreglos se publican bajo licencias abiertas.\n\n"
            "Dirige el Coro de Cámara de la Universidad y el Coro Comunitario Voces de Cuba, un grupo de cuarenta vecinas y vecinos de su barrio que se reúnen los jueves por la noche en un salón de la junta comunal. "
            "Dicta un taller de dirección coral para maestros de escuela, y es jurada de concursos de coros en el Eje Cafetero y Antioquia. Es también autora de «Cantar juntos es otra cosa», un manual de ensayo para coros comunitarios sin experiencia, que ha tenido tres reimpresiones.\n\n"
            "Recibió el reconocimiento «Diapasón de Oro» de una asociación de directores corales del occidente colombiano (2009), el premio «Voces que Enseñan» de un festival de coros de Antioquia (2015) y el homenaje «Maestra de Coros» de la alcaldía de Pereira (2023). "
            "Prefiere que su perfil se mantenga visible solo para los usuarios de la plataforma: no busca más público, sino mejores colegas con quienes intercambiar arreglos y recomendaciones. "
            "Dice que el secreto de un buen coro no es la afinación sino la escucha: una voz que se oye a sí misma deja de oír a la de al lado, y entonces ya no es coro sino un montón de solistas."
        ),
        roles=["Compositora coral", "Directora de coros", "Arreglista", "Docente de dirección coral"],
        practicas=["musicas-vocales-corales-y-de-tradicion-cantada", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical", "musicas-campesinas-rurales-y-de-raiz-territorial"],
        rol=["compositor", "director", "docente"], servicio=["composicion", "direccion", "clases", "asesoria"], instrumento=["voz"], territorio=["66001", "66", "17"],
        enlaces=[("https://olgamejia.test", "Sitio personal"), ("https://archivo.olgamejia.test/arreglos", "Cuadernos de arreglos"), ("https://instagram.com/olga.coro.test", "Instagram")],
        portafolio=[
            dict(tipo="texto", titulo="Cantar juntos es otra cosa: manual de ensayo para coros comunitarios", url="https://archivo.olgamejia.test/publicaciones/cantar-juntos", descripcion="Guía práctica para ensayar con personas sin experiencia musical.", anio=2017),
            dict(tipo="texto", titulo="Cuadernos de arreglos corales de músicas colombianas", url="https://archivo.olgamejia.test/publicaciones/cuadernos-de-arreglos", descripcion="Cuatro volúmenes con más de trescientos arreglos de torbellinos, guabinas y cantos de trabajo.", anio=2021),
            dict(tipo="audio", titulo="Guabinas veleñas para coro mixto", url="https://archivo.olgamejia.test/audio/guabinas-para-coro", descripcion="Grabación con el coro de la Corporación Guabina y Tiple.", anio=2022),
            dict(tipo="video", titulo="Ensayo abierto del Coro Voces de Cuba", url="https://archivo.olgamejia.test/video/ensayo-abierto", descripcion="Una noche de jueves con cuarenta vecinas y vecinos del barrio.", anio=2024),
        ],
        orgs=[("corp-guabina-y-tiple", "editor", "Arreglista y directora invitada del coro", 2019), ("colectivo-tierra-adentro", None, "Arreglista del coro del colectivo", 2022)],
        festivales=[("n1.festival.festival-de-guabina-y-tiple-de-velez", "directora coral invitada")],
        visibilidad="solo_simus",
        multimedia=[("foto", "Olga Mejía con los brazos levantados dirigiendo a un coro de cuarenta personas en un salón comunal"), ("galeria", "Partituras de arreglos corales sobre un piano en la casa de la compositora")],
    ),
    dict(
        clave="fabian-rojas", nombre=("Fabián Ernesto", "Rojas", "Quintana"), muni="52356", doc="cc", nacimiento=1985,
        corta="Zampoñista y constructor de flautas andinas en Ipiales; fabrica quenas, zampoñas y rondadores y colabora con procesos de flautas del piedemonte y del Cauca.",
        larga=(
            "Fabián Ernesto Rojas Quintana creció en una finca del altiplano nariñense, donde el viento de las tardes se oye casi como un instrumento más. A los once años cortó su primer pedazo de carrizo para hacer una quena y descubrió que la caña, si se cortaba en luna menguante y se dejaba secar a la sombra, sonaba más dulce. "
            "Estudió licenciatura en música en Pasto, pero la mayor parte de lo que sabe de flautas lo aprendió de constructores mayores de la frontera con Ecuador, que le enseñaron a medir con la mano y a afinar con el oído antes que con el afinador.\n\n"
            "Hoy construye zampoñas de dos hileras, rondadores, quenas y pífanos, y ha fabricado más de mil doscientas flautas que se tocan en agrupaciones de Nariño, Cauca, Putumayo y el interior del país. "
            "Tiene un taller en el patio de su casa, con una pequeña sala de pruebas donde invita a los músicos a tocar cada flauta antes de llevársela, y un cuaderno de afinaciones donde registra cada instrumento con nombre propio. "
            "Con el apoyo de una beca de dotación, abrió un taller abierto de lutería de aerófonos donde enseña a seis jóvenes por semestre.\n\n"
            "Toca la zampoña en un ensamble de cámara de cuatro integrantes que mezcla repertorio andino y composiciones propias, y ha participado como músico invitado en grabaciones de grupos de Pasto, Cali y Bogotá. "
            "Acompaña como constructor al Colectivo Tierra Adentro en Popayán, donde dicta un taller anual de flautas, y participa en el Encuentro de Flautas del Piedemonte Amazónico de la Corporación Tejidos de Aire, "
            "donde trabaja con constructores de otras regiones y deja siempre una flauta como regalo para la escuela anfitriona.\n\n"
            "Ha recibido el reconocimiento «Caña de Oro» de una asociación de constructores de instrumentos del sur (2018), la beca de apoyo a la creación artesanal de la gobernación de Nariño (2021) y la mención «Aire que Enseña» de un festival de música andina de Ecuador y Colombia (2024). "
            "No tiene página personal: prefiere que lo encuentren por sus instrumentos. Dice que la parte más difícil de su oficio es la espera, porque una caña bien curada necesita meses de paciencia y los clientes casi siempre tienen prisa. "
            "Su próximo proyecto es un catálogo de afinaciones de zampoñas con grabaciones de cada nota, para que otros constructores puedan comparar."
        ),
        roles=["Zampoñista", "Constructor de flautas andinas", "Docente de lutería de aerófonos", "Músico de ensamble"],
        practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-de-frontera-diasporas-migraciones-e-interculturalidad", "expresiones-sonoras-de-pueblos-originarios"],
        rol=["interprete", "luthier", "docente"], servicio=["luteria", "clases", "presentaciones"], instrumento=["aerofonos"], territorio=["52356", "52", "86"],
        enlaces=[("https://flautasdeipiales.test", "Taller de flautas"), ("https://archivo.flautasdeipiales.test/afinaciones", "Cuaderno de afinaciones"), ("https://instagram.com/flautas.ipiales.test", "Instagram")],
        portafolio=[
            dict(tipo="audio", titulo="Zampoñas de dos hileras: cada nota", url="https://archivo.flautasdeipiales.test/audio/cada-nota", descripcion="Grabación de la escala completa de tres zampoñas de distinta afinación.", anio=2025),
            dict(tipo="video", titulo="De la caña a la quena", url="https://archivo.flautasdeipiales.test/video/de-la-cana-a-la-quena", descripcion="Proceso de corte, secado y afinación de una quena de siete orificios.", anio=2022),
            dict(tipo="texto", titulo="Cuaderno de afinaciones de zampoñas", url="https://archivo.flautasdeipiales.test/documentos/cuaderno-de-afinaciones", descripcion="Medidas y notas de cincuenta zampoñas construidas entre 2015 y 2025.", anio=2025),
            dict(tipo="imagen", titulo="El taller del patio", url="https://archivo.flautasdeipiales.test/galeria/taller-del-patio", descripcion="Fotografías de herramientas, cañas en secado y flautas terminadas.", anio=2023),
        ],
        orgs=[("corp-tejidos-de-aire", "editor", "Constructor invitado del encuentro de flautas", 2021), ("colectivo-tierra-adentro", None, "Tallerista anual de flautas", 2022)],
        festivales=[("n1.festival.encuentro-de-flautas-del-piedemonte-amazonico", "constructor invitado")],
        multimedia=[("foto", "Fabián Rojas probando una zampoña recién terminada en el patio de su taller en Ipiales"), ("galeria", "Cañas de carrizo secándose en un estante de madera dentro del taller")],
    ),
]
