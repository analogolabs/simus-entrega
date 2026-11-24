using System.Runtime.CompilerServices;
using SIMUS.Api.Endpoints;
using Xunit;
using Xunit.Abstractions;
using static SIMUS.Api.Endpoints.ParecidoDeNombres;

namespace SIMUS.Api.Tests;

/// <summary>
/// CUÁNTOS FALSOS AVISOS DAN LAS ERRATAS Y LAS SIGLAS, medido con los Festivales de la demostración
/// (COI2, decisión 48).
/// </summary>
/// <remarks>
/// <para>
/// El usuario pidió reconocer erratas de tecleo y siglas «cuidando que no dé falsos avisos». Un umbral
/// «a ojo» no se puede defender: esta prueba lo mide y deja el resultado a la vista en cada ejecución.
/// El archivo <c>Fixtures/festivales-de-la-demostracion.tsv</c> son los nombres y territorios de los
/// Festivales de las siembras de la demostración (`scripts/demo/sembrar-demo.sh completa` y los históricos
/// de `V20261106_07`); son inventados o públicos y no llevan datos de personas.
/// </para>
/// <para>
/// Se mide así: (1) <b>falsos avisos</b>: cada par de Festivales de nombre distinto se compara, con el
/// territorio real y con el peor caso (todos en el mismo departamento); un aviso nuevo (errata o
/// sigla) entre dos Festivales que no son el mismo cuenta como falso aviso; (2) <b>choques de sigla</b>:
/// dos Festivales distintos del mismo departamento con las mismas iniciales; (3) <b>recuperación</b>:
/// si se escribe la sigla de un Festival, o su nombre con una errata, ¿lo encuentra?
/// </para>
/// <para>
/// Para ajustar un umbral se cambia <see cref="Criterios"/> y se repite esta medición: si aparece un
/// falso aviso, el nombre de los dos Festivales sale en el mensaje del fallo.
/// </para>
/// </remarks>
public sealed class MedicionDeParecidoTests(ITestOutputHelper salida)
{
    private sealed record Festival(string Departamento, string Municipio, string Nombre);

    private static List<Festival> Cargar([CallerFilePath] string ruta = "")
    {
        var archivo = Path.Combine(Path.GetDirectoryName(ruta)!, "Fixtures", "festivales-de-la-demostracion.tsv");
        return File.ReadAllLines(archivo)
            .Where(x => !string.IsNullOrWhiteSpace(x) && !x.StartsWith('#'))
            .Select(x => x.Split('\t'))
            .Where(x => x.Length >= 3)
            .Select(x => new Festival(x[0].Trim(), x[1].Trim(), x[2].Trim()))
            .ToList();
    }

    private static bool EsAvisoNuevo(string? razon) =>
        razon is not null
        && (razon.StartsWith("Posible errata", StringComparison.Ordinal) || razon.StartsWith("Posible coincidencia por sigla", StringComparison.Ordinal));

    [Fact]
    public void La_demostracion_tiene_Festivales_para_medir()
    {
        var festivales = Cargar();
        salida.WriteLine($"Festivales medidos: {festivales.Count}; departamentos: {festivales.Select(x => x.Departamento).Distinct().Count()}.");
        Assert.True(festivales.Count >= 100, "la medición necesita al menos cien Festivales distintos");
    }

    [Fact]
    public void Entre_los_Festivales_de_la_demostracion_las_erratas_y_las_siglas_no_dan_falsos_avisos()
    {
        var festivales = Cargar();
        var distintos = festivales.GroupBy(x => Normalizar(x.Nombre)).Select(g => g.First()).ToList();
        var consultas = distintos.Select(x => new Consulta(x.Nombre)).ToList();

        var paresMedidos = 0;
        var falsosConTerritorioReal = new List<string>();
        var falsosEnElPeorCaso = new List<string>();
        var porRazon = new Dictionary<string, int>();
        for (var i = 0; i < distintos.Count; i++)
        {
            for (var j = 0; j < distintos.Count; j++)
            {
                if (i == j) continue;
                paresMedidos++;
                var a = distintos[i];
                var b = distintos[j];
                // Si ya se parecían por palabras (puntaje 2 o más) no es un aviso NUEVO.
                if (consultas[i].Puntaje(b.Nombre) >= 1) continue;

                var real = RespaldoDe(a.Departamento, a.Municipio, b.Departamento, b.Municipio);
                if (EsAvisoNuevo(consultas[i].Razon(b.Nombre, real)))
                    falsosConTerritorioReal.Add($"«{a.Nombre}» ({a.Departamento}) ~ «{b.Nombre}» ({b.Departamento}): {consultas[i].Razon(b.Nombre, real)}");
                var peor = consultas[i].Razon(b.Nombre, RespaldoTerritorial.MismoMunicipio);
                if (EsAvisoNuevo(peor))
                {
                    falsosEnElPeorCaso.Add($"«{a.Nombre}» ~ «{b.Nombre}»: {peor}");
                    var tipo = peor!.StartsWith("Posible errata", StringComparison.Ordinal) ? "errata" : "sigla";
                    porRazon[tipo] = porRazon.GetValueOrDefault(tipo) + 1;
                }
            }
        }

        salida.WriteLine($"Pares medidos (ordenados): {paresMedidos}.");
        salida.WriteLine($"Avisos nuevos con el territorio real: {falsosConTerritorioReal.Count}.");
        salida.WriteLine($"Avisos nuevos en el peor caso (todos en el mismo municipio): {falsosEnElPeorCaso.Count} {string.Join(", ", porRazon.Select(x => $"{x.Key}={x.Value}"))}.");
        foreach (var f in falsosEnElPeorCaso.Take(40)) salida.WriteLine("  · " + f);

        // Entre Festivales distintos de la demostración no debe haber ningún aviso nuevo con el territorio real.
        Assert.True(falsosConTerritorioReal.Count == 0, "Falsos avisos con territorio real:\n" + string.Join("\n", falsosConTerritorioReal));
        // Y en el peor caso, solo los que se hayan revisado a mano y aceptado (ninguno hoy).
        Assert.True(falsosEnElPeorCaso.Count <= PeorCasoAceptado, "Falsos avisos en el peor caso:\n" + string.Join("\n", falsosEnElPeorCaso));
    }

