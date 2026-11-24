import { EventosQueSeArchivanService } from './eventos-que-se-archivan.service';

describe('EventosQueSeArchivanService.frase', () => {
  it('dice cuántos eventos se archivan y cuántos están publicados', () => {
    const frase = EventosQueSeArchivanService.frase({ tipo: 'taller', procesoId: 1, total: 3, publicados: 2 });
    expect(frase).toContain('Se archivarán 3 eventos de la Agenda');
    expect(frase).toContain('2 están publicados');
    expect(frase).toContain('nada se borra');
  });

  it('habla en singular y cuando no hay ninguno', () => {
    expect(EventosQueSeArchivanService.frase({ tipo: 'red', procesoId: 1, total: 1, publicados: 1 })).toContain('1 evento de la Agenda');
    expect(EventosQueSeArchivanService.frase({ tipo: 'red', procesoId: 1, total: 0, publicados: 0 })).toContain('no tiene eventos vivos');
  });
});
