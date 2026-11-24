using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El Banco de archivos contra SQL Server de verdad: lo que dice el filtro «Sin usar» y lo que escribe el retiro.
///
/// <para>
/// <b>POR QUÉ VIVE AQUÍ.</b> Dos cosas que SQLite no puede comprobar. La primera: la consulta de «Sin usar»
/// lleva subconsultas correlacionadas, entre ellas una que compara un entero con un texto
/// (<c>e.Id.ToString() == m.RegistroId</c>), y que EF la traduzca bien en SQL Server es un hecho del motor.
/// La segunda: la línea de bitácora del retiro pasa por <c>CK_BitacoraAuditoria_Accion</c>, que solo existe
/// en el esquema real. Con las pruebas de SQLite en verde, una acción que la base rechazara habría sido un 500
/// que solo se ve aquí.
/// </para>
/// </summary>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class BancoDeArchivosSinUsarSqlServerTests
{
    private const string Correo = "banco.sinusar@consola.test";
    private const string Clave = "ClaveDeLaConsola123";
    private const string Ruta = "/api/v1/institucional/archivos";

    private readonly SqlServerFixture _base;

    public BancoDeArchivosSinUsarSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

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
    public async Task El_filtro_sin_usar_se_traduce_en_el_motor_y_encuentra_el_archivo_recien_subido()
    {
        var consola = await ConsolaAsync();
        var subida = await consola.PostAsync(Ruta, Formulario(PngDeUnPixel()));
        Assert.True(subida.IsSuccessStatusCode, await subida.Content.ReadAsStringAsync());
        var id = (await subida.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var filtrado = await consola.GetAsync($"{Ruta}?soloHuerfanos=true&tamano=100");

        // 200 y no 500: la consulta con subconsultas correlacionadas la acepta el motor.
        Assert.Equal(HttpStatusCode.OK, filtrado.StatusCode);
        var listado = await filtrado.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(id, listado.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("id").GetInt32()));
        Assert.True(listado.GetProperty("sinUsar").GetProperty("total").GetInt32() >= 1);
        Assert.True(listado.GetProperty("sinUsar").GetProperty("bytes").GetInt64() > 0);
    }

    [HechoSqlServer]
    public async Task Retirar_un_archivo_deja_una_linea_que_la_base_admite()
    {
        var consola = await ConsolaAsync();
        var subida = await consola.PostAsync(Ruta, Formulario(PngDeUnPixel()));
        Assert.True(subida.IsSuccessStatusCode, await subida.Content.ReadAsStringAsync());
        var id = (await subida.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var retiro = await consola.DeleteAsync($"{Ruta}/{id}");

        // 204 y no 500: `CK_BitacoraAuditoria_Accion` admite «eliminar» y la línea entra.
        Assert.Equal(HttpStatusCode.NoContent, retiro.StatusCode);
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE Accion = N'eliminar' AND TablaAfectada = N'Archivos' "
            + $"AND IdRegistroAfectado = N'{id.ToString(CultureInfo.InvariantCulture)}' "
            + "AND ValoresNuevos LIKE N'%ArchivoRetirado%' AND ValoresNuevos NOT LIKE N'%cedula-ana-gomez%';"),
            CultureInfo.InvariantCulture));
    }
}
