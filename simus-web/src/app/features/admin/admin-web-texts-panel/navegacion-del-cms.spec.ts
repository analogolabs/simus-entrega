import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminWebTextsPanelComponent } from './admin-web-texts-panel.component';
import { WEB_TEXT_GROUPS, WEB_TEXT_SECTIONS } from '../../../core/services/textos-web.service';

describe('CMS · navegación por páginas y bloques', () => {
  let fixture: ComponentFixture<AdminWebTextsPanelComponent>;
  let component: AdminWebTextsPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AdminWebTextsPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(AdminWebTextsPanelComponent);
    component = fixture.componentInstance;
    component._enabled.set(true);
    component.vistaEncendida.set(false);
    fixture.detectChanges();
  });

  it('el índice lista cada página del registro con sus bloques', () => {
    const indice = component.indiceDelSitio();
    expect(indice.map(p => p.section)).toEqual(WEB_TEXT_SECTIONS.map(s => s.section));
    const totalBloques = indice.reduce((suma, p) => suma + p.bloques.length, 0);
    expect(totalBloques).toBe(WEB_TEXT_GROUPS.length);
  });

  it('la agenda es una página editable del CMS', () => {
    expect(component.indiceDelSitio().some(p => p.section === 'Agenda' && p.bloques.length >= 2)).toBeTrue();
  });

  it('ir a un bloque cambia de página y lo abre', () => {
    component.irAlBloque('Agenda', 'agenda_listado');
    expect(component.selectedSection()).toBe('Agenda');
    expect(component.selectedGroup()).toBe('agenda_listado');
    expect(component.bloqueAbierto()).toBe('agenda_listado');
  });

  it('sin nada cargado del servidor no hay cambios sin guardar', () => {
    expect(component.totalSinGuardar()).toBe(0);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="estado-sin-guardar"]')?.textContent).toContain('guardado');
  });

  it('un campo distinto de lo guardado cuenta como cambio sin guardar y se avisa al salir', () => {
    component.originalDetails.set({ agenda_events_title: { content: 'Eventos' } });
    (component as unknown as { loadedGroups: Set<string> }).loadedGroups.add('agenda_listado');
    component.handleInputChange('agenda_events_title', 'Todos los eventos');
    expect(component.camposSinGuardarDe('agenda_listado')).toBe(1);
    expect(component.totalSinGuardar()).toBe(1);

    const evento = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.avisarAntesDeSalir(evento);
    expect(evento.defaultPrevented).toBeTrue();

    component.handleInputChange('agenda_events_title', 'Eventos');
    expect(component.totalSinGuardar()).toBe(0);
  });

  it('el bloque siguiente avanza en el orden del índice', () => {
    component.irAlBloque('Portada', 'home_hero');
    component.irAlBloqueContiguo(1);
    expect(component.selectedGroup()).toBe('home_about');
  });

  it('el menú agrupa las páginas por área y refleja las páginas reales del portal', () => {
    const areas = component.indicePorAreas();
    expect(areas.map(a => a.area)).toEqual([
      'Inicio', 'El Plan', 'Ecosistema y directorios', 'Contenidos', 'Mapa', 'Suscripción y cuenta', 'En todas las páginas',
    ]);
    const paginas = areas.flatMap(a => a.paginas.map(p => p.section));
    for (const pagina of [
      'Portada', 'PNMC', 'Celebra la Música', 'Festivales', 'Mercados musicales', 'Lutería', 'Espacios en vivo',
      'Redes y documentación', 'Territorios sonoros', 'Prácticas musicales', 'Agentes y actores', 'Agenda de citas',
      'Noticias', 'Agenda', 'Editorial', 'Galería', 'Mapa ecosistémico', 'Sobre el mapa', 'Boletín', 'Políticas', 'Registro', 'Barra y pie',
    ]) {
      expect(paginas).withContext(pagina).toContain(pagina);
    }
    // Las páginas que ya no existen como tales (Sobre PNMC, Ejes y Estrategias se reunieron en /pnmc).
    for (const vieja of ['Home', 'Sobre PNMC', 'Ejes', 'Estrategias', 'Acceso externo', 'Navegación y Footer']) {
      expect(paginas).withContext(vieja).not.toContain(vieja);
    }
  });

  it('el título de la portada se escribe en una sola parte', () => {
    const claves = WEB_TEXT_GROUPS.find(g => g.id === 'home_hero')!.fields.map(f => f.key);
    expect(claves).toContain('home_title');
    expect(claves.some(k => k.endsWith('_accent'))).toBeFalse();
    expect(WEB_TEXT_GROUPS.flatMap(g => g.fields).some(f => f.key.endsWith('_accent'))).toBeFalse();
  });
});

describe('CMS · «Imágenes del sitio» con la misma estructura que «Textos y páginas»', () => {
  let fixture: ComponentFixture<AdminWebTextsPanelComponent>;
  let component: AdminWebTextsPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AdminWebTextsPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(AdminWebTextsPanelComponent);
    fixture.componentRef.setInput('modo', 'imagenes');
    component = fixture.componentInstance;
    component._enabled.set(true);
    component.vistaEncendida.set(false);
    fixture.detectChanges();
  });

  it('solo lista las páginas y los bloques que tienen alguna imagen administrable', () => {
    const indice = component.indiceDelSitio();
    expect(indice.length).toBeGreaterThan(0);
    for (const pagina of indice) {
      for (const bloque of pagina.bloques) {
        expect(component.imagenesDelBloque(bloque.id).length).withContext(bloque.id).toBeGreaterThan(0);
      }
    }
    expect(indice.map(p => p.section)).toContain('Portada');
    expect(indice.map(p => p.section)).not.toContain('Agenda de citas');
  });

  it('abre en la primera página con fotos y el centro enseña solo las imágenes, sin campos de texto', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    expect(component.selectedSection()).toBe(component.indiceDelSitio()[0].section);
    expect(raiz.querySelector('app-bloque-de-imagenes')).not.toBeNull();
    expect(raiz.querySelector('input[id^="campo-"], textarea[id^="campo-"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="guardar-borrador"], #guardar-borrador')).toBeNull();
    expect(raiz.querySelector('[data-testid="live-preview"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="buscador-de-textos"]')).toBeNull();
  });

  it('cambiar de página conserva el contexto: abre su primer bloque con fotos', () => {
    component.selectPill('Noticias');
    expect(component.selectedSection()).toBe('Noticias');
    expect(component.filteredGroups().map(g => g.id)).toEqual(['noticias_textos']);
    expect(component.bloqueAbierto()).toBe('noticias_textos');
  });
});
