import { useState } from 'react';
import { Trophy, Star, Crown, Users, ChevronRight, CheckCircle2, Circle, Clock, TrendingUp, Award, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PageHero } from '@/components/PageHero';
import {
  useClubeMembros, useClubeAtividades, useClubeNiveis,
  useClubeRegistros, useRegistrarAtividade,
  ClubeMembro, ClubeAtividade,
} from '@/hooks/useClube';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIA_LABELS: Record<string, string> = {
  presenca: 'Presença',
  execucao: 'Execução',
  comunidade: 'Comunidade',
  penalidade: 'Penalidade',
};

const CATEGORIA_COLORS: Record<string, string> = {
  presenca:   'bg-blue-50 border-blue-200 text-blue-700',
  execucao:   'bg-emerald-50 border-emerald-200 text-emerald-700',
  comunidade: 'bg-violet-50 border-violet-200 text-violet-700',
  penalidade: 'bg-red-50 border-red-200 text-red-700',
};

function NivelSelo({ nivel, size = 'sm' }: { nivel: string; size?: 'sm' | 'md' }) {
  const s = size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  if (nivel === 'Fundador One') return <Crown className={cn(s, 'text-amber-500')} />;
  if (nivel === 'Elite')        return (
    <span className="flex gap-0.5">
      <Star className={cn(s, 'text-yellow-500 fill-yellow-400')} />
      <Star className={cn(s, 'text-yellow-500 fill-yellow-400')} />
    </span>
  );
  if (nivel === 'Destaque')     return <Star className={cn(s, 'text-yellow-500 fill-yellow-400')} />;
  return null;
}

function NivelBadge({ nivel }: { nivel: string }) {
  const colors: Record<string, string> = {
    'Fundador One': 'bg-amber-50 border-amber-200 text-amber-800',
    'Elite':        'bg-yellow-50 border-yellow-200 text-yellow-800',
    'Destaque':     'bg-blue-50 border-blue-200 text-blue-800',
    'Membro':       'bg-muted/60 border-border/60 text-muted-foreground',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
      colors[nivel] ?? colors['Membro']
    )}>
      <NivelSelo nivel={nivel} />
      {nivel}
    </span>
  );
}

function ProdutoBadge({ produto }: { produto: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider',
      produto === 'PCA' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
    )}>
      {produto}
    </span>
  );
}

