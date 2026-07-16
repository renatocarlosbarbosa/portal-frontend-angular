import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  catchError,
  debounceTime,
  finalize,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import {
  CategoriaFinanceira,
  ConciliacaoCartaoOrigem,
  ConciliacaoExtratoOrigem,
  ContaFinanceiraOrigem,
  ExtratoBancarioRateio,
  FinanceiroConsultasPainel,
  FluxoCaixaOrigemDiario,
  PAINEL_FINANCEIRO_VAZIO,
  TipoLancamentoBancario,
} from './financeiro-consultas';
import { FinanceiroConsultasService } from './financeiro-consultas.service';

type AbaFinanceira = 'fluxo' | 'contas' | 'extrato' | 'cartoes';
type DirecaoOrdenacao = 'asc' | 'desc';
type ColunaOrdenacaoFluxo = 'data' | 'loja' | 'tipo' | 'entradas' | 'saidas' | 'saldo' | 'acumulado';
type ColunaOrdenacaoContas = 'vencimento' | 'tipo' | 'loja' | 'forma' | 'cartao' | 'valor' | 'origem';
type ColunaOrdenacaoExtrato = 'data' | 'loja' | 'banco' | 'conta' | 'historico' | 'tipo' | 'valor';
type ColunaOrdenacaoCartoes =
  | 'venda'
  | 'fonte'
  | 'status'
  | 'modalidade'
  | 'bandeira'
  | 'nsu'
  | 'bruto'
  | 'taxa'
  | 'liquido';
type OrdenacaoTabela<Coluna extends string> = {
  readonly coluna: Coluna;
  readonly direcao: DirecaoOrdenacao;
};
type OrdenacaoExtrato = {
  readonly coluna: ColunaOrdenacaoExtrato;
  readonly direcao: DirecaoOrdenacao;
};
type SecaoConfig = {
  readonly titulo: string;
  readonly resumo: string;
  readonly contador: () => number;
};
type RateioLinhaEdicao = {
  readonly categoriaFinanceiraId: string;
  readonly descricao: string;
  readonly valor: string;
  readonly observacao: string;
};

