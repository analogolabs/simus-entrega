using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Historial;

/// <summary>
/// Quién entra, quién sale y quién cambia de rol en una organización, en el registro de cambios
/// (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10).
/// </summary>
/// <remarks>
/// <para>
/// <b>UN CAMPO POR PERSONA:</b> <c>miembro.{usuarioId}</c>, con el rol como valor. «Entró» es un rol
/// donde antes no había nada; «salió» es un rol que pasa a vacío; «cambió de rol» es de uno a otro.
/// El historial de la organización lee así «Rol de Ana Gómez: editor → administrador» sin que el
/// registro de cambios tenga que conocer la tabla de membresías.
/// </para>
/// <para>
/// <b>CLASE «CONTACTO» (decisión 96, 19 de noviembre de 2026).</b> La etiqueta lleva el nombre de una
/// persona, y el nombre de una persona es un dato personal: este historial lo lee únicamente la consola
/// con el módulo de Auditoría. El equipo actual de la organización lo sigue viendo en la pantalla del
/// Equipo, que es otra cosa. El nombre se copia al escribir (como el del autor), así que si cambia de
/// nombre, lo que pasó ese día sigue diciendo quién era.
/// </para>
/// </remarks>
public static class CambiosDeMembresia
{
    /// <summary>
    /// Agrega a la sesión la fila de registro de cambios de una membresía. No llama a
    /// <c>SaveChanges</c>: va en la misma transacción que el cambio de la membresía.
    /// </summary>
    /// <param name="rolAnterior">El rol que tenía; <c>null</c> si la persona entra ahora.</param>
    /// <param name="rolNuevo">El rol que tiene; <c>null</c> si la persona sale.</param>
    public static async Task RegistrarAsync(
        SimusDbContext db,
        int organizacionId,
        int? actorId,
        int usuarioId,
        string? rolAnterior,
        string? rolNuevo,
        CancellationToken cancellationToken)
    {
        var nombre = await db.Users.AsNoTracking()
            .Where(x => x.Id == usuarioId)
            .Select(x => x.FullName)
            .FirstOrDefaultAsync(cancellationToken);

        await RegistradorDeCambios.RegistrarValoresAsync(
            db,
            new ContextoDeCambio(
                Modulos.Organizaciones,
                organizacionId.ToString(CultureInfo.InvariantCulture),
                organizacionId,
                actorId,
                "Organización"),
            [
                new ValorCambiado(
                    $"miembro.{usuarioId.ToString(CultureInfo.InvariantCulture)}",
                    string.IsNullOrWhiteSpace(nombre) ? "Rol de una persona del equipo" : $"Rol de {nombre.Trim()}",
                    ClaseDeDato.Contacto,
                    rolAnterior,
                    rolNuevo),
            ],
            cancellationToken,
            conBitacora: false);
    }
}
