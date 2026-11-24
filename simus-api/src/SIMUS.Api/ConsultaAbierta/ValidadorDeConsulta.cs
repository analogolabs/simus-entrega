using System.Globalization;
using SIMUS.Api.ConsultaGuiada;
using SIMUS.Contracts;

namespace SIMUS.Api.ConsultaAbierta;

/// <summary>Un filtro ya resuelto contra los catálogos. <c>Valores</c> son códigos DIVIPOLA, textos canónicos, números o fechas.</summary>
public sealed record FiltroValidado(CampoSemantico Campo, string Operador, IReadOnlyList<object> Valores, string Etiqueta);

public sealed record ConsultaValidada(
    EntidadSemantica Entidad, IReadOnlyList<FiltroValidado> Filtros, IReadOnlyList<CampoSemantico> Agrupar,
    bool HayMetrica, string Funcion, CampoSemantico? CampoDeMetrica, string OrdenCampo, bool Descendente, int Limite,
    ConsultaEstructuradaDto Canonica, IReadOnlyList<string> Notas);

public sealed record ResultadoDeValidacion(ConsultaValidada? Consulta, IReadOnlyList<string> Errores)
{
    public bool Valida => Consulta is not null;
}

/// <summary>
/// El VALIDADOR ESTRICTO. Lo que sale del modelo (o de un cliente que edita los filtros) es una cadena de texto no confiable:
/// aquí se contrasta con una lista blanca y con los catálogos, y solo lo que pasa llega al ejecutor.
/// </summary>
/// <remarks>
/// Rechaza entidades, campos, operadores y funciones fuera del catálogo; valores que no existen en DIVIPOLA, prácticas,
/// territorios, organizaciones públicas o tipos; más de 6 filtros o 2 agrupaciones; caracteres de control y valores de más de
/// 80 caracteres. El límite de filas se recorta a 50. Un valor de un campo de texto («contiene») se compara como texto literal
/// en memoria, nunca se concatena en una consulta.
/// </remarks>
public static class ValidadorDeConsulta
{
    private static string Norm(string? texto) => CatalogoDeConsultas.Normalizar((texto ?? string.Empty).Trim());

    private static string Clave(string texto) => string.Join(' ', CatalogoDeConsultas.PalabrasDe(Norm(texto)));

    private static readonly string[] Meses =
        ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    private static string[] OperadoresDe(CampoSemantico campo) => campo.Tipo switch
    {
        TipoDeCampo.Texto => ["eq", "neq", "in", "contiene"],
        TipoDeCampo.Catalogo or TipoDeCampo.Lugar => ["eq", "neq", "in"],
        TipoDeCampo.Numero => ["eq", "neq", "in", "gt", "gte", "lt", "lte"],
        _ => ["eq", "gt", "gte", "lt", "lte"],
    };

