using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Quién puede actuar en nombre de una organización del ecosistema.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ ESTO VIVE EN UN SITIO.</b> La misma regla estaba escrita <b>ocho veces</b>, una por
/// endpoint del canal externo, y <b>cinco de las ocho copias se habían quedado atrás</b>: no
/// comprobaban si la organización sigue activa. El resultado medible es que desactivar una
/// organización la bloqueaba a medias —dejaba de poder crear Festivales y Ediciones, pero seguía
/// pudiendo proponer revisiones por campos, escribir versiones, reclamar la administración de otros
/// procesos y anunciar eventos—.
/// </para>
/// <para>
/// <b>ES LA LECCIÓN DEL DESARROLLO DE SEPTIEMBRE, GENERALIZADA.</b> Allí, sobre la baja de una
/// cuenta, quedó escrito que dar de baja tiene que hacer <i>algo</i> que el simple guardado no
/// hace: cortar el acceso vivo. Una baja que solo pone una marca y deja seguir trabajando es una
/// promesa incumplida. Lo mismo vale para una organización.
/// </para>
/// <para>
/// <b>NO HACE FALTA INVALIDAR SESIONES.</b> Este predicado se evalúa <b>en cada petición</b>, así
/// que la primera que llegue después de la baja ya se rechaza. Es una diferencia real con el caso
/// de la cuenta de septiembre, donde el testigo de sesión vivía por su cuenta.
/// </para>
/// <para>
/// <b>CUATRO CONDICIONES, Y LAS CUATRO HACEN FALTA:</b> el vínculo entre la persona y la
/// organización está vigente, el rol es de los que responden por ella, la organización sigue activa
/// y <b>es una organización</b>.
/// </para>
/// <para>
/// <b>LA CUARTA ES HERENCIA DE SEPTIEMBRE.</b> Allí <c>dbo.Entidades</c> era una ficha publicable
/// genérica y su <c>CHECK</c> admitía ocho tipos: un festival, una escuela de música o un lutier
/// eran filas de la misma tabla. Este predicado resolvía por vínculo sin mirar el tipo, de modo que
/// una fila con <c>TipoEntidad = 'festival'</c> se administraba <i>como si fuera</i> una
/// organización. <c>V20260912_03</c> estrechó el <c>CHECK</c> a un solo valor y aquí se comprueba
/// igualmente: la condición explícita es lo que sostiene la regla si la tabla vuelve a abrirse.
/// </para>
/// </remarks>
internal static class AdministracionDeOrganizacion
{
    /// <summary>El único tipo de entidad que existe: el actor que registra y administra procesos.</summary>
    internal const string TipoOrganizacion = "organizacion";

    /// <summary>
    /// Si esta persona puede actuar hoy en nombre de esta organización.
    /// </summary>
    /// <remarks>
    /// SE MIRA LA VIGENCIA DE LA ORGANIZACION Y NO SU ESTADO. El estado dice en qué punto del
    /// circuito está su ficha —archivada, publicada—; la vigencia dice si la organización sigue
    /// existiendo. Una ficha archivada de una organización que opera no puede dejarla fuera.
    /// </remarks>
    /// <summary>
    /// Si alguna cuenta que responde por la organizacion ha confirmado ya su correo.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>QUE PUERTA ES ESTA.</b> No la de entrar —esa es <see cref="PuedeAdministrarAsync"/>—, sino
    /// la de <b>entregarle algo al Programa</b>: enviar un Festival a revision, publicar una
    /// edicion. Quien acaba de registrarse puede entrar, mirar y preparar; lo que no puede es que el
    /// Programa reciba un registro atado a una direccion que nadie ha comprobado, porque una errata
    /// en ese correo deja a la organizacion sin forma de recuperar su cuenta nunca: el correo es
    /// unico, es el de la organizacion, y hasta el restablecimiento de contrasena va ahi.
    /// </para>
    /// <para>
    /// <b>ALGUNA Y NO TODAS.</b> Una organizacion puede tener varias personas administrandola;
    /// exigir que las confirmen todas bloquearia el trabajo por una cuenta secundaria que nadie usa.
    /// Lo que la regla protege es que exista una direccion comprobada a la que poder escribir.
    /// </para>
    /// </remarks>
    internal static Task<bool> TieneCorreoConfirmadoAsync(
        SimusDbContext db, int organizacionId, CancellationToken ct) =>
        db.UserEntities.AsNoTracking()
            .Where(vinculo => vinculo.EntityId == organizacionId
                && vinculo.IsActive
                && RolesDeEntidad.QueResponden.Contains(vinculo.EntityRole))
            .Join(
                db.Users.AsNoTracking().Where(cuenta => cuenta.IsActive && cuenta.CorreoConfirmado),
                vinculo => vinculo.UserId,
                cuenta => cuenta.Id,
                (_, _) => true)
            .AnyAsync(ct);

