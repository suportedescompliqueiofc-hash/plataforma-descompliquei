import { useState } from 'react';
import {
  Trophy, Users, Plus, Pencil, Trash2, CheckCircle2, TrendingUp,
  Download, Loader2, Star, Crown, Circle, ToggleLeft, ToggleRight, Award,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  useClubeMembros, useClubeAtividades, useTodosRegistros, useClubeNiveis,
  useCreateMembro, useUpdateMembro, useCreateAtividade, useUpdateAtividade, useRegistrarAtividade,
  ClubeMembro, ClubeAtividade,
} from '@/hooks/useClube';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIA_LABELS: Record<string, string> = {
  presenca: 'Presença', execucao: 'Execução',
  comunidade: 'Comunidade', penalidade: 'Penalidade',
};
const CATEGORIA_COLORS: Record<string, string> = {
  presenca:   'bg-blue-50 border-blue-200 text-blue-700',
  execucao:   'bg-emerald-50 border-emerald-200 text-emerald-700',
  comunidade: 'bg-violet-50 border-violet-200 text-violet-700',
  penalidade: 'bg-red-50 border-red-200 text-red-700',
};

function NivelBadge({ nivel }: { nivel: string }) {
  const map: Record<string, string> = {
    'Fundador One': 'bg-amber-50 border-amber-200 text-amber-800',
    'Elite':        'bg-yellow-50 border-yellow-200 text-yellow-800',
    'Destaque':     'bg-blue-50 border-blue-200 text-blue-800',
    'Membro':       'bg-muted/60 border-border/60 text-muted-foreground',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', map[nivel] ?? map['Membro'])}>
      {nivel === 'Fundador One' && <Crown className="h-3 w-3 text-amber-500" />}
      {nivel === 'Elite'        && <Star className="h-3 w-3 text-yellow-500 fill-yellow-400" />}
      {nivel === 'Destaque'     && <Star className="h-3 w-3 text-yellow-500 fill-yellow-400" />}
      {nivel}
    </span>
  );
}

// ─── Modal de membro ──────────────────────────────────────────────────────────

