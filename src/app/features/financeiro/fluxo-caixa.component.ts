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

import { FluxoCaixaService } from './fluxo-caixa.service';

@Component({
  selector: 'app-fluxo-caixa',
  imports: [ReactiveFormsModule],
  templateUrl: './fluxo-caixa.component.html',
  styleUrl: './fluxo-caixa.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FluxoCaixaComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly fluxoCaixaService = inject(FluxoCaixaService);
  private readonly hoje = new Date();

  protected readonly carregando = signal(true);
  protected readonly erroCarregamento = signal(false);
  protected readonly filtros = this.formBuilder.nonNullable.group({
    dataInicial: [this.obterPrimeiroDiaMes()],
    dataFinal: [this.obterDataHoje()],
  });
  protected readonly resumo = toSignal(
    this.filtros.valueChanges.pipe(
      startWith(this.filtros.getRawValue()),
      debounceTime(250),
      distinctUntilChanged((anterior, atual) => JSON.stringify(anterior) === JSON.stringify(atual)),
      tap(() => {
        this.carregando.set(true);
        this.erroCarregamento.set(false);
      }),
      switchMap((filtros) =>
        this.fluxoCaixaService.listarFluxo(filtros.dataInicial ?? '', filtros.dataFinal ?? '').pipe(
          catchError(() => {
            this.erroCarregamento.set(true);
            return of({
              lojas: [],
              linhas: [],
              saldoPeriodo: 0,
              totalEntradas: 0,
              totalSaidas: 0,
            });
          }),
          finalize(() => this.carregando.set(false)),
        ),
      ),
      takeUntilDestroyed(),
    ),
    {
      initialValue: {
        lojas: [],
        linhas: [],
        saldoPeriodo: 0,
        totalEntradas: 0,
        totalSaidas: 0,
      },
    },
  );
  protected readonly saldoClasse = computed(() =>
    this.resumo().saldoPeriodo >= 0 ? 'value--positive' : 'value--negative',
  );
  protected readonly diasPeriodo = computed(() => this.resumo().linhas.length);
  protected readonly mediaDiaria = computed(() => {
    const dias = this.diasPeriodo();

    return dias > 0 ? this.resumo().saldoPeriodo / dias : 0;
  });

  protected formatarMoeda(valor: number | undefined): string {
    if (valor === undefined) {
      return '-';
    }

    return this.fluxoCaixaService.formatarMoeda(valor);
  }

  protected aplicarMesAtual(): void {
    this.filtros.setValue({
      dataInicial: this.obterPrimeiroDiaMes(),
      dataFinal: this.obterDataHoje(),
    });
  }

  protected aplicarProximos30Dias(): void {
    const dataFinal = new Date(this.hoje);
    dataFinal.setDate(dataFinal.getDate() + 30);

    this.filtros.setValue({
      dataInicial: this.obterDataHoje(),
      dataFinal: dataFinal.toISOString().slice(0, 10),
    });
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
