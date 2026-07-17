import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CalendarEventsService } from '../../../core/calendar-events.service';
import { NextCallService } from '../../../core/next-call.service';
import { ToastService } from '../../../core/toast.service';

interface TimeOption {
  value: string;
  label: string;
}

// Same 15-minute-increment time picker as the calendar's event form.
const TIME_OPTIONS: TimeOption[] = buildTimeOptions();

function buildTimeOptions(): TimeOption[] {
  const options: TimeOption[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      options.push({ value, label: `${displayHour}:${String(m).padStart(2, '0')} ${period}` });
    }
  }
  return options;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Rounds down to the nearest 15 minutes so the dropdown always has a
// matching option pre-selected when editing an existing time.
function toHHMM(date: Date): string {
  const h = date.getHours();
  const roundedMinute = date.getMinutes() - (date.getMinutes() % 15);
  return `${String(h).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`;
}

@Component({
  selector: 'app-next-call-banner',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './next-call-banner.component.html',
  styleUrl: './next-call-banner.component.css',
})
export class NextCallBannerComponent implements OnInit {
  private readonly nextCallService = inject(NextCallService);
  private readonly calendarEventsService = inject(CalendarEventsService);
  private readonly toast = inject(ToastService);

  readonly timeOptions = TIME_OPTIONS;

  readonly startsAt = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly editing = signal(false);
  readonly formDate = signal('');
  readonly formTime = signal('09:00');
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.nextCallService.get().subscribe({
      next: (startsAt) => {
        this.startsAt.set(startsAt);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load the next call time.');
        this.loading.set(false);
      },
    });
  }

  displayText(): string {
    const iso = this.startsAt();
    if (!iso) {
      return 'Not scheduled yet';
    }
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  startEdit(): void {
    const iso = this.startsAt();
    const base = iso ? new Date(iso) : new Date();
    this.formDate.set(toIsoDate(base));
    this.formTime.set(toHHMM(base));
    this.formError.set(null);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.formError.set(null);
  }

  save(): void {
    const date = this.formDate();
    const time = this.formTime();
    if (!date || !time) {
      this.formError.set('Pick both a date and a time.');
      return;
    }

    const startsAt = new Date(`${date}T${time}:00`).toISOString();
    if (Number.isNaN(new Date(startsAt).getTime())) {
      this.formError.set('That date/time looks invalid.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.nextCallService.update(startsAt).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.startsAt.set(updated);
        this.editing.set(false);
        this.toast.show('Next call updated');
        this.checkConflict(startsAt);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.error ?? 'Could not save that time.');
      },
    });
  }

  // Warns (doesn't block) if the chosen date falls on the same calendar day
  // as a regular event, regardless of time. Birthdays/holidays ('special'
  // events) are intentionally excluded — those are expected to land on all
  // sorts of days regardless.
  private checkConflict(startsAtIso: string): void {
    const date = new Date(startsAtIso);
    const monthParam = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const targetDay = toIsoDate(date);

    this.calendarEventsService.list(monthParam).subscribe({
      next: (events) => {
        const conflict = events.find(
          (event) => event.type === 'event' && toIsoDate(new Date(event.startsAt)) === targetDay,
        );
        if (conflict) {
          this.toast.show(`Heads up: this is the same day as "${conflict.title}" on the calendar.`, {
            type: 'warning',
          });
        }
      },
      // Conflict-checking is a nice-to-have — a failed check shouldn't
      // surface its own error on top of an otherwise-successful save.
      error: () => {},
    });
  }
}
