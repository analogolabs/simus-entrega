namespace SIMUS.Api.Security;

/// <summary>
/// La forma en que un correo electrónico se guarda y se compara.
/// </summary>
/// <remarks>
/// <para>
/// <b>ESTABA ESCRITO DIEZ VECES, EN DOS IDIOMAS Y CON TRES COMPORTAMIENTOS.</b> La auditoría del 21
/// de septiembre de 2026 lo encontró como <c>NormalizeEmail</c> en cuatro ficheros —devolvía
/// <c>string</c>, y un valor en blanco se convertía en cadena vacía— y como
/// <c>NormalizarCorreo</c> en otros seis, donde unas veces devolvía nulo ante un valor en blanco,
/// otras cadena vacía, y en el boletín además validaba el largo.
/// </para>
/// <para>
/// <b>EL RIESGO ERA REAL AUNQUE NO HUBIERA LLEGADO A LOS DATOS.</b> Se comprobó en la base y todas
/// las columnas de correo tenían nulos y cero cadenas vacías, de modo que la divergencia no había
/// mordido todavía. Pero que un correo en blanco se guardara como <c>NULL</c> o como <c>''</c> según
/// por qué puerta entrara es la clase de diferencia que nadie ve hasta que una consulta cuenta mal.
/// </para>
/// <para>
/// <b>SE ELIGIO EL NULO, Y NO LA CADENA VACIA.</b> Un correo en blanco es la AUSENCIA de un correo,
/// no un correo que vale «». Las columnas que lo guardan admiten nulo, el resto del proyecto limpia
/// así —<c>string.IsNullOrWhiteSpace(x) ? null : x.Trim()</c>— y comparar contra nulo no encuentra a
/// nadie, que es exactamente lo que debe pasar si alguien intenta entrar sin escribir su correo.
/// </para>
/// </remarks>
public static class CorreoElectronico
{
    /// <summary>
    /// El correo tal como se guarda y se compara: sin espacios alrededor y en minúsculas.
    /// </summary>
    /// <remarks>
    /// EN MINUSCULAS PORQUE LA PARTE DEL DOMINIO NO DISTINGUE MAYUSCULAS y, en la práctica, tampoco
    /// lo hace ningún proveedor para la parte local. Guardarlo tal cual llegó haría que la misma
    /// persona escrita con una mayúscula distinta pareciera otra.
    /// </remarks>
    public static string? Normalizar(string? valor) =>
        string.IsNullOrWhiteSpace(valor) ? null : valor.Trim().ToLowerInvariant();

    /// <summary>
    /// El correo enmascarado para enseñarlo a quien quizá no es su dueño: «a•••o@dominio.org».
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>PARA QUE UN ENLACE REENVIADO NO REVELE LA DIRECCION COMPLETA.</b> La invitación a
    /// una organización solo la acepta la cuenta con ese correo; la página tiene que decir a cuál se
    /// envió para que la persona sepa con qué cuenta entrar, sin entregar la dirección entera a quien
    /// recibió el enlace de segunda mano.
    /// </para>
    /// <para>
    /// <b>LA MISMA REGLA QUE <c>enmascararCorreo</c> DEL FRONTEND</b> —primera letra, tres puntos y
    /// última letra de la parte local si tiene más de tres; el dominio entero—: la página compara la
    /// cuenta con la sesión enmascarando las dos.
    /// </para>
    /// </remarks>
    public static string Enmascarar(string? valor)
    {
        var correo = Normalizar(valor);
        if (correo is null) return string.Empty;
        var arroba = correo.LastIndexOf('@');
        if (arroba <= 0) return "•••";
        var local = correo[..arroba];
        var dominio = correo[arroba..];
        var oculto = local.Length > 3 ? $"{local[0]}•••{local[^1]}" : $"{local[0]}•••";
        return oculto + dominio;
    }
}
