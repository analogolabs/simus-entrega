using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Api.Security;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Qué módulos de la consola tiene activados cada cuenta.
/// </summary>
/// <remarks>
/// <para>
/// <b>TRES RUTAS Y CADA UNA RESPONDE A OTRA PREGUNTA.</b> «Qué módulos existen» lo necesita la
/// pantalla que los concede; «qué tiene esta cuenta» también; y «qué tengo yo» lo necesita CUALQUIER
/// cuenta al abrir la consola, para dibujar su barra izquierda. Por eso la tercera no exige el
/// módulo «usuarios»: si lo exigiera, solo quien administra usuarios podría ver su propio menú.
/// </para>
/// <para>
/// <b>SE GUARDA LA LISTA ENTERA Y NO UN «AÑADE» Y UN «QUITA».</b> La pantalla es una lista de
/// casillas: lo que la persona decide es el conjunto, no una diferencia. Con dos operaciones habría
/// que reconstruir aquí qué cambió, y dos pestañas abiertas podrían dejar un estado que nadie
/// eligió. Con el conjunto, la última en guardar gana y lo que queda es exactamente lo que se vio.
/// </para>
/// </remarks>
public static class PermisosDeModuloEndpoints
{
    public static RouteGroupBuilder MapPermisosDeModuloEndpoints(this RouteGroupBuilder group)
    {
        // MIS MODULOS: sin exigir «usuarios», porque toda cuenta necesita saber qué puede abrir.
        group.MapGet("/admin/mis-modulos", async (
            ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct) =>
        {
            var cuenta = PermisosDeModulo.CuentaDe(principal);
            if (cuenta is null) return Results.Unauthorized();

            var esWebmaster = principal.IsInRole(Permisos.Webmaster);
            var mios = await PermisosDeModulo.DeLaCuentaAsync(db, cuenta.Value, esWebmaster, ct);

            return Results.Ok(new
            {
                modulos = mios,
                siempreActivados = ModulosDeLaConsola.SiempreActivados,
                // SE DICE SI LOS TIENE TODOS POR SER WEBMASTER y no por concesión: la pantalla que
                // administra permisos necesita explicar por qué sus casillas están todas puestas.
                todosPorSerWebmaster = esWebmaster,
            });
        })
        .WithName("MisModulosDeConsola")
        .RequireAuthorization(Permisos.PoliticaFuncionario);

        // EL VOCABULARIO DE TIPOS DE DOCUMENTO, LEIDO DE LA TABLA. Es el mismo catálogo del país
        // que usa el alta externa, y aquí se lee de `dbo.TiposDocumento` en vez de llevar una copia:
        // el número de identificación de una cuenta administrativa se captura con una lista, no con
        // texto libre, igual que cualquier otro vocabulario controlado del proyecto.
        //
        // SIN EXIGIR «usuarios» NI EL PRIMER INGRESO TERMINADO. Vivía dentro del grupo
        // `/admin/usuarios`, y el filtro de módulo responde 403 a quien no tiene «usuarios» y a quien
        // no ha terminado su primer ingreso. Justo quien más lo necesita —la cuenta recién entregada,
        // en el paso «Dinos quién eres»— era la única que nunca podía leerlo: el tipo de documento es
        // obligatorio y el desplegable llegaba vacío, así que ningún gestor nuevo podía entrar. Es un
        // dato público y estable; basta con ser funcionario.
        group.MapGet("/admin/catalogos/tipos-documento", async (SimusDbContext db, CancellationToken ct) =>
            Results.Ok(await db.TiposDocumento.AsNoTracking()
                .Where(t => t.Activo)
                .OrderBy(t => t.OrdenVisualizacion)
                .Select(t => new { codigo = t.Codigo, etiqueta = t.Nombre })
                .ToListAsync(ct)))
        .WithName("TiposDeDocumentoParaLaConsola")
        .WithTags("admin-modulos-por-cuenta")
        .RequireAuthorization(Permisos.PoliticaFuncionario);

        var administracion = group.MapGroup("/admin/usuarios")
            .WithTags("admin-modulos-por-cuenta")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .ExigeModulo("usuarios");

        // EL CATALOGO: qué módulos existen y cuáles no se pueden quitar.
        administracion.MapGet("/modulos-disponibles", () => Results.Ok(new
        {
            modulos = ModulosDeLaConsola.Todos,
            siempreActivados = ModulosDeLaConsola.SiempreActivados,
            // Los que solo abre el webmaster: la ficha no los ofrece a otro rol.
            soloWebmaster = ModulosDeLaConsola.SoloWebmaster,
        }))
        .WithName("ModulosDisponiblesDeConsola");

        administracion.MapGet("/{id:int}/modulos", async (
            int id, SimusDbContext db, CancellationToken ct) =>
        {
            var cuenta = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
            if (cuenta is null) return Results.NotFound();

            var esWebmaster = await EsWebmasterAsync(db, id, ct);
            var suyos = await PermisosDeModulo.DeLaCuentaAsync(db, id, esWebmaster, ct);

            return Results.Ok(new
            {
                idUsuario = id,
                modulos = suyos,
                siempreActivados = ModulosDeLaConsola.SiempreActivados,
                todosPorSerWebmaster = esWebmaster,
            });
        })
        .WithName("ModulosDeUnaCuenta");

        administracion.MapPut("/{id:int}/modulos", async (
            int id, ModulosDeUnaCuentaSolicitud solicitud, ClaimsPrincipal principal,
            SimusDbContext db, CancellationToken ct) =>
        {
            var cuenta = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (cuenta is null) return Results.NotFound();

            // UN MODULO QUE NO EXISTE NO SE GUARDA EN SILENCIO: se dice cuál, porque casi siempre es
            // un identificador mal escrito y adivinarlo desde una lista vacía cuesta una tarde.
            var pedidos = (solicitud.Modulos ?? []).Select(m => (m ?? string.Empty).Trim()).ToList();
            var desconocidos = pedidos.Where(m => !ModulosDeLaConsola.Existe(m)).ToList();
            if (desconocidos.Count > 0)
            {
                return Results.BadRequest(new
                {
                    modulos = new[]
                    {
                        $"Estos no son módulos de la consola: {string.Join(", ", desconocidos)}.",
                    },
                });
            }

            // LOS DE SIEMPRE NO SE GUARDAN, aunque vengan en la lista: guardarlos sería poder
            // borrarlos. Se descartan aquí y el catálogo del servidor los sigue concediendo.
            var aGuardar = pedidos
                .Where(m => !ModulosDeLaConsola.EsSiempreActivado(m))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // NI SE GUARDAN LOS QUE EL ROL NUNCA ABRIRA. A una cuenta que no es webmaster,
            // «usuarios» y «sistema» no le abren nada: guardarlos sería contar una llave sin puerta.
            // Se descartan, y si la base los tenía de antes, salen con el resto de lo no pedido.
            var esWebmasterLaCuenta = await EsWebmasterAsync(db, id, ct);
            if (!esWebmasterLaCuenta)
            {
                aGuardar.RemoveAll(ModulosDeLaConsola.EsSoloWebmaster);
            }

            await GuardarConjuntoAsync(db, id, aGuardar, PermisosDeModulo.CuentaDe(principal), ct);

            return Results.Ok(new
            {
                idUsuario = id,
                modulos = await PermisosDeModulo.DeLaCuentaAsync(db, id, esWebmasterLaCuenta, ct),
                siempreActivados = ModulosDeLaConsola.SiempreActivados,
                todosPorSerWebmaster = esWebmasterLaCuenta,
            });
        })
        .WithName("GuardarModulosDeUnaCuenta")
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir);

