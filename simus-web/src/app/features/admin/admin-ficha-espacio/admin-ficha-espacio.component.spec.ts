import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { appConfig } from '../../../app.config';
import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { DecisionSobreEspacio, Espacio, EspaciosService } from '../../../core/services/espacios.service';
import { AdminFichaEspacioComponent } from './admin-ficha-espacio.component';

/**
 * La ficha de un espacio en la consola: aquí se decide.
 *
 * <b>LO QUE SE FIJA.</b> Que solo se ofrezca lo que aplica al estado, que pedir ajustes, rechazar y
 * retirar pasen por el diálogo común CON motivo obligatorio, y que una decisión cancelada no llegue
 * al servidor.
 */
describe('AdminFichaEspacioComponent', () => {
  const espacio = (estadoRegistro: string): Espacio => ({
    id: 3, nombre: 'Espacio de prueba', descripcion: 'Descripción.', ambiente: 'mixto', aforoMaximo: 150,
    esAccesible: false, horarioYProgramacion: null, correoEspacio: 'espacio@correo.test', telefonoEspacio: null,
    sitioWebEspacio: null, instagramEspacio: null, facebookEspacio: null, otroEnlaceEspacio: null,
    nivelCobertura: 'nacional', codigoDepartamento: null, nombreDepartamento: null,
    codigoMunicipio: null, nombreMunicipio: null, lugarEspecifico: null,
    organizacionId: null, organizacionNombre: null, usuarioResponsableId: 8, responsableNombre: 'Marta Valderrama',
    estadoRegistro, motivoDeLaDecision: null, equipamiento: [], tipos: [], practicasMusicales: [],
    fechaCreacion: '2026-10-01T00:00:00Z', fechaActualizacion: null, fechaEnvioARevision: '2026-10-02T00:00:00Z', fechaPublicacion: null,
  });

  let fixture: ComponentFixture<AdminFichaEspacioComponent>;
  let componente: AdminFichaEspacioComponent;
  let confirmaciones: { titulo: string; pideMotivo?: boolean; motivoObligatorio?: boolean }[];
  let respuesta: { motivo: string } | null;
  let decidido: { decision: DecisionSobreEspacio; motivo: string | null } | null;
  let archivado: string | null;

  beforeAll(() => expect(appConfig.providers.length).toBeGreaterThan(0));

  function montar(estado: string): void {
    confirmaciones = []; respuesta = { motivo: 'Un motivo.' }; decidido = null; archivado = null;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminFichaEspacioComponent],
      providers: [
        provideRouter([]),
        { provide: ServicioDeConfirmacion, useValue: { pedir: (p: { titulo: string }) => { confirmaciones.push(p); return Promise.resolve(respuesta); } } },
        { provide: EspaciosService, useValue: {
          obtenerEnLaConsola: () => of(espacio(estado)),
          decidir: (_id: string | number, decision: DecisionSobreEspacio, motivo: string | null) => {
            decidido = { decision, motivo };
            return Promise.resolve(espacio(decision === 'publicar' ? 'publicado' : decision === 'rechazar' ? 'rechazado' : 'ajustes_solicitados'));
          },
          archivar: (_id: string | number, motivo: string) => { archivado = motivo; return Promise.resolve(espacio('archivado')); },
        } },
      ],
    });
    fixture = TestBed.createComponent(AdminFichaEspacioComponent);
    fixture.componentRef.setInput('espacioId', '3');
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const boton = (testid: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testid}"]`);

  it('en revisión se publica, se piden ajustes o se rechaza; publicado solo se retira', () => {
    montar('en_revision');
    expect(boton('publicar-espacio')).not.toBeNull();
    expect(boton('pedir-ajustes-espacio')).not.toBeNull();
    expect(boton('rechazar-espacio')).not.toBeNull();
    expect(boton('retirar-espacio-consola')).toBeNull();

    montar('publicado');
    expect(boton('publicar-espacio')).toBeNull();
    expect(boton('retirar-espacio-consola')).not.toBeNull();

    montar('borrador');
    expect(boton('publicar-espacio')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('lo completa quien lo registró');
  });

  it('nombra a la persona responsable de un espacio independiente', () => {
    montar('en_revision');

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Marta Valderrama (responsable independiente)');
  });

  it('publicar confirma sin pedir motivo y llega al servidor', async () => {
    montar('en_revision');

    await componente.decidir('publicar');

    expect(confirmaciones[0].titulo).toBe('Publicar el espacio');
    expect(confirmaciones[0].pideMotivo).toBeFalse();
    expect(decidido).toEqual({ decision: 'publicar', motivo: 'Un motivo.' });
    expect(componente.espacio()!.estadoRegistro).toBe('publicado');
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
    expect(componente.espacio()!.estadoRegistro).toBe('archivado');
  });
});
