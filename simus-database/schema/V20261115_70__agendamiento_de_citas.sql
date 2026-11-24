/*
  SIMUS · Herramientas: el agendamiento de citas entre artistas y compradores o bookers (docs/referencia/26-agenda-de-citas-y-mercados.md)

  QUE ES. Una herramienta que cuelga de una EDICION de Mercado (no del Mercado): la organización
  responsable habilita una agenda de citas, fija el modo, la duración y las franjas, invita a los
  compradores o bookers (los designa el Mercado), y los artistas —o sus representantes— se inscriben
  y se agendan por orden de ingreso. La solicitud pendiente RESERVA la franja, vence y se libera.

  DOS MODOS, decididos por la dirección el 11 de noviembre de 2026:
    · compradores_rotan  — los artistas son fijos (cada uno «recibe») y los compradores rotan
                           visitándolos: el comprador pide la cita; el artista la confirma.
    · compradores_fijos  — los compradores son fijos (en una mesa o espacio) y los artistas rotan:
                           el artista pide la cita; el comprador la confirma.
  En los dos casos la pareja se llama ANFITRION (el fijo) y VISITANTE (el que rota). El modo solo
  decide quién ocupa cada lugar; las restricciones son las mismas.

  LO QUE LA BASE HACE CUMPLIR, para que no dependa de la interfaz:
    · una agenda por edición (UNIQUE);
    · nadie —anfitrión ni visitante— tiene dos citas VIVAS (solicitada o confirmada) en la misma
      franja: dos índices únicos filtrados. «Doble reserva» es imposible aunque dos personas
      pulsen a la vez; la segunda recibe el conflicto de la base;
    · rangos de duración, pausa, topes y vencimiento;
    · un artista es una cuenta; un comprador es una persona o empresa que el Mercado carga con un
      correo (con él se enlaza la cuenta cuando entra).

  SIN CASCADAS, como todo el proyecto. ES ADITIVA: no toca ninguna tabla existente.
*/
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

-- ── La agenda de una edición ─────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'AgendasDeCitas' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.AgendasDeCitas (
        IdAgenda int IDENTITY(1,1) NOT NULL,
        EdicionMercadoId int NOT NULL,

        Estado nvarchar(20) NOT NULL CONSTRAINT DF_AgendasDeCitas_Estado DEFAULT (N'borrador'),
        Modo nvarchar(30) NOT NULL CONSTRAINT DF_AgendasDeCitas_Modo DEFAULT (N'compradores_rotan'),
        -- Cómo entran los artistas, según la metodología de cada Mercado (decisión del 12 de noviembre):
        --   automatica — entra por orden de ingreso hasta el cupo y después queda en lista de espera;
        --   aceptacion — la organización aprueba o rechaza a cada artista inscrito (queda «pendiente»).
        AprobacionDeArtistas nvarchar(20) NOT NULL CONSTRAINT DF_AgendasDeCitas_Aprobacion DEFAULT (N'automatica'),

        -- Una duración general para todas las citas de la edición, y una pausa entre ellas.
        DuracionMinutos int NOT NULL CONSTRAINT DF_AgendasDeCitas_Duracion DEFAULT (20),
        PausaMinutos int NOT NULL CONSTRAINT DF_AgendasDeCitas_Pausa DEFAULT (5),
        -- Cuántas solicitudes pendientes puede tener a la vez quien rota (hay más oferta que demanda).
        TopeSolicitudesPendientes int NOT NULL CONSTRAINT DF_AgendasDeCitas_Tope DEFAULT (5),
        VencimientoSolicitudHoras int NOT NULL CONSTRAINT DF_AgendasDeCitas_Vence DEFAULT (72),

        -- Inscripción de artistas con cupo y lista de espera por orden de ingreso. NULL = sin cupo.
        CupoArtistas int NULL,
        AperturaInscripcionUtc datetime2(0) NULL,
        CierreInscripcionUtc datetime2(0) NULL,

        IdUsuarioCreador int NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_AgendasDeCitas_FechaCreacion DEFAULT (SYSUTCDATETIME()),
        FechaActualizacion datetime2(0) NULL,
        FechaCierre datetime2(0) NULL,

        CONSTRAINT PK_AgendasDeCitas PRIMARY KEY (IdAgenda),
        CONSTRAINT FK_AgendasDeCitas_Edicion FOREIGN KEY (EdicionMercadoId) REFERENCES dbo.EdicionesMercado(IdEdicionMercado),
        CONSTRAINT UQ_AgendasDeCitas_Edicion UNIQUE (EdicionMercadoId),
        CONSTRAINT CK_AgendasDeCitas_Estado CHECK (Estado IN (N'borrador', N'abierta', N'en_curso', N'cerrada')),
        CONSTRAINT CK_AgendasDeCitas_Aprobacion CHECK (AprobacionDeArtistas IN (N'automatica', N'aceptacion')),
        CONSTRAINT CK_AgendasDeCitas_Modo CHECK (Modo IN (N'compradores_rotan', N'compradores_fijos')),
        CONSTRAINT CK_AgendasDeCitas_Duracion CHECK (DuracionMinutos BETWEEN 10 AND 60),
        CONSTRAINT CK_AgendasDeCitas_Pausa CHECK (PausaMinutos BETWEEN 0 AND 30),
        CONSTRAINT CK_AgendasDeCitas_Tope CHECK (TopeSolicitudesPendientes BETWEEN 1 AND 50),
        CONSTRAINT CK_AgendasDeCitas_Vence CHECK (VencimientoSolicitudHoras BETWEEN 1 AND 720),
        CONSTRAINT CK_AgendasDeCitas_Cupo CHECK (CupoArtistas IS NULL OR CupoArtistas > 0),
        CONSTRAINT CK_AgendasDeCitas_Ventana CHECK (
            AperturaInscripcionUtc IS NULL OR CierreInscripcionUtc IS NULL OR CierreInscripcionUtc > AperturaInscripcionUtc
        )
    );
