"""Genera `siembra/docs/mapa-de-campos.md`: inventario de lo que hay que sembrar, LEÍDO del esquema real (columnas, claves, únicos,
FK, CHECK) más las notas de estados, transiciones y dependencias que no caben en el esquema.

    python3 siembra/generador/esquema.py inventario.json          # lee la base de PRUEBA (solo lee)
    python3 siembra/generador/mapa_de_campos.py inventario.json   # escribe siembra/docs/mapa-de-campos.md
    python3 siembra/generador/mapa_de_campos.py inventario.json --comprobar   # falla si una tabla no está clasificada

Las notas curadas (NOTAS) salen de los CHECK, de `EstadosFestival.cs`, `EstadosDeOrganizacion.cs`,
`ReclamacionesAdministracionEndpoints.cs` y de los formularios; el resto es mecánico. Es un documento de apoyo del kit de demo, no
una especificación del producto.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "siembra" / "docs" / "mapa-de-campos.md"

# Tipos de entidad a sembrar: (id, título, tablas, notas). El orden es el de lectura, no el de inserción.
TIPOS = [
    ("personas", "Personas y perfiles", [
        "Usuarios", "UsuariosRoles", "PerfilesPublicos", "PerfilesPublicosClasificaciones", "PerfilesPublicosEnlaces",
        "PerfilesPublicosPracticas", "AutorizacionesDatos", "BoletinSuscripciones"],
     """**Una persona = una fila de `Usuarios` (rol `externo`) + una de `PerfilesPublicos` (misma clave `IdUsuario`).** El perfil público
es 1:1 con el usuario; `ClavePublica` es el identificador de la URL (única). Biografía corta/larga, portafolio y organizaciones visibles
viajan en columnas JSON (`PortafolioJson`, `OrganizacionesVisiblesJson`, `RolesJson`): el generador debe emitir JSON válido.
- `Usuarios.CanalAcceso`: `externo` (personas y organizaciones) o `interno` (gestión). Sin CHECK en la base; el API solo escribe esos dos. `TipoPerfil`: `individual` (persona) u `organizacion` (cuenta que administra organizaciones).
- `Usuarios.HashContrasena`: hash de ASP.NET Identity (V3). La clave de demostración es «admin» (ver kit/cuentas).
- Correo con formato `x@y.z` (CHECK) y único por cuenta; `Identificacion` opcional, 3+ caracteres `[0-9A-Za-z-]`; **nunca documentos reales**.
- `CorreoConfirmado=1` para poder ingresar; `DebeCambiarContrasena=0` y `PerfilCompletado=1` para que no pase por el primer ingreso.
- `PerfilesPublicos.Visibilidad`: `publico` | `solo_simus`. Moderación: `OcultoPorModeracion` + motivo/fecha/moderador (los tres juntos).
- Autorizaciones: una fila por finalidad (`perfil_publico`, `boletin`, `terminos`, `tratamiento`) y origen (`cuenta`, `consola`, `noticias`, `portada`, `registro`).
- Dependencias: `TiposDocumento`, `Divipola` (residencia), `Roles`, `PoliticasDatos`, taxonomías de perfiles (`ValoresDeTaxonomiaDePerfiles`).
- Estados: no hay máquina de estados propia; la cuenta es `Activo` 0/1 y el perfil es visible/oculto por moderación."""),
    ("organizaciones", "Organizaciones", [
        "Entidades", "EntidadesResponsable", "UsuariosEntidades", "InvitacionesDeOrganizacion", "ConfirmacionesDeCorreo"],
     """**`Entidades` solo admite `TipoEntidad='organizacion'`** (CHECK). La fila 1 es la entidad institucional del PNMC (`EsInstitucional=1`) y no se toca.
- `EstadoRegistro` (FK a `EstadosContenido` + CHECK): `pendiente_de_confirmacion` → `activa` ⇄ `inactiva` → `eliminada`. `Activo` debe ser coherente
  (`CK_Entidades_VigenciaCoherente`): 1 para `activa`/`pendiente_de_confirmacion`, 0 para `inactiva`/`eliminada`.
- Transiciones: nace `pendiente_de_confirmacion` (alta externa) → `activa` al confirmar el correo; `activa` ⇄ `inactiva` (reversible); `eliminada` exige resolver
  antes los procesos (custodia: liberar la administración). La demo usa casi todo `activa` y deja algunas `inactiva`/`pendiente_de_confirmacion` para la consola.
