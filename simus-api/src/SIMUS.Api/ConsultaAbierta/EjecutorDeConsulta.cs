using System.Globalization;
using SIMUS.Api.ConsultaGuiada;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;

namespace SIMUS.Api.ConsultaAbierta;

/// <summary>Lo que devuelve el ejecutor: la tabla, el resumen determinista y el gráfico sugerido.</summary>
public sealed record ResultadoDeEjecucion(TablaDeConsultaDto Tabla, string Resumen, string? Grafico, IReadOnlyList<string> ComoEntendi);

/// <summary>
/// El EJECUTOR DETERMINISTA. Recibe solo una <see cref="ConsultaValidada"/> (nunca texto del modelo) y la evalúa en memoria sobre
/// filas públicas ya leídas con las lecturas fijas de <see cref="CargadorDeEntidades"/>. No hay SQL dinámico, ni expresiones, ni
/// reflexión: cada operador es una comparación escrita aquí. Las cifras de la respuesta salen de aquí y de ningún otro sitio.
/// </summary>
public static class EjecutorDeConsulta
{
    private const string SinDato = "Sin dato";

    private static string Mayuscula(string texto) => char.ToUpperInvariant(texto[0]) + texto[1..];

    private static string Clave(string? texto) => string.Join(' ', CatalogoDeConsultas.PalabrasDe(CatalogoDeConsultas.Normalizar(texto ?? string.Empty)));

    private static IEnumerable<object?> Valores(FilaSemantica fila, CampoSemantico campo) =>
        fila.Valores.GetValueOrDefault(campo.Nombre) switch
        {
            IEnumerable<string> lista => lista,
            var otro => [otro],
        };

    private static bool Cumple(FilaSemantica fila, FiltroValidado filtro)
    {
        var campo = filtro.Campo;
        if (campo.Tipo == TipoDeCampo.Lugar)
        {
            var codigo = fila.Codigos.GetValueOrDefault(campo.Nombre);
            var coincide = codigo is not null && filtro.Valores.Any(v => (string)v == codigo);
            return filtro.Operador == "neq" ? !coincide : coincide;
        }

        var existentes = Valores(fila, campo).Where(v => v is not null).ToList();
        bool Alguno(Func<object, bool> prueba) => existentes.Any(v => prueba(v!));

        return filtro.Operador switch
        {
            "eq" or "in" => Alguno(v => filtro.Valores.Any(w => Igual(v, w))),
            "neq" => !Alguno(v => filtro.Valores.Any(w => Igual(v, w))),
            "contiene" => Alguno(v => filtro.Valores.Any(w => Clave(v.ToString()).Contains(Clave(w.ToString()), StringComparison.Ordinal))),
            "gt" => Alguno(v => Comparar(v, filtro.Valores[0]) > 0),
            "gte" => Alguno(v => Comparar(v, filtro.Valores[0]) >= 0),
            "lt" => Alguno(v => Comparar(v, filtro.Valores[0]) < 0),
            "lte" => Alguno(v => Comparar(v, filtro.Valores[0]) <= 0),
            _ => false,
        };
    }

    private static bool Igual(object a, object b) => a switch
    {
        decimal x when b is decimal y => x == y,
        DateOnly x when b is DateOnly y => x == y,
        _ => Clave(a.ToString()) == Clave(b.ToString()),
    };

    private static int Comparar(object a, object b) => a switch
    {
        decimal x when b is decimal y => x.CompareTo(y),
        DateOnly x when b is DateOnly y => x.CompareTo(y),
        _ => 0,
    };

    private static string Texto(object? valor) => valor switch
    {
        null => SinDato,
        DateOnly fecha => fecha.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
        decimal numero => numero.ToString("0.##", CultureInfo.InvariantCulture),
        var otro => otro.ToString() is { Length: > 0 } t ? t : SinDato,
    };

    private static readonly string[] Meses =
        ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    /// <summary>El mes se lee por su nombre («Noviembre») y no por su número.</summary>
    private static string TextoDeGrupo(CampoSemantico campo, object? valor) =>
        campo.Nombre == "mes" && valor is decimal mes && mes is >= 1 and <= 12 ? Mayuscula(Meses[(int)mes - 1]) : Texto(valor);

