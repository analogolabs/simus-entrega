using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El mensaje «Confirma tu correo» habla de la cuenta, no de una organización.
/// </summary>
/// <remarks>
///. El texto decía «para terminar de activar tu organización», y el mismo mensaje se
/// emite a cuentas que todavía no tienen ninguna —quien acepta una invitación o se registra como
/// persona—. Lo que se confirma es el correo de la cuenta, y eso es lo que tiene que decir.
/// </remarks>
public sealed class TextoDelCorreoDeConfirmacionTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public TextoDelCorreoDeConfirmacionTests(TestWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task El_mensaje_de_confirmacion_habla_de_la_cuenta_y_lleva_su_enlace()
    {
        var correo = $"texto.confirmacion.{Guid.NewGuid():N}@example.com";
        var alta = await _factory.CreateClient().PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización del texto de confirmación",
            FullName = "Persona del texto",
            NumeroDocumento = "1000000777",
            HeadquartersDepartmentCode = "11",
            HeadquartersMunicipalityCode = "11001",
            Phone = "3000000000",
            Email = correo,
            Password = "ClaveExterna123",
            PoliticasAceptadas = ["tratamiento", "terminos"],
        });
        Assert.Equal(HttpStatusCode.Created, alta.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var mensaje = await db.Notifications.AsNoTracking()
            .Where(x => x.RecipientEmail == correo && x.EventType == "ConfirmacionDeCorreo")
            .OrderByDescending(x => x.Id)
            .FirstAsync();

        Assert.Contains("activar tu cuenta", mensaje.Body, StringComparison.Ordinal);
        Assert.DoesNotContain("tu organización", mensaje.Body, StringComparison.Ordinal);
        Assert.Contains("/ecosistema/confirmar-correo?testigo=", mensaje.Body, StringComparison.Ordinal);
    }
}