- `IdUsuarioCreador` obligatorio; `IdUsuarioResponsable` opcional (la persona responsable). Sede principal: `CodigoDepartamentoSede`/`CodigoMunicipioSede` (FK a `Divipola`).
- `NumeroIdentificacion`/`TipoIdentificacion` (NIT) opcional; un correo de contacto pertenece a una sola organización (índice único del 28-ago).
- Fechas coherentes: `FechaCreacion` ≤ `FechaRevision` ≤ `FechaAprobacion` ≤ `FechaPublicacion` cuando existan.
- Equipo: `UsuariosEntidades.RolEntidad` ∈ {`administrador`, `editor`}; único por (usuario, entidad). Cada organización activa necesita al menos un administrador.
- Invitaciones: `Estado` ∈ {`pendiente`, `aceptada`, `revocada`, `vencida`}; `RolEntidad` ∈ {`administrador`, `editor`}."""),
    ("festivales", "Festivales y ediciones", [
        "Festivales", "EdicionesFestival", "FestivalesReferenciasHistoricas", "PracticasMusicalesDeRegistro", "TerritoriosSonorosDeRegistro",
        "TiposIngresoDeRegistro", "ModalidadesParticipacionDeRegistro", "ExpresionesArtisticasDeRegistro", "EntidadesAliadasDeRegistro", "LocalizacionesDeRegistro",
        "ArchivosDeRegistro"],
     """**Festival** (`Festivales`) y **edición** (`EdicionesFestival`, N por festival). Las tablas `…DeRegistro` son pivotes polimórficos: `ModuloId` ∈ {`festivales`,
`ediciones-festival`, `ediciones-mercado`} (+ `reclamaciones-administracion` en archivos) y `RegistroId` apunta al festival o a la edición, sin FK real: **el generador debe garantizar la existencia del destino**.
- `Festivales.EstadoRegistro` (CHECK/FK): `borrador`, `en_revision`, `ajustes_solicitados`, `aprobado`, `publicado`, `archivado`, `rechazado`. **`aprobado` existe en el catálogo pero ningún
  camino del Festival lo escribe: no se siembra.** Circuito: `borrador` → `en_revision` → {`publicado` | `ajustes_solicitados` | `rechazado`}; `ajustes_solicitados` → `en_revision`;
  `archivado` se alcanza desde cualquiera. Editables por la organización: `borrador` y `ajustes_solicitados`. Público: solo `publicado`.
- `NivelCobertura` ∈ {`municipal`, `departamental`, `nacional`} con coherencia: nacional → sin departamento ni municipio; departamental → departamento sin municipio; municipal → ambos (FK `Divipola`).
- `FusionadoEnId` y `FechaFusion` van juntos y solo con `EstadoRegistro='archivado'` (`CK_Festivales_FusionCoherente`). Histórico sin reclamar: festival `publicado` cuyo `OrganizacionPrincipalId` es la entidad institucional (`EsInstitucional=1`); nace publicado para que las organizaciones lo encuentren y lo reclamen
  (ver «Coincidencias y reclamaciones»). `FestivalesReferenciasHistoricas` liga una organización con un festival que ya administró.
- Organización responsable: FK a `Entidades` (por omisión la institucional). `Periodicidades` y `TipologiasFestival` son catálogos.
- `EdicionesFestival.Estado`: `en_preparacion`, `programada`, `realizada`, `cancelada`. `EstadoRegistro` (mismo vocabulario de siete) y `EstadoVisibilidad` ∈ {`borrador`, `publicada`, `archivada`}.
  Coherencia: edición `publicada` ⇒ festival `publicado`; `realizada` ⇒ fecha fin en el pasado; `programada`/`en_preparacion` ⇒ fechas futuras o sin fecha; `cancelada` con motivo en descripción.
- `CK_EdicionesFestival_Identificacion`: al menos uno de año, número de edición, nombre, fecha de inicio o de fin. Fechas: `FechaInicio` ≤ `FechaFin`. Único (festival, año, número) según los índices.
- Trayectorias a cubrir: muchas ediciones (5–6), 2, 1, ninguna; interrupciones (años sin edición), cambio de sede, ediciones futuras de demostración."""),
    ("mercados", "Mercados, ediciones y agenda de citas", [
        "Mercados", "EdicionesMercado", "MercadosPracticasMusicales", "MercadosTerritoriosSonoros", "AgendasDeCitas", "FranjasDeCitas",
        "CitasDeAgenda", "ParticipantesDeCitas", "InvitacionesDeAgenda"],
     """- `Mercados.EstadoRegistro`: siete códigos del catálogo, pero el circuito simple usa `borrador`, `en_revision`, `ajustes_solicitados`, `publicado`, `archivado`, `rechazado` (el CHECK no admite `aprobado` en mercados).
- `EdicionesMercado.Estado`: `en_preparacion`, `programada`, `realizada`, `cancelada`; `EstadoVisibilidad`: `borrador`, `publicado`, `archivado` (nótese el masculino).
- `AlcancesMercado` y `ModalidadesMercado` son catálogos; `NivelCobertura` con la misma regla que festivales.
- Agenda de citas (sólo mercados con rueda de negocios): `AgendasDeCitas.Estado` ∈ {`borrador`, `abierta`, `en_curso`, `cerrada`}; `Modo` ∈ {`compradores_fijos`, `compradores_rotan`};
  `AprobacionDeArtistas` ∈ {`aceptacion`, `automatica`}. Franjas (`FranjasDeCitas`) pertenecen a la agenda.
