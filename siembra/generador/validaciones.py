"""Validaciones previas del plan de siembra (antes de escribir una sola línea de SQL).

Comprueba contra la instantánea del esquema real (columnas, obligatorios, longitudes, CHECK de enumeración, únicos) y contra reglas de
negocio que el esquema no expresa: referencias resueltas, fechas coherentes con el estado, historiales que terminan en el estado actual,
territorio consistente, unicidad de claves naturales y textos no repetidos. Devuelve (errores, advertencias); con errores no se aplica nada.
"""
from __future__ import annotations

import datetime as dt
import re
from collections import defaultdict

from nucleo import Cat, Plan, Raw, Ref

COLUMNAS_TEXTO_LARGO = ("Descripcion", "DescripcionLarga", "Cuerpo", "Resumen", "BiografiaLarga", "BiografiaCorta", "Justificacion", "Motivo")
PARES_DE_FECHAS = [("FechaInicio", "FechaFin"), ("FechaCreacion", "FechaActualizacion"), ("FechaCreacion", "FechaEnvioARevision"), ("FechaEnvioARevision", "FechaPublicacion"),
                   ("FechaPublicacion", "FechaArchivado"), ("FechaCreacion", "FechaPublicacion"), ("FechaEnvio", "FechaDecision"), ("FechaCreacion", "FechaEnvio"), ("FechaEmision", "FechaExpiracion"),
                   ("FechaCreacion", "FechaEnvio"), ("FechaEnvio", "FechaLectura")]
TABLAS_CON_ESTADO = {"Festivales": "EstadoRegistro", "Mercados": "EstadoRegistro", "Redes": "EstadoRegistro", "Talleres": "EstadoRegistro", "Espacios": "EstadoRegistro",
                     "Noticias": "Estado", "EventosAgenda": "Estado"}
MODULO_DE_TABLA = {"Festivales": "festivales", "Mercados": "mercados", "Redes": "redes", "Talleres": "talleres", "Espacios": "espacios", "Noticias": "noticias", "EventosAgenda": "agenda"}
CATALOGO_DE_TABLA = {"PracticasMusicales": "practicas", "TerritoriosSonoros": "territorios", "Roles": None, "Categorias": "categorias", "AlcancesMercado": "alcances_mercado",
                     "ModalidadesMercado": "modalidades_mercado", "TipologiasFestival": "tipologias_festival", "FuentesFinanciacion": "fuentes_financiacion", "TiposOrganizador": "tipos_organizador"}
ROLES_VALIDOS = {"externo", "gestor_interno", "webmaster"}


def indexar_esquema(esq: dict) -> dict:
    t = defaultdict(lambda: {"cols": {}, "uq": [], "enum": {}, "checks": []})
    for c in esq["columnas"]:
        t[c["tabla"]]["cols"][c["columna"]] = c
    defectos = {(d["tabla"], d["columna"]) for d in esq["defectos"]}
    for tabla, d in t.items():
        for nombre, c in d["cols"].items():
            c["obligatoria"] = not c["admite_nulo"] and not c["es_identidad"] and not c["es_calculada"] and (tabla, nombre) not in defectos
    for k in esq["claves"]:
        if not k["es_pk"] and not k.get("filtro"):
            t[k["tabla"]]["uq"].append(k["columnas"].split(","))
    for ck in esq["checks"]:
        d = ck["definicion"]
        t[ck["tabla"]]["checks"].append((ck["restriccion"], d))
        cols = set(re.findall(r"\[(\w+)\]=N?'", d))
        if len(cols) == 1 and not re.search(r"\bAND\b|IS NULL|<|>|like|collate", d, re.I):
            col = cols.pop()
            t[ck["tabla"]]["enum"][col] = set(re.findall(r"=N?'([^']*)'", d))
    return t


NO_EVALUABLE = re.compile(r"like|len\(|collate|case|nullif|isnull|lower|rtrim|ltrim|\bIN\b|between|\+|substring|charindex|patindex|\bin \(", re.I)


