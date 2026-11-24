import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { RouterTestingHarness } from '@angular/router/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { consultaRecordadaDelDirectorio, recordarConsultaDelDirectorio } from '../../../../core/services/directorio-de-personas.service';
import { PerfilPublicoPageComponent } from './perfil-publico-page.component';
import { DirectorioDePersonasService } from '../../../../core/services/directorio-de-personas.service';
import { PerfilPublico, PerfilPublicoService } from '../../../../core/services/perfil-publico.service';

/**
 * La página pública del perfil de una persona.
 *
 * Pinta solo lo que trae el DTO público; si el servidor dice 404 —perfil inexistente u oculto, que
 * para el público son lo mismo— dice «no disponible» sin distinguir entre los dos.
 */
const PERFIL: PerfilPublico = {
  clave: '0f8fad5b-d9cb-469f-a165-70867728950e',
  nombreVisible: 'Lucía la gaitera',
  practicas: [{ id: 1, nombre: 'Música andina colombiana', slug: 'musica-andina' }],
  municipio: 'Medellín',
  departamento: 'Antioquia',
  fotoUrl: null,
  fotoTextoAlternativo: null,
  enlaces: ['https://www.gaita.example.org/lucia'],
  organizaciones: [{ id: 7, nombre: 'Corporación Gaitas del Norte' }],
};

