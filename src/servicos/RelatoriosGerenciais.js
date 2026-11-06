import { dentroDoPeriodo } from "../utils/datas.js";

/**
 * Gera relatórios a partir dos dados de CadastroClientes e
 * RegistroDeEntradasESaidas.
 *
 * FASE 2: os relatórios previstos no diagrama de classes foram mantidos com a
 * mesma assinatura e ganharam versões "detalhadas" (usadas pela interface),
 * além do relatório de clientes NÃO cadastrados exigido pelo enunciado.
 *
 * Os seis relatórios exigidos:
 *   1. resumoArrecadacao / totalArrecadadoPorPeriodo .... por período e/ou categoria
 *   2. situacaoCliente ................................. situação de um cliente
 *   3. registrosPorCliente ............................. registros de cadastrado
 *   4. registrosDeNaoCadastrados ....................... registros de avulsos
 *   5. clientesImpedidos ............................... impedidos de entrar
 *   6. clientesMaisFrequentes .......................... 10 mais frequentes do ano
 */
export class RelatoriosGerenciais {
  #cadastroClientes;
  #registroDeEntradasESaidas;

  constructor(cadastroClientes, registroDeEntradasESaidas) {
    this.#cadastroClientes = cadastroClientes;
    this.#registroDeEntradasESaidas = registroDeEntradasESaidas;
  }

  /** Soma os valores de uma lista de tickets já fechados. */
  static totalizar(tickets) {
    let custo = 0;
    let desconto = 0;
    let pago = 0;
    let emAberto = 0;

    for (const ticket of tickets) {
      custo += ticket.custo;
      desconto += ticket.valorDesconto;
      pago += ticket.valorPago;
      emAberto += ticket.valorEmAberto;
    }

    return {
      quantidade: tickets.length,
      custo: Number(custo.toFixed(2)),
      desconto: Number(desconto.toFixed(2)),
      pago: Number(pago.toFixed(2)),
      emAberto: Number(emAberto.toFixed(2)),
    };
  }

  // ==================================================================
  // 1. Valor total arrecadado por período e/ou categoria de cliente
  // ==================================================================

  /** Assinatura original do diagrama: devolve apenas o total arrecadado. */
  totalArrecadadoPorPeriodo(inicio, fim, tipoCliente = null) {
    return this.resumoArrecadacao({ inicio, fim, categoria: tipoCliente }).pago;
  }

  /** Versão detalhada, usada pela interface. */
  resumoArrecadacao({ inicio = null, fim = null, categoria = null } = {}) {
    const filtro = categoria ? String(categoria).trim().toLowerCase() : null;

    if (filtro) {
      const validas = ["estudante", "professor", "empresa", "avulso"];
      if (!validas.includes(filtro)) {
        throw new Error(
          `Categoria inválida: "${categoria}". Use Estudante, Professor, Empresa ou Avulso.`
        );
      }
    }

    // Só entram tickets já fechados: um veículo ainda no pátio não gerou receita.
    const registros = this.#registroDeEntradasESaidas.historico
      .filter((ticket) => !ticket.estaAberto)
      .filter((ticket) => dentroDoPeriodo(ticket.dataHoraSaida, inicio, fim))
      .filter((ticket) => !filtro || ticket.tipoCliente.toLowerCase() === filtro)
      .sort((a, b) => a.dataHoraSaida - b.dataHoraSaida);

    // Quebra por categoria usando um Map como acumulador.
    const porCategoriaMap = new Map();
    for (const ticket of registros) {
      if (!porCategoriaMap.has(ticket.tipoCliente)) porCategoriaMap.set(ticket.tipoCliente, []);
      porCategoriaMap.get(ticket.tipoCliente).push(ticket);
    }

    const porCategoria = [...porCategoriaMap.entries()]
      .map(([nome, lista]) => ({ categoria: nome, ...RelatoriosGerenciais.totalizar(lista) }))
      .sort((a, b) => b.pago - a.pago);

    // Quebra por desconto aplicado.
    const porDescontoMap = new Map();
    for (const ticket of registros) {
      const chave = ticket.descontoAplicado || "nenhum";
      const atual = porDescontoMap.get(chave) || { desconto: chave, quantidade: 0, valor: 0 };
      atual.quantidade++;
      atual.valor = Number((atual.valor + ticket.valorDesconto).toFixed(2));
      porDescontoMap.set(chave, atual);
    }

    return {
      periodo: { inicio, fim },
      categoria: categoria || "Todas",
      ...RelatoriosGerenciais.totalizar(registros),
      porCategoria,
      porDesconto: [...porDescontoMap.values()].sort((a, b) => b.quantidade - a.quantidade),
      registros,
    };
  }

