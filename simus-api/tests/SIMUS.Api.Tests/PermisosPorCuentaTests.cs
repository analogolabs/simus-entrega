using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Los permisos de la consola se conceden por cuenta, y el servidor los aplica.
/// </summary>
/// <remarks>
/// <para>
/// <b>LO QUE ESTAS PRUEBAS EXISTEN PARA IMPEDIR.</b> Que recortar el menú se confunda con conceder
/// un permiso. Una barra izquierda sin «Catálogo Editorial» no impide nada: la ruta sigue
/// respondiendo a quien la escriba a mano o tenga el enlace guardado. Aquí no se mira ninguna
/// pantalla; se piden las rutas con una cuenta que NO es webmaster y se comprueba qué contesta el
/// servidor.
/// </para>
/// <para>
/// <b>POR QUE NO VALE PROBARLO CON EL WEBMASTER.</b> El webmaster tiene todos los módulos siempre
/// —si no, la última cuenta que pudiera administrar usuarios podría dejar al Programa sin forma de
/// conceder permisos a nadie—, así que con él todo responde 200 y la prueba no probaría nada. Todas
/// las de aquí crean una cuenta de gestor y entran con ella.
/// </para>
/// </remarks>
public sealed class PermisosPorCuentaTests
{
    private const string Clave = "ClaveDePrueba123";

    /// <summary>La que la propia persona elige en su primer ingreso, distinta de la entregada.</summary>
    private const string ClaveDefinitiva = "ClaveElegida456";

    // Una cédula distinta por cuenta, y sin azar: el analizador rechaza `Random` y una cifra fija
    // chocaría en cuanto dos pruebas de la misma clase creasen su gestor a la vez.
    private static int _contadorDeIdentificaciones;

    private static string ProximaIdentificacion() =>
        (1_000_000 + Interlocked.Increment(ref _contadorDeIdentificaciones))
            .ToString(System.Globalization.CultureInfo.InvariantCulture);

    // Los conjuntos que se mandan una y otra vez, declarados una sola vez: el analizador pide no
    // construir la misma matriz en cada llamada.
    private static readonly string[] SoloAgenda = ["agenda"];
    private static readonly string[] SoloCatalogo = ["catalogo-editorial"];
    private static readonly string[] AgendaYUnoInventado = ["agenda", "calendario"];
    private static readonly string[] Ninguno = [];
    private static readonly string[] AgendaUsuariosYSistema = ["agenda", "usuarios", "sistema"];

    /// <summary>Crea una cuenta de gestor interno y devuelve su identificador y su sesión.</summary>
    internal static async Task<(int Id, HttpClient Sesion, string Correo)> GestorAsync(TestWebApplicationFactory factory)
    {
        var webmaster = await CmsTestClient.LoginAsync(factory);
        var correo = $"gestor.{Guid.NewGuid():N}@pnmc.local";

        var alta = await webmaster.PostAsJsonAsync("/api/v1/admin/auth/users", new AdminUserUpsertRequest
        {
            FullName = "Gestor de prueba",
            Email = correo,
            Roles = ["gestor_interno"],
            Password = Clave,
            IsActive = true,
        });
        alta.EnsureSuccessStatusCode();

        // EL ALTA DEVUELVE `{ user: { id: "12", ... } }` Y EL ID VIAJA COMO TEXTO. Leerlo como
        // número daba cero en silencio, y con cero todas las rutas de módulos respondían 404.
        var creada = await alta.Content.ReadFromJsonAsync<JsonElement>();
        var id = int.Parse(
            creada.GetProperty("user").GetProperty("id").GetString()!,
            System.Globalization.CultureInfo.InvariantCulture);

        var sesion = await CmsTestClient.LoginAsync(factory, correo, Clave);

        // SE LA ENTREGA TERMINADA, COMO EN LA REALIDAD. Una cuenta administrativa se crea con
        // correo y contraseña por omisión, y su primer ingreso la obliga a cambiarla y a decir
        // quién es antes de abrir nada; mientras eso falta, el servidor contesta 403 a todas las
        // rutas de módulo. Sin recorrerlo aquí, estas pruebas medirían el primer ingreso y no los
        // permisos, que es lo que vinieron a comprobar.
        var cambio = await sesion.PostAsJsonAsync("/api/v1/admin/auth/mi-contrasena",
            new CambioDeContrasenaPropia { Actual = Clave, Nueva = ClaveDefinitiva });
        cambio.EnsureSuccessStatusCode();

        var perfil = await sesion.PostAsJsonAsync("/api/v1/admin/auth/mi-perfil", new PerfilPropio
        {
            PrimerNombre = "Gestora",
            PrimerApellido = "De Prueba",
            TipoDocumento = "cc",
            Identificacion = ProximaIdentificacion(),
        });
        perfil.EnsureSuccessStatusCode();

        return (id, sesion, correo);
    }

