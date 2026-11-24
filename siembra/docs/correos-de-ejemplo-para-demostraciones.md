# Correos de ejemplo para demostraciones

. En modo demo el envío de correo no está conectado, así que la bandeja de la demo está vacía. Para mostrar cómo se ven las invitaciones, la cuenta, la contraseña, los Festivales y el boletín (incluida la invitación de la agenda de citas) se envían **ejemplos** a un Mailpit local **propio**, separado del de la demo.

## Cómo

```bash
SIMUS_LOCAL_SMTP_PORT=11025 SIMUS_LOCAL_MAILPIT_WEB_PORT=18025 \
SIMUS_LOCAL_MAILPIT_CONTAINER=simus-correos-de-ejemplo SIMUS_LOCAL_MAILPIT_PROYECTO=simus-correos-de-ejemplo \
./scripts/datos/vista-previa-de-correos.sh            # envía un ejemplo de cada correo y dice dónde verlos (http://127.0.0.1:18025)
./scripts/datos/vista-previa-de-correos.sh --bajar    # (mismas variables) al terminar, detiene ese Mailpit
```

- Con `--capturas <carpeta>` deja además capturas a 390 px y un `index.html` (necesita Playwright de `simus-web/node_modules`).
- Mailpit guarda en memoria: al bajar el contenedor la bandeja se borra. Los ejemplos usan direcciones `.test` y datos sintéticos; no llega nada a nadie.

## Qué lo hace seguro

- El script **se niega** a correr sin `SIMUS_LOCAL_MAILPIT_CONTAINER` o con el nombre del contenedor de la demo (`simus-desarrollo-mailpit`): nunca recrea ni vacía la bandeja de la demo (puerto 8025).
- El transporte solo acepta servidores en `127.0.0.1`; no puede enviar a Internet.
- Puertos distintos de los de la demo (1025 y 8025): usa libres, por ejemplo 11025 y 18025.

## Si se quiere ver en la bandeja de la demo

Solo con orden expresa de quien opera la demo: el script no lo hace y la regla de arriba lo impide a propósito, porque levantar el Mailpit de la demo recrea el contenedor y vacía su bandeja.
