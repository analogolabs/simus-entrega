import { traducirErrorDelServidor } from '../../core/formularios/traductor-de-errores';
import { PanelDeSeccionComponent } from '../../shared/components/ui/panel-de-seccion/panel-de-seccion.component';
import { Component, ElementRef, effect, inject, signal } from '@angular/core';
import { TextosWebService } from '../../core/services/textos-web.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucidePencilLine } from '@lucide/angular';
import { BotonComponent } from '../../shared/components/ui/boton/boton.component';
import { DatoEnLecturaComponent } from '../../shared/components/ui/dato-en-lectura/dato-en-lectura.component';
import {
  FalloDelServidor,
  PanelOrganizacionApi,
  ResponsableOrganizacion,
  ResponsableOrganizacionSolicitud,
  TipoDocumento,
} from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { AvisoSoloAdministracionComponent } from './aviso-solo-administracion.component';
import { FechaPipe } from '../../shared/utils/fecha.pipe';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
interface FormularioResponsable {
  responsableNombre: string;
  responsableTipoDocumento: string;
  responsableNumeroDocumento: string;
  responsableTelefono: string;
}

function vacioANulo(valor: string): string | null {
  const limpio = (valor ?? '').trim();
  return limpio.length === 0 ? null : limpio;
}

/**
 * La ruta «Persona responsable», en /gestion/responsable.
 *
 * <b>SE SEPARÓ DE `SeccionOrganizacionComponent`.</b> Vivía ahí como un
 * segundo bloque, sin DOM compartido con el de la organización: dos `<section>` hermanos, dos
 * formularios, dos guardados, dos rutas del API (`dbo.Entidades` frente a
 * `dbo.EntidadesResponsable`). Separarla en su propia ruta fue sobre todo mecánico —el mismo
 * formulario, la misma validación, el mismo `api.guardarResponsable()`— y le da su propia URL,
 * como pidió la dirección de producto.
 *
 * <b>Lo que no se edita no se pinta como campo apagado.</b> Un `<input disabled>` no recibe foco y
 * no dice por qué está apagado: quien usa lector de pantalla oye un campo y no se entera de nada.
 * Aquí esos datos van como texto, con su motivo escrito al lado.
 */
@Component({
  selector: 'app-seccion-responsable',
  standalone: true,
  imports: [PanelDeSeccionComponent, CampoDeSeleccionComponent, BotonNativoDirective, FechaPipe, AvisoSoloAdministracionComponent, CommonModule, FormsModule, BotonComponent, DatoEnLecturaComponent, LucidePencilLine],
  templateUrl: './seccion-responsable.component.html',
})
export class SeccionResponsableComponent {
  private readonly textosWeb = inject(TextosWebService);

