# 3. Estructura del proyecto

## Decisión estructural

Las imágenes de referencia describen responsabilidades útiles, pero corresponden a un
backend Node y un frontend React. SIMUS usa .NET y Angular; su estructura debe expresar
esas plataformas sin crear capas equivalentes con nombres ajenos.

```text
simus/
├── simus-web/          Angular: portal, espacio de gestión y consola; pruebas, trinquetes y herramientas
├── simus-api/          .NET: HTTP, dominio, contratos, infraestructura, migrador y pruebas
├── simus-database/     SQL: esquema (DbUp), semillas, consultas de validación y línea Flyway del Ministerio
├── scripts/            entorno local reproducible y validación
├── infra/              despliegue Azure (Bicep y guiones; sin aplicar)
├── docs/               documentación vigente (numerada) y registros de decisión
├── .github/            plantillas y flujos de GitHub (los flujos se lanzan solo a mano)
└── CHANGELOG.md, README.md, Dockerfile, docker-compose.local.yml
```

La carpeta `Archivos basura/` ya **no existe**: salió del repositorio el 14 de septiembre de 2026 y
`scripts/validacion/verificar-estructura.sh` impide que reaparezca, igual que otras rutas retiradas. La
trazabilidad interna del trabajo (planes, auditorías, borradores de entrega) tampoco se versiona: vive fuera
del repositorio y en `docs/` solo está lo que ese guion permite.

No se agrupan frontend, backend y base bajo una carpeta adicional: ya son unidades con
manifiestos, comandos y ciclos de verificación propios. Moverlas añadiría profundidad y
rompería referencias sin mejorar el aislamiento.

## Backend

`simus-api/SIMUS.Api.sln` contiene:

| Proyecto | Responsabilidad |
|---|---|
| `SIMUS.Api` | composición HTTP, endpoints, seguridad y observabilidad |
| `SIMUS.Contracts` | solicitudes y respuestas públicas |
| `SIMUS.Domain` | entidades y conceptos de dominio |
| `SIMUS.Infrastructure` | EF Core, acceso a datos e integraciones |
| `SIMUS.Migrador` | aplicación de esquema y carga territorial controlada |
| `SIMUS.Api.Tests` | pruebas unitarias e integración |

Los endpoints minimal API cumplen la función que tendría una carpeta `controllers` en
otro marco. EF Core y las entidades reemplazan `models`; no existe un router separado
porque el mapeo de rutas pertenece a los propios endpoints.

## Frontend

Dentro de `simus-web/src/app/`:

- `core/`: servicios globales, HTTP, guardas, configuración, navegación, vocabularios, territorio y CMS.
- `features/`: capacidades organizadas por dominio y páginas enrutables: `admin` (consola), `panel-organizacion`
  y `external-access` (espacio de gestión), `ecosistema`, `agenda`, `news`, `editorial`, `gallery`, `map`, `home`,
  `pnmc`, `content`, `politicas`, `desarrollo` y `not-found`.
- `shared/`: componentes, directivas, textos y utilidades reutilizables sin dominio propio (`app-boton`,
  `app-estado-de-lista` y las demás piezas comunes).

Existe un único dominio `features/ecosistema/`; el duplicado heredado `features/ecosystem/` se retiró y el guion de
estructura impide que vuelva.

Las pruebas de navegador viven en `e2e/`; las auditorías amplias, en `e2e-audit/`; las
herramientas mantenidas, en `tools/`; los límites cuantificados de deuda, en `trinquete/`; los recursos
estáticos (marca, galería, miniaturas editoriales), en `public/`.

## Datos

- `simus-database/schema/`: historial inmutable de cambios estructurales (DbUp).
- `simus-database/simus-ministerio/`: migraciones Flyway de la base SIMUS del Ministerio y su verificación.
- `simus-database/seed/`: cargas explícitas separadas del esquema.
- `simus-database/scripts/`: consultas de auditoría y validación, más los guiones de respaldo y reversa del retiro de
  `PerfilesPublicosFestival` (`docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md`).
- `simus-database/local/`: notas sobre el modelo local.

DbUp, mediante `SIMUS.Migrador`, es el único ejecutor autorizado del esquema. La carpeta
retirada `migrations/` no formaba parte de ese flujo.

Las pruebas del API están en `simus-api/tests/SIMUS.Api.Tests/` y las de los guiones de operación en
`scripts/tests/`; las cifras actuales de ambas, en [`10`](10-pruebas.md).

## Dependencias permitidas

```text
simus-web ──HTTP──> simus-api ──EF Core──> SQL Server
scripts ──orquesta──> simus-web + simus-api + simus-database
infra ──empaqueta──> artefactos verificados
```

El frontend no consulta SQL. La base no depende del frontend. Ninguna parte activa
depende de material retirado.

