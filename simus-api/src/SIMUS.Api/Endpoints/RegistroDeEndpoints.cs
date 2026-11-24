using SIMUS.Api.Historial;
using Microsoft.AspNetCore.Routing;

namespace SIMUS.Api.Endpoints;

/** Mantiene el orden explícito de registro de superficies HTTP de SIMUS. */
public static class RegistroDeEndpoints
{
    public static RouteGroupBuilder MapEndpointsDePnmc(this RouteGroupBuilder api)
    {
        api.MapMapEndpoints();
        api.MapBoletinEndpoints();
        api.MapPoliticasDeDatosEndpoints();
        api.MapDivipolaPublicoEndpoints();
        api.MapExternalAuthEndpoints();
        api.MapRecuperacionDeContrasenaEndpoints();
        api.MapExternalOrganizationEndpoints();
        api.MapEquipoDeOrganizacionEndpoints();
        api.MapPerfilPublicoEndpoints();
        api.MapDirectorioDePersonasEndpoints();
        api.MapFestivalesExternosEndpoints();
        api.MapReclamacionesAdministracionEndpoints();
        api.MapEdicionesFestivalExternosEndpoints();
        // El perfil público ya no existe (PR-8 del retiro): las realizaciones se operan como EdicionesFestival.
        // El fichero histórico existe para soportar historial y propuestas, pero sus antiguas rutas
        // externas mezclaban fechas y financiación de una realización con el perfil del Festival.
        // Reponerlas haría funcional un formulario retirado; el ajuste corresponde al frontend,
        // no a publicar otra vez esas cinco rutas.
        api.MapPropuestasDeCambioFestivalExternosEndpoints();
        api.MapRevisionInstitucionalFestivalesEndpoints();
        api.MapRevisionInstitucionalEdicionesFestivalEndpoints();
        api.MapRevisionInstitucionalEventosEndpoints();
        api.MapRevisionDeCamposFestivalEndpoints();
        api.MapRevisionDeCamposEdicionFestivalEndpoints();
        api.MapRevisionInstitucionalPropuestasFestivalEndpoints();
        api.MapFestivalesPublicosEndpoints();
        api.MapTerritoriosSonorosPublicosEndpoints();
        api.MapPracticasMusicalesPublicasEndpoints();
        api.MapAnaliticaFestivalesPublicosEndpoints();
        api.MapAnaliticaEvolucionPublicaEndpoints();
        api.MapAnaliticaRedPublicaEndpoints();
        api.MapNotificationEndpoints();
        api.MapRecordGovernanceEndpoints();
        api.MapAdminAuthEndpoints();
        api.MapPermisosDeModuloEndpoints();
        api.MapAdminDataEndpoints();
        api.MapAnalisisAdministrativoEndpoints();
        api.MapConsultaGuiadaDeOrganizacionEndpoints();
        api.MapConsultaGuiadaPublicaEndpoints();
        api.MapConsultaAbiertaPublicaEndpoints();
        api.MapCatalogoEditorialEndpoints();
        api.MapNoticiasEndpoints();
        api.MapMercadosExternosEndpoints();
        api.MapSedeDeProcesoEndpoints();
        api.MapEdicionesDeMercadoEndpoints();
        api.MapMercadosEndpoints();
        api.MapRevisionDeCamposDeMercadoEndpoints();
        api.MapPropuestasDeCambioDeProcesoEndpoints();
        api.MapTalleresEndpoints();
        api.MapEspaciosEndpoints();
        api.MapAgendamientoDeLaOrganizacionEndpoints();
        api.MapAgendamientoDeLasPersonasEndpoints();
        api.MapSolicitudesDeLaCuentaEndpoints();
        api.MapInvitacionesDeAgendaEndpoints();
        api.MapRedesEndpoints();
        api.MapAgendaEndpoints();
        api.MapBancoDeArchivosEndpoints();
        api.MapCategoriasDeContenidoEndpoints();
        api.MapCatalogosEndpoints();
        api.MapBorradoresDeConsolaEndpoints();
        api.MapAltaAdministrativaEndpoints();
        api.MapFusionDeFestivalesHistoricosEndpoints();
        api.MapProyectosTransversalesEndpoints();
        api.MapCelebraLaMusicaEndpoints();
        api.MapGaleriaEndpoints();
        api.MapTaxonomiaDePerfilesEndpoints();
        api.MapEventosDeOrganizacionEndpoints();
        api.MapEventosQueSeArchivanAlRetirarEndpoints();
        api.MapAsistenciaAOrganizacionEndpoints();
        api.MapConfirmacionDeCorreoEndpoints();
        api.MapCuentaExternaEndpoints();
        api.MapImportacionAsistidaEndpoints();
        api.MapAdminAuditoriaEndpoints();
        api.MapHistorialDeCambiosEndpoints();
        api.MapResueltasDeLaBandejaEndpoints();
        api.MapAdminOrganizacionesEndpoints();
        api.MapContenidoWebEndpoints();
        api.MapEquipoWebEndpoints();
        api.MapImportacionDeContenidoWebEndpoints();
        api.MapImagenesWebEndpoints();
        return api;
    }
}
