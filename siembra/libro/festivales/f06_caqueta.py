from ._comun import ed

FESTIVAL = dict(
    clave="muestra-de-cantos-del-rio-caqueta", nombre="Muestra de Cantos del Río Caquetá", org="fund-voces-del-caqueta", muni="18001", estado="publicado", trayectoria="directo",
    periodicidad="bianual", periodicidad_detalle="Se organiza cada dos años en junio, aprovechando la estación en que los ríos permiten el viaje de las delegaciones; la primera edición fue en 2024.",
    practicas=["musicas-comunitarias-y-procesos-colectivos-de-practica-musical", "musicas-vocales-corales-y-de-tradicion-cantada", "expresiones-sonoras-de-pueblos-originarios"],
    territorio="amazonas", director="Marcela Perdomo Hoyos", tipo_organizador="fundacion", cobertura="departamental",
    desc=("La muestra se originó en un trabajo de campo de cuatro años en el que la fundación grabó cantos de trabajo, arrullos y músicas de fiesta en veredas y resguardos del Caquetá. Al devolver las grabaciones a las familias se dio cuenta de que las comunidades querían escucharse entre sí, y de ahí nació la idea de un encuentro bienal en Florencia.\n\n"
          "El programa reúne ruedas de cantos, una sala de escucha del archivo sonoro, conversatorios sobre derechos colectivos del conocimiento, talleres de registro sonoro y una noche de música de fiesta con instrumentos de cuerda y acordeón. "
          "Busca que los cantos de la Amazonía circulen sin perder el control de sus dueños, formar jóvenes en grabación y edición, y construir una mirada propia sobre lo que se archiva y cómo se comparte.\n\n"
          "La identidad de la muestra es la de un río con varias orillas: conviven repertorios campesinos, indígenas y de colonización, siempre con acuerdos explícitos sobre qué puede grabarse, qué puede difundirse y qué debe quedarse en la comunidad. El público se sienta en círculo y los intérpretes son quienes presentan sus propias piezas."),
    contacto=dict(correo_organizador="voces@vocesdelcaqueta.test", telefono_organizador="+57 608 555 0620", sitio_organizador="https://vocesdelcaqueta.test",
                  instagram="https://instagram.test/cantosdelrio", facebook="https://facebook.test/cantosdelrio", otro="https://vocesdelcaqueta.test/sala-de-escucha",
                  telefono="+57 608 555 0621", obs="Se responde en horario de oficina; para consultas sobre uso de grabaciones se pide cita previa."),
    aliados=["Semillero de Música Amazónica de la ciudad", "Red de Emisoras del Piedemonte Amazónico", "Consejo de Mayores del Alto Caquetá"],
    enlaces=[("https://vocesdelcaqueta.test/acuerdos-de-uso.pdf", "Modelo de acuerdo de uso de grabaciones con comunidades."), ("https://vocesdelcaqueta.test/programa-2026.pdf", "Programa de la edición 2026.")],
    ediciones=[
        ed(2024, 1, ((6, 14), (6, 16)), "Del río a la sala", "Teatro del Centro Cultural de Florencia",
           "Primera edición con once delegaciones de cuatro municipios. Hubo una sala de escucha con las primeras grabaciones devueltas a las familias y un conversatorio sobre uso de los cantos con voceros de varias comunidades.",
           [(0, "19:00", "Rueda de cantos de trabajo", "conciertos-y-presentaciones", "Teatro del Centro Cultural", "Once delegaciones presentan cantos de chagra, de pesca y de arreo."),
            (1, "10:00", "Conversatorio sobre derechos del conocimiento sonoro", "encuentros-y-dialogos", "Sala de reuniones del Centro Cultural", "Voceros comunitarios explican qué se puede difundir y bajo qué condiciones.")],
           formacion="Taller de registro sonoro para doce jóvenes con equipos de campo prestados por la fundación.",
           cifras=dict(agrupaciones=11, artistas=64, asistentes=800, talleres=2, comunidades=9), tipologia="encuentros", fuente1="estimulos", fuente2="recursos-propios"),
        ed(2026, 2, ((6, 12), (6, 14)), "Orillas", "Centro Cultural de Florencia y parque de los Fundadores",
           "Segunda edición, con delegaciones de siete municipios y un día dedicado a la música de fiesta. Se presentó un disco colectivo editado a partir de las grabaciones de campo y entregado a cada comunidad.",
           [(0, "18:30", "Presentación del disco colectivo", "encuentros-y-dialogos", "Centro Cultural", "Se escucha una selección del disco y las familias comentan cómo se sintieron al oírse."),
            (1, "19:00", "Noche de música de fiesta", "conciertos-y-presentaciones", "Parque de los Fundadores", "Los Hermanos Carvajal del Orteguaza y el Grupo Aire de Monte tocan con acordeón y cuerdas."),
            (2, "10:00", "Taller de edición sonora", "formacion", "Centro Cultural", "Quince jóvenes aprenden a editar y catalogar grabaciones con acuerdos de uso.")],
           convocatoria="Convocatoria abierta a comunidades y procesos del departamento entre el 2 de marzo y el 20 de abril; 17 propuestas, 14 seleccionadas.",
           cifras=dict(agrupaciones=14, artistas=88, asistentes=1250, talleres=3, comunidades=12), tipologia="encuentros", fuente1="mincultura", fuente2="recursos-propios", agenda=True),
    ],
)
