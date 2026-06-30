import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CaixaFechamentoService } from './caixa-fechamento.service';

@Component({
  selector: 'app-caixa-resumo',
  imports: [RouterLink],
  templateUrl: './caixa-resumo.component.html',
  styleUrl: './caixa-resumo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaixaResumoComponent {
  protected readonly caixaFechamentoService = inject(CaixaFechamentoService);

  protected formatarMoeda(valor: number): string {
    return this.caixaFechamentoService.formatarMoeda(valor);
  }
}
