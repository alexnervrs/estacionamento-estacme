/**
 * Testes automáticos do sistema (execute com: npm test).
 *
 * Conferem, sem precisar navegar pelos menus, que:
 *   - os arquivos CSV são lidos corretamente na inicialização;
 *   - as tarifas e os limites de cada tipo de cliente da Fase 1 continuam valendo;
 *   - os bloqueios impedem a entrada;
 *   - o desconto ClienteFrequente é aplicado na hora certa;
 *   - os seis relatórios gerenciais devolvem resultados coerentes;
 *   - o que é gravado no CSV volta igual quando é lido de novo.
 *
 * Os testes trabalham sobre uma CÓPIA dos CSVs em uma pasta temporária,
 * portanto os arquivos da pasta /dados não são alterados.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { App } from "./servicos/App.js";
import { CadastroClientes } from "./servicos/CadastroClientes.js";
import { Estudante } from "./modelos/Estudante.js";
import { Professor } from "./modelos/Professor.js";
import { Empresa } from "./modelos/Empresa.js";
import { Cliente } from "./modelos/Cliente.js";
import { ClienteFrequente } from "./modelos/Desconto.js";

const PASTA_ORIGEM = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dados");

let aprovados = 0;
let reprovados = 0;

function verificar(descricao, condicao, detalhe = "") {
  if (condicao) {
    aprovados++;
    console.log(`  [ OK ] ${descricao}`);
  } else {
    reprovados++;
    console.log(`  [FALHA] ${descricao}${detalhe ? " -> " + detalhe : ""}`);
  }
}

function secao(titulo) {
  console.log("\n" + "=".repeat(72));
  console.log("  " + titulo);
  console.log("=".repeat(72));
}

/** Copia os CSVs de /dados para uma pasta temporária e monta o sistema. */
function montarSistema() {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), "estacme-teste-"));
  for (const arquivo of ["clientes.csv", "registros.csv", "bloqueios.csv"]) {
    const origem = path.join(PASTA_ORIGEM, arquivo);
    if (fs.existsSync(origem)) fs.copyFileSync(origem, path.join(destino, arquivo));
  }

  const app = new App(destino);
  const resumo = app.carregarTudo();
  return { app, resumo, pasta: destino };
}

const { app, resumo, pasta } = montarSistema();
const cadastro = app.cadastroClientes;
const registro = app.registro;
const relatorios = app.relatorios;

const em = (ano, mes, dia, hora, minuto = 0) => new Date(ano, mes - 1, dia, hora, minuto, 0);

// ====================================================================
secao("1. Leitura dos arquivos CSV na inicialização");
// ====================================================================
verificar("Clientes foram carregados do CSV", resumo.clientes > 0, `carregados: ${resumo.clientes}`);
verificar("Registros foram carregados do CSV", resumo.registros > 0, `carregados: ${resumo.registros}`);
verificar("Lista de bloqueio foi carregada do CSV", resumo.bloqueios > 0, `carregados: ${resumo.bloqueios}`);
verificar("Nenhuma linha inválida encontrada", resumo.avisos.length === 0, resumo.avisos.join(" | "));
verificar(
  "Existe cliente de cada tipo",
  ["Estudante", "Professor", "Empresa"].every((tipo) => cadastro.listarPorTipo(tipo).length > 0)
);
verificar(
  "Créditos e saldo devedor voltaram do CSV",
  cadastro.listarPorTipo("Estudante").some((c) => c.creditos !== 0) &&
  cadastro.listarPorTipo("Empresa").some((c) => c.saldoDevedor > 0)
);

// ====================================================================
secao("2. Estruturas de dados (Set e Map) e encapsulamento");
// ====================================================================
verificar("Cliente guarda as placas em um Set", cadastro.todosClientes[0].placas instanceof Set);
verificar("Cadastro expõe o Set de todas as placas", cadastro.todasAsPlacas instanceof Set);
verificar("Registro expõe a lista de bloqueio", Array.isArray(registro.clientesImpedidos));

