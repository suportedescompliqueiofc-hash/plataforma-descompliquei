import { BookOpen, Bot, CheckCircle2, Clock, Layers, Lock, Loader2, ClipboardList, MessageSquare, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EstagioDetalhe {
  titulo: string;
  descricao?: string;
  passos: { titulo: string; concluido: boolean; concluido_em?: string }[];
}

interface AulaConcluida {
  nome: string;
  concluido_em: string;
}

interface Conversa {
  titulo: string;
  agente_slug: string | null;
  criado_em: string;
}

export interface EngajamentoData {
  diagnostico: Record<string, any> | null;
  estagios: EstagioDetalhe[];
  jornadaTitulo: string | null;
  jornadaStatus: string | null;
  aulasConcluidas: AulaConcluida[];
  conversas: Conversa[];
}

interface Props {
  data: EngajamentoData;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const DIAG_FIELDS: { key: string; label: string }[] = [
  { key: 'p2', label: 'Especialidade' },
  { key: 'p3', label: 'Modelo de atendimento' },
  { key: 'p20', label: 'Faturamento mensal' },
  { key: 'p21', label: 'Ticket médio' },
  { key: 'p22', label: 'Procedimento principal' },
  { key: 'p28', label: 'Leads novos/mês' },
  { key: 'p29', label: 'Tempo de resposta ao lead' },
  { key: 'p32', label: 'Taxa de conversão estimada' },
  { key: 'p14', label: 'Tráfego pago' },
  { key: 'p14a_ativo', label: 'Investimento mensal' },
  { key: 'p38', label: 'Equipe de atendimento' },
  { key: 'p8', label: 'Atendimentos/mês' },
  { key: 'p46', label: 'Meta de faturamento (3 meses)' },
  { key: 'p47', label: 'Área mais travada' },
];

const DIAG_FLAGS: { test: (r: Record<string, any>) => boolean; label: string; severity: 'danger' | 'warning' }[] = [
  { test: r => r.p29 === 'Mais de 2h', label: 'Tempo de resposta alto (>2h)', severity: 'danger' },
  { test: r => r.p34 === 'Não fazemos', label: 'Sem follow-up estruturado', severity: 'danger' },
  { test: r => r.p35 === 'Nunca', label: 'Sem reativação de inativos', severity: 'warning' },
  { test: r => r.p32 === 'Menos de 20%' || r.p32 === 'Não sei', label: 'Conversão baixa ou desconhecida', severity: 'warning' },
  { test: r => r.p44 === 'Não acompanho', label: 'Sem acompanhamento de métricas', severity: 'warning' },
  { test: r => r.p14 === 'Sim, de forma consistente' && r.p14d_ativo === 'Não — invisto e não vejo retorno claro', label: 'Investe em tráfego sem retorno claro', severity: 'danger' },
  { test: r => r.p23 === 'Principalmente avulsos' && r.p25 === 'Não ofereço recorrência', label: 'Receita 100% transacional', severity: 'warning' },
  { test: r => r.p38 === 'Não — trabalho sozinho' && r.p38a_solo === 'Sim, claramente — não consigo atender tudo', label: 'Solo sobrecarregado — limita crescimento', severity: 'danger' },
];

function getEstagioIcon(passos: { concluido: boolean }[]) {
  const done = passos.filter(p => p.concluido).length;
  if (done === passos.length && passos.length > 0) return { icon: CheckCircle2, cls: 'text-emerald-500' };
  if (done > 0) return { icon: Clock, cls: 'text-amber-500' };
  return { icon: Lock, cls: 'text-muted-foreground/30' };
}

export default function AbaEngajamento({ data }: Props) {
  const { diagnostico, estagios, jornadaTitulo, jornadaStatus, aulasConcluidas, conversas } = data;

  const activeFlags = diagnostico
    ? DIAG_FLAGS.filter(f => f.test(diagnostico))
    : [];

  const diagFields = diagnostico
    ? DIAG_FIELDS.map(f => {
        const val = diagnostico[f.key];
        if (!val) return null;
        const display = Array.isArray(val) ? val.join(', ') : String(val);
        return { label: f.label, value: display };
      }).filter(Boolean) as { label: string; value: string }[]
    : [];

  return (
    <div className="space-y-4">
      {/* Diagnóstico */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Diagnóstico do Cliente</p>
          </div>
          {diagnostico ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200/60">
              Preenchido
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/60">
              Não preenchido
            </span>
          )}
        </div>

        {diagnostico ? (
          <div className="p-5 space-y-4">
            {/* Dados principais */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
              {diagFields.map(f => (
                <div key={f.label}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">{f.label}</p>
                  <p className="text-[13px] text-foreground">{f.value}</p>
                </div>
              ))}
            </div>

            {/* Canais de aquisição */}
            {diagnostico.p11 && Array.isArray(diagnostico.p11) && diagnostico.p11.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Canais de aquisição</p>
                <div className="flex flex-wrap gap-1.5">
                  {diagnostico.p11.map((c: string) => (
                    <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Flags de atenção */}
            {activeFlags.length > 0 && (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3.5 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Pontos de atenção</p>
                {activeFlags.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', f.severity === 'danger' ? 'text-red-500' : 'text-amber-500')} />
                    <p className="text-[12px] text-amber-900 leading-snug">{f.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Textos livres do diagnóstico */}
            {(diagnostico.p19 || diagnostico.p49 || diagnostico.p50 || diagnostico.p51) && (
              <div className="space-y-2.5 pt-2 border-t border-border/40">
                {diagnostico.p50 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Maior obstáculo para crescer</p>
                    <p className="text-[12px] text-foreground/80 leading-relaxed">{diagnostico.p50}</p>
                  </div>
                )}
                {diagnostico.p51 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Maior ambição (12 meses)</p>
                    <p className="text-[12px] text-foreground/80 leading-relaxed">{diagnostico.p51}</p>
                  </div>
                )}
                {diagnostico.p19 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Desafio na geração de demanda</p>
                    <p className="text-[12px] text-foreground/80 leading-relaxed">{diagnostico.p19}</p>
                  </div>
                )}
                {diagnostico.p49 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">O que já tentou e não funcionou</p>
                    <p className="text-[12px] text-foreground/80 leading-relaxed">{diagnostico.p49}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <ClipboardList className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Diagnóstico não preenchido</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">O cliente ainda não completou o formulário de onboarding</p>
          </div>
        )}
      </div>

      {/* Jornada detalhada */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {jornadaTitulo || 'Jornada de Implementação'}
              </p>
            </div>
          </div>
          {jornadaStatus && (
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
              jornadaStatus === 'ativa' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' :
              jornadaStatus === 'concluida' ? 'bg-blue-50 text-blue-700 border-blue-200/60' :
              'bg-muted text-muted-foreground border-border/60'
            )}>
              {jornadaStatus}
            </span>
          )}
        </div>

        {estagios.length > 0 ? (
          <div className="p-5">
            <div className="space-y-3">
              {estagios.map((est, i) => {
                const { icon: Icon, cls } = getEstagioIcon(est.passos);
                const done = est.passos.filter(p => p.concluido).length;
                const total = est.passos.length;
                return (
                  <div key={i} className="rounded-xl border border-border/50 bg-muted/[0.02] overflow-hidden">
                    <div className="px-4 py-3 flex items-center gap-3">
                      <Icon className={cn('h-4 w-4 shrink-0', cls)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{est.titulo}</p>
                        {est.descricao && <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{est.descricao}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', done === total && total > 0 ? 'bg-emerald-500' : 'bg-foreground/40')}
                            style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{done}/{total}</span>
                      </div>
                    </div>
                    {/* Lista de passos */}
                    {est.passos.length > 0 && (
                      <div className="border-t border-border/40 divide-y divide-border/30">
                        {est.passos.map((p, j) => (
                          <div key={j} className="flex items-center gap-2.5 px-4 py-2 pl-11">
                            {p.concluido
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              : <div className="h-3.5 w-3.5 rounded-full border border-border/60 shrink-0" />
                            }
                            <p className={cn('text-[12px] flex-1', p.concluido ? 'text-muted-foreground line-through' : 'text-foreground')}>
                              {p.titulo}
                            </p>
                            {p.concluido && p.concluido_em && (
                              <span className="text-[10px] text-muted-foreground/40 shrink-0">{fmtDate(p.concluido_em)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Layers className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Jornada ainda não criada</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">O Athos ainda não gerou a jornada personalizada</p>
          </div>
        )}
      </div>

      {/* Arsenal — aulas concluídas */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Aulas do Arsenal</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/60">
            {aulasConcluidas.length} concluída{aulasConcluidas.length !== 1 ? 's' : ''}
          </span>
        </div>

        {aulasConcluidas.length > 0 ? (
          <div className="divide-y divide-border/40">
            {aulasConcluidas.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <p className="text-[13px] text-foreground flex-1 min-w-0 truncate">{a.nome}</p>
                <span className="text-[10px] text-muted-foreground/40 shrink-0">{fmtDate(a.concluido_em)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-[13px] text-muted-foreground/50">Nenhuma aula concluída ainda</p>
          </div>
        )}
      </div>

      {/* Conversas com Athos */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Conversas com Athos GS</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/60">
            {conversas.length} conversa{conversas.length !== 1 ? 's' : ''}
          </span>
        </div>

        {conversas.length > 0 ? (
          <div className="divide-y divide-border/40">
            {conversas.map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <MessageSquare className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground truncate">{c.titulo || 'Conversa sem título'}</p>
                  {c.agente_slug && (
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">{c.agente_slug}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/40 shrink-0">{fmtDate(c.criado_em)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-[13px] text-muted-foreground/50">Nenhuma conversa registrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
