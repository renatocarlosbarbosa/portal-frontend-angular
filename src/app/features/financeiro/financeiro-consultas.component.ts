import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
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
  ConciliacaoExtratoOrigem,
  FinanceiroConsultasPainel,
  PAINEL_FINANCEIRO_VAZIO,
  TipoLancamentoBancario,
} from './financeiro-consultas';
import { FinanceiroConsultasService } from './financeiro-consultas.service';

type AbaFinanceira = 'fluxo' | 'contas' | 'extrato' | 'cartoes';
type SecaoConfig = {
  readonly titulo: string;
  readonly resumo: string;
  readonly contador: () => number;
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
  protected readonly contasPagar = computed(() =>
    this.painel().contas.filter((conta) => conta.tipoTitulo === 'PAGAR'),
  );
  protected readonly contasReceber = computed(() =>
    this.painel().contas.filter((conta) => conta.tipoTitulo === 'RECEBER'),
  );
  protected readonly cartoesLiquido = computed(() =>
    this.painel().cartoes.reduce((total, cartao) => total + cartao.valorLiquido, 0),
  );
  protected readonly extratosExibidos = computed(() => {
    const atualizados = this.extratosAtualizados();
    return this.painel().extratos.map((extrato) => atualizados[extrato.origemChave] ?? extrato);
  });
  protected readonly quantidadeExtratosSelecionados = computed(() => this.extratosSelecionados().size);
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

  protected trackOrigem(_: number, item: { origemChave: string }): string {
    return item.origemChave;
  }

  protected trackFluxo(_: number, item: { dataEvento: string; sapLoja: string | null; tipoEvento: string }): string {
    return `${item.dataEvento}-${item.sapLoja ?? 'geral'}-${item.tipoEvento}`;
  }

  protected trackTipoLancamento(_: number, item: { id: number }): number {
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