function MembroModal({ membro, onClose }: { membro: Partial<ClubeMembro> | null; onClose: () => void }) {
  const isEdit = !!membro?.id;
  const create = useCreateMembro();
  const update = useUpdateMembro();
  const [nome, setNome] = useState(membro?.nome ?? '');
  const [produto, setProduto] = useState<'PCA' | 'GCA'>(membro?.produto ?? 'PCA');
  const [fotoUrl, setFotoUrl] = useState(membro?.foto_url ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      if (isEdit && membro?.id) {
        await update.mutateAsync({ id: membro.id, nome, produto, foto_url: fotoUrl || null });
      } else {
        await create.mutateAsync({ nome, produto, foto_url: fotoUrl || undefined });
      }
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? 'Editar membro' : 'Novo membro'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do membro" className="h-10 text-sm rounded-lg border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto *</Label>
            <Select value={produto} onValueChange={v => setProduto(v as 'PCA' | 'GCA')}>
              <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PCA">PCA</SelectItem>
                <SelectItem value="GCA">GCA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Foto (URL)</Label>
            <Input value={fotoUrl} onChange={e => setFotoUrl(e.target.value)} placeholder="https://..." className="h-10 text-sm rounded-lg border-border/60" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            {isEdit ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal de registro manual ─────────────────────────────────────────────────

function RegistroModal({ membro, onClose }: { membro: ClubeMembro; onClose: () => void }) {
  const { user } = useAuth();
  const { data: atividades } = useClubeAtividades(true);
  const registrar = useRegistrarAtividade();
  const [atividadeId, setAtividadeId] = useState('');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  const atividadeSel = atividades?.find(a => a.id === atividadeId);
  const isPenalidade = atividadeSel?.categoria === 'penalidade';
  const pts = isPenalidade ? (atividadeSel?.pontos_perda ?? 0) : (atividadeSel?.pontos_ganho ?? 0);

  async function handleSave() {
    if (!atividadeId) { toast.error('Selecione uma atividade.'); return; }
    if (!user) return;
    setSaving(true);
    try {
      await registrar.mutateAsync({
        membro_id: membro.id,
        atividade_id: atividadeId,
        pontos: pts,
        tipo: isPenalidade ? 'perda' : 'ganho',
        observacao: obs || undefined,
        registrado_por: user.id,
      });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Registrar pontos — {membro.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Atividade *</Label>
            <Select value={atividadeId} onValueChange={setAtividadeId}>
              <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {(atividades ?? []).map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome} ({a.categoria === 'penalidade' ? `-${a.pontos_perda}` : `+${a.pontos_ganho}`} pts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {atividadeSel && (
            <div className={cn(
              'px-3 py-2 rounded-xl border text-[11px] font-semibold',
              isPenalidade ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            )}>
              {isPenalidade ? `-${pts} pontos (penalidade)` : `+${pts} pontos`}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Observação</Label>
            <Textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Motivo ou contexto do registro..."
              className="resize-none text-sm rounded-lg border-border/60"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !atividadeId} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal de atividade ───────────────────────────────────────────────────────

function AtividadeModal({ atividade, onClose }: { atividade: Partial<ClubeAtividade> | null; onClose: () => void }) {
  const isEdit = !!atividade?.id;
  const create = useCreateAtividade();
  const update = useUpdateAtividade();
  const [nome, setNome] = useState(atividade?.nome ?? '');
  const [descricao, setDescricao] = useState(atividade?.descricao ?? '');
  const [categoria, setCategoria] = useState<ClubeAtividade['categoria']>(atividade?.categoria ?? 'presenca');
  const [pontosGanho, setPontosGanho] = useState(String(atividade?.pontos_ganho ?? 0));
  const [pontosPerda, setPontosPerda] = useState(String(atividade?.pontos_perda ?? 0));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      const payload = {
        nome, descricao: descricao || null, categoria,
        pontos_ganho: parseInt(pontosGanho) || 0,
        pontos_perda: parseInt(pontosPerda) || 0,
      };
      if (isEdit && atividade?.id) {
        await update.mutateAsync({ id: atividade.id, ...payload });
      } else {
        await create.mutateAsync(payload as any);
      }
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? 'Editar atividade' : 'Nova atividade'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da atividade" className="h-10 text-sm rounded-lg border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional..." className="resize-none text-sm rounded-lg border-border/60" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria *</Label>
            <Select value={categoria} onValueChange={v => setCategoria(v as any)}>
              <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pontos (ganho)</Label>
              <Input type="number" min={0} value={pontosGanho} onChange={e => setPontosGanho(e.target.value)} className="h-10 text-sm rounded-lg border-border/60" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pontos (perda)</Label>
              <Input type="number" min={0} value={pontosPerda} onChange={e => setPontosPerda(e.target.value)} className="h-10 text-sm rounded-lg border-border/60" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Aba: Membros ─────────────────────────────────────────────────────────────

function TabMembros() {
  const { data: membros, isLoading } = useClubeMembros(false);
  const update = useUpdateMembro();
  const [modalMembro, setModalMembro] = useState<Partial<ClubeMembro> | null | 'new'>(null);
  const [modalRegistro, setModalRegistro] = useState<ClubeMembro | null>(null);

  function exportCSV() {
    if (!membros?.length) return;
    const header = ['Posição', 'Nome', 'Produto', 'Nível', 'Pontos', 'Ativo'];
    const rows = membros
      .filter(m => m.ativo)
      .sort((a, b) => b.pontos_total - a.pontos_total)
      .map((m, i) => [i + 1, m.nome, m.produto, m.nivel, m.pontos_total, m.ativo ? 'Sim' : 'Não']);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clube-one-ranking.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] text-muted-foreground/60">{membros?.filter(m => m.ativo).length ?? 0} membros ativos</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-[11px] gap-1.5 px-3 border-border/60" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" />Exportar CSV
          </Button>
          <Button size="sm" className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5 px-3" onClick={() => setModalMembro('new')}>
            <Plus className="h-3.5 w-3.5" />Novo membro
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !membros?.length ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <Users className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum membro cadastrado</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Clique em "Novo membro" para começar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {membros
            .sort((a, b) => b.pontos_total - a.pontos_total)
            .map((m, i) => (
              <div key={m.id} className={cn(
                'group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-muted/[0.02] transition-all',
                !m.ativo && 'opacity-50'
              )}>
                <span className="text-sm font-bold tabular-nums text-muted-foreground/40 w-6 text-center shrink-0">
                  {m.ativo ? `#${i + 1}` : '—'}
                </span>
                <Avatar className="h-8 w-8 rounded-lg border border-border/60 shrink-0">
                  {m.foto_url && <AvatarFallback className="rounded-lg bg-muted text-xs font-bold">{m.nome.charAt(0)}</AvatarFallback>}
                  <AvatarFallback className="rounded-lg bg-muted text-xs font-bold">{m.nome.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{m.nome}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <NivelBadge nivel={m.nivel} />
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider',
                      m.produto === 'PCA' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    )}>{m.produto}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold tabular-nums">{m.pontos_total} pts</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" title="Registrar pontos" onClick={() => setModalRegistro(m)}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setModalMembro(m)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" title={m.ativo ? 'Desativar' : 'Ativar'} onClick={() => update.mutate({ id: m.id, ativo: !m.ativo })}>
                    {m.ativo ? <ToggleRight className="h-3.5 w-3.5 text-emerald-600" /> : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modais */}
      {(modalMembro === 'new' || (modalMembro && modalMembro !== 'new')) && (
        <MembroModal membro={modalMembro === 'new' ? {} : modalMembro} onClose={() => setModalMembro(null)} />
      )}
      {modalRegistro && <RegistroModal membro={modalRegistro} onClose={() => setModalRegistro(null)} />}
    </>
  );
}

// ─── Aba: Atividades ──────────────────────────────────────────────────────────

function TabAtividades() {
  const { data: atividades, isLoading } = useClubeAtividades(false);
  const update = useUpdateAtividade();
  const [modal, setModal] = useState<Partial<ClubeAtividade> | null | 'new'>(null);

  const porCategoria = (atividades ?? []).reduce<Record<string, ClubeAtividade[]>>((acc, a) => {
    if (!acc[a.categoria]) acc[a.categoria] = [];
    acc[a.categoria].push(a);
    return acc;
  }, {});

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button size="sm" className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5 px-3" onClick={() => setModal('new')}>
          <Plus className="h-3.5 w-3.5" />Nova atividade
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(porCategoria).map(([cat, ativs]) => (
            <div key={cat}>
              <p className={cn(
                'text-[10px] font-bold uppercase tracking-widest mb-2 inline-flex items-center px-2 py-0.5 rounded-full border',
                CATEGORIA_COLORS[cat] ?? 'bg-muted/60 border-border/60 text-muted-foreground'
              )}>
                {CATEGORIA_LABELS[cat] ?? cat}
              </p>
              <div className="space-y-1.5">
                {ativs.map(a => (
                  <div key={a.id} className={cn(
                    'group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-muted/[0.02] transition-all',
                    !a.ativa && 'opacity-50'
                  )}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{a.nome}</p>
                      {a.descricao && <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{a.descricao}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {a.pontos_ganho > 0 && (
                        <p className="text-xs font-bold text-emerald-600 tabular-nums">+{a.pontos_ganho} pts</p>
                      )}
                      {a.pontos_perda > 0 && (
                        <p className="text-xs font-bold text-red-500 tabular-nums">-{a.pontos_perda} pts</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setModal(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" title={a.ativa ? 'Desativar' : 'Ativar'} onClick={() => update.mutate({ id: a.id, ativa: !a.ativa })}>
                        {a.ativa ? <ToggleRight className="h-3.5 w-3.5 text-emerald-600" /> : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal === 'new' || (modal && modal !== 'new')) && (
        <AtividadeModal atividade={modal === 'new' ? {} : modal} onClose={() => setModal(null)} />
      )}
    </>
  );
}

// ─── Aba: Histórico ───────────────────────────────────────────────────────────

function TabHistorico() {
  const { data: registros, isLoading } = useTodosRegistros();

  return isLoading ? (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ) : !registros?.length ? (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="p-3 rounded-xl bg-muted/40 mb-3">
        <Award className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Nenhum registro ainda</p>
    </div>
  ) : (
    <div className="space-y-2">
      {registros.map(r => (
        <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-muted/[0.02]">
          <div className={cn(
            'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
            r.tipo === 'ganho' ? 'bg-emerald-100' : 'bg-red-100'
          )}>
            <TrendingUp className={cn('h-3.5 w-3.5', r.tipo === 'ganho' ? 'text-emerald-600' : 'text-red-500 rotate-180')} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-semibold text-foreground">{(r as any).clube_membros?.nome ?? '—'}</p>
              <span className="text-[10px] text-muted-foreground/50">·</span>
              <p className="text-[11px] text-muted-foreground/70 truncate">{r.clube_atividades?.nome ?? '—'}</p>
            </div>
            {r.observacao && <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">{r.observacao}</p>}
            <p className="text-[10px] text-muted-foreground/40">
              {format(parseISO(r.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <span className={cn('text-sm font-bold tabular-nums shrink-0', r.tipo === 'ganho' ? 'text-emerald-600' : 'text-red-500')}>
            {r.tipo === 'ganho' ? '+' : '-'}{r.pontos}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminClubeOne() {
  const [aba, setAba] = useState<'membros' | 'atividades' | 'historico'>('membros');

  const abas = [
    { key: 'membros',    label: 'Membros' },
    { key: 'atividades', label: 'Atividades' },
    { key: 'historico',  label: 'Histórico' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted">
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Clube One</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">Gestão de membros, atividades e pontuação</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center bg-muted/40 rounded-xl p-1 gap-1 max-w-xs">
        {abas.map(a => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={cn(
              'flex-1 h-8 rounded-lg text-[11px] font-semibold transition-all',
              aba === a.key
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="p-5">
          {aba === 'membros'    && <TabMembros />}
          {aba === 'atividades' && <TabAtividades />}
          {aba === 'historico'  && <TabHistorico />}
        </div>
      </div>
    </div>
  );
}
