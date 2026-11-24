using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Api.Historial;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El NIT de una organización (decisión 96, docs/referencia/20-decisiones-y-flujos-por-modulo.md): vacío o NIT de persona jurídica, nunca una cédula.
/// </summary>
public sealed class NitDeOrganizacionTests
{
    private const string Organizaciones = "/api/v1/admin/organizaciones";

    // ---------- La función única ----------

    [Theory]
    [InlineData("900123456-8", "900123456-8")]
    [InlineData("900.123.456-8", "900123456-8")]
    [InlineData("9001234568", "900123456-8")]
    [InlineData("900123456", "900123456-8")]
    [InlineData(" 900 123 456 - 8 ", "900123456-8")]
    [InlineData("860002964-4", "860002964-4")]
    [InlineData("800197268-4", "800197268-4")]
    [InlineData("899999999-1", "899999999-1")]
    public void Un_NIT_de_persona_juridica_es_valido_y_queda_en_forma_canonica(string escrito, string canonico)
    {
        var (resultado, forma) = NitColombiano.Analizar(escrito);
        Assert.Equal(NitColombiano.Resultado.Valido, resultado);
        Assert.Equal(canonico, forma);
        Assert.Null(NitColombiano.Validar(escrito));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Vacio_es_valido_porque_la_organizacion_puede_no_tener_personeria(string? valor)
    {
        Assert.Equal(NitColombiano.Resultado.Vacio, NitColombiano.Analizar(valor).Resultado);
        Assert.Null(NitColombiano.Validar(valor));
        Assert.Null(AltaDeOrganizacion.NormalizarIdentificacion(valor));
    }

    [Theory]
    [InlineData("1020304050")]
    [InlineData("1.020.304.050")]
    [InlineData("80123456")]
    [InlineData("52.123.456")]
    [InlineData("700123456")]
    [InlineData("10203040-5")]
    [InlineData("1020304050-1")]
    public void Lo_que_tiene_forma_de_cedula_se_rechaza(string valor)
    {
        Assert.Equal(NitColombiano.Resultado.FormaDeCedula, NitColombiano.Analizar(valor).Resultado);
        Assert.Equal(NitColombiano.MensajeDeCedula, NitColombiano.Validar(valor));
    }

    [Theory]
    [InlineData("900123456-7")]
    [InlineData("9001234567")]
    [InlineData("860002964-5")]
    public void Un_digito_de_verificacion_que_no_corresponde_se_rechaza(string valor)
    {
        Assert.Equal(NitColombiano.Resultado.DigitoIncorrecto, NitColombiano.Analizar(valor).Resultado);
        Assert.Equal(NitColombiano.MensajeDeDigito, NitColombiano.Validar(valor));
    }

    [Theory]
    [InlineData("NIT 900123456")]
    [InlineData("PUB-123")]
    [InlineData("900123456-78")]
    [InlineData("900-123456-8")]
    [InlineData("12")]
    [InlineData("123456789012")]
    public void Letras_simbolos_y_longitudes_imposibles_son_formato_invalido(string valor)
    {
        var resultado = NitColombiano.Analizar(valor).Resultado;
        Assert.True(resultado is NitColombiano.Resultado.FormatoInvalido or NitColombiano.Resultado.FormaDeCedula, resultado.ToString());
        Assert.NotNull(NitColombiano.Validar(valor));
    }

    [Fact]
    public void El_digito_de_verificacion_sigue_el_algoritmo_de_la_DIAN()
    {
        Assert.Equal(4, NitColombiano.DigitoDeVerificacion("800197268"));
        Assert.Equal(4, NitColombiano.DigitoDeVerificacion("860002964"));
        Assert.Equal(0, NitColombiano.DigitoDeVerificacion("890900286"));
    }

    [Fact]
    public void El_historial_clasifica_como_identificacion_el_NIT_con_forma_de_cedula()
    {
        var campo = ExternalOrganizationEndpoints.CamposDelPerfil.Single(x => x.Id == "numeroIdentificacion");

        Assert.Equal(ClaseDeDato.Organizacion, campo.ClaseDelCambio(null, "900123456-8"));
        Assert.Equal(ClaseDeDato.Organizacion, campo.ClaseDelCambio("900.123.456-8", null));
        // Un valor guardado antes de la regla, con forma de cédula, pasa a identificación aunque el nuevo sea un NIT.
        Assert.Equal(ClaseDeDato.Identificacion, campo.ClaseDelCambio("1020304050", "900123456-8"));
        Assert.Equal(ClaseDeDato.Identificacion, campo.ClaseDelCambio(null, "1020304050"));
        // Forma de NIT con el dígito errado (solo datos anteriores): sigue siendo de la organización.
        Assert.Equal(ClaseDeDato.Organizacion, campo.ClaseDelCambio("901900101-1", "900123456-8"));
    }

    // ---------- Por la API ----------

    private static object Organizacion(string nombre, string? identificacion) => new
    {
        nombre,
        identificacion,
        correoContacto = $"nit{Guid.NewGuid():N}@fundacion.org",
        codigoDepartamentoSede = "05",
        codigoMunicipioSede = "05001",
        responsableNombre = "Ana Restrepo",
        responsableTipoDocumento = "CC",
        responsableNumeroDocumento = "1020304050",
        responsableCorreo = "ana@fundacion.org",
        responsableAutorizacionDatos = true,
    };

    [Fact]
    public async Task El_alta_de_la_consola_rechaza_una_cedula_en_el_campo_del_NIT_y_no_escribe_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var nombre = $"Colectivo con cédula {Guid.NewGuid():N}";

        var respuesta = await client.PostAsJsonAsync(Organizaciones, Organizacion(nombre, "1.020.304.050"));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        using var cuerpo = JsonDocument.Parse(await respuesta.Content.ReadAsStringAsync());
        var mensaje = cuerpo.RootElement.GetProperty("errors").GetProperty("identificationNumber")[0].GetString();
        Assert.Equal(NitColombiano.MensajeDeCedula, mensaje);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.False(await db.EntityProfiles.AnyAsync(x => x.Name == nombre));
    }

