import { Cliente } from "../modelos/Cliente.js";
import { Estudante } from "../modelos/Estudante.js";
import { Professor } from "../modelos/Professor.js";
import { Empresa } from "../modelos/Empresa.js";
import { garantirArquivo, lerCSV, gravarCSV } from "../utils/csv.js";

/**
 * Gerencia todos os clientes pré-cadastrados (Estudante, Professor, Empresa).
 * Usa dois Maps para busca rápida (exigência do documento):
 *  - por CPF/CNPJ (identificação do cliente)
 *  - por placa (para descobrir rapidamente o dono de um veículo na entrada)
 *
 * FASE 2:
 *  - acrescentado o Set #todasAsPlacas, que impede a MESMA placa de ser
 *    cadastrada para dois clientes diferentes;
 *  - acrescentados carregarDeCSV() e salvarEmCSV(), previstos no diagrama
 *    de classes da Fase 1.
 */
export class CadastroClientes {
  #clientesPorId; // Map<cpfCnpj, Cliente>
  #clientesPorPlaca; // Map<placa, Cliente>
  #todasAsPlacas; // Set<placa> -> evita placa duplicada entre clientes
  #avisosDeLeitura; // mensagens sobre linhas ignoradas do CSV

  constructor() {
    this.#clientesPorId = new Map();
    this.#clientesPorPlaca = new Map();
    this.#todasAsPlacas = new Set();
    this.#avisosDeLeitura = [];
  }

  get totalClientes() {
    return this.#clientesPorId.size;
  }