describe('PerfilPublicoPageComponent', () => {
  async function montar(respuesta: Observable<PerfilPublico>): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [PerfilPublicoPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ clave: PERFIL.clave })) } },
        { provide: PerfilPublicoService, useValue: { consultar: () => respuesta } },
        { provide: DirectorioDePersonasService, useValue: { similares: () => throwError(() => new Error('sin similares')), taxonomia: () => of({ roles: [], servicios: [], instrumentos: [], maximoDeRoles: 6, maximoDeServicios: 8, maximoDeInstrumentos: 8, maximoDeTerritorios: 10 }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PerfilPublicoPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('pinta nombre, municipio, prácticas, organizaciones y enlaces', async () => {
    const raiz = await montar(of(PERFIL));
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('Lucía la gaitera');
    expect(texto).toContain('Medellín, Antioquia');
    expect(texto).toContain('Música andina colombiana');

    const organizacion = Array.from(raiz.querySelectorAll('a')).find(a => a.textContent?.includes('Corporación Gaitas del Norte'));
    expect(organizacion?.getAttribute('href')).toBe('/ecosistema/organizaciones/7');

    const enlace = raiz.querySelector<HTMLAnchorElement>('a[href="https://www.gaita.example.org/lucia"]');
    expect(enlace).not.toBeNull();
    expect(enlace!.textContent).toContain('gaita.example.org');
    expect(enlace!.rel).toContain('noopener');
    expect(enlace!.rel).toContain('nofollow');
  });

  it('pinta el nombre civil, las biografías, los oficios y el portafolio cuando el perfil los trae', async () => {
    const raiz = await montar(of({
      ...PERFIL,
      nombreCivil: 'Lucía Pérez',
      biografiaCorta: 'Gaitera desde niña.',
      biografiaLarga: 'Aprendí la gaita con mi abuelo.',
      oficios: ['Maestra', 'Cantadora'],
      portafolio: [{ tipo: 'audio', titulo: 'Currulao', url: 'https://musica.example.org/currulao' }],
    }));
    expect(raiz.querySelector('[data-nombre-civil]')?.textContent).toContain('Lucía Pérez');
    expect(raiz.querySelector('[data-nombre-civil]')?.textContent).not.toMatch(/nombre civil/i);
    expect(raiz.querySelector('[data-biografia-corta]')?.textContent).toContain('Gaitera desde niña.');
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('Aprendí la gaita con mi abuelo.');
    expect(texto).toContain('Cantadora');
    const item = raiz.querySelector<HTMLAnchorElement>('a[href="https://musica.example.org/currulao"]');
    expect(item?.textContent).toContain('Currulao');
    expect(item?.textContent).toContain('Audio');
    expect(item?.rel).toContain('noopener');
  });

  it('sin lo enriquecido no pinta secciones vacías', async () => {
    const raiz = await montar(of(PERFIL));
    expect(raiz.querySelector('[data-nombre-civil]')).toBeNull();
    expect(raiz.textContent).not.toContain('Biografía');
    expect(raiz.textContent).not.toContain('Portafolio');
  });

  it('sin foto muestra iniciales decorativas, no una imagen sin alternativa', async () => {
    const raiz = await montar(of(PERFIL));
    expect(raiz.querySelector('img')).toBeNull();
    expect(raiz.querySelector('[data-iniciales]')?.textContent).toContain('LL');
  });

  it('un perfil oculto o inexistente se ve igual: «no disponible»', async () => {
    const raiz = await montar(throwError(() => ({ status: 404 })));
    // El «no encontrado» compartido: título, causa probable y salidas al ecosistema y al inicio.
    expect(raiz.textContent).toContain('Este perfil no está disponible');
    expect(raiz.querySelector('[data-testid="rne-lista"]')?.getAttribute('href')).toBe('/ecosistema/personas');
    expect(raiz.querySelector('[data-testid="rne-inicio"]')).not.toBeNull();
    expect(raiz.textContent).not.toContain('Lucía');
  });

  describe('de una persona a otra (perfiles similares)', () => {
    const OTRA: PerfilPublico = { ...PERFIL, clave: '1a2b3c4d-0000-4000-8000-000000000002', nombreVisible: 'Beto el tiplero', municipio: 'Cali', departamento: 'Valle del Cauca', organizaciones: [], practicas: [] };

    async function conRuta() {
      const consultadas: string[] = [];
      await TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: 'ecosistema/personas/:clave', component: PerfilPublicoPageComponent }]),
          { provide: PerfilPublicoService, useValue: { consultar: (clave: string) => { consultadas.push(clave); return of(clave === OTRA.clave ? OTRA : PERFIL); } } },
          { provide: DirectorioDePersonasService, useValue: { similares: () => throwError(() => new Error('x')), taxonomia: () => of({ roles: [], servicios: [], instrumentos: [], maximoDeRoles: 6, maximoDeServicios: 8, maximoDeInstrumentos: 8, maximoDeTerritorios: 10 }) } },
        ],
      }).compileComponents();
      const harness = await RouterTestingHarness.create();
      return { harness, consultadas };
    }

    it('al cambiar solo la clave, el MISMO componente muestra a la otra persona y cambia el título', async () => {
      const { harness, consultadas } = await conRuta();
      const primero = await harness.navigateByUrl(`/ecosistema/personas/${PERFIL.clave}`, PerfilPublicoPageComponent);
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('Lucía la gaitera');
      expect(TestBed.inject(Title).getTitle()).toContain('Lucía la gaitera');

      const segundo = await harness.navigateByUrl(`/ecosistema/personas/${OTRA.clave}`, PerfilPublicoPageComponent);
      harness.detectChanges();
      expect(segundo).toBe(primero); // Angular reutiliza el componente: antes se quedaba con la persona anterior.
      expect(harness.routeNativeElement?.textContent).toContain('Beto el tiplero');
      expect(harness.routeNativeElement?.textContent).not.toContain('Lucía la gaitera');
      expect(TestBed.inject(Title).getTitle()).toContain('Beto el tiplero');
      expect(consultadas).toEqual([PERFIL.clave, OTRA.clave]);
    });

    it('«Volver» lleva al directorio con la consulta guardada aunque se hayan recorrido varias personas', async () => {
      recordarConsultaDelDirectorio('servicio=clases&pagina=2');
      const { harness } = await conRuta();
      const ficha = await harness.navigateByUrl(`/ecosistema/personas/${PERFIL.clave}`, PerfilPublicoPageComponent);
      await harness.navigateByUrl(`/ecosistema/personas/${OTRA.clave}`, PerfilPublicoPageComponent);
      const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      ficha.volver();
      expect(navegar).toHaveBeenCalledWith('/ecosistema/personas?servicio=clases&pagina=2');
      recordarConsultaDelDirectorio('');
      expect(consultaRecordadaDelDirectorio()).toBe('');
    });
  });
});
