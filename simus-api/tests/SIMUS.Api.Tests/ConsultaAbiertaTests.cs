using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.ConsultaAbierta;
using SIMUS.Api.ConsultaGuiada;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La CONSULTA ABIERTA pública: validador estricto, ejecutor determinista y endpoint con el doble determinista (sin modelo real).
/// </summary>
public sealed class ConsultaAbiertaTests
{
    private const string Estado = "/api/v1/publico/consulta-abierta/estado";
    private const string Consultar = "/api/v1/publico/consulta-abierta/consultar";
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private static readonly DateOnly Hoy = new(2026, 11, 23);

    // ───────────── Validador ─────────────

    private static CatalogosSemanticos Catalogos() => new()
    {
        Vocabulario = VocabularioTerritorial.Construir(
        [
            new("52", "Nariño", "52001", "Pasto"), new("52", "Nariño", "52835", "Tumaco"),
            new("05", "Antioquia", "05001", "Medellín"), new("05", "Antioquia", "05045", "San Andrés"),
            new("88", "San Andrés y Providencia", "88001", "San Andrés"),
            new("11", "Bogotá, D.C.", "11001", "Bogotá, D.C."),
        ]),
        Departamentos = new Dictionary<string, string> { ["52"] = "NARIÑO", ["05"] = "ANTIOQUIA", ["88"] = "SAN ANDRÉS", ["11"] = "BOGOTÁ, D.C." },
        Municipios = new Dictionary<string, string> { ["52001"] = "PASTO", ["52835"] = "TUMACO", ["05001"] = "MEDELLÍN", ["05045"] = "SAN ANDRÉS", ["88001"] = "SAN ANDRÉS", ["11001"] = "BOGOTÁ, D.C." },
        Practicas = ["Chirimía", "Vallenato"],
        Territorios = ["Andino"],
        Organizaciones = [(1, "Corporación Sonora")],
    };

    private static ResultadoDeValidacion Validar(ConsultaEstructuradaDto consulta) => ValidadorDeConsulta.Validar(consulta, Catalogos(), Hoy);

    private static ConsultaEstructuradaDto Q(string entidad, params (string Campo, string Op, string Valor)[] filtros) => new()
    {
        Entidad = entidad,
        Filtros = filtros.Select(f => new FiltroDeConsultaDto { Campo = f.Campo, Operador = f.Op, Valor = f.Valor }).ToList(),
    };

    [Fact]
    public void Una_consulta_valida_se_resuelve_contra_los_catalogos_y_queda_canonica()
    {
        var resultado = Validar(Q("festivales", ("departamento", "eq", "narino"), ("practica", "eq", "chirimia")));
        Assert.True(resultado.Valida, string.Join(" ", resultado.Errores));
        var canonica = resultado.Consulta!.Canonica;
        Assert.Equal("festivales", canonica.Entidad);
        Assert.Equal("Nariño", canonica.Filtros![0].Valor);
        Assert.Equal("Chirimía", canonica.Filtros[1].Valor);
        Assert.Equal(20, canonica.Limite);
        // La canónica se vuelve a validar igual: es lo que el cliente reenvía al editar filtros.
        Assert.True(Validar(canonica).Valida);
    }

    [Theory]
    [InlineData("usuarios")]
    [InlineData("personas")]
    [InlineData("festivales; DROP TABLE Festivales")]
    [InlineData("")]
    [InlineData(null)]
    public void Una_entidad_fuera_del_catalogo_se_rechaza(string? entidad) =>
        Assert.False(Validar(new ConsultaEstructuradaDto { Entidad = entidad }).Valida);

