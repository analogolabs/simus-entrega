"""Gramática combinatoria del motor masivo: plantillas por campo, con rellenos del territorio, la práctica, la época y los vínculos.

Cada función recibe el generador `g` (con `g.rng` y el banco anti-duplicados) y un contexto `x`; devuelve texto en español colombiano.
Las plantillas de un mismo campo son al menos 7 y se combinan con rellenos de listas largas: el banco rechaza (y vuelve a sortear)
cualquier texto demasiado parecido a uno ya producido para ese campo.
"""
from __future__ import annotations

import re
from collections import defaultdict

from . import lexico as L

STOP = {"de", "la", "el", "los", "las", "y", "en", "del", "a", "un", "una", "con", "por", "para", "al", "que", "se", "su", "sus", "lo", "es"}


def _trigramas(t: str) -> frozenset:
    pal = re.findall(r"\w+", t.lower())
    if len(pal) < 3:
        return frozenset([tuple(pal)])
    return frozenset(zip(pal, pal[1:], pal[2:]))


def similitud(a: frozenset, b: frozenset) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


class Banco:
    """Recuerda los textos ya producidos por campo y mide la similitud (Jaccard de trigramas de palabras) con los nuevos."""

    def __init__(self, umbral: float = 0.45):
        self.umbral = umbral
        self.vistos: dict = defaultdict(list)

    def parecido(self, campo: str, texto: str) -> float:
        tg = _trigramas(texto)
        return max((similitud(tg, o) for o in self.vistos[campo]), default=0.0)

    def registrar(self, campo: str, texto: str):
        self.vistos[campo].append(_trigramas(texto))

    def producir(self, campo: str, fabrica, maximo: int | None = None, intentos: int = 24) -> str:
        mejor, mejor_s = None, 9.0
        for _ in range(intentos):
            t = fabrica()
            if maximo and len(t) > maximo:
                continue
            s = self.parecido(campo, t)
            if s < self.umbral:
                self.registrar(campo, t)
                return t
            if s < mejor_s:
                mejor, mejor_s = t, s
        t = mejor if mejor is not None else (fabrica() if not maximo else fabrica()[:maximo].rsplit(" ", 1)[0] + ".")
        self.registrar(campo, t)
        return t


def de(frase: str) -> str:
    """«el valle» → «del valle»; «la ribera» → «de la ribera»."""
    return "del " + frase[3:] if frase.startswith("el ") else "de " + frase


def a_(frase: str) -> str:
    return "al " + frase[3:] if frase.startswith("el ") else "a " + frase


def cap(t: str) -> str:
    return t[:1].upper() + t[1:]


def lista(items: list, conj: str = "y") -> str:
    items = [i for i in items if i]
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + f" {conj} " + items[-1]


# --------------------------------------------------------------------------------------------------------------------
# Piezas reutilizables
# --------------------------------------------------------------------------------------------------------------------
OFICIOS = {"interprete": ("intérprete", "intérprete"), "cantante": ("cantante", "cantante"), "compositor": ("compositor", "compositora"), "director": ("director de agrupaciones", "directora de agrupaciones"),
           "docente": ("docente de música", "docente de música"), "investigador": ("investigador de las músicas de su región", "investigadora de las músicas de su región"),
           "luthier": ("luthier", "luthier"), "sonidista": ("sonidista", "sonidista"), "productor": ("productor musical", "productora musical"), "gestor": ("gestor cultural", "gestora cultural"),
           "cultor": ("cultor de tradiciones musicales", "cultora de tradiciones musicales")}
FORMACIONES = ["en la escuela de música de su municipio", "con maestros de su comunidad", "en la facultad de artes de una universidad regional", "en talleres de verano con maestros invitados",
               "de manera autodidacta, con grabaciones de radio y casetes prestados", "en la banda de su colegio", "en un conservatorio de la capital del departamento", "en un semillero de música de su barrio",
               "acompañando a los músicos mayores de su familia", "en cursos de extensión de una casa de la cultura", "en una escuela de formación artística de la caja de compensación"]
APRENDIZAJES = ["de su abuela", "de un tío que tocaba en las fiestas del pueblo", "en las novenas de su barrio", "escuchando la radio de su casa", "en la banda de su colegio", "con los mayores de la vereda",
                "en las reuniones familiares de fin de año", "de un vecino que enseñaba por las tardes", "mirando ensayar a la agrupación del pueblo", "en las ceremonias y fiestas de su comunidad"]
TESIS = ["la memoria sonora se cuida tocándola y no guardándola", "una ficha bien hecha es una forma de cuidar un proceso", "enseñar es una manera de seguir aprendiendo", "los maestros mayores merecen reconocimiento y pagos justos",
         "la música de cada territorio se fortalece cuando quienes la hacen se conocen entre sí", "los instrumentos suenan mejor cuando se tocan entre varios", "los procesos pequeños sostienen la vida cultural de los pueblos",
         "nadie debería tener que irse de su municipio para vivir de la música", "documentar es devolverle a la gente lo que ella misma sabe", "la formación de niñas y niños es la base de cualquier escena local",
         "las alianzas entre vecinos valen más que cualquier tarima grande", "la música tradicional se renueva cuando los jóvenes la sienten propia"]
VERBOS_TRAYECTORIA = ["coordina", "dirige", "acompaña", "impulsa", "sostiene", "anima", "acompaña como docente", "organiza", "lidera"]
PROCESOS = ["un proceso de formación con niñas y niños", "un semillero de música", "ensayos abiertos para la comunidad", "un grupo de estudio sobre repertorios locales", "una escuela de barrio", "talleres para adultos mayores",
            "un ciclo anual de presentaciones", "un programa de visitas a escuelas rurales", "una serie de grabaciones de campo", "un taller de repertorio con jóvenes", "una ronda mensual de música en vivo"]
ZONAS_TRABAJO = ["en escuelas y barrios", "con comunidades de varias veredas", "junto a juntas de acción comunal", "en colegios públicos y casas culturales", "con organizaciones de base", "en plazas y salones comunales"]
MOTIVOS_CANCELACION = ["falta de recursos de la convocatoria de la que dependía", "obras en la sede principal que impidieron usarla", "una emergencia por lluvias en el municipio", "la calamidad de uno de los aliados organizadores",
                       "un cambio de calendario de las entidades que apoyaban la programación", "la imposibilidad de confirmar los permisos del espacio público a tiempo"]
LEMAS = ["Música para encontrarnos", "Tocar juntos", "Cuerdas, tambores y memoria", "La plaza es de todos", "Voces que no se apagan", "Sonar en el territorio", "De mayores a jóvenes", "Escuchar al vecino",
         "Un compás compartido", "El pueblo canta", "Raíces en movimiento", "Al ritmo del río", "Todos al ensayo", "Con los pies en la tierra", "Músicas que viajan", "La casa suena", "Memoria que se toca"]
CAMBIOS_SEDE = ["cambió de sede a un coliseo cubierto", "se trasladó al parque principal", "sumó una segunda sede en una vereda", "pasó de la casa cultural a la plaza", "se repartió entre tres barrios",
                "regresó a su sede original tras unas obras", "estrenó escenario en la ribera del río"]
