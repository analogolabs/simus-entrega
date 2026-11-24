# 9. Despliegue

## 9.1 Requisitos

- .NET SDK 10.
- Node.js 24 y npm.
- Docker Desktop con `docker compose`.
- Git. En Windows, Git Bash y PowerShell.

La base local usa `mcr.microsoft.com/azure-sql-edge:latest`. Su puerto solo se publica
en la interfaz local.

## 9.2 Preparar el entorno

```bash
cp .env.example .env
npm ci --prefix simus-web
```

Abra `.env` y reemplace el marcador de `SIMUS_LOCAL_SA_PASSWORD` por una contraseña local
robusta. Este archivo está ignorado por Git. No copie allí credenciales de Azure.

| Variable | Valor predeterminado |
|---|---|
| `SIMUS_LOCAL_SQL_PORT` | `14344` |
| `SIMUS_LOCAL_DB_NAME` | `SIMUS_LOCAL` |
| `SIMUS_LOCAL_API_PORT` | `8180` |
| `SIMUS_LOCAL_WEB_PORT` | `4300` |

## 9.3 Iniciar y comprobar

```bash
./scripts/local/dev-up.sh
./scripts/local/dev-check.sh
```

El arranque levanta SQL Server, aplica los guiones pendientes de `simus-database/schema/`,
incorpora DIVIPOLA MGN 2025 si falta e inicia API y frontend. Los registros temporales
quedan en `tmp/dev/` y no se versionan.

```bash
./scripts/local/dev-down.sh     # detiene sin borrar el volumen de datos
./scripts/local/dev-refresh.sh  # detiene y vuelve a iniciar
```

En Windows, `dev-up.sh` delega el inicio a `scripts/local/dev-start-windows.ps1`. No existen
lanzadores `.command` vigentes.

## 9.4 Operación por componentes

```bash
./scripts/local/local-db-up.sh
./scripts/local/schema-local.sh migrar
./scripts/local/api-local.sh

cd simus-web
npm start
```

`schema-local.sh estado` lista los cambios pendientes. `base-limpia-local.sh` elimina y
reconstruye una base local; úselo solo cuando la pérdida esté prevista.

## 9.5 Validar

```bash
./scripts/validacion/verificar-estructura.sh
bash scripts/validacion/tests/run-script-tests.sh
(cd simus-web && npm run lint && npm run trinquete && npm test && npm run build)
(cd simus-api && dotnet build SIMUS.Api.sln --configuration Release)
```

La suite completa de persistencia necesita SQL local y `SIMUS_PRUEBAS_SQLSERVER=1`.

## 9.6 Base SIMUS del Ministerio

El módulo de Festivales se incorpora a la base SIMUS con Flyway, desde `simus-database/simus-ministerio/`:
respaldo completo, `flyway baseline` (registra las tablas `ART_MUS_*` existentes como versión 1),
`flyway migrate` y `verificacion/verificar_estado_objetivo.sql`. El procedimiento, los requisitos y el
traslado de registros heredados están en el `README.md` de esa carpeta. Antes de desplegar se ejecuta
`scripts/validacion/validar-simus-ministerio.sh` con la exportación vigente de la base.

## 9.7 Azure

La infraestructura versionada está en `infra/`. Antes de un despliegue real se confirman
la suscripción, el grupo de recursos, el nombre del sitio y la cadena de conexión. Esos
datos no se infieren ni se guardan en el repositorio.

