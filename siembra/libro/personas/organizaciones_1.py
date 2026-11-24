"""Organizaciones N1 (1 a 7). Todo inventado: nombres, NIT, contactos `.test`, direcciones y teléfonos de rango no asignable.

Campos: `dias` = hace cuántos días se registró en SIMUS; `cambios` = (dias_atras, campo, etiqueta, clase, anterior, nuevo, origen, actor, motivo) con actor `admin` o `gestion`;
`invitaciones` = (correo, rol, estado, dias_emision); `revision` = días desde la revisión de la consola (o None); `documentos` y `multimedia` van por alias.
"""

ORGANIZACIONES = [
    dict(
        clave="corp-cabildo-sonoro-del-atrato", nombre="Corporación Cabildo Sonoro del Atrato", tipo="Comunitario", muni="27001", estado="activa", admin="nubia-palacios",
        fundada=2004, dias=410, dominio="cabildosonoro.test", telefono="+57 604 555 0101", direccion="Carrera 4 n.º 22-15, barrio Medrano, Quibdó", nit="999.101.201-4",
        facebook="https://facebook.com/cabildosonoro.test", instagram="https://instagram.com/cabildosonoro.test", otro="https://archivo.cabildosonoro.test",
        desc=(
            "La Corporación Cabildo Sonoro del Atrato nació en 2004 en una sala prestada de un colegio de Quibdó, cuando un grupo de maestros y cantadoras decidió que los alabaos, los gualíes y la chirimía no podían seguir aprendiéndose solo en los velorios y las novenas. "
            "Hoy es una corporación comunitaria con sede propia en el barrio Medrano, un equipo estable de catorce personas y una escuela de formación que cada año recibe a unos cien niños y jóvenes en canto, chirimía, percusión y construcción de instrumentos.\n\n"
            "Su trabajo se apoya en tres líneas. La primera es la formación: tres niveles de escuela, un coro infantil y un taller itinerante de marimba que viaja a comunidades del Chocó con maestros constructores como Jhon Fredy Valencia, de Guapi. "
            "La segunda es la memoria: un archivo de más de mil cantos de velorio, novena y trabajo grabados con mujeres mayores del medio Atrato, consultable bajo un protocolo de uso que la propia corporación redactó con las familias custodias. "
            "La tercera es la circulación: el Festival de Chirimía y Alabaos del Atrato, que desde 2015 reúne cada año a las agrupaciones del río y de la costa en tres noches de música, conversatorios de mayores y talleres abiertos.\n\n"
            "La corporación la dirige Nubia Palacios, fundadora y cantadora, con el acompañamiento de un consejo de mayores. En su ficha de SIMUS tienen cuenta de editor Camila Restrepo, de la Corporación Sonora Andina de Bogotá, que colabora en el registro audiovisual de los talleres, "
            "y participan como colaboradores el constructor Jhon Fredy Valencia y el productor Hernán Velásquez, de Altamira Discos, con quien se prepara el primer disco de alabaos de la corporación, con grabaciones de campo remasterizadas y notas escritas por las propias cantadoras.\n\n"
            "Trabaja en Quibdó y en municipios del medio Atrato y el Pacífico chocoano. Mantiene vínculos con escuelas de música de Tumaco y Cali y con un grupo de investigadores de una universidad regional. "
            "Sus agrupaciones asociadas son el Coro Infantil del Cabildo, la Chirimía Los Mayores del Barrio y el grupo de cantadoras Las Voces del Río."
        ),
        cambios=[
            (395, "descripcion", "Descripción", "publico", "Corporación comunitaria de Quibdó dedicada a la enseñanza de los cantos del Pacífico.", "La Corporación Cabildo Sonoro del Atrato nació en 2004 en una sala prestada de un colegio de Quibdó, cuando un grupo de maestros y cantadoras decidió que los cantos no podían seguir aprendiéndose solo en los velorios.", "directo", "admin", "Ampliación de la presentación de la corporación."),
            (360, "numeroIdentificacion", "NIT", "identificacion", None, "999.101.201-4", "directo", "admin", "Se registra el NIT de la corporación."),
            (240, "sitioWeb", "Sitio web", "publico", "https://cabildo-atrato.test", "https://cabildosonoro.test", "directo", "admin", "Cambio de dominio del sitio institucional."),
            (120, "descripcion", "Descripción", "publico", "Escuela de formación y archivo de cantos de velorio en Quibdó.", "La corporación mantiene tres líneas: formación, memoria y circulación, con un taller itinerante de marimba.", "propuesta", "admin", "Actualización con el taller itinerante y el protocolo de uso de cantos."),
        ],
        invitaciones=[("jovenes.chirimia@simus.test", "editor", "pendiente", 5), ("archivista.cabildo@simus.test", "editor", "aceptada", 150), ("asesora.escuelas@simus.test", "editor", "vencida", 200)],
        revision=395,
        multimedia=[("logo", "Logotipo del Cabildo Sonoro del Atrato: un tambor y una hoja de palma en tonos terracota")],
        documentos=[("protocolo-de-uso-de-cantos", "Protocolo de uso de cantos funerarios", "pdf"), ("informe-de-gestion-2025", "Informe de gestión 2025", "pdf")],
        proyectos=["Escuela de formación del Cabildo", "Taller itinerante de marimba", "Archivo de cantos de velorio", "Festival de Chirimía y Alabaos del Atrato", "Disco de alabaos (en producción)"],
        agrupaciones=["Coro Infantil del Cabildo", "Chirimía Los Mayores del Barrio", "Las Voces del Río"],
        festivales=[("n1.festival.festival-de-chirimia-y-alabaos-del-atrato", "organizadora")],
    ),
    dict(
        clave="fund-orquesta-juvenil-alto-magdalena", nombre="Fundación Orquesta Sinfónica Juvenil del Alto Magdalena", tipo="Fundación", muni="41001", estado="activa", admin="ruben-trujillo",
        fundada=2005, dias=370, dominio="orquestaaltomagdalena.test", telefono="+57 608 555 0102", direccion="Calle 9 n.º 12-40, barrio Calixto, Neiva", nit="999.102.202-8",
        facebook="https://facebook.com/orquesta.altomagdalena.test", instagram="https://instagram.com/orquesta.altomagdalena.test", otro="https://festival.orquestaaltomagdalena.test",
        desc=(
            "La Fundación Orquesta Sinfónica Juvenil del Alto Magdalena es un proyecto de formación sinfónica abierto a niños y jóvenes de todos los barrios de Neiva y de los municipios vecinos. Se creó en 2005 por iniciativa del violinista y director Rubén Darío Trujillo, con una regla de partida: no hay audiciones excluyentes y ningún estudiante se queda sin instrumento por falta de recursos.\n\n"
            "Hoy atiende a trescientos cincuenta estudiantes organizados en tres niveles de orquesta, una banda de vientos y un coro, con un equipo de veintidós docentes y un parque de ciento veinte instrumentos que se prestan por semestre. La sede, una casa adaptada en el barrio Calixto, tiene ocho salones de ensayo, un auditorio pequeño y una bodega de instrumentos con inventario. "
            "La fundación ha ofrecido más de doscientos conciertos en Neiva, Pitalito, Garzón y La Plata, y ha hecho giras a Bogotá, Medellín y Cali.\n\n"
            "Cada año realiza el Festival Sinfónico del Alto Magdalena, una semana de conciertos, clínicas y encuentros entre orquestas juveniles de la región, y ejecuta un programa de formación de directores de bandas y orquestas de municipios pequeños, en el que ha colaborado como asesor el maestro Gilberto Pedraza, de Sogamoso. "
            "Encarga a compositores del Huila y del Eje Cafetero obras que combinan lenguaje sinfónico y repertorio tradicional: bambucos para cuerdas, rajaleñas con vientos y un concierto para arpa y orquesta que se estrenará con el arpista llanero Eliécer Ríos como solista invitado.\n\n"
            "Sus principales retos son la sostenibilidad económica, porque depende de convocatorias anuales, y la formación de nuevos docentes entre sus propios egresados. Trabaja en un modelo de financiación compartida con otras fundaciones de la región. "
            "Sus agrupaciones son la Orquesta Infantil Semilla, la Orquesta Juvenil Principal, la Banda de Vientos Tolima Grande y el Coro Voces del Magdalena."
        ),
        cambios=[
            (365, "numeroIdentificacion", "NIT", "identificacion", None, "999.102.202-8", "directo", "admin", "Se registra el NIT de la fundación."),
            (300, "correoContacto", "Correo de contacto", "contacto", "info@orquestaaltomagdalena.test", "contacto@orquestaaltomagdalena.test", "directo", "admin", "Unificación del correo institucional."),
            (150, "descripcion", "Descripción", "publico", "Orquesta juvenil de Neiva.", "La fundación atiende a trescientos cincuenta estudiantes en tres niveles de orquesta, una banda y un coro.", "directo", "admin", "Cifras actualizadas al cierre del año lectivo."),
        ],
        invitaciones=[("docente.cuerdas@simus.test", "editor", "aceptada", 90), ("coordinacion.festival@simus.test", "administrador", "pendiente", 3)],
        revision=365,
        multimedia=[("logo", "Logotipo de la orquesta: un violín estilizado sobre una hoja de palma de iraca")],
        documentos=[("plan-pedagogico", "Plan pedagógico de la orquesta", "pdf"), ("modelo-de-orquesta-sin-audiciones", "Modelo de orquesta sin audiciones excluyentes", "pdf")],
        proyectos=["Orquesta en tres niveles", "Banda de vientos Tolima Grande", "Coro Voces del Magdalena", "Programa de formación de directores", "Festival Sinfónico del Alto Magdalena"],
        agrupaciones=["Orquesta Infantil Semilla", "Orquesta Juvenil Principal", "Banda de Vientos Tolima Grande", "Coro Voces del Magdalena"],
        festivales=[("n1.festival.festival-sinfonico-del-alto-magdalena", "organizadora")],
    ),
    dict(
        clave="casa-de-musica-la-candelaria", nombre="Casa de la Música La Candelaria", tipo="Casa cultural", muni="20001", estado="activa", admin="rosalba-perez",
        fundada=2011, dias=350, dominio="lacandelaria.test", telefono="+57 605 555 0103", direccion="Calle 15 n.º 6-32, centro histórico, Valledupar", nit=None,
        facebook="https://facebook.com/lacandelaria.test", instagram="https://instagram.com/lacandelaria.test", otro="https://archivo.lacandelaria.test",
        desc=(
            "La Casa de la Música La Candelaria funciona desde 2011 en una casona restaurada del centro de Valledupar. Empezó con una sala prestada y una docena de estudiantes de acordeón, y hoy ofrece aulas de acordeón, caja, guacharaca, canto y composición, un auditorio de ochenta puestos y una pequeña biblioteca con partituras de oído escritas por sus propios estudiantes.\n\n"
            "Su programa más conocido es «Acordeonas», que desde 2012 ha formado a más de trescientas niñas y mujeres en un instrumento que durante décadas fue territorio casi exclusivo de los hombres; varias de sus egresadas dirigen hoy sus propios grupos. "
            "La casa también acompaña a jóvenes compositores en el registro de sus obras y en la comprensión de cómo se reparten los derechos de una canción, y publica un cancionero ilustrado que se reparte en colegios.\n\n"
            "Cada año organiza el Encuentro de Acordeoneras y Cantadoras del Cesar, una semana de conciertos, clínicas y rondas de composición que reúne a intérpretes del Cesar, La Guajira y Magdalena. "
            "La dirige la acordeonera y compositora Rosalba Pérez, quien lidera además la agrupación de la casa. El equipo es pequeño, con seis docentes y dos personas de producción, y la organización aún no tiene un número de identificación tributaria propio registrado en la plataforma.\n\n"
            "Su ámbito es Valledupar y el valle del río Cesar, con colaboraciones puntuales con colegios rurales. Sus agrupaciones asociadas son Las Acordeonas de La Candelaria y el Ensamble de Cajas y Guacharacas."
        ),
        cambios=[
            (340, "descripcion", "Descripción", "publico", "Casa cultural de Valledupar.", "La casa funciona desde 2011 en una casona restaurada del centro histórico y ofrece aulas de acordeón, caja, guacharaca, canto y composición.", "directo", "admin", "Presentación inicial de la casa."),
            (200, "sitioWeb", "Sitio web", "publico", None, "https://lacandelaria.test", "directo", "admin", "Primera publicación del sitio web."),
        ],
        invitaciones=[("docente.caja@simus.test", "editor", "revocada", 60)],
        revision=340,
        multimedia=[("logo", "Logotipo de La Candelaria: un acordeón de líneas simples con una vela encendida")],
        documentos=[("cancionero-acordeonas", "Cancionero Acordeonas", "pdf")],
        proyectos=["Programa Acordeonas", "Cancionero ilustrado", "Acompañamiento a compositores jóvenes", "Encuentro de Acordeoneras y Cantadoras del Cesar"],
        agrupaciones=["Las Acordeonas de La Candelaria", "Ensamble de Cajas y Guacharacas"],
        festivales=[("n1.festival.encuentro-de-acordeoneras-y-cantadoras-del-cesar", "organizadora")],
    ),
    dict(
        clave="sello-altamira-discos", nombre="Altamira Discos", tipo="Mixto", muni="05001", estado="activa", admin="hernan-velasquez",
        fundada=2009, dias=290, dominio="altamiradiscos.test", telefono="+57 604 555 0104", direccion="Calle Colombia n.º 74-18, Medellín", nit="999.104.204-1",
        facebook="https://facebook.com/altamira.discos.test", instagram="https://instagram.com/altamira.discos.test", otro="https://archivo.altamiradiscos.test",
        desc=(
            "Altamira Discos es un sello independiente de Medellín que publica desde 2009 música que casi nunca encuentra espacio en los catálogos comerciales: bambucos, torbellinos, chirimías, arpa llanera, bandas sinfónicas, rock instrumental y obras contemporáneas. "
            "Lo fundaron tres socios con una idea sencilla: grabar bien, pagar a tiempo y dejar los derechos en manos de los artistas.\n\n"
            "Su catálogo suma cuarenta y un álbumes, diecisiete de ellos de agrupaciones de regiones distintas a Antioquia. Cada producción trae un cuadernillo con notas escritas por los músicos y una ficha técnica que explica cómo se grabó. "
            "El sello lo dirige Hernán Velásquez, productor e ingeniero de sonido, y cuenta con un consejo de producción en el que participa el compositor manizaleño Julián Arboleda, autor de «Mercado, siete de la mañana», publicado por el sello en 2022. "
            "Trabaja actualmente con la Corporación Cabildo Sonoro del Atrato en el primer disco de alabaos de la corporación.\n\n"
            "Más allá de los discos, Altamira ofrece un taller anual de producción fonográfica para agrupaciones emergentes, una guía de contratos claros de edición y un servicio de digitalización de cintas originales de músicos mayores, que conserva en custodia en un archivo propio. "
            "Cada año coordina la Rueda de Sellos y Circulación del Noroccidente, un mercado que reúne a sellos, programadores y agrupaciones para tejer redes de distribución.\n\n"
            "El sello opera en Medellín, con producciones en todo el país. Sus agrupaciones y artistas recurrentes son el Cuarteto de Cuerdas del Valle de Aburrá, la Banda Sinfónica Juvenil de Santander y el Dúo Voz y Tiple de Timbío."
        ),
        cambios=[
            (280, "numeroIdentificacion", "NIT", "identificacion", None, "999.104.204-1", "directo", "admin", "Registro del NIT del sello."),
            (210, "nombre", "Nombre", "organizacion", "Altamira Producciones", "Altamira Discos", "propuesta", "admin", "El sello adopta el nombre con el que se le conoce en el catálogo."),
            (100, "descripcion", "Descripción", "publico", "Sello independiente de Medellín.", "El sello suma cuarenta y un álbumes y coordina la Rueda de Sellos y Circulación del Noroccidente.", "directo", "admin", "Actualización del catálogo y del mercado."),
        ],
        invitaciones=[("ingeniero.mastering@simus.test", "editor", "pendiente", 8), ("promotora.catalogo@simus.test", "editor", "aceptada", 120)],
        revision=280,
        multimedia=[("logo", "Logotipo de Altamira Discos: un disco de vinilo dividido en franjas de montaña")],
        documentos=[("guia-de-contratos-claros", "Guía de contratos claros", "pdf"), ("catalogo-2025", "Catálogo 2025", "pdf")],
        proyectos=["Catálogo de 41 álbumes", "Taller de producción fonográfica", "Archivo de cintas originales", "Rueda de Sellos y Circulación del Noroccidente", "Disco de alabaos (con el Cabildo Sonoro)"],
        agrupaciones=["Cuarteto de Cuerdas del Valle de Aburrá", "Banda Sinfónica Juvenil de Santander", "Dúo Voz y Tiple de Timbío"],
        festivales=[("n1.mercado.rueda-de-sellos-y-circulacion-del-noroccidente", "organizador")],
    ),
    dict(
        clave="productora-marea-alta", nombre="Marea Alta Producciones", tipo="Mixto", muni="08001", estado="activa", admin="margarita-buelvas",
        fundada=2014, dias=380, dominio="mareaalta.test", telefono="+57 605 555 0105", direccion="Carrera 51B n.º 79-100, Barranquilla", nit="999.105.205-5",
        facebook="https://facebook.com/mareaalta.test", instagram="https://instagram.com/mareaalta.test", otro="https://boletin.mareaalta.test",
        desc=(
            "Marea Alta Producciones es una productora de eventos y circulación para músicas del Caribe, fundada en 2014 en Barranquilla por la gestora Margarita Buelvas. Con un equipo de once personas y una red de cincuenta agrupaciones asociadas, ha producido más de ochenta eventos: carnavales, giras de gaitas y tambores, ciclos de cámara en patios coloniales y ruedas de negocios para programadores nacionales.\n\n"
            "Sus dos propuestas más grandes son el Carnaval Sonoro Marea Alta, un festival de cuatro días que combina conciertos barriales con una rueda de negocios, y el Mercado de Músicas del Caribe, que reúne a agencias, sellos y festivales de ocho países de la cuenca. "
            "Ambos incluyen una mesa de asesoría legal y un ciclo de talleres sobre tarifas, contratos y derechos conexos, diseñado para que las agrupaciones pequeñas lleguen preparadas a cada cita.\n\n"
            "La productora mantiene un boletín quincenal de convocatorias con cuatro mil suscriptores, una plataforma propia de citas preprogramadas para ruedas de negocios y una política de pago a técnicos y agrupaciones dentro de los treinta días posteriores a cada evento. "
            "En el equipo participa como programadora de la escena electrónica la productora y DJ de Bucaramanga Karen Ospina, quien tiene cuenta de editora en la ficha de la organización.\n\n"
            "Su territorio principal es Barranquilla y el Caribe colombiano, con circulaciones al interior del país y a las islas. Trabaja en alianza con la Asociación Sonidos del Archipiélago, de San Andrés, y con el Colectivo Tierra Adentro, de Popayán, para intercambios de programadores. "
            "Sus agrupaciones asociadas incluyen la Gaita Mayor de Marea Alta, Tambores de la Ribera y el Ensamble de Cámara del Patio."
        ),
        cambios=[
            (375, "numeroIdentificacion", "NIT", "identificacion", None, "999.105.205-5", "directo", "admin", "Registro del NIT de la productora."),
            (330, "correoContacto", "Correo de contacto", "contacto", "marea@mareaalta.test", "contacto@mareaalta.test", "directo", "admin", "Correo general de la productora."),
            (180, "descripcion", "Descripción", "publico", "Productora de eventos del Caribe.", "Productora con once personas, cincuenta agrupaciones asociadas y dos propuestas insignia: un carnaval sonoro y un mercado de músicas.", "propuesta", "admin", "Actualización de cifras y propuestas."),
            (60, "otroEnlace", "Otro enlace", "publico", "https://mareaalta.test/boletin", "https://boletin.mareaalta.test", "sistema", "gestion", "La gestión corrigió el enlace al boletín, que cambió de dirección."),
        ],
        invitaciones=[("produccion.carnaval@simus.test", "editor", "aceptada", 200), ("tecnico.sonido@simus.test", "editor", "vencida", 130), ("asesor.legal@simus.test", "editor", "pendiente", 2)],
        revision=375,
        multimedia=[("logo", "Logotipo de Marea Alta: una ola estilizada con tres líneas paralelas en azul y naranja")],
        documentos=[("guia-para-ruedas-de-negocios", "Guía para llegar preparados a una rueda de negocios", "pdf"), ("politica-de-pagos", "Política de pagos a técnicos y agrupaciones", "pdf")],
        proyectos=["Carnaval Sonoro Marea Alta", "Mercado de Músicas del Caribe", "Boletín quincenal de convocatorias", "Plataforma de citas preprogramadas", "Mesa de asesoría legal"],
        agrupaciones=["Gaita Mayor de Marea Alta", "Tambores de la Ribera", "Ensamble de Cámara del Patio"],
        festivales=[("n1.festival.carnaval-sonoro-marea-alta", "organizadora"), ("n1.mercado.mercado-de-musicas-del-caribe-marea-alta", "organizadora")],
    ),
    dict(
        clave="escuela-de-luteria-el-roble", nombre="Escuela de Lutería El Roble", tipo="Otro", muni="63001", estado="activa", admin="luis-ernesto-castano",
        fundada=2007, dias=360, dominio="luteriaelroble.test", telefono="+57 606 555 0106", direccion="Carrera 18 n.º 20-30, Armenia", nit="999.106.206-2",
        facebook="https://facebook.com/luteria.elroble.test", instagram="https://instagram.com/luteria.elroble.test", otro="https://encuentro.luteriaelroble.test",
        desc=(
            "La Escuela de Lutería El Roble es un taller-escuela de Armenia donde se aprende a construir y restaurar tiples, guitarras, bandolas y requintos. Nació en 2007 de la decisión del maestro Luis Ernesto Castaño de enseñar de manera formal lo que durante quince años había transmitido a unos pocos aprendices, y se sostiene con la restauración de instrumentos para escuelas de música de municipios pequeños, a las que cobra solo los materiales.\n\n"
            "La formación se organiza en tres niveles, acercamiento, construcción y restauración, y recibe cada año a veinticuatro aprendices con una lista de espera de casi el doble. La escuela cuenta con un taller de maderas, un cuarto de barnices, una sala de pruebas acústicas con analizador de espectro y una pequeña biblioteca técnica. "
            "Su archivo conserva el registro fotográfico y audiovisual de más de mil cuatrocientos instrumentos restaurados, entre ellos el proceso completo de una bandola de 1920, que en 2024 fue grabado en un documental corto por Camila Restrepo, de la Corporación Sonora Andina de Bogotá, hoy editor de la ficha de la escuela.\n\n"
            "Cada año organiza el Encuentro Nacional de Lutería y Cuerdas, con exposición de instrumentos, clínicas de restauración y un concierto de cierre. Mantiene intercambios de saberes con constructores de otras regiones, entre ellos el marimbero y constructor Jhon Fredy Valencia, de Guapi, que visitó la escuela en 2025 para trabajar sobre maderas y tratamientos.\n\n"
            "Su territorio es el Eje Cafetero y las escuelas de música que atiende en todo el país. Sus agrupaciones asociadas son el Cuarteto de Cuerdas El Roble y el Ensamble de Tiples del Quindío, formados por docentes y egresados."
        ),
        cambios=[
            (355, "numeroIdentificacion", "NIT", "identificacion", None, "999.106.206-2", "directo", "admin", "Registro del NIT de la escuela."),
            (220, "descripcion", "Descripción", "publico", "Taller de lutería en Armenia.", "Taller-escuela con tres niveles de formación, sala de pruebas acústicas y registro de más de mil cuatrocientas restauraciones.", "directo", "admin", "Descripción ampliada tras la apertura de la sala de pruebas."),
            (90, "instagram", "Instagram", "publico", None, "https://instagram.com/luteria.elroble.test", "directo", "admin", "Se agrega la cuenta de la escuela."),
        ],
        invitaciones=[("docente.restauracion@simus.test", "editor", "aceptada", 100), ("aspirante.beca@simus.test", "editor", "revocada", 45)],
        revision=355,
        multimedia=[("logo", "Logotipo de El Roble: una hoja de roble con una clavija de guitarra en el centro")],
        documentos=[("manual-de-restauracion", "Manual de restauración de cuerdas tradicionales", "pdf"), ("reglamento-de-aprendices", "Reglamento de aprendices", "pdf")],
        proyectos=["Formación en tres niveles", "Restauración para escuelas de música", "Registro de más de mil cuatrocientas restauraciones", "Encuentro Nacional de Lutería y Cuerdas"],
        agrupaciones=["Cuarteto de Cuerdas El Roble", "Ensamble de Tiples del Quindío"],
        festivales=[("n1.festival.encuentro-nacional-de-luteria-y-cuerdas", "organizadora")],
    ),
    dict(
        clave="colectivo-tierra-adentro", nombre="Colectivo Tierra Adentro", tipo="Comunitario", muni="19001", estado="activa", admin="claudia-munoz",
        fundada=2009, dias=330, dominio="tierraadentro.test", telefono="+57 602 555 0107", direccion="Calle 5 n.º 4-18, centro, Popayán", nit=None,
        facebook="https://facebook.com/tierraadentro.cauca.test", instagram="https://instagram.com/tierraadentro.cauca.test", otro="https://archivo.tierraadentro.test",
        desc=(
            "El Colectivo Tierra Adentro es una red de investigadores, cantantes y maestros rurales que desde 2009 documenta y devuelve a sus comunidades los cantos de trabajo del alto Cauca: cantos de arriería, de trilla, de azada, coplas de siembra y de cosecha. Lo coordina desde Popayán la antropóloga y cantante Claudia Muñoz, y lo integran cuarenta personas de once municipios del Cauca y el sur del Valle.\n\n"
            "Su archivo comunitario reúne seiscientas grabaciones de campo, cada una con el nombre de quien la cantó y las condiciones de uso que su familia decidió. Con esos materiales el colectivo ofrece talleres de escritura de coplas en escuelas rurales, un coro comunitario con arreglos de la compositora Olga Mejía, de Pereira, y un taller anual de flautas con el constructor Fabián Rojas, de Ipiales. "
            "Cuenta también con la asesoría en consentimiento y archivo de la etnomusicóloga Ángela Burbano, de Mocoa.\n\n"
            "Desde 2023 colabora con la gestora Camila Restrepo, de la Corporación Sonora Andina de Bogotá, editora de la ficha del colectivo, que acompañó en campo el registro de un conjunto de cantos del alto Cauca y apoyó la organización de la documentación del archivo. "
            "Cada año el colectivo organiza el Encuentro de Cantos de Trabajo de Popayán, donde se reúnen cantadoras y cantadores de varias generaciones, mantiene un intercambio de programadores con Marea Alta Producciones, de Barranquilla, y trabaja en un mapa sonoro del alto Cauca que permitirá escuchar los cantos en el lugar donde se grabaron.\n\n"
            "Su territorio son las veredas y los cascos urbanos del Cauca andino. El colectivo no tiene aún un número de identificación tributaria registrado. Sus agrupaciones asociadas son el Coro Comunitario Tierra Adentro, el Dúo Voz y Tiple de Timbío y el grupo de coplas Los Sembradores."
        ),
        cambios=[
            (320, "descripcion", "Descripción", "publico", "Colectivo de investigación de cantos rurales.", "Red de investigadores, cantantes y maestros rurales que documenta cantos de trabajo del alto Cauca y los devuelve a sus familias.", "directo", "admin", "Presentación completa del colectivo."),
            (150, "sitioWeb", "Sitio web", "publico", None, "https://tierraadentro.test", "directo", "admin", "Publicación del sitio del colectivo."),
            (70, "descripcion", "Descripción", "publico", "Red de investigadores, cantantes y maestros rurales.", "El colectivo suma un coro comunitario, un taller anual de flautas y el proyecto de un mapa sonoro.", "propuesta", "admin", "Actualización de los proyectos en marcha."),
        ],
        invitaciones=[("coordinacion.veredas@simus.test", "editor", "pendiente", 10)],
        revision=None,
        multimedia=[("logo", "Logotipo de Tierra Adentro: una cordillera dibujada con una línea de pentagrama")],
        documentos=[("acuerdo-de-uso-del-archivo", "Acuerdo de uso del archivo comunitario", "pdf")],
        proyectos=["Archivo comunitario de cantos de trabajo", "Talleres de coplas en escuelas rurales", "Coro comunitario", "Mapa sonoro del alto Cauca", "Encuentro de Cantos de Trabajo de Popayán"],
        agrupaciones=["Coro Comunitario Tierra Adentro", "Dúo Voz y Tiple de Timbío", "Los Sembradores"],
        festivales=[("n1.festival.encuentro-de-cantos-de-trabajo-de-popayan", "organizadora")],
    ),
]
