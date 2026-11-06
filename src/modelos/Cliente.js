/**
 * Classe abstrata que representa um cliente pré-cadastrado do estacionamento.
 * Nunca deve ser instanciada diretamente: só existe para ser estendida por
 * Estudante, Professor e Empresa (que implementam a regra de cobrança
 * específica de cada tipo).
 *
 * Uso de encapsulamento: os atributos internos ficam marcados com "#"
 * (campos privados reais do JavaScript), só acessíveis pelos métodos
 * da própria classe ou de quem a estende.
 *
 * FASE 2: acrescentados os métodos de serialização para CSV
 * (paraLinhaCSV / COLUNAS_CSV) e o texto de regra usado na interface.
 */
export class Cliente {
  #cpfCnpj;
  #nome;
  #placas; // Set<string> -> evita cadastro de placas duplicadas

  constructor(cpfCnpj, nome) {
    // Trava de segurança: impede "new Cliente(...)" direto.
    // Só permite instanciar subclasses (Estudante, Professor, Empresa).
    if (new.target === Cliente) {
      throw new Error(
        "Cliente é uma classe abstrata e não pode ser instanciada diretamente."
      );
    }

    if (!cpfCnpj || !nome) {
      throw new Error("cpfCnpj e nome são obrigatórios para cadastrar um cliente.");
    }

    this.#cpfCnpj = String(cpfCnpj).trim();
    this.#nome = String(nome).trim();
    this.#placas = new Set();
  }

  // ----- Getters (leitura controlada dos atributos privados) -----

  get cpfCnpj() {
    return this.#cpfCnpj;
  }

  get nome() {
    return this.#nome;
  }

  // Retorna uma cópia das placas, para que ninguém de fora consiga
  // alterar o Set original sem passar pelos métodos da classe.
  get placas() {
    return new Set(this.#placas);
  }

  get quantidadePlacas() {
    return this.#placas.size;
  }

  /** Lista de placas em ordem, para exibir na tela e gravar no CSV. */
  get listaDePlacas() {
    return [...this.#placas];
  }

  // ----- Gerenciamento de placas -----

  /**
   * Adiciona uma placa ao cliente, respeitando o limite máximo definido
   * por cada subclasse (ver método limitePlacas()).
   * Lança erro se a placa já estiver cadastrada ou se o limite for atingido.
   */
  adicionarPlaca(placa) {
    if (!placa) {
      throw new Error("Placa inválida.");
    }

    const placaFormatada = placa.trim().toUpperCase();

    if (this.#placas.has(placaFormatada)) {
      throw new Error(`A placa ${placaFormatada} já está cadastrada para este cliente.`);
    }

    const limite = this.limitePlacas();
    if (limite !== Infinity && this.#placas.size >= limite) {
      throw new Error(
        `${this.nome} já atingiu o limite de ${limite} placa(s) cadastrada(s).`
      );
    }

    this.#placas.add(placaFormatada);
  }

  removerPlaca(placa) {
    const placaFormatada = placa.trim().toUpperCase();
    if (!this.#placas.has(placaFormatada)) {
      throw new Error(`A placa ${placaFormatada} não pertence a este cliente.`);
    }
    this.#placas.delete(placaFormatada);
  }

  possuiPlaca(placa) {
    return this.#placas.has(String(placa).trim().toUpperCase());
  }

  // ----- Métodos que cada subclasse é OBRIGADA a sobrescrever -----
  // (é aqui que entra o polimorfismo pedido no enunciado)

  /**
   * Quantidade máxima de placas que esse tipo de cliente pode cadastrar.
   * Estudante -> 1 | Professor -> 2 | Empresa -> Infinity
   */
  limitePlacas() {
    throw new Error("limitePlacas() deve ser implementado pela subclasse.");
  }

  /**
   * Calcula o valor a cobrar por uma permanência no estacionamento.
   * Cada subclasse aplica sua própria regra (ingresso fixo, gratuidade,
   * diária etc). Recebe as datas de entrada e saída (objetos Date).
   */
  calcularCusto(dataHoraEntrada, dataHoraSaida) {
    throw new Error("calcularCusto() deve ser implementado pela subclasse.");
  }

  /**
   * Indica se o cliente está impedido de entrar no estacionamento
   * (ex.: estudante com saldo negativo, empresa inadimplente).
   * Por padrão, ninguém está bloqueado; as subclasses que têm essa
   * regra sobrescrevem este método.
   */
  estaBloqueado() {
    return false;
  }

  /** Motivo do impedimento, usado no relatório de clientes impedidos. */
  motivoBloqueio() {
    return this.estaBloqueado() ? "Impedido" : "";
  }

  /** Nome do tipo, usado em relatórios e no registro dos tickets. */
  get tipo() {
    return this.constructor.name;
  }

  /** Texto curto com a regra de cobrança do tipo, exibido na interface. */
  descricaoRegra() {
    return "Regra definida pela subclasse.";
  }

  // ----- FASE 2: persistência em CSV -----

  static get COLUNAS_CSV() {
    return ["cpfCnpj", "nome", "tipo", "placas", "creditos", "saldoDevedor"];
  }

  /**
   * Converte o cliente em um objeto pronto para virar uma linha do CSV.
   * Estudante e Empresa completam as colunas de créditos e saldo devedor.
   */
  paraLinhaCSV() {
    return {
      cpfCnpj: this.cpfCnpj,
      nome: this.nome,
      tipo: this.tipo,
      placas: this.listaDePlacas.join("|"),
      creditos: "",
      saldoDevedor: "",
    };
  }
}