@Component({
  selector: 'app-financeiro-consultas',
  imports: [ReactiveFormsModule],
  templateUrl: './financeiro-consultas.component.html',
  styleUrl: './financeiro-consultas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceiroConsultasComponent {
  protected readonly filtroNaoClassificado = 'NAO_CLASSIFICADO';
  private readonly formBuilder = inject(FormBuilder);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly financeiroConsultasService = inject(FinanceiroConsultasService);
  private readonly hoje = new Date();

  protected readonly lojas = ['101260', '101261', '101266', '107005'];
  protected readonly secaoAtiva = toSignal(
    this.activatedRoute.data.pipe(map((data) => this.normalizarSecao(data['secaoFinanceira']))),
    { initialValue: this.normalizarSecao(this.activatedRoute.snapshot.data['secaoFinanceira']) },
  );
  protected readonly carregando = signal(true);
  protected readonly erroCarregamento = signal(false);
  protected readonly salvandoClassificacao = signal<string | null>(null);
  protected readonly mensagemClassificacao = signal<string | null>(null);
  protected readonly extratosAtualizados = signal<Record<string, ConciliacaoExtratoOrigem>>({});
  protected readonly extratosSelecionados = signal<ReadonlySet<string>>(new Set());
  protected readonly tipoLancamentoLote = signal('');
  protected readonly extratoRateio = signal<ConciliacaoExtratoOrigem | null>(null);
  protected readonly rateiosEdicao = signal<readonly RateioLinhaEdicao[]>([]);
  protected readonly carregandoRateio = signal(false);
  protected readonly salvandoRateio = signal(false);
  protected readonly mensagemRateio = signal<string | null>(null);
  protected readonly ordenacaoFluxo = signal<OrdenacaoTabela<ColunaOrdenacaoFluxo>>({
    coluna: 'data',
    direcao: 'desc',
  });
  protected readonly ordenacaoContas = signal<OrdenacaoTabela<ColunaOrdenacaoContas>>({
    coluna: 'vencimento',
    direcao: 'asc',
  });
  protected readonly filtroHistoricoExtrato = new FormControl('', { nonNullable: true });
  protected readonly termoHistoricoExtrato = toSignal(
    this.filtroHistoricoExtrato.valueChanges.pipe(
      startWith(this.filtroHistoricoExtrato.value),
      debounceTime(200),
      tap(() => {
        this.extratosSelecionados.set(new Set());
        this.tipoLancamentoLote.set('');
      }),
    ),
    { initialValue: this.filtroHistoricoExtrato.value },
  );
  protected readonly ordenacaoExtrato = signal<OrdenacaoExtrato>({
    coluna: 'data',
    direcao: 'desc',
  });
  protected readonly ordenacaoCartoes = signal<OrdenacaoTabela<ColunaOrdenacaoCartoes>>({
    coluna: 'venda',
    direcao: 'desc',
  });
  protected readonly filtros = this.formBuilder.nonNullable.group({
    dataInicial: [this.obterPrimeiroDiaMes()],
    dataFinal: [this.obterDataHoje()],
    sapLoja: [''],
    tipoLancamentoId: [''],
  });
  protected readonly tiposLancamento = toSignal(
    this.financeiroConsultasService.listarTiposLancamentoBancario().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly categoriasDespesa = toSignal(
    this.financeiroConsultasService
      .listarCategoriasFinanceiras({ tipo: 'DESPESA' })
      .pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly painel = toSignal(
    this.filtros.valueChanges.pipe(
      startWith(this.filtros.getRawValue()),
      debounceTime(250),
      tap(() => {
        this.carregando.set(true);
        this.erroCarregamento.set(false);
        this.extratosAtualizados.set({});
        this.extratosSelecionados.set(new Set());
        this.tipoLancamentoLote.set('');
      }),
      switchMap((filtros) => {
        const tipoLancamentoFiltro = filtros.tipoLancamentoId || null;
        const filtrosNormalizados = {
          dataInicial: filtros.dataInicial ?? '',
          dataFinal: filtros.dataFinal ?? '',
          sapLoja: filtros.sapLoja || null,
          tipoLancamentoId: this.resolverTipoLancamentoFiltroId(tipoLancamentoFiltro),
          classificacao: this.resolverClassificacaoFiltro(tipoLancamentoFiltro),
        };
        const consulta = this.secaoAtiva() === 'extrato'
          ? this.financeiroConsultasService.carregarPainelExtratoBancario(filtrosNormalizados)
          : this.financeiroConsultasService.carregarPainel(filtrosNormalizados);

        return consulta.pipe(
          catchError(() => {
            this.erroCarregamento.set(true);
            return of(PAINEL_FINANCEIRO_VAZIO);
          }),
          finalize(() => this.carregando.set(false)),
        );
      }),
      takeUntilDestroyed(),
    ),
    { initialValue: PAINEL_FINANCEIRO_VAZIO },
  );
  protected readonly totalPrevisto = computed(() => this.obterResultadoIndicador('PREVISTO'));
  protected readonly totalRealizado = computed(() => this.obterResultadoIndicador('REALIZADO'));
  protected readonly entradasPeriodo = computed(() =>
    this.painel().indicadores.reduce((total, indicador) => total + indicador.entradas, 0),
  );
  protected readonly saidasPeriodo = computed(() =>
    this.painel().indicadores.reduce((total, indicador) => total + indicador.saidas, 0),
  );
  protected readonly saldoPeriodo = computed(() => this.entradasPeriodo() - this.saidasPeriodo());
  protected readonly fluxoExibido = computed(() => {
    const ordenacao = this.ordenacaoFluxo();

    return this.painel().fluxo.slice().sort((itemA, itemB) => {
      const comparacao = this.compararFluxo(itemA, itemB, ordenacao.coluna);
      return ordenacao.direcao === 'asc' ? comparacao : comparacao * -1;
    });
  });
  protected readonly contasExibidas = computed(() => {
    const ordenacao = this.ordenacaoContas();

    return this.painel().contas.slice().sort((itemA, itemB) => {
      const comparacao = this.compararContas(itemA, itemB, ordenacao.coluna);
      return ordenacao.direcao === 'asc' ? comparacao : comparacao * -1;
    });
  });
  protected readonly contasPagar = computed(() =>
    this.painel().contas.filter((conta) => conta.tipoTitulo === 'PAGAR'),
  );
  protected readonly contasReceber = computed(() =>
    this.painel().contas.filter((conta) => conta.tipoTitulo === 'RECEBER'),
  );
  protected readonly cartoesLiquido = computed(() =>
    this.painel().cartoes.reduce((total, cartao) => total + cartao.valorLiquido, 0),
  );
  protected readonly cartoesExibidos = computed(() => {
    const ordenacao = this.ordenacaoCartoes();

    return this.painel().cartoes.slice().sort((itemA, itemB) => {
      const comparacao = this.compararCartoes(itemA, itemB, ordenacao.coluna);
      return ordenacao.direcao === 'asc' ? comparacao : comparacao * -1;
    });
  });
  protected readonly extratosExibidos = computed(() => {
    const atualizados = this.extratosAtualizados();
    const termoHistorico = this.normalizarNome(this.termoHistoricoExtrato());
    const extratos = this.painel().extratos
      .map((extrato) => atualizados[extrato.origemChave] ?? extrato)
      .filter((extrato) => {
        if (!termoHistorico) {
          return true;
        }

        return this.normalizarNome(extrato.historicoTransacao).includes(termoHistorico);
      });
    const ordenacao = this.ordenacaoExtrato();

    return extratos.sort((extratoA, extratoB) => {
      const comparacao = this.compararExtratos(extratoA, extratoB, ordenacao.coluna);

      return ordenacao.direcao === 'asc' ? comparacao : comparacao * -1;
    });
  });
  protected readonly quantidadeExtratosSelecionados = computed(() => this.extratosSelecionados().size);
  protected readonly categoriasDespesaOrdenadas = computed(() => {
    const prioridades = ['aluguel', 'fundo', 'condominio'];

    return [...this.categoriasDespesa()].sort((a, b) => {
      const prioridadeA = prioridades.findIndex((termo) => this.normalizarNome(a.nome).includes(termo));
      const prioridadeB = prioridades.findIndex((termo) => this.normalizarNome(b.nome).includes(termo));
      const ordemA = prioridadeA === -1 ? 99 : prioridadeA;
      const ordemB = prioridadeB === -1 ? 99 : prioridadeB;

      if (ordemA !== ordemB) {
        return ordemA - ordemB;
      }

      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  });
  protected readonly totalRateio = computed(() =>
    this.rateiosEdicao().reduce((total, item) => total + this.converterValorDigitado(item.valor), 0),
  );
  protected readonly saldoRateio = computed(() => {
    const extrato = this.extratoRateio();

    return Math.round(((extrato ? Math.abs(extrato.valorTransacao) : 0) - this.totalRateio()) * 100) / 100;
  });
  protected readonly rateioFechado = computed(() => Math.abs(this.saldoRateio()) < 0.005);
  protected readonly secaoConfig = computed<SecaoConfig>(() => {
    switch (this.secaoAtiva()) {
      case 'contas':
        return {
          titulo: 'Contas CISS',
          resumo: 'Titulos financeiros originados no CISS por vencimento, loja e forma de pagamento.',
          contador: () => this.painel().contas.length,
        };
      case 'extrato':
        return {
          titulo: 'Extrato Bancario',
          resumo: 'Lancamentos bancarios importados, com classificacao editavel por tipo de receita ou despesa.',
          contador: () => this.extratosExibidos().length,
        };
      case 'cartoes':
        return {
          titulo: 'Cartoes',
          resumo: 'Vendas e recebimentos de cartao por fonte, modalidade, bandeira e valores liquidos.',
          contador: () => this.painel().cartoes.length,
        };
      default:
        return {
          titulo: 'Fluxo Diario',
          resumo: 'Fluxo financeiro diario por origem, separando movimentos previstos e realizados.',
          contador: () => this.painel().fluxo.length,
        };
    }
  });

  protected aplicarMesAtual(): void {
    this.filtros.patchValue({
      dataInicial: this.obterPrimeiroDiaMes(),
      dataFinal: this.obterDataHoje(),
    });
  }

  protected aplicarUltimos30Dias(): void {
    const dataInicial = new Date(this.hoje);
    dataInicial.setDate(dataInicial.getDate() - 30);

    this.filtros.patchValue({
      dataInicial: dataInicial.toISOString().slice(0, 10),
      dataFinal: this.obterDataHoje(),
    });
  }

  protected formatarMoeda(valor: number | null | undefined): string {
    return this.financeiroConsultasService.formatarMoeda(valor);
  }

  protected formatarData(data: string | null | undefined): string {
    return this.financeiroConsultasService.formatarData(data);
  }

  protected nomeFonte(origemTabela: string | null | undefined): string {
    if (!origemTabela) {
      return '-';
    }

    return origemTabela.replace('conciliacao.', '').replace('ciss.', '');
  }

  protected tipoValorClasse(valor: number): string {
    return valor >= 0 ? 'value--positive' : 'value--negative';
  }

  protected resolverTipoLancamentoValor(extrato: ConciliacaoExtratoOrigem): string {
    if (extrato.tipoLancamentoId !== null && extrato.tipoLancamentoId !== undefined) {
      return String(extrato.tipoLancamentoId);
    }

    const nomeNormalizado = this.normalizarNome(extrato.tipoLancamentoNome);
    if (!nomeNormalizado) {
      return '';
    }

    const tipoEncontrado = this.tiposLancamento().find(
      (tipo) => this.normalizarNome(tipo.nome) === nomeNormalizado,
    );

    return tipoEncontrado ? String(tipoEncontrado.id) : '';
  }

  protected tipoLancamentoAusenteNasOpcoes(extrato: ConciliacaoExtratoOrigem): boolean {
    const valorAtual = this.resolverTipoLancamentoValor(extrato);
    if (!valorAtual) {
      return false;
    }

    return !this.tiposLancamentoPermitidos(extrato).some((tipo) => String(tipo.id) === valorAtual);
  }

  protected tiposLancamentoPermitidos(extrato: ConciliacaoExtratoOrigem): readonly TipoLancamentoBancario[] {
    const naturezaEsperada = extrato.valorTransacao < 0 ? 'SAIDA' : 'ENTRADA';

    return this.tiposLancamento().filter(
      (tipo) => tipo.natureza === naturezaEsperada || tipo.natureza === 'AMBOS',
    );
  }

  protected tiposLancamentoPermitidosLote(): readonly TipoLancamentoBancario[] {
    const selecionados = this.extratosExibidos().filter((extrato) =>
      this.extratosSelecionados().has(extrato.origemChave),
    );

    if (selecionados.length === 0) {
      return [];
    }

    const possuiEntrada = selecionados.some((extrato) => extrato.valorTransacao >= 0);
    const possuiSaida = selecionados.some((extrato) => extrato.valorTransacao < 0);

    if (possuiEntrada && possuiSaida) {
      return this.tiposLancamento().filter((tipo) => tipo.natureza === 'AMBOS');
    }

    const naturezaEsperada = possuiSaida ? 'SAIDA' : 'ENTRADA';
    return this.tiposLancamento().filter(
      (tipo) => tipo.natureza === naturezaEsperada || tipo.natureza === 'AMBOS',
    );
  }

  protected tipoLancamentoSelecionado(
    extrato: ConciliacaoExtratoOrigem,
    tipoLancamentoId: number | string | null | undefined,
  ): boolean {
    const valorAtual = this.resolverTipoLancamentoValor(extrato);

    return !!valorAtual && valorAtual === String(tipoLancamentoId ?? '');
  }

  protected nomeTipoLancamentoAtual(extrato: ConciliacaoExtratoOrigem): string {
    const nome = extrato.tipoLancamentoNome?.trim();

    if (nome) {
      return nome;
    }

    return `Tipo ${extrato.tipoLancamentoId}`;
  }

  protected atualizarTipoLancamento(
    extrato: ConciliacaoExtratoOrigem,
    event: Event,
  ): void {
    const select = event.target as HTMLSelectElement;
    const tipoLancamentoId = select.value ? Number(select.value) : null;
    const tipoLancamentoNome = select.selectedOptions.item(0)?.textContent?.trim() || null;
    const extratoSelecionado: ConciliacaoExtratoOrigem = {
      ...extrato,
      tipoLancamentoId,
      tipoLancamentoNome: tipoLancamentoId ? tipoLancamentoNome : null,
      origemClassificacao: 'MANUAL',
    };

    this.salvandoClassificacao.set(extrato.origemChave);
    this.mensagemClassificacao.set(null);
    this.financeiroConsultasService
      .atualizarClassificacaoExtrato({
        origemTabela: extrato.origemTabela,
        origemChave: extrato.origemChave,
        tipoLancamentoId,
      })
      .pipe(finalize(() => this.salvandoClassificacao.set(null)))
      .subscribe({
        next: (extratoAtualizado) => {
          this.aplicarExtratoAtualizado(extratoAtualizado ?? extratoSelecionado);
          this.mensagemClassificacao.set('Classificacao gravada.');
        },
        error: () => {
          this.mensagemClassificacao.set('Nao foi possivel gravar a classificacao.');
          this.erroCarregamento.set(true);
        },
      });
  }

  protected atualizarTipoLancamentoLote(): void {
    const origemChaves = Array.from(this.extratosSelecionados());
    const tipoLancamentoId = this.tipoLancamentoLote() ? Number(this.tipoLancamentoLote()) : null;

    if (origemChaves.length === 0 || tipoLancamentoId === null) {
      return;
    }

    this.salvandoClassificacao.set('LOTE');
    this.mensagemClassificacao.set(null);
    this.financeiroConsultasService
      .atualizarClassificacaoExtratoLote({
        origemChaves,
        tipoLancamentoId,
      })
      .pipe(finalize(() => this.salvandoClassificacao.set(null)))
      .subscribe({
        next: (extratosAtualizados) => {
          for (const extrato of extratosAtualizados) {
            this.aplicarExtratoAtualizado(extrato);
          }
          this.extratosSelecionados.set(new Set());
          this.tipoLancamentoLote.set('');
          this.mensagemClassificacao.set(`${extratosAtualizados.length} lancamento(s) classificado(s).`);
        },
        error: () => {
          this.mensagemClassificacao.set('Nao foi possivel classificar os lancamentos selecionados.');
          this.erroCarregamento.set(true);
        },
      });
  }

  protected atualizarTipoLancamentoLoteSelecionado(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.tipoLancamentoLote.set(select.value);
  }

  protected ordenarFluxoPor(coluna: ColunaOrdenacaoFluxo): void {
    this.ordenacaoFluxo.update((ordenacaoAtual) => this.proximaOrdenacao(ordenacaoAtual, coluna));
  }

  protected indicadorOrdenacaoFluxo(coluna: ColunaOrdenacaoFluxo): string {
    return this.indicadorOrdenacao(this.ordenacaoFluxo(), coluna);
  }

  protected ariaSortFluxo(coluna: ColunaOrdenacaoFluxo): 'ascending' | 'descending' | 'none' {
    return this.ariaSort(this.ordenacaoFluxo(), coluna);
  }

  protected ordenarContasPor(coluna: ColunaOrdenacaoContas): void {
    this.ordenacaoContas.update((ordenacaoAtual) => this.proximaOrdenacao(ordenacaoAtual, coluna));
  }

  protected indicadorOrdenacaoContas(coluna: ColunaOrdenacaoContas): string {
    return this.indicadorOrdenacao(this.ordenacaoContas(), coluna);
  }

  protected ariaSortContas(coluna: ColunaOrdenacaoContas): 'ascending' | 'descending' | 'none' {
    return this.ariaSort(this.ordenacaoContas(), coluna);
  }

  protected ordenarExtratoPor(coluna: ColunaOrdenacaoExtrato): void {
    this.ordenacaoExtrato.update((ordenacaoAtual) => {
      if (ordenacaoAtual.coluna !== coluna) {
        return {
          coluna,
          direcao: coluna === 'data' || coluna === 'valor' ? 'desc' : 'asc',
        };
      }

      return {
        coluna,
        direcao: ordenacaoAtual.direcao === 'asc' ? 'desc' : 'asc',
      };
    });
  }

  protected indicadorOrdenacaoExtrato(coluna: ColunaOrdenacaoExtrato): string {
    const ordenacao = this.ordenacaoExtrato();

    if (ordenacao.coluna !== coluna) {
      return '-';
    }

    return ordenacao.direcao === 'asc' ? '^' : 'v';
  }

  protected ariaSortExtrato(coluna: ColunaOrdenacaoExtrato): 'ascending' | 'descending' | 'none' {
    const ordenacao = this.ordenacaoExtrato();

    if (ordenacao.coluna !== coluna) {
      return 'none';
    }

    return ordenacao.direcao === 'asc' ? 'ascending' : 'descending';
  }

  protected limparBuscaHistoricoExtrato(): void {
    this.filtroHistoricoExtrato.setValue('');
  }

  protected ordenarCartoesPor(coluna: ColunaOrdenacaoCartoes): void {
    this.ordenacaoCartoes.update((ordenacaoAtual) => this.proximaOrdenacao(ordenacaoAtual, coluna));
  }

  protected indicadorOrdenacaoCartoes(coluna: ColunaOrdenacaoCartoes): string {
    return this.indicadorOrdenacao(this.ordenacaoCartoes(), coluna);
  }

  protected ariaSortCartoes(coluna: ColunaOrdenacaoCartoes): 'ascending' | 'descending' | 'none' {
    return this.ariaSort(this.ordenacaoCartoes(), coluna);
  }

  protected abrirRateioExtrato(extrato: ConciliacaoExtratoOrigem): void {
    this.extratoRateio.set(extrato);
    this.mensagemRateio.set(null);
    this.carregandoRateio.set(true);

    this.financeiroConsultasService
      .listarRateiosExtrato(extrato.origemChave, extrato.origemTabela)
      .pipe(finalize(() => this.carregandoRateio.set(false)))
      .subscribe({
        next: (rateios) => {
          this.rateiosEdicao.set(
            rateios.length > 0
              ? rateios.map((rateio) => this.mapearRateioParaEdicao(rateio))
              : [this.criarLinhaRateio(extrato.categoriaFinanceiraId, Math.abs(extrato.valorTransacao))],
          );
        },
        error: () => {
          this.rateiosEdicao.set([this.criarLinhaRateio(extrato.categoriaFinanceiraId, Math.abs(extrato.valorTransacao))]);
          this.mensagemRateio.set('Nao foi possivel carregar o rateio atual.');
        },
      });
  }

  protected fecharRateioExtrato(): void {
    if (this.salvandoRateio()) {
      return;
    }

    this.extratoRateio.set(null);
    this.rateiosEdicao.set([]);
    this.mensagemRateio.set(null);
  }

  protected adicionarLinhaRateio(): void {
    this.rateiosEdicao.update((linhas) => [...linhas, this.criarLinhaRateio(null, Math.max(this.saldoRateio(), 0))]);
  }

  protected removerLinhaRateio(indice: number): void {
    this.rateiosEdicao.update((linhas) => linhas.filter((_, linhaIndice) => linhaIndice !== indice));
  }

  protected atualizarLinhaRateio(indice: number, campo: keyof RateioLinhaEdicao, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLSelectElement;

    this.rateiosEdicao.update((linhas) =>
      linhas.map((linha, linhaIndice) =>
        linhaIndice === indice
          ? {
              ...linha,
              [campo]: input.value,
            }
          : linha,
      ),
    );
  }

  protected salvarRateioExtrato(): void {
    const extrato = this.extratoRateio();
    if (!extrato || this.salvandoRateio() || !this.rateioFechado()) {
      return;
    }

    const itens = this.rateiosEdicao()
      .map((linha) => ({
        categoriaFinanceiraId: Number(linha.categoriaFinanceiraId),
        descricao: linha.descricao || null,
        valor: this.converterValorDigitado(linha.valor),
        observacao: linha.observacao || null,
      }))
      .filter((linha) => linha.categoriaFinanceiraId && linha.valor > 0);

    if (itens.length === 0) {
      this.mensagemRateio.set('Informe ao menos uma categoria e valor.');
      return;
    }

    this.salvandoRateio.set(true);
    this.mensagemRateio.set(null);
    this.financeiroConsultasService
      .salvarRateiosExtrato(
        extrato.origemChave,
        {
          itens,
        },
        extrato.origemTabela,
      )
      .pipe(finalize(() => this.salvandoRateio.set(false)))
      .subscribe({
        next: (rateios) => {
          this.rateiosEdicao.set(rateios.map((rateio) => this.mapearRateioParaEdicao(rateio)));
          this.mensagemRateio.set('Rateio gravado.');
        },
        error: () => {
          this.mensagemRateio.set('Nao foi possivel gravar o rateio.');
        },
      });
  }

  protected extratoSelecionado(extrato: ConciliacaoExtratoOrigem): boolean {
    return this.extratosSelecionados().has(extrato.origemChave);
  }

  protected alternarExtratoSelecionado(extrato: ConciliacaoExtratoOrigem, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.extratosSelecionados.update((selecionadosAtuais) => {
      const selecionados = new Set(selecionadosAtuais);

      if (input.checked) {
        selecionados.add(extrato.origemChave);
      } else {
        selecionados.delete(extrato.origemChave);
      }

      return selecionados;
    });
  }

  protected todosExtratosExibidosSelecionados(): boolean {
    const extratos = this.extratosExibidos();
    return extratos.length > 0 && extratos.every((extrato) => this.extratosSelecionados().has(extrato.origemChave));
  }

  protected alternarTodosExtratosExibidos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const origemChaves = this.extratosExibidos().map((extrato) => extrato.origemChave);

    this.extratosSelecionados.update((selecionadosAtuais) => {
      const selecionados = new Set(selecionadosAtuais);

      for (const origemChave of origemChaves) {
        if (input.checked) {
          selecionados.add(origemChave);
        } else {
          selecionados.delete(origemChave);
        }
      }

      return selecionados;
    });
  }

  private aplicarExtratoAtualizado(extrato: ConciliacaoExtratoOrigem): void {
    this.extratosAtualizados.update((atualizados) => ({
      ...atualizados,
      [extrato.origemChave]: extrato,
    }));
  }

  private compararFluxo(
    itemA: FluxoCaixaOrigemDiario,
    itemB: FluxoCaixaOrigemDiario,
    coluna: ColunaOrdenacaoFluxo,
  ): number {
    switch (coluna) {
      case 'data':
        return this.compararTexto(itemA.dataEvento, itemB.dataEvento);
      case 'loja':
        return this.compararTexto(itemA.sapLoja, itemB.sapLoja);
      case 'tipo':
        return this.compararTexto(itemA.tipoEvento, itemB.tipoEvento);
      case 'entradas':
        return itemA.entradas - itemB.entradas;
      case 'saidas':
        return itemA.saidas - itemB.saidas;
      case 'saldo':
        return itemA.saldoDia - itemB.saldoDia;
      case 'acumulado':
        return itemA.saldoAcumulado - itemB.saldoAcumulado;
    }
  }

  private compararContas(
    itemA: ContaFinanceiraOrigem,
    itemB: ContaFinanceiraOrigem,
    coluna: ColunaOrdenacaoContas,
  ): number {
    switch (coluna) {
      case 'vencimento':
        return this.compararTexto(itemA.dataVencimento, itemB.dataVencimento);
      case 'tipo':
        return this.compararTexto(itemA.tipoTitulo, itemB.tipoTitulo);
      case 'loja':
        return this.compararTexto(itemA.sapLoja, itemB.sapLoja);
      case 'forma':
        return this.compararTexto(itemA.descricaoFormaPagamento, itemB.descricaoFormaPagamento);
      case 'cartao':
        return this.compararTexto(
          itemA.bandeiraCartao ?? itemA.operadoraCartao,
          itemB.bandeiraCartao ?? itemB.operadoraCartao,
        );
      case 'valor':
        return itemA.valorParcela - itemB.valorParcela;
      case 'origem':
        return this.compararTexto(this.nomeFonte(itemA.origemTabela), this.nomeFonte(itemB.origemTabela));
    }
  }

  private compararExtratos(
    extratoA: ConciliacaoExtratoOrigem,
    extratoB: ConciliacaoExtratoOrigem,
    coluna: ColunaOrdenacaoExtrato,
  ): number {
    switch (coluna) {
      case 'data':
        return this.compararTexto(extratoA.dataTransacao, extratoB.dataTransacao);
      case 'loja':
        return this.compararTexto(extratoA.sapLoja, extratoB.sapLoja);
      case 'banco':
        return this.compararTexto(extratoA.numeroBanco, extratoB.numeroBanco);
      case 'conta':
        return this.compararTexto(extratoA.numeroConta, extratoB.numeroConta);
      case 'historico':
        return this.compararTexto(extratoA.historicoTransacao, extratoB.historicoTransacao);
      case 'tipo':
        return this.compararTexto(this.nomeTipoLancamentoAtual(extratoA), this.nomeTipoLancamentoAtual(extratoB));
      case 'valor':
        return extratoA.valorTransacao - extratoB.valorTransacao;
    }
  }

  private compararTexto(valorA: string | null | undefined, valorB: string | null | undefined): number {
    return (valorA ?? '').localeCompare(valorB ?? '', 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    });
  }

  private compararCartoes(
    itemA: ConciliacaoCartaoOrigem,
    itemB: ConciliacaoCartaoOrigem,
    coluna: ColunaOrdenacaoCartoes,
  ): number {
    switch (coluna) {
      case 'venda':
        return this.compararTexto(itemA.dataVenda, itemB.dataVenda);
      case 'fonte':
        return this.compararTexto(this.nomeFonte(itemA.origemTabela), this.nomeFonte(itemB.origemTabela));
      case 'status':
        return this.compararTexto(itemA.statusOrigem, itemB.statusOrigem);
      case 'modalidade':
        return this.compararTexto(itemA.modalidade ?? itemA.tipo, itemB.modalidade ?? itemB.tipo);
      case 'bandeira':
        return this.compararTexto(itemA.bandeira, itemB.bandeira);
      case 'nsu':
        return this.compararTexto(itemA.nsuCv, itemB.nsuCv);
      case 'bruto':
        return itemA.valorBruto - itemB.valorBruto;
      case 'taxa':
        return itemA.valorMdr - itemB.valorMdr;
      case 'liquido':
        return itemA.valorLiquido - itemB.valorLiquido;
    }
  }

  private proximaOrdenacao<Coluna extends string>(
    ordenacaoAtual: OrdenacaoTabela<Coluna>,
    coluna: Coluna,
  ): OrdenacaoTabela<Coluna> {
    if (ordenacaoAtual.coluna !== coluna) {
      return {
        coluna,
        direcao: this.colunaNumericaOuData(coluna) ? 'desc' : 'asc',
      };
    }

    return {
      coluna,
      direcao: ordenacaoAtual.direcao === 'asc' ? 'desc' : 'asc',
    };
  }

  private indicadorOrdenacao<Coluna extends string>(
    ordenacao: OrdenacaoTabela<Coluna>,
    coluna: Coluna,
  ): string {
    if (ordenacao.coluna !== coluna) {
      return '-';
    }

    return ordenacao.direcao === 'asc' ? '^' : 'v';
  }

  private ariaSort<Coluna extends string>(
    ordenacao: OrdenacaoTabela<Coluna>,
    coluna: Coluna,
  ): 'ascending' | 'descending' | 'none' {
    if (ordenacao.coluna !== coluna) {
      return 'none';
    }

    return ordenacao.direcao === 'asc' ? 'ascending' : 'descending';
  }

  private colunaNumericaOuData(coluna: string): boolean {
    return [
      'data',
      'vencimento',
      'venda',
      'entradas',
      'saidas',
      'saldo',
      'acumulado',
      'valor',
      'bruto',
      'taxa',
      'liquido',
    ].includes(coluna);
  }

  protected trackOrigem(_: number, item: { origemChave: string }): string {
    return item.origemChave;
  }

  protected trackFluxo(_: number, item: { dataEvento: string; sapLoja: string | null; tipoEvento: string }): string {
    return `${item.dataEvento}-${item.sapLoja ?? 'geral'}-${item.tipoEvento}`;
  }

  protected trackTipoLancamento(_: number, item: { id: number }): number {
    return item.id;
  }

  protected trackCategoria(_: number, item: CategoriaFinanceira): number {
    return item.id;
  }

  private resolverTipoLancamentoFiltroId(valor: string | null): string | null {
    if (valor === this.filtroNaoClassificado) {
      return null;
    }

    return valor;
  }

  private resolverClassificacaoFiltro(valor: string | null): string | null {
    if (valor === this.filtroNaoClassificado) {
      return this.filtroNaoClassificado;
    }

    return null;
  }

  private normalizarSecao(secao: unknown): AbaFinanceira {
    if (secao === 'contas' || secao === 'extrato' || secao === 'cartoes') {
      return secao;
    }

    return 'fluxo';
  }

  private normalizarNome(valor: string | null | undefined): string {
    return (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private criarLinhaRateio(
    categoriaFinanceiraId: number | null | undefined,
    valor: number,
  ): RateioLinhaEdicao {
    return {
      categoriaFinanceiraId: categoriaFinanceiraId ? String(categoriaFinanceiraId) : '',
      descricao: '',
      valor: this.formatarNumeroEdicao(valor),
      observacao: '',
    };
  }

  private mapearRateioParaEdicao(rateio: ExtratoBancarioRateio): RateioLinhaEdicao {
    return {
      categoriaFinanceiraId: String(rateio.categoriaFinanceiraId),
      descricao: rateio.descricao ?? '',
      valor: this.formatarNumeroEdicao(rateio.valor),
      observacao: rateio.observacao ?? '',
    };
  }

  private converterValorDigitado(valor: string): number {
    const numero = Number((valor || '0').replace(/\./g, '').replace(',', '.'));

    if (!Number.isFinite(numero)) {
      return 0;
    }

    return Math.round(numero * 100) / 100;
  }

  private formatarNumeroEdicao(valor: number): string {
    return (valor || 0).toFixed(2).replace('.', ',');
  }

  private obterResultadoIndicador(tipoEvento: string): number {
    return this.painel().indicadores
      .filter((indicador) => indicador.tipoEvento === tipoEvento)
      .reduce((total, indicador) => total + indicador.resultado, 0);
  }

  private obterPrimeiroDiaMes(): string {
    return new Date(this.hoje.getFullYear(), this.hoje.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
  }

  private obterDataHoje(): string {
    return this.hoje.toISOString().slice(0, 10);
  }
}
