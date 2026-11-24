using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El transporte SMTP de verdad (<see cref="TransporteSmtp"/>) contra un servidor SMTP falso que vive en
/// el propio proceso, en el bucle local y en un puerto libre: no hay red ni servidor real. Es lo que
/// ocupa Mailpit en la demo.
/// </summary>
public sealed class TransporteSmtpTests
{
    [Fact]
    public async Task Entrega_remitente_destinatario_asunto_y_cuerpo_al_servidor()
    {
        await using var servidor = new SmtpFalso();
        var transporte = new TransporteSmtp(Opciones(servidor.Puerto));

        await transporte.EnviarAsync(
            new MensajeDeCorreo("lucia@ejemplo.org", "Confirma tu correo", "Abre:\n\nhttp://127.0.0.1:4300/ecosistema/confirmar-correo?testigo=t1"),
            CancellationToken.None);

        var recibido = Assert.Single(servidor.Recibidos);
        Assert.Contains("no-responder@simus.local", recibido.Remitente, StringComparison.Ordinal);
        Assert.Contains("lucia@ejemplo.org", recibido.Destinatarios);
        Assert.Contains("Subject: Confirma tu correo", recibido.Datos, StringComparison.Ordinal);
        Assert.Contains("confirmar-correo?testigo=t1", recibido.Datos, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Con_cuerpo_HTML_envia_multiparte_con_las_imagenes_incrustadas()
    {
        await using var servidor = new SmtpFalso();
        var transporte = new TransporteSmtp(Opciones(servidor.Puerto));
        var html = PlantillaDeCorreoSimus.ConfirmacionDeBoletin("http://127.0.0.1:4300/ecosistema/confirmar-boletin?testigo=t1");

        await transporte.EnviarAsync(new MensajeDeCorreo("lucia@ejemplo.org", "Confirma", "texto plano", html), CancellationToken.None);

        var recibido = Assert.Single(servidor.Recibidos);
        Assert.Contains("multipart/", recibido.Datos, StringComparison.Ordinal);
        Assert.Contains("text/plain", recibido.Datos, StringComparison.Ordinal);
        Assert.Contains("text/html", recibido.Datos, StringComparison.Ordinal);
        Assert.Contains("Content-ID: <logo-simus-", recibido.Datos, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("image/png", recibido.Datos, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Un_correo_del_boletin_con_enlace_https_lleva_List_Unsubscribe_y_un_clic_RFC_8058()
    {
        await using var servidor = new SmtpFalso();
        var transporte = new TransporteSmtp(Opciones(servidor.Puerto));
        const string enlace = "https://simus.gov.co/api/v1/publico/boletin/baja-un-clic?testigo=7.abc";

        await transporte.EnviarAsync(new MensajeDeCorreo("lucia@ejemplo.org", "Boletín", "texto", EnlaceDeBaja: enlace), CancellationToken.None);

        var datos = Assert.Single(servidor.Recibidos).Datos;
        Assert.Contains($"List-Unsubscribe: <{enlace}>", datos, StringComparison.Ordinal);
        Assert.Contains("List-Unsubscribe-Post: List-Unsubscribe=One-Click", datos, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Con_enlace_http_solo_lleva_List_Unsubscribe_porque_el_un_clic_exige_https()
    {
        await using var servidor = new SmtpFalso();
        var transporte = new TransporteSmtp(Opciones(servidor.Puerto));

        await transporte.EnviarAsync(
            new MensajeDeCorreo("lucia@ejemplo.org", "Boletín", "texto", EnlaceDeBaja: "http://127.0.0.1:4300/api/v1/publico/boletin/baja-un-clic?testigo=7.abc"),
            CancellationToken.None);

        var datos = Assert.Single(servidor.Recibidos).Datos;
        Assert.Contains("List-Unsubscribe: <http://127.0.0.1:4300", datos, StringComparison.Ordinal);
        Assert.DoesNotContain("List-Unsubscribe-Post", datos, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Un_correo_que_no_es_del_boletin_no_lleva_cabeceras_de_baja()
    {
        await using var servidor = new SmtpFalso();
        var transporte = new TransporteSmtp(Opciones(servidor.Puerto));

        await transporte.EnviarAsync(new MensajeDeCorreo("lucia@ejemplo.org", "Confirma", "texto"), CancellationToken.None);

        Assert.DoesNotContain("List-Unsubscribe", Assert.Single(servidor.Recibidos).Datos, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Con_el_servidor_caido_el_transporte_lanza_y_el_correo_sigue_pendiente()
    {
        var puertoCerrado = PuertoLibre();
        await using var factory = new TestWebApplicationFactory();
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var fila = new NotificationRow
        {
            RecipientEmail = "diana@ejemplo.org", EventType = "Prueba", Channel = "email",
            Title = "Invitación", Body = "Cuerpo", Status = "pendiente", CreatedAt = DateTime.UtcNow,
        };
        db.Notifications.Add(fila);
        await db.SaveChangesAsync();
        var opciones = Opciones(puertoCerrado);
        var despachador = new DespachadorDeCorreo(db, new TransporteSmtp(opciones), opciones, TimeProvider.System);

        var resultado = await despachador.DespacharLoteAsync(CancellationToken.None);

        Assert.Equal(new ResultadoDeDespacho(0, 1, 0), resultado);
        db.ChangeTracker.Clear();
        var guardada = await db.Notifications.SingleAsync(n => n.Id == fila.Id);
        Assert.Equal("pendiente", guardada.Status);
        Assert.Equal(1, guardada.Attempts);
        Assert.False(string.IsNullOrWhiteSpace(guardada.Error));
    }

    [Fact]
    public async Task Cuando_el_servidor_vuelve_el_mismo_correo_sale_y_queda_enviado()
    {
        var puerto = PuertoLibre();
        await using var factory = new TestWebApplicationFactory();
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var fila = new NotificationRow
        {
            RecipientEmail = "camilo@ejemplo.org", EventType = "Prueba", Channel = "email",
            Title = "Recuperación", Body = "Abre:\n\n/ecosistema/restablecer?testigo=abc", Status = "pendiente", CreatedAt = DateTime.UtcNow,
        };
        db.Notifications.Add(fila);
        await db.SaveChangesAsync();
        var opciones = Opciones(puerto);
        var despachador = new DespachadorDeCorreo(db, new TransporteSmtp(opciones), opciones, TimeProvider.System);

        Assert.Equal(new ResultadoDeDespacho(0, 1, 0), await despachador.DespacharLoteAsync(CancellationToken.None));

        await using var servidor = new SmtpFalso(puerto);
        Assert.Equal(new ResultadoDeDespacho(1, 0, 0), await despachador.DespacharLoteAsync(CancellationToken.None));

        db.ChangeTracker.Clear();
        var enviada = await db.Notifications.SingleAsync(n => n.Id == fila.Id);
        Assert.Equal("enviada", enviada.Status);
        Assert.Null(enviada.Error);
        Assert.Equal(2, enviada.Attempts);
        var recibido = Assert.Single(servidor.Recibidos);
        // El correo viaja en multiparte (texto plano + HTML) y cada parte en base64: se decodifica la
        // primera, la de texto plano, para leer el enlace tal como lo ve quien abre el mensaje.
        var base64 = string.Concat(recibido.Datos.Replace("\r", string.Empty, StringComparison.Ordinal).Split("Content-Transfer-Encoding: base64\n", 2)[1]
            .Split("--", 2)[0].Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries));
        var legible = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(base64));
        Assert.Contains("http://127.0.0.1:4300/ecosistema/restablecer?testigo=abc", legible, StringComparison.Ordinal);
    }

    private static OpcionesDeCorreo Opciones(int puerto) => new()
    {
        Proveedor = OpcionesDeCorreo.ProveedorSmtp,
        UrlPublica = "http://127.0.0.1:4300",
        Remitente = "no-responder@simus.local",
        Smtp = new OpcionesSmtp { Servidor = "127.0.0.1", Puerto = puerto, UsarTls = false },
    };

    private static int PuertoLibre()
    {
        var escucha = new TcpListener(IPAddress.Loopback, 0);
        escucha.Start();
        var puerto = ((IPEndPoint)escucha.LocalEndpoint).Port;
        escucha.Stop();
        return puerto;
    }

    private sealed record CorreoRecibido(string Remitente, List<string> Destinatarios, string Datos);

    /// <summary>Un SMTP mínimo (sin TLS ni autenticación) que guarda lo que recibe.</summary>
    private sealed class SmtpFalso : IAsyncDisposable
    {
        private readonly TcpListener _escucha;
        private readonly CancellationTokenSource _cierre = new();
        private readonly Task _bucle;
        private readonly object _candado = new();
        private readonly List<CorreoRecibido> _recibidos = [];

        public SmtpFalso(int puerto = 0)
        {
            _escucha = new TcpListener(IPAddress.Loopback, puerto);
            _escucha.Start();
            Puerto = ((IPEndPoint)_escucha.LocalEndpoint).Port;
            _bucle = Task.Run(AceptarAsync);
        }

        public int Puerto { get; }

        public IReadOnlyList<CorreoRecibido> Recibidos
        {
            get { lock (_candado) return _recibidos.ToList(); }
        }

        private async Task AceptarAsync()
        {
            try
            {
                while (!_cierre.IsCancellationRequested)
                {
                    var cliente = await _escucha.AcceptTcpClientAsync(_cierre.Token);
                    _ = Task.Run(() => AtenderAsync(cliente));
                }
            }
            catch (Exception) when (_cierre.IsCancellationRequested) { }
            catch (ObjectDisposedException) { }
        }

        private async Task AtenderAsync(TcpClient cliente)
        {
            using var _ = cliente;
            using var flujo = cliente.GetStream();
            using var lector = new StreamReader(flujo, Encoding.UTF8);
            await using var escritor = new StreamWriter(flujo, new UTF8Encoding(false)) { NewLine = "\r\n", AutoFlush = true };
            string remitente = "";
            var destinatarios = new List<string>();
            await escritor.WriteLineAsync("220 simus-falso listo");
            while (await lector.ReadLineAsync(_cierre.Token) is { } linea)
            {
                var orden = linea.ToUpperInvariant();
                if (orden.StartsWith("EHLO", StringComparison.Ordinal) || orden.StartsWith("HELO", StringComparison.Ordinal))
                    await escritor.WriteLineAsync("250 simus-falso");
                else if (orden.StartsWith("MAIL FROM", StringComparison.Ordinal))
                {
                    remitente = linea;
                    await escritor.WriteLineAsync("250 ok");
                }
                else if (orden.StartsWith("RCPT TO", StringComparison.Ordinal))
                {
                    destinatarios.Add(linea[(linea.IndexOf('<') + 1)..linea.IndexOf('>')]);
                    await escritor.WriteLineAsync("250 ok");
                }
                else if (orden == "DATA")
                {
                    await escritor.WriteLineAsync("354 sigue");
                    var datos = new StringBuilder();
                    while (await lector.ReadLineAsync(_cierre.Token) is { } l && l != ".")
                        datos.AppendLine(l);
                    var texto = datos.ToString();
                    lock (_candado) _recibidos.Add(new CorreoRecibido(remitente, [.. destinatarios], DecodificarSiHaceFalta(texto)));
                    await escritor.WriteLineAsync("250 aceptado");
                }
                else if (orden == "QUIT")
                {
                    await escritor.WriteLineAsync("221 adiós");
                    return;
                }
                else
                    await escritor.WriteLineAsync("250 ok");
            }
        }

        /// <summary>El cuerpo en UTF-8 puede viajar en base64: se decodifica para poder buscar en él.</summary>
        private static string DecodificarSiHaceFalta(string texto)
        {
            if (!texto.Contains("Content-Transfer-Encoding: base64", StringComparison.OrdinalIgnoreCase)) return texto;
            var corte = texto.IndexOf("\r\n\r\n", StringComparison.Ordinal);
            if (corte < 0) corte = texto.IndexOf("\n\n", StringComparison.Ordinal);
            if (corte < 0) return texto;
            var cabecera = texto[..corte];
            try
            {
                var cuerpo = Encoding.UTF8.GetString(Convert.FromBase64String(string.Concat(texto[corte..].Where(c => !char.IsWhiteSpace(c)))));
                return cabecera + "\n\n" + cuerpo;
            }
            catch (FormatException) { return texto; }
        }

        public async ValueTask DisposeAsync()
        {
            await _cierre.CancelAsync();
            _escucha.Stop();
            try { await _bucle; } catch (Exception) { }
            _cierre.Dispose();
        }
    }
}
