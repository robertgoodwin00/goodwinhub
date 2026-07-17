import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';

const MAX_DOTS = 8;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  password = '';
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  /** Drives the tumbler-dot signature above the real input. */
  get dotCount(): number {
    return Math.min(this.password.length, MAX_DOTS);
  }

  get overflow(): boolean {
    return this.password.length > MAX_DOTS;
  }

  submit(): void {
    if (!this.password || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth.login(this.password).subscribe({
      next: () => this.router.navigate(['/welcome']),
      error: (err) => {
        // A 429 from the login rate limiter carries its own "try again in
        // N minutes" message — showing "Incorrect key" instead would be
        // actively misleading for that case.
        this.error.set(
          err?.status === 429
            ? (err?.error?.error ?? 'Too many attempts. Try again shortly.')
            : 'Incorrect key. Try again.',
        );
        this.submitting.set(false);
      },
    });
  }
}
