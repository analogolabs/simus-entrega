using System.Security.Cryptography;
using System.Text;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Historial;

/// <summary>
/// La nómina del equipo que se muestra en el sitio, en el registro de cambios (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10).
/// </summary>
/// <remarks>
/// <para>
/// <b>UN INTEGRANTE ES UN CAMPO.</b> Quién entra, quién sale y a quién se le cambia algo (nombre, cargo,
/// grupo, correo o fotografía). Cambiar el ORDEN de la lista no es un cambio de datos y no se registra.
/// </para>
/// <para>
/// <b>LA FOTOGRAFÍA NUNCA SE COPIA AL HISTORIAL.</b> Viaja en base64 y pesaría megabytes por fila. Se guarda
/// una huella corta (los primeros caracteres de su SHA-256): basta para saber que la foto cambió y cuál es
/// cuál, sin volver a guardar la imagen. En el texto que lee la persona, solo «con foto» o «sin foto».
/// </para>
/// <para>
/// <b>ES DATO DE CONTACTO.</b> La fila lleva el nombre de una persona y su correo, así que su historia solo la
/// lee la consola con el módulo de Auditoría, y esa lectura queda en la bitácora. La nómina no tiene organización
/// responsable: no la lee ninguna organización.
/// </para>
/// </remarks>
public static class CambiosDeLaNomina
{
    /// <summary>El registro único de este módulo: la nómina es una sola.</summary>
    public const string RegistroUnico = "nomina";

    public static async Task<int> RegistrarAsync(
        SimusDbContext db,
        ContextoDeCambio contexto,
        IReadOnlyList<MiembroDelEquipoWeb> antes,
        IReadOnlyList<MiembroDelEquipoWeb> despues,
        CancellationToken cancellationToken,
        bool conBitacora = true)
    {
        var previos = antes.GroupBy(x => x.Id, StringComparer.Ordinal).ToDictionary(x => x.Key, x => x.First(), StringComparer.Ordinal);
        var nuevos = despues.GroupBy(x => x.Id, StringComparer.Ordinal).ToDictionary(x => x.Key, x => x.First(), StringComparer.Ordinal);

        var cambios = new List<ValorCambiado>();
        foreach (var id in previos.Keys.Union(nuevos.Keys, StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal))
        {
            previos.TryGetValue(id, out var anterior);
            nuevos.TryGetValue(id, out var nuevo);
            var valorAnterior = Valor(anterior);
            var valorNuevo = Valor(nuevo);
            if (string.Equals(valorAnterior, valorNuevo, StringComparison.Ordinal)) continue;

            cambios.Add(new ValorCambiado(
                $"integrante.{id}",
                $"Integrante: {(nuevo ?? anterior)!.Name}",
                ClaseDeDato.Contacto,
                valorAnterior,
                valorNuevo,
                NombreAnterior: Legible(anterior),
                NombreNuevo: Legible(nuevo)));
        }

        return await RegistradorDeCambios.RegistrarValoresAsync(db, contexto, cambios, cancellationToken, conBitacora);
    }

    /// <summary>Lo que se guarda: todo lo que identifica al integrante salvo la imagen, de la que va una huella.</summary>
    private static string? Valor(MiembroDelEquipoWeb? m) =>
        m is null ? null : $"{m.Name}|{m.Role}|{m.Group}|{m.Email}|foto:{Huella(m.Photo)}";

    /// <summary>Lo que lee la persona.</summary>
    private static string? Legible(MiembroDelEquipoWeb? m)
    {
        if (m is null) return null;
        var correo = string.IsNullOrWhiteSpace(m.Email) ? string.Empty : $", {m.Email}";
        var foto = string.IsNullOrWhiteSpace(m.Photo) ? "sin foto" : "con foto";
        return $"{m.Name}: {m.Role} ({m.Group}){correo}, {foto}";
    }

    private static string Huella(string? foto)
    {
        if (string.IsNullOrWhiteSpace(foto)) return "-";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(foto)))[..8].ToLowerInvariant();
    }
}