    /// <summary>
    /// La puerta que pide el correo confirmado antes de actuar en nombre de la organizacion.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>DEVUELVE EL RESULTADO YA HECHO, o <c>null</c> si se puede seguir.</b> Cada ruta que la use
    /// escribe una linea; escribir el 409 en cada sitio es como se llega a que una de ellas explique
    /// el motivo y las otras cinco digan «no tiene permisos», que es justo lo que se define
    /// evitar.
    /// </para>
    /// <para>
    /// <b>EL MENSAJE DICE LAS CUATRO COSAS</b> —que falta, por que, que hacer y que se habilita
    /// despues— y viaja en campos separados para que la pantalla no tenga que trocear una frase.
    /// </para>
    /// <para>
    /// <b>409 Y NO 403.</b> No es una cuestion de permisos: quien pide esto SI administra la
    /// organizacion. Es un requisito del estado del registro, y la diferencia importa porque un 403
    /// invita a pensar que hace falta otro rol.
    /// </para>
    /// </remarks>
    internal static async Task<IResult?> ExigirCorreoConfirmadoAsync(
        SimusDbContext db,
        PoliticaDeConfirmacionDeCorreo politica,
        int organizacionId,
        string loQueSeIntenta,
        CancellationToken ct)
    {
        // La excepción no altera CorreoConfirmado ni el estado de la organización: solo dispensa
        // esta comprobación en un entorno explícitamente permitido por la política de arranque.
        if (!politica.ConfirmacionObligatoria) return null;
        if (await TieneCorreoConfirmadoAsync(db, organizacionId, ct)) return null;

        var correo = await db.UserEntities.AsNoTracking()
            .Where(vinculo => vinculo.EntityId == organizacionId && vinculo.IsActive
                && RolesDeEntidad.QueResponden.Contains(vinculo.EntityRole))
            .Join(db.Users.AsNoTracking().Where(cuenta => cuenta.IsActive), v => v.UserId, u => u.Id, (_, u) => u.Email)
            .FirstOrDefaultAsync(ct);

        return Results.Conflict(new
        {
            motivo = "correo_sin_confirmar",
            queFalta = "Falta confirmar el correo de tu cuenta.",
            porQue = "Es la dirección con la que el PNMC te escribirá y con la que recuperarías tu acceso. "
                + "Una errata ahí dejaría a tu organización sin forma de volver a entrar.",
            queHacer = correo is null
                ? "Abre el enlace que enviamos a tu correo."
                : $"Abre el enlace que enviamos a {correo}. Si esa dirección no es correcta, puedes corregirla desde tu panel.",
            queSeHabilita = $"Al confirmarlo podrás {loQueSeIntenta}.",
            correoDestino = correo,
        });
    }

    internal static Task<bool> PuedeAdministrarAsync(
        SimusDbContext db, int personaId, int organizacionId, CancellationToken ct) =>
        TieneRolAsync(db, personaId, organizacionId, RolesDeEntidad.QueResponden, ct);

    /// <summary>
    /// Si esta persona puede ver la organizacion y preparar sus borradores (administrador o editor).
    /// </summary>
    /// <remarks>
    /// Es la guarda de crear y editar borradores, leer los procesos y atender los ajustes que pide el
    /// Programa (<c>docs/desarrollo/19-cuentas-y-organizaciones.md</c> §19.3). Enviar a revision, retirar, proponer cambios sobre lo
    /// publicado, editar los datos de la organizacion y gestionar el equipo siguen con
    /// <see cref="PuedeAdministrarAsync"/>: un editor que lo intente recibe 403.
    /// </remarks>
    internal static Task<bool> PuedeEditarAsync(
        SimusDbContext db, int personaId, int organizacionId, CancellationToken ct) =>
        TieneRolAsync(db, personaId, organizacionId, RolesDeEntidad.Miembros, ct);