  get todosClientes() {
    return [...this.#clientesPorId.values()];
  }

  get todasAsPlacas() {
    return new Set(this.#todasAsPlacas);
  }

  get avisosDeLeitura() {
    return [...this.#avisosDeLeitura];
  }

  cadastrarCliente(cliente) {
    if (!(cliente instanceof Cliente)) {
      throw new Error("Só é possível cadastrar objetos do tipo Cliente.");
    }
    if (this.#clientesPorId.has(cliente.cpfCnpj)) {
      throw new Error(`Já existe um cliente cadastrado com o documento ${cliente.cpfCnpj}.`);
    }

    // O Set garante que nenhuma placa pertença a dois clientes.
    for (const placa of cliente.placas) {
      if (this.#todasAsPlacas.has(placa)) {
        const dono = this.buscarPorPlaca(placa);
        throw new Error(
          `A placa ${placa} já está cadastrada para ${dono ? dono.nome : "outro cliente"}.`
        );
      }
    }

    this.#clientesPorId.set(cliente.cpfCnpj, cliente);
    for (const placa of cliente.placas) {
      this.#clientesPorPlaca.set(placa, cliente);
      this.#todasAsPlacas.add(placa);
    }
    return cliente;
  }

  // Chame depois de cliente.adicionarPlaca(...) para manter o índice em dia.
  registrarPlacaNoIndice(placa, cliente) {
    const placaFormatada = placa.trim().toUpperCase();
    this.#clientesPorPlaca.set(placaFormatada, cliente);
    this.#todasAsPlacas.add(placaFormatada);
  }

  removerPlacaDoIndice(placa) {
    const placaFormatada = placa.trim().toUpperCase();
    this.#clientesPorPlaca.delete(placaFormatada);
    this.#todasAsPlacas.delete(placaFormatada);
  }

  buscarPorCpfCnpj(cpfCnpj) {
    return this.#clientesPorId.get(String(cpfCnpj).trim()) ?? null;
  }

  buscarPorPlaca(placa) {
    return this.#clientesPorPlaca.get(String(placa).trim().toUpperCase()) ?? null;
  }

  buscarPorNome(termo) {
    const busca = String(termo || "").trim().toLowerCase();
    if (!busca) return [];
    return this.todosClientes.filter((cliente) => cliente.nome.toLowerCase().includes(busca));
  }

  placaJaCadastrada(placa) {
    return this.#todasAsPlacas.has(String(placa).trim().toUpperCase());
  }

  /** Adiciona uma placa a um cliente já existente, mantendo os índices. */
  adicionarPlacaAoCliente(cpfCnpj, placa) {
    const cliente = this.buscarPorCpfCnpj(cpfCnpj);
    if (!cliente) throw new Error("Cliente não encontrado.");

    const placaFormatada = String(placa).trim().toUpperCase();
    if (this.#todasAsPlacas.has(placaFormatada)) {
      const dono = this.buscarPorPlaca(placaFormatada);
      throw new Error(
        `A placa ${placaFormatada} já está cadastrada para ${dono ? dono.nome : "outro cliente"}.`
      );
    }

    cliente.adicionarPlaca(placaFormatada); // respeita o limite de placas do tipo
    this.registrarPlacaNoIndice(placaFormatada, cliente);
    return cliente;
  }

  removerPlacaDoCliente(cpfCnpj, placa) {
    const cliente = this.buscarPorCpfCnpj(cpfCnpj);
    if (!cliente) throw new Error("Cliente não encontrado.");

    cliente.removerPlaca(placa); // lança erro se a placa não for do cliente
    this.removerPlacaDoIndice(placa);
    return cliente;
  }

  removerCliente(cpfCnpj) {
    const cliente = this.buscarPorCpfCnpj(cpfCnpj);
    if (!cliente) return false;
    for (const placa of cliente.placas) {
      this.removerPlacaDoIndice(placa);
    }
    return this.#clientesPorId.delete(cliente.cpfCnpj);
  }

  listarPorTipo(tipo) {
    const alvo = String(tipo || "").toLowerCase();
    return this.todosClientes.filter((cliente) => cliente.tipo.toLowerCase() === alvo);
  }

  /** Quantidade de clientes por tipo, exibida no resumo da tela inicial. */
  contarPorTipo() {
    const contagem = new Map();
    for (const cliente of this.#clientesPorId.values()) {
      contagem.set(cliente.tipo, (contagem.get(cliente.tipo) || 0) + 1);
    }
    return contagem;
  }

  /** Fábrica: cria a subclasse correta a partir do tipo informado. */
  static criarPorTipo({ tipo, cpfCnpj, nome, creditos = 0, saldoDevedor = 0, placas = [] }) {
    let cliente;

    switch (String(tipo).trim().toLowerCase()) {
      case "estudante":
        cliente = new Estudante(cpfCnpj, nome, Number(creditos) || 0);
        break;
      case "professor":
        cliente = new Professor(cpfCnpj, nome);
        break;
      case "empresa":
        cliente = new Empresa(cpfCnpj, nome, Number(saldoDevedor) || 0);
        break;
      default:
        throw new Error(
          `Tipo de cliente desconhecido: "${tipo}". Use Estudante, Professor ou Empresa.`
        );
    }

    const lista = Array.isArray(placas)
      ? placas
      : String(placas || "").split(/[|;,]/).map((p) => p.trim()).filter(Boolean);

    for (const placa of lista) {
      cliente.adicionarPlaca(placa); // respeita o limite de placas do tipo
    }

    return cliente;
  }

  // ----- FASE 2: persistência em CSV -----

  /**
   * Lê o arquivo de clientes na inicialização do sistema. Linhas com problema
   * não derrubam o programa: são ignoradas e registradas em avisosDeLeitura.
   */
  carregarDeCSV(caminho) {
    this.#avisosDeLeitura = [];
    garantirArquivo(caminho, Cliente.COLUNAS_CSV);

    let carregados = 0;
    for (const linha of lerCSV(caminho)) {
      try {
        this.cadastrarCliente(CadastroClientes.criarPorTipo(linha));
        carregados++;
      } catch (erro) {
        this.#avisosDeLeitura.push(`clientes.csv linha ${linha._linha}: ${erro.message}`);
      }
    }
    return carregados;
  }

  /** Grava o estado atual dos clientes no arquivo CSV. */
  salvarEmCSV(caminho) {
    const linhas = this.todosClientes.map((cliente) => cliente.paraLinhaCSV());
    gravarCSV(caminho, Cliente.COLUNAS_CSV, linhas);
    return linhas.length;
  }
}
