using System.Text.Json;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Qué pasó de verdad en una línea de la bitácora, más allá del verbo técnico.
/// </summary>
/// <remarks>
/// <para>
/// <b>«ACTUALIZO» CINCO VECES NO ES UN HISTORIAL.</b> El 17 de septiembre de 2026, al recorrer el
/// flujo de Mercados, el historial de un mercado en la consola enseñaba cinco líneas idénticas
/// —«Actualizó», «Actualizó», «Actualizó»…— que solo se distinguían por la hora. Quien lo abre
/// quiere saber QUE cambió, y el verbo técnico no lo dice.
/// </para>
/// <para>
/// <b>EL DATO YA ESTABA GUARDADO.</b> <c>CK_BitacoraAuditoria_Accion</c> solo admite trece verbos,
/// así que los circuitos escriben el verbo admitido en <c>Accion</c> y el evento funcional —
/// <c>MercadoPublicado</c>, <c>FestivalPropuestaRechazada</c>— dentro de <c>ValoresNuevos</c>. Esta
/// clase lo saca de ahí y lo nombra; la fila no cambia.
/// </para>
/// <para>
/// <b>SI NO SE RECONOCE, NO SE INVENTA.</b> Un evento sin traducir devuelve <c>null</c> y la línea
/// se queda con su verbo, que es lo que enseñaba hasta hoy. Nunca se enseña el nombre técnico en
/// crudo: «MercadoConAjustesSolicitados» en una pantalla es peor que «Actualizó».
/// </para>
/// </remarks>
public static class EventosDeLaBitacora
{
    private static readonly Dictionary<string, string> EtiquetaPorEvento =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // Mercados
            ["MercadoCreado"] = "Registró el mercado",
            ["MercadoEnviadoARevision"] = "Envió el mercado a revisión",
            ["MercadoPublicado"] = "Publicó el mercado",
            ["MercadoAprobado"] = "Aprobó el mercado",
            ["MercadoArchivado"] = "Archivó el mercado",
            ["MercadoConAjustesSolicitados"] = "Pidió ajustes en el mercado",
            ["MercadoCambioPropuesto"] = "Propuso un cambio",
            ["MercadoPropuestaAplicada"] = "Aplicó la propuesta de cambio",
            ["MercadoPropuestaRechazada"] = "Rechazó la propuesta de cambio",
            ["MercadoPropuestaConAjustes"] = "Pidió ajustes en la propuesta",
            ["EdicionDeMercadoCreada"] = "Registró una edición",
            ["EdicionDeMercadoActualizada"] = "Actualizó una edición",
            ["MercadoDecidido"] = "Tomó una decisión sobre el mercado",

            // Festivales
            ["FestivalCreado"] = "Registró el Festival",
            ["FestivalEnviadoARevision"] = "Envió el Festival a revisión",
            ["FestivalPublicado"] = "Publicó el Festival",
            ["FestivalAprobado"] = "Aprobó el Festival",
            ["FestivalRechazado"] = "Rechazó el Festival",
            ["FestivalRevisionReabierta"] = "Reabrió la revisión del Festival",
            ["FestivalArchivado"] = "Archivó el Festival",
            ["FestivalCambiosPedidosPorCampo"] = "Pidió cambios campo por campo",
            ["FestivalCambioPropuesto"] = "Propuso un cambio",
            ["FestivalCambioPropuestoActualizado"] = "Editó la propuesta de cambio",
            ["FestivalPropuestaEnviadaARevision"] = "Envió la propuesta a revisión",
            ["FestivalPropuestaPublicada"] = "Publicó la propuesta en el perfil público",
            ["FestivalPropuestaRechazada"] = "Rechazó la propuesta de cambio",
            ["FestivalPropuestaAjustesSolicitados"] = "Pidió ajustes en la propuesta",
            ["BorradorInstitucionalFestival"] = "Abrió un borrador institucional",
            ["BorradorInstitucionalActualizado"] = "Editó el borrador institucional",
            ["BorradorInstitucionalEnviadoARevision"] = "Envió el borrador institucional a revisión",

            // El registro de cambios por campo (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md). Los dos nacen con el contrato único
            // de `ContratoDeBitacora`; la bitácora guarda el hecho y `CambiosDeRegistro` los valores.
            ["CambioDeRegistro"] = "Cambió datos del registro",

