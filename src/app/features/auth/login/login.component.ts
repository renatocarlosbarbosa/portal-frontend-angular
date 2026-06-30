import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly submitted = signal(false);
  protected readonly loading = signal(false);
  protected readonly loginError = signal(false);
  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['grupoa2r2@gmail.com', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  protected readonly hasFormError = computed(() => this.submitted() && this.form.invalid);

  protected submit(): void {
    this.submitted.set(true);
    this.loginError.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.authService
      .login(this.form.controls.email.value, this.form.controls.password.value)
      .subscribe({
        next: () => {
          this.loading.set(false);
          const redirectTo =
            this.activatedRoute.snapshot.queryParamMap.get('redirectTo') ?? '/dashboard';

          void this.router.navigateByUrl(redirectTo);
        },
        error: () => {
          this.loading.set(false);
          this.loginError.set(true);
        },
      });
  }
}