verificar(
  "Cliente é abstrata e não pode ser instanciada",
  (() => {
    try {
      new Cliente("123", "Teste");
      return false;
    } catch {
      return true;
    }
  })()
);

verificar(
  "O Set de placas do cliente é uma cópia (encapsulamento preservado)",
  (() => {
    const cliente = cadastro.todosClientes[0];
    const copia = cliente.placas;
    copia.add("HACK1A11");
    return !cliente.possuiPlaca("HACK1A11");
  })()
);

verificar(
  "Set impede cadastrar a mesma placa para dois clientes",
  (() => {
    const placaExistente = cadastro.todosClientes[0].listaDePlacas[0];
    try {
      cadastro.cadastrarCliente(
        CadastroClientes.criarPorTipo({
          tipo: "Professor",
          cpfCnpj: "99999999999",
          nome: "Teste Placa Duplicada",
          placas: [placaExistente],
        })
      );
      return false;
    } catch (erro) {
      return /já está cadastrada/.test(erro.message);
    }
  })()
);

// ====================================================================
secao("3. Tarifas e limites definidos na Fase 1");
// ====================================================================
const estudanteTeste = new Estudante("11122233344", "Estudante Teste", 100);
const professorTeste = new Professor("22233344455", "Professor Teste");
const empresaTeste = new Empresa("33344455000166", "Empresa Teste", 0);

const entrada = em(2026, 9, 1, 8);
const saidaMesmoDia = em(2026, 9, 1, 12);
const saidaOutroDia = em(2026, 9, 2, 9);

verificar(
  "Estudante paga R$ 25,00 por ingresso no mesmo dia",
  estudanteTeste.calcularCusto(entrada, saidaMesmoDia) === 25,
  String(estudanteTeste.calcularCusto(entrada, saidaMesmoDia))
);
verificar(
  "Estudante paga o dobro quando passa da meia-noite",
  estudanteTeste.calcularCusto(entrada, saidaOutroDia) === 50
);
verificar("Professor não paga nada", professorTeste.calcularCusto(entrada, saidaOutroDia) === 0);
verificar(
  "Empresa paga diária de R$ 70,00",
  empresaTeste.calcularCusto(entrada, saidaMesmoDia) === 70
);
verificar(
  "Empresa paga R$ 100,00 com a multa por passar da meia-noite",
  empresaTeste.calcularCusto(entrada, saidaOutroDia) === 100
);

verificar("Limite de placas do Estudante é 1", estudanteTeste.limitePlacas() === 1);
verificar("Limite de placas do Professor é 2", professorTeste.limitePlacas() === 2);
verificar("Empresa não tem limite de placas", empresaTeste.limitePlacas() === Infinity);

estudanteTeste.adicionarPlaca("EST1A11");
verificar(
  "Estudante não consegue cadastrar uma segunda placa",
  (() => {
    try {
      estudanteTeste.adicionarPlaca("EST2A22");
      return false;
    } catch (erro) {
      return /limite/.test(erro.message);
    }
  })()
);

professorTeste.adicionarPlaca("PRO1A11");
professorTeste.adicionarPlaca("PRO2A22");
verificar(
  "Professor não consegue cadastrar uma terceira placa",
  (() => {
    try {
      professorTeste.adicionarPlaca("PRO3A33");
      return false;
    } catch {
      return true;
    }
  })()
);

cadastro.cadastrarCliente(estudanteTeste);
cadastro.cadastrarCliente(professorTeste);
cadastro.cadastrarCliente(empresaTeste);
empresaTeste.adicionarPlaca("EMP1A11");
cadastro.registrarPlacaNoIndice("EMP1A11", empresaTeste);

// ====================================================================
secao("4. Regras de entrada e saída");
// ====================================================================

// Estudante: debita dos créditos
const creditosAntes = estudanteTeste.creditos;
registro.autorizarEntrada("EST1A11", entrada);
const ticketEstudante = registro.processarSaida("EST1A11", saidaMesmoDia);
verificar("Saída do estudante cobra R$ 25,00", ticketEstudante.valorPago === 25);
verificar(
  "Valor é debitado dos créditos do estudante",
  estudanteTeste.creditos === creditosAntes - 25,
  String(estudanteTeste.creditos)
);

