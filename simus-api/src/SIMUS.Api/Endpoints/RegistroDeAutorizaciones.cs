using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El único sitio por el que se otorga o se retira una autorización de datos.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ ESTO ES UNA PIEZA Y NO CÓDIGO REPETIDO EN CADA PUERTA.</b> Antes había tres formas de
/// guardar lo mismo —el alta de organización, el boletín y un booleano suelto en la ficha de la
/// persona responsable— y las tres guardaban cosas distintas. La que copiaba el texto no guardaba
/// la versión; la que guardaba la versión no copiaba el texto; la tercera no guardaba ninguna de
/// las dos. Con una sola pieza, una puerta nueva no puede inventarse una cuarta manera.
/// </para>
/// <para>
/// <b>LO QUE SIEMPRE HACE, VENGA DE DONDE VENGA.</b> Lee la política vigente de esa finalidad y
/// <b>copia su texto y su versión dentro de la autorización</b>. Sin política vigente no escribe
/// nada y lo dice: una autorización sin texto no prueba nada y es peor que no tenerla, porque
/// aparenta que sí.
/// </para>
/// </remarks>
public static class RegistroDeAutorizaciones
{
    /// <summary>
    /// Otorga una autorización, copiando dentro el texto vigente.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>NO LLAMA A SaveChanges.</b> Quien la usa suele estar dentro de una transacción —el alta de
    /// organización escribe en cinco tablas—, y guardar aquí partiría esa transacción en dos. La
    /// fila queda añadida al contexto y se guarda con el resto.
    /// </para>
    /// <para>
    /// <b>NO COMPRUEBA SI YA HABÍA UNA.</b> Autorizar dos veces la misma finalidad es legítimo
    /// —ocurre cuando cambia el texto y se vuelve a pedir— y cada vez es una fila propia. Quien
    /// necesite saber si está vigente ahora mismo pregunta por la última sin revocar, que es lo que
    /// hace <see cref="EstaVigenteAsync"/>.
    /// </para>
    /// </remarks>
    /// <returns>La fila añadida, o <c>null</c> si no hay política vigente para esa finalidad.</returns>
    public static async Task<AutorizacionDeDatosRow?> OtorgarAsync(
        SimusDbContext dbContext,
        string finalidad,
        string origen,
        DateTime cuando,
        int? idUsuario,
        string? correoTitular,
        string? referenciaId,
        CancellationToken cancellationToken)
    {
        if (idUsuario is null && string.IsNullOrWhiteSpace(correoTitular))
            throw new ArgumentException("Una autorización necesita una cuenta o un correo: sin titular no es de nadie.", nameof(idUsuario));

        var politica = await PoliticaVigenteAsync(dbContext, finalidad, cancellationToken);
        if (politica is null) return null;

        var autorizacion = new AutorizacionDeDatosRow
        {
            Finalidad = finalidad,
            IdPolitica = politica.Id,
            Version = politica.Version,
            TextoAceptado = politica.Texto,
            // Capturada de verdad: es el texto que el servidor acaba de servir a esa pantalla.
            TextoReconstruido = false,
            IdUsuario = idUsuario,
            CorreoTitular = string.IsNullOrWhiteSpace(correoTitular) ? null : correoTitular.Trim(),
            Origen = origen,
            ReferenciaId = referenciaId,
            FechaOtorgada = cuando,
        };

        dbContext.AutorizacionesDeDatos.Add(autorizacion);
        return autorizacion;
    }

    /// <summary>
    /// Retira todas las autorizaciones vigentes de una finalidad para un titular.
    /// </summary>
    /// <remarks>
    /// <b>PONE FECHA, NO BORRA.</b> Borrar la fila dejaría sin respuesta la pregunta «¿esta persona
    /// autorizó alguna vez, y hasta cuándo?», que es justo la que hay que poder contestar años
    /// después. Se marcan TODAS las vigentes y no solo la última: si por lo que sea quedaron dos
    /// abiertas, dejar una viva haría que la pantalla dijera «retirada» y el sistema siguiera
    /// teniendo permiso.
    /// </remarks>
    /// <returns>Cuántas se retiraron.</returns>
    public static async Task<int> RevocarAsync(
        SimusDbContext dbContext,
        string finalidad,
        DateTime cuando,
        string motivo,
        int? idUsuario,
        string? correoTitular,
        CancellationToken cancellationToken)
    {
        var correo = string.IsNullOrWhiteSpace(correoTitular) ? null : correoTitular.Trim();

        var vigentes = await dbContext.AutorizacionesDeDatos
            .Where(item => item.Finalidad == finalidad
                && item.FechaRevocacion == null
                && ((idUsuario != null && item.IdUsuario == idUsuario)
                    || (correo != null && item.CorreoTitular == correo)))
            .ToListAsync(cancellationToken);

        foreach (var autorizacion in vigentes)
        {
            autorizacion.FechaRevocacion = cuando;
            autorizacion.MotivoRevocacion = motivo;
        }

        return vigentes.Count;
    }