    [Theory]
    [InlineData("correo", "eq", "a@b.c")]
    [InlineData("telefono", "eq", "300")]
    [InlineData("estado", "eq", "borrador")]
    [InlineData("nombre; DROP", "eq", "x")]
    [InlineData("departamento", "like", "x")]
    [InlineData("departamento", "gt", "Nariño")]
    [InlineData("nombre", "gte", "x")]
    [InlineData("departamento", "eq", "05' OR 1=1 --")]
    [InlineData("departamento", "eq", "Narnia")]
    [InlineData("practica", "eq", "Reguetón inexistente")]
    public void Un_campo_un_operador_o_un_valor_fuera_de_lista_se_rechaza(string campo, string operador, string valor) =>
        Assert.False(Validar(Q("festivales", (campo, operador, valor))).Valida);

    [Fact]
    public void Los_valores_de_texto_se_toman_como_literales_y_los_excesivos_o_con_control_se_rechazan()
    {
        Assert.True(Validar(Q("festivales", ("nombre", "contiene", "'; DROP TABLE x; --"))).Valida);
        Assert.False(Validar(Q("festivales", ("nombre", "contiene", new string('a', 81)))).Valida);
        Assert.False(Validar(Q("festivales", ("nombre", "contiene", "a\u0000b"))).Valida);
    }

    [Fact]
    public void Los_limites_de_filtros_agrupaciones_y_filas_se_hacen_cumplir()
    {
        var muchos = Q("festivales", Enumerable.Range(0, 7).Select(_ => ("departamento", "eq", "Nariño")).ToArray());
        Assert.False(Validar(muchos).Valida);
        var tres = Q("festivales");
        tres.Agrupar = ["departamento", "municipio", "practica"];
        Assert.False(Validar(tres).Valida);
        var grande = Q("festivales");
        grande.Limite = 100000;
        Assert.Equal(CatalogoSemantico.LimiteMaximo, Validar(grande).Consulta!.Limite);
        grande.Limite = -3;
        Assert.Equal(CatalogoSemantico.LimitePorOmision, Validar(grande).Consulta!.Limite);
    }

    [Fact]
    public void Las_metricas_y_la_agrupacion_solo_admiten_campos_declarados()
    {
        var suma = Q("festivales");
        suma.Metrica = new MetricaDeConsultaDto { Funcion = "sum", Campo = "departamento" };
        Assert.False(Validar(suma).Valida);
        suma.Metrica = new MetricaDeConsultaDto { Funcion = "drop", Campo = null };
        Assert.False(Validar(suma).Valida);
        var ok = Q("organizaciones");
        ok.Metrica = new MetricaDeConsultaDto { Funcion = "sum", Campo = "procesos" };
        Assert.True(Validar(ok).Valida);
        // Tolerancia con tropiezos del modelo (sin ampliar lo permitido): agrupar por nombre se descarta y «contar» pasa a ser lista.
        var porNombre = Q("festivales");
        porNombre.Agrupar = ["nombre"];
        porNombre.Metrica = new MetricaDeConsultaDto { Funcion = "count" };
        var tolerada = Validar(porNombre);
        Assert.True(tolerada.Valida);
        Assert.Empty(tolerada.Consulta!.Agrupar);
        Assert.False(tolerada.Consulta.HayMetrica);
        Assert.NotEmpty(tolerada.Consulta.Notas);
        // Un orden por un campo inexistente nunca llega a ejecutarse como tal: se usa el habitual.
        var orden = Q("festivales");
        orden.Orden = new OrdenDeConsultaDto { Campo = "contrasena", Direccion = "asc" };
        Assert.Equal("nombre", Validar(orden).Consulta!.OrdenCampo);
        // Un filtro sin valor no filtra: se descarta; uno repetido se cuenta una vez; «contiene» sobre un catálogo es «eq».
        var tolerante = Q("festivales", ("departamento", "neq", ""), ("practica", "contiene", "chirimia"), ("practica", "eq", "Chirimía"));
        var filtros = Validar(tolerante).Consulta!.Filtros;
        Assert.Single(filtros);
        Assert.Equal("eq", filtros[0].Operador);
    }

