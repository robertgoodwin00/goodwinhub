import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ConfirmService } from '../../core/confirm.service';
import { GalleriesService, GalleryDetail } from '../../core/galleries.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-gallery-detail',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './gallery-detail.component.html',
  styleUrl: './gallery-detail.component.css',
})
export class GalleryDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly galleriesService = inject(GalleriesService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  private galleryId = 0;

  readonly gallery = signal<GalleryDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly editingTitle = signal(false);
  readonly titleDraft = signal('');
  readonly savingTitle = signal(false);

  readonly editingDescription = signal(false);
  readonly descriptionDraft = signal('');
  readonly savingDescription = signal(false);

  selectedFile: File | null = null;
  selectedFileName = '';
  readonly uploadCaption = signal('');
  readonly uploading = signal(false);
  readonly uploadError = signal<string | null>(null);

  readonly lightboxIndex = signal<number | null>(null);
  readonly captionDraft = signal('');
  readonly savingCaption = signal(false);

  readonly lightboxImage = computed(() => {
    const idx = this.lightboxIndex();
    const gallery = this.gallery();
    if (idx === null || !gallery) {
      return null;
    }
    return gallery.images[idx] ?? null;
  });

  ngOnInit(): void {
    this.galleryId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.galleriesService.get(this.galleryId).subscribe({
      next: (gallery) => {
        this.gallery.set(gallery);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load this gallery.');
        this.loading.set(false);
      },
    });
  }

  startEditTitle(): void {
    const g = this.gallery();
    if (!g) {
      return;
    }
    this.titleDraft.set(g.title);
    this.editingTitle.set(true);
  }

  cancelEditTitle(): void {
    this.editingTitle.set(false);
  }

  saveTitle(): void {
    const title = this.titleDraft().trim();
    if (!title || this.savingTitle()) {
      return;
    }
    this.savingTitle.set(true);
    this.galleriesService.rename(this.galleryId, title).subscribe({
      next: () => {
        this.savingTitle.set(false);
        this.editingTitle.set(false);
        this.load();
        this.toast.show('Title saved');
      },
      error: () => {
        this.savingTitle.set(false);
      },
    });
  }

  startEditDescription(): void {
    const g = this.gallery();
    if (!g) {
      return;
    }
    this.descriptionDraft.set(g.description);
    this.editingDescription.set(true);
  }

  cancelEditDescription(): void {
    this.editingDescription.set(false);
  }

  saveDescription(): void {
    if (this.savingDescription()) {
      return;
    }
    this.savingDescription.set(true);
    this.galleriesService
      .updateDescription(this.galleryId, this.descriptionDraft().trim())
      .subscribe({
        next: () => {
          this.savingDescription.set(false);
          this.editingDescription.set(false);
          this.load();
          this.toast.show('Description saved');
        },
        error: () => {
          this.savingDescription.set(false);
        },
      });
  }

  async deleteGallery(): Promise<void> {
    if (
      !(await this.confirmService.ask(
        'Delete this whole gallery and all its photos? This cannot be undone.',
      ))
    ) {
      return;
    }
    this.galleriesService.remove(this.galleryId).subscribe({
      next: () => this.router.navigate(['/welcome']),
      error: () => this.error.set('Could not delete this gallery.'),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile = file;
    this.selectedFileName = file?.name ?? '';
  }

  submitUpload(): void {
    if (!this.selectedFile || this.uploading()) {
      return;
    }
    this.uploading.set(true);
    this.uploadError.set(null);

    this.galleriesService.uploadImage(this.galleryId, this.selectedFile, this.uploadCaption().trim()).subscribe({
      next: () => {
        this.uploading.set(false);
        this.selectedFile = null;
        this.selectedFileName = '';
        this.uploadCaption.set('');
        this.load();
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadError.set(err?.error?.error ?? 'Could not upload that image.');
      },
    });
  }

  openLightbox(index: number): void {
    this.lightboxIndex.set(index);
    const img = this.gallery()?.images[index];
    this.captionDraft.set(img?.caption ?? '');
  }

  closeLightbox(): void {
    this.lightboxIndex.set(null);
  }

  prevImage(): void {
    const gallery = this.gallery();
    const idx = this.lightboxIndex();
    if (!gallery || idx === null || gallery.images.length === 0) {
      return;
    }
    this.openLightbox((idx - 1 + gallery.images.length) % gallery.images.length);
  }

  nextImage(): void {
    const gallery = this.gallery();
    const idx = this.lightboxIndex();
    if (!gallery || idx === null || gallery.images.length === 0) {
      return;
    }
    this.openLightbox((idx + 1) % gallery.images.length);
  }

  saveCaption(): void {
    const image = this.lightboxImage();
    if (!image || this.savingCaption()) {
      return;
    }
    this.savingCaption.set(true);
    this.galleriesService.updateCaption(this.galleryId, image.id, this.captionDraft().trim()).subscribe({
      next: (updatedImage) => {
        this.savingCaption.set(false);
        // Patch the one image in place instead of re-fetching the whole
        // gallery — saves a whole round-trip, so the toast (and the
        // updated caption) show up as soon as this request resolves,
        // not after a second one too.
        this.gallery.update((current) =>
          current
            ? {
                ...current,
                images: current.images.map((img) =>
                  img.id === updatedImage.id ? updatedImage : img,
                ),
              }
            : current,
        );
        this.toast.show('Caption saved');
      },
      error: () => {
        this.savingCaption.set(false);
      },
    });
  }

  async deleteImage(): Promise<void> {
    const image = this.lightboxImage();
    if (!image) {
      return;
    }
    if (!(await this.confirmService.ask('Delete this photo?'))) {
      return;
    }
    this.galleriesService.deleteImage(this.galleryId, image.id).subscribe({
      next: () => {
        this.closeLightbox();
        this.load();
      },
      error: () => this.error.set('Could not delete that photo.'),
    });
  }
}