// Professor: 1 veículo por vez
registro.autorizarEntrada("PRO1A11", entrada);
verificar(
  "Professor não pode ter 2 veículos estacionados ao mesmo tempo",
  (() => {
    try {
      registro.autorizarEntrada("PRO2A22", entrada);
      return false;
    } catch (erro) {
      return /já possui um veículo estacionado/.test(erro.message);
    }
  })()
);
const ticketProfessor = registro.processarSaida("PRO1A11", saidaMesmoDia);
verificar("Saída do professor é gratuita", ticketProfessor.valorPago === 0);
verificar(
  "Depois da saída o professor pode entrar com o outro veículo",
  (() => {
    registro.autorizarEntrada("PRO2A22", saidaMesmoDia);
    registro.processarSaida("PRO2A22", em(2026, 9, 1, 16));
    return true;
  })()
);

// Empresa: acumula débito e fica inadimplente
registro.autorizarEntrada("EMP1A11", entrada);
registro.processarSaida("EMP1A11", saidaMesmoDia);
verificar("Empresa acumula o débito da diária", empresaTeste.saldoDevedor === 70);
verificar("Empresa com saldo devedor fica inadimplente", empresaTeste.estaInadimplente() === true);
verificar("Empresa inadimplente fica bloqueada", empresaTeste.estaBloqueado() === true);
verificar(
  "Empresa inadimplente é impedida de entrar",
  (() => {
    try {
      registro.autorizarEntrada("EMP1A11", em(2026, 9, 3, 8));
      return false;
    } catch (erro) {
      return /impedido/.test(erro.message);
    }
  })()
);
registro.registrarPagamentoEmpresa(empresaTeste, 70);
verificar("Pagamento do boleto zera o saldo devedor", empresaTeste.saldoDevedor === 0);
verificar("Empresa volta a poder entrar após pagar", empresaTeste.estaBloqueado() === false);

// Avulso: R$ 8/hora até 6 horas, diária acima disso
registro.autorizarEntrada("AVU1A11", em(2026, 9, 4, 8));
const ticketAvulso3h = registro.processarSaida("AVU1A11", em(2026, 9, 4, 11));
verificar("Avulso paga R$ 8,00 por hora (3h = R$ 24,00)", ticketAvulso3h.custo === 24,
  String(ticketAvulso3h.custo));

registro.autorizarEntrada("AVU2A22", em(2026, 9, 4, 8));
const ticketAvulso8h = registro.processarSaida("AVU2A22", em(2026, 9, 4, 16));
verificar("Avulso acima de 6 horas paga a diária de R$ 45,00", ticketAvulso8h.custo === 45);

registro.autorizarEntrada("AVU3A33", em(2026, 9, 4, 22));
const ticketAvulsoNoite = registro.processarSaida("AVU3A33", em(2026, 9, 5, 7));
verificar("Avulso que vira o dia paga a diária de R$ 45,00", ticketAvulsoNoite.custo === 45);

// Avulso que se recusa a pagar
registro.autorizarEntrada("AVU4A44", em(2026, 9, 6, 8));
const ticketCalote = registro.processarSaida("AVU4A44", em(2026, 9, 6, 10), {
  clienteAvulsoRecusouPagar: true,
});
verificar("Avulso que se recusa a pagar registra valor pago zero", ticketCalote.valorPago === 0);
verificar("Placa do avulso inadimplente vai para a lista de bloqueio",
  registro.estaNaListaDeBloqueio("AVU4A44"));
verificar(
  "Placa bloqueada não consegue entrar novamente",
  (() => {
    try {
      registro.autorizarEntrada("AVU4A44", em(2026, 9, 7, 8));
      return false;
    } catch (erro) {
      return /lista de bloqueio/.test(erro.message);
    }
  })()
);