def evaluar_check(definicion: str, valores: dict, columnas: dict):
    """Evalúa un CHECK simple (comparaciones, IS [NOT] NULL, AND/OR/NOT) sobre una fila simbólica. Devuelve True/False, o None si
    no se puede decidir (expresiones con funciones, o columnas omitidas que tienen valor por defecto)."""
    if NO_EVALUABLE.search(definicion):
        return None
    cols = set(re.findall(r"\[(\w+)\]", definicion))
    for c in cols:
        if c not in valores and not columnas.get(c, {}).get("admite_nulo", True):
            return None  # no nula y omitida: la fija el valor por defecto, que aquí no se conoce
        if c not in columnas:
            return None
    ex = definicion
    ex = re.sub(r"N?'([^']*)'", lambda m: repr(m.group(1)), ex)
    ex = re.sub(r"\[(\w+)\]", lambda m: f"V({m.group(1)!r})", ex)
    ex = re.sub(r"\(\((\d+)\)\)", r"\1", ex)
    ex = ex.replace("<>", "!=")
    ex = re.sub(r"(?<![<>!=])=(?!=)", "==", ex)
    ex = re.sub(r"\bIS NOT NULL\b", "is not None", ex, flags=re.I)
    ex = re.sub(r"\bIS NULL\b", "is None", ex, flags=re.I)
    ex = re.sub(r"\bAND\b", "and", ex, flags=re.I)
    ex = re.sub(r"\bOR\b", "or", ex, flags=re.I)
    ex = re.sub(r"\bNOT\b", "not", ex, flags=re.I)

    def V(nombre):
        v = valores.get(nombre)
        if isinstance(v, Ref):
            return ("ref", v.alias)
        if isinstance(v, Cat):
            return ("cat", v.tabla, v.clave)   # dos catálogos distintos se comparan por su clave (p. ej. CK_EdicionesFestival_FuentesDistintas)
        return ("raw", v.sql) if isinstance(v, Raw) else v
    try:
        return bool(eval(ex, {"__builtins__": {}}, {"V": V}))
    except Exception:
        return None


