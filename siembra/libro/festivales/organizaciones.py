"""Personas y organizaciones SINTÉTICAS que producen los festivales y mercados del libro de festivales (nombres inventados).

Numeración de teléfonos y documentos: base 300 (ver LEEME.md). Municipios: códigos DIVIPOLA de 5 dígitos.
"""
from __future__ import annotations

PERSONAS = [
    dict(clave="nubia-mosquera-palacios", nombre=("Nubia", "Mosquera", "Palacios"), muni="27077", doc="cc", oficio="cantadora de alabaos y arrullos",
         corta="Cantadora de alabaos y arrullos del Bajo Baudó; preside una corporación de mujeres que enseña los cantos a niñas y niños de la cuenca.",
         larga="Nubia aprendió los alabaos acompañando a su abuela en los novenarios de la ribera del Baudó, y desde joven dirige coros de mujeres que cantan en velorios, fiestas de santos y celebraciones de la comunidad. "
               "Hoy coordina una corporación que graba a las cantadoras mayores, organiza encuentros anuales en la cabecera municipal y lleva los cantos a las escuelas de las veredas más alejadas del río."),
    dict(clave="eulogio-perea-asprilla", nombre=("Eulogio", "Perea", "Asprilla"), muni="27001", doc="cc", oficio="maestro de percusión y logística de festivales",
         corta="Percusionista y productor de campo; coordina la logística de encuentros musicales en el Chocó.",
         larga="Eulogio toca el cununo y el bombo desde la adolescencia y durante quince años ha resuelto lo que ningún programa dice: botes, planta eléctrica, alojamiento en casas de familia y afinación de tambores bajo la lluvia. "
               "Acompaña a la corporación del Baudó como coordinador de producción y enseña a jóvenes a montar un escenario en comunidades sin red eléctrica."),
    dict(clave="yolanda-redondo-camargo", nombre=("Yolanda", "Redondo", "Camargo"), muni="47189", doc="cc", oficio="cantadora de bullerengue y docente",
         corta="Cantadora de bullerengue y maestra de primaria en la Ciénaga Grande; lidera un colectivo de tamboreras.",
         larga="Yolanda dicta clases en una escuela de la zona palafítica de la Ciénaga Grande y por las tardes ensaya con un grupo de mujeres que mantiene el bullerengue sentado y el tambor alegre. "
               "Reúne versos de pescadoras y lavanderas, los transcribe en cuadernos escolares y organiza con su colectivo un encuentro anual que mezcla ruedas de cantos con talleres de elaboración de tambores."),
    dict(clave="gustavo-alarcon-pinzon", nombre=("Gustavo", "Alarcón", "Pinzón"), muni="15238", doc="cc", oficio="requintista y luthier",
         corta="Requintista y luthier boyacense; dirige una fundación de música de cuerdas andinas en Duitama.",
         larga="Gustavo construye tiples y requintos en un taller familiar de Duitama y ha formado a más de un centenar de niños en escuelas rurales del altiplano. "
               "Fundó una organización que programa conciertos de cuerdas en pueblos de páramo y mantiene un archivo de partituras manuscritas de maestros de la región."),
    dict(clave="leidy-beltran-moya", nombre=("Leidy Johana", "Beltrán", "Moya"), muni="50313", doc="cc", oficio="arpista y gestora cultural",
         corta="Arpista y gestora cultural del piedemonte llanero; dirige una corporación dedicada al arpa y al cuatro.",
         larga="Leidy empezó con un arpa prestada en una escuela de Granada y hoy dirige una corporación que organiza festivales, escuelas de formación y una vitrina de circulación para agrupaciones llaneras. "
               "Defiende el pago justo a los músicos y ha pasado años enseñando a las agrupaciones jóvenes a negociar sus presentaciones y a leer un contrato."),
    dict(clave="nelson-ardila-quiroga", nombre=("Nelson", "Ardila", "Quiroga"), muni="50001", doc="cc", oficio="cuatrista y productor técnico",
         corta="Cuatrista y productor técnico de eventos en el Meta; coordina sonido y escenarios de festivales llaneros.",
         larga="Nelson combina el cuatro con la mesa de sonido: durante la semana ofrece clases en Villavicencio y los fines de semana monta los escenarios de los festivales del piedemonte. "
               "Es el encargado técnico de la corporación del Ariari y capacita a bachilleres en operación de sonido para música tradicional."),
    dict(clave="rubiel-mantilla-saavedra", nombre=("Rubiel", "Mantilla", "Saavedra"), muni="85250", doc="cc", oficio="copleros y cuatrista",
         corta="Coplero y cuatrista de Paz de Ariporo; reúne a copleros de hatos y veredas del Casanare.",
         larga="Rubiel creció entre trabajos de ganadería y contrapunteos de coplas en las fiestas de los hatos. Con un colectivo de vecinos graba a copleros mayores, organiza encuentros en la sabana y enseña a niños de la escuela rural a improvisar versos sin perder el respeto por la tradición."),
    dict(clave="marcela-perdomo-hoyos", nombre=("Marcela", "Perdomo", "Hoyos"), muni="18001", doc="cc", oficio="cantante e investigadora de músicas amazónicas",
         corta="Cantante e investigadora; dirige una fundación que documenta cantos de los ríos del Caquetá.",
         larga="Marcela recorre desde hace una década los afluentes del Caquetá grabando cantos de trabajo, arrullos y músicas de fiesta con familias campesinas e indígenas. "
               "Dirige una fundación que forma jóvenes en registro sonoro y presenta resultados en muestras abiertas en Florencia, siempre con acuerdos de uso firmados con quienes cantan."),
    dict(clave="audrey-archbold-pomare", nombre=("Audrey", "Archbold", "Pomare"), muni="88001", doc="cc", oficio="cantante de calipso y mento, docente",
         corta="Cantante raizal de calipso y mento; docente de música y presidenta de una casa cultural isleña.",
         larga="Audrey canta en inglés criollo y en español desde niña, con repertorio de calipso, mento y baladas de las islas. Preside una casa cultural del barrio Cove que ofrece clases de guitarra, ukelele y percusión menor, y organiza cada año una muestra donde abuelos y nietos comparten tarima."),
    dict(clave="wilmer-gomez-rueda", nombre=("Wilmer", "Gómez", "Rueda"), muni="68679", doc="cc", oficio="tiplista y compositor",
         corta="Tiplista y compositor guanentino; presidió una corporación cultural de San Gil hasta su pausa.",
         larga="Wilmer toca el tiple desde los doce años y ha compuesto torbellinos y bambucos para estudiantinas de la provincia. Presidió la corporación que organizó durante años un festival de torbellino y tiple, y hoy conserva el archivo de afiches, programas y grabaciones de aquellas ediciones."),
    dict(clave="cecilia-mavisoy-tisoy", nombre=("Cecilia", "Mavisoy", "Tisoy"), muni="86749", doc="cc", oficio="flautista y maestra de música tradicional",
         corta="Flautista y maestra del Valle de Sibundoy; coordina una asociación de flautistas y constructores de instrumentos.",
         larga="Cecilia enseña flautas de caña y tambores en la escuela de su comunidad, y coordina una asociación que reúne a flautistas, tejedoras y constructores del valle alto. "
               "Impulsa encuentros donde los mayores explican el origen de cada pieza antes de tocarla, y vela por que los registros se hagan con permiso de las familias."),
    dict(clave="jhon-penaloza-cardenas", nombre=("Jhon Fredy", "Peñaloza", "Cárdenas"), muni="99001", doc="cc", oficio="gestor cultural y guitarrista",
         corta="Gestor cultural y guitarrista del Vichada; promueve encuentros de música llanera y de frontera.",
         larga="Jhon Fredy llegó a Puerto Carreño como profesor de música y se quedó para armar un colectivo que une joropo de la sabana, música de la ribera del Orinoco y ritmos de la frontera. Presentó la propuesta de un encuentro regional que aún busca completar su ficha y su equipo."),
    dict(clave="fabian-ortega-salgado", nombre=("Fabián", "Ortega", "Salgado"), muni="70820", doc="cc", oficio="productor de ruedas de negocios",
         corta="Productor musical del Golfo de Morrosquillo; organiza ferias de circulación para agrupaciones costeñas.",
         larga="Fabián gestiona citas entre programadores y agrupaciones del golfo desde hace ocho años. Trabaja con pescadores-músicos, cumbiamberos y bandas de pueblo, y prepara cada feria con talleres previos sobre fichas técnicas, tarifas y manejo de contratos."),
    dict(clave="julian-ospina-marin", nombre=("Julián", "Ospina", "Marín"), muni="66001", doc="cc", oficio="gestor de industrias creativas y bajista",
         corta="Gestor de industrias creativas y bajista pereirano; impulsa una cooperativa de músicos del Eje Cafetero.",
         larga="Julián tocó en bandas de rock y de música andina antes de estudiar gestión cultural. Dirige una cooperativa de músicos del Eje Cafetero que organiza vitrinas de circulación, asesoría contable para artistas y un programa de acompañamiento a primeras giras."),
    dict(clave="sandra-contreras-villamizar", nombre=("Sandra Milena", "Contreras", "Villamizar"), muni="54001", doc="cc", oficio="productora y cantante de música de frontera",
         corta="Cantante y productora cucuteña; coordina una corporación de músicas de frontera.",
         larga="Sandra canta carrilera, vallenato y música andina, y desde Cúcuta tiende puentes con agrupaciones de ambos lados de la frontera. Su corporación reúne a artistas, programadores y emisoras para pensar cómo circula la música cuando los pasos cambian de horario y de reglas."),
]