- `ParticipantesDeCitas`: `Rol` ∈ {`artista`, `comprador`}; artista exige `UsuarioId`; comprador exige `CorreoInvitacion` y `TipoDeComprador` ∈ {`festival`, `sala`, `agencia`, `sello`, `editorial`, `medio`, `institucion`, `otro`};
  `Estado` ∈ {`pendiente`, `aprobado`, `rechazado`, `lista_de_espera`, `retirado`}; `lista_de_espera` solo para artistas.
- `CitasDeAgenda.Estado` ∈ {`solicitada`, `confirmada`, `rechazada`, `cancelada`, `vencida`}; `InvitacionesDeAgenda.Estado` ∈ {`pendiente`, `aceptada`, `revocada`, `vencida`}."""),
    ("redes_luteria_espacios", "Redes, lutería (talleres) y espacios", [
        "Redes", "RedesPracticasMusicales", "RedesFormasDeAcceso", "RedesFormatos", "Talleres", "TalleresPracticasMusicales", "TalleresFamiliasDeInstrumentos",
        "TalleresServicios", "Espacios", "EspaciosPracticasMusicales", "EspaciosEquipamiento", "EspaciosTipos"],
     """Los tres usan el circuito simple de seis estados: `borrador` → `en_revision` → {`publicado` | `ajustes_solicitados` | `rechazado`}; `archivado` desde cualquiera (sin `aprobado`).
- `Redes.TipoDeNodo` ∈ {`red`, `archivo`, `coleccion`, `centro_de_documentacion`, `grupo_de_investigacion`}. Formas de acceso y formatos de documentación son catálogos con `EstadoAprobacion` (`propuesto`/`aprobado`).
- `Talleres.Modalidad` ∈ {`fijo`, `itinerante`, `colectivo`}; servicios y familias de instrumentos: catálogos (`ServiciosDeTaller`, `FamiliasDeInstrumentos`), valores `propuesto` se pueden sembrar para la bandeja.
- `Espacios.Ambiente` ∈ {`abierto`, `cerrado`, `mixto`}; `TiposDeEspacio` y `EquipamientoDeEspacio` catálogos con aprobación.
- Los tres: `NivelCobertura` + departamento/municipio coherentes (CHECK); **`CK_*_UnSoloResponsable`: o bien `OrganizacionPrincipalId` o bien `UsuarioResponsableId`, nunca ambos ni ninguno**; `EstadoRegistro` FK a `EstadosContenido`."""),
    ("eventos", "Eventos y agenda", [
        "EventosAgenda", "EventosAgendaPracticasMusicales", "EventosAgendaTerritoriosSonoros", "EventosAgendaProyectosTransversales", "EventosAgendaArchivos",
        "EtiquetasEventoAgenda"],
     """- `EventosAgenda.Estado` (CHECK): `borrador`, `en_revision`, `publicado`, `rechazado`, `archivado`. `Modalidad` ∈ {`presencial`, `virtual`, `mixta`}: **publicado** exige `Lugar` si es presencial, `Url` si es virtual, ambos si es mixta
  (`CK_EventosAgenda_DatosDeModalidad`). `NivelCobertura` con la regla territorial. Fechas: inicio ≤ fin; eventos pasados, presentes y futuros para series temporales.
- Vínculos opcionales a festival/mercado/edición, a prácticas, territorios, proyectos transversales, archivos (imagen del evento) y etiquetas (`Etiquetas`). Se publica desde la consola de gestión: `borrador` → `en_revision` → `publicado`/`rechazado`."""),
    ("noticias", "Noticias", ["Noticias", "NoticiasPracticasMusicales", "NoticiasTerritoriosSonoros", "NoticiasProyectosTransversales", "NoticiasArchivos", "EtiquetasNoticia"],
     """- `Noticias.Estado`: `borrador`, `en_revision`, `publicado`, `rechazado`, `archivado`; **`publicado` exige `FechaPublicacion`** (`CK_Noticias_PublicadaConFecha`).
