using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>Retirar un Festival archiva sus eventos de la Agenda (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 113); nada se borra.</summary>
public sealed class RetiroDeFestivalArchivaEventosTests
{
    [Fact]
    public async Task Eliminar_un_festival_del_ecosistema_archiva_sus_eventos_y_deja_los_de_otro_festival()
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();
        (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = "test@pnmc.local", Password = "pnmc-master" })).EnsureSuccessStatusCode();

        int festivalId, otroId;
        long eventoId, eventoAjenoId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var institucional = db.EntityProfiles.Single(x => x.IsInstitutional).Id;
            FestivalRow Nuevo(string nombre) => new()
            {
                Name = nombre, OrganizacionPrincipalId = institucional, Description = "Descripción.", CoverageLevel = "municipal",
                DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = "Publicado", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            };
            var uno = Nuevo("Festival que se retira");
            var dos = Nuevo("Festival que sigue");
            db.FestivalRecords.AddRange(uno, dos);
            await db.SaveChangesAsync();
            EventoAgendaRow Evento(int festival, string titulo) => new()
            {
                Slug = "ev-" + Guid.NewGuid().ToString("N")[..10], Titulo = titulo, Descripcion = "Descripción del evento.",
                FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(20), Estado = "publicado", FestivalId = festival,
                FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
            };
            var e1 = Evento(uno.Id, "Concierto de apertura");
            var e2 = Evento(dos.Id, "Concierto del otro festival");
            db.EventosAgenda.AddRange(e1, e2);
            await db.SaveChangesAsync();
            (festivalId, otroId, eventoId, eventoAjenoId) = (uno.Id, dos.Id, e1.Id, e2.Id);
        }

        var token = await cliente.GetFromJsonAsync<TokenAntiforgeryRespuesta>("/api/v1/institucional/festivales/csrf");
        var mensaje = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/institucional/festivales/{festivalId}/archivar")
        {
            Content = JsonContent.Create(new { motivo = "Duplicado." }),
        };
        mensaje.Headers.Add("X-CSRF-TOKEN", token!.RequestToken);
        Assert.Equal(HttpStatusCode.OK, (await cliente.SendAsync(mensaje)).StatusCode);

        using var alcance = factory.Services.CreateScope();
        var db2 = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal("archivado", (await db2.EventosAgenda.AsNoTracking().SingleAsync(e => e.Id == eventoId)).Estado);
        Assert.Equal("publicado", (await db2.EventosAgenda.AsNoTracking().SingleAsync(e => e.Id == eventoAjenoId)).Estado);
        Assert.NotEqual(festivalId, otroId);
    }
}
