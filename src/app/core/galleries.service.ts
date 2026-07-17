import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

export interface GalleryListItem {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  imageCount: number;
  coverUrl: string | null;
}

export interface GalleryImage {
  id: number;
  galleryId: number;
  filename: string;
  thumbnailFilename: string;
  caption: string;
  createdAt: string;
  fullUrl: string;
  thumbUrl: string;
}

export interface GalleryDetail {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  images: GalleryImage[];
}

interface GalleryDto {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  imageCount: number;
  coverFilename: string | null;
}

interface GalleryImageDto {
  id: number;
  galleryId: number;
  filename: string;
  thumbnailFilename: string;
  caption: string;
  createdAt: string;
}

interface GalleryDetailDto {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  images: GalleryImageDto[];
}

@Injectable({ providedIn: 'root' })
export class GalleriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/galleries`;
  private readonly uploadsUrl = `${environment.apiUrl}/uploads`;

  private originalUrl(filename: string): string {
    return `${this.uploadsUrl}/originals/${filename}`;
  }

  private thumbUrl(filename: string): string {
    return `${this.uploadsUrl}/thumbs/${filename}`;
  }

  private toListItem = (dto: GalleryDto): GalleryListItem => ({
    id: dto.id,
    title: dto.title,
    description: dto.description,
    createdAt: dto.createdAt,
    imageCount: dto.imageCount,
    coverUrl: dto.coverFilename ? this.thumbUrl(dto.coverFilename) : null,
  });

  private toImage = (dto: GalleryImageDto): GalleryImage => ({
    id: dto.id,
    galleryId: dto.galleryId,
    filename: dto.filename,
    thumbnailFilename: dto.thumbnailFilename,
    caption: dto.caption,
    createdAt: dto.createdAt,
    fullUrl: this.originalUrl(dto.filename),
    thumbUrl: this.thumbUrl(dto.thumbnailFilename),
  });

  list(): Observable<GalleryListItem[]> {
    return this.http
      .get<GalleryDto[]>(this.baseUrl, { withCredentials: true })
      .pipe(map((rows) => rows.map(this.toListItem)));
  }

  get(id: number): Observable<GalleryDetail> {
    return this.http
      .get<GalleryDetailDto>(`${this.baseUrl}/${id}`, { withCredentials: true })
      .pipe(
        map((dto) => ({
          id: dto.id,
          title: dto.title,
          description: dto.description,
          createdAt: dto.createdAt,
          images: dto.images.map(this.toImage),
        })),
      );
  }

  create(title: string, description = ''): Observable<GalleryListItem> {
    return this.http
      .post<GalleryDto>(this.baseUrl, { title, description }, { withCredentials: true })
      .pipe(map(this.toListItem));
  }

  rename(id: number, title: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}`, { title }, { withCredentials: true });
  }

  updateDescription(id: number, description: string): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/${id}`,
      { description },
      { withCredentials: true },
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  uploadImage(galleryId: number, file: File, caption: string): Observable<GalleryImage> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('caption', caption);
    return this.http
      .post<GalleryImageDto>(`${this.baseUrl}/${galleryId}/images`, formData, {
        withCredentials: true,
      })
      .pipe(map(this.toImage));
  }

  updateCaption(galleryId: number, imageId: number, caption: string): Observable<GalleryImage> {
    return this.http
      .patch<GalleryImageDto>(
        `${this.baseUrl}/${galleryId}/images/${imageId}`,
        { caption },
        { withCredentials: true },
      )
      .pipe(map(this.toImage));
  }

  deleteImage(galleryId: number, imageId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${galleryId}/images/${imageId}`, {
      withCredentials: true,
    });
  }

  /** Admin-only server-side; wipes every gallery and every image file on disk. */
  clearAll(): Observable<void> {
    return this.http.delete<void>(this.baseUrl, { withCredentials: true });
  }
}
