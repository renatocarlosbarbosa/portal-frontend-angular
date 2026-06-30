import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CaixaFechamentoService } from './caixa-fechamento.service';

@Component({
  selector: 'app-caixa-cartoes-pix',
  imports: [RouterLink],
  templateUrl: './caixa-cartoes-pix.component.html',
  styleUrl: './caixa-cartoes-pix.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaixaCartoesPixComponent {
  private readonly router = inject(Router);
  protected readonly caixaFechamentoService = inject(CaixaFechamentoService);

  protected atualizarRecebimentos(totalMaquininha: string, pix: string): void {
    this.caixaFechamentoService.atualizarRecebimentosEletronicos(
      Number(totalMaquininha),
      Number(pix),
    );
  }

  protected avancar(): void {
    this.router.navigateByUrl('/caixa/resumo');
  }

  protected formatarMoeda(valor: number): string {
    return this.caixaFechamentoService.formatarMoeda(valor);
  }
}
