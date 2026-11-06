import { Cliente } from "./Cliente.js";

/**
 * Professor: cadastra até 2 veículos, entrada gratuita, mas só pode
 * ter 1 veículo estacionado por vez (a verificação disso é feita em
 * RegistroDeEntradasESaidas, que sabe quais placas estão ativas agora).
 */
export class Professor extends Cliente {
  constructor(cpfCnpj, nome) {
    super(cpfCnpj, nome);
  }

  limitePlacas() {
    return 2;
  }

  // Gratuito, conforme o documento.
  calcularCusto(dataHoraEntrada, dataHoraSaida) {
    return 0;
  }

  descricaoRegra() {
    return "Entrada gratuita. Limite de 2 placas e 1 veículo estacionado por vez.";
  }
}
