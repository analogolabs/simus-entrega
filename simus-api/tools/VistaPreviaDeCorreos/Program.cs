using SIMUS.Infrastructure.Correo;

// VISTA PREVIA DE LOS CORREOS DEL SISTEMA.
// Envía un ejemplo de cada correo, con la plantilla real y el transporte real, a un SMTP DE CAPTURA
// LOCAL (Mailpit). Por seguridad solo acepta destinos de bucle local: nunca sale a Internet.
//   dotnet run --project simus-api/tools/VistaPreviaDeCorreos -- [puerto-smtp] [url-publica]

var puerto = args.Length > 0 && int.TryParse(args[0], out var p) ? p : 1025;
var urlPublica = args.Length > 1 ? args[1] : "http://127.0.0.1:4300";
const string servidor = "127.0.0.1";

var opciones = new OpcionesDeCorreo
{
    Proveedor = OpcionesDeCorreo.ProveedorSmtp,
    UrlPublica = urlPublica,
    Remitente = "no-responder@simus.local",
    Smtp = new OpcionesSmtp { Servidor = servidor, Puerto = puerto, UsarTls = false },
};
var transporte = new TransporteSmtp(opciones);

var ejemplos = new List<(string Etiqueta, string Evento, CorreoRedactado Correo)>
{
    ("invitacion-equipo-editor", "InvitacionDeOrganizacion", CorreosDelSistema.InvitacionAEquipo("Corporación Cantares del Pacífico", "editora o editor", "Ana María Pérez", "/ecosistema/invitacion-organizacion?testigo=ejemplo", 7)),
    ("invitacion-equipo-administrador", "InvitacionDeOrganizacion", CorreosDelSistema.InvitacionAEquipo("Corporación Cantares del Pacífico", "administradora o administrador", "Ana María Pérez", "/ecosistema/invitacion-organizacion?testigo=ejemplo", 7)),
    ("invitacion-agenda-de-citas", "InvitacionDeAgenda", CorreosDelSistema.InvitacionDeAgenda("Circulart", 2026, "Corporación Cantares del Pacífico", "/ecosistema/invitacion-agenda?testigo=ejemplo", 7)),
    ("confirmar-correo", "ConfirmacionDeCorreo", CorreosDelSistema.ConfirmacionDeCorreo("Ana María Pérez", "/ecosistema/confirmar-correo?testigo=ejemplo", 3)),
    ("restablecer-contrasena", "RestablecimientoDeContrasena", CorreosDelSistema.RestablecerContrasena("/ecosistema/restablecer-contrasena?testigo=ejemplo", 30)),
    ("contrasena-cambiada", "ContrasenaRestablecida", CorreosDelSistema.ContrasenaCambiada()),
    ("festival-enviado-a-revision", "FestivalEnviadoARevision", CorreosDelSistema.FestivalEnviadoARevision("Ana María Pérez", "Festival Petronio Álvarez", "Corporación Cantares del Pacífico", "/gestion/o/12/procesos/festivales/45")),
    ("festival-por-validar", "FestivalRecibidoParaRevision", CorreosDelSistema.FestivalPendienteDeRevision("Festival Petronio Álvarez", "Corporación Cantares del Pacífico", "Ana María Pérez", "/administracion/solicitudes/review-festivals-45")),
    ("festival-publicado", "FestivalPublicado", CorreosDelSistema.DecisionDeFestival("Publicado", "Ana María Pérez", "Festival Petronio Álvarez", "Corporación Cantares del Pacífico", null, "/gestion/o/12/procesos/festivales/45")),
    ("festival-ajustes-solicitados", "FestivalAjustesSolicitados", CorreosDelSistema.DecisionDeFestival("AjustesSolicitados", "Ana María Pérez", "Festival Petronio Álvarez", "Corporación Cantares del Pacífico", "Falta indicar el aforo y las fechas de la edición.", "/gestion/o/12/procesos/festivales/45?seccion=informacion&ajustes=1")),
    ("festival-rechazado", "FestivalRechazado", CorreosDelSistema.DecisionDeFestival("Rechazado", "Ana María Pérez", "Festival Petronio Álvarez", "Corporación Cantares del Pacífico", "Ya existe una ficha vigente de este Festival.", "/gestion/o/12/procesos/festivales/45")),
    ("festival-eliminado", "FestivalArchivado", CorreosDelSistema.DecisionDeFestival("Archivado", "Ana María Pérez", "Festival Petronio Álvarez", "Corporación Cantares del Pacífico", "Información duplicada.", "/gestion/o/12/procesos/festivales/45")),
    ("festival-revision-reabierta", "FestivalRevisionReabierta", CorreosDelSistema.DecisionDeFestival("EnRevision", "Ana María Pérez", "Festival Petronio Álvarez", "Corporación Cantares del Pacífico", "Se recibió un documento nuevo.", "/gestion/o/12/procesos/festivales/45")),
    ("boletin-confirmar", PlantillaDeCorreoSimus.TipoConfirmacionDeBoletin, new CorreoRedactado(
        "Confirma tu suscripción al boletín del SIMUS",
        "Hola.\n\nPara activar la suscripción, abre este enlace:\n\n/ecosistema/confirmar-boletin?testigo=ejemplo\n\nEl enlace sirve una sola vez y vence en 3 días.\n\n" + PlantillaDeCorreoSimus.PieDeBajaTexto("/ecosistema/baja-boletin?testigo=7.0123456789abcdef"))),
};

var enviados = 0;
foreach (var (etiqueta, evento, correo) in ejemplos)
{
    var cuerpo = DespachadorDeCorreo.CompletarEnlaces(correo.Cuerpo, urlPublica);
    var asunto = $"[{etiqueta}] {correo.Asunto}";
    await transporte.EnviarAsync(
        new MensajeDeCorreo($"{etiqueta}@ejemplo.simus.local", asunto, cuerpo, PlantillaDeCorreoSimus.HtmlPara(evento, cuerpo, correo.Asunto), PlantillaDeCorreoSimus.EnlaceDeUnClicDeBaja(cuerpo)),
        CancellationToken.None);
    enviados++;
    Console.WriteLine($"  enviado: {etiqueta}");
}
Console.WriteLine($"[simus] {enviados} correos de ejemplo entregados a {servidor}:{puerto} (solo bucle local).");