NOVEDADES = ["una jornada de formación para niñas y niños", "su primera muestra de lutería", "un concurso de composición", "una noche dedicada a los mayores", "una ruta de presentaciones por las veredas",
              "un conversatorio sobre derechos de autor", "un pequeño mercado de instrumentos y discos", "una convocatoria a agrupaciones de municipios vecinos", "un día dedicado a la música de las mujeres de la región",
              "un taller abierto de grabación de campo"]
NOVEDAD_VERBOS = [("abrió", "abrirá"), ("incluyó", "incluirá"), ("sumó", "sumará"), ("estrenó", "estrenará"), ("incorporó", "incorporará")]
FINANCIACION_TXT = ["con recursos del impuesto al consumo de telefonía móvil destinado a cultura", "con aportes de la alcaldía y de la gobernación", "gracias a un estímulo de convocatoria cultural", "con boletería solidaria y aportes de aliados",
                    "con apoyo de una caja de compensación", "con trabajo voluntario y aportes de los comerciantes del barrio"]
ALIAS_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


URBANOS = ["el parque principal", "la casa de la cultura", "el teatro municipal", "la plaza de mercado", "el coliseo cubierto", "la biblioteca pública", "el auditorio de un colegio", "el salón comunal del barrio",
           "la plaza principal", "el malecón", "un patio colonial del centro", "el polideportivo", "el parque de los músicos", "el atrio de la iglesia", "la cancha del barrio"]


def lugar_de(r, rural: bool, vereda: str | None = None) -> str:
    v = vereda or r.choice(L.VEREDAS)
    rurales = [f"la caseta comunal de la vereda {v}", f"la cancha de la escuela rural de {v}", f"el patio de una finca de la vereda {v}", f"el salón comunal de {v}", "la ramada del corregimiento",
               f"la capilla de la vereda {v}", f"la plaza del corregimiento de {v}"]
    return r.choice(rurales if rural else URBANOS)


def preparar(g, dep: str, muni_cod: str, fam_key: str, rural: bool | None = None) -> dict:
    """Contexto territorial y de práctica reutilizable por todas las plantillas."""
    r = g.rng
    d = L.DEPTO[dep]
    fam = L.FAMILIAS[fam_key]
    region = L.REGION[dep]
    reg_f = "pacifico" if (fam_key == "afro" and dep in L.PACIFICO) else region
    gens = fam["gen"].get(reg_f) or fam["gen"].get("*") or fam["gen"].get("andina")
    ins = fam["instr"].get(reg_f) or fam["instr"].get("*") or fam["instr"].get("andina")
    muni = g.nombre_muni(muni_cod)
    geo = L.geo_de(dep, muni_cod, r)
    vereda = r.choice(L.VEREDAS)
    es_rural = (r.random() < 0.4) if rural is None else rural
    g1 = r.choice(gens)
    g2 = r.choice([x for x in gens if x != g1] or gens)
    i1 = r.choice(ins)
    i2 = r.choice([x for x in ins if x != i1] or ins)
    lugar = lugar_de(r, es_rural, vereda)
    return dict(dep=dep, muni=muni, depto=d["n"], adj=d["adj"], geo=geo, de_geo=de(geo), en_geo="en " + geo, a_geo=a_(geo), region=region, vereda=vereda, rural=es_rural, gen=g1, gen2=g2, instr=g_i(i1), instr2=i2,
                agentes=r.choice(fam["agentes"]), agentes2=r.choice(fam["agentes"]), acts=r.choice(fam["acts"]), acts2=r.choice(fam["acts"]), lugar=lugar,
                lugar_adm=muni if dep == "11" else f"{muni} ({d['n']})", fam=fam, fam_key=fam_key, epiteto=r.choice(fam["epitetos"]))


def g_i(x):
    return x


# --------------------------------------------------------------------------------------------------------------------
# Personas
# --------------------------------------------------------------------------------------------------------------------
def persona_corta(g, x: dict) -> str:
    r = g.rng
    ofi = OFICIOS[x["rol"]][1 if x["fem"] else 0]
    nac = "nacida" if x["fem"] else "nacido"
    plantillas = [
        "{Ofi} {nac} en {muni}; trabaja {gen} con {agentes} {en_geo}.",
        "{Ofi} con base en {lugar_adm}. Su trabajo gira en torno a {gen} y a {acts}.",
        "Desde {ini} se dedica a {gen} {en_geo}; trabaja con {instr} y {verbo} {proceso}.",
        "{Ofi} de {muni}: {gen}, {instr} y mucho trabajo con {agentes}.",
        "{Ofi} {nac} en {depto}. Acompaña {proceso} y trabaja con {instr} en agrupaciones de {muni}.",
        "En {muni} es conocid{o} por sus {acts}; su repertorio parte de {gen} y se abre a {gen2}.",
        "{Ofi} que {verbo} {proceso} en {lugar_adm}; su trabajo se apoya en {gen} y en {instr}.",
        "Trabaja {gen} desde {ini}. {Ofi} {nac} en {muni}, hoy {verbo} {proceso}.",
        "{Ofi} en {muni}: {gen}, {gen2} y {acts} con {agentes2}.",
    ]
    def f():
        t = r.choice(plantillas).format(ofi=ofi, Ofi=cap(ofi), nac=nac, o="a" if x["fem"] else "o", verbo=r.choice(VERBOS_TRAYECTORIA), proceso=r.choice(PROCESOS), ini=x["ini"], **{k: v for k, v in x.items() if k in ("muni", "depto", "gen", "gen2", "agentes", "agentes2", "acts", "instr", "en_geo", "de_geo", "lugar_adm")})
        return t
    return g.banco.producir("PerfilesPublicos.BiografiaCorta", f, 280)


