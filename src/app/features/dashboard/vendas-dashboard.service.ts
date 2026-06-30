import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { DiaResumoVendas, VendasResumoDiario } from './vendas-resumo-diario';

@Injectable({
  providedIn: 'root',
})
export class VendasDashboardService {
  private readonly httpClient = inject(HttpClient);

  listarResumoPorDia(dias = 7): Observable<readonly DiaResumoVendas[]> {
    return this.httpClient
      .get<readonly VendasResumoDiario[]>('/api/vendas/resumo-diario', {
        params: {
          dias,
        },
      })
      .pipe(map((vendas) => this.agruparResumoPorDia(vendas)));
  }

  private agruparResumoPorDia(
    vendasResumoDiario: readonly VendasResumoDiario[],
  ): readonly DiaResumoVendas[] {
    const grupos = new Map<string, VendasResumoDiario[]>();

    for (const venda of vendasResumoDiario) {
      const data = venda.dataHoraMovimentacao.slice(0, 10);
      const vendasDoDia = grupos.get(data) ?? [];
      grupos.set(data, [...vendasDoDia, venda]);
    }

    return Array.from(grupos.entries())
      .sort(([dataA], [dataB]) => dataB.localeCompare(dataA))
      .map(([data, vendas]) => this.criarResumoDia(data, vendas));
  }

  private criarResumoDia(data: string, vendas: readonly VendasResumoDiario[]): DiaResumoVendas {
    const valorTotalBruto = this.somar(vendas, 'valorTotalBruto');
    const valorTotalLiquido = this.somar(vendas, 'valorTotalLiquido');
    const cuponsEmitidos = this.somar(vendas, 'cuponsEmitidos');
    const quantidadeProduto = this.somar(vendas, 'quantidadeProduto');
    const tiqueteMedio = cuponsEmitidos > 0 ? valorTotalLiquido / cuponsEmitidos : 0;
    const quantidadePorAtendimento =
      cuponsEmitidos > 0 ? quantidadeProduto / cuponsEmitidos : 0;

    return {
      data,
      dataLabel: this.formatarData(data),
      totalizadores: [
        { label: 'Valor total bruto', value: this.formatarMoeda(valorTotalBruto) },
        { label: 'Valor total liquido', value: this.formatarMoeda(valorTotalLiquido) },
        { label: 'Cupons emitidos', value: this.formatarNumero(cuponsEmitidos) },
        { label: 'Tiquete medio', value: this.formatarMoeda(tiqueteMedio) },
        {
          label: 'Quantidade por atendimento',
          value: this.formatarDecimal(quantidadePorAtendimento),
        },
      ],
      lojas: vendas
        .slice()
        .sort((a, b) => a.sapLoja.localeCompare(b.sapLoja))
        .map((venda) => ({
          sapLoja: venda.sapLoja,
          dataHoraMovimentacao: this.formatarDataHora(venda.dataHoraMovimentacao),
          indicadores: [
            { label: 'Valor total bruto', value: this.formatarMoeda(venda.valorTotalBruto) },
            {
              label: 'Valor total liquido',
              value: this.formatarMoeda(venda.valorTotalLiquido),
            },
            { label: 'Cupons emitidos', value: this.formatarNumero(venda.cuponsEmitidos) },
            { label: 'Tiquete medio', value: this.formatarMoeda(venda.tiqueteMedio) },
            {
              label: 'Quantidade por atendimento',
              value: this.formatarDecimal(venda.quantidadePorAtendimento),
            },
          ],
        })),
    };
  }

  private somar(
    vendas: readonly VendasResumoDiario[],
    campo: 'valorTotalBruto' | 'valorTotalLiquido' | 'cuponsEmitidos' | 'quantidadeProduto',
  ): number {
    return vendas.reduce((total, venda) => total + venda[campo], 0);
  }

  private formatarMoeda(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      currency: 'BRL',
      style: 'currency',
    });
  }

  private formatarNumero(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      maximumFractionDigits: 0,
    });
  }

  private formatarDecimal(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }

  private formatarData(data: string): string {
    return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');
  }

  private formatarDataHora(dataHora: string): string {
    return new Date(dataHora).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }
}
