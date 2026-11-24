using System.Globalization;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Qué es un NIT de organización y qué no (decisión 96 de docs/referencia/20-decisiones-y-flujos-por-modulo.md, decidida el 19 de noviembre de 2026).
/// </summary>
/// <remarks>
/// <para>
/// <b>LA REGLA, EN UNA FRASE.</b> El campo «NIT» de una organización solo admite el NIT de una
/// persona jurídica: nueve dígitos que empiezan por 8 o por 9, con el dígito de verificación
/// opcional (<c>900123456-7</c>, <c>900.123.456-7</c>, <c>9001234567</c> o <c>900123456</c>). Si se
/// escribe el dígito de verificación, tiene que ser el que calcula el algoritmo de la DIAN (módulo
/// 11 con los pesos 3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71). Una organización
/// sin personería jurídica deja el campo vacío: se identifica por su responsable.
/// </para>
/// <para>
/// <b>POR QUÉ SE RECHAZA LA CÉDULA.</b> Una cédula es un dato personal (Ley 1581 de 2012) y este
/// campo se ve en fichas, listados y exportaciones. Las cédulas tienen entre 6 y 10 dígitos y las
/// de 10 empiezan por 1; ninguna tiene nueve dígitos que empiecen por 8 o 9. Por eso «nueve dígitos
/// que empiezan por 8 o 9» separa sin ambigüedad el NIT de una persona jurídica de una cédula.
/// También queda fuera el NIT de una persona natural comerciante (su cédula más un dígito de
/// verificación), que empieza por otro dígito: esa persona se identifica por su responsable.
/// </para>
/// <para>
/// <b>LO QUE SE GUARDA.</b> Siempre la forma canónica <c>NNNNNNNNN-D</c>, con el dígito de
/// verificación calculado si no se escribió. Así «900.123.456-7» y «900123456» son el mismo NIT y
/// el índice único los reconoce como duplicado.
/// </para>
/// <para>
/// <b>LO QUE NO SE HACE.</b> No se migran los valores que ya estaban guardados: la regla se aplica
/// a lo que se escribe. Un valor antiguo que no cumple se conserva hasta que alguien lo cambie, y
/// el historial lo trata como dato de identificación (solo lo lee la consola con Auditoría).
/// </para>
/// </remarks>
internal static class NitColombiano
{
    private static readonly int[] Pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

    internal enum Resultado
    {
        /// <summary>Sin valor: permitido, la organización no tiene personería jurídica.</summary>
        Vacio,
        Valido,
        /// <summary>Tiene forma de cédula, de NIT de persona natural o de otro documento de una persona.</summary>
        FormaDeCedula,
        DigitoIncorrecto,
        FormatoInvalido,
    }

    internal const string MensajeDeCedula =
        "Este campo es para el NIT de la organización (9 dígitos y dígito de verificación, por ejemplo 900123456-7), "
        + "no para una cédula. Si la organización no tiene personería jurídica, deja el campo vacío: se identifica por su responsable.";

    internal const string MensajeDeDigito =
        "El dígito de verificación no corresponde a este NIT. Revisa el número (por ejemplo 900123456-7) o escríbelo sin el dígito.";

    internal const string MensajeDeFormato =
        "El NIT debe tener 9 dígitos y, si quieres, el dígito de verificación (por ejemplo 900123456-7). "
        + "No lleva letras ni otros símbolos.";

    /// <summary>Analiza un valor escrito por una persona y devuelve su forma canónica si es un NIT.</summary>
    internal static (Resultado Resultado, string? Canonico) Analizar(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return (Resultado.Vacio, null);

        var texto = valor.Trim();
        foreach (var c in texto)
        {
            if (!(char.IsAsciiDigit(c) || c is '.' or '-' or ' '))
                return (Resultado.FormatoInvalido, null);
        }

        // «900123456 - 7» y «900.123.456-7»: los puntos y los espacios no significan nada.
        var limpio = new string(texto.Where(c => c is not ('.' or ' ')).ToArray());
        string baseNit;
        string? digitoEscrito = null;
        var guion = limpio.IndexOf('-', StringComparison.Ordinal);
        if (guion >= 0)
        {
            // Un único guion y un único dígito de verificación detrás de él.
            if (limpio.LastIndexOf('-') != guion || limpio.Length - guion - 1 != 1 || guion == 0)
                return (Resultado.FormatoInvalido, null);
            baseNit = limpio[..guion];
            digitoEscrito = limpio[(guion + 1)..];
        }
        else if (limpio.Length == 10)
        {
            // Sin guion, diez dígitos: nueve de NIT y el de verificación.
            baseNit = limpio[..9];
            digitoEscrito = limpio[9..];
        }
        else
        {
            baseNit = limpio;
        }

        if (baseNit.Length == 9 && (baseNit[0] == '8' || baseNit[0] == '9'))
        {
            var calculado = DigitoDeVerificacion(baseNit);
            if (digitoEscrito is not null && digitoEscrito != calculado.ToString(CultureInfo.InvariantCulture))
                return (Resultado.DigitoIncorrecto, null);
            return (Resultado.Valido, $"{baseNit}-{calculado.ToString(CultureInfo.InvariantCulture)}");
        }

        // Solo dígitos pero no es un NIT de persona jurídica: lo normal es una cédula.
        return baseNit.Length is >= 5 and <= 11
            ? (Resultado.FormaDeCedula, null)
            : (Resultado.FormatoInvalido, null);
    }

    /// <summary>Dígito de verificación de la DIAN para nueve dígitos.</summary>
    internal static int DigitoDeVerificacion(string baseNit)
    {
        var suma = 0;
        for (var i = 0; i < baseNit.Length; i++)
            suma += (baseNit[baseNit.Length - 1 - i] - '0') * Pesos[i];
        var resto = suma % 11;
        return resto > 1 ? 11 - resto : resto;
    }

    /// <summary>El mensaje de error en español, o <c>null</c> si el valor está vacío o es un NIT válido.</summary>
    internal static string? Validar(string? valor) => Analizar(valor).Resultado switch
    {
        Resultado.FormaDeCedula => MensajeDeCedula,
        Resultado.DigitoIncorrecto => MensajeDeDigito,
        Resultado.FormatoInvalido => MensajeDeFormato,
        _ => null,
    };

    /// <summary>Verdadero si el valor es un NIT válido. Vacío no lo es: no hay nada que clasificar.</summary>
    internal static bool EsValido(string? valor) => Analizar(valor).Resultado == Resultado.Valido;

    /// <summary>Las formas con las que un NIT pudo guardarse antes de que existiera la forma canónica.</summary>
    internal static string[] FormasEquivalentes(string canonico)
    {
        var baseNit = canonico[..9];
        var dv = canonico[10..];
        var puntos = $"{baseNit[..3]}.{baseNit[3..6]}.{baseNit[6..]}";
        return [canonico, baseNit + dv, baseNit, $"{puntos}-{dv}", puntos];
    }
}
