import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SeccionPerfilPublicoComponent } from './seccion-perfil-publico.component';
import { MiPerfilPublico, PerfilPublicoService } from '../../core/services/perfil-publico.service';
import { PracticasMusicalesService } from '../../core/services/practicas-musicales.service';
import { AdminService } from '../../core/services/admin.service';
import { DirectorioDePersonasService } from '../../core/services/directorio-de-personas.service';

/**
 * «Perfil público» en /gestion: nace oculto, se publica solo aceptando el texto servido y
 * ocultarlo es retirar la autorización.
 */
const BASE: MiPerfilPublico = {
  existe: true, clave: 'abc', nombreVisible: 'Lucía', idsPracticas: [], codigoMunicipio: null,
  archivoFotoId: null, fotoUrl: null, enlaces: [], autorizacionVigente: false,
  ocultoPorModeracion: false, motivoModeracion: null, visible: false, organizaciones: [],
};

describe('SeccionPerfilPublicoComponent', () => {
  let fixture: ComponentFixture<SeccionPerfilPublicoComponent>;
  let servicio: jasmine.SpyObj<PerfilPublicoService>;

  async function montar(perfil: MiPerfilPublico): Promise<HTMLElement> {
    servicio = jasmine.createSpyObj<PerfilPublicoService>('PerfilPublicoService', ['mio', 'politica', 'guardar', 'publicar', 'ocultar', 'subirFoto', 'historial']);
    servicio.mio.and.returnValue(of(perfil));
    servicio.politica.and.returnValue(of({ clave: 'perfil_publico', version: '2026-11-05', titulo: 'Autorización para publicar mi perfil público', texto: 'Texto servido.' }));
    servicio.publicar.and.returnValue(of({ ...perfil, autorizacionVigente: true, visible: true }));
    servicio.ocultar.and.returnValue(of({ ...perfil, autorizacionVigente: false, visible: false }));
    servicio.historial.and.returnValue(of([{ fecha: '2026-11-12T10:00:00Z', campo: 'Biografía corta', anterior: null, nuevo: 'Maestra de marimba.' }]));
    servicio.guardar.and.callFake(cambios => of({ ...perfil, ...cambios } as MiPerfilPublico));
    await TestBed.configureTestingModule({
      imports: [SeccionPerfilPublicoComponent],
      providers: [
        provideRouter([]),
        { provide: PerfilPublicoService, useValue: servicio },
        { provide: PracticasMusicalesService, useValue: { listar: () => of([]) } },
        { provide: DirectorioDePersonasService, useValue: { taxonomia: () => of({ roles: [], servicios: [], instrumentos: [], maximoDeRoles: 6, maximoDeServicios: 8, maximoDeInstrumentos: 8, maximoDeTerritorios: 10 }), mia: () => of({ existe: true, roles: [], servicios: [], instrumentos: [], codigosDeDepartamento: [], pendiente: true }) } },
        { provide: AdminService, useValue: { cargarDivipolaPublica: () => of([]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SeccionPerfilPublicoComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('nace oculto y no publica sin marcar la autorización', async () => {
    const raiz = await montar(BASE);
    expect(raiz.querySelector('[data-estado="oculto"]')).not.toBeNull();
    expect(raiz.textContent).toContain('Texto servido.');

    const publicar = Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.includes('Publicar mi perfil'))!;
    publicar.click();
    fixture.detectChanges();
    expect(servicio.publicar).not.toHaveBeenCalled();
    expect(raiz.textContent).toContain('Marca la casilla');
  });

  it('publica aceptando la versión del texto que se leyó', async () => {
    const raiz = await montar(BASE);
    fixture.componentInstance.acepta = true;
    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.includes('Publicar mi perfil'))!.click();
    fixture.detectChanges();
    expect(servicio.publicar).toHaveBeenCalledWith('2026-11-05');
    expect(raiz.querySelector('[data-estado="visible"]')).not.toBeNull();
  });

  it('visible: ofrece verlo y ocultarlo, y ocultar retira la autorización', async () => {
    const raiz = await montar({ ...BASE, autorizacionVigente: true, visible: true });
    expect(raiz.querySelector('a[href="/ecosistema/personas/abc"]')).not.toBeNull();
    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.includes('Ocultar mi perfil'))!.click();
    fixture.detectChanges();
    expect(servicio.ocultar).toHaveBeenCalled();
    expect(raiz.querySelector('[data-estado="oculto"]')).not.toBeNull();
  });

  it('oculto por moderación muestra el motivo', async () => {
    const raiz = await montar({ ...BASE, autorizacionVigente: true, ocultoPorModeracion: true, motivoModeracion: 'Enlace no relacionado.' });
    expect(raiz.querySelector('[data-estado="moderado"]')?.textContent).toContain('Enlace no relacionado.');
  });

  it('rechaza enlaces que no son direcciones antes de enviar, con el mensaje de la regla única', async () => {
    await montar(BASE);
    fixture.componentInstance.formulario.enlaces = [{ red: 'otro', url: '@usuario' }];
    fixture.componentInstance.guardar();
    fixture.detectChanges();
    expect(servicio.guardar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errores()['enlaces']).toContain('enlaces señalados');
  });

  it('un enlace sin esquema se acepta y viaja con https:// (la misma regla que el servidor)', async () => {
    await montar(BASE);
    fixture.componentInstance.formulario.enlaces = [{ red: 'otro', url: 'www.miperfil.example.org', etiqueta: ' Mi sitio ' }, { red: 'youtube', url: 'youtube.com/@a', etiqueta: 'ignorada' }];
    fixture.componentInstance.guardar();
    const enviado = servicio.guardar.calls.mostRecent().args[0];
    expect(enviado.enlaces).toEqual(['https://www.miperfil.example.org', 'https://youtube.com/@a']);
    // El rótulo solo lo lleva «otro», recortado; las redes conocidas no.
    expect(enviado.etiquetasDeEnlaces).toEqual(['Mi sitio', null]);
  });

  // ───────────────────────── un solo guardado que incluye la foto ─────────────────────────

  function elegirFotoPendiente(raiz: HTMLElement): File {
    const archivo = new File(['x'], 'foto.png', { type: 'image/png' });
    const entrada = raiz.querySelector<HTMLInputElement>('#perfil-foto')!;
    Object.defineProperty(entrada, 'files', { value: [archivo] });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return archivo;
  }

  it('elegir una foto NO la sube: queda como vista previa hasta guardar', async () => {
    const raiz = await montar(BASE);
    elegirFotoPendiente(raiz);

    expect(servicio.subirFoto).not.toHaveBeenCalled();
    expect(raiz.querySelector('[data-foto-pendiente]')).not.toBeNull();
    expect(raiz.querySelector('[data-cambios-sin-guardar]')).not.toBeNull();
    expect(fixture.componentInstance.avisoAlSalir()).toContain('no guardaste');
  });

  it('«Guardar perfil» sube la foto y guarda el perfil con ella, en una sola acción', async () => {
    const raiz = await montar(BASE);
    servicio.subirFoto.and.returnValue(of({ id: 9, url: '/archivos/9' }));
    const archivo = elegirFotoPendiente(raiz);
    fixture.componentInstance.fotoAlt = 'Retrato de Lucía';

    fixture.componentInstance.guardar();

    expect(servicio.subirFoto).toHaveBeenCalledWith(archivo, 'Retrato de Lucía');
    expect(servicio.guardar.calls.mostRecent().args[0].archivoFotoId).toBe(9);
    expect(fixture.componentInstance.avisoAlSalir()).toBeNull();
  });

  it('la foto pide su descripción antes de subirse, junto al campo', async () => {
    const raiz = await montar(BASE);
    elegirFotoPendiente(raiz);

    fixture.componentInstance.guardar();
    fixture.detectChanges();

    expect(servicio.subirFoto).not.toHaveBeenCalled();
    expect(raiz.querySelector('#perfil-foto-alt-error')?.textContent).toContain('Describe la imagen');
  });

  it('«Publicar» con la foto sin guardar la guarda ANTES de publicar: ya no se publica sin ella', async () => {
    const raiz = await montar(BASE);
    servicio.subirFoto.and.returnValue(of({ id: 9, url: '/archivos/9' }));
    elegirFotoPendiente(raiz);
    fixture.componentInstance.fotoAlt = 'Retrato de Lucía';
    fixture.componentInstance.acepta = true;
    const orden: string[] = [];
    servicio.guardar.and.callFake(cambios => { orden.push('guardar'); return of({ ...BASE, ...cambios }); });
    servicio.publicar.and.callFake(() => { orden.push('publicar'); return of({ ...BASE, autorizacionVigente: true, visible: true }); });

    fixture.componentInstance.publicar();

    expect(orden).toEqual(['guardar', 'publicar']);
    expect(servicio.guardar.calls.mostRecent().args[0].archivoFotoId).toBe(9);
  });

  it('el aviso de éxito de guardar aparece junto al botón, no arriba de la pantalla', async () => {
    const raiz = await montar(BASE);

    fixture.componentInstance.guardar();
    fixture.detectChanges();

    expect(raiz.querySelector('form [data-aviso-de-guardado]')?.textContent).toContain('quedó guardado');
  });

  it('un error de guardado vuelve con el nombre de la persona, no el del campo interno', async () => {
    await montar(BASE);
    servicio.guardar.and.returnValue(throwError(() => ({ status: 400, message: 'x', payload: { errors: { enlaces: ['Escribe una dirección web completa.'] } } })));
    fixture.componentInstance.formulario.enlaces = [{ red: 'otro', url: 'www.ok.example.org' }];

    fixture.componentInstance.guardar();

    expect(fixture.componentInstance.errores()['enlaces']).toBe('Escribe una dirección web completa.');
  });

  // ───────────────────────── Perfil enriquecido (ME, PR 2) ─────────────────────────

  it('guarda biografías, oficios, portafolio, organizaciones elegidas y visibilidad en una sola petición', async () => {
    await montar({ ...BASE, organizaciones: [{ id: 7, nombre: 'Gaitas del Norte' }] });
    const c = fixture.componentInstance;
    c.formulario.biografiaCorta = ' Maestra de marimba. ';
    c.formulario.biografiaLarga = 'Enseño marimba.';
    c.nuevoOficio = 'Cantadora';
    c.anadirOficio();
    c.formulario.portafolio = [{ tipo: 'audio', titulo: 'Currulao', url: 'musica.example.org/c', descripcion: ' Grabación de campo ', anio: 2024 }];
    c.alternarOrganizacion(7, true);
    c.visibilidadElegida = 'solo_simus';

    c.guardar();

    const enviado = servicio.guardar.calls.mostRecent().args[0];
    expect(enviado.biografiaCorta).toBe('Maestra de marimba.');
    expect(enviado.oficios).toEqual(['Cantadora']);
    expect(enviado.portafolio).toEqual([{ tipo: 'audio', titulo: 'Currulao', url: 'https://musica.example.org/c', descripcion: 'Grabación de campo', anio: 2024 }]);
    expect(enviado.idsOrganizaciones).toEqual([7]);
    expect(enviado.visibilidad).toBe('solo_simus');
  });

  it('los oficios no se repiten ni pasan del máximo', async () => {
    await montar(BASE);
    const c = fixture.componentInstance;
    for (const oficio of ['Maestra', 'maestra', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) { c.nuevoOficio = oficio; c.anadirOficio(); }
    expect(c.formulario.oficios.length).toBe(c.maximoDeOficios);
    expect(c.formulario.oficios.filter(o => o.toLowerCase() === 'maestra').length).toBe(1);
  });

  it('elegir «oculto» en un perfil publicado guarda y luego retira la autorización', async () => {
    await montar({ ...BASE, autorizacionVigente: true, visible: true });
    const c = fixture.componentInstance;
    c.visibilidadElegida = 'oculto';
    c.guardar();
    expect(servicio.guardar).toHaveBeenCalled();
    expect(servicio.ocultar).toHaveBeenCalled();
  });

  it('la vista previa muestra lo escrito, solo con las organizaciones elegidas', async () => {
    await montar({ ...BASE, organizaciones: [{ id: 7, nombre: 'Gaitas del Norte' }, { id: 8, nombre: 'Otra' }] });
    const c = fixture.componentInstance;
    c.formulario.nombreVisible = 'Lucía Gaitera';
    c.alternarOrganizacion(7, true);
    expect(c.inicialesDeLaVistaPrevia()).toBe('LG');
    expect(c.organizacionesDeLaVistaPrevia()).toEqual(['Gaitas del Norte']);
  });

  it('marcar «mostrar mi nombre civil» lo refleja en la vista previa y viaja al guardar', async () => {
    const raiz = await montar({ ...BASE, nombreCivilPropio: 'Rosa Elena Caicedo', nombreCivilVisible: false });
    expect(raiz.querySelector('[data-vp-civil]')).toBeNull();

    const casilla = raiz.querySelector('#perfil-nombre-civil') as HTMLInputElement;
    casilla.click();
    fixture.detectChanges();
    expect(raiz.querySelector('[data-vp-civil]')?.textContent).toContain('Rosa Elena Caicedo');

    fixture.componentInstance.guardar();
    expect(servicio.guardar).toHaveBeenCalledWith(jasmine.objectContaining({ nombreCivilVisible: true }));
  });

  it('sin nombre civil en la cuenta la casilla se apaga y manda a Datos personales, en vez de no hacer nada', async () => {
    const raiz = await montar({ ...BASE, nombreCivilPropio: null });
    expect((raiz.querySelector('#perfil-nombre-civil') as HTMLInputElement).disabled).toBeTrue();
    expect(raiz.querySelector('[data-nombre-civil-ausente] a')?.getAttribute('href')).toBe('/gestion/cuenta/datos');
  });

  it('el historial se pide al abrirlo y se lee en palabras', async () => {
    const raiz = await montar(BASE);
    fixture.componentInstance.cargarHistorial();
    fixture.detectChanges();
    expect(servicio.historial).toHaveBeenCalled();
    expect(raiz.textContent).toContain('Biografía corta');
    expect(fixture.componentInstance.resumenDeCambio('["Maestra","Cantadora"]')).toBe('Maestra, Cantadora');
    expect(fixture.componentInstance.resumenDeCambio(null)).toBe('vacío');
  });
});
