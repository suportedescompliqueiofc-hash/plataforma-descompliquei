// Lógica compartilhada dos lembretes de agendamento.
//
// Existem DUAS modalidades de lembrete (convivem — a clínica escolhe por lembrete):
//   • 'relativo' → disparado X minutos antes do horário do agendamento (minutos_antes)
//   • 'fixo'     → disparado N dias antes do agendamento, num horário fixo do dia (dias_antes + horario "HH:MM")
//
// Este módulo é a fonte única da verdade usada pelo ConfigNotificacoes, pelos modais de
// agendamento (pré-cancelamento) e espelhado no cron `process-appointment-notifications`.
// A dedup é feita por `chaveLembrete` (o antecedencia_minutos não identifica um lembrete
// fixo, cuja antecedência varia conforme o horário de cada agendamento).

export type LembreteModo = "relativo" | "fixo";

export interface Lembrete {
  ativo: boolean;
  modo?: LembreteModo; // ausente = 'relativo' (retrocompatível com lembretes antigos)
  minutos_antes: number; // usado no modo relativo
  dias_antes?: number; // usado no modo fixo (0 = no mesmo dia)
  horario?: string; // "HH:MM" — usado no modo fixo
}

export function lembreteModo(l: Lembrete): LembreteModo {
  return l.modo === "fixo" ? "fixo" : "relativo";
}

/** Identificador estável do lembrete, usado para dedup em agendamento_notificacoes.chave_lembrete. */
export function chaveLembrete(l: Lembrete): string {
  if (lembreteModo(l) === "fixo") {
    return `fixo:${l.dias_antes ?? 1}:${l.horario ?? "08:00"}`;
  }
  return `rel:${l.minutos_antes}`;
}

/**
 * Momento de envio deste lembrete para um agendamento específico (Date no fuso local).
 * Modo fixo: (data do agendamento − dias_antes) às HH:MM.
 * Retorna null se inválido (ex.: horário fixo cairia depois do próprio agendamento).
 */
export function momentoEnvioLembrete(l: Lembrete, dataInicio: Date): Date | null {
  if (lembreteModo(l) === "fixo") {
    const [hh, mm] = (l.horario ?? "08:00").split(":").map(Number);
    const dias = l.dias_antes ?? 1;
    const d = new Date(dataInicio);
    d.setDate(d.getDate() - dias);
    d.setHours(Number.isFinite(hh) ? hh : 8, Number.isFinite(mm) ? mm : 0, 0, 0);
    if (d.getTime() >= dataInicio.getTime()) return null;
    return d;
  }
  if (!(l.minutos_antes > 0)) return null;
  return new Date(dataInicio.getTime() - l.minutos_antes * 60 * 1000);
}

/** Antecedência efetiva em minutos (para a coluna NOT NULL antecedencia_minutos e logs). */
export function antecedenciaMinutos(l: Lembrete, dataInicio: Date): number {
  if (lembreteModo(l) === "fixo") {
    const m = momentoEnvioLembrete(l, dataInicio);
    if (!m) return 0;
    return Math.max(0, Math.round((dataInicio.getTime() - m.getTime()) / 60000));
  }
  return l.minutos_antes;
}

/** Um lembrete está válido para agendar quando ativo e com os campos do seu modo preenchidos. */
export function lembreteAtivoValido(l: Lembrete): boolean {
  if (!l.ativo) return false;
  if (lembreteModo(l) === "fixo") return !!l.horario && (l.dias_antes ?? 0) >= 0;
  return l.minutos_antes > 0;
}

/** Rótulo humano do lembrete (ex.: "1 dia antes, às 08:00" ou "2 horas antes"). */
export function formatLembrete(l: Lembrete): string {
  if (lembreteModo(l) === "fixo") {
    const dias = l.dias_antes ?? 1;
    const horario = l.horario ?? "08:00";
    const quando = dias === 0 ? "No mesmo dia" : dias === 1 ? "1 dia antes" : `${dias} dias antes`;
    return `${quando}, às ${horario}`;
  }
  const min = l.minutos_antes;
  if (min < 60) return `${min} minutos antes`;
  if (min === 60) return "1 hora antes";
  if (min < 1440) return `${Math.round(min / 60)} horas antes`;
  if (min === 1440) return "1 dia antes";
  return `${Math.round(min / 1440)} dias antes`;
}
