import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { environment } from '../../environments/environment';

type Role = 'user' | 'admin';

interface SessionResponse {
  authenticated: boolean;
  role?: Role;
}

/**
 * There are no user accounts. Everyone shares one of two passwords, so
 * "auth" here just means "does the browser have a valid session cookie",
 * and "role" just means "which of the two passwords was used".
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  readonly isAuthenticated = signal(false);
  readonly role = signal<Role | null>(null);
  readonly isAdmin = computed(() => this.role() === 'admin');

  login(password: string): Observable<boolean> {
    return this.http
      .post<SessionResponse>(`${this.baseUrl}/login`, { password }, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.isAuthenticated.set(res.authenticated);
          this.role.set(res.role ?? null);
        }),
        map((res) => res.authenticated),
      );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.isAuthenticated.set(false);
        this.role.set(null);
      }),
    );
  }

  /** Asks the server whether the current session cookie is still valid. */
  checkSession(): Observable<boolean> {
    return this.http
      .get<SessionResponse>(`${this.baseUrl}/session`, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.isAuthenticated.set(res.authenticated);
          this.role.set(res.role ?? null);
        }),
        map((res) => res.authenticated),
        catchError(() => {
          this.isAuthenticated.set(false);
          this.role.set(null);
          return of(false);
        }),
      );
  }
}
