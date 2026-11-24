# Cómo contribuir

El uso y la modificación de SIMUS requieren acuerdo con los titulares (ver [LICENSE](LICENSE)).
Quien trabaje sobre el código con ese acuerdo sigue estas pautas.

1. **Levanta el entorno** como indica el [README](README.md) y la guía
   [instalación y configuración](docs/operacion/04-instalacion-y-configuracion.md).
2. **Un cambio, una rama, un commit claro.** Mensajes en español, en presente y con el porqué.
3. **Valida antes de proponer.** `./scripts/validacion/verificar-estructura.sh` (rápido) y
   `./scripts/validacion/validar-local.sh` (lint, trinquetes, pruebas de la web y de la API, compilaciones).
   Qué se comprueba y cómo se corre cada cosa: [pruebas](docs/desarrollo/10-pruebas.md).
4. **Estilo.** Código y nombres en español (ver `docs/operacion/11-operacion-y-mantenimiento.md` §11.6) y textos de la
   interfaz según la [guía de estilo](docs/usuario/23-guia-de-estilo-de-textos.md).
5. **Pruebas con el cambio.** Un comportamiento nuevo o corregido lleva su prueba; los trinquetes
   (`simus-web/trinquete/`) no se bajan para conseguir verde.
6. **Sin secretos ni datos reales.** Ni `.env`, ni credenciales, ni certificados, ni bases de datos de personas.
7. **Documenta lo que cambie** en `docs/` y conserva los créditos de autoría ([CREDITOS.md](CREDITOS.md)).

Contacto: [edderjimenezg@gmail.com](mailto:edderjimenezg@gmail.com).
