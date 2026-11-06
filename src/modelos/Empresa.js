import { Cliente } from "./Cliente.js";

/**
 * Empresa: cadastra quantos veículos quiser, cobrança por diária,
 * multa se passar da meia-noite, e fica inadimplente se não pagar o boleto.
 */
export class Empresa extends Cliente {
  static VALOR_DIARIA = 70;
  static MULTA_POR_DIA_ATRASADO = 30;

  #saldoDevedor;

  constructor(cpfCnpj, nome, saldoDevedorInicial = 0) {
    super(cpfCnpj, nome);
    this.#saldoDevedor = Number(saldoDevedorInicial) || 0;
  }

  get saldoDevedor() {
    return this.#saldoDevedor;
  }

  limitePlacas() {
    return Infinity;
  }

  acumularDebito(valor) {
    this.#saldoDevedor += valor;
  }

  registrarPagamento(valor) {
    this.#saldoDevedor = Math.max(0, this.#saldoDevedor - valor);
  }

  estaInadimplente() {
    return this.#saldoDevedor > 0;
  }

  // Empresa inadimplente fica impedida de acessar o estacionamento.
  estaBloqueado() {
    return this.estaInadimplente();
  }

  motivoBloqueio() {
    return this.estaBloqueado()
      ? `Inadimplente: saldo devedor de R$ ${this.#saldoDevedor.toFixed(2).replace(".", ",")}`
      : "";
  }

  calcularCusto(dataHoraEntrada, dataHoraSaida) {
    const passouDaMeiaNoite =
      dataHoraEntrada.toDateString() !== dataHoraSaida.toDateString();

    let custo = Empresa.VALOR_DIARIA;
    if (passouDaMeiaNoite) {
      custo += Empresa.MULTA_POR_DIA_ATRASADO;
    }
    return custo;
  }

  descricaoRegra() {
    return `Diária de R$ ${Empresa.VALOR_DIARIA},00 (+ R$ ${Empresa.MULTA_POR_DIA_ATRASADO},00 `
      + `se passar da meia-noite). Placas ilimitadas, faturado.`;
  }

  // FASE 2: grava o saldo devedor no CSV.
  paraLinhaCSV() {
    return { ...super.paraLinhaCSV(), saldoDevedor: this.#saldoDevedor.toFixed(2) };
  }
}