def _texto_norm(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", t.lower())).strip()


def validar(plan: Plan, esquema: dict, catalogos: dict, territorio) -> tuple:
    ix = indexar_esquema(esquema)
    err, adv = [], []
    aliases: dict = {}
    claves_estables: set = set()
    cat_valores = {k: {x["slug"] for x in v} for k, v in catalogos.items() if k not in ("divipola", "categorias")}
    cat_valores["categorias"] = {x["slug"] for x in catalogos["categorias"]}
    estado_de: dict = {}
    unicos: dict = defaultdict(dict)
    textos: dict = defaultdict(dict)
    hist: dict = defaultdict(list)

    for f in plan.filas:
        loc = f"{f.tabla}[{f.alias or '·'}]"
        # --- alias y procedencia
        if f.alias:
            if f.alias in aliases:
                err.append(f"alias repetido: {f.alias}")
            aliases[f.alias] = f
            if len(f.alias) > 120:
                err.append(f"{loc}: alias de más de 120 caracteres")
        if f.procedencia not in ("publico", "sintetico", "hibrido"):
            err.append(f"{loc}: procedencia no válida «{f.procedencia}»")
        if f.procedencia != "sintetico" and not f.fuente:
            err.append(f"{loc}: procedencia {f.procedencia} sin fuente")
        if f.nivel == 1 and f.alias and not f.clave_estable and f.tabla in ("Festivales", "EdicionesFestival", "Mercados", "EdicionesMercado", "Entidades", "Usuarios"):
            err.append(f"{loc}: nivel 1 sin clave estable")
        if f.clave_estable:
            if f.nivel not in (0, 1):
                err.append(f"{loc}: clave estable solo en niveles 0 y 1")
            if len(f.clave_estable) > 80:
                err.append(f"{loc}: clave estable de {len(f.clave_estable)} caracteres (máximo 80): {f.clave_estable}")
            if f.clave_estable in claves_estables:
                err.append(f"clave estable repetida: {f.clave_estable}")
            claves_estables.add(f.clave_estable)
        if f.solo_marca:  # marca de un registro preexistente: no lleva valores de negocio
            if f.id_expr is None or f.valores:
                err.append(f"{loc}: una marca (solo_marca) necesita id_expr y no lleva valores")
            continue
        # --- tabla y columnas
        if f.tabla not in ix:
            err.append(f"{loc}: la tabla no existe en el esquema")
            continue
        cols = ix[f.tabla]["cols"]
        for nombre, v in f.valores.items():
            c = cols.get(nombre)
            if c is None:
                err.append(f"{loc}: columna inexistente {nombre}")
                continue
            if c["es_calculada"]:
                err.append(f"{loc}: {nombre} es una columna calculada: no se inserta")
            if c["es_identidad"]:
                err.append(f"{loc}: {nombre} es una identidad: no se inserta")
            if v is None:
                continue
            if isinstance(v, Ref):
                if v.alias not in aliases:
                    err.append(f"{loc}.{nombre}: referencia sin resolver o posterior ({v.alias})")
            elif isinstance(v, Cat):
                clave_cat = CATALOGO_DE_TABLA.get(v.tabla)
                if v.tabla == "Roles":
                    if v.clave not in ROLES_VALIDOS:
                        err.append(f"{loc}.{nombre}: rol desconocido {v.clave}")
                elif clave_cat and v.clave not in cat_valores.get(clave_cat, set()):
                    err.append(f"{loc}.{nombre}: «{v.clave}» no está en el catálogo {v.tabla}")
            elif isinstance(v, Raw):
                pass
            elif isinstance(v, str) and c["tipo"] in ("nvarchar", "varchar", "nchar", "char"):
                n = c["longitud"]
                if n not in (-1, None) and len(v) > n:
                    err.append(f"{loc}.{nombre}: {len(v)} caracteres > {n}")
            if nombre in ix[f.tabla]["enum"] and isinstance(v, str) and v not in ix[f.tabla]["enum"][nombre]:
                err.append(f"{loc}.{nombre}: «{v}» no admitido por CHECK ({sorted(ix[f.tabla]['enum'][nombre])})")
        for nombre, c in cols.items():
            if c["obligatoria"] and nombre not in f.valores:
                err.append(f"{loc}: falta la columna obligatoria {nombre}")
            elif c["obligatoria"] and f.valores.get(nombre) is None:
                err.append(f"{loc}: columna obligatoria {nombre} en NULL")
        for nombre_ck, definicion in ix[f.tabla]["checks"]:
            if evaluar_check(definicion, f.valores, cols) is False:
                err.append(f"{loc}: viola el CHECK {nombre_ck}: {definicion[:160]}")
        # --- únicos naturales
        for uq in ix[f.tabla]["uq"]:
            if all(k in f.valores for k in uq):
                clave = tuple(repr(f.valores[k]) if not isinstance(f.valores[k], Ref) else f"@{f.valores[k].alias}" for k in uq)
                if any(f.valores[k] is None for k in uq):
                    continue
                previo = unicos[(f.tabla, tuple(uq))].get(clave)
                if previo:
                    err.append(f"{loc}: duplica el único {uq} de {previo}")
                unicos[(f.tabla, tuple(uq))][clave] = f.alias or "pivote"
        # --- territorio
        d, m = f.valores.get("CodigoDepartamento"), f.valores.get("CodigoMunicipio")
        for cd, cm in (("CodigoDepartamento", "CodigoMunicipio"), ("SedeCodigoDepartamento", "SedeCodigoMunicipio"), ("ResidenciaCodigoDepartamento", "ResidenciaCodigoMunicipio"),
                       ("CodigoDepartamentoSede", "CodigoMunicipioSede")):
            dd, mm = f.valores.get(cd), f.valores.get(cm)
            if mm and mm not in territorio.codigos_muni:
                err.append(f"{loc}: municipio {mm} no existe en DIVIPOLA")
            if dd and dd not in territorio.codigos_dep:
                err.append(f"{loc}: departamento {dd} no existe en DIVIPOLA")
            if mm and dd and mm[:2] != dd:
                err.append(f"{loc}: municipio {mm} no pertenece al departamento {dd}")
        if f.valores.get("NivelCobertura") == "municipal" and not (d and m):
            err.append(f"{loc}: cobertura municipal sin departamento y municipio")
        # --- fechas
        for a, b in PARES_DE_FECHAS:
            va, vb = f.valores.get(a), f.valores.get(b)
            if isinstance(va, (dt.date, dt.datetime)) and isinstance(vb, (dt.date, dt.datetime)) and type(va) is type(vb) and va > vb:
                err.append(f"{loc}: {a} ({va}) posterior a {b} ({vb})")
        if f.tabla in ("EdicionesFestival", "EdicionesMercado"):
            ini, fin, est = f.valores.get("FechaInicio"), f.valores.get("FechaFin"), f.valores.get("Estado")
            if est == "realizada" and fin and fin > plan.hoy:
                err.append(f"{loc}: edición realizada con fin futuro")
            if est == "programada" and ini and ini <= plan.hoy:
                err.append(f"{loc}: edición programada con inicio pasado")
            if est == "cancelada" and fin and fin > plan.hoy:
                err.append(f"{loc}: edición cancelada con fechas futuras")
        # --- estado y fechas por tabla
        if f.tabla in TABLAS_CON_ESTADO:
            est = f.valores[TABLAS_CON_ESTADO[f.tabla]]
            estado_de[f.alias] = est
            if est == "publicado" and f.tabla in ("Festivales", "Mercados", "Redes", "Talleres", "Espacios") and f.valores.get("FechaPublicacion") is None and f.tabla != "Festivales":
                err.append(f"{loc}: publicado sin FechaPublicacion")
            if f.tabla == "Noticias" and est == "publicado" and not f.valores.get("FechaPublicacion"):
                err.append(f"{loc}: noticia publicada sin fecha")
            if f.tabla == "EventosAgenda" and est == "publicado":
                mod = f.valores.get("Modalidad")
                if mod in ("presencial", "mixta") and not f.valores.get("Lugar"):
                    err.append(f"{loc}: evento {mod} publicado sin lugar")
                if mod in ("virtual", "mixta") and not f.valores.get("Url"):
                    err.append(f"{loc}: evento {mod} publicado sin enlace")
        if f.tabla == "Entidades":
            est, act = f.valores["EstadoRegistro"], f.valores["Activo"]
            if (est in ("activa", "pendiente_de_confirmacion")) != bool(act):
                err.append(f"{loc}: Activo no coincide con el estado {est}")
        if f.tabla == "RegistrosRevisionHistorial":
            hist[(f.valores["ModuloId"], f.valores["RegistroId"].alias)].append((f.valores["Fecha"], f.valores["EstadoAnterior"], f.valores["EstadoNuevo"]))
        if f.tabla == "Usuarios":
            correo = f.valores["CorreoElectronico"]
            if not correo.endswith(".test"):
                err.append(f"{loc}: correo {correo} no termina en .test")
            if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", correo):
                err.append(f"{loc}: correo mal formado")
        if f.tabla in ("Entidades", "Festivales", "Mercados", "Redes", "Talleres", "Espacios"):
            for k in ("CorreoContacto", "CorreoFestival", "CorreoMercado", "CorreoRed", "CorreoTaller", "CorreoEspacio"):
                v = f.valores.get(k)
                if v and not v.endswith(".test"):
                    err.append(f"{loc}.{k}: contacto {v} no termina en .test")
        # --- textos
        for k in COLUMNAS_TEXTO_LARGO:
            v = f.valores.get(k)
            if isinstance(v, str) and len(v) > 40:
                n = _texto_norm(v)
                if n in textos[(f.tabla, k)]:
                    err.append(f"{loc}.{k}: texto repetido de {textos[(f.tabla, k)][n]}")
                textos[(f.tabla, k)][n] = f.alias or "pivote"
        if f.nivel == 1 and f.tabla in ("Festivales", "Entidades", "Mercados") and len(str(f.valores.get("Descripcion") or "")) < 120:
            adv.append(f"{loc}: descripción corta para un registro de nivel 1")

    # --- historiales: terminan en el estado actual y crecen en el tiempo
    for (modulo, alias), pasos in hist.items():
        pasos.sort(key=lambda x: x[0])
        for a, b in zip(pasos, pasos[1:]):
            if a[2] != b[1]:
                err.append(f"historial de {alias}: salto de «{a[2]}» a «{b[1]}» (el anterior no coincide)")
        actual = estado_de.get(alias)
        if actual and pasos[-1][2] != actual:
            err.append(f"historial de {alias}: termina en «{pasos[-1][2]}» pero el registro está «{actual}»")
    # --- una organización activa tiene administrador
    admins = {f.valores["IdEntidad"].alias for f in plan.filas if f.tabla == "UsuariosEntidades" and f.valores["RolEntidad"] == "administrador"}
    for f in plan.filas:
        if f.tabla == "Entidades" and f.valores["EstadoRegistro"] == "activa" and f.alias not in admins:
            err.append(f"organización activa sin administrador: {f.alias}")
    # --- una sola reclamación activa y una sola propuesta viva por registro
    vivas = defaultdict(list)
    ACTIVAS = ("borrador", "enviada", "en_revision", "requiere_aclaracion", "aclaracion_enviada", "aprobada")
    for f in plan.filas:
        if f.tabla == "ReclamacionesAdministracion" and f.valores.get("Estado") in ACTIVAS:
            vivas[("rec", f.valores["RegistroCanonicoId"].alias)].append(f.alias)
        if f.tabla == "PropuestasDeCambio" and f.valores["Estado"] not in ("aplicada", "rechazada"):
            vivas[("prop", f.valores["RegistroId"].alias)].append(f.alias)
    for k, v in vivas.items():
        if len(v) > 1:
            err.append(f"más de una {k[0]} viva sobre {k[1]}: {v}")
    return err, adv
