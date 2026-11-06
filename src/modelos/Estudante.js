import { Cliente } from "./Cliente.js";

/**
 * Estudante: cadastra 1 única placa, é pré-pago (créditos), e paga um
 * valor fixo por ingresso (vale até a meia-noite do mesmo dia).
 */
export class Estudante extends Cliente {
  static CUSTO_FIXO_POR_INGRESSO = 25;

  #creditos;

  constructor(cpfCnpj, nome, creditosIniciais = 0) {
    super(cpfCnpj, nome);
    this.#creditos = Number(creditosIniciais) || 0;
  }

  get creditos() {
    return this.#creditos;
  }

  limitePlacas() {
    return 1;
  }

  carregarSaldo(valor) {
    if (valor <= 0) throw new Error("Valor de recarga deve ser positivo.");
    this.#creditos += valor;
  }

  debitarCreditos(valor) {
    // Regra do documento: pode ficar negativo, a saída é sempre liberada.
    this.#creditos -= valor;
  }

  // Bloqueado enquanto o saldo estiver negativo (impede novas entradas).
  estaBloqueado() {
    return this.#creditos < 0;
  }

  motivoBloqueio() {
    return this.estaBloqueado()
      ? `Saldo de créditos negativo (R$ ${this.#creditos.toFixed(2).replace(".", ",")})`
      : "";
  }

  calcularCusto(dataHoraEntrada, dataHoraSaida) {
    const mesmoDia =
      dataHoraEntrada.toDateString() === dataHoraSaida.toDateString();

    // Se passou da meia-noite, é cobrado um novo ingresso (2x o valor fixo).
    return mesmoDia
      ? Estudante.CUSTO_FIXO_POR_INGRESSO
      : Estudante.CUSTO_FIXO_POR_INGRESSO * 2;
  }

  descricaoRegra() {
    return `Pré-pago: R$ ${Estudante.CUSTO_FIXO_POR_INGRESSO},00 por ingresso `
      + `(o dobro se passar da meia-noite). Limite de 1 placa.`;
  }

  // FASE 2: grava os créditos no CSV.
  paraLinhaCSV() {
    return { ...super.paraLinhaCSV(), creditos: this.#creditos.toFixed(2) };
  }
}
