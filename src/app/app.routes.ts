import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { AppLayoutComponent } from './layouts/app-layout/app-layout.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    title: 'Login | Portal Grupo A2R2',
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
        title: 'Dashboard | Portal Grupo A2R2',
      },
      {
        path: 'vendas/produtos',
        loadComponent: () =>
          import('./features/vendas/vendas-produtos.component').then(
            (m) => m.VendasProdutosComponent,
          ),
        title: 'Vendas por Produto | Portal Grupo A2R2',
      },
      {
        path: 'estoque',
        loadComponent: () =>
          import('./features/estoque/estoque-produtos.component').then(
            (m) => m.EstoqueProdutosComponent,
          ),
        title: 'Estoque | Portal Grupo A2R2',
      },
      {
        path: 'financeiro/fluxo-caixa',
        loadComponent: () =>
          import('./features/financeiro/fluxo-caixa.component').then(
            (m) => m.FluxoCaixaComponent,
          ),
        title: 'Fluxo de Caixa | Portal Grupo A2R2',
      },
      {
        path: 'financeiro/consultas',
        pathMatch: 'full',
        redirectTo: 'financeiro/fluxo-diario',
      },
      {
        path: 'financeiro/fluxo-diario',
        loadComponent: () =>
          import('./features/financeiro/financeiro-consultas.component').then(
            (m) => m.FinanceiroConsultasComponent,
          ),
        data: { secaoFinanceira: 'fluxo' },
        title: 'Fluxo Diario | Portal Grupo A2R2',
      },
      {
        path: 'financeiro/contas-ciss',
        loadComponent: () =>
          import('./features/financeiro/financeiro-consultas.component').then(
            (m) => m.FinanceiroConsultasComponent,
          ),
        data: { secaoFinanceira: 'contas' },
        title: 'Contas CISS | Portal Grupo A2R2',
      },
      {
        path: 'financeiro/extrato-bancario',
        loadComponent: () =>
          import('./features/financeiro/financeiro-consultas.component').then(
            (m) => m.FinanceiroConsultasComponent,
          ),
        data: { secaoFinanceira: 'extrato' },
        title: 'Extrato Bancario | Portal Grupo A2R2',
      },
      {
        path: 'financeiro/cartoes',
        loadComponent: () =>
          import('./features/financeiro/financeiro-consultas.component').then(
            (m) => m.FinanceiroConsultasComponent,
          ),
        data: { secaoFinanceira: 'cartoes' },
        title: 'Cartoes | Portal Grupo A2R2',
      },
      {
        path: 'compras/organizacao',
        loadComponent: () =>
          import('./features/compras/compras.component').then(
            (m) => m.ComprasComponent,
          ),
        title: 'Compras | Portal Grupo A2R2',
      },
      {
        path: 'caixa',
        pathMatch: 'full',
        redirectTo: 'caixa/contagem',
      },
      {
        path: 'caixa/contagem',
        loadComponent: () =>
          import('./features/caixa/caixa-contagem.component').then(
            (m) => m.CaixaContagemComponent,
          ),
        title: 'Fechamento de Caixa | Portal Grupo A2R2',
      },
      {
        path: 'caixa/cartoes-pix',
        loadComponent: () =>
          import('./features/caixa/caixa-cartoes-pix.component').then(
            (m) => m.CaixaCartoesPixComponent,
          ),
        title: 'Cartoes e PIX | Portal Grupo A2R2',
      },
      {
        path: 'caixa/resumo',
        loadComponent: () =>
          import('./features/caixa/caixa-resumo.component').then(
            (m) => m.CaixaResumoComponent,
          ),
        title: 'Resumo do Caixa | Portal Grupo A2R2',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
