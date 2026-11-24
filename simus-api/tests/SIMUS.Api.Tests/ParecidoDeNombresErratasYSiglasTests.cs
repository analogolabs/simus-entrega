using SIMUS.Api.Endpoints;
using Xunit;
using static SIMUS.Api.Endpoints.ParecidoDeNombres;

namespace SIMUS.Api.Tests;

/// <summary>
/// Erratas de tecleo y siglas en el parecido de nombres (COI2, decisión 48).
/// </summary>
/// <remarks>
/// <para>
/// El usuario pidió reconocer las dos cosas «pero cuidando que no dé falsos avisos». Por eso hay más
/// casos que NO deben avisar que casos que sí: un falso aviso cuesta confianza en el asistente, y
/// los dos parecidos nuevos valen 1 («posible coincidencia») y no entran en la fusión.
/// </para>
/// <para>
/// La medición con los Festivales de la demostración está en <see cref="MedicionDeParecidoTests"/>.
/// </para>
/// </remarks>
public sealed class ParecidoDeNombresErratasYSiglasTests
{
    // ---------- Erratas de tecleo ----------------------------------------------------------------

    [Theory]
    // Letra cambiada en una palabra que distingue.
    [InlineData("Festival Currulao de Guapi", "Festival Currulo de Guapi")]
    // Dos letras intercambiadas.
    [InlineData("Festival Marimba Tumaco", "Festival Marimab Tumaco")]
    // Una letra de más.
    [InlineData("Festival Villavicencio Joropo", "Festival Villavicenncio Joropo")]
    // Palabra larga: se toleran dos errores (aquí, una letra de menos).
    [InlineData("Festival Internacionalizado de Cuerdas", "Festival Internacionlizado de Cuerdas")]
    // Sin palabras que distingan: el nombre entero difiere en una letra (el ejemplo del usuario).
    [InlineData("Festival de la Música", "Festibal de la Musica")]
    [InlineData("Festival Cultural", "Festibal Cultural")]
    public void Una_errata_de_tecleo_avisa_con_su_razon(string guardado, string escrito)
    {
        var consulta = new Consulta(escrito);

        Assert.Equal(1, consulta.Puntaje(guardado));
        var razon = consulta.Razon(guardado);
        Assert.NotNull(razon);
        Assert.StartsWith("Posible errata de tecleo", razon, StringComparison.Ordinal);
    }

    [Theory]
    // Municipios distintos con una letra de diferencia: son palabras cortas, no una errata.
    [InlineData("Festival de Cuerdas de Neiva", "Festival de Cuerdas de Leiva")]
    [InlineData("Festival de Bandas de Paipa", "Festival de Bandas de Pailas")]
    [InlineData("Festival Pasto", "Festival Pasco")]
    // Género distinto: son palabras distintas.
    [InlineData("Festival Folclórico Llanero", "Festival Folclórico Llanera")]
    [InlineData("Festival Andino de Cuerdas", "Festival Andina de Cuerdas")]
    // Una errata en la primera letra no se acepta: demasiados nombres distintos difieren así.
    [InlineData("Festival Pacífico Sur", "Festival Racífico Sur")]
    // El número suelto no es una errata sino otra edición u otro Festival.
    [InlineData("Festival de Jazz 1", "Festival de Jazz 2")]
    // «Música Llanera» y «Música Larga» no se parecen (el ejemplo del usuario).
    [InlineData("Festival de la Música Llanera", "Festival de Música Larga")]
    // Más de dos palabras distintas no se rescatan con erratas.
    [InlineData("Festival Currulao de Guapi Pacífico", "Festival Currulo de Guapo Pacifica")]
    public void Nombres_distintos_con_una_letra_de_diferencia_no_avisan(string guardado, string escrito)
    {
        Assert.Equal(0, new Consulta(escrito).Puntaje(guardado));
        Assert.Null(new Consulta(escrito).Razon(guardado));
    }

