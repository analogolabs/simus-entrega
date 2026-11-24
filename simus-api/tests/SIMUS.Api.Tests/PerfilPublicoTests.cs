using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Perfil público de la persona, activado por ella (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4-§19.5).
/// </summary>
/// <remarks>
/// LO PRIVADO SE BUSCA POR VALOR EN EL JSON CRUDO, como en <see cref="FichaPublicaSinDatosPersonalesTests"/>:
/// renombrar una propiedad no puede esquivar la prueba. Y cada caso comprueba antes que sí viaja lo
/// que debe (centinelas en verde), para que «no aparece» no sea cierto por una respuesta vacía.
/// </remarks>
public sealed class PerfilPublicoTests : IClassFixture<TestWebApplicationFactory>
{
    private const string Clave = "ClaveExterna123";
    private const string Telefono = "3009876543";
    private readonly TestWebApplicationFactory _factory;

    public PerfilPublicoTests(TestWebApplicationFactory factory) => _factory = factory;

    private async Task<(HttpClient Sesion, int IdUsuario)> PersonaAsync(string correo, string documento)
    {
        var anonimo = _factory.CreateClient();
        (await anonimo.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = "Lucía",
            FirstSurname = "Mosquera",
            DocumentType = "cc",
            DocumentNumber = documento,
            Phone = Telefono,
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();

        var sesion = _factory.CreateClient();
        (await sesion.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave }))
            .EnsureSuccessStatusCode();

        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var id = await db.Users.AsNoTracking().Where(usuario => usuario.Email == correo).Select(usuario => usuario.Id).SingleAsync();
        return (sesion, id);
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var token = (await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/organizaciones/csrf"))!.RequestToken;
        var mensaje = new HttpRequestMessage(metodo, ruta) { Content = JsonContent.Create(cuerpo ?? new { }) };
        mensaje.Headers.Add("X-CSRF-TOKEN", token);
        return await cliente.SendAsync(mensaje);
    }

