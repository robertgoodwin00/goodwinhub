import { Injectable, signal } from '@angular/core';

export type ToastType = 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

/**
 * Tiny in-memory toast queue. Any component can call `show()`; the single
 * `<app-toast>` mounted at the root reads `toasts()` and renders whatever's
 * there. No app-wide event bus needed — just a shared signal.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;

  readonly toasts = signal<Toast[]>([]);

  show(message: string, options: { type?: ToastType; durationMs?: number } = {}): void {
    const type = options.type ?? 'info';
    // Warnings stick around longer — there's more to read and it matters more.
    const durationMs = options.durationMs ?? (type === 'warning' ? 4500 : 2500);
    const id = this.nextId++;
    this.toasts.update((current) => [...current, { id, message, type }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((current) => current.filter((t) => t.id !== id));
  }
}
