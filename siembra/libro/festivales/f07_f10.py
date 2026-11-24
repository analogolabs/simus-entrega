from ._comun import ed

# --- Insular: borrador con una edición en preparación -------------------------------------------------------------
F07 = dict(
    clave="encuentro-de-quadrille-y-calipso-del-cove", nombre="Encuentro de Quadrille y Calipso del Cove", org="casa-cultural-del-cove", muni="88001", estado="borrador", trayectoria="borrador",
    periodicidad="anual", periodicidad_detalle="Está previsto para la temporada de lluvias de mitad de año; la primera edición se está organizando para junio de 2027.",
    practicas=["musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical"],
    territorio="insular", director="Audrey Archbold Pomare", tipo_organizador="casa-cultural", cobertura="municipal",
    desc=("La casa cultural del Cove lleva años recibiendo a abuelos que quieren mostrar cómo se bailaba la quadrille y a jóvenes que quieren aprender calipso en inglés criollo. De esas tardes nació la idea de un encuentro en el barrio, con ensayos abiertos que culminen en una noche de baile en la cancha comunal.\n\n"
          "La propuesta se apoya en tres ejes: la transmisión entre generaciones, la defensa del inglés criollo como lengua de canto y el cruce entre repertorios de San Andrés, Providencia y las comunidades raizales del Caribe centroamericano, que comparten baladas, letras de mento y formas de bailar que cada isla guarda con matices propios. Contempla una semana de ensayos, una rueda de calipso, una clase pública de quadrille y un conversatorio de mayores sobre la historia de la música de las islas.\n\n"
          "La identidad del encuentro es isleña y doméstica: la tarima se arma con tablones de una cancha, los niños bailan descalzos y el menú incluye rondón y pan de coco."),
    contacto=dict(correo_organizador="casa@casadelcove.test", telefono_organizador="+57 608 555 0770", sitio_organizador="https://casadelcove.test",
                  instagram="https://instagram.test/quadrilleycalipso", facebook="https://facebook.test/quadrilleycalipso", otro="https://casadelcove.test/ensayos",
                  telefono="+57 608 555 0771", obs="Se atiende por la tarde; en temporada alta los mensajes pueden demorar."),
    aliados=["Escuela de Música Raizal del Barrio San Luis", "Radio comunitaria de la isla"],
    enlaces=[("https://casadelcove.test/borrador-de-programa.pdf", "Borrador de programa de la primera edición.")],
    ediciones=[
        ed(2027, 1, None, "Tablones y calipso", "Cancha comunal del barrio Cove",
           "Primera edición en preparación, sin fechas confirmadas. Se planea una semana de ensayos abiertos, una rueda de calipso y una clase pública de quadrille dirigida por bailarines mayores.",
           [(0, "17:00", "Ensayo abierto de quadrille", "formacion", "Cancha comunal del Cove", "Bailarines mayores enseñan los pasos a jóvenes que sólo conocen la quadrille por fotografías."),
            (1, "19:00", "Rueda de calipso", "conciertos-y-presentaciones", "Cancha comunal del Cove", "Cantantes de varias generaciones alternan calipsos en inglés criollo.")],
           estado="en_preparacion", tipologia="encuentros", fuente1="recursos-propios", fuente2="alcaldia"),
    ],
)

# --- Orinoquía: rechazado, sin ediciones -----------------------------------------------------------------------
F08 = dict(
    clave="encuentro-de-musicas-del-orinoco-y-la-frontera", nombre="Encuentro de Músicas del Orinoco y la Frontera", org="colectivo-orinoco-sonoro", muni="99001", estado="rechazado", trayectoria="rechazo",
    periodicidad="otra_regular", periodicidad_detalle="Propuesta de realización cada año al finalizar el invierno, aún sin fechas ni lugar definidos.",
    practicas=["musicas-de-frontera-diasporas-migraciones-e-interculturalidad", "musicas-populares-tradicionales-regionales-y-patrimoniales"],
    territorio="joropo", director="Jhon Fredy Peñaloza Cárdenas", tipo_organizador="comunitario", cobertura="departamental",
    desc=("Propuesta de un encuentro regional que reúna joropo de sabana, músicas de la ribera del Orinoco y ritmos de la frontera con Venezuela. El colectivo promotor, con sede en Puerto Carreño, quiere invitar a agrupaciones de ambos lados del río y programar clínicas de arpa y cuatro durante dos jornadas.\n\n"
          "La idea surgió de las tertulias que los integrantes sostienen cada sábado en la plaza, donde se cruzan repertorios de llaneros, de comunidades de la ribera y de familias que migraron en distintos momentos. "
          "Plantean además una mesa abierta sobre cómo circula la música en territorios de frontera, con invitados de emisoras y de casas de cultura, y un registro sonoro de piezas que cruzan el Orinoco y casi nunca se escuchan fuera de su zona.\n\n"
          "El colectivo imagina un evento sencillo, con escenario sobre la ribera, comida compartida y entrada libre, que pueda repetirse cada año al finalizar el invierno."),
    contacto=dict(correo_organizador="colectivo@orinocosonoro.test", telefono_organizador="+57 608 555 0880", sitio_organizador="https://orinocosonoro.test", instagram="https://instagram.test/orinocosonoro",
                  facebook=None, otro=None, telefono=None, obs="Por ahora sólo se atiende por correo."),
    aliados=[], enlaces=[], ediciones=[],
)

