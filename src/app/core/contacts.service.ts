import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

export interface ContactSocial {
  id: number;
  platform: string;
  url: string;
}

export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  phoneAlt: string;
  address: string;
  createdAt: string;
  socials: ContactSocial[];
}

interface ContactDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  phone_alt: string;
  address: string;
  created_at: string;
  socials: ContactSocial[];
}

export interface ContactFields {
  name: string;
  email?: string;
  phone?: string;
  phoneAlt?: string;
  address?: string;
}

@Injectable({ providedIn: 'root' })
export class ContactsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/contacts`;

  // Contacts come back with their socials already embedded, so there's no
  // separate fetch needed just to display them.
  list(): Observable<Contact[]> {
    return this.http
      .get<ContactDto[]>(this.baseUrl, { withCredentials: true })
      .pipe(map((rows) => rows.map(toContact)));
  }

  create(input: ContactFields): Observable<Contact> {
    return this.http
      .post<ContactDto>(this.baseUrl, input, { withCredentials: true })
      .pipe(map(toContact));
  }

  update(id: number, input: Partial<ContactFields>): Observable<Contact> {
    return this.http
      .patch<ContactDto>(`${this.baseUrl}/${id}`, input, { withCredentials: true })
      .pipe(map(toContact));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  /** Admin-only server-side; wipes every contact and their social links. */
  clearAll(): Observable<void> {
    return this.http.delete<void>(this.baseUrl, { withCredentials: true });
  }

  addSocial(contactId: number, input: { platform: string; url: string }): Observable<ContactSocial> {
    return this.http.post<ContactSocial>(`${this.baseUrl}/${contactId}/socials`, input, {
      withCredentials: true,
    });
  }

  updateSocial(
    contactId: number,
    socialId: number,
    input: { platform?: string; url?: string },
  ): Observable<ContactSocial> {
    return this.http.patch<ContactSocial>(
      `${this.baseUrl}/${contactId}/socials/${socialId}`,
      input,
      { withCredentials: true },
    );
  }

  removeSocial(contactId: number, socialId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${contactId}/socials/${socialId}`, {
      withCredentials: true,
    });
  }
}

function toContact(dto: ContactDto): Contact {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    phone: dto.phone,
    phoneAlt: dto.phone_alt,
    address: dto.address,
    createdAt: dto.created_at,
    socials: dto.socials ?? [],
  };
}
