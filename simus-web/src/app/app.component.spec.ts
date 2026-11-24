import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideRouter } from '@angular/router';
import { ExternalSessionService } from './core/services/external-session.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should identify the SIMUS application`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('SIMUS');
  });

  it('should render the application shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    // UI-G: el armazón de la aplicación ya no pone el <main>; lo pone cada armazón de pantalla.
    expect(compiled.querySelector('main')).toBeNull();
    expect(compiled.querySelector('a[href="#contenido-principal"]')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  describe('la sesión externa (DAT-01)', () => {
    let direccionOriginal: string;
    let consulta: jasmine.Spy;

    beforeEach(() => {
      direccionOriginal = window.location.pathname + window.location.search;
      // SE ESPÍA EL MÉTODO DEL SERVICIO REAL y no se sustituye el servicio: la plantilla lee muchos
      // más miembros de él, y un doble a medias rompería el armazón por algo que no es lo probado.
      consulta = spyOn(TestBed.inject(ExternalSessionService), 'cargarUnaVez');
    });

    afterEach(() => window.history.replaceState({}, '', direccionOriginal));

    it('en la consola no pregunta por la sesión externa: respondería 401 a un funcionario y se vería como error', () => {
      window.history.replaceState({}, '', '/administracion/resumen');
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      TestBed.flushEffects();

      expect(consulta).not.toHaveBeenCalled();
    });

    it('en una página pública sí pregunta, una sola vez por carga', () => {
      window.history.replaceState({}, '', '/noticias');
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      TestBed.flushEffects();

      expect(consulta).toHaveBeenCalledTimes(1);
    });
  });
});
