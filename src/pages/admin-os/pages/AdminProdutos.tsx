import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Power, Brain, Layers, BookOpen, Zap, Users, CheckSquare2, Loader2, Trash2 } from 'lucide-react';

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  duracao_dias: number;
  pilares_liberados: string[];
  ias_liberadas: string[];
  acesso_cerebro: boolean;
  acesso_crm: boolean;
  acesso_sessoes_taticas: boolean;
  acesso_materiais: boolean;
  acesso_ia_comercial: boolean;
  max_leads: number;
  max_usuarios_crm: number;
  ativo: boolean;
  ordem_index: number;
}

interface Pilar {
  id: string;
  nome: string;
  icone: string | null;
}

interface IAConfig {
  id: string;
  name: string;
}

const EMPTY_FORM: Omit<Produto, 'id' | 'ordem_index'> = {
  nome: '',
  descricao: '',
  preco_mensal: 0,
  duracao_dias: 30,
  pilares_liberados: [],
  ias_liberadas: [],
  acesso_cerebro: false,
  acesso_crm: false,
  acesso_sessoes_taticas: false,
  acesso_materiais: false,
  acesso_ia_comercial: false,
  max_leads: 500,
  max_usuarios_crm: 3,
  ativo: true,
};

const FUNCIONALIDADES = [
  { key: 'acesso_cerebro',          label: 'Cérebro',         desc: 'IA de inteligência estratégica', icon: Brain },
  { key: 'acesso_crm',              label: 'CRM',             desc: 'Gestão de leads e WhatsApp',     icon: Users },
  { key: 'acesso_sessoes_taticas',  label: 'Sessões Táticas', desc: 'Sessões de acompanhamento',      icon: CheckSquare2 },
  { key: 'acesso_materiais',        label: 'Materiais',       desc: 'Biblioteca de conteúdos',        icon: BookOpen },
  { key: 'acesso_ia_comercial',     label: 'IA Comercial',    desc: 'IA de apoio comercial',          icon: Zap },
] as const;

