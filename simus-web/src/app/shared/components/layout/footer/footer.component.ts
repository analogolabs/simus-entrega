import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { redesConDireccionDelCms } from '../../../../core/config/redes-institucionales';
import { TextosWebService } from '../../../../core/services/textos-web.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  // `RouterLink` para las dos políticas propias: sin importarlo, `routerLink` se queda en un
  // atributo inerte —el compilador no se queja— y el enlace no lleva a ninguna parte.
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  private webTexts = inject(TextosWebService);
  currentYear = new Date().getFullYear();

  /**
   * LOS ENLACES DEL PIE SE EDITAN EN EL CMS (grupo «Redes sociales y enlaces del pie»): cada rótulo y cada
   * dirección tienen su clave. Las de fábrica son las del Ministerio; se leen aquí y no se escriben en la plantilla.
   */
  readonly socialNetworks = computed(() =>
    redesConDireccionDelCms(clave => this.webTexts.getWebText(clave)).map(red => ({ label: red.nombre, href: red.href })));

  private enlace(rotulo: string, direccion: string, interno = false): { label: string; href: string; interno?: boolean } {
    return { label: this.webTexts.getWebText(rotulo), href: this.webTexts.getWebText(direccion), interno: interno || undefined };
  }

  readonly citizenshipServices = computed(() => [
    this.enlace('footer_serv_pqrsd', 'footer_serv_pqrsd_url'),
    this.enlace('footer_serv_faq', 'footer_serv_faq_url'),
    this.enlace('footer_serv_glosario', 'footer_serv_glosario_url'),
    this.enlace('footer_serv_tramites', 'footer_serv_tramites_url'),
  ].filter(item => item.href.trim().length > 0));

  readonly aboutSite = computed(() => [
    this.enlace('footer_sitio_politicas', 'footer_sitio_politicas_url'),
    this.enlace('footer_sitio_datos', 'footer_sitio_datos_url', true),
    this.enlace('footer_sitio_mapa', 'footer_sitio_mapa_url'),
    this.enlace('footer_sitio_terminos', 'footer_sitio_terminos_url', true),
    this.enlace('footer_sitio_accesibilidad', 'footer_sitio_accesibilidad_url'),
  ].filter(item => item.href.trim().length > 0));

  getWebText(key: string): string {
    return this.webTexts.getWebText(key);
  }
  /**
   * Imagen editable. Devuelve la publicada en el CMS o, si no hay ninguna, la
   * compilada del registro: nunca cadena vacia, porque un `src` vacio hace que
   * el navegador vuelva a pedir la pagina. Ver `registro-de-imagenes-web.ts`.
   */
  imagen(clave: string): string {
    return this.webTexts.getWebImage(clave);
  }

  /** Texto alternativo de esa misma ranura. */
  imagenAlt(clave: string): string {
    return this.webTexts.getWebImageAlt(clave);
  }
}
