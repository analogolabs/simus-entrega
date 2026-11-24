# 15. Modos de ejecución y paso a producción

**Estado actual de SIMUS: pre-entrega.** Todo el trabajo se ejecuta en modo `Local` o `Demo`. El
envío de correo no está conectado y la confirmación de correo está dispensada. Producción se
activa el día de la entrega siguiendo la [lista de la sección 15.4](#154-lista-para-pasar-a-producción).

## 15.1 Los tres modos

SIMUS lee al arrancar la variable `ASPNETCORE_ENVIRONMENT`. Según su valor carga un archivo de
configuración distinto. La variable no se define en el código: la fija quien ejecuta la aplicación.

| Modo | Dónde | Archivo | Confirmación de correo | Envío de correo |
|---|---|---|---|---|
| `Local` | Equipo de cada persona (`scripts/local/dev-up.sh`) | `appsettings.json` + `.env` | Dispensada si `.env` lo indica | No |
| `Demo` | Demo publicada en Azure | `appsettings.Demo.json` | Dispensada | No |
| `Production` | Servidor definitivo | `appsettings.Production.json` + variables del servidor | **Obligatoria** | **Obligatorio** (SMTP) |

`Demo` tiene exactamente la misma seguridad que `Production` (HTTPS, HSTS, proxy inverso, CORS
cerrado); una prueba automática lo comprueba. La única diferencia es la confirmación de correo.

## 15.2 Qué está apagado en pre-entrega

| Servicio | Situación hoy | Qué lo activa |
|---|---|---|
| Envío de correo | Los mensajes se guardan en `dbo.Notificaciones` con estado `pendiente` y no salen | `Correo:Proveedor=Smtp` (15.3) |
| Confirmación de correo | Dispensada: las cuentas operan sin confirmar | Usar el modo `Production` |

Mientras tanto, el personal del Programa puede dar un correo por confirmado desde la consola
(«Confirmar el correo» en la ficha de la organización).

## 15.3 Cómo funciona el envío de correo

1. Cada mensaje (confirmación de cuenta, avisos de revisión de Festivales…) se guarda en la
   cola `dbo.Notificaciones` con `Canal = email` y `Estado = pendiente`.
2. Si hay proveedor configurado, un servicio en segundo plano revisa la cola cada
   `IntervaloSegundos` (30 por defecto), envía hasta `TamanoDeLote` mensajes y los marca
   `enviada`. Si un envío falla, guarda el error en la columna `Error` y lo reintenta; al llegar a
   `MaximoIntentos` (5) lo marca `fallida`.
3. Los enlaces de los mensajes se escriben sin dominio (`/ecosistema/confirmar-correo?...`) y se
   completan al enviar con `Correo:UrlPublica`.

Los mensajes acumulados antes de conectar el proveedor también se envían. Si no se desea, hay
que marcarlos `cancelada` antes de activar el envío; es una operación sobre la base de datos y
requiere autorización.

### Configuración

Las claves se pasan como variables de entorno del servidor: `__` separa los niveles.
**La clave nunca va en un archivo del repositorio.**

| Variable | Ejemplo | Obligatoria |
|---|---|---|
| `Correo__Proveedor` | `Smtp` | Sí |
| `Correo__UrlPublica` | `https://simus.gov.co` | Sí |
| `Correo__Remitente` | `no-responder@simus.gov.co` | Sí |
| `Correo__ClaveDeBaja` | *(secreto, 32 caracteres como mínimo)* | Sí |
| `Correo__NombreRemitente` | `SIMUS` | No |
| `Correo__Smtp__Servidor` | `smtp.office365.com` | Sí |
| `Correo__Smtp__Puerto` | `587` | No (587) |
| `Correo__Smtp__UsarTls` | `true` | No (true) |
| `Correo__Smtp__Usuario` | `no-responder@simus.gov.co` | Si el servidor lo pide |
| `Correo__Smtp__Clave` | *(secreto)* | Si el servidor lo pide |

Si falta un dato obligatorio, la aplicación no arranca y el mensaje de error dice cuál.

### Servidores habituales

| Proveedor | Servidor | Puerto | Usuario |
|---|---|---|---|
| Microsoft 365 / Exchange Online | `smtp.office365.com` | 587 | La cuenta remitente (requiere SMTP autenticado habilitado) |
| Google Workspace | `smtp.gmail.com` | 587 | La cuenta remitente, con contraseña de aplicación |
| SendGrid | `smtp.sendgrid.net` | 587 | `apikey` (la clave es la API key) |
| Azure Communication Services | `smtp.azurecomm.net` | 587 | Usuario SMTP creado en el recurso |
| Brevo | `smtp-relay.brevo.com` | 587 | Usuario SMTP de la cuenta |

Se admite el puerto 587 con TLS (STARTTLS). El puerto 465 con TLS implícito no está soportado.

## 15.4 Lista para pasar a producción

1. **Contratar o habilitar el proveedor** y crear la cuenta remitente. Configurar SPF, DKIM y
   DMARC del dominio para que los mensajes no lleguen a spam.
2. **Definir en el servidor** las variables de la tabla de 15.3, con la clave como secreto.
3. **Cambiar el modo** a `ASPNETCORE_ENVIRONMENT=Production`. Si falta el proveedor, la
   aplicación se niega a arrancar: es intencional.
4. **Probar**: registrar una cuenta, comprobar que llega el correo y que el enlace abre en el
   dominio público. Revisar en `dbo.Notificaciones` que el mensaje quedó `enviada`.

Para volver al modo de pre-entrega basta con `ASPNETCORE_ENVIRONMENT=Demo`.

## 15.5 Base de demostración local

En pre-entrega **no hay datos reales**: todo lo que no sea esquema o catálogo de referencia es
de demostración y se puede reconstruir.

| Capa | Qué contiene | ¿Real? | ¿Llega a producción? | Se carga con |
|---|---|---|---|---|
| Esquema | Tablas y columnas | — | Sí | `SIMUS.Migrador migrar` |
| Referencia | DIVIPOLA, catálogos, roles, acervo editorial | Sí | Sí | `scripts/local/seed-local-db.sh` |
| Cuentas de arranque | `webmaster@simus.test`, `gestor@simus.test`… | No | **No** | La API al iniciar en local |
| Demostración | Festivales, organizaciones, agenda y noticias inventados | No | **No** | `scripts/demo/sembrar-demo.sh` |

Un solo comando monta las cuatro capas desde cero (borra la base indicada en
`SIMUS_LOCAL_DB_NAME`, por defecto `SIMUS_LOCAL`):

```bash
./scripts/local/dev-down.sh                 # si los servicios están en marcha
./scripts/demo/reconstruir-demo-local.sh   # pide escribir el nombre de la base para confirmar
./scripts/local/dev-up.sh
```

Para renovar solo los contenidos de demostración sin tocar el resto:
`./scripts/demo/sembrar-demo.sh` (o `… mapa` / `… noticias`). Cada semilla retira lo que ella misma
sembró —procedencia `siembra`— antes de volver a sembrar.

En `.env` (ignorado por Git) el modo demo dispensa la confirmación de correo:

```bash
Demo__PermitirOperacionSinCorreoConfirmado=true
```

Para probar el envío real desde un equipo, se pueden añadir también las variables `Correo__…`
de 15.3 apuntando a un servidor de pruebas.
`./scripts/demo/reiniciar-demo.sh --si` ya lo hace con Mailpit, una bandeja local en <http://127.0.0.1:8025>
(ver `docs/operacion/11-operacion-y-mantenimiento.md` §11.8).