- Imagen de portada y galería por `NoticiasArchivos` (FK `Archivos`); categoría de `Categorias` (módulo `noticias`); etiquetas, prácticas, territorios y proyectos transversales por pivotes.
- Texto largo con extensión suficiente (cuerpo editorial) y autoría. **Una noticia no tiene FK a festival/organización**: solo categoría, prácticas, territorios, proyectos y archivos. El `Slug` es único y las categorías se buscan por (`CodigoModulo`, `Slug`): un mismo slug (p. ej. `formacion`) existe en agenda y en noticias."""),
    ("editorial", "Catálogo editorial (acervo)", [
        "PublicacionesEditoriales", "PublicacionesEditorialesFuentes", "PublicacionesEditorialesIdiomas", "PublicacionesEditorialesPracticasMusicales",
        "PublicacionesEditorialesProgramas", "PublicacionesEditorialesTerritoriosSonoros", "PublicacionesEditorialesTipologias", "AccesosEditoriales",
        "AgentesEditoriales", "CreditosEditoriales", "IdentificadoresEditoriales", "PalabrasClaveEditoriales", "FuentesEditoriales", "ProgramasEditoriales",
        "TipologiasEditoriales"],
     """**Ya viene poblado por las migraciones/seed (171 publicaciones, 410 agentes, 864 créditos): la siembra de demo NO lo toca** salvo que se quiera ampliar. Es acervo de referencia, no operativo.
- `EstadoPublicacion`: `borrador`, `en_revision`, `publicado`, `retirado`; `EstadoCatalogacion`: `pendiente_revision`, `en_revision`, `validada`, `observada`; `DerechosEstado`: `pendiente`, `verificado`, `restringido`.
- `Formato` ∈ {`Físico`, `Digital`, `Mixto`}; `Confianza` ∈ {`Baja`, `Media`, `Alta`}; `IdentificadoresEditoriales.Esquema` ∈ {`ISBN`, `ISMN`}; `AgentesEditoriales.Tipo` ∈ {`persona`, `entidad`}.
- `AccesosEditoriales.Tipo` ∈ {`archivo`, `enlace`, `ubicacion`}: un solo destino por fila (CHECK `UnSoloDestino`)."""),
    ("proyectos_etiquetas", "Proyectos transversales, etiquetas y categorías", ["ProyectosTransversales", "Etiquetas", "Categorias", "TitulacionesColectivas"],
     """- `ProyectosTransversales` (3 de partida) enlaza con eventos y noticias; `Etiquetas` son las etiquetas libres de noticias/agenda (hashtags).
- `Categorias`: `CodigoModulo` en minúscula sin espacios; jerarquía solo para `editorial` (`CategoriaPadreId`). Las de noticias y agenda ya existen (migración `categorias_noticias_agenda`)."""),
    ("galeria", "Galería pública (álbumes de fotos, de videos y mixtos)", ["GaleriaAlbumes", "GaleriaItems"],
     """- `GaleriaAlbumes.Tipo` ∈ {`fotos`, `videos`, `mixto`} (CHECK); `Slug` único (minúsculas, números y guiones); `ListaOrigenUrl` es un enlace https (la lista de reproducción de origen); solo `Publicado = 1` se ve en el portal y solo entonces se sirven al público sus fotos y portada (vínculo en `VinculosAsync` del Banco de archivos).
- `GaleriaItems.TipoItem` ∈ {`foto`, `video`}: la foto lleva `ArchivoId` (FK `Archivos`) y no `VideoId`; el video lleva `VideoId` (11 caracteres de YouTube, sin ningún archivo) y `Titulo`, y puede llevar fecha, descripción y `DuracionSegundos` (CHECK `CK_GaleriaItems_Destino`). `GaleriaAlbumId` es opcional: nulo = ítem «Sin álbum», que se ve con su propia marca `Publicado`. El video lleva además `MiniaturaArchivoId` (FK `Archivos`, su imagen propia; solo videos, CHECK `CK_GaleriaItems_Miniatura`) y, si `Descripcion` es un resumen, el texto completo en `Detalle`.
- Que el tipo del ítem sea coherente con el del álbum (un álbum de fotos no lleva videos y uno de videos no lleva fotos; el mixto, de ambos) lo valida la API y lo respeta la siembra; un CHECK no cruza tablas.
- **Privacidad:** no se guarda ninguna miniatura ni dirección de terceros salvo el identificador; la miniatura de un video no se pide a YouTube (la portada es una tarjeta propia)."""),
    ("multimedia", "Archivos y multimedia", ["Archivos", "MediosWeb", "MediosWebHistorial"],
     """- `Archivos`: contenido binario en la base (`PesoBytes`); **tope 2 MiB (imágenes) y 20 MiB (PDF)** por `CK_Archivos_PesoPorTipo`. `Credito` y procedencia en columnas propias: anotar la fuente allí.