    [Fact]
    public void Un_municipio_dicho_como_departamento_se_corrige_y_un_nombre_repetido_pide_precision()
    {
        var corregido = Validar(Q("festivales", ("departamento", "eq", "Pasto")));
        Assert.True(corregido.Valida);
        Assert.Equal("municipio", corregido.Consulta!.Filtros[0].Campo.Nombre);
        Assert.NotEmpty(corregido.Consulta.Notas);
        // «San Andrés» es municipio de dos departamentos (y nombre de uno): ambiguo por nombre, válido por código.
        Assert.False(Validar(Q("festivales", ("municipio", "eq", "San Andrés"))).Valida);
        Assert.True(Validar(Q("festivales", ("municipio", "eq", "05045"))).Valida);
        Assert.False(Validar(Q("festivales", ("municipio", "eq", "99999"))).Valida);
    }

    [Fact]
    public void Las_fechas_y_los_numeros_se_validan_y_los_meses_se_aceptan_por_nombre()
    {
        Assert.True(Validar(Q("eventos", ("fecha", "gte", "hoy"))).Valida);
        Assert.True(Validar(Q("eventos", ("fecha", "gte", "2026-12-01"))).Valida);
        Assert.False(Validar(Q("eventos", ("fecha", "gte", "mañana"))).Valida);
        Assert.False(Validar(Q("eventos", ("mes", "eq", "13"))).Valida);
        Assert.Equal("12", Validar(Q("eventos", ("mes", "eq", "Diciembre"))).Consulta!.Canonica.Filtros![0].Valor);
        Assert.False(Validar(Q("eventos", ("anio", "eq", "abc"))).Valida);
    }

    // ───────────── Ejecutor ─────────────

    private static FilaSemantica Fila(string nombre, string? depto, string? codigo, params string[] practicas) =>
        new(new Dictionary<string, object?> { ["nombre"] = nombre, ["departamento"] = depto, ["practica"] = practicas.ToList() },
            new Dictionary<string, string?> { ["departamento"] = codigo }, "/ecosistema/festivales/1");

    [Fact]
    public void El_ejecutor_filtra_agrupa_cuenta_y_ordena_de_forma_determinista()
    {
        var filas = new List<FilaSemantica>
        {
            Fila("A", "Nariño", "52", "Chirimía"), Fila("B", "Nariño", "52", "Chirimía", "Vallenato"),
            Fila("C", "Antioquia", "05", "Vallenato"), Fila("D", null, null),
        };
        var catalogos = Catalogos();

        var porPractica = Validar(new ConsultaEstructuradaDto { Entidad = "festivales", Agrupar = ["practica"], Metrica = new() { Funcion = "count" } });
        var tabla = EjecutorDeConsulta.Ejecutar(porPractica.Consulta!, filas, catalogos).Tabla;
        Assert.Equal(["Chirimía", "2"], tabla.Filas[0]); // empate: orden alfabético
        Assert.Equal(["Vallenato", "2"], tabla.Filas[1]);
        Assert.Equal(["Sin dato", "1"], tabla.Filas[2]);

        var enNarino = Validar(Q("festivales", ("departamento", "eq", "Nariño")));
        var resultado = EjecutorDeConsulta.Ejecutar(enNarino.Consulta!, filas, catalogos);
        Assert.Equal(2, resultado.Tabla.Filas.Count);
        Assert.Equal("/ecosistema/festivales/1", resultado.Tabla.Destinos![0]);
        Assert.Contains("Solo registros publicados", resultado.Tabla.FiltrosAplicados!);

        var neq = Validar(Q("festivales", ("departamento", "neq", "Nariño")));
        Assert.Equal(2, EjecutorDeConsulta.Ejecutar(neq.Consulta!, filas, catalogos).Tabla.Filas.Count);

        var cuenta = Validar(new ConsultaEstructuradaDto { Entidad = "festivales", Metrica = new() { Funcion = "count" } });
        Assert.Equal("4", EjecutorDeConsulta.Ejecutar(cuenta.Consulta!, filas, catalogos).Tabla.Filas[0][0]);

        var limitado = Q("festivales");
        limitado.Limite = 2;
        var dos = EjecutorDeConsulta.Ejecutar(Validar(limitado).Consulta!, filas, catalogos);
        Assert.Equal(2, dos.Tabla.Filas.Count);
        Assert.Contains("se muestran 2", dos.Resumen, StringComparison.Ordinal);
    }

