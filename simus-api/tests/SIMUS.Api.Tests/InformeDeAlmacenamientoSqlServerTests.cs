using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El informe de almacenamiento del Banco contra SQL Server de verdad.
///
/// <para>
/// <b>POR QUÉ VIVE AQUÍ.</b> El informe agrupa por año y mes de la fecha, por huella y por organización, y suma
/// columnas que admiten nulos. Que EF traduzca esas agrupaciones es un hecho del motor: con SQLite en verde, una
/// que SQL Server no aceptara sería un 500 que solo se ve aquí.
/// </para>
/// </summary>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class InformeDeAlmacenamientoSqlServerTests
{
    private const string Correo = "banco.informe@consola.test";
    private const string Clave = "ClaveDeLaConsola123";
    private const string Ruta = "/api/v1/institucional/archivos";

    private readonly SqlServerFixture _base;

    public InformeDeAlmacenamientoSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    /// <summary>
    /// Un PNG DISTINTO en cada llamada. El banco deduplica por contenido y la base de pruebas se comparte con
    /// otras clases: con los mismos bytes que otra prueba, esta subida «reutilizaría» un archivo de otro dueño y
    /// dejaría la otra prueba (la de la imagen repetida) viendo una descripción que no es la suya.
    /// </summary>
    private static byte[] PngDeUnPixel()
    {
        using var mapa = new SkiaSharp.SKBitmap(2, 2);
        for (var x = 0; x < 2; x++)
        {
            for (var y = 0; y < 2; y++)
            {
                var color = System.Security.Cryptography.RandomNumberGenerator.GetBytes(3);
                mapa.SetPixel(x, y, new SkiaSharp.SKColor(color[0], color[1], color[2]));
            }
        }
        using var imagen = SkiaSharp.SKImage.FromBitmap(mapa);
        using var datos = imagen.Encode(SkiaSharp.SKEncodedImageFormat.Png, 100);
        return datos.ToArray();
    }

    private async Task<HttpClient> ConsolaAsync()
    {
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            if (!await db.Users.AnyAsync(x => x.Email == Correo))
            {
                var idWebmaster = await db.Roles.AsNoTracking().Where(x => x.Name == "webmaster").Select(x => x.Id).FirstAsync();
                var usuario = new UserRow { FullName = "Consola del banco", Email = Correo, IsActive = true, CreatedAt = DateTime.UtcNow };
                usuario.PasswordHash = AdminAuthEndpoints.HashPassword(usuario, Clave);
                db.Users.Add(usuario);
                await db.SaveChangesAsync();
                await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);
            }
        }

        var consola = _base.CrearCliente();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = Correo, Password = Clave }))
            .EnsureSuccessStatusCode();
        var testigo = await consola.GetFromJsonAsync<JsonElement>("/api/v1/admin/csrf");
        consola.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        consola.DefaultRequestHeaders.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return consola;
    }

    private static MultipartFormDataContent Formulario(byte[] datos)
    {
        var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(datos);
        parte.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        contenido.Add(parte, "file", "cedula-ana-gomez.png");
        contenido.Add(new StringContent("Una imagen de prueba"), "alt");
        return contenido;
    }

    [HechoSqlServer]
    public async Task El_informe_se_traduce_en_el_motor_y_cuenta_el_archivo_recien_subido()
    {
        var consola = await ConsolaAsync();
        var subida = await consola.PostAsync(Ruta, Formulario(PngDeUnPixel()));
        Assert.True(subida.IsSuccessStatusCode, await subida.Content.ReadAsStringAsync());

        var respuesta = await consola.GetAsync($"{Ruta}/almacenamiento");

        // 200 y no 500: las agrupaciones por mes, por huella y por organización las acepta el motor.
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var informe = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(informe.GetProperty("total").GetProperty("archivos").GetInt32() >= 1);
        Assert.True(informe.GetProperty("total").GetProperty("bytes").GetInt64() > 0);
        Assert.Equal(12, informe.GetProperty("crecimientoMensual").GetArrayLength());
        Assert.True(informe.GetProperty("sinUsar").GetProperty("archivos").GetInt32() >= 1);
        var total = informe.GetProperty("total").GetProperty("bytes").GetInt64();
        Assert.Equal(total, informe.GetProperty("porProcedencia").EnumerateArray().Sum(x => x.GetProperty("bytes").GetInt64()));
    }
}
