# 4. Instalación y configuración

La orden habitual es `./scripts/local/dev-up.sh`. El script carga `.env`, comprueba Docker,
levanta la base, migra el esquema, completa DIVIPOLA cuando falta e inicia API y web.

| Script | Uso |
|---|---|
| `dev-up.sh` | iniciar el entorno completo |
| `dev-check.sh` | comprobar web, API y conectividad |
| `dev-down.sh` | detener procesos y contenedor sin borrar datos |
| `dev-refresh.sh` | reiniciar el conjunto |
| `local-db-up.sh` | iniciar y validar únicamente SQL Server |
| `schema-local.sh` | consultar, aplicar o inicializar historial DbUp |
| `api-local.sh` | iniciar el API contra SQL local |
| `base-limpia-local.sh` | reconstruir una base local desde cero |
| `actualizar-divipola-mgn-2025.sh` | actualizar el catálogo territorial desde DANE |

Los archivos bajo `tmp/`, así como `bin/`, `obj/`, `dist/` y `.angular/`, son resultados
locales regenerables. No contienen código fuente.

## Demostración sin confirmación de correo

La confirmación de correo es obligatoria por defecto, también si falta proveedor de correo. Para
una demostración controlada puede habilitarse explícitamente en `appsettings.Development.json` o
en la configuración local equivalente:

```json
{
  "Demo": {
    "PermitirOperacionSinCorreoConfirmado": true
  }
}
```

Solo se acepta en los entornos `Development`, `Local`, `Demo` y `Test`; si se activa en
`Production`, la API falla al iniciar. La excepción permite registrar y usar procesos, pero no
marca el correo como confirmado ni relaja autenticación, autorización, propiedad, CSRF, roles ni
auditoría. Restablecerla en `false` al finalizar la demostración.

### Demo publicada en Azure

La demo vigente es la Container App `simus-demo` (grupo `<grupo-de-recursos>`), que ejecuta la
imagen `simus:demo` del registro `<registro-de-contenedores>`. `appsettings.Demo.json` es una copia de
`appsettings.Production.json` —HTTPS, HSTS, proxy inverso, CORS cerrado— más la excepción
activa; una prueba automática exige que ambos sigan iguales salvo la sección `Demo`.
`infra/simus-demo.bicep` describe la variante App Service y también usa `Demo`.

Orden obligatorio:

1. Construir y publicar una imagen que incluya `appsettings.Demo.json` (workflow
   *Construir imagen SIMUS demo*; hoy bloqueado, ver).
2. Cambiar el entorno de la Container App:

```bash
# Activar el entorno Demo (sin confirmación de correo)
az containerapp update -g <grupo-de-recursos> -n simus-demo \
  --set-env-vars ASPNETCORE_ENVIRONMENT=Demo

# Volver a exigir la confirmación de correo
az containerapp update -g <grupo-de-recursos> -n simus-demo \
  --set-env-vars ASPNETCORE_ENVIRONMENT=Production
```

No aplicar el paso 2 sobre una imagen anterior: sin `appsettings.Demo.json`, el entorno
`Demo` arrancaría sin la configuración de seguridad de producción.
