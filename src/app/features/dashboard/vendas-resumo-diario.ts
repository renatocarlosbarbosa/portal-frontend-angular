export interface VendasResumoDiario {
  readonly sapLoja: string;
  readonly tipoMovimento: string;
  readonly dataHoraMovimentacao: string;
  readonly valorTotalBruto: number;
  readonly valorTotalLiquido: number;
  readonly cuponsEmitidos: number;
  readonly tiqueteMedio: number;
  readonly quantidadeProduto: number;
  readonly quantidadePorAtendimento: number;
}

export interface IndicadorFormatado {
  readonly label: string;
  readonly value: string;
}

export interface LojaResumoDiario {
  readonly sapLoja: string;
  readonly dataHoraMovimentacao: string;
  readonly indicadores: readonly IndicadorFormatado[];
}

export interface DiaResumoVendas {
  readonly data: string;
  readonly dataLabel: string;
  readonly totalizadores: readonly IndicadorFormatado[];
  readonly lojas: readonly LojaResumoDiario[];
}