END;

-- ── Las franjas: la rejilla de horarios de la edición ────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'FranjasDeCitas' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.FranjasDeCitas (
        IdFranja int IDENTITY(1,1) NOT NULL,
        AgendaId int NOT NULL,
        InicioUtc datetime2(0) NOT NULL,
        FinUtc datetime2(0) NOT NULL,
        CONSTRAINT PK_FranjasDeCitas PRIMARY KEY (IdFranja),
        CONSTRAINT FK_FranjasDeCitas_Agenda FOREIGN KEY (AgendaId) REFERENCES dbo.AgendasDeCitas(IdAgenda),
        CONSTRAINT UQ_FranjasDeCitas_Inicio UNIQUE (AgendaId, InicioUtc),
        CONSTRAINT CK_FranjasDeCitas_Rango CHECK (FinUtc > InicioUtc)
    );
END;

-- ── Los participantes: artistas que se inscriben y compradores que el Mercado carga ──────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'ParticipantesDeCitas' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.ParticipantesDeCitas (
        IdParticipante int IDENTITY(1,1) NOT NULL,
        AgendaId int NOT NULL,
        Rol nvarchar(10) NOT NULL,

        -- Un artista es SIEMPRE una cuenta. Un comprador nace como invitado del Mercado (sin cuenta) y
        -- se enlaza cuando entra una cuenta con el mismo correo confirmado.
        UsuarioId int NULL,
        Nombre nvarchar(240) NOT NULL,
        -- La agrupación (artista) o la empresa o entidad (comprador).
        Entidad nvarchar(240) NULL,
        TipoDeComprador nvarchar(30) NULL,
        CorreoInvitacion nvarchar(180) NULL,
        Presentacion nvarchar(1200) NULL,
        -- Hasta tres enlaces de audio o video, uno por línea.
        Enlaces nvarchar(1500) NULL,
        -- Si quien se inscribe es el representante de un artista: a quién representa.
        RepresentaA nvarchar(240) NULL,

        -- Datos de contacto: solo los ve la otra parte cuando la cita está CONFIRMADA.
        ContactoCorreo nvarchar(180) NULL,
        ContactoTelefono nvarchar(80) NULL,
        -- La mesa, el stand o el espacio donde recibe (el anfitrión).
        Espacio nvarchar(120) NULL,

        Estado nvarchar(20) NOT NULL CONSTRAINT DF_ParticipantesDeCitas_Estado DEFAULT (N'aprobado'),
        MotivoDeLaDecision nvarchar(600) NULL,
        -- El orden de ingreso: quien primero se inscribe primero entra y primero sale de la lista de espera.
        FechaInscripcion datetime2(3) NOT NULL CONSTRAINT DF_ParticipantesDeCitas_Inscripcion DEFAULT (SYSUTCDATETIME()),
        IdUsuarioCreador int NULL,
        FechaActualizacion datetime2(0) NULL,

        CONSTRAINT PK_ParticipantesDeCitas PRIMARY KEY (IdParticipante),
        CONSTRAINT FK_ParticipantesDeCitas_Agenda FOREIGN KEY (AgendaId) REFERENCES dbo.AgendasDeCitas(IdAgenda),
        CONSTRAINT FK_ParticipantesDeCitas_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(IdUsuario),
        CONSTRAINT CK_ParticipantesDeCitas_Rol CHECK (Rol IN (N'artista', N'comprador')),
        CONSTRAINT CK_ParticipantesDeCitas_Estado CHECK (Estado IN (N'pendiente', N'aprobado', N'lista_de_espera', N'rechazado', N'retirado')),
        CONSTRAINT CK_ParticipantesDeCitas_Tipo CHECK (
            TipoDeComprador IS NULL
            OR TipoDeComprador IN (N'festival', N'sala', N'agencia', N'sello', N'editorial', N'medio', N'institucion', N'otro')
        ),
        -- Un artista es una cuenta; un comprador trae el correo con el que se enlazará la suya.
        CONSTRAINT CK_ParticipantesDeCitas_Identidad CHECK (
            (Rol = N'artista' AND UsuarioId IS NOT NULL)
            OR (Rol = N'comprador' AND CorreoInvitacion IS NOT NULL AND TipoDeComprador IS NOT NULL)
        ),
        -- Solo los artistas esperan: un comprador que el Mercado carga está aprobado o retirado.
        CONSTRAINT CK_ParticipantesDeCitas_Espera CHECK (Rol = N'artista' OR Estado IN (N'aprobado', N'retirado'))
    );

    CREATE INDEX IX_ParticipantesDeCitas_Agenda_Rol_Estado ON dbo.ParticipantesDeCitas (AgendaId, Rol, Estado, FechaInscripcion);
    CREATE INDEX IX_ParticipantesDeCitas_Usuario ON dbo.ParticipantesDeCitas (UsuarioId) WHERE UsuarioId IS NOT NULL;

    -- Una cuenta no se inscribe dos veces como artista en la misma agenda, y un correo no se carga dos
    -- veces como comprador. Solo cuentan las inscripciones VIVAS: quien se retiró puede volver.
    CREATE UNIQUE INDEX UX_ParticipantesDeCitas_Artista
        ON dbo.ParticipantesDeCitas (AgendaId, UsuarioId)
        WHERE Rol = N'artista' AND Estado IN (N'pendiente', N'aprobado', N'lista_de_espera');
    CREATE UNIQUE INDEX UX_ParticipantesDeCitas_Comprador
        ON dbo.ParticipantesDeCitas (AgendaId, CorreoInvitacion)
        WHERE Rol = N'comprador' AND Estado = N'aprobado';
