import { destinoSeguroTrasEntrar, organizacionDeLaUrl, rutaDelPanel, seccionDeLaUrl, urlDelPanel } from './rutas-de-gestion';

describe('rutas de Gestión', () => {
  it('construye las direcciones del panel con la organización delante', () => {
    expect(rutaDelPanel('117', 'procesos/festivales', 92)).toEqual(['/gestion/o', '117', 'procesos', 'festivales', '92']);
    expect(urlDelPanel('117', 'resumen')).toBe('/gestion/o/117/resumen');
  });

  it('lee la organización de la dirección, y nada fuera del panel', () => {
    expect(organizacionDeLaUrl('/gestion/o/1117/procesos?x=1')).toBe('1117');
    expect(organizacionDeLaUrl('/gestion/o/7')).toBe('7');
    expect(organizacionDeLaUrl('/gestion/cuenta')).toBeNull();
    expect(organizacionDeLaUrl('/gestion/resumen')).toBeNull();
  });

  it('al cambiar de organización conserva la sección, no el registro ni el asistente', () => {
    expect(seccionDeLaUrl('/gestion/o/1/procesos')).toBe('procesos');
    expect(seccionDeLaUrl('/gestion/o/1/procesos/festivales/92?seccion=historial')).toBe('procesos/festivales');
    expect(seccionDeLaUrl('/gestion/o/1/procesos/festivales/nuevo')).toBe('procesos/festivales');
    expect(seccionDeLaUrl('/gestion/o/1/procesos/mercados/4')).toBe('procesos/mercados');
    expect(seccionDeLaUrl('/gestion/o/1/equipo#invitar')).toBe('equipo');
    expect(seccionDeLaUrl('/gestion/o/1')).toBe('resumen');
  });

  it('tras ingresar solo vuelve a direcciones de Gestión de este sitio: no es una redirección abierta', () => {
    expect(destinoSeguroTrasEntrar('/gestion/o/7/procesos/festivales/92?seccion=informacion')).toBe('/gestion/o/7/procesos/festivales/92?seccion=informacion');
    expect(destinoSeguroTrasEntrar('/gestion/cuenta/perfil-publico')).toBe('/gestion/cuenta/perfil-publico');
    expect(destinoSeguroTrasEntrar('/gestion')).toBe('/gestion');
    expect(destinoSeguroTrasEntrar('//malo.example/gestion')).toBeNull();
    expect(destinoSeguroTrasEntrar('https://malo.example/gestion')).toBeNull();
    expect(destinoSeguroTrasEntrar('/gestionx')).toBeNull();
    expect(destinoSeguroTrasEntrar('/administracion')).toBeNull();
    expect(destinoSeguroTrasEntrar('/gestion/\\malo')).toBeNull();
    expect(destinoSeguroTrasEntrar(null)).toBeNull();
  });
});
