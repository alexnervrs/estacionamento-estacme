import { TicketEstacionamento } from "../modelos/TicketEstacionamento.js";
import { ClienteFrequente } from "../modelos/Desconto.js";
import { Estudante } from "../modelos/Estudante.js";
import { Empresa } from "../modelos/Empresa.js";
import { garantirArquivo, lerCSV, gravarCSV } from "../utils/csv.js";

const VALOR_HORA_AVULSO = 8;
const LIMITE_HORAS_AVULSO = 6;
const VALOR_DIARIA_AVULSO = 45;

const COLUNAS_BLOQUEIO = ["identificador", "motivo"];

/**
 * Controla as entradas e saídas do estacionamento.
 *
 * Estruturas de dados (exigência do enunciado):
 *  - Map #ticketsAtivos ............ placa -> ticket em aberto
 *  - Map #motivosBloqueio .......... identificador -> motivo do bloqueio
 *  - Map #entradasAvulsoPorPlaca ... placa -> datas de entrada (desconto)
 *  - Set #listaBloqueio ............ placas/documentos impedidos de entrar
 *  - Set #placasEstacionadas ....... placas que estão no pátio agora
 *
 * FASE 2: acrescentados o identificador dos tickets, os motivos de bloqueio
 * e a persistência em CSV (registros e lista de bloqueio).
 */
export class RegistroDeEntradasESaidas {
  #cadastroClientes;
  #ticketsAtivos; // Map<placa, TicketEstacionamento>
  #historico; // TicketEstacionamento[]
  #listaBloqueio; // Set<placa ou cpfCnpj>
  #motivosBloqueio; // Map<identificador, motivo>
  #entradasAvulsoPorPlaca; // Map<placa, Date[]>  -> usado pelo desconto ClienteFrequente
  #placasEstacionadas; // Set<placa>
  #descontosDisponiveis;
  #avisosDeLeitura;

  constructor(cadastroClientes) {
    this.#cadastroClientes = cadastroClientes;
    this.#ticketsAtivos = new Map();
    this.#historico = [];
    this.#listaBloqueio = new Set();
    this.#motivosBloqueio = new Map();
    this.#entradasAvulsoPorPlaca = new Map();
    this.#placasEstacionadas = new Set();
    this.#descontosDisponiveis = [new ClienteFrequente()];
    this.#avisosDeLeitura = [];
  }