  // ==================================================================
  // 2. Situação de um cliente cadastrado
  // ==================================================================
  situacaoCliente(cpfCnpj) {
    const cliente = this.#cadastroClientes.buscarPorCpfCnpj(cpfCnpj);
    if (!cliente) return null;

    const registros = this.#registroDeEntradasESaidas.historico.filter((ticket) =>
      cliente.possuiPlaca(ticket.placa)
    );
    const fechados = registros.filter((ticket) => !ticket.estaAberto);
    const abertos = registros.filter((ticket) => ticket.estaAberto);
    const totais = RelatoriosGerenciais.totalizar(fechados);

    const datas = registros.map((t) => t.dataHoraEntrada).sort((a, b) => a - b);
    const naListaDeBloqueio =
      this.#registroDeEntradasESaidas.estaNaListaDeBloqueio(cliente.cpfCnpj) ||
      cliente.listaDePlacas.some((placa) =>
        this.#registroDeEntradasESaidas.estaNaListaDeBloqueio(placa)
      );

    return {
      cpfCnpj: cliente.cpfCnpj,
      nome: cliente.nome,
      tipo: cliente.tipo,
      regra: cliente.descricaoRegra(),
      placas: cliente.listaDePlacas,
      limitePlacas: cliente.limitePlacas(),
      creditos: cliente.tipo === "Estudante" ? cliente.creditos : null,
      saldoDevedor: cliente.tipo === "Empresa" ? cliente.saldoDevedor : null,
      bloqueado: cliente.estaBloqueado() || naListaDeBloqueio,
      motivoBloqueio: cliente.motivoBloqueio() ||
        (naListaDeBloqueio ? "Consta na lista de bloqueio" : ""),
      naListaDeBloqueio,
      totalRegistros: registros.length,
      veiculosNoPatio: abertos.length,
      ticketsAbertos: abertos,
      totalCusto: totais.custo,
      totalDesconto: totais.desconto,
      totalPago: totais.pago,
      totalEmAberto: totais.emAberto,
      primeiroAcesso: datas.length ? datas[0] : null,
      ultimoAcesso: datas.length ? datas[datas.length - 1] : null,
    };
  }

  // ==================================================================
  // 3. Registros de estacionamento de cliente cadastrado por período
  // ==================================================================
  registrosPorCliente(cpfCnpj, inicio = null, fim = null) {
    const cliente = this.#cadastroClientes.buscarPorCpfCnpj(cpfCnpj);
    if (!cliente) return null;

    const registros = this.#registroDeEntradasESaidas.historico
      .filter((ticket) => cliente.possuiPlaca(ticket.placa))
      .filter((ticket) => dentroDoPeriodo(ticket.dataHoraEntrada, inicio, fim))
      .sort((a, b) => a.dataHoraEntrada - b.dataHoraEntrada);

    return {
      cliente: { cpfCnpj: cliente.cpfCnpj, nome: cliente.nome, tipo: cliente.tipo },
      periodo: { inicio, fim },
      registros,
      totais: RelatoriosGerenciais.totalizar(registros.filter((t) => !t.estaAberto)),
    };
  }

  /** Nome usado na Fase 1; mantido para não quebrar nada. */
  registrosDoCliente(cpfCnpj, inicio, fim) {
    const resultado = this.registrosPorCliente(cpfCnpj, inicio, fim);
    return resultado ? resultado.registros : [];
  }

  // ==================================================================
  // 4. Registros de estacionamento de cliente NÃO cadastrado por período
  // ==================================================================
  registrosDeNaoCadastrados(inicio = null, fim = null) {
    const registros = this.#registroDeEntradasESaidas.historico
      .filter((ticket) => ticket.tipoCliente === "Avulso")
      .filter((ticket) => dentroDoPeriodo(ticket.dataHoraEntrada, inicio, fim))
      .sort((a, b) => a.dataHoraEntrada - b.dataHoraEntrada);

    // Agrupa por placa para mostrar os avulsos recorrentes.
    const porPlacaMap = new Map();
    for (const ticket of registros) {
      const atual = porPlacaMap.get(ticket.placa) || {
        placa: ticket.placa,
        quantidade: 0,
        pago: 0,
        desconto: 0,
      };
      atual.quantidade++;
      atual.pago = Number((atual.pago + ticket.valorPago).toFixed(2));
      atual.desconto = Number((atual.desconto + ticket.valorDesconto).toFixed(2));
      porPlacaMap.set(ticket.placa, atual);
    }

    return {
      periodo: { inicio, fim },
      registros,
      totais: RelatoriosGerenciais.totalizar(registros.filter((t) => !t.estaAberto)),
      porPlaca: [...porPlacaMap.values()].sort((a, b) => b.quantidade - a.quantidade),
    };
  }

  // ==================================================================
  // 5. Relação de clientes impedidos de entrar no estacionamento
  // ==================================================================
  clientesImpedidos() {
    const daListaDeBloqueio = this.#registroDeEntradasESaidas.listarBloqueios().map((item) => ({
      identificador: item.identificador,
      nome: item.nome,
      tipo: item.tipo,
      cpfCnpj: item.cpfCnpj,
      motivo: item.motivo,
      origem: "Lista de bloqueio",
    }));

    const jaListados = new Set(daListaDeBloqueio.map((item) => item.identificador));

    // Estudante com crédito negativo e empresa inadimplente também estão
    // impedidos, mesmo sem constar na lista de bloqueio.
    const porRegraDoTipo = this.#cadastroClientes.todosClientes
      .filter((cliente) => cliente.estaBloqueado())
      .filter(
        (cliente) =>
          !jaListados.has(cliente.cpfCnpj) &&
          !cliente.listaDePlacas.some((placa) => jaListados.has(placa))
      )
      .map((cliente) => ({
        identificador: cliente.listaDePlacas.join(" / ") || cliente.cpfCnpj,
        nome: cliente.nome,
        tipo: cliente.tipo,
        cpfCnpj: cliente.cpfCnpj,
        motivo: cliente.motivoBloqueio(),
        origem: "Regra do tipo de cliente",
      }));

    const lista = [...daListaDeBloqueio, ...porRegraDoTipo].sort((a, b) =>
      a.nome.localeCompare(b.nome) || a.identificador.localeCompare(b.identificador)
    );

    return {
      lista,
      total: lista.length,
      totalCadastrados: lista.filter((item) => item.cpfCnpj).length,
      totalAvulsos: lista.filter((item) => !item.cpfCnpj).length,
    };
  }

  // ==================================================================
  // 6. Relação dos 10 clientes mais frequentes do ano
  // ==================================================================
  clientesMaisFrequentes(ano = new Date().getFullYear(), limite = 10) {
    const anoSelecionado = Number(ano);
    if (!Number.isInteger(anoSelecionado) || anoSelecionado < 1900 || anoSelecionado > 2999) {
      throw new Error(`Ano inválido: "${ano}". Informe um ano com 4 dígitos, por exemplo 2026.`);
    }

    // Map cpfCnpj -> acumulado do cliente no ano.
    const contador = new Map();

    for (const ticket of this.#registroDeEntradasESaidas.historico) {
      if (ticket.dataHoraEntrada.getFullYear() !== anoSelecionado) continue;

      const cliente = this.#cadastroClientes.buscarPorPlaca(ticket.placa);
      if (!cliente) continue; // avulsos não entram no ranking de clientes

      const atual = contador.get(cliente.cpfCnpj) || {
        cpfCnpj: cliente.cpfCnpj,
        nome: cliente.nome,
        tipo: cliente.tipo,
        quantidade: 0,
        pago: 0,
        ultimoAcesso: null,
      };

      atual.quantidade++;
      atual.pago = Number((atual.pago + ticket.valorPago).toFixed(2));
      if (!atual.ultimoAcesso || ticket.dataHoraEntrada > atual.ultimoAcesso) {
        atual.ultimoAcesso = ticket.dataHoraEntrada;
      }

      contador.set(cliente.cpfCnpj, atual);
    }

    const lista = [...contador.values()]
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome))
      .slice(0, limite)
      .map((item, indice) => ({ posicao: indice + 1, ...item }));

    return { ano: anoSelecionado, limite, totalClientesNoAno: contador.size, lista };
  }
}