    /// <summary>Si esa finalidad está autorizada ahora mismo por ese titular.</summary>
    public static async Task<bool> EstaVigenteAsync(
        SimusDbContext dbContext,
        string finalidad,
        int? idUsuario,
        string? correoTitular,
        CancellationToken cancellationToken)
    {
        var correo = string.IsNullOrWhiteSpace(correoTitular) ? null : correoTitular.Trim();

        return await dbContext.AutorizacionesDeDatos.AsNoTracking()
            .AnyAsync(item => item.Finalidad == finalidad
                && item.FechaRevocacion == null
                && ((idUsuario != null && item.IdUsuario == idUsuario)
                    || (correo != null && item.CorreoTitular == correo)),
                cancellationToken);
    }

    /// <summary>La redacción en uso de una finalidad, o <c>null</c> si no hay ninguna publicada.</summary>
    public static Task<PoliticaDeDatosRow?> PoliticaVigenteAsync(
        SimusDbContext dbContext, string finalidad, CancellationToken cancellationToken) =>
        dbContext.PoliticasDeDatos.AsNoTracking()
            .Where(item => item.Clave == finalidad && item.Vigente)
            .FirstOrDefaultAsync(cancellationToken);

    /// <summary>
    /// Si la persona responsable de cada organización tiene vigente la autorización de tratamiento,
    /// leída de la misma fuente que «Mis autorizaciones».
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>UNA SOLA FUENTE (PUB-09).</b> El alta de una organización desde una cuenta
    /// individual guarda <c>ResponsableAutorizacionDatos = 0</c> porque no presume nada, pero esa
    /// persona ya autorizó el tratamiento al registrarse. «Persona responsable» decía «Sin otorgar»
    /// mientras «Mis autorizaciones» decía «Vigente», sobre la misma persona y el mismo texto.
    /// </para>
    /// <para>
    /// <b>CUANDO LA RESPONSABLE TIENE CUENTA, MANDA EL REGISTRO DE AUTORIZACIONES</b>, que es lo que
    /// ella ve y puede retirar. Solo cuando no tiene cuenta —la declaró la consola en el alta
    /// administrativa— se lee la casilla guardada, porque no hay otro registro de esa persona. El
    /// texto de la autorización no cambia: la dirección lo mantuvo (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1, decisión 12).
    /// </para>
    /// </remarks>
    public static async Task<Dictionary<int, bool>> AutorizacionDeLosResponsablesAsync(
        SimusDbContext dbContext,
        IReadOnlyCollection<EntidadResponsableRow> filas,
        CancellationToken cancellationToken)
    {
        var resultado = new Dictionary<int, bool>();
        if (filas.Count == 0) return resultado;

        var correos = filas
            .Select(fila => SIMUS.Api.Security.CorreoElectronico.Normalizar(fila.ResponsableCorreo))
            .Where(correo => correo is not null)
            .Select(correo => correo!)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var cuentas = correos.Count == 0
            ? []
            : await dbContext.Users.AsNoTracking()
                .Where(usuario => correos.Contains(usuario.Email))
                .Select(usuario => new { usuario.Id, usuario.Email })
                .ToListAsync(cancellationToken);
        var identificadores = cuentas.Select(cuenta => (int?)cuenta.Id).ToList();
        var vigentes = await dbContext.AutorizacionesDeDatos.AsNoTracking()
            .Where(item => item.Finalidad == FinalidadesDeDatos.Tratamiento
                && item.FechaRevocacion == null
                && ((item.IdUsuario != null && identificadores.Contains(item.IdUsuario))
                    || (item.CorreoTitular != null && correos.Contains(item.CorreoTitular))))
            .Select(item => new { item.IdUsuario, item.CorreoTitular })
            .ToListAsync(cancellationToken);

        foreach (var fila in filas)
        {
            var correo = SIMUS.Api.Security.CorreoElectronico.Normalizar(fila.ResponsableCorreo);
            var cuenta = correo is null ? null : cuentas.Find(item => string.Equals(item.Email, correo, StringComparison.OrdinalIgnoreCase));
            resultado[fila.IdEntidad] = cuenta is null
                ? fila.ResponsableAutorizacionDatos
                : vigentes.Exists(item => item.IdUsuario == cuenta.Id
                    || string.Equals(item.CorreoTitular, correo, StringComparison.OrdinalIgnoreCase));
        }

        return resultado;
    }
}