def persona_larga(g, x: dict, breve: bool) -> str:
    r = g.rng
    nombre = x["primer"]
    fem = x["fem"]
    nac = "nacida" if fem else "nacido"
    origen = [
        "{n} creció {en_geo}, en {lugar_o}, donde aprendió {gen} {apr}.",
        "{Nac} en {muni}, {n} se acercó a la música {apr}; con los años se especializó en {gen}.",
        "{n} aprendió {gen} {apr}. Desde entonces no ha dejado de trabajar con {instr}.",
        "Su primer contacto con {gen} lo tuvo {apr}, en {muni}. A los quince años ya acompañaba presentaciones de la comunidad.",
        "{n} nació en {depto} y vive en {muni}. Su casa fue por años punto de ensayo de {agentes}.",
        "La música llegó a {n} {apr}; en {muni} encontró con quién tocar y por qué quedarse.",
        "{n} recuerda las tardes de ensayo {en_geo}: ahí entendió que {gen} se aprende escuchando a quienes ya la tocan.",
        "{n} se crió entre ensayos y fiestas {en_geo}; {gen} fue, desde el comienzo, el idioma de su casa.",
    ]
    formacion = [
        "Se formó {form} y más tarde amplió su repertorio hacia {gen2}.",
        "Estudió {form}; completó su formación con cursos cortos de {gen2}.",
        "Su formación fue {form}, con acompañamiento puntual de maestros de {gen2}.",
        "Tras formarse {form}, empezó a combinar {gen} con {gen2} en sus presentaciones.",
        "Aprendió el oficio {form}, y desde entonces alterna {instr} con {instr2}.",
        "Su formación combina {form} con años de práctica en {muni}; hoy se mueve entre {gen} y {gen2}.",
        "Pasó por varios procesos de formación, entre ellos {form}, y se quedó con {gen} como línea principal.",
        "Aprendió {form} y, con el tiempo, empezó a enseñar lo que había aprendido.",
    ]
    trayect = [
        "Desde {ini} {verbo} {proceso} {zona}.",
        "Entre {ini} y {fin} participó en {n_enc} encuentros regionales y {v_past} {proceso}.",
        "Ha acompañado a {agentes} de {muni} en {n_enc} presentaciones y ha {v_part} {proceso}.",
        "En {ini} puso en marcha {proceso}; hoy continúa en ese trabajo {zona}.",
        "Su trabajo reciente incluye {acts} y {proceso}, siempre {zona}.",
        "Ha pasado por {n_enc} escenarios de la región y, desde {ini}, {verbo} {proceso}.",
        "Durante los últimos años ha combinado su trabajo artístico con {proceso} {zona}.",
        "En {muni} es una de las personas a las que se acude cuando hay que armar {acts}; desde {ini} lo hace con {agentes}.",
    ]
    vinculos_t = [
        "Hace parte de {orgs}.", "Colabora con {orgs}.", "Su principal vínculo institucional es {orgs}.", "Trabaja de la mano de {orgs} en sus proyectos locales.", "Es integrante activa de {orgs}.",
        "Su trabajo se articula con {orgs}.", "Participa de las actividades de {orgs}.", "Se vincula con {orgs} para sus proyectos de formación.",
    ]
    cierre = [
        "Piensa que {tesis}.", "Suele repetir que {tesis}.", "Está convencid{o} de que {tesis}.", "Defiende la idea de que {tesis}.", "Para {n}, {tesis}.",
        "Su manera de trabajar parte de una idea: {tesis}.", "Cuando le preguntan por qué sigue en esto, responde que {tesis}.", "Entiende su oficio desde una convicción: {tesis}.",
    ]
    def f():
        partes = [r.choice(origen)]
        if not breve:
            partes.append(r.choice(formacion))
        partes.append(r.choice(trayect))
        if x.get("orgs"):
            partes.append(r.choice(vinculos_t))
        if not breve or r.random() < 0.5:
            partes.append(r.choice(cierre))
        txt = " ".join(partes)
        return txt.format(n=nombre, o="a" if fem else "o", nac=nac, en_geo=x["en_geo"], lugar_o=x["lugar_o"], gen=x["gen"], gen2=x["gen2"], apr=r.choice(APRENDIZAJES), muni=x["muni"], depto=x["depto"],
                          agentes=x["agentes"], instr=x["instr"], instr2=x["instr2"], form=r.choice(FORMACIONES), ini=x["ini"], fin=x["ini"] + r.randint(2, 6), verbo=r.choice(VERBOS_TRAYECTORIA),
                          v_past=r.choice(["acompañó", "coordinó", "dirigió", "sostuvo"]), v_part=r.choice(["coordinado", "dirigido", "sostenido", "impulsado"]), Nac=cap(nac), proceso=r.choice(PROCESOS), zona=r.choice(ZONAS_TRABAJO), acts=x["acts"], n_enc=r.randint(3, 19),
                          orgs=x.get("orgs", ""), tesis=r.choice(TESIS))
    return g.banco.producir("PerfilesPublicos.BiografiaLarga", f, 3800)


# --------------------------------------------------------------------------------------------------------------------
# Organizaciones y agrupaciones
# --------------------------------------------------------------------------------------------------------------------
def org_desc(g, x: dict, nivel: int) -> str:
    r = g.rng
    ident = [
        "{nombre} es una organización con sede en {lugar_adm} que trabaja {gen} y {gen2} con {agentes}.",
        "Desde {ini}, {nombre} impulsa en {muni} procesos de {gen}; su equipo combina formación, circulación y documentación.",
        "{Nombre} reúne a {agentes} de {muni} y {de_geo} alrededor de {gen}.",
        "Con sede en {muni}, {nombre} nació en {ini} para dar continuidad a {gen} {en_geo}.",
        "{Nombre} es una entidad cultural de {depto} dedicada a {gen}, a {acts} y al trabajo con {agentes2}.",
        "En {lugar_adm}, {nombre} sostiene desde {ini} {proceso}, con énfasis en {gen}.",
        "{Nombre} trabaja {en_geo} desde {ini}: {gen}, {acts} y un archivo propio de lo que va haciendo.",
        "{Nombre} trabaja con {agentes} {en_geo} desde {ini}, con sede en {muni}.",
    ]
    linea = [
        "Sus líneas son la formación de públicos, la circulación de agrupaciones locales y la documentación de lo que se hace {en_geo}.",
        "Cada año convoca a {agentes2} a {acts} y mantiene abiertos {proceso}.",
        "Trabaja con {n_pers} personas entre docentes, integrantes y voluntarios, y se sostiene {fin}.",
        "Mantiene {proceso} y dos veces al año abre sus puertas para {acts}.",
        "Su apuesta es que {tesis}.",
        "Opera con presupuestos pequeños y se financia {fin}.",
        "La organización lleva el registro de cada actividad y comparte con la comunidad los resultados de sus {acts}.",
        "Convoca cada año a {agentes2} y publica el resultado de sus {acts}.",
    ]
    rel = [
        "Está liderada por {admin}", "Su representante es {admin}", "La coordina {admin}", "Quien responde por ella es {admin}",
    ]
    proc = [
        " y hoy gestiona {procs}.", "; actualmente administra {procs}.", ". En la plataforma figuran {procs}.", " y tiene a su cargo {procs}.", "; su trabajo visible hoy se concentra en {procs}.", " y figura como responsable de {procs}.",
    ]
    ali = [" Trabaja en alianza con {aliados}.", " Entre sus aliados están {aliados}.", " Comparte proyectos con {aliados}.", " Mantiene alianzas con {aliados}.", " Ha trabajado con {aliados}."]

    def f():
        partes = [r.choice(ident)]
        if nivel == 2:
            partes.append(r.choice(linea))
        elif r.random() < 0.5:
            partes.append(r.choice(linea))
        txt = " ".join(partes)
        if x.get("admin"):
            txt += " " + r.choice(rel).format(admin=x["admin"]) + (r.choice(proc).format(procs=x["procs"]) if x.get("procs") else ".")
        elif x.get("procs"):
            txt += " " + cap(r.choice(["Hoy gestiona {procs}.", "En la plataforma figuran {procs}."]).format(procs=x["procs"]))
        if x.get("aliados") and (nivel == 2 or r.random() < 0.4):
            txt += r.choice(ali).format(aliados=x["aliados"])
        return txt.format(nombre=x["nombre"], Nombre=x["nombre"], lugar_adm=x["lugar_adm"], muni=x["muni"], depto=x["depto"], gen=x["gen"], gen2=x["gen2"], agentes=x["agentes"], agentes2=x["agentes2"],
                          ini=x["ini"], de_geo=x["de_geo"], en_geo=x["en_geo"], acts=x["acts"], proceso=r.choice(PROCESOS), tesis=r.choice(TESIS), n_pers=r.randint(4, 40), fin=r.choice(FINANCIACION_TXT))
    return g.banco.producir(f"Entidades.Descripcion.n{nivel}", f)


