import path from "node:path";
import { fileURLToPath } from "node:url";

import { CadastroClientes } from "./CadastroClientes.js";
import { RegistroDeEntradasESaidas } from "./RegistroDeEntradasESaidas.js";
import { RelatoriosGerenciais } from "./RelatoriosGerenciais.js";
import { InterfaceUsuario } from "../interfaces/InterfaceUsuario.js";

const PASTA_DESTE_ARQUIVO = path.dirname(fileURLToPath(import.meta.url));
const PASTA_DADOS = path.join(PASTA_DESTE_ARQUIVO, "..", "..", "dados");

/**
 * Monta o sistema, carrega os arquivos CSV e entrega o controle para a
 * interface com o usuário.
 *
 * Na Fase 1 esta classe era uma demonstração automática; na Fase 2 ela passa
 * a ser o ponto de montagem do sistema e a responsável pela persistência,
 * como estava previsto no comentário da própria classe.
 */
export class App {
  #cadastroClientes;
  #registro;
  #relatorios;
  #caminhos;

  constructor(pastaDados = PASTA_DADOS) {
    this.#cadastroClientes = new CadastroClientes();
    this.#registro = new RegistroDeEntradasESaidas(this.#cadastroClientes);
    this.#relatorios = new RelatoriosGerenciais(this.#cadastroClientes, this.#registro);
    this.#caminhos = {
      clientes: path.join(pastaDados, "clientes.csv"),
      registros: path.join(pastaDados, "registros.csv"),
      bloqueios: path.join(pastaDados, "bloqueios.csv"),
    };
  }

  get cadastroClientes() {
    return this.#cadastroClientes;
  }

  get registro() {
    return this.#registro;
  }

  get relatorios() {
    return this.#relatorios;
  }

  /** Leitura dos três arquivos CSV na inicialização do sistema. */
  carregarTudo() {
    const clientes = this.#cadastroClientes.carregarDeCSV(this.#caminhos.clientes);
    const registros = this.#registro.carregarDeCSV(this.#caminhos.registros);
    const bloqueios = this.#registro.carregarBloqueiosDeCSV(this.#caminhos.bloqueios);

    return {
      clientes,
      registros,
      bloqueios,
      veiculosNoPatio: this.#registro.totalNoPatio,
      avisos: [
        ...this.#cadastroClientes.avisosDeLeitura,
        ...this.#registro.avisosDeLeitura,
      ],
    };
  }

  /** Gravação dos três arquivos CSV. */
  salvarTudo() {
    return {
      clientes: this.#cadastroClientes.salvarEmCSV(this.#caminhos.clientes),
      registros: this.#registro.salvarEmCSV(this.#caminhos.registros),
      bloqueios: this.#registro.salvarBloqueiosEmCSV(this.#caminhos.bloqueios),
    };
  }

  async iniciar() {
    const resumo = this.carregarTudo();

    const interfaceUsuario = new InterfaceUsuario({
      cadastroClientes: this.#cadastroClientes,
      registro: this.#registro,
      relatorios: this.#relatorios,
      persistencia: this,
    });

    await interfaceUsuario.iniciar(resumo);
  }
}
