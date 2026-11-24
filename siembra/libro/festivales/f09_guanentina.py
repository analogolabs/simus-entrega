from ._comun import ed

FESTIVAL = dict(
    clave="festival-del-torbellino-y-el-tiple-de-la-provincia-guanentina", nombre="Festival del Torbellino y el Tiple de la Provincia Guanentina", org="corp-guanentina-de-cultura", muni="68679", estado="archivado", trayectoria="archivo",
    periodicidad="intermitente", periodicidad_detalle="Se organizó en septiembre durante cuatro temporadas entre 2014 y 2019 y una quinta, la de 2023, que no llegó a abrirse; hubo interrupciones por falta de recursos y por la pandemia; cambió de sede dos veces antes de la pausa definitiva.",
    practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-campesinas-rurales-y-de-raiz-territorial"],
    territorio="canta-y-torbellino", director="Wilmer Gómez Rueda", tipo_organizador="mixto", cobertura="departamental",
    desc=("El festival se creó en 2014 para reunir a tiplistas, guitarristas y cantadores de torbellino de la provincia guanentina, que hasta entonces sólo coincidían en fiestas patronales. Durante sus primeras temporadas, la corporación organizadora logró reunir a más de treinta agrupaciones de estudiantinas, duetos y coros veredales.\n\n"
          "Su programa combinaba conciertos de plaza, clínicas de tiple y bandola, un concurso de composición de torbellino y una exposición de fotografías de los músicos mayores. "
          "El objetivo era conservar un repertorio de coplas y piezas instrumentales que se aprendían de oído, pagar honorarios modestos a los intérpretes y llevar los conciertos a públicos de pueblos pequeños.\n\n"
          "Tras la edición de 2023, que debió cancelarse por falta de recursos, la corporación decidió archivar la ficha mientras define si podrá retomar la tarea. El archivo de afiches, programas y grabaciones se conserva y puede consultarse por solicitud. La identidad del festival fue la de la provincia: cantadores con ruana, tiples afinados en el corredor de una casa y empanadas de comino repartidas entre el público."),
    contacto=dict(correo_organizador="corporacion@guanentinacultura.test", telefono_organizador="+57 607 555 0940", sitio_organizador="https://guanentinacultura.test", instagram="https://instagram.test/torbellinoytiple",
                  facebook="https://facebook.test/torbellinoytiple", otro="https://guanentinacultura.test/archivo", telefono="+57 607 555 0941", obs="Ficha archivada; el archivo se atiende por correo."),
    aliados=["Casa de la Cultura de la provincia", "Estudiantina Juvenil Guanentina"],
    enlaces=[("https://guanentinacultura.test/archivo-de-afiches.pdf", "Colección de afiches de las cuatro ediciones realizadas.")],
    ediciones=[
        ed(2014, 1, ((9, 12), (9, 14)), "Tiple de ida y vuelta", "Parque principal de San Gil", "La primera edición reunió a once grupos de la provincia en el parque principal de San Gil, con un concurso de composición de torbellino que ganó una maestra de escuela rural.",
           [(0, "16:00", "Concurso de composición de torbellino", "conciertos-y-presentaciones", "Parque principal de San Gil", "Ocho piezas inéditas se presentan ante un jurado de maestros y público.")],
           cifras=dict(agrupaciones=11, artistas=52, asistentes=700, talleres=1, comunidades=6), director="Wilmer Gómez Rueda", tipologia="festival-de-musica", fuente1="alcaldia", fuente2="recursos-propios", lugar_muni="68679"),
        ed(2015, 2, ((9, 11), (9, 13)), "Cuerdas del Chicamocha", "Plaza de Barichara y parque de San Gil", "Segunda edición con sedes en dos municipios: tres noches en Barichara y una tarde de cierre en San Gil. Se inauguró la exposición de fotografías de músicos mayores.",
           [(0, "17:30", "Conciertos de plaza en Barichara", "conciertos-y-presentaciones", "Plaza de Barichara", "Duetos y estudiantinas, entre ellos Cuerdas del Mesón y el Dueto Bejuco y Madera.")],
           cifras=dict(agrupaciones=18, artistas=94, asistentes=1400, talleres=2, comunidades=9), tipologia="festival-de-musica", fuente1="gobernacion", fuente2="alcaldia", lugar_muni="68079"),
        ed(2016, 3, ((9, 9), (9, 11)), "Torbellino de ida", "Plaza de Barichara y casa de la cultura de Socorro", "Se recorrió la provincia en tres noches con cambio de sede cada día. Un maestro de bandola de ochenta años recibió un homenaje público tras seis décadas de enseñanza.",
           [(1, "19:00", "Homenaje a un maestro de bandola", "encuentros-y-dialogos", "Casa de la cultura de Socorro", "Ex alumnos tocan piezas que el maestro les enseñó; él cierra con un solo de bandola.")],
           cifras=dict(agrupaciones=20, artistas=105, asistentes=1800, talleres=3, comunidades=10), tipologia="festival-de-musica", fuente1="gobernacion", fuente2="aportes-privados", lugar_muni="68755"),
        ed(2019, 4, ((9, 13), (9, 15)), "Tres años de silencio", "Teatro Santander de San Gil", "Tras una pausa de dos años por falta de recursos, regresó con un programa reducido en el teatro municipal. La clínica de tiple tuvo cupo completo, pero la asistencia a los conciertos fue baja.",
           [(0, "18:00", "Gala de reencuentro", "conciertos-y-presentaciones", "Teatro Santander", "Ensamble de tiples de la provincia con invitados del Socorro y de Vélez.")],
           cifras=dict(agrupaciones=9, artistas=48, asistentes=520, talleres=1, comunidades=5), tipologia="festival-de-musica", fuente1="alcaldia", fuente2="recursos-propios", lugar_muni="68679"),
        ed(2023, 5, ((9, 15), (9, 17)), "El último torbellino", "San Gil", "La edición prevista para septiembre de 2023 se canceló dos semanas antes de abrir porque no se completó el presupuesto para alojamiento y logística de las agrupaciones. La corporación comunicó la decisión y dejó abierta la reprogramación para un año posterior.",
           [], estado="cancelada", tipologia="festival-de-musica", fuente1="alcaldia", fuente2="recursos-propios", lugar_muni="68679"),
    ],
)