        // EL APARTADO «MODULOS DEL GESTOR»: quién tiene qué, de todas las cuentas de consola, en UNA consulta.
        // Es la vista inversa («¿quién tiene este módulo?»): sin ella había que abrir la ficha de cada cuenta y
        // contar casillas. Solo cuentas con rol interno; las externas no entran a la consola.
        administracion.MapGet("/modulos/resumen", async (SimusDbContext db, CancellationToken ct) =>
        {
            var cuentas = await db.Users.AsNoTracking()
                .OrderByDescending(u => u.IsActive).ThenBy(u => u.FullName)
                .Select(u => new { u.Id, u.FullName, u.Email, u.IsActive })
                .ToListAsync(ct);
            var roles = await RolesDeUsuario.ObtenerDeVariosAsync(db, cuentas.Select(c => c.Id).ToList(), ct);
            var concedidos = (await db.ModulosPorCuenta.AsNoTracking()
                    .Select(x => new { x.IdUsuario, x.CodigoModulo }).ToListAsync(ct))
                .GroupBy(x => x.IdUsuario)
                .ToDictionary(g => g.Key, g => g.Select(x => x.CodigoModulo).ToHashSet(StringComparer.OrdinalIgnoreCase));

            var filas = new List<object>();
            foreach (var c in cuentas)
            {
                var suyos = roles.TryGetValue(c.Id, out var r) ? r : [];
                if (!suyos.Any(nombre => Permisos.RolesInternos.Contains(nombre, StringComparer.OrdinalIgnoreCase))) continue;

                var esWebmaster = suyos.Contains(Permisos.Webmaster, StringComparer.OrdinalIgnoreCase);
                var tiene = concedidos.TryGetValue(c.Id, out var g) ? g : [];
                var modulos = esWebmaster
                    ? ModulosDeLaConsola.Todos.ToList()
                    : ModulosDeLaConsola.AlAlcanceDe(false)
                        .Where(m => ModulosDeLaConsola.EsSiempreActivado(m) || tiene.Contains(m)).ToList();
                filas.Add(new { id = c.Id, nombre = c.FullName, correo = c.Email, activa = c.IsActive, esWebmaster, modulos });
            }

            return Results.Ok(new
            {
                cuentas = filas,
                siempreActivados = ModulosDeLaConsola.SiempreActivados,
                soloWebmaster = ModulosDeLaConsola.SoloWebmaster,
            });
        })
        .WithName("ResumenDeModulosDeLasCuentas");

