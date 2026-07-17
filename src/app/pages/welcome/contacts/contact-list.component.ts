import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../core/auth.service';
import { ConfirmService } from '../../../core/confirm.service';
import { Contact, ContactSocial, ContactsService } from '../../../core/contacts.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-contact-list',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './contact-list.component.html',
  styleUrl: './contact-list.component.css',
})
export class ContactListComponent implements OnInit {
  private readonly contactsService = inject(ContactsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly isAdmin = this.auth.isAdmin;

  // Collapsed by default — the section is just a title bar until the
  // toggle arrow is clicked.
  readonly open = signal(false);

  readonly contacts = signal<Contact[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly clearing = signal(false);

  // Main contact form (add or edit — editingId null means "adding new").
  readonly editingId = signal<number | null>(null);
  readonly formOpen = signal(false);
  readonly formName = signal('');
  readonly formEmail = signal('');
  readonly formPhone = signal('');
  readonly formPhoneAlt = signal('');
  readonly formAddress = signal('');
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  // Social-link form, scoped to whichever contact it's open for.
  // editingSocialId set means "editing that social"; null + socialFormFor
  // set means "adding a new one to that contact".
  readonly socialFormFor = signal<number | null>(null);
  readonly editingSocialId = signal<number | null>(null);
  readonly socialPlatform = signal('');
  readonly socialUrl = signal('');
  readonly socialSaving = signal(false);
  readonly socialError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  toggleOpen(): void {
    this.open.update((v) => !v);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.contactsService.list().subscribe({
      next: (contacts) => {
        this.contacts.set(contacts);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load contacts.');
        this.loading.set(false);
      },
    });
  }

  startAdd(): void {
    this.editingId.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formPhone.set('');
    this.formPhoneAlt.set('');
    this.formAddress.set('');
    this.formError.set(null);
    this.formOpen.set(true);
  }

  // Any signed-in user can edit any contact, so there's no ownership check.
  startEdit(contact: Contact): void {
    this.editingId.set(contact.id);
    this.formName.set(contact.name);
    this.formEmail.set(contact.email);
    this.formPhone.set(contact.phone);
    this.formPhoneAlt.set(contact.phoneAlt);
    this.formAddress.set(contact.address);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  cancelForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.formError.set(null);
  }

  saveForm(): void {
    const name = this.formName().trim();
    if (!name) {
      this.formError.set('A name is required.');
      return;
    }

    const input = {
      name,
      email: this.formEmail().trim(),
      phone: this.formPhone().trim(),
      phoneAlt: this.formPhoneAlt().trim(),
      address: this.formAddress().trim(),
    };

    this.saving.set(true);
    this.formError.set(null);
    const editingId = this.editingId();

    const request$ = editingId
      ? this.contactsService.update(editingId, input)
      : this.contactsService.create(input);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelForm();
        this.load();
        this.toast.show(editingId ? 'Contact saved' : 'Contact added');
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.error ?? 'Could not save that contact.');
      },
    });
  }

  // Any signed-in user can delete any contact (and its socials, via DB cascade).
  async deleteContact(contact: Contact): Promise<void> {
    if (!(await this.confirmService.ask(`Delete ${contact.name}? This also removes their social links.`))) {
      return;
    }
    this.contactsService.remove(contact.id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Could not delete that contact.'),
    });
  }

  startAddSocial(contactId: number): void {
    this.socialFormFor.set(contactId);
    this.editingSocialId.set(null);
    this.socialPlatform.set('');
    this.socialUrl.set('');
    this.socialError.set(null);
  }

  startEditSocial(contactId: number, social: ContactSocial): void {
    this.socialFormFor.set(contactId);
    this.editingSocialId.set(social.id);
    this.socialPlatform.set(social.platform);
    this.socialUrl.set(social.url);
    this.socialError.set(null);
  }

  cancelSocialForm(): void {
    this.socialFormFor.set(null);
    this.editingSocialId.set(null);
    this.socialError.set(null);
  }

  saveSocialForm(contactId: number): void {
    const platform = this.socialPlatform().trim();
    const url = this.socialUrl().trim();
    if (!platform || !url) {
      this.socialError.set('Platform and link are both required.');
      return;
    }

    this.socialSaving.set(true);
    this.socialError.set(null);
    const editingSocialId = this.editingSocialId();

    const request$ = editingSocialId
      ? this.contactsService.updateSocial(contactId, editingSocialId, { platform, url })
      : this.contactsService.addSocial(contactId, { platform, url });

    request$.subscribe({
      next: () => {
        this.socialSaving.set(false);
        this.cancelSocialForm();
        this.load();
        this.toast.show(editingSocialId ? 'Social link saved' : 'Social link added');
      },
      error: (err) => {
        this.socialSaving.set(false);
        this.socialError.set(err?.error?.error ?? 'Could not save that social link.');
      },
    });
  }

  async deleteSocial(contactId: number, social: ContactSocial): Promise<void> {
    if (!(await this.confirmService.ask('Delete this social link?'))) {
      return;
    }
    this.contactsService.removeSocial(contactId, social.id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Could not delete that social link.'),
    });
  }

  /** Admin-only: wipes every contact and their social links. */
  async clearAll(): Promise<void> {
    if (this.clearing()) {
      return;
    }
    if (!(await this.confirmService.ask('Delete every contact and all their social links? This cannot be undone.'))) {
      return;
    }
    this.clearing.set(true);
    this.contactsService.clearAll().subscribe({
      next: () => {
        this.clearing.set(false);
        this.load();
      },
      error: () => {
        this.clearing.set(false);
        this.error.set('Could not clear contacts.');
      },
    });
  }
}
