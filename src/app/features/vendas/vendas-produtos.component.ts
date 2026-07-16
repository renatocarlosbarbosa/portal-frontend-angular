import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  catchError,
  debounceTime,
  finalize,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { VendaProdutoResumo, VendasProdutosLoja } from './vendas-produtos';
import { VendasProdutosService } from './vendas-produtos.service';

type DirecaoOrdenacao = 'asc' | 'desc';
type ColunaOrdenacaoVendas =
  | 'idProduto'
  | 'codigoSap'
  | 'descricaoProduto'
  | 'ncm'
  | 'unidade'
  | 'quantidade'
  | 'valorTotalBruto'
  | 'valorDesconto'
  | 'valorTotalLiquido';

interface OrdenacaoVendas {
  readonly coluna: ColunaOrdenacaoVendas;
  readonly direcao: DirecaoOrdenacao;
}

@Component({
  selector: 'app-vendas-produtos',
  imports: [ReactiveFormsModule],
  templateUrl: './vendas-produtos.component.html',
  styleUrl: './vendas-produtos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendasProdutosComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly vendasProdutosService = inject(VendasProdutosService);
  private readonly hoje = new Date();

  protected readonly lojas = ['101260', '101261', '101266', '107005'];
  protected readonly carregando = signal(true);
  protected readonly erroCarregamento = signal(false);
  protected readonly ordenacao = signal<OrdenacaoVendas>({
    coluna: 'descricaoProduto',
    direcao: 'asc',
  });
  protected readonly filtros = this.formBuilder.nonNullable.group({
    dataInicial: [this.obterDataHoje()],
    dataFinal: [this.obterDataHoje()],
    sapLoja: [''],
    termo: [''],
  });
  protected readonly vendas = toSignal(
    this.filtros.valueChanges.pipe(
      startWith(this.filtros.getRawValue()),
      debounceTime(300),
      tap(() => {
        this.carregando.set(true);
        this.erroCarregamento.set(false);
      }),
      switchMap((filtros) =>
        this.vendasProdutosService
          .listarVendasPorProduto({
            dataInicial: filtros.dataInicial ?? '',
            dataFinal: filtros.dataFinal ?? '',
            sapLoja: filtros.sapLoja || null,
            termo: filtros.termo || null,
          })
          .pipe(
            catchError(() => {
              this.erroCarregamento.set(true);
              return of([]);
            }),
            finalize(() => this.carregando.set(false)),
          ),
      ),
      takeUntilDestroyed(),
    ),
    { initialValue: [] },
  );
  protected readonly lojasAgrupadas = computed(() => this.agruparPorLoja(this.vendas()));
  protected readonly totalQuantidade = computed(() =>
    this.vendas().reduce((total, venda) => total + venda.quantidade, 0),
  );
  protected readonly totalBruto = computed(() =>
    this.vendas().reduce((total, venda) => total + venda.valorTotalBruto, 0),
  );
  protected readonly totalDesconto = computed(() =>
    this.vendas().reduce((total, venda) => total + venda.valorDesconto, 0),
  );
  protected readonly totalLiquido = computed(() =>
    this.vendas().reduce((total, venda) => total + venda.valorTotalLiquido, 0),
  );

  protected aplicarHoje(): void {
    const hoje = this.obterDataHoje();
    this.filtros.patchValue({
      dataInicial: hoje,
      dataFinal: hoje,
    });
  }

  protected aplicarMesAtual(): void {
    this.filtros.patchValue({
      dataInicial: new Date(this.hoje.getFullYear(), this.hoje.getMonth(), 1).toISOString().slice(0, 10),
      dataFinal: this.obterDataHoje(),
    });
  }

  protected limparFiltros(): void {
    this.filtros.patchValue({
      sapLoja: '',
      termo: '',
    });
  }

  protected formatarMoeda(valor: number | null | undefined): string {
    return this.vendasProdutosService.formatarMoeda(valor);
  }

  protected formatarQuantidade(valor: number | null | undefined): string {
    return this.vendasProdutosService.formatarQuantidade(valor);
  }

  protected formatarData(data: string | null | undefined): string {
    return this.vendasProdutosService.formatarData(data);
  }

  protected trackLoja(_: number, loja: VendasProdutosLoja): string {
    return loja.sapLoja;
  }

  protected trackProduto(_: number, venda: VendaProdutoResumo): string {
    return `${venda.sapLoja}-${venda.dataMovimentacao}-${venda.idProduto}-${venda.codigoSap ?? ''}`;
  }

  protected ordenarPor(coluna: ColunaOrdenacaoVendas): void {
    const atual = this.ordenacao();
    const direcaoInicial: DirecaoOrdenacao = [
      'quantidade',
      'valorTotalBruto',
      'valorDesconto',
      'valorTotalLiquido',
    ].includes(coluna)
      ? 'desc'
      : 'asc';

    this.ordenacao.set({
      coluna,
      direcao: atual.coluna === coluna ? (atual.direcao === 'asc' ? 'desc' : 'asc') : direcaoInicial,
    });
  }

  protected indicadorOrdenacao(coluna: ColunaOrdenacaoVendas): string {
    const ordenacao = this.ordenacao();

    if (ordenacao.coluna !== coluna) {
      return '-';
    }

    return ordenacao.direcao === 'asc' ? '^' : 'v';
  }

  protected ariaSort(coluna: ColunaOrdenacaoVendas): 'ascending' | 'descending' | 'none' {
    const ordenacao = this.ordenacao();

    if (ordenacao.coluna !== coluna) {
      return 'none';
    }

    return ordenacao.direcao === 'asc' ? 'ascending' : 'descending';
  }

  private agruparPorLoja(vendas: readonly VendaProdutoResumo[]): readonly VendasProdutosLoja[] {
    const grupos = new Map<string, VendaProdutoResumo[]>();
    const ordenacao = this.ordenacao();

    for (const venda of vendas) {
      const itens = grupos.get(venda.sapLoja) ?? [];
      grupos.set(venda.sapLoja, [...itens, venda]);
    }

    return Array.from(grupos.entries())
      .sort(([lojaA], [lojaB]) => lojaA.localeCompare(lojaB))
      .map(([sapLoja, itens]) => ({
        sapLoja,
        itens: itens.slice().sort((a, b) => {
          const comparacao = this.compararVendas(a, b, ordenacao.coluna);
          return ordenacao.direcao === 'asc' ? comparacao : comparacao * -1;
        }),
        quantidade: this.somar(itens, 'quantidade'),
        valorTotalBruto: this.somar(itens, 'valorTotalBruto'),
        valorDesconto: this.somar(itens, 'valorDesconto'),
        valorTotalLiquido: this.somar(itens, 'valorTotalLiquido'),
      }));
  }

  private compararVendas(
    vendaA: VendaProdutoResumo,
    vendaB: VendaProdutoResumo,
    coluna: ColunaOrdenacaoVendas,
  ): number {
    switch (coluna) {
      case 'idProduto':
      case 'quantidade':
      case 'valorTotalBruto':
      case 'valorDesconto':
      case 'valorTotalLiquido':
        return vendaA[coluna] - vendaB[coluna];
      case 'codigoSap':
      case 'descricaoProduto':
      case 'ncm':
      case 'unidade':
        return this.compararTexto(vendaA[coluna], vendaB[coluna]);
    }
  }

  private compararTexto(valorA: string | null | undefined, valorB: string | null | undefined): number {
    return (valorA ?? '').localeCompare(valorB ?? '', 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    });
  }

  private somar(
    vendas: readonly VendaProdutoResumo[],
    campo: 'quantidade' | 'valorTotalBruto' | 'valorDesconto' | 'valorTotalLiquido',
  ): number {
    return vendas.reduce((total, venda) => total + venda[campo], 0);
  }

  private obterDataHoje(): string {
    return this.hoje.toISOString().slice(0, 10);
  }
}
