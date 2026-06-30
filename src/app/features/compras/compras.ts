export interface GrupoItemCompra {
  readonly id: number;
  readonly nome: string;
  readonly descricao: string | null;
  readonly ativo: boolean;
}

export interface UnidadeMedida {
  readonly id: number;
  readonly sigla: string;
  readonly nome: string;
  readonly ativo: boolean;
}

export interface FornecedorCompra {
  readonly id: number;
  readonly nome: string;
  readonly documento: string | null;
  readonly contato: string | null;
  readonly telefone: string | null;
  readonly email: string | null;
  readonly observacoes: string | null;
  readonly ativo: boolean;
}

export interface LocalCompra {
  readonly id: number;
  readonly nome: string;
  readonly tipo: string;
  readonly fornecedorId: number | null;
  readonly fornecedorNome: string | null;
  readonly observacoes: string | null;
  readonly ativo: boolean;
}

export interface ItemCompra {
  readonly id: number;
  readonly descricao: string;
  readonly grupoId: number;
  readonly grupoNome: string;
  readonly unidadeMedidaId: number;
  readonly unidadeSigla: string;
  readonly localCompraPadraoId: number | null;
  readonly localCompraPadraoNome: string | null;
  readonly fornecedorPadraoId: number | null;
  readonly fornecedorPadraoNome: string | null;
  readonly quantidadeMinimaSugerida: number;
  readonly quantidadePadraoCompra: number;
  readonly recorrente: boolean;
  readonly homologado: boolean;
  readonly observacoes: string | null;
  readonly ativo: boolean;
}

export interface NecessidadeCompra {
  readonly id: number;
  readonly sapLoja: string;
  readonly lojaNome: string | null;
  readonly itemCompraId: number;
  readonly itemDescricao: string;
  readonly grupoId: number;
  readonly grupoNome: string;
  readonly unidadeSigla: string;
  readonly localCompraId: number | null;
  readonly localCompraNome: string | null;
  readonly fornecedorId: number | null;
  readonly fornecedorNome: string | null;
  readonly quantidadeNecessaria: number;
  readonly prioridade: string;
  readonly observacao: string | null;
  readonly dataNecessidade: string;
  readonly usuarioResponsavel: string | null;
  readonly status: string;
}

export interface ConsolidadoCompra {
  readonly localCompraId: number | null;
  readonly localCompraNome: string | null;
  readonly fornecedorId: number | null;
  readonly fornecedorNome: string | null;
  readonly itemCompraId: number;
  readonly itemDescricao: string;
  readonly grupoId: number;
  readonly grupoNome: string;
  readonly unidadeSigla: string;
  readonly quantidadeTotal: number;
  readonly quantidadeNecessidades: number;
  readonly lojas: string | null;
  readonly prioridadeOrdem: number;
}

export interface PedidoCompraResumo {
  readonly id: number;
  readonly numeroInterno: string;
  readonly localCompraId: number;
  readonly localCompraNome: string;
  readonly fornecedorId: number | null;
  readonly fornecedorNome: string | null;
  readonly dataAbertura: string;
  readonly dataFechamento: string | null;
  readonly dataCompra: string | null;
  readonly status: string;
  readonly usuarioResponsavel: string | null;
  readonly observacoes: string | null;
  readonly valorTotal: number;
  readonly quantidadeItens: number;
}

export interface PedidoCompraItemOrigem {
  readonly necessidadeId: number;
  readonly sapLoja: string;
  readonly quantidadeOrigem: number;
}

export interface PedidoCompraItem {
  readonly id: number;
  readonly pedidoCompraId: number;
  readonly itemCompraId: number;
  readonly itemDescricao: string;
  readonly unidadeSigla: string;
  readonly quantidadeSolicitada: number;
  readonly quantidadeComprada: number;
  readonly valorUnitario: number;
  readonly valorTotal: number;
  readonly observacao: string | null;
  readonly status: string;
  readonly origens: readonly PedidoCompraItemOrigem[];
}

export interface PedidoCompraDetalhe {
  readonly pedido: PedidoCompraResumo;
  readonly itens: readonly PedidoCompraItem[];
}

export interface HistoricoCompra {
  readonly itemCompraId: number;
  readonly itemDescricao: string;
  readonly grupoNome: string;
  readonly unidadeSigla: string;
  readonly pedidoId: number;
  readonly numeroInterno: string;
  readonly dataCompra: string | null;
  readonly dataFechamento: string | null;
  readonly localCompraId: number;
  readonly localCompraNome: string;
  readonly fornecedorId: number | null;
  readonly fornecedorNome: string | null;
  readonly quantidadeComprada: number;
  readonly valorUnitario: number;
  readonly valorTotal: number;
  readonly status: string;
}

export interface CustoMedioCompra {
  readonly itemCompraId: number;
  readonly itemDescricao: string;
  readonly grupoNome: string;
  readonly unidadeSigla: string;
  readonly custoMedio: number;
  readonly menorValorUnitario: number;
  readonly maiorValorUnitario: number;
  readonly quantidadeComprada: number;
  readonly valorTotal: number;
}

export interface ComprasPainel {
  readonly grupos: readonly GrupoItemCompra[];
  readonly unidades: readonly UnidadeMedida[];
  readonly fornecedores: readonly FornecedorCompra[];
  readonly locais: readonly LocalCompra[];
  readonly itens: readonly ItemCompra[];
  readonly necessidades: readonly NecessidadeCompra[];
  readonly organizacao: readonly ConsolidadoCompra[];
  readonly pedidos: readonly PedidoCompraResumo[];
  readonly historico: readonly HistoricoCompra[];
  readonly custos: readonly CustoMedioCompra[];
}

export const COMPRAS_PAINEL_VAZIO: ComprasPainel = {
  grupos: [],
  unidades: [],
  fornecedores: [],
  locais: [],
  itens: [],
  necessidades: [],
  organizacao: [],
  pedidos: [],
  historico: [],
  custos: [],
};
