using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El envío real de correo: configuración, completado de enlaces y vaciado de la cola.
/// </summary>
/// <remarks>
/// Ninguna prueba habla con un servidor SMTP: el transporte se sustituye por uno que anota lo que
/// recibe y puede fallar a voluntad. Lo que se mide es lo que hace SIMUS con la cola.
/// </remarks>
public sealed class EnvioDeCorreoTests
{
    // ---------- Configuración ----------

    [Fact]
    public void Sin_proveedor_es_valido_fuera_de_produccion()
    {
        new OpcionesDeCorreo().Validar(exigirProveedor: false);
    }

    [Fact]
    public void Produccion_sin_proveedor_no_arranca_y_dice_que_hacer()
    {
        var error = Assert.Throws<InvalidOperationException>(() => new OpcionesDeCorreo().Validar(exigirProveedor: true));

        Assert.Contains("Correo:Proveedor", error.Message, StringComparison.Ordinal);
        Assert.Contains("Demo", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Smtp_completo_es_valido_en_produccion()
    {
        OpcionesSmtpValidas().Validar(exigirProveedor: true);
    }

    [Theory]
    [InlineData("Servidor")]
    [InlineData("Remitente")]
    [InlineData("UrlPublica")]
    [InlineData("SoloUsuario")]
    public void Smtp_incompleto_no_arranca(string queFalta)
    {
        var opciones = OpcionesSmtpValidas();
        switch (queFalta)
        {
            case "Servidor": opciones.Smtp.Servidor = ""; break;
            case "Remitente": opciones.Remitente = "no es un correo"; break;
            case "UrlPublica": opciones.UrlPublica = "simus.gov.co"; break;
            case "SoloUsuario": opciones.Smtp.Clave = ""; break;
        }

        var error = Assert.Throws<InvalidOperationException>(() => opciones.Validar(exigirProveedor: false));
        Assert.Contains(queFalta == "SoloUsuario" ? "Usuario" : queFalta, error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Un_proveedor_desconocido_no_arranca()
    {
        var opciones = new OpcionesDeCorreo { Proveedor = "Palomas" };

        Assert.Throws<InvalidOperationException>(() => opciones.Validar(exigirProveedor: false));
    }

    // ---------- Enlaces ----------

    [Fact]
    public void Completa_solo_las_lineas_que_son_una_ruta()
    {
        const string cuerpo = "Hola.\n\nAbre este enlace:\n\n/ecosistema/confirmar-correo?testigo=abc\n\nVence en 3 días / no lo compartas.";

        var resultado = DespachadorDeCorreo.CompletarEnlaces(cuerpo, "https://simus.gov.co/");

        Assert.Contains("\nhttps://simus.gov.co/ecosistema/confirmar-correo?testigo=abc\n", resultado, StringComparison.Ordinal);
        Assert.EndsWith("Vence en 3 días / no lo compartas.", resultado, StringComparison.Ordinal);
    }

    [Fact]
    public void Sin_url_publica_deja_el_cuerpo_igual()
    {
        Assert.Equal("/ruta", DespachadorDeCorreo.CompletarEnlaces("/ruta", null));
    }

    // ---------- Cola ----------

    [Fact]
    public async Task Envia_los_pendientes_de_correo_y_no_toca_los_internos()
    {
        await using var factory = new TestWebApplicationFactory();
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var correo = Encolar(db, "persona@ejemplo.org", "Confirma tu correo", "Abre:\n\n/ecosistema/confirmar-correo?testigo=t1");
        var interna = Encolar(db, "persona@ejemplo.org", "Aviso interno", "Solo campana", canal: "internal");
        await db.SaveChangesAsync();
        var transporte = new TransporteDePrueba();

        var resultado = await Despachador(db, transporte).DespacharLoteAsync(CancellationToken.None);

        Assert.Equal(new ResultadoDeDespacho(1, 0, 0), resultado);
        var mensaje = Assert.Single(transporte.Enviados);
        Assert.Equal("persona@ejemplo.org", mensaje.Destinatario);
        Assert.Contains("https://simus.ejemplo.org/ecosistema/confirmar-correo?testigo=t1", mensaje.Cuerpo, StringComparison.Ordinal);

        db.ChangeTracker.Clear();
        var enviada = await db.Notifications.SingleAsync(n => n.Id == correo.Id);
        Assert.Equal("enviada", enviada.Status);
        Assert.NotNull(enviada.SentAt);
        Assert.Equal(1, enviada.Attempts);
        Assert.Equal("pendiente", (await db.Notifications.SingleAsync(n => n.Id == interna.Id)).Status);
    }

    [Fact]
    public async Task Un_fallo_se_reintenta_y_al_agotar_intentos_queda_fallida()
    {
        await using var factory = new TestWebApplicationFactory();
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var notificacion = Encolar(db, "rebota@ejemplo.org", "Asunto", "Cuerpo");
        await db.SaveChangesAsync();
        var transporte = new TransporteDePrueba { FallarPara = "rebota@ejemplo.org" };
        var despachador = Despachador(db, transporte, maximoIntentos: 2);

        Assert.Equal(new ResultadoDeDespacho(0, 1, 0), await despachador.DespacharLoteAsync(CancellationToken.None));
        Assert.Equal(new ResultadoDeDespacho(0, 0, 1), await despachador.DespacharLoteAsync(CancellationToken.None));
        Assert.Equal(new ResultadoDeDespacho(0, 0, 0), await despachador.DespacharLoteAsync(CancellationToken.None));

        db.ChangeTracker.Clear();
        var fallida = await db.Notifications.SingleAsync(n => n.Id == notificacion.Id);
        Assert.Equal("fallida", fallida.Status);
        Assert.Equal(2, fallida.Attempts);
        Assert.Null(fallida.SentAt);
        Assert.Contains("servidor rechazó", fallida.Error, StringComparison.Ordinal);
    }

    // ---------- Apoyos ----------

    private static OpcionesDeCorreo OpcionesSmtpValidas() => new()
    {
        Proveedor = OpcionesDeCorreo.ProveedorSmtp,
        UrlPublica = "https://simus.ejemplo.org",
        Remitente = "no-responder@ejemplo.org",
        Smtp = new OpcionesSmtp { Servidor = "smtp.ejemplo.org", Usuario = "usuario", Clave = "clave" },
        ClaveDeBaja = "clave-de-prueba-de-baja-de-al-menos-32-caracteres",
    };

    private static DespachadorDeCorreo Despachador(SimusDbContext db, TransporteDePrueba transporte, int maximoIntentos = 5)
    {
        var opciones = OpcionesSmtpValidas();
        opciones.MaximoIntentos = maximoIntentos;
        return new DespachadorDeCorreo(db, transporte, opciones, TimeProvider.System);
    }

    private static NotificationRow Encolar(SimusDbContext db, string destinatario, string asunto, string cuerpo, string canal = "email")
    {
        var fila = new NotificationRow
        {
            RecipientEmail = destinatario,
            EventType = "Prueba",
            Channel = canal,
            Title = asunto,
            Body = cuerpo,
            Status = "pendiente",
            CreatedAt = DateTime.UtcNow,
        };
        db.Notifications.Add(fila);
        return fila;
    }

    private sealed class TransporteDePrueba : ITransporteDeCorreo
    {
        public List<MensajeDeCorreo> Enviados { get; } = [];
        public string? FallarPara { get; init; }

        public Task EnviarAsync(MensajeDeCorreo mensaje, CancellationToken cancellationToken)
        {
            if (mensaje.Destinatario == FallarPara)
                throw new InvalidOperationException("El servidor rechazó el mensaje.");
            Enviados.Add(mensaje);
            return Task.CompletedTask;
        }
    }
}
