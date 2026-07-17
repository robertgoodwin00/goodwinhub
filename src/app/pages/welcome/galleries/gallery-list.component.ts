import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth.service';
import { ConfirmService } from '../../../core/confirm.service';
import { GalleriesService, GalleryListItem } from '../../../core/galleries.service';

@Component({
  selector: 'app-gallery-list',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './gallery-list.component.html',
  styleUrl: './gallery-list.component.css',
})
export class GalleryListComponent implements OnInit {
  private readonly galleriesService = inject(GalleriesService);
  private readonly auth = inject(AuthService);
  private readonly confirmService = inject(ConfirmService);

  readonly isAdmin = this.auth.isAdmin;

  readonly galleries = signal<GalleryListItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly clearing = signal(false);

  readonly formOpen = signal(false);
  readonly newTitle = signal('');
  readonly newDescription = signal('');
  readonly creating = signal(false);
  readonly formError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.galleriesService.list().subscribe({
      next: (galleries) => {
        this.galleries.set(galleries);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load galleries.');
        this.loading.set(false);
      },
    });
  }

  startCreate(): void {
    this.formOpen.set(true);
    this.newTitle.set('');
    this.newDescription.set('');
    this.formError.set(null);
  }

  cancelCreate(): void {
    this.formOpen.set(false);
    this.newTitle.set('');
    this.newDescription.set('');
    this.formError.set(null);
  }

  submitCreate(): void {
    const title = this.newTitle().trim();
    if (!title || this.creating()) {
      return;
    }
    this.creating.set(true);
    this.formError.set(null);
    this.galleriesService.create(title, this.newDescription().trim()).subscribe({
      next: () => {
        this.creating.set(false);
        this.cancelCreate();
        this.load();
      },
      error: (err) => {
        this.creating.set(false);
        this.formError.set(err?.error?.error ?? 'Could not create that gallery.');
      },
    });
  }

  async clearAll(): Promise<void> {
    if (this.clearing()) {
      return;
    }
    if (
      !(await this.confirmService.ask(
        'Delete every gallery and every photo in them? This removes the files from storage too and cannot be undone.',
      ))
    ) {
      return;
    }
    this.clearing.set(true);
    this.galleriesService.clearAll().subscribe({
      next: () => {
        this.clearing.set(false);
        this.load();
      },
      error: () => {
        this.clearing.set(false);
        this.error.set('Could not clear galleries.');
      },
    });
  }
}