    /// <summary>
    /// Cuantos administradores activos —vinculo vigente y cuenta activa— tiene la organizacion.
    /// </summary>
    internal static Task<int> AdministradoresActivosAsync(
        SimusDbContext db, int organizacionId, CancellationToken ct) =>
        db.UserEntities.AsNoTracking()
            .Where(vinculo => vinculo.EntityId == organizacionId
                && vinculo.IsActive
                && RolesDeEntidad.QueResponden.Contains(vinculo.EntityRole))
            .Join(db.Users.AsNoTracking().Where(cuenta => cuenta.IsActive),
                vinculo => vinculo.UserId, cuenta => cuenta.Id, (vinculo, _) => vinculo.UserId)
            .Distinct()
            .CountAsync(ct);

    /// <summary>
    /// Las organizaciones activas en las que esta persona es la UNICA administradora activa.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>LA REGLA DEL ULTIMO ADMINISTRADOR</b> (<c>docs/desarrollo/19-cuentas-y-organizaciones.md</c> §19.3): ninguna operacion —quitar,
    /// rebajar a editor, salir, desactivar la cuenta— puede dejar una organizacion activa sin
    /// administradores. Es el mismo razonamiento que el candado del ultimo webmaster
    /// (<c>CandadoDelUltimoWebmasterTests</c>): salir de ese estado no esta en el producto, hay que
    /// entrar a la base de datos.
    /// </para>
    /// <para>
    /// Se pregunta por persona y no por operacion: quien llama decide que va a hacer y, si la lista
    /// no esta vacia (o contiene la organizacion que toca), lo rechaza con 409.
    /// </para>
    /// </remarks>
    internal static async Task<List<int>> DondeEsElUltimoAdministradorAsync(
        SimusDbContext db, int personaId, CancellationToken ct)
    {
        var suyas = await db.UserEntities.AsNoTracking()
            .Where(vinculo => vinculo.UserId == personaId
                && vinculo.IsActive
                && RolesDeEntidad.QueResponden.Contains(vinculo.EntityRole))
            .Join(db.EntityProfiles.AsNoTracking()
                    .Where(organizacion => organizacion.IsActive && organizacion.EntityType == TipoOrganizacion),
                vinculo => vinculo.EntityId, organizacion => organizacion.Id, (vinculo, _) => vinculo.EntityId)
            .Distinct()
            .ToListAsync(ct);

        var resultado = new List<int>();
        foreach (var organizacionId in suyas)
        {
            var otros = await db.UserEntities.AsNoTracking()
                .Where(vinculo => vinculo.EntityId == organizacionId
                    && vinculo.UserId != personaId
                    && vinculo.IsActive
                    && RolesDeEntidad.QueResponden.Contains(vinculo.EntityRole))
                .Join(db.Users.AsNoTracking().Where(cuenta => cuenta.IsActive),
                    vinculo => vinculo.UserId, cuenta => cuenta.Id, (vinculo, _) => vinculo.Id)
                .AnyAsync(ct);
            if (!otros) resultado.Add(organizacionId);
        }

        return resultado;
    }

    /// <summary>El 409 que explica la regla del ultimo administrador, igual en todas las rutas.</summary>
    internal static IResult ConflictoDelUltimoAdministrador() =>
        Results.Conflict(new
        {
            motivo = "ultimo_administrador",
            queFalta = "La organización se quedaría sin administradores.",
            queHacer = "Nombra antes a otra persona como administradora.",
        });

    private static Task<bool> TieneRolAsync(
        SimusDbContext db, int personaId, int organizacionId, string[] roles, CancellationToken ct) =>
        db.UserEntities.AsNoTracking()
            .Where(vinculo => vinculo.UserId == personaId
                && vinculo.EntityId == organizacionId
                && vinculo.IsActive
                && roles.Contains(vinculo.EntityRole))
            .Join(
                db.EntityProfiles.AsNoTracking()
                    .Where(organizacion => organizacion.IsActive && organizacion.EntityType == TipoOrganizacion),
                vinculo => vinculo.EntityId,
                organizacion => organizacion.Id,
                (_, _) => true)
            .AnyAsync(ct);
}
