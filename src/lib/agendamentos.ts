/**
 * Regras compartilhadas de agendamentos.
 *
 * O banco usa 4 tipos (`consulta`, `procedimento`, `avaliacao`, `retorno`) mas a UI só
 * oferece os três primeiros. `avaliacao` é funcionalmente uma consulta — trata-se igual.
 */

/** Tipos que podem ter um procedimento vinculado. */
export const TIPOS_COM_PROCEDIMENTO = ["procedimento", "consulta", "avaliacao"] as const;

/** Tipos em que o procedimento é apenas *interesse* — não é o serviço agendado em si. */
export const TIPOS_DE_INTERESSE = ["consulta", "avaliacao"] as const;

export function aceitaProcedimento(tipo: string | null | undefined): boolean {
  return TIPOS_COM_PROCEDIMENTO.includes(tipo as any);
}

/**
 * Numa consulta, o procedimento é o que a paciente *pretende* fazer — vincular não deve
 * mexer no valor nem na duração do agendamento (o `valor_orcado` da consulta é o valor da
 * consulta). Já num agendamento de procedimento, o catálogo preenche valor e duração.
 */
export function isProcedimentoDeInteresse(tipo: string | null | undefined): boolean {
  return TIPOS_DE_INTERESSE.includes(tipo as any);
}

export function labelProcedimento(tipo: string | null | undefined): string {
  return isProcedimentoDeInteresse(tipo) ? "Procedimento de interesse" : "Procedimento";
}

/** Status que ainda podem gerar receita (o agendamento não aconteceu nem morreu). */
export const STATUS_EM_ABERTO = ["agendado", "confirmado"] as const;

/** Status terminais usados para apurar a taxa de comparecimento. */
export const STATUS_COMPARECEU = ["realizado"] as const;
export const STATUS_NAO_COMPARECEU = ["cancelado", "nao_compareceu", "remarcado"] as const;

/** Janela das taxas históricas, em dias (decisão de produto — 2026-07-20). */
export const JANELA_TAXAS_DIAS = 180;

/**
 * Massa mínima de agendamentos terminais para confiar numa taxa apurada. Abaixo disso a
 * projeção usa o valor bruto e sinaliza que ainda não há base para ponderar.
 */
export const MINIMO_PARA_PONDERAR = 20;