# tipo: etiqueta del catálogo de tipos de organizador de SIMUS (el generador solo lo usa para describir); estado: activa | inactiva | pendiente_de_confirmacion
ORGANIZACIONES = [
    dict(clave="corp-alabao-y-bahia", nombre="Corporación Alabao y Bahía", tipo="Comunitario", muni="27077", estado="activa", admin="nubia-mosquera-palacios", editor="eulogio-perea-asprilla", dias=560,
         desc="Corporación de mujeres cantadoras del Bajo Baudó que graba alabaos y arrullos, enseña los cantos en escuelas de la ribera y organiza un encuentro anual en la cabecera municipal con recorridos en lancha."),
    dict(clave="asoc-cantadoras-de-la-cienaga", nombre="Asociación Cantadoras de la Ciénaga", tipo="Comunitario", muni="47189", estado="activa", admin="yolanda-redondo-camargo", editor=None, dias=520,
         desc="Colectivo de tamboreras y cantadoras de los pueblos palafíticos de la Ciénaga Grande; mantiene el bullerengue sentado, recopila versos en cuadernos escolares y construye tambores alegres en talleres abiertos."),
    dict(clave="fund-cuerdas-del-paramo", nombre="Fundación Cuerdas del Páramo", tipo="Fundación", muni="15238", estado="activa", admin="gustavo-alarcon-pinzon", editor=None, dias=540,
         desc="Fundación de Duitama dedicada a la música de cuerdas andinas: escuelas rurales de tiple y requinto, taller de lutería, archivo de partituras manuscritas y un festival itinerante por pueblos de páramo."),
    dict(clave="corp-arpa-del-ariari", nombre="Corporación Arpa del Ariari", tipo="Mixto", muni="50313", estado="activa", admin="leidy-beltran-moya", editor="nelson-ardila-quiroga", dias=500,
         desc="Corporación del piedemonte llanero que reúne arpistas, cuatristas y cantantes; produce un festival anual, una vitrina de circulación para agrupaciones y una escuela de formación técnica en sonido para música tradicional."),
    dict(clave="colectivo-coplas-del-cravo", nombre="Colectivo Coplas del Cravo", tipo="Comunitario", muni="85250", estado="activa", admin="rubiel-mantilla-saavedra", editor=None, dias=380,
         desc="Colectivo de copleros y cuatristas de Paz de Ariporo que graba a los mayores, organiza encuentros de coplas en hatos y veredas y enseña improvisación de versos a niños de la escuela rural."),
    dict(clave="fund-voces-del-caqueta", nombre="Fundación Voces del Caquetá", tipo="Fundación", muni="18001", estado="activa", admin="marcela-perdomo-hoyos", editor=None, dias=430,
         desc="Fundación de Florencia que documenta cantos de trabajo, arrullos y músicas de fiesta de los ríos del Caquetá, forma jóvenes en registro sonoro y presenta resultados en muestras abiertas con acuerdos de uso."),
    dict(clave="casa-cultural-del-cove", nombre="Casa Cultural del Cove", tipo="Casa cultural", muni="88001", estado="activa", admin="audrey-archbold-pomare", editor=None, dias=470,
         desc="Casa cultural raizal del barrio Cove, en San Andrés: clases de guitarra, ukelele y percusión menor, ensayos abiertos de calipso y mento y una muestra anual en la que abuelos y nietos comparten tarima."),
    dict(clave="corp-guanentina-de-cultura", nombre="Corporación Guanentina de Cultura", tipo="Mixto", muni="68679", estado="inactiva", admin="wilmer-gomez-rueda", editor=None, dias=590,
         desc="Corporación sangileña que organizó un festival de torbellino y tiple en la provincia guanentina; está en pausa administrativa y conserva su ficha y su archivo de afiches y programas."),
    dict(clave="asoc-flautas-del-valle-alto", nombre="Asociación Flautas del Valle Alto", tipo="Comunitario", muni="86749", estado="activa", admin="cecilia-mavisoy-tisoy", editor=None, dias=300,
         desc="Asociación de flautistas, constructores de instrumentos y tejedoras del Valle de Sibundoy; organiza encuentros donde los mayores explican el origen de las piezas antes de interpretarlas."),
    dict(clave="colectivo-orinoco-sonoro", nombre="Colectivo Orinoco Sonoro", tipo="Comunitario", muni="99001", estado="pendiente_de_confirmacion", admin="jhon-penaloza-cardenas", editor=None, dias=140,
         desc="Colectivo de Puerto Carreño que une joropo de sabana, músicas de la ribera del Orinoco y ritmos de frontera; su ficha está pendiente de confirmación del equipo responsable."),
    dict(clave="agencia-golfo-en-vivo", nombre="Agencia Golfo en Vivo", tipo="Mixto", muni="70820", estado="activa", admin="fabian-ortega-salgado", editor=None, dias=450,
         desc="Agencia de producción de Santiago de Tolú que organiza ferias de circulación para agrupaciones del Golfo de Morrosquillo, con talleres previos sobre fichas técnicas, tarifas y contratos."),
    dict(clave="coop-eje-sonoro", nombre="Cooperativa Eje Sonoro", tipo="Mixto", muni="66001", estado="activa", admin="julian-ospina-marin", editor=None, dias=410,
         desc="Cooperativa de músicos del Eje Cafetero que ofrece asesoría contable, acompañamiento a primeras giras y una vitrina anual de circulación abierta a agrupaciones de todo el país."),
    dict(clave="corp-frontera-sonora", nombre="Corporación Frontera Sonora", tipo="Mixto", muni="54001", estado="activa", admin="sandra-contreras-villamizar", editor=None, dias=250,
         desc="Corporación de Cúcuta que reúne artistas, programadores y emisoras a ambos lados de la frontera para pensar la circulación de la música; prepara un mercado de músicas del nororiente."),
]
