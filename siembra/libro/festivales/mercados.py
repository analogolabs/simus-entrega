from ._comun import ed

M1 = dict(
    clave="feria-de-circulacion-musical-del-golfo", nombre="Feria de Circulación Musical del Golfo", org="agencia-golfo-en-vivo", muni="70820", estado="publicado", trayectoria="directo",
    alcance="regional", modalidad="presencial", periodicidad="anual", periodicidad_detalle="Se realiza en septiembre, en la semana siguiente a las fiestas del pueblo, para aprovechar la presencia de programadores del Caribe.",
    practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales"], territorios=["cantos-pitos-y-tambores"],
    lugar="Casa de la Cultura y malecón de Santiago de Tolú", cobertura="departamental",
    desc=("La feria nació en 2023 de una pregunta sencilla que le hacían a la agencia los grupos del golfo: cómo conseguir contratos fuera de las fiestas del pueblo. La respuesta fue invitar durante tres días a programadores de festivales, salas y casas de cultura del Caribe, y ponerlos a conversar con las agrupaciones en un malecón abierto al público.\n\n"
          "El formato combina citas de veinte minutos entre programadores y agrupaciones, presentaciones breves de media hora en escenarios al aire libre, una mesa sobre derechos de autor y un taller previo, semanas antes, en el que los grupos aprenden a preparar una ficha técnica, un video corto y una propuesta de tarifas. "
          "Los objetivos son profesionalizar a los músicos de la región, generar contratos reales fuera de la temporada alta y construir confianza entre quienes programan y quienes tocan.\n\n"
          "La identidad de la feria es costeña y práctica: se escucha cumbia, gaita, banda de pueblo y salsa de barrio, las citas se hacen bajo carpas con ventilador y todos almuerzan juntos pescado frito y arroz de coco. El mercado ha apostado por mantener la entrada libre al público en las presentaciones y por cobrar una inscripción baja a los programadores."),
    contacto=dict(correo="feria@golfoenvivo.test", telefono="+57 605 555 1010", sitio="https://feriadelgolfo.test", instagram="https://instagram.test/feriadelgolfo", facebook="https://facebook.test/feriadelgolfo",
                  otro="https://feriadelgolfo.test/inscripcion-de-agrupaciones", obs="Atención a agrupaciones y programadores por correo y mensajería de lunes a viernes."),
    enlaces=[("https://feriadelgolfo.test/guia-del-programador.pdf", "Guía para programadores invitados."), ("https://feriadelgolfo.test/ficha-tecnica-modelo.pdf", "Modelo de ficha técnica para agrupaciones.")],
    ediciones=[
        ed(2023, 1, ((9, 21), (9, 23)), "Citas junto al mar", "Casa de la Cultura de Tolú",
           "Primera edición: 40 agrupaciones inscritas, doce programadores invitados y una sala con ventiladores que se volvió insuficiente. El primer contrato salió entre una banda de pueblo y un festival del interior.",
           [(0, "09:00", "Citas de veinte minutos, primera ronda", "encuentros-y-dialogos", "Casa de la Cultura", "Doce programadores y cuarenta agrupaciones conversan por turnos.")],
           cifras=dict(agrupaciones=40, programadores=12, citas=96, contratos=7, asistentes=900), tipologia=None),
        ed(2024, 2, ((9, 19), (9, 21)), "Contratos con sal", "Casa de la Cultura y malecón de Tolú",
           "Segunda edición con presentaciones breves en el malecón y mesa sobre derechos de autor. Los programadores subieron a quince y las agrupaciones aprendieron a negociar fechas en ferias nacionales.",
           [(1, "16:00", "Mesa sobre derechos de autor", "formacion", "Casa de la Cultura", "Una abogada invitada explica cómo se registran obras y cómo cobrar por su uso."),
            (1, "19:00", "Presentaciones en el malecón", "conciertos-y-presentaciones", "Malecón de Tolú", "Seis agrupaciones de media hora cada una, entre ellas La Banda Marinera y Gaiteros de Playa Honda.")],
           cifras=dict(agrupaciones=55, programadores=15, citas=140, contratos=14, asistentes=1700)),
        ed(2025, 3, ((9, 18), (9, 20)), "Tarifas claras", "Casa de la Cultura, malecón y hotel sede",
           "Tercera edición con un componente de formación sobre tarifas y condiciones técnicas. Por primera vez se firmaron contratos plurianuales entre una agrupación del golfo y un festival del Caribe.",
           [(0, "10:00", "Taller de tarifas y fichas técnicas", "formacion", "Hotel sede", "Se calcula el costo real de una presentación con ejemplos de grupos de cuatro y de diez integrantes."),
            (2, "17:00", "Balance de contratos", "encuentros-y-dialogos", "Casa de la Cultura", "Los programadores comentan qué los convenció y qué faltó en cada propuesta.")],
           formacion="Ciclo previo de tres talleres virtuales sobre ficha técnica, video de presentación y propuesta de tarifas, con noventa inscritos.",
           convocatoria="Convocatoria abierta a agrupaciones del Caribe entre el 1 de junio y el 15 de julio; 120 postulaciones, 60 seleccionadas por un comité mixto.",
           cifras=dict(agrupaciones=60, programadores=18, citas=180, contratos=22, asistentes=2300)),
        ed(2026, 4, ((9, 17), (9, 19)), "Con el oído abierto", "Casa de la Cultura y malecón de Tolú",
           "Cuarta edición, con 22 programadores y una sala de escucha de demos en vivo. Se pilotó una ronda de citas en línea para agrupaciones que no pudieron viajar.",
           [(0, "09:30", "Ronda de citas presencial", "encuentros-y-dialogos", "Casa de la Cultura", "Veintidós programadores atienden citas de veinte minutos con 64 agrupaciones."),
            (1, "15:00", "Sala de escucha de propuestas", "formacion", "Casa de la Cultura", "Los programadores comentan en vivo demos enviadas sin nombre de grupo."),
            (2, "18:00", "Presentaciones de cierre", "conciertos-y-presentaciones", "Malecón de Tolú", "Cumbiamberos, gaiteros y una orquesta de metales cierran la feria.")],
           convocatoria="Convocatoria abierta entre el 1 de junio y el 20 de julio con modalidad presencial y en línea; 150 postulaciones, 64 seleccionadas.",
           cifras=dict(agrupaciones=64, programadores=22, citas=210, contratos=31, asistentes=2800), agenda=True),
        ed(2027, 5, ((9, 16), (9, 18)), "Ruta de ida y vuelta", "Casa de la Cultura y malecón de Tolú",
           "Quinta edición prevista, con el propósito de organizar las citas por temas (festivales, salas, sellos) y de incorporar a programadores de Centroamérica.",
           [(0, "09:30", "Citas por tipo de programador", "encuentros-y-dialogos", "Casa de la Cultura", "Las rondas se organizan por tipo de comprador para facilitar el encuentro entre intereses.")],
           estado="programada", agenda=True),
    ],
)