END;

-- ── Las citas ────────────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'CitasDeAgenda' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.CitasDeAgenda (
        IdCita int IDENTITY(1,1) NOT NULL,
        AgendaId int NOT NULL,
        FranjaId int NOT NULL,
        -- El fijo (recibe) y el que rota (visita); quién es cada uno lo decide el modo de la agenda.
        AnfitrionId int NOT NULL,
        VisitanteId int NOT NULL,

        Estado nvarchar(20) NOT NULL CONSTRAINT DF_CitasDeAgenda_Estado DEFAULT (N'solicitada'),
        MensajeInicial nvarchar(400) NULL,
        MotivoDeLaDecision nvarchar(600) NULL,
        CanceladaPorId int NULL,
        -- Cuándo se libera la franja si el anfitrión no responde.
        VenceUtc datetime2(0) NULL,

        FechaSolicitud datetime2(0) NOT NULL CONSTRAINT DF_CitasDeAgenda_Solicitud DEFAULT (SYSUTCDATETIME()),
        FechaDecision datetime2(0) NULL,
        FechaActualizacion datetime2(0) NULL,

        CONSTRAINT PK_CitasDeAgenda PRIMARY KEY (IdCita),
        CONSTRAINT FK_CitasDeAgenda_Agenda FOREIGN KEY (AgendaId) REFERENCES dbo.AgendasDeCitas(IdAgenda),
        CONSTRAINT FK_CitasDeAgenda_Franja FOREIGN KEY (FranjaId) REFERENCES dbo.FranjasDeCitas(IdFranja),
        CONSTRAINT FK_CitasDeAgenda_Anfitrion FOREIGN KEY (AnfitrionId) REFERENCES dbo.ParticipantesDeCitas(IdParticipante),
        CONSTRAINT FK_CitasDeAgenda_Visitante FOREIGN KEY (VisitanteId) REFERENCES dbo.ParticipantesDeCitas(IdParticipante),
        CONSTRAINT FK_CitasDeAgenda_CanceladaPor FOREIGN KEY (CanceladaPorId) REFERENCES dbo.ParticipantesDeCitas(IdParticipante),
        CONSTRAINT CK_CitasDeAgenda_Estado CHECK (Estado IN (N'solicitada', N'confirmada', N'rechazada', N'cancelada', N'vencida')),
        CONSTRAINT CK_CitasDeAgenda_Distintos CHECK (AnfitrionId <> VisitanteId)
    );

    CREATE INDEX IX_CitasDeAgenda_Agenda_Estado ON dbo.CitasDeAgenda (AgendaId, Estado);
    CREATE INDEX IX_CitasDeAgenda_Vence ON dbo.CitasDeAgenda (VenceUtc) WHERE Estado = N'solicitada';

    -- LA DOBLE RESERVA ES IMPOSIBLE: nadie tiene dos citas vivas en la misma franja, ni como
    -- anfitrión ni como visitante. Una solicitud pendiente cuenta: RESERVA la franja hasta que se
    -- decide o vence. Rechazada, cancelada y vencida la liberan.
    CREATE UNIQUE INDEX UX_CitasDeAgenda_Anfitrion_Franja
        ON dbo.CitasDeAgenda (AnfitrionId, FranjaId)
        WHERE Estado IN (N'solicitada', N'confirmada');
    CREATE UNIQUE INDEX UX_CitasDeAgenda_Visitante_Franja
        ON dbo.CitasDeAgenda (VisitanteId, FranjaId)
        WHERE Estado IN (N'solicitada', N'confirmada');