  get historico() {
    return [...this.#historico];
  }

  get clientesImpedidos() {
    return [...this.#listaBloqueio];
  }

  get ticketsAtivos() {
    return [...this.#ticketsAtivos.values()].sort(
      (a, b) => a.dataHoraEntrada - b.dataHoraEntrada
    );
  }

  get totalNoPatio() {
    return this.#placasEstacionadas.size;
  }

  get totalRegistros() {
    return this.#historico.length;
  }

  get avisosDeLeitura() {
    return [...this.#avisosDeLeitura];
  }

  motivoDoBloqueio(identificador) {
    return this.#motivosBloqueio.get(String(identificador).trim().toUpperCase()) ?? "";
  }

  estaNaListaDeBloqueio(identificador) {
    return this.#listaBloqueio.has(String(identificador).trim().toUpperCase());
  }

  buscarTicketAtivo(placa) {
    return this.#ticketsAtivos.get(String(placa).trim().toUpperCase()) ?? null;
  }

  // ---------------------------------------------------------------
  // ENTRADA
  // ---------------------------------------------------------------
  autorizarEntrada(placa, dataHoraEntrada = new Date()) {
    const placaFormatada = placa.trim().toUpperCase();

    if (this.#listaBloqueio.has(placaFormatada)) {
      throw new Error(`Entrada negada: placa ${placaFormatada} está na lista de bloqueio.`);
    }

    if (this.#ticketsAtivos.has(placaFormatada)) {
      throw new Error(`O veículo ${placaFormatada} já está estacionado.`);
    }

    const cliente = this.#cadastroClientes.buscarPorPlaca(placaFormatada);
    const tipoCliente = cliente ? cliente.tipo : "Avulso";

    if (cliente) {
      if (this.#listaBloqueio.has(cliente.cpfCnpj) || cliente.estaBloqueado()) {
        throw new Error(`Entrada negada: ${cliente.nome} está impedido (inadimplente/saldo negativo).`);
      }

      // Regra do Professor: só 1 veículo estacionado por vez.
      if (tipoCliente === "Professor" && this.#professorTemVeiculoEstacionado(cliente)) {
        throw new Error(`Entrada negada: ${cliente.nome} já possui um veículo estacionado.`);
      }
    }

    const ticket = new TicketEstacionamento(
      placaFormatada,
      tipoCliente,
      dataHoraEntrada,
      this.#gerarIdTicket()
    );
    this.#ticketsAtivos.set(placaFormatada, ticket);
    this.#placasEstacionadas.add(placaFormatada);
    this.#historico.push(ticket);

    if (!cliente) {
      // guarda o horário de entrada para o cálculo de "cliente frequente"
      const historicoPlaca = this.#entradasAvulsoPorPlaca.get(placaFormatada) ?? [];
      historicoPlaca.push(dataHoraEntrada);
      this.#entradasAvulsoPorPlaca.set(placaFormatada, historicoPlaca);
    }

    return ticket;
  }

  #professorTemVeiculoEstacionado(professor) {
    for (const ticket of this.#ticketsAtivos.values()) {
      if (professor.possuiPlaca(ticket.placa)) return true;
    }
    return false;
  }

  #gerarIdTicket() {
    let proximo = this.#historico.length + 1;
    const usados = new Set(this.#historico.map((ticket) => ticket.id));
    let id = "T" + String(proximo).padStart(4, "0");
    while (usados.has(id)) {
      proximo++;
      id = "T" + String(proximo).padStart(4, "0");
    }
    return id;
  }

  /**
   * Simula a entrada sem registrar nada, para a interface poder avisar
   * antes de confirmar. Devolve { permitido, motivo, cliente }.
   */
  verificarEntrada(placa) {
    const placaFormatada = String(placa).trim().toUpperCase();

    if (this.#listaBloqueio.has(placaFormatada)) {
      return {
        permitido: false,
        motivo: this.motivoDoBloqueio(placaFormatada) || "Placa na lista de bloqueio",
        cliente: null,
      };
    }
    if (this.#ticketsAtivos.has(placaFormatada)) {
      return { permitido: false, motivo: "O veículo já está estacionado.", cliente: null };
    }

    const cliente = this.#cadastroClientes.buscarPorPlaca(placaFormatada);
    if (cliente) {
      if (this.#listaBloqueio.has(cliente.cpfCnpj)) {
        return { permitido: false, motivo: this.motivoDoBloqueio(cliente.cpfCnpj), cliente };
      }
      if (cliente.estaBloqueado()) {
        return { permitido: false, motivo: cliente.motivoBloqueio(), cliente };
      }
      if (cliente.tipo === "Professor" && this.#professorTemVeiculoEstacionado(cliente)) {
        return {
          permitido: false,
          motivo: `${cliente.nome} já possui um veículo estacionado (limite de 1 por vez).`,
          cliente,
        };
      }
    }

    return { permitido: true, motivo: "Entrada autorizada", cliente };
  }

  // ---------------------------------------------------------------
  // SAÍDA
  // ---------------------------------------------------------------
  processarSaida(placa, dataHoraSaida = new Date(), { clienteAvulsoRecusouPagar = false } = {}) {
    const placaFormatada = placa.trim().toUpperCase();
    const ticket = this.#ticketsAtivos.get(placaFormatada);

    if (!ticket) {
      throw new Error(`Nenhum veículo com a placa ${placaFormatada} está estacionado.`);
    }
    if (dataHoraSaida < ticket.dataHoraEntrada) {
      throw new Error("A data de saída não pode ser anterior à data de entrada.");
    }

    const cliente = this.#cadastroClientes.buscarPorPlaca(placaFormatada);
    let custo;
    let descontoAplicado = "nenhum";
    let valorDesconto = 0;

    if (cliente) {
      custo = cliente.calcularCusto(ticket.dataHoraEntrada, dataHoraSaida);

      if (cliente.tipo === "Estudante") {
        cliente.debitarCreditos(custo);
      } else if (cliente.tipo === "Empresa") {
        cliente.acumularDebito(custo);
      }
    } else {
      custo = this.#calcularCustoAvulso(ticket.dataHoraEntrada, dataHoraSaida);

      const historicoPlaca = this.#entradasAvulsoPorPlaca.get(placaFormatada) ?? [];
      for (const desconto of this.#descontosDisponiveis) {
        if (desconto.aplicavel(historicoPlaca, dataHoraSaida)) {
          descontoAplicado = desconto.identificador;
          valorDesconto = desconto.calcularValorDesconto(custo);
          break;
        }
      }
    }

    const valorDevido = custo - valorDesconto;
    const valorPago = clienteAvulsoRecusouPagar ? 0 : valorDevido;

    ticket.registrarSaida({
      dataHoraSaida,
      custo,
      descontoAplicado,
      valorDesconto,
      valorPago,
    });

    if (!cliente && clienteAvulsoRecusouPagar) {
      // Regra do avulso inadimplente: sai, mas fica bloqueado para sempre.
      this.bloquear(placaFormatada, "Cliente avulso se recusou a pagar");
    }

    this.#ticketsAtivos.delete(placaFormatada);
    this.#placasEstacionadas.delete(placaFormatada);

    return ticket;
  }

  #calcularCustoAvulso(dataHoraEntrada, dataHoraSaida) {
    const passouDaMeiaNoite =
      dataHoraEntrada.toDateString() !== dataHoraSaida.toDateString();

    if (passouDaMeiaNoite) {
      return VALOR_DIARIA_AVULSO;
    }

    const horas = (dataHoraSaida - dataHoraEntrada) / 3_600_000;
    if (horas > LIMITE_HORAS_AVULSO) {
      return VALOR_DIARIA_AVULSO;
    }
    return Math.ceil(horas) * VALOR_HORA_AVULSO;
  }

  /** Valor que seria cobrado agora, usado na tela "veículos no pátio". */
  simularCusto(ticket, dataHoraSaida = new Date()) {
    const cliente = this.#cadastroClientes.buscarPorPlaca(ticket.placa);
    if (cliente) return cliente.calcularCusto(ticket.dataHoraEntrada, dataHoraSaida);
    return this.#calcularCustoAvulso(ticket.dataHoraEntrada, dataHoraSaida);
  }

  // ---------------------------------------------------------------
  // LISTA DE BLOQUEIO
  // ---------------------------------------------------------------
  bloquear(identificador, motivo = "Bloqueio manual") {
    const chave = String(identificador).trim().toUpperCase();
    if (!chave) throw new Error("Informe a placa ou o documento a bloquear.");
    this.#listaBloqueio.add(chave);
    this.#motivosBloqueio.set(chave, motivo);
    return chave;
  }

  bloquearCliente(cpfCnpj, motivo = "Bloqueio manual") {
    return this.bloquear(cpfCnpj, motivo);
  }

  desbloquear(identificador) {
    const chave = String(identificador).trim().toUpperCase();
    if (!this.#listaBloqueio.has(chave)) {
      throw new Error(`${chave} não está na lista de bloqueio.`);
    }
    this.#listaBloqueio.delete(chave);
    this.#motivosBloqueio.delete(chave);
    return chave;
  }

  /** Lista de bloqueio já com o dono identificado, quando é um cliente. */
  listarBloqueios() {
    return [...this.#listaBloqueio].map((identificador) => {
      const porPlaca = this.#cadastroClientes.buscarPorPlaca(identificador);
      const porDocumento = this.#cadastroClientes.buscarPorCpfCnpj(identificador);
      const cliente = porPlaca ?? porDocumento;
      return {
        identificador,
        motivo: this.#motivosBloqueio.get(identificador) || "Bloqueio manual",
        nome: cliente ? cliente.nome : "Cliente não cadastrado",
        tipo: cliente ? cliente.tipo : "Avulso",
        cpfCnpj: cliente ? cliente.cpfCnpj : "",
      };
    });
  }