    [Fact]
    public void Las_erratas_no_son_candidatos_de_fusion()
    {
        // La fusión y «Relacionadas» piden 2 o más: una errata vale 1 y nunca propone unir dos registros.
        Assert.Equal(1, Puntaje("Festival Currulao de Guapi", "Festival Currulo de Guapi"));
        Assert.True(Puntaje("Festival Currulao de Guapi", "Festival Currulo de Guapi") < 2);
    }

    [Theory]
    [InlineData("festival", "festival", 0)]
    [InlineData("festival", "festibal", 1)]
    [InlineData("jacinto", "jacinot", 1)]
    [InlineData("bambuco", "bambucoo", 1)]
    [InlineData("neiva", "leiva", 1)]
    [InlineData("guapi", "guapo", 1)]
    [InlineData("pasto", "pasco", 1)]
    [InlineData("kitten", "sitting", 3)]
    public void La_distancia_de_edicion_cuenta_letras_de_mas_de_menos_cambiadas_o_intercambiadas(string a, string b, int esperada) =>
        Assert.Equal(esperada, DistanciaDeEdicion(a, b));

    // ---------- Siglas ----------------------------------------------------------------------------

    [Theory]
    [InlineData("FIMC", "Festival Internacional de Música Clásica")]
    [InlineData("F.I.M.C.", "Festival Internacional de Música Clásica")]
    [InlineData("F I M C", "Festival Internacional de Música Clásica")]
    // La sigla sin la palabra que abre el nombre.
    [InlineData("IMC", "Festival Internacional de Música Clásica")]
    // Con el año o la edición alrededor.
    [InlineData("FIMC 2019", "Festival Internacional de Música Clásica")]
    [InlineData("XXV FIMC", "Festival Internacional de Música Clásica")]
    public void Una_sigla_avisa_con_el_mismo_municipio_y_con_su_razon(string escrita, string guardado)
    {
        var consulta = new Consulta(escrita);

        Assert.Equal(1, consulta.Puntaje(guardado, RespaldoTerritorial.MismoMunicipio));
        var razon = consulta.Razon(guardado, RespaldoTerritorial.MismoMunicipio);
        Assert.NotNull(razon);
        Assert.StartsWith("Posible coincidencia por sigla", razon, StringComparison.Ordinal);
        Assert.Contains("FIMC", razon.Replace("IMC", "FIMC", StringComparison.Ordinal), StringComparison.Ordinal);
    }

    [Fact]
    public void La_sigla_guardada_tambien_avisa_si_lo_escrito_es_el_nombre_completo()
    {
        var consulta = new Consulta("Festival Internacional de Música Clásica");

        Assert.Equal(1, consulta.Puntaje("FIMC", RespaldoTerritorial.MismoDepartamento));
        Assert.StartsWith("Posible coincidencia por sigla", consulta.Razon("FIMC", RespaldoTerritorial.MismoDepartamento), StringComparison.Ordinal);
    }

    [Theory]
    // SIN RESPALDO DE TERRITORIO NO HAY AVISO: dos «FIMC» de dos departamentos no son el mismo.
    [InlineData("FIMC", "Festival Internacional de Música Clásica", RespaldoTerritorial.Ninguno)]
    // Con solo el departamento, una sigla de tres letras choca demasiado: hace falta el municipio.
    [InlineData("FMA", "Festival de Música Andina", RespaldoTerritorial.MismoDepartamento)]
    // No es sigla lo escrito en minúsculas ni una palabra corriente.
    [InlineData("Fimc", "Festival Internacional de Música Clásica", RespaldoTerritorial.MismoMunicipio)]
    [InlineData("fimc", "Festival Internacional de Música Clásica", RespaldoTerritorial.MismoMunicipio)]
    // Las iniciales deben ser exactamente esas.
    [InlineData("FIMD", "Festival Internacional de Música Clásica", RespaldoTerritorial.MismoMunicipio)]
    [InlineData("FIM", "Festival Internacional de Música Clásica", RespaldoTerritorial.MismoMunicipio)]
    // Una sigla demasiado larga o corta no es sigla.
    [InlineData("FIMCDEFGH", "Festival Internacional de Música Clásica", RespaldoTerritorial.MismoMunicipio)]
    [InlineData("FI", "Festival Internacional", RespaldoTerritorial.MismoMunicipio)]
    public void Una_sigla_sin_respaldo_suficiente_o_que_no_corresponde_no_avisa(string escrita, string guardado, RespaldoTerritorial respaldo)
    {
        Assert.Equal(0, new Consulta(escrita).Puntaje(guardado, respaldo));
        Assert.Null(new Consulta(escrita).Razon(guardado, respaldo));
    }

