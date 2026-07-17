import { Component } from '@angular/core';

import { CalendarComponent } from './calendar/calendar.component';
import { ShoutboxComponent } from './shoutbox/shoutbox.component';
import { GalleryListComponent } from './galleries/gallery-list.component';
import { LinkListComponent } from './links/link-list.component';
import { ContactListComponent } from './contacts/contact-list.component';
import { NextCallBannerComponent } from './next-call-banner/next-call-banner.component';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [
    CalendarComponent,
    ShoutboxComponent,
    GalleryListComponent,
    LinkListComponent,
    ContactListComponent,
    NextCallBannerComponent,
  ],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.css',
})
export class WelcomeComponent {}
