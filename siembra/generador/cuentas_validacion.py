"""Cuentas de validación (nivel 0): las que usa la persona que valida las pantallas «en todos sus estados» y el recorrido de aceptación.

Todas con la clave «admin» (solo demo local; nunca en un entorno expuesto) y correos `@simus.test`:

| Cuenta | Qué es | Qué tiene |
|---|---|---|
| camila.restrepo@simus.test | externa «Camila Restrepo» | perfil personal muy cargado; administra una organización GRANDE (5 tipos de proceso × 6 estados), una MEDIANA, una NUEVA (sin confirmar) y una VACÍA; es EDITOR en otra |
| webmaster@simus.test | administrativa (rol `webmaster`) | bandeja con solicitudes de todos esos tipos y estados |
| gestor@simus.test | administrativa (rol `gestor_interno`) | ídem; firma las decisiones del historial |
| editor@simus.test | externa de apoyo | editora de la organización grande y de la mediana |
| reclamante@simus.test | externa de apoyo | organización con reclamaciones en varios estados sobre festivales históricos |
| nuevo@simus.test | externa sin datos | sin organizaciones ni perfil completado: recorrido desde cero |
"""
from __future__ import annotations

import datetime as dt
import hashlib
import os

import datos_publicos as dp
from constructores import CLAVE_DEMO, momento, rng_de, slug
from hash_identidad import hash_identidad
from nucleo import Cat, Raw, Ref, USUARIO_SISTEMA

LOTE = "cuentas-validacion"             # cuentas administrativas (van primero: firman los historiales)
LOTE_EXTERNAS = "cuentas-externas"      # cuentas externas, su perfil y sus organizaciones (después de las organizaciones del libro)
LOTE_PROCESOS = "cuentas-procesos"      # procesos, invitaciones, agenda, propuestas y reclamaciones (después de los festivales públicos)
NIVEL = 0
ESTADOS = ["borrador", "en_revision", "ajustes_solicitados", "publicado", "rechazado", "archivado"]

# Municipios de la organización grande (códigos DIVIPOLA validados por el generador) y sus nombres en texto.
LUGARES = [("11001", "Bogotá"), ("05001", "Medellín"), ("76001", "Cali"), ("08001", "Barranquilla"), ("68001", "Bucaramanga"), ("52001", "Pasto"),
           ("73001", "Ibagué"), ("19001", "Popayán"), ("20001", "Valledupar"), ("54001", "Cúcuta"), ("63001", "Armenia"), ("41001", "Neiva")]
