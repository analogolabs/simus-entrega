-- =============================================
-- Nombre del script: V20261009_04__revision_editorial_contenidos.sql
-- Descripcion: Revision por ficha del contenido editorial y dos subcategorias
--              de Creacion y Circulacion. Conserva fuentes y relaciones.
-- Autor: Edder Jiménez
-- Fecha: 2026-10-09
-- Version: 20261009.04 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;
DECLARE @Padre int=(SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo=N'editorial' AND Slug=N'creacion-y-circulacion' AND CategoriaPadreId IS NULL);
IF @Padre IS NULL THROW 51045,'Falta la categoria Creacion y Circulacion.',1;
INSERT INTO dbo.Categorias(CodigoModulo,NombreCategoria,Slug,Descripcion,OrdenVisualizacion,CategoriaPadreId)
SELECT N'editorial',x.Nombre,x.Slug,x.Descripcion,x.Orden,@Padre FROM (VALUES
(N'Creación e interpretación musical',N'creacion-y-circulacion--creacion-e-interpretacion-musical',N'Producciones cuyo contenido central son obras musicales y sus interpretaciones, independientes del soporte y de la convocatoria.',1),
(N'Registros de conciertos y experiencias de circulación',N'creacion-y-circulacion--registros-conciertos-circulacion',N'Registros musicales de conciertos, presentaciones y experiencias de circulación. Los informes y memorias divulgativas se clasifican por su finalidad.',2)
)x(Nombre,Slug,Descripcion,Orden) WHERE NOT EXISTS(SELECT 1 FROM dbo.Categorias c WHERE c.CodigoModulo=N'editorial' AND c.Slug=x.Slug);
UPDATE dbo.Categorias SET Descripcion=N'Producciones artísticas de creación e interpretación musical y registros musicales de conciertos y experiencias de circulación. Tema o finalidad independiente del tipo de contenido, soporte, programa y colección.' WHERE IdCategoria=@Padre;
DECLARE @Decision TABLE(Codigo nvarchar(40),Categoria nvarchar(150),Subcategoria nvarchar(150),CategoriaAnterior nvarchar(150),SubcategoriaAnterior nvarchar(150));
INSERT INTO @Decision VALUES
(N'PNMC-ED-001',N'Formación',N'Orientaciones pedagógicas',NULL,NULL),
(N'PNMC-ED-014',N'Repertorio',NULL,N'Repertorio',N'Arreglos y adaptaciones'),
(N'PNMC-ED-015',N'Repertorio',N'Arreglos y adaptaciones',N'Repertorio',NULL),
(N'PNMC-ED-016',N'Creación y Circulación',N'Creación e interpretación musical',N'Repertorio',NULL),
(N'PNMC-ED-019',N'Repertorio',N'Composiciones originales',N'Repertorio',NULL),
(N'PNMC-ED-024',N'Divulgación',N'Memorias y homenajes',N'Repertorio',NULL),
(N'PNMC-ED-055',N'Repertorio',N'Arreglos y adaptaciones',N'Formación',N'Pedagogía instrumental'),
(N'PNMC-ED-056',N'Repertorio',N'Composiciones originales',N'Formación',N'Pedagogía instrumental'),
(N'PNMC-ED-069',N'Gestión',N'Escuelas y procesos musicales',N'Gestión',NULL),
(N'PNMC-ED-070',N'Gestión',N'Gestión pública y política musical',N'Gestión',NULL),
(N'PNMC-ED-071',N'Gestión',N'Escuelas y procesos musicales',N'Gestión',NULL),
(N'PNMC-ED-072',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-073',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-074',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-075',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-076',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-077',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-078',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-079',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-080',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-081',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-082',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-083',N'Formación',N'Iniciación musical',N'Investigación',NULL),
(N'PNMC-ED-084',N'Formación',N'Orientaciones pedagógicas',N'Investigación',NULL),
(N'PNMC-ED-085',N'Investigación',N'Documentación de prácticas y saberes',N'Investigación',NULL),
(N'PNMC-ED-086',N'Investigación',N'Documentación de prácticas y saberes',N'Investigación',NULL),
(N'PNMC-ED-087',N'Investigación',N'Documentación de prácticas y saberes',N'Investigación',NULL),
(N'PNMC-ED-088',N'Investigación',N'Documentación de prácticas y saberes',N'Investigación',NULL),
(N'PNMC-ED-089',N'Investigación',N'Estudios musicales',N'Investigación',NULL),
(N'PNMC-ED-090',N'Investigación',N'Caracterizaciones sectoriales',N'Investigación',NULL),
(N'PNMC-ED-091',N'Investigación',N'Estudios musicales',N'Investigación',NULL),
(N'PNMC-ED-092',N'Investigación',N'Estudios musicales',N'Investigación',NULL),
(N'PNMC-ED-093',N'Investigación',N'Documentación de prácticas y saberes',N'Investigación',NULL),
(N'PNMC-ED-094',N'Dotación e Infraestructura',N'Instrumentos y mantenimiento',N'Dotación e Infraestructura',NULL),
(N'PNMC-ED-095',N'Dotación e Infraestructura',N'Espacios y adecuación acústica',N'Dotación e Infraestructura',NULL),
(N'PNMC-ED-096',N'Dotación e Infraestructura',N'Espacios y adecuación acústica',N'Dotación e Infraestructura',NULL),
(N'PNMC-ED-097',N'Producción y Emprendimiento',N'Gestión de proyectos y emprendimientos',N'Producción y Emprendimiento',NULL),
(N'PNMC-ED-098',N'Producción y Emprendimiento',N'Producción de eventos',N'Producción y Emprendimiento',NULL),
(N'PNMC-ED-099',N'Gestión',N'Escuelas y procesos musicales',N'Producción y Emprendimiento',NULL),
(N'PNMC-ED-100',N'Dotación e Infraestructura',N'Espacios y adecuación acústica',N'Producción y Emprendimiento',NULL),
(N'PNMC-ED-101',N'Producción y Emprendimiento',N'Producción de eventos',N'Producción y Emprendimiento',NULL),
(N'PNMC-ED-102',N'Producción y Emprendimiento',N'Producción de eventos',N'Producción y Emprendimiento',NULL),
(N'PNMC-ED-103',N'Gestión',N'Gestión pública y política musical',N'Producción y Emprendimiento',NULL),
(N'PNMC-ED-104',N'Producción y Emprendimiento',N'Promoción y distribución',N'Producción y Emprendimiento',NULL),
(N'PNMC-ED-112',N'Divulgación',N'Memorias y homenajes',N'Creación y Circulación',NULL),
(N'PNMC-ED-113',N'Divulgación',N'Memorias y homenajes',N'Creación y Circulación',NULL),
(N'PNMC-ED-114',N'Creación y Circulación',N'Registros de conciertos y experiencias de circulación',N'Creación y Circulación',NULL),
(N'PNMC-ED-115',N'Divulgación',N'Memorias y homenajes',N'Creación y Circulación',NULL),
(N'PNMC-ED-116',N'Investigación',N'Documentación de prácticas y saberes',N'Creación y Circulación',NULL),
(N'PNMC-ED-117',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-118',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-119',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-120',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-121',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-122',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-123',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-124',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-125',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-126',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-127',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-128',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-129',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-130',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-131',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-132',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-133',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-134',N'Investigación',N'Documentación de prácticas y saberes',N'Creación y Circulación',NULL),
(N'PNMC-ED-135',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-136',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-137',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-138',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-139',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-140',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-141',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-142',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-143',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-144',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-145',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-146',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-147',N'Formación',N'Iniciación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-148',N'Investigación',N'Documentación de prácticas y saberes',N'Creación y Circulación',NULL),
(N'PNMC-ED-149',N'Creación y Circulación',N'Registros de conciertos y experiencias de circulación',N'Creación y Circulación',NULL),
(N'PNMC-ED-150',N'Creación y Circulación',N'Registros de conciertos y experiencias de circulación',N'Creación y Circulación',NULL),
(N'PNMC-ED-151',N'Creación y Circulación',N'Registros de conciertos y experiencias de circulación',N'Creación y Circulación',NULL),
(N'PNMC-ED-152',N'Creación y Circulación',N'Registros de conciertos y experiencias de circulación',N'Creación y Circulación',NULL),
(N'PNMC-ED-153',N'Creación y Circulación',N'Registros de conciertos y experiencias de circulación',N'Creación y Circulación',NULL),
(N'PNMC-ED-154',N'Creación y Circulación',N'Registros de conciertos y experiencias de circulación',N'Creación y Circulación',NULL),
(N'PNMC-ED-155',N'Creación y Circulación',N'Registros de conciertos y experiencias de circulación',N'Creación y Circulación',NULL),
(N'PNMC-ED-156',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-157',N'Repertorio',N'Composiciones originales',N'Creación y Circulación',NULL),
(N'PNMC-ED-158',N'Repertorio',N'Composiciones originales',N'Creación y Circulación',NULL),
(N'PNMC-ED-159',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL),
(N'PNMC-ED-164',N'Divulgación',N'Materiales divulgativos',N'Creación y Circulación',NULL),
(N'PNMC-ED-165',N'Divulgación',N'Materiales divulgativos',N'Creación y Circulación',NULL),
(N'PNMC-ED-166',N'Divulgación',N'Materiales divulgativos',N'Creación y Circulación',NULL),
(N'PNMC-ED-167',N'Divulgación',N'Materiales divulgativos',N'Creación y Circulación',NULL),
(N'PNMC-ED-168',N'Divulgación',N'Materiales divulgativos',N'Creación y Circulación',NULL),
(N'PNMC-ED-169',N'Divulgación',N'Materiales divulgativos',N'Creación y Circulación',NULL),
(N'PNMC-ED-170',N'Divulgación',N'Memorias y homenajes',N'Creación y Circulación',NULL),
(N'PNMC-ED-171',N'Creación y Circulación',N'Creación e interpretación musical',N'Creación y Circulación',NULL);
UPDATE p SET CategoriaId=c.IdCategoria,SubcategoriaEditorialId=s.IdCategoria
FROM dbo.PublicacionesEditoriales p JOIN @Decision d ON d.Codigo=p.Codigo
JOIN dbo.Categorias c ON c.CodigoModulo=N'editorial' AND c.CategoriaPadreId IS NULL AND c.NombreCategoria=d.Categoria
LEFT JOIN dbo.Categorias s ON s.CodigoModulo=N'editorial' AND s.CategoriaPadreId=c.IdCategoria AND s.NombreCategoria=d.Subcategoria
LEFT JOIN dbo.Categorias anterior ON anterior.IdCategoria=p.CategoriaId
LEFT JOIN dbo.Categorias subanterior ON subanterior.IdCategoria=p.SubcategoriaEditorialId
WHERE (d.Subcategoria IS NULL OR s.IdCategoria IS NOT NULL)
AND (anterior.NombreCategoria=d.CategoriaAnterior OR (anterior.IdCategoria IS NULL AND d.CategoriaAnterior IS NULL))
AND (subanterior.NombreCategoria=d.SubcategoriaAnterior OR (subanterior.IdCategoria IS NULL AND d.SubcategoriaAnterior IS NULL))
;
-- La marca de revisión también cubre prácticas pendientes. No limpiarla por asignar una subcategoría.
UPDATE dbo.PublicacionesEditoriales SET RevisarClasificacion=1 WHERE Codigo IN (N'PNMC-ED-010',N'PNMC-ED-014',N'PNMC-ED-053',N'PNMC-ED-054',N'PNMC-ED-057',N'PNMC-ED-104',N'PNMC-ED-116',N'PNMC-ED-148',N'PNMC-ED-151',N'PNMC-ED-160',N'PNMC-ED-161',N'PNMC-ED-162',N'PNMC-ED-163',N'PNMC-ED-015');
COMMIT TRANSACTION;