    private static IComparable? Orden(object? valor) => valor as IComparable;

    public static ResultadoDeEjecucion Ejecutar(ConsultaValidada consulta, List<FilaSemantica> filas, CatalogosSemanticos catalogos)
    {
        var entidad = consulta.Entidad;
        var coinciden = filas.Where(fila => consulta.Filtros.All(filtro => Cumple(fila, filtro))).ToList();

        var comoEntendi = ComoEntendi(consulta, catalogos);
        var filtros = new List<string> { "Solo registros publicados" };
        filtros.AddRange(comoEntendi.Skip(1).Take(consulta.Filtros.Count));
        filtros.AddRange(consulta.Notas);

        List<string[]> salida;
        List<string?> destinos;
        string[] columnas;
        string resumen;
        string? grafico = null;
        int total;
        var columnaDeEnlace = 0;

        if (consulta.Agrupar.Count == 0 && !consulta.HayMetrica)
        {
            // LISTA DE FILAS.
            var campoOrden = consulta.OrdenCampo == "metrica" ? entidad.CampoNombre : consulta.OrdenCampo;
            var ordenadas = coinciden.OrderBy(f => f.Valores.GetValueOrDefault(campoOrden) is null ? 1 : 0);
            ordenadas = consulta.Descendente
                ? ordenadas.ThenByDescending(f => Orden(f.Valores.GetValueOrDefault(campoOrden)), Comparer<IComparable?>.Create(CompararOrden))
                : ordenadas.ThenBy(f => Orden(f.Valores.GetValueOrDefault(campoOrden)), Comparer<IComparable?>.Create(CompararOrden));
            var mostradas = ordenadas.ThenBy(f => Texto(f.Valores.GetValueOrDefault(entidad.CampoNombre)), StringComparer.Ordinal)
                .Take(consulta.Limite).ToList();
            var campos = entidad.Columnas.Select(entidad.Campo).Where(c => c is not null).Select(c => c!).ToList();
            columnas = campos.Select(c => c.Rotulo).ToArray();
            columnaDeEnlace = Math.Max(0, campos.FindIndex(c => c.Nombre == entidad.CampoNombre));
            salida = mostradas.Select(f => campos.Select(c => Texto(f.Valores.GetValueOrDefault(c.Nombre))).ToArray()).ToList();
            destinos = mostradas.Select(f => f.Ruta).ToList();
            total = coinciden.Count;
            resumen = total == 0
                ? $"No hay {entidad.Plural} publicados que cumplan lo pedido."
                : total > mostradas.Count
                    ? $"Hay {TextoEnEspanol.Plural(total, entidad.Rotulo, entidad.Plural)} que {(total == 1 ? "cumple" : "cumplen")} lo pedido; se muestran {mostradas.Count.ToString(CultureInfo.InvariantCulture)}."
                    : $"Hay {TextoEnEspanol.Plural(total, entidad.Rotulo, entidad.Plural)} que {(total == 1 ? "cumple" : "cumplen")} lo pedido.";
        }
        else if (consulta.Agrupar.Count == 0)
        {
            // UN SOLO VALOR AGREGADO.
            var cifra = Agregar(consulta, coinciden);
            columnas = [EtiquetaDeMetrica(consulta)];
            salida = [[Texto(cifra)]];
            destinos = [entidad.Directorio];
            total = 1;
            resumen = cifra is null ? "No hay datos para calcularlo."
                : consulta.Funcion == "count"
                    ? $"Hay {TextoEnEspanol.Plural(cifra is decimal n ? (int)n : 0, entidad.Rotulo, entidad.Plural)} que {(cifra is decimal uno && uno == 1 ? "cumple" : "cumplen")} lo pedido."
                    : $"{EtiquetaDeMetrica(consulta)}: {Texto(cifra)}.";
        }
        else
        {
            // AGRUPADO.
            var grupos = new Dictionary<string, (List<object?> Claves, List<FilaSemantica> Filas)>(StringComparer.Ordinal);
            foreach (var fila in coinciden)
            {
                IEnumerable<List<object?>> combinaciones = [[]];
                foreach (var campo in consulta.Agrupar)
                {
                    var valores = Valores(fila, campo).Where(v => v is not null).Distinct().ToList();
                    if (valores.Count == 0) valores = [null];
                    combinaciones = combinaciones.SelectMany(prefijo => valores.Select(v => new List<object?>([.. prefijo, v])));
                }
                foreach (var claves in combinaciones)
                {
                    var llave = string.Join('\u001f', claves.Select(Texto));
                    if (!grupos.TryGetValue(llave, out var grupo)) grupos[llave] = grupo = (claves, []);
                    grupo.Filas.Add(fila);
                }
            }

            var calculados = grupos.Values.Select(g => (g.Claves, Cifra: Agregar(consulta, g.Filas), g.Filas)).ToList();
            var indiceOrden = consulta.Agrupar.ToList().FindIndex(c => c.Nombre == consulta.OrdenCampo);
            IOrderedEnumerable<(List<object?> Claves, object? Cifra, List<FilaSemantica> Filas)> ordenados;
            var comparador = Comparer<IComparable?>.Create(CompararOrden);
            if (indiceOrden >= 0)
            {
                ordenados = consulta.Descendente
                    ? calculados.OrderByDescending(g => Orden(g.Claves[indiceOrden]), comparador)
                    : calculados.OrderBy(g => Orden(g.Claves[indiceOrden]), comparador);
            }
            else
            {
                ordenados = consulta.Descendente
                    ? calculados.OrderByDescending(g => Orden(g.Cifra), comparador)
                    : calculados.OrderBy(g => Orden(g.Cifra), comparador);
            }
            var lista = ordenados.ThenBy(g => string.Join(' ', g.Claves.Select(Texto)), StringComparer.Ordinal).ToList();
            total = lista.Count;
            var mostrados = lista.Take(consulta.Limite).ToList();
            columnas = [.. consulta.Agrupar.Select(c => c.Rotulo), EtiquetaDeMetrica(consulta)];
            salida = mostrados.Select(g => (string[])[.. g.Claves.Select((clave, i) => TextoDeGrupo(consulta.Agrupar[i], clave)), Texto(g.Cifra)]).ToList();
            destinos = mostrados.Select(g => DestinoDeGrupo(entidad, consulta.Agrupar, g.Claves)).ToList();
            var sumaDeCuentas = consulta.Funcion == "count" ? coinciden.Count : (int?)null;
            resumen = total == 0
                ? $"No hay {entidad.Plural} publicados que cumplan lo pedido."
                : $"{total.ToString(CultureInfo.InvariantCulture)} {(total == 1 ? "grupo" : "grupos")} por {string.Join(" y ", consulta.Agrupar.Select(c => c.Rotulo.ToLowerInvariant()))}; "
                    + $"el primero es «{TextoDeGrupo(consulta.Agrupar[0], mostrados[0].Claves[0])}»{(consulta.Agrupar.Count > 1 ? " (y " + TextoDeGrupo(consulta.Agrupar[1], mostrados[0].Claves[1]) + ")" : string.Empty)} con {Texto(mostrados[0].Cifra)}"
                    + (total > mostrados.Count ? $"; se muestran {mostrados.Count.ToString(CultureInfo.InvariantCulture)}." : ".");
            _ = sumaDeCuentas;
            if (consulta.Agrupar.Count == 1 && mostrados.Count >= 2)
                grafico = consulta.Agrupar[0].Nombre is "mes" or "anio" ? "linea" : "barras";
        }

        var alcance = $"Solo lo publicado · {salida.Count.ToString(CultureInfo.InvariantCulture)} de {total.ToString(CultureInfo.InvariantCulture)} filas";
        var titulo = $"{Mayuscula(entidad.Plural)} publicados";
        var tabla = new TablaDeConsultaDto(
            titulo, entidad.Fuente, alcance, columnas, salida.Select(f => (IReadOnlyList<string>)f).ToList(), destinos, columnaDeEnlace, filtros);
        return new ResultadoDeEjecucion(tabla, resumen, grafico, comoEntendi);
    }