    [Fact]
    public async Task La_lista_de_cuentas_dice_cuantos_apartados_puede_abrir_cada_una()
    {
        // LA PREGUNTA DE ESA PANTALLA ES «QUIEN PUEDE ABRIR QUE», y hasta el 17 de septiembre de
        // 2026 solo se respondía cuenta por cuenta: había que abrir la ficha de cada una y contar
        // casillas. La cifra viaja en la lista, con la misma regla que la ficha.
        await using var factory = new TestWebApplicationFactory();
        var (id, _, correo) = await GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        var reciente = await LeerCuentaAsync(webmaster, correo);

        // Recién creada no tiene ninguno concedido: solo los dos que vienen siempre.
        Assert.Equal(2, reciente.GetProperty("apartadosActivos").GetInt32());
        var totales = reciente.GetProperty("apartadosTotales").GetInt32();
        Assert.True(totales > 2);

        var concedidos = await webmaster.PutAsJsonAsync(
            $"/api/v1/admin/usuarios/{id}/modulos", new { modulos = SoloAgenda });
        concedidos.EnsureSuccessStatusCode();

        var despues = await LeerCuentaAsync(webmaster, correo);
        Assert.Equal(3, despues.GetProperty("apartadosActivos").GetInt32());

        // EL TOTAL DE UN GESTOR NO CUENTA LO QUE SU ROL NUNCA ABRE: «Usuarios y roles» y
        // «Salud del sistema» son solo del webmaster, como en la barra.
        Assert.Equal(SIMUS.Api.Security.ModulosDeLaConsola.Todos.Length - SIMUS.Api.Security.ModulosDeLaConsola.SoloWebmaster.Length, totales);

        // Y EL WEBMASTER LOS TIENE TODOS, no porque se los hayan concedido sino por lo que es.
        var suya = await LeerCuentaAsync(webmaster, "webmaster@simus.test");
        Assert.Equal(SIMUS.Api.Security.ModulosDeLaConsola.Todos.Length, suya.GetProperty("apartadosActivos").GetInt32());
        Assert.Equal(SIMUS.Api.Security.ModulosDeLaConsola.Todos.Length, suya.GetProperty("apartadosTotales").GetInt32());
    }

