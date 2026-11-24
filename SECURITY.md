# Seguridad

Si encuentras una vulnerabilidad en SIMUS, no la publiques ni abras un Issue público.
Escribe a [edderjimenezg@gmail.com](mailto:edderjimenezg@gmail.com) con el asunto «Seguridad SIMUS» e incluye:

- qué ocurre y qué podría lograr quien lo aproveche;
- los pasos para reproducirlo (ruta, rol de la cuenta, datos de entrada);
- la versión o el commit en que lo observaste.

Se acusa recibo, se evalúa y se responde con un plan de corrección. No pruebes contra datos reales
ni contra servicios que no administras. Los secretos y las credenciales nunca se versionan
(ver `.env.example` y `docs/operacion/09-despliegue.md`).
