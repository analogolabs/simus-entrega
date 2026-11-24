using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SIMUS.Api.ConsultaAbierta;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// EL CALENTAMIENTO DEL MODELO al arrancar la API: en la demo la primera pregunta agotaba los 25 s porque el modelo se cargaba en frío.
/// Sin modelo real: un manejador HTTP falso registra lo que se le pide.
/// </summary>
public sealed class CalentamientoDelModeloTests
{
    private sealed class ManejadorFalso(bool tagsResponde = true) : HttpMessageHandler
    {
        public List<(string Ruta, JsonObject? Cuerpo)> Llamadas { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage solicitud, CancellationToken ct)
        {
            var cuerpo = solicitud.Content is null ? null : JsonNode.Parse(await solicitud.Content.ReadAsStringAsync(ct))?.AsObject();
            Llamadas.Add((solicitud.RequestUri!.AbsolutePath, cuerpo));
            if (solicitud.RequestUri.AbsolutePath.EndsWith("api/tags") && !tagsResponde) return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"message\":{\"content\":\"{}\"}}", Encoding.UTF8, "application/json") };
        }
    }

    private static InterpreteOllama Crear(ManejadorFalso manejador, OpcionesDelModelo opciones) =>
        new(new HttpClient(manejador), Options.Create(opciones));

    [Fact]
    public void Los_valores_por_omision_son_los_de_la_demo_con_espera_de_45_s_y_modelo_cargado_dos_horas()
    {
        var o = new OpcionesDelModelo();
        Assert.Equal(45, o.TimeoutSegundos);
        Assert.Equal("2h", o.MantenerCargado);
        Assert.True(o.Calentar);
    }

    [Fact]
    public async Task Calentar_manda_una_pregunta_minima_con_el_prompt_real_y_el_keep_alive_configurado()
    {
        var manejador = new ManejadorFalso();
        await Crear(manejador, new OpcionesDelModelo { Habilitado = true, MantenerCargado = "3h" }).CalentarAsync(CancellationToken.None);

        var chat = Assert.Single(manejador.Llamadas, l => l.Ruta.EndsWith("api/chat"));
        Assert.Equal("3h", chat.Cuerpo!["keep_alive"]!.GetValue<string>());
        Assert.Equal(8, chat.Cuerpo["options"]!["num_predict"]!.GetValue<int>());
        Assert.Contains("Traduces preguntas", chat.Cuerpo["messages"]![0]!["content"]!.GetValue<string>());
    }

    [Fact]
    public async Task Calentar_sin_modelo_no_lanza_y_se_rinde_al_pasar_la_espera()
    {
        var manejador = new ManejadorFalso(tagsResponde: false);
        await Crear(manejador, new OpcionesDelModelo { Habilitado = true, CalentarEsperaSegundos = 0 }).CalentarAsync(CancellationToken.None);
        Assert.DoesNotContain(manejador.Llamadas, l => l.Ruta.EndsWith("api/chat"));
    }

    [Fact]
    public async Task El_servicio_en_segundo_plano_no_hace_nada_si_la_consulta_abierta_esta_apagada_o_el_calentamiento_desactivado()
    {
        var doble = new InterpreteDoble(_ => throw new InvalidOperationException());
        foreach (var opciones in new[] { new OpcionesDelModelo { Habilitado = false }, new OpcionesDelModelo { Habilitado = true, Calentar = false } })
        {
            var servicio = new ServicioDeCalentamientoDelModelo(doble, Options.Create(opciones), NullLogger<ServicioDeCalentamientoDelModelo>.Instance);
            await servicio.StartAsync(CancellationToken.None);
            await servicio.StopAsync(CancellationToken.None);
        }
        Assert.Equal(0, doble.Llamadas);
    }
}
