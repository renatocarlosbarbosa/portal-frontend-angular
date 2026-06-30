import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { AuthUser } from './auth-user';

interface LoginResponse {
  readonly token: string;
  readonly tipo: string;
  readonly expiraEm: string;
  readonly idUsuario: number;
  readonly nome: string;
  readonly email: string;
  readonly perfis: readonly string[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly storageTokenKey = 'portal_a2r2_token';
  private readonly httpClient = inject(HttpClient);
  private readonly currentToken = signal<string | null>(localStorage.getItem(this.storageTokenKey));
  private readonly currentUser = signal<AuthUser | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly token = this.currentToken.asReadonly();
  readonly isAuthenticated = computed(() => this.currentToken() !== null);

  login(email: string, senha: string): Observable<void> {
    return this.httpClient
      .post<LoginResponse>('/auth/login', {
        email,
        senha,
      })
      .pipe(
        tap((response) => {
          localStorage.setItem(this.storageTokenKey, response.token);
          this.currentToken.set(response.token);
          this.currentUser.set({
            name: response.nome,
            email: response.email,
            roles: response.perfis,
          });
        }),
        map(() => undefined),
      );
  }

  logout(): void {
    localStorage.removeItem(this.storageTokenKey);
    this.currentToken.set(null);
    this.currentUser.set(null);
  }
}
