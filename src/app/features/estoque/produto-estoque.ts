export interface ProdutoEstoque {
  readonly sapLoja: string;
  readonly idLocalEstoque: number | null;
  readonly idProduto: number;
  readonly numeroEan: string | null;
  readonly descricaoProduto: string;
  readonly descricaoResumidaProduto: string | null;
  readonly flagAtivo: boolean | null;
  readonly flagAtivoVenda: boolean | null;
  readonly secaoNome: string | null;
  readonly grupoNome: string | null;
  readonly subgrupoNome: string | null;
  readonly unidadeMedidaAbreviacao: string | null;
  readonly quantidadeEstoque: number;
  readonly dataHoraAtualizacao: string | null;
}

export interface ProdutoEstoqueLinha {
  readonly idProduto: number;
  readonly numeroEan: string | null;
  readonly descricaoProduto: string;
  readonly subgrupoNome: string | null;
  readonly unidadeMedidaAbreviacao: string | null;
  readonly quantidadePorLoja: Readonly<Record<string, number>>;
  readonly total: number;
}

export interface ProdutoEstoqueMatriz {
  readonly lojas: readonly string[];
  readonly linhas: readonly ProdutoEstoqueLinha[];
}

export type ProdutoEstoqueFlagFiltro = 'todos' | 'true' | 'false';

export interface ProdutoEstoqueFiltros {
  readonly termo: string;
  readonly ativo: ProdutoEstoqueFlagFiltro;
  readonly ativoVenda: ProdutoEstoqueFlagFiltro;
}
