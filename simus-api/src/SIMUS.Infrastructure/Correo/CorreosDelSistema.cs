namespace SIMUS.Infrastructure.Correo;

/// <summary>El portafolio de una persona de la agenda de citas, tal como llega en el correo de una cita.</summary>
public sealed record PortafolioDeCorreo(string Nombre, string? Entidad, string? Presentacion, string? Enlaces);

/// <summary>Un correo ya redactado: asunto y cuerpo (el texto de la cola, que es también el texto plano).</summary>
public sealed record CorreoRedactado(string Asunto, string Cuerpo);

/// <summary>
/// La redacción de TODOS los correos que SIMUS envía, en un solo lugar.
/// </summary>
/// <remarks>
/// <para>
/// <b>UN CATALOGO, NO UN TEXTO POR ENDPOINT.</b> Antes cada endpoint armaba su mensaje con cadenas
/// sueltas y varios llegaban sin decir quién actuaba ni sobre qué entidad («Te invitan a unirte a X»,
/// sin la persona). Aquí cada correo declara su asunto, a quién se refiere, qué se espera de quien lo
/// lee, su botón principal y su vigencia, y se pinta con <see cref="PlantillaDeCorreoSimus"/>.
/// </para>
/// <para>
/// <b>SIN EL NOMBRE DE LA CUENTA EN LOS AVISOS DE SEGURIDAD.</b> El correo de restablecer contraseña y
/// el de «cambiaron tu contraseña» no llevan nombre: quien registra una cuenta con un correo ajeno
/// escribe el nombre que quiera, y sería texto de suplantación dentro de un correo legítimo.
/// </para>
/// </remarks>
public static class CorreosDelSistema
{
    public const string Institucion = "Sistema de Información de la Música (SIMUS)";

    private static string Dias(int dias) => dias == 1 ? "1 día" : $"{dias} días";

    private static CorreoRedactado Armar(string asunto, ContenidoDeCorreo contenido) => new(asunto, contenido.ATextoPlano());

    private static string Vence(int dias) => $"El enlace sirve una sola vez y vence en {Dias(dias)}.";

    /// <summary>Invitar a una persona al equipo de una organización como editora o administradora.</summary>
    public static CorreoRedactado InvitacionAEquipo(
        string organizacion, string rol, string? invitadoPor, string enlace, int vigenciaDias)
    {
        var quien = string.IsNullOrWhiteSpace(invitadoPor) ? "Una persona del equipo" : invitadoPor.Trim();
        return Armar($"{quien} te invita a {organizacion} en SIMUS",
            ContenidoDeCorreo.Nuevo($"Te invitan a unirte a {organizacion}")
                .ConSaludo(null)
                .ConParrafo($"{quien} te invita a formar parte del equipo de la organización {organizacion} en el {Institucion}.")
                .ConDatos(("Te invita", quien), ("Organización", organizacion), ("Tu rol", rol))
                .ConParrafo("Para aceptar, entra con la cuenta de este mismo correo o créala con él si todavía no la tienes.")
                .ConBoton("Aceptar la invitación", enlace)
                .ConParrafo($"{Vence(vigenciaDias)} Si no esperabas esta invitación, puedes ignorarla: no pasará nada."));
    }

    /// <summary>Invitar a un comprador o booker sin cuenta a la agenda de citas de un mercado.</summary>
    public static CorreoRedactado InvitacionDeAgenda(
        string mercado, int anio, string? invitadoPor, string enlace, int vigenciaDias)
    {
        var quien = string.IsNullOrWhiteSpace(invitadoPor) ? "La organización del mercado" : invitadoPor.Trim();
        return Armar($"{quien} te invita a la agenda de citas de {mercado} en SIMUS",
            ContenidoDeCorreo.Nuevo($"Te invitan a la agenda de citas de {mercado}")
                .ConSaludo(null)
                .ConParrafo($"{quien} te invita a la agenda de citas de {mercado} ({anio}) en el {Institucion}, como comprador o booker.")
                .ConDatos(("Te invita", quien), ("Mercado", $"{mercado} ({anio})"), ("Tu rol", "Comprador o booker"))
                .ConParrafo("Al aceptar verás a los artistas inscritos y podrás gestionar tus citas. Entra con la cuenta de este mismo correo, o créala con él si todavía no la tienes.")
                .ConBoton("Aceptar la invitación", enlace)
                .ConParrafo($"{Vence(vigenciaDias)} Si no esperabas esta invitación, puedes ignorarla."));
    }