    /// <remarks>
    /// <c>revisada</c> es la revisión de la consola, que decide si la organización es pública.
    /// Por omisión se siembra revisada: las pruebas de perfil miran el perfil, no esa regla.
    /// </remarks>
    private async Task<int> OrganizacionAsync(int idUsuario, string nombre, string estado, bool revisada = true)
    {
        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var entidad = new EntityProfileRow
        {
            EntityType = "organizacion",
            Name = nombre,
            ContactEmail = $"contacto-{Guid.NewGuid():N}@no-publicar.test",
            StatusCode = estado,
            IsActive = true,
            CreatedByUserId = idUsuario,
            CreatedAt = DateTime.UtcNow,
            FechaRevisionConsola = revisada ? DateTime.UtcNow : null,
            IdUsuarioRevisionConsola = revisada ? idUsuario : null,
        };
        db.EntityProfiles.Add(entidad);
        await db.SaveChangesAsync();
        db.UserEntities.Add(new UserEntityRow { UserId = idUsuario, EntityId = entidad.Id, EntityRole = "administrador", IsActive = true, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return entidad.Id;
    }

    private static PerfilPublicoSolicitud Perfil(params string[] enlaces) => new()
    {
        NombreVisible = "Lucía la gaitera",
        IdsPracticas = [1],
        CodigoMunicipio = "11001",
        Enlaces = [.. enlaces],
    };

    /// <summary>El perfil de siempre, eligiendo mostrar estas organizaciones (ME: el consentimiento es explícito).</summary>
    private static PerfilPublicoSolicitud PerfilMostrando(IEnumerable<int> organizaciones, params string[] enlaces)
    {
        var solicitud = Perfil(enlaces);
        solicitud.IdsOrganizaciones = [.. organizaciones];
        return solicitud;
    }

    private static async Task<MiPerfilPublicoDto> PublicarAsync(HttpClient sesion)
    {
        var politica = await sesion.GetFromJsonAsync<PoliticaPublicaDto>("/api/v1/publico/politicas/perfil_publico");
        var respuesta = await EnviarAsync(sesion, HttpMethod.Post, "/api/v1/externo/cuenta/perfil-publico/publicar",
            new PublicarPerfilPublicoSolicitud { VersionAceptada = politica!.Version });
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
    }

    [Fact]
    public async Task Nace_oculto_y_solo_se_ve_al_aceptar_la_finalidad_perfil_publico()
    {
        var (sesion, _) = await PersonaAsync("perfil.nace@example.com", "53000111");

        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", Perfil("https://gaita.example.org"));
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        Assert.False(mio.Visible);
        Assert.False(mio.AutorizacionVigente);

        var anonimo = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/personas/{mio.Clave}")).StatusCode);

        // Una versión que no es la vigente no publica.
        var otraVersion = await EnviarAsync(sesion, HttpMethod.Post, "/api/v1/externo/cuenta/perfil-publico/publicar",
            new PublicarPerfilPublicoSolicitud { VersionAceptada = "1999-01-01" });
        Assert.Equal(HttpStatusCode.BadRequest, otraVersion.StatusCode);

        var publicado = await PublicarAsync(sesion);
        Assert.True(publicado.Visible);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/personas/{mio.Clave}")).StatusCode);

        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var autorizacion = await db.AutorizacionesDeDatos.AsNoTracking()
            .SingleAsync(item => item.Finalidad == "perfil_publico" && item.CorreoTitular == "perfil.nace@example.com");
        Assert.Equal("cuenta", autorizacion.Origen);
        Assert.False(string.IsNullOrWhiteSpace(autorizacion.TextoAceptado));
    }

    [Fact]
    public async Task El_JSON_publico_no_lleva_correo_documento_telefono_ni_rol()
    {
        const string correo = "perfil.privado@example.com";
        const string documento = "53000222";
        var (sesion, id) = await PersonaAsync(correo, documento);
        var gaitas = await OrganizacionAsync(id, "Corporación Gaitas del Norte", "activa");
        var inactiva = await OrganizacionAsync(id, "Organización inactiva oculta", "inactiva");

        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico",
            PerfilMostrando([gaitas, inactiva], "https://gaita.example.org/lucia"));
        var clave = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!.Clave;
        await PublicarAsync(sesion);

        var crudo = await _factory.CreateClient().GetStringAsync($"/api/v1/publico/personas/{clave}");

        // Centinelas en verde: lo público sí viaja.
        Assert.Contains("Lucía la gaitera", crudo, StringComparison.Ordinal);
        Assert.Contains("https://gaita.example.org/lucia", crudo, StringComparison.Ordinal);
        Assert.Contains("Corporación Gaitas del Norte", crudo, StringComparison.Ordinal);
        Assert.Contains("Música andina colombiana", crudo, StringComparison.Ordinal);
        Assert.Contains("Bogota", crudo, StringComparison.Ordinal);

        // Y lo privado no.
        Assert.DoesNotContain(correo, crudo, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(documento, crudo, StringComparison.Ordinal);
        Assert.DoesNotContain(Telefono, crudo, StringComparison.Ordinal);
        Assert.DoesNotContain("administrador", crudo, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("no-publicar.test", crudo, StringComparison.Ordinal);
        Assert.DoesNotContain("Organización inactiva oculta", crudo, StringComparison.Ordinal);

        // El DTO público, por tipo, tampoco declara nada de eso.
        var propiedades = typeof(PerfilPublicoDto).GetProperties().Select(p => p.Name.ToLowerInvariant()).ToList();
        Assert.DoesNotContain(propiedades, nombre => nombre.Contains("correo") || nombre.Contains("email")
            || nombre.Contains("documento") || nombre.Contains("telefono") || nombre.Contains("rol"));
    }

    [Fact]
    public async Task Oculto_responde_igual_que_inexistente_y_retirar_la_autorizacion_lo_oculta_en_el_acto()
    {
        var (sesion, _) = await PersonaAsync("perfil.retiro@example.com", "53000333");
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", Perfil());
        var clave = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!.Clave;
        await PublicarAsync(sesion);

        var anonimo = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/personas/{clave}")).StatusCode);

        var retiro = await EnviarAsync(sesion, HttpMethod.Post, "/api/v1/externo/mis-autorizaciones/perfil_publico/revocar");
        Assert.Equal(HttpStatusCode.OK, retiro.StatusCode);

        var oculto = await anonimo.GetAsync($"/api/v1/publico/personas/{clave}");
        var inexistente = await anonimo.GetAsync($"/api/v1/publico/personas/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, oculto.StatusCode);
        Assert.Equal(inexistente.StatusCode, oculto.StatusCode);
        Assert.Equal(await inexistente.Content.ReadAsStringAsync(), await oculto.Content.ReadAsStringAsync());

        // Y se puede volver a publicar; ocultarlo desde el perfil también retira la autorización.
        await PublicarAsync(sesion);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/personas/{clave}")).StatusCode);
        var ocultar = await EnviarAsync(sesion, HttpMethod.Post, "/api/v1/externo/cuenta/perfil-publico/ocultar");
        Assert.False((await ocultar.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!.Visible);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/personas/{clave}")).StatusCode);
    }

    [Fact]
    public async Task Enlaces_solo_https_y_hasta_cinco_y_la_foto_tiene_que_ser_propia()
    {
        var (sesion, _) = await PersonaAsync("perfil.enlaces@example.com", "53000444");

        // LA REGLA ÚNICA DE DIRECCIÓN: un enlace http:// no se rechaza —el perfil se
        // quedaba sin guardar por un detalle—, se guarda como https://, que sigue siendo «solo https».
        var http = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", Perfil("http://inseguro.example.org"));
        Assert.Equal(HttpStatusCode.OK, http.StatusCode);
        Assert.Equal("https://inseguro.example.org", Assert.Single((await http.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!.Enlaces));

        var sinEsquema = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", Perfil("www.miperfil.example.org"));
        Assert.Equal(HttpStatusCode.OK, sinEsquema.StatusCode);
        Assert.Equal("https://www.miperfil.example.org", Assert.Single((await sinEsquema.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!.Enlaces));

        var javascript = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", Perfil("javascript:alert(1)"));
        Assert.Equal(HttpStatusCode.BadRequest, javascript.StatusCode);

        var seis = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico",
            Perfil([.. Enumerable.Range(1, 6).Select(i => $"https://e{i}.example.org")]));
        Assert.Equal(HttpStatusCode.BadRequest, seis.StatusCode);

        var cinco = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico",
            Perfil([.. Enumerable.Range(1, 5).Select(i => $"https://e{i}.example.org")]));
        Assert.Equal(HttpStatusCode.OK, cinco.StatusCode);

        int ajena;
        using (var alcance = _factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var archivo = new FileRow
            {
                OriginalName = "ajena.png", StoredName = "ajena.png", MimeType = "image/png", StoragePath = "/x",
                UploadedByUserId = 1, CreatedAt = DateTime.UtcNow, Content = [1, 2, 3], AltText = "ajena",
            };
            db.Files.Add(archivo);
            await db.SaveChangesAsync();
            ajena = archivo.Id;
        }

        var solicitud = Perfil();
        solicitud.ArchivoFotoId = ajena;
        var conFotoAjena = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);
        Assert.Equal(HttpStatusCode.BadRequest, conFotoAjena.StatusCode);
        Assert.Contains("archivoFotoId", await conFotoAjena.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task La_consola_lo_oculta_con_motivo_sin_editarlo_y_queda_en_la_bitacora()
    {
        var (sesion, id) = await PersonaAsync("perfil.moderado@example.com", "53000555");
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", Perfil("https://moderado.example.org"));
        var clave = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!.Clave;
        await PublicarAsync(sesion);

        var consola = await CmsTestClient.LoginAsync(_factory);
        var listado = await consola.GetFromJsonAsync<List<PerfilPublicoEnModeracionDto>>("/api/v1/admin/perfiles-publicos?q=moderado");
        Assert.Contains(listado!, perfil => perfil.Clave == clave && perfil.Visible);

        var sinMotivo = await consola.PostAsJsonAsync($"/api/v1/admin/perfiles-publicos/{clave}/ocultar", new ModeracionDePerfilSolicitud { Motivo = " " });
        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);

        var ocultar = await consola.PostAsJsonAsync($"/api/v1/admin/perfiles-publicos/{clave}/ocultar",
            new ModeracionDePerfilSolicitud { Motivo = "Enlace a contenido no relacionado con la música." });
        Assert.Equal(HttpStatusCode.NoContent, ocultar.StatusCode);

        var anonimo = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/personas/{clave}")).StatusCode);

        // La persona ve el motivo y su contenido sigue intacto.
        var mio = await sesion.GetFromJsonAsync<MiPerfilPublicoDto>("/api/v1/externo/cuenta/perfil-publico");
        Assert.True(mio!.OcultoPorModeracion);
        Assert.True(mio.AutorizacionVigente);
        Assert.False(mio.Visible);
        Assert.Equal("Enlace a contenido no relacionado con la música.", mio.MotivoModeracion);
        Assert.Equal("Lucía la gaitera", mio.NombreVisible);
        Assert.Equal(["https://moderado.example.org"], mio.Enlaces);

        using (var alcance = _factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var registro = await db.AuditLogs.AsNoTracking()
                .Where(item => item.TableName == "PerfilesPublicos" && item.RecordId == id.ToString())
                .OrderByDescending(item => item.Id)
                .FirstAsync();
            Assert.Contains("perfil_publico_ocultado_por_moderacion", registro.NewValuesJson, StringComparison.Ordinal);
            Assert.Contains("Enlace a contenido no relacionado", registro.NewValuesJson, StringComparison.Ordinal);
        }

        // Una cuenta externa no modera.
        Assert.NotEqual(HttpStatusCode.NoContent,
            (await EnviarAsync(sesion, HttpMethod.Post, $"/api/v1/admin/perfiles-publicos/{clave}/restablecer")).StatusCode);

        var restablecer = await consola.PostAsJsonAsync($"/api/v1/admin/perfiles-publicos/{clave}/restablecer", new { });
        Assert.Equal(HttpStatusCode.NoContent, restablecer.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/personas/{clave}")).StatusCode);
    }

    [Fact]
    public async Task La_ficha_publica_de_la_organizacion_enlaza_los_perfiles_visibles()
    {
        var (sesion, id) = await PersonaAsync("perfil.organizacion@example.com", "53000666");
        var activa = await OrganizacionAsync(id, "Escuela de Gaitas San Jacinto", "activa");
        var inactiva = await OrganizacionAsync(id, "Escuela cerrada", "inactiva");
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", PerfilMostrando([activa]));
        var clave = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!.Clave;

        var anonimo = _factory.CreateClient();
        var antes = await anonimo.GetFromJsonAsync<OrganizacionPublicaDto>($"/api/v1/publico/organizaciones/{activa}");
        Assert.Empty(antes!.Personas);

        await PublicarAsync(sesion);
        var despues = await anonimo.GetFromJsonAsync<OrganizacionPublicaDto>($"/api/v1/publico/organizaciones/{activa}");
        Assert.Contains(despues!.Personas, persona => persona.Clave == clave && persona.NombreVisible == "Lucía la gaitera");

        var crudo = await anonimo.GetStringAsync($"/api/v1/publico/organizaciones/{activa}");
        Assert.DoesNotContain("no-publicar.test", crudo, StringComparison.Ordinal);
        Assert.DoesNotContain("perfil.organizacion@example.com", crudo, StringComparison.Ordinal);

        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/organizaciones/{inactiva}")).StatusCode);
    }

    /// <summary>
    /// Una organización que la consola no ha revisado no es pública, aunque esté activa.
    /// </summary>
    [Fact]
    public async Task La_organizacion_sin_revisar_no_tiene_ficha_ni_sale_en_el_perfil()
    {
        var (sesion, id) = await PersonaAsync("perfil.sin.revisar@example.com", "53000777");
        var revisada = await OrganizacionAsync(id, "Corporación revisada por el PNMC", "activa");
        var sinRevisar = await OrganizacionAsync(id, "Red de Gaitas sin revisar", "activa", revisada: false);
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", PerfilMostrando([revisada, sinRevisar]));
        var clave = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!.Clave;
        await PublicarAsync(sesion);

        var anonimo = _factory.CreateClient();
        // CENTINELA: la revisada sí tiene ficha.
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/organizaciones/{revisada}")).StatusCode);
        // SIN REVISAR Y AUSENTE RESPONDEN IGUAL: 404 sin cuerpo.
        var ficha = await anonimo.GetAsync($"/api/v1/publico/organizaciones/{sinRevisar}");
        Assert.Equal(HttpStatusCode.NotFound, ficha.StatusCode);
        Assert.Equal(string.Empty, await ficha.Content.ReadAsStringAsync());

        // Y el perfil de la persona no la enlaza.
        var perfil = await anonimo.GetFromJsonAsync<PerfilPublicoDto>($"/api/v1/publico/personas/{clave}");
        Assert.Contains(perfil!.Organizaciones, organizacion => organizacion.Id == revisada);
        Assert.DoesNotContain(perfil.Organizaciones, organizacion => organizacion.Id == sinRevisar);
    }
    /// <summary>
    /// En el Banco de archivos, la foto de un perfil público es de una persona, no del Programa.
    /// </summary>
    [Fact]
    public async Task La_foto_del_perfil_aparece_en_el_banco_con_procedencia_persona()
    {
        var (sesion, _) = await PersonaAsync("perfil.foto.banco@example.com", "53000999");
        using var formulario = new MultipartFormDataContent();
        var png = new ByteArrayContent(Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="));
        png.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        formulario.Add(png, "file", "retrato.png");
        formulario.Add(new StringContent("Retrato de Lucía"), "alt");
        var subida = await TestigoDelCanalExterno.PostAsync(sesion, "/api/v1/externo/cuenta/perfil-publico/foto", formulario);
        Assert.True(subida.IsSuccessStatusCode, await subida.Content.ReadAsStringAsync());
        var foto = (await subida.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var consola = await CmsTestClient.LoginAsync(_factory);
        // Y UNA DEL PROGRAMA, para que el filtro «institucional» no pase por vacío. Son otros
        // bytes: el banco devuelve el archivo existente si la huella coincide dentro del mismo dueño.
        using var institucional = new MultipartFormDataContent();
        var otra = new ByteArrayContent(Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=="));
        otra.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        institucional.Add(otra, "file", "programa.png");
        institucional.Add(new StringContent("Imagen del PNMC"), "alt");
        var delPrograma = await consola.PostAsync("/api/v1/institucional/archivos", institucional);
        Assert.True(delPrograma.IsSuccessStatusCode, await delPrograma.Content.ReadAsStringAsync());
        var programa = (await delPrograma.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        async Task<Dictionary<int, string>> ListarAsync(string filtro)
        {
            var listado = await consola.GetFromJsonAsync<JsonElement>($"/api/v1/institucional/archivos?tamano=100{filtro}");
            return listado.GetProperty("items").EnumerateArray()
                .ToDictionary(item => item.GetProperty("id").GetInt32(), item => item.GetProperty("procedencia").GetString()!);
        }

        var todos = await ListarAsync(string.Empty);
        Assert.Equal("persona", todos[foto]);
        Assert.Equal("institucional", todos[programa]);

        var personas = await ListarAsync("&procedencia=personas");
        Assert.Contains(foto, personas.Keys);
        Assert.DoesNotContain(programa, personas.Keys);

        var delProgramaFiltrado = await ListarAsync("&procedencia=institucional");
        Assert.Contains(programa, delProgramaFiltrado.Keys);
        Assert.DoesNotContain(foto, delProgramaFiltrado.Keys);
    }

    /// <summary>
    /// Los mismos bytes subidos por dos personas y por la consola dan tres archivos, uno por dueño.
    /// Antes las tres subidas sin organización compartían la deduplicación y cada una recibía el ajeno.
    /// </summary>
    [Fact]
    public async Task Los_mismos_bytes_de_dos_personas_y_del_Programa_dan_un_archivo_por_dueno()
    {
        const string Imagen = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        static MultipartFormDataContent Formulario(string alt)
        {
            var formulario = new MultipartFormDataContent();
            var png = new ByteArrayContent(Convert.FromBase64String(Imagen));
            png.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            formulario.Add(png, "file", "misma.png");
            formulario.Add(new StringContent(alt), "alt");
            return formulario;
        }

        async Task<int> SubirAsync(HttpClient cliente, string ruta, string alt)
        {
            using var formulario = Formulario(alt);
            var respuesta = ruta.Contains("/externo/", StringComparison.Ordinal)
                ? await TestigoDelCanalExterno.PostAsync(cliente, ruta, formulario)
                : await cliente.PostAsync(ruta, formulario);
            Assert.True(respuesta.IsSuccessStatusCode, await respuesta.Content.ReadAsStringAsync());
            return (await respuesta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        }

        var consola = await CmsTestClient.LoginAsync(_factory);
        var delPrograma = await SubirAsync(consola, "/api/v1/institucional/archivos", "Imagen del PNMC");

        var (ana, _) = await PersonaAsync("dedup.ana@example.com", "53001001");
        var (beto, _) = await PersonaAsync("dedup.beto@example.com", "53001002");
        var deAna = await SubirAsync(ana, "/api/v1/externo/cuenta/perfil-publico/foto", "Retrato de Ana");
        var deBeto = await SubirAsync(beto, "/api/v1/externo/cuenta/perfil-publico/foto", "Retrato de Beto");

        Assert.Equal(3, new[] { delPrograma, deAna, deBeto }.Distinct().Count());

        // Dentro de un mismo dueño sí se reutiliza.
        Assert.Equal(deAna, await SubirAsync(ana, "/api/v1/externo/cuenta/perfil-publico/foto", "Otra vez"));
        Assert.Equal(delPrograma, await SubirAsync(consola, "/api/v1/institucional/archivos", "Otra vez"));

        // Y la foto propia se puede usar en el perfil.
        var solicitud = Perfil();
        solicitud.ArchivoFotoId = deBeto;
        var guardado = await EnviarAsync(beto, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);
        Assert.True(guardado.IsSuccessStatusCode, await guardado.Content.ReadAsStringAsync());
    }

    // ── Perfil enriquecido (ME, docs/desarrollo/19-cuentas-y-organizaciones.md §19.12) ───────────────────────────────────────────────

    [Fact]
    public async Task Mostrar_una_organizacion_exige_elegirla_estar_en_ella_no_basta()
    {
        var (sesion, id) = await PersonaAsync("perfil.optin@example.com", "53000881");
        var elegida = await OrganizacionAsync(id, "Escuela elegida", "activa");
        var callada = await OrganizacionAsync(id, "Escuela que no muestro", "activa");

        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", PerfilMostrando([elegida]));
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        await PublicarAsync(sesion);

        Assert.Equal([elegida], mio.IdsOrganizacionesVisibles);
        var anonimo = _factory.CreateClient();
        var publico = await anonimo.GetFromJsonAsync<PerfilPublicoDto>($"/api/v1/publico/personas/{mio.Clave}");
        Assert.Contains(publico!.Organizaciones, organizacion => organizacion.Id == elegida);
        Assert.DoesNotContain(publico.Organizaciones, organizacion => organizacion.Id == callada);
        // La ficha de la organización que no mostró no lista a la persona.
        var ficha = await anonimo.GetFromJsonAsync<OrganizacionPublicaDto>($"/api/v1/publico/organizaciones/{callada}");
        Assert.Empty(ficha!.Personas);
    }

    [Fact]
    public async Task No_se_puede_mostrar_una_organizacion_ajena()
    {
        var (sesion, id) = await PersonaAsync("perfil.ajena@example.com", "53000882");
        await OrganizacionAsync(id, "Mi organización", "activa");
        var (_, otro) = await PersonaAsync("perfil.otro@example.com", "53000883");
        var ajena = await OrganizacionAsync(otro, "Organización ajena", "activa");

        var respuesta = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", PerfilMostrando([ajena]));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("idsOrganizaciones", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task La_ficha_lleva_biografia_roles_y_portafolio_y_nunca_el_correo_ni_el_documento()
    {
        const string correo = "perfil.rico@example.com";
        const string documento = "53000884";
        var (sesion, _) = await PersonaAsync(correo, documento);
        var solicitud = Perfil("https://gaita.example.org/rica");
        solicitud.BiografiaCorta = "Gaitera y maestra de gaita.";
        solicitud.BiografiaLarga = "Aprendí con mi abuelo en los Montes de María y hoy enseño en la escuela del barrio.";
        solicitud.Oficios = ["Intérprete", "Maestra", "intérprete"];
        solicitud.Portafolio =
        [
            new ItemDePortafolioDto("audio", "Cumbia de gaitas", "https://musica.example.org/cumbia"),
            new ItemDePortafolioDto("video", "Concierto 2025", "youtube.com/watch?v=demo"),
        ];
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        await PublicarAsync(sesion);

        // Los roles no se repiten (sin distinguir mayúsculas) y la dirección sin esquema se guarda con https.
        Assert.Equal(["Intérprete", "Maestra"], mio.Oficios);
        Assert.Equal("https://youtube.com/watch?v=demo", mio.Portafolio![1].Url);

        var crudo = await _factory.CreateClient().GetStringAsync($"/api/v1/publico/personas/{mio.Clave}");
        Assert.Contains("Gaitera y maestra de gaita.", crudo, StringComparison.Ordinal);
        Assert.Contains("Montes de María", crudo, StringComparison.Ordinal);
        Assert.Contains("Cumbia de gaitas", crudo, StringComparison.Ordinal);
        Assert.DoesNotContain(correo, crudo, StringComparison.Ordinal);
        Assert.DoesNotContain(documento, crudo, StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_nombre_civil_solo_sale_si_la_persona_lo_consiente()
    {
        var (sesion, _) = await PersonaAsync("perfil.civil@example.com", "53000885");
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", Perfil());
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        await PublicarAsync(sesion);
        var anonimo = _factory.CreateClient();

        // SIN CONSENTIMIENTO: el nombre civil no viaja, aunque la persona lo vea para decidir.
        Assert.False(mio.NombreCivilVisible);
        Assert.False(string.IsNullOrWhiteSpace(mio.NombreCivilPropio));
        var sinConsentimiento = await anonimo.GetFromJsonAsync<PerfilPublicoDto>($"/api/v1/publico/personas/{mio.Clave}");
        Assert.Null(sinConsentimiento!.NombreCivil);

        var solicitud = Perfil();
        solicitud.NombreCivilVisible = true;
        await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);
        var conConsentimiento = await anonimo.GetFromJsonAsync<PerfilPublicoDto>($"/api/v1/publico/personas/{mio.Clave}");
        Assert.Equal(mio.NombreCivilPropio, conConsentimiento!.NombreCivil);
    }

    [Fact]
    public async Task El_nombre_civil_sale_tambien_para_una_cuenta_que_solo_tiene_el_nombre_completo()
    {
        // Las cuentas anteriores al nombre partido (y las de organización) solo tienen `FullName`: marcar la casilla
        // no hacía nada porque el nombre civil se armaba solo con las cuatro partes.
        var (sesion, id) = await PersonaAsync("perfil.civil.antiguo@example.com", "53000889");
        using (var alcance = _factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var usuario = await db.Users.SingleAsync(item => item.Id == id);
            usuario.PrimerNombre = null; usuario.SegundoNombre = null; usuario.PrimerApellido = null; usuario.SegundoApellido = null;
            usuario.FullName = "Rosa Elena Caicedo";
            await db.SaveChangesAsync();
        }
        var solicitud = Perfil();
        solicitud.NombreCivilVisible = true;
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        await PublicarAsync(sesion);

        Assert.Equal("Rosa Elena Caicedo", mio.NombreCivilPropio);
        Assert.True(mio.NombreCivilVisible);
        var publico = await _factory.CreateClient().GetFromJsonAsync<PerfilPublicoDto>($"/api/v1/publico/personas/{mio.Clave}");
        Assert.Equal("Rosa Elena Caicedo", publico!.NombreCivil);
    }

    [Fact]
    public async Task Un_perfil_solo_simus_no_lo_ve_el_publico_pero_si_quien_tiene_cuenta()
    {
        var (sesion, id) = await PersonaAsync("perfil.solosimus@example.com", "53000886");
        var organizacion = await OrganizacionAsync(id, "Escuela del solo SIMUS", "activa");
        var solicitud = PerfilMostrando([organizacion]);
        solicitud.Visibilidad = "solo_simus";
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        await PublicarAsync(sesion);
        Assert.Equal("solo_simus", mio.Visibilidad);

        var anonimo = _factory.CreateClient();
        // EL PÚBLICO RECIBE 404 SIN CUERPO, el mismo de «no existe» y de «oculto».
        var sinSesion = await anonimo.GetAsync($"/api/v1/publico/personas/{mio.Clave}");
        Assert.Equal(HttpStatusCode.NotFound, sinSesion.StatusCode);
        Assert.Equal(string.Empty, await sinSesion.Content.ReadAsStringAsync());
        // Y la ficha de la organización no lo lista.
        var ficha = await anonimo.GetFromJsonAsync<OrganizacionPublicaDto>($"/api/v1/publico/organizaciones/{organizacion}");
        Assert.Empty(ficha!.Personas);

        // QUIEN TIENE CUENTA EN SIMUS LO VE.
        var (otra, _) = await PersonaAsync("perfil.vecina@example.com", "53000887");
        Assert.Equal(HttpStatusCode.OK, (await otra.GetAsync($"/api/v1/publico/personas/{mio.Clave}")).StatusCode);

        // Cambiarlo a público lo abre a cualquiera.
        var abierto = Perfil();
        abierto.Visibilidad = "publico";
        await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", abierto);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/personas/{mio.Clave}")).StatusCode);
    }

    /// <summary>
    /// La foto de un perfil «solo SIMUS» solo se sirve con sesión; la de uno público sigue anónima (docs/desarrollo/19-cuentas-y-organizaciones.md §19.12).
    /// </summary>
    [Fact]
    public async Task La_foto_de_un_perfil_solo_simus_solo_se_sirve_con_sesion()
    {
        var (sesion, _) = await PersonaAsync("perfil.fotosolosimus@example.com", "53000897");
        using var formulario = new MultipartFormDataContent();
        var png = new ByteArrayContent(Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="));
        png.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        formulario.Add(png, "file", "solo-simus.png");
        formulario.Add(new StringContent("Retrato solo SIMUS"), "alt");
        var subida = await TestigoDelCanalExterno.PostAsync(sesion, "/api/v1/externo/cuenta/perfil-publico/foto", formulario);
        Assert.True(subida.IsSuccessStatusCode, await subida.Content.ReadAsStringAsync());
        var foto = (await subida.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        var ruta = $"/api/v1/publico/archivos/{foto}";

        var solicitud = Perfil();
        solicitud.ArchivoFotoId = foto;
        solicitud.Visibilidad = "solo_simus";
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);
        Assert.True(guardado.IsSuccessStatusCode, await guardado.Content.ReadAsStringAsync());
        await PublicarAsync(sesion);

        var anonimo = _factory.CreateClient();
        var sinSesion = await anonimo.GetAsync(ruta);
        Assert.Equal(HttpStatusCode.NotFound, sinSesion.StatusCode);
        Assert.Equal(string.Empty, await sinSesion.Content.ReadAsStringAsync());
        // Igual que un archivo que no existe.
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync("/api/v1/publico/archivos/2147000000")).StatusCode);

        var (otra, _) = await PersonaAsync("perfil.fotovecina@example.com", "53000898");
        Assert.Equal(HttpStatusCode.OK, (await otra.GetAsync(ruta)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await sesion.GetAsync(ruta)).StatusCode);
        var consola = await CmsTestClient.LoginAsync(_factory);
        Assert.Equal(HttpStatusCode.OK, (await consola.GetAsync(ruta)).StatusCode);

        // Si el perfil se abre al público, la foto también.
        solicitud.Visibilidad = "publico";
        await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync(ruta)).StatusCode);
    }

    [Fact]
    public async Task El_portafolio_guarda_clase_descripcion_y_anio_y_conserva_los_elementos_de_antes()
    {
        var (sesion, _) = await PersonaAsync("perfil.portafolio.nuevo@example.com", "53000990");
        var solicitud = Perfil("https://gaita.example.org/portafolio");
        solicitud.Portafolio =
        [
            // Un elemento «de antes»: sin descripción ni año, con la clase de entonces.
            new ItemDePortafolioDto("enlace", "Mi sitio", "https://sitio.example.org"),
            new ItemDePortafolioDto("texto", "Crónica de un festival", "https://prensa.example.org/cronica", "  Reseña publicada en la prensa regional.  ", 2024),
            new ItemDePortafolioDto("imagen", "Afiche", "afiches.example.org/2025", null, 2025),
        ];

        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);

        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        Assert.Equal(["enlace", "texto", "imagen"], mio.Portafolio!.Select(i => i.Tipo));
        Assert.Null(mio.Portafolio![0].Descripcion);
        Assert.Null(mio.Portafolio![0].Anio);
        Assert.Equal("Reseña publicada en la prensa regional.", mio.Portafolio![1].Descripcion);
        Assert.Equal(2024, mio.Portafolio![1].Anio);
        Assert.Equal("https://afiches.example.org/2025", mio.Portafolio![2].Url);
    }

    [Theory]
    [InlineData("anio-antiguo")]
    [InlineData("anio-futuro")]
    [InlineData("clase-desconocida")]
    [InlineData("descripcion-larga")]
    public async Task El_portafolio_rechaza_lo_que_no_cumple_su_regla(string caso)
    {
        var (sesion, _) = await PersonaAsync($"perfil.portafolio.{caso}@example.com", caso switch { "anio-antiguo" => "53000991", "anio-futuro" => "53000992", "clase-desconocida" => "53000993", _ => "53000994" });
        var solicitud = Perfil();
        solicitud.Portafolio = [caso switch
        {
            "anio-antiguo" => new ItemDePortafolioDto("audio", "Viejo", "https://a.example.org/x", null, 1850),
            "anio-futuro" => new ItemDePortafolioDto("audio", "Futuro", "https://a.example.org/x", null, DateTime.UtcNow.Year + 5),
            "clase-desconocida" => new ItemDePortafolioDto("archivo", "Un archivo", "https://a.example.org/x"),
            _ => new ItemDePortafolioDto("audio", "Largo", "https://a.example.org/x", new string('d', 301)),
        }];

        var respuesta = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("portafolio", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Un_enlace_otro_guarda_su_etiqueta_y_los_de_antes_se_leen_sin_ella()
    {
        var (sesion, _) = await PersonaAsync("perfil.enlaces.etiqueta@example.com", "53000996");
        var solicitud = Perfil("https://instagram.com/lucia", "https://mi-sitio.example.org");
        solicitud.EtiquetasDeEnlaces = [null, "  Mi sitio  "];

        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        Assert.Equal(["https://instagram.com/lucia", "https://mi-sitio.example.org"], mio.Enlaces);
        Assert.Equal([null, "Mi sitio"], mio.EtiquetasDeEnlaces);

        // Sin el arreglo de rótulos (cliente anterior) se guarda igual y quedan sin etiqueta.
        var anterior = Perfil("https://instagram.com/lucia");
        var sinRotulos = (await (await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", anterior)).Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        Assert.Equal([null], sinRotulos.EtiquetasDeEnlaces);
    }

    [Fact]
    public async Task El_rotulo_de_un_enlace_no_pasa_de_sesenta_caracteres()
    {
        var (sesion, _) = await PersonaAsync("perfil.enlaces.etiqueta.larga@example.com", "53000997");
        var solicitud = Perfil("https://mi-sitio.example.org");
        solicitud.EtiquetasDeEnlaces = [new string('e', 61)];

        var respuesta = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("enlaces", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Los_enlaces_del_perfil_no_se_repiten()
    {
        var (sesion, _) = await PersonaAsync("perfil.enlaces.repetidos@example.com", "53000995");
        var solicitud = Perfil("https://instagram.com/lucia", "instagram.com/lucia");

        var respuesta = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("enlaces", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("biografiaCorta")]
    [InlineData("oficios")]
    [InlineData("portafolio")]
    [InlineData("visibilidad")]
    public async Task Lo_enriquecido_se_valida_en_el_servidor(string campo)
    {
        var (sesion, _) = await PersonaAsync($"perfil.valida.{campo.ToLowerInvariant()}@example.com", campo == "oficios" ? "53000891" : campo == "portafolio" ? "53000892" : campo == "visibilidad" ? "53000893" : "53000896");
        var solicitud = Perfil();
        switch (campo)
        {
            case "biografiaCorta": solicitud.BiografiaCorta = new string('a', 281); break;
            case "oficios": solicitud.Oficios = [.. Enumerable.Range(1, 9).Select(n => $"Rol {n}")]; break;
            case "portafolio": solicitud.Portafolio = [new ItemDePortafolioDto("audio", "Sin https", "ftp://inseguro.example.org/a")]; break;
            case "visibilidad": solicitud.Visibilidad = "privado"; break;
        }

        var respuesta = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", solicitud);

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains(campo, await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_historial_del_perfil_lo_lee_su_titular_y_nombra_cada_campo_que_cambio()
    {
        var (sesion, _) = await PersonaAsync("perfil.historia@example.com", "53000894");
        await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", Perfil());
        var segundo = Perfil();
        segundo.NombreVisible = "Lucía la maestra";
        segundo.BiografiaCorta = "Ahora enseño.";
        await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", segundo);

        var historial = await sesion.GetFromJsonAsync<List<CambioDePerfilPublicoDto>>("/api/v1/externo/cuenta/perfil-publico/historial");

        Assert.Contains(historial!, cambio => cambio.Campo == "Nombre artístico" && cambio.Anterior == "Lucía la gaitera" && cambio.Nuevo == "Lucía la maestra");
        Assert.Contains(historial!, cambio => cambio.Campo == "Biografía corta" && cambio.Nuevo == "Ahora enseño.");
        // Otra persona no lee ese historial: el de ella está vacío.
        var (otra, _) = await PersonaAsync("perfil.otra.historia@example.com", "53000895");
        var suyo = await otra.GetFromJsonAsync<List<CambioDePerfilPublicoDto>>("/api/v1/externo/cuenta/perfil-publico/historial");
        Assert.Empty(suyo!);
    }
}