            // Las propuestas de cambio de lutería, espacios y redes (PROP, decisión 122): la misma vida que la de Mercado.
            ["TallerCambioPropuesto"] = "Propuso un cambio en el taller",
            ["TallerPropuestaAplicada"] = "Aplicó la propuesta de cambio del taller",
            ["TallerPropuestaRechazada"] = "Rechazó la propuesta de cambio del taller",
            ["TallerPropuestaConAjustes"] = "Pidió ajustes en la propuesta del taller",
            ["EspacioCambioPropuesto"] = "Propuso un cambio en el espacio",
            ["EspacioPropuestaAplicada"] = "Aplicó la propuesta de cambio del espacio",
            ["EspacioPropuestaRechazada"] = "Rechazó la propuesta de cambio del espacio",
            ["EspacioPropuestaConAjustes"] = "Pidió ajustes en la propuesta del espacio",
            ["RedCambioPropuesto"] = "Propuso un cambio en la red",
            ["RedPropuestaAplicada"] = "Aplicó la propuesta de cambio de la red",
            ["RedPropuestaRechazada"] = "Rechazó la propuesta de cambio de la red",
            ["RedPropuestaConAjustes"] = "Pidió ajustes en la propuesta de la red",

            // Talleres de lutería
            ["TallerCreado"] = "Registró el taller",
            ["TallerEnviadoARevision"] = "Envió el taller a revisión",
            ["TallerRetiradoDeRevision"] = "Retiró el taller de la revisión",
            ["TallerPublicado"] = "Publicó el taller",
            ["TallerConAjustesSolicitados"] = "Pidió ajustes en el taller",
            ["TallerRechazado"] = "Rechazó el taller",
            ["TallerArchivado"] = "Archivó el taller",
            ["TallerRetirado"] = "Retiró el taller del ecosistema",
            ["TallerVueltoARevision"] = "El taller volvió a revisión por un cambio de fondo",

            // Espacios para música en vivo
            ["EspacioCreado"] = "Registró el espacio",
            ["EspacioEnviadoARevision"] = "Envió el espacio a revisión",
            ["EspacioRetiradoDeRevision"] = "Retiró el espacio de la revisión",
            ["EspacioPublicado"] = "Publicó el espacio",
            ["EspacioConAjustesSolicitados"] = "Pidió ajustes en el espacio",
            ["EspacioRechazado"] = "Rechazó el espacio",
            ["EspacioArchivado"] = "Archivó el espacio",
            ["EspacioRetirado"] = "Retiró el espacio del ecosistema",
            ["EspacioVueltoARevision"] = "El espacio volvió a revisión por un cambio de fondo",
            // Redes y documentación
            ["RedCreada"] = "Registró la red",
            ["RedEnviadaARevision"] = "Envió la red a revisión",
            ["RedRetiradaDeRevision"] = "Retiró la red de la revisión",
            ["RedPublicada"] = "Publicó la red",
            ["RedConAjustesSolicitados"] = "Pidió ajustes en la red",
            ["RedRechazada"] = "Rechazó la red",
            ["RedArchivada"] = "Archivó la red",
            ["RedRetirada"] = "Retiró la red del ecosistema",
            ["RedVueltaARevision"] = "La red volvió a revisión por un cambio de fondo",
            ["ConsultaDeDatosPersonales"] = "Consultó datos personales del historial",


            // D-05. Los eventos funcionales que llegaban a la bitácora SIN nombre y se leían «Actualizó» o «Creó»
            // (p. ej. «Pedir ajustes» sobre un Festival). Cada uno dice quién hizo qué, en verbo y sobre qué.
            // `Los_eventos_que_el_codigo_escribe_estan_en_el_catalogo` impide que vuelva a haber uno sin rótulo.

            // El alta de cuentas y de organizaciones por su propia persona (no pasaban por la bitácora).
            ["CuentaRegistrada"] = "Registró su cuenta",
            ["OrganizacionRegistrada"] = "Registró su organización",
            ["AdministradorInicialAsignado"] = "Quedó como administrador de su organización",
            ["OrganizacionCreadaDesdeConsola"] = "Registró la organización desde la consola",

            // La decisión sobre un Festival y el resto de su circuito
            ["FestivalAjustesSolicitados"] = "Pidió ajustes en el Festival",
            ["FestivalBorradorActualizado"] = "Editó el borrador del Festival",
            ["FestivalContactoPublicoActualizado"] = "Actualizó el contacto público del Festival",
            ["FestivalRetiradoDeRevision"] = "Retiró el Festival de la revisión",
            ["FestivalRetiroAprobado"] = "Aprobó el retiro del Festival",
            ["FestivalCreadoDesdeConsola"] = "Registró el Festival desde la consola",
            ["FestivalPublicadoDesdeConsola"] = "Publicó el Festival al cargarlo desde la consola",
            ["FestivalHistoricoFusionado"] = "Fusionó un Festival histórico con otro",
            ["FestivalHistoricoAbsorbido"] = "Archivó un Festival histórico duplicado al fusionarlo",
            ["ReclamacionTrasladadaPorFusion"] = "Trasladó una solicitud de administración al Festival que se conserva",

