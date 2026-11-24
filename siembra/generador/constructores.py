"""Constructores del plan de siembra: traducen los datos públicos y el libro sintético a filas simbólicas, en orden de dependencias.

Reglas que se cumplen aquí (y que `validaciones.py` vuelve a comprobar sobre el plan):
- estados de los CHECK/FK reales y transiciones del API (borrador → en_revision → publicado | ajustes_solicitados | rechazado; archivado);
- fechas coherentes con el estado y con la fecha de referencia del plan (`plan.hoy`); historiales crecientes y terminados en el estado actual;
- lo público solo lleva hechos citados; lo sintético, entidades inventadas; las participaciones de artistas nunca son reales;
- nada en las fichas dice «ficticio» ni «demostración»: la marca es la fila de `DatosDeDemostracion`.
"""
from __future__ import annotations

import datetime as dt
import random
import re
import unicodedata

import datos_publicos as dp
from hash_identidad import hash_identidad
from nucleo import Cat, Plan, Raw, Ref, INSTITUCIONAL, USUARIO_SISTEMA

CLAVE_DEMO = "admin"


def slug(t: str) -> str:
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:60]


def rng_de(plan: Plan, alias: str) -> random.Random:
    return random.Random(f"{plan.semilla}:{alias}")


def momento(plan: Plan, dias_atras: int, hora: int = 10, minuto: int = 0) -> dt.datetime:
    d = plan.hoy - dt.timedelta(days=dias_atras)
    return dt.datetime(d.year, d.month, d.day, hora, minuto, 0)


def dep_de(muni: str) -> str:
    return muni[:2]


