import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  id: number;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Replaces the browser's native `confirm()` for destructive actions with an
 * in-app dialog that matches the rest of the CMS. Mirrors ToastService's
 * pattern: a single `<app-confirm-dialog>` mounted at the root reads
 * `request()` and renders whatever's there, any component can call `ask()`.
 *
 * `ask()` resolves to `true`/`false` the same way `window.confirm()` did, so
 * call sites just swap `if (!confirm('...'))` for `if (!(await
 * this.confirmService.ask('...')))`.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private nextId = 0;
  private resolver: ((result: boolean) => void) | null = null;

  readonly request = signal<ConfirmRequest | null>(null);

  ask(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    // Resolve any still-open prior request as "cancelled" so a resolver
    // never gets orphaned if something asks twice in a row.
    this.resolver?.(false);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.request.set({
        id: this.nextId++,
        message,
        confirmLabel: options.confirmLabel ?? 'Delete',
        cancelLabel: options.cancelLabel ?? 'Cancel',
      });
    });
  }

  respond(result: boolean): void {
    this.resolver?.(result);
    this.resolver = null;
    this.request.set(null);
  }
}
