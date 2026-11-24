# SIMUS — mapa de campos para la siembra de demostración (generado)

>. Generado por `siembra/generador/mapa_de_campos.py` desde el esquema real (base de PRUEBA con todas las migraciones, 162 tablas) y las notas curadas de ese guion. No se edita a mano: se regenera. Es documentación del kit de demo, no del producto.

Convenciones: «obligatorio» = columna `NOT NULL` sin valor por defecto ni identidad. Los estados son los admitidos por CHECK/FK; las «transiciones» salen del API (`EstadosFestival`, `EstadosDeOrganizacion`, `ReclamacionesAdministracionEndpoints`, `PropuestasDeCambio`). Lo que el esquema no impide pero el API no escribe se marca como «no se siembra».

## Índice de tipos de entidad

- [Personas y perfiles](#personas) — 8 tablas
- [Organizaciones](#organizaciones) — 5 tablas
- [Festivales y ediciones](#festivales) — 11 tablas
- [Mercados, ediciones y agenda de citas](#mercados) — 9 tablas
- [Redes, lutería (talleres) y espacios](#redes_luteria_espacios) — 12 tablas
- [Eventos y agenda](#eventos) — 6 tablas
- [Noticias](#noticias) — 6 tablas
- [Catálogo editorial (acervo)](#editorial) — 15 tablas
- [Proyectos transversales, etiquetas y categorías](#proyectos_etiquetas) — 4 tablas
- [Galería pública (álbumes de fotos, de videos y mixtos)](#galeria) — 2 tablas
- [Archivos y multimedia](#multimedia) — 3 tablas
- [Equipos e invitaciones](#equipos_invitaciones) — 3 tablas
- [Notificaciones](#notificaciones) — 1 tablas
- [Solicitudes de revisión, propuestas e historiales](#revisiones) — 10 tablas
- [Celebra la música: ediciones del micrositio](#celebra) — 5 tablas
- [Coincidencias, vinculaciones y reclamaciones](#coincidencias_reclamaciones) — 7 tablas
- [Catálogos que se preservan](#catalogos)
- [Tablas que la siembra no toca](#no-sembrar)
- [Orden de inserción por dependencias](#orden)

<a id="personas"></a>
## Personas y perfiles

**Una persona = una fila de `Usuarios` (rol `externo`) + una de `PerfilesPublicos` (misma clave `IdUsuario`).** El perfil público
es 1:1 con el usuario; `ClavePublica` es el identificador de la URL (única). Biografía corta/larga, portafolio y organizaciones visibles
viajan en columnas JSON (`PortafolioJson`, `OrganizacionesVisiblesJson`, `RolesJson`): el generador debe emitir JSON válido.
- `Usuarios.CanalAcceso`: `externo` (personas y organizaciones) o `interno` (gestión). Sin CHECK en la base; el API solo escribe esos dos. `TipoPerfil`: `individual` (persona) u `organizacion` (cuenta que administra organizaciones).
- `Usuarios.HashContrasena`: hash de ASP.NET Identity (V3). La clave de demostración es «admin» (ver kit/cuentas).
- Correo con formato `x@y.z` (CHECK) y único por cuenta; `Identificacion` opcional, 3+ caracteres `[0-9A-Za-z-]`; **nunca documentos reales**.
- `CorreoConfirmado=1` para poder ingresar; `DebeCambiarContrasena=0` y `PerfilCompletado=1` para que no pase por el primer ingreso.
- `PerfilesPublicos.Visibilidad`: `publico` | `solo_simus`. Moderación: `OcultoPorModeracion` + motivo/fecha/moderador (los tres juntos).
- Autorizaciones: una fila por finalidad (`perfil_publico`, `boletin`, `terminos`, `tratamiento`) y origen (`cuenta`, `consola`, `noticias`, `portada`, `registro`).
- Dependencias: `TiposDocumento`, `Divipola` (residencia), `Roles`, `PoliticasDatos`, taxonomías de perfiles (`ValoresDeTaxonomiaDePerfiles`).
- Estados: no hay máquina de estados propia; la cuenta es `Activo` 0/1 y el perfil es visible/oculto por moderación.

**Tablas:** `Usuarios`, `UsuariosRoles`, `PerfilesPublicos`, `PerfilesPublicosClasificaciones`, `PerfilesPublicosEnlaces`, `PerfilesPublicosPracticas`, `AutorizacionesDatos`, `BoletinSuscripciones`

##### `Usuarios`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdUsuario` int↑id; `NombreCompleto`* nvarchar(180); `CorreoElectronico`* nvarchar(180); `HashContrasena`* nvarchar(500); `CanalAcceso` nvarchar(40)=(N'interno'); `TipoPerfil` nvarchar(80); `Activo` bit=((1)); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `UltimoAcceso` datetime2; `Telefono` nvarchar(80); `Identificacion` nvarchar(60); `CodigoTipoDocumento` nvarchar(20); `CorreoConfirmado` bit=((0)); `FechaConfirmacionCorreo` datetime2; `PrimerNombre` nvarchar(80); `SegundoNombre` nvarchar(80); `PrimerApellido` nvarchar(80); `SegundoApellido` nvarchar(80); `DebeCambiarContrasena` bit=((0)); `PerfilCompletado` bit=((1)); `ResidenciaCodigoDepartamento` char(2); `ResidenciaCodigoMunicipio` char(5); `CanalDeContactoPreferido` varchar(10); `GeneracionDeSesion` int=((0)).
- PK: `IdUsuario`
- Único `UQ_Usuarios_CorreoElectronico`: `(CorreoElectronico)`
- Único `UQ_Usuarios_Documento`: `(CodigoTipoDocumento,Identificacion)` donde `([Identificacion] IS NOT NULL)`
- FK `ResidenciaCodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `ResidenciaCodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `CodigoTipoDocumento` → `TiposDocumento.CodigoTipoDocumento`
- CHECK `CK_Usuarios_CanalDeContacto`: `([CanalDeContactoPreferido] IS NULL OR ([CanalDeContactoPreferido]=N'telefono' OR [CanalDeContactoPreferido]=N'correo'))`
- CHECK `CK_Usuarios_CorreoElectronico_Formato`: `([CorreoElectronico] like '%_@_%._%')`
- CHECK `CK_Usuarios_Documento_Completo`: `([Identificacion] IS NULL AND [CodigoTipoDocumento] IS NULL OR [Identificacion] IS NOT NULL AND [CodigoTipoDocumento] IS NOT NULL)`
- CHECK `CK_Usuarios_Identificacion_Formato`: `([Identificacion] IS NULL OR len([Identificacion])>=(3) AND NOT [Identificacion] like '%[^0-9A-Za-z-]%')`
- CHECK `CK_Usuarios_ResidenciaCoherente`: `([ResidenciaCodigoMunicipio] IS NULL OR [ResidenciaCodigoDepartamento] IS NOT NULL AND left([ResidenciaCodigoMunicipio],(2))=[ResidenciaCodigoDepartamento])`

##### `UsuariosRoles`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdUsuarioRol` int↑id; `IdUsuario`* int; `IdRol`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdUsuarioRol`
- Único `UQ_UsuariosRoles`: `(IdUsuario,IdRol)`
- FK `IdRol` → `Roles.IdRol`
- FK `IdUsuario` → `Usuarios.IdUsuario`

##### `PerfilesPublicos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdUsuario`* int; `ClavePublica` uniqueidentifier=(newid()); `NombreVisible`* nvarchar(120); `CodigoMunicipio` nvarchar(10); `ArchivoFotoId` int; `OcultoPorModeracion` bit=((0)); `MotivoModeracion` nvarchar(500); `FechaModeracion` datetime2; `IdUsuarioModera` int; `FechaCreacion`* datetime2; `FechaActualizacion` datetime2; `NombreCivilVisible` bit=((0)); `BiografiaCorta` nvarchar(280); `BiografiaLarga` nvarchar(4000); `Visibilidad` nvarchar(12)=(N'publico'); `RolesJson` nvarchar(max); `PortafolioJson` nvarchar(max); `OrganizacionesVisiblesJson` nvarchar(max).
- PK: `IdUsuario`
- Único `UQ_PerfilesPublicos_ClavePublica`: `(ClavePublica)`
- FK `ArchivoFotoId` → `Archivos.IdArchivo`
- FK `IdUsuarioModera` → `Usuarios.IdUsuario`
- FK `IdUsuario` → `Usuarios.IdUsuario`
- CHECK `CK_PerfilesPublicos_Json`: `(([RolesJson] IS NULL OR isjson([RolesJson])=(1)) AND ([PortafolioJson] IS NULL OR isjson([PortafolioJson])=(1)) AND ([OrganizacionesVisiblesJson] IS NULL OR isjson([OrganizacionesVisiblesJson])=(1)))`
- CHECK `CK_PerfilesPublicos_Moderacion`: `([OcultoPorModeracion]=(0) OR [MotivoModeracion] IS NOT NULL AND len([MotivoModeracion])>(0) AND [FechaModeracion] IS NOT NULL)`
- CHECK `CK_PerfilesPublicos_Visibilidad`: `([Visibilidad]=N'solo_simus' OR [Visibilidad]=N'publico')`

##### `PerfilesPublicosClasificaciones`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdUsuario`* int; `Dimension`* nvarchar(12); `Codigo`* nvarchar(40).
- PK: `IdUsuario,Dimension,Codigo`
- FK `IdUsuario` → `PerfilesPublicos.IdUsuario`
- CHECK `CK_PerfilesPublicosClasificaciones_Dimension`: `([Dimension]=N'territorio' OR [Dimension]=N'instrumento' OR [Dimension]=N'servicio' OR [Dimension]=N'rol')`

##### `PerfilesPublicosEnlaces`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEnlace` int↑id; `IdUsuario`* int; `Orden`* tinyint; `Url`* nvarchar(400); `Etiqueta` nvarchar(60).
- PK: `IdEnlace`
- Único `UX_PerfilesPublicosEnlaces_Orden`: `(IdUsuario,Orden)`
- FK `IdUsuario` → `PerfilesPublicos.IdUsuario`
- CHECK `CK_PerfilesPublicosEnlaces_Https`: `([Url] like N'https://_%')`
- CHECK `CK_PerfilesPublicosEnlaces_Orden`: `([Orden]>=(1) AND [Orden]<=(5))`

##### `PerfilesPublicosPracticas`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdUsuario`* int; `IdPracticaMusical`* int.
- PK: `IdUsuario,IdPracticaMusical`
- FK `IdUsuario` → `PerfilesPublicos.IdUsuario`
- FK `IdPracticaMusical` → `PracticasMusicales.IdPracticaMusical`

##### `AutorizacionesDatos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdAutorizacion` bigint↑id; `Finalidad`* nvarchar(40); `IdPolitica`* int; `Version`* nvarchar(40); `TextoAceptado`* nvarchar(max); `TextoReconstruido` bit=((0)); `IdUsuario` int; `CorreoTitular` nvarchar(180); `Origen`* nvarchar(40); `ReferenciaId` nvarchar(120); `FechaOtorgada` datetime2=(sysutcdatetime()); `FechaRevocacion` datetime2; `MotivoRevocacion` nvarchar(400).
- PK: `IdAutorizacion`
- FK `IdPolitica` → `PoliticasDatos.IdPolitica`
- FK `IdUsuario` → `Usuarios.IdUsuario`
- CHECK `CK_AutorizacionesDatos_Fechas`: `([FechaRevocacion] IS NULL OR [FechaRevocacion]>=[FechaOtorgada])`
- CHECK `CK_AutorizacionesDatos_Finalidad`: `([Finalidad]=N'perfil_publico' OR [Finalidad]=N'boletin' OR [Finalidad]=N'terminos' OR [Finalidad]=N'tratamiento')`
- CHECK `CK_AutorizacionesDatos_Origen`: `([Origen]=N'cuenta' OR [Origen]=N'consola' OR [Origen]=N'noticias' OR [Origen]=N'portada' OR [Origen]=N'registro')`
- CHECK `CK_AutorizacionesDatos_Titular`: `([IdUsuario] IS NOT NULL OR [CorreoTitular] IS NOT NULL)`

##### `BoletinSuscripciones`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdSuscripcion` int↑id; `CorreoElectronico`* nvarchar(180); `Origen` nvarchar(60)=(N'portada'); `Estado` nvarchar(30)=(N'activa'); `FechaAlta` datetime2=(sysutcdatetime()); `FechaBaja` datetime2; `Confirmada` bit=((0)); `FechaConfirmacion` datetime2; `HashTestigo` nvarchar(64); `FechaEmisionTestigo` datetime2.
- PK: `IdSuscripcion`
- Único `UQ_BoletinSuscripciones_Correo`: `(CorreoElectronico)`
- Único `UX_BoletinSuscripciones_HashTestigo`: `(HashTestigo)` donde `([HashTestigo] IS NOT NULL)`
- CHECK `CK_BoletinSuscripciones_Correo_Formato`: `([CorreoElectronico] like '%_@_%._%')`
- CHECK `CK_BoletinSuscripciones_Estado`: `([Estado]=N'baja' OR [Estado]=N'activa')`
- CHECK `CK_BoletinSuscripciones_FechaBaja`: `([Estado]=N'baja' AND [FechaBaja] IS NOT NULL OR [Estado]=N'activa' AND [FechaBaja] IS NULL)`

<a id="organizaciones"></a>
## Organizaciones

**`Entidades` solo admite `TipoEntidad='organizacion'`** (CHECK). La fila 1 es la entidad institucional del PNMC (`EsInstitucional=1`) y no se toca.
- `EstadoRegistro` (FK a `EstadosContenido` + CHECK): `pendiente_de_confirmacion` → `activa` ⇄ `inactiva` → `eliminada`. `Activo` debe ser coherente
  (`CK_Entidades_VigenciaCoherente`): 1 para `activa`/`pendiente_de_confirmacion`, 0 para `inactiva`/`eliminada`.
- Transiciones: nace `pendiente_de_confirmacion` (alta externa) → `activa` al confirmar el correo; `activa` ⇄ `inactiva` (reversible); `eliminada` exige resolver
  antes los procesos (custodia: liberar la administración). La demo usa casi todo `activa` y deja algunas `inactiva`/`pendiente_de_confirmacion` para la consola.
- `IdUsuarioCreador` obligatorio; `IdUsuarioResponsable` opcional (la persona responsable). Sede principal: `CodigoDepartamentoSede`/`CodigoMunicipioSede` (FK a `Divipola`).
- `NumeroIdentificacion`/`TipoIdentificacion` (NIT) opcional; un correo de contacto pertenece a una sola organización (índice único del 28-ago).
- Fechas coherentes: `FechaCreacion` ≤ `FechaRevision` ≤ `FechaAprobacion` ≤ `FechaPublicacion` cuando existan.
- Equipo: `UsuariosEntidades.RolEntidad` ∈ {`administrador`, `editor`}; único por (usuario, entidad). Cada organización activa necesita al menos un administrador.
- Invitaciones: `Estado` ∈ {`pendiente`, `aceptada`, `revocada`, `vencida`}; `RolEntidad` ∈ {`administrador`, `editor`}.

**Tablas:** `Entidades`, `EntidadesResponsable`, `UsuariosEntidades`, `InvitacionesDeOrganizacion`, `ConfirmacionesDeCorreo`

##### `Entidades`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEntidad` int↑id; `TipoEntidad`* nvarchar(80); `Nombre`* nvarchar(240); `NombreLegal` nvarchar(240); `Descripcion` nvarchar(max); `CorreoContacto` nvarchar(180); `TelefonoContacto` nvarchar(80); `SitioWeb` nvarchar(500); `Facebook` nvarchar(500); `Instagram` nvarchar(500); `OtroEnlace` nvarchar(500); `Direccion` nvarchar(300); `EstadoRegistro` nvarchar(80)=(N'pendiente_de_confirmacion'); `Activo` bit=((1)); `IdUsuarioCreador`* int; `IdUsuarioResponsable` int; `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `FechaRevision` datetime2; `FechaAprobacion` datetime2; `FechaPublicacion` datetime2; `NumeroIdentificacion` nvarchar(60); `TipoIdentificacion` nvarchar(40); `EsInstitucional` bit=((0)); `CodigoDepartamentoSede` char(2); `CodigoMunicipioSede` char(5); `ArchivoFotoId` int; `FechaRevisionConsola` datetime2; `IdUsuarioRevisionConsola` int.
- PK: `IdEntidad`
- Único `UQ_Entidades_EsInstitucional`: `(EsInstitucional)` donde `([EsInstitucional]=(1))`
- Único `UQ_Entidades_NumeroIdentificacion`: `(NumeroIdentificacion)` donde `([NumeroIdentificacion] IS NOT NULL)`
- Único `UX_Entidades_CorreoContacto`: `(CorreoContacto)` donde `([CorreoContacto] IS NOT NULL)`
- FK `ArchivoFotoId` → `Archivos.IdArchivo`
- FK `EstadoRegistro` → `EstadosContenido.CodigoEstado`
- FK `CodigoDepartamentoSede` → `Divipola.CodigoDepartamento`
- FK `CodigoMunicipioSede` → `Divipola.CodigoMunicipio`
- FK `IdUsuarioCreador` → `Usuarios.IdUsuario`
- FK `IdUsuarioResponsable` → `Usuarios.IdUsuario`
- FK `IdUsuarioRevisionConsola` → `Usuarios.IdUsuario`
- CHECK `CK_Entidades_EstadoRegistro`: `([EstadoRegistro]=N'eliminada' OR [EstadoRegistro]=N'inactiva' OR [EstadoRegistro]=N'activa' OR [EstadoRegistro]=N'pendiente_de_confirmacion')`
- CHECK `CK_Entidades_RevisionConsolaCoherente`: `([FechaRevisionConsola] IS NULL AND [IdUsuarioRevisionConsola] IS NULL OR [FechaRevisionConsola] IS NOT NULL AND [IdUsuarioRevisionConsola] IS NOT NULL)`
- CHECK `CK_Entidades_Sede_Completa`: `([CodigoDepartamentoSede] IS NULL AND [CodigoMunicipioSede] IS NULL OR [CodigoDepartamentoSede] IS NOT NULL AND [CodigoMunicipioSede] IS NOT NULL)`
- CHECK `CK_Entidades_Tipo`: `([TipoEntidad]=N'organizacion')`
- CHECK `CK_Entidades_VigenciaCoherente`: `(([EstadoRegistro]=N'activa' OR [EstadoRegistro]=N'pendiente_de_confirmacion') AND [Activo]=(1) OR ([EstadoRegistro]=N'eliminada' OR [EstadoRegistro]=N'inactiva') AND [Activo]=(0))`

##### `EntidadesResponsable`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEntidad`* int; `ResponsableNombre`* nvarchar(240); `ResponsableTipoDocumento`* nvarchar(40); `ResponsableNumeroDocumento`* nvarchar(40); `ResponsableCorreo`* nvarchar(320); `ResponsableTelefono` nvarchar(80); `ResponsableDesde` datetime2=(sysutcdatetime()); `ResponsableAutorizacionDatos` bit=((0)); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `ResponsablePrimerNombre` nvarchar(80); `ResponsableSegundoNombre` nvarchar(80); `ResponsablePrimerApellido` nvarchar(80); `ResponsableSegundoApellido` nvarchar(80).
- PK: `IdEntidad`
- FK `IdEntidad` → `Entidades.IdEntidad`

##### `UsuariosEntidades`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdUsuarioEntidad` int↑id; `IdUsuario`* int; `IdEntidad`* int; `RolEntidad`* nvarchar(80); `Activo` bit=((1)); `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdUsuarioEntidad`
- Único `UQ_UsuariosEntidades`: `(IdUsuario,IdEntidad,RolEntidad)`
- FK `IdEntidad` → `Entidades.IdEntidad`
- FK `IdUsuario` → `Usuarios.IdUsuario`
- CHECK `CK_UsuariosEntidades_Rol`: `([RolEntidad]=N'editor' OR [RolEntidad]=N'administrador')`

##### `InvitacionesDeOrganizacion`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdInvitacion` int↑id; `IdEntidad`* int; `CorreoInvitado`* nvarchar(240); `RolEntidad`* nvarchar(20); `HashTestigo`* nvarchar(64); `Estado` nvarchar(20)=(N'pendiente'); `IdUsuarioInvita`* int; `FechaEmision`* datetime2; `FechaExpiracion`* datetime2; `IdUsuarioAcepta` int; `FechaCierre` datetime2.
- PK: `IdInvitacion`
- Único `UQ_InvitacionesDeOrganizacion_HashTestigo`: `(HashTestigo)`
- Único `UX_InvitacionesDeOrganizacion_PendientePorCorreo`: `(IdEntidad,CorreoInvitado)` donde `([Estado]=N'pendiente')`
- FK `IdUsuarioAcepta` → `Usuarios.IdUsuario`
- FK `IdEntidad` → `Entidades.IdEntidad`
- FK `IdUsuarioInvita` → `Usuarios.IdUsuario`
- CHECK `CK_InvitacionesDeOrganizacion_Estado`: `([Estado]=N'vencida' OR [Estado]=N'revocada' OR [Estado]=N'aceptada' OR [Estado]=N'pendiente')`
- CHECK `CK_InvitacionesDeOrganizacion_Rol`: `([RolEntidad]=N'editor' OR [RolEntidad]=N'administrador')`
- CHECK `CK_InvitacionesDeOrganizacion_Vigencia`: `([FechaExpiracion]>[FechaEmision])`

##### `ConfirmacionesDeCorreo`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdConfirmacionDeCorreo` int↑id; `IdUsuario`* int; `CorreoDestino`* nvarchar(240); `HashTestigo`* char(64); `FechaEmision` datetime2=(sysutcdatetime()); `FechaExpiracion`* datetime2; `FechaUso` datetime2.
- PK: `IdConfirmacionDeCorreo`
- Único `UQ_ConfirmacionesDeCorreo_HashTestigo`: `(HashTestigo)`
- FK `IdUsuario` → `Usuarios.IdUsuario`
- CHECK `CK_ConfirmacionesDeCorreo_Vigencia`: `([FechaExpiracion]>[FechaEmision])`

<a id="festivales"></a>
## Festivales y ediciones

**Festival** (`Festivales`) y **edición** (`EdicionesFestival`, N por festival). Las tablas `…DeRegistro` son pivotes polimórficos: `ModuloId` ∈ {`festivales`,
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
- Trayectorias a cubrir: muchas ediciones (5–6), 2, 1, ninguna; interrupciones (años sin edición), cambio de sede, ediciones futuras de demostración.

**Tablas:** `Festivales`, `EdicionesFestival`, `FestivalesReferenciasHistoricas`, `PracticasMusicalesDeRegistro`, `TerritoriosSonorosDeRegistro`, `TiposIngresoDeRegistro`, `ModalidadesParticipacionDeRegistro`, `ExpresionesArtisticasDeRegistro`, `EntidadesAliadasDeRegistro`, `LocalizacionesDeRegistro`, `ArchivosDeRegistro`

##### `Festivales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdFestival` int↑id; `NombreFestival`* nvarchar(220); `NumeroEdiciones` int; `FechaUltimaEdicion` date; `Descripcion` nvarchar(max); `Organizador` nvarchar(220); `CorreoOrganizador` nvarchar(180); `TelefonoOrganizador` nvarchar(80); `SitioWebOrganizador` nvarchar(500); `CorreoFestival` nvarchar(180); `InstagramFestival` nvarchar(500); `FacebookFestival` nvarchar(500); `SitioWebFestival` nvarchar(500); `OtroEnlaceFestival` nvarchar(500); `TelefonoFestival` nvarchar(80); `TieneEdicionVigenteAnoActual` bit=((0)); `EstadoEdicionAnoActual` nvarchar(80); `FechaInicioEdicionActual` date; `FechaFinEdicionActual` date; `NivelCobertura`* nvarchar(40); `CodigoDepartamento` char(2); `CodigoMunicipio` char(5); `EstadoRegistro`* nvarchar(80); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `OrganizacionPrincipalId`* int; `Periodicidad` nvarchar(80); `ObservacionesContacto` nvarchar(600); `PeriodicidadDetalle` nvarchar(600); `FusionadoEnId` int; `FechaFusion` datetime2; `SedeCodigoDepartamento` char(2); `SedeCodigoMunicipio` char(5); `Director` nvarchar(240); `TipoOrganizadorId` int; `OtroTipoOrganizador` nvarchar(200); `PerteneceAOrganizacionColectiva` bit; `NombreOrganizacionColectiva` nvarchar(500).
- PK: `IdFestival`
- FK `CodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `CodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `EstadoRegistro` → `EstadosContenido.CodigoEstado`
- FK `FusionadoEnId` → `Festivales.IdFestival`
- FK `OrganizacionPrincipalId` → `Entidades.IdEntidad`
- FK `Periodicidad` → `Periodicidades.CodigoPeriodicidad`
- FK `SedeCodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `SedeCodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `TipoOrganizadorId` → `TiposOrganizador.IdTipoOrganizador`
- CHECK `CK_Festivales_EstadoRegistro`: `([EstadoRegistro]=N'rechazado' OR [EstadoRegistro]=N'archivado' OR [EstadoRegistro]=N'publicado' OR [EstadoRegistro]=N'aprobado' OR [EstadoRegistro]=N'ajustes_solicitados' OR [EstadoRegistro]=N'en_revision' OR [EstadoRegistro]=N'borrador')`
- CHECK `CK_Festivales_FechasEdicionActual`: `([FechaFinEdicionActual] IS NULL OR [FechaInicioEdicionActual] IS NULL OR [FechaFinEdicionActual]>=[FechaInicioEdicionActual])`
- CHECK `CK_Festivales_FusionCoherente`: `([FusionadoEnId] IS NULL AND [FechaFusion] IS NULL OR [FusionadoEnId] IS NOT NULL AND [FechaFusion] IS NOT NULL AND [EstadoRegistro]=N'archivado')`
- CHECK `CK_Festivales_FusionNoASiMismo`: `([FusionadoEnId] IS NULL OR [FusionadoEnId]<>[IdFestival])`
- CHECK `CK_Festivales_NivelCobertura`: `(([NivelCobertura]=N'municipal' OR [NivelCobertura]=N'departamental' OR [NivelCobertura]=N'nacional') AND ([NivelCobertura]=N'nacional' AND [CodigoDepartamento] IS NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'departamental' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'municipal' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NOT NULL))`
- CHECK `CK_Festivales_NumeroEdiciones`: `([NumeroEdiciones] IS NULL OR [NumeroEdiciones]>=(0))`
- CHECK `CK_Festivales_SedeCoherente`: `([SedeCodigoMunicipio] IS NULL OR [SedeCodigoDepartamento] IS NOT NULL AND left([SedeCodigoMunicipio],(2))=[SedeCodigoDepartamento])`

##### `EdicionesFestival`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEdicionFestival` int↑id; `FestivalId`* int; `Anio` int; `Nombre` nvarchar(240); `Descripcion` nvarchar(max); `FechaInicio` date; `FechaFin` date; `Estado` nvarchar(40)=(N'en_preparacion'); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `Director` nvarchar(240); `EstadoRegistro`* nvarchar(80); `TipologiaFestivalId` int; `OtraTipologia` nvarchar(120); `FuenteFinanciacionPrimariaId` int; `OtraFuenteFinanciacionPrimaria` nvarchar(120); `FuenteFinanciacionSecundariaId` int; `OtraFuenteFinanciacionSecundaria` nvarchar(120); `UsaEstampillaProcultura` bit; `PracticasMusicalesQueCongrega` nvarchar(500); `OtraModalidadParticipacion` nvarchar(120); `OtraExpresionArtistica` nvarchar(120); `NumeroEdicion` int; `EstadoVisibilidad`* nvarchar(40).
- PK: `IdEdicionFestival`
- FK `EstadoRegistro` → `EstadosContenido.CodigoEstado`
- FK `FestivalId` → `Festivales.IdFestival`
- FK `FuenteFinanciacionPrimariaId` → `FuentesFinanciacion.IdFuenteFinanciacion`
- FK `FuenteFinanciacionSecundariaId` → `FuentesFinanciacion.IdFuenteFinanciacion`
- FK `TipologiaFestivalId` → `TipologiasFestival.IdTipologiaFestival`
- CHECK `CK_EdicionesFestival_AnioValido`: `([Anio] IS NULL OR [Anio]>=(1900) AND [Anio]<=(2200))`
- CHECK `CK_EdicionesFestival_Estado`: `([Estado]=N'cancelada' OR [Estado]=N'realizada' OR [Estado]=N'programada' OR [Estado]=N'en_preparacion')`
- CHECK `CK_EdicionesFestival_EstadoRegistro`: `([EstadoRegistro]=N'rechazado' OR [EstadoRegistro]=N'archivado' OR [EstadoRegistro]=N'publicado' OR [EstadoRegistro]=N'aprobado' OR [EstadoRegistro]=N'ajustes_solicitados' OR [EstadoRegistro]=N'en_revision' OR [EstadoRegistro]=N'borrador')`
- CHECK `CK_EdicionesFestival_EstadoVisibilidad`: `([EstadoVisibilidad]=N'archivada' OR [EstadoVisibilidad]=N'publicada' OR [EstadoVisibilidad]=N'borrador')`
- CHECK `CK_EdicionesFestival_Fechas`: `([FechaFin] IS NULL OR [FechaInicio] IS NULL OR [FechaFin]>=[FechaInicio])`
- CHECK `CK_EdicionesFestival_FuentesDistintas`: `([FuenteFinanciacionPrimariaId] IS NULL OR [FuenteFinanciacionSecundariaId] IS NULL OR [FuenteFinanciacionPrimariaId]<>[FuenteFinanciacionSecundariaId])`
- CHECK `CK_EdicionesFestival_Identificacion`: `([Anio] IS NOT NULL OR [NumeroEdicion] IS NOT NULL OR nullif(ltrim(rtrim([Nombre])),N'') IS NOT NULL OR [FechaInicio] IS NOT NULL OR [FechaFin] IS NOT NULL)`
- CHECK `CK_EdicionesFestival_NumeroValido`: `([NumeroEdicion] IS NULL OR [NumeroEdicion]>(0))`

##### `FestivalesReferenciasHistoricas`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdReferenciaHistoricaFestival` int↑id; `IdOrganizacion`* int; `IdFestival`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdReferenciaHistoricaFestival`
- Único `UQ_FestivalesReferenciasHistoricas_Organizacion_Festival`: `(IdOrganizacion,IdFestival)`
- FK `IdFestival` → `Festivales.IdFestival`
- FK `IdOrganizacion` → `Entidades.IdEntidad`

##### `PracticasMusicalesDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdPracticaMusicalDeRegistro` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `IdPracticaMusical`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdPracticaMusicalDeRegistro`
- Único `UQ_PracticasMusicalesDeRegistro`: `(ModuloId,RegistroId,IdPracticaMusical)`
- FK `IdPracticaMusical` → `PracticasMusicales.IdPracticaMusical`
- CHECK `CK_PracticasMusicalesDeRegistro_Modulo`: `([ModuloId]=N'ediciones-mercado' OR [ModuloId]=N'ediciones-festival' OR [ModuloId]=N'festivales')`

##### `TerritoriosSonorosDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdTerritorioSonoroDeRegistro` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `IdTerritorioSonoro`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdTerritorioSonoroDeRegistro`
- Único `UQ_TerritoriosSonorosDeRegistro`: `(ModuloId,RegistroId,IdTerritorioSonoro)`
- FK `IdTerritorioSonoro` → `TerritoriosSonoros.IdTerritorioSonoro`
- CHECK `CK_TerritoriosSonorosDeRegistro_Modulo`: `([ModuloId]=N'ediciones-mercado' OR [ModuloId]=N'ediciones-festival' OR [ModuloId]=N'festivales')`

##### `TiposIngresoDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdTipoIngresoDeRegistro` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `IdTipoIngreso`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdTipoIngresoDeRegistro`
- Único `UQ_TiposIngresoDeRegistro`: `(ModuloId,RegistroId,IdTipoIngreso)`
- FK `IdTipoIngreso` → `TiposIngreso.IdTipoIngreso`
- CHECK `CK_TiposIngresoDeRegistro_Modulo`: `([ModuloId]=N'ediciones-mercado' OR [ModuloId]=N'ediciones-festival' OR [ModuloId]=N'festivales')`

##### `ModalidadesParticipacionDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdModalidadParticipacionDeRegistro` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `IdModalidadParticipacion`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdModalidadParticipacionDeRegistro`
- Único `UQ_ModalidadesParticipacionDeRegistro`: `(ModuloId,RegistroId,IdModalidadParticipacion)`
- FK `IdModalidadParticipacion` → `ModalidadesParticipacion.IdModalidadParticipacion`
- CHECK `CK_ModalidadesParticipacionDeRegistro_Modulo`: `([ModuloId]=N'ediciones-mercado' OR [ModuloId]=N'ediciones-festival' OR [ModuloId]=N'festivales')`

##### `ExpresionesArtisticasDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdExpresionArtisticaDeRegistro` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `IdExpresionArtistica`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdExpresionArtisticaDeRegistro`
- Único `UQ_ExpresionesArtisticasDeRegistro`: `(ModuloId,RegistroId,IdExpresionArtistica)`
- FK `IdExpresionArtistica` → `ExpresionesArtisticas.IdExpresionArtistica`
- CHECK `CK_ExpresionesArtisticasDeRegistro_Modulo`: `([ModuloId]=N'ediciones-mercado' OR [ModuloId]=N'ediciones-festival' OR [ModuloId]=N'festivales')`

##### `EntidadesAliadasDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEntidadAliadaDeRegistro` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `NombreEntidadAliada` nvarchar(300); `CorreoEntidadAliada` nvarchar(180); `NaturalezaEntidadId` int; `EntidadId` int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdEntidadAliadaDeRegistro`
- FK `EntidadId` → `Entidades.IdEntidad`
- FK `NaturalezaEntidadId` → `NaturalezasEntidad.IdNaturalezaEntidad`
- CHECK `CK_EntidadesAliadasDeRegistro_Identificable`: `([EntidadId] IS NOT NULL OR nullif(ltrim(rtrim([NombreEntidadAliada])),N'') IS NOT NULL)`
- CHECK `CK_EntidadesAliadasDeRegistro_Modulo`: `([ModuloId]=N'ediciones-mercado' OR [ModuloId]=N'ediciones-festival' OR [ModuloId]=N'festivales')`

##### `LocalizacionesDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdLocalizacionDeRegistro` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `CodigoDepartamento`* char(2); `CodigoMunicipio`* char(5); `ZonaUrbanoRuralId` int; `TitulacionColectivaId` int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdLocalizacionDeRegistro`
- Único `UQ_LocalizacionesDeRegistro`: `(ModuloId,RegistroId,CodigoDepartamento,CodigoMunicipio,ZonaUrbanoRuralId)`
- FK `CodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `CodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `TitulacionColectivaId` → `TitulacionesColectivas.IdTitulacionColectiva`
- FK `ZonaUrbanoRuralId` → `ZonasUrbanoRural.IdZonaUrbanoRural`
- CHECK `CK_LocalizacionesDeRegistro_Modulo`: `([ModuloId]=N'ediciones-mercado' OR [ModuloId]=N'ediciones-festival' OR [ModuloId]=N'festivales')`
- CHECK `CK_LocalizacionesDeRegistro_Municipio_Departamento`: `(left([CodigoMunicipio],(2))=[CodigoDepartamento])`

##### `ArchivosDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdArchivoDeRegistro` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `ArchivoId` int; `Url` nvarchar(1000); `RolArchivo` nvarchar(80)=(N'material'); `DescripcionArchivo` nvarchar(1000); `OrdenVisualizacion`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdArchivoDeRegistro`
- Único `UQ_ArchivosDeRegistro`: `(ModuloId,RegistroId,RolArchivo,OrdenVisualizacion)`
- FK `ArchivoId` → `Archivos.IdArchivo`
- CHECK `CK_ArchivosDeRegistro_Destino`: `([ArchivoId] IS NOT NULL OR [Url] IS NOT NULL)`
- CHECK `CK_ArchivosDeRegistro_Modulo`: `([ModuloId]=N'reclamaciones-administracion' OR [ModuloId]=N'ediciones-mercado' OR [ModuloId]=N'ediciones-festival' OR [ModuloId]=N'festivales')`
- CHECK `CK_ArchivosDeRegistro_Orden`: `([OrdenVisualizacion]>(0))`

<a id="mercados"></a>
## Mercados, ediciones y agenda de citas

- `Mercados.EstadoRegistro`: siete códigos del catálogo, pero el circuito simple usa `borrador`, `en_revision`, `ajustes_solicitados`, `publicado`, `archivado`, `rechazado` (el CHECK no admite `aprobado` en mercados).
- `EdicionesMercado.Estado`: `en_preparacion`, `programada`, `realizada`, `cancelada`; `EstadoVisibilidad`: `borrador`, `publicado`, `archivado` (nótese el masculino).
- `AlcancesMercado` y `ModalidadesMercado` son catálogos; `NivelCobertura` con la misma regla que festivales.
- Agenda de citas (sólo mercados con rueda de negocios): `AgendasDeCitas.Estado` ∈ {`borrador`, `abierta`, `en_curso`, `cerrada`}; `Modo` ∈ {`compradores_fijos`, `compradores_rotan`};
  `AprobacionDeArtistas` ∈ {`aceptacion`, `automatica`}. Franjas (`FranjasDeCitas`) pertenecen a la agenda.
- `ParticipantesDeCitas`: `Rol` ∈ {`artista`, `comprador`}; artista exige `UsuarioId`; comprador exige `CorreoInvitacion` y `TipoDeComprador` ∈ {`festival`, `sala`, `agencia`, `sello`, `editorial`, `medio`, `institucion`, `otro`};
  `Estado` ∈ {`pendiente`, `aprobado`, `rechazado`, `lista_de_espera`, `retirado`}; `lista_de_espera` solo para artistas.
- `CitasDeAgenda.Estado` ∈ {`solicitada`, `confirmada`, `rechazada`, `cancelada`, `vencida`}; `InvitacionesDeAgenda.Estado` ∈ {`pendiente`, `aceptada`, `revocada`, `vencida`}.

**Tablas:** `Mercados`, `EdicionesMercado`, `MercadosPracticasMusicales`, `MercadosTerritoriosSonoros`, `AgendasDeCitas`, `FranjasDeCitas`, `CitasDeAgenda`, `ParticipantesDeCitas`, `InvitacionesDeAgenda`

##### `Mercados`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdMercado` int↑id; `NombreMercado`* nvarchar(240); `Descripcion` nvarchar(max); `AlcanceMercadoId` int; `ModalidadMercadoId` int; `Periodicidad` nvarchar(80); `PeriodicidadDetalle` nvarchar(240); `CorreoMercado` nvarchar(180); `TelefonoMercado` nvarchar(80); `SitioWebMercado` nvarchar(500); `InstagramMercado` nvarchar(500); `FacebookMercado` nvarchar(500); `OtroEnlaceMercado` nvarchar(500); `ObservacionesContacto` nvarchar(1000); `NivelCobertura`* nvarchar(40); `CodigoDepartamento` char(2); `CodigoMunicipio` char(5); `LugarEspecifico` nvarchar(300); `SeRealizaEnElMarcoDeUnFestival` bit=((0)); `FestivalId` int; `OrganizacionPrincipalId`* int; `EstadoRegistro` nvarchar(80)=(N'borrador'); `Activo` bit=((1)); `IdUsuarioCreador` int; `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `FechaEnvioARevision` datetime2; `FechaPublicacion` datetime2; `FechaArchivado` datetime2; `SedeCodigoDepartamento` char(2); `SedeCodigoMunicipio` char(5).
- PK: `IdMercado`
- FK `AlcanceMercadoId` → `AlcancesMercado.IdAlcanceMercado`
- FK `CodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `CodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `FestivalId` → `Festivales.IdFestival`
- FK `ModalidadMercadoId` → `ModalidadesMercado.IdModalidadMercado`
- FK `OrganizacionPrincipalId` → `Entidades.IdEntidad`
- FK `Periodicidad` → `Periodicidades.CodigoPeriodicidad`
- FK `SedeCodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `SedeCodigoMunicipio` → `Divipola.CodigoMunicipio`
- CHECK `CK_Mercados_EstadoRegistro`: `([EstadoRegistro]=N'rechazado' OR [EstadoRegistro]=N'archivado' OR [EstadoRegistro]=N'publicado' OR [EstadoRegistro]=N'ajustes_solicitados' OR [EstadoRegistro]=N'en_revision' OR [EstadoRegistro]=N'borrador')`
- CHECK `CK_Mercados_FestivalCoherente`: `([SeRealizaEnElMarcoDeUnFestival]=(1) AND [FestivalId] IS NOT NULL OR [SeRealizaEnElMarcoDeUnFestival]=(0) AND [FestivalId] IS NULL)`
- CHECK `CK_Mercados_NivelCobertura`: `(([NivelCobertura]=N'municipal' OR [NivelCobertura]=N'departamental' OR [NivelCobertura]=N'nacional') AND ([NivelCobertura]=N'nacional' AND [CodigoDepartamento] IS NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'departamental' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'municipal' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NOT NULL))`
- CHECK `CK_Mercados_SedeCoherente`: `([SedeCodigoMunicipio] IS NULL OR [SedeCodigoDepartamento] IS NOT NULL AND left([SedeCodigoMunicipio],(2))=[SedeCodigoDepartamento])`

##### `EdicionesMercado`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEdicionMercado` int↑id; `MercadoId`* int; `Anio`* int; `NumeroEdicion` int; `Nombre` nvarchar(240); `Descripcion` nvarchar(max); `FechaInicio` date; `FechaFin` date; `CodigoDepartamento` char(2); `CodigoMunicipio` char(5); `LugarEspecifico` nvarchar(300); `Estado` nvarchar(40)=(N'en_preparacion'); `EstadoVisibilidad` nvarchar(40)=(N'borrador'); `IdUsuarioCreador` int; `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `FechaPublicacion` datetime2.
- PK: `IdEdicionMercado`
- Único `UQ_EdicionesMercado_MercadoAnio`: `(MercadoId,Anio)`
- FK `CodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `CodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `MercadoId` → `Mercados.IdMercado`
- CHECK `CK_EdicionesMercado_Anio`: `([Anio]>=(1900) AND [Anio]<=(2200))`
- CHECK `CK_EdicionesMercado_Estado`: `([Estado]=N'cancelada' OR [Estado]=N'realizada' OR [Estado]=N'programada' OR [Estado]=N'en_preparacion')`
- CHECK `CK_EdicionesMercado_Fechas`: `([FechaInicio] IS NULL OR [FechaFin] IS NULL OR [FechaFin]>=[FechaInicio])`
- CHECK `CK_EdicionesMercado_Visibilidad`: `([EstadoVisibilidad]=N'archivado' OR [EstadoVisibilidad]=N'publicado' OR [EstadoVisibilidad]=N'borrador')`

##### `MercadosPracticasMusicales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdMercadoPracticaMusical` int↑id; `MercadoId`* int; `PracticaMusicalId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdMercadoPracticaMusical`
- Único `UQ_MercadosPracticas_Par`: `(MercadoId,PracticaMusicalId)`
- FK `MercadoId` → `Mercados.IdMercado`
- FK `PracticaMusicalId` → `PracticasMusicales.IdPracticaMusical`

##### `MercadosTerritoriosSonoros`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdMercadoTerritorioSonoro` int↑id; `MercadoId`* int; `TerritorioSonoroId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdMercadoTerritorioSonoro`
- Único `UQ_MercadosTerritorios_Par`: `(MercadoId,TerritorioSonoroId)`
- FK `MercadoId` → `Mercados.IdMercado`
- FK `TerritorioSonoroId` → `TerritoriosSonoros.IdTerritorioSonoro`

##### `AgendasDeCitas`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdAgenda` int↑id; `EdicionMercadoId`* int; `Estado` nvarchar(20)=(N'borrador'); `Modo` nvarchar(30)=(N'compradores_rotan'); `AprobacionDeArtistas` nvarchar(20)=(N'automatica'); `DuracionMinutos` int=((20)); `PausaMinutos` int=((5)); `TopeSolicitudesPendientes` int=((5)); `VencimientoSolicitudHoras` int=((72)); `CupoArtistas` int; `AperturaInscripcionUtc` datetime2; `CierreInscripcionUtc` datetime2; `IdUsuarioCreador` int; `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `FechaCierre` datetime2; `Nombre` nvarchar(120)=(N'Agenda de citas').
- PK: `IdAgenda`
- Único `UX_AgendasDeCitas_EdicionNombre`: `(EdicionMercadoId,Nombre)`
- FK `EdicionMercadoId` → `EdicionesMercado.IdEdicionMercado`
- CHECK `CK_AgendasDeCitas_Aprobacion`: `([AprobacionDeArtistas]=N'aceptacion' OR [AprobacionDeArtistas]=N'automatica')`
- CHECK `CK_AgendasDeCitas_Cupo`: `([CupoArtistas] IS NULL OR [CupoArtistas]>(0))`
- CHECK `CK_AgendasDeCitas_Duracion`: `([DuracionMinutos]>=(10) AND [DuracionMinutos]<=(60))`
- CHECK `CK_AgendasDeCitas_Estado`: `([Estado]=N'cerrada' OR [Estado]=N'en_curso' OR [Estado]=N'abierta' OR [Estado]=N'borrador')`
- CHECK `CK_AgendasDeCitas_Modo`: `([Modo]=N'compradores_fijos' OR [Modo]=N'compradores_rotan')`
- CHECK `CK_AgendasDeCitas_Pausa`: `([PausaMinutos]>=(0) AND [PausaMinutos]<=(30))`
- CHECK `CK_AgendasDeCitas_Tope`: `([TopeSolicitudesPendientes]>=(1) AND [TopeSolicitudesPendientes]<=(50))`
- CHECK `CK_AgendasDeCitas_Vence`: `([VencimientoSolicitudHoras]>=(1) AND [VencimientoSolicitudHoras]<=(720))`
- CHECK `CK_AgendasDeCitas_Ventana`: `([AperturaInscripcionUtc] IS NULL OR [CierreInscripcionUtc] IS NULL OR [CierreInscripcionUtc]>[AperturaInscripcionUtc])`

##### `FranjasDeCitas`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdFranja` int↑id; `AgendaId`* int; `InicioUtc`* datetime2; `FinUtc`* datetime2.
- PK: `IdFranja`
- Único `UQ_FranjasDeCitas_Inicio`: `(AgendaId,InicioUtc)`
- FK `AgendaId` → `AgendasDeCitas.IdAgenda`
- CHECK `CK_FranjasDeCitas_Rango`: `([FinUtc]>[InicioUtc])`

##### `CitasDeAgenda`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdCita` int↑id; `AgendaId`* int; `FranjaId`* int; `AnfitrionId`* int; `VisitanteId`* int; `Estado` nvarchar(20)=(N'solicitada'); `MensajeInicial` nvarchar(400); `MotivoDeLaDecision` nvarchar(600); `CanceladaPorId` int; `VenceUtc` datetime2; `FechaSolicitud` datetime2=(sysutcdatetime()); `FechaDecision` datetime2; `FechaActualizacion` datetime2.
- PK: `IdCita`
- Único `UX_CitasDeAgenda_Anfitrion_Franja`: `(AnfitrionId,FranjaId)` donde `([Estado] IN (N'solicitada', N'confirmada'))`
- Único `UX_CitasDeAgenda_Visitante_Franja`: `(VisitanteId,FranjaId)` donde `([Estado] IN (N'solicitada', N'confirmada'))`
- FK `AgendaId` → `AgendasDeCitas.IdAgenda`
- FK `AnfitrionId` → `ParticipantesDeCitas.IdParticipante`
- FK `CanceladaPorId` → `ParticipantesDeCitas.IdParticipante`
- FK `FranjaId` → `FranjasDeCitas.IdFranja`
- FK `VisitanteId` → `ParticipantesDeCitas.IdParticipante`
- CHECK `CK_CitasDeAgenda_Distintos`: `([AnfitrionId]<>[VisitanteId])`
- CHECK `CK_CitasDeAgenda_Estado`: `([Estado]=N'vencida' OR [Estado]=N'cancelada' OR [Estado]=N'rechazada' OR [Estado]=N'confirmada' OR [Estado]=N'solicitada')`

##### `ParticipantesDeCitas`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdParticipante` int↑id; `AgendaId`* int; `Rol`* nvarchar(10); `UsuarioId` int; `Nombre`* nvarchar(240); `Entidad` nvarchar(240); `TipoDeComprador` nvarchar(30); `CorreoInvitacion` nvarchar(180); `Presentacion` nvarchar(1200); `Enlaces` nvarchar(1500); `RepresentaA` nvarchar(240); `ContactoCorreo` nvarchar(180); `ContactoTelefono` nvarchar(80); `Espacio` nvarchar(120); `Estado` nvarchar(20)=(N'aprobado'); `MotivoDeLaDecision` nvarchar(600); `FechaInscripcion` datetime2=(sysutcdatetime()); `IdUsuarioCreador` int; `FechaActualizacion` datetime2; `FotoArchivoId` int.
- PK: `IdParticipante`
- Único `UX_ParticipantesDeCitas_Artista`: `(AgendaId,UsuarioId)` donde `([Rol]=N'artista' AND ([Estado] IN (N'pendiente', N'aprobado', N'lista_de_espera')))`
- Único `UX_ParticipantesDeCitas_Comprador`: `(AgendaId,CorreoInvitacion)` donde `([Rol]=N'comprador' AND [Estado]=N'aprobado')`
- FK `AgendaId` → `AgendasDeCitas.IdAgenda`
- FK `FotoArchivoId` → `Archivos.IdArchivo`
- FK `UsuarioId` → `Usuarios.IdUsuario`
- CHECK `CK_ParticipantesDeCitas_Espera`: `([Rol]=N'artista' OR ([Estado]=N'retirado' OR [Estado]=N'aprobado'))`
- CHECK `CK_ParticipantesDeCitas_Estado`: `([Estado]=N'retirado' OR [Estado]=N'rechazado' OR [Estado]=N'lista_de_espera' OR [Estado]=N'aprobado' OR [Estado]=N'pendiente')`
- CHECK `CK_ParticipantesDeCitas_Identidad`: `([Rol]=N'artista' AND [UsuarioId] IS NOT NULL OR [Rol]=N'comprador' AND [CorreoInvitacion] IS NOT NULL AND [TipoDeComprador] IS NOT NULL)`
- CHECK `CK_ParticipantesDeCitas_Rol`: `([Rol]=N'comprador' OR [Rol]=N'artista')`
- CHECK `CK_ParticipantesDeCitas_Tipo`: `([TipoDeComprador] IS NULL OR ([TipoDeComprador]=N'otro' OR [TipoDeComprador]=N'institucion' OR [TipoDeComprador]=N'medio' OR [TipoDeComprador]=N'editorial' OR [TipoDeComprador]=N'sello' OR [TipoDeComprador]=N'agencia' OR [TipoDeComprador]=N'sala' OR [TipoDeComprador]=N'festival'))`

##### `InvitacionesDeAgenda`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdInvitacion` int↑id; `ParticipanteId`* int; `CorreoInvitado`* nvarchar(180); `HashTestigo`* nvarchar(64); `Estado` nvarchar(20)=(N'pendiente'); `IdUsuarioInvita`* int; `FechaEmision`* datetime2; `FechaExpiracion`* datetime2; `IdUsuarioAcepta` int; `FechaCierre` datetime2.
- PK: `IdInvitacion`
- Único `UQ_InvitacionesDeAgenda_HashTestigo`: `(HashTestigo)`
- Único `UX_InvitacionesDeAgenda_PendientePorComprador`: `(ParticipanteId)` donde `([Estado]=N'pendiente')`
- FK `IdUsuarioAcepta` → `Usuarios.IdUsuario`
- FK `IdUsuarioInvita` → `Usuarios.IdUsuario`
- FK `ParticipanteId` → `ParticipantesDeCitas.IdParticipante`
- CHECK `CK_InvitacionesDeAgenda_Estado`: `([Estado]=N'vencida' OR [Estado]=N'revocada' OR [Estado]=N'aceptada' OR [Estado]=N'pendiente')`
- CHECK `CK_InvitacionesDeAgenda_Vigencia`: `([FechaExpiracion]>[FechaEmision])`

<a id="redes_luteria_espacios"></a>
## Redes, lutería (talleres) y espacios

Los tres usan el circuito simple de seis estados: `borrador` → `en_revision` → {`publicado` | `ajustes_solicitados` | `rechazado`}; `archivado` desde cualquiera (sin `aprobado`).
- `Redes.TipoDeNodo` ∈ {`red`, `archivo`, `coleccion`, `centro_de_documentacion`, `grupo_de_investigacion`}. Formas de acceso y formatos de documentación son catálogos con `EstadoAprobacion` (`propuesto`/`aprobado`).
- `Talleres.Modalidad` ∈ {`fijo`, `itinerante`, `colectivo`}; servicios y familias de instrumentos: catálogos (`ServiciosDeTaller`, `FamiliasDeInstrumentos`), valores `propuesto` se pueden sembrar para la bandeja.
- `Espacios.Ambiente` ∈ {`abierto`, `cerrado`, `mixto`}; `TiposDeEspacio` y `EquipamientoDeEspacio` catálogos con aprobación.
- Los tres: `NivelCobertura` + departamento/municipio coherentes (CHECK); **`CK_*_UnSoloResponsable`: o bien `OrganizacionPrincipalId` o bien `UsuarioResponsableId`, nunca ambos ni ninguno**; `EstadoRegistro` FK a `EstadosContenido`.

**Tablas:** `Redes`, `RedesPracticasMusicales`, `RedesFormasDeAcceso`, `RedesFormatos`, `Talleres`, `TalleresPracticasMusicales`, `TalleresFamiliasDeInstrumentos`, `TalleresServicios`, `Espacios`, `EspaciosPracticasMusicales`, `EspaciosEquipamiento`, `EspaciosTipos`

##### `Redes`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdRed` int↑id; `NombreRed`* nvarchar(240); `Descripcion` nvarchar(max); `TipoDeNodo` nvarchar(40)=(N'red'); `AccesoAbierto` bit=((0)); `AcervosYColecciones` nvarchar(2000); `CorreoRed` nvarchar(180); `TelefonoRed` nvarchar(80); `SitioWebRed` nvarchar(500); `InstagramRed` nvarchar(500); `FacebookRed` nvarchar(500); `OtroEnlaceRed` nvarchar(500); `NivelCobertura`* nvarchar(40); `CodigoDepartamento` char(2); `CodigoMunicipio` char(5); `LugarEspecifico` nvarchar(300); `OrganizacionPrincipalId` int; `UsuarioResponsableId` int; `EstadoRegistro` nvarchar(80)=(N'borrador'); `MotivoDeLaDecision` nvarchar(1200); `Activo` bit=((1)); `IdUsuarioCreador` int; `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `FechaEnvioARevision` datetime2; `FechaPublicacion` datetime2; `FechaArchivado` datetime2; `SedeCodigoDepartamento` char(2); `SedeCodigoMunicipio` char(5); `ArchivoFotoId` int.
- PK: `IdRed`
- FK `ArchivoFotoId` → `Archivos.IdArchivo`
- FK `CodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `CodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `OrganizacionPrincipalId` → `Entidades.IdEntidad`
- FK `SedeCodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `SedeCodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `UsuarioResponsableId` → `Usuarios.IdUsuario`
- CHECK `CK_Redes_EstadoRegistro`: `([EstadoRegistro]=N'rechazado' OR [EstadoRegistro]=N'archivado' OR [EstadoRegistro]=N'publicado' OR [EstadoRegistro]=N'ajustes_solicitados' OR [EstadoRegistro]=N'en_revision' OR [EstadoRegistro]=N'borrador')`
- CHECK `CK_Redes_NivelCobertura`: `(([NivelCobertura]=N'municipal' OR [NivelCobertura]=N'departamental' OR [NivelCobertura]=N'nacional') AND ([NivelCobertura]=N'nacional' AND [CodigoDepartamento] IS NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'departamental' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'municipal' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NOT NULL))`
- CHECK `CK_Redes_SedeCoherente`: `([SedeCodigoMunicipio] IS NULL OR [SedeCodigoDepartamento] IS NOT NULL AND left([SedeCodigoMunicipio],(2))=[SedeCodigoDepartamento])`
- CHECK `CK_Redes_TipoDeNodo`: `([TipoDeNodo]=N'grupo_de_investigacion' OR [TipoDeNodo]=N'coleccion' OR [TipoDeNodo]=N'archivo' OR [TipoDeNodo]=N'centro_de_documentacion' OR [TipoDeNodo]=N'red')`
- CHECK `CK_Redes_UnSoloResponsable`: `([OrganizacionPrincipalId] IS NOT NULL AND [UsuarioResponsableId] IS NULL OR [OrganizacionPrincipalId] IS NULL AND [UsuarioResponsableId] IS NOT NULL)`

##### `RedesPracticasMusicales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdRedPracticaMusical` int↑id; `RedId`* int; `PracticaMusicalId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdRedPracticaMusical`
- Único `UQ_RedesPracticas_Par`: `(RedId,PracticaMusicalId)`
- FK `PracticaMusicalId` → `PracticasMusicales.IdPracticaMusical`
- FK `RedId` → `Redes.IdRed`

##### `RedesFormasDeAcceso`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdRedFormaDeAcceso` int↑id; `RedId`* int; `FormaDeAccesoId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdRedFormaDeAcceso`
- Único `UQ_RedesFormasDeAcceso_Par`: `(RedId,FormaDeAccesoId)`
- FK `FormaDeAccesoId` → `FormasDeAccesoDeRed.IdFormaDeAcceso`
- FK `RedId` → `Redes.IdRed`

##### `RedesFormatos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdRedFormato` int↑id; `RedId`* int; `FormatoId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdRedFormato`
- Único `UQ_RedesFormatos_Par`: `(RedId,FormatoId)`
- FK `FormatoId` → `FormatosDeDocumentacion.IdFormato`
- FK `RedId` → `Redes.IdRed`

##### `Talleres`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdTaller` int↑id; `NombreTaller`* nvarchar(240); `Descripcion` nvarchar(max); `Modalidad` nvarchar(20)=(N'fijo'); `RecibeAprendices` bit=((0)); `SaberesYTecnicas` nvarchar(2000); `CorreoTaller` nvarchar(180); `TelefonoTaller` nvarchar(80); `SitioWebTaller` nvarchar(500); `InstagramTaller` nvarchar(500); `FacebookTaller` nvarchar(500); `OtroEnlaceTaller` nvarchar(500); `NivelCobertura`* nvarchar(40); `CodigoDepartamento` char(2); `CodigoMunicipio` char(5); `LugarEspecifico` nvarchar(300); `OrganizacionPrincipalId` int; `UsuarioResponsableId` int; `EstadoRegistro` nvarchar(80)=(N'borrador'); `MotivoDeLaDecision` nvarchar(1200); `Activo` bit=((1)); `IdUsuarioCreador` int; `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `FechaEnvioARevision` datetime2; `FechaPublicacion` datetime2; `FechaArchivado` datetime2; `SedeCodigoDepartamento` char(2); `SedeCodigoMunicipio` char(5); `ArchivoFotoId` int.
- PK: `IdTaller`
- FK `ArchivoFotoId` → `Archivos.IdArchivo`
- FK `CodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `CodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `OrganizacionPrincipalId` → `Entidades.IdEntidad`
- FK `SedeCodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `SedeCodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `UsuarioResponsableId` → `Usuarios.IdUsuario`
- CHECK `CK_Talleres_EstadoRegistro`: `([EstadoRegistro]=N'rechazado' OR [EstadoRegistro]=N'archivado' OR [EstadoRegistro]=N'publicado' OR [EstadoRegistro]=N'ajustes_solicitados' OR [EstadoRegistro]=N'en_revision' OR [EstadoRegistro]=N'borrador')`
- CHECK `CK_Talleres_Modalidad`: `([Modalidad]=N'colectivo' OR [Modalidad]=N'itinerante' OR [Modalidad]=N'fijo')`
- CHECK `CK_Talleres_NivelCobertura`: `(([NivelCobertura]=N'municipal' OR [NivelCobertura]=N'departamental' OR [NivelCobertura]=N'nacional') AND ([NivelCobertura]=N'nacional' AND [CodigoDepartamento] IS NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'departamental' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'municipal' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NOT NULL))`
- CHECK `CK_Talleres_SedeCoherente`: `([SedeCodigoMunicipio] IS NULL OR [SedeCodigoDepartamento] IS NOT NULL AND left([SedeCodigoMunicipio],(2))=[SedeCodigoDepartamento])`
- CHECK `CK_Talleres_UnSoloResponsable`: `([OrganizacionPrincipalId] IS NOT NULL AND [UsuarioResponsableId] IS NULL OR [OrganizacionPrincipalId] IS NULL AND [UsuarioResponsableId] IS NOT NULL)`

##### `TalleresPracticasMusicales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdTallerPracticaMusical` int↑id; `TallerId`* int; `PracticaMusicalId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdTallerPracticaMusical`
- Único `UQ_TalleresPracticas_Par`: `(TallerId,PracticaMusicalId)`
- FK `PracticaMusicalId` → `PracticasMusicales.IdPracticaMusical`
- FK `TallerId` → `Talleres.IdTaller`

##### `TalleresFamiliasDeInstrumentos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdTallerFamilia` int↑id; `TallerId`* int; `FamiliaInstrumentoId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdTallerFamilia`
- Único `UQ_TalleresFamilias_Par`: `(TallerId,FamiliaInstrumentoId)`
- FK `FamiliaInstrumentoId` → `FamiliasDeInstrumentos.IdFamiliaInstrumento`
- FK `TallerId` → `Talleres.IdTaller`

##### `TalleresServicios`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdTallerServicio` int↑id; `TallerId`* int; `ServicioTallerId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdTallerServicio`
- Único `UQ_TalleresServicios_Par`: `(TallerId,ServicioTallerId)`
- FK `ServicioTallerId` → `ServiciosDeTaller.IdServicioTaller`
- FK `TallerId` → `Talleres.IdTaller`

##### `Espacios`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEspacio` int↑id; `NombreEspacio`* nvarchar(240); `Descripcion` nvarchar(max); `Ambiente` nvarchar(20)=(N'cerrado'); `AforoMaximo` int; `EsAccesible` bit; `HorarioYProgramacion` nvarchar(2000); `CorreoEspacio` nvarchar(180); `TelefonoEspacio` nvarchar(80); `SitioWebEspacio` nvarchar(500); `InstagramEspacio` nvarchar(500); `FacebookEspacio` nvarchar(500); `OtroEnlaceEspacio` nvarchar(500); `NivelCobertura`* nvarchar(40); `CodigoDepartamento` char(2); `CodigoMunicipio` char(5); `LugarEspecifico` nvarchar(300); `OrganizacionPrincipalId` int; `UsuarioResponsableId` int; `EstadoRegistro` nvarchar(80)=(N'borrador'); `MotivoDeLaDecision` nvarchar(1200); `Activo` bit=((1)); `IdUsuarioCreador` int; `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `FechaEnvioARevision` datetime2; `FechaPublicacion` datetime2; `FechaArchivado` datetime2; `SedeCodigoDepartamento` char(2); `SedeCodigoMunicipio` char(5); `ArchivoFotoId` int.
- PK: `IdEspacio`
- FK `ArchivoFotoId` → `Archivos.IdArchivo`
- FK `CodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `CodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `OrganizacionPrincipalId` → `Entidades.IdEntidad`
- FK `SedeCodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `SedeCodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `UsuarioResponsableId` → `Usuarios.IdUsuario`
- CHECK `CK_Espacios_Aforo`: `([AforoMaximo] IS NULL OR [AforoMaximo]>(0))`
- CHECK `CK_Espacios_Ambiente`: `([Ambiente]=N'mixto' OR [Ambiente]=N'abierto' OR [Ambiente]=N'cerrado')`
- CHECK `CK_Espacios_EstadoRegistro`: `([EstadoRegistro]=N'rechazado' OR [EstadoRegistro]=N'archivado' OR [EstadoRegistro]=N'publicado' OR [EstadoRegistro]=N'ajustes_solicitados' OR [EstadoRegistro]=N'en_revision' OR [EstadoRegistro]=N'borrador')`
- CHECK `CK_Espacios_NivelCobertura`: `(([NivelCobertura]=N'municipal' OR [NivelCobertura]=N'departamental' OR [NivelCobertura]=N'nacional') AND ([NivelCobertura]=N'nacional' AND [CodigoDepartamento] IS NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'departamental' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'municipal' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NOT NULL))`
- CHECK `CK_Espacios_SedeCoherente`: `([SedeCodigoMunicipio] IS NULL OR [SedeCodigoDepartamento] IS NOT NULL AND left([SedeCodigoMunicipio],(2))=[SedeCodigoDepartamento])`
- CHECK `CK_Espacios_UnSoloResponsable`: `([OrganizacionPrincipalId] IS NOT NULL AND [UsuarioResponsableId] IS NULL OR [OrganizacionPrincipalId] IS NULL AND [UsuarioResponsableId] IS NOT NULL)`

##### `EspaciosPracticasMusicales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEspacioPracticaMusical` int↑id; `EspacioId`* int; `PracticaMusicalId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdEspacioPracticaMusical`
- Único `UQ_EspaciosPracticas_Par`: `(EspacioId,PracticaMusicalId)`
- FK `EspacioId` → `Espacios.IdEspacio`
- FK `PracticaMusicalId` → `PracticasMusicales.IdPracticaMusical`

##### `EspaciosEquipamiento`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEspacioEquipamiento` int↑id; `EspacioId`* int; `EquipamientoEspacioId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdEspacioEquipamiento`
- Único `UQ_EspaciosEquipamiento_Par`: `(EspacioId,EquipamientoEspacioId)`
- FK `EquipamientoEspacioId` → `EquipamientoDeEspacio.IdEquipamientoEspacio`
- FK `EspacioId` → `Espacios.IdEspacio`

##### `EspaciosTipos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEspacioTipo` int↑id; `EspacioId`* int; `TipoEspacioId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdEspacioTipo`
- Único `UQ_EspaciosTipos_Par`: `(EspacioId,TipoEspacioId)`
- FK `EspacioId` → `Espacios.IdEspacio`
- FK `TipoEspacioId` → `TiposDeEspacio.IdTipoEspacio`

<a id="eventos"></a>
## Eventos y agenda

- `EventosAgenda.Estado` (CHECK): `borrador`, `en_revision`, `publicado`, `rechazado`, `archivado`. `Modalidad` ∈ {`presencial`, `virtual`, `mixta`}: **publicado** exige `Lugar` si es presencial, `Url` si es virtual, ambos si es mixta
  (`CK_EventosAgenda_DatosDeModalidad`). `NivelCobertura` con la regla territorial. Fechas: inicio ≤ fin; eventos pasados, presentes y futuros para series temporales.
- Vínculos opcionales a festival/mercado/edición, a prácticas, territorios, proyectos transversales, archivos (imagen del evento) y etiquetas (`Etiquetas`). Se publica desde la consola de gestión: `borrador` → `en_revision` → `publicado`/`rechazado`.

**Tablas:** `EventosAgenda`, `EventosAgendaPracticasMusicales`, `EventosAgendaTerritoriosSonoros`, `EventosAgendaProyectosTransversales`, `EventosAgendaArchivos`, `EtiquetasEventoAgenda`

##### `EventosAgenda`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEventoAgenda` bigint↑id; `Slug`* nvarchar(180); `Titulo`* nvarchar(300); `Descripcion`* nvarchar(1000); `FechaInicio`* date; `FechaFin` date; `HoraInicio` time; `Modalidad` nvarchar(20)=(N'presencial'); `Lugar` nvarchar(300); `CodigoDepartamento` char(2); `CodigoMunicipio` char(5); `Url` nvarchar(500); `ImagenRuta` nvarchar(500); `ImagenAlternativa` nvarchar(300); `Estado` nvarchar(20)=(N'borrador'); `Version` int=((1)); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2=(sysutcdatetime()); `Organizador` nvarchar(220); `DescripcionLarga` nvarchar(max); `HoraFin` time; `OrdenVisualizacion` int; `FestivalId` int; `NivelCobertura`* nvarchar(20); `CategoriaId` int; `MercadoId` int; `Cancelado` bit=((0)); `MotivoCancelacion` nvarchar(500); `FechaCancelacion` datetime2; `TallerId` int; `EspacioId` int; `RedId` int.
- PK: `IdEventoAgenda`
- Único `UQ_EventosAgenda_Slug`: `(Slug)`
- FK `CategoriaId` → `Categorias.IdCategoria`
- FK `CodigoDepartamento` → `Divipola.CodigoDepartamento`
- FK `CodigoMunicipio` → `Divipola.CodigoMunicipio`
- FK `EspacioId` → `Espacios.IdEspacio`
- FK `FestivalId` → `Festivales.IdFestival`
- FK `MercadoId` → `Mercados.IdMercado`
- FK `RedId` → `Redes.IdRed`
- FK `TallerId` → `Talleres.IdTaller`
- CHECK `CK_EventosAgenda_Cancelacion`: `([Cancelado]=(0) AND [MotivoCancelacion] IS NULL AND [FechaCancelacion] IS NULL OR [Cancelado]=(1) AND [FechaCancelacion] IS NOT NULL AND [MotivoCancelacion] IS NOT NULL AND len(ltrim(rtrim([MotivoCancelacion])))>(0))`
- CHECK `CK_EventosAgenda_DatosDeModalidad`: `([Modalidad]=N'presencial' AND ([Estado]<>N'publicado' OR len(ltrim(rtrim(isnull([Lugar],N''))))>(0)) OR [Modalidad]=N'virtual' AND ([Estado]<>N'publicado' OR len(ltrim(rtrim(isnull([Url],N''))))>(0)) OR [Modalidad]=N'mixta' AND ([Estado]<>N'publicado' OR len(ltrim(rtrim(isnull([Lugar],N''))))>(0) AND len(ltrim(rtrim(isnull([Url],N''))))>(0)))`
- CHECK `CK_EventosAgenda_Descripcion`: `(len(ltrim(rtrim([Descripcion])))>(0))`
- CHECK `CK_EventosAgenda_Estado`: `([Estado]=N'archivado' OR [Estado]=N'rechazado' OR [Estado]=N'publicado' OR [Estado]=N'en_revision' OR [Estado]=N'borrador')`
- CHECK `CK_EventosAgenda_Fechas`: `([FechaFin] IS NULL OR [FechaFin]>=[FechaInicio])`
- CHECK `CK_EventosAgenda_Horas`: `([HoraFin] IS NULL OR [HoraInicio] IS NULL OR [HoraFin]>=[HoraInicio])`
- CHECK `CK_EventosAgenda_Modalidad`: `([Modalidad]=N'mixta' OR [Modalidad]=N'virtual' OR [Modalidad]=N'presencial')`
- CHECK `CK_EventosAgenda_NivelCobertura`: `(([NivelCobertura]=N'municipal' OR [NivelCobertura]=N'departamental' OR [NivelCobertura]=N'nacional') AND ([NivelCobertura]=N'nacional' AND [CodigoDepartamento] IS NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'departamental' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NULL OR [NivelCobertura]=N'municipal' AND [CodigoDepartamento] IS NOT NULL AND [CodigoMunicipio] IS NOT NULL))`
- CHECK `CK_EventosAgenda_Orden`: `([OrdenVisualizacion] IS NULL OR [OrdenVisualizacion]>(0))`
- CHECK `CK_EventosAgenda_Titulo`: `(len(ltrim(rtrim([Titulo])))>(0))`
- CHECK `CK_EventosAgenda_UnSoloProceso`: `(((((case when [FestivalId] IS NULL then (0) else (1) end+case when [MercadoId] IS NULL then (0) else (1) end)+case when [TallerId] IS NULL then (0) else (1) end)+case when [EspacioId] IS NULL then (0) else (1) end)+case when [RedId] IS NULL then (0) else (1) end)<=(1))`
- CHECK `CK_EventosAgenda_Version`: `([Version]>=(1))`

##### `EventosAgendaPracticasMusicales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEventoAgendaPracticaMusical` bigint↑id; `EventoAgendaId`* bigint; `PracticaMusicalId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdEventoAgendaPracticaMusical`
- Único `UQ_EventosAgendaPracticasMusicales`: `(EventoAgendaId,PracticaMusicalId)`
- FK `EventoAgendaId` → `EventosAgenda.IdEventoAgenda`
- FK `PracticaMusicalId` → `PracticasMusicales.IdPracticaMusical`

##### `EventosAgendaTerritoriosSonoros`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEventoAgendaTerritorioSonoro` bigint↑id; `EventoAgendaId`* bigint; `TerritorioSonoroId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdEventoAgendaTerritorioSonoro`
- Único `UQ_EventosAgendaTerritoriosSonoros`: `(EventoAgendaId,TerritorioSonoroId)`
- FK `EventoAgendaId` → `EventosAgenda.IdEventoAgenda`
- FK `TerritorioSonoroId` → `TerritoriosSonoros.IdTerritorioSonoro`

##### `EventosAgendaProyectosTransversales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEventoAgendaProyectoTransversal` bigint↑id; `EventoAgendaId`* bigint; `ProyectoTransversalId`* int.
- PK: `IdEventoAgendaProyectoTransversal`
- Único `UQ_EventosAgendaProyectosTransversales`: `(EventoAgendaId,ProyectoTransversalId)`
- FK `EventoAgendaId` → `EventosAgenda.IdEventoAgenda`
- FK `ProyectoTransversalId` → `ProyectosTransversales.IdProyectoTransversal`

##### `EventosAgendaArchivos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEventoAgendaArchivo` bigint↑id; `EventoAgendaId`* bigint; `ArchivoId`* int; `RolArchivo` nvarchar(80)=(N'imagen_principal'); `OrdenVisualizacion` int=((1)).
- PK: `IdEventoAgendaArchivo`
- Único `UQ_EventosAgendaArchivos`: `(EventoAgendaId,ArchivoId,RolArchivo)`
- FK `ArchivoId` → `Archivos.IdArchivo`
- FK `EventoAgendaId` → `EventosAgenda.IdEventoAgenda`
- CHECK `CK_EventosAgendaArchivos_Orden`: `([OrdenVisualizacion]>(0))`

##### `EtiquetasEventoAgenda`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEtiquetaEventoAgenda` bigint↑id; `EventoAgendaId`* bigint; `Termino`* nvarchar(120).
- PK: `IdEtiquetaEventoAgenda`
- Único `UQ_EtiquetasEventoAgenda_Termino`: `(EventoAgendaId,Termino)`
- FK `EventoAgendaId` → `EventosAgenda.IdEventoAgenda`
- CHECK `CK_EtiquetasEventoAgenda_Termino`: `(len(ltrim(rtrim([Termino])))>(0))`

<a id="noticias"></a>
## Noticias

- `Noticias.Estado`: `borrador`, `en_revision`, `publicado`, `rechazado`, `archivado`; **`publicado` exige `FechaPublicacion`** (`CK_Noticias_PublicadaConFecha`).
- Imagen de portada y galería por `NoticiasArchivos` (FK `Archivos`); categoría de `Categorias` (módulo `noticias`); etiquetas, prácticas, territorios y proyectos transversales por pivotes.
- Texto largo con extensión suficiente (cuerpo editorial) y autoría. **Una noticia no tiene FK a festival/organización**: solo categoría, prácticas, territorios, proyectos y archivos. El `Slug` es único y las categorías se buscan por (`CodigoModulo`, `Slug`): un mismo slug (p. ej. `formacion`) existe en agenda y en noticias.

**Tablas:** `Noticias`, `NoticiasPracticasMusicales`, `NoticiasTerritoriosSonoros`, `NoticiasProyectosTransversales`, `NoticiasArchivos`, `EtiquetasNoticia`

##### `Noticias`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdNoticia` bigint↑id; `Slug`* nvarchar(180); `Titulo`* nvarchar(300); `Resumen`* nvarchar(500); `Cuerpo` nvarchar(max); `FechaPublicacion` date; `ImagenRuta` nvarchar(500); `ImagenAlternativa` nvarchar(300); `AutoriaNombre` nvarchar(200); `Estado` nvarchar(20)=(N'borrador'); `Version` int=((1)); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2=(sysutcdatetime()); `CategoriaId` int.
- PK: `IdNoticia`
- Único `UQ_Noticias_Slug`: `(Slug)`
- FK `CategoriaId` → `Categorias.IdCategoria`
- CHECK `CK_Noticias_Estado`: `([Estado]=N'archivado' OR [Estado]=N'rechazado' OR [Estado]=N'publicado' OR [Estado]=N'en_revision' OR [Estado]=N'borrador')`
- CHECK `CK_Noticias_PublicadaConFecha`: `([Estado]<>N'publicado' OR [FechaPublicacion] IS NOT NULL)`
- CHECK `CK_Noticias_Resumen`: `(len(ltrim(rtrim([Resumen])))>(0))`
- CHECK `CK_Noticias_Titulo`: `(len(ltrim(rtrim([Titulo])))>(0))`
- CHECK `CK_Noticias_Version`: `([Version]>=(1))`

##### `NoticiasPracticasMusicales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdNoticiaPracticaMusical` bigint↑id; `NoticiaId`* bigint; `PracticaMusicalId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdNoticiaPracticaMusical`
- Único `UQ_NoticiasPracticasMusicales`: `(NoticiaId,PracticaMusicalId)`
- FK `NoticiaId` → `Noticias.IdNoticia`
- FK `PracticaMusicalId` → `PracticasMusicales.IdPracticaMusical`

##### `NoticiasTerritoriosSonoros`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdNoticiaTerritorioSonoro` bigint↑id; `NoticiaId`* bigint; `TerritorioSonoroId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdNoticiaTerritorioSonoro`
- Único `UQ_NoticiasTerritoriosSonoros`: `(NoticiaId,TerritorioSonoroId)`
- FK `NoticiaId` → `Noticias.IdNoticia`
- FK `TerritorioSonoroId` → `TerritoriosSonoros.IdTerritorioSonoro`

##### `NoticiasProyectosTransversales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdNoticiaProyectoTransversal` bigint↑id; `NoticiaId`* bigint; `ProyectoTransversalId`* int.
- PK: `IdNoticiaProyectoTransversal`
- Único `UQ_NoticiasProyectosTransversales`: `(NoticiaId,ProyectoTransversalId)`
- FK `NoticiaId` → `Noticias.IdNoticia`
- FK `ProyectoTransversalId` → `ProyectosTransversales.IdProyectoTransversal`

##### `NoticiasArchivos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdNoticiaArchivo` bigint↑id; `NoticiaId`* bigint; `ArchivoId`* int; `RolArchivo` nvarchar(80)=(N'imagen_principal'); `OrdenVisualizacion` int=((1)).
- PK: `IdNoticiaArchivo`
- Único `UQ_NoticiasArchivos`: `(NoticiaId,ArchivoId,RolArchivo)`
- FK `ArchivoId` → `Archivos.IdArchivo`
- FK `NoticiaId` → `Noticias.IdNoticia`
- CHECK `CK_NoticiasArchivos_Orden`: `([OrdenVisualizacion]>(0))`

##### `EtiquetasNoticia`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEtiquetaNoticia` bigint↑id; `NoticiaId`* bigint; `Termino`* nvarchar(120).
- PK: `IdEtiquetaNoticia`
- Único `UQ_EtiquetasNoticia_Termino`: `(NoticiaId,Termino)`
- FK `NoticiaId` → `Noticias.IdNoticia`
- CHECK `CK_EtiquetasNoticia_Termino`: `(len(ltrim(rtrim([Termino])))>(0))`

<a id="editorial"></a>
## Catálogo editorial (acervo)

**Ya viene poblado por las migraciones/seed (171 publicaciones, 410 agentes, 864 créditos): la siembra de demo NO lo toca** salvo que se quiera ampliar. Es acervo de referencia, no operativo.
- `EstadoPublicacion`: `borrador`, `en_revision`, `publicado`, `retirado`; `EstadoCatalogacion`: `pendiente_revision`, `en_revision`, `validada`, `observada`; `DerechosEstado`: `pendiente`, `verificado`, `restringido`.
- `Formato` ∈ {`Físico`, `Digital`, `Mixto`}; `Confianza` ∈ {`Baja`, `Media`, `Alta`}; `IdentificadoresEditoriales.Esquema` ∈ {`ISBN`, `ISMN`}; `AgentesEditoriales.Tipo` ∈ {`persona`, `entidad`}.
- `AccesosEditoriales.Tipo` ∈ {`archivo`, `enlace`, `ubicacion`}: un solo destino por fila (CHECK `UnSoloDestino`).

**Tablas:** `PublicacionesEditoriales`, `PublicacionesEditorialesFuentes`, `PublicacionesEditorialesIdiomas`, `PublicacionesEditorialesPracticasMusicales`, `PublicacionesEditorialesProgramas`, `PublicacionesEditorialesTerritoriosSonoros`, `PublicacionesEditorialesTipologias`, `AccesosEditoriales`, `AgentesEditoriales`, `CreditosEditoriales`, `IdentificadoresEditoriales`, `PalabrasClaveEditoriales`, `FuentesEditoriales`, `ProgramasEditoriales`, `TipologiasEditoriales`

##### `PublicacionesEditoriales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdPublicacionEditorial` bigint↑id; `Codigo`* nvarchar(60); `Titulo`* nvarchar(500); `Subtitulo` nvarchar(500); `DesignacionVolumen` nvarchar(120); `SerieOColeccion` nvarchar(300); `Resumen` nvarchar(max); `FechaEdtf` nvarchar(60); `AnioInicio` int; `AnioFin` int; `EstadoCatalogacion` nvarchar(30)=(N'pendiente_revision'); `EstadoPublicacion` nvarchar(30)=(N'borrador'); `Version` int=((1)); `DerechosEstado` nvarchar(30)=(N'pendiente'); `DerechosPermitePublicarFicha` bit=((0)); `DerechosPermitePublicarArchivo` bit=((0)); `DerechosLicenciaONota` nvarchar(600); `DerechosFuenteId` bigint; `DerechosFechaVerificacion` datetime2; `DerechosVerificadoPor` nvarchar(200); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2=(sysutcdatetime()); `TipoPublicacion` nvarchar(240); `Ambito` nvarchar(160); `MiniaturaRuta` nvarchar(500); `SeccionPrincipal` nvarchar(200); `RutaSeccion` nvarchar(500); `PracticaMusical` nvarchar(160); `Subcategoria` nvarchar(160); `TamanoFormato` nvarchar(120); `Paginas` nvarchar(160); `Duracion` nvarchar(160); `CamposAdicionales` nvarchar(max); `TextoPortada` nvarchar(max); `CategoriaId` int; `Formato` nvarchar(20); `NotaFecha` nvarchar(300); `CategoriaSecundaria` nvarchar(240); `AmbitoTexto` nvarchar(240); `NotasCatalogacion` nvarchar(500); `Confianza` nvarchar(20); `RevisarClasificacion` bit=((0)); `RevisarCreditos` bit=((0)); `DiapositivaOrigen` nvarchar(20); `SubcategoriaEditorialId` int.
- PK: `IdPublicacionEditorial`
- Único `UQ_PublicacionesEditoriales_Codigo`: `(Codigo)`
- FK `CategoriaId` → `Categorias.IdCategoria`
- FK `DerechosFuenteId` → `FuentesEditoriales.IdFuenteEditorial`
- FK `SubcategoriaEditorialId` → `Categorias.IdCategoria`
- FK `CategoriaId` → `Categorias.CategoriaPadreId`
- CHECK `CK_PublicacionesEditoriales_Anios`: `([AnioFin] IS NULL OR [AnioInicio] IS NULL OR [AnioFin]>=[AnioInicio])`
- CHECK `CK_PublicacionesEditoriales_Catalogacion`: `([EstadoCatalogacion]=N'observada' OR [EstadoCatalogacion]=N'validada' OR [EstadoCatalogacion]=N'en_revision' OR [EstadoCatalogacion]=N'pendiente_revision')`
- CHECK `CK_PublicacionesEditoriales_Confianza`: `([Confianza] IS NULL OR ([Confianza]=N'Baja' OR [Confianza]=N'Media' OR [Confianza]=N'Alta'))`
- CHECK `CK_PublicacionesEditoriales_DerechosEstado`: `([DerechosEstado]=N'restringido' OR [DerechosEstado]=N'verificado' OR [DerechosEstado]=N'pendiente')`
- CHECK `CK_PublicacionesEditoriales_Formato`: `([Formato] IS NULL OR ([Formato]=N'Mixto' OR [Formato]=N'Digital' OR [Formato]=N'Físico'))`
- CHECK `CK_PublicacionesEditoriales_Publicacion`: `([EstadoPublicacion]=N'retirado' OR [EstadoPublicacion]=N'publicado' OR [EstadoPublicacion]=N'en_revision' OR [EstadoPublicacion]=N'borrador')`
- CHECK `CK_PublicacionesEditoriales_SubcategoriaPrincipal`: `([SubcategoriaEditorialId] IS NULL OR [CategoriaId] IS NOT NULL)`

##### `PublicacionesEditorialesFuentes`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `PublicacionEditorialId`* bigint; `FuenteEditorialId`* bigint.
- PK: `PublicacionEditorialId,FuenteEditorialId`
- FK `FuenteEditorialId` → `FuentesEditoriales.IdFuenteEditorial`
- FK `PublicacionEditorialId` → `PublicacionesEditoriales.IdPublicacionEditorial`

##### `PublicacionesEditorialesIdiomas`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `PublicacionEditorialId`* bigint; `CodigoIdioma`* nvarchar(3); `Orden`* int.
- PK: `PublicacionEditorialId,CodigoIdioma`
- FK `CodigoIdioma` → `Idiomas.CodigoIdioma`
- FK `PublicacionEditorialId` → `PublicacionesEditoriales.IdPublicacionEditorial`
- CHECK `CK_PublicacionesEditorialesIdiomas_Orden`: `([Orden]>(0))`

##### `PublicacionesEditorialesPracticasMusicales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdPublicacionEditorialPracticaMusical` bigint↑id; `PublicacionEditorialId`* bigint; `PracticaMusicalId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdPublicacionEditorialPracticaMusical`
- Único `UQ_PublicacionesEditorialesPracticasMusicales`: `(PublicacionEditorialId,PracticaMusicalId)`
- FK `PublicacionEditorialId` → `PublicacionesEditoriales.IdPublicacionEditorial`
- FK `PracticaMusicalId` → `PracticasMusicales.IdPracticaMusical`

##### `PublicacionesEditorialesProgramas`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdPublicacionEditorialPrograma` bigint↑id; `PublicacionEditorialId`* bigint; `ProgramaEditorialId`* bigint; `FuenteEditorialId`* bigint; `VigenteDesde` date; `VigenteHasta` date; `VerificadaPor`* nvarchar(200).
- PK: `IdPublicacionEditorialPrograma`
- Único `UQ_PublicacionesEditorialesProgramas`: `(PublicacionEditorialId,ProgramaEditorialId)`
- FK `FuenteEditorialId` → `FuentesEditoriales.IdFuenteEditorial`
- FK `ProgramaEditorialId` → `ProgramasEditoriales.IdProgramaEditorial`
- FK `PublicacionEditorialId` → `PublicacionesEditoriales.IdPublicacionEditorial`
- CHECK `CK_PublicacionesEditorialesProgramas_Vigencia`: `([VigenteHasta] IS NULL OR [VigenteDesde] IS NULL OR [VigenteHasta]>=[VigenteDesde])`

##### `PublicacionesEditorialesTerritoriosSonoros`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdPublicacionEditorialTerritorioSonoro` bigint↑id; `PublicacionEditorialId`* bigint; `TerritorioSonoroId`* int; `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdPublicacionEditorialTerritorioSonoro`
- Único `UQ_PublicacionesEditorialesTerritoriosSonoros`: `(PublicacionEditorialId,TerritorioSonoroId)`
- FK `PublicacionEditorialId` → `PublicacionesEditoriales.IdPublicacionEditorial`
- FK `TerritorioSonoroId` → `TerritoriosSonoros.IdTerritorioSonoro`

##### `PublicacionesEditorialesTipologias`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `PublicacionEditorialId`* bigint; `TipologiaEditorialId`* int.
- PK: `PublicacionEditorialId,TipologiaEditorialId`
- FK `PublicacionEditorialId` → `PublicacionesEditoriales.IdPublicacionEditorial`
- FK `TipologiaEditorialId` → `TipologiasEditoriales.IdTipologiaEditorial`

##### `AccesosEditoriales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdAccesoEditorial` bigint↑id; `PublicacionEditorialId`* bigint; `Tipo`* nvarchar(20); `ArchivoId` int; `Url` nvarchar(1000); `UbicacionFisica` nvarchar(600); `Etiqueta` nvarchar(200); `Nota` nvarchar(600); `Orden` int=((0)); `DerechosEstado` nvarchar(30)=(N'pendiente'); `DerechosPermitePublicarFicha` bit=((0)); `DerechosPermitePublicarArchivo` bit=((0)); `DerechosLicenciaONota` nvarchar(600); `DerechosFuenteId` bigint; `DerechosFechaVerificacion` datetime2; `DerechosVerificadoPor` nvarchar(200).
- PK: `IdAccesoEditorial`
- FK `ArchivoId` → `Archivos.IdArchivo`
- FK `DerechosFuenteId` → `FuentesEditoriales.IdFuenteEditorial`
- FK `PublicacionEditorialId` → `PublicacionesEditoriales.IdPublicacionEditorial`
- CHECK `CK_AccesosEditoriales_DerechosEstado`: `([DerechosEstado]=N'restringido' OR [DerechosEstado]=N'verificado' OR [DerechosEstado]=N'pendiente')`
- CHECK `CK_AccesosEditoriales_Tipo`: `([Tipo]=N'ubicacion' OR [Tipo]=N'enlace' OR [Tipo]=N'archivo')`
- CHECK `CK_AccesosEditoriales_UnSoloDestino`: `([Tipo]=N'archivo' AND [ArchivoId] IS NOT NULL AND [Url] IS NULL AND [UbicacionFisica] IS NULL OR [Tipo]=N'enlace' AND [ArchivoId] IS NULL AND [Url] IS NOT NULL AND [UbicacionFisica] IS NULL OR [Tipo]=N'ubicacion' AND [ArchivoId] IS NULL AND [Url] IS NULL AND [UbicacionFisica] IS NOT NULL)`

##### `AgentesEditoriales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdAgenteEditorial` bigint↑id; `Codigo`* nvarchar(60); `Tipo`* nvarchar(20); `NombrePreferido`* nvarchar(300); `FormaNormalizada` nvarchar(300); `Seudonimo` nvarchar(300); `Acronimo` nvarchar(60); `RequiereRevision` bit=((0)); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2=(sysutcdatetime()).
- PK: `IdAgenteEditorial`
- Único `UQ_AgentesEditoriales_Codigo`: `(Codigo)`
- CHECK `CK_AgentesEditoriales_Tipo`: `(([Tipo]) collate Latin1_General_BIN2=N'entidad' OR ([Tipo]) collate Latin1_General_BIN2=N'persona')`

##### `CreditosEditoriales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdCreditoEditorial` bigint↑id; `PublicacionEditorialId`* bigint; `AgenteEditorialId`* bigint; `RolCodigo`* nvarchar(20); `RolEtiqueta`* nvarchar(120); `Principal` bit=((0)); `Orden` int=((0)).
- PK: `IdCreditoEditorial`
- Único `UQ_CreditosEditoriales_PorRol`: `(PublicacionEditorialId,AgenteEditorialId,RolCodigo)`
- FK `AgenteEditorialId` → `AgentesEditoriales.IdAgenteEditorial`
- FK `PublicacionEditorialId` → `PublicacionesEditoriales.IdPublicacionEditorial`

##### `IdentificadoresEditoriales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdIdentificadorEditorial` bigint↑id; `PublicacionEditorialId`* bigint; `Esquema`* nvarchar(20); `CodigoRecibido`* nvarchar(60); `Cualificador` nvarchar(120); `Valido` bit; `ObservacionValidacion` nvarchar(400).
- PK: `IdIdentificadorEditorial`
- FK `PublicacionEditorialId` → `PublicacionesEditoriales.IdPublicacionEditorial`
- CHECK `CK_IdentificadoresEditoriales_Esquema`: `([Esquema]=N'ISMN' OR [Esquema]=N'ISBN')`

##### `PalabrasClaveEditoriales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdPalabraClaveEditorial` bigint↑id; `PublicacionEditorialId`* bigint; `Termino`* nvarchar(120).
- PK: `IdPalabraClaveEditorial`
- Único `UQ_PalabrasClaveEditoriales`: `(PublicacionEditorialId,Termino)`
- FK `PublicacionEditorialId` → `PublicacionesEditoriales.IdPublicacionEditorial`

##### `FuentesEditoriales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdFuenteEditorial` bigint↑id; `Nombre`* nvarchar(300); `Referencia` nvarchar(600); `Url` nvarchar(1000); `FechaFuente` datetime2; `FechaConsulta`* datetime2; `VerificadaPor`* nvarchar(200); `FechaCreacion` datetime2=(sysutcdatetime()).
- PK: `IdFuenteEditorial`

##### `ProgramasEditoriales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdProgramaEditorial` bigint↑id; `Codigo`* nvarchar(60); `Nombre`* nvarchar(200); `Activo` bit=((1)).
- PK: `IdProgramaEditorial`
- Único `UQ_ProgramasEditoriales_Codigo`: `(Codigo)`

##### `TipologiasEditoriales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdTipologiaEditorial` int↑id; `Eje`* nvarchar(20); `Codigo`* nvarchar(60); `Etiqueta`* nvarchar(120); `Norma`* nvarchar(60); `Orden` int=((0)).
- PK: `IdTipologiaEditorial`
- Único `UQ_TipologiasEditoriales_EjeCodigo`: `(Eje,Codigo)`
- CHECK `CK_TipologiasEditoriales_Eje`: `([Eje]=N'soporte' OR [Eje]=N'medio' OR [Eje]=N'contenido' OR [Eje]=N'recurso')`

<a id="proyectos_etiquetas"></a>
## Proyectos transversales, etiquetas y categorías

- `ProyectosTransversales` (3 de partida) enlaza con eventos y noticias; `Etiquetas` son las etiquetas libres de noticias/agenda (hashtags).
- `Categorias`: `CodigoModulo` en minúscula sin espacios; jerarquía solo para `editorial` (`CategoriaPadreId`). Las de noticias y agenda ya existen (migración `categorias_noticias_agenda`).

**Tablas:** `ProyectosTransversales`, `Etiquetas`, `Categorias`, `TitulacionesColectivas`

##### `ProyectosTransversales`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdProyectoTransversal` int↑id; `Codigo`* nvarchar(80); `Nombre`* nvarchar(200); `Descripcion` nvarchar(1000); `Activo` bit=((1)); `OrdenVisualizacion` int=((1)); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2.
- PK: `IdProyectoTransversal`
- Único `UQ_ProyectosTransversales_Codigo`: `(Codigo)`
- Único `UQ_ProyectosTransversales_Nombre`: `(Nombre)`
- CHECK `CK_ProyectosTransversales_Orden`: `([OrdenVisualizacion]>(0))`

##### `Etiquetas`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEtiqueta` int↑id; `NombreEtiqueta`* nvarchar(120); `Slug`* nvarchar(140).
- PK: `IdEtiqueta`
- Único `UQ_Etiquetas_NombreEtiqueta`: `(NombreEtiqueta)`
- Único `UQ_Etiquetas_Slug`: `(Slug)`

##### `Categorias`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdCategoria` int↑id; `CodigoModulo`* nvarchar(80); `NombreCategoria`* nvarchar(140); `Slug`* nvarchar(160); `Descripcion` nvarchar(600); `OrdenVisualizacion`* int; `CategoriaPadreId` int.
- PK: `IdCategoria`
- Único `UQ_Categorias_Modulo_Nombre`: `(CodigoModulo,NombreCategoria)`
- Único `UQ_Categorias_Modulo_Slug`: `(CodigoModulo,Slug)`
- Único `UX_Categorias_Id_Padre`: `(IdCategoria,CategoriaPadreId)`
- FK `CategoriaPadreId` → `Categorias.IdCategoria`
- CHECK `CK_Categorias_CodigoModulo_Formato`: `([CodigoModulo]=lower([CodigoModulo]) AND NOT [CodigoModulo] like '% %')`
- CHECK `CK_Categorias_Orden`: `([OrdenVisualizacion]>(0))`
- CHECK `CK_Categorias_PadreEditorial`: `([CategoriaPadreId] IS NULL OR [CodigoModulo]=N'editorial' AND [CategoriaPadreId]<>[IdCategoria])`

##### `TitulacionesColectivas`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdTitulacionColectiva` int↑id; `NombreTitulacionColectiva`* nvarchar(140); `Slug`* nvarchar(160); `Descripcion` nvarchar(800); `OrdenVisualizacion`* int.
- PK: `IdTitulacionColectiva`
- Único `UQ_TitulacionesColectivas_Nombre`: `(NombreTitulacionColectiva)`
- Único `UQ_TitulacionesColectivas_Slug`: `(Slug)`
- CHECK `CK_TitulacionesColectivas_Orden`: `([OrdenVisualizacion]>(0))`

<a id="galeria"></a>
## Galería pública (álbumes de fotos, de videos y mixtos)

- `GaleriaAlbumes.Tipo` ∈ {`fotos`, `videos`, `mixto`} (CHECK); `Slug` único (minúsculas, números y guiones); `ListaOrigenUrl` es un enlace https (la lista de reproducción de origen); solo `Publicado = 1` se ve en el portal y solo entonces se sirven al público sus fotos y portada (vínculo en `VinculosAsync` del Banco de archivos).
- `GaleriaItems.TipoItem` ∈ {`foto`, `video`}: la foto lleva `ArchivoId` (FK `Archivos`) y no `VideoId`; el video lleva `VideoId` (11 caracteres de YouTube, sin ningún archivo) y `Titulo`, y puede llevar fecha, descripción y `DuracionSegundos` (CHECK `CK_GaleriaItems_Destino`). `GaleriaAlbumId` es opcional: nulo = ítem «Sin álbum», que se ve con su propia marca `Publicado`. El video lleva además `MiniaturaArchivoId` (FK `Archivos`, su imagen propia; solo videos, CHECK `CK_GaleriaItems_Miniatura`) y, si `Descripcion` es un resumen, el texto completo en `Detalle`.
- Que el tipo del ítem sea coherente con el del álbum (un álbum de fotos no lleva videos y uno de videos no lleva fotos; el mixto, de ambos) lo valida la API y lo respeta la siembra; un CHECK no cruza tablas.
- **Privacidad:** no se guarda ninguna miniatura ni dirección de terceros salvo el identificador; la miniatura de un video no se pide a YouTube (la portada es una tarjeta propia).

**Tablas:** `GaleriaAlbumes`, `GaleriaItems`

##### `GaleriaAlbumes`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdGaleriaAlbum` int↑id; `Slug`* nvarchar(120); `Titulo`* nvarchar(200); `Descripcion` nvarchar(1000); `Tipo`* nvarchar(10); `Lugar` nvarchar(200); `FechaReferencia` date; `PortadaArchivoId` int; `ListaOrigenUrl` nvarchar(300); `Orden` int=((1)); `Publicado` bit=((0)); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2.
- PK: `IdGaleriaAlbum`
- Único `UQ_GaleriaAlbumes_Slug`: `(Slug)`
- FK `PortadaArchivoId` → `Archivos.IdArchivo`
- CHECK `CK_GaleriaAlbumes_ListaOrigen`: `([ListaOrigenUrl] IS NULL OR [ListaOrigenUrl] like N'https://%')`
- CHECK `CK_GaleriaAlbumes_Slug`: `(NOT [Slug] like N'%[^a-z0-9-]%' AND len([Slug])>(0))`
- CHECK `CK_GaleriaAlbumes_Tipo`: `([Tipo]=N'mixto' OR [Tipo]=N'videos' OR [Tipo]=N'fotos')`

##### `GaleriaItems`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdGaleriaItem` int↑id; `GaleriaAlbumId`* int; `TipoItem`* nvarchar(5); `Orden` int=((1)); `Titulo` nvarchar(250); `Descripcion` nvarchar(2000); `Fecha` date; `Credito` nvarchar(250); `TextoAlternativo` nvarchar(300); `ArchivoId` int; `VideoId` char(11); `DuracionSegundos` int.
- PK: `IdGaleriaItem`
- FK `GaleriaAlbumId` → `GaleriaAlbumes.IdGaleriaAlbum`
- FK `ArchivoId` → `Archivos.IdArchivo`
- CHECK `CK_GaleriaItems_Destino`: `([TipoItem]=N'foto' AND [ArchivoId] IS NOT NULL AND [VideoId] IS NULL AND [DuracionSegundos] IS NULL OR [TipoItem]=N'video' AND [VideoId] IS NOT NULL AND [ArchivoId] IS NULL AND [Titulo] IS NOT NULL)`
- CHECK `CK_GaleriaItems_Duracion`: `([DuracionSegundos] IS NULL OR [DuracionSegundos]>(0))`
- CHECK `CK_GaleriaItems_Tipo`: `([TipoItem]=N'video' OR [TipoItem]=N'foto')`
- CHECK `CK_GaleriaItems_VideoId`: `([VideoId] IS NULL OR NOT [VideoId] like N'%[^A-Za-z0-9_-]%')`

<a id="multimedia"></a>
## Archivos y multimedia

- `Archivos`: contenido binario en la base (`PesoBytes`); **tope 2 MiB (imágenes) y 20 MiB (PDF)** por `CK_Archivos_PesoPorTipo`. `Credito` y procedencia en columnas propias: anotar la fuente allí.
- `MediosWeb` (logotipo/fondo de sitio): `Uso` ∈ {`logotipo`, `fondo`}; tipos `image/jpeg|png|webp`; huellas hexadecimales en minúscula; borrador y publicado juntos y completos (`PublicadoCompleto`).
- Imágenes de festivales, perfiles, noticias y eventos se sirven vía `Archivos` + pivotes. Multimedia ligera (manifiesto + licencias fuera de git); el generador referencia el manifiesto por `ClaveImagen`.

**Tablas:** `Archivos`, `MediosWeb`, `MediosWebHistorial`

##### `Archivos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdArchivo` int↑id; `NombreOriginal`* nvarchar(260); `NombreAlmacenado`* nvarchar(260); `Extension` nvarchar(20); `TipoMime`* nvarchar(120); `PesoBytes` bigint; `RutaAlmacenamiento`* nvarchar(700); `UrlPublica` nvarchar(1000); `TextoAlternativo` nvarchar(300); `Pie` nvarchar(500); `Credito` nvarchar(250); `IdUsuarioCarga`* int; `FechaCarga` datetime2=(sysutcdatetime()); `Contenido` varbinary(max); `Huella` char(64); `Ancho` int; `Alto` int; `OrganizacionId` int.
- PK: `IdArchivo`
- Único `UQ_Archivos_RutaAlmacenamiento`: `(RutaAlmacenamiento)`
- FK `OrganizacionId` → `Entidades.IdEntidad`
- FK `IdUsuarioCarga` → `Usuarios.IdUsuario`
- CHECK `CK_Archivos_PesoBytes`: `([PesoBytes] IS NULL OR [PesoBytes]>=(0))`
- CHECK `CK_Archivos_PesoPorTipo`: `([PesoBytes]<=case when [TipoMime]=N'application/pdf' then (20971520) else (2097152) end)`

##### `MediosWeb`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdMedioWeb` int↑id; `Clave`* nvarchar(160); `GrupoId`* nvarchar(120); `GrupoEtiqueta`* nvarchar(160); `Seccion`* nvarchar(120); `Etiqueta`* nvarchar(240); `Uso` nvarchar(40)=(N'fondo'); `AnchoSugerido` int; `AltoSugerido` int; `Editable` bit=((1)); `TextoAlternativo` nvarchar(300)=(N''); `BorradorContenido` varbinary(max); `BorradorTipo` nvarchar(40); `BorradorBytes` int; `BorradorAncho` int; `BorradorAlto` int; `BorradorHuella` char(64); `BorradorMiniatura` varbinary(max); `PublicadoContenido` varbinary(max); `PublicadoTipo` nvarchar(40); `PublicadoBytes` int; `PublicadoAncho` int; `PublicadoAlto` int; `PublicadoHuella` char(64); `PublicadoMiniatura` varbinary(max); `Version` int=((1)); `ActualizadoPor` nvarchar(160)=(N'Sistema'); `FechaActualizacion` datetime2=(sysutcdatetime()); `FechaRetiro` datetime2.
- PK: `IdMedioWeb`
- Único `UQ_MediosWeb_Clave`: `(Clave)`
- CHECK `CK_MediosWeb_BorradorCompleto`: `([BorradorContenido] IS NULL AND [BorradorTipo] IS NULL AND [BorradorBytes] IS NULL AND [BorradorAncho] IS NULL AND [BorradorAlto] IS NULL AND [BorradorHuella] IS NULL OR [BorradorContenido] IS NOT NULL AND [BorradorTipo] IS NOT NULL AND [BorradorBytes] IS NOT NULL AND [BorradorAncho] IS NOT NULL AND [BorradorAlto] IS NOT NULL AND [BorradorHuella] IS NOT NULL)`
- CHECK `CK_MediosWeb_BorradorTipo`: `([BorradorTipo] IS NULL OR ([BorradorTipo]=N'image/jpeg' OR [BorradorTipo]=N'image/png' OR [BorradorTipo]=N'image/webp'))`
- CHECK `CK_MediosWeb_BorradorTope`: `([BorradorBytes] IS NULL OR [BorradorBytes]>(0) AND [BorradorBytes]<=(2097152))`
- CHECK `CK_MediosWeb_BytesReales`: `(([BorradorContenido] IS NULL OR datalength([BorradorContenido])=[BorradorBytes]) AND ([PublicadoContenido] IS NULL OR datalength([PublicadoContenido])=[PublicadoBytes]))`
- CHECK `CK_MediosWeb_Dimensiones`: `(([BorradorAncho] IS NULL OR [BorradorAncho]>=(1) AND [BorradorAncho]<=(12000) AND ([BorradorAlto]>=(1) AND [BorradorAlto]<=(12000))) AND ([PublicadoAncho] IS NULL OR [PublicadoAncho]>=(1) AND [PublicadoAncho]<=(12000) AND ([PublicadoAlto]>=(1) AND [PublicadoAlto]<=(12000))))`
- CHECK `CK_MediosWeb_HuellaHex`: `(([BorradorHuella] IS NULL OR NOT ([BorradorHuella]) collate Latin1_General_BIN2 like '%[^0-9a-f]%') AND ([PublicadoHuella] IS NULL OR NOT ([PublicadoHuella]) collate Latin1_General_BIN2 like '%[^0-9a-f]%'))`
- CHECK `CK_MediosWeb_MiniaturaTope`: `(([BorradorMiniatura] IS NULL OR datalength([BorradorMiniatura])<=(24576)) AND ([PublicadoMiniatura] IS NULL OR datalength([PublicadoMiniatura])<=(24576)))`
- CHECK `CK_MediosWeb_NoEditableSinBytes`: `([Editable]=(1) OR [BorradorContenido] IS NULL AND [PublicadoContenido] IS NULL)`
- CHECK `CK_MediosWeb_NoPublicadoYRetirado`: `([PublicadoContenido] IS NULL OR [FechaRetiro] IS NULL)`
- CHECK `CK_MediosWeb_PublicadoCompleto`: `([PublicadoContenido] IS NULL AND [PublicadoTipo] IS NULL AND [PublicadoBytes] IS NULL AND [PublicadoAncho] IS NULL AND [PublicadoAlto] IS NULL AND [PublicadoHuella] IS NULL OR [PublicadoContenido] IS NOT NULL AND [PublicadoTipo] IS NOT NULL AND [PublicadoBytes] IS NOT NULL AND [PublicadoAncho] IS NOT NULL AND [PublicadoAlto] IS NOT NULL AND [PublicadoHuella] IS NOT NULL)`
- CHECK `CK_MediosWeb_PublicadoTipo`: `([PublicadoTipo] IS NULL OR ([PublicadoTipo]=N'image/jpeg' OR [PublicadoTipo]=N'image/png' OR [PublicadoTipo]=N'image/webp'))`
- CHECK `CK_MediosWeb_PublicadoTope`: `([PublicadoBytes] IS NULL OR [PublicadoBytes]>(0) AND [PublicadoBytes]<=(2097152))`
- CHECK `CK_MediosWeb_Uso`: `([Uso]=N'logotipo' OR [Uso]=N'fondo')`

##### `MediosWebHistorial`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdMedioWebHistorial` bigint↑id; `Clave`* nvarchar(160); `Accion`* nvarchar(40); `Tipo` nvarchar(40); `Bytes` int; `Ancho` int; `Alto` int; `Huella` char(64); `Usuario`* nvarchar(160); `Fecha` datetime2=(sysutcdatetime()).
- PK: `IdMedioWebHistorial`
- CHECK `CK_MediosWebHistorial_Accion`: `([Accion]=N'republicado' OR [Accion]=N'retirado' OR [Accion]=N'publicado' OR [Accion]=N'guardado')`
- CHECK `CK_MediosWebHistorial_Tipo`: `([Tipo] IS NULL OR ([Tipo]=N'image/jpeg' OR [Tipo]=N'image/png' OR [Tipo]=N'image/webp'))`
- CHECK `CK_MediosWebHistorial_Tope`: `([Bytes] IS NULL OR [Bytes]>(0) AND [Bytes]<=(2097152))`

<a id="equipos_invitaciones"></a>
## Equipos e invitaciones

Ver «Organizaciones» y «Mercados». Reglas: una invitación `pendiente` lleva correo del invitado y caducidad futura; `aceptada` ⇒ existe la fila de `UsuariosEntidades`; `vencida` ⇒ caducidad pasada; `revocada` con fecha.

**Tablas:** `UsuariosEntidades`, `InvitacionesDeOrganizacion`, `InvitacionesDeAgenda`

##### `UsuariosEntidades`

Descrita arriba (la tabla sirve a más de un tipo).

##### `InvitacionesDeOrganizacion`

Descrita arriba (la tabla sirve a más de un tipo).

##### `InvitacionesDeAgenda`

Descrita arriba (la tabla sirve a más de un tipo).

<a id="notificaciones"></a>
## Notificaciones

- `Estado` ∈ {`pendiente`, `enviada`, `leida`, `fallida`, `cancelada`}; `Canal` ∈ {`internal`, `email`, `whatsapp`} (la demo solo `internal` y `email`); `AmbitoAcceso` ∈ {`external`, `institutional`}.
- Coherencia: `leida` ⇒ `FechaLectura` ≥ `FechaEnvio` ≥ `FechaCreacion`; `fallida` ⇒ `Error` e `Intentos` ≥ 1; destinatario por `UsuarioDestinatarioId` o `CorreoDestinatario`; `ModuloId`/`RegistroId` apuntan al proceso (sin FK).
- `FechaOcultacion` = la persona la ocultó.

**Tablas:** `Notificaciones`

##### `Notificaciones`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdNotificacion` bigint↑id; `UsuarioDestinatarioId` int; `CorreoDestinatario` nvarchar(320); `TipoEvento`* nvarchar(100); `Canal` nvarchar(40)=(N'internal'); `Titulo`* nvarchar(240); `Cuerpo`* nvarchar(2000); `Estado` nvarchar(40)=(N'pendiente'); `ModuloId` nvarchar(80); `RegistroId` nvarchar(120); `MetadataJson` nvarchar(max); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaEnvio` datetime2; `FechaLectura` datetime2; `Intentos` int=((0)); `Error` nvarchar(1200); `FechaOcultacion` datetime2; `AmbitoAcceso` nvarchar(20)=(N'external').
- PK: `IdNotificacion`
- FK `UsuarioDestinatarioId` → `Usuarios.IdUsuario`
- CHECK `CK_Notificaciones_AmbitoAcceso`: `([AmbitoAcceso]=N'institutional' OR [AmbitoAcceso]=N'external')`
- CHECK `CK_Notificaciones_Canal`: `([Canal]=N'whatsapp' OR [Canal]=N'email' OR [Canal]=N'internal')`
- CHECK `CK_Notificaciones_Estado`: `([Estado]=N'cancelada' OR [Estado]=N'fallida' OR [Estado]=N'leida' OR [Estado]=N'enviada' OR [Estado]=N'pendiente')`

<a id="revisiones"></a>
## Solicitudes de revisión, propuestas e historiales

- **Revisión por campos** (`RevisionesDeRegistro`): `Estado` ∈ {`borrador`, `enviada`, `cerrada`}; `FechaEnvio` nula solo en `borrador`; `FechaCierre` solo en `cerrada` (CHECK). Observaciones: `Ambito` ∈ {`principal`, `subregistro`}
  (`subregistro` exige `SubregistroId`), `Estado` ∈ {`pendiente`, `atendida`}.
- **Envíos** (`EnviosDeRevision`): una fila por envío, `NumeroEnvio` correlativo por registro; guarda la instantánea `DatosJson` (JSON válido).
- **Propuestas de cambio** (`PropuestasDeCambio`): `Estado` ∈ {`borrador`, `en_revision`, `ajustes_solicitados`, `aplicada`, `rechazada`}. `FechaEnvio` nula solo en borrador; `FechaDecision` solo en `aplicada`/`rechazada`; `rechazada` exige `MotivoDeLaDecision`.
  Transiciones: `borrador` → `en_revision` → {`aplicada` | `ajustes_solicitados` | `rechazada`}; `ajustes_solicitados` → `en_revision`. Cada campo propuesto en `PropuestasDeCambioCampos` (único por propuesta y campo). **Una sola propuesta viva** (no aplicada ni rechazada) por (módulo, registro) y una sola revisión por campos no cerrada por registro.
- **Historial** (`RegistrosRevisionHistorial`): una fila por transición de estado de un proceso; `EstadoNuevo` ∈ los siete de contenido + `pendiente_revision`/`validada`/`observada`/`retirado` (editorial); el estado nuevo del historial
  debe coincidir con el `EstadoRegistro` actual del proceso y las fechas deben ser crecientes. `Accion` coherente (enviar, solicitar ajustes, publicar, rechazar, archivar…).
- `CambiosDeRegistro`: bitácora de campos (`ClaseDato` ∈ {`publico`, `organizacion`, `contacto`, `identificacion`, `sensible`}; `Origen` ∈ {`directo`, `propuesta`, `importacion`, `fusion`, `sistema`, `migracion`}).
- `BorradoresProceso.Estado` ∈ {`borrador`, `cerrado`, `cancelado`}: solo uno `borrador` por (módulo, organización, persona).
- `ProcedenciasDeRegistro` es **la tabla de negocio** (contexto `siembra`, `historico`, `prueba`, `importacion`, `externo`, `administrativo`) y NO sustituye a `DatosDeDemostracion` (kit de demo): el generador escribe ambas cuando el API la exige.
- `BitacoraAuditoria.Accion` tiene CHECK con la lista de acciones auditables; el generador solo sembrará las que el API produce.

**Tablas:** `RevisionesDeRegistro`, `RevisionesDeRegistroObservaciones`, `EnviosDeRevision`, `PropuestasDeCambio`, `PropuestasDeCambioCampos`, `RegistrosRevisionHistorial`, `CambiosDeRegistro`, `BorradoresProceso`, `ProcedenciasDeRegistro`, `BitacoraAuditoria`

##### `RevisionesDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdRevision` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `Estado` nvarchar(40)=(N'borrador'); `IdUsuarioRevisor`* int; `RevisorNombre` nvarchar(480); `IdUsuarioDestinatario` int; `DestinatarioNombre` nvarchar(480); `IdOrganizacion` int; `OrganizacionNombre` nvarchar(480); `ObservacionGeneral` nvarchar(2400); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `FechaEnvio` datetime2; `FechaCierre` datetime2.
- PK: `IdRevision`
- Único `UQ_RevisionesDeRegistro_Viva`: `(ModuloId,RegistroId)` donde `([Estado]<>N'cerrada')`
- FK `IdUsuarioDestinatario` → `Usuarios.IdUsuario`
- FK `IdOrganizacion` → `Entidades.IdEntidad`
- FK `IdUsuarioRevisor` → `Usuarios.IdUsuario`
- CHECK `CK_RevisionesDeRegistro_Estado`: `([Estado]=N'cerrada' OR [Estado]=N'enviada' OR [Estado]=N'borrador')`
- CHECK `CK_RevisionesDeRegistro_FechaCierre`: `([Estado]=N'cerrada' AND [FechaCierre] IS NOT NULL OR [Estado]<>N'cerrada' AND [FechaCierre] IS NULL)`
- CHECK `CK_RevisionesDeRegistro_FechaEnvio`: `([Estado]=N'borrador' AND [FechaEnvio] IS NULL OR [Estado]<>N'borrador' AND [FechaEnvio] IS NOT NULL)`
- CHECK `CK_RevisionesDeRegistro_Registro`: `(len(ltrim(rtrim([ModuloId])))>(0) AND len(ltrim(rtrim([RegistroId])))>(0))`

##### `RevisionesDeRegistroObservaciones`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdObservacion` bigint↑id; `IdRevision`* bigint; `Ambito`* nvarchar(40); `SubregistroId` nvarchar(120); `SeccionId`* nvarchar(80); `CampoId`* nvarchar(120); `CampoEtiqueta`* nvarchar(240); `ValorObservado` nvarchar(max); `Nota`* nvarchar(2400); `Estado` nvarchar(40)=(N'pendiente'); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `FechaAtencion` datetime2; `IdUsuarioAtiende` int.
- PK: `IdObservacion`
- Único `UQ_RevisionesDeRegistroObservaciones_Campo`: `(IdRevision,Ambito,SubregistroId,CampoId)`
- FK `IdUsuarioAtiende` → `Usuarios.IdUsuario`
- FK `IdRevision` → `RevisionesDeRegistro.IdRevision`
- CHECK `CK_RevisionesDeRegistroObservaciones_Ambito`: `([Ambito]=N'subregistro' OR [Ambito]=N'principal')`
- CHECK `CK_RevisionesDeRegistroObservaciones_Estado`: `([Estado]=N'atendida' OR [Estado]=N'pendiente')`
- CHECK `CK_RevisionesDeRegistroObservaciones_Nota`: `(len(ltrim(rtrim([Nota])))>(0))`
- CHECK `CK_RevisionesDeRegistroObservaciones_Subregistro`: `([Ambito]=N'subregistro' AND [SubregistroId] IS NOT NULL OR [Ambito]=N'principal' AND [SubregistroId] IS NULL)`

##### `EnviosDeRevision`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdEnvioDeRevision` bigint↑id; `NumeroEnvio`* int; `IdUsuarioRemitente`* int; `IdOrganizacion`* int; `IdRevisionOrigen` bigint; `EstadoAnterior`* nvarchar(40); `DatosJson`* nvarchar(max); `FechaEnvio`* datetime2; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120).
- PK: `IdEnvioDeRevision`
- Único `UQ_EnviosDeRevision_Numero`: `(ModuloId,RegistroId,NumeroEnvio)`
- FK `IdOrganizacion` → `Entidades.IdEntidad`
- FK `IdRevisionOrigen` → `RevisionesDeRegistro.IdRevision`
- FK `IdUsuarioRemitente` → `Usuarios.IdUsuario`
- CHECK `CK_EnviosDeRevision_Datos`: `(isjson([DatosJson])=(1))`
- CHECK `CK_EnviosDeRevision_Numero`: `([NumeroEnvio]>(0))`

##### `PropuestasDeCambio`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdPropuesta` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `Estado` nvarchar(40)=(N'borrador'); `IdOrganizacion` int; `OrganizacionNombre` nvarchar(480); `IdUsuarioProponente` int; `ProponenteNombre` nvarchar(480); `Motivo` nvarchar(2400); `IdUsuarioDecide` int; `DecideNombre` nvarchar(480); `MotivoDeLaDecision` nvarchar(2400); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2; `FechaEnvio` datetime2; `FechaDecision` datetime2; `SubregistroId` nvarchar(120); `SubregistroResultanteId` nvarchar(120); `IdUsuarioResponsable` int.
- PK: `IdPropuesta`
- Único `UQ_PropuestasDeCambio_Viva`: `(ModuloId,RegistroId)` donde `([Estado]<>N'aplicada' AND [Estado]<>N'rechazada')`
- FK `IdUsuarioDecide` → `Usuarios.IdUsuario`
- FK `IdOrganizacion` → `Entidades.IdEntidad`
- FK `IdUsuarioProponente` → `Usuarios.IdUsuario`
- FK `IdUsuarioResponsable` → `Usuarios.IdUsuario`
- CHECK `CK_PropuestasDeCambio_Estado`: `([Estado]=N'rechazada' OR [Estado]=N'aplicada' OR [Estado]=N'ajustes_solicitados' OR [Estado]=N'en_revision' OR [Estado]=N'borrador')`
- CHECK `CK_PropuestasDeCambio_FechaDecision`: `(([Estado]=N'rechazada' OR [Estado]=N'aplicada') AND [FechaDecision] IS NOT NULL OR NOT ([Estado]=N'rechazada' OR [Estado]=N'aplicada') AND [FechaDecision] IS NULL)`
- CHECK `CK_PropuestasDeCambio_FechaEnvio`: `([Estado]=N'borrador' AND [FechaEnvio] IS NULL OR [Estado]<>N'borrador' AND [FechaEnvio] IS NOT NULL)`
- CHECK `CK_PropuestasDeCambio_MotivoDelRechazo`: `([Estado]<>N'rechazada' OR len(ltrim(rtrim(isnull([MotivoDeLaDecision],N''))))>(0))`
- CHECK `CK_PropuestasDeCambio_Registro`: `(len(ltrim(rtrim([ModuloId])))>(0) AND len(ltrim(rtrim([RegistroId])))>(0))`
- CHECK `CK_PropuestasDeCambio_UnSoloResponsable`: `([IdOrganizacion] IS NOT NULL AND [IdUsuarioResponsable] IS NULL OR [IdOrganizacion] IS NULL AND [IdUsuarioResponsable] IS NOT NULL)`

##### `PropuestasDeCambioCampos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdCampoPropuesto` bigint↑id; `IdPropuesta`* bigint; `SeccionId`* nvarchar(80); `CampoId`* nvarchar(120); `CampoEtiqueta`* nvarchar(240); `ValorAnterior` nvarchar(max); `ValorPropuesto` nvarchar(max); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2.
- PK: `IdCampoPropuesto`
- Único `UQ_PropuestasDeCambioCampos_Campo`: `(IdPropuesta,CampoId)`
- FK `IdPropuesta` → `PropuestasDeCambio.IdPropuesta`
- CHECK `CK_PropuestasDeCambioCampos_Campo`: `(len(ltrim(rtrim([CampoId])))>(0) AND len(ltrim(rtrim([CampoEtiqueta])))>(0))`

##### `RegistrosRevisionHistorial`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdRevisionHistorial` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `EstadoAnterior` nvarchar(80); `EstadoNuevo`* nvarchar(80); `Accion`* nvarchar(80); `Comentario` nvarchar(1200); `MotivoRechazo` nvarchar(1200); `CamposObservados` nvarchar(max); `IdUsuario` int; `Fecha` datetime2=(sysutcdatetime()); `MetadataJson` nvarchar(max); `OrganizacionId` int; `OrganizacionNombre` nvarchar(240); `ResponsableNombre` nvarchar(240); `ActorNombre` nvarchar(240).
- PK: `IdRevisionHistorial`
- CHECK `CK_RegistrosRevisionHistorial_EstadoNuevo`: `([EstadoNuevo]=N'retirado' OR [EstadoNuevo]=N'observada' OR [EstadoNuevo]=N'validada' OR [EstadoNuevo]=N'pendiente_revision' OR [EstadoNuevo]=N'archivado' OR [EstadoNuevo]=N'rechazado' OR [EstadoNuevo]=N'publicado' OR [EstadoNuevo]=N'aprobado' OR [EstadoNuevo]=N'ajustes_solicitados' OR [EstadoNuevo]=N'en_revision' OR [EstadoNuevo]=N'borrador')`

##### `CambiosDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdCambio` bigint↑id; `ModuloId`* nvarchar(40); `RegistroId`* nvarchar(64); `OrganizacionId` int; `IdGrupo`* uniqueidentifier; `CampoId`* nvarchar(80); `CampoEtiqueta`* nvarchar(160); `ClaseDato`* nvarchar(20); `ValorAnterior` nvarchar(max); `ValorNuevo` nvarchar(max); `Origen`* nvarchar(20); `PropuestaId` bigint; `PerfilPublicoFestivalId` int; `ActorId` int; `ActorNombre` nvarchar(200); `ActorRol` nvarchar(60); `Motivo` nvarchar(500); `Fecha` datetime2=(sysutcdatetime()); `NombreAnterior` nvarchar(300); `NombreNuevo` nvarchar(300).
- PK: `IdCambio`
- FK `ActorId` → `Usuarios.IdUsuario`
- CHECK `CK_CambiosDeRegistro_ClaseDato`: `([ClaseDato]=N'sensible' OR [ClaseDato]=N'identificacion' OR [ClaseDato]=N'contacto' OR [ClaseDato]=N'organizacion' OR [ClaseDato]=N'publico')`
- CHECK `CK_CambiosDeRegistro_Distinto`: `([ValorAnterior] IS NULL OR [ValorNuevo] IS NULL OR [ValorAnterior]<>[ValorNuevo])`
- CHECK `CK_CambiosDeRegistro_Origen`: `([Origen]=N'migracion' OR [Origen]=N'sistema' OR [Origen]=N'fusion' OR [Origen]=N'importacion' OR [Origen]=N'propuesta' OR [Origen]=N'directo')`

##### `BorradoresProceso`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdBorradorProceso` bigint↑id; `ModuloId`* nvarchar(80); `OrganizacionId` int; `PersonaId`* int; `Estado` nvarchar(40)=(N'borrador'); `DatosJson` nvarchar(max)=(N'{}'); `Version` int=((1)); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2=(sysutcdatetime()).
- PK: `IdBorradorProceso`
- Único `UX_BorradoresProceso_Abierto`: `(ModuloId,OrganizacionId,PersonaId)` donde `([Estado]=N'borrador')`
- FK `OrganizacionId` → `Entidades.IdEntidad`
- FK `PersonaId` → `Usuarios.IdUsuario`
- CHECK `CK_BorradoresProceso_Estado`: `([Estado]=N'cancelado' OR [Estado]=N'cerrado' OR [Estado]=N'borrador')`

##### `ProcedenciasDeRegistro`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdProcedencia` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `ContextoOrigen`* nvarchar(20); `OrganizacionProcedenciaId` int; `UsuarioCreadorId` int; `FechaRegistro` datetime2=(sysutcdatetime()).
- PK: `IdProcedencia`
- Único `UQ_ProcedenciasDeRegistro`: `(ModuloId,RegistroId)`
- FK `OrganizacionProcedenciaId` → `Entidades.IdEntidad`
- FK `UsuarioCreadorId` → `Usuarios.IdUsuario`
- CHECK `CK_ProcedenciasDeRegistro_Contexto`: `([ContextoOrigen]=N'prueba' OR [ContextoOrigen]=N'historico' OR [ContextoOrigen]=N'siembra' OR [ContextoOrigen]=N'importacion' OR [ContextoOrigen]=N'externo' OR [ContextoOrigen]=N'administrativo')`

##### `BitacoraAuditoria`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdAuditoria` bigint↑id; `IdUsuario` int; `TablaAfectada`* nvarchar(160); `IdRegistroAfectado`* nvarchar(120); `Accion`* nvarchar(40); `ValoresAnteriores` nvarchar(max); `ValoresNuevos` nvarchar(max); `FechaAccion` datetime2=(sysutcdatetime()).
- PK: `IdAuditoria`
- FK `IdUsuario` → `Usuarios.IdUsuario`
- CHECK `CK_BitacoraAuditoria_Accion`: `([Accion]=N'consultar' OR [Accion]=N'asignar_administrador_inicial' OR [Accion]=N'crear_organizacion' OR [Accion]=N'cerrar_sesion_externa' OR [Accion]=N'iniciar_sesion_externa' OR [Accion]=N'cerrar_sesion' OR [Accion]=N'iniciar_sesion' OR [Accion]=N'rechazar' OR [Accion]=N'aprobar' OR [Accion]=N'archivar' OR [Accion]=N'publicar' OR [Accion]=N'eliminar' OR [Accion]=N'actualizar' OR [Accion]=N'crear')`
- CHECK `CK_BitacoraAuditoria_ValoresAnteriores_JSON`: `([ValoresAnteriores] IS NULL OR isjson([ValoresAnteriores])=(1))`
- CHECK `CK_BitacoraAuditoria_ValoresNuevos_JSON`: `([ValoresNuevos] IS NULL OR isjson([ValoresNuevos])=(1))`

<a id="celebra"></a>
## Celebra la música: ediciones del micrositio

- **Una edición por año** (`CelebraEdiciones`, `Anio` único entre 2011 y 2100), cada una con su proyecto transversal (`ProyectoTransversalId`, único): los de 2025 y 2026 existen por migración y la limpieza los conserva.
  Una sola edición vigente (`Actual = 1`, índice único filtrado). Colores `#RRGGBB` (CHECK). Cifras no negativas. `Publicada` decide si la ve el público: la API pública solo sirve las publicadas.
- **Hijas** (sin cascada; todas por `CelebraEdicionId`): `CelebraCategorias` (nombre único por edición), `CelebraPreguntas`, `CelebraGaleria` (archivo único por edición; `TextoAlternativo` obligatorio) y `CelebraRecursos`.
  Un recurso lleva un archivo del Banco **o** un enlace `https://`, nunca ambos ni ninguno (CHECK). El grupo «Aliados» (o «Logos de aliados») no es de la caja de herramientas: la página muestra cada recurso como logotipo del aliado cuyo nombre
  coincide con su `Titulo` en el texto `Aliados` de la edición.
- **No tiene noticias ni agenda propias**: son las generales filtradas por el proyecto de la edición (`EventosAgendaProyectosTransversales`, `NoticiasProyectosTransversales`).
- Un archivo del Banco se sirve a anónimos mientras la edición que lo cita esté publicada (portada, galería y recursos).

**Tablas:** `CelebraEdiciones`, `CelebraCategorias`, `CelebraRecursos`, `CelebraPreguntas`, `CelebraGaleria`

##### `CelebraEdiciones`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdCelebraEdicion` int↑id; `Anio`* int; `Nombre`* nvarchar(200); `Hashtag` nvarchar(80); `ProyectoTransversalId`* int; `FechaInicio` date; `FechaFin` date; `Resumen` nvarchar(600); `Presentacion` nvarchar(max); `Aliados` nvarchar(500); `Actividades` int; `Municipios` int; `Departamentos` int; `Organizaciones` int; `Musicos` int; `ColorPrincipal` char(7)=('#6B2A8C'); `ColorSecundario` char(7)=('#E5007E'); `ImagenPortadaArchivoId` int; `Actual` bit=((0)); `Publicada` bit=((0)); `Fuente` nvarchar(300); `PendienteDeValidar` bit=((0)); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2.
- PK: `IdCelebraEdicion`
- Único `UQ_CelebraEdiciones_Anio`: `(Anio)`
- Único `UQ_CelebraEdiciones_Proyecto`: `(ProyectoTransversalId)`
- Único `UX_CelebraEdiciones_Actual`: `(Actual)` donde `([Actual]=(1))`
- FK `ImagenPortadaArchivoId` → `Archivos.IdArchivo`
- FK `ProyectoTransversalId` → `ProyectosTransversales.IdProyectoTransversal`
- CHECK `CK_CelebraEdiciones_Anio`: `([Anio]>=(2011) AND [Anio]<=(2100))`
- CHECK `CK_CelebraEdiciones_Cifras`: `(([Actividades] IS NULL OR [Actividades]>=(0)) AND ([Municipios] IS NULL OR [Municipios]>=(0)) AND ([Departamentos] IS NULL OR [Departamentos]>=(0)) AND ([Organizaciones] IS NULL OR [Organizaciones]>=(0)) AND ([Musicos] IS NULL OR [Musicos]>=(0)))`
- CHECK `CK_CelebraEdiciones_Colores`: `([ColorPrincipal] like '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]' AND [ColorSecundario] like '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')`
- CHECK `CK_CelebraEdiciones_Fechas`: `([FechaFin] IS NULL OR [FechaInicio] IS NULL OR [FechaFin]>=[FechaInicio])`

##### `CelebraCategorias`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdCelebraCategoria` int↑id; `CelebraEdicionId`* int; `Nombre`* nvarchar(120); `Descripcion` nvarchar(600); `Orden` int=((1)).
- PK: `IdCelebraCategoria`
- Único `UQ_CelebraCategorias_Nombre`: `(CelebraEdicionId,Nombre)`
- FK `CelebraEdicionId` → `CelebraEdiciones.IdCelebraEdicion`
- CHECK `CK_CelebraCategorias_Orden`: `([Orden]>(0))`

##### `CelebraRecursos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdCelebraRecurso` int↑id; `CelebraEdicionId`* int; `Grupo`* nvarchar(120); `Titulo`* nvarchar(200); `Descripcion` nvarchar(600); `ArchivoId` int; `Url` nvarchar(500); `Orden` int=((1)).
- PK: `IdCelebraRecurso`
- FK `ArchivoId` → `Archivos.IdArchivo`
- FK `CelebraEdicionId` → `CelebraEdiciones.IdCelebraEdicion`
- CHECK `CK_CelebraRecursos_Destino`: `([ArchivoId] IS NOT NULL AND [Url] IS NULL OR [ArchivoId] IS NULL AND [Url] IS NOT NULL)`
- CHECK `CK_CelebraRecursos_Orden`: `([Orden]>(0))`
- CHECK `CK_CelebraRecursos_Url`: `([Url] IS NULL OR [Url] like 'https://%')`

##### `CelebraPreguntas`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdCelebraPregunta` int↑id; `CelebraEdicionId`* int; `Pregunta`* nvarchar(300); `Respuesta`* nvarchar(2000); `Orden` int=((1)).
- PK: `IdCelebraPregunta`
- FK `CelebraEdicionId` → `CelebraEdiciones.IdCelebraEdicion`
- CHECK `CK_CelebraPreguntas_Orden`: `([Orden]>(0))`

##### `CelebraGaleria`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdCelebraImagen` int↑id; `CelebraEdicionId`* int; `ArchivoId`* int; `TextoAlternativo`* nvarchar(300); `Credito` nvarchar(250); `Orden` int=((1)).
- PK: `IdCelebraImagen`
- Único `UQ_CelebraGaleria_Archivo`: `(CelebraEdicionId,ArchivoId)`
- FK `ArchivoId` → `Archivos.IdArchivo`
- FK `CelebraEdicionId` → `CelebraEdiciones.IdCelebraEdicion`
- CHECK `CK_CelebraGaleria_Orden`: `([Orden]>(0))`

<a id="coincidencias_reclamaciones"></a>
## Coincidencias, vinculaciones y reclamaciones

- **Reclamación** (`ReclamacionesAdministracion`): `Estado` ∈ {`borrador`, `enviada`, `en_revision`, `requiere_aclaracion`, `aclaracion_enviada`, `aprobada`, `rechazada`, `cancelada`, `transferencia_ejecutada`, `historica`}.
  Activas: `borrador`, `enviada`, `en_revision`, `requiere_aclaracion`, `aclaracion_enviada`, `aprobada` (`EsActiva` es columna CALCULADA a partir del estado: no se inserta; integridad: una sola activa por registro canónico). Transiciones: `borrador` → `enviada` → `en_revision` → {`requiere_aclaracion` → `aclaracion_enviada` → `en_revision` | `aprobada` | `rechazada`};
  `aprobada` → `transferencia_ejecutada` (concilia y mueve la administración; escribe `TransferenciasAdministracion`); `cancelada` desde la organización; `historica` es el cierre de lo anterior al modelo actual.
  `FechaEnvio` desde `enviada`; `FechaDecision`/`DecisorId`/`MotivoDecision` en `aprobada`/`rechazada`; `SenalesJson` y `Justificacion` obligatorios; la organización solicitante NO es la responsable actual.
- `ReclamacionesAclaraciones`: pregunta de la gestión + respuesta de la organización (con soportes `ArchivosDeRegistro`, módulo `reclamaciones-administracion`).
- **Vinculación** (`SolicitudesVinculacionRegistros`): `Estado` ∈ {`pendiente`, `en_revision`, `ajustes_solicitados`, `aprobada`, `rechazada`, `cancelada`}; `AlcanceSolicitado` ∈ {`editor`, `responsable`}; `Justificacion` obligatoria; revisor y comentario al decidir.
- **Duplicados/coincidencias** (`RegistrosDuplicadosCandidatos`): `NivelCoincidencia` ∈ {`alta`, `media`, `baja`}; `Estado` ∈ {`pendiente`, `resuelto`}; `Decision` ∈ {`pendiente`, `fusionar`, `mantener_separados`, `no_duplicado`} (nula = sin decidir).
- Escenarios a sembrar: coincidencia clara (1 candidato alto), parcial, varios candidatos, ninguna, histórico sin reclamar, ya reclamado (`transferencia_ejecutada`), solicitud pendiente, aprobada, rechazada, devuelta (`requiere_aclaracion`).
  **No se simulan resultados que la plataforma no produce**: las coincidencias del buscador se calculan, no se insertan; solo se insertan candidatos de duplicado cuando el API los produce.
- `RegistrosCalidadDatos`: `Severidad` ∈ {`alta`, `media`, `baja`}; `Estado` ∈ {`abierta`, `en_revision`, `resuelta`, `descartada`}.

**Tablas:** `RegistrosDuplicadosCandidatos`, `SolicitudesVinculacionRegistros`, `ReclamacionesAdministracion`, `ReclamacionesAclaraciones`, `ReclamacionesConciliaciones`, `TransferenciasAdministracion`, `RegistrosCalidadDatos`

##### `RegistrosDuplicadosCandidatos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdDuplicadoCandidato` bigint↑id; `ModuloId`* nvarchar(80); `RegistroOrigenId`* nvarchar(120); `RegistroCandidatoId`* nvarchar(120); `NivelCoincidencia`* nvarchar(20); `PuntajeCoincidencia` decimal; `EvidenciaJson` nvarchar(max)=(N'{}'); `Estado` nvarchar(40)=(N'pendiente'); `Decision` nvarchar(40); `ComentarioDecision` nvarchar(1200); `UsuarioRevisorId` int; `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2=(sysutcdatetime()).
- PK: `IdDuplicadoCandidato`
- CHECK `CK_RegistrosDuplicadosCandidatos_Decision`: `([Decision] IS NULL OR ([Decision]=N'pendiente' OR [Decision]=N'no_duplicado' OR [Decision]=N'mantener_separados' OR [Decision]=N'fusionar'))`
- CHECK `CK_RegistrosDuplicadosCandidatos_Estado`: `([Estado]=N'resuelto' OR [Estado]=N'pendiente')`
- CHECK `CK_RegistrosDuplicadosCandidatos_Nivel`: `([NivelCoincidencia]=N'baja' OR [NivelCoincidencia]=N'media' OR [NivelCoincidencia]=N'alta')`

##### `SolicitudesVinculacionRegistros`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdSolicitudVinculacionRegistro` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `UsuarioSolicitanteId`* int; `EntidadId` int; `AlcanceSolicitado` nvarchar(40)=(N'responsable'); `Justificacion`* nvarchar(1200); `EvidenciaTexto` nvarchar(2000); `Estado` nvarchar(40)=(N'pendiente'); `UsuarioRevisorId` int; `ComentarioRevision` nvarchar(1200); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2=(sysutcdatetime()).
- PK: `IdSolicitudVinculacionRegistro`
- FK `EntidadId` → `Entidades.IdEntidad`
- FK `UsuarioSolicitanteId` → `Usuarios.IdUsuario`
- CHECK `CK_SolicitudesVinculacionRegistros_Alcance`: `([AlcanceSolicitado]=N'editor' OR [AlcanceSolicitado]=N'responsable')`
- CHECK `CK_SolicitudesVinculacionRegistros_Estado`: `([Estado]=N'cancelada' OR [Estado]=N'rechazada' OR [Estado]=N'aprobada' OR [Estado]=N'ajustes_solicitados' OR [Estado]=N'en_revision' OR [Estado]=N'pendiente')`

##### `ReclamacionesAdministracion`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdReclamacion` bigint↑id; `ModuloId`* nvarchar(80); `RegistroCanonicoId`* nvarchar(120); `OrganizacionSolicitanteId`* int; `PersonaSolicitanteId`* int; `BorradorProcesoId` bigint; `Estado`* nvarchar(40); `SenalesJson` nvarchar(max)=(N'[]'); `Justificacion`* nvarchar(2400); `EvidenciasJson` nvarchar(max); `Decision` nvarchar(40); `MotivoDecision` nvarchar(2400); `DecisorId` int; `FechaCreacion` datetime2=(sysutcdatetime()); `FechaEnvio` datetime2; `FechaDecision` datetime2; `FechaActualizacion` datetime2=(sysutcdatetime()); `Version` int=((1)); `EsActiva` bit(calc.).
- PK: `IdReclamacion`
- FK `BorradorProcesoId` → `BorradoresProceso.IdBorradorProceso`
- FK `OrganizacionSolicitanteId` → `Entidades.IdEntidad`
- FK `PersonaSolicitanteId` → `Usuarios.IdUsuario`
- CHECK `CK_Reclamaciones_Estado`: `([Estado]=N'historica' OR [Estado]=N'transferencia_ejecutada' OR [Estado]=N'cancelada' OR [Estado]=N'rechazada' OR [Estado]=N'aprobada' OR [Estado]=N'aclaracion_enviada' OR [Estado]=N'requiere_aclaracion' OR [Estado]=N'en_revision' OR [Estado]=N'enviada' OR [Estado]=N'borrador')`

##### `ReclamacionesAclaraciones`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdAclaracion` bigint↑id; `ReclamacionId`* bigint; `SolicitadaPorId`* int; `Comentario`* nvarchar(2400); `Respuesta` nvarchar(2400); `RespondidaPorId` int; `FechaSolicitud` datetime2=(sysutcdatetime()); `FechaRespuesta` datetime2.
- PK: `IdAclaracion`
- FK `ReclamacionId` → `ReclamacionesAdministracion.IdReclamacion`

##### `ReclamacionesConciliaciones`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdConciliacion` bigint↑id; `ReclamacionId`* bigint; `ValoresHistoricosJson`* nvarchar(max); `ValoresBorradorJson`* nvarchar(max); `SeleccionesJson` nvarchar(max); `FechaCreacion` datetime2=(sysutcdatetime()); `FechaResolucion` datetime2.
- PK: `IdConciliacion`
- Único `UQ_ReclamacionesConciliaciones_Reclamacion`: `(ReclamacionId)`
- FK `ReclamacionId` → `ReclamacionesAdministracion.IdReclamacion`

##### `TransferenciasAdministracion`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdTransferencia` bigint↑id; `ModuloId`* nvarchar(80); `RegistroCanonicoId`* nvarchar(120); `OrganizacionAnteriorId`* int; `OrganizacionNuevaId`* int; `ReclamacionId` bigint; `DecisorId`* int; `Motivo` nvarchar(2400); `EvidenciasJson` nvarchar(max); `EstadoAnterior` nvarchar(80); `EstadoPosterior` nvarchar(80); `FechaEjecucion` datetime2=(sysutcdatetime()).
- PK: `IdTransferencia`
- Único `UX_Transferencias_Reclamacion`: `(ReclamacionId)` donde `([ReclamacionId] IS NOT NULL)`
- FK `ReclamacionId` → `ReclamacionesAdministracion.IdReclamacion`

##### `RegistrosCalidadDatos`

Columnas (`*` obligatoria sin valor por defecto; `↑id` identidad): `IdRegistroCalidadDatos` bigint↑id; `ModuloId`* nvarchar(80); `RegistroId`* nvarchar(120); `TipoBandera`* nvarchar(80); `Severidad` nvarchar(20)=(N'media'); `Estado` nvarchar(40)=(N'abierta'); `Detalle` nvarchar(1200); `CreadoPorUsuarioId` int; `FechaCreacion` datetime2=(sysutcdatetime()); `FechaActualizacion` datetime2=(sysutcdatetime()).
- PK: `IdRegistroCalidadDatos`
- CHECK `CK_RegistrosCalidadDatos_Estado`: `([Estado]=N'descartada' OR [Estado]=N'resuelta' OR [Estado]=N'en_revision' OR [Estado]=N'abierta')`
- CHECK `CK_RegistrosCalidadDatos_Severidad`: `([Severidad]=N'alta' OR [Severidad]=N'media' OR [Severidad]=N'baja')`

<a id="catalogos"></a>
## Catálogos que se preservan (la limpieza NO los vacía)

Divisiones territoriales, roles y permisos, estados de contenido, prácticas, territorios sonoros, géneros y demás catálogos de referencia, categorías, menú y el diario de migraciones. La siembra solo LEE de ellos (códigos válidos para las FK).

- `AlcancesMercado` (PK `IdAlcanceMercado`; 4 columnas)
- `CatalogosReferenciaFuente` (PK `CodigoCatalogo`; 6 columnas)
- `Categorias` (PK `IdCategoria`; 7 columnas)
- `DepartamentosRegionOcad` (PK `CodigoDepartamento`; 2 columnas)
- `Divipola` (PK `CodigoDepartamento,CodigoMunicipio`; 7 columnas)
- `EnfoquesDiferenciales` (PK `CodigoEnfoqueDiferencial`; 5 columnas)
- `EquipamientoDeEspacio` (PK `IdEquipamientoEspacio`; 7 columnas)
- `EstadosContenido` (PK `IdEstadoContenido`; 4 columnas)
- `ExpresionesArtisticas` (PK `IdExpresionArtistica`; 5 columnas)
- `FamiliasDeInstrumentos` (PK `IdFamiliaInstrumento`; 8 columnas)
- `FichasConceptualesPracticasMusicales` (PK `PracticaMusicalId`; 11 columnas)
- `FichasConceptualesTerritoriosSonoros` (PK `TerritorioSonoroId`; 12 columnas)
- `FormasDeAccesoDeRed` (PK `IdFormaDeAcceso`; 7 columnas)
- `FormatosDeDocumentacion` (PK `IdFormato`; 8 columnas)
- `FuentesFinanciacion` (PK `IdFuenteFinanciacion`; 5 columnas)
- `IdentidadesGenero` (PK `CodigoIdentidadGenero`; 5 columnas)
- `Idiomas` (PK `CodigoIdioma`; 6 columnas)
- `MenuElementos` (PK `IdMenuElemento`; 9 columnas)
- `ModalidadesMercado` (PK `IdModalidadMercado`; 4 columnas)
- `ModalidadesParticipacion` (PK `IdModalidadParticipacion`; 5 columnas)
- `NaturalezasEntidad` (PK `IdNaturalezaEntidad`; 5 columnas)
- `OrientacionesSexuales` (PK `CodigoOrientacionSexual`; 5 columnas)
- `Periodicidades` (PK `CodigoPeriodicidad`; 6 columnas)
- `Permisos` (PK `IdPermiso`; 6 columnas)
- `PertenenciasEtnicas` (PK `CodigoPertenenciaEtnica`; 5 columnas)
- `PoliticasDatos` (PK `IdPolitica`; 10 columnas)
- `PracticasMusicales` (PK `IdPracticaMusical`; 5 columnas)
- `RegionesOcad` (PK `IdRegionOcad`; 5 columnas)
- `Roles` (PK `IdRol`; 4 columnas)
- `RolesPermisos` (PK `IdRolPermiso`; 4 columnas)
- `SchemaVersions` (PK `Id`; 3 columnas)
- `ServiciosDeTaller` (PK `IdServicioTaller`; 7 columnas)
- `Sexos` (PK `CodigoSexo`; 5 columnas)
- `TerritoriosSonoros` (PK `IdTerritorioSonoro`; 5 columnas)
- `TipologiasFestival` (PK `IdTipologiaFestival`; 5 columnas)
- `TiposDeEspacio` (PK `IdTipoEspacio`; 7 columnas)
- `TiposDiscapacidad` (PK `CodigoTipoDiscapacidad`; 5 columnas)
- `TiposDocumento` (PK `CodigoTipoDocumento`; 4 columnas)
- `TiposIngreso` (PK `IdTipoIngreso`; 5 columnas)
- `TiposOrganizador` (PK `IdTipoOrganizador`; 5 columnas)
- `ValoresDeTaxonomiaDePerfiles` (PK `IdValor`; 11 columnas)
- `ZonasUrbanoRural` (PK `IdZonaUrbanoRural`; 5 columnas)

<a id="no-sembrar"></a>
## Tablas que la siembra no toca

- **Contenido del sitio y configuración:** `TextosSitio`, `TextosSitioHistorial`, `ContenidoWeb`, `ContenidoWebHistorial`, `EquipoWeb`, `ModulosPorCuenta`, `MenuElementos`
- **Importaciones gobernadas:** `LotesImportacion`, `FilasImportacion`, `DecisionesImportacion`, `HallazgosImportacion`, `ExtraccionesAsistidas`
- **Sesión y seguridad (efímeras):** `IntentosDeIngresoFallidos`, `UsuariosCodigosVerificacion`, `RestablecimientosDeContrasena`
- **Respaldos de migración:** `CambiosDeRegistro_RespaldoClase_20261119`
- **Formularios públicos:** `Participaciones`

<a id="orden"></a>
## Orden de inserción por dependencias (FK reales)

Calculado de las FK entre las tablas sembrables; la limpieza usa el orden inverso. Las referencias polimórficas (`ModuloId`+`RegistroId`) no son FK: el generador las valida aparte.

`AgentesEditoriales` → `BoletinSuscripciones` → `Categorias` → `Etiquetas` → `ExpresionesArtisticasDeRegistro` → `FuentesEditoriales` → `MediosWeb` → `MediosWebHistorial` → `ModalidadesParticipacionDeRegistro` → `PracticasMusicalesDeRegistro` → `ProgramasEditoriales` → `ProyectosTransversales` → `RegistrosCalidadDatos` → `RegistrosDuplicadosCandidatos` → `RegistrosRevisionHistorial` → `TerritoriosSonorosDeRegistro` → `TipologiasEditoriales` → `TiposIngresoDeRegistro` → `TitulacionesColectivas` → `Usuarios` → `AutorizacionesDatos` → `BitacoraAuditoria` → `CambiosDeRegistro` → `ConfirmacionesDeCorreo` → `LocalizacionesDeRegistro` → `Noticias` → `Notificaciones` → `PublicacionesEditoriales` → `UsuariosRoles` → `CreditosEditoriales` → `EtiquetasNoticia` → `IdentificadoresEditoriales` → `NoticiasPracticasMusicales` → `NoticiasProyectosTransversales` → `NoticiasTerritoriosSonoros` → `PalabrasClaveEditoriales` → `PublicacionesEditorialesFuentes` → `PublicacionesEditorialesIdiomas` → `PublicacionesEditorialesPracticasMusicales` → `PublicacionesEditorialesProgramas` → `PublicacionesEditorialesTerritoriosSonoros` → `PublicacionesEditorialesTipologias` → `AccesosEditoriales` → `AgendasDeCitas` → `FranjasDeCitas` → `Archivos` → `ArchivosDeRegistro` → `CelebraEdiciones` → `Entidades` → `GaleriaAlbumes` → `NoticiasArchivos` → `ParticipantesDeCitas` → `PerfilesPublicos` → `BorradoresProceso` → `CelebraCategorias` → `CelebraGaleria` → `CelebraPreguntas` → `CelebraRecursos` → `CitasDeAgenda` → `EntidadesAliadasDeRegistro` → `EntidadesResponsable` → `Espacios` → `Festivales` → `GaleriaItems` → `InvitacionesDeAgenda` → `InvitacionesDeOrganizacion` → `PerfilesPublicosClasificaciones` → `PerfilesPublicosEnlaces` → `PerfilesPublicosPracticas` → `ProcedenciasDeRegistro` → `PropuestasDeCambio` → `Redes` → `RevisionesDeRegistro` → `SolicitudesVinculacionRegistros` → `Talleres` → `UsuariosEntidades` → `EdicionesFestival` → `EnviosDeRevision` → `EspaciosEquipamiento` → `EspaciosPracticasMusicales` → `EspaciosTipos` → `FestivalesReferenciasHistoricas` → `Mercados` → `PropuestasDeCambioCampos` → `ReclamacionesAdministracion` → `RedesFormasDeAcceso` → `RedesFormatos` → `RedesPracticasMusicales` → `RevisionesDeRegistroObservaciones` → `TalleresFamiliasDeInstrumentos` → `TalleresPracticasMusicales` → `TalleresServicios` → `EdicionesMercado` → `EventosAgenda` → `MercadosPracticasMusicales` → `MercadosTerritoriosSonoros` → `ReclamacionesAclaraciones` → `ReclamacionesConciliaciones` → `TransferenciasAdministracion` → `EtiquetasEventoAgenda` → `EventosAgendaArchivos` → `EventosAgendaPracticasMusicales` → `EventosAgendaProyectosTransversales` → `EventosAgendaTerritoriosSonoros`