  /**
   * El canal para pedir lo que no se hace desde la pantalla. «Escríbele al equipo del
   * PNMC» no decía adónde: es el correo de atención del Ministerio, el mismo del pie del sitio y
   * editable desde el CMS (`footer_col3_email`).
   */
  readonly correoDelPrograma = () => this.textosWeb.getWebText('footer_col3_email');
  private readonly api = inject(PanelOrganizacionApi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly store = inject(PanelOrganizacionStore);

  readonly organizacionId = this.store.organizacionId;
  /**
   * Ver y editar a la persona responsable es de la administración: son datos personales y
   * el servidor responde 403 al editor. Al editor no se le piden ni se le ofrecen.
   */
  readonly esAdministradora = this.store.esAdministradora;

  readonly formularioResponsable: FormularioResponsable = {
    responsableNombre: '', responsableTipoDocumento: '', responsableNumeroDocumento: '', responsableTelefono: '',
  };

  readonly tiposDocumento = signal<TipoDocumento[]>([]);
  readonly responsable = signal<ResponsableOrganizacion | null>(null);

  /** Distingue «no ha llegado» de «esta organización no tiene fila»: hoy le pasa a 17 de 19. */
  readonly sinResponsable = signal(false);

  readonly guardandoResponsable = signal(false);
  readonly mensajeResponsable = signal('');
  readonly errorResponsable = signal('');

  /** Errores por campo, con las claves que devuelve el 422 del API. */
  readonly erroresResponsable = signal<Record<string, string>>({});

  /** Falso es lectura y verdadero es formulario. Arranca en falso. */
  readonly editandoResponsable = signal(false);

  constructor() {
    // Cambiar de organización cambia la persona responsable, no solo el rótulo de la cabecera.
    effect(() => {
      const id = this.organizacionId();
      const administra = this.esAdministradora();
      if (id) {
        this.editandoResponsable.set(false);
        this.mensajeResponsable.set('');
        this.erroresResponsable.set({});
        if (administra) this.cargarResponsable(id);
        else this.responsable.set(null);
      }
    });

    this.api.obtenerTiposDocumento().subscribe({
      next: tipos => this.tiposDocumento.set(tipos ?? []),
      error: () => this.tiposDocumento.set([]),
    });
  }

  /**
   * Rellena los cuatro campos escribibles desde la fila.
   *
   * SE SACÓ DE `cargarResponsable` para que «Cancelar» pudiera reusarlo.
   * Sin esto, cancelar dejaría el formulario con lo tecleado y la próxima vez que se abriera
   * mostraría datos que nadie guardó.
   */
  private sembrarFormularioResponsable(fila: ResponsableOrganizacion | null): void {
    this.formularioResponsable.responsableNombre = fila?.responsableNombre ?? '';
    this.formularioResponsable.responsableTipoDocumento = (fila?.responsableTipoDocumento ?? '').toLowerCase();
    this.formularioResponsable.responsableNumeroDocumento = fila?.responsableNumeroDocumento ?? '';
    this.formularioResponsable.responsableTelefono = fila?.responsableTelefono ?? '';
  }

  private cargarResponsable(organizacionId: string): void {
    this.sinResponsable.set(false);
    this.errorResponsable.set('');
    this.api.obtenerResponsable(organizacionId).subscribe({
      next: fila => {
        this.responsable.set(fila);
        this.sembrarFormularioResponsable(fila);
      },
      error: (fallo: FalloDelServidor) => {
        this.responsable.set(null);
        // 404 NO ES UN ERROR AQUÍ: es una organización dada de alta antes de que existiera la fila
        // de responsable. El panel lo dice; pintar campos vacíos haría creer que los datos estaban
        // y se perdieron.
        if (fallo?.status === 404) this.sinResponsable.set(true);
        else this.errorResponsable.set(fallo?.message ?? 'No fue posible consultar la persona responsable');
      },
    });
  }

  /** Igual que en la organización: abre el formulario con lo que hay guardado. */
  editarResponsable(): void {
    const fila = this.responsable();
    if (!fila) return;
    this.sembrarFormularioResponsable(fila);
    this.mensajeResponsable.set('');
    this.errorResponsable.set('');
    this.erroresResponsable.set({});
    this.editandoResponsable.set(true);
    this.enfocar('#responsable-nombre');
  }

  cancelarResponsable(): void {
    this.sembrarFormularioResponsable(this.responsable());
    this.mensajeResponsable.set('');
    this.errorResponsable.set('');
    this.erroresResponsable.set({});
    this.editandoResponsable.set(false);
    this.enfocar('[data-testid="responsable-editar"]');
  }

  guardarResponsable(): void {
    if (this.guardandoResponsable()) return;
    this.mensajeResponsable.set('');
    this.errorResponsable.set('');

    const errores: Record<string, string> = {};
    if (!this.formularioResponsable.responsableNombre.trim()) errores['responsableNombre'] = 'El nombre de la persona responsable es obligatorio.';
    if (!this.formularioResponsable.responsableTipoDocumento) errores['responsableTipoDocumento'] = 'Elige el tipo de documento.';

    // El API normaliza el número a dígitos y exige entre 6 y 15, igual que el alta.
    const digitos = (this.formularioResponsable.responsableNumeroDocumento ?? '').replace(/\D/g, '');
    if (digitos.length < 6 || digitos.length > 15) errores['responsableNumeroDocumento'] = 'El número de documento debe tener entre 6 y 15 dígitos.';

    this.erroresResponsable.set(errores);
    if (Object.keys(errores).length > 0) {
      this.errorResponsable.set('Revisa los campos marcados.');
      return;
    }

    const solicitud: ResponsableOrganizacionSolicitud = {
      responsableNombre: this.formularioResponsable.responsableNombre.trim(),
      // El catálogo guarda 'cc' en minúscula y las filas existentes guardan 'CC'; el API compara en
      // minúscula, así que se envía en minúscula y no se discute.
      responsableTipoDocumento: this.formularioResponsable.responsableTipoDocumento.toLowerCase(),
      responsableNumeroDocumento: digitos,
      responsableTelefono: vacioANulo(this.formularioResponsable.responsableTelefono),
    };

    this.guardandoResponsable.set(true);
    this.api.guardarResponsable(this.organizacionId(), solicitud).subscribe({
      next: actualizado => {
        this.guardandoResponsable.set(false);
        this.responsable.set(actualizado);
        this.sinResponsable.set(false);
        this.editandoResponsable.set(false);
        this.mensajeResponsable.set('Los datos de la persona responsable quedaron guardados.');
        this.enfocar('[data-testid="responsable-editar"]');
      },
      error: (fallo: FalloDelServidor) => {
        this.guardandoResponsable.set(false);
        const traducido = traducirErrorDelServidor(fallo, {
          camposConLugar: ['responsableNombre', 'responsableTipoDocumento', 'responsableNumeroDocumento'],
          alternativa: 'No fue posible guardar la persona responsable.',
        });
        this.erroresResponsable.set(traducido.campos);
        this.errorResponsable.set(traducido.general);
      },
    });
  }

  /** Lleva el foco a donde acaba de aparecer la pantalla nueva. Mismo ayudante que en Organización. */
  private enfocar(selector: string): void {
    setTimeout(() => {
      const destino = this.host.nativeElement.querySelector<HTMLElement>(selector);
      if (!destino) return;
      destino.focus();
      destino.scrollIntoView?.({ block: 'nearest' });
    });
  }
}
