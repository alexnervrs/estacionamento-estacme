/**
 * Leitura e escrita de arquivos CSV usando apenas o módulo fs do Node.js
 * (nenhuma biblioteca externa é necessária).
 *
 * O leitor trata campos entre aspas, aspas duplicadas dentro do campo,
 * quebras de linha do Windows (\r\n) e o BOM de arquivos salvos pelo Excel.
 */

import fs from "node:fs";
import path from "node:path";

/** Cria o arquivo com o cabeçalho informado caso ele ainda não exista. */
export function garantirArquivo(caminho, colunas) {
  if (!fs.existsSync(caminho)) {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.writeFileSync(caminho, colunas.join(",") + "\n", "utf8");
    return true;
  }
  return false;
}

export function lerLinhaCSV(linha) {
  const campos = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const caractere = linha[i];
    const proximo = linha[i + 1];

    if (caractere === '"' && dentroDeAspas && proximo === '"') {
      atual += '"';
      i++;
    } else if (caractere === '"') {
      dentroDeAspas = !dentroDeAspas;
    } else if (caractere === "," && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += caractere;
    }
  }

  campos.push(atual);
  return campos.map((campo) => campo.trim());
}

export function escaparCSV(valor) {
  const texto = valor === undefined || valor === null ? "" : String(valor);
  if (texto.includes(",") || texto.includes('"') || texto.includes("\n")) {
    return '"' + texto.replace(/"/g, '""') + '"';
  }
  return texto;
}

/**
 * Lê o arquivo e devolve um array de objetos, usando a primeira linha como
 * cabeçalho. Cada objeto recebe também "_linha" com o número da linha no
 * arquivo, para que mensagens de erro possam apontar onde está o problema.
 */
export function lerCSV(caminho) {
  if (!fs.existsSync(caminho)) return [];

  let conteudo = fs.readFileSync(caminho, "utf8");
  if (conteudo.charCodeAt(0) === 0xfeff) conteudo = conteudo.slice(1); // remove BOM
  conteudo = conteudo.trim();
  if (!conteudo) return [];

  const linhas = conteudo.split(/\r?\n/).filter((linha) => linha.trim() !== "");
  const cabecalho = lerLinhaCSV(linhas[0]);

  return linhas.slice(1).map((linha, indice) => {
    const valores = lerLinhaCSV(linha);
    const objeto = { _linha: indice + 2 };
    cabecalho.forEach((coluna, posicao) => {
      objeto[coluna] = valores[posicao] ?? "";
    });
    return objeto;
  });
}

/** Grava o array de objetos no arquivo, na ordem de colunas informada. */
export function gravarCSV(caminho, colunas, linhas) {
  const saida = [colunas.join(",")];
  for (const linha of linhas) {
    saida.push(colunas.map((coluna) => escaparCSV(linha[coluna])).join(","));
  }
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, saida.join("\n") + "\n", "utf8");
}