def agrupacion_desc(g, x: dict, nivel: int) -> str:
    r = g.rng
    ident = [
        "{nombre} es una agrupación de {muni} que interpreta {gen} con {instr} y {instr2}.",
        "Fundada en {ini} en {lugar_adm}, {nombre} se dedica a {gen}.",
        "{Nombre} nació {en_geo} en {ini}; su repertorio parte de {gen} y se abre a {gen2}.",
        "Con {n_int} integrantes, {nombre} toca {gen} en fiestas, encuentros y escuelas de {depto}.",
        "{Nombre} es un grupo de {agentes} de {muni} que desde {ini} trabaja {gen}.",
        "Desde {ini}, {nombre} lleva {gen} a plazas y escenarios de {muni} y {de_geo}.",
        "La agrupación {nombre}, de {lugar_adm}, une {instr}, {instr2} y voces para tocar {gen}.",
        "Integrada por {n_int} personas de {muni}, {nombre} toca {gen}.",
    ]
    prod = [
        "Ha grabado {n_gr} producciones independientes y presentado su repertorio en {n_pres} encuentros.",
        "Prepara un repertorio nuevo con arreglos propios y mantiene ensayos abiertos para la comunidad.",
        "Participa cada año en {acts} y ofrece funciones didácticas en colegios.",
        "Su repertorio incluye piezas de maestros de la región y composiciones del propio grupo.",
        "Ensaya una vez por semana en {lugar} y se presenta en {acts}.",
        "Combina {gen} con {gen2} y suele cerrar sus presentaciones con una ronda abierta al público.",
        "Se presenta en fiestas patronales, encuentros de {depto} y escuelas de {muni}.",
        "Entre sus metas están grabar un disco y circular por {n_pres} municipios.",
    ]
    def f():
        partes = [r.choice(ident)]
        if nivel == 2 or r.random() < 0.55:
            partes.append(r.choice(prod))
        txt = " ".join(partes)
        if x.get("admin"):
            txt += " " + r.choice(["La dirige {admin}.", "Su director o directora es {admin}.", "El grupo está coordinado por {admin}.", "{admin} es quien lleva la coordinación del grupo."]).format(admin=x["admin"])
        if x.get("festis"):
            txt += " " + r.choice(["Se ha presentado en {festis}.", "Ha estado en la programación de {festis}.", "Participa con frecuencia en {festis}.", "Ha subido a los escenarios de {festis}.", "Estuvo en la cartelera de {festis}."]).format(festis=x["festis"])
        return txt.format(nombre=x["nombre"], Nombre=x["nombre"], muni=x["muni"], lugar_adm=x["lugar_adm"], depto=x["depto"], gen=x["gen"], gen2=x["gen2"], instr=x["instr"], instr2=x["instr2"], ini=x["ini"],
                          en_geo=x["en_geo"], de_geo=x["de_geo"], n_int=r.randint(4, 14), agentes=x["agentes"], n_gr=r.randint(1, 4), n_pres=r.randint(5, 40), acts=x["acts"], lugar=x["lugar"])
    return g.banco.producir(f"Entidades.Descripcion.agrupacion.n{nivel}", f)


# --------------------------------------------------------------------------------------------------------------------
# Festivales y ediciones
# --------------------------------------------------------------------------------------------------------------------
def festival_desc(g, x: dict, nivel: int) -> str:
    r = g.rng
    origen = [
        "{nombre} nació en {ini} en {muni} como una cita para {gen} {en_geo}.",
        "Desde {ini}, {nombre} reúne en {lugar_adm} a {agentes} {de_geo}.",
        "{Nombre} empezó en {ini} con una sola noche en {lugar} y hoy ocupa varios espacios de {muni}.",
        "El festival {nombre} se creó en {ini} para dar visibilidad a {gen} y a quienes la sostienen {en_geo}.",
        "Lo que hoy se conoce como {nombre} comenzó en {ini} como una reunión de {agentes} en {muni}.",
        "{Nombre} es una cita anual de {gen} en {lugar_adm}, nacida en {ini} por iniciativa de {agentes2}.",
        "En {muni}, {nombre} lleva desde {ini} poniendo a conversar {gen} y {gen2}.",
        "{Nombre} se hace en {lugar_adm} desde {ini}: {gen} y {gen2} comparten programa.",
    ]
    prog = [
        "Su programación combina {acts}, {acts2} y una jornada de formación para jóvenes.",
        "Cada edición propone {acts} y deja un espacio para {acts2}.",
        "Entre {acts} y {acts2}, la programación incluye presentaciones de {n_ag} agrupaciones locales y regionales.",
        "Las jornadas se reparten entre {lugar} y otros escenarios del municipio, con {acts} como eje.",
        "La programación suele incluir {acts}, talleres abiertos y una noche de cierre con {gen2}.",
        "Se destaca por {acts}, y por abrir sus escenarios a {agentes2} que rara vez llegan a tarimas grandes.",
        "Ofrece {acts} y {acts2}, y reserva una franja para las agrupaciones que se presentan por primera vez.",
        "La parrilla alterna {acts} con {acts2}; los fines de semana suma {n_ag} agrupaciones.",
    ]
    comun = [
        "Participan {agentes} de {muni} y de municipios vecinos, y la entrada es libre hasta completar el aforo.",
        "El festival se apoya en el trabajo voluntario de {agentes} y de vecinos del barrio donde se realiza.",
        "Recibe cada año a agrupaciones de {n_mun} municipios y mantiene un encuentro paralelo de maestros y aprendices.",
        "Su público es sobre todo local: familias, estudiantes y {agentes2} que reconocen en él su propia música.",
        "Más que un escenario, funciona como punto de encuentro entre {agentes} y quienes quieren aprender {gen}.",
        "Quienes llegan de otros municipios encuentran alojamiento solidario en casas de familia del lugar.",
        "El comité organizador se reúne durante todo el año con {agentes} para decidir la programación.",
        "Las familias del barrio sostienen buena parte de la logística: cocinan, prestan sillas y reciben a las agrupaciones.",
    ]
    org = [
        "Lo organiza {org}", "Está a cargo de {org}", "La organización responsable es {org}", "Lo produce {org}",
    ]
    ali = [" con el acompañamiento de {aliados}.", ", en alianza con {aliados}.", " y cuenta con el apoyo de {aliados}.", ", junto a {aliados}."]
    def f():
        partes = [r.choice(origen)]
        if nivel == 2:
            partes += [r.choice(prog), r.choice(comun)]
        elif r.random() < 0.7:
            partes.append(r.choice(prog))
        txt = " ".join(partes)
        txt += " " + r.choice(org).format(org=x["org"]) + (r.choice(ali).format(aliados=x["aliados"]) if x.get("aliados") else ".")
        if x.get("parts"):
            txt += " " + r.choice(["Entre las agrupaciones que han pasado por su escenario están {parts}.", "Han tocado en sus jornadas {parts}.", "Su programación ha contado con {parts}.", "Figuran en su historia de programación {parts}."]).format(parts=x["parts"])
        if x.get("traj"):
            txt += " " + x["traj"]
        return txt.format(nombre=x["nombre"], Nombre=x["nombre"], ini=x["ini"], muni=x["muni"], lugar_adm=x["lugar_adm"], gen=x["gen"], gen2=x["gen2"], agentes=x["agentes"], agentes2=x["agentes2"], en_geo=x["en_geo"],
                          de_geo=x["de_geo"], lugar=x["lugar"], acts=x["acts"], acts2=x["acts2"], n_ag=r.randint(6, 28), n_mun=r.randint(3, 12))
    return g.banco.producir(f"Festivales.Descripcion.n{nivel}", f)


