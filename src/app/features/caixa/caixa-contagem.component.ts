import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { CaixaConfiguracaoService } from './caixa-configuracao.service';
import { CaixaFechamentoService } from './caixa-fechamento.service';

@Component({
  selector: 'app-caixa-contagem',
  imports: [RouterLink],
  templateUrl: './caixa-contagem.component.html',
  styleUrl: './caixa-contagem.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaixaContagemComponent {
  private readonly caixaConfiguracaoService = inject(CaixaConfiguracaoService);
  private readonly router = inject(Router);
  protected readonly caixaFechamentoService = inject(CaixaFechamentoService);

  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    this.carregarConfiguracao();
  }

  protected atualizarQuantidade(codigo: string, valor: string): void {
    this.caixaFechamentoService.atualizarQuantidade(codigo, Number(valor));
  }

  protected limpar(): void {
    if (confirm('Deseja limpar a contagem do fechamento de caixa?')) {
      this.caixaFechamentoService.limpar();
    }
  }

  protected avancar(): void {
    this.router.navigateByUrl('/caixa/cartoes-pix');
  }

  protected formatarMoeda(valor: number): string {
    return this.caixaFechamentoService.formatarMoeda(valor);
  }

  private carregarConfiguracao(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.caixaConfiguracaoService
      .buscarConfiguracao()
      .pipe(
        catchError(() => {
          this.erro.set('Nao foi possivel carregar a configuracao do caixa.');
          return of(null);
        }),
        finalize(() => this.carregando.set(false)),
      )
      .subscribe((configuracao) => {
        if (configuracao) {
          this.caixaFechamentoService.aplicarConfiguracao(configuracao);
        }
      });
  }
}