            // Las ediciones de un Festival
            ["EdicionPublicada"] = "Publicó una edición",
            ["EdicionPublicadaPorOrganizacion"] = "Publicó una edición",
            ["EdicionDespublicada"] = "Retiró una edición de lo público",
            ["EdicionDespublicadaPorOrganizacion"] = "Retiró una edición de lo público",
            ["EdicionArchivada"] = "Archivó una edición",
            ["EdicionArchivadaPorOrganizacion"] = "Archivó una edición",
            ["EdicionObservada"] = "Pidió ajustes en una edición",
            ["EdicionObservadaPorCampo"] = "Pidió ajustes en una edición, campo por campo",
            ["EdicionCambiosPedidosPorCampo"] = "Pidió ajustes en una edición, campo por campo",
            ["EdicionRechazada"] = "Rechazó una edición",

            // Mercados
            ["MercadoActualizado"] = "Actualizó el mercado",
            ["MercadoContactoPublicoActualizado"] = "Actualizó el contacto público del mercado",
            ["MercadoRetiradoDeRevision"] = "Retiró el mercado de la revisión",
            ["MercadoRechazado"] = "Rechazó el mercado",
            ["decidir"] = "Tomó una decisión",
            ["guardar"] = "Guardó cambios",

            // La solicitud de administración de un proceso histórico
            ["ReclamacionEnviada"] = "Pidió la administración de un proceso",
            ["AclaracionSolicitada"] = "Pidió una aclaración sobre la solicitud de administración",
            ["AclaracionRespondida"] = "Respondió la aclaración de una solicitud de administración",
            ["ReclamacionCancelada"] = "Canceló su solicitud de administración",
            ["ReclamacionRechazada"] = "Rechazó la solicitud de administración",
            ["ReclamacionAprobadaPendienteConciliacion"] = "Aprobó la solicitud de administración",
            ["TransferenciaAdministracionEjecutada"] = "Transfirió la administración del proceso a la organización",
            ["AdministracionLiberadaAlPrograma"] = "Liberó la administración del proceso al PNMC",
            ["ArchivadoAlCerrarLaOrganizacion"] = "Archivó el proceso al cerrar la organización",

            // Los eventos de la agenda que anuncia una organización
            ["EventoAnunciadoPorOrganizacion"] = "Anunció un evento",
            ["EventoAnunciadoPorPersona"] = "Anunció un evento",
            ["EventoEditadoPorOrganizacion"] = "Editó un evento",
            ["EventoEnviadoARevision"] = "Envió un evento a revisión",
            ["EventoCanceladoPorOrganizacion"] = "Canceló un evento",
            ["EventoRetiradoPorOrganizacion"] = "Retiró un evento",
            ["EventoArchivadoConSuProceso"] = "Archivó un evento junto con su proceso",

            // Importación asistida
            ["ImportacionPrevisualizada"] = "Previsualizó una importación",
            ["ImportacionAplicada"] = "Aplicó una importación",
            ["RegistroCreadoPorImportacion"] = "Creó un registro por importación",

            // La cuenta, el equipo y el perfil público
            ["contrasena_cambiada"] = "Cambió su contraseña",
            ["contrasena_restablecida"] = "Restableció su contraseña",
            ["restablecimiento_solicitado"] = "Pidió restablecer su contraseña",
            ["actualizar_perfil"] = "Actualizó su perfil",
            ["ConfirmacionDeCorreo"] = "Confirmó su correo electrónico",
            ["invitacion_creada"] = "Invitó a una persona al equipo",
            ["invitacion_enlace_nuevo"] = "Generó un enlace nuevo de invitación al equipo",
            ["invitacion_revocada"] = "Revocó una invitación al equipo",
            ["invitacion_aceptada"] = "Aceptó la invitación al equipo",
            ["InvitacionAOrganizacion"] = "Invitó a una persona al equipo",
            ["InvitacionALaAgendaDeCitas"] = "Invitó a la agenda de citas",
            ["rol_cambiado"] = "Cambió el rol de una persona del equipo",
            ["perfil_publico_autorizado"] = "Autorizó mostrar su perfil público",
            ["perfil_publico_retirado"] = "Retiró su perfil público",
            ["perfil_publico_restablecido"] = "Restableció su perfil público",
            ["perfil_publico_ocultado_por_moderacion"] = "Ocultó un perfil público por moderación",