M2 = dict(
    clave="vitrina-cafetera-de-musicas", nombre="Vitrina Cafetera de Músicas", org="coop-eje-sonoro", muni="66001", estado="publicado", trayectoria="con_ajustes",
    alcance="nacional", modalidad="mixta", periodicidad="anual", periodicidad_detalle="Se organiza en octubre, con una fase virtual de dos semanas previa al encuentro presencial de tres días.",
    practicas=["musicas-urbanas-alternativas-e-independientes", "musicas-electronicas-digitales-produccion-sonora-y-nuevas-tecnologias", "musicas-populares-tradicionales-regionales-y-patrimoniales"], territorios=[],
    lugar="Centro cultural y auditorio de Pereira", cobertura="nacional",
    desc=("La vitrina surgió de una cooperativa de músicos del Eje Cafetero que se cansó de que sus giras terminaran en pérdidas y decidió crear su propio mercado, con una premisa: cualquier agrupación del país puede postularse, pero cada grupo seleccionado llega preparado, con materiales listos y claridad sobre qué busca.\n\n"
          "El proceso empieza con dos semanas virtuales de mentorías y revisión de propuestas, y continúa con tres días presenciales de showcases, citas con programadores y charlas sobre contabilidad, distribución digital y derechos conexos. "
          "El objetivo es acortar la distancia entre el trabajo creativo y la circulación, ofrecer asesoría contable que normalmente los músicos pagan caro y facilitar primeras giras reales para grupos emergentes.\n\n"
          "La identidad de la vitrina es práctica y cálida: los showcases se hacen en salas pequeñas con buen sonido, las citas tienen café incluido y los programadores llegan con una lista de preguntas concretas. Se privilegia la diversidad de géneros: en una misma jornada pueden oírse una cantaora del Pacífico, un productor electrónico y un cuarteto de cuerdas andinas."),
    contacto=dict(correo="vitrina@ejesonoro.test", telefono="+57 606 555 1120", sitio="https://vitrinacafetera.test", instagram="https://instagram.test/vitrinacafetera", facebook="https://facebook.test/vitrinacafetera",
                  otro="https://vitrinacafetera.test/postulaciones", obs="Las postulaciones se gestionan en el sitio web; la cooperativa responde dudas por correo."),
    enlaces=[("https://vitrinacafetera.test/reglamento-2026.pdf", "Reglamento de postulación y selección 2026.")],
    ediciones=[
        ed(2025, 1, ((10, 23), (10, 25)), "Primera vitrina", "Centro cultural de Pereira",
           "Primera edición con 24 agrupaciones seleccionadas de doce departamentos. Se descubrió que muchos grupos tenían materiales excelentes pero no sabían qué pedirle a un programador, y la mentoría previa se volvió el componente central.",
           [(0, "10:00", "Mentorías de preparación", "formacion", "Centro cultural", "Los grupos ensayan su presentación de tres minutos con asesores de la cooperativa."),
            (1, "19:00", "Showcases de la noche", "conciertos-y-presentaciones", "Auditorio de Pereira", "Doce grupos de géneros distintos tocan veinte minutos cada uno.")],
           formacion="Dos semanas de mentorías virtuales para los 24 grupos seleccionados.",
           cifras=dict(agrupaciones=24, programadores=14, citas=70, contratos=9, asistentes=650)),
        ed(2026, 2, ((10, 22), (10, 24)), "Con el café servido", "Centro cultural y auditorio de Pereira",
           "Segunda edición con 30 agrupaciones y una jornada contable sobre facturación electrónica y retenciones. Los programadores pidieron más tiempo para escuchar piezas completas, y se amplió el espacio de showcases.",
           [(0, "09:00", "Jornada contable para músicos", "formacion", "Centro cultural", "Una contadora explica facturación, retenciones y seguridad social para artistas independientes."),
            (1, "20:00", "Showcases de la noche", "conciertos-y-presentaciones", "Auditorio de Pereira", "Quince grupos presentan piezas de entre quince y veinte minutos."),
            (2, "10:00", "Citas con programadores", "encuentros-y-dialogos", "Centro cultural", "Dieciséis programadores y 30 grupos se citan en rondas de veinte minutos.")],
           convocatoria="Convocatoria nacional del 1 de junio al 15 de agosto; 210 postulaciones, 30 agrupaciones seleccionadas.",
           cifras=dict(agrupaciones=30, programadores=16, citas=96, contratos=15, asistentes=900), agenda=True),
    ],
)

