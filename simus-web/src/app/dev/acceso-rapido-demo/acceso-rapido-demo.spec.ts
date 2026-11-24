import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { AccesoRapidoDemoComponent } from './acceso-rapido-demo.component';
import { CuentaDeDemostracion, esDireccionLocal, leerConfiguracion } from './acceso-rapido-demo.config';

const CUENTAS: CuentaDeDemostracion[] = [
  { rotulo: 'Administrador', correo: 'a@x.test', clave: 'k1', ambito: 'administrativo' },
  { rotulo: 'Gestor', correo: 'g@x.test', clave: 'k2', ambito: 'administrativo' },
  { rotulo: 'Lucía', correo: 'l@x.test', clave: 'k3', ambito: 'externo' },
];

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (ambito() === 'externo') {
      <form (ngSubmit)="enviado.set(enviado() + 1)"><input id="acceso-correo" name="c" [(ngModel)]="correo"><input id="acceso-contrasena" name="p" [(ngModel)]="clave"><button>Ir</button></form>
    }
    @if (ambito() === 'administrativo') {
      <form (ngSubmit)="enviado.set(enviado() + 1)"><input id="admin-email" name="c" [(ngModel)]="correo"><input id="admin-password" name="p" [(ngModel)]="clave"><button>Ir</button></form>
    }`,
})
class PantallaFalsa {
  ambito = signal<'externo' | 'administrativo' | 'ninguno'>('ninguno');
  correo = ''; clave = '';
  enviado = signal(0);
}

describe('Acceso rápido de demostración', () => {
  describe('configuración', () => {
    it('no hay nada utilizable sin configuración o apagada', () => {
      expect(leerConfiguracion(undefined)).toBeNull();
      expect(leerConfiguracion({ accesoRapido: false, cuentas: CUENTAS })).toBeNull();
      expect(leerConfiguracion({ accesoRapido: true, cuentas: [] })).toBeNull();
      expect(leerConfiguracion({ accesoRapido: true, cuentas: [{ rotulo: 1 }] })).toBeNull();
    });
    it('conserva solo las cuentas bien formadas', () => {
      const c = leerConfiguracion({ accesoRapido: true, cuentas: [...CUENTAS, { rotulo: 'x' }] });
      expect(c?.cuentas.length).toBe(3);
    });
    it('solo se intenta desde direcciones locales', () => {
      expect(esDireccionLocal('localhost')).toBeTrue();
      expect(esDireccionLocal('127.0.0.1')).toBeTrue();
      expect(esDireccionLocal('simus.ejemplo.org')).toBeFalse();
    });
  });

  describe('componente', () => {
    let pantalla: ComponentFixture<PantallaFalsa>;
    let panel: ComponentFixture<AccesoRapidoDemoComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({ imports: [PantallaFalsa, AccesoRapidoDemoComponent] }).compileComponents();
      pantalla = TestBed.createComponent(PantallaFalsa);
      pantalla.detectChanges();
      panel = TestBed.createComponent(AccesoRapidoDemoComponent);
      // Crear otra instancia retira del documento la raíz de la anterior: se vuelve a colgar.
      document.body.appendChild(pantalla.nativeElement);
      panel.componentRef.setInput('cuentas', CUENTAS);
      panel.detectChanges();
    });

    afterEach(() => (pantalla.nativeElement as HTMLElement).remove());

    const el = () => panel.nativeElement as HTMLElement;
    const mostrar = (a: 'externo' | 'administrativo' | 'ninguno') => {
      pantalla.componentInstance.ambito.set(a);
      pantalla.detectChanges();
      panel.componentInstance.detectar();
      panel.detectChanges();
    };

    it('no se muestra fuera de una pantalla de ingreso', () => {
      expect(el().querySelector('aside')).toBeNull();
    });

    it('en el ingreso de la gestión muestra solo las cuentas administrativas', () => {
      mostrar('administrativo');
      (el().querySelector('.ard-boton') as HTMLButtonElement).click();
      panel.detectChanges();
      const rotulos = Array.from(el().querySelectorAll('.ard-cuenta span')).map((s) => s.textContent);
      expect(rotulos).toEqual(['Administrador', 'Gestor']);
    });

    it('en el ingreso externo muestra solo las externas', () => {
      mostrar('externo');
      (el().querySelector('.ard-boton') as HTMLButtonElement).click();
      panel.detectChanges();
      expect(Array.from(el().querySelectorAll('.ard-cuenta span')).map((s) => s.textContent)).toEqual(['Lucía']);
    });

    it('al elegir una cuenta rellena los campos y el modelo se entera', async () => {
      mostrar('administrativo');
      await pantalla.whenStable(); // ngModel escribe su valor inicial de forma asíncrona
      panel.componentInstance.elegir(CUENTAS[1]);
      pantalla.detectChanges();
      await pantalla.whenStable();
      expect((document.getElementById('admin-email') as HTMLInputElement).value).toBe('g@x.test');
      expect(pantalla.componentInstance.correo).toBe('g@x.test');
      expect(pantalla.componentInstance.clave).toBe('k2');
      expect(pantalla.componentInstance.enviado()).toBe(0);
    });

    it('con «ingresar al elegir» envía el formulario', async () => {
      mostrar('externo');
      await pantalla.whenStable();
      panel.componentInstance.ingresarAlElegir.set(true);
      panel.componentInstance.elegir(CUENTAS[2]);
      await new Promise((r) => setTimeout(r, 20));
      expect(pantalla.componentInstance.enviado()).toBe(1);
    });
  });
});