    [Fact]
    public async Task Conceder_Y_Quitar_Modulos_A_Una_Cuenta_Queda_En_El_Historial_Y_Repetir_No_Escribe_Nada()
    {
        // «por qué esta persona puede publicar» se contesta con el registro de cambios: qué módulos
        // tenía, cuáles tiene, quién los concedió. Repetir la misma lista no es un cambio.
        await using var factory = new TestWebApplicationFactory();
        var (id, _, _) = await GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        (await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{id}/modulos", new { modulos = SoloAgenda })).EnsureSuccessStatusCode();
        (await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{id}/modulos", new { modulos = SoloAgenda })).EnsureSuccessStatusCode();
        (await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{id}/modulos", new { modulos = Array.Empty<string>() })).EnsureSuccessStatusCode();

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SIMUS.Infrastructure.Data.SimusDbContext>();
        var cambios = (await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(
            db.CambiosDeRegistro.Where(x => x.ModuloId == "usuarios" && x.RegistroId == id.ToString(System.Globalization.CultureInfo.InvariantCulture))
                .OrderBy(x => x.Id))).ToList();

        // Dos cambios: se concede «agenda» y se retira. El segundo guardado igual al primero no escribe nada.
        Assert.Equal(2, cambios.Count);
        Assert.Null(cambios[0].ValorAnterior);
        Assert.Equal("agenda", cambios[0].ValorNuevo);
        Assert.Equal("agenda", cambios[1].ValorAnterior);
        Assert.Null(cambios[1].ValorNuevo);
        Assert.All(cambios, c => Assert.Equal("contacto", c.ClaseDato));
        Assert.All(cambios, c => Assert.Equal("Consola", c.ActorRol));
    }

    /// <summary>La cuenta de ese correo, leída de la lista que ve la consola.</summary>
    private static async Task<JsonElement> LeerCuentaAsync(HttpClient webmaster, string correo)
    {
        var lista = await webmaster.GetFromJsonAsync<JsonElement>("/api/v1/admin/auth/users");
        foreach (var cuenta in lista.EnumerateArray())
        {
            if (string.Equals(cuenta.GetProperty("email").GetString(), correo, StringComparison.OrdinalIgnoreCase))
            {
                return cuenta.Clone();
            }
        }

        throw new InvalidOperationException($"La lista no trae la cuenta {correo}.");
    }

    [Fact]
    public async Task Una_cuenta_sin_el_modulo_no_entra_a_sus_rutas()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, gestor, _) = await GestorAsync(factory);

        // Recién creada no tiene ningún módulo concedido: solo los dos que vienen siempre.
        var catalogo = await gestor.GetAsync("/api/v1/institucional/catalogo-editorial");
        var agenda = await gestor.GetAsync("/api/v1/institucional/agenda");

        Assert.Equal(HttpStatusCode.Forbidden, catalogo.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, agenda.StatusCode);
    }

    [Fact]
    public async Task El_403_dice_que_falta_activar_el_modulo_y_no_que_no_existe()
    {
        // NO ES UN 404 A PROPOSITO. Quien llega aquí ya demostró que tiene sesión de consola y rol
        // interno: no se le oculta que el módulo existe —lo ve en la barra de un compañero—, se le
        // dice que a él no se lo han activado. Un 404 le haría buscar un fallo que no existe.
        await using var factory = new TestWebApplicationFactory();
        var (_, gestor, _) = await GestorAsync(factory);

        var respuesta = await gestor.GetAsync("/api/v1/institucional/agenda");
        var cuerpo = await respuesta.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
        Assert.Contains("no tiene activado este módulo", cuerpo, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Activarle_el_modulo_le_abre_sus_rutas()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        var guardado = await webmaster.PutAsJsonAsync(
            $"/api/v1/admin/usuarios/{id}/modulos", new { modulos = SoloAgenda });
        guardado.EnsureSuccessStatusCode();

        var agenda = await gestor.GetAsync("/api/v1/institucional/agenda");
        var catalogo = await gestor.GetAsync("/api/v1/institucional/catalogo-editorial");

        Assert.Equal(HttpStatusCode.OK, agenda.StatusCode);
        // Y SOLO ESE: conceder uno no concede los demás.
        Assert.Equal(HttpStatusCode.Forbidden, catalogo.StatusCode);
    }

    [Fact]
    public async Task Los_dos_de_siempre_estan_aunque_nadie_los_conceda()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, gestor, _) = await GestorAsync(factory);

        var mios = await gestor.GetFromJsonAsync<JsonElement>("/api/v1/admin/mis-modulos");
        var modulos = mios.GetProperty("modulos").EnumerateArray().Select(x => x.GetString()).ToList();

        Assert.Contains("monitor", modulos);
        Assert.Contains("solicitudes", modulos);
        Assert.DoesNotContain("catalogo-editorial", modulos);
    }

