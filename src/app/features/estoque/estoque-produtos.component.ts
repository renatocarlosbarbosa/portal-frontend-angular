import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { ProdutoEstoqueFlagFiltro, ProdutoEstoqueLinha } from './produto-estoque';
import { ProdutoEstoqueService } from './produto-estoque.service';

type EstoqueSortColumn = 'produto' | 'ean' | 'subgrupo' | 'total' | `loja:${string}`;
type SortDirection = 'asc' | 'desc';

interface EstoqueSortState {
  readonly column: EstoqueSortColumn;
  readonly direction: SortDirection;
}

@Component({
  selector: 'app-estoque-produtos',
  imports: [ReactiveFormsModule],
  templateUrl: './estoque-produtos.component.html',
  styleUrl: './estoque-produtos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstoqueProdutosComponent {
  private readonly produtoEstoqueService = inject(ProdutoEstoqueService);

  protected readonly filtro = new FormControl('', { nonNullable: true });
  protected readonly filtroAtivo = new FormControl<ProdutoEstoqueFlagFiltro>('true', { nonNullable: true });
  protected readonly filtroAtivoVenda = new FormControl<ProdutoEstoqueFlagFiltro>('true', { nonNullable: true });
  protected readonly carregando = signal(true);
  protected readonly erroCarregamento = signal(false);
  protected readonly ordenacao = signal<EstoqueSortState>({
    column: 'produto',
    direction: 'asc',
  });
  protected readonly matriz = toSignal(
    combineLatest([
      this.filtro.valueChanges.pipe(startWith(this.filtro.value)),
      this.filtroAtivo.valueChanges.pipe(startWith(this.filtroAtivo.value)),
      this.filtroAtivoVenda.valueChanges.pipe(startWith(this.filtroAtivoVenda.value)),
    ]).pipe(
      debounceTime(350),
      distinctUntilChanged(
        ([termoAnterior, ativoAnterior, ativoVendaAnterior], [termoAtual, ativoAtual, ativoVendaAtual]) =>
          termoAnterior === termoAtual &&
          ativoAnterior === ativoAtual &&
          ativoVendaAnterior === ativoVendaAtual,
      ),
      tap(() => {
        this.carregando.set(true);
        this.erroCarregamento.set(false);
      }),
      switchMap(([termo, ativo, ativoVenda]) =>
        this.produtoEstoqueService.listarMatriz({ termo, ativo, ativoVenda }).pipe(
          catchError(() => {
            this.erroCarregamento.set(true);
            return of({ lojas: [], linhas: [] });
          }),
          finalize(() => this.carregando.set(false)),
        ),
      ),
      takeUntilDestroyed(),
    ),
    { initialValue: { lojas: [], linhas: [] } },
  );
  protected readonly totalQuantidade = computed(() =>
    this.matriz().linhas.reduce((total, linha) => total + linha.total, 0),
  );
  protected readonly linhasOrdenadas = computed(() => {
    const estado = this.ordenacao();

    return [...this.matriz().linhas].sort((linhaA, linhaB) => {
      const resultado = this.compararLinhas(linhaA, linhaB, estado.column);

      return estado.direction === 'asc' ? resultado : resultado * -1;
    });
  });

  protected formatarQuantidade(valor: number | undefined): string {
    if (!valor) {
      return '-';
    }

    return this.produtoEstoqueService.formatarQuantidade(valor);
  }

  protected limparFiltro(): void {
    this.filtro.setValue('');
    this.filtroAtivo.setValue('true');
    this.filtroAtivoVenda.setValue('true');
  }

  protected ordenarPorLoja(sapLoja: string): void {
    this.alternarOrdenacao(`loja:${sapLoja}`);
  }

  protected ordenarPorTotal(): void {
    this.alternarOrdenacao('total');
  }

  protected ordenarPorProduto(): void {
    this.alternarOrdenacao('produto');
  }

  protected ordenarPorEan(): void {
    this.alternarOrdenacao('ean');
  }

  protected ordenarPorSubgrupo(): void {
    this.alternarOrdenacao('subgrupo');
  }

  protected indicadorOrdenacao(coluna: EstoqueSortColumn): string {
    const estado = this.ordenacao();

    if (estado.column !== coluna) {
      return '-';
    }

    return estado.direction === 'asc' ? '^' : 'v';
  }

  protected ariaSort(coluna: EstoqueSortColumn): 'ascending' | 'descending' | 'none' {
    const estado = this.ordenacao();

    if (estado.column !== coluna) {
      return 'none';
    }

    return estado.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected colunaLoja(sapLoja: string): EstoqueSortColumn {
    return `loja:${sapLoja}`;
  }

  private alternarOrdenacao(coluna: EstoqueSortColumn): void {
    this.ordenacao.update((estadoAtual) => {
      if (estadoAtual.column !== coluna) {
        return {
          column: coluna,
          direction: coluna === 'produto' || coluna === 'ean' || coluna === 'subgrupo' ? 'asc' : 'desc',
        };
      }

      return {
        column: coluna,
        direction: estadoAtual.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  }

  private compararLinhas(
    linhaA: ProdutoEstoqueLinha,
    linhaB: ProdutoEstoqueLinha,
    coluna: EstoqueSortColumn,
  ): number {
    if (coluna === 'produto') {
      return linhaA.descricaoProduto.localeCompare(linhaB.descricaoProduto, 'pt-BR');
    }

    if (coluna === 'ean') {
      return (linhaA.numeroEan ?? '').localeCompare(linhaB.numeroEan ?? '', 'pt-BR', { numeric: true });
    }

    if (coluna === 'subgrupo') {
      return (linhaA.subgrupoNome ?? '').localeCompare(linhaB.subgrupoNome ?? '', 'pt-BR', { sensitivity: 'base' });
    }

    if (coluna === 'total') {
      return linhaA.total - linhaB.total;
    }

    const sapLoja = coluna.replace('loja:', '');

    return (linhaA.quantidadePorLoja[sapLoja] ?? 0) - (linhaB.quantidadePorLoja[sapLoja] ?? 0);
  }
}