def trayectoria_txt(g, anios: list, estados: list, nombre: str) -> str:
    """Frase sobre el recorrido (interrupciones, número de ediciones, próxima edición) a partir de la serie real de ediciones."""
    r = g.rng
    real = [a for a, e in zip(anios, estados) if e == "realizada"]
    canc = [a for a, e in zip(anios, estados) if e == "cancelada"]
    fut = [a for a, e in zip(anios, estados) if e in ("programada", "en_preparacion")]
    opciones = []
    if len(real) >= 3:
        opciones += [f"Entre {min(real)} y {max(real)} ha realizado {len(real)} ediciones registradas en esta plataforma.", f"Lleva {len(real)} ediciones documentadas, la más reciente en {max(real)}.",
                     f"Desde {min(real)} mantiene una serie continua de ediciones, con {len(real)} registradas."]
    elif real:
        opciones += [f"Tiene {len(real)} {'edición registrada' if len(real) == 1 else 'ediciones registradas'}, la última en {max(real)}.", f"En la plataforma figura su edición de {max(real)}."]
    if canc:
        opciones += [f"En {canc[0]} la edición se canceló y la organización retomó el proceso después.", f"La edición de {canc[0]} no se realizó; el equipo reorganizó el calendario para los años siguientes."]
    if fut:
        opciones += [f"Ya tiene prevista la edición de {fut[0]}.", f"La próxima edición, la de {fut[0]}, está en {'preparación' if True else ''}."]
    return r.choice(opciones) if opciones else ""


EXTRAS_EDICION = ["Se financió {fin_txt}.", "La entrada fue libre hasta completar el aforo.", "Contó con {n_vol} personas voluntarias del barrio.", "Asistió público de {muni} y de municipios vecinos.",
                  "Se publicó un balance con fotografías y cifras de asistencia.", "Las agrupaciones recibieron una compensación por transporte.", "Los talleres se repitieron en dos colegios del municipio.",
                  "Hubo transmisión por redes de la organización."]
EXTRAS_FUTURA = ["La convocatoria de agrupaciones sigue abierta.", "Se espera financiar la edición {fin_txt}.", "La organización busca voluntarios del barrio para la logística.", "Los aliados confirmarán los escenarios en los próximos meses.",
                 "Habrá talleres previos en colegios del municipio."]


def edicion_desc(g, x: dict, estado: str, nivel: int) -> str:
    base = _edicion_base(g, x, estado, nivel)
    if nivel == 2 and estado != "cancelada":
        r = g.rng
        extra = r.choice(EXTRAS_FUTURA if estado in ("programada", "en_preparacion") else EXTRAS_EDICION).format(fin_txt=r.choice(FINANCIACION_TXT), n_vol=r.randint(8, 60), muni=x.get("muni", "la zona"))
        return base + " " + extra
    return base


def _edicion_base(g, x: dict, estado: str, nivel: int) -> str:
    """Descripción de UNA edición; `x` trae anio, nombre, ordinal, org, lugar, lema, n_ag, n_tall, hecho (novedad), motivo."""
    r = g.rng
    if estado == "cancelada":
        pl = [
            "La edición de {anio} de {nombre} se canceló por {motivo}; la organización anunció la reprogramación para los años siguientes.",
            "En {anio} {nombre} no pudo abrir sus puertas: {motivo}. Las agrupaciones inscritas fueron informadas y se conservó su lugar para la siguiente edición.",
            "{Nombre} {anio}: cancelada por {motivo}. El equipo organizador mantuvo los talleres de formación de forma reducida.",
            "Por {motivo}, la versión {anio} de {nombre} quedó suspendida; se publicó un comunicado y se reabrió la convocatoria.",
            "La cita de {anio} no se realizó. La causa fue {motivo}, según explicó la organización a las agrupaciones.",
            "{Nombre} dejó en pausa su edición {anio} debido a {motivo}; los aliados acordaron retomar el calendario después.",
            "Hubo que cancelar la edición {anio} de {nombre} a causa de {motivo}.",
        ]
        return g.banco.producir("EdicionesFestival.Descripcion.cancelada", lambda: r.choice(pl).format(**x), 1900)
    if estado in ("programada", "en_preparacion"):
        pl = [
            "La edición {anio} de {nombre}, la número {ordinal}, se prepara para {lugar} con {n_ag} agrupaciones convocadas y {n_tall} talleres abiertos.",
            "Para {anio}, {nombre} anuncia {acts} en {lugar}; el lema será «{lema}» y {hecho_f}.",
            "{Nombre} {anio} ya tiene fecha: {n_ag} agrupaciones confirmadas, {acts} y una jornada de formación. Se realizará en {lugar}.",
            "La próxima cita de {nombre}, en {anio}, traerá {acts}; además, {hecho_f}. Las inscripciones de agrupaciones siguen abiertas.",
            "En {anio} el festival regresa a {lugar}. Habrá {acts} y la edición se concentrará en «{lema}».",
            "{Nombre} se alista para su edición {ordinal}: {n_ag} agrupaciones, {n_tall} talleres y {acts} en {lugar}.",
            "Edición {anio} en preparación: {acts}, con sede en {lugar}, y {hecho_f}.",
            "Con «{lema}» como idea central, {nombre} {anio} se perfila con {n_ag} participantes y entrada libre a los talleres.",
        ]
        return g.banco.producir("EdicionesFestival.Descripcion.futura", lambda: r.choice(pl).format(**x), 1900)
    pl = [
        "{ordinal}.ª edición de {nombre}: {acts} en {lugar}, con {n_ag} agrupaciones y {n_tall} talleres abiertos; ese año el festival {hecho}.",
        "En {anio}, {nombre} reunió a {n_ag} agrupaciones en {lugar}. El eje fue «{lema}» y {hecho_f2}.",
        "La edición {anio} de {nombre} se concentró en {acts}; asistieron cerca de {publico} personas y el festival {hecho}.",
        "{Nombre} {anio}: {n_ag} agrupaciones, {n_tall} talleres y {acts} en {lugar}. {Hecho_c}.",
        "Con «{lema}» como lema, la versión {anio} de {nombre} llenó {lugar} durante {dias} días; participaron {n_ag} agrupaciones y el festival {hecho}.",
        "La {ordinal}.ª versión del festival {nombre} ({anio}) combinó {acts} con jornadas de formación; se calcula una asistencia de {publico} personas.",
        "Tras la edición anterior, {nombre} volvió en {anio} con {acts} en {lugar}; {hecho_f2}.",
        "{Nombre} cerró su edición {anio} con {n_ag} agrupaciones, {acts} y un balance de {publico} asistentes. {Hecho_c}.",
        "Durante {dias} días de {anio}, {lugar} fue sede de {nombre}: {acts}, {n_tall} talleres y {n_ag} agrupaciones invitadas.",
    ]
    return g.banco.producir("EdicionesFestival.Descripcion.realizada", lambda: r.choice(pl).format(**x), 1900)


