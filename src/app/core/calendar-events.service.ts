import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

export type CalendarEventType = 'event' | 'special';

export interface CalendarEvent {
  id: number;
  type: CalendarEventType;
  title: string;
  startsAt: string;
  details: string;
}

interface CalendarEventDto {
  id: number;
  type: CalendarEventType;
  title: string;
  starts_at: string;
  details: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarEventsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/events`;

  /** month format: 'YYYY-MM' */
  list(month: string): Observable<CalendarEvent[]> {
    const params = new HttpParams().set('month', month);
    return this.http
      .get<CalendarEventDto[]>(this.baseUrl, { params, withCredentials: true })
      .pipe(map((rows) => rows.map(toEvent)));
  }

  create(input: {
    startsAt: string;
    title: string;
    details: string;
    type?: CalendarEventType;
  }): Observable<CalendarEvent> {
    return this.http
      .post<CalendarEventDto>(this.baseUrl, input, { withCredentials: true })
      .pipe(map(toEvent));
  }

  update(
    id: number,
    input: { startsAt?: string; title?: string; details?: string },
  ): Observable<CalendarEvent> {
    return this.http
      .patch<CalendarEventDto>(`${this.baseUrl}/${id}`, input, { withCredentials: true })
      .pipe(map(toEvent));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  /** Admin-only server-side. type: 'event' clears regular events, 'special' clears birthdays/holidays. */
  clearAll(type: CalendarEventType): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/bulk/${type}`, { withCredentials: true });
  }
}

function toEvent(dto: CalendarEventDto): CalendarEvent {
  return { id: dto.id, type: dto.type, title: dto.title, startsAt: dto.starts_at, details: dto.details };
}
