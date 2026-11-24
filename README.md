# SIMUS — Sistema de Información de la Música

Sistema de información del sector musical colombiano para el Plan Nacional de Música para la Convivencia.
Reúne el **portal público**, el **espacio de gestión de las organizaciones** y la **consola de gestión administrativa**
en una aplicación Angular, sobre un API en .NET y una base de datos SQL Server.

## Créditos y contacto

| | |
|---|---|
| **Autor y desarrollo** | Edder Jiménez |
| **Entregado a través de** | Fundación El Poliedro |
| **Para** | Plan Nacional de Música para la Convivencia · Ministerio de las Culturas, las Artes y los Saberes |
| **Contacto** | [edderjimenezg@gmail.com](mailto:edderjimenezg@gmail.com) |

Condiciones de uso en [LICENSE](LICENSE); detalle en [CREDITOS.md](CREDITOS.md), [AUTHORS](AUTHORS) y [NOTICE](NOTICE).

> **Estado de la entrega.** SIMUS se ejecuta en modo `Local` o `Demo`. El envío de correo no está conectado y las cuentas
> operan sin confirmar su correo. El paso a producción —conectar el proveedor de correo y activar la confirmación— está
> descrito en [Modos de ejecución y paso a producción](docs/operacion/15-modos-de-ejecucion-y-paso-a-produccion.md).

## Requisitos

Git, .NET SDK 10, Node.js 24 con npm, Docker Desktop (SQL Server local y correo de prueba) y Python 3 con Pillow (siembra de demostración y comprobaciones).

## Probar con datos de demostración en 10 minutos

El repositorio **no trae datos cargados**: la demostración se genera al vuelo con el generador determinista de `siembra/`.

```bash
./scripts/demo/cargar-siembra.sh --si
```

Ese único comando comprueba las herramientas, crea `.env` con una contraseña de SQL Server propia de tu máquina, instala la web,
levanta SQL Server en Docker, migra el esquema, carga los catálogos (DIVIPOLA, territorios sonoros, prácticas musicales, roles),
genera las imágenes de demostración en `tmp/siembra/assets/`, siembra organizaciones, festivales, mercados, talleres, agenda,
noticias, Galería y Celebra la música, y arranca la API, la web y Mailpit. Sin `--si` solo explica lo que haría. Requisitos:
Docker Desktop en marcha, .NET SDK 10, Node.js 24, Python 3 con Pillow (`python3 -m pip install --user Pillow`).

| Servicio | Dirección predeterminada |
|---|---|
| Portal y consola | `http://127.0.0.1:4300` |
| API y documentación de rutas | `http://localhost:8180/swagger` |
| Estado del API | `http://localhost:8180/health/ready` |
| Correo local (Mailpit) | `http://127.0.0.1:8025` |
| SQL Server | `127.0.0.1,14344` |

**Cuentas de prueba** (clave inicial `admin`, solo en tu máquina). Las dos primeras **exigen cambiar la clave en el primer ingreso** (mínimo 12 caracteres):

| Cuenta | Para qué |
|---|---|
| `webmaster@simus.test` | Webmaster SIMUS: consola con todas las secciones |
| `gestor@simus.test` | Gestor institucional SIMUS |
| `camila.restrepo@simus.test` | Persona con organizaciones y procesos en todos los estados (espacio externo) |
| `editor@simus.test` | Equipo de una organización |
| `reclamante@simus.test` | Reclamaciones en varios estados |
| `nuevo@simus.test` | Cuenta sin datos |

> **Advertencia.** Si despliegas SIMUS en internet, entra de inmediato a cambiar las claves iniciales y desactiva el acceso rápido de
> demostración. Detalle: [Accesos iniciales](docs/accesos-iniciales.md).

Comprobar el entorno y detenerlo: `./scripts/local/dev-check.sh` y `./scripts/local/dev-down.sh`. Para rehacer la demostración desde
cero, vuelve a correr `cargar-siembra.sh --si`. Para una base sin datos de demostración (solo esquema, catálogos y cuentas de arranque):
`./scripts/demo/reconstruir-demo-local.sh --si` con `SIMUS_RECONSTRUIR_SIN_SEMBRAR_DEMO=1`.
Validar un cambio: `./scripts/validacion/verificar-estructura.sh` y `./scripts/validacion/validar-local.sh`
(la validación es local; los flujos de `.github/workflows` se lanzan a mano).
Cómo funciona la Galería y dónde van los archivos: [Galería y archivos multimedia](docs/desarrollo/33-galeria-y-archivos-multimedia.md).

## Estructura

| Ruta | Contenido |
|---|---|
| `simus-web/` | Aplicación Angular: portal público, espacios de gestión, pruebas y trinquetes de calidad |
| `simus-api/` | API .NET: dominio, contratos, persistencia, migrador y pruebas |
| `simus-database/` | Esquema y semillas (DbUp), validaciones SQL y base `simus-ministerio` |
| `siembra/` | Generador de datos sintéticos de demostración |
| `scripts/` | `local/` entorno, `demo/` demostración y siembra, `validacion/` pruebas y estructura, `documentos/` comprobaciones de documentación, `datos/` utilidades de datos |
| `infra/` | Infraestructura como código (Bicep) y guiones de despliegue |
| `docs/` | Documentación por público (índice abajo) |

## Mapa de la documentación

El índice completo está en [`docs/README.md`](docs/README.md).

| Si eres… | Empieza por |
|---|---|
| Persona usuaria o gestora | [Descripción general](docs/usuario/01-descripcion-general.md), [Módulos](docs/usuario/06-modulos-y-funcionalidades.md), [Roles y permisos](docs/usuario/07-roles-y-permisos.md) |
| Quien instala o despliega | [Instalación](docs/operacion/04-instalacion-y-configuracion.md), [Despliegue](docs/operacion/09-despliegue.md), [Operación](docs/operacion/11-operacion-y-mantenimiento.md) |
| Quien modifica el sistema | [Arquitectura](docs/desarrollo/02-arquitectura.md), [Estructura](docs/desarrollo/03-estructura-del-proyecto.md), [Pruebas](docs/desarrollo/10-pruebas.md) |
| Quien busca el porqué | [Decisiones y flujos por módulo](docs/referencia/20-decisiones-y-flujos-por-modulo.md) |

El [registro de cambios](CHANGELOG.md) describe la versión entregada (1.0.0). La [guía de contribución](CONTRIBUTING.md) y la
[política de seguridad](SECURITY.md) acompañan al código.

## Licencia y términos de uso

© 2026 Edder Jiménez. Todos los derechos reservados. El uso, la modificación y la redistribución requieren acuerdo con los
titulares, y todo uso debe conservar los créditos. Los términos de uso para el Plan Nacional de Música para la Convivencia se
acuerdan con la entidad. Ver [LICENSE](LICENSE).

---

**Autor y desarrollo: Edder Jiménez** · Entregado a través de la **Fundación El Poliedro** ·
Plan Nacional de Música para la Convivencia · Contacto: [edderjimenezg@gmail.com](mailto:edderjimenezg@gmail.com)