    [Fact]
    public async Task Una_organizacion_sin_personeria_se_registra_sin_NIT_y_con_NIT_queda_en_forma_canonica()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var sin = await client.PostAsJsonAsync(Organizaciones, Organizacion($"Colectivo informal {Guid.NewGuid():N}", null));
        Assert.True(sin.IsSuccessStatusCode, await sin.Content.ReadAsStringAsync());

        var nombre = $"Fundación con NIT {Guid.NewGuid():N}";
        var con = await client.PostAsJsonAsync(Organizaciones, Organizacion(nombre, "890.900.286-0"));
        Assert.True(con.IsSuccessStatusCode, await con.Content.ReadAsStringAsync());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal("890900286-0", (await db.EntityProfiles.AsNoTracking().SingleAsync(x => x.Name == nombre)).IdentificationNumber);

        // «890900286» es el mismo NIT escrito sin dígito: es un duplicado.
        var repetido = await client.PostAsJsonAsync(Organizaciones, Organizacion($"Otra fundación {Guid.NewGuid():N}", "890900286"));
        Assert.Equal(HttpStatusCode.BadRequest, repetido.StatusCode);
    }

    [Fact]
    public async Task El_alta_con_cuenta_rechaza_la_cedula_y_un_digito_errado()
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();

        foreach (var malo in new[] { "1020304050", "900123456-7" })
        {
            var correo = $"nit.{Guid.NewGuid():N}@example.com";
            var respuesta = await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new SIMUS.Contracts.ExternalRegisterRequest
            {
                OrganizationName = "Organización con NIT malo",
                OrganizationIdentificationNumber = malo,
                FullName = "Persona Responsable",
                NumeroDocumento = "1020304099",
                Phone = "3000000000",
                Email = correo,
                Password = "ClaveExterna123",
                HeadquartersDepartmentCode = "05",
                HeadquartersMunicipalityCode = "05001",
                PoliticasAceptadas = ["tratamiento", "terminos"],
            });
            Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
            Assert.Contains("identificationNumber", await respuesta.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            Assert.False(db.Users.Any(x => x.Email == correo));
        }
    }

    [Fact]
    public async Task Editar_el_perfil_no_reprueba_un_NIT_antiguo_que_no_cambia_pero_si_uno_nuevo_con_forma_de_cedula()
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();
        var correo = $"nit.perfil.{Guid.NewGuid():N}@example.com";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new SIMUS.Contracts.ExternalRegisterRequest
        {
            OrganizationName = "Organización antigua",
            FullName = "Persona Responsable",
            NumeroDocumento = "1020304098",
            Phone = "3000000000",
            Email = correo,
            Password = "ClaveExterna123",
            HeadquartersDepartmentCode = "05",
            HeadquartersMunicipalityCode = "05001",
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();

        var login = await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new { email = correo, password = "ClaveExterna123" });
        login.EnsureSuccessStatusCode();
        var mias = await cliente.GetFromJsonAsync<List<JsonElement>>("/api/v1/externo/organizaciones/mis");
        var id = int.Parse(mias![0].GetProperty("id").GetString()!, System.Globalization.CultureInfo.InvariantCulture);

        // Un valor de antes de la regla, escrito directo en la base.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            (await db.EntityProfiles.SingleAsync(x => x.Id == id)).IdentificationNumber = "1020304050";
            await db.SaveChangesAsync();
        }

        async Task<HttpResponseMessage> Guardar(string nombre, string? nit)
        {
            var peticion = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/externo/organizaciones/{id}/perfil")
            {
                Content = JsonContent.Create(new
                {
                    nombre, numeroIdentificacion = nit, correoContacto = $"c.{id}@ejemplo.test",
                    codigoDepartamentoSede = "05", codigoMunicipioSede = "05001",
                }),
            };
            peticion.Headers.Add("X-CSRF-TOKEN", await OrganizacionDeLaCuenta.CsrfAsync(cliente));
            return await cliente.SendAsync(peticion);
        }

        // Sin tocar el NIT, el perfil se guarda: no se migra a la fuerza.
        Assert.Equal(HttpStatusCode.OK, (await Guardar("Organización antigua renombrada", "1020304050")).StatusCode);

        // Cambiarlo por otra cédula, no.
        var cambiado = await Guardar("Organización antigua renombrada", "52123456");
        Assert.Equal(HttpStatusCode.BadRequest, cambiado.StatusCode);

        // Cambiarlo por un NIT, sí, y queda canónico.
        Assert.Equal(HttpStatusCode.OK, (await Guardar("Organización antigua renombrada", "900.321.654")).StatusCode);
        using var verificacion = factory.Services.CreateScope();
        var dbFinal = verificacion.ServiceProvider.GetRequiredService<SimusDbContext>();
        var guardado = (await dbFinal.EntityProfiles.AsNoTracking().SingleAsync(x => x.Id == id)).IdentificationNumber;
        Assert.Equal("900321654-" + NitColombiano.DigitoDeVerificacion("900321654"), guardado);

        // El cambio del valor con forma de cédula quedó en el historial como identificación (solo Auditoría).
        var clase = await dbFinal.CambiosDeRegistro.AsNoTracking()
            .Where(x => x.RegistroId == id.ToString(System.Globalization.CultureInfo.InvariantCulture) && x.CampoId == "numeroIdentificacion")
            .OrderByDescending(x => x.Id).Select(x => x.ClaseDato).FirstAsync();
        Assert.Equal("identificacion", clase);
    }

    [Fact]
    public void La_membresia_del_historial_lleva_el_nombre_de_una_persona_y_se_clasifica_como_contacto()
    {
        Assert.False(ClaseDeDatoExtensiones.LaLeeLaOrganizacion(ClaseDeDato.Contacto.Codigo()));
    }
}