M3 = dict(
    clave="vitrina-de-musicas-del-llano-y-la-selva", nombre="Vitrina de Músicas del Llano y la Selva", org="corp-arpa-del-ariari", muni="50313", estado="en_revision", trayectoria="revision",
    alcance="regional", modalidad="virtual", periodicidad="anual", periodicidad_detalle="Está pensada para realizarse durante el encuentro de arpas y cuatros del Ariari, en agosto, con una fase previa en línea.",
    practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-campesinas-rurales-y-de-raiz-territorial", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical"], territorios=["joropo", "amazonas"],
    lugar="Plataforma virtual y coliseo de Granada", cobertura="departamental", festival="encuentro-de-arpas-y-cuatros-del-ariari",
    desc=("La vitrina pretende ofrecer a las agrupaciones del llano y de la selva una oportunidad de presentarse ante programadores y emisoras sin costos de viaje, mediante sesiones en línea de veinte minutos y una gala presencial que coincidirá con el encuentro de arpas y cuatros del Ariari.\n\n"
          "El proyecto surge de la experiencia de la corporación, que observó cómo muchos grupos que tocan con calidad no logran salir de su vereda por falta de contactos. La vitrina propone un esquema de acompañamiento: videos grabados con apoyo técnico, una jornada virtual de citas con programadores y emisoras, y una sesión de balance donde los grupos reciben comentarios por escrito.\n\n"
          "Se concibe como un espacio abierto a repertorios de joropo, música campesina, cantos amazónicos y propuestas de fusión, siempre que respeten acuerdos de uso con las comunidades de origen. Su identidad será la de una plaza de feria llevada a las pantallas: sin tarima, con conversaciones largas, cuadernos de notas y mucha comida llanera en las pausas presenciales."),
    contacto=dict(correo="vitrina@arpadelariari.test", telefono="+57 608 555 1230", sitio="https://vitrinallanoyselva.test", instagram="https://instagram.test/vitrinallanoyselva", facebook=None,
                  otro=None, obs="Se atiende por correo y por la plataforma de la corporación."),
    enlaces=[("https://vitrinallanoyselva.test/convocatoria-2027.pdf", "Borrador de convocatoria a agrupaciones.")],
    ediciones=[
        ed(2027, 1, None, "Del patio a la pantalla", "Plataforma virtual y coliseo de Granada",
           "Primera edición en preparación. Se plantean sesiones virtuales de veinte minutos, una gala presencial en el coliseo y un cuaderno de comentarios para cada agrupación participante.",
           [], estado="en_preparacion"),
    ],
)

