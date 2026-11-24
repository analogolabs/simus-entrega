/*
    SIMUS · Retiro de la demostración de la agenda de citas (docs/referencia/26-agenda-de-citas-y-mercados.md), paso 1 de 2.

    Se ejecuta ANTES de volver a sembrar (y antes del retiro de `completa`, porque la agenda cuelga de
    una organización de la demostración). Retira SOLO lo que sembró `V20261115_72`: el Mercado
    «Mercado Musical del Valle» (o, en siembras anteriores, «… (demostración)») con su edición, su agenda, sus franjas, sus participantes
    y sus citas, más el rastro que dejaron (avisos y registro de cambios). No toca nada de otro origen.

    ES IDEMPOTENTE: si no hay nada que retirar, no hace nada. Retira en orden inverso al de las claves
    ajenas, porque ninguna de las cuatro tablas tiene cascadas.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Mercado int = (SELECT IdMercado FROM dbo.Mercados WHERE NombreMercado IN (N'Mercado Musical del Valle', N'Mercado Musical del Valle (demostración)'));
IF @Mercado IS NULL RETURN;

BEGIN TRANSACTION;

DECLARE @Edicion TABLE (Id int PRIMARY KEY);
INSERT INTO @Edicion SELECT IdEdicionMercado FROM dbo.EdicionesMercado WHERE MercadoId = @Mercado;

DECLARE @Agenda TABLE (Id int PRIMARY KEY);
INSERT INTO @Agenda SELECT IdAgenda FROM dbo.AgendasDeCitas WHERE EdicionMercadoId IN (SELECT Id FROM @Edicion);

-- El rastro de la agenda: avisos y registro de cambios de sus tres entidades.
DELETE FROM dbo.Notificaciones
 WHERE ModuloId = N'agendas-de-citas' AND TRY_CAST(RegistroId AS int) IN (SELECT Id FROM @Agenda);

DELETE FROM dbo.CambiosDeRegistro
 WHERE ModuloId = N'citas-de-agenda'
   AND TRY_CAST(RegistroId AS int) IN (SELECT IdCita FROM dbo.CitasDeAgenda WHERE AgendaId IN (SELECT Id FROM @Agenda));
DELETE FROM dbo.CambiosDeRegistro
 WHERE ModuloId = N'participantes-de-citas'
   AND TRY_CAST(RegistroId AS int) IN (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId IN (SELECT Id FROM @Agenda));
DELETE FROM dbo.CambiosDeRegistro
 WHERE ModuloId = N'agendas-de-citas' AND TRY_CAST(RegistroId AS int) IN (SELECT Id FROM @Agenda);

-- El historial de la edición y del Mercado que se retiran (FK de ActorId hacia las cuentas demo).
DELETE FROM dbo.CambiosDeRegistro WHERE ModuloId = N'ediciones-mercado' AND TRY_CAST(RegistroId AS int) IN (SELECT Id FROM @Edicion);
DELETE FROM dbo.CambiosDeRegistro WHERE ModuloId = N'mercados' AND TRY_CAST(RegistroId AS int) = @Mercado;

DELETE FROM dbo.InvitacionesDeAgenda WHERE ParticipanteId IN (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId IN (SELECT Id FROM @Agenda));
DELETE FROM dbo.CitasDeAgenda WHERE AgendaId IN (SELECT Id FROM @Agenda);
DELETE FROM dbo.ParticipantesDeCitas WHERE AgendaId IN (SELECT Id FROM @Agenda);
DELETE FROM dbo.FranjasDeCitas WHERE AgendaId IN (SELECT Id FROM @Agenda);
DELETE FROM dbo.AgendasDeCitas WHERE IdAgenda IN (SELECT Id FROM @Agenda);

DELETE FROM dbo.EdicionesMercado WHERE MercadoId = @Mercado;
DELETE FROM dbo.Mercados WHERE IdMercado = @Mercado;

COMMIT TRANSACTION;
