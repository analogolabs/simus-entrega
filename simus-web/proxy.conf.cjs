/**
 * El proxy de `ng serve`: reenvía `/api` a la API de ESTA pila.
 *
 * EL PUERTO SALE DE `SIMUS_LOCAL_API_PORT` (8180 por omisión), la misma variable que usa `scripts/local/api-local.sh`
 * (D-08). Antes el destino estaba fijo en 8180: levantar una pila aislada con otro puerto obligaba a editar el
 * archivo y, si se olvidaba, la web aislada escribía en la API de la demostración. Con la variable, la API y la web
 * de una misma pila se declaran con el mismo valor y no hay nada que editar:
 *
 *   SIMUS_LOCAL_API_PORT=8560 SIMUS_LOCAL_WEB_PORT=4560 npm start
 *
 * Para capturar pantallas o grabar NO se usa `ng serve` sino el artefacto de producción (sin
 * cuentas de desarrollo, sin peticiones a servicios locales): `npm run servir:produccion`.
 */
const puerto = process.env.SIMUS_LOCAL_API_PORT || '8180';

module.exports = {
  '/api': {
    target: `http://localhost:${puerto}`,
    secure: false,
    changeOrigin: false,
    logLevel: 'warn',
  },
};
