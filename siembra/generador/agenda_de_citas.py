"""Agendas de citas de mercados para la demo integral: organizar (organización) y participar (artista, compradora).

Una herramienta de la edición de un Mercado (docs/referencia/26-agenda-de-citas-y-mercados.md): la organización habilita una agenda, fija franjas y compradores; los artistas se
inscriben y piden o responden citas. Se siembran TRES agendas sobre el Mercado PUBLICADO de la organización grande de las cuentas de
validación (Corporación Sonora Andina, que administra `camila.restrepo@simus.test`; `editor@simus.test` es su editor):

  abierta   edición 2027, «Rueda de citas con programadores y sellos»: franjas, 5 artistas aprobados, 1 por decidir, 2 en lista de espera,
            1 rechazado; 4 compradores con mesa (3 con cuenta y 1 invitada que aún no la tiene); citas solicitadas, confirmadas, rechazadas,
            canceladas y vencidas.
  borrador  edición 2027, «Ronda de citas con medios y editoriales»: recién creada, solo configurada (se prueba organizar desde cero).
  cerrada   edición 2025, ya realizada: los compradores reciben en su mesa y los artistas rotan (el otro modo); todo ya ocurrió.
  mesas fijas  edición 2027, «Rueda de citas con mesas fijas»: ABIERTA en la otra modalidad (compradores con mesa fija; los artistas rotan y piden), con mesas
            asignadas y solicitudes PENDIENTES de los artistas que cada comprador debe confirmar o rechazar: sirve para mostrar completas las tres ópticas.

En la agenda abierta de stands fijos cada artista admitido tiene su stand asignado (dato de siembra: la lógica de asignación ya existe en la organización).

Las personas son las del libro N1 de personas (cuentas `@simus.test`, clave «admin»): los artistas y compradores participan con su cuenta,
y `nuevo@simus.test` queda SIN participación para inscribirse como artista desde cero. Todo es sintético (nivel 1, lote `n1-agenda-de-citas`,
claves estables `n1.agenda-de-citas.*`). Idempotente por alias; se puede aplicar sola a una demo ya sembrada
(`scripts/demo/sembrar-agenda-de-citas.sh`): resuelve por alias el Mercado, sus ediciones y las cuentas, que ya existen.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from constructores import momento
from nucleo import Ref

LOTE = "n1-agenda-de-citas"
NIVEL = 1
MERCADO = "mercado.camila-grande-mercado-publicado"
ORGANIZADORA = "cuenta.externo-camila"      # camila.restrepo@simus.test: administra la organización del mercado

CLAVE_ABIERTA = "n1.agenda-de-citas.abierta"
CLAVE_BORRADOR = "n1.agenda-de-citas.borrador"
CLAVE_CERRADA = "n1.agenda-de-citas.cerrada"
CLAVE_FIJA = "n1.agenda-de-citas.abierta-mesas-fijas"
ALIAS_ABIERTA = "agenda-de-citas.abierta"
ALIAS_BORRADOR = "agenda-de-citas.borrador"
ALIAS_CERRADA = "agenda-de-citas.cerrada"
ALIAS_FIJA = "agenda-de-citas.abierta-mesas-fijas"
NOMBRE_ABIERTA = "Rueda de citas con programadores y sellos"
NOMBRE_BORRADOR = "Ronda de citas con medios y editoriales"
NOMBRE_CERRADA = "Rueda de citas 2025"
NOMBRE_FIJA = "Rueda de citas con mesas fijas"

# Los stands de los artistas admitidos de la agenda abierta de stands fijos (la que rotan los compradores).
STANDS_ABIERTA = {"eliecer-rios": "Stand 1", "martha-rangel": "Stand 2", "gilberto-pedraza": "Stand 3", "dennis-bryan": "Stand 4", "fabian-rojas": "Stand 5"}

# Artistas (todas son personas del libro N1: la cuenta es `<nombre>.<apellido>@simus.test`).
# clave → (cuenta, nombre visible, agrupación o proyecto, presentación, enlaces, representa, teléfono)
ARTISTAS = {
    "eliecer-rios": (
        "Eliécer Ríos", "Corporación Música del Llano",
        "Arpa llanera, cuatro y capachos: joropo tradicional y composiciones nuevas para festival y sala. Doce años de giras por Casanare, Arauca y Meta, "
        "dos discos grabados y un formato de cuarteto que cabe en cualquier escenario mediano.",
        "https://musicadelllano.simus.test/escucha\nhttps://musicadelllano.simus.test/video-en-vivo", None, "+57 310 000 0301"),
    "martha-rangel": (
        "Martha Rangel", "Corporación Guabina y Tiple",
        "Cuarteto de tiple, requinto, guabina cantada y coplas recopiladas en Vélez. Repertorio andino santandereano con arreglos de cámara y un espectáculo "
        "didáctico para casas de cultura y festivales de música de raíz.",
        "https://guabinaytiple.simus.test/audio\nhttps://guabinaytiple.simus.test/video", None, "+57 310 000 0302"),
    "gilberto-pedraza": (
        "Gilberto Pedraza", "Banda de Vientos del Alto Chicamocha",
        "Banda sinfónica de vientos de dieciocho músicos de Sogamoso con repertorio de marchas, pasodobles y música andina arreglada para banda. "
        "Tiene un programa de concierto de una hora y un formato reducido de quinteto de metales.",
        "https://bandachicamocha.simus.test/conciertos", "Representa a la Banda de Vientos del Alto Chicamocha", "+57 310 000 0303"),
    "dennis-bryan": (
        "Dennis Bryan", "Sonidos del Archipiélago",
        "Mento, calipso y música raizal de San Andrés y Providencia en formato de guitarra, bajo, percusión y voz, cantada en creole y en español. "
        "Ha tocado en festivales del Caribe insular y busca circuito en el continente.",
        "https://sonidosdelarchipielago.simus.test/en-vivo", None, "+57 310 000 0304"),
    "fabian-rojas": (
        "Fabián Rojas", "Aires de Frontera",
        "Ensamble de zampoñas, quenas y rondadores construidos por el propio grupo en Ipiales, con música andina del sur de Nariño y del norte del Ecuador. "
        "Ofrece concierto y taller de construcción de flautas para público familiar.",
        "https://airesdefrontera.simus.test/audio\nhttps://airesdefrontera.simus.test/taller", None, "+57 310 000 0305"),
    "tatiana-cardozo": (
        "Tatiana Cardozo", "Maloca Sonora",
        "Canciones y músicas de la triple frontera amazónica, entre el español, el portugués y lenguas de la región, con un formato de voz, guitarra y percusión menor. "
        "Presenta además una conferencia cantada sobre el trabajo de archivo con las comunidades.",
        "https://malocasonora.simus.test/escucha", None, "+57 310 000 0306"),
    "olga-mejia": (
        "Olga Mejía", "Voces del Eje (coro de cámara)",
        "Coro de cámara de dieciséis voces con arreglos de músicas andinas para coro a capela y con tiple, bandola y guitarra. Recorre casas de cultura y templos del Eje Cafetero.",
        "https://vocesdeleje.simus.test/audio", None, "+57 310 000 0307"),
    "julian-arboleda": (
        "Julián Arboleda", "Ensamble de obra por encargo",
        "Ensamble de música contemporánea de cámara que escribe obras por encargo a partir de materiales tradicionales colombianos. "
        "Programa de cuarenta minutos para sala pequeña o festival de músicas nuevas.",
        "https://obraporencargo.simus.test/escucha", None, "+57 310 000 0308"),
    "angela-burbano": (
        "Ángela Burbano", "Corporación Tejidos de Aire",
        "Registro y circulación de músicas del piedemonte con acuerdos de consentimiento con las autoridades de cada pueblo; propone un formato de conferencia con escucha guiada.",
        "https://tejidosdeaire.simus.test/escucha", None, "+57 310 000 0309"),
}

# Compradores o bookers. Con cuenta: (clave de persona, entidad, tipo, presentación, mesa). Sin cuenta: la persona que invitó el Mercado.
COMPRADORES = {
    "margarita-buelvas": ("Margarita Buelvas", "Marea Alta Producciones", "agencia", "margarita.buelvas@simus.test",
                          "Producimos festivales y ruedas de negocios para músicas del Caribe y buscamos agrupaciones con repertorio propio y ficha técnica lista para contratar.",
                          "Mesa 1"),
    "hernan-velasquez": ("Hernán Velásquez", "Altamira Discos", "sello", "hernan.velasquez@simus.test",
                         "Sello independiente de músicas tradicionales y alternativas. Escuchamos propuestas para grabación y buscamos agrupaciones con material en vivo.",
                         "Mesa 2"),
    "rosalba-perez": ("Rosalba Pérez", "Casa de la Música La Candelaria", "sala", "rosalba.perez@simus.test",
                      "Sala de ciento veinte personas en Valledupar con temporada de conciertos de jueves a sábado. Programamos música de raíz y formatos de cámara.",
                      "Mesa 3"),
}
INVITADA = dict(clave="yuliana-mosquera", nombre="Yuliana Mosquera Mena", entidad="Festival de Arrullos y Alabaos del Baudó", tipo="festival",
                correo="programacion@arrullosbaudo.test", mesa="Mesa 4", dep="27",
                presentacion="Coordino la programación del festival: tres escenarios de músicas del Pacífico y de río. Buscamos agrupaciones que dialoguen con las cantadoras y los tamboreros de la región.")

# Mensajes de quien pide la cita (el que rota) y motivos de quien decide, variados y sin repetirse en la misma agenda.
MENSAJES = {
    "margarita-buelvas": ["Me gustaría escuchar su propuesta en vivo para uno de nuestros festivales del Caribe.", "¿Tienen ficha técnica y rider para giras de fin de semana?",
                          "Buscamos una agrupación para abrir una noche de circulación en Barranquilla.", "Quiero conversar sobre fechas posibles de gira para el segundo semestre."],
    "hernan-velasquez": ["Escuché su registro y quisiera hablar de una posible grabación.", "¿Tienen material en vivo que pueda oír con calma?",
                         "Estamos armando el catálogo del año próximo y su repertorio calza con lo que buscamos.", "Me interesa conversar sobre la edición de un disco de campo."],
    "rosalba-perez": ["Nuestra sala tiene fechas libres en marzo y su formato de cámara encaja.", "Quisiera conocer su espectáculo didáctico para escuelas.",
                      "¿Podrían tocar un jueves de temporada en Valledupar?", "Quiero saber qué necesitan en escena para programarlos."],
    "yuliana-mosquera": ["Les propongo conversar sobre una invitación al festival del Baudó.", "¿Les interesaría un intercambio de repertorio con cantadoras de la región?",
                         "Buscamos una agrupación para el escenario de río del festival.", "Queremos escuchar su propuesta para la edición próxima."],
}
CLAUSULA_ARTISTA = {"eliecer-rios": "Me interesa el cuarteto de arpa llanera.", "martha-rangel": "Vi su espectáculo didáctico de guabina y tiple.",
                    "gilberto-pedraza": "Nos llamó la atención el formato de banda de vientos.", "dennis-bryan": "Su repertorio cantado en creole es justo lo que buscamos.",
                    "fabian-rojas": "El taller de construcción de flautas sería un valor añadido."}
CLAUSULA_COMPRADOR = {"margarita-buelvas": "Producimos circulación en el Caribe y buscamos propuestas nuevas.", "hernan-velasquez": "Armamos el catálogo del año entrante.",
                      "rosalba-perez": "Nuestra sala recibe grupos de raíz todo el año.", "yuliana-mosquera": "El festival abre convocatoria de escenarios en marzo."}
MOTIVOS_RECHAZO = ["Ese horario lo tengo cruzado con la prueba de sonido de otra agrupación.", "En esa franja estamos entrevistados por una emisora de la ciudad.",
                   "Por ahora no tenemos disponibilidad de gira en esas fechas.", "Preferimos conversar en la siguiente franja, que tenemos libre."]
MOTIVOS_CANCELA = ["Se nos cruzó un compromiso y no alcanzamos a llegar a esa hora.", "Cambió la agenda del equipo y preferimos reprogramar con calma."]


def _bogota(dia: dt.date, hora: int, minuto: int) -> dt.datetime:
    """Hora de Bogotá (UTC−5) → UTC."""
    return dt.datetime(dia.year, dia.month, dia.day, hora + 5, minuto, 0)


def _franjas(plan, c, alias_agenda: str, dias: list, por_dia: int, duracion: int, pausa: int, hora0: int = 9) -> list:
    """Una fila por franja, desde las 9:00 de Bogotá cada `duracion + pausa` minutos. Devuelve los alias en orden."""
    alias = []
    for d, dia in enumerate(dias):
        for k in range(por_dia):
            ini = _bogota(dia, hora0, 0) + dt.timedelta(minutes=k * (duracion + pausa))
            a = f"{alias_agenda}.franja.{d * por_dia + k:02d}"
            c.add("FranjasDeCitas", {"AgendaId": Ref(alias_agenda), "InicioUtc": ini, "FinUtc": ini + dt.timedelta(minutes=duracion)}, alias=a, lote=LOTE, nivel=NIVEL, procedencia="sintetico")
            alias.append(a)
    return alias


def _agenda(plan, c, alias, clave, nombre, edicion_alias, estado, modo, aprobacion, duracion, pausa, tope, vence_h, cupo, apertura, cierre, creada, cerrada=None):
    c.add("AgendasDeCitas", {
        "EdicionMercadoId": Ref(edicion_alias), "Nombre": nombre, "Estado": estado, "Modo": modo, "AprobacionDeArtistas": aprobacion, "DuracionMinutos": duracion, "PausaMinutos": pausa,
        "TopeSolicitudesPendientes": tope, "VencimientoSolicitudHoras": vence_h, "CupoArtistas": cupo, "AperturaInscripcionUtc": apertura, "CierreInscripcionUtc": cierre,
        "IdUsuarioCreador": Ref(ORGANIZADORA), "FechaCreacion": creada, "FechaActualizacion": cerrada or creada + dt.timedelta(days=2), "FechaCierre": cerrada,
    }, alias=alias, lote=LOTE, nivel=NIVEL, procedencia="sintetico", clave_estable=clave)


def _artista(plan, c, agenda, clave, estado, dias_inscripcion, motivo=None, espacio=None):
    cuenta, entidad, presentacion, enlaces, representa, telefono = ARTISTAS[clave]
    inscrita = momento(plan, dias_inscripcion, 9 + len(clave) % 8, (len(entidad) * 7) % 60)
    c.add("ParticipantesDeCitas", {
        "AgendaId": Ref(agenda), "Rol": "artista", "UsuarioId": Ref(f"persona.{clave}"), "Nombre": cuenta, "Entidad": entidad, "Presentacion": presentacion, "Enlaces": enlaces,
        "RepresentaA": representa, "ContactoCorreo": clave.replace("-", ".") + "@simus.test", "ContactoTelefono": telefono,
        "Espacio": espacio, "Estado": estado, "MotivoDeLaDecision": motivo, "FechaInscripcion": inscrita, "IdUsuarioCreador": Ref(f"persona.{clave}"),
        "FechaActualizacion": inscrita + dt.timedelta(days=1) if estado in ("aprobado", "rechazado", "retirado") else None,
    }, alias=f"{agenda}.artista.{clave}", lote=LOTE, nivel=NIVEL, procedencia="sintetico")
    return f"{agenda}.artista.{clave}"


def _comprador_con_cuenta(plan, c, agenda, clave, dias_carga, mesa=None):
    nombre, entidad, tipo, correo, presentacion, mesa_def = COMPRADORES[clave]
    c.add("ParticipantesDeCitas", {
        "AgendaId": Ref(agenda), "Rol": "comprador", "UsuarioId": Ref(f"persona.{clave}"), "Nombre": nombre, "Entidad": entidad, "TipoDeComprador": tipo, "CorreoInvitacion": correo,
        "Presentacion": presentacion, "Espacio": mesa or mesa_def, "ContactoCorreo": correo, "ContactoTelefono": None, "Estado": "aprobado",
        "FechaInscripcion": momento(plan, dias_carga, 11, (len(clave) * 3) % 60), "IdUsuarioCreador": Ref(ORGANIZADORA),
    }, alias=f"{agenda}.comprador.{clave}", lote=LOTE, nivel=NIVEL, procedencia="sintetico")
    return f"{agenda}.comprador.{clave}"


def _cita(plan, c, agenda, n, franja, anfitrion, visitante, estado, dias_solicitud, mensaje, vence_h, motivo=None, cancela=None):
    solicitud = momento(plan, dias_solicitud, 10 + n % 7, (n * 11) % 60)
    vals = {
        "AgendaId": Ref(agenda), "FranjaId": Ref(franja), "AnfitrionId": Ref(anfitrion), "VisitanteId": Ref(visitante), "Estado": estado, "MensajeInicial": mensaje,
        "MotivoDeLaDecision": motivo, "CanceladaPorId": Ref(cancela) if cancela else None, "VenceUtc": solicitud + dt.timedelta(hours=vence_h), "FechaSolicitud": solicitud,
        "FechaDecision": None, "FechaActualizacion": None,
    }
    if estado == "confirmada":
        vals["FechaDecision"] = solicitud + dt.timedelta(hours=20 + n % 9)
    elif estado in ("rechazada", "cancelada"):
        vals["FechaDecision"] = solicitud + dt.timedelta(hours=30 + n % 11)
    elif estado == "vencida":
        vals["FechaDecision"] = solicitud + dt.timedelta(hours=vence_h)
    vals["FechaActualizacion"] = vals["FechaDecision"]
    c.add("CitasDeAgenda", vals, alias=f"{agenda}.cita.{n:02d}", lote=LOTE, nivel=NIVEL, procedencia="sintetico")


# (franja, artista, comprador, estado, días desde la solicitud) de la agenda abierta (los compradores piden, el artista responde).
# Estados: C confirmada · S solicitada (espera al artista) · R rechazada · X cancelada · V vencida.
CITAS_ABIERTA = [
    (0, "eliecer-rios", "margarita-buelvas", "C", 14), (0, "martha-rangel", "hernan-velasquez", "C", 14), (0, "gilberto-pedraza", "rosalba-perez", "C", 13), (0, "dennis-bryan", "yuliana-mosquera", "C", 12),
    (1, "martha-rangel", "margarita-buelvas", "C", 13), (1, "eliecer-rios", "hernan-velasquez", "C", 13), (1, "fabian-rojas", "rosalba-perez", "C", 12),
    (2, "gilberto-pedraza", "margarita-buelvas", "C", 12), (2, "dennis-bryan", "hernan-velasquez", "C", 12), (2, "eliecer-rios", "yuliana-mosquera", "C", 11),
    (3, "fabian-rojas", "hernan-velasquez", "C", 11), (3, "martha-rangel", "rosalba-perez", "C", 11),
    (4, "eliecer-rios", "rosalba-perez", "S", 2), (4, "gilberto-pedraza", "hernan-velasquez", "S", 3), (4, "dennis-bryan", "margarita-buelvas", "C", 10),
    (5, "eliecer-rios", "margarita-buelvas", "S", 1), (5, "martha-rangel", "yuliana-mosquera", "C", 10), (5, "fabian-rojas", "hernan-velasquez", "R", 9),
    (6, "dennis-bryan", "rosalba-perez", "S", 2), (6, "gilberto-pedraza", "yuliana-mosquera", "C", 9), (6, "fabian-rojas", "margarita-buelvas", "C", 9),
    (7, "eliecer-rios", "hernan-velasquez", "X", 8), (7, "martha-rangel", "rosalba-perez", "R", 8),
    (8, "eliecer-rios", "yuliana-mosquera", "R", 7), (8, "gilberto-pedraza", "margarita-buelvas", "S", 1), (8, "dennis-bryan", "hernan-velasquez", "C", 7),
    (9, "fabian-rojas", "yuliana-mosquera", "C", 7), (9, "martha-rangel", "margarita-buelvas", "S", 2),
    (10, "eliecer-rios", "rosalba-perez", "C", 6), (10, "gilberto-pedraza", "hernan-velasquez", "X", 6), (10, "dennis-bryan", "yuliana-mosquera", "S", 1),
    (11, "martha-rangel", "hernan-velasquez", "C", 6),
    (12, "eliecer-rios", "margarita-buelvas", "C", 5), (12, "fabian-rojas", "rosalba-perez", "C", 5), (12, "dennis-bryan", "hernan-velasquez", "C", 5),
    (14, "gilberto-pedraza", "margarita-buelvas", "C", 4), (14, "eliecer-rios", "hernan-velasquez", "S", 1), (14, "martha-rangel", "yuliana-mosquera", "C", 4),
    (16, "eliecer-rios", "hernan-velasquez", "V", 40), (17, "dennis-bryan", "rosalba-perez", "V", 38), (16, "martha-rangel", "margarita-buelvas", "C", 3),
    (18, "fabian-rojas", "yuliana-mosquera", "C", 3), (18, "gilberto-pedraza", "rosalba-perez", "S", 1),
]
# La agenda abierta de mesas fijas: los compradores reciben en su mesa y los ARTISTAS piden (visitan); cada comprador confirma o rechaza.
# (franja, artista que pide, comprador que recibe, estado, días desde la solicitud). Las solicitudes «S» esperan la respuesta del comprador.
CITAS_FIJA = [
    (0, "martha-rangel", "margarita-buelvas", "C", 7), (0, "eliecer-rios", "hernan-velasquez", "C", 6), (0, "gilberto-pedraza", "rosalba-perez", "C", 5),
    (1, "eliecer-rios", "margarita-buelvas", "S", 1), (1, "martha-rangel", "hernan-velasquez", "C", 5),
    (2, "martha-rangel", "margarita-buelvas", "S", 2), (2, "fabian-rojas", "rosalba-perez", "C", 4),
    (3, "gilberto-pedraza", "margarita-buelvas", "S", 1), (3, "eliecer-rios", "hernan-velasquez", "S", 1),
    (4, "fabian-rojas", "margarita-buelvas", "S", 2), (4, "martha-rangel", "rosalba-perez", "S", 1),
    (5, "fabian-rojas", "margarita-buelvas", "C", 6), (5, "eliecer-rios", "rosalba-perez", "S", 1),
    (6, "martha-rangel", "margarita-buelvas", "R", 4), (7, "gilberto-pedraza", "margarita-buelvas", "X", 3),
    (8, "eliecer-rios", "margarita-buelvas", "V", 40),
]
MENSAJES_ARTISTA = {
    "eliecer-rios": ["Les propongo escuchar el cuarteto llanero en vivo; llevo el repertorio de joropo y composiciones nuevas.",
                     "Quisiera conversar sobre una fecha de gira por el Caribe con arpa, cuatro y capachos.",
                     "Me interesa presentarles el formato de cuarteto para sus festivales y salas medianas.",
                     "Tengo dos discos grabados y material de video para compartirles en la cita."],
    "martha-rangel": ["Les cuento el espectáculo didáctico de guabina y tiple, pensado para casas de cultura y festivales.",
                      "Me gustaría mostrarles el repertorio andino santandereano con arreglos de cámara.",
                      "Buscamos circulación para el cuarteto en el segundo semestre y su propuesta nos encaja.",
                      "¿Podemos hablar de su programación de sala para el próximo año?"],
    "gilberto-pedraza": ["Tenemos un programa de concierto de una hora y un quinteto de metales para formato reducido.",
                         "La banda de vientos busca circuito de festivales; quisiera presentarles el repertorio."],
    "fabian-rojas": ["Además del concierto ofrecemos un taller de construcción de flautas para público familiar.",
                     "Les propongo escuchar las zampoñas y quenas construidas por el propio grupo.",
                     "Me gustaría conversar sobre una presentación en su programación de música andina."],
}
# La agenda cerrada: los compradores reciben (anfitriones) y los artistas rotan (visitantes). Todo ya ocurrió.
CITAS_CERRADA = [
    (0, "eliecer-rios", "margarita-buelvas", "C"), (0, "martha-rangel", "hernan-velasquez", "C"), (0, "gilberto-pedraza", "rosalba-perez", "C"),
    (1, "martha-rangel", "margarita-buelvas", "C"), (1, "eliecer-rios", "rosalba-perez", "C"), (1, "fabian-rojas", "hernan-velasquez", "C"),
    (2, "fabian-rojas", "margarita-buelvas", "C"), (2, "gilberto-pedraza", "hernan-velasquez", "R"), (2, "eliecer-rios", "rosalba-perez", "X"),
    (3, "gilberto-pedraza", "margarita-buelvas", "C"), (3, "eliecer-rios", "hernan-velasquez", "C"),
    (8, "martha-rangel", "rosalba-perez", "C"), (8, "fabian-rojas", "margarita-buelvas", "C"), (8, "eliecer-rios", "hernan-velasquez", "C"),
    (9, "gilberto-pedraza", "rosalba-perez", "V"), (9, "martha-rangel", "hernan-velasquez", "C"), (10, "eliecer-rios", "margarita-buelvas", "C"), (10, "fabian-rojas", "rosalba-perez", "R"),
]


def _verificar_sin_doble_reserva(citas, anfitrion_de, visitante_de, nombre):
    """Lo que la base hace cumplir (índices únicos filtrados): nadie tiene dos citas vivas en la misma franja."""
    vistos = set()
    for franja, *resto in citas:
        art, comp, estado = resto[0], resto[1], resto[2]
        if estado not in ("C", "S"):
            continue
        for persona in (art, comp):
            if (franja, persona) in vistos:
                raise ValueError(f"{nombre}: doble reserva de {persona} en la franja {franja}")
            vistos.add((franja, persona))


def sembrar(plan, c) -> None:
    filas = {f.alias: f for f in plan.filas if f.alias}
    ed25 = filas[f"{MERCADO}.edicion.2025"].valores
    ed27 = filas[f"{MERCADO}.edicion.2027"].valores
    inicio27, inicio25 = ed27["FechaInicio"], ed25["FechaInicio"]
    img = plan.imagenes

    # ───────────────────────── 1. ABIERTA (edición 2027) ─────────────────────────
    ab = ALIAS_ABIERTA
    dias27 = [inicio27, inicio27 + dt.timedelta(days=1)]
    _agenda(plan, c, ab, CLAVE_ABIERTA, NOMBRE_ABIERTA, f"{MERCADO}.edicion.2027", "abierta", "compradores_rotan", "aceptacion", 20, 5, 5, 720, 5,
            momento(plan, 60, 8), dt.datetime(inicio27.year, inicio27.month, inicio27.day) - dt.timedelta(days=14), momento(plan, 75, 9))
    franjas = _franjas(plan, c, ab, dias27, 12, 20, 5)
    art = {}
    for k, (clave, estado, dias, motivo) in enumerate([
            ("eliecer-rios", "aprobado", 55, None), ("martha-rangel", "aprobado", 54, None), ("gilberto-pedraza", "aprobado", 53, None), ("dennis-bryan", "aprobado", 52, None),
            ("fabian-rojas", "aprobado", 51, None), ("tatiana-cardozo", "pendiente", 2, None), ("olga-mejia", "lista_de_espera", 49, None), ("julian-arboleda", "lista_de_espera", 48, None),
            ("angela-burbano", "rechazado", 50, "La propuesta es una conferencia con escucha guiada y esta rueda programa conciertos y espectáculos para circulación; la esperamos en la mesa de archivos de la próxima edición.")]):
        art[clave] = _artista(plan, c, ab, clave, estado, dias, motivo, STANDS_ABIERTA.get(clave) if estado == "aprobado" else None)
    comp = {k: _comprador_con_cuenta(plan, c, ab, k, 58 - 2 * i) for i, k in enumerate(COMPRADORES)}
    # la compradora invitada que todavía no tiene cuenta: foto propia del Banco (privada) y una invitación pendiente
    foto = img.ref(f"img.participante.{INVITADA['clave']}.foto", nombre=INVITADA["nombre"], departamento=INVITADA["dep"])
    c.add("ParticipantesDeCitas", {
        "AgendaId": Ref(ab), "Rol": "comprador", "UsuarioId": None, "Nombre": INVITADA["nombre"], "Entidad": INVITADA["entidad"], "TipoDeComprador": INVITADA["tipo"], "CorreoInvitacion": INVITADA["correo"],
        "Presentacion": INVITADA["presentacion"], "Espacio": INVITADA["mesa"], "Estado": "aprobado", "FechaInscripcion": momento(plan, 52, 11, 20), "IdUsuarioCreador": Ref(ORGANIZADORA), "FotoArchivoId": foto,
    }, alias=f"{ab}.comprador.{INVITADA['clave']}", lote=LOTE, nivel=NIVEL, procedencia="sintetico")
    comp[INVITADA["clave"]] = f"{ab}.comprador.{INVITADA['clave']}"
    c.add("InvitacionesDeAgenda", {
        "ParticipanteId": Ref(comp[INVITADA["clave"]]), "CorreoInvitado": INVITADA["correo"], "HashTestigo": hashlib.sha256(testigo_de_invitacion().encode("utf-8")).hexdigest(), "Estado": "pendiente",
        "IdUsuarioInvita": Ref(ORGANIZADORA), "FechaEmision": momento(plan, 4, 10), "FechaExpiracion": momento(plan, -90, 10),
    }, alias=f"{ab}.invitacion.{INVITADA['clave']}", lote=LOTE, nivel=NIVEL, procedencia="sintetico")

    _verificar_sin_doble_reserva(CITAS_ABIERTA, None, None, "agenda abierta")
    usados = {}
    for n, (fr, a, b, est, dias) in enumerate(CITAS_ABIERTA, 1):
        i = usados.get(b, 0)
        usados[b] = i + 1
        mensaje = f"{MENSAJES[b][i % len(MENSAJES[b])]} {CLAUSULA_ARTISTA[a]}"
        estado = {"C": "confirmada", "S": "solicitada", "R": "rechazada", "X": "cancelada", "V": "vencida"}[est]
        motivo = cancela = None
        if est == "R":
            motivo = MOTIVOS_RECHAZO[n % len(MOTIVOS_RECHAZO)]
        elif est == "X":
            motivo, cancela = MOTIVOS_CANCELA[n % len(MOTIVOS_CANCELA)], comp[b]
        _cita(plan, c, ab, n, franjas[fr], art[a], comp[b], estado, dias, mensaje, 720, motivo, cancela)

    # ───────────────────────── 2. BORRADOR (edición 2027): recién creada, solo configurada ─────────────────────────
    _agenda(plan, c, ALIAS_BORRADOR, CLAVE_BORRADOR, NOMBRE_BORRADOR, f"{MERCADO}.edicion.2027", "borrador", "compradores_fijos", "automatica", 15, 5, 4, 72, 8, None, None, momento(plan, 1, 16))

    # ───────────────────────── 2b. ABIERTA DE MESAS FIJAS (edición 2027): compradores con mesa, los artistas piden ─────────────────────────
    fj = ALIAS_FIJA
    _agenda(plan, c, fj, CLAVE_FIJA, NOMBRE_FIJA, f"{MERCADO}.edicion.2027", "abierta", "compradores_fijos", "aceptacion", 20, 10, 5, 720, 6,
            momento(plan, 44, 8), dt.datetime(inicio27.year, inicio27.month, inicio27.day) - dt.timedelta(days=14), momento(plan, 50, 9))
    franjas_fj = _franjas(plan, c, fj, dias27, 8, 20, 10, hora0=14)
    art_fj = {}
    for clave, estado, dias in (("eliecer-rios", "aprobado", 44), ("martha-rangel", "aprobado", 43), ("gilberto-pedraza", "aprobado", 42), ("fabian-rojas", "aprobado", 41),
                                ("tatiana-cardozo", "pendiente", 2)):
        art_fj[clave] = _artista(plan, c, fj, clave, estado, dias)
    comp_fj = {k: _comprador_con_cuenta(plan, c, fj, k, 47 - 2 * i) for i, k in enumerate(COMPRADORES)}
    _verificar_sin_doble_reserva(CITAS_FIJA, None, None, "agenda abierta de mesas fijas")
    usados = {}
    for n, (fr, a, b, est, dias) in enumerate(CITAS_FIJA, 1):
        i = usados.get(a, 0)
        usados[a] = i + 1
        mensaje = MENSAJES_ARTISTA[a][i % len(MENSAJES_ARTISTA[a])]
        estado = {"C": "confirmada", "S": "solicitada", "R": "rechazada", "X": "cancelada", "V": "vencida"}[est]
        motivo = cancela = None
        if est == "R":
            motivo = "Esa franja la reservamos para otra propuesta; con gusto los escuchamos en la siguiente."
        elif est == "X":
            motivo, cancela = MOTIVOS_CANCELA[n % len(MOTIVOS_CANCELA)], art_fj[a]
        _cita(plan, c, fj, n, franjas_fj[fr], comp_fj[b], art_fj[a], estado, dias, mensaje, 720, motivo, cancela)

    # ───────────────────────── 3. CERRADA (edición 2025, ya realizada) ─────────────────────────
    ce = ALIAS_CERRADA
    dias25 = [inicio25, inicio25 + dt.timedelta(days=1)]
    cierre = dt.datetime(ed25["FechaFin"].year, ed25["FechaFin"].month, ed25["FechaFin"].day, 23, 0) + dt.timedelta(days=1)
    _agenda(plan, c, ce, CLAVE_CERRADA, NOMBRE_CERRADA, f"{MERCADO}.edicion.2025", "cerrada", "compradores_fijos", "automatica", 20, 5, 5, 72, 4,
            dt.datetime(inicio25.year, inicio25.month, inicio25.day) - dt.timedelta(days=50), dt.datetime(inicio25.year, inicio25.month, inicio25.day) - dt.timedelta(days=12),
            dt.datetime(inicio25.year, inicio25.month, inicio25.day) - dt.timedelta(days=60), cerrada=cierre)
    fr25 = _franjas(plan, c, ce, dias25, 8, 20, 5)
    dias_antes = (plan.hoy - inicio25).days
    art25 = {}
    for clave, d in (("eliecer-rios", 40), ("martha-rangel", 38), ("gilberto-pedraza", 37), ("fabian-rojas", 35)):
        art25[clave] = _artista(plan, c, ce, clave, "aprobado", dias_antes + d)
    art25["dennis-bryan"] = _artista(plan, c, ce, "dennis-bryan", "retirado", dias_antes + 33, "No alcanzamos a organizar el viaje desde San Andrés para esas fechas.")
    comp25 = {k: _comprador_con_cuenta(plan, c, ce, k, dias_antes + 45 - 2 * i) for i, k in enumerate(COMPRADORES)}
    _verificar_sin_doble_reserva(CITAS_CERRADA, None, None, "agenda cerrada")
    usados = {}
    for n, (fr, a, b, est) in enumerate(CITAS_CERRADA, 1):
        i = usados.get(a, 0)
        usados[a] = i + 1
        mensaje = (["Quisiera presentarle mi propuesta y escuchar qué busca para este año.", "Me gustaría contarle mi repertorio y conocer sus fechas libres.",
                    "Nos interesa conversar sobre una presentación en su programación.", "¿Podemos hablar de una colaboración para la próxima temporada?"][(n + i) % 4]
                   + f" Conozco el trabajo de {COMPRADORES[b][1]}.")
        estado = {"C": "confirmada", "R": "rechazada", "X": "cancelada", "V": "vencida"}[est]
        motivo = cancela = None
        if est == "R":
            motivo = "Por ahora la programación del año está completa; guardamos su propuesta para la siguiente."
        elif est == "X":
            motivo, cancela = MOTIVOS_CANCELA[n % len(MOTIVOS_CANCELA)], art25[a]
        _cita(plan, c, ce, n, fr25[fr], comp25[b], art25[a], estado, dias_antes + 18 - fr // 4, mensaje, 72, motivo, cancela)


def testigo_de_invitacion() -> str:
    """El testigo (secreto de un solo uso) de la invitación pendiente de la compradora sin cuenta. Determinista: se resume con SHA-256 en la base,
    y quien prueba el flujo lo abre en `/ecosistema/invitacion-agenda?testigo=<este valor>`. Es solo de la demo."""
    return hashlib.sha256(f"simus-demo-invitacion-de-agenda:{INVITADA['clave']}".encode("utf-8")).hexdigest()


# ──────────────────────────────────────────────────────────────────────────────────────────────────
# Solo esto, sobre una demo ya sembrada (lo invoca scripts/demo/sembrar-agenda-de-citas.sh)
# ──────────────────────────────────────────────────────────────────────────────────────────────────
def escribir_solo_agenda(salida, semilla: int = 20261121, hoy: str = "2026-11-21", datos: str | None = None) -> list:
    """Construye el plan COMPLETO (los alias que cita se resuelven en la base por `DatosDeDemostracion`), lo valida y escribe en `salida`
    tres guiones: las fotos de la agenda (filas `Archivos` de `img.participante.*`), el lote de la agenda (solo inserta lo que falta) y los stands de los
    artistas ya sembrados sin stand. Devuelve sus rutas."""
    import json
    aqui = Path(__file__).resolve().parent
    sys.path.insert(0, str(aqui))
    import datos_publicos as dp
    import siembra as S
    from nucleo import Plan, sql_de_lote
    from validaciones import validar
    fecha = dt.date.fromisoformat(hoy)
    catalogos = json.loads((aqui / "catalogos-instantanea.json").read_text(encoding="utf-8"))
    esquema = json.loads((aqui / "esquema-instantanea.json").read_text(encoding="utf-8"))
    plan = S.construir_plan(semilla, fecha, dp.cargar(dp.carpeta_de_datos(datos)), catalogos, 6, True, 1.0)
    errores, _ = validar(plan, esquema, catalogos, dp.Territorio(catalogos["divipola"]))
    if errores:
        raise SystemExit("[agenda] el plan no valida:\n" + "\n".join(errores[:20]))
    fotos = [f for f in plan.filas if f.tabla == "Archivos" and f.alias.startswith("img.participante.")]
    agenda = [f for f in plan.filas if f.lote == LOTE]
    carpeta = Path(salida)
    carpeta.mkdir(parents=True, exist_ok=True)
    rutas = []
    for nombre, filas in (("01-fotos-de-la-agenda.sql", fotos), ("02-n1-agenda-de-citas.sql", agenda)):
        lote = filas[0].lote
        ruta = carpeta / nombre
        ruta.write_text(sql_de_lote(Plan(semilla=semilla, hoy=fecha, filas=filas), lote), encoding="utf-8")
        rutas.append(ruta)
    ruta = carpeta / "03-stands-de-los-artistas.sql"
    ruta.write_text(sql_de_stands(), encoding="utf-8")
    rutas.append(ruta)
    return rutas


def sql_de_stands() -> str:
    """Pone su stand a los artistas admitidos de la agenda abierta de stands fijos de una demo YA sembrada (donde esas filas existen sin stand).
    Solo escribe donde `Espacio` está vacío: nunca pisa lo que la organización asignó a mano. Idempotente."""
    cuerpo = "\n".join(
        "UPDATE p SET p.Espacio = N'" + stand + "', p.FechaActualizacion = SYSUTCDATETIME()\n"
        "FROM dbo.ParticipantesDeCitas p JOIN dbo.DatosDeDemostracion d ON d.Tabla = N'ParticipantesDeCitas' AND d.IdRegistro = CAST(p.IdParticipante AS nvarchar(120))\n"
        f"WHERE d.Alias = N'{ALIAS_ABIERTA}.artista.{clave}' AND p.Espacio IS NULL;"
        for clave, stand in STANDS_ABIERTA.items())
    return ("/* Stands de los artistas admitidos de la agenda abierta (lote n1-agenda-de-citas): solo donde aún no hay stand. */\n"
            "SET NOCOUNT ON;\nSET XACT_ABORT ON;\nBEGIN TRANSACTION;\n" + cuerpo + "\nCOMMIT TRANSACTION;\n")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Escribe el SQL de solo la agenda de citas (sin tocar ninguna base).")
    ap.add_argument("--salida")
    ap.add_argument("--semilla", type=int, default=20261121)
    ap.add_argument("--hoy", default="2026-11-21")
    ap.add_argument("--datos")
    ap.add_argument("--testigo", action="store_true", help="imprime el testigo de la invitación pendiente y sale")
    a = ap.parse_args()
    if a.testigo:
        print(testigo_de_invitacion())
    elif not a.salida:
        ap.error("falta --salida")
    else:
        for r in escribir_solo_agenda(a.salida, a.semilla, a.hoy, a.datos):
            print(r)