    /// <summary>Cuántos avisos nuevos en el peor caso se aceptan tras revisarlos uno por uno (ver la medición).</summary>
    private const int PeorCasoAceptado = 0;

    [Fact]
    public void Las_siglas_de_los_Festivales_de_la_demostracion_avisan_solo_si_son_de_un_unico_Festival_del_departamento()
    {
        var festivales = Cargar().GroupBy(x => Normalizar(x.Nombre)).Select(g => g.First()).ToList();
        var porDepartamento = festivales.Where(x => x.Departamento.Length > 0).GroupBy(x => x.Departamento).ToDictionary(g => g.Key, g => g.ToList());

        var probadas = 0;
        var unicas = 0;
        var unicasEncontradas = 0;
        var ambiguas = 0;
        var ambiguasQueAvisan = new List<string>();
        var perdidas = new List<string>();
        foreach (var (departamento, lista) in porDepartamento)
        {
            foreach (var festival in lista)
            {
                var sigla = SiglasDe(festival.Nombre).Where(s => s.Length is >= Criterios.SiglaMinimaConSoloDepartamento and <= Criterios.SiglaMaxima)
                    .OrderByDescending(s => s.Length).FirstOrDefault();
                if (sigla is null) continue;
                probadas++;
                // Cuántos Festivales distintos del departamento corresponden a esa sigla.
                var duenos = lista.Where(x => SiglasDe(x.Nombre).Contains(sigla)).Select(x => Normalizar(x.Nombre)).Distinct().Count();
                var avisos = Puntuar(sigla.ToUpperInvariant(), lista, x => x.Nombre, x => RespaldoDe(departamento, null, x.Departamento, x.Municipio))
                    .Where(x => EsAvisoDeSigla(x.Razon)).ToList();
                if (duenos == 1)
                {
                    unicas++;
                    if (avisos.Any(x => ReferenceEquals(x.Item, festival))) unicasEncontradas++;
                    else perdidas.Add($"{sigla.ToUpperInvariant()} → «{festival.Nombre}»");
                }
                else
                {
                    ambiguas++;
                    if (avisos.Count > 0) ambiguasQueAvisan.Add($"{sigla.ToUpperInvariant()} ({departamento}): avisa de {avisos.Count} Festivales, de {duenos} que la tienen");
                }
            }
        }
        salida.WriteLine($"Siglas de {Criterios.SiglaMinimaConSoloDepartamento} a {Criterios.SiglaMaxima} letras probadas: {probadas} (en {porDepartamento.Count} departamentos).");
        salida.WriteLine($"  Únicas en su departamento: {unicas}; encontradas: {unicasEncontradas}.");
        salida.WriteLine($"  Ambiguas (varios Festivales distintos del departamento): {ambiguas}; de las cuales avisan: {ambiguasQueAvisan.Count}.");
        foreach (var p in perdidas.Take(20)) salida.WriteLine("  · única y no encontrada: " + p);
        foreach (var a in ambiguasQueAvisan.Take(20)) salida.WriteLine("  · ambigua que avisa: " + a);

        Assert.True(probadas > 20, "la medición necesita siglas de cuatro letras o más");
        // La sigla única en su departamento se encuentra siempre…
        Assert.True(unicas == unicasEncontradas, "Siglas únicas que no encuentran su Festival:\n" + string.Join("\n", perdidas));
        // …y la ambigua nunca avisa: no dice cuál es el Festival de quien escribe.
        Assert.True(ambiguasQueAvisan.Count == 0, "Siglas ambiguas que avisan:\n" + string.Join("\n", ambiguasQueAvisan));
    }

