using System.Diagnostics.CodeAnalysis;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Xunit;

namespace SIMUS.Api.Tests;

[Collection(ColeccionSqlServer.Nombre)]
public sealed class CatalogoEditorialSemillasSqlServerTests(SqlServerFixture baseDesechable)
{
    private static readonly Regex Lotes = new(@"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private const string Snapshot = """
        SELECT JSON_QUERY((SELECT * FROM dbo.Categorias WHERE CodigoModulo=N'editorial' ORDER BY IdCategoria FOR JSON PATH,INCLUDE_NULL_VALUES)) AS Categorias,
        JSON_QUERY((SELECT Codigo,CategoriaId,SubcategoriaEditorialId,RutaSeccion,Subcategoria,PracticaMusical,CategoriaSecundaria,RevisarClasificacion FROM dbo.PublicacionesEditoriales WHERE Codigo LIKE N'PNMC-ED-[0-9][0-9][0-9]' ORDER BY Codigo FOR JSON PATH,INCLUDE_NULL_VALUES)) AS Fichas,
        JSON_QUERY((SELECT r.* FROM dbo.PublicacionesEditorialesPracticasMusicales r JOIN dbo.PublicacionesEditoriales p ON p.IdPublicacionEditorial=r.PublicacionEditorialId WHERE p.Codigo LIKE N'PNMC-ED-[0-9][0-9][0-9]' ORDER BY r.PublicacionEditorialId,r.PracticaMusicalId FOR JSON PATH)) AS Practicas
        FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
        """;

    [HechoSqlServer]
    public async Task Recargar_conserva_la_administracion_y_clasifica_solo_las_fichas_nuevas()
    {
        await using var conexion = new SqlConnection(baseDesechable.CadenaDeConexion);
        await conexion.OpenAsync();
        await using var transaccion = (SqlTransaction)await conexion.BeginTransactionAsync();
        await Sembrar(conexion, transaccion, "V20261009_03__administracion_control_sin_editorial_seed.sql");
        await Sembrar(conexion, transaccion, "V20261009_06__catalogo_editorial_acervo_revisado.sql");
        Assert.Equal("171:171:166:143", await Escalar(conexion, transaccion, """
            SELECT CONCAT(COUNT(*),':',SUM(CASE WHEN CategoriaId IS NOT NULL THEN 1 ELSE 0 END),':',SUM(CASE WHEN SubcategoriaEditorialId IS NOT NULL THEN 1 ELSE 0 END),':',(SELECT COUNT(*) FROM dbo.PublicacionesEditorialesPracticasMusicales r JOIN dbo.PublicacionesEditoriales p2 ON p2.IdPublicacionEditorial=r.PublicacionEditorialId WHERE p2.Codigo LIKE N'PNMC-ED-[0-9][0-9][0-9]')) FROM dbo.PublicacionesEditoriales p WHERE p.Codigo LIKE N'PNMC-ED-[0-9][0-9][0-9]';
            """));

        await Ejecutar(conexion, transaccion, """
            UPDATE dbo.Categorias SET NombreCategoria=N'Formación ajustada QA',Slug=N'formacion-ajustada-qa',Descripcion=N'Descripción manual',OrdenVisualizacion=42 WHERE CodigoModulo=N'editorial' AND Slug=N'formacion';
            UPDATE dbo.Categorias SET NombreCategoria=N'Pedagogía instrumental QA',Slug=N'pedagogia-instrumental-qa',Descripcion=N'Subcategoría ajustada',OrdenVisualizacion=89 WHERE CodigoModulo=N'editorial' AND Slug=N'formacion--pedagogia-instrumental';
            INSERT dbo.Categorias(CodigoModulo,NombreCategoria,Slug,Descripcion,OrdenVisualizacion) VALUES(N'editorial',N'Categoría editorial QA',N'categoria-editorial-qa',N'Categoría añadida',91);
            INSERT dbo.Categorias(CodigoModulo,NombreCategoria,Slug,OrdenVisualizacion,CategoriaPadreId) SELECT N'editorial',N'Subcategoría editorial QA',N'subcategoria-editorial-qa',1,IdCategoria FROM dbo.Categorias WHERE CodigoModulo=N'editorial' AND Slug=N'categoria-editorial-qa';
            INSERT dbo.Categorias(CodigoModulo,NombreCategoria,Slug,OrdenVisualizacion,CategoriaPadreId) SELECT N'editorial',N'Subcategoría eliminada QA',N'subcategoria-eliminada-qa',2,IdCategoria FROM dbo.Categorias WHERE CodigoModulo=N'editorial' AND Slug=N'categoria-editorial-qa';
            UPDATE dbo.Categorias SET CategoriaPadreId=(SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo=N'editorial' AND Slug=N'gestion') WHERE CodigoModulo=N'editorial' AND Slug=N'subcategoria-editorial-qa';
            DELETE dbo.Categorias WHERE CodigoModulo=N'editorial' AND Slug=N'subcategoria-eliminada-qa';
            DECLARE @Ficha bigint=(SELECT TOP(1) IdPublicacionEditorial FROM dbo.PublicacionesEditoriales WHERE Codigo LIKE N'PNMC-ED-[0-9][0-9][0-9]' AND SubcategoriaEditorialId IS NOT NULL ORDER BY IdPublicacionEditorial);
            UPDATE dbo.PublicacionesEditoriales SET CategoriaId=NULL,SubcategoriaEditorialId=NULL WHERE IdPublicacionEditorial=@Ficha;
            DELETE dbo.PublicacionesEditorialesPracticasMusicales WHERE PublicacionEditorialId=@Ficha;
            """);
        var antes = await Escalar(conexion, transaccion, Snapshot);
        for (var i = 0; i < 2; i++)
        {
            await Sembrar(conexion, transaccion, "V20261009_03__administracion_control_sin_editorial_seed.sql");
            await Sembrar(conexion, transaccion, "V20261009_06__catalogo_editorial_acervo_revisado.sql");
            Assert.Equal(antes, await Escalar(conexion, transaccion, Snapshot));
        }
        await conexion.CloseAsync(); // La transacción de la prueba revierte todos sus cambios.
    }

    private static async Task Sembrar(SqlConnection conexion, SqlTransaction transaccion, string nombre, [CallerFilePath] string origen = "")
    {
        var ruta = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(origen)!, "..", "..", "..", "simus-database", "seed", nombre));
        foreach (var lote in Lotes.Split(await File.ReadAllTextAsync(ruta)))
            if (!string.IsNullOrWhiteSpace(lote)) await Ejecutar(conexion, transaccion, lote);
    }

    [SuppressMessage("Security", "CA2100", Justification = "SQL constante y semillas versionadas del repositorio en una base de pruebas desechable.")]
    private static async Task Ejecutar(SqlConnection conexion, SqlTransaction transaccion, string sql)
    {
        await using var orden = new SqlCommand(sql, conexion, transaccion) { CommandTimeout = 180 };
        await orden.ExecuteNonQueryAsync();
    }

    [SuppressMessage("Security", "CA2100", Justification = "Consulta constante de la prueba contra una base desechable.")]
    private static async Task<string> Escalar(SqlConnection conexion, SqlTransaction transaccion, string sql)
    {
        await using var orden = new SqlCommand(sql, conexion, transaccion) { CommandTimeout = 180 };
        return (string)(await orden.ExecuteScalarAsync())!;
    }
}
