using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El informe de almacenamiento del Banco de archivos (<c>docs/operacion/28-tabla-de-retencion-documental.md</c> §28.14 pieza 1).
///
/// <para>
/// LO QUE ESTAS PRUEBAS IMPIDEN. Que el informe deje de coincidir con el Banco (mismas filas, misma regla de «sin
/// usar»), que la alarma deje de saltar al pasar el umbral configurado y que el informe se abra sin sesión de la
/// consola. Es solo lectura: no hay nada que borrar ni mover.
/// </para>
/// </summary>
public sealed class InformeDeAlmacenamientoTests
{
    private const string Ruta = "/api/v1/institucional/archivos/almacenamiento";

    private static async Task<int> SembrarAsync(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory, string huella, long peso = 3)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var marca = Guid.NewGuid().ToString("N");
        var fila = new FileRow
        {
            OriginalName = $"arc06-{marca}.png",
            StoredName = $"arc06-{marca}.png",
            MimeType = "image/png",
            FileSizeBytes = peso,
            StoragePath = $"arc06/{marca}",
            UploadedByUserId = 1,
            CreatedAt = DateTime.UtcNow,
            Content = [1, 2, 3],
            Fingerprint = huella,
        };
        db.Files.Add(fila);
        await db.SaveChangesAsync();
        return fila.Id;
    }

    [Fact]
    public async Task Sin_sesion_de_la_consola_el_informe_no_se_abre()
    {
        await using var factory = new TestWebApplicationFactory();
        using var anonimo = factory.CreateClient();

        var respuesta = await anonimo.GetAsync(Ruta);

        Assert.True(respuesta.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden, respuesta.StatusCode.ToString());
    }

    [Fact]
    public async Task El_informe_cuenta_lo_mismo_que_el_banco_y_mide_los_repetidos_y_lo_que_nadie_usa()
    {
        await using var baseFactory = new TestWebApplicationFactory();
        await using var factory = baseFactory.WithWebHostBuilder(b => b.UseSetting("Almacenamiento:TopeDeLaBaseBytes", (32L * 1024 * 1024 * 1024).ToString(System.Globalization.CultureInfo.InvariantCulture)));
        var consola = await CmsTestClient.LoginAsync(factory);
        var huella = Guid.NewGuid().ToString("N");
        await SembrarAsync(factory, huella);
        await SembrarAsync(factory, huella);
        await SembrarAsync(factory, Guid.NewGuid().ToString("N"));

        var informe = await consola.GetFromJsonAsync<JsonElement>(Ruta);
        var banco = await consola.GetFromJsonAsync<JsonElement>("/api/v1/institucional/archivos?tamano=1");

        // EL TOTAL ES EL DEL BANCO: las mismas filas que ofrece la lista.
        Assert.Equal(banco.GetProperty("total").GetInt32(), informe.GetProperty("total").GetProperty("archivos").GetInt32());
        // Y LO SIN USAR, LA MISMA CIFRA DEL AVISO DEL BANCO.
        Assert.Equal(banco.GetProperty("sinUsar").GetProperty("total").GetInt32(), informe.GetProperty("sinUsar").GetProperty("archivos").GetInt32());
        Assert.Equal(banco.GetProperty("sinUsar").GetProperty("bytes").GetInt64(), informe.GetProperty("sinUsar").GetProperty("bytes").GetInt64());

        // Dos copias del mismo contenido: una sobra, y pesa lo que pesa una.
        Assert.True(informe.GetProperty("repetidos").GetProperty("copiasSobrantes").GetInt32() >= 1);
        Assert.True(informe.GetProperty("repetidos").GetProperty("bytes").GetInt64() >= 3);

        // Las partes suman el total, por procedencia y por antigüedad.
        var total = informe.GetProperty("total").GetProperty("bytes").GetInt64();
        Assert.Equal(total, informe.GetProperty("porProcedencia").EnumerateArray().Sum(x => x.GetProperty("bytes").GetInt64()));
        Assert.Equal(total, informe.GetProperty("porAntiguedad").EnumerateArray().Sum(x => x.GetProperty("bytes").GetInt64()));
        Assert.Equal(total, informe.GetProperty("porTipo").EnumerateArray().Sum(x => x.GetProperty("bytes").GetInt64()));

        // Doce meses, y lo de hoy cae en el último.
        var meses = informe.GetProperty("crecimientoMensual").EnumerateArray().ToList();
        Assert.Equal(12, meses.Count);
        Assert.True(meses[^1].GetProperty("archivos").GetInt32() >= 3);

        // El tope es el del entorno (aquí 32 GiB, como la demo) y con tan pocos bytes la alarma está en «normal».
        Assert.Equal(32L * 1024 * 1024 * 1024, informe.GetProperty("tope").GetProperty("bytes").GetInt64());
        Assert.Equal("normal", informe.GetProperty("tope").GetProperty("nivel").GetString());
        Assert.True(informe.GetProperty("tope").GetProperty("soloMideElBanco").GetBoolean());
        // Los medios del sitio se informan aparte y no entran en el total del Banco.
        Assert.True(informe.GetProperty("mediosDelSitio").GetProperty("bytes").GetInt64() >= 0);
    }

    [Fact]
    public async Task La_alarma_salta_al_pasar_los_umbrales_configurados()
    {
        await using var baseFactory = new TestWebApplicationFactory();
        await using var factory = baseFactory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Almacenamiento:TopeDeLaBaseBytes", "100");
            b.UseSetting("Almacenamiento:UmbralDeAtencion", "0.8");
            b.UseSetting("Almacenamiento:UmbralDeAlarma", "0.9");
        });
        var consola = await CmsTestClient.LoginAsync(factory);
        var huella = Guid.NewGuid().ToString("N");
        var datosBase = (await consola.GetFromJsonAsync<JsonElement>(Ruta)).GetProperty("total").GetProperty("bytes").GetInt64();

        // Cada archivo pesa 3: se agregan los necesarios para quedar entre el 80 % y el 90 % del tope de 100.
        var faltan = (int)Math.Ceiling((83 - datosBase) / 3.0);
        for (var i = 0; i < faltan; i++) { await SembrarAsync(factory, huella + i); }
        var atencion = await consola.GetFromJsonAsync<JsonElement>(Ruta);
        Assert.Equal("atencion", atencion.GetProperty("tope").GetProperty("nivel").GetString());

        for (var i = 0; i < 4; i++) { await SembrarAsync(factory, huella + "x" + i); }
        var alarma = await consola.GetFromJsonAsync<JsonElement>(Ruta);
        Assert.Equal("alarma", alarma.GetProperty("tope").GetProperty("nivel").GetString());
    }

    [Fact]
    public async Task Sin_tope_configurado_solo_hay_cifra_sin_porcentaje_ni_nivel()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        await SembrarAsync(factory, Guid.NewGuid().ToString("N"));

        var informe = await consola.GetFromJsonAsync<JsonElement>(Ruta);

        Assert.True(informe.GetProperty("total").GetProperty("bytes").GetInt64() > 0);
        Assert.Equal(JsonValueKind.Null, informe.GetProperty("tope").GetProperty("bytes").ValueKind);
        Assert.Equal(JsonValueKind.Null, informe.GetProperty("tope").GetProperty("fraccionUsada").ValueKind);
        Assert.Equal("sinTope", informe.GetProperty("tope").GetProperty("nivel").GetString());
        Assert.Equal(JsonValueKind.Null, informe.GetProperty("proyeccion").ValueKind);
    }

    [Fact]
    public async Task Quien_tiene_el_Banco_pero_no_Auditoria_recibe_403_y_con_Auditoria_lo_ve()
    {
        await using var factory = new TestWebApplicationFactory();
        var gestor = await GestorConAsync(factory, "banco-de-archivos");
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync(Ruta)).StatusCode);

        var conAuditoria = await GestorConAsync(factory, "banco-de-archivos", "auditoria");
        Assert.Equal(HttpStatusCode.OK, (await conAuditoria.GetAsync(Ruta)).StatusCode);
    }

    [Fact]
    public async Task Una_organizacion_no_abre_el_informe()
    {
        await using var factory = new TestWebApplicationFactory();
        using var externo = factory.CreateClient();

        var respuesta = await externo.GetAsync("/api/v1/externo/archivos/almacenamiento");

        Assert.True(respuesta.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.NotFound, respuesta.StatusCode.ToString());
    }

    private static async Task<HttpClient> GestorConAsync(TestWebApplicationFactory factory, params string[] modulos)
    {
        const string clave = "ClaveDePrueba123";
        const string definitiva = "ClaveElegida456";
        var webmaster = await CmsTestClient.LoginAsync(factory);
        var correo = $"gestor.arc07.{Guid.NewGuid():N}@pnmc.local";
        var alta = await webmaster.PostAsJsonAsync("/api/v1/admin/auth/users", new AdminUserUpsertRequest
        {
            FullName = "Gestor del Banco", Email = correo, Roles = ["gestor_interno"], Password = clave, IsActive = true,
        });
        alta.EnsureSuccessStatusCode();
        var creada = await alta.Content.ReadFromJsonAsync<JsonElement>();
        var id = int.Parse(creada.GetProperty("user").GetProperty("id").GetString()!, System.Globalization.CultureInfo.InvariantCulture);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            db.ModulosPorCuenta.RemoveRange(db.ModulosPorCuenta.Where(x => x.IdUsuario == id));
            foreach (var modulo in modulos)
            {
                db.ModulosPorCuenta.Add(new ModuloPorCuentaRow { IdUsuario = id, CodigoModulo = modulo, FechaOtorgado = DateTime.UtcNow });
            }
            await db.SaveChangesAsync();
        }

        var sesion = await CmsTestClient.LoginAsync(factory, correo, clave);
        (await sesion.PostAsJsonAsync("/api/v1/admin/auth/mi-contrasena", new CambioDeContrasenaPropia { Actual = clave, Nueva = definitiva })).EnsureSuccessStatusCode();
        (await sesion.PostAsJsonAsync("/api/v1/admin/auth/mi-perfil", new PerfilPropio
        {
            PrimerNombre = "Gestora", PrimerApellido = "Del Banco", TipoDocumento = "cc",
            Identificacion = "3" + id.ToString(System.Globalization.CultureInfo.InvariantCulture).PadLeft(6, '0'),
        })).EnsureSuccessStatusCode();
        return sesion;
    }

    // ─── Niveles y proyección (funciones puras) ───

    [Theory]
    [InlineData(0.0, "normal")]
    [InlineData(0.79, "normal")]
    [InlineData(0.8, "atencion")]
    [InlineData(0.89, "atencion")]
    [InlineData(0.9, "alarma")]
    [InlineData(1.2, "alarma")]
    public void Los_niveles_son_cifra_sola_por_debajo_del_80_atencion_hasta_el_90_y_alarma_desde_ahi(double fraccion, string esperado)
        => Assert.Equal(esperado, Endpoints.InformeDeAlmacenamiento.NivelDe(fraccion, 0.8, 0.9));

    [Fact]
    public void La_proyeccion_avisa_si_se_llegaria_al_90_en_menos_de_seis_meses()
    {
        // Tope 1000, umbral 900, hoy 600: faltan 300. Con 12 meses de 100 se llega en 3 meses: avisa.
        var rapido = Endpoints.InformeDeAlmacenamiento.Proyectar(Enumerable.Repeat(100L, 12).ToList(), 600, 1000, 0.9);
        Assert.Equal(3.0, rapido.MesesHastaElUmbral);
        Assert.True(rapido.AvisaDeLlegadaPronta);

        // Con 12 meses de 25 se llega en 12 meses: no avisa.
        var lento = Endpoints.InformeDeAlmacenamiento.Proyectar(Enumerable.Repeat(25L, 12).ToList(), 600, 1000, 0.9);
        Assert.Equal(12.0, lento.MesesHastaElUmbral);
        Assert.False(lento.AvisaDeLlegadaPronta);
    }

    [Fact]
    public void La_proyeccion_promedia_desde_el_primer_mes_con_datos_y_calla_sin_crecimiento_o_si_ya_se_paso()
    {
        // Tres meses de 90 (los otros nueve vacíos): el promedio es 90, no 22.
        var meses = new long[12]; meses[9] = 90; meses[10] = 90; meses[11] = 90;
        var joven = Endpoints.InformeDeAlmacenamiento.Proyectar(meses, 0, 1000, 0.9);
        Assert.Equal(90, joven.BytesPorMes);
        Assert.Equal(10.0, joven.MesesHastaElUmbral);

        var sinCrecimiento = Endpoints.InformeDeAlmacenamiento.Proyectar(new long[12], 100, 1000, 0.9);
        Assert.Null(sinCrecimiento.MesesHastaElUmbral);
        Assert.False(sinCrecimiento.AvisaDeLlegadaPronta);

        var yaPasado = Endpoints.InformeDeAlmacenamiento.Proyectar(new long[12], 950, 1000, 0.9);
        Assert.Equal(0, yaPasado.MesesHastaElUmbral);
        Assert.True(yaPasado.AvisaDeLlegadaPronta);
    }
}