        // EL INTERRUPTOR DE UN MODULO PARA UNA CUENTA. Habilitar o deshabilitar UNO no debe reescribir el
        // conjunto con lo que la pantalla creía que había: dos personas con la pantalla abierta se pisarían.
        // Aquí se parte de lo que hay en la base en este instante y se cambia solo ese módulo.
        administracion.MapPut("/{id:int}/modulos/{codigo}", async (
            int id, string codigo, InterruptorDeModuloSolicitud solicitud, ClaimsPrincipal principal,
            SimusDbContext db, CancellationToken ct) =>
        {
            var cuenta = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
            if (cuenta is null) return Results.NotFound();

            codigo = (codigo ?? string.Empty).Trim();
            if (!ModulosDeLaConsola.Existe(codigo))
            {
                return Rechazo($"Estos no son módulos de la consola: {codigo}.");
            }

            // LOS QUE NO SE TOCAN, se dice por qué en vez de ignorarlo en silencio.
            if (ModulosDeLaConsola.EsSiempreActivado(codigo))
            {
                return Rechazo("Resumen operativo y Solicitudes y revisiones van siempre activados.");
            }
            if (ModulosDeLaConsola.EsSoloWebmaster(codigo))
            {
                return Rechazo("Ese módulo solo lo abre el rol webmaster.");
            }

            // UN WEBMASTER LOS TIENE TODOS: no se le conceden ni se le quitan (y por eso tampoco a sí mismo).
            if (await EsWebmasterAsync(db, id, ct))
            {
                return Rechazo("Un webmaster tiene todos los módulos y no se le pueden quitar.");
            }

            var conjunto = (await db.ModulosPorCuenta.AsNoTracking()
                    .Where(x => x.IdUsuario == id).Select(x => x.CodigoModulo).ToListAsync(ct))
                .Where(m => ModulosDeLaConsola.Existe(m) && !ModulosDeLaConsola.EsSoloWebmaster(m))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            conjunto.RemoveAll(m => string.Equals(m, codigo, StringComparison.OrdinalIgnoreCase));
            if (solicitud.Habilitado) conjunto.Add(codigo);

            await GuardarConjuntoAsync(db, id, conjunto, PermisosDeModulo.CuentaDe(principal), ct);

            return Results.Ok(new
            {
                idUsuario = id,
                modulos = await PermisosDeModulo.DeLaCuentaAsync(db, id, false, ct),
                siempreActivados = ModulosDeLaConsola.SiempreActivados,
                todosPorSerWebmaster = false,
            });
        })
        .WithName("InterruptorDeModuloDeUnaCuenta")
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir);

        return group;
    }

    /// <summary>
    /// Deja a la cuenta con exactamente ese conjunto de módulos, con su bitácora y su registro de cambios.
    /// </summary>
    /// <remarks>
    /// UN SOLO SITIO PARA GUARDAR: el PUT del conjunto entero y el interruptor de un módulo pasan por aquí, así
    /// que las dos rutas dejan el mismo rastro (antes y después, quién lo otorga) y no pueden divergir.
    /// </remarks>
    private static async Task GuardarConjuntoAsync(
        SimusDbContext db, int id, List<string> aGuardar, int? quienOtorga, CancellationToken ct)
    {
        var actuales = await db.ModulosPorCuenta.Where(x => x.IdUsuario == id).ToListAsync(ct);
        var antes = actuales.Select(x => x.CodigoModulo).OrderBy(x => x, StringComparer.Ordinal).ToList();

        db.ModulosPorCuenta.RemoveRange(actuales.Where(x => !aGuardar.Contains(x.CodigoModulo, StringComparer.OrdinalIgnoreCase)));

        var ahora = DateTime.UtcNow;
        foreach (var modulo in aGuardar.Where(m => !actuales.Exists(x => string.Equals(x.CodigoModulo, m, StringComparison.OrdinalIgnoreCase))))
        {
            db.ModulosPorCuenta.Add(new ModuloPorCuentaRow
            {
                IdUsuario = id,
                CodigoModulo = modulo,
                FechaOtorgado = ahora,
                IdUsuarioQueOtorgo = quienOtorga,
            });
        }

        // QUEDA EN LA BITACORA. «Por qué esta persona puede publicar» es una pregunta que se hace
        // seis meses después, y sin rastro no tiene respuesta.
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = quienOtorga ?? 0,
            TableName = "ModulosPorCuenta",
            RecordId = id.ToString(CultureInfo.InvariantCulture),
            Action = AccionesAuditoria.Actualizar,
            PreviousValuesJson = JsonSerializer.Serialize(new { modulos = antes }),
            NewValuesJson = JsonSerializer.Serialize(new { modulos = aGuardar.OrderBy(x => x, StringComparer.Ordinal).ToList() }),
            CreatedAt = ahora,
        });

        // EL REGISTRO DE CAMBIOS: qué módulos tenía y cuáles tiene, quién los concedió y cuándo. La línea
        // de bitácora de arriba ya existe, así que no se escribe otra. Es dato de contacto: solo Auditoría lo lee.
        var ordenados = aGuardar.OrderBy(x => x, StringComparer.Ordinal).ToList();
        var valorAntes = antes.Count == 0 ? null : string.Join(',', antes);
        var valorDespues = ordenados.Count == 0 ? null : string.Join(',', ordenados);
        if (!string.Equals(valorAntes, valorDespues, StringComparison.Ordinal))
        {
            await RegistradorDeCambios.RegistrarValoresAsync(
                db,
                new ContextoDeCambio(Modulos.Usuarios, id.ToString(CultureInfo.InvariantCulture), null, quienOtorga, "Consola", Fecha: ahora),
                [new ValorCambiado("modulos", "Módulos de la consola", ClaseDeDato.Contacto, valorAntes, valorDespues)],
                ct, conBitacora: false);
        }

        await db.SaveChangesAsync(ct);
    }

    private static IResult Rechazo(string motivo) =>
        Results.BadRequest(new Dictionary<string, string[]> { ["modulos"] = [motivo] });

    private static async Task<bool> EsWebmasterAsync(SimusDbContext db, int idUsuario, CancellationToken ct) =>
        await db.UsuariosRoles.AsNoTracking()
            .Where(ur => ur.UserId == idUsuario)
            .Join(db.Roles.AsNoTracking(), ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
            .AnyAsync(nombre => nombre == Permisos.Webmaster, ct);
}

/// <summary>El conjunto de módulos que queda activado para esa cuenta.</summary>
public sealed class ModulosDeUnaCuentaSolicitud
{
    public string?[]? Modulos { get; set; }
}

/// <summary>Habilitar o deshabilitar un solo módulo para una cuenta.</summary>
public sealed class InterruptorDeModuloSolicitud
{
    public bool Habilitado { get; set; }
}