class Constructor:
    def __init__(self, plan: Plan, datos: dict, territorio: dp.Territorio, libro, gestor=None, n1=(), cuentas=False):
        self.plan, self.datos, self.terr, self.libro = plan, datos, territorio, libro
        self.gestor = gestor or USUARIO_SISTEMA          # quién firma las decisiones institucionales
        self.n1 = set(n1)                                # claves del libro con nivel 1
        self.persona_id: dict = {}                       # clave → alias del usuario
        self.org_id: dict = {}                           # clave → alias de la organización
        self.persona_spec: dict = {x["clave"]: x for x in libro.PERSONAS}
        self.org_spec: dict = {o["clave"]: o for o in libro.ORGANIZACIONES}   # clave → ficha (las cuentas de validación añaden las suyas)
        self.cuentas = cuentas
        self.avisos: list = []                           # lo que se omitió y por qué (se muestra al planear)

    # ---------------------------------------------------------------- utilidades
    def nivel(self, clave: str, defecto: int, forzar=None) -> int:
        if forzar:
            return forzar[0]
        return 1 if clave in self.n1 else defecto

    @staticmethod
    def clave_est(nivel: int, tipo: str, clave: str):
        """Clave estable (solo niveles 0 y 1): lo que citan los guiones de los videos y el recorrido de aceptación."""
        return f"n{nivel}.{tipo}.{clave}" if nivel in (0, 1) else None

    def add(self, tabla, valores, alias=None, lote="", **kw):
        return self.plan.agregar(tabla, valores, alias=alias, lote=lote, **kw)

    def practicas(self, tabla_pivote: str, alias: str, slugs, lote, nivel, procedencia, modulo=None, col_registro="RegistroId", col_practica="IdPracticaMusical", texto=False, fuente=None):
        for s in slugs:
            v = {}
            if modulo:
                v["ModuloId"] = modulo
            v[col_registro] = Ref(alias, texto=texto or modulo is not None)
            v[col_practica] = Cat("PracticasMusicales", "IdPracticaMusical", "Slug", s)
            self.add(tabla_pivote, v, alias=None, lote=lote, nivel=nivel, procedencia=procedencia, fuente=fuente)

    def historial(self, alias_registro: str, modulo: str, pasos: list, org_alias, org_nombre, lote, nivel, procedencia, fuente, ref_actor_org):
        """pasos = [(estado_anterior, estado_nuevo, accion, dias_atras, comentario, motivo, actor)] con actor «org» o «gestion»."""
        for i, (ant, nuevo, accion, dias, comentario, motivo, actor) in enumerate(pasos):
            self.add("RegistrosRevisionHistorial", {
                "ModuloId": modulo, "RegistroId": Ref(alias_registro, texto=True), "EstadoAnterior": ant, "EstadoNuevo": nuevo, "Accion": accion,
                "Comentario": comentario, "MotivoRechazo": motivo, "IdUsuario": ref_actor_org if actor == "org" else self.gestor,
                "Fecha": momento(self.plan, dias, 9 + i), "OrganizacionId": Ref(org_alias) if org_alias else None, "OrganizacionNombre": org_nombre,
                "ActorNombre": None,
            }, alias=f"{alias_registro}.hist.{i + 1}", lote=lote, nivel=nivel, procedencia=procedencia, fuente=fuente)

    def historial_simple(self, alias, modulo, estado, dias, lote, nivel=3):
        """Cambios de estado de Noticias y Agenda (sin circuito propio): una fila `EstadoCambiado` por paso, firmada por la gestión."""
        camino = [("borrador", "en_revision"), ("en_revision", estado)] if estado in ("en_revision", "rechazado") else (
            [("borrador", "en_revision"), ("en_revision", "publicado")] + ([("publicado", "archivado")] if estado == "archivado" else []) if estado in ("publicado", "archivado") else [])
        for k, (ant, nuevo) in enumerate(camino):
            if ant == nuevo:
                continue
            self.add("RegistrosRevisionHistorial", {"ModuloId": modulo, "RegistroId": Ref(alias, texto=True), "EstadoAnterior": ant, "EstadoNuevo": nuevo, "Accion": "EstadoCambiado",
                                                    "MotivoRechazo": "No cumple el criterio editorial; puede corregirse y volver a enviarse." if nuevo == "rechazado" else None,
                                                    "IdUsuario": self.gestor, "Fecha": momento(self.plan, max(dias - 2 * k, 1), 9 + k)}, alias=f"{alias}.hist.{k + 1}", lote=lote, nivel=nivel, procedencia="sintetico")

    @staticmethod
    def pasos_de(estado: str, dias_inicio: int) -> list:
        """Recorrido que lleva al estado actual, con fechas crecientes (dias_inicio = hace cuántos días nació)."""
        d = dias_inicio
        alta = (None, "borrador", "Alta", d, None, None, "org")
        envio = ("borrador", "en_revision", "EnviadoARevision", max(d - 3, 1), None, None, "org")
        tabla = {
            "borrador": [alta],
            "en_revision": [alta, envio],
            "publicado": [alta, envio, ("en_revision", "publicado", "Publicado", max(d - 6, 1), "Cumple los criterios de la ficha.", None, "gestion")],
            "ajustes_solicitados": [alta, envio, ("en_revision", "ajustes_solicitados", "EstadoCambiado", max(d - 6, 1),
                                                  "Falta confirmar la sede y las fechas; complete esos campos y vuelva a enviar.", None, "gestion")],
            "rechazado": [alta, envio, ("en_revision", "rechazado", "RechazadoEnRevision", max(d - 6, 1), None,
                                        "La ficha no describe un proceso musical de alcance territorial; puede presentar otra con más detalle.", "gestion")],
            "archivado": [alta, envio, ("en_revision", "publicado", "Publicado", max(d - 6, 1), None, None, "gestion"),
                          ("publicado", "archivado", "Archivado", max(d - 12, 1), "Archivado por la organización: el proceso se pausó.", None, "org")],
        }
        return tabla[estado]

    def fechas_estado(self, estado: str, dias_inicio: int) -> dict:
        """Columnas de fecha de un proceso simple según su estado (FechaEnvioARevision, FechaPublicacion, FechaArchivado)."""
        pasos = self.pasos_de(estado, dias_inicio)
        out = {"FechaCreacion": momento(self.plan, dias_inicio)}
        for _, nuevo, _, d, _, _, _ in pasos:
            if nuevo == "en_revision":
                out["FechaEnvioARevision"] = momento(self.plan, d)
            if nuevo == "publicado":
                out["FechaPublicacion"] = momento(self.plan, d)
            if nuevo == "archivado":
                out["FechaArchivado"] = momento(self.plan, d)
        return out

    # ---------------------------------------------------------------- personas
    def personas(self, lote="n2-personas", items=None, base=0):
        """`items` permite sembrar personas de otro libro temático; `base` desplaza la numeración de teléfonos y documentos para no chocar."""
        for i, pe in enumerate(items if items is not None else self.libro.PERSONAS):
            self.persona_spec[pe["clave"]] = pe
            clave = pe["clave"]
            alias = f"persona.{clave}"
            self.persona_id[clave] = alias
            n1, n2, ap = pe["nombre"][0], pe["nombre"][1], pe["nombre"][2]
            primer = n1.split()[0]
            correo = f"{slug(primer)}.{slug(n2)}@correo.test"
            nivel = self.nivel(clave, 2)
            meta = dict(lote=lote, nivel=nivel, procedencia="sintetico", clave_estable=f"n1.persona.{clave}" if nivel == 1 else None)
            dep, muni = dep_de(pe["muni"]), pe["muni"]
            self.add("Usuarios", {
                "NombreCompleto": f"{n1} {n2} {ap}", "CorreoElectronico": correo, "HashContrasena": hash_identidad(CLAVE_DEMO, correo), "CanalAcceso": "externo",
                "TipoPerfil": "individual", "Activo": True, "FechaCreacion": momento(self.plan, 400 - 17 * i), "Telefono": f"+57 300 555 {1000 + (i + base) * 7:04d}",
                "Identificacion": f"DEMO-{i + 1 + base:04d}", "CodigoTipoDocumento": pe["doc"], "CorreoConfirmado": True, "FechaConfirmacionCorreo": momento(self.plan, 399 - 17 * i),
                "PrimerNombre": primer, "SegundoNombre": " ".join(n1.split()[1:]) or None, "PrimerApellido": n2, "SegundoApellido": ap,
                "DebeCambiarContrasena": False, "PerfilCompletado": True, "ResidenciaCodigoDepartamento": dep, "ResidenciaCodigoMunicipio": muni,
                "CanalDeContactoPreferido": "correo",
            }, alias=alias, **meta)
            self.add("UsuariosRoles", {"IdUsuario": Ref(alias), "IdRol": Cat("Roles", "IdRol", "NombreRol", "externo")}, **{**meta, "clave_estable": None})
            self.add("PerfilesPublicos", {
                "IdUsuario": Ref(alias), "NombreVisible": f"{n1} {n2}", "CodigoMunicipio": muni, "FechaCreacion": momento(self.plan, 395 - 17 * i), "FechaActualizacion": momento(self.plan, 20 + i),
                "NombreCivilVisible": True, "BiografiaCorta": pe["corta"], "BiografiaLarga": pe["larga"], "Visibilidad": "publico",
            }, alias=f"{alias}.perfil", id_expr=Ref(alias), **{**meta, "clave_estable": None})

    # ---------------------------------------------------------------- organizaciones
    def organizaciones(self, lote="n2-organizaciones", items=None, forzar=None, base=0):
        lote = forzar[1] if forzar else lote
        for i, o in enumerate(items if items is not None else self.libro.ORGANIZACIONES):
            self.org_spec[o["clave"]] = o
            clave = o["clave"]
            alias = f"org.{clave}"
            self.org_id[clave] = alias
            admin = Ref(self.persona_id[o["admin"]])
            nivel = self.nivel(clave, 2, forzar)
            estado = o["estado"]
            activo = estado in ("activa", "pendiente_de_confirmacion")
            dias = o.get("dias", 330 - 21 * i)
            meta = dict(lote=lote, nivel=nivel, procedencia="sintetico", clave_estable=self.clave_est(nivel, "organizacion", clave))
            correo = f"contacto@{slug(clave)}.test"
            vals = {
                "TipoEntidad": "organizacion", "Nombre": o["nombre"], "NombreLegal": o["nombre"], "Descripcion": o["desc"], "CorreoContacto": correo,
                "TelefonoContacto": f"+57 601 555 {2000 + (i + base) * 11:04d}", "SitioWeb": f"https://{slug(clave)}.test", "Instagram": f"https://instagram.com/{slug(clave)}.test",
                "Direccion": None, "EstadoRegistro": estado, "Activo": activo, "IdUsuarioCreador": admin, "IdUsuarioResponsable": admin,
                "FechaCreacion": momento(self.plan, dias), "FechaActualizacion": momento(self.plan, max(dias - 40, 0)), "EsInstitucional": False,
                "CodigoDepartamentoSede": dep_de(o["muni"]), "CodigoMunicipioSede": o["muni"],
            }
            if estado == "activa":
                vals.update(FechaRevision=momento(self.plan, dias - 3), FechaAprobacion=momento(self.plan, dias - 4), FechaPublicacion=momento(self.plan, dias - 4))
            self.add("Entidades", vals, alias=alias, **meta)
            self.add("UsuariosEntidades", {"IdUsuario": admin, "IdEntidad": Ref(alias), "RolEntidad": "administrador", "Activo": True, "FechaCreacion": momento(self.plan, dias)}, **{**meta, "clave_estable": None})
            for editor in ([o["editor"]] if isinstance(o.get("editor"), str) else (o.get("editor") or [])):
                self.add("UsuariosEntidades", {"IdUsuario": Ref(self.persona_id[editor]), "IdEntidad": Ref(alias), "RolEntidad": "editor", "Activo": True,
                                              "FechaCreacion": momento(self.plan, dias - 20)}, **{**meta, "clave_estable": None})
            pe = self.persona_spec[o["admin"]]
            self.add("EntidadesResponsable", {
                "IdEntidad": Ref(alias), "ResponsableNombre": " ".join(pe["nombre"]), "ResponsableTipoDocumento": pe["doc"], "ResponsableNumeroDocumento": f"DEMO-R{i + 1 + base:03d}",
                "ResponsableCorreo": f"{slug(pe['nombre'][0].split()[0])}.{slug(pe['nombre'][1])}@correo.test", "ResponsableAutorizacionDatos": True,
                "ResponsableDesde": momento(self.plan, dias), "ResponsablePrimerNombre": pe["nombre"][0].split()[0], "ResponsablePrimerApellido": pe["nombre"][1],
            }, alias=None, **{**meta, "clave_estable": None})

    # ---------------------------------------------------------------- festivales
    def _municipio_publico(self, nombre, depto):
        d, m = self.terr.municipio(nombre, depto)
        return d, m

    def festivales_publicos(self, max_ediciones=6, lote_n1="n1-festivales", lote_hist="n3-festivales-historicos", reclamado=None, reales=None):
        """Festivales reales como HISTÓRICOS publicados, administrados por la entidad institucional (nadie reclama aún).
        `reclamado = {n: clave_org}`: el n-ésimo histórico (desde 0) ya fue reclamado y lo administra esa organización.
        `reales = {slug: spec}` (libro temático de festivales): fuerza el nivel 1 y enriquece con hechos citados; spec admite `descripcion`, `practicas`,
        `territorio`, `max_ediciones` (None = todas), `excluir` (años que no son ediciones), `numeros` ({año: n.º de edición}), `numero_ediciones`, `periodicidad`, `realizadas` (años sin fecha exacta que ya ocurrieron)."""
        self.historicos_libres: list = []
        self.historico_reclamado = None
        n_hist = -1
        for f in self.datos["festivales"]:
            d, m = self._municipio_publico(f["municipio"], f["departamento"])
            if not m:
                self.avisos.append(f"festival público omitido (municipio sin resolver): {f['nombre']} / {f['municipio']}, {f['departamento']}")
                continue
            clave = slug(f["nombre"])
            alias = f"festival.{clave}"
            fuentes = [u.strip() for u in re.split(r"\|", ";".join(f.get("fuentes", [])) if isinstance(f.get("fuentes"), list) else f.get("fuentes", "")) if u.strip()]
            fuente = (fuentes[0] if fuentes else "https://es.wikipedia.org/wiki/Anexo:Festivales_en_Colombia")[:500]
            spec = (reales or {}).get(clave)
            eds = sorted([e for e in f.get("ediciones_historicas", []) if isinstance(e["anio"], int) and e["anio"] not in (spec or {}).get("excluir", ())], key=lambda e: e["anio"])
            tope = spec["max_ediciones"] if spec and "max_ediciones" in spec else max_ediciones
            eds = eds[-tope:] if tope else eds
            profundo = bool(spec) or (f["certeza"] == "alto" and len(eds) >= 3)
            nivel = 1 if profundo else 3
            lote = lote_n1 if profundo else lote_hist
            meta = dict(lote=lote, nivel=nivel, procedencia="publico", fuente=fuente)
            responsable = INSTITUCIONAL
            if not profundo:
                n_hist += 1
                if reclamado and n_hist in reclamado:
                    responsable = Ref(self.org_id[reclamado[n_hist]])
                    self.historico_reclamado = (alias, reclamado[n_hist])
                else:
                    self.historicos_libres.append(alias)
            periodicidad = next((c for k, c in (("bianual", "bianual"), ("bienal", "bienal"), ("anual", "anual"), ("semestral", "semestral")) if k in (f.get("periodicidad_epoca") or "").lower()), None)
            dias = 700 - len(clave) % 17 * 3
            ult = max([e["anio"] for e in eds], default=None)
            self.add("Festivales", {
                "NombreFestival": f["nombre"], "NumeroEdiciones": spec.get("numero_ediciones") if spec else (len(f.get("ediciones_historicas", [])) or None),
                "Descripcion": spec["descripcion"] if spec else f["descripcion"], "Organizador": f.get("entidad_organizadora") or None,
                "SitioWebFestival": f.get("sitio_web") or None, "TieneEdicionVigenteAnoActual": bool(ult and ult >= self.plan.hoy.year), "NivelCobertura": "municipal",
                "CodigoDepartamento": d, "CodigoMunicipio": m, "EstadoRegistro": "publicado", "FechaCreacion": momento(self.plan, dias), "FechaActualizacion": momento(self.plan, dias - 30),
                "OrganizacionPrincipalId": responsable, "Periodicidad": (spec or {}).get("periodicidad", periodicidad), "PeriodicidadDetalle": (f.get("periodicidad_epoca") or None) and f["periodicidad_epoca"][:600],
                "SedeCodigoDepartamento": d, "SedeCodigoMunicipio": m,
            }, alias=alias, clave_estable=f"n1.festival.{clave}" if nivel == 1 else None, **meta)
            self.practicas("PracticasMusicalesDeRegistro", alias, (spec or {}).get("practicas") or dp.practicas_de(f.get("practicas", "")), lote, nivel, "publico", modulo="festivales", fuente=fuente)
            if spec and spec.get("territorio"):
                self.add("TerritoriosSonorosDeRegistro", {"ModuloId": "festivales", "RegistroId": Ref(alias, texto=True), "IdTerritorioSonoro": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", spec["territorio"])},
                         alias=None, **meta)
            if spec:   # las fuentes consultadas quedan visibles como materiales de la ficha
                for k, u in enumerate(fuentes, 1):
                    self.add("ArchivosDeRegistro", {"ModuloId": "festivales", "RegistroId": Ref(alias, texto=True), "Url": u[:1000], "RolArchivo": "material",
                                                    "DescripcionArchivo": "Fuente consultada para los datos históricos de esta ficha.", "OrdenVisualizacion": k}, alias=None, **meta)
            self.add("RegistrosRevisionHistorial", {
                "ModuloId": "festivales", "RegistroId": Ref(alias, texto=True), "EstadoAnterior": None, "EstadoNuevo": "publicado", "Accion": "Alta", "Comentario": "Registro histórico publicado al cargarse.",
                "IdUsuario": self.gestor, "Fecha": momento(self.plan, dias),
            }, alias=f"{alias}.hist.1", **meta)
            for e in eds:
                ini, fin = dp.parse_fecha(e["anio"], e.get("fecha", ""))
                futura = (ini or dt.date(e["anio"], 12, 31)) > self.plan.hoy and not (spec and e["anio"] in spec.get("realizadas", ()))
                estado = "programada" if futura else "realizada"
                hecho = (e.get("hecho") or "").strip()
                sede = (e.get("sede") or "").strip()
                desc = " ".join(x for x in (f"Edición {e['anio']} de {f['nombre']}.", f"Sede: {sede}." if sede else "", hecho + ("." if hecho and not hecho.endswith(".") else "")) if x) or None
                self.add("EdicionesFestival", {
                    "FestivalId": Ref(alias), "Anio": e["anio"], "Nombre": f"{f['nombre']} {e['anio']}", "Descripcion": desc, "FechaInicio": ini, "FechaFin": fin, "Estado": estado,
                    "FechaCreacion": momento(self.plan, dias), "EstadoRegistro": "publicado", "EstadoVisibilidad": "publicada",
                    "NumeroEdicion": ((spec or {}).get("numeros") or {}).get(e["anio"]),
                }, alias=f"{alias}.edicion.{e['anio']}", lote=lote, nivel=nivel, procedencia="publico", fuente=(e.get("fuente") or fuente)[:500],
                    clave_estable=f"n1.edicion.{clave}-{e['anio']}" if nivel == 1 else None)

    def _fecha_edicion(self, rng, anio, estado):
        """Fechas coherentes con el estado: realizada/cancelada en el pasado, programada futura, en_preparacion futura o sin fecha."""
        mes = rng.choice([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
        dia = rng.randint(3, 22)
        ini = dt.date(anio, mes, dia)
        fin = ini + dt.timedelta(days=rng.choice([0, 1, 2, 2, 3]))
        if estado in ("realizada", "cancelada") and fin >= self.plan.hoy:
            ini, fin = dt.date(self.plan.hoy.year - 1, mes, dia), dt.date(self.plan.hoy.year - 1, mes, dia) + (fin - ini)
        if estado in ("programada", "en_preparacion") and ini <= self.plan.hoy:
            ini = dt.date(self.plan.hoy.year + 1, mes, dia)
            fin = ini + dt.timedelta(days=2)
        if estado == "en_preparacion" and rng.random() < 0.4:
            return None, None
        return ini, fin

    PLANTILLAS_EDICION = [
        "{n}.ª edición de {nombre}: {act} en {lugar}, con {a} agrupaciones invitadas y {t} talleres abiertos.",
        "Para {anio}, {nombre} reúne a {a} agrupaciones en {lugar}; la programación combina {act} y jornadas de formación con maestros de la región.",
        "{nombre} vuelve a {lugar} en {anio} con {act}; participan {a} agrupaciones y se mantiene la entrada libre a los talleres.",
        "La edición de {anio} de {nombre} se concentra en {act}, con {a} agrupaciones y un encuentro de maestros en {lugar}.",
    ]
    ACTIVIDADES = ["conciertos nocturnos y muestras de instrumentos", "una ruta de presentaciones por los barrios", "rondas de cantos y un conversatorio de maestros", "clínicas de instrumentos y conciertos de cierre", "una feria de lutería y presentaciones de escuelas"]

    def festivales_sinteticos(self, lote="n2-festivales", items=None, forzar=None):
        lote = forzar[1] if forzar else lote
        for fe in (items if items is not None else self.libro.FESTIVALES):
            clave = fe["clave"]
            alias = f"festival.{clave}"
            org_alias = self.org_id[fe["org"]]
            org = self.org_spec[fe["org"]]
            admin = Ref(self.persona_id[org["admin"]])
            nivel = self.nivel(clave, 2, forzar)
            rng = rng_de(self.plan, alias)
            estado = fe["estado"]
            dias = 300 - rng.randint(0, 120)
            meta = dict(lote=lote, nivel=nivel, procedencia="sintetico")
            f_est = self.fechas_estado(estado, dias)
            d, m = dep_de(fe["muni"]), fe["muni"]
            anios = [a for a, _ in fe["ediciones"]]
            self.add("Festivales", {
                "NombreFestival": fe["nombre"], "NumeroEdiciones": len(fe["ediciones"]) or None, "Descripcion": fe["desc"], "Organizador": org["nombre"],
                "CorreoFestival": f"info@{slug(clave)}.test", "SitioWebFestival": f"https://{slug(clave)}.test", "TieneEdicionVigenteAnoActual": any(a >= self.plan.hoy.year for a in anios),
                "NivelCobertura": "municipal", "CodigoDepartamento": d, "CodigoMunicipio": m, "EstadoRegistro": estado, "FechaCreacion": f_est["FechaCreacion"],
                "FechaActualizacion": momento(self.plan, max(dias - 25, 1)), "OrganizacionPrincipalId": Ref(org_alias), "Periodicidad": fe["periodicidad"],
                "SedeCodigoDepartamento": d, "SedeCodigoMunicipio": m, "Director": fe["director"],
            }, alias=alias, clave_estable=self.clave_est(nivel, "festival", clave), **meta)
            self.practicas("PracticasMusicalesDeRegistro", alias, fe["practicas"], lote, nivel, "sintetico", modulo="festivales")
            if fe["territorio"]:
                self.add("TerritoriosSonorosDeRegistro", {"ModuloId": "festivales", "RegistroId": Ref(alias, texto=True), "IdTerritorioSonoro": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", fe["territorio"])},
                         alias=None, **meta)
            self.historial(alias, "festivales", self.pasos_de(estado, dias), org_alias, org["nombre"], lote, nivel, "sintetico", None, admin)
            if estado in ("en_revision", "publicado", "ajustes_solicitados", "rechazado", "archivado"):
                self.add("EnviosDeRevision", {"NumeroEnvio": 1, "IdUsuarioRemitente": admin, "IdOrganizacion": Ref(org_alias), "EstadoAnterior": "borrador",
                                              "DatosJson": {"nombre": fe["nombre"], "municipio": m, "estado": "en_revision"}, "FechaEnvio": momento(self.plan, max(dias - 3, 1)),
                                              "ModuloId": "festivales", "RegistroId": Ref(alias, texto=True)}, alias=f"{alias}.envio.1", **meta)
            for k, (anio, est_ed) in enumerate(fe["ediciones"]):
                ini, fin = getattr(self, "fechas_fijas", {}).get((alias, anio)) or self._fecha_edicion(rng_de(self.plan, f"{alias}.{anio}"), anio, est_ed)
                r2 = rng_de(self.plan, f"{alias}.{anio}.txt")
                lugar = r2.choice(["el parque central", "la casa de la cultura", "un teatro municipal", "varios barrios", "la plaza principal"])
                if est_ed == "cancelada":
                    desc = f"La edición de {anio} de {fe['nombre']} se canceló antes de abrirse la programación; la organización informó el cambio de sede y la reprogramación para un próximo año."
                else:
                    desc = r2.choice(self.PLANTILLAS_EDICION).format(n=k + 1, nombre=fe["nombre"], anio=anio, act=r2.choice(self.ACTIVIDADES), lugar=lugar, a=r2.randint(8, 24), t=r2.randint(2, 6))
                if estado == "publicado":
                    reg, vis = "publicado", "publicada"
                elif estado == "archivado":
                    reg, vis = "archivado", "archivada"
                elif estado == "en_revision":
                    reg, vis = "en_revision", "borrador"
                elif estado == "ajustes_solicitados":
                    reg, vis = "ajustes_solicitados", "borrador"
                else:
                    reg, vis = "borrador", "borrador"
                self.add("EdicionesFestival", {
                    "FestivalId": Ref(alias), "Anio": anio, "NumeroEdicion": k + 1, "Nombre": f"{fe['nombre']} {anio}", "Descripcion": desc, "FechaInicio": ini, "FechaFin": fin, "Estado": est_ed,
                    "FechaCreacion": momento(self.plan, dias), "Director": fe["director"], "EstadoRegistro": reg, "EstadoVisibilidad": vis,
                }, alias=f"{alias}.edicion.{anio}", lote=lote, nivel=nivel, procedencia="sintetico", clave_estable=self.clave_est(nivel, "edicion", f"{clave}-{anio}"))

    # ---------------------------------------------------------------- mercados
    def mercados(self, lote_pub="n1-mercados", lote_sint="n2-mercados", items=None, forzar=None, solo_sinteticos=False, reales=None):
        lote_sint = forzar[1] if forzar else lote_sint
        for mk in ([] if solo_sinteticos else self.datos["mercados"]):
            d, m = self._municipio_publico(re.sub(r"\(.*?\)", "", mk["municipio"]), mk["departamento"] or "")
            if not m:
                self.avisos.append(f"mercado público omitido (municipio sin resolver): {mk['nombre']} / {mk['municipio']}")
                continue
            clave = slug(mk["nombre"])
            alias = f"mercado.{clave}"
            fuentes = mk.get("fuentes") or []
            fuente = (fuentes[0] if fuentes else "https://www.circulart.org")[:500]
            spec = (reales or {}).get(clave)
            nivel = 1 if spec or (mk["certeza"] == "alto" and mk.get("ediciones_historicas")) else 3
            meta = dict(lote=lote_pub, nivel=nivel, procedencia="publico", fuente=fuente)
            dias = 650
            self.add("Mercados", {
                "NombreMercado": mk["nombre"], "Descripcion": spec["descripcion"] if spec else mk["descripcion"], "SitioWebMercado": mk.get("sitio_web") or None, "NivelCobertura": "municipal", "CodigoDepartamento": d,
                "CodigoMunicipio": m, "SeRealizaEnElMarcoDeUnFestival": False, "OrganizacionPrincipalId": INSTITUCIONAL, "EstadoRegistro": "publicado", "Activo": True,
                "FechaCreacion": momento(self.plan, dias), "FechaPublicacion": momento(self.plan, dias - 4), "FechaEnvioARevision": momento(self.plan, dias - 1),
                "SedeCodigoDepartamento": d, "SedeCodigoMunicipio": m, "PeriodicidadDetalle": (mk.get("periodicidad_epoca") or None) and mk["periodicidad_epoca"][:240],
            }, alias=alias, clave_estable=f"n1.mercado.{clave}" if nivel == 1 else None, **meta)
            self.add("RegistrosRevisionHistorial", {"ModuloId": "mercados", "RegistroId": Ref(alias, texto=True), "EstadoAnterior": None, "EstadoNuevo": "publicado", "Accion": "Alta",
                                                    "Comentario": "Registro histórico publicado al cargarse.", "IdUsuario": self.gestor, "Fecha": momento(self.plan, dias)}, alias=f"{alias}.hist.1", **meta)
            if spec:
                for p in spec.get("practicas", ()):
                    self.add("MercadosPracticasMusicales", {"MercadoId": Ref(alias), "PracticaMusicalId": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", p)}, alias=None, **meta)
                for t in spec.get("territorios", ()):
                    self.add("MercadosTerritoriosSonoros", {"MercadoId": Ref(alias), "TerritorioSonoroId": Cat("TerritoriosSonoros", "IdTerritorioSonoro", "Slug", t)}, alias=None, **meta)
            for e in sorted([e for e in mk.get("ediciones_historicas", []) if isinstance(e["anio"], int) and e["anio"] not in (spec or {}).get("excluir", ())], key=lambda e: e["anio"]):
                ini, fin = dp.parse_fecha(e["anio"], e.get("fecha", ""))
                futura = (ini or dt.date(e["anio"], 12, 31)) > self.plan.hoy and not (spec and e["anio"] in spec.get("realizadas", ()))
                hecho = (e.get("hecho") or "").strip()
                self.add("EdicionesMercado", {
                    "MercadoId": Ref(alias), "Anio": e["anio"], "Nombre": f"{mk['nombre']} {e['anio']}", "Descripcion": hecho or None, "FechaInicio": ini, "FechaFin": fin, "CodigoDepartamento": d, "CodigoMunicipio": m,
                    "LugarEspecifico": (e.get("sede") or None) and e["sede"][:300], "Estado": "programada" if futura else "realizada", "EstadoVisibilidad": "publicado",
                    "FechaCreacion": momento(self.plan, dias), "FechaPublicacion": momento(self.plan, dias - 4), "NumeroEdicion": ((spec or {}).get("numeros") or {}).get(e["anio"]),
                }, alias=f"{alias}.edicion.{e['anio']}", lote=lote_pub, nivel=nivel, procedencia="publico", fuente=(e.get("fuente") or fuente)[:500],
                    clave_estable=f"n1.edicion.{clave}-{e['anio']}" if nivel == 1 else None)
        for mk in (items if items is not None else self.libro.MERCADOS):
            clave = mk["clave"]
            alias = f"mercado.{clave}"
            org = self.org_spec[mk["org"]]
            admin = Ref(self.persona_id[org["admin"]])
            estado = mk["estado"]
            rng = rng_de(self.plan, alias)
            dias = 260 - rng.randint(0, 80)
            f_est = self.fechas_estado(estado, dias)
            nivel = self.nivel(clave, 2, forzar)
            meta = dict(lote=lote_sint, nivel=nivel, procedencia="sintetico")
            d, m = dep_de(mk["muni"]), mk["muni"]
            vals = {"NombreMercado": mk["nombre"], "Descripcion": mk["desc"], "AlcanceMercadoId": Cat("AlcancesMercado", "IdAlcanceMercado", "Slug", mk["alcance"]),
                    "ModalidadMercadoId": Cat("ModalidadesMercado", "IdModalidadMercado", "Slug", mk["modalidad"]), "Periodicidad": "anual", "CorreoMercado": f"mercado@{slug(clave)}.test",
                    "SitioWebMercado": f"https://{slug(clave)}.test", "NivelCobertura": "municipal", "CodigoDepartamento": d, "CodigoMunicipio": m, "SeRealizaEnElMarcoDeUnFestival": False,
                    "OrganizacionPrincipalId": Ref(self.org_id[mk["org"]]), "EstadoRegistro": estado, "Activo": True, "IdUsuarioCreador": admin, "SedeCodigoDepartamento": d, "SedeCodigoMunicipio": m}
            vals.update({k: v for k, v in f_est.items() if k in ("FechaCreacion", "FechaEnvioARevision", "FechaPublicacion", "FechaArchivado")})
            self.add("Mercados", vals, alias=alias, clave_estable=self.clave_est(nivel, "mercado", clave), **meta)
            self.historial(alias, "mercados", self.pasos_de(estado, dias), self.org_id[mk["org"]], org["nombre"], lote_sint, nivel, "sintetico", None, admin)
            for anio, est_ed in mk["ediciones"]:
                ini, fin = getattr(self, "fechas_fijas", {}).get((alias, anio)) or self._fecha_edicion(rng_de(self.plan, f"{alias}.{anio}"), anio, est_ed)
                pub = estado == "publicado"
                self.add("EdicionesMercado", {
                    "MercadoId": Ref(alias), "Anio": anio, "Nombre": f"{mk['nombre']} {anio}", "Descripcion": f"Edición {anio} de {mk['nombre']}: {rng_de(self.plan, f'{alias}.{anio}.t').choice(self.ACTIVIDADES)}.",
                    "FechaInicio": ini, "FechaFin": fin, "CodigoDepartamento": d, "CodigoMunicipio": m, "Estado": est_ed, "EstadoVisibilidad": "publicado" if pub else "borrador", "IdUsuarioCreador": admin,
                    "FechaCreacion": momento(self.plan, dias), "FechaPublicacion": momento(self.plan, max(dias - 6, 1)) if pub else None,
                }, alias=f"{alias}.edicion.{anio}", lote=lote_sint, nivel=nivel, procedencia="sintetico", clave_estable=self.clave_est(nivel, "edicion", f"{clave}-{anio}"))

    # ---------------------------------------------------------------- redes, talleres y espacios
    def _simple(self, tabla, modulo, pk_col, items, nombre_col, extra, pivote_practica, col_pivote_id, lote, forzar=None):
        lote = forzar[1] if forzar else lote
        for it in items:
            clave = it["clave"]
            alias = f"{modulo}.{clave}"
            org = self.org_spec[it["org"]]
            admin = Ref(self.persona_id[org["admin"]])
            estado = it["estado"]
            rng = rng_de(self.plan, alias)
            dias = 240 - rng.randint(0, 90)
            nivel = self.nivel(clave, 3, forzar)
            d, m = dep_de(it["muni"]), it["muni"]
            vals = {nombre_col: it["nombre"], "Descripcion": it["desc"], "NivelCobertura": "municipal", "CodigoDepartamento": d, "CodigoMunicipio": m,
                    "OrganizacionPrincipalId": Ref(self.org_id[it["org"]]), "EstadoRegistro": estado, "Activo": True, "IdUsuarioCreador": admin,
                    "SedeCodigoDepartamento": d, "SedeCodigoMunicipio": m}
            vals.update(extra(it))
            vals.update({k: v for k, v in self.fechas_estado(estado, dias).items() if k in ("FechaCreacion", "FechaEnvioARevision", "FechaPublicacion", "FechaArchivado")})
            if estado in ("ajustes_solicitados", "rechazado"):
                vals["MotivoDeLaDecision"] = "Complete la descripción con el alcance real del proceso y vuelva a enviar." if estado == "ajustes_solicitados" else "La ficha no corresponde al alcance del módulo."
            self.add(tabla, vals, alias=alias, lote=lote, nivel=nivel, procedencia="sintetico", clave_estable=self.clave_est(nivel, {"redes": "red", "talleres": "taller", "espacios": "espacio"}[modulo], clave))
            self.historial(alias, modulo, self.pasos_de(estado, dias), self.org_id[it["org"]], org["nombre"], lote, nivel, "sintetico", None, admin)
            if pivote_practica:
                for s in it.get("practicas", ["musicas-populares-tradicionales-regionales-y-patrimoniales"]):
                    self.add(pivote_practica, {col_pivote_id: Ref(alias), "PracticaMusicalId": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", s)}, alias=None, lote=lote, nivel=nivel, procedencia="sintetico")

    def redes_talleres_espacios(self, redes=None, talleres=None, espacios=None, forzar=None):
        self._simple("Redes", "redes", "IdRed", redes if redes is not None else self.libro.REDES, "NombreRed", lambda it: {"TipoDeNodo": it["tipo"], "AccesoAbierto": True, "CorreoRed": f"red@{slug(it['clave'])}.test"}, "RedesPracticasMusicales", "RedId", "n2-redes", forzar)
        self._simple("Talleres", "talleres", "IdTaller", talleres if talleres is not None else self.libro.TALLERES, "NombreTaller", lambda it: {"Modalidad": it["modalidad"], "RecibeAprendices": True, "CorreoTaller": f"taller@{slug(it['clave'])}.test"}, "TalleresPracticasMusicales", "TallerId", "n2-talleres", forzar)
        self._simple("Espacios", "espacios", "IdEspacio", espacios if espacios is not None else self.libro.ESPACIOS, "NombreEspacio", lambda it: {"Ambiente": it["ambiente"], "AforoMaximo": it["aforo"], "EsAccesible": True, "CorreoEspacio": f"espacio@{slug(it['clave'])}.test"}, "EspaciosPracticasMusicales", "EspacioId", "n2-espacios", forzar)

    # ---------------------------------------------------------------- agenda y noticias
    def eventos(self, lote="n2-agenda"):
        for i, (titulo, cat, modalidad, muni, lugar, desfase, dias_dur, estado) in enumerate(self.libro.EVENTOS):
            alias = f"evento.{slug(titulo)}"
            inicio = self.plan.hoy + dt.timedelta(days=desfase)
            fin = inicio + dt.timedelta(days=dias_dur) if dias_dur else None
            url = f"https://{slug(titulo)[:30]}.test/inscripcion" if modalidad in ("virtual", "mixta") else None
            pub = estado == "publicado"
            self.add("EventosAgenda", {
                "Slug": slug(titulo), "Titulo": titulo, "Descripcion": f"{titulo}. Una cita abierta al público en {lugar or 'línea'}, con entrada libre hasta completar el cupo.",
                "FechaInicio": inicio, "FechaFin": fin, "HoraInicio": dt.time(18, 0) if i % 2 else dt.time(10, 0), "HoraFin": dt.time(21, 0) if i % 2 else dt.time(13, 0), "Modalidad": modalidad,
                "Lugar": lugar, "CodigoDepartamento": dep_de(muni), "CodigoMunicipio": muni, "Url": url, "Estado": estado, "FechaCreacion": momento(self.plan, 60 + i), "FechaActualizacion": momento(self.plan, 30 + i),
                "Organizador": None, "DescripcionLarga": f"{titulo}: encuentro pensado para personas interesadas en las músicas de la región. Habrá presentaciones, espacio para preguntas y un momento de intercambio con quienes organizan.",
                "NivelCobertura": "municipal", "CategoriaId": Cat("Categorias", "IdCategoria", "Slug", cat, "CodigoModulo = N'agenda'"),
            }, alias=alias, lote=lote, nivel=3, procedencia="sintetico")
            self.historial_simple(alias, "agenda", estado, 40 + i, lote)
            self.add("EventosAgendaPracticasMusicales", {"EventoAgendaId": Ref(alias), "PracticaMusicalId": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", "musicas-populares-tradicionales-regionales-y-patrimoniales")},
                     alias=None, lote=lote, nivel=3, procedencia="sintetico")

    def noticias(self, lote="n2-noticias"):
        for i, (titulo, cat, resumen, cuerpo, estado) in enumerate(self.libro.NOTICIAS):
            alias = f"noticia.{slug(titulo)}"
            fecha_pub = (self.plan.hoy - dt.timedelta(days=15 + 23 * i)) if estado in ("publicado", "archivado") else None
            self.add("Noticias", {"Slug": slug(titulo), "Titulo": titulo, "Resumen": resumen, "Cuerpo": cuerpo, "FechaPublicacion": fecha_pub, "AutoriaNombre": "Equipo editorial", "Estado": estado,
                                  "FechaCreacion": momento(self.plan, 20 + 23 * i), "FechaActualizacion": momento(self.plan, 10 + 23 * i), "CategoriaId": Cat("Categorias", "IdCategoria", "Slug", cat, "CodigoModulo = N'noticias'")},
                     alias=alias, lote=lote, nivel=3, procedencia="sintetico")
            self.historial_simple(alias, "noticias", estado, 30 + 23 * i, lote)
            self.add("NoticiasPracticasMusicales", {"NoticiaId": Ref(alias), "PracticaMusicalId": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", "musicas-populares-tradicionales-regionales-y-patrimoniales")},
                     alias=None, lote=lote, nivel=3, procedencia="sintetico")

    # ---------------------------------------------------------------- invitaciones y notificaciones
    def invitaciones_y_notificaciones(self, lote="n2-equipos"):
        casos = [("fund-voces-del-llano", "pendiente", "administrador", 6, 24), ("corp-raiz-y-tambor", "aceptada", "editor", 40, -10), ("colectivo-sonidos-del-sur", "vencida", "editor", 80, 60),
                 ("asoc-bullerengue-vivo", "revocada", "editor", 35, 20)]
        import hashlib
        for i, (org, estado, rol, dias_emision, vence_en) in enumerate(casos):
            o = next(x for x in self.libro.ORGANIZACIONES if x["clave"] == org)
            admin = Ref(self.persona_id[o["admin"]])
            alias = f"invitacion.{org}.{estado}"
            emision = momento(self.plan, dias_emision)
            exp = emision + dt.timedelta(days=14)
            cierre = None if estado == "pendiente" else (exp if estado == "vencida" else emision + dt.timedelta(days=3))
            if estado == "pendiente":
                exp = momento(self.plan, -8)  # vence en el futuro
            vals = {"IdEntidad": Ref(self.org_id[org]), "CorreoInvitado": f"invitada{i + 1}@correo.test", "RolEntidad": rol, "HashTestigo": hashlib.sha256(alias.encode()).hexdigest(), "Estado": estado,
                    "IdUsuarioInvita": admin, "FechaEmision": emision, "FechaExpiracion": exp, "FechaCierre": cierre}
            if estado == "aceptada":
                vals["IdUsuarioAcepta"] = Ref(self.persona_id["marisol-quiceno"])
            self.add("InvitacionesDeOrganizacion", vals, alias=alias, lote=lote, nivel=3, procedencia="sintetico")
        tipos = [("organizacion.invitacion", "Invitación a una organización", "Te invitaron a colaborar en una organización. Acepta la invitación desde tu correo."),
                 ("festival.publicado", "Tu festival ya está publicado", "La ficha de tu festival fue revisada y ya es visible en el portal."),
                 ("festival.ajustes", "Tu festival necesita ajustes", "La gestión pidió completar la sede y las fechas antes de publicar."),
                 ("festival.rechazado", "Tu ficha no pudo publicarse", "La revisión no aprobó la ficha; puedes presentar otra con más detalle.")]
        for i, (clave_pe, destino) in enumerate(list(self.persona_id.items())[:10]):
            tipo, titulo, cuerpo = tipos[i % len(tipos)]
            estado = ["leida", "enviada", "pendiente", "leida", "fallida", "cancelada", "enviada", "leida", "pendiente", "leida"][i]
            creada = momento(self.plan, 30 - i)
            vals = {"UsuarioDestinatarioId": Ref(destino), "TipoEvento": tipo, "Canal": "internal" if i % 3 else "email", "Titulo": titulo, "Cuerpo": f"Hola {next(x for x in self.libro.PERSONAS if x['clave'] == clave_pe)['nombre'][0].split()[0]}. {cuerpo}", "Estado": estado, "FechaCreacion": creada,
                    "AmbitoAcceso": "external", "Intentos": 0}
            if estado in ("enviada", "leida", "fallida"):
                vals["FechaEnvio"] = creada + dt.timedelta(minutes=2)
                vals["Intentos"] = 1 if estado != "fallida" else 3
            if estado == "leida":
                vals["FechaLectura"] = creada + dt.timedelta(hours=5)
            if estado == "fallida":
                vals["Error"] = "El servidor de correo rechazó el mensaje (buzón lleno)."
            self.add("Notificaciones", vals, alias=f"notificacion.{clave_pe}", lote=lote, nivel=3, procedencia="sintetico")

    # ---------------------------------------------------------------- reclamaciones y coincidencias (sobre festivales históricos)
    def _reclamacion(self, alias, registro, org_clave, admin, estado, dias, i, lote, fuente="https://es.wikipedia.org/wiki/Anexo:Festivales_en_Colombia", persona_gestion=None):
        enviada = estado != "borrador"
        decidida = estado in ("aprobada", "rechazada", "transferencia_ejecutada")
        vals = {"ModuloId": "festivales", "RegistroCanonicoId": Ref(registro, texto=True), "OrganizacionSolicitanteId": Ref(self.org_id[org_clave]), "PersonaSolicitanteId": admin, "Estado": estado,
                "SenalesJson": [], "Justificacion": f"Somos la organización que produce este festival desde hace varios años y queremos administrar su ficha para mantenerla al día. Adjuntamos actas y afiches de las últimas ediciones ({i + 2} soportes); registro {registro.split('.')[-1]}.",
                "FechaCreacion": momento(self.plan, dias), "FechaEnvio": momento(self.plan, dias - 1) if enviada else None, "FechaActualizacion": momento(self.plan, max(dias - 4, 0)), "Version": 1 + i % 3}
        if decidida:
            aprobo = estado in ("aprobada", "transferencia_ejecutada")
            vals.update(Decision="aprobar" if aprobo else "rechazar", MotivoDecision="Los soportes acreditan la relación con el festival." if aprobo else "Los soportes no acreditan la relación con el festival.",
                        DecisorId=self.gestor, FechaDecision=momento(self.plan, max(dias - 4, 0)))
        self.add("ReclamacionesAdministracion", vals, alias=alias, lote=lote, nivel=self._nivel_rec, procedencia="hibrido", fuente=fuente)
        if estado == "requiere_aclaracion":
            self.add("ReclamacionesAclaraciones", {"ReclamacionId": Ref(alias), "SolicitadaPorId": self.gestor, "Comentario": "Adjunte un documento que muestre a la organización como productora de al menos una edición.",
                                                   "FechaSolicitud": momento(self.plan, max(dias - 3, 0))}, alias=f"{alias}.aclaracion.1", lote=lote, nivel=self._nivel_rec, procedencia="sintetico")
        if estado == "transferencia_ejecutada":
            self.add("TransferenciasAdministracion", {"ModuloId": "festivales", "RegistroCanonicoId": Ref(registro, texto=True), "OrganizacionAnteriorId": INSTITUCIONAL, "OrganizacionNuevaId": Ref(self.org_id[org_clave]),
                                                      "ReclamacionId": Ref(alias), "DecisorId": self.gestor, "Motivo": "Reclamación aprobada y conciliada.", "EstadoAnterior": "publicado", "EstadoPosterior": "publicado",
                                                      "FechaEjecucion": momento(self.plan, max(dias - 6, 0))}, alias=f"{alias}.transferencia", lote=lote, nivel=self._nivel_rec, procedencia="sintetico")

    _nivel_rec = 3

    def reclamaciones_de(self, org_clave, persona_clave, forzar=None, lote="n3-reclamaciones"):
        """Escenarios de reclamación de UNA organización sobre los históricos reales aún libres (y, si lo hay, el ya reclamado por ella)."""
        lote = forzar[1] if forzar else lote
        self._nivel_rec = forzar[0] if forzar else 3
        admin = Ref(self.persona_id[persona_clave])
        if self.historico_reclamado and self.historico_reclamado[1] == org_clave:
            self._reclamacion(f"reclamacion.{org_clave}.ya-reclamado", self.historico_reclamado[0], org_clave, admin, "transferencia_ejecutada", 80, 0, lote)
        escenarios = ["requiere_aclaracion", "en_revision", "rechazada", "cancelada", "enviada", "aprobada"]
        for i, estado in enumerate(escenarios):
            if not self.historicos_libres:
                self.avisos.append(f"reclamación {estado} de {org_clave} omitida: no quedan festivales históricos libres")
                break
            self._reclamacion(f"reclamacion.{org_clave}.{estado}", self.historicos_libres.pop(0), org_clave, admin, estado, 50 - 6 * i, i + 1, lote)
        self._nivel_rec = 3

    def reclamaciones(self, lote="n2-reclamaciones"):
        """Un escenario de reclamación pendiente por organización sintética del libro (sobre los históricos reales que queden)."""
        orgs = [o for o in self.libro.ORGANIZACIONES if o["estado"] == "activa"]
        for i, estado in enumerate(["enviada"]):
            if not self.historicos_libres:
                break
            o = orgs[i % len(orgs)]
            self._reclamacion(f"reclamacion.{o['clave']}.{estado}", self.historicos_libres.pop(0), o["clave"], Ref(self.persona_id[o["admin"]]), estado, 50, i, lote)

        for i, (est, alcance) in enumerate([("pendiente", "responsable"), ("en_revision", "editor"), ("aprobada", "editor"), ("rechazada", "responsable")]):
            o = orgs[(i + 1) % len(orgs)]
            self.add("SolicitudesVinculacionRegistros", {
                "ModuloId": "festivales", "RegistroId": Ref(f"festival.{self.libro.FESTIVALES[i % len(self.libro.FESTIVALES)]['clave']}", texto=True),
                "UsuarioSolicitanteId": Ref(self.persona_id[o["admin"]]), "EntidadId": Ref(self.org_id[o["clave"]]), "AlcanceSolicitado": alcance,
                "Justificacion": f"Hacemos parte del equipo organizador de {self.libro.FESTIVALES[i % len(self.libro.FESTIVALES)]['nombre']} y necesitamos poder editar la ficha con alcance de {alcance}.", "Estado": est,
                "UsuarioRevisorId": self.gestor if est in ("aprobada", "rechazada") else None, "ComentarioRevision": "Vinculación verificada con la organización." if est == "aprobada" else ("No se pudo verificar la relación." if est == "rechazada" else None),
                "FechaCreacion": momento(self.plan, 30 - 4 * i), "FechaActualizacion": momento(self.plan, 28 - 4 * i)}, alias=f"vinculacion.{est}", lote=lote, nivel=3, procedencia="sintetico")
        self.add("PropuestasDeCambio", {
            "ModuloId": "festivales", "RegistroId": Ref(f"festival.{self.libro.FESTIVALES[0]['clave']}", texto=True), "Estado": "en_revision", "IdOrganizacion": Ref(self.org_id[self.libro.FESTIVALES[0]["org"]]),
            "IdUsuarioProponente": Ref(self.persona_id["ismael-cuesta"]), "Motivo": "Actualizar la descripción con las novedades de la última edición.", "FechaCreacion": momento(self.plan, 9), "FechaEnvio": momento(self.plan, 8)},
            alias="propuesta.chirimia", lote=lote, nivel=3, procedencia="sintetico")
        self.add("PropuestasDeCambioCampos", {"IdPropuesta": Ref("propuesta.chirimia"), "SeccionId": "general", "CampoId": "descripcion", "CampoEtiqueta": "Descripción",
                                              "ValorAnterior": self.libro.FESTIVALES[0]["desc"], "ValorPropuesto": self.libro.FESTIVALES[0]["desc"] + " En la última edición se sumó un cabildo de maestros mayores."},
                 alias="propuesta.chirimia.campo.1", lote=lote, nivel=3, procedencia="sintetico")

    def todo(self):
        self.personas(); self.organizaciones(); self.festivales_publicos(); self.festivales_sinteticos(); self.mercados(); self.redes_talleres_espacios()
        self.eventos(); self.noticias(); self.invitaciones_y_notificaciones(); self.reclamaciones()
