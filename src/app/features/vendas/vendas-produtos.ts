export interface VendaProdutoResumo {
  readonly sapLoja: string;
  readonly dataMovimentacao: string;
  readonly idProduto: number;
  readonly codigoSap: string | null;
  readonly descricaoProduto: string | null;
  readonly ncm: string | null;
  readonly unidade: string | null;
  readonly quantidade: number;
  readonly valorTotalBruto: number;
  readonly valorDesconto: number;
  readonly valorTotalLiquido: number;
}

export interface VendasProdutosLoja {
  readonly sapLoja: string;
  readonly itens: readonly VendaProdutoResumo[];
  readonly quantidade: number;
  readonly valorTotalBruto: number;
  readonly valorDesconto: number;
  readonly valorTotalLiquido: number;
}
