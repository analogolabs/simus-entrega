import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * El «no encontrado» de un recurso concreto: una noticia, un evento, una organización, un perfil,
 * un eje, un festival. UN SOLO COMPONENTE PARA TODOS.
 *
 * <b>POR QUÉ EXISTE.</b> Las pantallas públicas resolvían el «no existe» de cinco maneras: una
 * página 404 completa, «Componente no encontrado» sin contexto, el catálogo sin aviso, «no está
 * publicada» y «no disponible» con una salida al ecosistema. Quien sigue un enlace viejo no sabía
 * qué había pasado ni adónde ir.
 *
 * <b>QUÉ DICE.</b> Un título que nombra lo que se buscó, la causa probable —que es la misma para
 * un recurso inexistente y para uno oculto, a propósito: decir «existe pero no es público» filtra
 * lo que aún no se ha anunciado— y dos salidas: la lista de la que cuelga y el inicio.
 *
 * Se pinta dentro del contenedor de la pantalla: no pone su propio `main` ni su propia cabecera.
 */
@Component({
  selector: 'app-recurso-no-encontrado',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-xl px-6 py-20 text-center" role="status" data-testid="recurso-no-encontrado" [attr.aria-labelledby]="'rne-' + idBase()">
      <p class="tipo-etiqueta text-tinta-media">No encontrado</p>
      <h1 [id]="'rne-' + idBase()" class="tipo-titulo-grande mt-3 text-titulo">{{ titulo() }}</h1>
      <p class="mt-4 text-sm leading-relaxed text-tinta-media">
        {{ causa() }}
      </p>
      <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a
          [routerLink]="rutaDeLista()"
          data-testid="rne-lista"
          class="inline-flex min-h-11 items-center rounded-xl bg-morado px-5 text-xs font-bold text-white no-underline transition hover:bg-morado-vivo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2"
        >{{ etiquetaDeLista() }}</a>
        <a
          routerLink="/"
          data-testid="rne-inicio"
          class="inline-flex min-h-11 items-center rounded-xl border border-filete px-5 text-xs font-bold text-morado no-underline transition hover:border-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2"
        >Ir al inicio</a>
      </div>
    </section>
  `,
})
export class RecursoNoEncontradoComponent {
  /** «Esta noticia no está publicada», «No encontramos ese evento»… */
  readonly titulo = input.required<string>();
  /** Por qué puede pasar. Por omisión, la causa que sirve para casi todo. */
  readonly causa = input('Puede que la dirección haya cambiado, que esté mal escrita o que la publicación se haya retirado.');
  /** La lista de la que cuelga el recurso: «Ver todas las noticias». */
  readonly etiquetaDeLista = input.required<string>();
  readonly rutaDeLista = input.required<string>();
  /** Para que dos avisos en una misma pantalla no repitan el identificador. */
  readonly idBase = input('recurso');
}
