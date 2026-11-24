/*
    SIMUS · Catalogos demograficos: un solo codigo

    Las seis tablas demograficas (V20261007_02) nacieron con DOS identificadores: un entero (`IdSexo`...) y un texto unico
    (`Slug`). Para quien llegue de nuevo son dos llaves para lo mismo. Como NINGUNA tabla las referencia todavia, es el
    momento barato de dejarlas con una sola: el CODIGO (`masculino`, `no-responde`...), que es lo que se guardara en las
    tablas que las usen (la persona, el agente...), igual que `TiposDocumento` y `Periodicidades`.

    Queda:  Codigo<X> (clave) · Nombre<X> · Descripcion (la fuente) · OrdenVisualizacion · Activo.
    No cambia ningun dato: solo la llave. Idempotente.
*/
SET NOCOUNT ON;
GO

DECLARE @t TABLE (Tabla sysname, ColId sysname, ColCodigo sysname, Pk sysname, UqSlug sysname);
INSERT INTO @t VALUES
    (N'Sexos',                N'IdSexo',               N'CodigoSexo',               N'PK_Sexos',                N'UQ_Sexos_Slug'),
    (N'IdentidadesGenero',    N'IdIdentidadGenero',    N'CodigoIdentidadGenero',    N'PK_IdentidadesGenero',    N'UQ_IdentidadesGenero_Slug'),
    (N'OrientacionesSexuales',N'IdOrientacionSexual',  N'CodigoOrientacionSexual',  N'PK_OrientacionesSexuales',N'UQ_OrientacionesSexuales_Slug'),
    (N'PertenenciasEtnicas',  N'IdPertenenciaEtnica',  N'CodigoPertenenciaEtnica',  N'PK_PertenenciasEtnicas',  N'UQ_PertenenciasEtnicas_Slug'),
    (N'TiposDiscapacidad',    N'IdTipoDiscapacidad',   N'CodigoTipoDiscapacidad',   N'PK_TiposDiscapacidad',    N'UQ_TiposDiscapacidad_Slug'),
    (N'EnfoquesDiferenciales',N'IdEnfoqueDiferencial', N'CodigoEnfoqueDiferencial', N'PK_EnfoquesDiferenciales',N'UQ_EnfoquesDiferenciales_Slug');

DECLARE @tabla sysname, @id sysname, @cod sysname, @pk sysname, @uq sysname, @sql nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla, ColId, ColCodigo, Pk, UqSlug FROM @t;
OPEN c; FETCH NEXT FROM c INTO @tabla, @id, @cod, @pk, @uq;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @tabla, @id) IS NOT NULL   -- aun tiene el entero: falta convertirla
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + @tabla + N' DROP CONSTRAINT ' + @uq + N';'
                 + N'ALTER TABLE dbo.' + @tabla + N' DROP CONSTRAINT ' + @pk + N';'
                 + N'ALTER TABLE dbo.' + @tabla + N' DROP COLUMN ' + @id + N';'
                 + N'EXEC sp_rename N''dbo.' + @tabla + N'.Slug'', N''' + @cod + N''', N''COLUMN'';'
                 + N'ALTER TABLE dbo.' + @tabla + N' ADD CONSTRAINT ' + @pk + N' PRIMARY KEY (' + @cod + N');';
        EXEC (@sql);
    END
    FETCH NEXT FROM c INTO @tabla, @id, @cod, @pk, @uq;
END
CLOSE c; DEALLOCATE c;
GO