    /// <summary>
    /// Un paso de la agenda de citas que le toca a una persona: su inscripción (recibida, pendiente, aprobada,
    /// en lista de espera, rechazada), una cita (pedida, confirmada, rechazada, cancelada) o su salida. Lo reciben
    /// por igual los artistas y los compradores o bookers: el texto de <paramref name="detalle"/> ya dice quién
    /// actúa; aquí se añade la agenda a la que se refiere, qué se espera de quien lee y el botón.
    /// </summary>
    /// <param name="evento">El tipo del aviso (<c>CitaSolicitada</c>, <c>InscripcionEnListaDeEspera</c>…).</param>
    /// <param name="titulo">El título del aviso dentro de SIMUS, que es también el asunto.</param>
    /// <param name="detalle">El cuerpo del aviso, con quién actúa y sobre qué mercado.</param>
    /// <param name="agenda">El nombre de la agenda con su subtítulo.</param>
    /// <param name="enlace">A dónde lleva el botón: «Mi agenda de citas».</param>
    public static CorreoRedactado AvisoDeAgendaDeCitas(
        string evento, string titulo, string detalle, string? agenda, string enlace, PortafolioDeCorreo? portafolio = null)
    {
        var (esperado, boton) = evento switch
        {
            "CitaSolicitada" => ("Se espera que respondas la solicitud antes de que venza: si no, la franja se libera.", "Responder la solicitud"),
            "CitaPedida" => ("Te avisaremos cuando respondan. Puedes retirar la solicitud mientras siga pendiente.", "Ver mis solicitudes"),
            "CitaConfirmada" => ("Ya puedes ver el contacto de la otra persona en tu agenda. La cita queda en tu calendario.", "Ver mi cita"),
            "CitaRechazada" => ("Puedes pedir otra franja o a otra persona mientras la agenda siga abierta.", "Pedir otra cita"),
            "CitaCancelada" => ("La franja quedó libre. Puedes pedir otra cita mientras la agenda siga abierta.", "Ver mi agenda"),
            "InscripcionEnAgendaConfirmada" or "InscripcionEnAgendaDeCitas" => ("Ya puedes pedir o recibir citas. Inscribirte no garantiza una cita: depende de quien confirme.", "Abrir mi agenda de citas"),
            "InscripcionPendienteDeAprobacion" => ("No tienes que hacer nada: te escribiremos cuando la organización decida.", "Ver mi inscripción"),
            "InscripcionEnListaDeEspera" => ("Entrarás por orden de ingreso si se libera un lugar.", "Ver mi lugar en la lista"),
            "InscripcionEnAgendaRechazada" => ("Si crees que es un error, escríbele a la organización del mercado.", "Ver mi agenda de citas"),
            "RetiradoDeLaAgendaDeCitas" => ("Tus citas vivas en esta agenda se cancelaron.", "Ver mi agenda de citas"),
            "InvitacionALaAgendaDeCitas" => ("Entra para ver a los artistas inscritos y gestionar tus citas.", "Abrir mi agenda de citas"),
            _ => (null, "Abrir mi agenda de citas"),
        };
        var contenido = ContenidoDeCorreo.Nuevo(titulo)
            .ConSaludo(null)
            .ConParrafo(detalle)
            .ConDatos(("Agenda de citas", agenda));
        // EL PORTAFOLIO VIAJA CON LA CITA: quien recibe una solicitud (o la confirmación) ve a quién tiene enfrente sin buscarlo.
        if (portafolio is not null)
        {
            contenido = contenido.ConDatos(("Portafolio de", portafolio.Nombre), ("Agrupación o empresa", portafolio.Entidad),
                ("Presentación", portafolio.Presentacion), ("Enlaces", portafolio.Enlaces));
        }
        if (esperado is not null) contenido = contenido.ConParrafo(esperado);
        return Armar($"SIMUS · {titulo}", contenido.ConBoton(boton, enlace));
    }

    /// <summary>Comprobar que el correo de una cuenta nueva es de quien se registró.</summary>
    public static CorreoRedactado ConfirmacionDeCorreo(string? nombre, string enlace, int vigenciaDias) =>
        Armar("Confirma tu correo en SIMUS",
            ContenidoDeCorreo.Nuevo("Confirma tu correo para activar tu cuenta")
                .ConSaludo(nombre)
                .ConParrafo($"Para terminar de activar tu cuenta en el {Institucion} necesitamos comprobar que este correo es tuyo.")
                .ConBoton("Confirmar mi correo", enlace)
                .ConParrafo($"El enlace vence en {Dias(vigenciaDias)}. Si no lo pediste tú, puedes ignorar este mensaje."));

    /// <summary>El enlace para elegir una contraseña nueva. Sin nombre de cuenta, a propósito.</summary>
    public static CorreoRedactado RestablecerContrasena(string enlace, int vigenciaMinutos) =>
        Armar("Restablece tu contraseña de SIMUS",
            ContenidoDeCorreo.Nuevo("Restablece tu contraseña")
                .ConSaludo(null)
                .ConParrafo($"Recibimos una solicitud para restablecer la contraseña de tu cuenta en el {Institucion}. Usa el botón para elegir una nueva.")
                .ConBoton("Elegir una contraseña nueva", enlace)
                .ConParrafo($"El enlace sirve una sola vez y vence en {vigenciaMinutos} minutos. Si no lo pediste tú, ignora este mensaje: tu contraseña no cambia mientras no abras el enlace."));

