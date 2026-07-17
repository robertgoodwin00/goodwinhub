import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

export interface LinkItem {
  id: number;
  name: string;
  title: string;
  url: string;
  createdAt: string;
}

interface LinkItemDto {
  id: number;
  name: string;
  title: string;
  url: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class LinksService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/links`;

  // Server already returns rows ordered by name so same-name links land
  // together; the component groups off of that ordering for display.
  // Paginated: offset 0 + a growing limit ("load more"), not a true cursor —
  // see the route's comment for why that's the simpler fit for grouping.
  list(offset = 0, limit = 50): Observable<LinkItem[]> {
    const params = new HttpParams().set('offset', offset).set('limit', limit);
    return this.http
      .get<LinkItemDto[]>(this.baseUrl, { params, withCredentials: true })
      .pipe(map((rows) => rows.map(toLink)));
  }

  create(input: { name: string; title: string; url: string }): Observable<LinkItem> {
    return this.http
      .post<LinkItemDto>(this.baseUrl, input, { withCredentials: true })
      .pipe(map(toLink));
  }

  update(
    id: number,
    input: { name?: string; title?: string; url?: string },
  ): Observable<LinkItem> {
    return this.http
      .patch<LinkItemDto>(`${this.baseUrl}/${id}`, input, { withCredentials: true })
      .pipe(map(toLink));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  /** Admin-only server-side; wipes every link. */
  clearAll(): Observable<void> {
    return this.http.delete<void>(this.baseUrl, { withCredentials: true });
  }

  /** Admin-only server-side; wipes every link sharing that exact name. */
  clearByName(name: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/by-name/${encodeURIComponent(name)}`, {
      withCredentials: true,
    });
  }
}

function toLink(dto: LinkItemDto): LinkItem {
  return { id: dto.id, name: dto.name, title: dto.title, url: dto.url, createdAt: dto.created_at };
}
