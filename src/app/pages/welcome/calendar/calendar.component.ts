import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../core/auth.service';
import { CalendarEvent, CalendarEventsService } from '../../../core/calendar-events.service';
import { ConfirmService } from '../../../core/confirm.service';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface DayCell {
  iso: string;
  dayNumber: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  events: CalendarEvent[];
}

interface TimeOption {
  value: string;
  label: string;
}

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

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
})
export class CalendarComponent implements OnInit {
  private readonly eventsService = inject(CalendarEventsService);
  private readonly auth = inject(AuthService);
  private readonly confirmService = inject(ConfirmService);

  readonly isAdmin = this.auth.isAdmin;
  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly timeOptions = TIME_OPTIONS;

  private readonly today = new Date();
  readonly viewYear = signal(this.today.getFullYear());
  readonly viewMonth = signal(this.today.getMonth()); // 0-indexed

  readonly events = signal<CalendarEvent[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly clearing = signal(false);

  readonly selectedDate = signal<string | null>(null);

  readonly editingId = signal<number | null>(null);
  readonly formOpen = signal(false);
  readonly formTitle = signal('');
  readonly formTime = signal('09:00');
  readonly formDetails = signal('');
  readonly formIsSpecial = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly monthLabel = computed(() => `${MONTH_LABELS[this.viewMonth()]} ${this.viewYear()}`);

  readonly days = computed<DayCell[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const eventsByDay = new Map<string, CalendarEvent[]>();

    for (const event of this.events()) {
      const iso = isoDateForEvent(event);
      const list = eventsByDay.get(iso) ?? [];
      list.push(event);
      eventsByDay.set(iso, list);
    }
    for (const list of eventsByDay.values()) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }

    const firstOfMonth = new Date(year, month, 1);
    const leadingBlanks = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;
    const todayIso = toIsoDate(this.today);

    const cells: DayCell[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNumber = i - leadingBlanks + 1;
      const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
      const cellDate = new Date(year, month, dayNumber);
      const iso = toIsoDate(cellDate);

      cells.push({
        iso,
        dayNumber: cellDate.getDate(),
        isToday: iso === todayIso,
        isCurrentMonth,
        events: eventsByDay.get(iso) ?? [],
      });
    }
    return cells;
  });

  readonly selectedDayEvents = computed(() => {
    const iso = this.selectedDate();
    if (!iso) {
      return [];
    }
    return this.days().find((d) => d.iso === iso)?.events ?? [];
  });

  ngOnInit(): void {
    this.loadMonth();
  }

  private monthParam(): string {
    return `${this.viewYear()}-${String(this.viewMonth() + 1).padStart(2, '0')}`;
  }

  private loadMonth(): void {
    this.loading.set(true);
    this.error.set(null);
    this.eventsService.list(this.monthParam()).subscribe({
      next: (events) => {
        this.events.set(events);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load the calendar.');
        this.loading.set(false);
      },
    });
  }

  prevMonth(): void {
    this.shiftMonth(-1);
  }

  nextMonth(): void {
    this.shiftMonth(1);
  }

  goToToday(): void {
    this.viewYear.set(this.today.getFullYear());
    this.viewMonth.set(this.today.getMonth());
    this.selectedDate.set(toIsoDate(this.today));
    this.cancelForm();
    this.loadMonth();
  }

  private shiftMonth(delta: number): void {
    let month = this.viewMonth() + delta;
    let year = this.viewYear();
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    this.viewYear.set(year);
    this.viewMonth.set(month);
    this.cancelForm();
    this.loadMonth();
  }

  selectDay(day: DayCell): void {
    this.cancelForm();
    this.selectedDate.set(day.iso);
  }

  startAdd(): void {
    if (!this.selectedDate()) {
      return;
    }
    this.editingId.set(null);
    this.formTitle.set('');
    this.formDetails.set('');
    this.formIsSpecial.set(false);
    this.formError.set(null);
    this.formTime.set('09:00');
    this.formOpen.set(true);
  }

  startEdit(event: CalendarEvent): void {
    if (!this.canEdit(event)) {
      return;
    }
    this.editingId.set(event.id);
    this.formTitle.set(event.title);
    this.formDetails.set(event.details);
    this.formIsSpecial.set(event.type === 'special');
    this.formError.set(null);
    this.formTime.set(eventHHMM(event));
    this.formOpen.set(true);
  }

  cancelForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.formTitle.set('');
    this.formTime.set('09:00');
    this.formDetails.set('');
    this.formIsSpecial.set(false);
    this.formError.set(null);
  }

  canEdit(event: CalendarEvent): boolean {
    return event.type !== 'special' || this.isAdmin();
  }

  saveForm(): void {
    const iso = this.selectedDate();
    const title = this.formTitle().trim();
    const details = this.formDetails().trim();
    const time = this.formTime();

    if (!iso || !title || !details || !time) {
      this.formError.set('Title, time, and details are all required.');
      return;
    }

    const isSpecial = this.formIsSpecial() && this.isAdmin();

    // Special events are UTC-anchored: the month/day/time typed is taken
    // literally as UTC, so it repeats on the same calendar date for every
    // viewer regardless of timezone. Regular events use real local time,
    // converted properly to a true UTC instant, since an actual meeting
    // time needs to mean the same moment everywhere.
    const startsAt = isSpecial
      ? `${iso}T${time}:00Z`
      : new Date(`${iso}T${time}:00`).toISOString();

    if (Number.isNaN(new Date(startsAt).getTime())) {
      this.formError.set('That date/time looks invalid.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    const editingId = this.editingId();

    const request$ = editingId
      ? this.eventsService.update(editingId, { startsAt, title, details })
      : this.eventsService.create({
          startsAt,
          title,
          details,
          type: isSpecial ? 'special' : 'event',
        });

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelForm();
        this.loadMonth();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.error ?? 'Could not save that event.');
      },
    });
  }

  async deleteEvent(event: CalendarEvent): Promise<void> {
    if (!this.canEdit(event)) {
      return;
    }
    if (!(await this.confirmService.ask('Delete this event?'))) {
      return;
    }

    this.eventsService.remove(event.id).subscribe({
      next: () => this.loadMonth(),
      error: () => this.error.set('Could not delete that event.'),
    });
  }

  formatEventTime(event: CalendarEvent): string {
    const { hour, minute } = eventHourMinute(event);
    if (hour === 0 && minute === 0) {
      return 'All day';
    }
    const period = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
  }

  formatSelectedDate(): string {
    const iso = this.selectedDate();
    if (!iso) {
      return '';
    }
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  async clearRegularEvents(): Promise<void> {
    if (this.clearing()) {
      return;
    }
    if (
      !(await this.confirmService.ask(
        'Delete every regular event — every month, past and future? This cannot be undone.',
      ))
    ) {
      return;
    }
    this.clearing.set(true);
    this.eventsService.clearAll('event').subscribe({
      next: () => {
        this.clearing.set(false);
        this.loadMonth();
      },
      error: () => {
        this.clearing.set(false);
        this.error.set('Could not clear events.');
      },
    });
  }

  async clearSpecialEvents(): Promise<void> {
    if (this.clearing()) {
      return;
    }
    if (!(await this.confirmService.ask('Delete every birthday/holiday? This cannot be undone.'))) {
      return;
    }
    this.clearing.set(true);
    this.eventsService.clearAll('special').subscribe({
      next: () => {
        this.clearing.set(false);
        this.loadMonth();
      },
      error: () => {
        this.clearing.set(false);
        this.error.set('Could not clear birthdays/holidays.');
      },
    });
  }
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Special events are UTC-anchored (see saveForm), so their calendar date
 * has to be read back out using UTC getters too, or the day they land on
 * would drift depending on the viewer's own timezone. Regular events use
 * ordinary local time, same as before.
 */
function eventHourMinute(event: CalendarEvent): { hour: number; minute: number } {
  const date = new Date(event.startsAt);
  return event.type === 'special'
    ? { hour: date.getUTCHours(), minute: date.getUTCMinutes() }
    : { hour: date.getHours(), minute: date.getMinutes() };
}

function eventHHMM(event: CalendarEvent): string {
  const { hour, minute } = eventHourMinute(event);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function isoDateForEvent(event: CalendarEvent): string {
  const date = new Date(event.startsAt);
  if (event.type === 'special') {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return toIsoDate(date);
}
