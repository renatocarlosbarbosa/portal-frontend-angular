import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, catchError, debounceTime, distinctUntilChanged, finalize, of, tap } from 'rxjs';

import {
  COMPRAS_PAINEL_VAZIO,
  ComprasPainel,
  ConsolidadoCompra,
  GrupoItemCompra,
  ItemCompra,
  LocalCompra,
  NecessidadeCompra,
  PedidoCompraDetalhe,
  PedidoCompraItem,
  PedidoCompraResumo,
} from './compras';
import { ComprasService } from './compras.service';

type AbaCompras =
  | 'organizacao'
  | 'lista'
  | 'necessidades'
  | 'itens'
  | 'grupos'
  | 'locais'
  | 'historico';

@Component({
  selector: 'app-compras',
  imports: [ReactiveFormsModule],
  templateUrl: './compras.component.html',
  styleUrl: './compras.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComprasComponent {
  private readonly comprasService = inject(ComprasService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly lojas = ['101260', '101261', '101266', '107005'];
  protected readonly tiposLocal = [
    { id: 'SUPERMERCADO_LOCAL', label: 'Supermercado local' },
    { id: 'FORNECEDOR_HOMOLOGADO', label: 'Fornecedor homologado' },
    { id: 'DISTRIBUIDOR', label: 'Distribuidor' },
    { id: 'OUTRO', label: 'Outro' },
  ];
  protected readonly prioridades = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'];
  protected readonly statusNecessidade = ['PENDENTE', 'INCLUIDO_LISTA', 'COMPRADO', 'CANCELADO'];
  protected readonly abas: readonly { id: AbaCompras; label: string; contador: () => number }[] = [
    { id: 'organizacao', label: 'Organizacao', contador: () => this.painel().organizacao.length },
    { id: 'lista', label: 'Lista de compra', contador: () => this.painel().pedidos.length },
    { id: 'necessidades', label: 'Necessidades', contador: () => this.painel().necessidades.length },
    { id: 'itens', label: 'Itens', contador: () => this.painel().itens.length },
    { id: 'grupos', label: 'Grupos', contador: () => this.painel().grupos.length },
    { id: 'locais', label: 'Locais', contador: () => this.painel().locais.length },
    { id: 'historico', label: 'Historico', contador: () => this.painel().historico.length },
  ];

  protected readonly abaAtiva = signal<AbaCompras>('organizacao');
  protected readonly carregando = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly sucesso = signal<string | null>(null);
  protected readonly painel = signal<ComprasPainel>(COMPRAS_PAINEL_VAZIO);
  protected readonly necessidadesSelecionadas = signal<ReadonlySet<number>>(new Set<number>());
  protected readonly pedidoSelecionado = signal<PedidoCompraDetalhe | null>(null);
  protected readonly grupoEmEdicao = signal<GrupoItemCompra | null>(null);
  protected readonly localEmEdicao = signal<LocalCompra | null>(null);
  protected readonly itemEmEdicao = signal<ItemCompra | null>(null);

  protected readonly filtros = this.formBuilder.nonNullable.group({
    sapLoja: [''],
    localCompraId: [''],
    fornecedorId: [''],
    grupoId: [''],
    status: ['PENDENTE'],
    prioridade: [''],
  });
  protected readonly grupoForm = this.formBuilder.nonNullable.group({
    nome: ['', Validators.required],
    descricao: [''],
  });
  protected readonly fornecedorForm = this.formBuilder.nonNullable.group({
    nome: ['', Validators.required],
    documento: [''],
    contato: [''],
    telefone: [''],
    email: [''],
    observacoes: [''],
  });
  protected readonly localForm = this.formBuilder.nonNullable.group({
    nome: ['', Validators.required],
    tipo: ['SUPERMERCADO_LOCAL', Validators.required],
    fornecedorId: [''],
    observacoes: [''],
  });
  protected readonly itemForm = this.formBuilder.nonNullable.group({
    descricao: ['', Validators.required],
    grupoId: ['', Validators.required],
    unidadeMedidaId: ['', Validators.required],
    localCompraPadraoId: [''],
    fornecedorPadraoId: [''],
    quantidadeMinimaSugerida: ['0'],
    quantidadePadraoCompra: ['1', Validators.required],
    recorrente: [true],
    homologado: [false],
    observacoes: [''],
  });
  protected readonly necessidadeForm = this.formBuilder.nonNullable.group({
    sapLoja: ['101260', Validators.required],
    itemCompraId: ['', Validators.required],
    quantidadeNecessaria: ['1', Validators.required],
    prioridade: ['NORMAL', Validators.required],
    observacao: [''],
    dataNecessidade: [this.obterDataHoje(), Validators.required],
    usuarioResponsavel: [''],
  });
  protected readonly pedidoForm = this.formBuilder.nonNullable.group({
    usuarioResponsavel: [''],
    observacoes: [''],
    dataCompra: [this.obterDataHoje()],
  });

  protected readonly totalPendente = computed(() =>
    this.painel().necessidades.filter((necessidade) => necessidade.status === 'PENDENTE').length,
  );
  protected readonly totalSelecionado = computed(() => this.necessidadesSelecionadas().size);
  protected readonly valorPedidosAbertos = computed(() =>
    this.painel().pedidos.reduce((total, pedido) => total + pedido.valorTotal, 0),
  );
  protected readonly itensCompradosPedido = computed(() =>
    this.pedidoSelecionado()?.itens.filter((item) => item.status === 'COMPRADO').length ?? 0,
  );

  constructor() {
    this.filtros.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged((anterior, atual) => JSON.stringify(anterior) === JSON.stringify(atual)),
        tap(() => this.carregarPainel()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.carregarPainel();
  }

  protected selecionarAba(aba: AbaCompras): void {
    this.abaAtiva.set(aba);
  }

  protected carregarPainel(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.comprasService
      .carregarPainel({
        sapLoja: this.valorTexto(this.filtros.controls.sapLoja.value),
        localCompraId: this.valorNumero(this.filtros.controls.localCompraId.value),
        fornecedorId: this.valorNumero(this.filtros.controls.fornecedorId.value),
        grupoId: this.valorNumero(this.filtros.controls.grupoId.value),
        status: this.valorTexto(this.filtros.controls.status.value),
        prioridade: this.valorTexto(this.filtros.controls.prioridade.value),
      })
      .pipe(
        catchError(() => {
          this.erro.set('Nao foi possivel carregar o modulo de compras.');
          return of(this.comprasService.painelVazio());
        }),
        finalize(() => this.carregando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((painel) => {
        this.painel.set(painel);
        this.limparSelecaoInvalida(painel);
      });
  }

  protected salvarGrupo(): void {
    if (this.grupoForm.invalid) {
      return;
    }

    const grupo = this.grupoEmEdicao();
    const payload = { ...this.grupoForm.getRawValue(), ativo: grupo?.ativo ?? true };
    this.executarSalvamento(
      grupo
        ? this.comprasService.atualizarGrupo(grupo.id, payload)
        : this.comprasService.criarGrupo(payload),
      grupo ? 'Grupo atualizado.' : 'Grupo cadastrado.',
      () => this.cancelarEdicaoGrupo(),
    );
  }

  protected criarFornecedor(): void {
    if (this.fornecedorForm.invalid) {
      return;
    }

    this.executarSalvamento(
      this.comprasService.criarFornecedor({ ...this.fornecedorForm.getRawValue(), ativo: true }),
      'Fornecedor cadastrado.',
      () =>
        this.fornecedorForm.reset({
          nome: '',
          documento: '',
          contato: '',
          telefone: '',
          email: '',
          observacoes: '',
        }),
    );
  }

  protected salvarLocal(): void {
    if (this.localForm.invalid) {
      return;
    }

    const valor = this.localForm.getRawValue();
    const local = this.localEmEdicao();
    this.executarSalvamento(
      local ? this.comprasService.atualizarLocal(local.id, {
        nome: valor.nome,
        tipo: valor.tipo,
        fornecedorId: this.valorNumero(valor.fornecedorId),
        observacoes: valor.observacoes,
        ativo: local.ativo,
      }) : this.comprasService.criarLocal({
        nome: valor.nome,
        tipo: valor.tipo,
        fornecedorId: this.valorNumero(valor.fornecedorId),
        observacoes: valor.observacoes,
        ativo: true,
      }),
      local ? 'Local de compra atualizado.' : 'Local de compra cadastrado.',
      () => this.cancelarEdicaoLocal(),
    );
  }

  protected salvarItem(): void {
    if (this.itemForm.invalid) {
      return;
    }

    const valor = this.itemForm.getRawValue();
    const item = this.itemEmEdicao();
    const payload = {
      descricao: valor.descricao,
      grupoId: this.valorNumero(valor.grupoId),
      unidadeMedidaId: this.valorNumero(valor.unidadeMedidaId),
      localCompraPadraoId: this.valorNumero(valor.localCompraPadraoId),
      fornecedorPadraoId: this.valorNumero(valor.fornecedorPadraoId),
      quantidadeMinimaSugerida: this.valorDecimal(valor.quantidadeMinimaSugerida),
      quantidadePadraoCompra: this.valorDecimal(valor.quantidadePadraoCompra),
      recorrente: valor.recorrente,
      homologado: valor.homologado,
      observacoes: valor.observacoes,
      ativo: item?.ativo ?? true,
    };

    this.executarSalvamento(
      item ? this.comprasService.atualizarItem(item.id, payload) : this.comprasService.criarItem(payload),
      item ? 'Item atualizado.' : 'Item cadastrado.',
      () => this.cancelarEdicaoItem(),
    );
  }

  protected editarGrupo(grupo: GrupoItemCompra): void {
    this.grupoEmEdicao.set(grupo);
    this.grupoForm.setValue({
      nome: grupo.nome,
      descricao: grupo.descricao ?? '',
    });
  }

  protected cancelarEdicaoGrupo(): void {
    this.grupoEmEdicao.set(null);
    this.grupoForm.reset({ nome: '', descricao: '' });
  }

  protected desativarGrupo(grupo: GrupoItemCompra): void {
    this.executarSalvamento(this.comprasService.desativarGrupo(grupo.id), 'Grupo inativado.');
  }

  protected excluirGrupo(grupo: GrupoItemCompra): void {
    this.executarSalvamento(this.comprasService.excluirGrupo(grupo.id), 'Grupo excluido.');
  }

  protected editarLocal(local: LocalCompra): void {
    this.localEmEdicao.set(local);
    this.localForm.setValue({
      nome: local.nome,
      tipo: local.tipo,
      fornecedorId: local.fornecedorId ? String(local.fornecedorId) : '',
      observacoes: local.observacoes ?? '',
    });
  }

  protected cancelarEdicaoLocal(): void {
    this.localEmEdicao.set(null);
    this.localForm.reset({
      nome: '',
      tipo: 'SUPERMERCADO_LOCAL',
      fornecedorId: '',
      observacoes: '',
    });
  }

  protected desativarLocal(local: LocalCompra): void {
    this.executarSalvamento(this.comprasService.desativarLocal(local.id), 'Local inativado.');
  }

  protected excluirLocal(local: LocalCompra): void {
    this.executarSalvamento(this.comprasService.excluirLocal(local.id), 'Local excluido.');
  }

  protected editarItem(item: ItemCompra): void {
    this.itemEmEdicao.set(item);
    this.itemForm.setValue({
      descricao: item.descricao,
      grupoId: String(item.grupoId),
      unidadeMedidaId: String(item.unidadeMedidaId),
      localCompraPadraoId: item.localCompraPadraoId ? String(item.localCompraPadraoId) : '',
      fornecedorPadraoId: item.fornecedorPadraoId ? String(item.fornecedorPadraoId) : '',
      quantidadeMinimaSugerida: String(item.quantidadeMinimaSugerida),
      quantidadePadraoCompra: String(item.quantidadePadraoCompra),
      recorrente: item.recorrente,
      homologado: item.homologado,
      observacoes: item.observacoes ?? '',
    });
  }

  protected cancelarEdicaoItem(): void {
    this.itemEmEdicao.set(null);
    this.itemForm.reset({
      descricao: '',
      grupoId: '',
      unidadeMedidaId: '',
      localCompraPadraoId: '',
      fornecedorPadraoId: '',
      quantidadeMinimaSugerida: '0',
      quantidadePadraoCompra: '1',
      recorrente: true,
      homologado: false,
      observacoes: '',
    });
  }

  protected desativarItem(item: ItemCompra): void {
    this.executarSalvamento(this.comprasService.desativarItem(item.id), 'Item inativado.');
  }

  protected excluirItem(item: ItemCompra): void {
    this.executarSalvamento(this.comprasService.excluirItem(item.id), 'Item excluido.');
  }

  protected criarNecessidade(): void {
    if (this.necessidadeForm.invalid) {
      return;
    }

    const valor = this.necessidadeForm.getRawValue();
    this.executarSalvamento(
      this.comprasService.criarNecessidade({
        sapLoja: valor.sapLoja,
        itemCompraId: this.valorNumero(valor.itemCompraId),
        quantidadeNecessaria: this.valorDecimal(valor.quantidadeNecessaria),
        prioridade: valor.prioridade,
        observacao: valor.observacao,
        dataNecessidade: valor.dataNecessidade,
        usuarioResponsavel: valor.usuarioResponsavel,
      }),
      'Necessidade registrada.',
      () =>
        this.necessidadeForm.patchValue({
          itemCompraId: '',
          quantidadeNecessaria: '1',
          prioridade: 'NORMAL',
          observacao: '',
          dataNecessidade: this.obterDataHoje(),
        }),
    );
  }

  protected alternarNecessidade(necessidade: NecessidadeCompra, selecionada: boolean): void {
    this.necessidadesSelecionadas.update((selecionadas) => {
      const novas = new Set(selecionadas);
      if (selecionada) {
        novas.add(necessidade.id);
      } else {
        novas.delete(necessidade.id);
      }
      return novas;
    });
  }

  protected necessidadeSelecionada(id: number): boolean {
    return this.necessidadesSelecionadas().has(id);
  }

  protected gerarPedido(): void {
    const necessidadeIds = [...this.necessidadesSelecionadas()];
    if (necessidadeIds.length === 0) {
      this.erro.set('Selecione ao menos uma necessidade pendente.');
      return;
    }

    const necessidades = this.painel().necessidades.filter((necessidade) =>
      necessidadeIds.includes(necessidade.id),
    );
    const primeira = necessidades[0];
    if (!primeira?.localCompraId) {
      this.erro.set('As necessidades selecionadas precisam ter local de compra padrao.');
      return;
    }

    const mesmoLocal = necessidades.every(
      (necessidade) => necessidade.localCompraId === primeira.localCompraId,
    );
    if (!mesmoLocal) {
      this.erro.set('Selecione necessidades do mesmo local de compra para gerar um pedido.');
      return;
    }

    this.executarSalvamento(
      this.comprasService.gerarPedido({
        localCompraId: primeira.localCompraId,
        fornecedorId: primeira.fornecedorId,
        usuarioResponsavel: this.valorTexto(this.pedidoForm.controls.usuarioResponsavel.value),
        observacoes: this.valorTexto(this.pedidoForm.controls.observacoes.value),
        necessidadeIds,
      }),
      'Pedido gerado.',
      (pedido) => {
        this.necessidadesSelecionadas.set(new Set<number>());
        this.pedidoSelecionado.set(pedido);
        this.abaAtiva.set('lista');
      },
    );
  }

  protected abrirPedido(pedido: PedidoCompraResumo): void {
    this.carregando.set(true);
    this.comprasService
      .buscarPedido(pedido.id)
      .pipe(
        catchError(() => {
          this.erro.set('Nao foi possivel abrir o pedido.');
          return of(null);
        }),
        finalize(() => this.carregando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detalhe) => {
        this.pedidoSelecionado.set(detalhe);
      });
  }

  protected iniciarCompra(): void {
    const pedido = this.pedidoSelecionado()?.pedido;
    if (!pedido) {
      return;
    }

    this.executarSalvamento(
      this.comprasService.iniciarCompra(pedido.id),
      'Pedido marcado como em compra.',
      (detalhe) => this.pedidoSelecionado.set(detalhe),
    );
  }

  protected marcarItemComprado(item: PedidoCompraItem, quantidade: string, valor: string): void {
    this.executarSalvamento(
      this.comprasService.marcarItemComprado(item.id, {
        quantidadeComprada: this.valorDecimal(quantidade),
        valorUnitario: this.valorDecimal(valor),
        observacao: item.observacao,
      }),
      'Item marcado como comprado.',
      (detalhe) => this.pedidoSelecionado.set(detalhe),
    );
  }

  protected finalizarPedido(): void {
    const pedido = this.pedidoSelecionado()?.pedido;
    if (!pedido) {
      return;
    }

    this.executarSalvamento(
      this.comprasService.finalizarPedido(pedido.id, this.pedidoForm.controls.dataCompra.value),
      'Pedido finalizado.',
      (detalhe) => this.pedidoSelecionado.set(detalhe),
    );
  }

  protected cancelarPedido(pedido: PedidoCompraResumo): void {
    this.executarSalvamento(
      this.comprasService.cancelarPedido(pedido.id),
      'Pedido cancelado.',
      () => this.pedidoSelecionado.set(null),
    );
  }

  protected cancelarNecessidade(necessidade: NecessidadeCompra): void {
    this.executarSalvamento(
      this.comprasService.cancelarNecessidade(necessidade.id),
      'Necessidade cancelada.',
    );
  }

  protected reabrirNecessidade(necessidade: NecessidadeCompra): void {
    this.executarSalvamento(
      this.comprasService.reabrirNecessidade(necessidade.id),
      'Necessidade reaberta.',
    );
  }

  protected selecionarConsolidado(consolidado: ConsolidadoCompra): void {
    const ids = this.painel().necessidades
      .filter(
        (necessidade) =>
          necessidade.status === 'PENDENTE' &&
          necessidade.itemCompraId === consolidado.itemCompraId &&
          necessidade.localCompraId === consolidado.localCompraId,
      )
      .map((necessidade) => necessidade.id);

    this.necessidadesSelecionadas.update((selecionadas) => {
      const novas = new Set(selecionadas);
      for (const id of ids) {
        novas.add(id);
      }
      return novas;
    });
  }

  protected nomeTipoLocal(tipo: string): string {
    return this.tiposLocal.find((item) => item.id === tipo)?.label ?? tipo;
  }

  protected formatarMoeda(valor: number | null | undefined): string {
    return this.comprasService.formatarMoeda(valor);
  }

  protected formatarQuantidade(valor: number | null | undefined, unidade?: string | null): string {
    return this.comprasService.formatarQuantidade(valor, unidade);
  }

  protected formatarData(data: string | null | undefined): string {
    return this.comprasService.formatarData(data);
  }

  protected trackId(_: number, item: { id: number }): number {
    return item.id;
  }

  protected trackConsolidado(_: number, item: ConsolidadoCompra): string {
    return `${item.localCompraId ?? 'sem-local'}-${item.itemCompraId}`;
  }

  private executarSalvamento<T>(
    observable: Observable<T>,
    mensagem: string,
    depois?: (resultado: T) => void,
  ): void {
    let falhou = false;
    this.salvando.set(true);
    this.erro.set(null);
    this.sucesso.set(null);

    observable
      .pipe(
        catchError(() => {
          falhou = true;
          this.erro.set('Nao foi possivel concluir a operacao.');
          return of(null);
        }),
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado: T | null) => {
        if (!falhou) {
          this.sucesso.set(mensagem);
          if (resultado !== null) {
            depois?.(resultado);
          }
          this.carregarPainel();
        }
      });
  }

  private limparSelecaoInvalida(painel: ComprasPainel): void {
    const idsValidos = new Set(
      painel.necessidades
        .filter((necessidade) => necessidade.status === 'PENDENTE')
        .map((necessidade) => necessidade.id),
    );
    this.necessidadesSelecionadas.update((selecionadas) => {
      const novas = new Set<number>();
      for (const id of selecionadas) {
        if (idsValidos.has(id)) {
          novas.add(id);
        }
      }
      return novas;
    });
  }

  private valorTexto(valor: string | null | undefined): string | null {
    return valor && valor.trim() ? valor.trim() : null;
  }

  private valorNumero(valor: string | number | null | undefined): number | null {
    if (valor === null || valor === undefined || valor === '') {
      return null;
    }
    return Number(valor);
  }

  private valorDecimal(valor: string | number | null | undefined): number {
    if (valor === null || valor === undefined || valor === '') {
      return 0;
    }
    return Number(String(valor).replace(',', '.'));
  }

  private obterDataHoje(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