# --------------------------------------------------------------------------------------------------------------------
# Mercados, redes, talleres, espacios
# --------------------------------------------------------------------------------------------------------------------
def mercado_desc(g, x: dict, nivel: int) -> str:
    r = g.rng
    a = [
        "{nombre} es {un_tipo} de {gen} que conecta a agrupaciones {de_geo} con programadores, salas y festivales.",
        "Desde {ini}, {nombre} organiza en {lugar_adm} citas de negocio, showcases y charlas para {agentes}.",
        "{Nombre} reúne cada año a {n_ag} agrupaciones de {depto} y de regiones vecinas para mostrar {gen} ante programadores.",
        "En {muni}, {nombre} funciona como vitrina de {gen} y de {gen2}: citas de 20 minutos, showcases y asesoría en contratación.",
        "{Nombre} nació en {ini} como un espacio para que {agentes} aprendan a presentar su trabajo y a circular por otros territorios.",
        "Con sede en {lugar_adm}, {nombre} propone {un_tipo} abierta a {agentes} y a quienes programan música {en_geo}.",
        "Cada año, {nombre} sienta en una misma mesa a {agentes} y a quienes programan música {en_geo}.",
        "{Nombre} ofrece desde {ini} un espacio de encuentro entre {agentes} y compradores de servicios musicales de {depto}.",
    ]
    b = [
        "Incluye {acts}, mesas de asesoría en derechos de autor y una ronda de preguntas con programadores.",
        "Además de las citas, ofrece clínicas de {gen2} y una guía impresa con recomendaciones para negociar.",
        "La modalidad {modalidad} permite que agrupaciones sin presupuesto de viaje participen en las citas.",
        "Su alcance es {alcance} y recibe inscripciones por convocatoria abierta durante dos meses.",
        "Cada edición cierra con un balance público de citas realizadas y compromisos de programación.",
        "Cada agrupación recibe retroalimentación escrita sobre su propuesta artística y su ficha técnica.",
        "Hay una jornada previa de preparación para quienes participan por primera vez.",
        "Reúne a programadores de festivales, salas y medios de {depto} y de regiones vecinas.",
    ]
    def f():
        t = r.choice(a) + " " + r.choice(b) + (f" Se realiza en el marco de {x['festival']}." if x.get("festival") else "") + f" Lo organiza {x['org']}."
        return t.format(nombre=x["nombre"], Nombre=x["nombre"], un_tipo=x["un_tipo"], gen=x["gen"], gen2=x["gen2"], de_geo=x["de_geo"], en_geo=x["en_geo"], ini=x["ini"], lugar_adm=x["lugar_adm"], muni=x["muni"],
                        agentes=x["agentes"], n_ag=r.randint(20, 90), depto=x["depto"], acts=x["acts"], modalidad=x["modalidad"], alcance=x["alcance"])
    return g.banco.producir("Mercados.Descripcion", f)


def red_desc(g, x: dict, nivel: int) -> str:
    r = g.rng
    tipo = x["tipo"]
    nucleo = {"red": ["Red de {agentes} {de_geo} que comparte repertorios, convocatorias y contactos de {gen}.", "Red de trabajo entre {agentes} de {n_mun} municipios {de_geo}, dedicada a {gen}.", "Red que articula a {agentes} y escuelas de música {de_geo} para compartir repertorios y calendarios de {gen}.", "Red de intercambio entre procesos de {gen} y {gen2} de {depto}."],
              "archivo": ["Archivo de grabaciones, fotografías y partituras de {gen} de {depto}, organizado con las propias familias.", "Archivo comunitario de {gen} {en_geo}, con catálogo abierto y copias de preservación.", "Archivo que reúne grabaciones de campo, fotografías y cuadernos de maestros de {gen} de {muni} y sus alrededores.", "Archivo sonoro en construcción sobre {gen} y {gen2}, con acuerdos de uso definidos con las familias."],
              "coleccion": ["Colección de repertorios, programas de mano y fotografías de {gen} reunidos en {muni} desde {ini}.", "Colección de discos, casetes y partituras de {gen} de {depto}, reunida por {agentes}.", "Colección de afiches, programas y registros de eventos de {gen} {en_geo}, ordenada por años.", "Colección familiar de instrumentos, cuadernos y fotografías de {gen}, abierta a visitas guiadas en {muni}."],
              "centro_de_documentacion": ["Centro que reúne entrevistas, partituras orales y fotografías sobre {gen} en {lugar_adm}; atiende consultas de investigadores y escuelas.", "Centro de documentación dedicado a {gen}: cataloga, digitaliza y presta material en {muni}.", "Centro con sala de consulta para estudiantes e investigadores de {gen} y {gen2} {en_geo}.", "Centro comunitario que digitaliza y conserva partituras, grabaciones y entrevistas sobre {gen} en {depto}."],
              "grupo_de_investigacion": ["Grupo que acompaña la investigación sobre {gen} {en_geo}, con metodologías de trabajo conjunto con {agentes}.", "Grupo de estudio sobre {gen} y {gen2} integrado por {agentes} y docentes de {muni}.", "Grupo que cruza saberes de {agentes} con métodos de investigación para estudiar {gen} {en_geo}.", "Grupo de investigación y circulación de resultados sobre {gen} en {depto}."]}[tipo]
    cierre = ["Su acceso es {acceso} y los materiales se consultan {como}.", "Los catálogos se publican {como}; el acceso es {acceso}.", "Cada año suma {n_doc} documentos nuevos {como}.",
              "Mantiene reuniones {freq} y un boletín propio.", "Funciona con {n_pers} personas voluntarias y se sostiene {fin}.", "Publica un informe anual sobre lo recibido y lo consultado.", "Quienes quieran aportar material pueden hacerlo previa cita en {muni}.", "Los acuerdos de uso se revisan cada año con las familias y las agrupaciones."]
    def f():
        t = r.choice(nucleo) + " " + r.choice(cierre)
        t += f" Es parte de {x['org']}." if x.get("org") else ""
        return t.format(agentes=x["agentes"], de_geo=x["de_geo"], en_geo=x["en_geo"], gen=x["gen"], gen2=x["gen2"], n_mun=r.randint(3, 15), depto=x["depto"], muni=x["muni"], ini=x["ini"], lugar_adm=x["lugar_adm"],
                        acceso=r.choice(["abierto", "abierto con solicitud previa", "restringido a investigadores"]), como=r.choice(["en sala y en línea", "en sala", "por solicitud al correo de la red", "en línea"]),
                        n_doc=r.randint(30, 400), freq=r.choice(["mensuales", "trimestrales", "cada dos meses"]), n_pers=r.randint(3, 25), fin=r.choice(FINANCIACION_TXT))
    return g.banco.producir("Redes.Descripcion", f)