    [Fact]
    public void Al_agrupar_por_mes_se_lee_el_nombre_del_mes_y_el_resumen_concuerda_con_la_tabla()
    {
        FilaSemantica Evento(int mes) => new(new Dictionary<string, object?> { ["titulo"] = "E", ["mes"] = (decimal)mes }, new Dictionary<string, string?>(), "/agenda");
        var filas = new List<FilaSemantica> { Evento(11), Evento(11), Evento(12) };
        var validada = Validar(new ConsultaEstructuradaDto { Entidad = "eventos", Agrupar = ["mes"], Metrica = new() { Funcion = "count" } });
        var resultado = EjecutorDeConsulta.Ejecutar(validada.Consulta!, filas, Catalogos());
        Assert.Equal(["Noviembre", "2"], resultado.Tabla.Filas[0]);
        Assert.Equal(["Diciembre", "1"], resultado.Tabla.Filas[1]);
        Assert.Contains("«Noviembre» con 2", resultado.Resumen, StringComparison.Ordinal);
        Assert.Equal("linea", resultado.Grafico);
    }

    // ───────────── Endpoint con el doble determinista ─────────────

    private static WebApplicationFactory<Program> ConDoble(TestWebApplicationFactory fabrica, InterpreteDoble? doble) =>
        fabrica.WithWebHostBuilder(constructor => constructor.ConfigureTestServices(servicios =>
        {
            if (doble is null) return;
            foreach (var d in servicios.Where(s => s.ServiceType == typeof(IInterpreteDeConsultas)).ToList()) servicios.Remove(d);
            servicios.AddSingleton<IInterpreteDeConsultas>(doble);
        }));

    private static async Task<string> SembrarAsync(WebApplicationFactory<Program> fabrica)
    {
        using var alcance = fabrica.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var marca = "ZZ" + Guid.NewGuid().ToString("N")[..6];
        var ahora = DateTime.UtcNow;
        var hoy = DateOnly.FromDateTime(ahora);
        db.FestivalRecords.AddRange(
            new FestivalRow { Name = "Festival publicado " + marca, CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = EstadosFestival.Publicado, ContactEmail = marca + "@privado.test", ContactPhone = "3001112233", CreatedAt = ahora },
            new FestivalRow { Name = "Festival en revisión " + marca, CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = EstadosFestival.EnRevision, CreatedAt = ahora });
        db.Talleres.Add(new TallerRow { Nombre = "Taller publicado " + marca, NivelCobertura = "municipal", CodigoDepartamento = "05", CodigoMunicipio = "05001", EstadoRegistro = "publicado", Activo = true, FechaCreacion = ahora });
        db.Talleres.Add(new TallerRow { Nombre = "Taller borrador " + marca, NivelCobertura = "municipal", CodigoDepartamento = "05", CodigoMunicipio = "05001", EstadoRegistro = "en_revision", Activo = true, FechaCreacion = ahora });
        db.EventosAgenda.AddRange(
            new EventoAgendaRow { Slug = "p-" + marca, Titulo = "Evento publicado " + marca, Descripcion = "d", FechaInicio = hoy.AddDays(2), Estado = "publicado", CodigoDepartamento = "05", CodigoMunicipio = "05001", Organizador = "Persona Privada " + marca, FechaCreacion = ahora, FechaActualizacion = ahora },
            new EventoAgendaRow { Slug = "b-" + marca, Titulo = "Evento borrador " + marca, Descripcion = "d", FechaInicio = hoy.AddDays(2), Estado = "borrador", CodigoDepartamento = "05", CodigoMunicipio = "05001", FechaCreacion = ahora, FechaActualizacion = ahora });
        await db.SaveChangesAsync();
        return marca;
    }

