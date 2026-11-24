using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Tests;

/// <summary>
/// Apoyos para las pruebas de los eventos de talleres, espacios y redes (LUT-01 y LUT-02).
/// </summary>
/// <remarks>
/// Los procesos se publican <b>contra la base</b>: lo que se mide es la regla del evento, no el circuito de
/// revisión del taller, el espacio o la red, que tienen sus propias pruebas.
/// </remarks>
internal static class ProcesosDeLuteriaEnLaAgenda
{
    internal const string Clave = "ClaveExterna123";

    internal const string Descripcion = "Taller abierto al público para aprender a afinar y a reparar instrumentos de cuerda.";

    /// <summary>Una persona sin organización: cuenta individual, con el correo confirmado y la sesión abierta.</summary>
    internal static async Task<(HttpClient Cliente, int PersonaId)> PersonaAsync(
        HttpClient cliente, IServiceProvider servicios, string marca)
    {
        var correo = $"{marca}.{Guid.NewGuid():N}"[..30] + "@correo.test";
        var documento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture);

        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = "Marta",
            FirstSurname = "Valderrama",
            DocumentType = "cc",
            DocumentNumber = documento,
            Phone = "3001234567",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();

        int persona;
        using (var alcance = servicios.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var cuenta = await db.Users.SingleAsync(x => x.Email == correo);
            cuenta.CorreoConfirmado = true;
            cuenta.FechaConfirmacionCorreo = DateTime.UtcNow;
            await db.SaveChangesAsync();
            persona = cuenta.Id;
        }

        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave }))
            .EnsureSuccessStatusCode();
        return (cliente, persona);
    }

    /// <summary>Un taller, un espacio o una red; de una organización o de una persona; publicado o no.</summary>
    internal static async Task<int> ProcesoAsync(
        IServiceProvider servicios, string tipo, int? organizacionId, int? personaId, string estado = "publicado", string? nombre = null)
    {
        using var alcance = servicios.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var ahora = DateTime.UtcNow;
        var titulo = nombre ?? $"{tipo} de prueba {Guid.NewGuid():N}"[..28];
        var responsable = organizacionId is null ? personaId : null;

        switch (tipo)
        {
            case "taller":
                var taller = new TallerRow
                {
                    Nombre = titulo, Modalidad = "fijo", NivelCobertura = "nacional", EstadoRegistro = estado,
                    OrganizacionPrincipalId = organizacionId, UsuarioResponsableId = responsable,
                    FechaCreacion = ahora, FechaPublicacion = estado == "publicado" ? ahora : null,
                };
                db.Talleres.Add(taller);
                await db.SaveChangesAsync();
                return taller.Id;
            case "espacio":
                var espacio = new EspacioRow
                {
                    Nombre = titulo, Ambiente = "cerrado", NivelCobertura = "nacional", EstadoRegistro = estado,
                    OrganizacionPrincipalId = organizacionId, UsuarioResponsableId = responsable,
                    FechaCreacion = ahora, FechaPublicacion = estado == "publicado" ? ahora : null,
                };
                db.Espacios.Add(espacio);
                await db.SaveChangesAsync();
                return espacio.Id;
            default:
                var red = new RedRow
                {
                    Nombre = titulo, TipoDeNodo = "red", NivelCobertura = "nacional", EstadoRegistro = estado,
                    OrganizacionPrincipalId = organizacionId, UsuarioResponsableId = responsable,
                    FechaCreacion = ahora, FechaPublicacion = estado == "publicado" ? ahora : null,
                };
                db.Redes.Add(red);
                await db.SaveChangesAsync();
                return red.Id;
        }
    }

    /// <summary>El cuerpo de un evento enmarcado en un proceso de lutería, música en vivo o redes.</summary>
    internal static Dictionary<string, object?> Evento(
        string tipo, int procesoId, string titulo = "Taller de afinación abierto", string descripcion = Descripcion,
        string lugar = "Casa del taller", int dias = 30) => new()
        {
            ["titulo"] = titulo,
            ["descripcion"] = descripcion,
            ["fechaInicio"] = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(dias),
            ["modalidad"] = "presencial",
            ["lugar"] = lugar,
            [tipo + "Id"] = procesoId,
        };

    /// <summary>Envía con el testigo antiforgery de la sesión externa.</summary>
    internal static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) mensaje.Content = JsonContent.Create(cuerpo);
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return await cliente.SendAsync(mensaje);
    }

    /// <summary>Publica un evento contra la base (lo que se mide es lo que pasa después).</summary>
    internal static async Task PublicarAsync(IServiceProvider servicios, string id)
    {
        using var alcance = servicios.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var fila = await db.EventosAgenda.SingleAsync(e => e.Id == long.Parse(id, CultureInfo.InvariantCulture));
        fila.Estado = "publicado";
        await db.SaveChangesAsync();
    }
}
