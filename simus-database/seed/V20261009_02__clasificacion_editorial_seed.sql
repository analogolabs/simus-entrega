-- =============================================
-- Nombre del script: V20261009_02__clasificacion_editorial_seed.sql
-- Descripcion: Clasificacion editorial de dos niveles en Categorias.
--              Conserva textos historicos y vincula solo correspondencias explicitas.
--              Mantiene las 171 fichas y su tipologia, idiomas, creditos y accesos.
-- Autor: Edder Jiménez
-- Fecha: 2026-10-09
-- Version: 20261009.02 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.Categorias',N'CategoriaPadreId') IS NULL
    ALTER TABLE dbo.Categorias ADD CategoriaPadreId int NULL;
IF COL_LENGTH(N'dbo.PublicacionesEditoriales',N'SubcategoriaEditorialId') IS NULL
    ALTER TABLE dbo.PublicacionesEditoriales ADD SubcategoriaEditorialId int NULL;
-- Compilar referencias a las nuevas columnas despues de agregarlas, en la misma transaccion.
EXEC sys.sp_executesql N'
DECLARE @FichasAntes int=(SELECT COUNT(*) FROM dbo.PublicacionesEditoriales);
DECLARE @TipologiasAntes int=(SELECT COUNT(*) FROM dbo.PublicacionesEditorialesTipologias);
DECLARE @IdiomasAntes int=(SELECT COUNT(*) FROM dbo.PublicacionesEditorialesIdiomas);
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=N''FK_Categorias_Padre'')
    ALTER TABLE dbo.Categorias WITH CHECK ADD CONSTRAINT FK_Categorias_Padre FOREIGN KEY(CategoriaPadreId) REFERENCES dbo.Categorias(IdCategoria);
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=N''CK_Categorias_PadreEditorial'')
    ALTER TABLE dbo.Categorias WITH CHECK ADD CONSTRAINT CK_Categorias_PadreEditorial CHECK(CategoriaPadreId IS NULL OR (CodigoModulo=N''editorial'' AND CategoriaPadreId<>IdCategoria));
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N''dbo.Categorias'') AND name=N''UX_Categorias_Id_Padre'')
    CREATE UNIQUE INDEX UX_Categorias_Id_Padre ON dbo.Categorias(IdCategoria,CategoriaPadreId);
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=N''FK_PublicacionesEditoriales_Subcategoria_Padre'')
    ALTER TABLE dbo.PublicacionesEditoriales WITH CHECK ADD CONSTRAINT FK_PublicacionesEditoriales_Subcategoria_Padre
        FOREIGN KEY(SubcategoriaEditorialId,CategoriaId) REFERENCES dbo.Categorias(IdCategoria,CategoriaPadreId);
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=N''CK_PublicacionesEditoriales_SubcategoriaPrincipal'')
    ALTER TABLE dbo.PublicacionesEditoriales WITH CHECK ADD CONSTRAINT CK_PublicacionesEditoriales_SubcategoriaPrincipal CHECK(SubcategoriaEditorialId IS NULL OR CategoriaId IS NOT NULL);
