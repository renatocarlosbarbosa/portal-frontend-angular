import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, tap } from 'rxjs';

import { VendasDashboardService } from './vendas-dashboard.service';
import { DiaResumoVendas, LojaResumoDiario } from './vendas-resumo-diario';

type DirecaoOrdenacao = 'asc' | 'desc';
type OrdenacaoDashboard = {
  readonly coluna: string;
  readonly direcao: DirecaoOrdenacao;
};

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
  protected readonly ordenacao = signal<OrdenacaoDashboard>({
    coluna: 'sap_loja',
    direcao: 'asc',
  });
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
  protected readonly resumoOrdenado = computed(() =>
    this.resumoPorDia().map((dia) => ({
      ...dia,
      lojas: this.ordenarLojas(dia),
    })),
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

  protected ordenarPor(coluna: string): void {
    this.ordenacao.update((ordenacaoAtual) => ({
      coluna,
      direcao: ordenacaoAtual.coluna === coluna ? (ordenacaoAtual.direcao === 'asc' ? 'desc' : 'asc') : 'asc',
    }));
  }

  protected indicadorOrdenacao(coluna: string): string {
    const ordenacao = this.ordenacao();

    if (ordenacao.coluna !== coluna) {
      return '-';
    }

    return ordenacao.direcao === 'asc' ? '^' : 'v';
  }

  protected ariaSort(coluna: string): 'ascending' | 'descending' | 'none' {
    const ordenacao = this.ordenacao();

    if (ordenacao.coluna !== coluna) {
      return 'none';
    }

    return ordenacao.direcao === 'asc' ? 'ascending' : 'descending';
  }

  private ordenarLojas(dia: DiaResumoVendas): readonly LojaResumoDiario[] {
    const ordenacao = this.ordenacao();

    return dia.lojas.slice().sort((lojaA, lojaB) => {
      const comparacao = this.compararLojas(lojaA, lojaB, ordenacao.coluna);
      return ordenacao.direcao === 'asc' ? comparacao : comparacao * -1;
    });
  }

  private compararLojas(lojaA: LojaResumoDiario, lojaB: LojaResumoDiario, coluna: string): number {
    if (coluna === 'sap_loja') {
      return lojaA.sapLoja.localeCompare(lojaB.sapLoja, 'pt-BR', { numeric: true });
    }

    return this.valorIndicador(lojaA, coluna) - this.valorIndicador(lojaB, coluna);
  }

  private valorIndicador(loja: LojaResumoDiario, coluna: string): number {
    const valor = loja.indicadores.find((indicador) => indicador.label === coluna)?.value ?? '0';
    const normalizado = valor
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const numero = Number(normalizado);

    return Number.isFinite(numero) ? numero : 0;
  }
}
