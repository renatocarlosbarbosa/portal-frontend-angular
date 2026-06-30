import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';

import {
  COMPRAS_PAINEL_VAZIO,
  ComprasPainel,
  ConsolidadoCompra,
  CustoMedioCompra,
  FornecedorCompra,
  GrupoItemCompra,
  HistoricoCompra,
  ItemCompra,
  LocalCompra,
  NecessidadeCompra,
  PedidoCompraDetalhe,
  PedidoCompraResumo,
  UnidadeMedida,
} from './compras';

@Injectable({
  providedIn: 'root',
})
export class ComprasService {
  private readonly httpClient = inject(HttpClient);
  private readonly baseUrl = '/api/compras';

  carregarPainel(filtros: {
    sapLoja?: string | null;
    localCompraId?: number | null;
    fornecedorId?: number | null;
    grupoId?: number | null;
    status?: string | null;
    prioridade?: string | null;
  }): Observable<ComprasPainel> {
    return forkJoin({
      grupos: this.listarGrupos({ ativo: true, limite: 500 }),
      unidades: this.listarUnidades(),
      fornecedores: this.listarFornecedores({ ativo: true, limite: 500 }),
      locais: this.listarLocais({ ativo: true, limite: 500 }),
      itens: this.listarItens({ ativo: true, grupoId: filtros.grupoId, limite: 700 }),
      necessidades: this.listarNecessidades({ ...filtros, limite: 700 }),
      organizacao: this.listarOrganizacao({
        localCompraId: filtros.localCompraId,
        fornecedorId: filtros.fornecedorId,
        grupoId: filtros.grupoId,
        limite: 700,
      }),
      pedidos: this.listarPedidos({ limite: 300 }),
      historico: this.listarHistorico({ fornecedorId: filtros.fornecedorId, limite: 300 }),
      custos: this.listarCustosMedios({ limite: 300 }),
    });
  }

  painelVazio(): ComprasPainel {
    return COMPRAS_PAINEL_VAZIO;
  }

  listarGrupos(filtros: {
    termo?: string | null;
    ativo?: boolean | null;
    limite?: number;
  }): Observable<readonly GrupoItemCompra[]> {
    return this.httpClient.get<readonly GrupoItemCompra[]>(`${this.baseUrl}/grupos`, {
      params: this.criarParams(filtros),
    });
  }

  criarGrupo(payload: Partial<GrupoItemCompra>): Observable<GrupoItemCompra> {
    return this.httpClient.post<GrupoItemCompra>(`${this.baseUrl}/grupos`, payload);
  }

  atualizarGrupo(id: number, payload: Partial<GrupoItemCompra>): Observable<GrupoItemCompra> {
    return this.httpClient.put<GrupoItemCompra>(`${this.baseUrl}/grupos/${id}`, payload);
  }

  desativarGrupo(id: number): Observable<void> {
    return this.httpClient.patch<void>(`${this.baseUrl}/grupos/${id}/desativar`, {});
  }

  excluirGrupo(id: number): Observable<void> {
    return this.httpClient.delete<void>(`${this.baseUrl}/grupos/${id}`);
  }

  listarUnidades(): Observable<readonly UnidadeMedida[]> {
    return this.httpClient.get<readonly UnidadeMedida[]>(`${this.baseUrl}/unidades`);
  }

  listarFornecedores(filtros: {
    termo?: string | null;
    ativo?: boolean | null;
    limite?: number;
  }): Observable<readonly FornecedorCompra[]> {
    return this.httpClient.get<readonly FornecedorCompra[]>(`${this.baseUrl}/fornecedores`, {
      params: this.criarParams(filtros),
    });
  }

  criarFornecedor(payload: Partial<FornecedorCompra>): Observable<FornecedorCompra> {
    return this.httpClient.post<FornecedorCompra>(`${this.baseUrl}/fornecedores`, payload);
  }

  listarLocais(filtros: {
    termo?: string | null;
    ativo?: boolean | null;
    limite?: number;
  }): Observable<readonly LocalCompra[]> {
    return this.httpClient.get<readonly LocalCompra[]>(`${this.baseUrl}/locais`, {
      params: this.criarParams(filtros),
    });
  }

  criarLocal(payload: Partial<LocalCompra>): Observable<LocalCompra> {
    return this.httpClient.post<LocalCompra>(`${this.baseUrl}/locais`, payload);
  }

  atualizarLocal(id: number, payload: Partial<LocalCompra>): Observable<LocalCompra> {
    return this.httpClient.put<LocalCompra>(`${this.baseUrl}/locais/${id}`, payload);
  }

  desativarLocal(id: number): Observable<void> {
    return this.httpClient.patch<void>(`${this.baseUrl}/locais/${id}/desativar`, {});
  }

  excluirLocal(id: number): Observable<void> {
    return this.httpClient.delete<void>(`${this.baseUrl}/locais/${id}`);
  }

  listarItens(filtros: {
    termo?: string | null;
    grupoId?: number | null;
    ativo?: boolean | null;
    limite?: number;
  }): Observable<readonly ItemCompra[]> {
    return this.httpClient.get<readonly ItemCompra[]>(`${this.baseUrl}/itens`, {
      params: this.criarParams(filtros),
    });
  }

  criarItem(payload: Record<string, unknown>): Observable<ItemCompra> {
    return this.httpClient.post<ItemCompra>(`${this.baseUrl}/itens`, payload);
  }

