from ._comun import ed

FESTIVAL = dict(
    clave="encuentro-de-coplas-del-cravo-sur", nombre="Encuentro de Coplas del Cravo Sur", org="colectivo-coplas-del-cravo", muni="85250", estado="en_revision", trayectoria="revision",
    periodicidad="anual", periodicidad_detalle="Se organiza en noviembre, cuando baja el nivel de los ríos y se puede llegar a los hatos; por ser una fiesta de trabajo, el calendario se confirma cada año según el invierno.",
    practicas=["musicas-campesinas-rurales-y-de-raiz-territorial", "musicas-populares-tradicionales-regionales-y-patrimoniales"],
    territorio="joropo", director="Rubiel Mantilla Saavedra", tipo_organizador="comunitario", cobertura="municipal",
    desc=("El encuentro empezó en 2023 en el patio de un hato de Paz de Ariporo, cuando Rubiel Mantilla invitó a los copleros de las veredas vecinas a un contrapunteo de dos noches. Llegaron quince, y desde entonces los vecinos piden que se repita. "
          "La idea era simple: oír de frente a quienes improvisan versos sobre las faenas, el ganado y el río, y grabarlos con el permiso de cada uno.\n\n"
          "El programa combina contrapunteos nocturnos, una feria de comidas del llano, clases de verso para niños de la escuela rural y un recorrido por hatos donde se cantan coplas de trabajo en la manga. "
          "Busca reconocer a los copleros como maestros de un oficio oral, ampliar el archivo de versos que lleva el colectivo y abrir un espacio donde las mujeres, casi siempre relegadas del contrapunteo, también improvisen.\n\n"
          "Su identidad es llanera de punta a punta: se canta de pie, se responde con respeto y el jurado se compone de copleros mayores que no premian el ingenio sino la verdad del verso. "),
    contacto=dict(correo_organizador="coplas@cravosur.test", telefono_organizador="+57 608 555 0550", sitio_organizador="https://coplasdelcravo.test",
                  instagram="https://instagram.test/coplasdelcravosur", facebook="https://facebook.test/coplasdelcravosur", otro="https://coplasdelcravo.test/versos",
                  telefono="+57 608 555 0551", obs="Se recibe respuesta por llamada y por mensaje de voz; la señal falla en horas de trabajo en el hato."),
    aliados=["Escuela Rural La Palmira", "Hato Los Guarataros", "Junta de Acción Comunal de la Vereda Matepantano"],
    enlaces=[("https://coplasdelcravo.test/programa-2025.pdf", "Programa de mano de la edición 2025.")],
    ediciones=[
        ed(2023, 1, ((11, 10), (11, 11)), "Verso a verso", "Patio del hato Los Guarataros",
           "Edición inicial con dos noches de contrapunteo y quince copleros de siete veredas. Los vecinos llevaron sillas, y el colectivo grabó cada intervención con consentimiento verbal.",
           [(0, "20:00", "Contrapunteo de apertura", "conciertos-y-presentaciones", "Patio del hato Los Guarataros", "Quince copleros se reparten la noche con turnos de diez minutos.")],
           cifras=dict(agrupaciones=15, artistas=15, asistentes=240, talleres=0, comunidades=7), tipologia="encuentros", fuente1="recursos-propios"),
        ed(2024, 2, ((11, 8), (11, 10)), "Coplas de a caballo", "Hato Los Guarataros y escuela rural La Palmira",
           "Se sumó una jornada escolar con niños improvisando sus primeros versos y un recorrido a caballo por tres hatos. La participación de cinco mujeres copleras rompió una costumbre de varias décadas.",
           [(1, "10:00", "Clase de verso en la escuela", "formacion", "Escuela rural La Palmira", "Copleros mayores enseñan métrica y respeto del turno a treinta niños."),
            (1, "20:00", "Contrapunteo con mujeres copleras", "conciertos-y-presentaciones", "Hato Los Guarataros", "Cinco copleras participan por primera vez y reciben ovaciones del público.")],
           formacion="Clases de verso para treinta niños con cuatro copleros mayores en jornada escolar.",
           cifras=dict(agrupaciones=18, artistas=22, asistentes=420, talleres=1, comunidades=9), tipologia="encuentros", fuente1="alcaldia", fuente2="recursos-propios"),
        ed(2025, 3, ((11, 7), (11, 9)), "Palabra de llano", "Hato Los Guarataros, manga y vereda Matepantano",
           "Edición con una noche de coplas de trabajo cantadas en la manga durante el arreo del ganado. Se amplió el archivo de versos con setenta nuevas coplas documentadas.",
           [(0, "20:00", "Noche de contrapunteo mayor", "conciertos-y-presentaciones", "Hato Los Guarataros", "Los copleros más veteranos improvisan sobre el río y el tiempo."),
            (1, "06:00", "Coplas de arreo", "encuentros-y-dialogos", "Manga del hato", "Vaqueros cantan mientras se arrea el ganado; el colectivo registra los versos.")],
           convocatoria="Convocatoria abierta por radio y mensajes de voz del 1 al 30 de septiembre; 26 copleros inscritos.",
           cifras=dict(agrupaciones=20, artistas=28, asistentes=520, talleres=2, comunidades=10), tipologia="encuentros", fuente1="gobernacion", fuente2="recursos-propios"),
    ],
)