    [Fact]
    public void Dos_festivales_distintos_con_la_misma_sigla_solo_avisan_si_comparten_territorio()
    {
        // «Festival de Música Andina» y «Fiesta de la Música Antigua» comparten FMA, pero la sigla de tres
        // letras exige el mismo municipio: en el mismo departamento, no avisa.
        Assert.Equal(0, Puntaje("Festival de Música Andina", "FMA", RespaldoTerritorial.MismoDepartamento));
        Assert.Equal(1, Puntaje("Festival de Música Andina", "FMA", RespaldoTerritorial.MismoMunicipio));
        // De cuatro letras, el departamento basta…
        Assert.Equal(1, Puntaje("Festival Internacional de Música Clásica", "FIMC", RespaldoTerritorial.MismoDepartamento));
        // …y sin territorio compartido, nada.
        Assert.Equal(0, Puntaje("Festival Internacional de Música Clásica", "FIMC", RespaldoTerritorial.Ninguno));
    }

    [Fact]
    public void La_sigla_vale_1_y_nunca_propone_una_fusion()
    {
        Assert.True(Puntaje("Festival Internacional de Música Clásica", "FIMC", RespaldoTerritorial.MismoMunicipio) < 2);
    }

    [Theory]
    [InlineData("Festival Internacional de Música Clásica", "fimc", "imc")]
    [InlineData("Festival de la Chirimía del Pacífico", "fcp", "cp")]
    [InlineData("Encuentro Nacional de Bandas 2019", "enb", "nb")]
    public void Las_siglas_de_un_nombre_son_las_iniciales_sin_articulos_ni_anio(string nombre, string completa, string sinApertura)
    {
        var siglas = SiglasDe(nombre);
        Assert.Contains(completa, siglas);
        // La variante sin la palabra que abre solo existe con tres letras o más.
        if (sinApertura.Length >= Criterios.SiglaMinima) Assert.Contains(sinApertura, siglas);
        else Assert.DoesNotContain(sinApertura, siglas);
    }

    [Theory]
    [InlineData("FIMC", "fimc")]
    [InlineData("F.I.M.C.", "fimc")]
    [InlineData("F I M C", "fimc")]
    [InlineData("FIMC 2019", "fimc")]
    [InlineData("XXV FIMC", "fimc")]
    [InlineData("FIMC - 25.º", "fimc")]
    public void Lo_escrito_en_mayusculas_y_corto_parece_una_sigla(string escrito, string esperada) =>
        Assert.Equal(esperada, SiglaEscrita(escrito));

    [Theory]
    [InlineData("Fimc")]
    [InlineData("Festival")]
    [InlineData("Festival de la Música")]
    [InlineData("FI")]
    [InlineData("FIMCDEFGHI")]
    [InlineData("")]
    public void Lo_demas_no_parece_una_sigla(string escrito) => Assert.Null(SiglaEscrita(escrito));

    // ---------- Siglas ambiguas (lo que encontró la medición) -------------------------------------

    [Fact]
    public void Una_sigla_que_corresponde_a_varios_Festivales_distintos_es_ambigua_y_no_avisa_de_ninguno()
    {
        // La demostración tiene series con la misma plantilla: todas comparten la sigla FCTA.
        string[] serie = ["Festival de Canta y Torbellino de Anorí", "Festival de Canta y Torbellino de Anzá", "Festival de Canta y Torbellino de Arboletes"];

        var avisos = Puntuar("FCTA", serie, x => x, _ => RespaldoTerritorial.MismoDepartamento);

        Assert.Empty(avisos);
    }

