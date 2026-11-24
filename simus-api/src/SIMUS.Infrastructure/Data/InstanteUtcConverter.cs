using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace SIMUS.Infrastructure.Data;

/// <summary>
/// TODO INSTANTE QUE SALE DE LA BASE ES UTC, Y LO DICE.
/// </summary>
/// <remarks>
/// <para>
/// <b>Que estaba roto.</b> La base guarda los instantes en <c>datetime2</c> con
/// <c>SYSUTCDATETIME()</c> o <c>DateTime.UtcNow</c>: son UTC. Pero <c>datetime2</c> no guarda la
/// zona, y EF los devolvia con <see cref="DateTimeKind.Unspecified"/>. System.Text.Json escribe un
/// <c>Unspecified</c> SIN sufijo —<c>"2026-11-05T23:23:00"</c>— y el navegador lee una fecha sin
/// zona como hora LOCAL. Resultado medido en la consola: «Enviado 23:23» y, en la misma ficha, el
/// historial «18:23», que si pasaba por <c>DateTime.SpecifyKind</c> a mano. Cinco horas de
/// diferencia en la trazabilidad, y toda solicitud «enviada ahora mismo».
/// </para>
/// <para>
/// <b>Por que aqui y no en el serializador.</b> Es la via menos invasiva y la unica que no adivina:
/// el valor nace marcado como UTC en el unico sitio donde se sabe que lo es —al leerlo de una
/// columna <c>datetime2</c> de SIMUS—, y desde ahi cualquier serializacion, comparacion o
/// <c>ToUniversalTime()</c> lo trata bien sin tocar ningun contrato. Un convertidor de JSON que
/// pusiera «Z» a todo <c>Unspecified</c> tendria que suponer lo mismo de valores que no vienen de la
/// base. Se aplica como convencion en <see cref="SimusDbContext"/>, asi que alcanza a las
/// proyecciones (<c>Select</c> a un DTO), que es por donde sale la mayor parte de las fechas.
/// </para>
/// <para>
/// <b>Las fechas de calendario no pasan por aqui.</b> Una fecha de edicion o de evento es un
/// <see cref="DateOnly"/> (columna <c>date</c>) y no tiene zona: el 5 de noviembre es el 5 de
/// noviembre en Bogota y en cualquier parte. Las tres columnas <c>date</c> heredadas que todavia se
/// leen como <see cref="DateTime"/> en <c>FestivalRow</c> se excluyen expresamente.
/// </para>
/// <para>
/// <b>Al escribir</b> se normaliza: un <see cref="DateTimeKind.Local"/> —por ejemplo, el de una
/// fecha con desfase que llego en una peticion— se pasa a UTC antes de guardarlo; un
/// <c>Unspecified</c> se guarda tal cual, porque en SIMUS lo que no dice zona es UTC.
/// </para>
/// </remarks>
public sealed class InstanteUtcConverter : ValueConverter<DateTime, DateTime>
{
    public InstanteUtcConverter()
        : base(
            valor => valor.Kind == DateTimeKind.Local ? valor.ToUniversalTime() : valor,
            valor => DateTime.SpecifyKind(valor, DateTimeKind.Utc))
    {
    }
}
