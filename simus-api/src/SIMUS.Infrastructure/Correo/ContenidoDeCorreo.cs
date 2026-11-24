using System.Text;
using System.Text.RegularExpressions;

namespace SIMUS.Infrastructure.Correo;

/// <summary>
/// El contenido de un correo del sistema, antes de decidir cómo se ve: título, saludo, párrafos,
/// datos (quién, qué entidad, qué rol), un botón principal y notas al pie.
/// </summary>
/// <remarks>
/// <para>
/// <b>UN SOLO CONTENIDO, DOS REPRESENTACIONES.</b> <see cref="ATextoPlano"/> es lo que se guarda en
/// la cola (<c>dbo.Notificaciones.Cuerpo</c>) y lo que viaja como alternativa de texto plano;
/// <see cref="Leer"/> lo reconstruye al despachar para que
/// <see cref="PlantillaDeCorreoSimus.Documento"/> lo pinte con la plantilla común. Así no hace falta
/// migración ni columna nueva, y los mensajes ya encolados con texto libre se siguen enviando.
/// </para>
/// <para>
/// <b>EL TEXTO VARIABLE SE APLANA.</b> Todo valor que llega de una persona (nombre de organización,
/// observación de un revisor…) pierde sus saltos de línea al entrar: si no, un texto con una línea en
/// blanco y otra con un enlace se reconstruiría como botón, es decir, un enlace ajeno dentro de un
/// correo legítimo del sistema.
/// </para>
/// <para>
/// Formato del texto plano: <c># Título</c>; párrafos separados por línea en blanco; datos como
/// <c>• Etiqueta: valor</c>; el botón como una línea <c>Texto:</c> seguida de una línea con solo el
/// enlace. Lo que viene después del botón se pinta como nota pequeña.
/// </para>
/// </remarks>
public sealed partial class ContenidoDeCorreo
{
    public abstract record Bloque;
    public sealed record Parrafo(string Texto) : Bloque;
    public sealed record Datos(IReadOnlyList<(string Etiqueta, string Valor)> Filas) : Bloque;
    public sealed record Boton(string Texto, string Enlace) : Bloque;

    private readonly List<Bloque> _bloques = [];

    public string? Titulo { get; private set; }
    public IReadOnlyList<Bloque> Bloques => _bloques;

    public static ContenidoDeCorreo Nuevo(string titulo) => new() { Titulo = Aplanar(titulo) };

    /// <summary>«Hola, Ana.» o, sin nombre, «Hola.».</summary>
    public ContenidoDeCorreo ConSaludo(string? nombre) =>
        ConParrafo(string.IsNullOrWhiteSpace(nombre) ? "Hola." : $"Hola, {Aplanar(nombre)}.");

    public ContenidoDeCorreo ConParrafo(string texto)
    {
        var limpio = Aplanar(texto);
        if (limpio.Length > 0) _bloques.Add(new Parrafo(limpio));
        return this;
    }

    public ContenidoDeCorreo ConDatos(params (string Etiqueta, string? Valor)[] filas)
    {
        var validas = filas.Where(f => !string.IsNullOrWhiteSpace(f.Valor))
            .Select(f => (Aplanar(f.Etiqueta).Replace(":", string.Empty, StringComparison.Ordinal), InicialMayuscula(Aplanar(f.Valor!))))
            .ToList();
        if (validas.Count > 0) _bloques.Add(new Datos(validas));
        return this;
    }

    /// <summary>
    /// Los valores de los datos (rol, estado, tipo…) empiezan con mayúscula inicial: «editora» se lee «Editora». No toca los
    /// correos electrónicos ni las direcciones, que se escriben como son.
    /// </summary>
    internal static string InicialMayuscula(string valor)
    {
        if (valor.Length == 0 || !char.IsLower(valor[0])) return valor;
        if (valor.Contains('@', StringComparison.Ordinal) || valor.StartsWith("http", StringComparison.OrdinalIgnoreCase)) return valor;
        return char.ToUpper(valor[0], System.Globalization.CultureInfo.GetCultureInfo("es-CO")) + valor[1..];
    }

