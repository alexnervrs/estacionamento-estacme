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