    [Fact]
    public async Task Quitar_un_modulo_vuelve_a_cerrar_la_puerta()
    {
        // GUARDAR EL CONJUNTO, NO UNA DIFERENCIA: la pantalla es una lista de casillas y lo que la
        // persona decide es el conjunto. Mandar la lista sin «agenda» es quitarlo.
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{id}/modulos", new { modulos = SoloAgenda });
        Assert.Equal(HttpStatusCode.OK, (await gestor.GetAsync("/api/v1/institucional/agenda")).StatusCode);

        await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{id}/modulos", new { modulos = Ninguno });

        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync("/api/v1/institucional/agenda")).StatusCode);
    }

    [Fact]
    public async Task A_un_gestor_no_se_le_conceden_los_apartados_que_solo_abre_el_webmaster()
    {
        // la ficha los ofrecía y la lista contaba «16 de 16» a una cuenta cuya barra tenía 14.
        // Ahora no se guardan, no se cuentan y la ruta sigue cerrada aunque la base los tuviera.
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        var guardado = await webmaster.PutAsJsonAsync(
            $"/api/v1/admin/usuarios/{id}/modulos", new { modulos = AgendaUsuariosYSistema });
        guardado.EnsureSuccessStatusCode();
        var modulos = (await guardado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("modulos")
            .EnumerateArray().Select(x => x.GetString()).ToList();

        Assert.Contains("agenda", modulos);
        Assert.DoesNotContain("usuarios", modulos);
        Assert.DoesNotContain("sistema", modulos);

        // Aunque la base los tenga —el arranque se los sembraba al gestor—, no abren nada.
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SIMUS.Infrastructure.Data.SimusDbContext>();
            db.ModulosPorCuenta.Add(new SIMUS.Domain.Entities.ModuloPorCuentaRow { IdUsuario = id, CodigoModulo = "usuarios", FechaOtorgado = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync("/api/v1/admin/usuarios/modulos-disponibles")).StatusCode);
        var mios = await gestor.GetFromJsonAsync<JsonElement>("/api/v1/admin/mis-modulos");
        Assert.DoesNotContain("usuarios", mios.GetProperty("modulos").EnumerateArray().Select(x => x.GetString()));
    }

    [Fact]
    public async Task Un_modulo_que_no_existe_se_rechaza_diciendo_cual()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, _, _) = await GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        var respuesta = await webmaster.PutAsJsonAsync(
            $"/api/v1/admin/usuarios/{id}/modulos", new { modulos = AgendaYUnoInventado });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        // SE DICE CUAL, porque casi siempre es un identificador mal escrito y adivinarlo desde una
        // lista vacía cuesta una tarde.
        Assert.Contains("calendario", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Una_cuenta_sin_el_modulo_de_usuarios_no_puede_conceder_permisos()
    {
        // LA PUERTA SE CIERRA SOBRE SI MISMA: administrar permisos es un módulo más, «usuarios», y
        // quien no lo tiene no puede darse a sí mismo los que le faltan.
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await GestorAsync(factory);

        var intento = await gestor.PutAsJsonAsync(
            $"/api/v1/admin/usuarios/{id}/modulos", new { modulos = SoloCatalogo });

        Assert.Equal(HttpStatusCode.Forbidden, intento.StatusCode);
    }

    [Fact]
    public async Task El_webmaster_los_tiene_todos_sin_que_nadie_se_los_conceda()
    {
        await using var factory = new TestWebApplicationFactory();
        var webmaster = await CmsTestClient.LoginAsync(factory);

        var mios = await webmaster.GetFromJsonAsync<JsonElement>("/api/v1/admin/mis-modulos");

        Assert.True(mios.GetProperty("todosPorSerWebmaster").GetBoolean());
        Assert.Equal(
            SIMUS.Api.Security.ModulosDeLaConsola.Todos.Length,
            mios.GetProperty("modulos").GetArrayLength());
    }

    /// <summary>
    /// El buzón de la campanita enseña lo mismo que la barra izquierda deja abrir.
    /// </summary>
    /// <remarks>
    /// El criterio es este: «es importante que el apartado
    /// de notificaciones por supuesto también corresponda con los módulos que tienen activados en
    /// cada caso». Un aviso de un módulo cerrado es un enlace a un 403.
    /// </remarks>
    [Fact]
    public async Task Un_aviso_de_un_modulo_cerrado_no_llega_al_buzon()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, correo) = await GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        await EnviarAvisoAsync(webmaster, correo, "catalogo-editorial", "Ficha lista para revisar");

        Assert.DoesNotContain("Ficha lista para revisar", await BuzonDeAsync(gestor), StringComparison.Ordinal);

        // Y EN CUANTO SE LE ACTIVA, APARECE: no se ha borrado nada, solo estaba fuera de su alcance.
        var guardado = await webmaster.PutAsJsonAsync(
            $"/api/v1/admin/usuarios/{id}/modulos", new { modulos = SoloCatalogo });
        guardado.EnsureSuccessStatusCode();

        Assert.Contains("Ficha lista para revisar", await BuzonDeAsync(gestor), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Un_aviso_que_no_es_de_ningun_modulo_llega_siempre()
    {
        // LO DESCONOCIDO SE MUESTRA. Callar lo que no se sabe clasificar convierte cada aviso nuevo
        // mal etiquetado en un mensaje que nadie recibe y que nadie echa de menos.
        await using var factory = new TestWebApplicationFactory();
        var (_, gestor, correo) = await GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        await EnviarAvisoAsync(webmaster, correo, null, "Mantenimiento programado");

        Assert.Contains("Mantenimiento programado", await BuzonDeAsync(gestor), StringComparison.Ordinal);
    }

    // «El circuito de revisión llega aunque no tenga el Ecosistema» se retiró el 5 de noviembre de
    // 2026: decidir sobre un Festival exige ahora el Ecosistema, y un aviso que lleva a esa
    // decisión sin el módulo sería un enlace a un 403. Lo contrario lo prueba
    // `RevisionInstitucionalPorModuloTests.Un_aviso_del_circuito_del_Festival_ya_no_llega_sin_el_Ecosistema`.

    private static async Task EnviarAvisoAsync(HttpClient webmaster, string correo, string? modulo, string titulo)
    {
        var enviado = await webmaster.PostAsJsonAsync("/api/v1/admin/notificaciones", new NotificationCreateRequest
        {
            RecipientEmail = correo,
            EventType = "aviso_de_prueba",
            Channel = "internal",
            Title = titulo,
            Body = "Cuerpo del aviso.",
            ModuleId = modulo,
            AmbitoAcceso = "institucional",
        });
        enviado.EnsureSuccessStatusCode();
    }

    private static async Task<string> BuzonDeAsync(HttpClient sesion)
    {
        var respuesta = await sesion.GetAsync("/api/v1/notificaciones?ambito=institucional&limite=100");
        respuesta.EnsureSuccessStatusCode();
        return await respuesta.Content.ReadAsStringAsync();
    }
}
