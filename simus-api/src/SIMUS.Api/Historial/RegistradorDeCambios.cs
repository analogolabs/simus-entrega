using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Endpoints;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Historial;

/// <summary>Quién y por qué: lo que toda fila del registro de cambios de un guardado comparte.</summary>
/// <param name="ModuloId">Valor de <c>Modulos</c> (festivales, ediciones-festival, organizaciones…).</param>
/// <param name="RegistroId">El identificador del registro, como texto.</param>
/// <param name="OrganizacionId">La organización responsable AHORA; se copia a la fila.</param>
/// <param name="ActorId">La persona que guarda.</param>
/// <param name="ActorRol">«Organización», «Consola»…; texto libre breve.</param>
public sealed record ContextoDeCambio(
    string ModuloId,
    string RegistroId,
    int? OrganizacionId,
    int? ActorId,
    string? ActorRol,
    string Origen = OrigenDelCambio.Directo,
    string? Motivo = null,
    long? PropuestaId = null,
    int? PerfilPublicoFestivalId = null,
    DateTime? Fecha = null,
    Guid? Grupo = null);

/// <summary>Un valor que cambió: qué campo, de qué clase, y de qué a qué.</summary>
/// <param name="Id">Identificador estable del campo.</param>
/// <param name="Etiqueta">El rótulo que se lee en pantalla.</param>
/// <param name="Clase">De qué naturaleza es el dato, y por eso quién puede leer su historia.</param>
/// <param name="Anterior">El valor antes; <c>null</c> si estaba vacío.</param>
/// <param name="Nuevo">El valor después; <c>null</c> si quedó vacío.</param>
/// <param name="Catalogo">Si el valor es un código de catálogo, cuál (para guardar también su nombre).</param>
/// <param name="NombreAnterior">El nombre ya conocido del valor anterior; si falta se resuelve por el catálogo.</param>
/// <param name="NombreNuevo">El nombre ya conocido del valor nuevo; si falta se resuelve por el catálogo.</param>
public sealed record ValorCambiado(
    string Id,
    string Etiqueta,
    ClaseDeDato Clase,
    string? Anterior,
    string? Nuevo,
    CatalogoDeCampo Catalogo = CatalogoDeCampo.Ninguno,
    string? NombreAnterior = null,
    string? NombreNuevo = null);

/// <summary>Los valores de los campos vigilados ANTES de aplicar el cambio.</summary>
public sealed class FotoDeCampos
{
    internal FotoDeCampos(IReadOnlyDictionary<string, string?> valores) => Valores = valores;

    internal IReadOnlyDictionary<string, string?> Valores { get; }
}

/// <summary>
/// El servicio central del registro de cambios por campo (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.5.1).
/// </summary>
/// <remarks>
/// <para>
/// <b>CÓMO SE USA, EN TRES LÍNEAS.</b> Se toma la <see cref="Tomar{T}"/> foto de la fila ANTES de
/// asignarle los valores nuevos; se asignan; y se llama a <see cref="RegistrarAsync{T}"/> antes del
/// <c>SaveChanges</c>. Las filas entran en la misma transacción que el cambio: o se guardan las dos
/// cosas o ninguna. No se guarda nada si no cambió ningún campo.
/// </para>
/// <para>
/// <b>NO ES UN INTERCEPTOR GLOBAL, Y ES DELIBERADO.</b> Cada proceso declara qué campos vigila
/// (<see cref="CampoVigilado{T}"/>). Un interceptor registraría campos que nadie decidió vigilar,
/// datos personales incluidos, y no sabría el motivo ni el origen. Es la misma lógica con la que ya
/// trabaja <c>HistorialDeEstados</c>.
/// </para>
/// <para>
/// <b>QUÉ SE GUARDA DE UN DATO PERSONAL.</b> El valor, como decidió la dirección el 10 de
/// noviembre de 2026; lo que lo protege es quién lo lee (ver <see cref="ClaseDeDato"/>), no que
/// falte. La bitácora, en cambio, solo recibe los <i>nombres</i> de los campos que cambiaron.
/// </para>
/// </remarks>
public static class RegistradorDeCambios
{
    /// <summary>El primer día con registro de cambios campo por campo (la migración V20261110_10).</summary>
    public static readonly DateOnly InicioDelRegistro = new(2026, 11, 10);

