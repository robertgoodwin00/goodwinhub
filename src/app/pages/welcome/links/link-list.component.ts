import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../core/auth.service';
import { ConfirmService } from '../../../core/confirm.service';
import { LinkItem, LinksService } from '../../../core/links.service';
import { ToastService } from '../../../core/toast.service';

interface LinkGroup {
  name: string;
  links: LinkItem[];
}

const PAGE_SIZE = 50;

@Component({
  selector: 'app-link-list',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './link-list.component.html',
  styleUrl: './link-list.component.css',
})
export class LinkListComponent implements OnInit {
  private readonly linksService = inject(LinksService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly isAdmin = this.auth.isAdmin;

  // Collapsed by default — the section is just a title bar until the
  // toggle arrow is clicked.
  readonly open = signal(false);

  readonly links = signal<LinkItem[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly clearing = signal(false);
  readonly clearingGroup = signal<string | null>(null);

  // How many links the current "window" covers (offset 0, this many).
  // Growing this and re-fetching is "load more"; re-fetching at the same
  // size after a create/edit/delete keeps whatever's already been loaded
  // in view instead of collapsing back to the first page.
  private windowSize = PAGE_SIZE;
  readonly hasMore = signal(false);

  readonly editingId = signal<number | null>(null);
  readonly formOpen = signal(false);
  readonly formName = signal('');
  readonly formTitle = signal('');
  readonly formUrl = signal('');
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  // The API returns links ordered by name, so grouping is just "start a new
  // group whenever the name changes" — no separate sort/group-by needed.
  readonly groups = computed<LinkGroup[]>(() => {
    const groups: LinkGroup[] = [];
    for (const link of this.links()) {
      const current = groups[groups.length - 1];
      if (current && current.name === link.name) {
        current.links.push(link);
      } else {
        groups.push({ name: link.name, links: [link] });
      }
    }
    return groups;
  });

  ngOnInit(): void {
    this.windowSize = PAGE_SIZE;
    this.load();
  }

  toggleOpen(): void {
    this.open.update((v) => !v);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fetchWindow();
  }

  /** Re-fetches offset 0 through the current window size, in place. */
  private refresh(): void {
    this.fetchWindow();
  }

  private fetchWindow(): void {
    this.linksService.list(0, this.windowSize).subscribe({
      next: (links) => {
        this.links.set(links);
        this.hasMore.set(links.length === this.windowSize);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.error.set('Could not load links.');
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }

  /** Grows the window by one page and re-fetches from the start. */
  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.windowSize += PAGE_SIZE;
    this.fetchWindow();
  }

  startAdd(): void {
    this.editingId.set(null);
    this.formName.set('');
    this.formTitle.set('');
    this.formUrl.set('');
    this.formError.set(null);
    this.formOpen.set(true);
  }

  // Any signed-in user can edit any link, so there's no ownership check here.
  startEdit(link: LinkItem): void {
    this.editingId.set(link.id);
    this.formName.set(link.name);
    this.formTitle.set(link.title);
    this.formUrl.set(link.url);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  cancelForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.formName.set('');
    this.formTitle.set('');
    this.formUrl.set('');
    this.formError.set(null);
  }

  saveForm(): void {
    const name = this.formName().trim();
    const title = this.formTitle().trim();
    const url = this.formUrl().trim();

    if (!name || !title || !url) {
      this.formError.set('Name, title, and link are all required.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    const editingId = this.editingId();

    const request$ = editingId
      ? this.linksService.update(editingId, { name, title, url })
      : this.linksService.create({ name, title, url });

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelForm();
        this.refresh();
        this.toast.show(editingId ? 'Link saved' : 'Link added');
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.error ?? 'Could not save that link.');
      },
    });
  }

  // Any signed-in user can delete any link, regardless of who added it.
  async deleteLink(link: LinkItem): Promise<void> {
    if (!(await this.confirmService.ask('Delete this link?'))) {
      return;
    }
    this.linksService.remove(link.id).subscribe({
      next: () => this.refresh(),
      error: () => this.error.set('Could not delete that link.'),
    });
  }

  /** Admin-only: wipes every link, across every name. */
  async clearAll(): Promise<void> {
    if (this.clearing()) {
      return;
    }
    if (!(await this.confirmService.ask('Delete every link, in every group? This cannot be undone.'))) {
      return;
    }
    this.clearing.set(true);
    this.linksService.clearAll().subscribe({
      next: () => {
        this.clearing.set(false);
        this.windowSize = PAGE_SIZE;
        this.refresh();
      },
      error: () => {
        this.clearing.set(false);
        this.error.set('Could not clear links.');
      },
    });
  }

  /** Admin-only: wipes every link sharing one dynamic group name. */
  async clearGroup(name: string): Promise<void> {
    if (this.clearingGroup()) {
      return;
    }
    if (!(await this.confirmService.ask(`Delete every link under "${name}"? This cannot be undone.`))) {
      return;
    }
    this.clearingGroup.set(name);
    this.linksService.clearByName(name).subscribe({
      next: () => {
        this.clearingGroup.set(null);
        this.refresh();
      },
      error: () => {
        this.clearingGroup.set(null);
        this.error.set(`Could not clear the "${name}" group.`);
      },
    });
  }
}
