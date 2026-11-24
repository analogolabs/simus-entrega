"""Perfiles N1 (7 a 12): Cauca, Llanos, Amazonía, Archipiélago, Boyacá y Santander. Todo inventado."""

PERFILES = [
    dict(
        clave="claudia-munoz", nombre=("Claudia Patricia", "Muñoz", "Bolaños"), muni="19001", doc="cc", nacimiento=1971,
        corta="Cantante e investigadora de cantos de trabajo del alto Cauca; coordina el Colectivo Tierra Adentro en Popayán y acompaña procesos de memoria sonora rural.",
        larga=(
            "Claudia Patricia Muñoz Bolaños estudió antropología en Popayán y cantó desde niña en el coro de una parroquia, pero fue durante su trabajo de grado, en una vereda de la cordillera, cuando entendió "
            "que el repertorio que quería estudiar no estaba en los libros sino en las voces de quienes cosechaban café, ordeñaban y tejían: cantos de arriería, de trilla, de azada, coplas de siembra. Recorrió durante cuatro años veintidós veredas "
            "con una grabadora de mano y un cuaderno, y volvió a cada una para devolver las grabaciones a las familias, una costumbre que mantiene hasta hoy.\n\n"
            "En 2009 fundó el Colectivo Tierra Adentro, una red de investigadores, cantantes y maestros rurales que hoy reúne a cuarenta personas de once municipios del Cauca y el sur del Valle. El colectivo mantiene un archivo comunitario "
            "con seiscientas grabaciones de cantos de trabajo, ofrece talleres de escritura de coplas en escuelas rurales y organiza el Encuentro de Cantos de Trabajo de Popayán, donde cada año se reúnen cantadoras y cantadores de varias generaciones. "
            "Los materiales siempre se publican con el consentimiento de las familias y bajo licencias que ellas mismas deciden.\n\n"
            "Como intérprete forma un dúo de voz y tiple con una maestra de música de Timbío, con quien ha grabado dos discos sin instrumentación electrónica, sólo voces, cuerdas y los sonidos del ambiente donde se grabó. "
            "Su investigación más conocida es «Coplas que cuelgan del aire», un estudio sobre los cantos que acompañan el trabajo en las fincas cafeteras, que aparecerá como libro en 2027. "
            "Desde 2023 colabora con una gestora cultural de Bogotá, Camila Restrepo, que acompañó en campo la grabación de un registro de cantos del alto Cauca y ayudó a organizar la documentación del archivo comunitario.\n\n"
            "Ha recibido el reconocimiento «Voz de la Cordillera» del encuentro de maestros rurales del Cauca (2017), la beca de investigación en memoria sonora del departamento (2020) y el premio «Escuela que Canta» por su trabajo con colegios rurales (2024). "
            "Es además consejera de cultura de su municipio y representante de los procesos de memoria ante la mesa departamental. Cuando le preguntan qué la mueve, responde que es la manera en que las señoras mayores explican una copla: primero la cantan, luego cuentan para qué la usaban, y al final se ríen del verso que no entiende nadie. "
            "Su próximo proyecto es un mapa sonoro del alto Cauca que permita escuchar los cantos en el lugar donde se grabaron."
        ),
        roles=["Cantante", "Investigadora de cantos de trabajo", "Antropóloga", "Coordinadora de colectivo", "Docente rural"],
        practicas=["musicas-campesinas-rurales-y-de-raiz-territorial", "musicas-vocales-corales-y-de-tradicion-cantada", "practicas-sonoras-arte-sonoro-archivo-investigacion-creacion-y-paisajes-sonoros"],
        rol=["cantante", "investigador", "docente", "gestor"], servicio=["investigacion", "clases", "presentaciones", "asesoria"], instrumento=["voz", "cordofonos"], territorio=["19001", "19", "76"],
        enlaces=[("https://tierraadentro.test", "Colectivo Tierra Adentro"), ("https://archivo.tierraadentro.test/cantos", "Archivo de cantos de trabajo"), ("https://claudiamunoz.test", "Sitio personal"), ("https://instagram.com/tierraadentro.cauca.test", "Instagram")],
        portafolio=[
            dict(tipo="audio", titulo="Cantos de trabajo del alto Cauca (selección)", url="https://archivo.tierraadentro.test/audio/seleccion-alto-cauca", descripcion="Cuarenta grabaciones de campo de cosechadoras, arrieros y tejedoras, con el consentimiento de las familias.", anio=2023),
            dict(tipo="texto", titulo="Coplas que cuelgan del aire (capítulos de avance)", url="https://archivo.tierraadentro.test/publicaciones/coplas-avance", descripcion="Tres capítulos del libro sobre cantos en fincas cafeteras.", anio=2026),
            dict(tipo="audio", titulo="Voz y tiple: un dúo sin pantallas", url="https://archivo.tierraadentro.test/audio/voz-y-tiple", descripcion="Segundo disco del dúo con la maestra de Timbío, grabado en una casa de campo.", anio=2021),
            dict(tipo="imagen", titulo="Veredas del alto Cauca", url="https://archivo.tierraadentro.test/galeria/veredas", descripcion="Retratos de cantadoras y paisajes de las veintidós veredas del trabajo de campo.", anio=2019),
            dict(tipo="enlace", titulo="Mapa sonoro del alto Cauca", url="https://mapa.tierraadentro.test", descripcion="Prototipo de mapa con cantos geolocalizados.", anio=2026),
        ],
        orgs=[("colectivo-tierra-adentro", "administrador", "Coordinadora y fundadora", 2009)],
        festivales=[("n1.festival.encuentro-de-cantos-de-trabajo-de-popayan", "directora")],
        multimedia=[("foto", "Claudia Muñoz con una grabadora de mano junto a una cantadora en el corredor de una casa de campo"), ("galeria", "Mujeres de una vereda del Cauca cantando durante una jornada de devolución de grabaciones")],
    ),
    dict(
        clave="eliecer-rios", nombre=("Eliécer Antonio", "Ríos", "Barragán"), muni="85001", doc="cc", nacimiento=1973,
        corta="Arpista, cuatrista y compositor llanero de Yopal; dirige la Corporación Música del Llano y organiza el festival de arpa y cuatro del Casanare.",
        larga=(
            "Eliécer Antonio Ríos Barragán nació en una finca ganadera del piedemonte casanareño, donde la música era parte de la jornada: se cantaba al ordeñar, se zapateaba al terminar y los domingos se armaba un joropo con arpa, cuatro y maracas. "
            "Su padre, vaquero y arpista aficionado, le puso a los siete años un arpa de tres cuartos en las manos. Estudió en una escuela de música de Yopal, donde un maestro le enseñó a leer partituras sin perder el oído, y a los veinte años ya acompañaba cantantes en las ferias de la región.\n\n"
            "Su carrera ha sido a la vez de intérprete y de gestor. Como arpista grabó tres discos de joropo instrumental y con voz, el más conocido «Camino de verano» (2008), y compuso más de ochenta obras, entre pasajes, golpes y corridos, algunas de las cuales se han vuelto repertorio de escuelas llaneras. "
            "Como gestor creó en 2005 la Corporación Música del Llano, que hoy mantiene una escuela de formación en arpa, cuatro, bandola llanera y canto con ciento cincuenta niños y jóvenes en Yopal y cuatro municipios del Casanare, "
            "y un programa de formación de maestros rurales de música. En su escuela se enseña la técnica y también el contexto: cómo se cantaba para arrear ganado, qué se decía en una contra, cuándo se ejecutaba cada golpe.\n\n"
            "Dirige el Festival Llanero de Arpa y Cuatro del Casanare, que se realiza hace dieciséis años, y mantiene un archivo con grabaciones de maestros mayores de la región, muchas de ellas recogidas en visitas a fincas. "
            "Ha trabajado con grupos de otras regiones, como un ensamble de cuerdas pulsadas del Eje Cafetero con el que grabó una versión de un pasaje llanero con tiple y bandola andina. Es defensor de la presencia de mujeres y jóvenes en una música que por mucho tiempo fue casi exclusivamente masculina, "
            "y tres de sus profesoras son arpistas formadas en su escuela.\n\n"
            "Ha recibido el «Arpa de Oro» de una federación de músicos llaneros (2013), la beca de circulación de la gobernación para su gira por Europa del Este (2016) y el reconocimiento «Maestro del Piedemonte» (2022). "
            "Dice que el joropo es una música de espera: espera el verano, espera la fiesta, espera la voz que falta, y que ese ritmo lento es lo que lo distingue. Trabaja actualmente en una obra para arpa y orquesta de cámara encargada por una orquesta juvenil de la región."
        ),
        roles=["Arpista", "Cuatrista", "Compositor", "Director de corporación", "Docente de música llanera"],
        practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-campesinas-rurales-y-de-raiz-territorial", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical"],
        rol=["interprete", "compositor", "docente", "gestor", "director"], servicio=["clases", "presentaciones", "composicion", "direccion", "gestion"], instrumento=["cordofonos", "idiofonos", "voz"], territorio=["85001", "85", "50"],
        enlaces=[("https://eliecerrios.test", "Sitio personal"), ("https://musicadelllano.test", "Corporación Música del Llano"), ("https://archivo.musicadelllano.test/maestros", "Archivo de maestros mayores"), ("https://instagram.com/eliecer.arpa.test", "Instagram")],
        portafolio=[
            dict(tipo="audio", titulo="Camino de verano (disco completo)", url="https://archivo.musicadelllano.test/audio/camino-de-verano", descripcion="Doce piezas de joropo instrumental y con voz, grabadas en 2008 con arpa, cuatro, bandola y maracas.", anio=2008),
            dict(tipo="texto", titulo="Cancionero llanero para escuelas", url="https://archivo.musicadelllano.test/publicaciones/cancionero-escuelas", descripcion="Cuarenta piezas con partitura y notas sobre su contexto de uso.", anio=2019),
            dict(tipo="video", titulo="Una contra a campo abierto", url="https://archivo.musicadelllano.test/video/contra-a-campo-abierto", descripcion="Registro de una contra entre dos copleros en una finca del piedemonte.", anio=2021),
            dict(tipo="audio", titulo="Pasaje con tiple y bandola andina", url="https://archivo.musicadelllano.test/audio/pasaje-con-tiple", descripcion="Colaboración con un ensamble de cuerdas pulsadas del Eje Cafetero.", anio=2023),
            dict(tipo="imagen", titulo="Escuela de arpa de Yopal", url="https://archivo.musicadelllano.test/galeria/escuela-de-arpa", descripcion="Fotografías de las clases en los cuatro municipios de la corporación.", anio=2025),
        ],
        orgs=[("corp-musica-del-llano-casanare", "administrador", "Director y fundador", 2005), ("fund-orquesta-juvenil-alto-magdalena", None, "Solista invitado del concierto para arpa y orquesta", 2026)],
        festivales=[("n1.festival.festival-llanero-de-arpa-y-cuatro-del-casanare", "director")],
        multimedia=[("foto", "Eliécer Ríos tocando el arpa llanera bajo un techo de palma en una finca de Casanare"), ("galeria", "Niños de la escuela de arpa de Yopal en una clase al aire libre")],
    ),
    dict(
        clave="tatiana-cardozo", nombre=("Tatiana Lucía", "Cardozo", "Ferreira"), muni="91001", doc="cc", nacimiento=1988,
        corta="Cantante e investigadora de músicas de frontera en la triple frontera amazónica; impulsa el trabajo de la Fundación Maloca Sonora en Leticia.",
        larga=(
            "Tatiana Lucía Cardozo Ferreira creció en Leticia entre el portugués de su abuela paterna, que había cruzado desde Tabatinga en los años sesenta, el español de su madre y las lenguas que se escuchaban en el mercado y en el puerto. "
            "Esa mezcla de idiomas y músicas moldeó su manera de cantar: baladas románticas en portugués, cumbias peruanas, boleros colombianos, y las canciones de cuna que aprendió de vecinas de distintos pueblos. "
            "Estudió música con énfasis en canto en Bogotá, regresó a su ciudad en 2014 y empezó a trabajar como docente en colegios y como cantante en bares y fiestas familiares.\n\n"
            "A partir de 2017 se interesó por registrar las músicas de la triple frontera entre Colombia, Perú y Brasil, un repertorio que casi no aparece en los catálogos nacionales. Con una beca de investigación pequeña y la ayuda de un amigo sonidista grabó cuarenta canciones "
            "en casas, barcos y salones comunales de Leticia, Puerto Nariño, Tabatinga y Santa Rosa, y las organizó en un archivo digital llamado «Canciones de tres orillas». Ese trabajo se convirtió en una investigación sobre la circulación de canciones entre pueblos vecinos que ya fue presentada en dos congresos académicos.\n\n"
            "En 2025 fundó, junto con un grupo de músicas y educadoras de la ciudad, la Fundación Maloca Sonora, que aspira a abrir una casa de música en Leticia con aulas de canto, un estudio sencillo y un programa de intercambio con colectivos de las ciudades hermanas. "
            "La fundación se encuentra en proceso de consolidación: tiene personería jurídica reciente y apenas está completando su equipo y su primera convocatoria. Mientras tanto, Tatiana coordina talleres de canto en tres colegios y un espacio mensual de ronda abierta en un salón prestado.\n\n"
            "Ha recibido el reconocimiento «Voz del Río» del encuentro de jóvenes artistas de la Amazonía (2021) y una residencia de investigación de dos meses en una casa de cultura de Manaos (2023). "
            "Trabaja con un cuaderno donde apunta quién le enseñó cada canción, para poder devolver los créditos cuando el archivo se publique. Su sueño es que alguien entre a un bus en Leticia y escuche, por el parlante del conductor, una canción de cuna que ella grabó en una cocina. "
            "En el escenario canta con una guitarra acústica, un cajón y una voz que mezcla la dulzura de las baladas con la dureza de quien conoce el río."
        ),
        roles=["Cantante", "Investigadora de músicas de frontera", "Docente de canto", "Fundadora de organización"],
        practicas=["musicas-de-frontera-diasporas-migraciones-e-interculturalidad", "musicas-vocales-corales-y-de-tradicion-cantada", "practicas-sonoras-arte-sonoro-archivo-investigacion-creacion-y-paisajes-sonoros"],
        rol=["cantante", "investigador", "docente", "gestor"], servicio=["clases", "presentaciones", "investigacion", "gestion"], instrumento=["voz", "cordofonos", "membranofonos"], territorio=["91001", "91", "95"],
        enlaces=[("https://tatianacardozo.test", "Sitio personal"), ("https://malocasonora.test", "Fundación Maloca Sonora"), ("https://archivo.malocasonora.test/tres-orillas", "Canciones de tres orillas"), ("https://instagram.com/tatiana.tresorillas.test", "Instagram")],
        portafolio=[
            dict(tipo="audio", titulo="Canciones de tres orillas (avance del archivo)", url="https://archivo.malocasonora.test/audio/tres-orillas-avance", descripcion="Veinte de las cuarenta canciones grabadas en Leticia, Puerto Nariño, Tabatinga y Santa Rosa.", anio=2022),
            dict(tipo="texto", titulo="Cantar entre idiomas: la circulación de canciones en la frontera", url="https://archivo.malocasonora.test/publicaciones/cantar-entre-idiomas", descripcion="Ponencia presentada en dos congresos de estudios musicales.", anio=2023),
            dict(tipo="video", titulo="Ronda abierta en un salón comunal de Leticia", url="https://archivo.malocasonora.test/video/ronda-abierta", descripcion="Registro de una sesión mensual con vecinas, niños y músicos aficionados.", anio=2026),
            dict(tipo="imagen", titulo="Archivo de tres orillas: retratos", url="https://archivo.malocasonora.test/galeria/retratos", descripcion="Fotografías de las personas que prestaron sus canciones.", anio=2022),
        ],
        orgs=[("fund-maloca-sonora", "administrador", "Fundadora y representante", 2025)],
        festivales=[("n1.festival.encuentro-de-musicas-de-las-tres-fronteras", "directora")],
        multimedia=[("foto", "Tatiana Cardozo cantando con una guitarra sobre el muelle del río en Leticia al atardecer"), ("galeria", "Vecinas en una ronda de canciones en un salón comunal de Leticia")],
    ),
    dict(
        clave="dennis-bryan", nombre=("Dennis Wilfred", "Bryan", "Forbes"), muni="88001", doc="cc", nacimiento=1964,
        corta="Guitarrista, cantante y maestro de mento y calipso en San Andrés; lidera la Asociación Sonidos del Archipiélago.",
        larga=(
            "Dennis Wilfred Bryan Forbes creció en San Luis, al oriente de San Andrés, en una casa de madera donde el inglés raizal se hablaba en la cocina, el español en la escuela y el creole en la calle. "
            "Su padre era pescador y tocaba una guitarra de cuerdas de nylon con la que acompañaba mentos y calipsos los sábados por la noche; su madre cantaba en el coro de la iglesia bautista. "
            "Dennis aprendió ambas tradiciones, y a los dieciséis años ya tocaba en los hoteles de la isla. Estudió música en una universidad del interior, trabajó varios años como músico de crucero y regresó en 1997 con la decisión de dedicarse a la enseñanza.\n\n"
            "En 2003 fundó la Asociación Sonidos del Archipiélago, una pequeña organización que hoy tiene su sede en un local alquilado de San Luis y se dedica a mantener vivas las músicas raizales: mento, calipso, schottische, mazurca, polka y baladas en creole. "
            "La asociación ofrece clases de guitarra, mandolina, tina y quijada de burro a unos sesenta niños y adolescentes, y organiza el Festival de Músicas del Archipiélago, un encuentro de dos días en San Andrés que se hace con presupuesto muy ajustado y mucho trabajo voluntario. "
            "Tiene pocas conexiones externas y pocos proyectos, y eso lo asume con humor: «somos pequeños, pero llevamos más de veinte años haciendo lo mismo, y eso también es una forma de ser grandes».\n\n"
            "Como intérprete lidera un trío con mandolina y contrabajo que toca los viernes en un restaurante frente al mar y viaja una vez al año al continente a presentarse en festivales. "
            "Ha grabado dos discos de baladas en creole con textos propios, y colabora con una investigadora de la isla en la transcripción de canciones tradicionales que aprendió de su abuela. "
            "Es maestro invitado de un programa de formación de músicos en Providencia y Santa Catalina, y consejero de cultura de su municipio.\n\n"
            "Ha sido reconocido con el «Quijada de Oro» de una asociación de músicos raizales (2012), la condecoración «Hijo Ilustre de San Luis» de su barrio (2018) y la beca de preservación del patrimonio inmaterial de la gobernación (2021). "
            "Su mayor preocupación es la pérdida del idioma entre los jóvenes, que cada vez cantan menos en creole, y por eso las canciones de sus clases se enseñan con letra en las dos lenguas. "
            "Su proyecto para 2027 es una grabación de ochenta canciones con ancianos del archipiélago, que ya empezó con una grabadora portátil y una conversación al atardecer."
        ),
        roles=["Guitarrista", "Cantante de mento y calipso", "Docente de música raizal", "Director de asociación"],
        practicas=["musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras", "musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical"],
        rol=["interprete", "cantante", "docente", "cultor", "director"], servicio=["clases", "presentaciones", "direccion"], instrumento=["cordofonos", "idiofonos", "voz"], territorio=["88001", "88"],
        enlaces=[("https://dennisbryan.test", "Sitio personal"), ("https://sonidosdelarchipielago.test", "Asociación Sonidos del Archipiélago"), ("https://instagram.com/dennis.mento.test", "Instagram")],
        portafolio=[
            dict(tipo="audio", titulo="Baladas en creole (disco)", url="https://sonidosdelarchipielago.test/audio/baladas-en-creole", descripcion="Doce baladas con textos propios y de la tradición oral, grabadas en San Andrés.", anio=2014),
            dict(tipo="video", titulo="Mento en la terraza: un viernes en San Luis", url="https://sonidosdelarchipielago.test/video/mento-en-la-terraza", descripcion="Registro de una noche con el trío y vecinos que se suman al canto.", anio=2022),
            dict(tipo="texto", titulo="Cancionero bilingüe del archipiélago", url="https://sonidosdelarchipielago.test/publicaciones/cancionero-bilingue", descripcion="Treinta canciones con letra en creole y español para uso en clases.", anio=2020),
            dict(tipo="imagen", titulo="La tina, la quijada y la mandolina", url="https://sonidosdelarchipielago.test/galeria/instrumentos", descripcion="Fotografías de los instrumentos que se enseñan en la asociación.", anio=2019),
        ],
        orgs=[("asoc-sonidos-del-archipielago", "administrador", "Director y fundador", 2003)],
        festivales=[("n1.festival.festival-de-musicas-del-archipielago", "director")],
        multimedia=[("foto", "Dennis Bryan sentado en un porche de madera con una guitarra frente al mar caribe"), ("galeria", "Niños de la asociación aprendiendo a tocar la quijada de burro")],
    ),
    dict(
        clave="gilberto-pedraza", nombre=("Gilberto Alfonso", "Pedraza", "Suárez"), muni="15759", doc="cc", nacimiento=1957,
        corta="Director de bandas sinfónicas y trombonista en Sogamoso; formó una generación de músicos boyacenses y hoy conserva el archivo de las bandas de paz.",
        larga=(
            "Gilberto Alfonso Pedraza Suárez ingresó a la banda municipal de Sogamoso a los trece años como aprendiz de bombardino, porque el director de entonces necesitaba un niño que cupiera detrás de las flautas. "
            "Allí aprendió solfeo, armonía básica y la disciplina de ensayar tres veces por semana. Se fue a estudiar a Bogotá, regresó con un título de dirección de bandas y trabajó cuarenta años como maestro de banda en escuelas, colegios y la propia banda municipal, "
            "que dirigió desde 1987 hasta su jubilación en 2018. Ha conducido ensayos, giras y concursos, y ha formado a más de mil quinientos músicos, entre ellos directores de bandas en otros departamentos.\n\n"
            "En 2003 fundó la Corporación Bandas de Boyacá, una organización que agrupó a doce bandas de municipios de la región, organizó intercambios de repertorio y de directores, y promovió el Festival de Bandas de Paz de Boyacá, "
            "un encuentro de tres días que llegó a reunir a cuarenta bandas en la plaza de Sogamoso. La corporación publicó diecisiete arreglos de música campesina boyacense para banda y editó un método de enseñanza que sigue usándose en escuelas rurales. "
            "A raíz de su jubilación y de un cambio en el equipo directivo, la corporación suspendió actividades en 2024: el festival se pausó y quedaron pendientes varios proyectos, y su ficha se conserva solo como memoria del proceso.\n\n"
            "Hoy Gilberto se dedica a ordenar el archivo de la corporación, que reúne partituras manuscritas, fotografías, programas de mano y grabaciones de más de cincuenta años de bandas boyacenses. Digitaliza cada pieza en una oficina cedida por la casa de la cultura y dicta, dos veces por semana, clases de trombón a jóvenes de barrios periféricos. "
            "Colabora también con una orquesta juvenil del Huila, a la que asesora en el trabajo con bandas de vientos, y participa como jurado en concursos de bandas del centro del país.\n\n"
            "Recibió la condecoración «Batuta de Plata» de la Asociación de Directores de Banda del Centro (2008), el reconocimiento «Hijo Predilecto de Sogamoso» del concejo (2015) y el homenaje «Maestro de Maestros» de las escuelas de música de Boyacá (2019). "
            "Dice que una banda es una escuela de ciudadanía: allí se aprende a esperar el turno, a escuchar al vecino y a equivocarse sin que se acabe el mundo. Su deseo es que algún día la corporación retome el festival, aunque sea en un formato más pequeño y con directores jóvenes al frente."
        ),
        roles=["Director de banda sinfónica", "Trombonista", "Arreglista", "Docente de vientos", "Archivista musical"],
        practicas=["musicas-sinfonicas-bandas-orquestas-y-grandes-formatos-instrumentales", "musicas-campesinas-rurales-y-de-raiz-territorial", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical"],
        rol=["director", "interprete", "docente", "compositor"], servicio=["direccion", "clases", "composicion", "investigacion"], instrumento=["aerofonos", "membranofonos"], territorio=["15759", "15"],
        enlaces=[("https://bandasdeboyaca.test", "Corporación Bandas de Boyacá"), ("https://archivo.bandasdeboyaca.test", "Archivo de bandas"), ("https://gilbertopedraza.test", "Sitio personal")],
        portafolio=[
            dict(tipo="texto", titulo="Método para bandas rurales de Boyacá", url="https://archivo.bandasdeboyaca.test/publicaciones/metodo-bandas-rurales", descripcion="Libro de ejercicios y repertorio básico para bandas de municipios pequeños.", anio=2010),
            dict(tipo="audio", titulo="Arreglos de música campesina boyacense para banda", url="https://archivo.bandasdeboyaca.test/audio/arreglos-campesinos", descripcion="Diecisiete arreglos grabados por la banda municipal de Sogamoso.", anio=2014),
            dict(tipo="imagen", titulo="Cincuenta años de bandas boyacenses", url="https://archivo.bandasdeboyaca.test/galeria/cincuenta-anos", descripcion="Fotografías digitalizadas de bandas, uniformes y plazas, de 1970 a 2020.", anio=2022),
            dict(tipo="video", titulo="Último festival de bandas de paz (2023)", url="https://archivo.bandasdeboyaca.test/video/ultimo-festival", descripcion="Registro del desfile y los conciertos de la última edición antes de la pausa.", anio=2023),
        ],
        orgs=[("corp-bandas-de-boyaca", "administrador", "Director fundador (hasta 2024)", 2003), ("fund-orquesta-juvenil-alto-magdalena", None, "Asesor en bandas de vientos", 2022)],
        festivales=[("n1.festival.festival-de-bandas-de-paz-de-boyaca", "director fundador")],
        multimedia=[("foto", "Gilberto Pedraza de pie frente a una banda de vientos en la plaza de Sogamoso con la batuta en la mano"), ("galeria", "Partituras manuscritas del archivo de la corporación extendidas sobre una mesa")],
    ),
]
