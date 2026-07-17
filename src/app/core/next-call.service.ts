import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

interface NextCallDto {
  starts_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class NextCallService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/next-call`;

  get(): Observable<string | null> {
    return this.http
      .get<NextCallDto>(this.baseUrl, { withCredentials: true })
      .pipe(map((dto) => dto.starts_at));
  }

  update(startsAt: string): Observable<string | null> {
    return this.http
      .patch<NextCallDto>(this.baseUrl, { startsAt }, { withCredentials: true })
      .pipe(map((dto) => dto.starts_at));
  }
}