DECLARE @Catalogo TABLE(Nombre nvarchar(150),Slug nvarchar(150),PadreSlug nvarchar(150),Orden int);
INSERT INTO @Catalogo VALUES
(N''Formación'',N''formacion'',NULL,1),
(N''Iniciación musical'',N''formacion--iniciacion-musical'',N''formacion'',1),
(N''Pedagogía instrumental'',N''formacion--pedagogia-instrumental'',N''formacion'',2),
(N''Pedagogía vocal y coral'',N''formacion--pedagogia-vocal-y-coral'',N''formacion'',3),
(N''Orientaciones pedagógicas'',N''formacion--orientaciones-pedagogicas'',N''formacion'',4),
(N''Repertorio'',N''repertorio'',NULL,2),
(N''Cancioneros'',N''repertorio--cancioneros'',N''repertorio'',1),
(N''Composiciones originales'',N''repertorio--composiciones-originales'',N''repertorio'',2),
(N''Arreglos y adaptaciones'',N''repertorio--arreglos-y-adaptaciones'',N''repertorio'',3),
(N''Investigación'',N''investigacion'',NULL,3),
(N''Caracterizaciones sectoriales'',N''investigacion--caracterizaciones-sectoriales'',N''investigacion'',1),
(N''Estudios musicales'',N''investigacion--estudios-musicales'',N''investigacion'',2),
(N''Documentación de prácticas y saberes'',N''investigacion--documentacion-de-practicas-y-saberes'',N''investigacion'',3),
(N''Gestión'',N''gestion'',NULL,4),
(N''Escuelas y procesos musicales'',N''gestion--escuelas-y-procesos-musicales'',N''gestion'',1),
(N''Gestión pública y política musical'',N''gestion--gestion-publica-y-politica-musical'',N''gestion'',2),
(N''Producción y Emprendimiento'',N''produccion-y-emprendimiento'',NULL,5),
(N''Producción de eventos'',N''produccion-y-emprendimiento--produccion-de-eventos'',N''produccion-y-emprendimiento'',1),
(N''Gestión de proyectos y emprendimientos'',N''produccion-y-emprendimiento--gestion-de-proyectos-y-emprendimientos'',N''produccion-y-emprendimiento'',2),
(N''Promoción y distribución'',N''produccion-y-emprendimiento--promocion-y-distribucion'',N''produccion-y-emprendimiento'',3),
(N''Dotación e Infraestructura'',N''dotacion-e-infraestructura'',NULL,6),
(N''Instrumentos y mantenimiento'',N''dotacion-e-infraestructura--instrumentos-y-mantenimiento'',N''dotacion-e-infraestructura'',1),
(N''Espacios y adecuación acústica'',N''dotacion-e-infraestructura--espacios-y-adecuacion-acustica'',N''dotacion-e-infraestructura'',2),
(N''Información'',N''informacion'',NULL,7),
(N''Estadísticas e información sectorial'',N''informacion--estadisticas-e-informacion-sectorial'',N''informacion'',1),
(N''Divulgación'',N''divulgacion'',NULL,8),
(N''Materiales divulgativos'',N''divulgacion--materiales-divulgativos'',N''divulgacion'',1),
(N''Memorias y homenajes'',N''divulgacion--memorias-y-homenajes'',N''divulgacion'',2),
(N''Creación y Circulación'',N''creacion-y-circulacion'',NULL,9);
-- No retirar ninguna categoria editorial anterior que tenga contenido o descendientes.
IF EXISTS(SELECT 1 FROM dbo.Categorias c WHERE c.CodigoModulo=N''editorial''
 AND c.Slug IN(N''bandas'',N''memorias'',N''publicacion'',N''material-pedagogico'')
 AND (EXISTS(SELECT 1 FROM dbo.PublicacionesEditoriales p WHERE p.CategoriaId=c.IdCategoria OR p.SubcategoriaEditorialId=c.IdCategoria)
 OR EXISTS(SELECT 1 FROM dbo.Categorias h WHERE h.CategoriaPadreId=c.IdCategoria)))
    THROW 51044,''Una categoria editorial anterior esta en uso y requiere correspondencia explicita.'',1;
DELETE c FROM dbo.Categorias c WHERE c.CodigoModulo=N''editorial'' AND c.Slug IN(N''bandas'',N''memorias'',N''publicacion'',N''material-pedagogico'');
INSERT INTO dbo.Categorias(CodigoModulo,NombreCategoria,Slug,OrdenVisualizacion)
SELECT N''editorial'',x.Nombre,x.Slug,x.Orden FROM @Catalogo x
WHERE NOT EXISTS(SELECT 1 FROM dbo.Categorias c WHERE c.CodigoModulo=N''editorial'' AND c.Slug=x.Slug);
UPDATE c SET NombreCategoria=x.Nombre,CategoriaPadreId=p.IdCategoria,OrdenVisualizacion=x.Orden,
 Descripcion=CASE WHEN x.PadreSlug IS NULL THEN N''Categoria principal del acervo editorial.'' ELSE N''Subcategoria editorial de ''+p.NombreCategoria+N''.'' END
