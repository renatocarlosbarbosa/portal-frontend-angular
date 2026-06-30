export interface FluxoCaixaDiario {
  readonly dataMovimento: string;
  readonly sapLoja: string;
  readonly valorEntradas: number;
  readonly valorSaidas: number;
  readonly saldoDia: number;
}

export interface FluxoCaixaLinha {
  readonly dataMovimento: string;
  readonly dataLabel: string;
  readonly entradas: number;
  readonly saidas: number;
  readonly saldo: number;
  readonly saldoAcumulado: number;
  readonly saldoPorLoja: Readonly<Record<string, number>>;
}

export interface FluxoCaixaResumo {
  readonly lojas: readonly string[];
  readonly linhas: readonly FluxoCaixaLinha[];
  readonly totalEntradas: number;
  readonly totalSaidas: number;
  readonly saldoPeriodo: number;
}
