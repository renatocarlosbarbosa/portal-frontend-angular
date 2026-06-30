import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ProdutoEstoque,
  ProdutoEstoqueFiltros,
  ProdutoEstoqueFlagFiltro,
  ProdutoEstoqueLinha,
  ProdutoEstoqueMatriz,
} from './produto-estoque';

@Injectable({
  providedIn: 'root',
})
export class ProdutoEstoqueService {
  private readonly httpClient = inject(HttpClient);

  listarMatriz(filtros: ProdutoEstoqueFiltros, limite = 500): Observable<ProdutoEstoqueMatriz> {
    return this.httpClient
      .get<readonly ProdutoEstoque[]>('/api/estoque/produtos', {
        params: this.criarParametrosConsulta(filtros, limite),
      })
      .pipe(map((produtos) => this.criarMatriz(produtos)));
  }

  formatarQuantidade(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    });
  }

  private criarMatriz(produtos: readonly ProdutoEstoque[]): ProdutoEstoqueMatriz {
    const lojas = Array.from(new Set(produtos.map((produto) => produto.sapLoja))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { numeric: true }),
    );
    const linhasPorProduto = new Map<number, ProdutoEstoqueLinha>();

    for (const produto of produtos) {
      const linhaAtual = linhasPorProduto.get(produto.idProduto);
      const quantidadePorLoja = {
        ...(linhaAtual?.quantidadePorLoja ?? {}),
      };
      const quantidadeAtual = quantidadePorLoja[produto.sapLoja] ?? 0;

      quantidadePorLoja[produto.sapLoja] = quantidadeAtual + produto.quantidadeEstoque;

      linhasPorProduto.set(produto.idProduto, {
        idProduto: produto.idProduto,
        numeroEan: produto.numeroEan,
        descricaoProduto: produto.descricaoProduto,
        subgrupoNome: produto.subgrupoNome,
        unidadeMedidaAbreviacao: produto.unidadeMedidaAbreviacao,
        quantidadePorLoja,
        total: Object.values(quantidadePorLoja).reduce((total, quantidade) => total + quantidade, 0),
      });
    }

    return {
      lojas,
      linhas: Array.from(linhasPorProduto.values()).sort((a, b) =>
        a.descricaoProduto.localeCompare(b.descricaoProduto, 'pt-BR'),
      ),
    };
  }

  private criarParametrosConsulta(
    filtros: ProdutoEstoqueFiltros,
    limite: number,
  ): Record<string, string | number> {
    const params: Record<string, string | number> = {
      limite,
      termo: filtros.termo,
    };

    this.adicionarFiltroFlag(params, 'ativo', filtros.ativo);
    this.adicionarFiltroFlag(params, 'ativoVenda', filtros.ativoVenda);

    return params;
  }

  private adicionarFiltroFlag(
    params: Record<string, string | number>,
    nome: string,
    valor: ProdutoEstoqueFlagFiltro,
  ): void {
    if (valor !== 'todos') {
      params[nome] = valor;
    }
  }
}
