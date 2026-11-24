using System.Text.Json;
using SIMUS.Api.Endpoints;
using SIMUS.Domain.Entities;

namespace SIMUS.Api.Historial;

/// <summary>De dónde viene un cambio. Es el mismo vocabulario de <c>CK_CambiosDeRegistro_Origen</c>.</summary>
public static class OrigenDelCambio
{
    public const string Directo = "directo";
    public const string Propuesta = "propuesta";
    public const string Importacion = "importacion";
    public const string Fusion = "fusion";
    public const string Sistema = "sistema";
    public const string Migracion = "migracion";

    public static readonly string[] Todos = [Directo, Propuesta, Importacion, Fusion, Sistema, Migracion];
}

/// <summary>
/// La forma única de una línea de la bitácora de auditoría (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.5.4).
/// </summary>
/// <remarks>
/// <para>
/// <b>EL PROBLEMA, MEDIDO.</b> Cada módulo escribía <c>ValoresNuevos</c> a su manera: unos
/// <c>{evento, detalle}</c>, otros <c>{…, "Evento": "…"}</c>, otros ninguno. 26 de 57 filas de la
/// base local no tenían JSON. Nadie podía preguntar a la bitácora de forma uniforme.
/// </para>
/// <para>
/// <b>EL CONTRATO.</b> Las líneas nuevas llevan siempre
/// <c>{ "evento": …, "antes": {…}, "despues": {…}, "motivo": …, "origen": … }</c>. El verbo sigue
/// siendo uno de los admitidos por <c>CK_BitacoraAuditoria_Accion</c> (<see cref="AccionesAuditoria"/>),
/// y el evento es un nombre estable del catálogo (<see cref="EventosDeLaBitacora"/>): <b>un evento
/// que no está en el catálogo no se escribe</b>, falla al construir la línea y una prueba lo vigila.
/// </para>
/// <para>
/// <b>LA BITÁCORA NO ES EL HISTORIAL DEL DATO.</b> Esa tarea es de <c>CambiosDeRegistro</c>. Aquí
/// van los hechos de gestión («actualizó», «consultó»), y por eso <c>antes</c> y <c>despues</c>
/// llevan lo mínimo que explica el hecho —nombres de campo, estados—, <b>nunca valores personales</b>.
/// </para>
/// <para>
/// Las líneas anteriores no se reescriben: <see cref="EventosDeLaBitacora.Etiquetar"/> sigue leyendo
/// las dos formas antiguas.
/// </para>
/// </remarks>
public static class ContratoDeBitacora
{
    private static readonly JsonSerializerOptions Opciones = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>Arma una línea de bitácora con el contrato único. No la guarda: la agrega quien llama.</summary>
    /// <exception cref="ArgumentException">Si el verbo no lo admite la base, el evento no está en el catálogo o el origen no existe.</exception>
    public static AuditLogRow Nueva(
        string verbo,
        string evento,
        int? usuarioId,
        string tabla,
        string registroId,
        object? antes,
        object? despues,
        string? motivo,
        string origen,
        DateTime fecha)
    {
        if (!AccionesAuditoria.EsAdmitido(verbo))
        {
            throw new ArgumentException(
                $"«{verbo}» no es un verbo que admita CK_BitacoraAuditoria_Accion.", nameof(verbo));
        }
        if (!EventosDeLaBitacora.Conoce(evento))
        {
            throw new ArgumentException(
                $"«{evento}» no está en el catálogo de eventos de la bitácora (EventosDeLaBitacora). "
                + "Añádelo allí, con su etiqueta, antes de escribirlo.", nameof(evento));
        }
        if (Array.IndexOf(OrigenDelCambio.Todos, origen) < 0)
        {
            throw new ArgumentException($"«{origen}» no es un origen conocido.", nameof(origen));
        }

        var cuerpo = new Dictionary<string, object?>
        {
            ["evento"] = evento,
            ["antes"] = antes,
            ["despues"] = despues,
            ["motivo"] = string.IsNullOrWhiteSpace(motivo) ? null : motivo.Trim(),
            ["origen"] = origen,
        };

        return new AuditLogRow
        {
            UserId = usuarioId,
            TableName = tabla,
            RecordId = registroId,
            Action = verbo,
            // El contrato describe el hecho, no el valor: `antes` va en su columna, `despues` y el
            // evento en la suya. ValoresNuevos lleva el cuerpo completo, que es de donde lo lee
            // EventosDeLaBitacora.Etiquetar; ValoresAnteriores repite solo `antes` para quien lo
            // consulte por columna.
            PreviousValuesJson = antes is null ? null : JsonSerializer.Serialize(antes, Opciones),
            NewValuesJson = JsonSerializer.Serialize(cuerpo, Opciones),
            CreatedAt = fecha,
        };
    }
}