M4 = dict(
    clave="mercado-de-musicas-de-frontera-del-nororiente", nombre="Mercado de Músicas de Frontera del Nororiente", org="corp-frontera-sonora", muni="54001", estado="ajustes_solicitados", trayectoria="ajustes_vigentes",
    alcance="internacional", modalidad="presencial", periodicidad="anual", periodicidad_detalle="Se planea para noviembre, en fecha que se ajusta según las condiciones de movilidad en los pasos fronterizos.",
    practicas=["musicas-de-frontera-diasporas-migraciones-e-interculturalidad", "musicas-populares-de-amplia-circulacion-tropicales-bailables-y-comerciales", "musicas-populares-tradicionales-regionales-y-patrimoniales"], territorios=[],
    lugar="Teatro municipal y casas de cultura de Cúcuta", cobertura="departamental",
    desc=("El mercado busca que programadores, emisoras y agrupaciones de ambos lados de la frontera se reúnan una vez al año para conversar sobre contratos, giras binacionales y derechos de autor en un territorio donde los trámites cambian de un día para otro. Su primera edición, realizada en 2026, reunió a más de cuarenta agrupaciones de carrilera, vallenato, música andina y música urbana.\n\n"
          "El programa combinó citas de negocios, showcases en el teatro municipal, una mesa técnica sobre cruce de instrumentos y equipos y una charla sobre cómo registrar obras que se interpretan en ambos países. "
          "Entre sus propósitos están abrir circuitos de gira estables entre Cúcuta y las ciudades vecinas, apoyar a las agrupaciones en trámites y mostrar cómo el cruce de repertorios genera una música que no cabe en una sola nacionalidad.\n\n"
          "La identidad del mercado es la de una orilla que se asoma a otra: las citas se hacen en cafés del centro, los showcases terminan con música de carrilera y las comidas incluyen arepas y pastel de yuca. La organización trabaja para que la entrada a las presentaciones sea libre."),
    contacto=dict(correo="mercado@fronterasonora.test", telefono="+57 607 555 1340", sitio="https://mercadodefrontera.test", instagram="https://instagram.test/mercadodefrontera", facebook="https://facebook.test/mercadodefrontera",
                  otro="https://mercadodefrontera.test/mesa-tecnica", obs="Se atiende por correo; la corporación responde en un plazo de tres días hábiles."),
    enlaces=[("https://mercadodefrontera.test/guia-de-tramites.pdf", "Guía de trámites para el cruce de instrumentos y equipos.")],
    ediciones=[
        ed(2026, 1, ((11, 5), (11, 7)), "Una orilla, dos orillas", "Teatro municipal y casas de cultura de Cúcuta",
           "Primera edición con 42 agrupaciones de carrilera, vallenato, música andina y urbana, y programadores de tres ciudades colombianas y dos del lado venezolano. La mesa técnica sobre cruce de instrumentos fue la más concurrida.",
           [(0, "09:30", "Citas de negocios", "encuentros-y-dialogos", "Casa de cultura", "Programadores y agrupaciones se reúnen en turnos de veinte minutos."),
            (1, "15:00", "Mesa técnica sobre cruce de instrumentos", "formacion", "Casa de cultura", "Un agente de aduanas explica requisitos y tiempos para el paso de instrumentos."),
            (2, "20:00", "Showcases en el teatro", "conciertos-y-presentaciones", "Teatro municipal", "Ocho agrupaciones presentan veinte minutos cada una.")],
           cifras=dict(agrupaciones=42, programadores=17, citas=110, contratos=11, asistentes=1500)),
        ed(2027, 2, None, "Cruce de caminos", "Teatro municipal y casas de cultura de Cúcuta",
           "Segunda edición en planeación: se ajusta el calendario según el cruce fronterizo y se evalúa un día adicional para agrupaciones infantiles y juveniles.",
           [], estado="en_preparacion"),
    ],
)

MERCADOS = [M1, M2, M3, M4]