    public static ResultadoDeValidacion Validar(ConsultaEstructuradaDto? consulta, CatalogosSemanticos catalogos, DateOnly hoy)
    {
        var errores = new List<string>();
        var notas = new List<string>();
        if (consulta is null) return new(null, ["No hay una consulta que validar."]);

        var entidad = CatalogoSemantico.Buscar(Norm(consulta.Entidad));
        if (entidad is null)
            return new(null, [$"«{Corto(consulta.Entidad)}» no es algo que se pueda consultar. Se puede preguntar por: {string.Join(", ", CatalogoSemantico.Entidades.Select(e => e.Plural))}."]);

        var filtros = new List<FiltroValidado>();
        var origen = consulta.Filtros ?? [];
        if (origen.Count > CatalogoSemantico.MaximoFiltros)
            errores.Add($"Hay demasiados filtros (el máximo es {CatalogoSemantico.MaximoFiltros}).");
        foreach (var filtro in origen.Take(CatalogoSemantico.MaximoFiltros))
        {
            // TOLERANCIA CON LOS TROPIEZOS COMUNES DEL MODELO, sin ampliar nada de lo permitido: un filtro sin valor no filtra nada
            // (suele ser su forma de decir «que tenga este campo») y se descarta; uno repetido se cuenta una vez.
            if (filtro is not null && string.IsNullOrWhiteSpace(filtro.Valor)) continue;
            var validado = ValidarFiltro(entidad, filtro, catalogos, hoy, errores, notas);
            if (validado is not null && !filtros.Any(f => f.Campo == validado.Campo && f.Operador == validado.Operador && f.Etiqueta == validado.Etiqueta))
                filtros.Add(validado);
        }

        var grupos = new List<CampoSemantico>();
        var agrupacionDescartada = false;
        var agrupar = consulta.Agrupar ?? [];
        if (agrupar.Count > CatalogoSemantico.MaximoAgrupaciones)
            errores.Add($"Se puede agrupar por {CatalogoSemantico.MaximoAgrupaciones} campos como máximo.");
        foreach (var nombre in agrupar.Take(CatalogoSemantico.MaximoAgrupaciones))
        {
            var campo = entidad.Campo(Norm(nombre));
            if (campo is null) errores.Add($"No se puede agrupar por «{Corto(nombre)}»: no es un campo de {entidad.Plural}.");
            else if (!campo.Agrupable) { agrupacionDescartada = true; notas.Add($"No se agrupa por «{campo.Rotulo}»: cada fila es distinta."); }
            else if (!grupos.Contains(campo)) grupos.Add(campo);
        }

        var funcion = Norm(consulta.Metrica?.Funcion);
        // Si lo único que se pidió agrupar era un campo que no se agrupa, el «contar» que lo acompañaba tampoco aplica: era una lista.
        if (agrupacionDescartada && grupos.Count == 0 && funcion == "count") funcion = string.Empty;
        var hayMetrica = funcion.Length > 0 || grupos.Count > 0;
        if (funcion.Length == 0) funcion = "count";
        CampoSemantico? campoMetrica = null;
        if (!CatalogoSemantico.Funciones.Contains(funcion))
        {
            errores.Add($"La función «{Corto(consulta.Metrica?.Funcion)}» no está permitida (usa contar, sumar, promedio, mínimo o máximo).");
        }
        else if (funcion != "count")
        {
            campoMetrica = entidad.Campo(Norm(consulta.Metrica?.Campo));
            // Sin campo, vale el único campo sumable de la entidad (organizaciones, prácticas y territorios tienen uno).
            if (campoMetrica is null && string.IsNullOrWhiteSpace(consulta.Metrica?.Campo) && entidad.Campos.Count(c => c.Agregable) == 1)
                campoMetrica = entidad.Campos.Single(c => c.Agregable);
            if (campoMetrica is null || !campoMetrica.Agregable)
                errores.Add($"No se puede calcular «{funcion}» sobre «{Corto(consulta.Metrica?.Campo)}» en {entidad.Plural}.");
        }

        // ORDEN: lo pedido si aplica; si el modelo pide uno que no existe o no sirve aquí, se usa el habitual y se dice.
        var ordenCampo = Norm(consulta.Orden?.Campo);
        var descendente = Norm(consulta.Orden?.Direccion) != "asc";
        if (ordenCampo.Length > 0)
        {
            var valido = ordenCampo == "metrica"
                ? hayMetrica
                : entidad.Campo(ordenCampo) is { Multiple: false } campoOrden && (grupos.Count == 0 || grupos.Contains(campoOrden));
            if (!valido) { ordenCampo = string.Empty; notas.Add("Se usó el orden habitual."); }
        }
        if (ordenCampo.Length == 0)
        {
            descendente = true;
            if (hayMetrica) ordenCampo = "metrica";
            else if (entidad.Id is "organizaciones" or "practicas" or "territorios") ordenCampo = entidad.Campos.Last().Nombre;
            else if (entidad.Campos.Any(c => c.Nombre == "fecha")) { ordenCampo = "fecha"; descendente = entidad.Id == "noticias"; }
            else { ordenCampo = entidad.CampoNombre; descendente = false; }
        }

        var limite = consulta.Limite ?? CatalogoSemantico.LimitePorOmision;
        if (limite < 1) limite = CatalogoSemantico.LimitePorOmision;
        if (limite > CatalogoSemantico.LimiteMaximo)
        {
            limite = CatalogoSemantico.LimiteMaximo;
            notas.Add($"Se muestran como máximo {CatalogoSemantico.LimiteMaximo} filas.");
        }

        if (errores.Count > 0) return new(null, errores);

        var canonica = new ConsultaEstructuradaDto
        {
            Entidad = entidad.Id,
            Filtros = filtros.Select(f => new FiltroDeConsultaDto { Campo = f.Campo.Nombre, Operador = f.Operador, Valor = f.Etiqueta }).ToList(),
            Agrupar = grupos.Select(g => g.Nombre).ToList(),
            Metrica = hayMetrica ? new MetricaDeConsultaDto { Funcion = funcion, Campo = campoMetrica?.Nombre } : null,
            Orden = new OrdenDeConsultaDto { Campo = ordenCampo, Direccion = descendente ? "desc" : "asc" },
            Limite = limite,
        };
        return new(new ConsultaValidada(entidad, filtros, grupos, hayMetrica, funcion, campoMetrica, ordenCampo, descendente, limite, canonica, notas), []);
    }

    private static string Corto(string? texto)
    {
        var limpio = new string((texto ?? string.Empty).Where(c => !char.IsControl(c)).ToArray());
        return limpio.Length <= 40 ? limpio : limpio[..40] + "…";
    }

