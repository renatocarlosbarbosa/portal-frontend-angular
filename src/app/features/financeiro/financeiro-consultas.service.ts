import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';

import {
  AtualizarClassificacaoExtratoLoteRequest,
  AtualizarClassificacaoExtratoRequest,
  ConciliacaoCartaoOrigem,
  ConciliacaoExtratoOrigem,
  ContaFinanceiraOrigem,
  FinanceiroConsultasPainel,
  FluxoCaixaOrigemDiario,
  IndicadorFinanceiro,
  TipoLancamentoBancario,
} from './financeiro-consultas';

@Injectable({
  providedIn: 'root',
})
export class FinanceiroConsultasService {
  private readonly httpClient = inject(HttpClient);
  private readonly baseUrl = '/api/financeiro/consultas';

  carregarPainel(filtros: {
    dataInicial: string;
    dataFinal: string;
    sapLoja?: string | null;
    tipoLancamentoId?: number | string | null;
    classificacao?: string | null;
    limite?: number;
  }): Observable<FinanceiroConsultasPainel> {
    return forkJoin({
      fluxo: this.listarFluxoCaixaOrigemDiario(filtros),
      contas: this.listarContasOrigem(filtros),
      extratos: this.listarExtratoOrigem(filtros),
      cartoes: this.listarCartoesOrigem(filtros),
      indicadores: this.listarIndicadores(filtros),
    });
  }

  carregarPainelExtratoBancario(filtros: {
    dataInicial: string;
    dataFinal: string;
    sapLoja?: string | null;
    tipoLancamentoId?: number | string | null;
    classificacao?: string | null;
    limite?: number;
  }): Observable<FinanceiroConsultasPainel> {
    return forkJoin({
      fluxo: of([]),
      contas: of([]),
      extratos: this.listarExtratoOrigem(filtros),
      cartoes: of([]),
      indicadores: this.listarIndicadores(filtros),
    });
  }

  listarFluxoCaixaOrigemDiario(filtros: {
    dataInicial: string;
    dataFinal: string;
    sapLoja?: string | null;
    tipoEvento?: string | null;
  }): Observable<readonly FluxoCaixaOrigemDiario[]> {
    return this.httpClient.get<readonly FluxoCaixaOrigemDiario[]>(
      `${this.baseUrl}/fluxo-caixa/origem/diario`,
      { params: this.criarParams(filtros) },
    );
  }

  listarContasOrigem(filtros: {
    dataInicial: string;
    dataFinal: string;
    sapLoja?: string | null;
    tipoTitulo?: string | null;
    limite?: number;
  }): Observable<readonly ContaFinanceiraOrigem[]> {
    return this.httpClient.get<readonly ContaFinanceiraOrigem[]>(
      `${this.baseUrl}/contas-origem`,
      { params: this.criarParams({ limite: 400, ...filtros }) },
    );
  }

  listarExtratoOrigem(filtros: {
    dataInicial: string;
    dataFinal: string;
    sapLoja?: string | null;
    tipoLancamentoId?: number | string | null;
    classificacao?: string | null;
    limite?: number;
  }): Observable<readonly ConciliacaoExtratoOrigem[]> {
    return this.httpClient.get<readonly ConciliacaoExtratoOrigem[]>(
      `${this.baseUrl}/extrato-origem`,
      { params: this.criarParams({ limite: 300, ...filtros }) },
    );
  }

  listarTiposLancamentoBancario(): Observable<readonly TipoLancamentoBancario[]> {
    return this.httpClient.get<readonly TipoLancamentoBancario[]>(
      `${this.baseUrl}/extrato-origem/tipos`,
      { params: this.criarParams({ somenteAtivos: false }) },
    );
  }

  atualizarClassificacaoExtrato(
    request: AtualizarClassificacaoExtratoRequest,
  ): Observable<ConciliacaoExtratoOrigem | null> {
    return this.httpClient.put<ConciliacaoExtratoOrigem | null>(
      `${this.baseUrl}/extrato-origem/classificacao`,
      request,
    );
  }

  atualizarClassificacaoExtratoLote(
    request: AtualizarClassificacaoExtratoLoteRequest,
  ): Observable<readonly ConciliacaoExtratoOrigem[]> {
    return this.httpClient.put<readonly ConciliacaoExtratoOrigem[]>(
      `${this.baseUrl}/extrato-origem/classificacao/lote`,
      request,
    );
  }

  listarCartoesOrigem(filtros: {
    dataInicial: string;
    dataFinal: string;
    origemTabela?: string | null;
    limite?: number;
  }): Observable<readonly ConciliacaoCartaoOrigem[]> {
    return this.httpClient.get<readonly ConciliacaoCartaoOrigem[]>(
      `${this.baseUrl}/cartoes-origem`,
      { params: this.criarParams({ limite: 300, ...filtros }) },
    );
  }

  listarIndicadores(filtros: {
    dataInicial: string;
    dataFinal: string;
    sapLoja?: string | null;
  }): Observable<readonly IndicadorFinanceiro[]> {
    return this.httpClient.get<readonly IndicadorFinanceiro[]>(
      `${this.baseUrl}/indicadores`,
      { params: this.criarParams(filtros) },
    );
  }

  formatarMoeda(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('pt-BR', {
      currency: 'BRL',
      style: 'currency',
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
