import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

/**
 * La vista previa del panel se decide ANTES de arrancar, no despues.
 *
 * La vista previa sustituye `TextosWebService`, asi que tiene que entrar en la
 * configuracion del arranque.
 *
 * Las dos condiciones son necesarias. `!environment.production` mantiene el
 * puente fuera del paquete desplegado —`angular.json` sustituye el fichero de
 * entorno, el `if` queda en `false` y este `import()` nunca se pide—, y el
 * parametro en la direccion evita que una pestana normal de desarrollo cargue un
 * servicio distinto del que corre en produccion.
 */
async function configuracionDeArranque() {
  const esVistaPrevia = typeof location !== 'undefined'
    && new URLSearchParams(location.search).has('pnmcVista');

  if (environment.production || !esVistaPrevia) { return appConfig; }

  const { PROVEEDOR_DE_VISTA_PREVIA } = await import('./app/core/cms/vista-previa-puente');
  return { ...appConfig, providers: [...appConfig.providers, PROVEEDOR_DE_VISTA_PREVIA] };
}

configuracionDeArranque()
  .then((config) => bootstrapApplication(AppComponent, config))
  .then((appRef) => {
    // Acceso rápido de cuentas de demostración: TEMPORAL, apagado por omisión. Solo en build de desarrollo y desde una
    // dirección local; pide `config-demo.js` (escrito por scripts/demo/reiniciar-demo.sh, fuera del repositorio) y, si
    // existe, carga el componente en un trozo aparte. Ver docs/operacion/11-operacion-y-mantenimiento.md §11.6 ter. En producción este bloque no se emite.
    if (!environment.production && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
      void import('./app/dev/acceso-rapido-demo/arranque').then((m) => m.arrancarAccesoRapidoDemo(appRef));
    }
  })
  .catch((err) => console.error(err));
