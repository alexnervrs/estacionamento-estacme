/**
 * Classe base dos descontos. Permite adicionar novos tipos de desconto
 * no futuro sem alterar o código que já existe (Strategy pattern).
 */
export class Desconto {
  get identificador() {
    throw new Error("identificador deve ser implementado pela subclasse.");
  }

  // Decide se esse desconto se aplica ao histórico de um cliente avulso.
  aplicavel(historicoDeEntradasDaPlaca) {
    throw new Error("aplicavel() deve ser implementado pela subclasse.");
  }

  calcularValorDesconto(valorOriginal) {
    throw new Error("calcularValorDesconto() deve ser implementado pela subclasse.");
  }
}

/**
 * ClienteFrequente: avulso que usou o estacionamento 3x nos últimos 5 dias
 * recebe 20% de desconto, independentemente de já ter sido beneficiado antes.
 */
export class ClienteFrequente extends Desconto {
  static PERCENTUAL = 0.2;
  static USOS_MINIMOS = 3;
  static JANELA_DIAS = 5;

  get identificador() {
    return "ClienteFrequente";
  }

  aplicavel(historicoDeEntradasDaPlaca, dataReferencia = new Date()) {
    const limiteAntigo = new Date(dataReferencia);
    limiteAntigo.setDate(limiteAntigo.getDate() - ClienteFrequente.JANELA_DIAS);

    const usosRecentes = historicoDeEntradasDaPlaca.filter(
      (dataEntrada) => dataEntrada >= limiteAntigo && dataEntrada <= dataReferencia
    );

    return usosRecentes.length >= ClienteFrequente.USOS_MINIMOS;
  }

  calcularValorDesconto(valorOriginal) {
    return valorOriginal * ClienteFrequente.PERCENTUAL;
  }
}
