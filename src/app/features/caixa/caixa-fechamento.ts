export interface CaixaDenominacao {
  readonly codigo: string;
  readonly descricao: string;
  readonly valor: number;
  readonly ordem: number;
  readonly ativo: boolean;
}

export interface CaixaFormaRecebimento {
  readonly codigo: string;
  readonly descricao: string;
}

export interface CaixaConfiguracao {
  readonly denominacoes: readonly CaixaDenominacao[];
  readonly formasRecebimento: readonly CaixaFormaRecebimento[];
}

export interface CaixaContagemItem {
  readonly denominacaoCodigo: string;
  readonly valorUnitario: number;
  readonly quantidade: number;
  readonly valorTotal: number;
}

export interface CaixaRecebimentosEletronicos {
  readonly totalMaquininha: number;
  readonly pix: number;
  readonly cartoes: number;
}

export interface CaixaFechamentoEstado {
  readonly quantidades: Readonly<Record<string, number>>;
  readonly recebimentosEletronicos: CaixaRecebimentosEletronicos;
}

export interface FechamentoCaixaDTO {
  readonly sapLoja: string | null;
  readonly dataMovimento: string | null;
  readonly usuarioResponsavel: string | null;
  readonly itensContagem: readonly CaixaContagemItem[];
  readonly formasRecebimento: readonly {
    readonly formaCodigo: string;
    readonly valorInformado: number;
    readonly valorCalculado: number;
  }[];
  readonly totalDinheiro: number;
  readonly totalPix: number;
  readonly totalCartoes: number;
  readonly totalGeral: number;
  readonly observacao: string | null;
}