FROM dbo.Categorias c JOIN @Catalogo x ON c.CodigoModulo=N''editorial'' AND c.Slug=x.Slug
LEFT JOIN dbo.Categorias p ON p.CodigoModulo=N''editorial'' AND p.Slug=x.PadreSlug;
-- Definiciones operativas del catalogo aprobado para SIMUS.
UPDATE c SET Descripcion=d.Descripcion FROM dbo.Categorias c JOIN (VALUES
(N''Formación'',N''Recursos para la enseñanza, el aprendizaje y la orientación pedagógica de la música.''),
(N''Repertorio'',N''Obras musicales destinadas a la interpretación: composiciones, arreglos, adaptaciones y cancioneros.''),
(N''Investigación'',N''Estudios y documentación que producen conocimiento sobre las músicas, sus prácticas y sus contextos.''),
(N''Gestión'',N''Recursos para organizar procesos musicales y orientar la gestión pública y las políticas del sector.''),
(N''Producción y Emprendimiento'',N''Recursos sobre producción de eventos, proyectos, emprendimientos y circulación comercial de bienes y servicios musicales.''),
(N''Dotación e Infraestructura'',N''Recursos sobre instrumentos, mantenimiento, espacios y condiciones físicas para la actividad musical.''),
(N''Información'',N''Publicaciones de datos, estadísticas e información sectorial que permiten conocer y seguir el sector musical.''),
(N''Divulgación'',N''Materiales que comunican al público procesos, resultados, memorias y reconocimientos de la actividad musical.''),
(N''Creación y Circulación'',N''Categoría histórica que se conserva durante la revisión del acervo. Su contenido debe examinarse antes de establecer subcategorías o reasignaciones.''),
(N''Iniciación musical'',N''Recursos para el acercamiento inicial a la música, la escucha, la exploración sonora y la participación musical.''),
(N''Pedagogía instrumental'',N''Guías, métodos y materiales para la enseñanza y el aprendizaje de instrumentos musicales.''),
(N''Pedagogía vocal y coral'',N''Recursos pedagógicos para la voz, el canto, las prácticas corales y la dirección de coros.''),
(N''Orientaciones pedagógicas'',N''Lineamientos y orientaciones para planear y desarrollar procesos de formación musical.''),
(N''Cancioneros'',N''Compilaciones de canciones presentadas como repertorio para su interpretación.''),
(N''Composiciones originales'',N''Obras musicales originales presentadas como repertorio; la autoría y los créditos se registran por separado.''),
(N''Arreglos y adaptaciones'',N''Versiones de obras musicales adaptadas o arregladas para una práctica, formato o conjunto de intérpretes.''),
(N''Caracterizaciones sectoriales'',N''Estudios que describen actores, actividades, condiciones y dinámicas del sector musical.''),
(N''Estudios musicales'',N''Investigaciones sobre las músicas, sus expresiones, procesos y contextos.''),
(N''Documentación de prácticas y saberes'',N''Registros y estudios de prácticas, conocimientos y memorias musicales con fuentes identificadas.''),
(N''Escuelas y procesos musicales'',N''Recursos para organizar y sostener escuelas y otros procesos colectivos de formación y práctica musical.''),
(N''Gestión pública y política musical'',N''Orientaciones y documentos de gestión pública, planificación y política vinculados al sector musical.''),
(N''Producción de eventos'',N''Recursos para planear, organizar y realizar eventos musicales.''),
(N''Gestión de proyectos y emprendimientos'',N''Recursos para formular y gestionar proyectos e iniciativas de emprendimiento musical.''),
(N''Promoción y distribución'',N''Recursos sobre promoción y distribución de obras, bienes y servicios musicales.''),
(N''Instrumentos y mantenimiento'',N''Recursos sobre dotación, cuidado, conservación y mantenimiento de instrumentos musicales.''),
(N''Espacios y adecuación acústica'',N''Recursos sobre infraestructura, espacios de práctica y adecuación acústica.''),
(N''Estadísticas e información sectorial'',N''Publicaciones de resultados estadísticos, indicadores y datos documentados del sector musical.''),
(N''Materiales divulgativos'',N''Materiales destinados a comunicar y explicar al público procesos o contenidos musicales.''),
(N''Memorias y homenajes'',N''Publicaciones que documentan trayectorias, acontecimientos o reconocimientos con finalidad divulgativa.'')) d(Nombre,Descripcion) ON c.CodigoModulo=N''editorial'' AND c.NombreCategoria=d.Nombre;
';
COMMIT TRANSACTION;
