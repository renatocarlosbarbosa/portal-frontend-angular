import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { VendaProdutoResumo } from './vendas-produtos';

@Injectable({
  providedIn: 'root',
})
export class VendasProdutosService {
  private readonly httpClient = inject(HttpClient);

  listarVendasPorProduto(filtros: {
    dataInicial: string;
    dataFinal: string;
    sapLoja?: string | null;
    termo?: string | null;
    limite?: number;
  }): Observable<readonly VendaProdutoResumo[]> {
    return this.httpClient.get<readonly VendaProdutoResumo[]>('/api/vendas/produtos', {
      params: this.criarParams({ limite: 1500, ...filtros }),
    });
  }

  formatarMoeda(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('pt-BR', {
      currency: 'BRL',
      style: 'currency',
    });
  }

  formatarQuantidade(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('pt-BR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }

  formatarData(data: string | null | undefined): string {
    if (!data) {
      return '-';
    }

    return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');
  }

  private criarParams(
    filtros: Record<string, string | number | boolean | null | undefined>,
  ): HttpParams {
    let params = new HttpParams();

    for (const [chave, valor] of Object.entries(filtros)) {
      if (valor !== null && valor !== undefined && valor !== '') {
        params = params.set(chave, String(valor));
      }
    }

    return params;
  }
}
