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
/// Las imágenes de las ediciones de un Mercado (portada, logotipo, afiche, galería): públicas solo si la
/// edición está publicada Y el mercado también, con ETag; en borrador o rechazado responden 404 como un archivo
/// que no existe. Es la misma regla que ya aplicaba a las ediciones de un Festival.
/// </summary>
public sealed class ImagenesDeMercadosPublicasTests
{
    private static async Task<(int Mercado, int Edicion, int Archivo)> SembrarAsync(
        TestWebApplicationFactory factory, string estadoMercado, string visibilidadEdicion, bool mercadoActivo = true,
        string rol = "portada")
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var marca = Guid.NewGuid().ToString("N");
        var archivo = new FileRow
        {
            OriginalName = $"m-{marca}.png", StoredName = $"m-{marca}.png", MimeType = "image/png", FileSizeBytes = 3,
            StoragePath = $"m/{marca}", UploadedByUserId = 1, CreatedAt = DateTime.UtcNow, Content = [1, 2, 3],
            Fingerprint = marca, AltText = "Portada del mercado",
        };
        db.Files.Add(archivo);
        var organizacion = new EntityProfileRow
        {
            EntityType = "organizacion", Name = "Org " + marca, CoverageLevel = "municipal", DepartmentCode = "05",
            MunicipalityCode = "05001", StatusCode = "activa", IsActive = true, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow,
        };
        db.EntityProfiles.Add(organizacion);
        await db.SaveChangesAsync();
        var mercado = new MercadoRow
        {
            Nombre = "Mercado " + marca, NivelCobertura = "nacional", OrganizacionPrincipalId = organizacion.Id,
            EstadoRegistro = estadoMercado, Activo = mercadoActivo, FechaCreacion = DateTime.UtcNow,
        };
        db.Mercados.Add(mercado);
        await db.SaveChangesAsync();
        var edicion = new EdicionMercadoRow
        {
            MercadoId = mercado.Id, Anio = 2026, Nombre = "Edición", Estado = "programada",
            EstadoVisibilidad = visibilidadEdicion, FechaCreacion = DateTime.UtcNow,
        };
        db.EdicionesMercado.Add(edicion);
        await db.SaveChangesAsync();
        db.ArchivosDeRegistro.Add(new ArchivoDeRegistroRow
        {
            ModuloId = Modulos.EdicionesDeMercado, RegistroId = edicion.Id.ToString(), ArchivoId = archivo.Id,
            RolArchivo = rol, OrdenVisualizacion = 1,
        });
        await db.SaveChangesAsync();
        return (mercado.Id, edicion.Id, archivo.Id);
    }

    [Fact]
    public async Task La_imagen_de_una_edicion_publicada_de_un_mercado_publicado_se_sirve_a_anonimos_con_etag()
    {
        await using var factory = new TestWebApplicationFactory();
        var anonimo = factory.CreateClient();
        var (mercado, edicion, archivo) = await SembrarAsync(factory, "publicado", "publicado");

        var respuesta = await anonimo.GetAsync($"/api/v1/publico/archivos/{archivo}");
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var etag = respuesta.Headers.ETag;
        Assert.NotNull(etag);

        var condicional = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/publico/archivos/{archivo}");
        condicional.Headers.IfNoneMatch.Add(etag!);
        Assert.Equal(HttpStatusCode.NotModified, (await anonimo.SendAsync(condicional)).StatusCode);

        var lista = await anonimo.GetFromJsonAsync<JsonElement>($"/api/v1/publico/mercados/{mercado}/ediciones/imagenes");
        var imagen = Assert.Single(lista.EnumerateArray());
        Assert.Equal(edicion, imagen.GetProperty("edicionId").GetInt32());
        Assert.Equal("portada", imagen.GetProperty("rol").GetString());
        Assert.Equal($"/api/v1/publico/archivos/{archivo}", imagen.GetProperty("url").GetString());
        Assert.Equal("Portada del mercado", imagen.GetProperty("alt").GetString());
    }

    [Theory]
    [InlineData("publicado", "borrador", true)]
    [InlineData("publicado", "archivado", true)]
    [InlineData("borrador", "publicado", true)]
    [InlineData("rechazado", "publicado", true)]
    [InlineData("publicado", "publicado", false)]
    public async Task La_imagen_de_lo_que_no_esta_publicado_da_404_y_no_se_lista(string mercadoEstado, string visibilidad, bool activo)
    {
        await using var factory = new TestWebApplicationFactory();
        var anonimo = factory.CreateClient();
        var (mercado, _, archivo) = await SembrarAsync(factory, mercadoEstado, visibilidad, activo);

        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/archivos/{archivo}")).StatusCode);

        var lista = await anonimo.GetAsync($"/api/v1/publico/mercados/{mercado}/ediciones/imagenes");
        if (mercadoEstado == "publicado" && activo)
        {
            // El mercado se ve; la edición no, así que no hay imágenes que contar.
            Assert.Equal(HttpStatusCode.OK, lista.StatusCode);
            Assert.Empty((await lista.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray());
        }
        else
        {
            Assert.Equal(HttpStatusCode.NotFound, lista.StatusCode);
        }

        // La consola sí la ve, y el Banco no la da por «sin uso».
        var consola = await CmsTestClient.LoginAsync(factory);
        Assert.Equal(HttpStatusCode.OK, (await consola.GetAsync($"/api/v1/publico/archivos/{archivo}")).StatusCode);
        var huerfanos = await consola.GetFromJsonAsync<JsonElement>("/api/v1/institucional/archivos?soloHuerfanos=true&tamano=100");
        Assert.DoesNotContain(huerfanos.GetProperty("items").EnumerateArray(), x => x.GetProperty("id").GetInt32() == archivo);
    }
}