  // ---------------------------------------------------------------
  // OPERAÇÕES DE CRÉDITO E BOLETO
  // ---------------------------------------------------------------

  /** Recarga de créditos do estudante. */
  recarregarCreditos(cliente, valor) {
    if (!(cliente instanceof Estudante)) {
      throw new Error("A recarga de créditos só vale para clientes do tipo Estudante.");
    }
    cliente.carregarSaldo(valor);
    return cliente.creditos;
  }

  /** Pagamento do boleto da empresa; zera ou reduz o saldo devedor. */
  registrarPagamentoEmpresa(cliente, valor) {
    if (!(cliente instanceof Empresa)) {
      throw new Error("O pagamento de boleto só vale para clientes do tipo Empresa.");
    }
    if (valor <= 0) throw new Error("O valor do pagamento deve ser positivo.");
    cliente.registrarPagamento(valor);
    return cliente.saldoDevedor;
  }

  // ---------------------------------------------------------------
  // FASE 2: persistência em CSV
  // ---------------------------------------------------------------

  /** Lê os registros de estacionamento e reconstrói o estado do pátio. */
  carregarDeCSV(caminhoRegistros) {
    this.#avisosDeLeitura = [];
    garantirArquivo(caminhoRegistros, TicketEstacionamento.COLUNAS_CSV);

    this.#historico = [];
    this.#ticketsAtivos.clear();
    this.#placasEstacionadas.clear();
    this.#entradasAvulsoPorPlaca.clear();

    const tickets = [];
    for (const linha of lerCSV(caminhoRegistros)) {
      try {
        tickets.push(TicketEstacionamento.deLinhaCSV(linha));
      } catch (erro) {
        this.#avisosDeLeitura.push(`registros.csv linha ${linha._linha}: ${erro.message}`);
      }
    }

    tickets.sort((a, b) => a.dataHoraEntrada - b.dataHoraEntrada);

    for (const ticket of tickets) {
      // Duas entradas em aberto para a mesma placa não podem existir:
      // a mais antiga é mantida apenas como histórico.
      if (ticket.estaAberto && this.#placasEstacionadas.has(ticket.placa)) {
        this.#avisosDeLeitura.push(
          `registros.csv: havia mais de uma entrada em aberto para ${ticket.placa}; ` +
          `apenas a mais recente ficou no pátio.`
        );
        const anterior = this.#ticketsAtivos.get(ticket.placa);
        this.#ticketsAtivos.delete(anterior.placa);
        this.#placasEstacionadas.delete(anterior.placa);
      }

      this.#historico.push(ticket);

      if (ticket.estaAberto) {
        this.#ticketsAtivos.set(ticket.placa, ticket);
        this.#placasEstacionadas.add(ticket.placa);
      }

      // Reconstrói o histórico de entradas dos avulsos para que o desconto
      // ClienteFrequente continue valendo entre execuções do sistema.
      if (ticket.tipoCliente === "Avulso") {
        const historicoPlaca = this.#entradasAvulsoPorPlaca.get(ticket.placa) ?? [];
        historicoPlaca.push(ticket.dataHoraEntrada);
        this.#entradasAvulsoPorPlaca.set(ticket.placa, historicoPlaca);
      }
    }

