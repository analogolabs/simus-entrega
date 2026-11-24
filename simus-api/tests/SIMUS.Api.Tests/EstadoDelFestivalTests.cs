using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El estado de un Festival, y qué llega al público por él.
/// </summary>
/// <remarks>
/// <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Que un registro cuyo estado nadie decidió aparezca en el
/// portal; que una versión nazca sin estado y quede fuera de todo vocabulario; y que el circuito
/// vuelva a nombrar un estado que ningún camino escribe.
/// </remarks>
public sealed class EstadoDelFestivalTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public EstadoDelFestivalTests(TestWebApplicationFactory factory) => _factory = factory;

    /// <summary>
    /// Un Festival sin estado declarado no se puede ni crear.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>LA LECTURA PUBLICA EMPEZABA POR `item.StatusCode == null`</b>, es decir: un registro sin
    /// estado salía en el portal. Al escribir esta prueba se descubrió que el caso no se puede
    /// construir <b>en ninguno de los dos motores</b>: la columna es NOT NULL también en el modelo
    /// de EF, así que SQLite la rechaza igual que SQL Server. La rama no era «alcanzable solo en
    /// pruebas» —como se había supuesto— sino código muerto en todas partes, declarando además lo
    /// contrario de lo que el sistema hace: lo que entra por Importación Asistida nace en borrador,
    /// no publicado.
    /// </para>
    /// <para>
    /// LA PRUEBA COMPRUEBA LO QUE SI SE PUEDE COMPROBAR: que el modelo no admite un Festival sin
    /// estado. Es la razón por la que la rama sobraba, y si alguien hiciera anulable esa columna,
    /// esta prueba se pondría roja antes de que nadie volviera a añadirla.
    /// </para>
    /// </remarks>
    [Fact]
    public async Task UnFestivalSinEstadoNoSePuedeGuardar()
    {
        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();

        db.FestivalRecords.Add(new FestivalRow
        {
            Name = $"Festival sin estado {Guid.NewGuid():N}",
            CoverageLevel = "municipal",
            DepartmentCode = "11",
            MunicipalityCode = "11001",
            StatusCode = null!,
            CreatedAt = DateTime.UtcNow,
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    /// <summary>
    /// El circuito no nombra estados que nadie escribe.
    /// </summary>
    /// <remarks>
    /// <c>aprobado</c> estaba en dos listas de lectura del circuito —qué procesos cuentan como
    /// dependientes de una organización, y cuáles impiden darla de baja— y ningún camino del API lo
    /// escribe: cero escrituras medidas, cero filas en la base. Cada una tenía por tanto una rama
    /// muerta. La constante se conserva porque la fila existe en el catálogo compartido; lo que no
    /// se conserva es fingir que un Festival puede estar en ella.
    /// </remarks>
    [Fact]
    public void ElCircuitoNoNombraEstadosInalcanzables()
    {
        Assert.DoesNotContain(EstadosFestival.Aprobado, EstadosFestival.DelCircuito);

        // Y los cinco que sí lo recorren siguen ahí: la prueba no debe pasar por haberlos borrado.
        Assert.Equal(
            [EstadosFestival.Borrador, EstadosFestival.EnRevision, EstadosFestival.AjustesSolicitados,
             EstadosFestival.Rechazado, EstadosFestival.Publicado],
            EstadosFestival.DelCircuito);
    }
}