    private static int CompararOrden(IComparable? a, IComparable? b)
    {
        if (a is null && b is null) return 0;
        if (a is null) return -1;
        if (b is null) return 1;
        if (a.GetType() != b.GetType()) return string.CompareOrdinal(a.ToString(), b.ToString());
        return a is string x ? string.Compare(x, (string)b, StringComparison.CurrentCultureIgnoreCase) : a.CompareTo(b);
    }

    private static string EtiquetaDeMetrica(ConsultaValidada consulta) => consulta.Funcion switch
    {
        "sum" => $"Suma de {consulta.CampoDeMetrica!.Rotulo.ToLowerInvariant()}",
        "avg" => $"Promedio de {consulta.CampoDeMetrica!.Rotulo.ToLowerInvariant()}",
        "min" => $"Mínimo de {consulta.CampoDeMetrica!.Rotulo.ToLowerInvariant()}",
        "max" => $"Máximo de {consulta.CampoDeMetrica!.Rotulo.ToLowerInvariant()}",
        _ => Mayuscula(consulta.Entidad.Plural),
    };

    private static object? Agregar(ConsultaValidada consulta, List<FilaSemantica> filas)
    {
        if (consulta.Funcion == "count") return (decimal)filas.Count;
        var numeros = filas.Select(f => f.Valores.GetValueOrDefault(consulta.CampoDeMetrica!.Nombre)).OfType<decimal>().ToList();
        if (numeros.Count == 0) return null;
        return consulta.Funcion switch
        {
            "sum" => numeros.Sum(),
            "avg" => Math.Round(numeros.Average(), 1, MidpointRounding.AwayFromZero),
            "min" => numeros.Min(),
            _ => numeros.Max(),
        };
    }

