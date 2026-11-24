using System.Globalization;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Api.Historial;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// PR-5a del retiro de <c>dbo.PerfilesPublicosFestival</c>: las propuestas de cambio de Festival se proyectan y se escriben sobre
/// la cabecera por el circuito común (<see cref="FestivalConPropuestas"/>), con la misma lista cerrada de campos de siempre.
/// </summary>
public sealed class FestivalConPropuestasTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public FestivalConPropuestasTests(TestWebApplicationFactory factory) => _factory = factory;

    /// <summary>Los diecisiete identificadores y rótulos que tenía <c>CamposProponiblesDeFestival</c>: no cambian (la historia y las notas los usan).</summary>
    private static readonly (string Id, string Etiqueta)[] CamposDeSiempre =
    [
        ("nombre", "Nombre del festival"), ("descripcion", "Descripción"), ("periodicidad", "Periodicidad"),
        ("periodicidadDetalle", "Detalle de la periodicidad"), ("nivelCobertura", "Alcance territorial"),
        ("codigoDepartamento", "Departamento"), ("codigoMunicipio", "Municipio"), ("correoContacto", "Correo de contacto"),
        ("telefonoContacto", "Teléfono de contacto"), ("instagram", "Instagram"), ("facebook", "Facebook"), ("sitioWeb", "Sitio web"),
        ("otroEnlace", "Otro enlace"), ("observacionesContacto", "Observaciones de contacto"), ("director", "Director o directora"),
        ("tipoOrganizadorId", "Tipo de organización"), ("practicasMusicales", "Prácticas musicales"), ("territoriosSonoros", "Territorios sonoros"),
    ];

    [Fact]
    public void La_lista_cerrada_de_campos_es_la_de_siempre_y_nada_mas()
    {
        var campos = FestivalConPropuestas.Instancia.Campos;
        Assert.Equal(CamposDeSiempre.Length, campos.Count);
        foreach (var (id, etiqueta) in CamposDeSiempre)
        {
            Assert.True(campos.TryGetValue(id, out var campo), $"Falta el campo {id}.");
            Assert.Equal(etiqueta, campo!.Etiqueta);
        }

        Assert.Equal(Modulos.Festivales, FestivalConPropuestas.Instancia.Modulo);
        // Fuera de la lista no se guarda, no se compara y no se aplica.
        Assert.DoesNotContain("estado", campos.Keys);
        Assert.DoesNotContain("organizacionPrincipalId", campos.Keys);
    }

    [Fact]
    public async Task La_proyeccion_prefiere_el_antes_copiado_y_lee_de_la_cabecera_lo_que_no_se_toca()
    {
        int festivalId;
        long propuestaId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            // La cabecera YA dice lo aprobado («segunda»): la propuesta se aplicó y el «antes» solo vive en su fila.
            var festival = new FestivalRow
            {
                Name = "Festival segunda", Description = "Texto que no se toca", CoverageLevel = "municipal", DepartmentCode = "05",
                MunicipalityCode = "05001", StatusCode = "Publicado", CreatedAt = DateTime.UtcNow,
            };
            db.FestivalRecords.Add(festival);
            db.SaveChanges();
            festivalId = festival.Id;
            var propuesta = new PropuestaDeCambioRow
            {
                ModuloId = Modulos.Festivales, RegistroId = festival.Id.ToString(CultureInfo.InvariantCulture),
                Estado = EstadosDePropuesta.Aplicada, FechaCreacion = DateTime.UtcNow,
            };
            db.PropuestasDeCambio.Add(propuesta);
            db.SaveChanges();
            db.PropuestasDeCambioCampos.Add(new PropuestaDeCambioCampoRow
            {
                IdPropuesta = propuesta.Id, SeccionId = "generales", CampoId = "nombre", CampoEtiqueta = "Nombre del festival",
                ValorAnterior = "Festival primera", ValorPropuesto = "Festival segunda", FechaCreacion = DateTime.UtcNow,
            });
            db.SaveChanges();
            propuestaId = propuesta.Id;
        }

        using var lectura = _factory.Services.CreateScope();
        var dbLectura = lectura.ServiceProvider.GetRequiredService<SimusDbContext>();
        var expediente = dbLectura.PropuestasDeCambio.Single(p => p.Id == propuestaId);
        var proyectada = await PropuestaDeFestivalProyectada.DeAsync(dbLectura, expediente, default);

        Assert.NotNull(proyectada);
        Assert.Equal(festivalId, proyectada!.Festival.Id);
        Assert.Equal("Festival segunda", proyectada.Nombre);
        Assert.Equal("Festival primera", proyectada.Anterior("nombre"));
        // Lo que la propuesta no toca vale lo mismo antes y después: sale de la cabecera.
        Assert.Equal("Texto que no se toca", proyectada.Anterior("descripcion"));
        Assert.Equal(proyectada.Anterior("descripcion"), proyectada.Descripcion);
    }

    [Fact]
    public async Task Sin_cabecera_no_hay_proyeccion()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var expediente = new PropuestaDeCambioRow { ModuloId = Modulos.Festivales, RegistroId = "999999", Estado = EstadosDePropuesta.Borrador };
        Assert.Null(await PropuestaDeFestivalProyectada.DeAsync(db, expediente, default));
    }
}