    private static async Task<RespuestaDeConsultaAbiertaDto> PreguntarAsync(HttpClient cliente, object cuerpo, HttpStatusCode esperado = HttpStatusCode.OK)
    {
        var respuesta = await cliente.PostAsJsonAsync(Consultar, cuerpo);
        Assert.Equal(esperado, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<RespuestaDeConsultaAbiertaDto>(Web))!;
    }

    private static InterpreteDoble Doble(Func<string, ConsultaEstructuradaDto?> regla) =>
        new(pregunta => regla(pregunta) is { } c ? ResultadoDeInterpretacion.De(c) : new(EstadoDeInterpretacion.JsonInvalido, null));

    [Fact]
    public async Task Sin_modelo_la_consulta_abierta_lo_dice_y_ofrece_preguntas_cercanas_y_el_estado_lo_declara()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = fabrica.CreateClient();
        var estado = (await cliente.GetFromJsonAsync<EstadoDeConsultaAbiertaDto>(Estado, Web))!;
        Assert.False(estado.ModeloDisponible);
        Assert.Equal(200, estado.MaximoDePregunta);
        Assert.Contains(estado.Entidades, e => e.Id == "festivales");
        // Nada personal en el catálogo semántico.
        var campos = estado.Entidades.SelectMany(e => e.Campos.Select(c => c.Nombre)).ToList();
        Assert.DoesNotContain(campos, c => c.Contains("correo", StringComparison.Ordinal) || c.Contains("telefono", StringComparison.Ordinal) || c.Contains("organizador", StringComparison.Ordinal));
        Assert.DoesNotContain(estado.Entidades, e => e.Id is "personas" or "usuarios");

