"""Organizaciones N1 (8 a 14): Llano, Amazonía, Archipiélago, Boyacá (inactiva), Santander, piedemonte y Caldas (disuelta). Todo inventado."""

ORGANIZACIONES = [
    dict(
        clave="corp-musica-del-llano-casanare", nombre="Corporación Música del Llano", tipo="Comunitario", muni="85001", estado="activa", admin="eliecer-rios",
        fundada=2005, dias=300, dominio="musicadelllano.test", telefono="+57 608 555 0108", direccion="Carrera 20 n.º 8-45, Yopal", nit="999.108.208-7",
        facebook="https://facebook.com/musicadelllano.test", instagram="https://instagram.com/musicadelllano.test", otro="https://archivo.musicadelllano.test",
        desc=(
            "La Corporación Música del Llano se fundó en 2005 en Yopal para que los niños del piedemonte aprendan arpa, cuatro, bandola llanera y canto sin tener que irse a estudiar a otra ciudad. La dirige el arpista y compositor Eliécer Ríos, y hoy atiende a ciento cincuenta niños y jóvenes en Yopal y en cuatro municipios del Casanare, con un equipo de doce docentes, tres de ellas arpistas formadas en la propia escuela.\n\n"
            "Además de las clases, mantiene un programa de formación de maestros rurales de música, un archivo de grabaciones de maestros mayores recogidas en visitas a fincas y un cancionero llanero para escuelas con cuarenta piezas y notas sobre su contexto de uso. "
            "Cada año organiza el Festival Llanero de Arpa y Cuatro del Casanare, que cumple dieciséis años y reúne a intérpretes del Casanare, Arauca, Meta y Vichada en cuatro noches de música y dos días de clínicas.\n\n"
            "La corporación trabaja en red con otras organizaciones de las músicas tradicionales: mantiene un intercambio de tiple y arpa con la Corporación Guabina y Tiple de Vélez, de la maestra Martha Rangel, y su director participará como solista invitado en el concierto para arpa y orquesta de la Fundación Orquesta Sinfónica Juvenil del Alto Magdalena.\n\n"
            "Su ámbito es el Casanare y el piedemonte llanero. Sus agrupaciones asociadas son el Ensamble de Arpas del Casanare, el Grupo Infantil Pasajeros y la Orquesta Llanera Juvenil."
        ),
        cambios=[
            (295, "numeroIdentificacion", "NIT", "identificacion", None, "999.108.208-7", "directo", "admin", "Registro del NIT de la corporación."),
            (200, "descripcion", "Descripción", "publico", "Escuela de música llanera en Yopal.", "Escuela de arpa, cuatro, bandola y canto con ciento cincuenta estudiantes en cinco municipios del Casanare.", "directo", "admin", "Actualización de cobertura territorial."),
        ],
        invitaciones=[("docente.arpa@simus.test", "editor", "aceptada", 110)],
        revision=295,
        multimedia=[("logo", "Logotipo de Música del Llano: un arpa llanera cuyas cuerdas forman un horizonte de sabana")],
        documentos=[("cancionero-llanero-para-escuelas", "Cancionero llanero para escuelas", "pdf")],
        proyectos=["Escuela de arpa, cuatro y bandola", "Formación de maestros rurales", "Archivo de maestros mayores", "Festival Llanero de Arpa y Cuatro del Casanare"],
        agrupaciones=["Ensamble de Arpas del Casanare", "Grupo Infantil Pasajeros", "Orquesta Llanera Juvenil"],
        festivales=[("n1.festival.festival-llanero-de-arpa-y-cuatro-del-casanare", "organizadora")],
    ),
    dict(
        clave="fund-maloca-sonora", nombre="Fundación Maloca Sonora", tipo="Fundación", muni="91001", estado="pendiente_de_confirmacion", admin="tatiana-cardozo",
        fundada=2025, dias=6, dominio="malocasonora.test", telefono="+57 608 555 0109", direccion=None, nit=None,
        facebook=None, instagram="https://instagram.com/malocasonora.test", otro="https://archivo.malocasonora.test/tres-orillas",
        desc=(
            "La Fundación Maloca Sonora acaba de registrarse y quiere abrir en Leticia una casa de música para la triple frontera entre Colombia, Perú y Brasil. La fundó en 2025 la cantante e investigadora Tatiana Cardozo con un grupo de músicas y educadoras de la ciudad, a partir de un archivo de cuarenta canciones recogidas en Leticia, Puerto Nariño, Tabatinga y Santa Rosa.\n\n"
            "Por ahora la fundación tiene un equipo de cuatro personas, sin sede propia, y desarrolla talleres de canto en tres colegios y una ronda abierta mensual en un salón comunal prestado. Su propuesta es construir con el tiempo aulas de canto, un estudio sencillo y un programa de intercambio con colectivos de las ciudades vecinas. "
            "Todavía no ha confirmado el correo de la organización en la plataforma, por lo que su ficha aparece pendiente de confirmación.\n\n"
            "Su territorio es Leticia y las orillas del Amazonas. No tiene todavía número de identificación tributaria registrado ni agrupaciones asociadas."
        ),
        cambios=[
            (6, "descripcion", "Descripción", "publico", None, "Fundación nueva que quiere abrir una casa de música en Leticia para la triple frontera.", "directo", "admin", "Alta inicial de la organización."),
        ],
        invitaciones=[("educadora.canto@simus.test", "editor", "pendiente", 4)],
        revision=None,
        multimedia=[("logo", "Logotipo de Maloca Sonora: el techo cónico de una maloca con una onda sonora")],
        documentos=[("propuesta-de-casa-de-musica", "Propuesta de casa de música de Leticia", "pdf")],
        proyectos=["Canciones de tres orillas", "Talleres de canto en tres colegios", "Ronda abierta mensual"],
        agrupaciones=[],
        festivales=[("n1.festival.encuentro-de-musicas-de-las-tres-fronteras", "organizadora (en borrador)")],
    ),
    dict(
        clave="asoc-sonidos-del-archipielago", nombre="Asociación Sonidos del Archipiélago", tipo="Comunitario", muni="88001", estado="activa", admin="dennis-bryan",
        fundada=2003, dias=180, dominio="sonidosdelarchipielago.test", telefono="+57 608 555 0110", direccion="Sector San Luis, vía circunvalar, San Andrés", nit=None,
        facebook="https://facebook.com/sonidosdelarchipielago.test", instagram="https://instagram.com/sonidosdelarchipielago.test", otro=None,
        desc=(
            "La Asociación Sonidos del Archipiélago es una organización pequeña y de largo aliento: desde 2003 enseña y toca en San Andrés las músicas raizales, mento, calipso, schottische, mazurca, polka y baladas en creole, que los jóvenes del archipiélago escuchan cada vez menos en sus casas. Su sede es un local alquilado en San Luis y su director, el guitarrista y cantante Dennis Bryan, es también su fundador.\n\n"
            "La asociación ofrece clases de guitarra, mandolina, tina y quijada de burro a unos sesenta niños y adolescentes, con canciones que se enseñan siempre con letra en creole y en español. Cada año organiza el Festival de Músicas del Archipiélago, un encuentro de dos días que se realiza con presupuesto ajustado y mucho trabajo voluntario. "
            "Tiene pocos aliados externos: colabora con la productora Marea Alta, de Barranquilla, para intercambios de programadores, y con un programa de formación de Providencia y Santa Catalina.\n\n"
            "Su ámbito es San Andrés, con trabajo puntual en Providencia. Sus agrupaciones asociadas son el Trío del Mar y los Niños de la Tina. No tiene número de identificación tributaria registrado."
        ),
        cambios=[
            (170, "descripcion", "Descripción", "publico", "Asociación de músicas raizales.", "Organización que enseña y toca desde 2003 las músicas raizales de San Andrés con clases para sesenta niños y adolescentes.", "directo", "admin", "Presentación de la asociación."),
        ],
        invitaciones=[],
        revision=None,
        multimedia=[("logo", "Logotipo de Sonidos del Archipiélago: una mandolina con ondas de mar caribe")],
        documentos=[("cancionero-bilingue", "Cancionero bilingüe del archipiélago", "pdf")],
        proyectos=["Clases de música raizal", "Cancionero bilingüe", "Festival de Músicas del Archipiélago"],
        agrupaciones=["Trío del Mar", "Niños de la Tina"],
        festivales=[("n1.festival.festival-de-musicas-del-archipielago", "organizadora")],
    ),
    dict(
        clave="corp-bandas-de-boyaca", nombre="Corporación Bandas de Boyacá", tipo="Comunitario", muni="15759", estado="inactiva", admin="gilberto-pedraza",
        fundada=2003, dias=340, dominio="bandasdeboyaca.test", telefono="+57 608 555 0111", direccion="Calle 11 n.º 10-22, Sogamoso", nit="999.111.211-3",
        facebook="https://facebook.com/bandasdeboyaca.test", instagram=None, otro="https://archivo.bandasdeboyaca.test",
        desc=(
            "La Corporación Bandas de Boyacá agrupó entre 2003 y 2024 a doce bandas de municipios boyacenses, organizó intercambios de repertorio y de directores y promovió el Festival de Bandas de Paz de Boyacá, un encuentro de tres días que llegó a reunir a cuarenta bandas en la plaza de Sogamoso. La fundó y dirigió el maestro Gilberto Pedraza, quien también dirigió la banda municipal de la ciudad hasta 2018.\n\n"
            "En su trayectoria publicó diecisiete arreglos de música campesina boyacense para banda y un método de enseñanza para bandas rurales que todavía se usa en escuelas. En 2024 suspendió actividades por un cambio en su equipo directivo y por la jubilación de su director; el festival se pausó y varios proyectos quedaron pendientes. "
            "La ficha se mantiene como memoria del proceso y como archivo abierto.\n\n"
            "Hoy el maestro Pedraza digitaliza el archivo de la corporación, que reúne partituras manuscritas, fotografías, programas de mano y grabaciones de más de cincuenta años de bandas boyacenses. La corporación podría retomarse con un nuevo equipo, y mantiene colaboración con la Fundación Orquesta Sinfónica Juvenil del Alto Magdalena, a la que su director asesora en el trabajo con vientos.\n\n"
            "Su ámbito es Boyacá. Las agrupaciones vinculadas son la Banda Municipal de Sogamoso y la Banda Escuela de la Corporación."
        ),
        cambios=[
            (330, "numeroIdentificacion", "NIT", "identificacion", None, "999.111.211-3", "directo", "admin", "Registro del NIT de la corporación."),
            (200, "descripcion", "Descripción", "publico", "Corporación de bandas sinfónicas de Boyacá.", "Corporación que agrupó a doce bandas de municipios boyacenses y promovió el Festival de Bandas de Paz.", "directo", "admin", "Actualización antes de la pausa."),
            (45, "estadoRegistro", "Estado de la organización", "organizacion", "activa", "inactiva", "directo", "admin", "Suspensión de actividades por cambio del equipo directivo y jubilación del director; la ficha se conserva como memoria."),
        ],
        invitaciones=[("directora.encargada@simus.test", "administrador", "vencida", 80)],
        revision=330,
        multimedia=[("logo", "Logotipo de Bandas de Boyacá: un bombardino y una montaña de páramo")],
        documentos=[("metodo-para-bandas-rurales", "Método para bandas rurales de Boyacá", "pdf"), ("acta-de-suspension", "Acta de suspensión de actividades", "pdf")],
        proyectos=["Intercambio de repertorio entre bandas", "Método para bandas rurales", "Archivo de bandas boyacenses", "Festival de Bandas de Paz de Boyacá (en pausa)"],
        agrupaciones=["Banda Municipal de Sogamoso", "Banda Escuela de la Corporación"],
        festivales=[("n1.festival.festival-de-bandas-de-paz-de-boyaca", "organizadora (en pausa)")],
    ),
    dict(
        clave="corp-guabina-y-tiple", nombre="Corporación Guabina y Tiple", tipo="Comunitario", muni="68861", estado="activa", admin="martha-rangel",
        fundada=2006, dias=250, dominio="guabinaytiple.test", telefono="+57 607 555 0112", direccion="Carrera 5 n.º 7-30, Vélez", nit=None,
        facebook="https://facebook.com/guabinaytiple.test", instagram="https://instagram.com/guabinaytiple.test", otro="https://archivo.guabinaytiple.test",
        desc=(
            "La Corporación Guabina y Tiple se creó en 2006 en Vélez, en la provincia santandereana de su nombre, para mantener viva la guabina veleña y enseñar tiple, requinto y bandola a los niños de las veredas. La dirige la maestra y cantante Martha Rangel, quien durante veintiocho años recogió coplas con sus estudiantes en escuelas rurales y llegó a reunir más de mil trescientas.\n\n"
            "La escuela atiende a noventa estudiantes de seis veredas y de la cabecera municipal, con clases los sábados en un colegio prestado y los miércoles en una casa rural. La corporación ha editado dos libros de coplas y un disco de guabinas con sus alumnos, que se reparte gratis en escuelas de la provincia, y organiza cada año el Festival de Guabina y Tiple de Vélez. "
            "Cuenta con la colaboración de la compositora y directora coral Olga Mejía, de Pereira, editora de la ficha de la corporación, que escribió arreglos corales de guabinas para el coro de la escuela.\n\n"
            "Mantiene un intercambio de tiple y arpa con la Corporación Música del Llano, de Yopal. Su ámbito es la provincia de Vélez y el sur de Santander. Sus agrupaciones asociadas son el Coro de la Corporación, el Grupo de Requintos y Los Coplistas de Vélez. La organización no tiene aún número de identificación tributaria registrado."
        ),
        cambios=[
            (240, "descripcion", "Descripción", "publico", "Escuela de tiple en Vélez.", "Escuela de tiple, requinto, bandola y canto con noventa estudiantes de seis veredas y la cabecera municipal.", "directo", "admin", "Descripción completa de la escuela."),
            (100, "instagram", "Instagram", "publico", None, "https://instagram.com/guabinaytiple.test", "directo", "admin", "Se agrega la cuenta de la corporación."),
        ],
        invitaciones=[("directora.coral@simus.test", "editor", "aceptada", 90)],
        revision=None,
        multimedia=[("logo", "Logotipo de Guabina y Tiple: un tiple con una guayaba a un lado")],
        documentos=[("mil-trescientas-coplas", "Mil trescientas coplas de la provincia de Vélez", "pdf")],
        proyectos=["Escuela de tiple, requinto y bandola", "Libros de coplas", "Disco de guabinas veleñas", "Festival de Guabina y Tiple de Vélez"],
        agrupaciones=["Coro de la Corporación", "Grupo de Requintos", "Los Coplistas de Vélez"],
        festivales=[("n1.festival.festival-de-guabina-y-tiple-de-velez", "organizadora")],
    ),
    dict(
        clave="corp-tejidos-de-aire", nombre="Corporación Tejidos de Aire", tipo="Comunitario", muni="86001", estado="activa", admin="angela-burbano",
        fundada=2019, dias=120, dominio="tejidosdeaire.test", telefono="+57 608 555 0113", direccion="Barrio Obrero, Mocoa", nit=None,
        facebook=None, instagram="https://instagram.com/tejidosdeaire.test", otro="https://archivo.tejidosdeaire.test/acuerdos",
        desc=(
            "La Corporación Tejidos de Aire acompaña desde 2019, en Mocoa, procesos de transmisión de flautas, cantos y músicas de ceremonia de pueblos originarios del piedemonte amazónico, siempre bajo acuerdos con las autoridades y los mayores de cada pueblo. La fundaron la etnomusicóloga Ángela Burbano, docentes y jóvenes artistas de varios pueblos, con una regla central: los mayores deciden qué se registra, quién lo custodia y quién puede escucharlo.\n\n"
            "Su trabajo incluye talleres de construcción de flautas con maestros de la región, un fondo documental con acuerdos de uso firmados, un semillero de jóvenes investigadores y el Encuentro de Flautas del Piedemonte Amazónico, que cada año reúne a intérpretes y constructores de Putumayo, Nariño, Cauca y Caquetá. "
            "Parte de los materiales no se publica jamás y se conserva solo en la comunidad. En el equipo participa como constructor invitado Fabián Rojas, de Ipiales, editor de la ficha de la corporación.\n\n"
            "La corporación prepara una guía abierta de acuerdos de uso para otras comunidades, que solo se publicará después de ser revisada por las autoridades con las que trabajó. Mantiene vínculos con el Colectivo Tierra Adentro, de Popayán, al que asesora en consentimiento y archivo.\n\n"
            "Su ámbito es Mocoa y el piedemonte amazónico. Sus agrupaciones asociadas son el Ensamble de Flautas del Piedemonte y el Semillero de Jóvenes de Tejidos de Aire."
        ),
        cambios=[
            (115, "descripcion", "Descripción", "publico", "Corporación de músicas del piedemonte.", "Corporación que acompaña la transmisión de flautas y cantos bajo acuerdos con las autoridades y los mayores de cada pueblo.", "directo", "admin", "Presentación de la corporación y de su regla de trabajo."),
            (60, "descripcion", "Descripción", "publico", "Corporación que acompaña la transmisión de flautas y cantos bajo acuerdos con las autoridades y los mayores de cada pueblo.", "Corporación que acompaña la transmisión de flautas, cantos y músicas de ceremonia con talleres, un fondo de acuerdos de uso y un encuentro anual de flautas.", "propuesta", "admin", "Se agregan las líneas de trabajo vigentes."),
        ],
        invitaciones=[("semillero.jovenes@simus.test", "editor", "pendiente", 7)],
        revision=None,
        multimedia=[("logo", "Logotipo de Tejidos de Aire: una flauta de caña con hilos de colores que forman una trenza")],
        documentos=[("guia-de-acuerdos-de-uso", "Guía abierta de acuerdos de uso (borrador)", "pdf")],
        proyectos=["Talleres de construcción de flautas", "Fondo documental con acuerdos de uso", "Semillero de jóvenes investigadores", "Encuentro de Flautas del Piedemonte Amazónico"],
        agrupaciones=["Ensamble de Flautas del Piedemonte", "Semillero de Jóvenes de Tejidos de Aire"],
        festivales=[("n1.festival.encuentro-de-flautas-del-piedemonte-amazonico", "organizadora")],
    ),
    dict(
        clave="colectivo-ensamble-pausa", nombre="Colectivo Ensamble Pausa", tipo="Otro", muni="17001", estado="eliminada", admin="julian-arboleda",
        fundada=2014, dias=330, dominio="ensamblepausa.test", telefono="+57 606 555 0114", direccion="Carrera 23 n.º 30-12, Manizales", nit=None,
        facebook=None, instagram="https://instagram.com/ensamblepausa.test", otro="https://archivo.ensamblepausa.test",
        desc=(
            "El Colectivo Ensamble Pausa fue un grupo de ocho músicos y diseñadores sonoros de Manizales que entre 2014 y 2023 presentó conciertos-instalación en casas, fábricas y plazas de Manizales y Pereira. Lo fundó el compositor Julián Arboleda junto con colegas de la universidad, con piezas que mezclaban instrumentos acústicos, objetos domésticos y grabaciones de campo.\n\n"
            "Durante seis años de trabajo continuo el colectivo editó un disco de piezas colectivas y estrenó una treintena de obras con funciones de entrada voluntaria. La pandemia y el traslado de varios integrantes a otras ciudades redujeron el equipo, y en 2023 los socios acordaron disolverlo. "
            "Su ficha fue dada de baja por los propios miembros, con constancia de lo hecho y con el archivo disponible en línea para consulta.\n\n"
            "Su ámbito era Manizales y el Eje Cafetero. No tuvo número de identificación tributaria ni agrupaciones asociadas."
        ),
        cambios=[
            (320, "descripcion", "Descripción", "publico", "Colectivo de música contemporánea de Manizales.", "Grupo de ocho músicos y diseñadores sonoros que presentó conciertos-instalación entre 2014 y 2023.", "directo", "admin", "Actualización del balance del colectivo."),
            (200, "estadoRegistro", "Estado de la organización", "organizacion", "activa", "inactiva", "directo", "admin", "Los socios acuerdan suspender las actividades del colectivo."),
            (150, "estadoRegistro", "Estado de la organización", "organizacion", "inactiva", "eliminada", "directo", "admin", "Disolución acordada por los socios en acta; no quedan procesos abiertos."),
        ],
        invitaciones=[],
        revision=None,
        multimedia=[("logo", "Logotipo del Ensamble Pausa: un signo de silencio de negra sobre fondo negro")],
        documentos=[("acta-de-disolucion", "Acta de disolución del colectivo", "pdf")],
        proyectos=["Conciertos-instalación en casas y fábricas", "Disco de piezas colectivas"],
        agrupaciones=[],
        festivales=[],
    ),
]
