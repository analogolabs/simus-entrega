using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SIMUS.Infrastructure.Data;

public static class DatabaseBootstrapper
{
    /// <summary>Una cuenta de arranque del entorno local.</summary>
    public sealed record CuentaDeArranque(string NombreCompleto, string Correo, string Rol, string Clave, string? Telefono);

    /// <summary>
    /// LAS CUENTAS DE ARRANQUE, EN UNA SOLA LISTA Y NO EN DOS.
    /// </summary>
    /// <remarks>
    /// <para>
    /// POR QUE EXISTE ESTA LISTA. Habia dos: la rama de SQLite sembraba tres cuentas y la de SQL
    /// Server —<c>Database:SeedBootstrapUsers</c>— sembraba dos. La tercera, <c>externo@simus.test</c>,
    /// se quedo sin hash contra la base real y <c>POST /external/auth/login</c> devolvia 401 con la
    /// contrasena que la documentacion declara. Comprobado: <c>admin@</c> y
    /// <c>gestor@</c> con hash de 84 caracteres, las tres externas con el literal
    /// <c>pendiente_configurar_hash_seguro</c>, de 32.
    /// </para>
    /// <para>
    /// Con una sola lista ese desajuste no puede repetirse: anadir una cuenta la siembra en los dos
    /// caminos, y quitarla la quita de los dos. Es lo unico que impide que el proximo alta vuelva a
    /// existir solo en el carril rapido, que es donde el defecto era invisible.
    /// </para>
    /// <para>
    /// <c>sistema@pnmc.local</c> NO ESTA AQUI Y NO ES UN OLVIDO. Es la cuenta a la que se atribuyen
    /// las acciones automaticas, y <c>AdminAuthEndpoints.WebmastersQuePuedenEntrarAsync</c> cuenta
    /// con que NO pueda iniciar sesion: si pudiera, la guarda del ultimo webmaster contaria a
    /// alguien que nadie usa y dejaria desactivar al unico real.
    /// </para>
    /// </remarks>
    public static readonly IReadOnlyList<CuentaDeArranque> CuentasDeArranque =
    [
        new("Webmaster SIMUS", "webmaster@simus.test", "webmaster", "admin", "3151234567"),
        new("Gestor institucional SIMUS", "gestor@simus.test", "gestor_interno", "admin", "3207654321"),
        new("Colaborador Externo", "externo@simus.test", "externo", "admin", "3103332211"),
        new("Participante de Prueba 2", "participante.dos@simus.test", "externo", "admin", null),
        new("Participante de Prueba 3", "participante.tres@simus.test", "externo", "admin", null),
    ];

    public static async Task EnsureReadyAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        using var scope = services.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseBootstrapper");
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
        var environment = scope.ServiceProvider.GetRequiredService<IHostEnvironment>();
        var timeoutSeconds = Math.Clamp(options.StartupTimeoutSeconds, 5, 300);
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
        var startupToken = timeoutCts.Token;

