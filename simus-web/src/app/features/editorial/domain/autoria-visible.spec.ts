import { partirAutoria } from './autoria-visible';

describe('partirAutoria', () => {
  it('una sola persona', () => {
    expect(partirAutoria('Ana Restrepo')).toEqual({ nombres: ['Ana Restrepo'], resto: null });
  });

  it('varios nombres separados por punto y coma', () => {
    expect(partirAutoria('Ana Restrepo; Luis Franco')).toEqual({ nombres: ['Ana Restrepo', 'Luis Franco'], resto: null });
  });

  it('separa la cola «y N más» del último nombre, porque no es un nombre', () => {
    expect(partirAutoria('A; B; C y 36 más')).toEqual({ nombres: ['A', 'B', 'C'], resto: 'y 36 más' });
  });

  it('un nombre con coma dentro no se parte', () => {
    expect(partirAutoria('Franco, Luis Fernando')).toEqual({ nombres: ['Franco, Luis Fernando'], resto: null });
  });

  it('vacío o ausente no da nombres', () => {
    expect(partirAutoria('')).toEqual({ nombres: [], resto: null });
    expect(partirAutoria(null)).toEqual({ nombres: [], resto: null });
  });
});