export default function AdminProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [ias, setIas] = useState<IAConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Produto, 'id' | 'ordem_index'>>(EMPTY_FORM);

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: prods }, { data: pils }, { data: iaList }] = await Promise.all([
        supabase.from('platform_products').select('*').order('ordem_index'),
        supabase.from('platform_pilares').select('id, nome, icone').order('ordem_index'),
        supabase.from('platform_ia_config').select('id, name').order('name'),
      ]);
      setProdutos((prods as Produto[]) || []);
      setPilares((pils as Pilar[]) || []);
      setIas((iaList as IAConfig[]) || []);
    } catch {
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(p: Produto) {
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      descricao: p.descricao || '',
      preco_mensal: p.preco_mensal,
      duracao_dias: p.duracao_dias,
      pilares_liberados: p.pilares_liberados || [],
      ias_liberadas: p.ias_liberadas || [],
      acesso_cerebro: p.acesso_cerebro,
      acesso_crm: p.acesso_crm,
      acesso_sessoes_taticas: p.acesso_sessoes_taticas,
      acesso_materiais: p.acesso_materiais,
      acesso_ia_comercial: p.acesso_ia_comercial,
      max_leads: p.max_leads,
      max_usuarios_crm: p.max_usuarios_crm,
      ativo: p.ativo,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('platform_products').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
        toast.success('Produto atualizado.');
      } else {
        const maxIdx = produtos.length ? Math.max(...produtos.map(p => p.ordem_index)) + 1 : 1;
        const { error } = await supabase.from('platform_products').insert({ ...form, ordem_index: maxIdx });
        if (error) throw error;
        toast.success('Produto criado.');
      }
      setModalOpen(false);
      loadData();
    } catch {
      toast.error('Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('platform_products').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Produto excluído.');
      setDeleteId(null);
      loadData();
    } catch {
      toast.error('Erro ao excluir produto. Verifique se ele não está em uso por algum cliente.');
    } finally {
      setDeleting(false);
    }
  }

  async function toggleAtivo(p: Produto) {
    const { error } = await supabase.from('platform_products').update({ ativo: !p.ativo }).eq('id', p.id);
    if (error) { toast.error('Erro ao alterar status.'); return; }
    toast.success(p.ativo ? 'Produto desativado.' : 'Produto ativado.');
    loadData();
  }

  function togglePilar(id: string) {
    setForm(f => ({
      ...f,
      pilares_liberados: f.pilares_liberados.includes(id)
        ? f.pilares_liberados.filter(x => x !== id)
        : [...f.pilares_liberados, id],
    }));
  }

  function toggleIA(id: string) {
    setForm(f => ({
      ...f,
      ias_liberadas: f.ias_liberadas.includes(id)
        ? f.ias_liberadas.filter(x => x !== id)
        : [...f.ias_liberadas, id],
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <Layers className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Produtos</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">Gerencie os planos e acessos da plataforma</p>
        </div>
        <Button onClick={openCreate} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo Produto
        </Button>
      </div>

      {/* Grid de Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : produtos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
          <Layers className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum produto cadastrado.</p>
          <Button variant="outline" size="sm" onClick={openCreate} className="mt-2 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Criar primeiro produto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {produtos.map(p => (
            <div
              key={p.id}
              className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col"
              style={{ opacity: p.ativo ? 1 : 0.55 }}
            >
              <div className="p-5 space-y-4 flex-1">
              {/* Topo */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-foreground leading-tight truncate">{p.nome}</h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0"
                      style={{
                        borderColor: p.ativo ? '#22c55e' : '#6b7280',
                        color: p.ativo ? '#22c55e' : '#6b7280',
                      }}
                    >
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  {p.descricao && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.descricao}</p>
                  )}
                </div>
              </div>

              {/* Duração */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Duração</p>
                <p className="text-sm font-semibold text-foreground">
                  {p.duracao_dias >= 99999 ? '♾️ Vitalício' : `${p.duracao_dias} dias`}
                </p>
              </div>

              {/* Funcionalidades */}
              <div className="flex flex-wrap gap-1.5">
                {FUNCIONALIDADES.map(f => {
                  const on = p[f.key as keyof Produto] as boolean;
                  return (
                    <span
                      key={f.key}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                      style={{
                        borderColor: on ? 'hsl(var(--foreground))' : 'hsl(var(--border))',
                        color: on ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                        background: on ? 'hsl(var(--foreground) / 0.08)' : 'transparent',
                      }}
                    >
                      {on ? '✓ ' : ''}{f.label}
                    </span>
                  );
                })}
              </div>

              {/* Contadores */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  {(p.pilares_liberados || []).length} {(p.pilares_liberados || []).length === 1 ? 'pilar' : 'pilares'}
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {(p.ias_liberadas || []).length} IAs
                </span>
              </div>

              </div>
              {/* Ações */}
              <div className="flex items-center justify-end px-5 py-3 border-t border-border/40 bg-muted/20 gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" onClick={() => setDeleteId(p.id)} title="Excluir produto">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className={`h-7 text-[11px] gap-1 border-border/60 ${p.ativo ? 'text-muted-foreground hover:text-red-500' : 'text-emerald-600'}`} onClick={() => toggleAtivo(p)}>
                  <Power className="h-3 w-3" /> {p.ativo ? 'Desativar' : 'Ativar'}
                </Button>
                <Button size="sm" className="h-7 text-[11px] gap-1 bg-foreground text-background hover:bg-foreground/90" onClick={() => openEdit(p)}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Excluir produto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja excluir este produto? Esta ação é <strong>irreversível</strong> e pode afetar clientes que utilizam este produto.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setDeleteId(null)} disabled={deleting}>Cancelar</Button>
            <Button onClick={handleDelete} disabled={deleting} className="h-9 rounded-lg text-xs font-semibold gap-1.5 bg-red-600 hover:bg-red-700 text-white">
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar/Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Informações Gerais */}
            <section className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Informações Gerais</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nome do produto <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: G.C.A. — Gestão Clínica Avançada"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Descrição</Label>
                  <Textarea
                    value={form.descricao || ''}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Descreva o que está incluído neste plano..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Duração do acesso (dias)</Label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Switch
                        checked={form.duracao_dias >= 99999}
                        onCheckedChange={val => setForm(f => ({ ...f, duracao_dias: val ? 99999 : 30 }))}
                      />
                      <span className="text-xs font-medium text-muted-foreground">Acesso vitalício</span>
                    </label>
                  </div>
                  {form.duracao_dias < 99999 && (
                    <Input
                      type="number"
                      min={1}
                      value={form.duracao_dias}
                      onChange={e => setForm(f => ({ ...f, duracao_dias: Number(e.target.value) }))}
                    />
                  )}
                  {form.duracao_dias >= 99999 && (
                    <p className="text-xs text-muted-foreground font-medium px-1">Sem data de expiração</p>
                  )}
                </div>
              </div>
            </section>

            {/* Acesso à Trilha */}
            {pilares.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Acesso à Trilha — Pilares</h3>
                <div className="space-y-2">
                  {pilares.map(pilar => (
                    <label key={pilar.id} className="flex items-center gap-3 cursor-pointer rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40 transition-colors">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        checked={form.pilares_liberados.includes(pilar.id)}
                        onChange={() => togglePilar(pilar.id)}
                      />
                      <span className="text-sm font-medium text-foreground flex-1">
                        {pilar.nome}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* Acesso às IAs */}
            {ias.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Acesso às IAs</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground underline font-medium"
                      onClick={() => setForm(f => ({ ...f, ias_liberadas: ias.map(i => i.id) }))}
                    >
                      Selecionar todos
                    </button>
                    <span className="text-muted-foreground text-[11px]">·</span>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:underline font-medium"
                      onClick={() => setForm(f => ({ ...f, ias_liberadas: [] }))}
                    >
                      Desmarcar todos
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ias.map(ia => (
                    <label key={ia.id} className="flex items-center gap-3 cursor-pointer rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40 transition-colors">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        checked={form.ias_liberadas.includes(ia.id)}
                        onChange={() => toggleIA(ia.id)}
                      />
                      <span className="text-sm font-medium text-foreground flex-1 truncate">{ia.name}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* Funcionalidades do Sistema */}
            <section className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Funcionalidades do Sistema</h3>
              <div className="space-y-2">
                {FUNCIONALIDADES.map(f => (
                  <div key={f.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <f.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">{f.label}</p>
                        <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={form[f.key as keyof typeof form] as boolean}
                      onCheckedChange={val => setForm(prev => ({ ...prev, [f.key]: val }))}
                    />
                  </div>
                ))}
              </div>
            </section>

          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="h-9 rounded-lg text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 px-5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
