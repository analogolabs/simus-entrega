import { ApplicationRef, createComponent } from '@angular/core';
import { AccesoRapidoDemoComponent } from './acceso-rapido-demo.component';
import { leerConfiguracion } from './acceso-rapido-demo.config';

declare global { interface Window { __SIMUS_DEMO__?: unknown } }

/**
 * Pide `config-demo.js` (lo escribe el script de la demo; no está en el repositorio). Sin el archivo, o si el
 * servidor responde con la página de la aplicación en su lugar, no pasa nada: ni componente ni mensajes.
 */
export async function arrancarAccesoRapidoDemo(appRef: ApplicationRef): Promise<void> {
  try {
    const r = await fetch('/config-demo.js', { cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('javascript')) { return; }
    await new Promise<void>((ok, no) => {
      const s = document.createElement('script');
      s.src = '/config-demo.js';
      s.onload = () => ok();
      s.onerror = () => no();
      document.head.appendChild(s);
    });
  } catch { return; }
  const config = leerConfiguracion(window.__SIMUS_DEMO__);
  if (!config) { return; }
  const ref = createComponent(AccesoRapidoDemoComponent, { environmentInjector: appRef.injector, hostElement: document.body.appendChild(document.createElement('app-acceso-rapido-demo')) });
  ref.setInput('cuentas', config.cuentas);
  appRef.attachView(ref.hostView);
}
