/**
 * Funções auxiliares de data.
 *
 * Os tickets guardam data e hora completas, mas os relatórios filtram por DIA
 * ("de 01/03/2026 até 31/03/2026"). Para não haver erro de fuso horário ao
 * comparar um horário com uma data, as comparações usam a "chave do dia" no
 * formato AAAA-MM-DD calculada no horário local.
 */

export function ehDataValida(valor) {
  return valor instanceof Date && !Number.isNaN(valor.getTime());
}

/** Converte uma data para a chave do dia no horário local: 2026-03-20 */
export function chaveDia(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Aceita a data digitada em AAAA-MM-DD ou DD/MM/AAAA e devolve sempre
 * AAAA-MM-DD. Devolve null quando o texto não é uma data válida.
 */
export function normalizarEntradaDeData(texto) {
  const limpo = String(texto || "").trim();
  if (!limpo) return null;

  let ano;
  let mes;
  let dia;

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(limpo)) {
    [ano, mes, dia] = limpo.split("-").map(Number);
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(limpo)) {
    [dia, mes, ano] = limpo.split("/").map(Number);
  } else {
    return null;
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const teste = new Date(ano, mes - 1, dia);
  if (teste.getFullYear() !== ano || teste.getMonth() !== mes - 1 || teste.getDate() !== dia) {
    return null;
  }

  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Primeiro instante do dia informado (AAAA-MM-DD). */
export function inicioDoDia(chave) {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}

/** Último instante do dia informado (AAAA-MM-DD). */
export function fimDoDia(chave) {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 23, 59, 59, 999);
}

/**
 * Diz se a data está dentro do período. inicio e fim podem ser objetos Date
 * ou null (sem limite daquele lado).
 */
export function dentroDoPeriodo(data, inicio = null, fim = null) {
  if (!ehDataValida(data)) return false;
  if (inicio && data < inicio) return false;
  if (fim && data > fim) return false;
  return true;
}

/** Horas decorridas entre duas datas. */
export function horasEntre(inicio, fim) {
  return (fim.getTime() - inicio.getTime()) / 3_600_000;
}