    /// <summary>Toma los valores vigilados de <paramref name="registro"/> tal como están ahora.</summary>
    public static FotoDeCampos Tomar<T>(T registro, IReadOnlyList<CampoVigilado<T>> campos)
    {
        ValidarDeclaracion(campos);
        var valores = new Dictionary<string, string?>(campos.Count, StringComparer.Ordinal);
        foreach (var campo in campos)
        {
            valores[campo.Id] = ValorDeHistorial.Texto(campo.Leer(registro));
        }
        return new FotoDeCampos(valores);
    }

    /// <summary>
    /// Compara la foto con el registro ya modificado y agrega a la sesión una fila por cada campo
    /// que cambió, más una línea de bitácora con el contrato único. No llama a <c>SaveChanges</c>.
    /// </summary>
    /// <param name="conBitacora">
    /// Si se escribe la línea de bitácora. <c>false</c> en los endpoints que ya escriben la suya
    /// para el mismo guardado, para no duplicarla.
    /// </param>
    /// <returns>Cuántos campos cambiaron.</returns>
    public static async Task<int> RegistrarAsync<T>(
        SimusDbContext db,
        ContextoDeCambio contexto,
        IReadOnlyList<CampoVigilado<T>> campos,
        FotoDeCampos antes,
        T despues,
        CancellationToken cancellationToken,
        bool conBitacora = true)
    {
        ArgumentNullException.ThrowIfNull(antes);
        if (Array.IndexOf(OrigenDelCambio.Todos, contexto.Origen) < 0)
        {
            throw new ArgumentException($"«{contexto.Origen}» no es un origen conocido.", nameof(contexto));
        }

        var cambiados = new List<ValorCambiado>();
        foreach (var campo in campos)
        {
            antes.Valores.TryGetValue(campo.Id, out var anterior);
            var nuevo = ValorDeHistorial.Texto(campo.Leer(despues));
            if (!string.Equals(anterior, nuevo, StringComparison.Ordinal))
            {
                cambiados.Add(new ValorCambiado(campo.Id, campo.Etiqueta, campo.ClaseDelCambio(anterior, nuevo), anterior, nuevo, campo.Catalogo));
            }
        }

        return await EscribirAsync(db, contexto, cambiados, cancellationToken, conBitacora);
    }

    /// <summary>
    /// Registra valores que no salen de una fila vigilada: una membresía que cambia de rol, una
    /// invitación aceptada. Escribe lo mismo que <see cref="RegistrarAsync{T}"/> (una fila por valor,
    /// el contrato único de bitácora, en la misma transacción); no compara nada: quien llama ya sabe
    /// qué cambió.
    /// </summary>
    /// <returns>Cuántos valores se registraron.</returns>
    public static Task<int> RegistrarValoresAsync(
        SimusDbContext db,
        ContextoDeCambio contexto,
        IReadOnlyList<ValorCambiado> cambios,
        CancellationToken cancellationToken,
        bool conBitacora = true)
    {
        if (Array.IndexOf(OrigenDelCambio.Todos, contexto.Origen) < 0)
        {
            throw new ArgumentException($"«{contexto.Origen}» no es un origen conocido.", nameof(contexto));
        }
        var distintos = cambios
            .Where(x => !string.Equals(x.Anterior, x.Nuevo, StringComparison.Ordinal))
            .ToList();
        return EscribirAsync(db, contexto, distintos, cancellationToken, conBitacora);
    }

