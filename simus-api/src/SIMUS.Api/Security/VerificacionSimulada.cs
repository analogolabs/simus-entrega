using Microsoft.AspNetCore.Identity;
using SIMUS.Domain.Entities;

namespace SIMUS.Api.Security;

/// <summary>
/// Gasta el mismo tiempo que una verificación de contraseña real cuando no hay cuenta que verificar (S-16).
/// </summary>
/// <remarks>
/// Sin esto, un ingreso con un correo que no existe (o de una cuenta inactiva) respondía en un instante y uno con una cuenta
/// activa tardaba lo que tarda el hash: la diferencia de tiempo delata qué correos tienen cuenta aunque el cuerpo de la
/// respuesta sea idéntico. El resultado de esta verificación se descarta siempre.
/// </remarks>
public static class VerificacionSimulada
{
    private static readonly PasswordHasher<UserRow> Hasher = new();
    private static readonly UserRow Ficticio = new() { Id = 0, Email = "nadie@pnmc.local" };
    private static readonly Lazy<string> HashFicticio = new(() => Hasher.HashPassword(Ficticio, "contrasena-que-nadie-tiene"));

    public static void Gastar(string? contrasena)
    {
        _ = Hasher.VerifyHashedPassword(Ficticio, HashFicticio.Value, contrasena ?? string.Empty);
    }
}
