import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { appConfig } from '../../../app.config';
import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { DecisionSobreRed, Red, RedesService } from '../../../core/services/redes.service';
import { AdminFichaRedComponent } from './admin-ficha-red.component';

/**
 * La ficha de una red en la consola: aquí se decide.
 *
 * <b>LO QUE SE FIJA.</b> Que solo se ofrezca lo que aplica al estado, que pedir ajustes, rechazar y
 * retirar pasen por el diálogo común CON motivo obligatorio, y que una decisión cancelada no llegue
 * al servidor.
 */
describe('AdminFichaRedComponent', () => {
  const red = (estadoRegistro: string): Red => ({
    id: 3, nombre: 'Red de prueba', descripcion: 'Descripción.', tipoDeNodo: 'grupo_de_investigacion',
    accesoAbierto: false, acervosYColecciones: null, correoRed: 'red@correo.test', telefonoRed: null,
    sitioWebRed: null, instagramRed: null, facebookRed: null, otroEnlaceRed: null,
    nivelCobertura: 'nacional', codigoDepartamento: null, nombreDepartamento: null,
    codigoMunicipio: null, nombreMunicipio: null, lugarEspecifico: null,
    organizacionId: null, organizacionNombre: null, usuarioResponsableId: 8, responsableNombre: 'Marta Valderrama',
    estadoRegistro, motivoDeLaDecision: null, formasDeAcceso: [], formatos: [], practicasMusicales: [],
    fechaCreacion: '2026-10-01T00:00:00Z', fechaActualizacion: null, fechaEnvioARevision: '2026-10-02T00:00:00Z', fechaPublicacion: null,
  });

  let fixture: ComponentFixture<AdminFichaRedComponent>;
  let componente: AdminFichaRedComponent;
  let confirmaciones: { titulo: string; pideMotivo?: boolean; motivoObligatorio?: boolean }[];
  let respuesta: { motivo: string } | null;
  let decidido: { decision: DecisionSobreRed; motivo: string | null } | null;
  let archivado: string | null;

  beforeAll(() => expect(appConfig.providers.length).toBeGreaterThan(0));

  function montar(estado: string): void {
    confirmaciones = []; respuesta = { motivo: 'Un motivo.' }; decidido = null; archivado = null;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminFichaRedComponent],
      providers: [
        provideRouter([]),
        { provide: ServicioDeConfirmacion, useValue: { pedir: (p: { titulo: string }) => { confirmaciones.push(p); return Promise.resolve(respuesta); } } },
        { provide: RedesService, useValue: {
          obtenerEnLaConsola: () => of(red(estado)),
          decidir: (_id: string | number, decision: DecisionSobreRed, motivo: string | null) => {
            decidido = { decision, motivo };
            return Promise.resolve(red(decision === 'publicar' ? 'publicado' : decision === 'rechazar' ? 'rechazado' : 'ajustes_solicitados'));
          },
          archivar: (_id: string | number, motivo: string) => { archivado = motivo; return Promise.resolve(red('archivado')); },
        } },
      ],
    });
    fixture = TestBed.createComponent(AdminFichaRedComponent);
    fixture.componentRef.setInput('redId', '3');
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const boton = (testid: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testid}"]`);

  it('en revisión se publica, se piden ajustes o se rechaza; publicado solo se retira', () => {
    montar('en_revision');
    expect(boton('publicar-red')).not.toBeNull();
    expect(boton('pedir-ajustes-red')).not.toBeNull();
    expect(boton('rechazar-red')).not.toBeNull();
    expect(boton('retirar-red-consola')).toBeNull();

    montar('publicado');
    expect(boton('publicar-red')).toBeNull();
    expect(boton('retirar-red-consola')).not.toBeNull();

    montar('borrador');
    expect(boton('publicar-red')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('lo completa quien lo registró');
  });

  it('nombra a la persona responsable de una red independiente', () => {
    montar('en_revision');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Marta Valderrama (persona responsable)');
  });

  it('publicar confirma sin pedir motivo y llega al servidor', async () => {
    montar('en_revision');

    await componente.decidir('publicar');

    expect(confirmaciones[0].titulo).toBe('Publicar la red');
    expect(confirmaciones[0].pideMotivo).toBeFalse();
    expect(decidido).toEqual({ decision: 'publicar', motivo: 'Un motivo.' });
    expect(componente.red()!.estadoRegistro).toBe('publicado');
  });

  it('pedir ajustes y rechazar piden el motivo y lo mandan; si se cancela no se manda nada', async () => {
    montar('en_revision');
    respuesta = null;
    await componente.decidir('rechazar');
    expect(confirmaciones[0].pideMotivo).toBeTrue();
    expect(confirmaciones[0].motivoObligatorio).toBeTrue();
    expect(decidido).toBeNull();

    respuesta = { motivo: 'Falta el barrio.' };
    await componente.decidir('ajustes');
    expect(decidido).toEqual({ decision: 'ajustes', motivo: 'Falta el barrio.' });
  });

  it('retirar uno publicado exige el motivo y avisa a su responsable', async () => {
    montar('publicado');
    respuesta = { motivo: 'Datos falsos.' };

    await componente.retirar();

    expect(confirmaciones[0].titulo).toBe('Retirar del ecosistema');
    expect(confirmaciones[0].motivoObligatorio).toBeTrue();
    expect(archivado).toBe('Datos falsos.');
    expect(componente.red()!.estadoRegistro).toBe('archivado');
  });
});
