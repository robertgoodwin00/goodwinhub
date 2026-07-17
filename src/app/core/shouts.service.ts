import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

export interface Shout {
  id: number;
  name: string;
  message: string;
  createdAt: string;
}

interface ShoutDto {
  id: number;
  name: string;
  message: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ShoutsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/shouts`;

  list(): Observable<Shout[]> {
    return this.http
      .get<ShoutDto[]>(this.baseUrl, { withCredentials: true })
      .pipe(map((rows) => rows.map(toShout)));
  }

  post(name: string, message: string): Observable<Shout> {
    return this.http
      .post<ShoutDto>(this.baseUrl, { name, message }, { withCredentials: true })
      .pipe(map(toShout));
  }

  /** Admin-only server-side; wipes the whole shoutbox. */
  clearAll(): Observable<void> {
    return this.http.delete<void>(this.baseUrl, { withCredentials: true });
  }
}

function toShout(dto: ShoutDto): Shout {
  return { id: dto.id, name: dto.name, message: dto.message, createdAt: dto.created_at };
}
