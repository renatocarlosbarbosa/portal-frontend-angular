export interface FluxoCaixaOrigemDiario {
  readonly dataEvento: string;
  readonly sapLoja: string | null;
  readonly contaBancariaId: number | null;
  readonly tipoEvento: 'PREVISTO' | 'REALIZADO' | string;
  readonly entradas: number;
  readonly saidas: number;
  readonly saldoDia: number;
  readonly saldoAcumulado: number;
}

export interface ContaFinanceiraOrigem {
  readonly tipoTitulo: 'PAGAR' | 'RECEBER' | string;
  readonly origemTabela: string;
  readonly origemChave: string;
  readonly sapLoja: string;
  readonly idMovimentacao: number | null;
  readonly idFinanceiro: number | null;
  readonly numeroParcela: number | null;
  readonly idFormaPagamento: number | null;
  readonly descricaoFormaPagamento: string | null;
  readonly valorParcela: number;
  readonly operadoraCartao: string | null;
  readonly bandeiraCartao: string | null;
  readonly numeroParcelasCartao: number | null;
  readonly tipoCartao: string | null;
  readonly dataVencimento: string;
  readonly dataHoraTransacaoCartao: string | null;
}

export interface ConciliacaoExtratoOrigem {
  readonly origemTabela: string;
  readonly origemChave: string;
  readonly sapLoja: string;
  readonly numeroConta: string | null;
  readonly numeroBanco: string | null;
  readonly idTransacao: string | null;
  readonly tipoTransacao: string | null;
  readonly dataTransacao: string;
  readonly historicoTransacao: string | null;
  readonly valorTransacao: number;
}

export interface ConciliacaoCartaoOrigem {
  readonly origemTabela: string;
  readonly origemChave: string;
  readonly dataVenda: string;
  readonly dataRecebimento: string | null;
  readonly dataVencimento: string | null;
  readonly statusOrigem: string | null;
  readonly modalidade: string | null;
  readonly tipo: string | null;
  readonly bandeira: string | null;
  readonly numeroParcelas: number | null;
  readonly parcela: number | null;
  readonly nsuCv: string | null;
  readonly tid: string | null;
  readonly numeroPedido: string | null;
  readonly numeroAutorizacao: string | null;
  readonly numeroEstabelecimento: string | null;
  readonly nomeEstabelecimento: string | null;
  readonly cnpj: string | null;
  readonly valorBruto: number;
  readonly valorBrutoAtualizado: number;
  readonly taxaMdr: number;
  readonly valorMdr: number;
  readonly valorLiquido: number;
  readonly dataCancelamento: string | null;
  readonly valorCancelado: string | null;
}

export interface IndicadorFinanceiro {
  readonly tipoEvento: 'PREVISTO' | 'REALIZADO' | string;
  readonly entradas: number;
  readonly saidas: number;
  readonly resultado: number;
  readonly quantidadeEntradas: number;
  readonly quantidadeSaidas: number;
}

export interface FinanceiroConsultasPainel {
  readonly fluxo: readonly FluxoCaixaOrigemDiario[];
  readonly contas: readonly ContaFinanceiraOrigem[];
  readonly extratos: readonly ConciliacaoExtratoOrigem[];
  readonly cartoes: readonly ConciliacaoCartaoOrigem[];
  readonly indicadores: readonly IndicadorFinanceiro[];
}

export const PAINEL_FINANCEIRO_VAZIO: FinanceiroConsultasPainel = {
  fluxo: [],
  contas: [],
  extratos: [],
  cartoes: [],
  indicadores: [],
};
