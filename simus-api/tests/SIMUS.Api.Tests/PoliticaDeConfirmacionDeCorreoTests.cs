using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using SIMUS.Api.Security;
using Xunit;

namespace SIMUS.Api.Tests;

public sealed class PoliticaDeConfirmacionDeCorreoTests
{
    [Fact]
    public void Produccion_rechaza_la_excepcion_configurada()
    {
        var configuracion = ConfiguracionConExcepcion();

        var error = Assert.Throws<InvalidOperationException>(() =>
            PoliticaDeConfirmacionDeCorreo.Crear(configuracion, new Entorno("Production")));

        Assert.Contains(PoliticaDeConfirmacionDeCorreo.ClavePermitirOperacionSinConfirmacion, error.Message);
    }

    [Fact]
    public void Desarrollo_solo_relaja_el_requisito_y_no_certifica_el_correo()
    {
        var politica = PoliticaDeConfirmacionDeCorreo.Crear(ConfiguracionConExcepcion(), new Entorno("Development"));

        Assert.False(politica.ConfirmacionObligatoria);
    }

    [Fact]
    public void Produccion_por_defecto_exige_confirmacion()
    {
        var politica = PoliticaDeConfirmacionDeCorreo.Crear(new ConfigurationBuilder().Build(), new Entorno("Production"));

        Assert.True(politica.ConfirmacionObligatoria);
    }

    [Fact]
    public void El_entorno_Demo_conserva_toda_la_configuracion_de_produccion()
    {
        // appsettings.Demo.json es una copia de Production con la excepción añadida. Si alguien
        // cambia la seguridad de uno y olvida el otro, la demo dejaría de parecerse a producción.
        var produccion = SinSeccionDemo(ConfiguracionReal("Production"));
        var demo = SinSeccionDemo(ConfiguracionReal("Demo"));

        Assert.Equal(produccion, demo);
    }

    [Fact]
    public void El_entorno_Demo_habilita_la_excepcion_y_Produccion_no()
    {
        var demo = PoliticaDeConfirmacionDeCorreo.Crear(ConfiguracionReal("Demo"), new Entorno("Demo"));
        var produccion = PoliticaDeConfirmacionDeCorreo.Crear(ConfiguracionReal("Production"), new Entorno("Production"));

        Assert.False(demo.ConfirmacionObligatoria);
        Assert.True(produccion.ConfirmacionObligatoria);
    }

    private static IConfigurationRoot ConfiguracionReal(string entorno)
    {
        var carpeta = Path.Combine(RutasDelRepositorio.Raiz(), "simus-api", "src", "SIMUS.Api");
        return new ConfigurationBuilder()
            .SetBasePath(carpeta)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{entorno}.json", optional: false)
            .Build();
    }

    private static List<KeyValuePair<string, string?>> SinSeccionDemo(IConfiguration configuracion) =>
        configuracion.AsEnumerable()
            .Where(par => par.Key != "Demo" && !par.Key.StartsWith("Demo:", StringComparison.Ordinal))
            .OrderBy(par => par.Key, StringComparer.Ordinal)
            .ToList();

    private static IConfiguration ConfiguracionConExcepcion() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            [PoliticaDeConfirmacionDeCorreo.ClavePermitirOperacionSinConfirmacion] = "true",
        })
        .Build();

    private sealed class Entorno(string nombre) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = nombre;
        public string ApplicationName { get; set; } = "SIMUS.Api.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