    private static FiltroValidado? ValidarFiltro(
        EntidadSemantica entidad, FiltroDeConsultaDto? filtro, CatalogosSemanticos catalogos, DateOnly hoy, List<string> errores, List<string> notas)
    {
        if (filtro is null) { errores.Add("Un filtro viene vacío."); return null; }
        var campo = entidad.Campo(Norm(filtro.Campo));
        if (campo is null) { errores.Add($"No se puede filtrar por «{Corto(filtro.Campo)}»: no es un campo de {entidad.Plural}."); return null; }
        var operador = Norm(filtro.Operador);
        if (operador.Length == 0) operador = "eq";
        // «contiene» sobre un catálogo («practica contiene chirimía») es «eq»: el valor se resuelve contra el catálogo de todos modos.
        if (operador == "contiene" && campo.Tipo is TipoDeCampo.Catalogo or TipoDeCampo.Lugar) operador = "eq";
        if (!CatalogoSemantico.Operadores.Contains(operador) || !OperadoresDe(campo).Contains(operador))
        {
            errores.Add($"El operador «{Corto(filtro.Operador)}» no se puede usar con «{campo.Rotulo}».");
            return null;
        }

        var crudo = filtro.Valor ?? string.Empty;
        if (crudo.Length == 0 || crudo.Length > CatalogoSemantico.MaximoValor || crudo.Any(char.IsControl))
        {
            errores.Add($"El valor del filtro «{campo.Rotulo}» no es válido.");
            return null;
        }

        var partes = operador == "in" ? crudo.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) : [crudo.Trim()];
        if (partes.Length == 0 || partes.Length > 10) { errores.Add($"El valor del filtro «{campo.Rotulo}» no es válido."); return null; }

        var valores = new List<object>();
        var etiquetas = new List<string>();
        var campoFinal = campo;
        foreach (var parte in partes)
        {
            switch (campo.Tipo)
            {
                case TipoDeCampo.Texto:
                    valores.Add(parte); etiquetas.Add(parte);
                    break;
                case TipoDeCampo.Numero:
                {
                    decimal numero;
                    var mes = campo.Nombre == "mes" ? Array.IndexOf(Meses, Norm(parte)) + 1 : 0;
                    if (mes > 0) numero = mes;
                    else if (!decimal.TryParse(parte, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out numero))
                    { errores.Add($"«{Corto(parte)}» no es un número válido para «{campo.Rotulo}»."); return null; }
                    if (campo.Nombre == "mes" && (numero < 1 || numero > 12)) { errores.Add("El mes debe estar entre 1 y 12."); return null; }
                    if (campo.Nombre == "anio" && (numero < 1900 || numero > 2200)) { errores.Add("El año no es válido."); return null; }
                    valores.Add(numero); etiquetas.Add(numero.ToString(CultureInfo.InvariantCulture));
                    break;
                }
                case TipoDeCampo.Fecha:
                {
                    DateOnly fecha;
                    if (Norm(parte) == "hoy") fecha = hoy;
                    else if (!DateOnly.TryParseExact(parte, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out fecha))
                    { errores.Add($"«{Corto(parte)}» no es una fecha válida (usa AAAA-MM-DD u «hoy»)."); return null; }
                    valores.Add(fecha); etiquetas.Add(Norm(parte) == "hoy" ? "hoy" : fecha.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                    break;
                }
                case TipoDeCampo.Lugar:
                {
                    var territorio = ResolverLugar(parte, catalogos);
                    if (territorio is null)
                    {
                        errores.Add(catalogos.Vocabulario.EsAmbiguo(Clave(parte))
                            ? $"«{Corto(parte)}» corresponde a varios municipios: indica también el departamento."
                            : $"«{Corto(parte)}» no es un {campo.Rotulo.ToLowerInvariant()} del catálogo DIVIPOLA.");
                        return null;
                    }
                    var cambiar = territorio.EsDepartamento ? entidad.Campo("departamento") : entidad.Campo("municipio");
                    if (cambiar is null) { errores.Add($"«{Corto(parte)}» no se puede usar como filtro en {entidad.Plural}."); return null; }
                    if (cambiar != campoFinal && valores.Count == 0)
                    {
                        notas.Add($"«{territorio.Nombre}» es un {(territorio.EsDepartamento ? "departamento" : "municipio")}: se filtra por {cambiar.Rotulo.ToLowerInvariant()}.");
                        campoFinal = cambiar;
                    }
                    else if (cambiar != campoFinal)
                    { errores.Add("Mezcla departamentos y municipios en un mismo filtro."); return null; }
                    valores.Add(territorio.Codigo);
                    // Un nombre repetido en varios departamentos se identifica por su código, para que editar el filtro no lo confunda.
                    var legible = BancoDePreguntasPublicas.Nombre(
                        territorio.EsDepartamento ? catalogos.Departamentos : catalogos.Municipios, territorio.Codigo) ?? territorio.Nombre;
                    etiquetas.Add(catalogos.Vocabulario.EsAmbiguo(Clave(legible)) ? territorio.Codigo : legible);
                    break;
                }
                default:
                {
                    var nombre = ResolverCatalogo(campo.Catalogo!, parte, catalogos, out var problema);
                    if (nombre is null) { errores.Add(problema!); return null; }
                    valores.Add(nombre); etiquetas.Add(nombre);
                    break;
                }
            }
        }

        return new FiltroValidado(campoFinal, operador, valores, string.Join('|', etiquetas));
    }

