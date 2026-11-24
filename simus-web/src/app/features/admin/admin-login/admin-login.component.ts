import { Component, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { 
  LucideMail, 
  LucideLock, 
  LucideEye, 
  LucideEyeOff, 
  LucideShieldCheck, 
  LucideAlertCircle, 
  LucideRefreshCw, 
} from '@lucide/angular';
import { SessionService } from '../../../core/services/session.service';
import { UsuarioAdministrativo } from '../../../core/services/admin.service';
import { DEV_ADMIN_ACCOUNTS } from './dev-accounts';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideMail,
    LucideLock,
    LucideEye,
    LucideEyeOff,
    LucideShieldCheck,
    LucideAlertCircle,
    LucideRefreshCw,
    RouterLink,
  ],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.css']
})
export class AdminLoginComponent {
  private sessionService = inject(SessionService);

  @Output() loginSuccess = new EventEmitter<UsuarioAdministrativo>();

  // Internal Login State. En el entorno local el correo y la contraseña vienen sembrados (ver `dev-accounts.ts`); en produccion van vacios.
  email = signal<string>(DEV_ADMIN_ACCOUNTS['webmaster']?.email ?? '');
  password = signal<string>(DEV_ADMIN_ACCOUNTS['webmaster']?.password ?? '');
  loginState = signal<{ status: string; message: string }>({ status: 'idle', message: '' });
  formMode = signal<string>('login'); // 'login' | 'recover'
  showPassword = signal<boolean>(false);

  // Icons reference for templates
  LucideMail = LucideMail;
  LucideLock = LucideLock;
  LucideEye = LucideEye;
  LucideEyeOff = LucideEyeOff;
  LucideShieldCheck = LucideShieldCheck;
  LucideAlertCircle = LucideAlertCircle;
  LucideRefreshCw = LucideRefreshCw;

  async handleSubmit(event: Event) {
    event.preventDefault();
    this.loginState.set({ status: 'saving', message: 'Validando credenciales...' });
    
    // Simulate or call API via SessionService
    this.sessionService.login({ email: this.email(), password: this.password() }).subscribe({
      next: (res) => {
        this.loginState.set({ status: 'idle', message: '' });
        this.loginSuccess.emit(res.user);
      },
      error: (err) => {
        this.loginState.set({ status: 'error', message: err.message || 'Error de inicio de sesión' });
      }
    });
  }

}
