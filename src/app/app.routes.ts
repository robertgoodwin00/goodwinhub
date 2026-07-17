import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { FrontComponent } from './pages/front/front.component';
import { LoginComponent } from './pages/login/login.component';
import { WelcomeComponent } from './pages/welcome/welcome.component';
import { GalleryDetailComponent } from './pages/gallery-detail/gallery-detail.component';

export const routes: Routes = [
  // The only public page.
  { path: '', component: FrontComponent, pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  // Everything else lives here, behind authGuard. Add new authenticated
  // pages as siblings of `welcome` and they're protected automatically.
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'welcome', component: WelcomeComponent },
      { path: 'galleries/:id', component: GalleryDetailComponent },
    ],
  },

  { path: '**', redirectTo: '' },
];
