using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El Banco de archivos y lo que nadie usa.
///
/// <para>
/// LO QUE ESTAS PRUEBAS IMPIDEN. Dos cosas. Que el filtro «Sin usar» vuelva a resolverse DESPUÉS de
/// paginar —con lo que una página salía casi vacía y el total mentía— y que retirar un archivo,
/// la única acción del banco que borra bytes, vuelva a no dejar rastro.
/// </para>
/// </summary>
public sealed class BancoDeArchivosSinUsarTests
{
    private const string Ruta = "/api/v1/institucional/archivos";

    /// <summary>Siembra archivos con bytes, para que el banco los ofrezca, y devuelve sus identificadores.</summary>
    private static async Task<List<int>> SembrarArchivosAsync(TestWebApplicationFactory factory, int cantidad, string prefijo)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var ids = new List<int>();
        for (var i = 0; i < cantidad; i++)
        {
            var marca = Guid.NewGuid().ToString("N");
            var fila = new FileRow
            {
                OriginalName = $"{prefijo}-{i}.png",
                StoredName = $"g5-{marca}.png",
                MimeType = "image/png",
                FileSizeBytes = 3,
                StoragePath = $"g5/{marca}",
                UploadedByUserId = 1,
                CreatedAt = DateTime.UtcNow,
                Content = [1, 2, 3],
                Fingerprint = marca,
            };
            db.Files.Add(fila);
            await db.SaveChangesAsync();
            ids.Add(fila.Id);
        }
        return ids;
    }

    /// <summary>Usa el archivo como foto de una organización: es un vínculo real de los seis.</summary>
    private static async Task UsarComoFotoAsync(TestWebApplicationFactory factory, int archivoId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        db.EntityProfiles.Add(new EntityProfileRow
        {
            EntityType = "organizacion",
            Name = "Organización con foto " + archivoId,
            CoverageLevel = "municipal",
            DepartmentCode = "05",
            MunicipalityCode = "05001",
            StatusCode = "activa",
            IsActive = true,
            CreatedByUserId = 1,
            CreatedAt = DateTime.UtcNow,
            ArchivoFotoId = archivoId,
        });
        await db.SaveChangesAsync();
    }

    private static async Task CitarEnRegistroAsync(TestWebApplicationFactory factory, int archivoId, string modulo, string registro)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        db.ArchivosDeRegistro.Add(new ArchivoDeRegistroRow
        {
            ModuloId = modulo,
            RegistroId = registro,
            ArchivoId = archivoId,
            OrdenVisualizacion = 1,
        });
        await db.SaveChangesAsync();
    }

    private static async Task<JsonElement> ListarAsync(HttpClient consola, string consulta) =>
        await (await consola.GetAsync($"{Ruta}{consulta}")).Content.ReadFromJsonAsync<JsonElement>();

    [Fact]
    public async Task Sin_usar_se_resuelve_antes_de_paginar_y_el_total_es_el_de_los_sin_usar()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var ids = await SembrarArchivosAsync(factory, 14, "reparto");
        // Cuatro con uso real, intercalados entre los de arriba y los de abajo del banco.
        await UsarComoFotoAsync(factory, ids[1]);
        await UsarComoFotoAsync(factory, ids[6]);
        await CitarEnRegistroAsync(factory, ids[3], Modulos.ReclamacionesDeAdministracion, "1");
        await CitarEnRegistroAsync(factory, ids[10], Modulos.ReclamacionesDeAdministracion, "2");

        var todos = await ListarAsync(consola, "?tamano=100");
        var sinUsarSegunCadaArchivo = todos.GetProperty("items").EnumerateArray()
            .Where(x => x.GetProperty("huerfano").GetBoolean()).Select(x => x.GetProperty("id").GetInt32()).ToList();
        Assert.True(sinUsarSegunCadaArchivo.Count >= 10, "los 10 sin uso sembrados tienen que aparecer");

        var primera = await ListarAsync(consola, "?soloHuerfanos=true&tamano=4&pagina=1");

        // LA PÁGINA SE LLENA CON LOS SIN USAR: antes se cortaba el banco entero en páginas de 4 y se
        // descartaba lo usado de cada una, de modo que salían páginas de 1, 2 o 3.
        Assert.Equal(4, primera.GetProperty("items").GetArrayLength());
        Assert.All(primera.GetProperty("items").EnumerateArray(), x => Assert.True(x.GetProperty("huerfano").GetBoolean()));
        Assert.Equal(sinUsarSegunCadaArchivo.Count, primera.GetProperty("total").GetInt32());
        var paginas = (int)Math.Ceiling(sinUsarSegunCadaArchivo.Count / 4.0);
        Assert.Equal(paginas, primera.GetProperty("totalPaginas").GetInt32());

        // La última página lleva el resto exacto, y entre todas están exactamente los sin usar.
        var vistos = new List<int>();
        for (var p = 1; p <= paginas; p++)
        {
            var pagina = await ListarAsync(consola, $"?soloHuerfanos=true&tamano=4&pagina={p}");
            vistos.AddRange(pagina.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("id").GetInt32()));
        }
        Assert.Equal(sinUsarSegunCadaArchivo.Order(), vistos.Order());
    }

    [Fact]
    public async Task Los_sin_usar_del_servidor_coinciden_con_los_vinculos_de_cada_archivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var ids = await SembrarArchivosAsync(factory, 6, "paridad");
        await UsarComoFotoAsync(factory, ids[0]);
        await CitarEnRegistroAsync(factory, ids[1], Modulos.ReclamacionesDeAdministracion, "1");
        // UN MATERIAL QUE CITA UNA EDICIÓN QUE NO EXISTE NO ES UN USO: `VinculosAsync` lo cuenta así y el
        // filtro del servidor tiene que contarlo igual, o el banco ofrecería retirar lo que no se ve usado.
        await CitarEnRegistroAsync(factory, ids[2], Modulos.EdicionesDeFestival, "987654");

        var todos = await ListarAsync(consola, "?tamano=100");
        var segunVinculos = todos.GetProperty("items").EnumerateArray()
            .Where(x => x.GetProperty("huerfano").GetBoolean()).Select(x => x.GetProperty("id").GetInt32()).Order().ToList();
        var filtrado = await ListarAsync(consola, "?soloHuerfanos=true&tamano=100");
        var segunElFiltro = filtrado.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("id").GetInt32()).Order().ToList();

        Assert.Equal(segunVinculos, segunElFiltro);
        Assert.DoesNotContain(ids[0], segunElFiltro);
        Assert.DoesNotContain(ids[1], segunElFiltro);
        Assert.Contains(ids[2], segunElFiltro);
    }

    [Fact]
    public async Task El_listado_dice_cuanto_hay_sin_usar_y_cuanto_pesa_en_cualquier_pagina()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var ids = await SembrarArchivosAsync(factory, 5, "aviso");
        await UsarComoFotoAsync(factory, ids[0]);

        var todos = await ListarAsync(consola, "?tamano=100");
        var items = todos.GetProperty("items").EnumerateArray().Where(x => x.GetProperty("huerfano").GetBoolean()).ToList();
        var esperadoBytes = items.Sum(x => x.GetProperty("bytes").GetInt64());

        // El resumen no depende de la página ni del filtro: es lo que el aviso del banco enseña.
        foreach (var consulta in new[] { "?tamano=100", "?tamano=2&pagina=2", "?soloHuerfanos=true&tamano=2" })
        {
            var respuesta = await ListarAsync(consola, consulta);
            var resumen = respuesta.GetProperty("sinUsar");
            Assert.Equal(items.Count, resumen.GetProperty("total").GetInt32());
            Assert.Equal(esperadoBytes, resumen.GetProperty("bytes").GetInt64());
        }
    }

    [Fact]
    public async Task Retirar_un_archivo_deja_su_linea_en_la_bitacora_sin_el_nombre_del_archivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var ids = await SembrarArchivosAsync(factory, 1, "cedula-ana-gomez");
        var id = ids[0];

        var retiro = await consola.DeleteAsync($"{Ruta}/{id}");
        Assert.Equal(HttpStatusCode.NoContent, retiro.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var linea = await db.AuditLogs.AsNoTracking()
            .SingleAsync(x => x.TableName == "Archivos" && x.RecordId == id.ToString(CultureInfo.InvariantCulture));
        Assert.Equal("eliminar", linea.Action);
        Assert.NotNull(linea.UserId);
        Assert.Contains("ArchivoRetirado", linea.NewValuesJson, StringComparison.Ordinal);
        // LO QUE DESCRIBE EL HECHO Y NADA PERSONAL: el nombre de un archivo puede ser el de una persona.
        Assert.DoesNotContain("cedula-ana-gomez", linea.NewValuesJson + linea.PreviousValuesJson, StringComparison.Ordinal);
        Assert.Contains("image/png", linea.PreviousValuesJson, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Un_retiro_rechazado_porque_el_archivo_se_usa_no_deja_linea_ni_borra_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var ids = await SembrarArchivosAsync(factory, 1, "en-uso");
        await UsarComoFotoAsync(factory, ids[0]);

        var retiro = await consola.DeleteAsync($"{Ruta}/{ids[0]}");

        Assert.Equal(HttpStatusCode.Conflict, retiro.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.False(await db.AuditLogs.AsNoTracking().AnyAsync(x => x.TableName == "Archivos"
            && x.RecordId == ids[0].ToString(CultureInfo.InvariantCulture)));
        Assert.True(await db.Files.AsNoTracking().AnyAsync(x => x.Id == ids[0]));
    }
}
