/**
 * Formatação de texto para a interface: dinheiro, datas, títulos e tabelas.
 * Manter isso separado deixa a interface limpa e garante que todo relatório
 * apareça na tela com a mesma aparência.
 */

import { ehDataValida } from "./datas.js";

export const LARGURA_TELA = 78;

export function moeda(valor) {
  const numero = Number(valor || 0);
  const negativo = numero < 0;
  const texto = Math.abs(numero)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (negativo ? "-R$ " : "R$ ") + texto;
}

export function dataHora(valor) {
  if (!ehDataValida(valor)) return "-";
  const dia = String(valor.getDate()).padStart(2, "0");
  const mes = String(valor.getMonth() + 1).padStart(2, "0");
  const hora = String(valor.getHours()).padStart(2, "0");
  const minuto = String(valor.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${valor.getFullYear()} ${hora}:${minuto}`;
}

export function dataCurta(valor) {
  if (!ehDataValida(valor)) return "-";
  const dia = String(valor.getDate()).padStart(2, "0");
  const mes = String(valor.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${valor.getFullYear()}`;
}

export function simNao(valor) {
  return valor ? "Sim" : "Nao";
}

export function alinhar(texto, largura, alinhamento = "esquerda") {
  const conteudo = String(texto ?? "");
  const recortado =
    conteudo.length > largura ? conteudo.slice(0, largura - 1) + "." : conteudo;
  if (alinhamento === "direita") return recortado.padStart(largura, " ");
  return recortado.padEnd(largura, " ");
}

export function linha(caractere = "-", largura = LARGURA_TELA) {
  return caractere.repeat(largura);
}

/** Cabeçalho destacado de uma seção da tela. */
export function titulo(texto) {
  return ["", linha("="), "  " + texto.toUpperCase(), linha("=")].join("\n");
}

export function subtitulo(texto) {
  return ["", "  " + texto, linha("-")].join("\n");
}

/**
 * Monta uma tabela de texto.
 * colunas: [{ titulo, campo, alinhamento }]
 * linhas:  array de objetos
 */
export function tabela(colunas, linhas) {
  if (!linhas || linhas.length === 0) {
    return "  (nenhum registro encontrado)";
  }

  const definicoes = colunas.map((coluna) => {
    const largura = linhas.reduce(
      (maior, item) => Math.max(maior, String(item[coluna.campo] ?? "").length),
      coluna.titulo.length
    );
    return { ...coluna, largura };
  });

  const cabecalho =
    "  " +
    definicoes
      .map((coluna) => alinhar(coluna.titulo, coluna.largura, coluna.alinhamento))
      .join(" | ");

  const separador =
    "  " + definicoes.map((coluna) => "-".repeat(coluna.largura)).join("-+-");

  const corpo = linhas.map(
    (item) =>
      "  " +
      definicoes
        .map((coluna) => alinhar(item[coluna.campo], coluna.largura, coluna.alinhamento))
        .join(" | ")
  );

  return [cabecalho, separador, ...corpo].join("\n");
}

/** Lista de "Rótulo: valor" alinhada, usada em fichas de cliente e tickets. */
export function ficha(pares) {
  const larguraRotulo = pares.reduce((maior, [rotulo]) => Math.max(maior, rotulo.length), 0);
  return pares
    .map(([rotulo, valor]) => `  ${alinhar(rotulo + ":", larguraRotulo + 1)} ${valor}`)
    .join("\n");
}
