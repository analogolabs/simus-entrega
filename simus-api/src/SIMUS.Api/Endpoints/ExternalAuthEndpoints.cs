using System.Globalization;
using System.Security.Cryptography;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Api.Observability;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Common;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

public static class ExternalAuthEndpoints
{
    private static readonly PasswordHasher<UserRow> PasswordHasher = new();

    public static RouteGroupBuilder MapExternalAuthEndpoints(this RouteGroupBuilder group)
    {
        var external = group.MapGroup("/externo/auth").WithTags("externo-auth");

        // ANONIMA PORQUE SE CONSULTA ANTES DE QUE EXISTA LA CUENTA, y porque el art. 12 de la Ley
        // 1581 obliga a informar ANTES de pedir la autorización: detrás de una sesión, esa
        // información llegaría después de haberla dado. Devuelve los textos vigentes ENTEROS —no
        // enlaces a ellos— porque es lo que la pantalla muestra y lo que el servidor copiará dentro
        // de cada autorización, y tienen que ser lo mismo. El alta no queda disponible si falta
        // alguno de los textos exigidos o el catálogo territorial.
        external.MapGet("/register-preparation", async (SimusDbContext dbContext, CancellationToken cancellationToken) =>
            Results.Ok(await GetRegistrationPreparationAsync(dbContext, cancellationToken))).AllowAnonymous();

        // ANONIMA A PROPOSITO (5 de 39). El alta del ecosistema: la organizacion, la persona que
        // responde por ella y su acceso, en UN SOLO ACTO. Quien se registra no tiene cuenta
        // todavia, por definicion, asi que esta ruta no puede ir detras de una sesion. No va
        // desnuda: valida la peticion entera, rechaza el correo duplicado con 409 y la limita
        // "external-register" por direccion de origen.
        //
        // (1) YA NO HAY CUENTA PERSONAL SUELTA. Antes esto creaba una persona y nada mas, y la
        //     organizacion venia despues por otra ruta con la sesion ya abierta. De ahi salian las
        //     dos mitades rotas: cuentas sin organizacion, que no podian hacer nada, y
        //     organizaciones sin nadie identificado —dbo.EntidadesResponsable llego a tener CERO
        //     filas frente a diecisiete entidades—. Ahora entran las tres cosas o no entra ninguna.
        //
        // (2) LA CUENTA NACE ACTIVA Y CON EL CORREO SIN CONFIRMAR, y eso es distinto de lo que
        //     habia. La pantalla /verify-email original pedia un codigo que no llegaba a ningun
        //     sitio: no habia ni una linea de envio de correo, el codigo solo viajaba en la
        //     respuesta bajo Development, no habia reenvio, y a los veinte minutos caducaba dejando
        //     ese correo inservible para siempre. Se retiro con la nota «vuelve el dia que haya
        //     remitente de verdad».
        //
        //     AHORA VUELVE, Y MONTADA ENTERA: testigo con hash, tres dias de vigencia, reenvio que
        //     invalida el anterior, y una ruta anonima que lo confirma. La diferencia que importa es
        //     que NO ENCIERRA A NADIE: confirmar no hace falta para entrar ni para preparar el
        //     registro, solo para entregarle algo al Programa. Lo unico que sigue faltando es el
        //     transporte, aislado en `IEnviadorDeCorreo`; el mensaje queda en la cola de salida con
        //     estado `pendiente`, que es la verdad.
        //
        // (3) TODO DENTRO DE UNA TRANSACCION. Son cinco escrituras en cuatro tablas —usuario, rol,
        //     entidad, vinculo y responsable— y antes iban en tres guardados sueltos sin
        //     transaccion. Bastaba con que el cliente cortase por tiempo de espera (20 s) entre el
        //     primero y el segundo para dejar un usuario sin rol y sin nada mas: correo quemado,
        //     y la persona solo habia leido «La solicitud tardo demasiado en responder».
        external.MapPost("/register", async (
            ExternalRegisterRequest request,
            SimusDbContext dbContext,
            IEnviadorDeCorreo correo,
            CancellationToken cancellationToken) =>
        {
            var errors = await ValidateRegisterRequestAsync(request, dbContext, cancellationToken);
            var preparation = await GetRegistrationPreparationAsync(dbContext, cancellationToken);
            if (!preparation.RegistroDisponible)
                errors["registro"] = preparation.Impedimentos.ToArray();

            var finalidadesAceptadas = request.PoliticasAceptadas
                .Where(clave => !string.IsNullOrWhiteSpace(clave))
                .Select(clave => clave.Trim())
                .Where(FinalidadesDeDatos.EsConocida)
                .ToHashSet(StringComparer.Ordinal);

            // SE EXIGEN LAS OBLIGATORIAS Y SOLO ESAS. El boletín está en la lista de políticas que
            // el alta ofrece, pero no en la de exigidas: quien no lo marque se registra igual. Es
            // la diferencia entre una autorización para fines determinados —Ley 1581 art. 9— y una
            // casilla que hay que marcar para poder continuar, que no es una autorización libre.
            var faltantes = preparation.Politicas
                .Where(politica => politica.Obligatoria && !finalidadesAceptadas.Contains(politica.Clave))
                .ToList();
            if (faltantes.Count > 0)
                errors["politicasAceptadas"] =
                    [.. faltantes.Select(politica => $"Debes aceptar: {politica.Titulo}.")];
            // LAS CATEGORÍAS DEL PERFIL SON OPCIONALES (DIR): solo se validan si vienen, y solo en la cuenta personal.
            var clasificacion = EsIndividual(request)
                ? await DirectorioDePersonasEndpoints.ValidarAsync(dbContext, request.Clasificacion, errors, cancellationToken)
                : null;
            if (errors.Count > 0)
            {
                return Results.ValidationProblem(errors);
            }

            var email = CorreoElectronico.Normalizar(request.Email);
            if (email is null)
            {
                // LA VALIDACION DE ARRIBA YA LO EXIGE, así que esto no es una defensa contra quien
                // se registra sino contra el futuro: si alguien afloja aquella regla, el fallo sale
                // aquí y no en forma de una cuenta creada sin correo, que es el estado del que
                // después no se sabe salir.
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["email"] = ["El correo electrónico es obligatorio."],
                });
            }

            var existing = await dbContext.Users.AsNoTracking()
                .AnyAsync(user => user.Email == email, cancellationToken);
            if (existing)
            {
                return Results.Conflict(new { message = "Ya existe una cuenta registrada con ese correo." });
            }

            var role = await dbContext.Roles.FirstOrDefaultAsync(item => item.Name == "externo", cancellationToken)
                ?? throw new InvalidOperationException("No existe el rol externo.");

            var now = DateTime.UtcNow;
            var identidad = IdentidadDeResponsable.Desde(request);

            // LA TRANSACCION VA DENTRO DE LA ESTRATEGIA DE EJECUCION, Y NO AL REVES.
            // SQL Server esta configurado con reintentos, y `SqlServerRetryingExecutionStrategy`
            // se niega a trabajar sobre una transaccion abierta a mano: si algo falla a mitad no
            // sabria desde donde reintentar. Abrirla directamente devuelve un 500 con
            // InvalidOperationException, no un error de datos.
            //
            // ESTO NO SE VE CON SQLite, que es el motor de casi toda la suite: alli no hay
            // estrategia de reintentos y `BeginTransactionAsync` a secas funciona. La via de
            // SQL Server fue la que lo dijo. Es la misma leccion de siempre: lo que impone el
            // motor no se deduce leyendo el ORM.
            var estrategia = dbContext.Database.CreateExecutionStrategy();
            return await estrategia.ExecuteAsync(async () =>
            {
            await using var transaccion = await dbContext.Database.BeginTransactionAsync(cancellationToken);

            // 180 Y NO 240: es lo que mide dbo.Usuarios.NombreCompleto. Recortar a 240 contra una
            // columna de 180 convertia un nombre pegado de mas de 180 caracteres en un 500 por
            // truncamiento, es decir, en un limite que solo conocia la base.
            var user = new UserRow
            {
                FullName = ValidationHelpers.SanitizeText(identidad.NombreCompleto, 180),
                Email = email,
                AccessChannel = "externo",
                ProfileType = EsIndividual(request) ? "individual" : "organizacion",
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            user.PasswordHash = PasswordHasher.HashPassword(user, request.Password);
            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);

            // LA FILA DE UsuariosRoles, QUE ES LO QUE DA EL ROL. Desde la transicion es lo unico:
            // `Usuarios.IdRol` ya no existe. Va DESPUES del guardado porque necesita el Id que EF
            // acaba de asignar a la fila nueva.
            await RolesDeUsuario.AsignarAsync(dbContext, user, [role], cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            // LA CUENTA INDIVIDUAL GUARDA LA IDENTIDAD EN LA PROPIA CUENTA: no hay organización con
            // persona responsable donde ponerla. La de organización la sigue guardando en
            // EntidadesResponsable, como hasta ahora.
            if (EsIndividual(request))
            {
                user.PrimerNombre = identidad.PrimerNombre;
                user.SegundoNombre = identidad.SegundoNombre;
                user.PrimerApellido = identidad.PrimerApellido;
                user.SegundoApellido = identidad.SegundoApellido;
                user.CodigoTipoDocumento = identidad.TipoDocumento.ToLowerInvariant();
                user.Identificacion = AltaDeOrganizacion.NormalizarDocumento(identidad.NumeroDocumento);
                user.Telefono = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
            }

            var entidad = EsIndividual(request) ? null : await AltaDeOrganizacion.CrearAsync(
                dbContext,
                user,
                request.OrganizationName,
                request.OrganizationIdentificationNumber,
                request.Email,
                request.HeadquartersDepartmentCode,
                request.HeadquartersMunicipalityCode,
                identidad.NombreCompleto,
                identidad.TipoDocumento,
                identidad.NumeroDocumento,
                identidad.PrimerNombre,
                identidad.SegundoNombre,
                identidad.PrimerApellido,
                identidad.SegundoApellido,
                request.Phone,
                finalidadesAceptadas.Contains(FinalidadesDeDatos.Tratamiento),
                now,
                cancellationToken);

            // LAS AUTORIZACIONES, CON EL TEXTO COPIADO DENTRO. Van por `RegistroDeAutorizaciones`
            // y no escribiendo aquí la fila a mano: es la pieza que garantiza que toda autorización
            // —venga del alta, del boletín o de donde entre mañana— guarde lo mismo. Antes cada
            // puerta guardaba cosas distintas y ninguna guardaba las dos que hacen falta.
            //
            // DENTRO DE LA MISMA TRANSACCIÓN que el resto del alta, y por el mismo motivo que el
            // enlace de confirmación: una cuenta creada cuya autorización no llegó a escribirse es
            // una cuenta cuyos datos se están tratando sin constancia de permiso.
            foreach (var clave in FinalidadesDeDatos.OfrecidasEnElAlta.Where(finalidadesAceptadas.Contains))
            {
                await RegistroDeAutorizaciones.OtorgarAsync(
                    dbContext, clave, "registro", now, user.Id, user.Email,
                    referenciaId: null, cancellationToken);
            }

            // EL BOLETÍN, SI LO PIDIÓ, TAMBIÉN ENTRA EN LA LISTA DE ENVÍO. La autorización dice que
            // puede recibirlo; la suscripción es lo que hace que lo reciba. Guardar solo la primera
            // dejaría a la persona autorizando algo que nunca le llega.
            if (finalidadesAceptadas.Contains(FinalidadesDeDatos.Boletin)
                && !await dbContext.BoletinSuscripciones.AnyAsync(item => item.CorreoElectronico == user.Email, cancellationToken))
            {
                dbContext.BoletinSuscripciones.Add(new()
                {
                    CorreoElectronico = user.Email,
                    Origen = "registro",
                    Estado = "activa",
                    FechaAlta = now,
                    // EL CORREO DE LA CUENTA YA PASA POR SU PROPIA CONFIRMACION: si esta confirmada
                    // (en modo demo se dispensa) la suscripcion nace confirmada; si no, queda
                    // solicitada y la confirma el enlace de la cuenta (ConfirmacionDeCorreo).
                    Confirmada = user.CorreoConfirmado,
                    FechaConfirmacion = user.CorreoConfirmado ? now : null,
                });
            }

            // EL PERFIL NACE OCULTO: existe para guardar las categorías, pero sin la autorización `perfil_publico` no se ve ni
            // se indexa. Publicarlo sigue siendo un acto de la persona, en su cuenta.
            if (clasificacion is { EstaVacia: false })
            {
                dbContext.PerfilesPublicos.Add(new PerfilPublicoRow
                {
                    IdUsuario = user.Id,
                    ClavePublica = Guid.NewGuid(),
                    NombreVisible = ValidationHelpers.SanitizeText($"{identidad.PrimerNombre} {identidad.PrimerApellido}".Trim(), 120),
                    FechaCreacion = now,
                });
                DirectorioDePersonasEndpoints.Poner(dbContext, user.Id, clasificacion);
            }
            await dbContext.SaveChangesAsync(cancellationToken);

            // EL ENLACE DE CONFIRMACION, DENTRO DE LA MISMA TRANSACCION que el alta. Si se emitiera
            // despues, un fallo entre medias dejaria una cuenta sin forma de confirmarse y sin
            // nadie que se enterara.
            await ConfirmacionDeCorreo.EmitirAsync(dbContext, correo, user, now, cancellationToken);

            // EL ALTA TAMBIÉN QUEDA EN LA BITÁCORA (D-05). Registrar una cuenta —y la organización que la
            // acompaña— era lo único del circuito externo que no dejaba línea, y la auditoría de la consola
            // no podía responder «¿cuándo y cómo entró esta persona u organización?». Va en la misma
            // transacción que el alta. La línea lleva el hecho y no datos personales (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.5.4).
            dbContext.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Crear, "CuentaRegistrada", user.Id, "Usuarios",
                user.Id.ToString(CultureInfo.InvariantCulture),
                antes: null,
                despues: new Dictionary<string, object?> { ["tipoDePerfil"] = user.ProfileType, ["canal"] = "externo" },
                motivo: null, OrigenDelCambio.Directo, now));
            if (entidad is not null)
            {
                dbContext.AuditLogs.Add(ContratoDeBitacora.Nueva(
                    AccionesAuditoria.CrearOrganizacion, "OrganizacionRegistrada", user.Id, "Entidades",
                    entidad.Id.ToString(CultureInfo.InvariantCulture),
                    antes: null,
                    despues: new Dictionary<string, object?> { ["estado"] = entidad.StatusCode, ["origen"] = "registro" },
                    motivo: null, OrigenDelCambio.Directo, now));
                dbContext.AuditLogs.Add(ContratoDeBitacora.Nueva(
                    AccionesAuditoria.AsignarAdministradorInicial, "AdministradorInicialAsignado", user.Id, "Entidades",
                    entidad.Id.ToString(CultureInfo.InvariantCulture),
                    antes: null,
                    despues: new Dictionary<string, object?> { ["rol"] = "administrador" },
                    motivo: null, OrigenDelCambio.Directo, now));
            }
            await dbContext.SaveChangesAsync(cancellationToken);

            await transaccion.CommitAsync(cancellationToken);

            return Results.Created($"/api/v1/externo/auth/users/{user.Id}", new ExternalRegisterResponse(
                user.Id.ToString(CultureInfo.InvariantCulture),
                user.Email,
                "activo",
                entidad?.Id.ToString(CultureInfo.InvariantCulture),
                entidad?.Name));
            });
        }).RequireRateLimiting("external-register").AllowAnonymous();

        // ANONIMA A PROPOSITO (6 de 39). La puerta del canal externo, gemela de
        // /admin/auth/login: sin ella nadie puede obtener jamas la cookie externa. El
        // manejador comprueba contrasena, que la cuenta este activa y que el rol sea
        // exactamente "externo" — un institucional no entra por aqui — y solo entonces
        // firma con SimusAuthentication.ExternalScheme. Lleva su propio limitador
        // "external-login" contra la fuerza bruta de credenciales.
        external.MapPost("/login", async (
            ExternalLoginRequest request,
            SimusDbContext dbContext,
            HttpContext httpContext,
            ILoggerFactory registros,
            PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion,
            BloqueoDeIngresoPorCuenta bloqueo,
            CancellationToken cancellationToken) =>
        {
            // MISMA INSTRUMENTACION QUE LA PUERTA INSTITUCIONAL. Hasta el 23 ago 2026 esta
            // puerta rechazaba en silencio: un relleno de credenciales contra las cuentas
            // externas —organizaciones y personas— era invisible, mientras la institucional
            // ya registraba motivo, correo seudonimizado y duracion. El correo nunca va en
            // claro: pasa por RedaccionDatosPersonales, como en AdminAuthEndpoints.
            var registro = registros.CreateLogger("SIMUS.Autenticacion.Externa");
            var reloj = System.Diagnostics.Stopwatch.StartNew();
            var email = CorreoElectronico.Normalizar(request.Email);
            var correoSeudonimo = RedaccionDatosPersonales.Correo(email);
            if (ValidationHelpers.IsMissing(email) || ValidationHelpers.IsMissing(request.Password))
            {
                registro.LogWarning(
                    "Inicio de sesion externo rechazado. Motivo {Motivo}, correo {Correo}, {DuracionMs} ms",
                    "credenciales_incompletas",
                    correoSeudonimo,
                    reloj.ElapsedMilliseconds);
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["credentials"] = ["Correo y contrasena son obligatorios."]
                });
            }

            // EL LIMITE POR CUENTA, ANTES DE MIRAR LA CLAVE Y CONTANDO POR LO ESCRITO (S-07): misma respuesta exista o no la cuenta.
            if (await bloqueo.EsperaAsync(BloqueoDeIngresoPorCuenta.CanalExterno, email, cancellationToken) is { } espera)
            {
                registro.LogWarning(
                    "Inicio de sesion externo rechazado. Motivo {Motivo}, correo {Correo}, {DuracionMs} ms",
                    "bloqueada_por_cuenta",
                    correoSeudonimo,
                    reloj.ElapsedMilliseconds);
                return BloqueoDeIngresoPorCuenta.Respuesta(BloqueoDeIngresoPorCuenta.CanalExterno, espera);
            }

            var user = await dbContext.Users.FirstOrDefaultAsync(item => item.Email == email, cancellationToken);
            // POR CONJUNTO, Y EXIGIENDO QUE `externo` ESTE DENTRO. No se compara el rol principal:
            // con N:M, una cuenta {externo, gestor_interno} tiene por principal `webmaster`/
            // `gestor_interno`, y compararlo contra "externo" la dejaria fuera de su propia
            // puerta. Esa combinacion no deberia existir —la prohibe la guarda U7 en la ruta de
            // asignacion, Permisos.MezclaExternoConInterno— pero esta puerta no depende de que la
            // otra haya hecho su trabajo.
            var rolesDelUsuario = user is null
                ? (IReadOnlyList<string>)[]
                : await RolesDeUsuario.ObtenerAsync(dbContext, user.Id, cancellationToken);
            var esExterno = rolesDelUsuario.Contains(Permisos.Externo, StringComparer.Ordinal);
            if (user is null
                || !user.IsActive
                || !esExterno
                || !IsPasswordValid(user, request.Password))
            {
                // El motivo va al registro, nunca a la respuesta: al cliente se le devuelve
                // el mismo 401 en los cuatro casos para no permitir enumerar cuentas.
                var motivo = user is null ? "usuario_inexistente"
                    : !user.IsActive ? "usuario_inactivo"
                    : !esExterno ? "rol_no_externo"
                    : "contrasena_incorrecta";
                await bloqueo.RegistrarFalloAsync(BloqueoDeIngresoPorCuenta.CanalExterno, email, cancellationToken);
                // IGUALA EL TIEMPO (S-16): sin cuenta activa de este canal no se hizo el hash.
                if (user is null || !user.IsActive || !esExterno)
                {
                    VerificacionSimulada.Gastar(request.Password);
                }

                registro.LogWarning(
                    "Inicio de sesion externo rechazado. Motivo {Motivo}, correo {Correo}, {DuracionMs} ms",
                    motivo,
                    correoSeudonimo,
                    reloj.ElapsedMilliseconds);
                return Results.Unauthorized();
            }

            // SE MIRA ANTES DE PISARLO. `LastLoginAt` es el unico rastro de si esta cuenta habia
            // entrado alguna vez, y la linea siguiente lo sobrescribe: leerlo despues daria siempre
            // «ya habia entrado». Es lo que sostiene la bienvenida del §15.2 sin columna nueva.
            var esPrimerIngreso = user.LastLoginAt is null;

            var now = DateTime.UtcNow;
            user.LastLoginAt = now;
            user.UpdatedAt = now;
            await WriteAuditAsync(dbContext, user.Id, "Usuarios", user.Id.ToString(), "iniciar_sesion_externa", cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            await bloqueo.LimpiarAsync(BloqueoDeIngresoPorCuenta.CanalExterno, email, cancellationToken);

            // PERSISTENTE, PERO CON TOPE ABSOLUTO DE 7 DIAS (S-11): ver VidaDeLaSesion.
            await httpContext.SignInAsync(
                SimusAuthentication.ExternalScheme,
                BuildExternalPrincipal(user),
                VidaDeLaSesion.Propiedades(persistente: true));

            return Results.Ok(await ToSessionResponseAsync(dbContext, user, politicaDeConfirmacion, cancellationToken, esPrimerIngreso));
        }).RequireRateLimiting("external-login").AllowAnonymous();

        external.MapGet("/me", async (
            ClaimsPrincipal principal,
            SimusDbContext dbContext,
            PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion,
            CancellationToken cancellationToken) =>
        {
            var user = await ResolveExternalUserAsync(principal, dbContext, cancellationToken);
            if (user is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok(await ToSessionResponseAsync(dbContext, user, politicaDeConfirmacion, cancellationToken));
        }).RequireAuthorization(SimusAuthentication.ExternalPolicy);

        // «¿HAY SESIÓN?» SIN ERROR (D-09). `/me` responde 401 a quien no ha entrado, y el navegador pinta todo 401
        // como un error rojo en la consola: cada página pública, vista por un visitante anónimo —que es la
        // mayoría—, dejaba uno, y el guion de verificación exige una consola sin errores. Esta ruta contesta
        // siempre 200: `autenticado: false` y sin sesión, o `autenticado: true` y la misma respuesta de `/me`.
        // La barra del portal pregunta aquí; `/me` sigue siendo la puerta de quien SÍ exige sesión.
        external.MapGet("/estado", async (
            HttpContext httpContext,
            SimusDbContext dbContext,
            PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion,
            CancellationToken cancellationToken) =>
        {
            var autenticacion = await httpContext.AuthenticateAsync(SimusAuthentication.ExternalScheme);
            var user = autenticacion.Succeeded && autenticacion.Principal is not null
                ? await ResolveExternalUserAsync(autenticacion.Principal, dbContext, cancellationToken)
                : null;
            return user is null
                ? Results.Ok(new EstadoDeSesionExternaDto(false, null))
                : Results.Ok(new EstadoDeSesionExternaDto(true, await ToSessionResponseAsync(dbContext, user, politicaDeConfirmacion, cancellationToken)));
        }).AllowAnonymous();

        external.MapPost("/logout", async (
            ClaimsPrincipal principal,
            SimusDbContext dbContext,
            HttpContext httpContext,
            RevalidacionDeSesion revalidacion,
            CancellationToken cancellationToken) =>
        {
            var user = await ResolveExternalUserAsync(principal, dbContext, cancellationToken);
            if (user is not null)
            {
                // Un borrador de alta no es una ficha persistente: al cerrar sesión se descarta
                // para que una nueva entrada no reabra un formulario anterior por sorpresa.
                var borradoresAbiertos = await dbContext.BorradoresDeProceso
                    .Where(item => item.PersonaId == user.Id && item.Estado == "borrador")
                    .ToListAsync(cancellationToken);
                foreach (var borrador in borradoresAbiertos)
                {
                    borrador.Estado = "cancelado";
                    borrador.FechaActualizacion = DateTime.UtcNow;
                }
                await WriteAuditAsync(dbContext, user.Id, "Usuarios", user.Id.ToString(), "cerrar_sesion_externa", cancellationToken);
                // CERRAR SESION DE VERDAD (S-11): sube la generacion y la cookie copiada deja de valer.
                user.GeneracionDeSesion++;
                await dbContext.SaveChangesAsync(cancellationToken);
                revalidacion.Invalidar(user.Id);
            }

            await httpContext.SignOutAsync(SimusAuthentication.ExternalScheme);
            return Results.NoContent();
        }).RequireAuthorization(SimusAuthentication.ExternalPolicy);

        return group;
    }

    /// <summary>
    /// Valida el alta entera: la persona responsable, su acceso y la organizacion.
    /// </summary>
    /// <remarks>
    /// <para>
    /// SE DEVUELVEN TODOS LOS ERRORES A LA VEZ, no el primero. El formulario es largo —organizacion,
    /// persona y acceso en una sola pantalla— y contestar de uno en uno obliga a enviarlo otras
    /// tantas veces para descubrir cuantos fallos habia.
    /// </para>
    /// <para>
    /// LA CEDULA SE MIDE SOBRE LOS DIGITOS, no sobre lo tecleado. Quien la escribe la copia del
    /// documento, con puntos, y el limite de 6 a 15 se refiere a los digitos: contar los puntos
    /// rechazaria cedulas validas escritas como se leen.
    /// </para>
    /// </remarks>
    private static async Task<Dictionary<string, string[]>> ValidateRegisterRequestAsync(
        ExternalRegisterRequest request,
        SimusDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);

        // ---- La persona que responde ----
        var identidad = IdentidadDeResponsable.Desde(request);
        if (identidad.EsSegmentada)
        {
            if (ValidationHelpers.IsMissing(identidad.PrimerNombre)) errors["firstName"] = ["El primer nombre es obligatorio."];
            if (ValidationHelpers.IsMissing(identidad.PrimerApellido)) errors["firstSurname"] = ["El primer apellido es obligatorio."];
        }
        else if (ValidationHelpers.IsMissing(identidad.NombreCompleto))
        {
            errors["fullName"] = ["El nombre de la persona responsable es obligatorio."];
        }

        if (!ExternalOrganizationEndpoints.TiposDeDocumento.ContainsKey(identidad.TipoDocumento))
            errors[identidad.EsSegmentada ? "documentType" : "numeroDocumento"] = ["El tipo de documento no pertenece al catálogo."];

        var documento = AltaDeOrganizacion.NormalizarDocumento(identidad.NumeroDocumento);
        if (documento.Length is < 6 or > 15)
            errors[identidad.EsSegmentada ? "documentNumber" : "numeroDocumento"] = ["El número de documento debe tener entre 6 y 15 dígitos."];

        // ---- El acceso ----
        // EL CORREO NO SE COMPRUEBA AQUI. Es uno solo —el institucional de la organizacion, que es
        // tambien el de acceso— y lo mira ValidarAsync mas abajo, que ya tenia que validarlo de
        // todos modos. Comprobarlo en los dos sitios devolvia dos errores para un unico fallo.
        var errorContrasena = PoliticaDeContrasena.Error(request.Password, request.Email,
            [identidad.PrimerNombre, identidad.SegundoNombre, identidad.PrimerApellido, identidad.SegundoApellido, identidad.NombreCompleto]);
        if (errorContrasena is not null) errors["password"] = [errorContrasena];

        // LO QUE SE ACEPTA NO SE VALIDA AQUI. Se comprueba contra las politicas VIGENTES que el
        // servidor sirvio, en la propia ruta del alta: cuales son obligatorias lo dice el catalogo
        // y no una lista escrita a mano en dos sitios. Antes habia aqui dos booleanos fijos que
        // nombraban dos documentos concretos, y el dia que apareciera un tercero seguirian
        // diciendo que con esos dos bastaba.

        // ---- Cuenta individual (docs/desarrollo/19-cuentas-y-organizaciones.md): sin organización, la identidad va a la cuenta ----
        if (EsIndividual(request))
        {
            if (CorreoElectronico.Normalizar(request.Email) is null)
                errors["email"] = ["Ingresa un correo electrónico válido."];
            if (!errors.ContainsKey("documentNumber") && !errors.ContainsKey("documentType")
                && await DocumentoEnUsoAsync(dbContext, identidad.TipoDocumento, documento, null, cancellationToken))
                errors["documentNumber"] = ["Ya existe una cuenta con ese documento. Si es tuya, inicia sesión."];
            return errors;
        }

        // ---- La organizacion, con las mismas reglas que la otra ruta que las crea ----
        await AltaDeOrganizacion.ValidarAsync(
            errors,
            "organization",
            "email",
            request.OrganizationName,
            request.OrganizationIdentificationNumber,
            request.Email,
            dbContext,
            cancellationToken);

        await AltaDeOrganizacion.ValidarSedeAsync(
            errors, request.HeadquartersDepartmentCode, request.HeadquartersMunicipalityCode,
            dbContext, cancellationToken);

        return errors;
    }

    private static async Task<PreparacionDeRegistroDto> GetRegistrationPreparationAsync(
        SimusDbContext dbContext, CancellationToken cancellationToken)
    {
        var vigentes = await dbContext.PoliticasDeDatos.AsNoTracking()
            .Where(politica => politica.Vigente)
            .ToListAsync(cancellationToken);

        // EL ORDEN LO PONE EL CATALOGO. Primero lo que sostiene la cuenta, al final lo voluntario:
        // es el orden en que la pantalla las presenta y en el que tienen sentido leidas seguidas.
        var politicas = FinalidadesDeDatos.OfrecidasEnElAlta
            .Select(clave => vigentes.FirstOrDefault(politica => politica.Clave == clave))
            .Where(politica => politica is not null)
            .Select(politica => new PoliticaParaRegistroDto(
                politica!.Clave, politica.Version, politica.Titulo, politica.Texto,
                politica.UrlOficial, politica.ReferenciaOficial,
                Array.IndexOf(FinalidadesDeDatos.ExigidasEnElAlta, politica.Clave) >= 0))
            .ToList();

        var impedimentos = new List<string>();

        // FALTA UNA OBLIGATORIA -> NO HAY ALTA, y esto no es rigidez. Registrar a alguien sin texto
        // que copiar dejaria una cuenta creada y una autorizacion vacia: datos personales tratados
        // sin constancia de que se informara de nada. Es preferible que el formulario diga que no
        // esta disponible.
        if (FinalidadesDeDatos.ExigidasEnElAlta.Any(clave => politicas.All(politica => politica.Clave != clave)))
            impedimentos.Add("Los textos de autorización vigentes no están disponibles.");

        if (!await dbContext.DivipolaLocations.AsNoTracking().AnyAsync(cancellationToken))
            impedimentos.Add("El catálogo territorial no está disponible.");

        return new(impedimentos.Count == 0, politicas, impedimentos);
    }


    private static string Clean(string value)
    {
        return (value ?? string.Empty).Trim().ToLowerInvariant();
    }

    private static bool IsPasswordValid(UserRow user, string password)
    {
        try
        {
            return PasswordHasher.VerifyHashedPassword(user, user.PasswordHash, password) != PasswordVerificationResult.Failed;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private sealed record IdentidadDeResponsable(
        string PrimerNombre,
        string? SegundoNombre,
        string PrimerApellido,
        string? SegundoApellido,
        string TipoDocumento,
        string NumeroDocumento,
        bool EsSegmentada)
    {
        public string NombreCompleto => string.Join(' ', new[] { PrimerNombre, SegundoNombre, PrimerApellido, SegundoApellido }
            .Where(item => !string.IsNullOrWhiteSpace(item)).Select(item => item!.Trim()));

        public static IdentidadDeResponsable Desde(ExternalRegisterRequest solicitud)
        {
            var segmentada = !string.IsNullOrWhiteSpace(solicitud.FirstName)
                || !string.IsNullOrWhiteSpace(solicitud.FirstSurname)
                || !string.IsNullOrWhiteSpace(solicitud.DocumentType)
                || !string.IsNullOrWhiteSpace(solicitud.DocumentNumber);
            if (segmentada)
                return new(solicitud.FirstName, solicitud.SecondName, solicitud.FirstSurname, solicitud.SecondSurname,
                    (solicitud.DocumentType ?? string.Empty).Trim().ToLowerInvariant(), solicitud.DocumentNumber, true);

            return new(solicitud.FullName, null, string.Empty, null, "cc", solicitud.NumeroDocumento, false);
        }
    }

    internal static bool EsIndividual(ExternalRegisterRequest request) =>
        string.Equals(request.RegistrationType?.Trim(), "individual", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Otra cuenta ya tiene ese documento. Es lo que también impone <c>UQ_Usuarios_Documento</c>;
    /// comprobarlo antes devuelve un error de campo en lugar de un 500.
    /// </summary>
    internal static Task<bool> DocumentoEnUsoAsync(
        SimusDbContext dbContext, string tipo, string numero, int? salvoUsuarioId, CancellationToken cancellationToken)
    {
        var tipoNormal = tipo.Trim().ToLowerInvariant();
        return dbContext.Users.AsNoTracking().AnyAsync(user =>
            user.CodigoTipoDocumento == tipoNormal
            && user.Identificacion == numero
            && (salvoUsuarioId == null || user.Id != salvoUsuarioId), cancellationToken);
    }

    internal static ClaimsPrincipal BuildExternalPrincipal(UserRow user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString(CultureInfo.InvariantCulture)),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, "externo"),
            new(SimusAuthentication.AccessScopeClaim, SimusAuthentication.ExternalScope),
            new(VidaDeLaSesion.ClaimDeGeneracion, user.GeneracionDeSesion.ToString(CultureInfo.InvariantCulture))
        };
        if (RevalidacionDeSesion.SelloDe(user.PasswordHash) is { } sello)
            claims.Add(new Claim(RevalidacionDeSesion.ClaimDeSello, sello));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, SimusAuthentication.ExternalScheme));
    }

    private static async Task<UserRow?> ResolveExternalUserAsync(
        ClaimsPrincipal principal,
        SimusDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var userId))
        {
            return null;
        }

        // POR dbo.UsuariosRoles. Con la columna escalar este Join devolvia una fila como
        // mucho; con N:M devolveria una por rol, asi que el filtro va sobre la tabla de asignacion
        // y el `Any` deja el resultado en «existe alguna asignacion a externo», que es la
        // pregunta que la ruta quiere hacer.
        return await dbContext.Users
            .Where(user => user.Id == userId
                && user.IsActive
                && dbContext.UsuariosRoles
                    .Join(dbContext.Roles, asignacion => asignacion.RoleId, role => role.Id, (asignacion, role) => new { asignacion.UserId, role.Name })
                    .Any(par => par.UserId == user.Id && par.Name == "externo"))
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    /// La sesion tal como la ve el sitio: quien es, y que organizaciones administra.
    /// </summary>
    /// <remarks>
    /// SOLO LOS VINCULOS ACTIVOS. `UsuariosEntidades.Activo` es como se retira a alguien de una
    /// organizacion sin borrar el historial; devolver tambien los inactivos pondria en su panel
    /// organizaciones que ya no puede tocar, y el primer boton que pulsara daria 403.
    ///
    /// ORDENADAS POR NOMBRE para que el panel no cambie de organizacion principal entre dos cargas:
    /// sin ORDER BY, el motor puede devolverlas en cualquier orden.
    /// </remarks>
    private static async Task<ExternalSessionResponse> ToSessionResponseAsync(
        SimusDbContext dbContext,
        UserRow user,
        PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion,
        CancellationToken cancellationToken,
        bool esPrimerIngreso = false)
    {
        var organizaciones = await dbContext.UserEntities.AsNoTracking()
            // La sesión alimenta el selector de contexto de Gestión. Debe enumerar exactamente
            // las organizaciones que sus endpoints permiten administrar: ni vínculos inactivos
            // ni roles de contacto/colaboración que solo podrían conducir a un 403 posterior.
            .Where(vinculo => vinculo.UserId == user.Id
                && vinculo.IsActive
                // Administrador o editor: los dos ven la organizacion en su panel. El rol viaja en
                // la sesion para que la pantalla no ofrezca a un editor lo que el servidor le niega.
                && RolesDeEntidad.Miembros.Contains(vinculo.EntityRole))
            .Join(
                dbContext.EntityProfiles.AsNoTracking().Where(entidad => entidad.IsActive),
                vinculo => vinculo.EntityId,
                entidad => entidad.Id,
                (vinculo, entidad) => new { entidad.Id, entidad.Name, vinculo.EntityRole })
            .OrderBy(fila => fila.Name)
            .ToListAsync(cancellationToken);

        return new ExternalSessionResponse(
            user.Id.ToString(CultureInfo.InvariantCulture),
            user.FullName,
            user.Email,
            user.IsActive ? "activo" : "inactivo",
            organizaciones
                .Select(fila => new ExternalSessionOrganization(
                    fila.Id.ToString(CultureInfo.InvariantCulture),
                    fila.Name,
                    fila.EntityRole))
                .ToList(),
            user.CorreoConfirmado,
            politicaDeConfirmacion.ConfirmacionObligatoria,
            esPrimerIngreso);
    }

    private static Task WriteAuditAsync(
        SimusDbContext dbContext,
        int userId,
        string tableName,
        string recordId,
        string action,
        CancellationToken cancellationToken)
    {
        dbContext.AuditLogs.Add(new AuditLogRow
        {
            UserId = userId,
            TableName = tableName,
            RecordId = recordId,
            Action = action,
            CreatedAt = DateTime.UtcNow
        });
        return Task.CompletedTask;
    }
}

/// <summary>La respuesta de «¿hay sesión externa?»: siempre 200, con la sesión solo si la hay (D-09).</summary>
public sealed record EstadoDeSesionExternaDto(bool Autenticado, ExternalSessionResponse? Sesion);