  atualizarItem(id: number, payload: Record<string, unknown>): Observable<ItemCompra> {
    return this.httpClient.put<ItemCompra>(`${this.baseUrl}/itens/${id}`, payload);
  }

  desativarItem(id: number): Observable<void> {
    return this.httpClient.patch<void>(`${this.baseUrl}/itens/${id}/desativar`, {});
  }

  excluirItem(id: number): Observable<void> {
    return this.httpClient.delete<void>(`${this.baseUrl}/itens/${id}`);
  }

  listarNecessidades(filtros: {
    sapLoja?: string | null;
    localCompraId?: number | null;
    fornecedorId?: number | null;
    grupoId?: number | null;
    status?: string | null;
    prioridade?: string | null;
    limite?: number;
  }): Observable<readonly NecessidadeCompra[]> {
    return this.httpClient.get<readonly NecessidadeCompra[]>(`${this.baseUrl}/necessidades`, {
      params: this.criarParams(filtros),
    });
  }

  criarNecessidade(payload: Record<string, unknown>): Observable<NecessidadeCompra> {
    return this.httpClient.post<NecessidadeCompra>(`${this.baseUrl}/necessidades`, payload);
  }

  cancelarNecessidade(id: number): Observable<void> {
    return this.httpClient.patch<void>(`${this.baseUrl}/necessidades/${id}/cancelar`, {});
  }

  reabrirNecessidade(id: number): Observable<void> {
    return this.httpClient.patch<void>(`${this.baseUrl}/necessidades/${id}/reabrir`, {});
  }

  listarOrganizacao(filtros: {
    localCompraId?: number | null;
    fornecedorId?: number | null;
    grupoId?: number | null;
    limite?: number;
  }): Observable<readonly ConsolidadoCompra[]> {
    return this.httpClient.get<readonly ConsolidadoCompra[]>(`${this.baseUrl}/organizacao`, {
      params: this.criarParams(filtros),
    });
  }

  gerarPedido(payload: {
    localCompraId: number;
    fornecedorId?: number | null;
    usuarioResponsavel?: string | null;
    observacoes?: string | null;
    necessidadeIds: readonly number[];
  }): Observable<PedidoCompraDetalhe> {
    return this.httpClient.post<PedidoCompraDetalhe>(`${this.baseUrl}/pedidos/gerar`, payload);
  }

  listarPedidos(filtros: {
    status?: string | null;
    localCompraId?: number | null;
    limite?: number;
  }): Observable<readonly PedidoCompraResumo[]> {
    return this.httpClient.get<readonly PedidoCompraResumo[]>(`${this.baseUrl}/pedidos`, {
      params: this.criarParams(filtros),
    });
  }

  buscarPedido(id: number): Observable<PedidoCompraDetalhe> {
    return this.httpClient.get<PedidoCompraDetalhe>(`${this.baseUrl}/pedidos/${id}`);
  }

  iniciarCompra(id: number): Observable<PedidoCompraDetalhe> {
    return this.httpClient.patch<PedidoCompraDetalhe>(`${this.baseUrl}/pedidos/${id}/em-compra`, {});
  }

  finalizarPedido(id: number, dataCompra: string): Observable<PedidoCompraDetalhe> {
    return this.httpClient.patch<PedidoCompraDetalhe>(`${this.baseUrl}/pedidos/${id}/finalizar`, {}, {
      params: this.criarParams({ dataCompra }),
    });
  }

  cancelarPedido(id: number): Observable<void> {
    return this.httpClient.patch<void>(`${this.baseUrl}/pedidos/${id}/cancelar`, {});
  }

  marcarItemComprado(id: number, payload: {
    quantidadeComprada: number;
    valorUnitario: number;
    observacao?: string | null;
  }): Observable<PedidoCompraDetalhe> {
    return this.httpClient.patch<PedidoCompraDetalhe>(
      `${this.baseUrl}/pedidos/itens/${id}/comprado`,
      payload,
    );
  }

  listarHistorico(filtros: {
    itemCompraId?: number | null;
    fornecedorId?: number | null;
    limite?: number;
  }): Observable<readonly HistoricoCompra[]> {
    return this.httpClient.get<readonly HistoricoCompra[]>(`${this.baseUrl}/historico`, {
      params: this.criarParams(filtros),
    });
  }

  listarCustosMedios(filtros: { limite?: number }): Observable<readonly CustoMedioCompra[]> {
    return this.httpClient.get<readonly CustoMedioCompra[]>(`${this.baseUrl}/custo-medio`, {
      params: this.criarParams(filtros),
    });
  }

  formatarMoeda(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('pt-BR', {
      currency: 'BRL',
      style: 'currency',
    });
  }

  formatarQuantidade(valor: number | null | undefined, unidade?: string | null): string {
    const quantidade = (valor ?? 0).toLocaleString('pt-BR', {
      maximumFractionDigits: 3,
      minimumFractionDigits: 0,
    });

    return unidade ? `${quantidade} ${unidade}` : quantidade;
  }

  formatarData(data: string | null | undefined): string {
    if (!data) {
      return '-';
    }

    return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');
  }

  private criarParams(filtros: Record<string, string | number | boolean | null | undefined>): HttpParams {
    let params = new HttpParams();

    for (const [chave, valor] of Object.entries(filtros)) {
      if (valor !== null && valor !== undefined && valor !== '') {
        params = params.set(chave, String(valor));
      }
    }

    return params;
  }
}
