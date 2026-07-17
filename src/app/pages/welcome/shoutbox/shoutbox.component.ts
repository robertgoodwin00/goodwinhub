import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../core/auth.service';
import { ConfirmService } from '../../../core/confirm.service';
import { Shout, ShoutsService } from '../../../core/shouts.service';

@Component({
  selector: 'app-shoutbox',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './shoutbox.component.html',
  styleUrl: './shoutbox.component.css',
})
export class ShoutboxComponent implements OnInit {
  private readonly shoutsService = inject(ShoutsService);
  private readonly auth = inject(AuthService);
  private readonly confirmService = inject(ConfirmService);

  readonly isAdmin = this.auth.isAdmin;

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  readonly shouts = signal<Shout[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly clearing = signal(false);

  name = '';
  message = '';

  ngOnInit(): void {
    this.shoutsService.list().subscribe({
      next: (shouts) => {
        this.shouts.set(shouts);
        this.loading.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.error.set('Could not load the shoutbox.');
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    const name = this.name.trim();
    const message = this.message.trim();
    if (!name || !message || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.shoutsService.post(name, message).subscribe({
      next: (shout) => {
        this.shouts.update((current) => [...current, shout]);
        this.message = '';
        this.submitting.set(false);
        this.scrollToBottom();
      },
      error: () => {
        this.error.set('Could not post that shout. Try again.');
        this.submitting.set(false);
      },
    });
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scrollContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  async clearAll(): Promise<void> {
    if (this.clearing()) {
      return;
    }
    if (!(await this.confirmService.ask('Delete every shout? This cannot be undone.'))) {
      return;
    }
    this.clearing.set(true);
    this.shoutsService.clearAll().subscribe({
      next: () => {
        this.clearing.set(false);
        this.shouts.set([]);
      },
      error: () => {
        this.clearing.set(false);
        this.error.set('Could not clear the shoutbox.');
      },
    });
  }
}
