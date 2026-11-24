using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Tests;

/// <summary>
/// Levanta la API apuntando a una base desechable de SQL Server en vez de al SQLite
/// de <see cref="TestWebApplicationFactory"/>.
///
/// <para>
/// SIGUE SIENDO ENTORNO "Test" a proposito. El entorno no elige aqui el motor —lo
/// elige esta clase sustituyendo el registro del contexto—, pero si gobierna otras
/// tres cosas de <c>Program.cs</c> que las pruebas necesitan: los limitadores de
/// peticiones se desactivan, las cookies no se marcan <c>Secure</c> (sobre http el
/// cliente de pruebas no las devolveria y todo inicio de sesion fallaria) y CORS
/// admite el origen local. Cambiar el nombre del entorno para esquivar la rama de
/// SQLite habria arrastrado esos tres efectos.
/// </para>
///
/// <para>
/// POR QUE SE RETIRAN MAS REGISTROS QUE EN EL ARNES DE SQLITE. Aquel sustituye SQLite
/// por SQLite, asi que le basta con quitar <c>DbContextOptions&lt;SimusDbContext&gt;</c>.
/// Aqui se sustituye SQLite por SQL Server: si sobrevive cualquier configuracion de
/// opciones de la primera llamada a <c>AddDbContext</c>, EF ve dos proveedores sobre
/// el mismo contexto y revienta al construir las opciones con "Only a single database
/// provider can be registered". Por eso se barren tambien las entradas
/// <c>IDbContextOptionsConfiguration&lt;SimusDbContext&gt;</c> que EF acumula; la
/// comprobacion es por nombre para no depender de que ese tipo exista en toda version
/// de EF.
/// </para>
/// </summary>
public sealed class SqlServerWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _cadenaDeConexion;

    public SqlServerWebApplicationFactory(string cadenaDeConexion)
    {
        _cadenaDeConexion = cadenaDeConexion;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Test");

        // EL TESTIGO CSRF GLOBAL SE OBSERVA, NO SE EXIGE, EN ESTA VIA. Estas pruebas miden la base real
        // (CHECK, claves, historial), no el testigo: las de la via de SQLite ya piden el testigo en cada
        // escritura y TestigoGlobalDeEscriturasTests prueba el modo `Exigir` de punta a punta.
        builder.ConfigureAppConfiguration((_, configuracion) => configuracion.AddInMemoryCollection(
            new Dictionary<string, string?> { ["Seguridad:Csrf:Modo"] = "Registrar" }));

        builder.ConfigureServices(services =>
        {
            RetirarRegistroDeContexto(services);

            // EL MISMO GESTO QUE EN LA VIA DE SQLite: el arnés hace de persona que abre el enlace de
            // confirmación nada más registrarse. Ver TestWebApplicationFactory.ConfirmaElCorreoAlRegistrar
            // para el motivo. Sin esto, la mitad de las pruebas de esta vía fallarían por un motivo
            // que no es el suyo: enviar a revisión exige un correo comprobado desde el 12 de
            // septiembre de 2026.
            services.RemoveAll<SIMUS.Infrastructure.Correo.IEnviadorDeCorreo>();
            services.AddScoped<SIMUS.Infrastructure.Correo.IEnviadorDeCorreo, EnviadorQueAbreElEnlace>();

            // CON REINTENTOS, COMO PRODUCCION. DependencyInjection.cs registra el contexto con
            // `EnableRetryOnFailure(5)`, y eso cambia una regla de EF: una transaccion iniciada
            // con `BeginTransactionAsync` fuera de `CreateExecutionStrategy().ExecuteAsync`
            // lanza en el primer SaveChangesAsync. Hasta el 23 ago 2026 este arnes NO
            // reintentaba, asi que tres rutas que morian SIEMPRE en produccion (normalizar
            // versiones, crear una propuesta, decidir sobre ella) pasaban aqui en verde.
            // El arnes tiene que fallar donde produccion falla, o no es un arnes.
            services.AddDbContext<SimusDbContext>(options => options.UseSqlServer(
                _cadenaDeConexion,
                sql => sql.EnableRetryOnFailure(5).CommandTimeout(180)));
        });
    }

    private static void RetirarRegistroDeContexto(IServiceCollection services)
    {
        for (var indice = services.Count - 1; indice >= 0; indice--)
        {
            var tipo = services[indice].ServiceType;

            var esElContexto = tipo == typeof(SimusDbContext);
            var esSusOpciones = tipo == typeof(DbContextOptions)
                || tipo == typeof(DbContextOptions<SimusDbContext>);
            var esSuConfiguracionDeOpciones = tipo.IsConstructedGenericType
                && tipo.GetGenericTypeDefinition().Name.StartsWith(
                    "IDbContextOptionsConfiguration",
                    StringComparison.Ordinal)
                && tipo.GenericTypeArguments.Length == 1
                && tipo.GenericTypeArguments[0] == typeof(SimusDbContext);

            if (esElContexto || esSusOpciones || esSuConfiguracionDeOpciones)
            {
                services.RemoveAt(indice);
            }
        }
    }
}