    [Fact]
    public void Una_sigla_de_un_unico_Festival_avisa_y_el_mismo_Festival_cargado_dos_veces_cuenta_como_uno()
    {
        string[] conOtro = ["Festival de Canta y Torbellino de Anorí", "Festival Marimba Tumaco"];
        var unico = Puntuar("FCTA", conOtro, x => x, _ => RespaldoTerritorial.MismoDepartamento);
        Assert.Equal("Festival de Canta y Torbellino de Anorí", Assert.Single(unico).Item);
        Assert.True(EsAvisoDeSigla(unico[0].Razon));

        // Dos filas del MISMO Festival (cargado de dos fuentes) no vuelven ambigua la sigla.
        string[] cargadoDosVeces = ["Festival de Canta y Torbellino de Anorí", "festival de canta y torbellino de anorí"];
        var doble = Puntuar("FCTA", cargadoDosVeces, x => x, _ => RespaldoTerritorial.MismoDepartamento);
        Assert.Equal(2, doble.Count);
    }

    [Fact]
    public void La_ambiguedad_de_una_sigla_no_apaga_los_avisos_por_palabras()
    {
        // Escribir el nombre completo sigue encontrando el suyo aunque la sigla sea ambigua.
        string[] serie = ["Festival de Canta y Torbellino de Anorí", "Festival de Canta y Torbellino de Anzá"];

        var avisos = Puntuar("Festival Canta y Torbellino de Anorí", serie, x => x, _ => RespaldoTerritorial.MismoDepartamento);

        Assert.Contains(avisos, x => x.Item.EndsWith("Anorí", StringComparison.Ordinal));
    }

    // ---------- Territorio ------------------------------------------------------------------------

    [Theory]
    [InlineData("05", "05001", "05", "05001", RespaldoTerritorial.MismoMunicipio)]
    [InlineData("05", "05001", "05", "05088", RespaldoTerritorial.MismoDepartamento)]
    [InlineData("05", null, "05", "05088", RespaldoTerritorial.MismoDepartamento)]
    [InlineData("05", "05001", "08", "08001", RespaldoTerritorial.Ninguno)]
    // El Festival registrado sin departamento (alcance nacional) no respalda ninguna sigla.
    [InlineData("05", "05001", null, null, RespaldoTerritorial.Ninguno)]
    [InlineData(null, null, "05", "05001", RespaldoTerritorial.Ninguno)]
    public void El_respaldo_de_territorio_sale_del_departamento_y_el_municipio(string? depBuscado, string? munBuscado, string? depCandidato, string? munCandidato, RespaldoTerritorial esperado) =>
        Assert.Equal(esperado, RespaldoDe(depBuscado, munBuscado, depCandidato, munCandidato));

    // ---------- Lo que no se rompe ----------------------------------------------------------------

    [Theory]
    // «Nacional» y «festival» no distinguen: quedan las mismas palabras, el puntaje es 3.
    [InlineData("Festival del Bambuco", "Festival Nacional del Bambuco", 3)]
    [InlineData("Festival del Bambuco", "festival del bambuco", 3)]
    [InlineData("Festival Sonidos del Huila", "Sonidos del Huila", 3)]
    // Las palabras del más corto están en el otro: 2.
    [InlineData("Festival Folclórico de la Chirimía", "Festival de la Chirimía", 2)]
    public void Los_puntajes_de_siempre_no_cambian(string guardado, string escrito, int esperado) =>
        Assert.Equal(esperado, Puntaje(guardado, escrito, RespaldoTerritorial.MismoMunicipio));

    [Fact]
    public void Sin_palabras_que_distingan_y_sin_errata_no_hay_aviso()
    {
        Assert.Equal(0, Puntaje("Festival Nacional de Música", "Festival Cultural"));
        Assert.Equal(0, Puntaje("Festival de la Música", "Festival de Rock al Parque"));
    }
}
