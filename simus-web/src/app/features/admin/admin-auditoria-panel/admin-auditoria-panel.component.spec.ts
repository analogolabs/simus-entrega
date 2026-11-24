import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminService, DetalleDeAuditoria } from '../../../core/services/admin.service';
import { FichaDeConsola } from '../domain/ficha-de-consola';
import { AdminAuditoriaPanelComponent } from './admin-auditoria-panel.component';

describe('AdminAuditoriaPanelComponent', () => {
  let fixture: ComponentFixture<AdminAuditoriaPanelComponent>;
  let component: AdminAuditoriaPanelComponent;
  let peticion: any;
  let detallePedido: string | null;

  const detalle: DetalleDeAuditoria = {
    actuacion: {
      id: '9', fecha: '2026-09-15T10:00:00Z', accion: 'actualizar', accionEtiqueta: 'Actualizó', grupo: 'festivales',
      grupoEtiqueta: 'Festivales', tabla: 'Festivales', registroId: '77', nombreRegistro: 'Festival del Río',
      autor: { id: '1', nombre: 'Autora', correo: 'autora@example.com' },
    },
    valoresAnteriores: { Nombre: 'Antes', Estado: 'borrador' },
    valoresNuevos: { Nombre: 'Después', Estado: 'borrador', Numero: '3' },
  };

  beforeEach(async () => {
    peticion = null;
    detallePedido = null;
    await TestBed.configureTestingModule({
      imports: [AdminAuditoriaPanelComponent],
      providers: [{ provide: AdminService, useValue: {
        cargarAuditoria: (opciones: any) => {
          peticion = opciones;
          return of({ total: 0, pagina: opciones.pagina, tamanoPagina: 25, grupos: [], acciones: [{ id: 'publicar', etiqueta: 'Publicó', total: 4 }, { id: 'iniciar_sesion', etiqueta: 'Inició sesión', total: 86 }], items: [], totalActuaciones: 81, totalAccesos: 86 });
        },
        cargarDetalleDeAuditoria: (id: string) => { detallePedido = id; return of(detalle); },
      } }],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminAuditoriaPanelComponent);
    component = fixture.componentInstance;
  });

  it('consulta la bitácora paginada al abrir', () => {
    fixture.detectChanges();
    // EL ORDEN VIAJA CON LA PETICION desde: la bitácora pagina, así
    // que ordenar la página cargada reordena veinticinco filas de miles. Abre por fecha
    // descendente, que es el mismo orden con el que responde el servidor si no se le pide otro.
    expect(peticion).toEqual({
      vista: 'actuaciones', grupo: 'todos', accion: undefined, q: undefined, desde: undefined, orden: 'fecha', direccion: 'desc', pagina: 1, tamano: 25,
    });
  });

  it('reinicia la página cuando cambia de grupo', () => {
    component.pagina.set(3);
    component.elegirGrupo('usuarios');
    expect(component.pagina()).toBe(1);
    expect(peticion.grupo).toBe('usuarios');
  });

  it('la acción es una lista que trae el servidor, con «Todas» delante, y filtra por el código', () => {
    // ERA UN CAMPO DE TEXTO para escribir «iniciar_sesion»: un vocabulario controlado pedido como
    // texto libre. La lista sale de la respuesta, con su recuento, y filtra por el verbo.
    fixture.detectChanges();
    expect(component.accionesDeLaBitacora().map(o => o.id)).toEqual(['todas', 'publicar']);
    expect(component.accionesDeLaBitacora()[1].conteo).toBe(4);

    component.pagina.set(2);
    component.elegirAccion('publicar');
    expect(peticion.accion).toBe('publicar');
    expect(peticion.pagina).toBe(1);

    component.elegirAccion('todas');
    expect(peticion.accion).toBeUndefined();
  });

  it('el periodo se pide como «desde» en ISO, y «todo» no lo manda', () => {
    component.elegirPeriodo('7');
    const desde = new Date(peticion.desde).getTime();
    expect(Date.now() - desde).toBeGreaterThan(6.9 * 86400000);
    expect(Date.now() - desde).toBeLessThan(7.1 * 86400000);

    component.elegirPeriodo('todo');
    expect(peticion.desde).toBeUndefined();
  });

  it('el buscador busca a la persona, no el verbo', () => {
    component.buscar('Autora');
    expect(peticion.q).toBe('Autora');
    expect(peticion.accion).toBeUndefined();
  });

  it('abrir una actuación trae lo que cambió, campo a campo, y marca lo que cambia', () => {
    // LA ACTUACIÓN SE ABRE POR LA DIRECCIÓN: abrir navega, y el armazón deja el
    // id en `FichaDeConsola`; aquí se hace lo que haría el armazón al cambiar la dirección.
    component.abrirDetalle(detalle.actuacion);
    TestBed.inject(FichaDeConsola).fijar('9');
    fixture.detectChanges();

    expect(detallePedido).toBe('9');
    // LA UNION DE ANTES Y DESPUES, y se pintan también los que no cambian: un listado de solo
    // diferencias no dice si «Estado» se guardó igual o no se guardó.
    expect(component.cambios()).toEqual([
      { campo: 'Nombre', antes: 'Antes', despues: 'Después', cambia: true },
      { campo: 'Estado', antes: 'borrador', despues: 'borrador', cambia: false },
      { campo: 'Numero', antes: null, despues: '3', cambia: true },
    ]);

    component.cerrarDetalle();
    expect(component.detalleAbierto()).toBeNull();
    expect(component.cambios()).toEqual([]);
  });

  it('abre en «Actuaciones», con los accesos aparte y su recuento', () => {
    // De 167 filas, 86 eran «Inició sesión»: quien busca quién cambió qué no debe empezar por ahí.
    fixture.detectChanges();
    expect(component.vista()).toBe('actuaciones');
    expect(component.vistasDeLaBitacora().map(v => [v.id, v.conteo])).toEqual([['actuaciones', 81], ['accesos', 86]]);
    // La lista de verbos de «Actuaciones» no ofrece los de sesión.
    expect(component.accionesDeLaBitacora().map(o => o.id)).toEqual(['todas', 'publicar']);
  });

  it('«Accesos» pide solo las sesiones, parte de cero y ofrece solo sus verbos', () => {
    fixture.detectChanges();
    component.grupo.set('usuarios');
    component.pagina.set(4);
    component.elegirVista('accesos');
    expect(peticion.vista).toBe('accesos');
    expect(peticion.grupo).toBe('todos');
    expect(peticion.pagina).toBe(1);
    expect(component.accionesDeLaBitacora().map(o => o.id)).toEqual(['todas', 'iniciar_sesion']);

    component.elegirVista('actuaciones');
    expect(peticion.vista).toBe('actuaciones');
  });
});
