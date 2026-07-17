import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Apply this to every route (or route group) that isn't the public front
 * page. It asks the server if the session cookie is valid and redirects to
 * /login when it isn't.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth
    .checkSession()
    .pipe(map((authenticated) => authenticated || router.createUrlTree(['/login'])));
};