    private static string? DestinoDeGrupo(EntidadSemantica entidad, IReadOnlyList<CampoSemantico> campos, List<object?> claves)
    {
        if (entidad.Directorio is null) return null;
        var parametro = campos[0].Nombre switch
        {
            "departamento" => "departamento", "municipio" => "municipio", "practica" => "practica", "territorio" => "territorio", _ => null,
        };
        var valor = claves[0] is null ? null : Texto(claves[0]);
        if (parametro is null || valor is null || valor == SinDato) return entidad.Directorio;
        var directorio = entidad.Id is "procesos" or "eventos" or "festivales" ? entidad.Directorio : null;
        if (entidad.Id == "procesos") directorio = "/ecosistema/festivales";
        return directorio is null ? entidad.Directorio : $"{directorio}?{parametro}={Uri.EscapeDataString(valor)}";
    }

    private static List<string> ComoEntendi(ConsultaValidada consulta, CatalogosSemanticos catalogos)
    {
        var lineas = new List<string> { $"Buscando: {consulta.Entidad.Plural}" };
        foreach (var filtro in consulta.Filtros)
        {
            var legibles = filtro.Valores.Select(v => filtro.Campo.Tipo == TipoDeCampo.Lugar
                ? BancoDePreguntasPublicas.Nombre((string)v is { Length: 2 } ? catalogos.Departamentos : catalogos.Municipios, (string)v) ?? (string)v
                : Texto(v)).ToList();
            var operador = filtro.Operador switch
            {
                "neq" => "distinto de ", "contiene" => "contiene ", "gt" => "mayor que ", "gte" => "desde ", "lt" => "menor que ", "lte" => "hasta ", _ => string.Empty,
            };
            lineas.Add($"{filtro.Campo.Rotulo}: {operador}{string.Join(" o ", legibles)}");
        }
        if (consulta.Agrupar.Count > 0) lineas.Add($"Agrupado por {string.Join(" y ", consulta.Agrupar.Select(c => c.Rotulo.ToLowerInvariant()))}");
        if (consulta.HayMetrica) lineas.Add($"Cálculo: {EtiquetaDeMetrica(consulta).ToLowerInvariant()}");
        if (consulta.OrdenCampo != "metrica" || consulta.Agrupar.Count > 0)
            lineas.Add($"Orden: {(consulta.OrdenCampo == "metrica" ? "por el valor calculado" : consulta.Entidad.Campo(consulta.OrdenCampo)?.Rotulo.ToLowerInvariant())} {(consulta.Descendente ? "(de mayor a menor)" : "(de menor a mayor)")}");
        lineas.Add($"Hasta {consulta.Limite.ToString(CultureInfo.InvariantCulture)} filas");
        return lineas;
    }
}
