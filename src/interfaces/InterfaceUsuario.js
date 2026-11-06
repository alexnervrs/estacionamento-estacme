import readline from "node:readline";

import { CadastroClientes } from "../servicos/CadastroClientes.js";
import { Estudante } from "../modelos/Estudante.js";
import { Empresa } from "../modelos/Empresa.js";
import { normalizarEntradaDeData, inicioDoDia, fimDoDia } from "../utils/datas.js";
import * as F from "../utils/formato.js";

const TIPOS = { 1: "Estudante", 2: "Professor", 3: "Empresa" };

/**
 * Interface com o usuário (item "b" do enunciado da Fase 2).
 *
 * Toda a conversa com quem usa o sistema acontece aqui: menus, perguntas,
 * validação do que foi digitado e exibição dos resultados em tabelas.
 * Esta classe não calcula regras de negócio — ela chama CadastroClientes,
 * RegistroDeEntradasESaidas e RelatoriosGerenciais.
 */
export class InterfaceUsuario {
  #cadastroClientes;
  #registro;
  #relatorios;
  #persistencia;
  #rl;
  #filaDeLinhas;
  #aguardandoResposta;
  #entradaEncerrada;
  #encerrando;

  constructor({ cadastroClientes, registro, relatorios, persistencia }) {
    this.#cadastroClientes = cadastroClientes;
    this.#registro = registro;
    this.#relatorios = relatorios;
    this.#persistencia = persistencia;

    this.#filaDeLinhas = [];
    this.#aguardandoResposta = null;
    this.#entradaEncerrada = false;
    this.#encerrando = false;

    this.#rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY === true,
    });

    // As linhas digitadas entram numa fila. Assim o sistema funciona tanto
    // digitando no teclado quanto recebendo um roteiro de respostas pronto.
    this.#rl.on("line", (linha) => {
      const texto = String(linha).trim();
      if (this.#aguardandoResposta) {
        const responder = this.#aguardandoResposta;
        this.#aguardandoResposta = null;
        responder(texto);
      } else {
        this.#filaDeLinhas.push(texto);
      }
    });

    // Fim da entrada (Ctrl+D ou roteiro terminado): salva e encerra.
    this.#rl.on("close", () => {
      if (this.#encerrando) return;
      this.#encerrando = true;
      this.escrever("\n\n  Entrada encerrada. Salvando dados nos arquivos CSV...");
      this.salvarAutomatico();
      this.escrever("  Sistema encerrado.\n");
      process.exit(0);
    });
  }

  // ==================================================================
  // Entrada e saída de texto
  // ==================================================================

  escrever(texto = "") {
    console.log(texto);
  }

  perguntar(texto) {
    process.stdout.write(texto);
    if (this.#filaDeLinhas.length > 0) {
      const resposta = this.#filaDeLinhas.shift();
      process.stdout.write(resposta + "\n");
      return Promise.resolve(resposta);
    }
    if (this.#entradaEncerrada) return Promise.resolve("");
    return new Promise((resolve) => {
      this.#aguardandoResposta = resolve;
    });
  }

  async perguntarObrigatorio(texto) {
    while (true) {
      const resposta = await this.perguntar(texto);
      if (resposta) return resposta;
      this.escrever("  ! Campo obrigatório.");
    }
  }

  async perguntarNumero(texto, { minimo = null, permitirVazio = false, padrao = 0 } = {}) {
    while (true) {
      const resposta = await this.perguntar(texto);
      if (!resposta && permitirVazio) return padrao;

      const numero = Number(String(resposta).replace(",", "."));
      if (!Number.isFinite(numero)) {
        this.escrever("  ! Valor inválido. Digite apenas números (ex.: 50 ou 50,00).");
        continue;
      }
      if (minimo !== null && numero < minimo) {
        this.escrever(`  ! O valor deve ser maior ou igual a ${minimo}.`);
        continue;
      }
      return numero;
    }
  }

  async perguntarData(texto) {
    while (true) {
      const resposta = await this.perguntar(texto);
      if (!resposta) return null;
      const normalizada = normalizarEntradaDeData(resposta);
      if (!normalizada) {
        this.escrever("  ! Data inválida. Use DD/MM/AAAA ou AAAA-MM-DD.");
        continue;
      }
      return normalizada;
    }
  }

  /** Devolve { inicio, fim } como objetos Date (ou null quando sem limite). */
  async perguntarPeriodo() {
    this.escrever("  (formato DD/MM/AAAA — deixe em branco para não limitar)");
    while (true) {
      const de = await this.perguntarData("  Data inicial: ");
      const ate = await this.perguntarData("  Data final..: ");
      if (de && ate && de > ate) {
        this.escrever("  ! A data inicial não pode ser posterior à data final.");
        continue;
      }
      return {
        inicio: de ? inicioDoDia(de) : null,
        fim: ate ? fimDoDia(ate) : null,
      };
    }
  }

  async confirmar(texto) {
    const resposta = await this.perguntar(`${texto} (s/n): `);
    return /^(s|sim|y)$/i.test(resposta);
  }

  async pausar() {
    await this.perguntar("\n  Pressione ENTER para voltar ao menu... ");
  }

  descricaoPeriodo(periodo) {
    const de = periodo.inicio ? F.dataCurta(periodo.inicio) : null;
    const ate = periodo.fim ? F.dataCurta(periodo.fim) : null;
    if (de && ate) return `${de} a ${ate}`;
    if (de) return `a partir de ${de}`;
    if (ate) return `até ${ate}`;
    return "Todo o histórico";
  }

  // ==================================================================
  // Salvamento
  // ==================================================================

  /** Salvamento automático, chamado após cada operação que altera dados. */
  salvarAutomatico() {
    try {
      this.#persistencia.salvarTudo();
      return true;
    } catch (erro) {
      this.escrever(`  ! Não foi possível salvar automaticamente: ${erro.message}`);
      return false;
    }
  }

  salvarManual() {
    const resultado = this.#persistencia.salvarTudo();
    this.escrever(F.titulo("Dados salvos nos arquivos CSV"));
    this.escrever(
      F.ficha([
        ["dados/clientes.csv", `${resultado.clientes} cliente(s)`],
        ["dados/registros.csv", `${resultado.registros} registro(s)`],
        ["dados/bloqueios.csv", `${resultado.bloqueios} bloqueio(s)`],
      ])
    );
  }

  // ==================================================================
  // Laço principal
  // ==================================================================

  async iniciar(resumoCarga) {
    this.#mostrarAbertura(resumoCarga);

    process.on("SIGINT", () => {
      if (this.#encerrando) return;
      this.#encerrando = true;
      this.escrever("\n\n  Encerrando... salvando dados nos arquivos CSV.");
      this.salvarAutomatico();
      this.#rl.close();
      process.exit(0);
    });

    let sair = false;
    while (!sair) {
      this.#mostrarMenuPrincipal();
      const opcao = await this.perguntar("  Escolha uma opção: ");

      try {
        switch (opcao) {
          case "1": await this.#menuClientes(); break;
          case "2": await this.#registrarEntrada(); break;
          case "3": await this.#registrarSaida(); break;
          case "4": await this.#mostrarPatio(); break;
          case "5": await this.#menuBloqueios(); break;
          case "6": await this.#menuRelatorios(); break;
          case "7": this.salvarManual(); await this.pausar(); break;
          case "0": sair = true; break;
          default: this.escrever("  ! Opção inválida. Escolha um número de 0 a 7.");
        }
      } catch (erro) {
        this.escrever(`\n  ! ${erro.message}`);
        await this.pausar();
      }
    }

    this.#encerrando = true;
    this.escrever("");
    this.salvarManual();
    this.escrever("\n  Sistema encerrado. Até logo!\n");
    this.#rl.close();
  }

  #mostrarAbertura(resumo) {
    this.escrever(F.titulo("EstACME — Sistema de Controle de Estacionamento (Fase 2)"));
    if (!resumo) return;

    this.escrever(
      F.ficha([
        ["Clientes carregados", String(resumo.clientes)],
        ["Registros carregados", String(resumo.registros)],
        ["Veículos no pátio", String(resumo.veiculosNoPatio)],
        ["Itens na lista de bloqueio", String(resumo.bloqueios)],
      ])
    );

    if (resumo.avisos?.length) {
      this.escrever(F.subtitulo("Avisos na leitura dos arquivos (linhas ignoradas)"));
      resumo.avisos.forEach((aviso) => this.escrever("  - " + aviso));
    }
  }

  #mostrarMenuPrincipal() {
    this.escrever(F.titulo("Menu principal"));
    this.escrever(
      `  Clientes: ${this.#cadastroClientes.totalClientes}   |   ` +
      `No pátio: ${this.#registro.totalNoPatio}   |   ` +
      `Bloqueios: ${this.#registro.clientesImpedidos.length}`
    );
    this.escrever(F.linha("-"));
    this.escrever("  1 - Clientes (cadastrar, consultar, placas, créditos, boleto)");
    this.escrever("  2 - Registrar ENTRADA de veículo");
    this.escrever("  3 - Registrar SAÍDA de veículo");
    this.escrever("  4 - Veículos no pátio");
    this.escrever("  5 - Lista de bloqueio");
    this.escrever("  6 - Relatórios gerenciais");
    this.escrever("  7 - Salvar dados nos arquivos CSV");
    this.escrever("  0 - Sair (salva automaticamente)");
    this.escrever(F.linha("-"));
  }

  // ==================================================================
  // 1. Clientes
  // ==================================================================

  async #menuClientes() {
    let voltar = false;
    while (!voltar) {
      this.escrever(F.titulo("Clientes"));
      this.escrever("  1 - Cadastrar novo cliente");
      this.escrever("  2 - Consultar cliente (documento, placa ou nome)");
      this.escrever("  3 - Listar todos os clientes");
      this.escrever("  4 - Adicionar placa a um cliente");
      this.escrever("  5 - Remover placa de um cliente");
      this.escrever("  6 - Recarregar créditos de estudante");
      this.escrever("  7 - Registrar pagamento de boleto de empresa");
      this.escrever("  8 - Remover cliente");
      this.escrever("  0 - Voltar ao menu principal");
      this.escrever(F.linha("-"));

      const opcao = await this.perguntar("  Escolha uma opção: ");
      try {
        switch (opcao) {
          case "1": await this.#cadastrarCliente(); break;
          case "2": await this.#consultarCliente(); break;
          case "3": await this.#listarClientes(); break;
          case "4": await this.#adicionarPlaca(); break;
          case "5": await this.#removerPlaca(); break;
          case "6": await this.#recarregarCreditos(); break;
          case "7": await this.#pagarBoleto(); break;
          case "8": await this.#removerCliente(); break;
          case "0": voltar = true; break;
          default: this.escrever("  ! Opção inválida.");
        }
      } catch (erro) {
        this.escrever(`\n  ! ${erro.message}`);
        await this.pausar();
      }
    }
  }

  async #cadastrarCliente() {
    this.escrever(F.titulo("Cadastro de cliente"));
    this.escrever("  Tipos disponíveis:");
    this.escrever("    1 - Estudante  (1 placa, pré-pago, R$ 25,00 por ingresso)");
    this.escrever("    2 - Professor  (até 2 placas, gratuito, 1 veículo por vez)");
    this.escrever("    3 - Empresa    (placas ilimitadas, diária de R$ 70,00, faturado)");
    this.escrever("    0 - Cancelar");

    let tipo = null;
    while (!tipo) {
      const escolha = await this.perguntar("  Tipo do cliente: ");
      if (escolha === "0") return this.escrever("  Cadastro cancelado.");
      tipo = TIPOS[escolha];
      if (!tipo) this.escrever("  ! Escolha 1, 2 ou 3.");
    }

    const cpfCnpj = await this.#perguntarDocumento(tipo);
    if (!cpfCnpj) return this.escrever("  Cadastro cancelado.");

    const nome = await this.perguntarObrigatorio("  Nome: ");

    const limite = tipo === "Estudante" ? 1 : tipo === "Professor" ? 2 : Infinity;
    const placas = await this.#lerPlacas(limite);

    let creditos = 0;
    let saldoDevedor = 0;
    if (tipo === "Estudante") {
      creditos = await this.perguntarNumero("  Créditos iniciais (ENTER para 0): ", {
        minimo: 0,
        permitirVazio: true,
      });
    }
    if (tipo === "Empresa") {
      saldoDevedor = await this.perguntarNumero("  Saldo devedor inicial (ENTER para 0): ", {
        minimo: 0,
        permitirVazio: true,
      });
    }

    const cliente = CadastroClientes.criarPorTipo({
      tipo, cpfCnpj, nome, placas, creditos, saldoDevedor,
    });
    this.#cadastroClientes.cadastrarCliente(cliente);
    this.salvarAutomatico();

    this.escrever(F.subtitulo("Cliente cadastrado com sucesso"));
    this.escrever(
      F.ficha([
        ["Documento", cliente.cpfCnpj],
        ["Nome", cliente.nome],
        ["Tipo", cliente.tipo],
        ["Regra", cliente.descricaoRegra()],
        ["Placas", cliente.listaDePlacas.join(", ") || "(nenhuma)"],
        ...(cliente instanceof Estudante ? [["Créditos", F.moeda(cliente.creditos)]] : []),
        ...(cliente instanceof Empresa ? [["Saldo devedor", F.moeda(cliente.saldoDevedor)]] : []),
      ])
    );

    if (cliente.estaBloqueado()) {
      this.escrever(`\n  ! Atenção: ${cliente.motivoBloqueio()} — o cliente já entra impedido.`);
    }
    await this.pausar();
  }

  async #perguntarDocumento(tipo) {
    const tamanho = tipo === "Empresa" ? 14 : 11;
    const rotulo = tipo === "Empresa" ? "CNPJ (14 dígitos)" : "CPF (11 dígitos)";

    while (true) {
      const resposta = await this.perguntar(`  ${rotulo} (0 para cancelar): `);
      if (resposta === "0") return null;

      const digitos = resposta.replace(/\D/g, "");
      if (digitos.length !== tamanho) {
        this.escrever(
          `  ! Documento inválido: são necessários ${tamanho} dígitos (foram digitados ${digitos.length}).`
        );
        continue;
      }
      const existente = this.#cadastroClientes.buscarPorCpfCnpj(digitos);
      if (existente) {
        this.escrever(`  ! Documento já cadastrado para ${existente.nome} (${existente.tipo}).`);
        continue;
      }
      return digitos;
    }
  }

  /** Formato aceito: ABC1234 (antigo) e ABC1D23 (Mercosul). */
  static placaValida(placa) {
    return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(String(placa).replace(/[\s-]/g, "").toUpperCase());
  }

  async #lerPlacas(limite) {
    const texto = limite === Infinity
      ? "  Placas (separadas por vírgula): "
      : `  Placa(s) — máximo ${limite}, separadas por vírgula: `;

    while (true) {
      const resposta = await this.perguntar(texto);
      const lista = resposta
        .split(/[,;|]/)
        .map((p) => p.replace(/[\s-]/g, "").toUpperCase())
        .filter(Boolean);

      if (lista.length === 0) {
        if (await this.confirmar("  Nenhuma placa informada. Cadastrar cliente sem veículo?")) {
          return [];
        }
        continue;
      }
      if (limite !== Infinity && lista.length > limite) {
        this.escrever(`  ! Esse tipo de cliente aceita no máximo ${limite} placa(s).`);
        continue;
      }

      const invalidas = lista.filter((placa) => !InterfaceUsuario.placaValida(placa));
      if (invalidas.length) {
        this.escrever(`  ! Placa(s) em formato inválido: ${invalidas.join(", ")}. Use ABC1234 ou ABC1D23.`);
        continue;
      }

      const ocupadas = lista.filter((placa) => this.#cadastroClientes.placaJaCadastrada(placa));
      if (ocupadas.length) {
        this.escrever(`  ! Placa(s) já cadastrada(s) para outro cliente: ${ocupadas.join(", ")}.`);
        continue;
      }

      const repetidas = lista.filter((placa, i) => lista.indexOf(placa) !== i);
      if (repetidas.length) {
        this.escrever(`  ! Placa repetida na lista: ${[...new Set(repetidas)].join(", ")}.`);
        continue;
      }

      return lista;
    }
  }

  /** Localiza um cliente por documento, placa ou nome. */
  async #localizarCliente(mensagem = "  Documento, placa ou nome do cliente: ") {
    const termo = await this.perguntar(mensagem);
    if (!termo) return null;

    const porDocumento = this.#cadastroClientes.buscarPorCpfCnpj(termo.replace(/\D/g, ""));
    if (porDocumento) return porDocumento;

    const porPlaca = this.#cadastroClientes.buscarPorPlaca(termo);
    if (porPlaca) return porPlaca;

    const porNome = this.#cadastroClientes.buscarPorNome(termo);
    if (porNome.length === 1) return porNome[0];

    if (porNome.length > 1) {
      this.escrever(F.subtitulo(`${porNome.length} clientes encontrados`));
      this.escrever(
        F.tabela(
          [
            { titulo: "#", campo: "indice", alinhamento: "direita" },
            { titulo: "Documento", campo: "cpfCnpj" },
            { titulo: "Nome", campo: "nome" },
            { titulo: "Tipo", campo: "tipo" },
          ],
          porNome.map((cliente, i) => ({
            indice: i + 1,
            cpfCnpj: cliente.cpfCnpj,
            nome: cliente.nome,
            tipo: cliente.tipo,
          }))
        )
      );
      const escolha = await this.perguntarNumero("  Escolha o número (0 para cancelar): ", { minimo: 0 });
      if (escolha >= 1 && escolha <= porNome.length) return porNome[escolha - 1];
      return null;
    }

    this.escrever("  ! Cliente não encontrado.");
    return null;
  }

  async #consultarCliente() {
    const cliente = await this.#localizarCliente();
    if (!cliente) return;
    this.#exibirSituacaoCliente(this.#relatorios.situacaoCliente(cliente.cpfCnpj));
    await this.pausar();
  }

  async #listarClientes() {
    const clientes = this.#cadastroClientes.todosClientes.sort(
      (a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome)
    );

    this.escrever(F.titulo(`Clientes cadastrados (${clientes.length})`));
    this.escrever(
      F.tabela(
        [
          { titulo: "Documento", campo: "cpfCnpj" },
          { titulo: "Nome", campo: "nome" },
          { titulo: "Tipo", campo: "tipo" },
          { titulo: "Placas", campo: "placas" },
          { titulo: "Créditos", campo: "creditos", alinhamento: "direita" },
          { titulo: "Saldo devedor", campo: "devedor", alinhamento: "direita" },
          { titulo: "Situação", campo: "situacao" },
        ],
        clientes.map((cliente) => ({
          cpfCnpj: cliente.cpfCnpj,
          nome: cliente.nome,
          tipo: cliente.tipo,
          placas: cliente.listaDePlacas.join(" ") || "-",
          creditos: cliente instanceof Estudante ? F.moeda(cliente.creditos) : "-",
          devedor: cliente instanceof Empresa ? F.moeda(cliente.saldoDevedor) : "-",
          situacao: cliente.estaBloqueado() ? "Impedido" : "Regular",
        }))
      )
    );

    const contagem = this.#cadastroClientes.contarPorTipo();
    if (contagem.size) {
      this.escrever("");
      this.escrever(
        "  Por tipo: " +
        [...contagem.entries()].map(([tipo, qtd]) => `${tipo}: ${qtd}`).join("   |   ")
      );
    }
    await this.pausar();
  }

  async #adicionarPlaca() {
    const cliente = await this.#localizarCliente();
    if (!cliente) return;

    const limite = cliente.limitePlacas();
    this.escrever(`  ${cliente.nome} (${cliente.tipo}) — placas: ${cliente.listaDePlacas.join(", ") || "(nenhuma)"}`);
    this.escrever(`  Limite do tipo: ${limite === Infinity ? "ilimitado" : limite} placa(s).`);

    const placa = await this.perguntarObrigatorio("  Nova placa: ");
    if (!InterfaceUsuario.placaValida(placa)) {
      throw new Error(`Placa inválida: "${placa}". Use o formato ABC1234 ou ABC1D23.`);
    }

    this.#cadastroClientes.adicionarPlacaAoCliente(cliente.cpfCnpj, placa);
    this.salvarAutomatico();
    this.escrever(`\n  Placa adicionada. Placas de ${cliente.nome}: ${cliente.listaDePlacas.join(", ")}`);
    await this.pausar();
  }

  async #removerPlaca() {
    const cliente = await this.#localizarCliente();
    if (!cliente) return;

    this.escrever(`  Placas atuais de ${cliente.nome}: ${cliente.listaDePlacas.join(", ") || "(nenhuma)"}`);
    const placa = await this.perguntarObrigatorio("  Placa a remover: ");

    if (this.#registro.buscarTicketAtivo(placa)) {
      throw new Error("Esse veículo está no pátio. Registre a saída antes de remover a placa.");
    }

    this.#cadastroClientes.removerPlacaDoCliente(cliente.cpfCnpj, placa);
    this.salvarAutomatico();
    this.escrever(`\n  Placa removida. Placas de ${cliente.nome}: ${cliente.listaDePlacas.join(", ") || "(nenhuma)"}`);
    await this.pausar();
  }

  async #recarregarCreditos() {
    const cliente = await this.#localizarCliente("  Documento, placa ou nome do estudante: ");
    if (!cliente) return;
    if (!(cliente instanceof Estudante)) {
      throw new Error(`${cliente.nome} é do tipo ${cliente.tipo}. A recarga vale só para Estudante.`);
    }

    this.escrever(`  Créditos atuais de ${cliente.nome}: ${F.moeda(cliente.creditos)}`);
    if (cliente.creditos < 0) {
      this.escrever(`  ! Saldo negativo: o estudante está impedido de entrar até regularizar.`);
    }

    const valor = await this.perguntarNumero("  Valor da recarga: ", { minimo: 0.01 });
    const saldo = this.#registro.recarregarCreditos(cliente, valor);
    this.salvarAutomatico();

    this.escrever(`\n  Recarga de ${F.moeda(valor)} realizada. Novo saldo: ${F.moeda(saldo)}`);
    this.escrever(`  Situação: ${cliente.estaBloqueado() ? "ainda impedido (saldo negativo)" : "liberado"}`);
    await this.pausar();
  }

  async #pagarBoleto() {
    const cliente = await this.#localizarCliente("  Documento, placa ou nome da empresa: ");
    if (!cliente) return;
    if (!(cliente instanceof Empresa)) {
      throw new Error(`${cliente.nome} é do tipo ${cliente.tipo}. O boleto vale só para Empresa.`);
    }
    if (cliente.saldoDevedor <= 0) {
      throw new Error(`${cliente.nome} não possui saldo devedor.`);
    }

    this.escrever(`  Saldo devedor de ${cliente.nome}: ${F.moeda(cliente.saldoDevedor)}`);
    const valor = await this.perguntarNumero(
      `  Valor do pagamento (ENTER para pagar o total): `,
      { minimo: 0.01, permitirVazio: true, padrao: cliente.saldoDevedor }
    );

    const restante = this.#registro.registrarPagamentoEmpresa(cliente, valor);
    this.salvarAutomatico();

    this.escrever(F.subtitulo("Pagamento registrado"));
    this.escrever(
      F.ficha([
        ["Empresa", cliente.nome],
        ["Valor pago", F.moeda(valor)],
        ["Saldo devedor restante", F.moeda(restante)],
        ["Situação", cliente.estaBloqueado() ? "Ainda inadimplente" : "Liberada para entrar"],
      ])
    );
    await this.pausar();
  }

  async #removerCliente() {
    const cliente = await this.#localizarCliente();
    if (!cliente) return;

    const noPatio = cliente.listaDePlacas.some((placa) => this.#registro.buscarTicketAtivo(placa));
    if (noPatio) {
      throw new Error("O cliente possui veículo no pátio. Registre a saída antes de remover o cadastro.");
    }

    this.escrever(`  Cliente: ${cliente.nome} (${cliente.tipo}) — placas: ${cliente.listaDePlacas.join(", ") || "(nenhuma)"}`);
    this.escrever("  Os registros de estacionamento já existentes serão mantidos no histórico.");
    if (!(await this.confirmar("  Confirmar a remoção do cadastro?"))) {
      return this.escrever("  Operação cancelada.");
    }

    this.#cadastroClientes.removerCliente(cliente.cpfCnpj);
    this.salvarAutomatico();
    this.escrever("\n  Cliente removido do cadastro.");
    await this.pausar();
  }

  // ==================================================================
  // 2 e 3. Entrada e saída
  // ==================================================================

  async #registrarEntrada() {
    this.escrever(F.titulo("Registrar entrada de veículo"));
    const placa = await this.perguntarObrigatorio("  Placa do veículo: ");

    if (!InterfaceUsuario.placaValida(placa)) {
      throw new Error(`Placa inválida: "${placa}". Use o formato ABC1234 ou ABC1D23.`);
    }

    const verificacao = this.#registro.verificarEntrada(placa);
    if (!verificacao.permitido) {
      this.escrever(`\n  ENTRADA NEGADA — ${verificacao.motivo}`);
      await this.pausar();
      return;
    }

    if (!verificacao.cliente) {
      this.escrever("\n  Placa não cadastrada: será registrada como cliente avulso.");
      this.escrever("  Tarifa avulsa: R$ 8,00 por hora até 6 horas; acima disso, diária de R$ 45,00.");
      if (!(await this.confirmar("  Confirmar a entrada?"))) {
        return this.escrever("  Entrada cancelada.");
      }
    }

    const ticket = this.#registro.autorizarEntrada(placa);
    this.salvarAutomatico();

    this.escrever(F.subtitulo("Entrada registrada"));
    this.escrever(
      F.ficha([
        ["Ticket", ticket.id],
        ["Placa", ticket.placa],
        ["Cliente", verificacao.cliente ? verificacao.cliente.nome : "Cliente não cadastrado"],
        ["Tipo", ticket.tipoCliente],
        ["Regra de cobrança", verificacao.cliente
          ? verificacao.cliente.descricaoRegra()
          : "R$ 8,00/hora até 6h; acima disso, diária de R$ 45,00"],
        ["Entrada", F.dataHora(ticket.dataHoraEntrada)],
      ])
    );
    await this.pausar();
  }

  async #registrarSaida() {
    this.escrever(F.titulo("Registrar saída de veículo"));

    const noPatio = this.#registro.ticketsAtivos;
    if (noPatio.length === 0) {
      this.escrever("  Não há veículos no pátio neste momento.");
      await this.pausar();
      return;
    }

    this.escrever(`  Veículos no pátio: ${noPatio.map((t) => t.placa).join(", ")}`);
    const placa = await this.perguntarObrigatorio("  Placa do veículo: ");

    const ticket = this.#registro.buscarTicketAtivo(placa);
    if (!ticket) {
      this.escrever(`\n  ! Nenhum veículo com a placa ${placa.toUpperCase()} está estacionado.`);
      await this.pausar();
      return;
    }

    const cliente = this.#cadastroClientes.buscarPorPlaca(ticket.placa);

    // Regra da Fase 1: o cliente avulso pode se recusar a pagar. Ele sai,
    // mas a placa fica bloqueada para sempre.
    let recusouPagar = false;
    if (!cliente) {
      const previsto = this.#registro.simularCusto(ticket);
      this.escrever(`\n  Valor a cobrar do cliente avulso: ${F.moeda(previsto)}`);
      recusouPagar = !(await this.confirmar("  O cliente pagou?"));
      if (recusouPagar) {
        this.escrever("  ! O veículo vai sair, mas a placa será bloqueada permanentemente.");
      }
    }

    const fechado = this.#registro.processarSaida(ticket.placa, new Date(), {
      clienteAvulsoRecusouPagar: recusouPagar,
    });
    this.salvarAutomatico();

    const linhas = [
      ["Ticket", fechado.id],
      ["Placa", fechado.placa],
      ["Cliente", cliente ? cliente.nome : "Cliente não cadastrado"],
      ["Tipo", fechado.tipoCliente],
      ["Entrada", F.dataHora(fechado.dataHoraEntrada)],
      ["Saída", F.dataHora(fechado.dataHoraSaida)],
      ["Custo", F.moeda(fechado.custo)],
    ];

    if (fechado.valorDesconto > 0) {
      linhas.push(["Desconto", `${fechado.descontoAplicado} (-${F.moeda(fechado.valorDesconto)})`]);
    }
    linhas.push(["Valor devido", F.moeda(fechado.valorDevido)]);
    linhas.push(["Valor pago", F.moeda(fechado.valorPago)]);

    if (cliente instanceof Estudante) {
      linhas.push(["Créditos restantes", F.moeda(cliente.creditos)]);
    }
    if (cliente instanceof Empresa) {
      linhas.push(["Saldo devedor da empresa", F.moeda(cliente.saldoDevedor)]);
    }

    this.escrever(F.subtitulo("Saída registrada"));
    this.escrever(F.ficha(linhas));

    if (cliente instanceof Estudante && cliente.estaBloqueado()) {
      this.escrever("\n  ! Créditos negativos: o estudante está impedido de entrar até recarregar.");
    }
    if (cliente instanceof Empresa && cliente.estaBloqueado()) {
      this.escrever("\n  ! Empresa com saldo devedor: fica impedida até o pagamento do boleto.");
    }
    if (recusouPagar) {
      this.escrever(`\n  ! Placa ${fechado.placa} adicionada à lista de bloqueio.`);
    }
    await this.pausar();
  }

  // ==================================================================
  // 4. Pátio
  // ==================================================================

  async #mostrarPatio() {
    const tickets = this.#registro.ticketsAtivos;
    this.escrever(F.titulo(`Veículos no pátio (${tickets.length})`));

    const agora = new Date();
    this.escrever(
      F.tabela(
        [
          { titulo: "Ticket", campo: "id" },
          { titulo: "Placa", campo: "placa" },
          { titulo: "Cliente", campo: "cliente" },
          { titulo: "Tipo", campo: "tipo" },
          { titulo: "Entrada", campo: "entrada" },
          { titulo: "Previsto agora", campo: "previsto", alinhamento: "direita" },
        ],
        tickets.map((ticket) => {
          const cliente = this.#cadastroClientes.buscarPorPlaca(ticket.placa);
          return {
            id: ticket.id,
            placa: ticket.placa,
            cliente: cliente ? cliente.nome : "Cliente não cadastrado",
            tipo: ticket.tipoCliente,
            entrada: F.dataHora(ticket.dataHoraEntrada),
            previsto: F.moeda(this.#registro.simularCusto(ticket, agora)),
          };
        })
      )
    );
    await this.pausar();
  }

  // ==================================================================
  // 5. Lista de bloqueio
  // ==================================================================

  async #menuBloqueios() {
    let voltar = false;
    while (!voltar) {
      this.escrever(F.titulo("Lista de bloqueio"));
      this.escrever(`  Itens na lista: ${this.#registro.clientesImpedidos.length}`);
      this.escrever(F.linha("-"));
      this.escrever("  1 - Bloquear uma placa ou documento");
      this.escrever("  2 - Retirar da lista de bloqueio");
      this.escrever("  3 - Ver relação de impedidos");
      this.escrever("  0 - Voltar");
      this.escrever(F.linha("-"));

      const opcao = await this.perguntar("  Escolha uma opção: ");
      try {
        switch (opcao) {
          case "1": {
            const alvo = await this.perguntarObrigatorio("  Placa ou documento: ");
            const motivo = await this.perguntar('  Motivo (ENTER para "Bloqueio manual"): ');
            const bloqueado = this.#registro.bloquear(alvo, motivo || "Bloqueio manual");
            this.salvarAutomatico();
            this.escrever(`\n  ${bloqueado} adicionado à lista de bloqueio.`);
            await this.pausar();
            break;
          }
          case "2": {
            const alvo = await this.perguntarObrigatorio("  Placa ou documento: ");
            const liberado = this.#registro.desbloquear(alvo);
            this.salvarAutomatico();
            this.escrever(`\n  ${liberado} retirado da lista de bloqueio.`);
            this.escrever("  Obs.: estudante com crédito negativo e empresa com saldo devedor");
            this.escrever("  continuam impedidos pela regra do próprio tipo de cliente.");
            await this.pausar();
            break;
          }
          case "3":
            this.#exibirClientesImpedidos(this.#relatorios.clientesImpedidos());
            await this.pausar();
            break;
          case "0": voltar = true; break;
          default: this.escrever("  ! Opção inválida.");
        }
      } catch (erro) {
        this.escrever(`\n  ! ${erro.message}`);
        await this.pausar();
      }
    }
  }

  // ==================================================================
  // 6. Relatórios gerenciais
  // ==================================================================

  async #menuRelatorios() {
    let voltar = false;
    while (!voltar) {
      this.escrever(F.titulo("Relatórios gerenciais"));
      this.escrever("  1 - Valor total arrecadado por período e/ou categoria");
      this.escrever("  2 - Situação de um cliente cadastrado");
      this.escrever("  3 - Registros de cliente CADASTRADO por período");
      this.escrever("  4 - Registros de cliente NÃO CADASTRADO por período");
      this.escrever("  5 - Clientes impedidos de entrar no estacionamento");
      this.escrever("  6 - 10 clientes mais frequentes do ano");
      this.escrever("  0 - Voltar");
      this.escrever(F.linha("-"));

      const opcao = await this.perguntar("  Escolha uma opção: ");
      try {
        switch (opcao) {
          case "1": await this.#relatorioArrecadacao(); break;
          case "2": await this.#relatorioSituacaoCliente(); break;
          case "3": await this.#relatorioCadastradoPorPeriodo(); break;
          case "4": await this.#relatorioNaoCadastradoPorPeriodo(); break;
          case "5":
            this.#exibirClientesImpedidos(this.#relatorios.clientesImpedidos());
            await this.pausar();
            break;
          case "6": await this.#relatorioMaisFrequentes(); break;
          case "0": voltar = true; break;
          default: this.escrever("  ! Opção inválida.");
        }
      } catch (erro) {
        this.escrever(`\n  ! ${erro.message}`);
        await this.pausar();
      }
    }
  }

  async #relatorioArrecadacao() {
    this.escrever(F.titulo("Relatório 1 — Valor arrecadado"));
    const periodo = await this.perguntarPeriodo();

    this.escrever("\n  Categoria: 1-Estudante  2-Professor  3-Empresa  4-Avulso  ENTER-Todas");
    const mapa = { ...TIPOS, 4: "Avulso" };
    const escolha = await this.perguntar("  Categoria: ");
    const categoria = escolha ? mapa[escolha] || escolha : null;

    const dados = this.#relatorios.resumoArrecadacao({ ...periodo, categoria });

    this.escrever(F.subtitulo("Resumo"));
    this.escrever(
      F.ficha([
        ["Período", this.descricaoPeriodo(dados.periodo)],
        ["Categoria", dados.categoria],
        ["Registros fechados", String(dados.quantidade)],
        ["Custo bruto", F.moeda(dados.custo)],
        ["Descontos concedidos", F.moeda(dados.desconto)],
        ["TOTAL ARRECADADO", F.moeda(dados.pago)],
        ["Não pago (avulso inadimplente)", F.moeda(dados.emAberto)],
      ])
    );

    this.escrever(F.subtitulo("Por categoria de cliente"));
    this.escrever(
      F.tabela(
        [
          { titulo: "Categoria", campo: "categoria" },
          { titulo: "Registros", campo: "quantidade", alinhamento: "direita" },
          { titulo: "Custo", campo: "custoTexto", alinhamento: "direita" },
          { titulo: "Desconto", campo: "descontoTexto", alinhamento: "direita" },
          { titulo: "Arrecadado", campo: "pagoTexto", alinhamento: "direita" },
        ],
        dados.porCategoria.map((item) => ({
          ...item,
          custoTexto: F.moeda(item.custo),
          descontoTexto: F.moeda(item.desconto),
          pagoTexto: F.moeda(item.pago),
        }))
      )
    );

    this.escrever(F.subtitulo("Por desconto aplicado"));
    this.escrever(
      F.tabela(
        [
          { titulo: "Desconto", campo: "desconto" },
          { titulo: "Registros", campo: "quantidade", alinhamento: "direita" },
          { titulo: "Valor concedido", campo: "valorTexto", alinhamento: "direita" },
        ],
        dados.porDesconto.map((item) => ({ ...item, valorTexto: F.moeda(item.valor) }))
      )
    );

    if (dados.registros.length && (await this.confirmar("\n  Ver a lista detalhada dos registros?"))) {
      this.#exibirTabelaRegistros(dados.registros);
    }
    await this.pausar();
  }

  async #relatorioSituacaoCliente() {
    this.escrever(F.titulo("Relatório 2 — Situação de cliente cadastrado"));
    const cliente = await this.#localizarCliente();
    if (!cliente) return;
    this.#exibirSituacaoCliente(this.#relatorios.situacaoCliente(cliente.cpfCnpj));
    await this.pausar();
  }

  #exibirSituacaoCliente(dados) {
    if (!dados) return this.escrever("  ! Cliente não encontrado.");

    this.escrever(F.subtitulo(`Ficha de ${dados.nome}`));
    const linhas = [
      ["Documento", dados.cpfCnpj],
      ["Nome", dados.nome],
      ["Tipo", dados.tipo],
      ["Regra de cobrança", dados.regra],
      ["Placas", dados.placas.join(", ") || "(nenhuma)"],
      ["Limite de placas", dados.limitePlacas === Infinity ? "ilimitado" : String(dados.limitePlacas)],
    ];

    if (dados.creditos !== null) linhas.push(["Créditos", F.moeda(dados.creditos)]);
    if (dados.saldoDevedor !== null) linhas.push(["Saldo devedor", F.moeda(dados.saldoDevedor)]);

    linhas.push(["Pode entrar", F.simNao(!dados.bloqueado)]);
    if (dados.bloqueado) linhas.push(["Motivo do impedimento", dados.motivoBloqueio]);
    linhas.push(["Veículos no pátio agora", String(dados.veiculosNoPatio)]);
    linhas.push(["Total de registros", String(dados.totalRegistros)]);
    linhas.push(["Custo acumulado", F.moeda(dados.totalCusto)]);
    linhas.push(["Descontos recebidos", F.moeda(dados.totalDesconto)]);
    linhas.push(["Total pago", F.moeda(dados.totalPago)]);
    linhas.push(["Primeiro acesso", dados.primeiroAcesso ? F.dataHora(dados.primeiroAcesso) : "-"]);
    linhas.push(["Último acesso", dados.ultimoAcesso ? F.dataHora(dados.ultimoAcesso) : "-"]);

    this.escrever(F.ficha(linhas));

    if (dados.ticketsAbertos.length) {
      this.escrever(F.subtitulo("Veículos no pátio agora"));
      this.#exibirTabelaRegistros(dados.ticketsAbertos);
    }
  }

  async #relatorioCadastradoPorPeriodo() {
    this.escrever(F.titulo("Relatório 3 — Registros de cliente cadastrado"));
    const cliente = await this.#localizarCliente();
    if (!cliente) return;

    const periodo = await this.perguntarPeriodo();
    const dados = this.#relatorios.registrosPorCliente(cliente.cpfCnpj, periodo.inicio, periodo.fim);

    this.escrever(
      F.subtitulo(`${dados.cliente.nome} (${dados.cliente.tipo}) — ${this.descricaoPeriodo(dados.periodo)}`)
    );
    this.#exibirTabelaRegistros(dados.registros);
    this.escrever("");
    this.escrever(
      F.ficha([
        ["Registros no período", String(dados.registros.length)],
        ["Custo acumulado", F.moeda(dados.totais.custo)],
        ["Descontos", F.moeda(dados.totais.desconto)],
        ["Total pago", F.moeda(dados.totais.pago)],
      ])
    );
    await this.pausar();
  }

  async #relatorioNaoCadastradoPorPeriodo() {
    this.escrever(F.titulo("Relatório 4 — Registros de cliente NÃO cadastrado"));
    const periodo = await this.perguntarPeriodo();
    const dados = this.#relatorios.registrosDeNaoCadastrados(periodo.inicio, periodo.fim);

    this.escrever(F.subtitulo(`Veículos avulsos — ${this.descricaoPeriodo(dados.periodo)}`));
    this.#exibirTabelaRegistros(dados.registros);

    if (dados.porPlaca.length) {
      this.escrever(F.subtitulo("Resumo por placa"));
      this.escrever(
        F.tabela(
          [
            { titulo: "Placa", campo: "placa" },
            { titulo: "Entradas", campo: "quantidade", alinhamento: "direita" },
            { titulo: "Desconto", campo: "descontoTexto", alinhamento: "direita" },
            { titulo: "Pago", campo: "pagoTexto", alinhamento: "direita" },
          ],
          dados.porPlaca.map((item) => ({
            ...item,
            descontoTexto: F.moeda(item.desconto),
            pagoTexto: F.moeda(item.pago),
          }))
        )
      );
    }

    this.escrever("");
    this.escrever(
      F.ficha([
        ["Registros no período", String(dados.registros.length)],
        ["Custo bruto", F.moeda(dados.totais.custo)],
        ["Descontos concedidos", F.moeda(dados.totais.desconto)],
        ["Total arrecadado", F.moeda(dados.totais.pago)],
        ["Não pago", F.moeda(dados.totais.emAberto)],
      ])
    );
    await this.pausar();
  }

  #exibirClientesImpedidos(dados) {
    this.escrever(F.titulo("Relatório 5 — Impedidos de entrar no estacionamento"));
    this.escrever(
      F.tabela(
        [
          { titulo: "Placa/Documento", campo: "identificador" },
          { titulo: "Cliente", campo: "nome" },
          { titulo: "Tipo", campo: "tipo" },
          { titulo: "Motivo", campo: "motivo" },
          { titulo: "Origem", campo: "origem" },
        ],
        dados.lista
      )
    );
    this.escrever("");
    this.escrever(
      F.ficha([
        ["Total de impedidos", String(dados.total)],
        ["Clientes cadastrados", String(dados.totalCadastrados)],
        ["Placas avulsas", String(dados.totalAvulsos)],
      ])
    );
  }

  async #relatorioMaisFrequentes() {
    this.escrever(F.titulo("Relatório 6 — 10 clientes mais frequentes do ano"));
    const anoAtual = new Date().getFullYear();
    const ano = await this.perguntarNumero(`  Ano (ENTER para ${anoAtual}): `, {
      permitirVazio: true,
      padrao: anoAtual,
    });

    const dados = this.#relatorios.clientesMaisFrequentes(ano);

    this.escrever(F.subtitulo(`Ano ${dados.ano} — ${dados.totalClientesNoAno} cliente(s) com registros`));
    this.escrever(
      F.tabela(
        [
          { titulo: "#", campo: "posicao", alinhamento: "direita" },
          { titulo: "Cliente", campo: "nome" },
          { titulo: "Documento", campo: "cpfCnpj" },
          { titulo: "Tipo", campo: "tipo" },
          { titulo: "Entradas", campo: "quantidade", alinhamento: "direita" },
          { titulo: "Total pago", campo: "pagoTexto", alinhamento: "direita" },
          { titulo: "Último acesso", campo: "ultimoTexto" },
        ],
        dados.lista.map((item) => ({
          ...item,
          pagoTexto: F.moeda(item.pago),
          ultimoTexto: F.dataCurta(item.ultimoAcesso),
        }))
      )
    );
    await this.pausar();
  }

  // ==================================================================
  // Tabela padrão de registros de estacionamento
  // ==================================================================

  #exibirTabelaRegistros(tickets) {
    this.escrever(
      F.tabela(
        [
          { titulo: "Ticket", campo: "id" },
          { titulo: "Placa", campo: "placa" },
          { titulo: "Tipo", campo: "tipo" },
          { titulo: "Entrada", campo: "entrada" },
          { titulo: "Saída", campo: "saida" },
          { titulo: "Custo", campo: "custo", alinhamento: "direita" },
          { titulo: "Desconto", campo: "desconto" },
          { titulo: "Pago", campo: "pago", alinhamento: "direita" },
        ],
        tickets.map((ticket) => ({
          id: ticket.id,
          placa: ticket.placa,
          tipo: ticket.tipoCliente,
          entrada: F.dataHora(ticket.dataHoraEntrada),
          saida: ticket.estaAberto ? "(no pátio)" : F.dataHora(ticket.dataHoraSaida),
          custo: ticket.estaAberto ? "-" : F.moeda(ticket.custo),
          desconto: ticket.valorDesconto > 0 ? ticket.descontoAplicado : "-",
          pago: ticket.estaAberto ? "-" : F.moeda(ticket.valorPago),
        }))
      )
    );
  }
}