    /// <summary>Aviso de que la contraseña cambió con un enlace de recuperación.</summary>
    public static CorreoRedactado ContrasenaCambiada() =>
        Armar("Cambiaron la contraseña de tu cuenta de SIMUS",
            ContenidoDeCorreo.Nuevo("Cambió la contraseña de tu cuenta")
                .ConSaludo(null)
                .ConParrafo($"La contraseña de tu cuenta en el {Institucion} se restableció con un enlace de recuperación y se cerraron las demás sesiones.")
                .ConParrafo("Si fuiste tú, no tienes que hacer nada. Si no fuiste tú, pide otro enlace desde «¿Olvidaste tu contraseña?» y escríbele al equipo del PNMC."));

    /// <summary>A quien envió un Festival a revisión: confirmación de recibido.</summary>
    public static CorreoRedactado FestivalEnviadoARevision(
        string? nombre, string festival, string? organizacion, string enlace) =>
        Armar($"SIMUS · Nueva solicitud · {festival}",
            ContenidoDeCorreo.Nuevo("Recibimos tu solicitud de registro")
                .ConSaludo(nombre)
                .ConParrafo($"Le informamos que su solicitud de registro del Festival «{festival}» ha sido enviada correctamente.")
                .ConDatos(("Proceso", $"Festival «{festival}»"), ("Organización", organizacion), ("Estado", "En revisión"))
                .ConParrafo("Una vez sea gestionada, recibirá una notificación para consultar la respuesta emitida por el Ministerio de las Culturas, las Artes y los Saberes.")
                .ConBoton("Ver el estado de mi solicitud", enlace));

    /// <summary>Al equipo del PNMC: hay un Festival esperando revisión.</summary>
    public static CorreoRedactado FestivalPendienteDeRevision(
        string festival, string? organizacion, string? enviadoPor, string enlace) =>
        Armar($"SIMUS · Nueva solicitud · {festival}",
            ContenidoDeCorreo.Nuevo("Tienes una solicitud por validar")
                .ConSaludo(null)
                .ConParrafo("Le informamos que se le ha asignado una solicitud de preregistro para su respectiva validación.")
                .ConDatos(("Proceso", $"Festival «{festival}»"), ("Organización", organizacion), ("Enviada por", enviadoPor))
                .ConParrafo("Se espera que revise la solicitud y decida: publicarla, pedir ajustes o rechazarla con su motivo.")
                .ConBoton("Abrir la solicitud para validarla", enlace));

    /// <summary>La decisión sobre un Festival (publicado, ajustes, rechazado, eliminado, revisión reabierta).</summary>
    /// <param name="estado">El estado nuevo: Publicado, AjustesSolicitados, Rechazado, Archivado, EnRevision u otro.</param>
    /// <param name="detalle">La observación o el motivo escritos por el equipo del PNMC, si los hay.</param>
    public static CorreoRedactado DecisionDeFestival(
        string estado, string? nombre, string festival, string? organizacion, string? detalle, string enlace)
    {
        var (titulo, resumen, etiquetaDeDetalle, accion, esperado) = estado switch
        {
            "AjustesSolicitados" => ("Se solicitaron ajustes a tu Festival",
                "El equipo del PNMC solicitó ajustes a tu Festival.", "Observación", "Revisar los ajustes y reenviar",
                "Se espera que hagas los ajustes y vuelvas a enviar el Festival a revisión."),
            "Rechazado" => ("Tu Festival fue rechazado",
                "El equipo del PNMC rechazó tu Festival.", "Motivo", "Ver el detalle",
                "Puedes consultar el motivo y, si corresponde, registrar una nueva solicitud."),
            "Publicado" => ("Tu Festival fue publicado",
                "Tu Festival fue publicado en el ecosistema musical del PNMC.", null, "Ver mi Festival",
                "No tienes que hacer nada más: ya aparece en el ecosistema."),
            "Archivado" => ("Tu Festival fue eliminado del ecosistema",
                "El equipo del PNMC eliminó tu Festival del ecosistema musical.", "Motivo", "Ver el detalle",
                "Si no estás de acuerdo, escríbele al equipo del PNMC."),
            "EnRevision" => ("Se reabrió la revisión de tu Festival",
                "El equipo del PNMC reabrió la revisión de tu Festival.", "Motivo", "Ver el estado",
                "Te avisaremos cuando se decida."),
            _ => ("Tu Festival cambió de estado", "Tu Festival cambió de estado.", null, "Ver mi Festival", string.Empty),
        };
        return Armar($"SIMUS · {titulo} · {festival}",
            ContenidoDeCorreo.Nuevo(titulo)
                .ConSaludo(nombre)
                .ConParrafo(resumen)
                .ConDatos(("Proceso", $"Festival «{festival}»"), ("Organización", organizacion), (etiquetaDeDetalle ?? "Detalle", etiquetaDeDetalle is null ? null : detalle))
                .ConParrafo(esperado)
                .ConBoton(accion, enlace));
    }
}
