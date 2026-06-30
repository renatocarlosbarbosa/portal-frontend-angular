import { Injectable, computed, effect, signal } from '@angular/core';

import {
  CaixaConfiguracao,
  CaixaContagemItem,
  CaixaDenominacao,
  CaixaFechamentoEstado,
  CaixaRecebimentosEletronicos,
  FechamentoCaixaDTO,
} from './caixa-fechamento';

const STORAGE_KEY = 'portal.caixa.fechamento.v1';

const ESTADO_INICIAL: CaixaFechamentoEstado = {
  quantidades: {},
  recebimentosEletronicos: {
    totalMaquininha: 0,
    pix: 0,
    cartoes: 0,
  },
};

@Injectable({
  providedIn: 'root',
})
export class CaixaFechamentoService {
  private ignorarProximaPersistencia = false;
  private readonly estado = signal<CaixaFechamentoEstado>(this.carregarEstado());
  private readonly configuracao = signal<CaixaConfiguracao>({
    denominacoes: [],
    formasRecebimento: [],
  });

  readonly denominacoes = computed(() =>
    [...this.configuracao().denominacoes]
      .filter((denominacao) => denominacao.ativo)
      .sort((a, b) => a.ordem - b.ordem),
  );
  readonly recebimentosEletronicos = computed(() => this.estado().recebimentosEletronicos);
  readonly itensContagem = computed(() =>
    this.denominacoes().map((denominacao) => this.criarItemContagem(denominacao)),
  );
  readonly totalDinheiro = computed(() =>
    this.itensContagem().reduce((total, item) => total + item.valorTotal, 0),
  );
  readonly totalPix = computed(() => this.recebimentosEletronicos().pix);
  readonly totalCartoes = computed(() => this.recebimentosEletronicos().cartoes);
  readonly totalGeral = computed(() => this.totalDinheiro() + this.totalPix() + this.totalCartoes());

  constructor() {
    effect(() => {
      const estadoAtual = this.estado();

      if (this.ignorarProximaPersistencia) {
        this.ignorarProximaPersistencia = false;
        this.removerEstadoSalvo();
        return;
      }

      this.salvarEstado(estadoAtual);
    });
  }

  aplicarConfiguracao(configuracao: CaixaConfiguracao): void {
    this.configuracao.set(configuracao);
  }

  atualizarQuantidade(denominacaoCodigo: string, quantidade: number): void {
    const quantidadeNormalizada = this.normalizarQuantidade(quantidade);
    this.estado.update((estadoAtual) => ({
      ...estadoAtual,
      quantidades: {
        ...estadoAtual.quantidades,
        [denominacaoCodigo]: quantidadeNormalizada,
      },
    }));
  }

  atualizarRecebimentosEletronicos(totalMaquininha: number, pix: number): void {
    const totalMaquininhaNormalizado = this.normalizarValor(totalMaquininha);
    const pixNormalizado = this.normalizarValor(pix);
    const cartoes = Math.max(totalMaquininhaNormalizado - pixNormalizado, 0);

    this.estado.update((estadoAtual) => ({
      ...estadoAtual,
      recebimentosEletronicos: {
        totalMaquininha: totalMaquininhaNormalizado,
        pix: pixNormalizado,
        cartoes: this.arredondar(cartoes),
      },
    }));
  }

  limpar(): void {
    this.ignorarProximaPersistencia = true;
    this.estado.set(ESTADO_INICIAL);
    this.removerEstadoSalvo();
  }

  gerarDTOBase(): FechamentoCaixaDTO {
    return {
      sapLoja: null,
      dataMovimento: null,
      usuarioResponsavel: null,
      itensContagem: this.itensContagem(),
      formasRecebimento: [
        {
          formaCodigo: 'DINHEIRO',
          valorInformado: this.totalDinheiro(),
          valorCalculado: this.totalDinheiro(),
        },
        {
          formaCodigo: 'PIX',
          valorInformado: this.totalPix(),
          valorCalculado: this.totalPix(),
        },
        {
          formaCodigo: 'CARTAO',
          valorInformado: this.recebimentosEletronicos().totalMaquininha,
          valorCalculado: this.totalCartoes(),
        },
      ],
      totalDinheiro: this.totalDinheiro(),
      totalPix: this.totalPix(),
      totalCartoes: this.totalCartoes(),
      totalGeral: this.totalGeral(),
      observacao: null,
    };
  }

  formatarMoeda(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  private criarItemContagem(denominacao: CaixaDenominacao): CaixaContagemItem {
    const quantidade = this.estado().quantidades[denominacao.codigo] ?? 0;

    return {
      denominacaoCodigo: denominacao.codigo,
      valorUnitario: denominacao.valor,
      quantidade,
      valorTotal: this.arredondar(quantidade * denominacao.valor),
    };
  }

  private carregarEstado(): CaixaFechamentoEstado {
    if (typeof localStorage === 'undefined') {
      return ESTADO_INICIAL;
    }

    const conteudo = localStorage.getItem(STORAGE_KEY);
    if (!conteudo) {
      return ESTADO_INICIAL;
    }

    try {
      const estado = JSON.parse(conteudo) as CaixaFechamentoEstado;
      return {
        quantidades: estado.quantidades ?? {},
        recebimentosEletronicos: this.normalizarRecebimentos(estado.recebimentosEletronicos),
      };
    } catch {
      return ESTADO_INICIAL;
    }
  }

  private salvarEstado(estado: CaixaFechamentoEstado): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    }
  }

  private removerEstadoSalvo(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private normalizarRecebimentos(
    recebimentos: CaixaRecebimentosEletronicos | null | undefined,
  ): CaixaRecebimentosEletronicos {
    return {
      totalMaquininha: this.normalizarValor(recebimentos?.totalMaquininha),
      pix: this.normalizarValor(recebimentos?.pix),
      cartoes: this.normalizarValor(recebimentos?.cartoes),
    };
  }

  private normalizarQuantidade(valor: number | null | undefined): number {
    if (!Number.isFinite(valor) || !valor || valor < 0) {
      return 0;
    }

    return Math.trunc(valor);
  }

  private normalizarValor(valor: number | null | undefined): number {
    if (!Number.isFinite(valor) || !valor || valor < 0) {
      return 0;
    }

    return this.arredondar(valor);
  }

  private arredondar(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }
}
