import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.token();

  if (!token || (!request.url.startsWith('/api') && !request.url.startsWith('/auth/me'))) {
    return next(request);
  }

  const requestWithToken = request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(requestWithToken).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        authService.logout();
        void router.navigate(['/login'], {
          queryParams: {
            redirectTo: router.url,
          },
        });
      }

      return throwError(() => error);
    }),
  );
};