        try
        {
            if (db.Database.IsSqlServer())
            {
                var canConnect = await db.Database.CanConnectAsync(startupToken);
                if (!canConnect)
                {
                    throw new InvalidOperationException("No fue posible conectar con SQL Server.");
                }

                // El esquema de SQL Server pertenece exclusivamente a SIMUS.Migrador (DbUp).
                // El proceso del API valida la conexión y solo escribe datos de arranque
                // expresamente habilitados; no crea ni altera tablas durante el inicio.
                if (options.SeedBootstrapUsers)
                {
                    if (!environment.IsDevelopment()
                        && !environment.IsEnvironment("Local")
                        && !environment.IsEnvironment("Test"))
                    {
                        throw new InvalidOperationException(
                            "Database:SeedBootstrapUsers solo puede habilitarse en Development, Local o Test.");
                    }

                    await EnsureBootstrapUsersAsync(db, options.BootstrapExigirCambioDeClave, startupToken);
                }

                logger.LogInformation(
                    "SQL Server connection established. Schema changes are managed exclusively by SIMUS.Migrador.");
            }
            else
            {
                await db.Database.EnsureCreatedAsync(startupToken);
                await EnsureLocalSupportTablesAsync(db, startupToken);
                await EnsureLocalDevelopmentSeedAsync(db, options.BootstrapExigirCambioDeClave, startupToken);
                logger.LogInformation("Database initialized with EnsureCreated for non-SQL provider.");
            }

            // EstadosContenido es un catálogo técnico del dominio, no contenido de
            // demostración. Festival, Organización y los demás registros que lo usan
            // tienen una llave foránea contra él; por tanto debe existir también en
            // SQL Server. Antes solo se completaba al iniciar SQLite y un Festival
            // nuevo fallaba con 500 al intentar guardar el estado "borrador".
            await EnsureCoreContentStatusesAsync(db, startupToken);

            if (options.SeedWebConfiguration)
            {
                // La siembra del CMS va DESPUES del if/else, no dentro de la rama de
                // SQL Server. Esa rama terminaba en `return`, de modo que cualquier
                // paso colgado de ella nunca corria con SQLite —el proveedor que usan
                // las pruebas—, y la suite habria pasado en verde sobre una tabla vacia.
                // El renombrado va ANTES de sembrar y no despues: el sembrador
                // inserta lo que falta, de modo que si se invirtiera el orden las
                // claves nuevas ya existirian cuando llegara el traslado y toda fila
                // vieja pareceria un conflicto.
                await RenombradoContenidoWeb.EnsureRenamedAsync(db, logger, startupToken);
                await SembradorDeContenidoWeb.EnsureSeededAsync(db, logger, startupToken);
                await SembradorDeEquipoWeb.EnsureSeededAsync(db, logger, startupToken);
                // Las ranuras de imagen. Nacen sin bytes: sembrar no es publicar, y el dia que esto
                // entro el sitio se veia exactamente igual. Ver MediosWebSeeder.
                await MediosWebSeeder.EnsureSeededAsync(db, logger, startupToken);

                // La poda va la ULTIMA de las tres. El renombrado y la retirada
                // escriben historial, y podar antes que ellos dejaria por encima del
                // tope justo las claves que este arranque acaba de tocar.
                await PodaDelHistorialContenidoWeb.PodarTodoAsync(db, logger, startupToken);
            }
            else
            {
                logger.LogInformation("Web configuration seeding is disabled for this database profile.");
            }
        }
        catch (Exception exception) when (options.ContinueOnStartupFailure)
        {
            logger.LogWarning(
                exception,
                "Database bootstrap failed at startup. The API will continue running in degraded mode. TimeoutSeconds={TimeoutSeconds}",
                timeoutSeconds);
        }
    }

    private static async Task EnsureBootstrapUsersAsync(SimusDbContext db, bool exigirCambioDeClave, CancellationToken cancellationToken)
    {
        await EnsureRoleAsync(db, "webmaster", "Control total de usuarios, modulos, datos, configuracion, revision, publicacion y mantenimiento.", cancellationToken);
        await EnsureRoleAsync(db, "gestor_interno", "Segundo nivel general de administracion institucional.", cancellationToken);
        await EnsureRoleAsync(db, "externo", "Participante publico sin acceso administrativo privilegiado.", cancellationToken);

        foreach (var cuenta in CuentasDeArranque)
        {
            await EnsureBootstrapUserAsync(
                db, cuenta.NombreCompleto, cuenta.Correo, cuenta.Rol, cuenta.Clave, cuenta.Telefono, exigirCambioDeClave, cancellationToken);
        }
    }

    private static async Task EnsureRoleAsync(
        SimusDbContext db,
        string name,
        string description,
        CancellationToken cancellationToken)
    {
        var role = await db.Roles.FirstOrDefaultAsync(item => item.Name == name, cancellationToken);
        if (role is null)
        {
            db.Roles.Add(new RoleRow
            {
                Name = name,
                Description = description
            });
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        role.Description = description;
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureBootstrapUserAsync(
        SimusDbContext db,
        string fullName,
        string email,
        string roleName,
        string password,
        string? phone,
        bool exigirCambioDeClave,
        CancellationToken cancellationToken)
    {
        var role = await db.Roles.FirstAsync(item => item.Name == roleName, cancellationToken);
        var user = await db.Users.FirstOrDefaultAsync(item => item.Email == email, cancellationToken);
        var isNew = user is null;

        user ??= new UserRow
        {
            FullName = fullName,
            Email = email,
            CreatedAt = DateTime.UtcNow
        };

        user.FullName = fullName;
        // Dos canales, no tres. El tercero, "aliado", desaparecio con el concepto el 22 de
        // agosto de 2026. CanalAcceso no tiene CHECK en la base, asi que ninguna fila vieja
        // con "aliado" rompe nada; simplemente ya no se escribe.
        user.AccessChannel = roleName == "externo" ? "externo" : "interno";
        user.ProfileType = roleName == "externo" ? "organizacion" : user.ProfileType;
        user.Telefono = phone;
        user.IsActive = true;
        // UNA CUENTA DE ARRANQUE NO PASA POR EL RECORRIDO DE PRIMER INGRESO. Ese recorrido existe
        // porque una cuenta se ENTREGA: alguien eligió su contraseña y la persona todavía no ha
        // dicho quién es. Estas las crea el propio sistema, con su nombre y sus credenciales
        // técnicas. Se dice aquí además de ser el valor por omisión de la entidad, porque una
        // cuenta de arranque que ya existiera con las marcas puestas tiene que volver a su sitio.
        //
        // EXCEPCION OPT-IN (Database:BootstrapExigirCambioDeClave, por omisión apagada): en una
        // instalación nueva las cuentas ADMINISTRATIVAS nacen con la clave por defecto y el primer
        // ingreso exige cambiarla. Solo al CREARLAS: una cuenta que ya existe no se toca, para no
        // volver a exigirle el cambio a quien ya lo hizo. El perfil queda completo; solo la clave
        // es el paso pendiente.
        var esAdministrativa = roleName is "webmaster" or "gestor_interno";
        if (exigirCambioDeClave && esAdministrativa)
        {
            if (isNew) user.DebeCambiarContrasena = true;
        }
        else
        {
            user.DebeCambiarContrasena = false;
        }
        user.PerfilCompletado = true;
        user.UpdatedAt = DateTime.UtcNow;

        if (isNew || !LooksLikeAspNetPasswordHash(user.PasswordHash))
        {
            var hasher = new PasswordHasher<UserRow>();
            user.PasswordHash = hasher.HashPassword(user, password);
        }

        if (isNew)
        {
            db.Users.Add(user);
        }

        await db.SaveChangesAsync(cancellationToken);

        // LA FILA DE dbo.UsuariosRoles, QUE ES LO QUE DA EL ROL DESDE LA TRANSICION.
        //
        // Sin esto, una base arrancada por el bootstrapper —la de desarrollo local y la que
        // fabrica el arnes de SQLite— dejaba a las cuentas semilla con `IdRol` puesto y CERO
        // filas de asignacion, es decir sin poder iniciar sesion: exactamente el sintoma que el
        // defecto U3 del plan describia para la siembra de SQL Server, en el otro camino.
        //
        // Desde la transicion es lo UNICO que da el rol: `Usuarios.IdRol` ya no existe. Va DESPUES
        // del guardado porque un usuario recien creado no tiene Id hasta que EF lo escribe.
        //
        // NO ACUMULA: deja EXACTAMENTE el rol pedido y retira cualquier otro. Un bootstrapper que
        // acumulara convertiria cada arranque en una concesion mas.
        var actuales = await db.UsuariosRoles
            .Where(asignacion => asignacion.UserId == user.Id)
            .ToListAsync(cancellationToken);

        foreach (var sobrante in actuales.Where(asignacion => asignacion.RoleId != role.Id))
        {
            db.UsuariosRoles.Remove(sobrante);
        }

        if (!actuales.Any(asignacion => asignacion.RoleId == role.Id))
        {
            db.UsuariosRoles.Add(new UsuarioRolRow
            {
                UserId = user.Id,
                RoleId = role.Id,
                CreatedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        await AsegurarModulosDeConsolaAsync(db, user.Id, roleName, cancellationToken);
    }

    /// <summary>
    /// Deja a una cuenta interna con todos los módulos de la consola activados.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>UNA CUENTA TECNICA NACE PUDIENDO TRABAJAR.</b> Desde los
    /// permisos de la consola se conceden por cuenta y el servidor los aplica: una cuenta sin
    /// módulos entra a una consola de dos pantallas. Las cuentas de arranque existen justamente
    /// para recorrer el sistema entero, así que se siembran con todo, igual que hace la migración
    /// con las cuentas que ya existían.
    /// </para>
    /// <para>
    /// <b>SOLO LAS INTERNAS.</b> Una cuenta externa no entra a la consola: darle módulos no le
    /// abriría nada y ensuciaría la pantalla de permisos con filas que no significan nada.
    /// </para>
    /// <para>
    /// NO ACUMULA NI RETIRA lo que alguien haya decidido después: solo añade lo que falte. Un
    /// arranque no es el sitio donde se revocan permisos concedidos a mano.
    /// </para>
    /// </remarks>
    private static async Task AsegurarModulosDeConsolaAsync(
        SimusDbContext db, int idUsuario, string roleName, CancellationToken cancellationToken)
    {
        if (!string.Equals(roleName, "webmaster", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(roleName, "gestor_interno", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var yaTiene = await db.ModulosPorCuenta
            .Where(x => x.IdUsuario == idUsuario)
            .Select(x => x.CodigoModulo)
            .ToListAsync(cancellationToken);

        var faltan = ModulosDeConsolaQueSeSiembran
            .Where(modulo => !yaTiene.Contains(modulo, StringComparer.OrdinalIgnoreCase))
            .ToList();
        if (faltan.Count == 0) return;

        var ahora = DateTime.UtcNow;
        foreach (var modulo in faltan)
        {
            db.ModulosPorCuenta.Add(new ModuloPorCuentaRow
            {
                IdUsuario = idUsuario,
                CodigoModulo = modulo,
                FechaOtorgado = ahora,
                IdUsuarioQueOtorgo = null,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Los módulos que se siembran. Son todos menos los dos que van siempre activados.
    /// </summary>
    /// <remarks>
    /// «monitor» y «solicitudes» NO se guardan nunca: los concede el catálogo del servidor, y
    /// guardarlos sería poder borrarlos.
    /// </remarks>
    private static readonly string[] ModulosDeConsolaQueSeSiembran =
    [
        "ecosistema", "mercados", "talleres", "espacios", "redes", "organizaciones", "catalogo-editorial", "agenda", "noticias",
        "categorias", "banco-de-archivos", "gestion-sitio", "boletin", "analisis",
        "auditoria", "usuarios", "sistema",
    ];

    private static async Task EnsureLocalDevelopmentSeedAsync(SimusDbContext db, bool exigirCambioDeClave, CancellationToken cancellationToken)
    {
        await EnsureRoleAsync(db, "webmaster", "Control total de usuarios, modulos, datos, configuracion, revision, publicacion y mantenimiento.", cancellationToken);
        await EnsureRoleAsync(db, "gestor_interno", "Segundo nivel general de administracion institucional.", cancellationToken);
        await EnsureRoleAsync(db, "externo", "Participante publico sin acceso administrativo privilegiado.", cancellationToken);

        // LA MISMA LISTA QUE LA RAMA DE SQL SERVER, por el mismo motivo: dos listas divergen y la
        // divergencia solo se ve en el carril que ninguna prueba recorre.
        foreach (var cuenta in CuentasDeArranque)
        {
            await EnsureBootstrapUserAsync(
                db, cuenta.NombreCompleto, cuenta.Correo, cuenta.Rol, cuenta.Clave, cuenta.Telefono, exigirCambioDeClave, cancellationToken);
        }

        await EnsureDivipolaLocationAsync(db, "05", "Antioquia", "05001", "Medellin", cancellationToken);
        await EnsureDivipolaLocationAsync(db, "11", "Bogota, D.C.", "11001", "Bogota, D.C.", cancellationToken);
        await EnsureDivipolaLocationAsync(db, "13", "Bolivar", "13001", "Cartagena de Indias", cancellationToken);
        await EnsureDivipolaLocationAsync(db, "25", "Cundinamarca", "25754", "Soacha", cancellationToken);
        await EnsureDivipolaLocationAsync(db, "76", "Valle del Cauca", "76001", "Cali", cancellationToken);
        await EnsurePoliticaDeDatosAsync(db, "tratamiento", PoliticasDeDatosSembradas.VersionVigente,
            PoliticasDeDatosSembradas.TituloTratamiento, PoliticasDeDatosSembradas.TextoTratamiento,
            PoliticasDeDatosSembradas.UrlTratamiento, "PL-GSI-002 v0", cancellationToken);

        await EnsurePoliticaDeDatosAsync(db, "terminos", PoliticasDeDatosSembradas.VersionVigente,
            PoliticasDeDatosSembradas.TituloTerminos, PoliticasDeDatosSembradas.TextoTerminos,
            PoliticasDeDatosSembradas.UrlTerminos, "PL-GSI-001 v0", cancellationToken);

        // EL BOLETIN NO TIENE PDF INSTITUCIONAL, y no se le inventa uno. Su texto se basta: dice
        // quien trata, que dato, para que y como se revoca.
        // Dos versiones: la anterior queda como histórica y la nueva («del SIMUS») es la vigente.
        await EnsurePoliticaDeDatosAsync(db, "boletin", PoliticasDeDatosSembradas.VersionBoletinAnterior,
            PoliticasDeDatosSembradas.TituloBoletinAnterior, PoliticasDeDatosSembradas.TextoBoletinAnterior,
            null, null, cancellationToken, vigente: false);
        await EnsurePoliticaDeDatosAsync(db, "boletin", PoliticasDeDatosSembradas.VersionBoletin,
            PoliticasDeDatosSembradas.TituloBoletin, PoliticasDeDatosSembradas.TextoBoletin,
            null, null, cancellationToken);

        await EnsurePoliticaDeDatosAsync(db, "perfil_publico", PoliticasDeDatosSembradas.VersionPerfilPublico,
            PoliticasDeDatosSembradas.TituloPerfilPublico, PoliticasDeDatosSembradas.TextoPerfilPublico,
            null, null, cancellationToken);
    }

    private static async Task EnsureLocalSupportTablesAsync(SimusDbContext db, CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS RegistrosRevisionHistorial (
                IdRevisionHistorial INTEGER PRIMARY KEY AUTOINCREMENT,
                ModuloId TEXT NOT NULL,
                RegistroId TEXT NOT NULL,
                EstadoAnterior TEXT NULL,
                EstadoNuevo TEXT NOT NULL,
                Accion TEXT NOT NULL,
                Comentario TEXT NULL,
                MotivoRechazo TEXT NULL,
                CamposObservados TEXT NULL,
                IdUsuario INTEGER NULL,
                Fecha TEXT NOT NULL,
                MetadataJson TEXT NULL
            );
            """, cancellationToken);
    }

    private static async Task EnsureCoreContentStatusesAsync(SimusDbContext db, CancellationToken cancellationToken)
    {
        await EnsureContentStatusAsync(db, "borrador", "Borrador", "Registro en elaboración.", cancellationToken);
        await EnsureContentStatusAsync(db, "en_revision", "En revisión", "Registro enviado para revisión institucional.", cancellationToken);
        await EnsureContentStatusAsync(db, "ajustes_solicitados", "Ajustes solicitados", "Registro devuelto para correcciones.", cancellationToken);
        await EnsureContentStatusAsync(db, "aprobado", "Aprobado", "Registro validado institucionalmente.", cancellationToken);
        await EnsureContentStatusAsync(db, "publicado", "Publicado", "Registro visible públicamente.", cancellationToken);
        await EnsureContentStatusAsync(db, "rechazado", "Rechazado", "Registro no aprobado.", cancellationToken);
        await EnsureContentStatusAsync(db, "archivado", "Archivado", "Registro retirado del flujo activo.", cancellationToken);
        // LOS CUATRO ESTADOS DE UNA ORGANIZACION, que comparten este catálogo por la foránea de
        // dbo.Entidades y NO son los de un contenido: una organización no se publica ni se aprueba.
        // Son un ciclo de vida en un solo eje, y los fija EstadosDeOrganizacion.
        await EnsureContentStatusAsync(db, "pendiente_de_confirmacion", "Pendiente de confirmación", "Organización cuya cuenta responsable todavía no ha confirmado su correo.", cancellationToken);
        await EnsureContentStatusAsync(db, "activa", "Activa", "Organización que opera con normalidad en la plataforma.", cancellationToken);
        await EnsureContentStatusAsync(db, "inactiva", "Inactiva", "Organización suspendida: conserva su ficha y no puede entrar.", cancellationToken);
        await EnsureContentStatusAsync(db, "eliminada", "Eliminada", "Organización retirada del ecosistema; sus procesos vuelven al PNMC.", cancellationToken);

        await EnsureTiposDeDocumentoAsync(db, cancellationToken);
        await EnsureVocabulariosDeMercadoAsync(db, cancellationToken);
        await EnsureVocabulariosDeLuteriaAsync(db, cancellationToken);
        await EnsureVocabulariosDeEspaciosAsync(db, cancellationToken);
        await EnsureVocabulariosDeRedesAsync(db, cancellationToken);
        await EnsureTaxonomiaDePerfilesAsync(db, cancellationToken);
    }

    /// <summary>
    /// El alcance y la modalidad de un mercado musical, que son vocabulario controlado.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>SE SIEMBRAN AQUI PORQUE LA BASE DE PRUEBAS NO PASA POR DbUp.</b> La crea EF con
    /// <c>EnsureCreated</c>, que levanta las tablas y ninguna de sus filas: un desplegable vacío no
    /// deja guardar a nadie, y la prueba fallaría por un motivo que no tiene que ver con lo que
    /// mide. Es la misma razón por la que se siembran los tipos de documento.
    /// </para>
    /// <para>
    /// <b>LA TABLA HEREDADA LOS GUARDABA COMO TEXTO LIBRE</b> —<c>alcance</c> y <c>modalidad</c>,
    /// <c>varchar</c> sin lista ni CHECK—, así que «Nacional», «nacional» y «NACIONAL» eran tres
    /// alcances distintos y nadie podía contar mercados por alcance. La regla del proyecto es que
    /// todo vocabulario controlado se captura con una lista.
    /// </para>
    /// </remarks>
    private static async Task EnsureVocabulariosDeMercadoAsync(SimusDbContext db, CancellationToken cancellationToken)
    {
        if (!await db.AlcancesMercado.AnyAsync(cancellationToken))
        {
            db.AlcancesMercado.AddRange(
                new AlcanceMercadoRow { Nombre = "Local", Slug = "local", OrdenVisualizacion = 1 },
                new AlcanceMercadoRow { Nombre = "Regional", Slug = "regional", OrdenVisualizacion = 2 },
                new AlcanceMercadoRow { Nombre = "Nacional", Slug = "nacional", OrdenVisualizacion = 3 },
                new AlcanceMercadoRow { Nombre = "Internacional", Slug = "internacional", OrdenVisualizacion = 4 });
        }

        if (!await db.ModalidadesMercado.AnyAsync(cancellationToken))
        {
            db.ModalidadesMercado.AddRange(
                new ModalidadMercadoRow { Nombre = "Presencial", Slug = "presencial", OrdenVisualizacion = 1 },
                new ModalidadMercadoRow { Nombre = "Virtual", Slug = "virtual", OrdenVisualizacion = 2 },
                new ModalidadMercadoRow { Nombre = "Mixta", Slug = "mixta", OrdenVisualizacion = 3 });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Las familias de instrumentos y los servicios del taller de lutería, que son vocabulario controlado.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>SE SIEMBRAN AQUI POR LA MISMA RAZON QUE LOS DE MERCADOS:</b> la base de pruebas la crea EF con
    /// <c>EnsureCreated</c>, que levanta las tablas y ninguna de sus filas. En SQL Server ya los dejó
    /// <c>V20261110_51</c> y la guarda <c>Any</c> no hace nada.
    /// </para>
    /// <para>
    /// <b>TODOS NACEN «PROPUESTO».</b> Ninguno está verificado en una fuente abierta (docs/referencia/27-fuentes-de-luteria.md) y la
    /// aprobación es del Plan Nacional de Música para la Convivencia; se pueden elegir desde el primer
    /// día, porque un formulario sin opciones no deja registrar un taller.
    /// </para>
    /// </remarks>
    private static async Task EnsureVocabulariosDeLuteriaAsync(SimusDbContext db, CancellationToken cancellationToken)
    {
        if (!await db.FamiliasDeInstrumentos.AnyAsync(cancellationToken))
        {
            db.FamiliasDeInstrumentos.AddRange(
                new FamiliaInstrumentoRow { Nombre = "Cordófonos", Slug = "cordofonos", Fuente = "F-13, F-14, F-08", OrdenVisualizacion = 1 },
                new FamiliaInstrumentoRow { Nombre = "Aerófonos", Slug = "aerofonos", Fuente = "F-13, F-14", OrdenVisualizacion = 2 },
                new FamiliaInstrumentoRow { Nombre = "Membranófonos", Slug = "membranofonos", Fuente = "F-13, F-14", OrdenVisualizacion = 3 },
                new FamiliaInstrumentoRow { Nombre = "Idiófonos", Slug = "idiofonos", Fuente = "F-13, F-14", OrdenVisualizacion = 4 },
                new FamiliaInstrumentoRow { Nombre = "Electrófonos", Slug = "electrofonos", Fuente = "F-13", OrdenVisualizacion = 5 });
            await db.SaveChangesAsync(cancellationToken);

            var cordofonos = await db.FamiliasDeInstrumentos.AsNoTracking()
                .Where(f => f.Slug == "cordofonos").Select(f => f.Id).SingleAsync(cancellationToken);
            db.FamiliasDeInstrumentos.AddRange(
                new FamiliaInstrumentoRow { Nombre = "Cordófonos frotados", Slug = "cordofonos-frotados", FamiliaPadreId = cordofonos, Fuente = "F-08", OrdenVisualizacion = 11 },
                new FamiliaInstrumentoRow { Nombre = "Cordófonos pulsados", Slug = "cordofonos-pulsados", FamiliaPadreId = cordofonos, Fuente = "F-08", OrdenVisualizacion = 12 });
        }

        if (!await db.ServiciosDeTaller.AnyAsync(cancellationToken))
        {
            db.ServiciosDeTaller.AddRange(
                new ServicioTallerRow { Nombre = "Construcción de instrumentos", Slug = "construccion", Fuente = "F-07, F-08", OrdenVisualizacion = 1 },
                new ServicioTallerRow { Nombre = "Reparación", Slug = "reparacion", Fuente = "F-07", OrdenVisualizacion = 2 },
                new ServicioTallerRow { Nombre = "Restauración y conservación", Slug = "restauracion", Fuente = "F-08", OrdenVisualizacion = 3 },
                new ServicioTallerRow { Nombre = "Afinación y puesta a punto", Slug = "afinacion", Fuente = "F-16", OrdenVisualizacion = 4 },
                new ServicioTallerRow { Nombre = "Venta de instrumentos", Slug = "venta", OrdenVisualizacion = 5 },
                new ServicioTallerRow { Nombre = "Enseñanza y formación", Slug = "ensenanza", Fuente = "F-07", OrdenVisualizacion = 6 });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Los tipos de espacio y el equipamiento de los espacios para música en vivo, que son vocabulario controlado.
    /// </summary>
    /// <remarks>
    /// <b>SE SIEMBRAN AQUI POR LA MISMA RAZON QUE LOS DE LUTERIA:</b> la base de pruebas la crea EF con
    /// <c>EnsureCreated</c>, que levanta las tablas y ninguna de sus filas. En SQL Server ya los dejó
    /// <c>V20261110_81</c> y la guarda <c>Any</c> no hace nada. TODOS NACEN «PROPUESTO»: la aprobación es del
    /// Plan Nacional de Música para la Convivencia.
    /// </remarks>
    private static async Task EnsureVocabulariosDeEspaciosAsync(SimusDbContext db, CancellationToken cancellationToken)
    {
        if (!await db.TiposDeEspacio.AnyAsync(cancellationToken))
        {
            db.TiposDeEspacio.AddRange(
                new TipoDeEspacioRow { Nombre = "Bar o taberna", Slug = "bar", OrdenVisualizacion = 1 },
                new TipoDeEspacioRow { Nombre = "Restaurante o café con música en vivo", Slug = "restaurante-cafe", OrdenVisualizacion = 2 },
                new TipoDeEspacioRow { Nombre = "Sala de conciertos", Slug = "sala-de-conciertos", OrdenVisualizacion = 3 },
                new TipoDeEspacioRow { Nombre = "Teatro", Slug = "teatro", OrdenVisualizacion = 4 },
                new TipoDeEspacioRow { Nombre = "Auditorio", Slug = "auditorio", OrdenVisualizacion = 5 },
                new TipoDeEspacioRow { Nombre = "Casa de cultura o centro cultural", Slug = "casa-de-cultura", OrdenVisualizacion = 6 },
                new TipoDeEspacioRow { Nombre = "Escenario al aire libre", Slug = "escenario-al-aire-libre", OrdenVisualizacion = 7 },
                new TipoDeEspacioRow { Nombre = "Otro lugar", Slug = "otro", OrdenVisualizacion = 8 });
        }

        if (!await db.EquipamientoDeEspacio.AnyAsync(cancellationToken))
        {
            db.EquipamientoDeEspacio.AddRange(
                new EquipamientoDeEspacioRow { Nombre = "Sistema de sonido", Slug = "sonido", OrdenVisualizacion = 1 },
                new EquipamientoDeEspacioRow { Nombre = "Iluminación escénica", Slug = "iluminacion", OrdenVisualizacion = 2 },
                new EquipamientoDeEspacioRow { Nombre = "Tarima o escenario fijo", Slug = "tarima", OrdenVisualizacion = 3 },
                new EquipamientoDeEspacioRow { Nombre = "Instrumentos y amplificación de respaldo", Slug = "backline", OrdenVisualizacion = 4 },
                new EquipamientoDeEspacioRow { Nombre = "Camerinos", Slug = "camerinos", OrdenVisualizacion = 5 },
                new EquipamientoDeEspacioRow { Nombre = "Grabación o transmisión", Slug = "grabacion-transmision", OrdenVisualizacion = 6 });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// La taxonomía de perfiles de personas (roles, servicios, instrumentos), vocabulario controlado administrable
    /// desde el Catálogo (decisión 133). En SQL Server la siembra <c>V20261118_10</c>; aquí, para la base de pruebas.
    /// </summary>
    private static async Task EnsureTaxonomiaDePerfilesAsync(SimusDbContext db, CancellationToken cancellationToken)
    {
        foreach (var dimension in TaxonomiaDePerfiles.DimensionesAdministrables)
        {
            var existentes = await db.ValoresDeTaxonomiaDePerfiles.AsNoTracking()
                .Where(v => v.Dimension == dimension).Select(v => v.Codigo).ToListAsync(cancellationToken);
            // EL ORDEN ES DENTRO DE CADA HERMANDAD: las categorías entre sí y las subcategorías bajo su categoría.
            var ordenes = new Dictionary<string, int>();
            var iniciales = TaxonomiaDePerfiles.Iniciales(dimension);
            // Primero las categorías (sin padre) para que las subcategorías encuentren su identificador.
            foreach (var pasada in new[] { false, true })
            {
                foreach (var valor in iniciales.Where(v => (v.CodigoDePadre is not null) == pasada))
                {
                    var hermandad = valor.CodigoDePadre ?? string.Empty;
                    ordenes[hermandad] = ordenes.GetValueOrDefault(hermandad) + 1;
                    if (existentes.Contains(valor.Codigo)) continue;
                    int? idPadre = null;
                    if (valor.CodigoDePadre is not null)
                        idPadre = await db.ValoresDeTaxonomiaDePerfiles.Where(v => v.Dimension == dimension && v.Codigo == valor.CodigoDePadre)
                            .Select(v => (int?)v.Id).FirstOrDefaultAsync(cancellationToken);
                    db.ValoresDeTaxonomiaDePerfiles.Add(new ValorDeTaxonomiaDePerfilesRow
                    {
                        Dimension = dimension, Codigo = valor.Codigo, Nombre = valor.Nombre, GrupoSoyCultura = valor.GrupoSoyCultura,
                        Fuente = valor.Fuente, Activo = true, OrdenVisualizacion = ordenes[hermandad], IdPadre = idPadre,
                        FechaCreacion = DateTime.UtcNow,
                    });
                }
                await db.SaveChangesAsync(cancellationToken);
            }
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Los formatos de documentación y las formas de acceso de las redes, que son vocabulario controlado.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>SE SIEMBRAN AQUI POR LA MISMA RAZON QUE LOS DE MERCADOS Y LUTERIA:</b> la base de pruebas la
    /// crea EF con <c>EnsureCreated</c>, que levanta las tablas y ninguna de sus filas. En SQL Server ya
    /// los dejó <c>V20261110_71</c> y la guarda <c>Any</c> no hace nada.
    /// </para>
    /// <para>
    /// <b>TODOS NACEN «PROPUESTO».</b> Son una propuesta técnica (docs/referencia/25-modulos-restantes.md §25.4), no una lista oficial,
    /// y la aprobación es del Plan Nacional de Música para la Convivencia; se pueden elegir desde el
    /// primer día, porque un formulario sin opciones no deja registrar una red.
    /// </para>
    /// </remarks>
    private static async Task EnsureVocabulariosDeRedesAsync(SimusDbContext db, CancellationToken cancellationToken)
    {
        const string fuente = "Propuesta técnica (docs/referencia/25-modulos-restantes.md)";

        if (!await db.FormatosDeDocumentacion.AnyAsync(cancellationToken))
        {
            db.FormatosDeDocumentacion.AddRange(
                new FormatoRow { Nombre = "Sonoro", Slug = "sonoro", Fuente = fuente, OrdenVisualizacion = 1 },
                new FormatoRow { Nombre = "Audiovisual", Slug = "audiovisual", Fuente = fuente, OrdenVisualizacion = 2 },
                new FormatoRow { Nombre = "Impreso", Slug = "impreso", Fuente = fuente, OrdenVisualizacion = 3 },
                new FormatoRow { Nombre = "Fotográfico y gráfico", Slug = "fotografico-y-grafico", Fuente = fuente, OrdenVisualizacion = 4 },
                new FormatoRow { Nombre = "Digital", Slug = "digital", Fuente = fuente, OrdenVisualizacion = 5 },
                new FormatoRow { Nombre = "Objetos", Slug = "objetos", Fuente = fuente, OrdenVisualizacion = 6 });
            await db.SaveChangesAsync(cancellationToken);

            var impreso = await db.FormatosDeDocumentacion.AsNoTracking()
                .Where(f => f.Slug == "impreso").Select(f => f.Id).SingleAsync(cancellationToken);
            db.FormatosDeDocumentacion.AddRange(
                new FormatoRow { Nombre = "Partituras", Slug = "partituras", FormatoPadreId = impreso, Fuente = fuente, OrdenVisualizacion = 31 },
                new FormatoRow { Nombre = "Libros y publicaciones periódicas", Slug = "libros-y-periodicos", FormatoPadreId = impreso, Fuente = fuente, OrdenVisualizacion = 32 });
        }

        if (!await db.FormasDeAccesoDeRed.AnyAsync(cancellationToken))
        {
            db.FormasDeAccesoDeRed.AddRange(
                new FormaDeAccesoRow { Nombre = "Consulta en sala", Slug = "consulta-en-sala", Fuente = fuente, OrdenVisualizacion = 1 },
                new FormaDeAccesoRow { Nombre = "Consulta en línea", Slug = "consulta-en-linea", Fuente = fuente, OrdenVisualizacion = 2 },
                new FormaDeAccesoRow { Nombre = "Con cita previa", Slug = "con-cita-previa", Fuente = fuente, OrdenVisualizacion = 3 },
                new FormaDeAccesoRow { Nombre = "Solo para investigadores", Slug = "solo-investigadores", Fuente = fuente, OrdenVisualizacion = 4 },
                new FormaDeAccesoRow { Nombre = "Préstamo de materiales", Slug = "prestamo", Fuente = fuente, OrdenVisualizacion = 5 },
                new FormaDeAccesoRow { Nombre = "Reproducción o copia digital", Slug = "copia-digital", Fuente = fuente, OrdenVisualizacion = 6 },
                new FormaDeAccesoRow { Nombre = "Visitas guiadas", Slug = "visitas-guiadas", Fuente = fuente, OrdenVisualizacion = 7 });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Los tipos de documento de identidad del país, que son vocabulario controlado.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>SE SIEMBRAN PORQUE LA TABLA ESTABA VACIA DONDE NO SE HABIA MIGRADO.</b> `dbo.TiposDocumento`
    /// tenía sus filas en la base local, pero ninguna siembra las creaba: cualquier base nueva —la de
    /// pruebas, una instalación limpia— nacía con el catálogo vacío, y un desplegable vacío no deja
    /// guardar a nadie.
    /// </para>
    /// <para>
    /// <b>SON DIEZ Y NO OCHO, y ese fue un hallazgo.</b> La copia que el alta externa llevaba escrita
    /// a mano tenía dos que la tabla no: «Documento de identificación extranjero» y «Carné
    /// diplomático». Es decir, el alta aceptaba dos códigos que el catálogo no reconocía, y una
    /// pantalla que leyera de la tabla enseñaría el código en crudo. Se añaden a la tabla, que es la
    /// fuente, en vez de quitarlos del alta: son tipos de documento reales.
    /// </para>
    /// <para>
    /// NO PISA LO QUE YA HAY: si la fila existe, se deja como está. Cambiar un nombre a mano en la
    /// base es una decisión de alguien y un arranque no es el sitio para deshacerla.
    /// </para>
    /// </remarks>
    private static async Task EnsureTiposDeDocumentoAsync(SimusDbContext db, CancellationToken cancellationToken)
    {
        var catalogo = new (string Codigo, string Nombre, int Orden)[]
        {
            ("cc", "Cédula de ciudadanía", 1),
            ("ce", "Cédula de extranjería", 2),
            ("ti", "Tarjeta de identidad", 3),
            ("rc", "Registro civil de nacimiento", 4),
            ("nuip", "Número único de identificación personal", 5),
            ("pa", "Pasaporte", 6),
            ("pep", "Permiso especial de permanencia", 7),
            ("ppt", "Permiso por protección temporal", 8),
            ("die", "Documento de identificación extranjero", 9),
            ("cd", "Carné diplomático", 10),
        };

        var existentes = await db.TiposDocumento.Select(t => t.Codigo).ToListAsync(cancellationToken);
        var faltan = catalogo.Where(t => !existentes.Contains(t.Codigo, StringComparer.OrdinalIgnoreCase)).ToList();
        if (faltan.Count == 0) return;

        foreach (var (codigo, nombre, orden) in faltan)
        {
            db.TiposDocumento.Add(new TipoDocumentoRow
            {
                Codigo = codigo,
                Nombre = nombre,
                OrdenVisualizacion = orden,
                Activo = true,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureContentStatusAsync(
        SimusDbContext db,
        string code,
        string name,
        string description,
        CancellationToken cancellationToken)
    {
        var status = await db.ContentStatuses.FirstOrDefaultAsync(item => item.Code == code, cancellationToken);
        if (status is null)
        {
            db.ContentStatuses.Add(new ContentStatusRow
            {
                Code = code,
                Name = name,
                Description = description
            });
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        status.Name = name;
        status.Description = description;
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureDivipolaLocationAsync(
        SimusDbContext db,
        string departmentCode,
        string departmentName,
        string municipalityCode,
        string municipalityName,
        CancellationToken cancellationToken)
    {
        var location = await db.DivipolaLocations.FirstOrDefaultAsync(
            item => item.DepartmentCode == departmentCode && item.MunicipalityCode == municipalityCode,
            cancellationToken);
        if (location is null)
        {
            db.DivipolaLocations.Add(new DivipolaLocationRow
            {
                DepartmentCode = departmentCode,
                DepartmentName = departmentName,
                MunicipalityCode = municipalityCode,
                MunicipalityName = municipalityName,
                LocationType = "MUNICIPALITY"
            });
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        location.DepartmentName = departmentName;
        location.MunicipalityName = municipalityName;
        location.LocationType = "MUNICIPALITY";
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Deja puesta la politica vigente de una finalidad.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>PARA QUE SIRVE ESTO SI LA MIGRACION YA LAS SIEMBRA.</b> `V20260912_07` las escribe en las
    /// bases que pasan por DbUp. Las bases de prueba no pasan: se levantan desde el modelo. Sin
    /// esta siembra, un alta de organizacion en pruebas no encontraria texto que copiar y la
    /// autorizacion nacería vacia, que es exactamente lo que esta tabla existe para impedir.
    /// </para>
    /// <para>
    /// <b>ACTUALIZA EL TEXTO DE LA VERSION, NO LO VERSIONA.</b> Aqui se repone una redaccion
    /// conocida, no se publica una nueva: si el texto cambia de verdad, cambia la version y entra
    /// como otra fila por migracion. Reescribir el texto de una version ya aceptada por alguien
    /// seria cambiarle lo que dice su evidencia, y por eso las autorizaciones guardan su propia
    /// copia y no leen de aqui.
    /// </para>
    /// </remarks>
    private static async Task EnsurePoliticaDeDatosAsync(
        SimusDbContext db, string clave, string version, string titulo, string texto,
        string? urlOficial, string? referenciaOficial, CancellationToken cancellationToken,
        bool vigente = true)
    {
        // UNA SOLA VIGENTE POR CLAVE: publicar una versión vigente retira las demás de esa clave.
        if (vigente)
        {
            var otras = await db.PoliticasDeDatos
                .Where(item => item.Clave == clave && item.Version != version && item.Vigente)
                .ToListAsync(cancellationToken);
            if (otras.Count > 0)
            {
                foreach (var otra in otras) otra.Vigente = false;
                await db.SaveChangesAsync(cancellationToken);
            }
        }

        var politica = await db.PoliticasDeDatos
            .FirstOrDefaultAsync(item => item.Clave == clave && item.Version == version, cancellationToken);

        if (politica is null)
        {
            db.PoliticasDeDatos.Add(new PoliticaDeDatosRow
            {
                Clave = clave,
                Version = version,
                Titulo = titulo,
                Texto = texto,
                UrlOficial = urlOficial,
                ReferenciaOficial = referenciaOficial,
                Vigente = vigente,
                FechaPublicacion = DateTime.UtcNow,
                FechaCreacion = DateTime.UtcNow,
            });
        }
        else
        {
            politica.Titulo = titulo;
            politica.Texto = texto;
            politica.UrlOficial = urlOficial;
            politica.ReferenciaOficial = referenciaOficial;
            politica.Vigente = vigente;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureLocalEcosystemSeedAsync(SimusDbContext db, CancellationToken cancellationToken)
    {
        if (await db.FestivalRecords.AnyAsync(cancellationToken))
        {
            return;
        }

        var now = DateTime.UtcNow;

        // TRES ASIGNACIONES DE AQUI NO GUARDABAN NADA, y es exactamente por lo que se retiraron las
        // propiedades que las recibían. `StatusId`, `CreatedByUserId` y `PublishedAt` estaban
        // declaradas en `FestivalRow` y marcadas con `Ignore()` en el mapeo: el código las escribía,
        // el compilador no se quejaba y la base no recibía nada. El estado de verdad viaja en
        // `StatusCode`, que sí es una columna.
        db.FestivalRecords.Add(new FestivalRow
        {
            Name = "Festival Demo PNMC",
            Description = "Registro local de referencia para validar mapa, revision y publicacion.",
            OrganizerDisplayName = "Agrupacion Demo PNMC",
            CoverageLevel = "municipal",
            DepartmentCode = "05",
            MunicipalityCode = "05001",
            SedeCodigoDepartamento = "05",
            SedeCodigoMunicipio = "05001",
            StatusCode = "publicado",
            CreatedAt = now
        });

        await db.SaveChangesAsync(cancellationToken);
    }

    private static bool LooksLikeAspNetPasswordHash(string passwordHash)
    {
        return !string.IsNullOrWhiteSpace(passwordHash)
            && passwordHash.StartsWith("AQAAAA", StringComparison.Ordinal);
    }

}
