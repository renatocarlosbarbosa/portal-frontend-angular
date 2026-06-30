import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import {
  FinanceiroConsultasPainel,
  PAINEL_FINANCEIRO_VAZIO,
} from './financeiro-consultas';
import { FinanceiroConsultasService } from './financeiro-consultas.service';

type AbaFinanceira = 'fluxo' | 'contas' | 'extrato' | 'cartoes';

@Component({
  selector: 'app-financeiro-consultas',
  imports: [ReactiveFormsModule],
  templateUrl: './financeiro-consultas.component.html',
  styleUrl: './financeiro-consultas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceiroConsultasComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly financeiroConsultasService = inject(FinanceiroConsultasService);
  private readonly hoje = new Date();

  protected readonly abas: readonly { id: AbaFinanceira; label: string; contador: () => number }[] = [
    { id: 'fluxo', label: 'Fluxo diario', contador: () => this.painel().fluxo.length },
    { id: 'contas', label: 'Contas CISS', contador: () => this.painel().contas.length },
    { id: 'extrato', label: 'Extrato OFX', contador: () => this.painel().extratos.length },
    { id: 'cartoes', label: 'Cartoes', contador: () => this.painel().cartoes.length },
  ];
  protected readonly lojas = ['101260', '101261', '101266', '107005'];
  protected readonly abaAtiva = signal<AbaFinanceira>('fluxo');
  protected readonly carregando = signal(true);
  protected readonly erroCarregamento = signal(false);
  protected readonly filtros = this.formBuilder.nonNullable.group({
    dataInicial: [this.obterPrimeiroDiaMes()],
    dataFinal: [this.obterDataHoje()],
    sapLoja: [''],
  });
  protected readonly painel = toSignal(
    this.filtros.valueChanges.pipe(
      startWith(this.filtros.getRawValue()),
      debounceTime(250),
      distinctUntilChanged((anterior, atual) => JSON.stringify(anterior) === JSON.stringify(atual)),
      tap(() => {
        this.carregando.set(true);
        this.erroCarregamento.set(false);
      }),
      switchMap((filtros) =>
        this.financeiroConsultasService
          .carregarPainel({
            dataInicial: filtros.dataInicial ?? '',
            dataFinal: filtros.dataFinal ?? '',
            sapLoja: filtros.sapLoja || null,
          })
          .pipe(
            catchError(() => {
              this.erroCarregamento.set(true);
              return of(PAINEL_FINANCEIRO_VAZIO);
            }),
            finalize(() => this.carregando.set(false)),
          ),
      ),
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

  protected selecionarAba(aba: AbaFinanceira): void {
    this.abaAtiva.set(aba);
  }

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

  protected trackOrigem(_: number, item: { origemChave: string }): string {
    return item.origemChave;
  }

  protected trackFluxo(_: number, item: { dataEvento: string; sapLoja: string | null; tipoEvento: string }): string {
    return `${item.dataEvento}-${item.sapLoja ?? 'geral'}-${item.tipoEvento}`;
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
