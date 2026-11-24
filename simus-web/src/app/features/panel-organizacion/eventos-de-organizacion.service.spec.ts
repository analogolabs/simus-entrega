import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { EventosDeOrganizacionService } from './eventos-de-organizacion.service';

/**
 * La dirección de los eventos de quien anuncia (LUT-01): con organización, la de ella; sin ella, la de la
 * persona en «Mi espacio». Las mismas operaciones, con las mismas reglas.
 */
describe('EventosDeOrganizacionService', () => {
  let api: jasmine.SpyObj<ApiClientService>;
  let servicio: EventosDeOrganizacionService;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiClientService>('ApiClientService', ['get', 'post', 'put']);
    api.get.and.callFake(((url: string) => of(url.endsWith('/csrf') ? { requestToken: 'testigo' } : [])) as never);
    api.post.and.returnValue(of({ id: '1', estado: 'archivado' }) as never);
    api.put.and.returnValue(of({ id: '1', estado: 'publicado' }) as never);
    TestBed.configureTestingModule({ providers: [{ provide: ApiClientService, useValue: api }] });
    servicio = TestBed.inject(EventosDeOrganizacionService);
  });

  const urls = (espia: jasmine.Spy) => espia.calls.allArgs().map(argumentos => argumentos[0] as string);

  it('una organización usa las direcciones de su organización', () => {
    servicio.procesosQueEnmarcan('117').subscribe();
    servicio.eventosDeLaOrganizacion('117').subscribe();
    servicio.evento('117', '9').subscribe();
    servicio.historial('117', '9').subscribe();
    servicio.retirarEvento('117', '9', 'Motivo').subscribe();

    expect(urls(api.get)).toContain('/api/v1/externo/organizaciones/117/procesos-que-enmarcan');
    expect(urls(api.get)).toContain('/api/v1/externo/organizaciones/117/eventos');
    expect(urls(api.get)).toContain('/api/v1/externo/organizaciones/117/eventos/9');
    expect(urls(api.get)).toContain('/api/v1/externo/organizaciones/117/eventos/9/historial');
    expect(urls(api.post)).toEqual(['/api/v1/externo/organizaciones/117/eventos/9/retirar']);
  });

  it('una persona sin organización usa «Mis eventos», con el mismo testigo antifalsificación', () => {
    servicio.procesosQueEnmarcan('').subscribe();
    servicio.eventosDeLaOrganizacion('').subscribe();
    servicio.evento('', '9').subscribe();
    servicio.historial('', '9').subscribe();
    servicio.anunciarEvento('', { titulo: 'T', descripcion: 'D', fechaInicio: '2026-12-01', modalidad: 'presencial', tallerId: 3 }).subscribe();
    servicio.editarEvento('', '9', { titulo: 'T', descripcion: 'D', fechaInicio: '2026-12-01', modalidad: 'presencial', tallerId: 3 }).subscribe();
    servicio.enviarARevision('', '9').subscribe();
    servicio.cancelarEvento('', '9', 'Motivo').subscribe();
    servicio.retirarEvento('', '9', 'Motivo').subscribe();

    expect(urls(api.get)).toContain('/api/v1/externo/mis-eventos/procesos-que-enmarcan');
    expect(urls(api.get)).toContain('/api/v1/externo/mis-eventos');
    expect(urls(api.get)).toContain('/api/v1/externo/mis-eventos/9');
    expect(urls(api.get)).toContain('/api/v1/externo/mis-eventos/9/historial');
    expect(urls(api.post)).toEqual([
      '/api/v1/externo/mis-eventos',
      '/api/v1/externo/mis-eventos/9/enviar',
      '/api/v1/externo/mis-eventos/9/cancelar',
      '/api/v1/externo/mis-eventos/9/retirar',
    ]);
    expect(urls(api.put)).toEqual(['/api/v1/externo/mis-eventos/9']);
    // EL TESTIGO ES EL DEL CANAL EXTERNO: uno solo, no uno por tipo de anunciante.
    expect(urls(api.get).filter(url => url.endsWith('/csrf')).every(url => url === '/api/v1/externo/organizaciones/csrf')).toBeTrue();
  });
});
