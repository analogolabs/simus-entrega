# Frontend de SIMUS

Aplicación Angular 21 con componentes standalone, Signals, Router, HttpClient,
Tailwind CSS, Leaflet y MapLibre.

## Estructura

- `src/app/core/`: configuración y servicios globales.
- `src/app/features/`: capacidades organizadas por dominio.
- `src/app/shared/`: piezas reutilizables sin dependencia de una capacidad.
- `e2e/`: recorridos funcionales de Playwright.
- `e2e-audit/`: auditorías de dispositivos, DOM y accesibilidad.
- `tools/`: comprobaciones y mantenimiento del frontend.
- `trinquete/`: límites cuantificados de deuda técnica.

El gestor de paquetes canónico es npm. `package-lock.json` es el único lock vigente.

## Desarrollo

```bash
npm ci
npm start
```

La aplicación queda en `http://127.0.0.1:4300`. El proxy (`proxy.conf.cjs`) reenvía `/api` al backend en
`http://localhost:8180`.

### Una pila aislada (otra base, otros puertos)

Los puertos salen de dos variables y no hay nada que editar: `SIMUS_LOCAL_API_PORT` (API; 8180 por omisión, la
misma que lee `scripts/local/api-local.sh`) y `SIMUS_LOCAL_WEB_PORT` (web; 4300 por omisión).

```bash
SIMUS_LOCAL_API_PORT=8560 SIMUS_LOCAL_WEB_PORT=4560 npm start
```

Para **capturar pantallas, grabar o correr recorridos de navegador** no se usa `ng serve`: lleva la capa de
anotación de desarrollo y las cuentas de desarrollo, y deja peticiones fallidas en la consola. Se sirve el build de
producción, que es lo que se despliega, con la API de la pila:

```bash
SIMUS_LOCAL_API_PORT=8560 SIMUS_LOCAL_WEB_PORT=4560 npm run servir:produccion   # compila y sirve
SIMUS_LOCAL_API_PORT=8560 SIMUS_LOCAL_WEB_PORT=4560 npm run servir               # sirve el dist/ ya compilado
```

`tools/capturar-pantallas.mjs` y los recorridos de Playwright toman la dirección de `--base` o de `SIMUS_BASE_URL`.

## Verificación

```bash
npm run lint
npm run trinquete
npm test
npm run build
npm run e2e:ci
```

En producción, el frontend consume rutas relativas del mismo origen. El servidor debe
redirigir `/api` al backend y devolver `index.html` para las rutas de la aplicación.