    private static TerritorioNombrado? ResolverLugar(string texto, CatalogosSemanticos catalogos)
    {
        var vocabulario = catalogos.Vocabulario;
        var codigo = texto.Trim();
        if (codigo.Length is 2 or 5 && codigo.All(char.IsAsciiDigit))
        {
            if (codigo.Length == 2 && catalogos.Departamentos.TryGetValue(codigo, out var dep)) return new(codigo, dep, true, codigo, dep);
            if (codigo.Length == 5 && catalogos.Municipios.TryGetValue(codigo, out var mun)
                && catalogos.Departamentos.TryGetValue(codigo[..2], out var depDelMun)) return new(codigo, mun, false, codigo[..2], depDelMun);
            return null;
        }

        var clave = Clave(texto);
        if (clave.Length == 0) return null;
        foreach (var prefijo in new[] { "", "el ", "la ", "los ", "las ", "departamento de ", "departamento del ", "municipio de ", "ciudad de " })
        {
            if (prefijo.Length > 0 && !clave.StartsWith(prefijo, StringComparison.Ordinal)) continue;
            var resto = clave[prefijo.Length..];
            if (resto.Length == 0) continue;
            var encontrado = vocabulario.Resolver(resto);
            if (encontrado is not null) return encontrado;
        }

        // Nombre corriente de un municipio de nombre oficial largo: «Cali» (Santiago de Cali), «Cartagena» (Cartagena de Indias),
        // «Tumaco» (San Andrés de Tumaco). Solo vale si identifica a un único municipio.
        var candidatos = catalogos.Municipios
            .Select(par => (par.Key, Nombre: Clave(par.Value)))
            .Where(par => par.Nombre.EndsWith(" de " + clave, StringComparison.Ordinal) || par.Nombre.StartsWith(clave + " de ", StringComparison.Ordinal))
            .ToList();
        if (candidatos.Count == 1 && catalogos.Departamentos.TryGetValue(candidatos[0].Key[..2], out var depto))
            return new(candidatos[0].Key, catalogos.Municipios[candidatos[0].Key], false, candidatos[0].Key[..2], depto);
        return null;
    }

    private static string? ResolverCatalogo(string catalogo, string valor, CatalogosSemanticos catalogos, out string? problema)
    {
        problema = null;
        var clave = Clave(valor);
        if (catalogo == "tipo")
        {
            foreach (var tipo in PlantillasDeConsultaPublica.Tipos)
            {
                string[] nombres = [tipo.Id, tipo.Singular, tipo.Plural, .. tipo.Pistas];
                if (nombres.Any(n => Clave(n) == clave)) return char.ToUpperInvariant(tipo.Singular[0]) + tipo.Singular[1..];
            }
            problema = $"«{Corto(valor)}» no es un tipo de proceso (festivales, mercados, talleres, espacios o redes).";
            return null;
        }

        IReadOnlyList<string> lista = catalogo switch
        {
            "practica" => catalogos.Practicas,
            "territorio" => catalogos.Territorios,
            "organizacion" => catalogos.Organizaciones.Select(o => o.Nombre).ToList(),
            _ => [],
        };
        var rotulo = catalogo switch { "practica" => "práctica musical", "territorio" => "territorio sonoro", _ => "organización con ficha pública" };
        lista = lista.DistinctBy(Clave).ToList();
        var exactos = lista.Where(n => Clave(n) == clave).ToList();
        if (exactos.Count == 1) return exactos[0];
        var parecidos = clave.Length >= 4
            ? lista.Where(n => Clave(n).Contains(clave, StringComparison.Ordinal) || (Clave(n).Length >= 4 && clave.Contains(Clave(n), StringComparison.Ordinal))).ToList()
            : [];
        if (parecidos.Count == 1) return parecidos[0];
        problema = parecidos.Count > 1
            ? $"«{Corto(valor)}» coincide con varias opciones ({string.Join(", ", parecidos.Take(4))}): sé más específico."
            : $"«{Corto(valor)}» no está en el catálogo de {rotulo}.";
        return null;
    }
}
