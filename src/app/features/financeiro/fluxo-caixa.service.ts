import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { FluxoCaixaDiario, FluxoCaixaLinha, FluxoCaixaResumo } from './fluxo-caixa';

@Injectable({
  providedIn: 'root',
})
export class FluxoCaixaService {
  private readonly httpClient = inject(HttpClient);

  listarFluxo(dataInicial: string, dataFinal: string): Observable<FluxoCaixaResumo> {
    return this.httpClient
      .get<readonly FluxoCaixaDiario[]>('/api/financeiro/fluxo-caixa/diario', {
        params: {
          dataFinal,
          dataInicial,
        },
      })
      .pipe(map((movimentos) => this.criarResumo(movimentos)));
  }

  formatarMoeda(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      currency: 'BRL',
      style: 'currency',
    });
  }

  private criarResumo(movimentos: readonly FluxoCaixaDiario[]): FluxoCaixaResumo {
    const lojas = Array.from(new Set(movimentos.map((movimento) => movimento.sapLoja))).sort(
      (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }),
    );
    const linhasPorData = new Map<string, FluxoCaixaLinha>();

    for (const movimento of movimentos) {
      const linhaAtual = linhasPorData.get(movimento.dataMovimento);
      const saldoPorLoja = {
        ...(linhaAtual?.saldoPorLoja ?? {}),
      };

      saldoPorLoja[movimento.sapLoja] = (saldoPorLoja[movimento.sapLoja] ?? 0) + movimento.saldoDia;

      linhasPorData.set(movimento.dataMovimento, {
        dataMovimento: movimento.dataMovimento,
        dataLabel: this.formatarData(movimento.dataMovimento),
        entradas: (linhaAtual?.entradas ?? 0) + movimento.valorEntradas,
        saidas: (linhaAtual?.saidas ?? 0) + movimento.valorSaidas,
        saldo: (linhaAtual?.saldo ?? 0) + movimento.saldoDia,
        saldoAcumulado: 0,
        saldoPorLoja,
      });
    }

    let saldoAcumulado = 0;
    const linhas = Array.from(linhasPorData.values())
      .sort((a, b) => a.dataMovimento.localeCompare(b.dataMovimento))
      .map((linha) => {
        saldoAcumulado += linha.saldo;

        return {
          ...linha,
          saldoAcumulado,
        };
      });
    const totalEntradas = linhas.reduce((total, linha) => total + linha.entradas, 0);
    const totalSaidas = linhas.reduce((total, linha) => total + linha.saidas, 0);

    return {
      lojas,
      linhas,
      totalEntradas,
      totalSaidas,
      saldoPeriodo: totalEntradas - totalSaidas,
    };
  }

  private formatarData(data: string): string {
    return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');
  }
}