// Entrada duplicada
registro.autorizarEntrada("AVU5A55", em(2026, 9, 8, 8));
verificar(
  "Não é possível registrar duas entradas para a mesma placa",
  (() => {
    try {
      registro.autorizarEntrada("AVU5A55", em(2026, 9, 8, 9));
      return false;
    } catch {
      return true;
    }
  })()
);
verificar("Veículo aparece no pátio enquanto não sai", registro.buscarTicketAtivo("AVU5A55") !== null);

// ====================================================================
secao("5. Desconto ClienteFrequente");
// ====================================================================
const desconto = new ClienteFrequente();
const referencia = em(2026, 10, 10, 12);
verificar("20% é o percentual do desconto", ClienteFrequente.PERCENTUAL === 0.2);
verificar(
  "Duas visitas em 5 dias NÃO dão desconto",
  desconto.aplicavel([em(2026, 10, 8, 9), em(2026, 10, 9, 9)], referencia) === false
);
verificar(
  "Três visitas em 5 dias dão desconto",
  desconto.aplicavel([em(2026, 10, 7, 9), em(2026, 10, 8, 9), em(2026, 10, 10, 9)], referencia) === true
);
verificar(
  "Visitas fora da janela de 5 dias não contam",
  desconto.aplicavel([em(2026, 9, 1, 9), em(2026, 9, 2, 9), em(2026, 9, 3, 9)], referencia) === false
);

// Aplicação real: 3 entradas do mesmo avulso em 5 dias
registro.autorizarEntrada("FRQ1A11", em(2026, 11, 2, 8));
registro.processarSaida("FRQ1A11", em(2026, 11, 2, 10));
registro.autorizarEntrada("FRQ1A11", em(2026, 11, 4, 8));
registro.processarSaida("FRQ1A11", em(2026, 11, 4, 10));
registro.autorizarEntrada("FRQ1A11", em(2026, 11, 6, 8));
const ticketFrequente = registro.processarSaida("FRQ1A11", em(2026, 11, 6, 10));
verificar(
  "Na 3a visita em 5 dias o avulso recebe 20% de desconto",
  ticketFrequente.descontoAplicado === "ClienteFrequente" && ticketFrequente.valorDesconto === 3.2,
  `desconto: ${ticketFrequente.valorDesconto}`
);
verificar(
  "Valor devido é o custo menos o desconto",
  ticketFrequente.valorDevido === ticketFrequente.custo - ticketFrequente.valorDesconto
);

// ====================================================================
secao("6. Relatórios gerenciais");
// ====================================================================
const inicio2026 = em(2026, 1, 1, 0);
const fim2026 = em(2026, 12, 31, 23, 59);

// 6.1
const r1 = relatorios.resumoArrecadacao({ inicio: inicio2026, fim: fim2026 });
verificar("R1: há registros no período", r1.quantidade > 0, `registros: ${r1.quantidade}`);
verificar("R1: custo = arrecadado + desconto + não pago",
  Math.abs(r1.custo - (r1.pago + r1.desconto + r1.emAberto)) < 0.01,
  `${r1.custo} vs ${r1.pago}+${r1.desconto}+${r1.emAberto}`);
verificar("R1: quebra por categoria foi montada", r1.porCategoria.length > 0);
verificar("R1: assinatura do diagrama devolve o total arrecadado",
  relatorios.totalArrecadadoPorPeriodo(inicio2026, fim2026) === r1.pago);

const r1Estudante = relatorios.resumoArrecadacao({
  inicio: inicio2026, fim: fim2026, categoria: "Estudante",
});
verificar("R1: filtro por categoria retorna só a categoria pedida",
  r1Estudante.registros.every((t) => t.tipoCliente === "Estudante"));
verificar("R1: total da categoria é menor que o total geral", r1Estudante.pago < r1.pago);

const r1Marco = relatorios.resumoArrecadacao({ inicio: em(2026, 3, 1, 0), fim: em(2026, 3, 31, 23, 59) });
verificar("R1: filtro por período reduz o resultado", r1Marco.quantidade < r1.quantidade,
  `março: ${r1Marco.quantidade} / ano: ${r1.quantidade}`);