- `MediosWeb` (logotipo/fondo de sitio): `Uso` ∈ {`logotipo`, `fondo`}; tipos `image/jpeg|png|webp`; huellas hexadecimales en minúscula; borrador y publicado juntos y completos (`PublicadoCompleto`).
- Imágenes de festivales, perfiles, noticias y eventos se sirven vía `Archivos` + pivotes. Multimedia ligera (manifiesto + licencias fuera de git); el generador referencia el manifiesto por `ClaveImagen`."""),
    ("equipos_invitaciones", "Equipos e invitaciones", ["UsuariosEntidades", "InvitacionesDeOrganizacion", "InvitacionesDeAgenda"],
     """Ver «Organizaciones» y «Mercados». Reglas: una invitación `pendiente` lleva correo del invitado y caducidad futura; `aceptada` ⇒ existe la fila de `UsuariosEntidades`; `vencida` ⇒ caducidad pasada; `revocada` con fecha."""),
    ("notificaciones", "Notificaciones", ["Notificaciones"],
     """- `Estado` ∈ {`pendiente`, `enviada`, `leida`, `fallida`, `cancelada`}; `Canal` ∈ {`internal`, `email`, `whatsapp`} (la demo solo `internal` y `email`); `AmbitoAcceso` ∈ {`external`, `institutional`}.
- Coherencia: `leida` ⇒ `FechaLectura` ≥ `FechaEnvio` ≥ `FechaCreacion`; `fallida` ⇒ `Error` e `Intentos` ≥ 1; destinatario por `UsuarioDestinatarioId` o `CorreoDestinatario`; `ModuloId`/`RegistroId` apuntan al proceso (sin FK).
- `FechaOcultacion` = la persona la ocultó."""),
    ("revisiones", "Solicitudes de revisión, propuestas e historiales", [
        "RevisionesDeRegistro", "RevisionesDeRegistroObservaciones", "EnviosDeRevision", "PropuestasDeCambio", "PropuestasDeCambioCampos", "RegistrosRevisionHistorial",
        "CambiosDeRegistro", "BorradoresProceso", "ProcedenciasDeRegistro", "BitacoraAuditoria"],
     """- **Revisión por campos** (`RevisionesDeRegistro`): `Estado` ∈ {`borrador`, `enviada`, `cerrada`}; `FechaEnvio` nula solo en `borrador`; `FechaCierre` solo en `cerrada` (CHECK). Observaciones: `Ambito` ∈ {`principal`, `subregistro`}
  (`subregistro` exige `SubregistroId`), `Estado` ∈ {`pendiente`, `atendida`}.
- **Envíos** (`EnviosDeRevision`): una fila por envío, `NumeroEnvio` correlativo por registro; guarda la instantánea `DatosJson` (JSON válido).
- **Propuestas de cambio** (`PropuestasDeCambio`): `Estado` ∈ {`borrador`, `en_revision`, `ajustes_solicitados`, `aplicada`, `rechazada`}. `FechaEnvio` nula solo en borrador; `FechaDecision` solo en `aplicada`/`rechazada`; `rechazada` exige `MotivoDeLaDecision`.
  Transiciones: `borrador` → `en_revision` → {`aplicada` | `ajustes_solicitados` | `rechazada`}; `ajustes_solicitados` → `en_revision`. Cada campo propuesto en `PropuestasDeCambioCampos` (único por propuesta y campo). **Una sola propuesta viva** (no aplicada ni rechazada) por (módulo, registro) y una sola revisión por campos no cerrada por registro.
- **Historial** (`RegistrosRevisionHistorial`): una fila por transición de estado de un proceso; `EstadoNuevo` ∈ los siete de contenido + `pendiente_revision`/`validada`/`observada`/`retirado` (editorial); el estado nuevo del historial
  debe coincidir con el `EstadoRegistro` actual del proceso y las fechas deben ser crecientes. `Accion` coherente (enviar, solicitar ajustes, publicar, rechazar, archivar…).
- `CambiosDeRegistro`: bitácora de campos (`ClaseDato` ∈ {`publico`, `organizacion`, `contacto`, `identificacion`, `sensible`}; `Origen` ∈ {`directo`, `propuesta`, `importacion`, `fusion`, `sistema`, `migracion`}).
- `BorradoresProceso.Estado` ∈ {`borrador`, `cerrado`, `cancelado`}: solo uno `borrador` por (módulo, organización, persona).
- `ProcedenciasDeRegistro` es **la tabla de negocio** (contexto `siembra`, `historico`, `prueba`, `importacion`, `externo`, `administrativo`) y NO sustituye a `DatosDeDemostracion` (kit de demo): el generador escribe ambas cuando el API la exige.
- `BitacoraAuditoria.Accion` tiene CHECK con la lista de acciones auditables; el generador solo sembrará las que el API produce."""),
    ("celebra", "Celebra la música: ediciones del micrositio", [
        "CelebraEdiciones", "CelebraCategorias", "CelebraRecursos", "CelebraPreguntas", "CelebraGaleria"],
     """- **Una edición por año** (`CelebraEdiciones`, `Anio` único entre 2011 y 2100), cada una con su proyecto transversal (`ProyectoTransversalId`, único): los de 2025 y 2026 existen por migración y la limpieza los conserva.
  Una sola edición vigente (`Actual = 1`, índice único filtrado). Colores `#RRGGBB` (CHECK). Cifras no negativas. `Publicada` decide si la ve el público: la API pública solo sirve las publicadas.