    [Fact]
    public void Las_siglas_no_avisan_de_otro_departamento_ni_de_un_Festival_sin_departamento()
    {
        var festivales = Cargar().GroupBy(x => Normalizar(x.Nombre)).Select(g => g.First()).ToList();
        var porDepartamento = festivales.Where(x => x.Departamento.Length > 0).GroupBy(x => x.Departamento).ToList();
        var falsos = new List<string>();
        var probadas = 0;
        foreach (var grupo in porDepartamento.Take(8))
        {
            foreach (var festival in grupo.Take(6))
            {
                var sigla = SiglasDe(festival.Nombre).Where(s => s.Length >= Criterios.SiglaMinimaConSoloDepartamento).FirstOrDefault();
                if (sigla is null) continue;
                probadas++;
                // Se busca desde OTRO departamento: ningún Festival del conjunto respalda la sigla.
                var otroDepartamento = porDepartamento.First(g => g.Key != grupo.Key).Key;
                var avisos = Puntuar(sigla.ToUpperInvariant(), festivales, x => x.Nombre, x => RespaldoDe(otroDepartamento, null, x.Departamento, x.Municipio))
                    .Where(x => x.Item.Departamento != otroDepartamento && EsAvisoDeSigla(x.Razon)).ToList();
                falsos.AddRange(avisos.Select(x => $"{sigla.ToUpperInvariant()} buscada desde {otroDepartamento} avisa de «{x.Item.Nombre}» ({x.Item.Departamento})"));
            }
        }
        salida.WriteLine($"Siglas buscadas desde otro departamento: {probadas}; avisos fuera del territorio: {falsos.Count}.");
        Assert.True(probadas > 10);
        Assert.True(falsos.Count == 0, string.Join("\n", falsos));
    }

    [Fact]
    public void Quien_escribe_un_Festival_de_la_demostracion_con_una_errata_lo_encuentra_y_no_encuentra_otros()
    {
        var festivales = Cargar().GroupBy(x => Normalizar(x.Nombre)).Select(g => g.First()).ToList();
        var consultas = festivales.Select(x => new Consulta(x.Nombre)).ToList();
        var probados = 0;
        var encontrados = 0;
        var ajenos = new List<string>();
        for (var i = 0; i < festivales.Count; i++)
        {
            var errata = ConErrata(festivales[i].Nombre);
            if (errata is null) continue;
            probados++;
            var consulta = new Consulta(errata);
            if (consulta.Puntaje(festivales[i].Nombre) >= 1) encontrados++;
            // La errata de un Festival no debe avisar de OTRO Festival que el original no avisaba.
            for (var j = 0; j < festivales.Count; j++)
            {
                if (j == i) continue;
                if (consulta.Puntaje(festivales[j].Nombre) >= 1 && consultas[i].Puntaje(festivales[j].Nombre) == 0)
                    ajenos.Add($"«{errata}» (de «{festivales[i].Nombre}») avisa de «{festivales[j].Nombre}»: {consulta.Razon(festivales[j].Nombre)}");
            }
        }
        salida.WriteLine($"Nombres con una errata sintética probados: {probados}; encontrados: {encontrados} ({(probados == 0 ? 0 : 100 * encontrados / probados)} %).");
        salida.WriteLine($"Avisos ajenos que la errata provoca: {ajenos.Count}.");
        foreach (var a in ajenos.Take(20)) salida.WriteLine("  · " + a);
        Assert.True(probados >= 50, "la medición necesita al menos cincuenta nombres con una palabra de seis letras o más");
        Assert.True(encontrados * 100 >= probados * 90, $"se encontró {encontrados} de {probados} nombres con errata: menos del 90 %");
        Assert.True(ajenos.Count == 0, "Una errata avisa de Festivales que el nombre original no mencionaba:\n" + string.Join("\n", ajenos));
    }

    /// <summary>Intercambia dos letras contiguas (no la primera) de la palabra más larga que distingue el nombre; <c>null</c> si ninguna tiene seis letras.</summary>
    private static string? ConErrata(string nombre)
    {
        var palabras = Normalizar(nombre).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var elegida = palabras
            .Where(p => p.Length >= Criterios.LongitudMinimaDeUnaErrata && Palabras(p).Count > 0 && !p.Any(char.IsDigit))
            .OrderByDescending(p => p.Length).FirstOrDefault();
        if (elegida is null) return null;
        var letras = elegida.ToCharArray();
        // Se busca un par contiguo de letras distintas, después de la primera.
        for (var k = 1; k < letras.Length - 1; k++)
        {
            if (letras[k] == letras[k + 1]) continue;
            (letras[k], letras[k + 1]) = (letras[k + 1], letras[k]);
            return string.Join(' ', palabras.Select(p => p == elegida ? new string(letras) : p));
        }
        return null;
    }
}
