"""Constructor del libro N1 de PERSONAS y ORGANIZACIONES sintéticas (tema `personas` de la siembra integral).

Lee `siembra/libro/personas/` (perfiles y organizaciones) y emite, en tres lotes de nivel 1 que respetan las dependencias:
  n1-libro-personas       cuentas (`Usuarios`, `UsuariosRoles`)
  n1-libro-organizaciones organizaciones, equipo, responsables, confirmaciones de correo, invitaciones e historial de cambios (`CambiosDeRegistro`)
  n1-libro-perfiles       perfil público (con las organizaciones visibles), enlaces, prácticas, clasificaciones, autorizaciones y boletín
Claves estables: `n1.persona.<clave>` y `n1.organizacion.<clave>`; alias del plan: `persona.<clave>`, `org.<clave>`.
Registra a las personas y organizaciones en `Constructor.persona_id/persona_spec/org_id/org_spec`, para que otros temas (festivales, mercados…) las citen.
Requiere que las cuentas de validación (`cuenta.externo-camila`, `cuenta.editor`) ya existan: Camila figura como editor de tres organizaciones sin tocar sus datos base.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import uuid

from constructores import CLAVE_DEMO, dep_de, momento, slug
from hash_identidad import hash_identidad
from nucleo import Cat, Raw, Ref

LOTE_PERSONAS, LOTE_ORGS, LOTE_PERFILES = "n1-libro-personas", "n1-libro-organizaciones", "n1-libro-perfiles"
CAMILA_EDITOR_EN = ("corp-cabildo-sonoro-del-atrato", "escuela-de-luteria-el-roble", "colectivo-tierra-adentro")
META = dict(nivel=1, procedencia="sintetico")


def correo_de(pe: dict) -> str:
    return f"{slug(pe['nombre'][0].split()[0])}.{slug(pe['nombre'][1])}@simus.test"


def cargar():
    from personas.organizaciones import ORGANIZACIONES
    from personas.perfiles import PERFILES
    return PERFILES, ORGANIZACIONES


def sembrar(plan, c, perfiles=None, organizaciones=None):
    if perfiles is None:
        perfiles, organizaciones = cargar()
    orgs = {o["clave"]: o for o in organizaciones}
    por_clave = {p["clave"]: p for p in perfiles}
    editor_de: dict = {k: [] for k in orgs}
    for p in perfiles:
        for org, rol, _cargo, _desde in p["orgs"]:
            if rol == "editor":
                editor_de[org].append(p["clave"])
    # ------------------------------------------------------------ cuentas
    for i, pe in enumerate(perfiles):
        clave, alias = pe["clave"], f"persona.{pe['clave']}"
        c.persona_id[clave] = alias
        c.persona_spec[clave] = dict(clave=clave, nombre=pe["nombre"], doc=pe["doc"])
        n1, ap1, ap2 = pe["nombre"]
        correo = correo_de(pe)
        creada = 700 - 11 * i
        c.add("Usuarios", {
            "NombreCompleto": f"{n1} {ap1} {ap2}", "CorreoElectronico": correo, "HashContrasena": hash_identidad(CLAVE_DEMO, correo), "CanalAcceso": "externo", "TipoPerfil": "individual",
            "Activo": True, "FechaCreacion": momento(plan, creada), "FechaActualizacion": momento(plan, 12 + i), "UltimoAcceso": momento(plan, 1 + i % 9, 8 + i % 10),
            "Telefono": f"+57 300 555 {2000 + i * 13:04d}", "Identificacion": f"DEMO-N1P{i + 1:02d}", "CodigoTipoDocumento": pe["doc"], "CorreoConfirmado": True,
            "FechaConfirmacionCorreo": momento(plan, creada - 1), "PrimerNombre": n1.split()[0], "SegundoNombre": " ".join(n1.split()[1:]) or None, "PrimerApellido": ap1, "SegundoApellido": ap2,
            "DebeCambiarContrasena": False, "PerfilCompletado": True, "ResidenciaCodigoDepartamento": dep_de(pe["muni"]), "ResidenciaCodigoMunicipio": pe["muni"], "CanalDeContactoPreferido": "correo" if i % 3 else "telefono",
        }, alias=alias, lote=LOTE_PERSONAS, clave_estable=f"n1.persona.{clave}", **META)
        c.add("UsuariosRoles", {"IdUsuario": Ref(alias), "IdRol": Cat("Roles", "IdRol", "NombreRol", "externo")}, lote=LOTE_PERSONAS, **META)
    # ------------------------------------------------------------ organizaciones
    for i, o in enumerate(organizaciones):
        clave, alias = o["clave"], f"org.{o['clave']}"
        c.org_id[clave] = alias
        c.org_spec[clave] = dict(clave=clave, nombre=o["nombre"], admin=o["admin"], estado=o["estado"], muni=o["muni"], desc=o["desc"], editor=editor_de[clave] or None)
        admin = Ref(c.persona_id[o["admin"]])
        pa = por_clave[o["admin"]]
        estado, dias = o["estado"], o["dias"]
        vals = {
            "TipoEntidad": "organizacion", "Nombre": o["nombre"], "NombreLegal": o["nombre"], "Descripcion": o["desc"], "CorreoContacto": f"contacto@{o['dominio']}", "TelefonoContacto": o["telefono"],
            "SitioWeb": f"https://{o['dominio']}", "Facebook": o.get("facebook"), "Instagram": o.get("instagram"), "OtroEnlace": o.get("otro"), "Direccion": o.get("direccion"),
            "EstadoRegistro": estado, "Activo": estado in ("activa", "pendiente_de_confirmacion"), "IdUsuarioCreador": admin, "IdUsuarioResponsable": admin,
            "FechaCreacion": momento(plan, dias), "FechaActualizacion": momento(plan, max(dias - 40 if dias > 60 else dias // 2, 0)),
            "NumeroIdentificacion": o.get("nit"), "TipoIdentificacion": "NIT" if o.get("nit") else None, "EsInstitucional": False,
            "CodigoDepartamentoSede": dep_de(o["muni"]), "CodigoMunicipioSede": o["muni"],
        }
        if estado != "pendiente_de_confirmacion":
            vals.update(FechaRevision=momento(plan, dias - 3), FechaAprobacion=momento(plan, dias - 4), FechaPublicacion=momento(plan, dias - 4))
        if o.get("revision") is not None:
            vals.update(FechaRevisionConsola=momento(plan, o["revision"] - 2), IdUsuarioRevisionConsola=c.gestor)
        c.add("Entidades", vals, alias=alias, lote=LOTE_ORGS, clave_estable=f"n1.organizacion.{clave}", **META)
        if estado != "eliminada":  # la eliminación exige liberar antes la administración: no queda equipo
            c.add("UsuariosEntidades", {"IdUsuario": admin, "IdEntidad": Ref(alias), "RolEntidad": "administrador", "Activo": True, "FechaCreacion": momento(plan, dias)}, lote=LOTE_ORGS, **META)
            for k, ed in enumerate(editor_de[clave]):
                c.add("UsuariosEntidades", {"IdUsuario": Ref(c.persona_id[ed]), "IdEntidad": Ref(alias), "RolEntidad": "editor", "Activo": True, "FechaCreacion": momento(plan, max(dias - 25 - 10 * k, 1))}, lote=LOTE_ORGS, **META)
            if clave in CAMILA_EDITOR_EN and "cuenta.externo-camila" in c.persona_id.values():
                c.add("UsuariosEntidades", {"IdUsuario": Ref("cuenta.externo-camila"), "IdEntidad": Ref(alias), "RolEntidad": "editor", "Activo": True, "FechaCreacion": momento(plan, max(dias - 140, 1))}, lote=LOTE_ORGS, **META)
        c.add("EntidadesResponsable", {
            "IdEntidad": Ref(alias), "ResponsableNombre": " ".join(pa["nombre"]), "ResponsableTipoDocumento": pa["doc"], "ResponsableNumeroDocumento": f"DEMO-N1P{perfiles.index(pa) + 1:02d}", "ResponsableCorreo": correo_de(pa),
            "ResponsableTelefono": f"+57 300 555 {2000 + perfiles.index(pa) * 13:04d}", "ResponsableDesde": momento(plan, dias), "ResponsableAutorizacionDatos": True,
            "ResponsablePrimerNombre": pa["nombre"][0].split()[0], "ResponsableSegundoNombre": " ".join(pa["nombre"][0].split()[1:]) or None, "ResponsablePrimerApellido": pa["nombre"][1], "ResponsableSegundoApellido": pa["nombre"][2],
        }, alias=None, lote=LOTE_ORGS, **META)
        emision = momento(plan, dias, 9)
        c.add("ConfirmacionesDeCorreo", {
            "IdUsuario": admin, "CorreoDestino": f"contacto@{o['dominio']}", "HashTestigo": hashlib.sha256(f"{alias}.confirmacion".encode()).hexdigest(), "FechaEmision": emision,
            "FechaExpiracion": emision + dt.timedelta(days=7), "FechaUso": None if estado == "pendiente_de_confirmacion" else emision + dt.timedelta(hours=20)}, alias=f"{alias}.confirmacion", lote=LOTE_ORGS, **META)
        for k, (correo, rol, est, d_emision) in enumerate(o["invitaciones"], 1):
            ialias = f"{alias}.invitacion.{k}"
            emi = momento(plan, d_emision)
            exp = emi + dt.timedelta(days=14)
            v = {"IdEntidad": Ref(alias), "CorreoInvitado": correo, "RolEntidad": rol, "HashTestigo": hashlib.sha256(ialias.encode()).hexdigest(), "Estado": est, "IdUsuarioInvita": admin,
                 "FechaEmision": emi, "FechaExpiracion": exp, "FechaCierre": None if est == "pendiente" else (exp if est == "vencida" else emi + dt.timedelta(days=3))}
            if est == "aceptada":
                ed = editor_de[clave]
                if ed:
                    v["IdUsuarioAcepta"] = Ref(c.persona_id[ed[0]])
                    v["CorreoInvitado"] = correo_de(por_clave[ed[0]])
                elif "cuenta.editor" in c.persona_id.values():
                    v["IdUsuarioAcepta"] = Ref("cuenta.editor")
                    v["CorreoInvitado"] = "editor@simus.test"
                else:
                    v["Estado"], v["FechaCierre"] = "pendiente", None
            c.add("InvitacionesDeOrganizacion", v, alias=ialias, lote=LOTE_ORGS, **META)
        for k, (d, campo, etiqueta, clase, ant, nuevo, origen, actor, motivo) in enumerate(o["cambios"], 1):
            v = {"ModuloId": "organizaciones", "RegistroId": Ref(alias, texto=True), "OrganizacionId": Ref(alias), "IdGrupo": Raw(f"'{uuid.uuid5(uuid.NAMESPACE_URL, f'{alias}.cambio.{k}')}'"),
                 "CampoId": campo, "CampoEtiqueta": etiqueta, "ClaseDato": clase, "ValorAnterior": ant, "ValorNuevo": nuevo, "Origen": origen,
                 "ActorId": admin if actor == "admin" else c.gestor, "ActorNombre": " ".join(pa["nombre"][:2]) if actor == "admin" else "Gestión SIMUS",
                 "ActorRol": "administrador de la organización" if actor == "admin" else "gestor_interno", "Motivo": motivo, "Fecha": momento(plan, d, 11)}
            if campo == "nombre":
                v.update(NombreAnterior=ant, NombreNuevo=nuevo)
            c.add("CambiosDeRegistro", v, alias=f"{alias}.cambio.{k}", lote=LOTE_ORGS, **META)
    # ------------------------------------------------------------ perfiles públicos
    for i, pe in enumerate(perfiles):
        clave, alias = pe["clave"], f"persona.{pe['clave']}"
        visibles = [f"org.{org}" for org, _r, _c2, _d in pe["orgs"] if orgs[org]["estado"] != "eliminada"]
        ids = Raw("N'[' + " + " + N',' + ".join(f"CAST((SELECT IdRegistro FROM dbo.DatosDeDemostracion WHERE Alias = N'{a}') AS nvarchar(20))" for a in visibles) + " + N']'") if visibles else None
        creada = 695 - 11 * i
        c.add("PerfilesPublicos", {
            "IdUsuario": Ref(alias), "NombreVisible": f"{pe['nombre'][0]} {pe['nombre'][1]}", "CodigoMunicipio": pe["muni"], "FechaCreacion": momento(plan, creada), "FechaActualizacion": momento(plan, 8 + i),
            "NombreCivilVisible": True, "BiografiaCorta": pe["corta"], "BiografiaLarga": pe["larga"], "Visibilidad": pe.get("visibilidad", "publico"),
            "RolesJson": pe["roles"], "PortafolioJson": pe["portafolio"], "OrganizacionesVisiblesJson": ids,
        }, alias=f"{alias}.perfil", id_expr=Ref(alias), lote=LOTE_PERFILES, **META)
        for k, (url, etiqueta) in enumerate(pe["enlaces"], 1):
            c.add("PerfilesPublicosEnlaces", {"IdUsuario": Ref(alias), "Orden": k, "Url": url, "Etiqueta": etiqueta}, lote=LOTE_PERFILES, **META)
        for s in pe["practicas"]:
            c.add("PerfilesPublicosPracticas", {"IdUsuario": Ref(alias), "IdPracticaMusical": Cat("PracticasMusicales", "IdPracticaMusical", "Slug", s)}, lote=LOTE_PERFILES, **META)
        for dim in ("rol", "servicio", "instrumento", "territorio"):
            for cod in pe[dim]:
                c.add("PerfilesPublicosClasificaciones", {"IdUsuario": Ref(alias), "Dimension": dim, "Codigo": cod}, lote=LOTE_PERFILES, **META)
        for fin in ("perfil_publico", "terminos", "tratamiento") + (("boletin",) if i % 3 == 0 else ()):
            c.add("AutorizacionesDatos", {"Finalidad": fin, "IdPolitica": Raw(f"(SELECT TOP 1 IdPolitica FROM dbo.PoliticasDatos WHERE Clave = N'{fin}' ORDER BY IdPolitica)"), "Version": "1.0",
                                          "TextoAceptado": "Texto de la política vigente al momento de la aceptación.", "IdUsuario": Ref(alias), "Origen": "cuenta", "FechaOtorgada": momento(plan, 699 - 11 * i)},
                  alias=f"{alias}.autorizacion.{fin}", lote=LOTE_PERFILES, **META)
        if i % 3 == 0:
            baja = i == 12
            c.add("BoletinSuscripciones", {"CorreoElectronico": correo_de(pe), "Origen": "cuenta", "Estado": "baja" if baja else "activa", "FechaAlta": momento(plan, 690 - 11 * i),
                                          "FechaBaja": momento(plan, 60) if baja else None, "Confirmada": True, "FechaConfirmacion": momento(plan, 689 - 11 * i)}, alias=f"{alias}.boletin", lote=LOTE_PERFILES, **META)
    plan.avisos.append(f"personas: {len(perfiles)} perfiles y {len(organizaciones)} organizaciones N1; sus relaciones con festivales y mercados se concilian en reconciliar_libros.py")
