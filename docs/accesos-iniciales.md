# Accesos iniciales

> **Autor y desarrollo:** Edder Jiménez · **Entregado a través de la Fundación El Poliedro** ·
> Contacto: [edderjimenezg@gmail.com](mailto:edderjimenezg@gmail.com)

Este documento lista las cuentas con las que arranca SIMUS en el entorno local y en la demostración, y qué hacer con ellas
antes de exponer el sistema. Las claves iniciales son **provisionales** y existen solo para poder entrar la primera vez.

> **Advertencia.** Si se despliega en internet, entra de inmediato a cambiar las claves iniciales y desactiva el acceso rápido
> de demostración (`SIMUS_DEMO_SIN_ACCESO_RAPIDO=1`). Una clave conocida en un servicio público equivale a dejar la puerta abierta.

## 1. Webmaster

| Dato | Valor |
|---|---|
| Cuenta | `webmaster@simus.test` (Webmaster SIMUS) |
| Clave inicial | `admin` |
| Cambio de clave | **Obligatorio en el primer ingreso**, mínimo 12 caracteres |
| Ingreso | `http://127.0.0.1:4300/administracion` |

Se crea al arrancar la API (con `Database__SeedBootstrapUsers`; opción `Database__BootstrapExigirCambioDeClave=true`, activa en `.env.example`).

## 2. Gestión institucional

| Dato | Valor |
|---|---|
| Cuenta | `gestor@simus.test` (Gestor institucional SIMUS) |
| Clave inicial | `admin` |
| Cambio de clave | **Obligatorio en el primer ingreso**, mínimo 12 caracteres |

## 3. Cuentas de la siembra de demostración

Las crea `./scripts/demo/cargar-siembra.sh --si`. Todas parten de la clave `admin`. La siembra reutiliza las dos cuentas
administrativas de las secciones 1 y 2 (no crea otras): firman los historiales de la demostración y exigen el cambio de clave igual.

| Cuenta | Para qué | Cambio de clave |
|---|---|---|
| `camila.restrepo@simus.test` | Persona ficticia con organizaciones y procesos en todos los estados (espacio externo) | No forzado |
| `editor@simus.test` | Equipo de una organización | No forzado |
| `reclamante@simus.test` | Reclamaciones en varios estados | No forzado |
| `nuevo@simus.test` | Cuenta sin datos | No forzado |
| `externo@simus.test`, `participante.dos@simus.test`, `participante.tres@simus.test` | Cuentas externas de arranque, para pruebas | No forzado |

## 4. Antes de exponer SIMUS

1. Cambia las claves de las cuentas de las secciones 1 y 2, y elimina o cambia las de la sección 3 (o no siembres la demostración).
2. Desactiva el acceso rápido de demostración: no debe existir en el servicio público.
3. Define una contraseña propia de SQL Server (`SIMUS_LOCAL_SA_PASSWORD`) y no versiones el archivo `.env`.
4. Conecta el proveedor de correo y activa la confirmación de correo (ver [Modos de ejecución y paso a producción](operacion/15-modos-de-ejecucion-y-paso-a-produccion.md)).

En este repositorio no hay claves reales, de servicios en la nube ni de Azure: las únicas credenciales son las provisionales de arriba.