def taller_desc(g, x: dict, nivel: int) -> str:
    r = g.rng
    nucleo = [
        "Taller de construcción y reparación de {instr}, {instr2} y otros instrumentos para {gen}; recibe aprendices cada semestre.",
        "Espacio de lutería {en_geo} que fabrica {instr} y restaura instrumentos de escuelas y agrupaciones de {muni}.",
        "En {lugar_adm}, este taller trabaja {instr} y {instr2} con maderas y cueros de la región; atiende encargos de {agentes}.",
        "Taller de oficio dedicado a {instr}: del corte de la madera al afinado final, con enfoque en {gen}.",
        "Lutería de barrio que repara y afina {instr} para {agentes}, y enseña el oficio a jóvenes interesados.",
        "Taller {modalidad} de {instr} y {instr2}: construcción, afinación y mantenimiento para quienes tocan {gen}.",
        "Lutería de oficio en {muni}: instrumentos nuevos por encargo y arreglos para {agentes} que tocan {gen}.",
        "Taller que mantiene viva la construcción de {instr} {en_geo}, con técnicas aprendidas de maestros constructores.",
        "En {lugar_adm}, un taller de {instr} y {instr2} donde también se reparan instrumentos de escuelas y bandas de la zona.",
    ]
    cierre = ["Atiende {n_enc} encargos al mes y enseña a {n_apr} aprendices por año.", "Tiene convenio con escuelas de música cercanas para el mantenimiento de instrumentos.", "Presta instrumentos a niñas y niños que no pueden comprarlos.",
              "Una vez al año abre el taller al público para mostrar cómo se construye un instrumento.", "Los materiales se consiguen en la región y las técnicas se transmiten de maestros a aprendices.",
              "Cobra precios solidarios a las agrupaciones de la comunidad.", "Guarda un banco de repuestos y cuerdas para emergencias antes de las presentaciones.", "Participa cada año en una feria local de instrumentos.", "Documenta cada construcción con fotografías y notas del maestro.", "Recibe visitas de colegios para mostrar el oficio.",
              "Desde {ini} ha formado a {n_apr_t} aprendices en {muni}.", "Su especialidad son {instr} y {instr2}, y atiende encargos de {depto}.", "Trabaja con {n_mad} maderas de la región y compra los cueros a ganaderos cercanos.",
              "Cada {freq_t} organiza una jornada de afinación gratuita para {agentes}."]
    def f():
        t = r.choice(nucleo) + " " + r.choice(cierre)
        return t.format(**{**x, "modalidad": x["modalidad_txt"], "n_enc": r.randint(3, 25), "n_apr": r.randint(2, 15), "n_apr_t": r.randint(8, 120), "n_mad": r.randint(3, 9),
                           "freq_t": r.choice(["mes", "trimestre", "semestre"])})
    return g.banco.producir("Talleres.Descripcion", f)


def espacio_desc(g, x: dict, nivel: int) -> str:
    r = g.rng
    nucleo = [
        "{Tipo} {amb} en {lugar_adm} para ensayos y presentaciones de {gen}; capacidad para {aforo} personas.",
        "Escenario {amb_m} de {muni} con espacio para {aforo} personas; recibe {agentes} y {acts}.",
        "{Tipo} de {muni} para {gen}: {aforo} personas de aforo y horarios nocturnos para los fines de semana.",
        "En {lugar_adm}, un lugar {amb_m} para {acts} y encuentros de {agentes}; aforo máximo de {aforo} personas.",
        "Lugar {amb_m} {en_geo} que sirve de punto de ensayo y de presentación a {agentes}; cabe {aforo} personas.",
        "{Tipo} {amb} donde ensayan {agentes} de {muni}; tiene {equipo} y se alquila a precios solidarios.",
        "En {muni}, {tipo_l} {amb} que usan {agentes} para ensayos, grabaciones caseras y {acts}; recibe {aforo} personas.",
        "{Tipo} {amb} para {agentes} de {lugar_adm}; el aforo máximo es de {aforo} personas.",
        "Lugar {amb_m} {en_geo}, sede habitual de {acts}; admite hasta {aforo} personas.",
    ]
    cierre = ["Cuenta con {equipo}.", "Se reserva con una semana de anticipación.", "Ofrece una franja gratuita para procesos comunitarios.", "Tiene acceso para personas con movilidad reducida.",
              "No cuenta con tarima fija, pero se adecúa para cada evento.", "Abre de martes a domingo con programación variable.", "Los fines de semana se reserva para presentaciones y entre semana para ensayos.", "Tiene un cuarto de almacenamiento para instrumentos de las agrupaciones residentes.", "La administración la lleva un comité de vecinos y músicos.", "Cuenta con baños y una pequeña cocina para los días de evento.",
              "Desde {ini} recibe a {agentes} de {muni} y de municipios vecinos.", "Cada mes programa {n_fechas} fechas de {gen}.", "Atiende unos {n_ens} ensayos por semana de agrupaciones de {depto}.",
              "Su aforo de {aforo} personas se llena en las noches de {acts}."]
    def f():
        t = r.choice(nucleo) + " " + r.choice(cierre)
        return t.format(**{**x, "tipo": x["tipo"], "Tipo": x["tipo"], "amb": x["amb_txt"], "n_fechas": r.randint(2, 9), "n_ens": r.randint(3, 15),
                        "equipo": r.choice(["sonido básico y micrófonos", "una consola pequeña y dos monitores", "luces y una tarima modular", "equipo de percusión disponible", "piano vertical y sillas", "amplificadores y backline básico"])})
    return g.banco.producir("Espacios.Descripcion", f)