function BarraProgresso({ pontos, nivelAtual, proximoNivel }: { pontos: number; nivelAtual: string; proximoNivel: { nome: string; pontos_minimo: number } | null }) {
  if (!proximoNivel) return (
    <div className="text-[11px] text-muted-foreground/60 text-center py-1">Nivel máximo atingido</div>
  );
  const { data: niveis } = useClubeNiveis();
  const nivelObj = niveis?.find(n => n.nome === nivelAtual);
  const base = nivelObj?.pontos_minimo ?? 0;
  const meta = proximoNivel.pontos_minimo;
  const pct = Math.min(100, Math.round(((pontos - base) / (meta - base)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-display tabular-nums">{pontos} pts</span>
        <span className="font-display tabular-nums">{proximoNivel.nome}: {meta} pts</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/50 text-right font-display tabular-nums">{pct}% para {proximoNivel.nome}</p>
    </div>
  );
}

// ─── Sheet de perfil ──────────────────────────────────────────────────────────

function MembroSheet({
  membro,
  onClose,
}: {
  membro: ClubeMembro | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { role } = useProfile();
  const isSuperAdmin = role === 'superadmin';
  const { data: registros, isLoading: loadingReg } = useClubeRegistros(membro?.id ?? null);
  const { data: atividades } = useClubeAtividades(true);
  const { data: niveis } = useClubeNiveis();
  const registrar = useRegistrarAtividade();
  const [obs, setObs] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'historico' | 'checklist'>('historico');

  if (!membro) return null;

  const proximoNivel = niveis?.find(n => n.pontos_minimo > membro.pontos_total) ?? null;

  const atividadesPorCategoria = (atividades ?? []).reduce<Record<string, ClubeAtividade[]>>((acc, a) => {
    if (!acc[a.categoria]) acc[a.categoria] = [];
    acc[a.categoria].push(a);
    return acc;
  }, {});

  async function handleRegistrar(ativ: ClubeAtividade) {
    if (!user || !membro) return;
    setSending(ativ.id);
    try {
      const isPenalidade = ativ.categoria === 'penalidade';
      await registrar.mutateAsync({
        membro_id: membro.id,
        atividade_id: ativ.id,
        pontos: isPenalidade ? ativ.pontos_perda : ativ.pontos_ganho,
        tipo: isPenalidade ? 'perda' : 'ganho',
        observacao: obs[ativ.id] || undefined,
        registrado_por: user.id,
      });
      setObs(prev => ({ ...prev, [ativ.id]: '' }));
    } finally {
      setSending(null);
    }
  }

  return (
    <Sheet open={!!membro} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header do perfil */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/[0.03]">
          <SheetHeader className="space-y-0 mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-xl border border-border/60">
                {membro.foto_url && <AvatarImage src={membro.foto_url} className="object-cover" />}
                <AvatarFallback className="rounded-xl bg-muted text-base font-bold">
                  {membro.nome.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base font-bold font-display truncate">{membro.nome}</SheetTitle>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <NivelBadge nivel={membro.nivel} />
                  <ProdutoBadge produto={membro.produto} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold font-display tabular-nums">{membro.pontos_total}</p>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">pontos</p>
              </div>
            </div>
          </SheetHeader>

          {/* Barra de progresso */}
          <BarraProgresso pontos={membro.pontos_total} nivelAtual={membro.nivel} proximoNivel={proximoNivel} />
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 pb-0 shrink-0">
          <div className="flex items-center bg-muted/40 rounded-xl p-1 gap-1">
            {(['historico', 'checklist'] as const).map(aba => (
              <button
                key={aba}
                onClick={() => setAbaAtiva(aba)}
                className={cn(
                  'flex-1 h-7 rounded-lg text-[11px] font-semibold transition-all',
                  abaAtiva === aba
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {aba === 'historico' ? 'Histórico' : 'Atividades'}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo das tabs */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Histórico */}
          {abaAtiva === 'historico' && (
            loadingReg ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !registros?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <Clock className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum registro ainda</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">As atividades registradas aparecerão aqui</p>
              </div>
            ) : (
              <div className="space-y-2">
                {registros.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/40 bg-muted/[0.02]">
                    <div className={cn(
                      'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
                      r.tipo === 'ganho' ? 'bg-emerald-100' : 'bg-red-100'
                    )}>
                      {r.tipo === 'ganho'
                        ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        : <TrendingUp className="h-3.5 w-3.5 text-red-500 rotate-180" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {r.clube_atividades?.nome ?? 'Atividade'}
                      </p>
                      {r.observacao && (
                        <p className="text-[10px] text-muted-foreground/60 truncate">{r.observacao}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/50">
                        {format(parseISO(r.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <span className={cn(
                      'text-sm font-bold font-display tabular-nums shrink-0',
                      r.tipo === 'ganho' ? 'text-emerald-600' : 'text-red-500'
                    )}>
                      {r.tipo === 'ganho' ? '+' : '-'}{r.pontos}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Checklist de atividades */}
          {abaAtiva === 'checklist' && (
            !isSuperAdmin ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <Award className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Registro disponível apenas para admins</p>
              </div>
            ) : (
              <div className="space-y-5">
                {Object.entries(atividadesPorCategoria).map(([cat, ativs]) => (
                  <div key={cat}>
                    <p className={cn(
                      'text-[10px] font-bold uppercase tracking-widest mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border',
                      CATEGORIA_COLORS[cat] ?? 'bg-muted/60 border-border/60 text-muted-foreground'
                    )}>
                      {CATEGORIA_LABELS[cat] ?? cat}
                    </p>
                    <div className="space-y-2">
                      {ativs.map(a => {
                        const isPenalidade = a.categoria === 'penalidade';
                        const pts = isPenalidade ? a.pontos_perda : a.pontos_ganho;
                        const isSending = sending === a.id;
                        return (
                          <div key={a.id} className="rounded-xl border border-border/40 bg-muted/[0.02] p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground">{a.nome}</p>
                                {a.descricao && (
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{a.descricao}</p>
                                )}
                              </div>
                              <span className={cn(
                                'text-xs font-bold font-display tabular-nums shrink-0',
                                isPenalidade ? 'text-red-500' : 'text-emerald-600'
                              )}>
                                {isPenalidade ? '-' : '+'}{pts} pts
                              </span>
                            </div>
                            <Textarea
                              placeholder="Observação (opcional)"
                              className="h-8 min-h-0 text-[11px] resize-none py-1.5 px-2 rounded-lg border-border/60"
                              value={obs[a.id] ?? ''}
                              onChange={e => setObs(prev => ({ ...prev, [a.id]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              className="w-full h-7 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                              onClick={() => handleRegistrar(a)}
                              disabled={isSending}
                            >
                              {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Registrar
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Card de ranking ──────────────────────────────────────────────────────────

function RankingCard({
  membro,
  posicao,
  onClick,
}: {
  membro: ClubeMembro;
  posicao: number;
  onClick: () => void;
}) {
  const top3 = posicao <= 3;
  const posColors = ['text-amber-500', 'text-slate-400', 'text-orange-400'];

  return (
    <button
      onClick={onClick}
      className="w-full text-left group flex items-center gap-4 px-5 py-4 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-foreground/20 hover:shadow-md transition-all duration-200"
    >
      {/* Posição */}
      <div className={cn(
        'text-xl font-bold font-display tabular-nums w-9 text-center shrink-0',
        top3 ? posColors[posicao - 1] : 'text-muted-foreground/40'
      )}>
        {top3 && posicao === 1 ? <Trophy className="h-6 w-6 mx-auto text-amber-500" /> : `#${posicao}`}
      </div>

      {/* Avatar */}
      <Avatar className="h-10 w-10 rounded-xl border border-border/60 shrink-0">
        {membro.foto_url && <AvatarImage src={membro.foto_url} className="object-cover" />}
        <AvatarFallback className="rounded-xl bg-muted text-sm font-bold">
          {membro.nome.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{membro.nome}</p>
          <ProdutoBadge produto={membro.produto} />
        </div>
        <div className="mt-0.5">
          <NivelBadge nivel={membro.nivel} />
        </div>
      </div>

      {/* Pontos */}
      <div className="text-right shrink-0">
        <p className="text-lg font-bold font-display tabular-nums text-foreground">{membro.pontos_total}</p>
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">pts</p>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ClubeOne() {
  const { data: membros, isLoading } = useClubeMembros(true);
  const [membroSelecionado, setMembroSelecionado] = useState<ClubeMembro | null>(null);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <PageHero
        icon={Trophy}
        title="Clube One"
        subtitle="Ranking de membros por pontuação"
      />

      {/* Ranking */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">RANKING GERAL</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Ordenado por pontuação total</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !membros?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <Users className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum membro ainda</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">Os membros aparecem aqui após serem cadastrados pelo admin</p>
            </div>
          ) : (
            membros.map((m, i) => (
              <RankingCard
                key={m.id}
                membro={m}
                posicao={i + 1}
                onClick={() => setMembroSelecionado(m)}
              />
            ))
          )}
        </div>
      </div>

      {/* Sheet de perfil */}
      <MembroSheet
        membro={membroSelecionado}
        onClose={() => setMembroSelecionado(null)}
      />
    </div>
  );
}
