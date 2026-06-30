import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, tap } from 'rxjs';

import { VendasDashboardService } from './vendas-dashboard.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly vendasDashboardService = inject(VendasDashboardService);

  protected readonly carregando = signal(true);
  protected readonly erroCarregamento = signal(false);
  protected readonly resumoPorDia = toSignal(
    this.vendasDashboardService.listarResumoPorDia().pipe(
      tap(() => this.erroCarregamento.set(false)),
      catchError(() => {
        this.erroCarregamento.set(true);
        return of([]);
      }),
      finalize(() => this.carregando.set(false)),
    ),
    { initialValue: [] },
  );
  protected readonly diasExpandidos = signal<ReadonlySet<string>>(new Set());
  protected readonly totalDias = computed(() => this.resumoPorDia().length);
  protected readonly totalLojas = computed(
    () => new Set(this.resumoPorDia().flatMap((dia) => dia.lojas.map((loja) => loja.sapLoja))).size,
  );
  protected readonly periodoResumo = computed(() => {
    const dias = this.resumoPorDia();

    if (dias.length === 0) {
      return 'Sem periodo';
    }

    const primeiroDia = dias[dias.length - 1]?.dataLabel;
    const ultimoDia = dias[0]?.dataLabel;

    return primeiroDia === ultimoDia ? ultimoDia : `${primeiroDia} a ${ultimoDia}`;
  });
  protected readonly todosExpandidos = computed(
    () => this.resumoPorDia().length > 0 && this.diasExpandidos().size === this.resumoPorDia().length,
  );

  protected alternarDia(data: string): void {
    this.diasExpandidos.update((diasAtuais) => {
      const proximosDias = new Set(diasAtuais);

      if (proximosDias.has(data)) {
        proximosDias.delete(data);
        return proximosDias;
      }

      proximosDias.add(data);
      return proximosDias;
    });
  }

  protected diaEstaExpandido(data: string): boolean {
    return this.diasExpandidos().has(data);
  }

  protected alternarTodos(): void {
    if (this.todosExpandidos()) {
      this.diasExpandidos.set(new Set());
      return;
    }

    this.diasExpandidos.set(new Set(this.resumoPorDia().map((dia) => dia.data)));
  }
}