verificar("R1: categoria inexistente é recusada",
  (() => {
    try {
      relatorios.resumoArrecadacao({ categoria: "Piloto" });
      return false;
    } catch {
      return true;
    }
  })());

// 6.2
const umEstudante = cadastro.listarPorTipo("Estudante")[0];
const r2 = relatorios.situacaoCliente(umEstudante.cpfCnpj);
verificar("R2: situação do cliente é retornada", r2 !== null);
verificar("R2: traz nome, tipo, placas e regra", !!r2.nome && !!r2.tipo && !!r2.regra && Array.isArray(r2.placas));
verificar("R2: traz os créditos do estudante", typeof r2.creditos === "number");
verificar("R2: cliente inexistente retorna null", relatorios.situacaoCliente("00000000000") === null);

const empresaInadimplente = cadastro.listarPorTipo("Empresa").find((e) => e.estaInadimplente());
if (empresaInadimplente) {
  const r2Empresa = relatorios.situacaoCliente(empresaInadimplente.cpfCnpj);
  verificar("R2: empresa inadimplente aparece como impedida", r2Empresa.bloqueado === true);
  verificar("R2: o motivo do impedimento é informado", r2Empresa.motivoBloqueio.length > 0);
}

// 6.3
const umProfessor = cadastro.listarPorTipo("Professor")[0];
const r3 = relatorios.registrosPorCliente(umProfessor.cpfCnpj, inicio2026, fim2026);
verificar("R3: registros do cliente cadastrado no período", r3 !== null && r3.registros.length > 0,
  `registros: ${r3 ? r3.registros.length : 0}`);
verificar("R3: todos os registros são das placas do cliente",
  r3.registros.every((t) => umProfessor.possuiPlaca(t.placa)));
verificar("R3: todos os registros estão dentro do período",
  r3.registros.every((t) => t.dataHoraEntrada.getFullYear() === 2026));
verificar("R3: período sem movimento retorna lista vazia",
  relatorios.registrosPorCliente(umProfessor.cpfCnpj, em(2020, 1, 1, 0), em(2020, 12, 31, 23)).registros.length === 0);
verificar("R3: cliente inexistente retorna null", relatorios.registrosPorCliente("00000000000") === null);

// 6.4
const r4 = relatorios.registrosDeNaoCadastrados(inicio2026, fim2026);
verificar("R4: registros de veículos avulsos no período", r4.registros.length > 0,
  `registros: ${r4.registros.length}`);
verificar("R4: nenhum registro pertence a cliente cadastrado",
  r4.registros.every((t) => t.tipoCliente === "Avulso"));
verificar("R4: resumo por placa foi montado", r4.porPlaca.length > 0);

// 6.5
const r5 = relatorios.clientesImpedidos();
verificar("R5: relação de impedidos é uma lista", Array.isArray(r5.lista));
verificar("R5: inclui quem está na lista de bloqueio",
  r5.lista.some((item) => item.origem === "Lista de bloqueio"));
verificar("R5: inclui quem está impedido pela regra do tipo (crédito/saldo devedor)",
  r5.lista.some((item) => item.origem === "Regra do tipo de cliente"));
registro.bloquear("TST1A23", "Teste de bloqueio");
verificar("R5: placa recém-bloqueada aparece na relação",
  relatorios.clientesImpedidos().lista.some((item) => item.identificador === "TST1A23"));
registro.desbloquear("TST1A23");
verificar("R5: placa desbloqueada sai da relação",
  !relatorios.clientesImpedidos().lista.some((item) => item.identificador === "TST1A23"));

// 6.6
const r6 = relatorios.clientesMaisFrequentes(2026);
verificar("R6: lista dos mais frequentes foi montada", r6.lista.length > 0, `clientes: ${r6.lista.length}`);
verificar("R6: no máximo 10 clientes", r6.lista.length <= 10);
verificar("R6: ordenado do mais para o menos frequente",
  r6.lista.every((item, i) => i === 0 || r6.lista[i - 1].quantidade >= item.quantidade));