    return this.#historico.length;
  }

  salvarEmCSV(caminhoRegistros) {
    const linhas = this.#historico.map((ticket) => ticket.paraLinhaCSV());
    gravarCSV(caminhoRegistros, TicketEstacionamento.COLUNAS_CSV, linhas);
    return linhas.length;
  }

  carregarBloqueiosDeCSV(caminhoBloqueios) {
    garantirArquivo(caminhoBloqueios, COLUNAS_BLOQUEIO);
    this.#listaBloqueio.clear();
    this.#motivosBloqueio.clear();

    for (const linha of lerCSV(caminhoBloqueios)) {
      const chave = String(linha.identificador || "").trim().toUpperCase();
      if (!chave) continue;
      this.#listaBloqueio.add(chave);
      this.#motivosBloqueio.set(chave, linha.motivo || "Bloqueio manual");
    }
    return this.#listaBloqueio.size;
  }

  salvarBloqueiosEmCSV(caminhoBloqueios) {
    const linhas = [...this.#listaBloqueio].map((identificador) => ({
      identificador,
      motivo: this.#motivosBloqueio.get(identificador) || "Bloqueio manual",
    }));
    gravarCSV(caminhoBloqueios, COLUNAS_BLOQUEIO, linhas);
    return linhas.length;
  }
}

export { VALOR_HORA_AVULSO, LIMITE_HORAS_AVULSO, VALOR_DIARIA_AVULSO };
