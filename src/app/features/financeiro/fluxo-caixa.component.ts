import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { FluxoCaixaService } from './fluxo-caixa.service';
import { FluxoCaixaLinha } from './fluxo-caixa';

type DirecaoOrdenacao = 'asc' | 'desc';
type ColunaOrdenacaoFluxo = 'data' | 'entradas' | 'saidas' | 'saldo' | 'saldoAcumulado' | `loja:${string}`;

interface OrdenacaoFluxo {
  readonly coluna: ColunaOrdenacaoFluxo;
  readonly direcao: DirecaoOrdenacao;
}

@Component({
  selector: 'app-fluxo-caixa',
  imports: [ReactiveFormsModule],
  templateUrl: './fluxo-caixa.component.html',
  styleUrl: './fluxo-caixa.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FluxoCaixaComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly fluxoCaixaService = inject(FluxoCaixaService);
  private readonly hoje = new Date();

  protected readonly carregando = signal(true);
  protected readonly erroCarregamento = signal(false);
  protected readonly ordenacao = signal<OrdenacaoFluxo>({
    coluna: 'data',
    direcao: 'asc',
  });
  protected readonly filtros = this.formBuilder.nonNullable.group({
    dataInicial: [this.obterPrimeiroDiaMes()],
    dataFinal: [this.obterDataHoje()],
  });
  protected readonly resumo = toSignal(
    this.filtros.valueChanges.pipe(
      startWith(this.filtros.getRawValue()),
      debounceTime(250),
      distinctUntilChanged((anterior, atual) => JSON.stringify(anterior) === JSON.stringify(atual)),
      tap(() => {
        this.carregando.set(true);
        this.erroCarregamento.set(false);
      }),
      switchMap((filtros) =>
        this.fluxoCaixaService.listarFluxo(filtros.dataInicial ?? '', filtros.dataFinal ?? '').pipe(
          catchError(() => {
            this.erroCarregamento.set(true);
            return of({
              lojas: [],
              linhas: [],
              saldoPeriodo: 0,
              totalEntradas: 0,
              totalSaidas: 0,
            });
          }),
          finalize(() => this.carregando.set(false)),
        ),
      ),
      takeUntilDestroyed(),
    ),
    {
      initialValue: {
        lojas: [],
        linhas: [],
        saldoPeriodo: 0,
        totalEntradas: 0,
        totalSaidas: 0,
      },
    },
  );
  protected readonly saldoClasse = computed(() =>
    this.resumo().saldoPeriodo >= 0 ? 'value--positive' : 'value--negative',
  );
  protected readonly diasPeriodo = computed(() => this.resumo().linhas.length);
  protected readonly linhasOrdenadas = computed(() => {
    const ordenacao = this.ordenacao();

    return this.resumo().linhas.slice().sort((linhaA, linhaB) => {
      const comparacao = this.compararLinhas(linhaA, linhaB, ordenacao.coluna);
      return ordenacao.direcao === 'asc' ? comparacao : comparacao * -1;
    });
  });
  protected readonly mediaDiaria = computed(() => {
    const dias = this.diasPeriodo();

    return dias > 0 ? this.resumo().saldoPeriodo / dias : 0;
  });

  protected formatarMoeda(valor: number | undefined): string {
    if (valor === undefined) {
      return '-';
    }

    return this.fluxoCaixaService.formatarMoeda(valor);
  }

  protected aplicarMesAtual(): void {
    this.filtros.setValue({
      dataInicial: this.obterPrimeiroDiaMes(),
      dataFinal: this.obterDataHoje(),
    });
  }

  protected aplicarProximos30Dias(): void {
    const dataFinal = new Date(this.hoje);
    dataFinal.setDate(dataFinal.getDate() + 30);

    this.filtros.setValue({
      dataInicial: this.obterDataHoje(),
      dataFinal: dataFinal.toISOString().slice(0, 10),
    });
  }

  protected ordenarPor(coluna: ColunaOrdenacaoFluxo): void {
    const atual = this.ordenacao();
    const direcaoInicial: DirecaoOrdenacao = coluna === 'data' ? 'asc' : 'desc';

    this.ordenacao.set({
      coluna,
      direcao: atual.coluna === coluna ? (atual.direcao === 'asc' ? 'desc' : 'asc') : direcaoInicial,
    });
  }

  protected colunaLoja(loja: string): ColunaOrdenacaoFluxo {
    return `loja:${loja}`;
  }

  protected indicadorOrdenacao(coluna: ColunaOrdenacaoFluxo): string {
    const ordenacao = this.ordenacao();

    if (ordenacao.coluna !== coluna) {
      return '-';
    }

    return ordenacao.direcao === 'asc' ? '^' : 'v';
  }

  protected ariaSort(coluna: ColunaOrdenacaoFluxo): 'ascending' | 'descending' | 'none' {
    const ordenacao = this.ordenacao();

    if (ordenacao.coluna !== coluna) {
      return 'none';
    }

    return ordenacao.direcao === 'asc' ? 'ascending' : 'descending';
  }

  private compararLinhas(
    linhaA: FluxoCaixaLinha,
    linhaB: FluxoCaixaLinha,
    coluna: ColunaOrdenacaoFluxo,
  ): number {
    if (coluna.startsWith('loja:')) {
      const loja = coluna.replace('loja:', '');
      return (linhaA.saldoPorLoja[loja] ?? 0) - (linhaB.saldoPorLoja[loja] ?? 0);
    }

    switch (coluna) {
      case 'data':
        return linhaA.dataMovimento.localeCompare(linhaB.dataMovimento);
      case 'entradas':
        return linhaA.entradas - linhaB.entradas;
      case 'saidas':
        return linhaA.saidas - linhaB.saidas;
      case 'saldo':
        return linhaA.saldo - linhaB.saldo;
      case 'saldoAcumulado':
        return linhaA.saldoAcumulado - linhaB.saldoAcumulado;
    }

    return 0;
  }

  private obterPrimeiroDiaMes(): string {
    return new Date(this.hoje.getFullYear(), this.hoje.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
  }

  private obterDataHoje(): string {
    return this.hoje.toISOString().slice(0, 10);
  }
}