        var respuesta = await PreguntarAsync(cliente, new { pregunta = "festivales con circulación de músicas" });
        Assert.Equal("sin_modelo", respuesta.Estado);
        Assert.Null(respuesta.Tabla);
    }

    [Fact]
    public async Task Con_el_doble_la_consulta_abierta_responde_solo_con_lo_publicado_y_sin_contacto()
    {
        var doble = Doble(_ => Q("procesos", ("departamento", "eq", "Antioquia")));
        await using var fabricaBase = new TestWebApplicationFactory();
        await using var fabrica = ConDoble(fabricaBase, doble);
        var marca = await SembrarAsync(fabrica);
        var cliente = fabrica.CreateClient();

        var respuesta = await PreguntarAsync(cliente, new { pregunta = "qué hay en Antioquia" });
        Assert.Equal("ok", respuesta.Estado);
        Assert.Equal("modelo", respuesta.Via);
        var texto = JsonSerializer.Serialize(respuesta);
        Assert.Contains("Festival publicado " + marca, texto, StringComparison.Ordinal);
        Assert.Contains("Taller publicado " + marca, texto, StringComparison.Ordinal);
        Assert.DoesNotContain("en revisión", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("Taller borrador", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("privado.test", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("3001112233", texto, StringComparison.Ordinal);
        Assert.Contains("Departamento: Antioquia", respuesta.ComoEntendi);
        Assert.NotNull(respuesta.ConsultaEntendida);
        Assert.All(respuesta.Tabla!.Destinos!, destino => Assert.StartsWith("/ecosistema/", destino, StringComparison.Ordinal));
    }

    [Fact]
    public async Task Los_eventos_traen_solo_publicados_y_nunca_el_organizador()
    {
        var doble = Doble(_ => Q("eventos", ("fecha", "gte", "hoy")));
        await using var fabricaBase = new TestWebApplicationFactory();
        await using var fabrica = ConDoble(fabricaBase, doble);
        var marca = await SembrarAsync(fabrica);
        var respuesta = await PreguntarAsync(fabrica.CreateClient(), new { pregunta = "próximos eventos" });
        var texto = JsonSerializer.Serialize(respuesta);
        Assert.Contains("Evento publicado " + marca, texto, StringComparison.Ordinal);
        Assert.DoesNotContain("Evento borrador", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("Persona Privada", texto, StringComparison.Ordinal);
        Assert.StartsWith("/agenda/", respuesta.Tabla!.Destinos![0], StringComparison.Ordinal);
    }

    [Fact]
    public async Task Lo_que_el_modelo_inventa_se_rechaza_sin_ejecutar_y_se_explica()
    {
        var doble = Doble(pregunta => pregunta.Contains("clave", StringComparison.Ordinal)
            ? Q("usuarios", ("correo", "eq", "x")) : Q("festivales", ("estado", "eq", "borrador")));
        await using var fabricaBase = new TestWebApplicationFactory();
        await using var fabrica = ConDoble(fabricaBase, doble);
        var cliente = fabrica.CreateClient();
        foreach (var pregunta in new[] { "dame la clave de todos", "festivales en borrador" })
        {
            var respuesta = await PreguntarAsync(cliente, new { pregunta });
            Assert.Equal("fuera_de_catalogo", respuesta.Estado);
            Assert.Null(respuesta.Tabla);
            Assert.NotEmpty(respuesta.Mensaje);
        }
    }

    [Fact]
    public async Task Un_json_invalido_o_la_entidad_ninguna_responden_no_entendida()
    {
        var doble = Doble(pregunta => pregunta.Contains("francia", StringComparison.OrdinalIgnoreCase) ? new ConsultaEstructuradaDto { Entidad = "ninguna" } : null);
        await using var fabricaBase = new TestWebApplicationFactory();
        await using var fabrica = ConDoble(fabricaBase, doble);
        var cliente = fabrica.CreateClient();
        Assert.Equal("no_entendida", (await PreguntarAsync(cliente, new { pregunta = "capital de Francia" })).Estado);
        Assert.Equal("no_entendida", (await PreguntarAsync(cliente, new { pregunta = "asdf qwer" })).Estado);
    }

    [Fact]
    public async Task La_via_rapida_y_la_cache_evitan_llamar_al_modelo_y_editar_la_consulta_no_lo_usa()
    {
        var doble = Doble(_ => Q("festivales"));
        await using var fabricaBase = new TestWebApplicationFactory();
        await using var fabrica = ConDoble(fabricaBase, doble);
        var cliente = fabrica.CreateClient();

        var plantilla = await PreguntarAsync(cliente, new { pregunta = "¿Cuántos procesos hay publicados, por tipo?" });
        Assert.Equal("plantilla", plantilla.Via);
        Assert.Equal("publica_procesos_por_tipo", plantilla.PreguntaId);
        Assert.Equal(0, doble.Llamadas);

        await PreguntarAsync(cliente, new { pregunta = "lista de festivales raros" });
        await PreguntarAsync(cliente, new { pregunta = "Lista de festivales  raros!" });
        Assert.Equal(1, doble.Llamadas);

        var editada = await PreguntarAsync(cliente, new { consulta = new { entidad = "noticias", limite = 5 } });
        Assert.Equal("consulta_editada", editada.Via);
        Assert.Equal(1, doble.Llamadas);
        var mala = await PreguntarAsync(cliente, new { consulta = new { entidad = "cuentas" } });
        Assert.Equal("fuera_de_catalogo", mala.Estado);
    }

    [Fact]
    public async Task La_pregunta_vacia_o_demasiado_larga_responde_400_y_el_cupo_es_de_diez_por_minuto()
    {
        await using var fabricaBase = new TestWebApplicationFactory();
        await using var fabrica = ConDoble(fabricaBase, Doble(_ => Q("noticias")));
        var cliente = fabrica.CreateClient();
        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.PostAsJsonAsync(Consultar, new { pregunta = "  " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.PostAsJsonAsync(Consultar, new { pregunta = new string('a', 201) })).StatusCode);

        HttpStatusCode? ultimo = null;
        for (var i = 0; i < 12; i++)
            ultimo = (await cliente.PostAsJsonAsync(Consultar, new { pregunta = "noticias " + i })).StatusCode;
        Assert.Equal(HttpStatusCode.TooManyRequests, ultimo);
    }
}