# --------------------------------------------------------------------------------------------------------------------
# Eventos
# --------------------------------------------------------------------------------------------------------------------
TITULOS_EVENTO = {
    "conciertos-y-presentaciones": ["Noche de {gen} en {muni}", "{Gen} en vivo {en_geo}", "Concierto de {instr} en {lugar_t}", "Tarde de {gen} para toda la familia", "Ronda abierta de {gen}", "Presentación de repertorio de {gen}",
                                    "Velada de {gen} {en_geo}", "Serenata de {gen} para {muni}"],
    "encuentros-y-dialogos": ["Conversatorio: {tema}", "Mesa de trabajo sobre {tema}", "Encuentro de {agentes} de {depto}", "Diálogo abierto: {tema}", "Tertulia de {agentes} en {muni}", "Foro sobre {tema}"],
    "formacion": ["Taller de {gen} para principiantes", "Clínica de {instr} en {muni}", "Curso corto de {gen}", "Laboratorio de {gen2}: sesión abierta", "Taller de {instr} con maestros locales", "Jornada de formación en {gen}"],
    "convocatorias": ["Convocatoria abierta: {gen} {en_geo}", "Charla informativa de la convocatoria de {gen}", "Inscripciones para agrupaciones de {gen}", "Convocatoria de {agentes} para {acts}"],
    "festivales": ["Jornada de {gen} del festival", "Ronda previa del festival: {gen}", "Conciertos de apertura en {muni}", "Gran cierre con {gen}", "Escenario de {gen} del festival en {lugar_t}"],
}
TEMAS_DIALOGO = ["los derechos de autor y las agrupaciones pequeñas", "cómo documentar un festival local", "la transmisión de saberes entre generaciones", "circulación de agrupaciones entre departamentos", "tarifas y condiciones técnicas",
                 "la lutería como oficio", "el archivo sonoro de la comunidad", "mujeres y música en el territorio", "formalizar una agrupación sin perder su espíritu", "programar música regional en salas pequeñas",
                 "los desafíos de sostener una escuela de música de barrio", "la música en las fiestas patronales de hoy"]


def evento_desc(g, x: dict) -> str:
    r = g.rng
    c1 = [
        "Una cita abierta en {lugar_txt} con {gen} como eje, pensada para familias y vecinos de {muni}.",
        "Participan {agentes} de {muni} y {de_geo}; la entrada es libre hasta completar el cupo.",
        "La jornada reúne a {n_ag} personas de la comunidad en {lugar_txt}, con espacio para escuchar y para preguntar.",
        "Se realiza en {lugar_txt} y combina {acts} con una pausa de conversación entre el público y quienes tocan.",
        "Es una de las actividades de la temporada de {gen} en {lugar_adm}.",
        "Organiza {organizador}; el programa va de las 6 de la tarde a las 9 de la noche y termina con una ronda abierta.",
        "Una actividad gratuita de {organizador} dirigida a quienes quieren acercarse a {gen}.",
        "Quienes lleguen podrán escuchar {gen} en vivo y conversar con {agentes} de {muni}.",
        "{organizador} abre sus puertas en {lugar_adm} para una jornada de {acts}.",
    ]
    c2 = [
        "Se recomienda llegar con anticipación.", "Habrá instrumentos disponibles para quienes quieran probarlos.", "Se transmitirá por redes de la organización para quienes no puedan asistir.",
        "El cupo es limitado y se confirma por orden de llegada.", "Se invita a llevar un instrumento o una canción para compartir.", "Al final se abrirá un espacio de preguntas con quienes participan.",
        "Los niños y niñas entran acompañados de un adulto.", "La actividad queda registrada en el archivo de la organización.",
        "Se recomienda llevar agua y ropa cómoda.", "La organización recibirá donaciones voluntarias para sostener la actividad.",
        "Para quienes lleguen temprano habrá {acts2} en {lugar_txt}.", "Se espera la participación de {agentes2} de {depto}.", "La jornada incluye una breve muestra de {gen2}.",
        "Las personas de {muni} que quieran sumarse pueden inscribirse el mismo día.", "Se pedirá un aporte voluntario para cubrir el sonido y el transporte de {agentes}.",
        "Es una de las {n_ag} actividades de la temporada en {muni}.", "La cita se repite cada {freq_ev} en {muni}.", "Quienes tocan {gen} están invitados a llevar su instrumento.",
    ]
    def f():
        base = r.choice(c1).format(**x)
        if r.random() < 0.3:
            return base
        return base + " " + r.choice(c2).format(freq_ev=r.choice(["semana", "quince días", "mes", "temporada"]), **x)
    return g.banco.producir("EventosAgenda.Descripcion", f, 950)


def evento_largo(g, x: dict) -> str:
    r = g.rng
    a = [
        "{titulo} es una actividad de {organizador} en {lugar_adm}. Quienes asisten encontrarán {acts} y una charla corta sobre la historia de {gen} {en_geo}.",
        "La convocatoria de {organizador} para {titulo} busca que {agentes} compartan su trabajo con vecinos de {muni}; el programa incluye {acts} y una muestra de {gen2}.",
        "En {lugar_txt}, {organizador} organiza {titulo}: un espacio para {acts}, con presentaciones breves de {agentes} y un cierre abierto al público.",
        "{titulo} se piensa como un punto de encuentro de {agentes} de {muni}. Habrá {acts}, un momento de conversación sobre {gen} y tiempo para que el público pregunte.",
        "Con {titulo}, {organizador} invita a vecinos y visitantes de {muni} a vivir {acts}; habrá una breve explicación sobre {gen2} para quienes lo escuchan por primera vez.",
        "{titulo} reúne en {lugar_txt} a {agentes} que trabajan {gen}; la jornada se completa con {acts} y un espacio de conversación con el público.",
        "Para {titulo}, {organizador} prepara un programa de {acts} {en_geo}, con participación de personas de {muni} y de municipios cercanos.",
        "{titulo} busca poner a {agentes} en contacto con quienes quieren aprender {gen}: habrá {acts}, un espacio de preguntas y material impreso sobre la actividad.",
    ]
    b = [
        "La organización recomienda confirmar la asistencia con anticipación, porque el cupo depende del aforo del lugar.", "Al terminar se publicará un registro fotográfico y un breve texto con lo que pasó en la jornada.",
        "Se contará con un intérprete de lengua de señas en la franja de conversación si se solicita con tres días de anticipación.", "El evento hace parte de una serie que la organización repite cada temporada.",
        "Quienes no puedan asistir podrán escribir a la organización para recibir el material de la jornada.",
        "Si llueve, la actividad se traslada a un salón cubierto cercano y se avisa por los canales de la organización.", "Habrá un punto de información para quienes quieran vincularse a los procesos de la organización.",
        "Al final se recogerán sugerencias del público para la próxima jornada.",
        "{organizador} documentará la jornada para su archivo sobre {gen}.", "Se prevé la asistencia de unas {n_ag} personas de {muni} y de municipios cercanos.", "La actividad cuenta con el apoyo de vecinos y comerciantes de {muni}.",
        "Quienes asistan podrán conocer el trabajo de {agentes2} {en_geo}.", "La entrada es libre y se pide puntualidad para empezar con {acts}.",
    ]
    def f():
        return r.choice(a).format(**x) + (" " + r.choice(b).format(**x) if r.random() < 0.85 else "")
    return g.banco.producir("EventosAgenda.DescripcionLarga", f)