    private static async Task<int> EscribirAsync(
        SimusDbContext db,
        ContextoDeCambio contexto,
        List<ValorCambiado> cambiados,
        CancellationToken cancellationToken,
        bool conBitacora)
    {
        if (cambiados.Count == 0) return 0;

        var fecha = contexto.Fecha ?? DateTime.UtcNow;
        var grupo = contexto.Grupo ?? Guid.NewGuid();

        // EL NOMBRE SE COPIA AL ESCRIBIR, como en el historial de estados: si la persona cambia de
        // nombre, lo que se hizo ese día sigue diciendo quién era. Si no se conoce, queda nulo.
        string? actorNombre = null;
        if (contexto.ActorId is int actorId)
        {
            actorNombre = await db.Users.AsNoTracking()
                .Where(x => x.Id == actorId)
                .Select(x => x.FullName)
                .FirstOrDefaultAsync(cancellationToken);
        }

        // EL CÓDIGO ES INTERNO: si el campo guarda un código de catálogo se guarda también el nombre que
        // tiene hoy, y la pantalla lee el nombre. Una consulta por catálogo, no una por campo.
        var nombres = new Dictionary<CatalogoDeCampo, IReadOnlyDictionary<string, string>>();
        foreach (var grupoDeCatalogo in cambiados
            .Where(x => x.Catalogo != CatalogoDeCampo.Ninguno)
            .GroupBy(x => x.Catalogo))
        {
            var codigos = grupoDeCatalogo
                .SelectMany(x => new[] { x.Anterior, x.Nuevo })
                .Where(x => !string.IsNullOrEmpty(x))
                .Select(x => x!)
                .Distinct(StringComparer.Ordinal)
                .ToList();
            nombres[grupoDeCatalogo.Key] = await NombresDeCatalogo.ResolverAsync(
                db, grupoDeCatalogo.Key, codigos, cancellationToken);
        }

        string? NombreDe(CatalogoDeCampo catalogo, string? codigo) =>
            codigo is not null && nombres.TryGetValue(catalogo, out var d) && d.TryGetValue(codigo, out var n)
                ? n
                : null;

        foreach (var cambio in cambiados)
        {
            db.CambiosDeRegistro.Add(new CambioDeRegistroRow
            {
                ModuloId = contexto.ModuloId,
                RegistroId = contexto.RegistroId,
                OrganizacionId = contexto.OrganizacionId,
                IdGrupo = grupo,
                CampoId = cambio.Id,
                CampoEtiqueta = cambio.Etiqueta,
                ClaseDato = cambio.Clase.Codigo(),
                ValorAnterior = cambio.Anterior,
                ValorNuevo = cambio.Nuevo,
                NombreAnterior = cambio.NombreAnterior ?? NombreDe(cambio.Catalogo, cambio.Anterior),
                NombreNuevo = cambio.NombreNuevo ?? NombreDe(cambio.Catalogo, cambio.Nuevo),
                Origen = contexto.Origen,
                PropuestaId = contexto.PropuestaId,
                PerfilPublicoFestivalId = contexto.PerfilPublicoFestivalId,
                ActorId = contexto.ActorId,
                ActorNombre = actorNombre,
                ActorRol = contexto.ActorRol,
                Motivo = string.IsNullOrWhiteSpace(contexto.Motivo) ? null : contexto.Motivo.Trim(),
                Fecha = fecha,
            });
        }

        if (conBitacora)
        {
            // SOLO LOS NOMBRES DE LOS CAMPOS. Los valores viven en CambiosDeRegistro, con su clase
            // de dato: copiarlos aquí los dejaría en una tabla que lee todo el que audita.
            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Actualizar,
                "CambioDeRegistro",
                contexto.ActorId,
                TablaDeBitacora(contexto.ModuloId),
                contexto.RegistroId,
                antes: null,
                despues: new Dictionary<string, object?>
                {
                    ["campos"] = cambiados.Select(x => x.Id).ToArray(),
                    ["grupo"] = grupo,
                },
                contexto.Motivo,
                contexto.Origen,
                fecha));
        }

        return cambiados.Count;
    }

    /// <summary>
    /// Que cada campo declarado tenga un identificador distinto. Es lo que vigila la prueba de
    /// contrato: dos campos con el mismo identificador se pisarían en el historial.
    /// </summary>
    public static void ValidarDeclaracion<T>(IReadOnlyList<CampoVigilado<T>> campos)
    {
        var repetido = campos.GroupBy(x => x.Id, StringComparer.Ordinal).FirstOrDefault(g => g.Count() > 1);
        if (repetido is not null)
        {
            throw new InvalidOperationException($"El campo «{repetido.Key}» está declarado dos veces.");
        }
    }

    /// <summary>La tabla que la bitácora nombra para cada módulo, la misma que ya escriben los endpoints.</summary>
    internal static string TablaDeBitacora(string moduloId) => moduloId switch
    {
        Modulos.EdicionesDeFestival => "EdicionesFestival",
        Modulos.EdicionesDeMercado => "EdicionesMercado",
        Modulos.Festivales => "Festivales",
        Modulos.Mercados => "Mercados",
        Modulos.Talleres => "Talleres",
        Modulos.Espacios => "Espacios",
        Modulos.Redes => "Redes",
        Modulos.Organizaciones => "Entidades",
        Modulos.Noticias => "Noticias",
        Modulos.Agenda => "EventosAgenda",
        Modulos.CatalogoEditorial => "CatalogoEditorial",
        Modulos.Archivos => "Archivos",
        _ => moduloId,
    };
}