# --- Putumayo: una sola edición futura, ficha publicada ---------------------------------------------------------
F10 = dict(
    clave="encuentro-de-flautas-y-tambores-del-valle-alto", nombre="Encuentro de Flautas y Tambores del Valle Alto", org="asoc-flautas-del-valle-alto", muni="86749", estado="publicado", trayectoria="directo",
    periodicidad="bienal", periodicidad_detalle="Se realiza cada dos años en la temporada de cosecha del maíz; la primera edición está programada para 2027.",
    practicas=["expresiones-sonoras-de-pueblos-originarios", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical", "musicas-campesinas-rurales-y-de-raiz-territorial"],
    territorio="practicas-de-pueblos-indigenas", director="Cecilia Mavisoy Tisoy", tipo_organizador="comunitario", cobertura="departamental",
    desc=("La asociación convoca por primera vez a flautistas, tamboreros y constructores de instrumentos de las comunidades del Valle de Sibundoy y de poblaciones vecinas del Alto Putumayo para un encuentro de dos jornadas durante la cosecha del maíz. "
          "La iniciativa surge de las reuniones mensuales en las que los mayores explican el origen de cada pieza antes de tocarla, y del interés de los jóvenes por entender qué se les permite grabar y qué no.\n\n"
          "El programa prevé conciertos al amanecer en las chagras, clases de flauta de caña y tambor para niños, una exposición de instrumentos y una conversación pública sobre cuidado del conocimiento sonoro. "
          "Entre sus objetivos están fortalecer la transmisión dentro de las familias, abrir un espacio respetuoso de encuentro con visitantes y dejar claras las reglas para el uso de imágenes y grabaciones.\n\n"
          "La identidad del encuentro es la del valle: se come maíz tostado y chicha de mazorca, los instrumentos se afinan al aire libre y cada pieza se presenta con una breve explicación en las lenguas de la comunidad y en español."),
    contacto=dict(correo_organizador="flautas@valletalto.test", telefono_organizador="+57 608 555 0990", sitio_organizador="https://flautasdelvallealto.test", instagram="https://instagram.test/flautasdelvallealto",
                  facebook="https://facebook.test/flautasdelvallealto", otro="https://flautasdelvallealto.test/reglas-de-registro", telefono="+57 608 555 0991",
                  obs="Se atiende en la sede de la asociación los martes y jueves; para consultas sobre grabaciones se pide cita."),
    aliados=["Escuela Rural Agropecuaria del Valle", "Cooperativa de Mujeres Tejedoras del Valle"],
    enlaces=[("https://flautasdelvallealto.test/reglas-de-registro.pdf", "Reglas acordadas por las familias para registrar y difundir las piezas."), ("https://flautasdelvallealto.test/programa-2027.pdf", "Programa preliminar de la edición 2027.")],
    ediciones=[
        ed(2027, 1, ((9, 17), (9, 18)), "Flautas al amanecer", "Chagras comunitarias y casa de la asociación, Sibundoy",
           "Primera edición programada para septiembre de 2027, con conciertos al amanecer en las chagras, clases de flauta y tambor para niños y una exposición de instrumentos hechos por las familias.",
           [(0, "06:00", "Concierto al amanecer en la chagra", "conciertos-y-presentaciones", "Chagra comunitaria", "Flautistas y tamboreros abren la jornada con piezas ligadas a la cosecha, presentadas por los mayores."),
            (0, "14:00", "Clase de flauta de caña para niños", "formacion", "Casa de la asociación", "Constructores y maestros enseñan a cortar la caña y a afinar las notas."),
            (1, "10:00", "Conversación sobre cuidado del conocimiento sonoro", "encuentros-y-dialogos", "Casa de la asociación", "Las familias explican las reglas de registro y qué piezas no se difunden.")],
           estado="programada", agenda=True, tipologia="encuentros", fuente1="recursos-propios", fuente2="alcaldia"),
    ],
)