verificar("R6: só considera clientes cadastrados",
  r6.lista.every((item) => cadastro.buscarPorCpfCnpj(item.cpfCnpj) !== null));
verificar("R6: o ano filtra o resultado",
  relatorios.clientesMaisFrequentes(2025).lista.length !== r6.lista.length ||
  relatorios.clientesMaisFrequentes(2025).lista[0].quantidade !== r6.lista[0].quantidade);
verificar("R6: ano inválido é recusado",
  (() => {
    try {
      relatorios.clientesMaisFrequentes("abc");
      return false;
    } catch {
      return true;
    }
  })());

// ====================================================================
secao("7. Gravação dos arquivos CSV (ida e volta)");
// ====================================================================
const gravado = app.salvarTudo();
verificar("Gravou os clientes no CSV", gravado.clientes === cadastro.totalClientes);
verificar("Gravou os registros no CSV", gravado.registros === registro.totalRegistros);

const app2 = new App(pasta);
const resumo2 = app2.carregarTudo();

verificar("Releitura traz a mesma quantidade de clientes", resumo2.clientes === cadastro.totalClientes,
  `${resumo2.clientes} vs ${cadastro.totalClientes}`);
verificar("Releitura traz a mesma quantidade de registros", resumo2.registros === registro.totalRegistros,
  `${resumo2.registros} vs ${registro.totalRegistros}`);
verificar("Releitura não gera avisos de linha inválida", resumo2.avisos.length === 0,
  resumo2.avisos.join(" | "));
verificar("Releitura mantém os veículos que estavam no pátio",
  app2.registro.totalNoPatio === registro.totalNoPatio,
  `${app2.registro.totalNoPatio} vs ${registro.totalNoPatio}`);
verificar("Releitura mantém a lista de bloqueio",
  app2.registro.clientesImpedidos.length === registro.clientesImpedidos.length);

const estudanteRelido = app2.cadastroClientes.buscarPorCpfCnpj(estudanteTeste.cpfCnpj);
verificar("Releitura preserva os créditos do estudante",
  estudanteRelido instanceof Estudante && estudanteRelido.creditos === estudanteTeste.creditos,
  `${estudanteRelido?.creditos} vs ${estudanteTeste.creditos}`);

const empresaRelida = app2.cadastroClientes.buscarPorCpfCnpj("67890123000156");
verificar("Releitura preserva o saldo devedor da empresa",
  empresaRelida instanceof Empresa && empresaRelida.saldoDevedor > 0,
  `saldo: ${empresaRelida?.saldoDevedor}`);

const professorRelido = app2.cadastroClientes.buscarPorCpfCnpj(umProfessor.cpfCnpj);
verificar("Releitura preserva as duas placas do professor",
  professorRelido.quantidadePlacas === umProfessor.quantidadePlacas);

const ticketRelido = app2.registro.historico.find((t) => t.descontoAplicado === "ClienteFrequente");
verificar("Releitura preserva o desconto aplicado no ticket",
  ticketRelido !== undefined && ticketRelido.valorDesconto > 0);

verificar("Relatório sobre os dados relidos dá o mesmo total arrecadado",
  app2.relatorios.totalArrecadadoPorPeriodo(inicio2026, fim2026) === r1.pago,
  `${app2.relatorios.totalArrecadadoPorPeriodo(inicio2026, fim2026)} vs ${r1.pago}`);

// ====================================================================
secao("Resultado final");
// ====================================================================
console.log(`  Testes aprovados: ${aprovados}`);
console.log(`  Testes reprovados: ${reprovados}`);
console.log("  Pasta temporária usada nos testes: " + pasta);
console.log("  (os arquivos da pasta /dados NÃO foram alterados)\n");

if (reprovados > 0) {
  console.log("  ATENÇÃO: existem testes reprovados.\n");
  process.exit(1);
}
console.log("  Todos os testes passaram.\n");