- **Hijas** (sin cascada; todas por `CelebraEdicionId`): `CelebraCategorias` (nombre único por edición), `CelebraPreguntas`, `CelebraGaleria` (archivo único por edición; `TextoAlternativo` obligatorio) y `CelebraRecursos`.
  Un recurso lleva un archivo del Banco **o** un enlace `https://`, nunca ambos ni ninguno (CHECK). El grupo «Aliados» (o «Logos de aliados») no es de la caja de herramientas: la página muestra cada recurso como logotipo del aliado cuyo nombre
  coincide con su `Titulo` en el texto `Aliados` de la edición.
- **No tiene noticias ni agenda propias**: son las generales filtradas por el proyecto de la edición (`EventosAgendaProyectosTransversales`, `NoticiasProyectosTransversales`).
- Un archivo del Banco se sirve a anónimos mientras la edición que lo cita esté publicada (portada, galería y recursos)."""),
    ("coincidencias_reclamaciones", "Coincidencias, vinculaciones y reclamaciones", [
        "RegistrosDuplicadosCandidatos", "SolicitudesVinculacionRegistros", "ReclamacionesAdministracion", "ReclamacionesAclaraciones", "ReclamacionesConciliaciones",
        "TransferenciasAdministracion", "RegistrosCalidadDatos"],
     """- **Reclamación** (`ReclamacionesAdministracion`): `Estado` ∈ {`borrador`, `enviada`, `en_revision`, `requiere_aclaracion`, `aclaracion_enviada`, `aprobada`, `rechazada`, `cancelada`, `transferencia_ejecutada`, `historica`}.
  Activas: `borrador`, `enviada`, `en_revision`, `requiere_aclaracion`, `aclaracion_enviada`, `aprobada` (`EsActiva` es columna CALCULADA a partir del estado: no se inserta; integridad: una sola activa por registro canónico). Transiciones: `borrador` → `enviada` → `en_revision` → {`requiere_aclaracion` → `aclaracion_enviada` → `en_revision` | `aprobada` | `rechazada`};
  `aprobada` → `transferencia_ejecutada` (concilia y mueve la administración; escribe `TransferenciasAdministracion`); `cancelada` desde la organización; `historica` es el cierre de lo anterior al modelo actual.
  `FechaEnvio` desde `enviada`; `FechaDecision`/`DecisorId`/`MotivoDecision` en `aprobada`/`rechazada`; `SenalesJson` y `Justificacion` obligatorios; la organización solicitante NO es la responsable actual.
- `ReclamacionesAclaraciones`: pregunta de la gestión + respuesta de la organización (con soportes `ArchivosDeRegistro`, módulo `reclamaciones-administracion`).
- **Vinculación** (`SolicitudesVinculacionRegistros`): `Estado` ∈ {`pendiente`, `en_revision`, `ajustes_solicitados`, `aprobada`, `rechazada`, `cancelada`}; `AlcanceSolicitado` ∈ {`editor`, `responsable`}; `Justificacion` obligatoria; revisor y comentario al decidir.
- **Duplicados/coincidencias** (`RegistrosDuplicadosCandidatos`): `NivelCoincidencia` ∈ {`alta`, `media`, `baja`}; `Estado` ∈ {`pendiente`, `resuelto`}; `Decision` ∈ {`pendiente`, `fusionar`, `mantener_separados`, `no_duplicado`} (nula = sin decidir).
- Escenarios a sembrar: coincidencia clara (1 candidato alto), parcial, varios candidatos, ninguna, histórico sin reclamar, ya reclamado (`transferencia_ejecutada`), solicitud pendiente, aprobada, rechazada, devuelta (`requiere_aclaracion`).
  **No se simulan resultados que la plataforma no produce**: las coincidencias del buscador se calculan, no se insertan; solo se insertan candidatos de duplicado cuando el API los produce.
