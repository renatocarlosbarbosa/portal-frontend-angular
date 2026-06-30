import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CaixaConfiguracao } from './caixa-fechamento';

@Injectable({
  providedIn: 'root',
})
export class CaixaConfiguracaoService {
  private readonly httpClient = inject(HttpClient);

  buscarConfiguracao(): Observable<CaixaConfiguracao> {
    return this.httpClient.get<CaixaConfiguracao>('/api/caixa/configuracao');
  }
}
