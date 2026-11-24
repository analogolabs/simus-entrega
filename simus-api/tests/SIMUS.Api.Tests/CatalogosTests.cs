using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La administración de los catálogos «Territorios sonoros» y «Prácticas musicales» desde la consola.
///
/// <para>
/// LO QUE ESTAS PRUEBAS IMPIDEN. Que se abra la gestión sin sesión o sin el módulo, que dos elementos se llamen igual sin
/// tildes, que se borre lo que está en uso, que un elemento desactivado siga ofreciéndose en el portal, que una importación
/// se aplique a medias y que se pierda el rastro de quién cambió una ficha.
/// </para>
/// </summary>
public sealed class CatalogosTests
{
    private const string Practicas = "/api/v1/institucional/catalogos/practicas-musicales";
    private const string Territorios = "/api/v1/institucional/catalogos/territorios-sonoros";
    private const string PublicoPracticas = "/api/v1/publico/practicas-musicales";
    private const string PublicoTerritorios = "/api/v1/publico/territorios-sonoros";

    private static async Task<JsonElement> Leer(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<int> Crear(HttpClient c, string ruta, object cuerpo)
    {
        var r = await c.PostAsJsonAsync(ruta, cuerpo);
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        return (await Leer(r)).GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task La_gestion_exige_sesion_y_el_modulo_de_categorias()
    {
        await using var factory = new TestWebApplicationFactory();
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(Practicas)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsJsonAsync(Territorios, new { nombre = "X" })).StatusCode);

        var gestor = await GestorConAsync(factory, "agenda");
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync(Practicas)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.PostAsJsonAsync(Territorios, new { nombre = "X" })).StatusCode);
        var conModulo = await GestorConAsync(factory, "categorias");
        Assert.Equal(HttpStatusCode.OK, (await conModulo.GetAsync(Practicas)).StatusCode);
    }

    [Fact]
    public async Task Una_practica_nueva_va_al_final_con_su_ficha_y_se_lee_en_el_portal()
    {
        await using var factory = new TestWebApplicationFactory();
        var c = await CmsTestClient.LoginAsync(factory);
        var maximo = (await Leer(await c.GetAsync(Practicas))).GetProperty("items").EnumerateArray().Select(x => x.GetProperty("orden").GetInt32()).DefaultIfEmpty(0).Max();

        var id = await Crear(c, Practicas, new
        {
            nombre = "Músicas de prueba", sinonimos = "pruebas; ensayo; pruebas", definicionBreve = "Una definición breve.",
            definicionAmpliada = "Primer párrafo.\n\nSegundo párrafo.", fuentes = "Fuente de prueba", esPreliminar = true, activo = true,
        });

        var lista = (await Leer(await c.GetAsync(Practicas))).GetProperty("items");
        var nueva = lista.EnumerateArray().Single(x => x.GetProperty("id").GetInt32() == id);
        Assert.Equal(maximo + 1, nueva.GetProperty("orden").GetInt32());
        Assert.Equal("musicas-de-prueba", nueva.GetProperty("slug").GetString());
        Assert.Equal("pruebas; ensayo", nueva.GetProperty("sinonimos").GetString());
        Assert.Equal("preliminar", nueva.GetProperty("estadoDeFicha").GetString());

        var publica = await Leer(await factory.CreateClient().GetAsync($"{PublicoPracticas}/musicas-de-prueba"));
        Assert.Equal("Una definición breve.", publica.GetProperty("definicionBreve").GetString());
        Assert.True(publica.GetProperty("esPreliminar").GetBoolean());
    }

    [Fact]
    public async Task El_nombre_es_unico_sin_tildes_ni_mayusculas_y_los_largos_se_validan()
    {
        await using var factory = new TestWebApplicationFactory();
        var c = await CmsTestClient.LoginAsync(factory);
        await Crear(c, Territorios, new { nombre = "Llanura Sonora" });

        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync(Territorios, new { nombre = "llanúra sonora" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync(Territorios, new { nombre = "  " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync(Territorios, new { nombre = "Otro", definicionBreve = new string('a', 801) })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync(Territorios, new { nombre = "Otro", orden = 0 })).StatusCode);
        // Una imagen sin texto alternativo no se acepta: la accesibilidad no es opcional.
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync(Territorios, new { nombre = "Otro", imagenArchivoId = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync(Territorios, new { nombre = "Otro", padreId = 1 })).StatusCode);
    }

    [Fact]
    public async Task Las_practicas_admiten_dos_niveles_y_no_ciclos()
    {
        await using var factory = new TestWebApplicationFactory();
        var c = await CmsTestClient.LoginAsync(factory);
        var raiz = await Crear(c, Practicas, new { nombre = "Principal" });
        var hija = await Crear(c, Practicas, new { nombre = "Hija", padreId = raiz });
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync(Practicas, new { nombre = "Nieta", padreId = hija })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PutAsJsonAsync($"{Practicas}/{raiz}", new { nombre = "Principal", padreId = hija })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PutAsJsonAsync($"{Practicas}/{hija}", new { nombre = "Hija", padreId = hija })).StatusCode);
        // Una principal con subelementos no se elimina.
        Assert.Equal(HttpStatusCode.BadRequest, (await c.DeleteAsync($"{Practicas}/{raiz}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"{Practicas}/{hija}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"{Practicas}/{raiz}")).StatusCode);
    }

    [Fact]
    public async Task Desactivar_lo_saca_del_portal_y_de_las_listas_pero_no_borra_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        var c = await CmsTestClient.LoginAsync(factory);
        var id = await Crear(c, Territorios, new { nombre = "Costa de prueba", definicionBreve = "Texto." });
        var anonimo = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"{PublicoTerritorios}/costa-de-prueba")).StatusCode);

        var r = await c.PostAsJsonAsync($"{Territorios}/{id}/activo", new { activo = false });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.False((await Leer(r)).GetProperty("activo").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"{PublicoTerritorios}/costa-de-prueba")).StatusCode);
        var publicos = await Leer(await anonimo.GetAsync(PublicoTerritorios));
        Assert.DoesNotContain(publicos.EnumerateArray(), x => x.GetProperty("id").GetInt32() == id);
        // La consola lo sigue viendo, desactivado, para poder reactivarlo.
        var enConsola = (await Leer(await c.GetAsync(Territorios))).GetProperty("items").EnumerateArray().Single(x => x.GetProperty("id").GetInt32() == id);
        Assert.False(enConsola.GetProperty("activo").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync($"{Territorios}/{id}/activo", new { activo = true })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"{PublicoTerritorios}/costa-de-prueba")).StatusCode);
    }

    [Fact]
    public async Task Lo_que_esta_en_uso_no_se_elimina_se_desactiva_y_se_ve_donde_se_usa()
    {
        await using var factory = new TestWebApplicationFactory();
        var c = await CmsTestClient.LoginAsync(factory);
        var id = await Crear(c, Practicas, new { nombre = "Práctica en uso" });
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            db.PracticasMusicalesDeRegistro.Add(new PracticaMusicalDeRegistroRow
            {
                ModuloId = Modulos.Festivales, RegistroId = "999", ValorId = id, FechaCreacion = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        var fila = (await Leer(await c.GetAsync(Practicas))).GetProperty("items").EnumerateArray().Single(x => x.GetProperty("id").GetInt32() == id);
        Assert.Equal(1, fila.GetProperty("totalDeUsos").GetInt32());
        Assert.Equal("Festivales", fila.GetProperty("usos")[0].GetProperty("fuente").GetString());
        var borrado = await c.DeleteAsync($"{Practicas}/{id}");
        Assert.Equal(HttpStatusCode.BadRequest, borrado.StatusCode);
        Assert.Contains("Desactívalo", await borrado.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync($"{Practicas}/{id}/activo", new { activo = false })).StatusCode);
    }

    [Fact]
    public async Task El_orden_se_guarda_completo_o_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var c = await CmsTestClient.LoginAsync(factory);
        var a = await Crear(c, Territorios, new { nombre = "Orden A" });
        var b = await Crear(c, Territorios, new { nombre = "Orden B" });
        var todos = (await Leer(await c.GetAsync(Territorios))).GetProperty("items").EnumerateArray().Select(x => x.GetProperty("id").GetInt32()).ToList();

        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync($"{Territorios}/orden", new { ids = new[] { a } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync($"{Territorios}/orden", new { ids = todos.Append(a).ToArray() })).StatusCode);
        todos.Remove(b);
        todos.Insert(0, b);
        var r = await c.PostAsJsonAsync($"{Territorios}/orden", new { ids = todos });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var items = (await Leer(r)).GetProperty("items");
        Assert.Equal(b, items[0].GetProperty("id").GetInt32());
        Assert.Equal(1, items[0].GetProperty("orden").GetInt32());
    }

    [Fact]
    public async Task La_importacion_muestra_primero_la_vista_previa_y_aplica_todo_o_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        var c = await CmsTestClient.LoginAsync(factory);
        var existente = await Crear(c, Practicas, new { nombre = "Ya existe", definicionBreve = "Antes." });
        var filas = new[]
        {
            new Dictionary<string, string?> { ["Nombre"] = "Ya existe", ["Definición breve"] = "Después.", ["Activo"] = "Sí" },
            new Dictionary<string, string?> { ["Nombre"] = "Nueva por hoja", ["Definición breve"] = "Texto.", ["Principal"] = "Ya existe", ["Definición preliminar"] = "Sí" },
        };

        var vista = await Leer(await c.PostAsJsonAsync($"{Practicas}/importar", new { filas, aplicar = false }));
        Assert.False(vista.GetProperty("aplicada").GetBoolean());
        Assert.Equal(1, vista.GetProperty("crea").GetInt32());
        Assert.Equal(1, vista.GetProperty("actualiza").GetInt32());
        var tras = (await Leer(await c.GetAsync(Practicas))).GetProperty("items").EnumerateArray().ToList();
        Assert.DoesNotContain(tras, x => x.GetProperty("nombre").GetString() == "Nueva por hoja");

        // Una fila con error impide aplicar cualquiera de las otras.
        var conError = filas.Append(new Dictionary<string, string?> { ["Nombre"] = "Mala", ["Orden"] = "abc" }).ToArray();
        var rechazada = await Leer(await c.PostAsJsonAsync($"{Practicas}/importar", new { filas = conError, aplicar = true }));
        Assert.False(rechazada.GetProperty("aplicada").GetBoolean());
        Assert.Equal(1, rechazada.GetProperty("conErrores").GetInt32());
        Assert.DoesNotContain((await Leer(await c.GetAsync(Practicas))).GetProperty("items").EnumerateArray(), x => x.GetProperty("nombre").GetString() == "Nueva por hoja");

        var aplicada = await Leer(await c.PostAsJsonAsync($"{Practicas}/importar", new { filas, aplicar = true }));
        Assert.True(aplicada.GetProperty("aplicada").GetBoolean());
        var final = (await Leer(await c.GetAsync(Practicas))).GetProperty("items").EnumerateArray().ToList();
        var nueva = final.Single(x => x.GetProperty("nombre").GetString() == "Nueva por hoja");
        Assert.Equal(existente, nueva.GetProperty("padreId").GetInt32());
        Assert.Equal("preliminar", nueva.GetProperty("estadoDeFicha").GetString());
        Assert.Equal("Después.", final.Single(x => x.GetProperty("id").GetInt32() == existente).GetProperty("definicionBreve").GetString());
    }

    [Fact]
    public async Task Cada_cambio_deja_rastro_en_el_historial_y_en_la_auditoria()
    {
        await using var factory = new TestWebApplicationFactory();
        var c = await CmsTestClient.LoginAsync(factory);
        var id = await Crear(c, Territorios, new { nombre = "Con historial", definicionBreve = "Uno." });
        Assert.Equal(HttpStatusCode.OK, (await c.PutAsJsonAsync($"{Territorios}/{id}", new { nombre = "Con historial", definicionBreve = "Dos." })).StatusCode);

        var historial = (await Leer(await c.GetAsync($"{Territorios}/{id}/historial"))).GetProperty("items");
        Assert.Equal(2, historial.GetArrayLength());
        Assert.Equal("actualizar", historial[0].GetProperty("accion").GetString());
        Assert.Contains("definicionBreve", historial[0].GetProperty("resumen").GetString(), StringComparison.Ordinal);
        var auditoria = await c.GetAsync("/api/v1/admin/auditoria/?tabla=TerritoriosSonoros");
        Assert.Equal(HttpStatusCode.OK, auditoria.StatusCode);
    }

    private static async Task<HttpClient> GestorConAsync(TestWebApplicationFactory factory, params string[] modulos)
    {
        const string clave = "ClaveDePrueba123";
        const string definitiva = "ClaveElegida456";
        var webmaster = await CmsTestClient.LoginAsync(factory);
        var correo = $"gestor.cat.{Guid.NewGuid():N}@pnmc.local";
        var alta = await webmaster.PostAsJsonAsync("/api/v1/admin/auth/users", new AdminUserUpsertRequest
        {
            FullName = "Gestor de catálogos", Email = correo, Roles = ["gestor_interno"], Password = clave, IsActive = true,
        });
        alta.EnsureSuccessStatusCode();
        var creada = await alta.Content.ReadFromJsonAsync<JsonElement>();
        var id = int.Parse(creada.GetProperty("user").GetProperty("id").GetString()!, CultureInfo.InvariantCulture);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            db.ModulosPorCuenta.RemoveRange(db.ModulosPorCuenta.Where(x => x.IdUsuario == id));
            foreach (var modulo in modulos)
                db.ModulosPorCuenta.Add(new ModuloPorCuentaRow { IdUsuario = id, CodigoModulo = modulo, FechaOtorgado = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }
        var sesion = await CmsTestClient.LoginAsync(factory, correo, clave);
        (await sesion.PostAsJsonAsync("/api/v1/admin/auth/mi-contrasena", new CambioDeContrasenaPropia { Actual = clave, Nueva = definitiva })).EnsureSuccessStatusCode();
        (await sesion.PostAsJsonAsync("/api/v1/admin/auth/mi-perfil", new PerfilPropio
        {
            PrimerNombre = "Gestora", PrimerApellido = "De Catálogos", TipoDocumento = "cc",
            Identificacion = "4" + id.ToString(CultureInfo.InvariantCulture).PadLeft(6, '0'),
        })).EnsureSuccessStatusCode();
        return sesion;
    }
}
