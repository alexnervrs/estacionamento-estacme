# EstACME — Sistema de Controle de Estacionamento

![Tests](https://github.com/alexnervrs/estacionamento-estacme/actions/workflows/tests.yml/badge.svg)

Sistema de estacionamento em terminal, feito em **JavaScript (Node.js)** na disciplina de Programação Orientada a Objetos (PUCRS).

- **4 tipos de cliente** (Estudante, Professor, Empresa e avulso), cada um com sua cobrança, usando herança e polimorfismo
- **Persistência em arquivos CSV** e **6 relatórios gerenciais**
- **Sem dependências externas**: só módulos nativos do Node
- **92 testes automatizados** (`npm test`), rodando em integração contínua

**Rodar em 10 segundos** (Node.js 16 ou superior): `npm start` abre o menu e `npm test` roda os testes. Detalhes completos [logo abaixo](#1-como-executar).

Autor: Alex Barroso Bezerra Lima

---

## Contexto

Projeto da disciplina de **Programação Orientada a Objetos**, desenvolvido em
**JavaScript** e executado com **Node.js**.

Esta é a continuação direta da Fase 1: as mesmas classes, os mesmos campos
privados (`#`) e **as mesmas regras de negócio**. A Fase 2 acrescenta a
persistência em arquivos CSV, a interface com o usuário e os relatórios
gerenciais.

---

## 1. Como executar

É necessário ter o Node.js instalado (versão 16 ou superior). Nenhuma
biblioteca externa é usada — apenas os módulos que já vêm com o Node
(`fs`, `path`, `url` e `readline`).

```bash
cd estacionamento
npm start
```

Também funciona sem o npm:

```bash
node main.js
```

Bateria de testes automáticos (não altera os arquivos da pasta `dados`):

```bash
npm test
```

> O `package.json` declara `"type": "module"` porque o projeto usa `import` /
> `export` (módulos ES), como na Fase 1.

---

## 2. Estrutura do projeto

```
estacionamento/
├── main.js                        # ponto de entrada (igual ao da Fase 1)
├── package.json
├── README.md
├── dados/                         # persistência em CSV (pasta criada na Fase 1)
│   ├── clientes.csv
│   ├── registros.csv
│   └── bloqueios.csv
└── src/
    ├── modelos/                   # classes de domínio (Fase 1)
    │   ├── Cliente.js             # classe ABSTRATA — herança e polimorfismo
    │   ├── Estudante.js
    │   ├── Professor.js
    │   ├── Empresa.js
    │   ├── Desconto.js            # Desconto + ClienteFrequente (Strategy)
    │   └── TicketEstacionamento.js
    ├── servicos/                  # regras do sistema (Fase 1 + Fase 2)
    │   ├── CadastroClientes.js    # + carregarDeCSV() / salvarEmCSV()
    │   ├── RegistroDeEntradasESaidas.js
    │   ├── RelatoriosGerenciais.js
    │   └── App.js                 # monta o sistema, carrega e salva os CSVs
    ├── interfaces/
    │   └── InterfaceUsuario.js    # FASE 2 — toda a interação com o usuário
    ├── utils/
    │   ├── csv.js                 # leitura e escrita de CSV
    │   ├── datas.js               # comparação e validação de datas
    │   └── formato.js             # moeda, datas e tabelas de texto
    └── testes.js                  # testes automáticos (npm test)
```

### O que mudou em relação à Fase 1

| Classe | Situação na Fase 2 |
|---|---|
| `Cliente`, `Estudante`, `Professor`, `Empresa` | regras **inalteradas**; ganharam apenas `paraLinhaCSV()`, `motivoBloqueio()` e `descricaoRegra()` |
| `Desconto` / `ClienteFrequente` | **inalterada** |
| `TicketEstacionamento` | ganhou o campo `id` e a conversão de/para linha de CSV |
| `CadastroClientes` | ganhou `carregarDeCSV()` e `salvarEmCSV()` (já previstos no diagrama) e um `Set` que impede a mesma placa em dois clientes |
| `RegistroDeEntradasESaidas` | cálculo **inalterado**; ganhou os motivos de bloqueio, o identificador dos tickets e a persistência |
| `RelatoriosGerenciais` | mesmas assinaturas do diagrama; ganhou os relatórios que faltavam e versões detalhadas para a tela |
| `App` | deixou de ser demonstração automática e passou a montar o sistema, carregar e salvar os CSVs |
| `InterfaceUsuario` | **nova** — é a "interface real" que o comentário da classe `App` da Fase 1 já anunciava |

O diagrama de classes entregue na Fase 1 (`docs/Diagrama_Classes_Estacionamento.pdf`) continua válido; a única classe nova é
`InterfaceUsuario`, que fica entre `App` e as classes de serviço.

---

## 3. Regras de negócio (as mesmas da Fase 1)

| Tipo | Placas | Cobrança | Pagamento | Fica impedido quando |
|---|---|---|---|---|
| **Estudante** | 1 | R$ 25,00 por ingresso; **o dobro** se passar da meia-noite | pré-pago, debitado dos créditos (pode ficar negativo — a saída é sempre liberada) | os créditos ficam negativos |
| **Professor** | até 2 | gratuito | não paga | nunca (mas só pode ter **1 veículo estacionado por vez**) |
| **Empresa** | ilimitadas | diária de R$ 70,00 **+ R$ 30,00 de multa** se passar da meia-noite | faturado: vira saldo devedor, quitado pelo boleto | tem qualquer saldo devedor em aberto |
| **Avulso** (não cadastrado) | — | R$ 8,00 por hora até 6 horas; acima disso ou virando o dia, diária de R$ 45,00 | na saída | se recusar a pagar — a placa fica bloqueada **para sempre** |

**Desconto ClienteFrequente:** o cliente avulso que usar o estacionamento
**3 vezes nos últimos 5 dias** recebe **20% de desconto**, quantas vezes for.

Os valores continuam onde estavam na Fase 1: constantes estáticas nas classes
(`Estudante.CUSTO_FIXO_POR_INGRESSO`, `Empresa.VALOR_DIARIA`,
`Empresa.MULTA_POR_DIA_ATRASADO`, `ClienteFrequente.PERCENTUAL`) e as tarifas do
avulso no topo de `RegistroDeEntradasESaidas.js`.

---

## 4. Menu do sistema

```
1 - Clientes
    1 - Cadastrar novo cliente
    2 - Consultar cliente (por documento, placa ou nome)
    3 - Listar todos os clientes
    4 - Adicionar placa a um cliente
    5 - Remover placa de um cliente
    6 - Recarregar créditos de estudante
    7 - Registrar pagamento de boleto de empresa
    8 - Remover cliente
2 - Registrar ENTRADA de veículo
3 - Registrar SAÍDA de veículo
4 - Veículos no pátio (com o valor previsto até agora)
5 - Lista de bloqueio (bloquear, liberar, ver relação)
6 - Relatórios gerenciais (os seis relatórios)
7 - Salvar dados nos arquivos CSV
0 - Sair (salva automaticamente)
```

Detalhes da interface:

- O sistema **respeita os limites do tipo** na hora de digitar: não deixa
  cadastrar 2 placas para um estudante nem 3 para um professor.
- Valida CPF (11 dígitos), CNPJ (14 dígitos), formato de placa
  (`ABC1234` e `ABC1D23`), valores numéricos e datas.
- Datas podem ser digitadas como `DD/MM/AAAA` ou `AAAA-MM-DD`; em branco
  significa "sem limite".
- Na saída de um veículo avulso o sistema **pergunta se o cliente pagou** —
  é assim que a regra do avulso inadimplente da Fase 1 aparece na prática.
- Valores no formato `R$ 1.234,56` e datas no formato brasileiro; resultados em
  tabelas alinhadas.
- Nenhum erro derruba o programa: a mensagem explica o que fazer e o menu volta.

---

## 5. Relatórios gerenciais

| Nº | Relatório | Filtros | O que mostra |
|---|---|---|---|
| 1 | Valor total arrecadado | período e/ou categoria | custo bruto, descontos concedidos, total arrecadado, valor não pago, quebra por categoria e por desconto, com opção de ver a lista de registros |
| 2 | Situação de um cliente cadastrado | cliente | dados, regra de cobrança, placas e limite, créditos ou saldo devedor, se está impedido e por quê, veículos no pátio, histórico e totais |
| 3 | Registros de cliente cadastrado por período | cliente + período | todos os registros do cliente no período, com totais |
| 4 | Registros de cliente não cadastrado por período | período | registros dos avulsos, com resumo por placa e descontos recebidos |
| 5 | Clientes impedidos de entrar | — | quem está na lista de bloqueio **e** quem está impedido pela regra do próprio tipo (estudante com crédito negativo, empresa com saldo devedor), com o motivo e a origem |
| 6 | 10 clientes mais frequentes do ano | ano | ranking por número de entradas, com total pago e último acesso |

Os métodos previstos no diagrama da Fase 1 continuam existindo com a mesma
assinatura (`totalArrecadadoPorPeriodo`, `situacaoCliente`, `registrosPorCliente`,
`clientesImpedidos`, `clientesMaisFrequentes`); as versões usadas pela tela
apenas devolvem o mesmo cálculo com mais detalhes.

---

## 6. Persistência em CSV

Os três arquivos ficam na pasta `dados` — a mesma pasta que já vinha vazia na
entrega da Fase 1. Na inicialização eles são lidos e os dados passam a viver em
memória (nos `Map`s e `Set`s). A gravação acontece de duas formas:

- **automaticamente** depois de cada operação que altera dados (cadastro,
  entrada, saída, bloqueio, recarga, pagamento) e ao encerrar — inclusive se o
  programa for interrompido com `Ctrl+C`;
- **manualmente**, pela opção 7 do menu principal.

Se um arquivo não existir, ele é criado com o cabeçalho correto. Linhas com
problema não derrubam o sistema: são ignoradas e listadas como aviso na tela
inicial, com o número da linha.

### `dados/clientes.csv`

```
cpfCnpj,nome,tipo,placas,creditos,saldoDevedor
12345678901,Joao Silva,Estudante,ABC1D23,25.00,
34567890123,Carlos Oliveira,Professor,JKL4G56|GHI3F45,,
56789012000145,Tecnopuc S.A.,Empresa,STU7J89|VWX8K90,,0.00
```

Várias placas do mesmo cliente são separadas por `|`. A coluna `creditos` só é
preenchida para Estudante e `saldoDevedor` só para Empresa.

### `dados/registros.csv`

```
id,placa,tipoCliente,dataHoraEntrada,dataHoraSaida,custo,descontoAplicado,valorDesconto,valorDevido,valorPago
T0024,XYZ9K99,Avulso,2026-04-10T12:00:00.000Z,2026-04-10T14:00:00.000Z,16.00,ClienteFrequente,3.20,12.80,12.80
```

As colunas são exatamente os atributos de `TicketEstacionamento` no diagrama de
classes, mais o `id`. Um ticket com `dataHoraSaida` vazia é um veículo que ainda
está no pátio. Datas em ISO 8601; exibidas no formato brasileiro.

### `dados/bloqueios.csv`

```
identificador,motivo
BBB1B11,Cliente avulso se recusou a pagar
```

Guarda a `listaBloqueio` (`Set<placa ou cpfCnpj>`) da Fase 1. Note que estudante
com crédito negativo e empresa com saldo devedor **não** precisam entrar nesse
arquivo: eles são impedidos pelo próprio método `estaBloqueado()`.

### Dados de exemplo entregues

6 clientes (2 estudantes, 2 professores, 2 empresas), 46 registros entre
nov/2025 e ago/2026 e 1 placa na lista de bloqueio. Foram gerados pelas próprias
classes do sistema, então todos os valores obedecem às regras. Incluem, de
propósito, casos que aparecem nos relatórios:

- estudante que virou o dia e pagou 2 ingressos (R$ 50,00);
- empresa que virou o dia e pagou diária + multa (R$ 100,00);
- avulso com 3 entradas em 5 dias recebendo o desconto ClienteFrequente;
- avulso que se recusou a pagar e ficou bloqueado;
- estudante com crédito negativo e empresa com boleto em aberto, ambos
  impedidos de entrar.

---

## 7. Estruturas de dados exigidas (`set` e `dictionary/map`)

| Onde | Estrutura | Para quê |
|---|---|---|
| `Cliente.#placas` | `Set` | placas do cliente, sem repetição (Fase 1) |
| `CadastroClientes.#todasAsPlacas` | `Set` | impede a mesma placa em dois clientes diferentes |
| `CadastroClientes.#clientesPorId` | `Map` | cpfCnpj → Cliente |
| `CadastroClientes.#clientesPorPlaca` | `Map` | placa → Cliente (usado na entrada) |
| `RegistroDeEntradasESaidas.#listaBloqueio` | `Set` | placas/documentos impedidos de entrar |
| `RegistroDeEntradasESaidas.#placasEstacionadas` | `Set` | impede duas entradas para a mesma placa |
| `RegistroDeEntradasESaidas.#ticketsAtivos` | `Map` | placa → ticket em aberto |
| `RegistroDeEntradasESaidas.#motivosBloqueio` | `Map` | identificador → motivo do bloqueio |
| `RegistroDeEntradasESaidas.#entradasAvulsoPorPlaca` | `Map` | placa → datas de entrada (desconto ClienteFrequente) |
| `RelatoriosGerenciais` | `Map` | acumuladores por categoria, desconto, placa e cliente |

Graças a essas estruturas, achar o dono de uma placa na entrada e montar os
relatórios não exige percorrer listas inteiras.

---

## 8. Onde cada item do enunciado foi atendido

| Item do enunciado (Fase 2) | Onde está |
|---|---|
| a) Leitura dos CSVs na inicialização | `App.carregarTudo()`, que chama `CadastroClientes.carregarDeCSV()` e `RegistroDeEntradasESaidas.carregarDeCSV()` |
| a) Dados em memória durante a execução | `Map`s e `Set`s de `CadastroClientes` e `RegistroDeEntradasESaidas` |
| a) Salvamento automático e manual | `InterfaceUsuario.salvarAutomatico()` e opção 7 do menu |
| a) Uso correto do formato | `src/utils/csv.js` + `Cliente.COLUNAS_CSV` e `TicketEstacionamento.COLUNAS_CSV` |
| b) Interface em classe separada | `src/interfaces/InterfaceUsuario.js` |
| b) Cadastro de clientes | menu 1 → opção 1 |
| b) Entrada e saída de veículos | menu 2 e menu 3 |
| b) Consultas e relatórios | menu 1 → opção 2, menu 4, menu 5 e menu 6 |
| c) Os seis relatórios gerenciais | `src/servicos/RelatoriosGerenciais.js` + menu 6 |
| d) `set` para placas e bloqueios | `Cliente.#placas`, `CadastroClientes.#todasAsPlacas`, `RegistroDeEntradasESaidas.#listaBloqueio`, `#placasEstacionadas` |
| d) `dictionary/map` para associações | tabela da seção 7 |

---

## 9. Testes automáticos

`npm test` executa 92 verificações sobre uma cópia temporária dos CSVs. Além dos
relatórios e da persistência, os testes conferem **as tarifas exatas da Fase 1**:
R$ 25,00 e R$ 50,00 do estudante, gratuidade do professor, R$ 70,00 e R$ 100,00
da empresa, R$ 8,00/hora e diária de R$ 45,00 do avulso, os limites de 1 e 2
placas, o professor com 1 veículo por vez, o bloqueio por crédito negativo e por
saldo devedor, o avulso que não paga e os 20% do desconto ClienteFrequente.

Saída esperada ao final:

```
  Testes aprovados: 92
  Testes reprovados: 0
  Todos os testes passaram.
```
