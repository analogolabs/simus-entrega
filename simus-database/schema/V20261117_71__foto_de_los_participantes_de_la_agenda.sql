SET NOCOUNT ON;

-- ── La foto de quien participa en una agenda de citas (AGE2) ─────────────────────────────────────────
--
-- Los compradores y los artistas pueden subir su foto (la misma regla del Banco de archivos que la foto de un
-- perfil: WebP, PNG o JPEG, hasta 2 MB). Se guarda como un vínculo del participante con el archivo: no es pública
-- (la sirve el Banco solo con sesión, como la de un perfil «solo SIMUS») y mientras la cita un participante no cuenta
-- como archivo sin uso. Nula = se pintan las iniciales. Idempotente.

IF COL_LENGTH(N'dbo.ParticipantesDeCitas', N'FotoArchivoId') IS NULL
BEGIN
    ALTER TABLE dbo.ParticipantesDeCitas ADD FotoArchivoId int NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ParticipantesDeCitas_Foto')
BEGIN
    EXEC (N'ALTER TABLE dbo.ParticipantesDeCitas ADD CONSTRAINT FK_ParticipantesDeCitas_Foto
            FOREIGN KEY (FotoArchivoId) REFERENCES dbo.Archivos (IdArchivo);');
END;