TEMAS = ["cuerdas", "tambores", "voces", "vientos", "gaitas", "marimbas", "acordeones", "bandolas", "flautas", "coros", "metales", "percusiones"]
PRACTICAS = ["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-vocales-corales-y-de-tradicion-cantada", "musicas-de-comunidades-negras-afrocolombianas-raizales-y-palenqueras",
             "musicas-campesinas-rurales-y-de-raiz-territorial", "musicas-urbanas-alternativas-e-independientes", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical"]
PROPOSITOS = ["formar a niñas y niños en instrumentos de la región", "reunir a maestros mayores con agrupaciones jóvenes", "documentar repertorios que se transmiten de oído",
              "abrir escenarios a agrupaciones sin circuito", "tejer redes entre escuelas de música de barrio", "recuperar piezas que se tocaban en fiestas patronales"]
FORMAS = ["con ensayos abiertos y conversatorios", "con una ruta de presentaciones por los barrios", "con clínicas de instrumento y un concierto de cierre",
          "con residencias cortas y una muestra pública", "con talleres de construcción de instrumentos", "con mesas de trabajo y una grabación de campo"]


def _texto(tipo: str, rng, lugar: str, tema: str, propo: str, forma: str, extra: str) -> str:
    entradas = {
        "festival": f"Festival de {tema} de {lugar}: {propo}, {forma}. {extra}",
        "mercado": f"Mercado de {tema} de {lugar}: un espacio de citas entre agrupaciones y programadores para {propo}. Se desarrolla {forma}. {extra}",
        "taller": f"Taller de {tema} en {lugar}: ofrece aprendizaje práctico para {propo}, {forma}. {extra}",
        "espacio": f"Sala de {tema} en {lugar}: lugar de ensayo y encuentro pensado para {propo}; funciona {forma}. {extra}",
        "red": f"Red de {tema} de {lugar}: reúne colecciones, personas y escuelas para {propo}, {forma}. {extra}",
    }
    return entradas[tipo]


def procesos_de(prefijo: str, org: str, estados, tipos=("festival", "mercado", "taller", "espacio", "red"), desplazamiento=0) -> dict:
    """Especificaciones (en el mismo formato del libro) de un proceso por tipo y estado, con nombres y textos distintos."""
    out = {t: [] for t in ("festival", "mercado", "taller", "espacio", "red")}
    k = desplazamiento
    for tipo in tipos:
        for estado in estados:
            muni, lugar = LUGARES[k % len(LUGARES)]
            tema = TEMAS[(k * 5 + 1) % len(TEMAS)]
            rng = rng_de_simple(f"{prefijo}:{tipo}:{estado}")
            propo, forma = PROPOSITOS[(k * 7) % len(PROPOSITOS)], FORMAS[(k * 3 + 1) % len(FORMAS)]
            nombre = {"festival": f"Festival de {tema} de {lugar}", "mercado": f"Mercado de {tema} de {lugar}", "taller": f"Taller de {tema} de {lugar}",
                      "espacio": f"Sala de {tema} de {lugar}", "red": f"Red de {tema} de {lugar}"}[tipo]
            clave = f"{prefijo}-{tipo}-{estado.replace('_', '-')}"
            extra = f"Edición del {2019 + k % 7} en adelante con apoyo de las familias del barrio." if tipo in ("festival", "mercado") else f"Atiende a {rng.randint(15, 90)} personas cada mes."
            desc = _texto(tipo, rng, lugar, tema, propo, forma, extra)
            base = dict(clave=clave, nombre=nombre, org=org, muni=muni, estado=estado, desc=desc)
            if tipo == "festival":
                base.update(periodicidad="anual", practicas=[PRACTICAS[k % len(PRACTICAS)]], territorio=None, director="Camila Restrepo",
                            ediciones=_ediciones(estado, k))
            elif tipo == "mercado":
                base.update(alcance=["local", "regional", "nacional"][k % 3], modalidad=["presencial", "virtual", "mixta"][k % 3], ediciones=_ediciones(estado, k, maximo=2))
            elif tipo == "taller":
                base.update(modalidad=["fijo", "itinerante", "colectivo"][k % 3], practicas=[PRACTICAS[k % len(PRACTICAS)]])
            elif tipo == "espacio":
                base.update(ambiente=["abierto", "cerrado", "mixto"][k % 3], aforo=40 + 25 * (k % 9), practicas=[PRACTICAS[k % len(PRACTICAS)]])
            else:
                base.update(tipo=["red", "archivo", "coleccion", "centro_de_documentacion", "grupo_de_investigacion"][k % 5], practicas=[PRACTICAS[k % len(PRACTICAS)]])
            out[tipo].append(base)
            k += 1
    return out


def rng_de_simple(semilla: str):
    import random
    return random.Random(semilla)


def _ediciones(estado: str, k: int, maximo: int = 3) -> list:
    """Ediciones coherentes con el estado del proceso: publicado con historia y próxima edición; archivado con una pausa; el resto con la primera."""
    if estado == "publicado":
        return [(2023, "realizada"), (2024, "realizada"), (2025, "realizada"), (2027, "programada")][-maximo - 1:] if maximo < 3 else [(2023, "realizada"), (2024, "realizada"), (2025, "realizada"), (2027, "programada")]
    if estado == "archivado":
        return [(2022, "realizada"), (2023, "cancelada")][:maximo]
    if estado in ("rechazado", "borrador"):
        return []
    return [(2026, "en_preparacion")]


PERSONAL = dict(
    corta="Gestora cultural y música; coordina procesos de formación y circulación de músicas de la región andina y del Pacífico.",
    larga=("Camila empezó tocando guitarra y tiple en una estudiantina de colegio y terminó coordinando proyectos de formación musical en comunidades de varios departamentos. "
           "Ha dirigido festivales de pequeño formato, mercados de agrupaciones y talleres de lutería; hoy acompaña a organizaciones que quieren ordenar su documentación, "
           "preparar convocatorias y sostener sus procesos en el tiempo. Cree que una ficha bien hecha es una forma de cuidar la memoria de un proceso y que la circulación "
           "de las músicas regionales mejora cuando quienes las hacen se conocen entre sí. En sus ratos libres graba cantos de trabajo con adultos mayores y los devuelve a sus familias."),
    oficios=["Gestor cultural", "Guitarrista", "Productor de eventos", "Docente de música", "Investigador"],
    portafolio=[
        {"tipo": "audio", "titulo": "Cantos de trabajo del alto Cauca", "url": "https://archivo.simus.test/camila/cantos-del-alto-cauca", "descripcion": "Registro de campo con familias de la región, 2023.", "anio": 2023},
        {"tipo": "video", "titulo": "Taller de lutería de cuerdas en Armenia", "url": "https://archivo.simus.test/camila/taller-luteria-armenia", "descripcion": "Documental corto sobre un taller de restauración.", "anio": 2024},
        {"tipo": "texto", "titulo": "Guía para ordenar la documentación de un festival", "url": "https://archivo.simus.test/camila/guia-documentacion-festival", "descripcion": "Texto de apoyo para equipos pequeños.", "anio": 2025},
        {"tipo": "imagen", "titulo": "Fotografías de una ruta de presentaciones", "url": "https://archivo.simus.test/camila/ruta-presentaciones", "descripcion": "Serie de veinte fotografías de una gira barrial.", "anio": 2022},
        {"tipo": "enlace", "titulo": "Archivo personal de proyectos", "url": "https://camila.simus.test/proyectos", "descripcion": "Índice con los procesos que ha coordinado.", "anio": 2026},
    ],
    enlaces=[("https://camila.simus.test", "Sitio personal"), ("https://instagram.com/camila.simus.test", "Instagram"), ("https://archivo.simus.test/camila", "Archivo")],
    practicas=["musicas-populares-tradicionales-regionales-y-patrimoniales", "musicas-comunitarias-y-procesos-colectivos-de-practica-musical", "musicas-campesinas-rurales-y-de-raiz-territorial"],
    clasificaciones=[("instrumento", "cordofonos"), ("instrumento", "voz"), ("rol", "gestor"), ("rol", "docente"), ("rol", "productor"), ("servicio", "asesoria"), ("servicio", "gestion"), ("servicio", "clases")],
)


def exigir_cambio_de_clave():
    """SIMUS_SIEMBRA_EXIGIR_CAMBIO_DE_CLAVE=1 marca las cuentas ADMINISTRATIVAS (webmaster y gestor) para cambiar la clave en su primer ingreso. Por omisión 0."""
    return os.environ.get("SIMUS_SIEMBRA_EXIGIR_CAMBIO_DE_CLAVE", "0").strip().lower() in ("1", "true", "si", "sí")


def _usuario(plan, c, alias, correo, nombre_completo, primer, apellido, canal, rol, dias, perfil_completado=True, telefono="+57 300 555 0000", tipo_perfil="individual", doc="DEMO-0000", lote=LOTE, exigir_cambio=False):
    nivel = NIVEL
    meta = dict(lote=lote, nivel=nivel, procedencia="sintetico")
    c.add("Usuarios", {
        "NombreCompleto": nombre_completo, "CorreoElectronico": correo, "HashContrasena": hash_identidad(CLAVE_DEMO, correo), "CanalAcceso": canal, "TipoPerfil": tipo_perfil if canal == "externo" else None,
        "Activo": True, "FechaCreacion": momento(plan, dias), "Telefono": telefono, "Identificacion": doc if canal == "externo" else None, "CodigoTipoDocumento": "cc" if canal == "externo" else None,
        "CorreoConfirmado": True, "FechaConfirmacionCorreo": momento(plan, dias - 1), "PrimerNombre": primer, "PrimerApellido": apellido, "DebeCambiarContrasena": exigir_cambio and exigir_cambio_de_clave(),
        "PerfilCompletado": perfil_completado, "CanalDeContactoPreferido": "correo",
        **({"ResidenciaCodigoDepartamento": "11", "ResidenciaCodigoMunicipio": "11001"} if canal == "externo" else {}),
    }, alias=alias, clave_estable=f"n0.cuenta.{alias.split('.')[-1]}", **meta)
    c.add("UsuariosRoles", {"IdUsuario": Ref(alias), "IdRol": Cat("Roles", "IdRol", "NombreRol", rol)}, **meta)


def administrativas(plan, c):
    """Las dos cuentas de la gestión (`webmaster@simus.test` y `gestor@simus.test`) las crea el ARRANQUE de la API (DatabaseBootstrapper);
    aquí solo se marcan, para que los historiales las firmen. Van primero porque firman las decisiones de los historiales."""
    meta = dict(lote=LOTE, nivel=NIVEL, procedencia="sintetico")
    for alias, correo in (("cuenta.webmaster", "webmaster@simus.test"), ("cuenta.gestor", "gestor@simus.test")):
        c.add("Usuarios", {}, alias=alias, clave_estable=f"n0.cuenta.{alias.split('.')[-1]}", id_expr=Raw(f"(SELECT TOP 1 IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'{correo}')"), solo_marca=True, **meta)
    return Ref("cuenta.gestor")


def _perfil(plan, c, alias, nombre_visible, corta, larga, muni, extra: dict | None = None):
    meta = dict(lote=LOTE_EXTERNAS, nivel=NIVEL, procedencia="sintetico")
    v = {"IdUsuario": Ref(alias), "NombreVisible": nombre_visible, "CodigoMunicipio": muni, "FechaCreacion": momento(plan, 380), "FechaActualizacion": momento(plan, 4), "NombreCivilVisible": True,
         "BiografiaCorta": corta, "BiografiaLarga": larga, "Visibilidad": "publico"}
    v.update(extra or {})
    c.add("PerfilesPublicos", v, alias=f"{alias}.perfil", id_expr=Ref(alias), **meta)


def externas_base(plan, c):
    """Cuentas externas, perfil personal y organizaciones. Requiere `c.personas()` y `c.organizaciones()` ya hechos."""
    meta = dict(lote=LOTE_EXTERNAS, nivel=NIVEL, procedencia="sintetico")
    forzar = (NIVEL, LOTE_EXTERNAS)
    _usuario(plan, c, "cuenta.externo-camila", "camila.restrepo@simus.test", "Camila Restrepo", "Camila", "Restrepo", "externo", "externo", 420, tipo_perfil="individual", doc="DEMO-0100", lote=LOTE_EXTERNAS)
    _usuario(plan, c, "cuenta.editor", "editor@simus.test", "Editora de Apoyo", "Editora", "Apoyo", "externo", "externo", 300, doc="DEMO-0101", lote=LOTE_EXTERNAS)
    _usuario(plan, c, "cuenta.reclamante", "reclamante@simus.test", "Reclamante de Prueba", "Reclamante", "Prueba", "externo", "externo", 200, doc="DEMO-0102", lote=LOTE_EXTERNAS)
    _usuario(plan, c, "cuenta.nuevo", "nuevo@simus.test", "Persona Nueva", "Persona", "Nueva", "externo", "externo", 1, perfil_completado=False, doc="DEMO-0103", lote=LOTE_EXTERNAS)
    for clave, alias, nombre, doc in (("camila", "cuenta.externo-camila", ("Camila", "Restrepo", ""), "cc"), ("editor", "cuenta.editor", ("Editora", "Apoyo", ""), "cc"),
                                      ("reclamante", "cuenta.reclamante", ("Reclamante", "Prueba", ""), "cc")):
        c.persona_id[clave] = alias
        c.persona_spec[clave] = dict(clave=clave, nombre=nombre, doc=doc)
    pe = PERSONAL
    # --- organizaciones
    orgs = [
        dict(clave="camila-grande", nombre="Corporación Sonora Andina", tipo="Fundación", muni="11001", estado="activa", admin="camila", editor=["editor"], dias=380,
             desc="Corporación bogotana que coordina festivales, mercados, talleres de lutería, salas de ensayo y redes de documentación de músicas andinas y del Pacífico; trabaja con escuelas de barrio y con maestros mayores y mantiene un archivo abierto de sus procesos."),
        dict(clave="camila-mediana", nombre="Colectivo Cantos del Valle", tipo="Comunitario", muni="76001", estado="activa", admin="camila", editor=["editor"], dias=240,
             desc="Colectivo caleño de cantadoras, percusionistas y docentes que organiza un festival pequeño, un taller de percusiones y una sala de ensayo en el oriente de la ciudad."),
        dict(clave="camila-nueva", nombre="Semillero Música Nueva", tipo="Otro", muni="73001", estado="pendiente_de_confirmacion", admin="camila", editor=None, dias=2,
             desc="Semillero de jóvenes de Ibagué que quiere organizar su primer encuentro de bandas escolares; acaba de registrarse y aún no confirma el correo de la organización."),
        dict(clave="camila-vacia", nombre="Asociación Resonancias", tipo="Casa cultural", muni="52001", estado="activa", admin="camila", editor=None, dias=90,
             desc="Asociación pastusa registrada para iniciar procesos de formación con adultos mayores; todavía no ha creado ninguna ficha de festival, mercado, taller, espacio o red."),
        dict(clave="reclamante-org", nombre="Corporación Memoria Sonora del Caribe", tipo="Comunitario", muni="13001", estado="activa", admin="reclamante", editor=None, dias=150,
             desc="Corporación cartagenera que reclama la administración de varios festivales históricos que ha producido durante años y mantiene al día los soportes de cada edición."),
    ]
    c.organizaciones(items=orgs, forzar=forzar)
    # Camila es EDITOR de una organización de otra persona (la de la Fundación Voces del Llano)
    c.add("UsuariosEntidades", {"IdUsuario": Ref("cuenta.externo-camila"), "IdEntidad": Ref(c.org_id["fund-voces-del-llano"]), "RolEntidad": "editor", "Activo": True, "FechaCreacion": momento(plan, 120)}, **meta)
    # --- perfil personal MUY cargado
    ids_visibles = Raw("N'[' + " + " + N',' + ".join(f"CAST((SELECT IdRegistro FROM dbo.DatosDeDemostracion WHERE Alias = N'org.{k}') AS nvarchar(20))" for k in ("camila-grande", "camila-mediana")) + " + N']'")
    _perfil(plan, c, "cuenta.externo-camila", "Camila Restrepo", pe["corta"], pe["larga"], "11001",
            {"RolesJson": pe["oficios"], "PortafolioJson": pe["portafolio"], "OrganizacionesVisiblesJson": ids_visibles})
    for i, (url, etiqueta) in enumerate(pe["enlaces"], 1):
        c.add("PerfilesPublicosEnlaces", {"IdUsuario": Ref("cuenta.externo-camila"), "Orden": i, "Url": url, "Etiqueta": etiqueta}, **meta)
    for s in pe["practicas"]:
        c.add("PerfilesPublicosPracticas", {"IdUsuario": Ref("cuenta.externo-camila"), "IdPracticaMusical": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", s)}, **meta)
    for dim, cod in pe["clasificaciones"]:
        c.add("PerfilesPublicosClasificaciones", {"IdUsuario": Ref("cuenta.externo-camila"), "Dimension": dim, "Codigo": cod}, **meta)
    for fin in ("perfil_publico", "terminos", "tratamiento", "boletin"):
        c.add("AutorizacionesDatos", {"Finalidad": fin, "IdPolitica": Raw(f"(SELECT TOP 1 IdPolitica FROM dbo.PoliticasDatos WHERE Clave = N'{fin}' ORDER BY IdPolitica)"), "Version": "1.0",
                                      "TextoAceptado": "Texto de la política vigente al momento de la aceptación.", "IdUsuario": Ref("cuenta.externo-camila"), "Origen": "cuenta",
                                      "FechaOtorgada": momento(plan, 419)}, alias=f"cuenta.externo-camila.autorizacion.{fin}", **meta)


def externas_procesos(plan, c):
    """Procesos, equipo, invitaciones, notificaciones, agenda, propuestas, revisiones y reclamaciones. Requiere los festivales públicos ya creados."""
    meta = dict(lote=LOTE_PROCESOS, nivel=NIVEL, procedencia="sintetico")
    forzar = (NIVEL, LOTE_PROCESOS)
    # --- procesos de la organización grande: 5 tipos × 6 estados
    grande = procesos_de("camila-grande", "camila-grande", ESTADOS)
    c.festivales_sinteticos(items=grande["festival"], forzar=forzar)
    c.mercados(items=grande["mercado"], forzar=forzar, solo_sinteticos=True)
    c.redes_talleres_espacios(redes=grande["red"], talleres=grande["taller"], espacios=grande["espacio"], forzar=forzar)
    # --- organización mediana: mezcla
    med = procesos_de("camila-mediana", "camila-mediana", ["publicado", "en_revision", "borrador"], tipos=("festival", "taller", "espacio"), desplazamiento=7)
    c.festivales_sinteticos(items=med["festival"], forzar=forzar)
    c.redes_talleres_espacios(talleres=med["taller"], espacios=med["espacio"], redes=[], forzar=forzar)
    # --- equipo, invitaciones y notificaciones de la organización grande
    for i, (estado, rol, dias_emision) in enumerate([("pendiente", "editor", 4), ("aceptada", "editor", 60), ("vencida", "editor", 90), ("revocada", "administrador", 45)]):
        alias = f"invitacion.camila-grande.{estado}"
        emision = momento(plan, dias_emision)
        exp = momento(plan, -10) if estado == "pendiente" else emision + dt.timedelta(days=14)
        vals = {"IdEntidad": Ref("org.camila-grande"), "CorreoInvitado": f"invitada.{estado}@simus.test", "RolEntidad": rol, "HashTestigo": hashlib.sha256(alias.encode()).hexdigest(), "Estado": estado,
                "IdUsuarioInvita": Ref("cuenta.externo-camila"), "FechaEmision": emision, "FechaExpiracion": exp,
                "FechaCierre": None if estado == "pendiente" else (exp if estado == "vencida" else emision + dt.timedelta(days=2))}
        if estado == "aceptada":
            vals["IdUsuarioAcepta"] = Ref("cuenta.editor")
        c.add("InvitacionesDeOrganizacion", vals, alias=alias, **meta)
    tipos = [("festival.publicado", "Tu festival ya está publicado", "La ficha fue revisada y ya es visible en el portal."), ("festival.ajustes", "Tu festival necesita ajustes", "La gestión pidió completar sede y fechas antes de publicar."),
             ("festival.rechazado", "Tu ficha no pudo publicarse", "La revisión no aprobó la ficha; puedes presentar otra con más detalle."), ("organizacion.invitacion", "Invitación aceptada", "Una persona aceptó tu invitación a la organización."),
             ("proceso.en_revision", "Tu proceso está en revisión", "Recibimos tu envío; la gestión lo revisará en los próximos días."), ("proceso.archivado", "Proceso archivado", "Archivaste el proceso; puedes consultarlo cuando quieras.")]
    estados_n = ["pendiente", "enviada", "leida", "fallida", "cancelada", "leida", "leida", "enviada", "pendiente", "leida", "enviada", "leida"]
    for i, est in enumerate(estados_n):
        tipo, titulo, cuerpo = tipos[i % len(tipos)]
        creada = momento(plan, 40 - 3 * i)
        v = {"UsuarioDestinatarioId": Ref("cuenta.externo-camila"), "TipoEvento": tipo, "Canal": "internal" if i % 3 else "email", "Titulo": titulo, "Cuerpo": f"{cuerpo} (aviso {i + 1}).", "Estado": est,
             "ModuloId": "festivales", "FechaCreacion": creada, "AmbitoAcceso": "external", "Intentos": 0}
        if est in ("enviada", "leida", "fallida"):
            v["FechaEnvio"] = creada + dt.timedelta(minutes=1)
            v["Intentos"] = 1 if est != "fallida" else 3
        if est == "leida":
            v["FechaLectura"] = creada + dt.timedelta(hours=3)
        if est == "fallida":
            v["Error"] = "El servidor de correo rechazó el mensaje (buzón lleno)."
        c.add("Notificaciones", v, alias=f"notificacion.camila.{i + 1}", **meta)
    for i, (usuario, titulo, cuerpo) in enumerate([("cuenta.webmaster", "Nuevo envío a revisión", "Hay procesos en revisión de la Corporación Sonora Andina."), ("cuenta.gestor", "Ajustes atendidos", "Una organización atendió los ajustes que pidió la gestión.")]):
        c.add("Notificaciones", {"UsuarioDestinatarioId": Ref(usuario), "TipoEvento": "revision.pendiente", "Canal": "internal", "Titulo": titulo, "Cuerpo": cuerpo, "Estado": "enviada",
                                 "FechaCreacion": momento(plan, 2 + i), "FechaEnvio": momento(plan, 2 + i), "Intentos": 1, "AmbitoAcceso": "institutional"}, alias=f"notificacion.gestion.{i + 1}", **meta)
    # --- eventos de la agenda ligados al festival publicado de la organización grande, en los cinco estados
    festival_pub = "festival.camila-grande-festival-publicado"
    for i, (estado, desfase, modalidad) in enumerate([("publicado", 18, "presencial"), ("publicado", -30, "mixta"), ("en_revision", 40, "virtual"), ("borrador", 75, "presencial"), ("rechazado", 55, "presencial"), ("archivado", -140, "presencial")]):
        titulo = ["Concierto de apertura", "Conversatorio con maestros", "Charla de inscripción", "Muestra de escuelas", "Ruta de presentaciones", "Concierto de cierre de la edición anterior"][i]
        titulo = f"{titulo} · Corporación Sonora Andina"
        alias = f"evento.camila.{i + 1}"
        inicio = plan.hoy + dt.timedelta(days=desfase)
        c.add("EventosAgenda", {"Slug": slug(titulo) + f"-{i + 1}", "Titulo": titulo, "Descripcion": f"{titulo}: una cita abierta, con inscripción previa y cupo limitado, dentro del festival de la corporación.", "FechaInicio": inicio,
                                "HoraInicio": dt.time(18, 0), "HoraFin": dt.time(21, 0), "Modalidad": modalidad, "Lugar": None if modalidad == "virtual" else "Teatro de la casa de la cultura, Bogotá",
                                "CodigoDepartamento": "11", "CodigoMunicipio": "11001", "Url": "https://sonora-andina.simus.test/inscripcion" if modalidad in ("virtual", "mixta") else None,
                                "Estado": estado, "FechaCreacion": momento(plan, 120 - i), "FechaActualizacion": momento(plan, 30), "Organizador": "Corporación Sonora Andina",
                                "DescripcionLarga": f"{titulo}. Propuesta de la Corporación Sonora Andina para acercar a las personas del barrio a las músicas que se trabajan en sus talleres y salas.",
                                "NivelCobertura": "municipal", "CategoriaId": Cat("Categorias", "IdCategoria", "Slug", "festivales", "CodigoModulo = N'agenda'"), "FestivalId": Ref(festival_pub)},
              alias=alias, **meta)
        c.historial_simple(alias, "agenda", estado, 100 - i, LOTE_PROCESOS, NIVEL)
    # --- propuestas de cambio (una sola viva por registro) y revisión por campos
    def propuesta(alias_proceso, modulo, estado, k):
        base = {"ModuloId": modulo, "RegistroId": Ref(alias_proceso, texto=True), "Estado": estado, "IdOrganizacion": Ref("org.camila-grande"), "IdUsuarioProponente": Ref("cuenta.externo-camila"),
                "Motivo": f"Actualizar la ficha con lo ocurrido en la última edición (propuesta {k}).", "FechaCreacion": momento(plan, 50 - 5 * k)}
        if estado != "borrador":
            base["FechaEnvio"] = momento(plan, 48 - 5 * k)
        if estado in ("aplicada", "rechazada"):
            base.update(IdUsuarioDecide=Ref("cuenta.gestor"), FechaDecision=momento(plan, 45 - 5 * k), MotivoDeLaDecision="Los cambios se verificaron con la organización." if estado == "aplicada" else "Falta evidencia de los cambios pedidos.")
        c.add("PropuestasDeCambio", base, alias=f"propuesta.camila.{k}", **meta)
        c.add("PropuestasDeCambioCampos", {"IdPropuesta": Ref(f"propuesta.camila.{k}"), "SeccionId": "general", "CampoId": "descripcion", "CampoEtiqueta": "Descripción",
                                           "ValorAnterior": "Texto anterior de la ficha.", "ValorPropuesto": f"Texto nuevo de la ficha ({k})."}, alias=f"propuesta.camila.{k}.campo.1", **meta)
    propuesta(festival_pub, "festivales", "aplicada", 1)
    propuesta(festival_pub, "festivales", "rechazada", 2)
    propuesta(festival_pub, "festivales", "en_revision", 3)
    propuesta("mercado.camila-grande-mercado-publicado", "mercados", "ajustes_solicitados", 4)
    propuesta("talleres.camila-grande-taller-publicado", "talleres", "borrador", 5)
    for k, (proc, estado) in enumerate([("festival.camila-grande-festival-ajustes-solicitados", "enviada"), (festival_pub, "cerrada")], 1):
        v = {"ModuloId": "festivales", "RegistroId": Ref(proc, texto=True), "Estado": estado, "IdUsuarioRevisor": Ref("cuenta.gestor"), "RevisorNombre": "Camila Restrepo (gestión)",
             "IdUsuarioDestinatario": Ref("cuenta.externo-camila"), "DestinatarioNombre": "Camila Restrepo", "IdOrganizacion": Ref("org.camila-grande"), "OrganizacionNombre": "Corporación Sonora Andina",
             "ObservacionGeneral": "Revisa los campos marcados y vuelve a enviar la ficha.", "FechaCreacion": momento(plan, 20 - 5 * k), "FechaEnvio": momento(plan, 19 - 5 * k)}
        if estado == "cerrada":
            v["FechaCierre"] = momento(plan, 8)
        c.add("RevisionesDeRegistro", v, alias=f"revision.camila.{k}", **meta)
        c.add("RevisionesDeRegistroObservaciones", {"IdRevision": Ref(f"revision.camila.{k}"), "Ambito": "principal", "SeccionId": "general", "CampoId": "descripcion", "CampoEtiqueta": "Descripción",
                                                    "ValorObservado": "Texto actual de la ficha.", "Nota": "Amplía la descripción con el alcance real del proceso y su periodicidad.",
                                                    "Estado": "pendiente" if estado == "enviada" else "atendida", "FechaCreacion": momento(plan, 19 - 5 * k),
                                                    **({"FechaAtencion": momento(plan, 9), "IdUsuarioAtiende": Ref("cuenta.externo-camila")} if estado == "cerrada" else {})},
              alias=f"revision.camila.{k}.obs.1", **meta)
    # --- vinculación: Camila pide ser responsable de una ficha ajena
    c.add("SolicitudesVinculacionRegistros", {"ModuloId": "festivales", "RegistroId": Ref("festival.encuentro-de-chirimia-del-san-juan", texto=True), "UsuarioSolicitanteId": Ref("cuenta.externo-camila"),
                                              "EntidadId": Ref("org.camila-grande"), "AlcanceSolicitado": "editor", "Justificacion": "Colaboramos con la corporación organizadora y queremos poder actualizar la ficha del encuentro.",
                                              "Estado": "pendiente", "FechaCreacion": momento(plan, 5), "FechaActualizacion": momento(plan, 5)}, alias="vinculacion.camila", **meta)
    # --- reclamaciones de la cuenta reclamante (sobre festivales históricos reales que sigan sin reclamar)
    c.reclamaciones_de("reclamante-org", "reclamante", forzar=forzar)
    return plan


def agregar(plan, constructor):
    """Compatibilidad: crea solo las administrativas y devuelve la referencia a la gestión."""
    return administrativas(plan, constructor)