- `RegistrosCalidadDatos`: `Severidad` ∈ {`alta`, `media`, `baja`}; `Estado` ∈ {`abierta`, `en_revision`, `resuelta`, `descartada`}."""),
]

# Tablas de referencia que se PRESERVAN en la limpieza (catálogos, roles, divisiones territoriales, configuración).
CATALOGOS = [
    "Divipola", "DepartamentosRegionOcad", "RegionesOcad", "Roles", "Permisos", "RolesPermisos", "EstadosContenido", "PracticasMusicales", "TerritoriosSonoros",
    "FichasConceptualesPracticasMusicales", "FichasConceptualesTerritoriosSonoros", "ExpresionesArtisticas", "ModalidadesParticipacion", "TiposIngreso", "TiposOrganizador",
    "NaturalezasEntidad", "Periodicidades", "TipologiasFestival", "ModalidadesMercado", "AlcancesMercado", "FuentesFinanciacion", "PoliticasDatos", "TiposDocumento", "Sexos",
    "IdentidadesGenero", "OrientacionesSexuales", "PertenenciasEtnicas", "EnfoquesDiferenciales", "TiposDiscapacidad", "ZonasUrbanoRural", "Idiomas",
    "ValoresDeTaxonomiaDePerfiles", "FamiliasDeInstrumentos", "ServiciosDeTaller", "TiposDeEspacio", "EquipamientoDeEspacio", "EquipamientoDeEspacio",
    "FormasDeAccesoDeRed", "FormatosDeDocumentacion", "CatalogosReferenciaFuente", "Categorias", "MenuElementos", "SchemaVersions",
]

# Tablas que existen pero la siembra no toca: configuración del sitio, importaciones, seguridad de sesión, microsito Celebra, respaldos.
NO_SEMBRAR = {
    "Contenido del sitio y configuración": ["TextosSitio", "TextosSitioHistorial", "ContenidoWeb", "ContenidoWebHistorial", "EquipoWeb", "ModulosPorCuenta", "MenuElementos"],
    "Importaciones gobernadas": ["LotesImportacion", "FilasImportacion", "DecisionesImportacion", "HallazgosImportacion", "ExtraccionesAsistidas"],
    "Sesión y seguridad (efímeras)": ["IntentosDeIngresoFallidos", "UsuariosCodigosVerificacion", "RestablecimientosDeContrasena"],
    "Respaldos de migración": ["CambiosDeRegistro_RespaldoClase_20261119"],
    "Formularios públicos": ["Participaciones"],
}

# Orden de limpieza y de siembra por dependencias (se calcula de las FK y se imprime; esto solo da prioridad a los grupos).
def cargar(ruta: Path) -> dict:
    inv = json.loads(ruta.read_text(encoding="utf-8"))
    por_tabla = defaultdict(lambda: {"cols": [], "uq": [], "fk": [], "ck": [], "df": {}})
    for c in inv["columnas"]:
        por_tabla[c["tabla"]]["cols"].append(c)
    for k in inv["claves"]:
        por_tabla[k["tabla"]]["uq"].append(k)
    for f in inv["foraneas"]:
        por_tabla[f["tabla"]]["fk"].append(f)
    for c in inv["checks"]:
        por_tabla[c["tabla"]]["ck"].append(c)
    for d in inv["defectos"]:
        por_tabla[d["tabla"]]["df"][d["columna"]] = d["definicion"]
    return por_tabla


def tipo_sql(c: dict) -> str:
    t, n = c["tipo"], c["longitud"]
    if t in ("nvarchar", "varchar", "nchar", "char", "varbinary"):
        return f"{t}({'max' if n in (-1, None) else n})"
    return t


def tabla_md(nombre: str, d: dict) -> list:
    cols = sorted(d["cols"], key=lambda c: c["orden"])
    out = [f"##### `{nombre}`", ""]
    partes = []
    for c in cols:
        marca = "" if c["admite_nulo"] or c["es_identidad"] or c["es_calculada"] or c["columna"] in d["df"] else "*"
        extra = "↑id" if c["es_identidad"] else ("(calc.)" if c["es_calculada"] else "")
        defecto = f"={d['df'][c['columna']]}" if c["columna"] in d["df"] else ""
        partes.append(f"`{c['columna']}`{marca} {tipo_sql(c)}{extra}{defecto}")
    out.append("Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): " + "; ".join(partes) + ".")
    pk = [k for k in d["uq"] if k["es_pk"]]
    if pk:
        out.append(f"- PK: `{pk[0]['columnas']}`")
    for k in d["uq"]:
        if not k["es_pk"]:
            out.append(f"- Único `{k['indice']}`: `({k['columnas']})`" + (f" donde `{k['filtro']}`" if k.get("filtro") else ""))
    for f in sorted(d["fk"], key=lambda f: f["restriccion"]):
        out.append(f"- FK `{f['columna']}` → `{f['tabla_referida']}.{f['columna_referida']}`")
    for c in sorted(d["ck"], key=lambda c: c["restriccion"]):
        out.append(f"- CHECK `{c['restriccion']}`: `{c['definicion'].replace(chr(10), ' ')}`")
    out.append("")
    return out


def orden_topologico(tablas: list, por_tabla: dict) -> list:
    pendientes = {t: {f["tabla_referida"] for f in por_tabla[t]["fk"] if f["tabla_referida"] != t and f["tabla_referida"] in tablas} for t in tablas}
    orden = []
    while pendientes:
        listas = sorted(t for t, deps in pendientes.items() if not (deps - set(orden)))
        if not listas:  # ciclo: se rompe por orden alfabético y se anota
            listas = [sorted(pendientes)[0]]
        for t in listas:
            orden.append(t)
            pendientes.pop(t)
    return orden


def clasificadas() -> set:
    s = set()
    for _, _, tablas, _ in TIPOS:
        s.update(tablas)
    s.update(CATALOGOS)
    for tablas in NO_SEMBRAR.values():
        s.update(tablas)
    return s


def generar(ruta: Path, comprobar: bool = False) -> int:
    por_tabla = cargar(ruta)
    sin_clasificar = sorted(set(por_tabla) - clasificadas())
    inexistentes = sorted(clasificadas() - set(por_tabla))
    if sin_clasificar or inexistentes:
        print("Tablas sin clasificar:", sin_clasificar, "| nombradas que no existen:", inexistentes, file=sys.stderr)
        if comprobar:
            return 1
    if comprobar:
        print(f"OK: {len(por_tabla)} tablas, todas clasificadas.")
        return 0
    sembrables = [t for _, _, tablas, _ in TIPOS for t in tablas if t in por_tabla]
    vistas, unicas = set(), []
    for t in sembrables:
        if t not in vistas:
            vistas.add(t)
            unicas.append(t)
    orden = orden_topologico(unicas, por_tabla)
    md = [
        "# SIMUS — mapa de campos para la siembra de demostración (generado)",
        "",
        ">. Generado por `siembra/generador/mapa_de_campos.py` desde el esquema real (base de PRUEBA con todas las migraciones, "
        f"{len(por_tabla)} tablas) y las notas curadas de ese guion. No se edita a mano: se regenera. Es documentación del kit de demo, no del producto.",
        "",
        "Convenciones: «obligatorio» = columna `NOT NULL` sin valor por defecto ni identidad. Los estados son los admitidos por CHECK/FK; las «transiciones» "
        "salen del API (`EstadosFestival`, `EstadosDeOrganizacion`, `ReclamacionesAdministracionEndpoints`, `PropuestasDeCambio`). Lo que el esquema no impide pero el API no escribe se marca como «no se siembra».",
        "",
        "## Índice de tipos de entidad",
        "",
    ]
    for tid, titulo, tablas, _ in TIPOS:
        md.append(f"- [{titulo}](#{tid}) — {len([t for t in tablas if t in por_tabla])} tablas")
    md += ["- [Catálogos que se preservan](#catalogos)", "- [Tablas que la siembra no toca](#no-sembrar)", "- [Orden de inserción por dependencias](#orden)", ""]
    emitidas: set = set()
    for tid, titulo, tablas, notas in TIPOS:
        md += [f'<a id="{tid}"></a>', f"## {titulo}", "", notas, "", "**Tablas:** " + ", ".join(f"`{t}`" for t in tablas if t in por_tabla), ""]
        for t in tablas:
            if t in por_tabla and t not in emitidas:
                emitidas.add(t)
                md += tabla_md(t, por_tabla[t])
            elif t in emitidas:
                md += [f"##### `{t}`", "", "Descrita arriba (la tabla sirve a más de un tipo).", ""]
    md += ['<a id="catalogos"></a>', "## Catálogos que se preservan (la limpieza NO los vacía)", "",
           "Divisiones territoriales, roles y permisos, estados de contenido, prácticas, territorios sonoros, géneros y demás catálogos de referencia, categorías, menú y el diario de migraciones. La siembra solo LEE de ellos (códigos válidos para las FK).", ""]
    for t in sorted(set(CATALOGOS)):
        if t in por_tabla:
            pk = [k for k in por_tabla[t]["uq"] if k["es_pk"]]
            md.append(f"- `{t}` (PK `{pk[0]['columnas'] if pk else '—'}`; {len(por_tabla[t]['cols'])} columnas)")
    md += ["", '<a id="no-sembrar"></a>', "## Tablas que la siembra no toca", ""]
    for grupo, tablas in NO_SEMBRAR.items():
        md.append(f"- **{grupo}:** " + ", ".join(f"`{t}`" for t in tablas if t in por_tabla))
    md += ["", '<a id="orden"></a>', "## Orden de inserción por dependencias (FK reales)", "",
           "Calculado de las FK entre las tablas sembrables; la limpieza usa el orden inverso. Las referencias polimórficas (`ModuloId`+`RegistroId`) no son FK: el generador las valida aparte.", "",
           " → ".join(f"`{t}`" for t in orden), ""]
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"Escrito {DESTINO.relative_to(RAIZ)} ({len(md)} líneas, {len(unicas)} tablas sembrables).")
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sys.exit(generar(Path(args[0]), "--comprobar" in sys.argv))