END;

-- ── La invitación a un comprador que todavía no tiene cuenta ──────────────────────────────────────
-- Mismo flujo que las invitaciones de organización (V20261105_05): enlace de un solo uso; de él solo se
-- guarda el resumen SHA-256 del testigo; una pendiente por comprador. Quien abre el enlace entra con la
-- cuenta de ese mismo correo (o la crea) y la invitación enlaza su cuenta con el comprador de la agenda.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'InvitacionesDeAgenda' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.InvitacionesDeAgenda (
        IdInvitacion int IDENTITY(1,1) NOT NULL,
        ParticipanteId int NOT NULL,
        CorreoInvitado nvarchar(180) NOT NULL,
        HashTestigo nvarchar(64) NOT NULL,
        Estado nvarchar(20) NOT NULL CONSTRAINT DF_InvitacionesDeAgenda_Estado DEFAULT (N'pendiente'),
        IdUsuarioInvita int NOT NULL,
        FechaEmision datetime2(0) NOT NULL,
        FechaExpiracion datetime2(0) NOT NULL,
        IdUsuarioAcepta int NULL,
        FechaCierre datetime2(0) NULL,

        CONSTRAINT PK_InvitacionesDeAgenda PRIMARY KEY (IdInvitacion),
        CONSTRAINT FK_InvitacionesDeAgenda_Participante FOREIGN KEY (ParticipanteId) REFERENCES dbo.ParticipantesDeCitas(IdParticipante),
        CONSTRAINT FK_InvitacionesDeAgenda_Invita FOREIGN KEY (IdUsuarioInvita) REFERENCES dbo.Usuarios(IdUsuario),
        CONSTRAINT FK_InvitacionesDeAgenda_Acepta FOREIGN KEY (IdUsuarioAcepta) REFERENCES dbo.Usuarios(IdUsuario),
        CONSTRAINT CK_InvitacionesDeAgenda_Estado CHECK (Estado IN (N'pendiente', N'aceptada', N'revocada', N'vencida')),
        CONSTRAINT CK_InvitacionesDeAgenda_Vigencia CHECK (FechaExpiracion > FechaEmision)
    );

    CREATE UNIQUE INDEX UQ_InvitacionesDeAgenda_HashTestigo ON dbo.InvitacionesDeAgenda (HashTestigo);
    CREATE UNIQUE INDEX UX_InvitacionesDeAgenda_PendientePorComprador
        ON dbo.InvitacionesDeAgenda (ParticipanteId)
        WHERE Estado = N'pendiente';
END;
