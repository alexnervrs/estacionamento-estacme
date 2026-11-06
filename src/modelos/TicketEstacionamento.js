/**
 * Representa uma passagem de um veículo pelo estacionamento: da entrada
 * até a saída, com todos os valores cobrados. Corresponde a uma linha
 * do arquivo CSV de registros (Fase 2).
 *
 * FASE 2: acrescentados o identificador do ticket (coluna "id" do CSV) e
 * os métodos de conversão de e para linha de CSV.
 */
export class TicketEstacionamento {
  constructor(placa, tipoCliente, dataHoraEntrada, id = null) {
    this.id = id;
    this.placa = placa;
    this.tipoCliente = tipoCliente; // "Avulso" | "Estudante" | "Professor" | "Empresa"
    this.dataHoraEntrada = dataHoraEntrada;

    // Preenchidos somente na saída:
    this.dataHoraSaida = null;
    this.custo = 0;
    this.descontoAplicado = "nenhum";
    this.valorDesconto = 0;
    this.valorDevido = 0;
    this.valorPago = 0;
  }

  get estaAberto() {
    return this.dataHoraSaida === null;
  }

  /** Diferença entre o que era devido e o que foi efetivamente pago. */
  get valorEmAberto() {
    return Number((this.valorDevido - this.valorPago).toFixed(2));
  }

  registrarSaida({ dataHoraSaida, custo, descontoAplicado, valorDesconto, valorPago }) {
    this.dataHoraSaida = dataHoraSaida;
    this.custo = custo;
    this.descontoAplicado = descontoAplicado;
    this.valorDesconto = valorDesconto;
    this.valorDevido = custo - valorDesconto;
    this.valorPago = valorPago;
  }

  // ----- FASE 2: persistência em CSV -----

  static get COLUNAS_CSV() {
    return [
      "id",
      "placa",
      "tipoCliente",
      "dataHoraEntrada",
      "dataHoraSaida",
      "custo",
      "descontoAplicado",
      "valorDesconto",
      "valorDevido",
      "valorPago",
    ];
  }

  paraLinhaCSV() {
    return {
      id: this.id ?? "",
      placa: this.placa,
      tipoCliente: this.tipoCliente,
      dataHoraEntrada: this.dataHoraEntrada.toISOString(),
      dataHoraSaida: this.dataHoraSaida ? this.dataHoraSaida.toISOString() : "",
      custo: Number(this.custo).toFixed(2),
      descontoAplicado: this.descontoAplicado,
      valorDesconto: Number(this.valorDesconto).toFixed(2),
      valorDevido: Number(this.valorDevido).toFixed(2),
      valorPago: Number(this.valorPago).toFixed(2),
    };
  }

  static deLinhaCSV(linha) {
    const entrada = new Date(linha.dataHoraEntrada);
    if (Number.isNaN(entrada.getTime())) {
      throw new Error("data de entrada inválida");
    }
    if (!linha.placa) {
      throw new Error("placa vazia");
    }

    const ticket = new TicketEstacionamento(
      String(linha.placa).trim().toUpperCase(),
      linha.tipoCliente || "Avulso",
      entrada,
      linha.id || null
    );

    if (linha.dataHoraSaida) {
      const saida = new Date(linha.dataHoraSaida);
      if (Number.isNaN(saida.getTime())) {
        throw new Error("data de saída inválida");
      }
      ticket.registrarSaida({
        dataHoraSaida: saida,
        custo: Number(linha.custo) || 0,
        descontoAplicado: linha.descontoAplicado || "nenhum",
        valorDesconto: Number(linha.valorDesconto) || 0,
        valorPago: Number(linha.valorPago) || 0,
      });
    }

    return ticket;
  }
}
