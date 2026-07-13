import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bot, Plus, Pencil, Check, X, ToggleLeft, ToggleRight, Loader2, ChevronDown, ChevronUp, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MODELS } from '@/lib/athosModels';

interface Agente {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  system_prompt: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const TABLE = 'athos_agentes' as any;
const CONFIG_TABLE = 'athos_config' as any;

function useAgentes() {
  return useQuery({
    queryKey: ['athos-agentes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(TABLE).select('*').order('created_at');
      if (error) throw error;
      return (data ?? []) as Agente[];
    },
  });
}

// Modelo padrão de IA usado em TODO chat voltado a clientes (DescompliqueiOS,
// painéis embutidos como o de Notas) — cliente não escolhe, só o Admin aqui.
function useAthosConfig() {
  return useQuery({
    queryKey: ['athos-config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(CONFIG_TABLE)
        .select('modelo_padrao, atualizado_em')
        .eq('id', 'default')
        .single();
      if (error) throw error;
      return data as { modelo_padrao: string; atualizado_em: string };
    },
  });
}

function useAtualizarModeloPadrao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modelo_padrao: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from(CONFIG_TABLE)
        .update({ modelo_padrao, atualizado_em: new Date().toISOString(), atualizado_por: user?.id })
        .eq('id', 'default');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['athos-config'] });
      toast.success('Modelo padrão atualizado.');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar — só superadmin pode alterar.'),
  });
}

function ModeloPadraoCard() {
  const { data: config, isLoading } = useAthosConfig();
  const atualizar = useAtualizarModeloPadrao();

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">MODELO PADRÃO</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Usado em todo chat do Athos GS voltado a clientes — eles não escolhem</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-4 flex items-center gap-3">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Select
              value={config?.modelo_padrao}
              onValueChange={(v) => atualizar.mutate(v)}
              disabled={atualizar.isPending}
            >
              <SelectTrigger className="h-9 w-64 text-sm rounded-lg border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {atualizar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {config?.atualizado_em && (
              <span className="text-[10px] text-muted-foreground/50">
                Atualizado {format(new Date(config.atualizado_em), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const EMPTY_FORM = { nome: '', slug: '', descricao: '', system_prompt: '', ativo: true };

export default function AdminAgentes() {
  const qc = useQueryClient();
  const { data: agentes = [], isLoading } = useAgentes();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agente | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any).from(TABLE).update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['athos-agentes'] }),
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (agente: Agente) => {
    setEditing(agente);
    setForm({
      nome: agente.nome,
      slug: agente.slug,
      descricao: agente.descricao ?? '',
      system_prompt: agente.system_prompt ?? '',
      ativo: agente.ativo,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.slug.trim()) {
      toast.error('Nome e slug são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any).from(TABLE).update({
          nome: form.nome.trim(),
          slug: form.slug.trim(),
          descricao: form.descricao.trim() || null,
          system_prompt: form.system_prompt.trim() || null,
          ativo: form.ativo,
        }).eq('id', editing.id);
        if (error) throw error;
        toast.success('Agente atualizado');
      } else {
        const { error } = await (supabase as any).from(TABLE).insert({
          nome: form.nome.trim(),
          slug: form.slug.trim(),
          descricao: form.descricao.trim() || null,
          system_prompt: form.system_prompt.trim() || null,
          ativo: form.ativo,
        });
        if (error) throw error;
        toast.success('Agente criado');
      }
      qc.invalidateQueries({ queryKey: ['athos-agentes'] });
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted">
            <Bot className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Agentes de IA</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">Gerencie os agentes do Athos GS — system prompts, slugs e status</p>
      </div>

      <ModeloPadraoCard />

      {/* List card */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">AGENTES CADASTRADOS</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{agentes.length} agente{agentes.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button
            onClick={openCreate}
            className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-3 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Novo agente
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : agentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Bot className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum agente cadastrado</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Crie o primeiro agente para começar</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {agentes.map((agente) => (
              <div key={agente.id} className="group">
                {/* Row */}
                <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  {/* Ativo toggle */}
                  <button
                    onClick={() => toggleAtivo.mutate({ id: agente.id, ativo: !agente.ativo })}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    title={agente.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {agente.ativo
                      ? <ToggleRight className="h-5 w-5 text-emerald-500" />
                      : <ToggleLeft className="h-5 w-5" />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-foreground">{agente.nome}</span>
                      <span className="text-[10px] font-mono bg-muted/60 border border-border/50 px-1.5 py-0.5 rounded text-muted-foreground">{agente.slug}</span>
                      {!agente.ativo && (
                        <span className="text-[10px] font-semibold bg-muted/40 text-muted-foreground/60 px-1.5 py-0.5 rounded">INATIVO</span>
                      )}
                    </div>
                    {agente.descricao && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{agente.descricao}</p>
                    )}
                  </div>

                  {/* Meta */}
                  <span className="text-[10px] text-muted-foreground/40 shrink-0 hidden sm:block">
                    {agente.system_prompt ? `${agente.system_prompt.length.toLocaleString()} chars` : 'Sem prompt'}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40 shrink-0 hidden md:block">
                    {format(new Date(agente.updated_at), "dd MMM yyyy", { locale: ptBR })}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => setExpanded(expanded === agente.id ? null : agente.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                      title="Ver prompt"
                    >
                      {expanded === agente.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => openEdit(agente)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* System prompt preview */}
                {expanded === agente.id && (
                  <div className="px-5 pb-4">
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">SYSTEM PROMPT</p>
                      {agente.system_prompt ? (
                        <pre className="text-[12px] text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">
                          {agente.system_prompt}
                        </pre>
                      ) : (
                        <p className="text-[12px] text-muted-foreground/50 italic">Nenhum system prompt definido</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editing ? 'Editar agente' : 'Novo agente'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</label>
                <Input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Athos GS Onboarding"
                  className="h-10 text-sm rounded-lg border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Slug</label>
                <Input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  placeholder="onboarding"
                  className="h-10 text-sm rounded-lg border-border/60 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</label>
              <Input
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Breve descrição do agente e quando é usado"
                className="h-10 text-sm rounded-lg border-border/60"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">System Prompt</label>
                <span className="text-[10px] text-muted-foreground/50">{form.system_prompt.length.toLocaleString()} chars</span>
              </div>
              <Textarea
                value={form.system_prompt}
                onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                placeholder="Você é o Athos GS, especialista em gestão de clínicas..."
                className="min-h-64 text-[13px] rounded-lg border-border/60 font-mono resize-y"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors',
                  form.ativo
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'border-border/60 bg-muted/30 text-muted-foreground'
                )}
              >
                {form.ativo
                  ? <><Check className="h-3.5 w-3.5" /> Ativo</>
                  : <><X className="h-3.5 w-3.5" /> Inativo</>}
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="h-9 rounded-lg text-[12px]">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {editing ? 'Salvar alterações' : 'Criar agente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