            // Herramientas: la agenda de citas de una edición de Mercado (docs/referencia/26-agenda-de-citas-y-mercados.md)
            ["AgendaDeCitasCreada"] = "Creó la agenda de citas",
            ["AgendaDeCitasConfigurada"] = "Cambió la configuración de la agenda de citas",
            ["AgendaDeCitasAbierta"] = "Abrió la inscripción a la agenda de citas",
            ["AgendaDeCitasIniciada"] = "Inició la agenda de citas",
            ["AgendaDeCitasCerrada"] = "Cerró la agenda de citas",
            ["FranjasDeCitasGeneradas"] = "Generó franjas de citas",
            ["FranjaDeCitasRetirada"] = "Retiró una franja de citas",
            ["CompradorInvitadoALaAgenda"] = "Invitó a un comprador a la agenda de citas",
            ["EspacioDeCitasAsignado"] = "Asignó una mesa o espacio",
            ["InscripcionEnAgendaDeCitas"] = "Se inscribió en la agenda de citas",
            ["InscripcionEnListaDeEspera"] = "Quedó en la lista de espera de la agenda de citas",
            ["InscripcionPendienteDeAprobacion"] = "Se inscribió en la agenda de citas y espera la aprobación",
            ["ParticipanteDeCitasAprobado"] = "Aprobó una inscripción a la agenda de citas",
            ["ParticipanteDeCitasEnListaDeEspera"] = "Aprobó una inscripción, pero sin cupo quedó en la lista de espera",
            ["InvitacionDeAgendaEmitida"] = "Emitió la invitación a un comprador de la agenda de citas",
            ["InvitacionDeAgendaAceptada"] = "Aceptó la invitación a la agenda de citas",
            ["InvitacionDeAgendaRevocada"] = "Dejó sin efecto la invitación a la agenda de citas",
            ["ParticipanteDeCitasPromovido"] = "Entró a la agenda desde la lista de espera",
            ["ParticipanteDeCitasRechazado"] = "Rechazó una inscripción a la agenda de citas",
            ["ParticipanteDeCitasRetirado"] = "Retiró a alguien de la agenda de citas",
            ["InscripcionEnAgendaRetirada"] = "Salió de la agenda de citas",
            ["CitaSolicitada"] = "Solicitó una cita",
            ["CitaConfirmada"] = "Confirmó una cita",
            ["CitaRechazada"] = "Rechazó una cita",
            ["CitaCancelada"] = "Canceló una cita",
            ["CitaVencida"] = "La solicitud de cita venció",
            // El Banco de archivos
            ["ArchivoRetirado"] = "Retiró un archivo del Banco",
        };

    /// <summary>
    /// Si el evento está en el catálogo. <see cref="Historial.ContratoDeBitacora"/> no escribe uno que no lo esté.
    /// </summary>
    public static bool Conoce(string? evento) =>
        !string.IsNullOrWhiteSpace(evento) && EtiquetaPorEvento.ContainsKey(evento);

    /// <summary>
    /// Cómo se nombra lo que pasó, leyéndolo de <c>ValoresNuevos</c>.
    /// </summary>
    /// <returns>La etiqueta del evento, o <c>null</c> si la fila no declara uno conocido.</returns>
    public static string? Etiquetar(string? valoresNuevosJson)
    {
        if (string.IsNullOrWhiteSpace(valoresNuevosJson)) return null;

        try
        {
            using var documento = JsonDocument.Parse(valoresNuevosJson);
            if (documento.RootElement.ValueKind != JsonValueKind.Object) return null;

            // LAS DOS FORMAS QUE SE USAN. Mercados escribe `{evento, detalle}` y el circuito de
            // Festival escribe `{…, "Evento": "…"}`: son dos convenciones de mayúscula sobre la
            // misma idea, y aquí se aceptan las dos en vez de obligar a unificarlas en diez sitios.
            foreach (var nombre in (string[])["evento", "Evento"])
            {
                if (documento.RootElement.TryGetProperty(nombre, out var valor)
                    && valor.ValueKind == JsonValueKind.String
                    && valor.GetString() is { Length: > 0 } evento
                    && EtiquetaPorEvento.TryGetValue(evento, out var etiqueta))
                {
                    return etiqueta;
                }
            }
        }
        catch (JsonException)
        {
            // Una fila con un cuerpo que no es JSON no es motivo para no enseñar la línea.
            return null;
        }

        return null;
    }
}