    /// <summary>El botón principal. Solo uno por correo, y solo con un enlace del propio sistema.</summary>
    public ContenidoDeCorreo ConBoton(string texto, string enlace)
    {
        if (_bloques.OfType<Boton>().Any()) throw new InvalidOperationException("Un correo lleva un solo botón principal.");
        _bloques.Add(new Boton(Aplanar(texto).TrimEnd(':'), Aplanar(enlace).Replace(" ", string.Empty, StringComparison.Ordinal)));
        return this;
    }

    public string ATextoPlano()
    {
        var bloques = new List<string>();
        if (!string.IsNullOrEmpty(Titulo)) bloques.Add("# " + Titulo);
        foreach (var bloque in _bloques)
        {
            bloques.Add(bloque switch
            {
                Parrafo p => p.Texto,
                Datos d => string.Join("\n", d.Filas.Select(f => $"• {f.Etiqueta}: {f.Valor}")),
                Boton b => $"{b.Texto}:\n{b.Enlace}",
                _ => string.Empty,
            });
        }
        return string.Join("\n\n", bloques);
    }

    /// <summary>
    /// Reconstruye el contenido desde el texto de la cola. Todo lo que no sea título, datos o botón
    /// es un párrafo, de modo que un texto libre anterior a esta plantilla también se pinta bien.
    /// </summary>
    public static ContenidoDeCorreo Leer(string texto, string? tituloPorOmision = null)
    {
        var contenido = new ContenidoDeCorreo { Titulo = tituloPorOmision is null ? null : Aplanar(tituloPorOmision) };
        var normal = (texto ?? string.Empty).Replace("\r\n", "\n", StringComparison.Ordinal).Trim();
        var primero = true;
        foreach (var crudo in BloqueSeparado().Split(normal))
        {
            var bloque = crudo.Trim();
            if (bloque.Length == 0) continue;
            var lineas = bloque.Split('\n').Select(l => l.Trim()).ToArray();
            if (primero && lineas.Length == 1 && lineas[0].StartsWith("# ", StringComparison.Ordinal))
            {
                contenido.Titulo = lineas[0][2..].Trim();
            }
            else if (lineas.All(l => FilaDeDatos().IsMatch(l)))
            {
                var filas = lineas.Select(l => FilaDeDatos().Match(l))
                    .Select(m => (m.Groups[1].Value, m.Groups[2].Value)).ToList();
                contenido._bloques.Add(new Datos(filas));
            }
            else if (lineas.Length == 2 && lineas[0].EndsWith(':') && EsEnlace(lineas[1])
                && !contenido._bloques.OfType<Boton>().Any())
            {
                contenido._bloques.Add(new Boton(lineas[0].TrimEnd(':'), lineas[1]));
            }
            else
            {
                contenido._bloques.Add(new Parrafo(string.Join(" ", lineas)));
            }
            primero = false;
        }
        return contenido;
    }

    private static bool EsEnlace(string linea) =>
        !linea.Contains(' ', StringComparison.Ordinal)
        && (linea.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            || linea.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || (linea.StartsWith('/') && !linea.StartsWith("//", StringComparison.Ordinal)));

    /// <summary>Una sola línea, sin espacios repetidos: ningún texto de persona puede abrir un bloque nuevo.</summary>
    internal static string Aplanar(string? texto) =>
        string.IsNullOrWhiteSpace(texto) ? string.Empty : EspaciosRepetidos().Replace(texto, " ").Trim();

    [GeneratedRegex(@"\s+")]
    private static partial Regex EspaciosRepetidos();

    [GeneratedRegex(@"\n\s*\n")]
    private static partial Regex BloqueSeparado();

    [GeneratedRegex(@"^• ([^:]+): (.+)$")]
    private static partial Regex FilaDeDatos();
}
