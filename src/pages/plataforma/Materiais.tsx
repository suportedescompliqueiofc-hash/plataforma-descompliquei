import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookMarked, Plus, Loader2, Pencil, Trash2, Swords, FolderOpen,
  Clock, ArrowRight, LayoutTemplate, FileText, ClipboardList, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMeusMateriais, useDeleteDocumento, useCreateDocumento } from '@/hooks/useMeusMateriais';
import { useAllArsenalTemplates, ArsenalTemplateComJoins } from '@/hooks/useArsenal';
import NovoMaterialModal from '@/components/plataforma/NovoMaterialModal';

// ─── Cores ─────────────────────────────────────────────────────────────────────

const SLUG_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'diagnostico-clareza':                { bg: 'bg-violet-500/15', text: 'text-violet-300', dot: 'bg-violet-400' },
  'oferta-precificacao-valor':          { bg: 'bg-amber-500/15',  text: 'text-amber-300',  dot: 'bg-amber-400' },
  'atendimento-conversao':              { bg: 'bg-cyan-500/15',   text: 'text-cyan-300',   dot: 'bg-cyan-400' },
  'funil-followup-reativacao':          { bg: 'bg-emerald-500/15',text: 'text-emerald-300',dot: 'bg-emerald-400' },
  'alto-ticket-protocolos-recorrencia': { bg: 'bg-rose-500/15',   text: 'text-rose-300',   dot: 'bg-rose-400' },
  'canais-aquisicao':                   { bg: 'bg-blue-500/15',   text: 'text-blue-300',   dot: 'bg-blue-400' },
  'montando-equipe-comercial':          { bg: 'bg-orange-500/15', text: 'text-orange-300', dot: 'bg-orange-400' },
  'gestao-time-comercial':              { bg: 'bg-indigo-500/15', text: 'text-indigo-300', dot: 'bg-indigo-400' },
};

const SLUG_COLORS_LIGHT: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  'diagnostico-clareza':                { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500',  border: 'border-violet-200' },
  'oferta-precificacao-valor':          { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   border: 'border-amber-200' },
  'atendimento-conversao':              { bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    border: 'border-cyan-200' },
  'funil-followup-reativacao':          { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  'alto-ticket-protocolos-recorrencia': { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500',    border: 'border-rose-200' },
  'canais-aquisicao':                   { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-200' },
  'montando-equipe-comercial':          { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500',  border: 'border-orange-200' },
  'gestao-time-comercial':              { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  border: 'border-indigo-200' },
};

const DEFAULT_COLOR_DARK = { bg: 'bg-white/[0.06]', text: 'text-white/50', dot: 'bg-white/30' };
const DEFAULT_COLOR_LIGHT = { bg: 'bg-muted/40', text: 'text-muted-foreground', dot: 'bg-muted-foreground', border: 'border-border/60' };

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Diagnóstico — estrutura dos blocos ───────────────────────────────────────

interface PerguntaDiag { key: string; label: string; }
interface BlocoDiag { id: number; titulo: string; descricao: string; perguntas: PerguntaDiag[]; }

const BLOCOS_DIAGNOSTICO: BlocoDiag[] = [
  {
    id: 1, titulo: 'Sobre a sua clínica', descricao: 'Informações gerais e modelo de atendimento',
    perguntas: [
      { key: 'p1',  label: 'Nome da clínica' },
      { key: 'p2',  label: 'Especialidade principal' },
      { key: 'p3',  label: 'Modelo de atendimento' },
      { key: 'p3a', label: '% do faturamento via convênio' },
      { key: 'p3b', label: 'Interesse em reduzir dependência do convênio' },
      { key: 'p3c', label: 'Serviços particulares fora do convênio' },
      { key: 'p3d', label: 'Pacientes do convênio conhecem serviços particulares?' },
      { key: 'p3e', label: 'Ticket médio nos procedimentos particulares' },
      { key: 'p4',  label: 'Tempo no mercado' },
      { key: 'p5',  label: 'Cidade e estado' },
      { key: 'p6',  label: 'Tipo de clínica' },
      { key: 'p7',  label: 'Dias de atendimento por semana' },
      { key: 'p8',  label: 'Volume médio de atendimentos/mês' },
    ],
  },
  {
    id: 2, titulo: 'Geração de demanda', descricao: 'Canais, tráfego pago e perfil dos pacientes',
    perguntas: [
      { key: 'p9',        label: 'Avaliação do volume de demanda atual' },
      { key: 'p10',       label: 'Base de pacientes anteriores' },
      { key: 'p10a',      label: 'Comunicação ativa com a base' },
      { key: 'p10b',      label: 'Acompanha quem não voltou em 6 meses?' },
      { key: 'p11',       label: 'Canais que geram leads hoje' },
      { key: 'p12',       label: 'Canal principal' },
      { key: 'p13',       label: 'Resiliência se canal principal parasse' },
      { key: 'p14',       label: 'Investe em tráfego pago' },
      { key: 'p14a_ativo', label: 'Investimento mensal em tráfego' },
      { key: 'p14b_ativo', label: 'Quem gerencia o tráfego' },
      { key: 'p14c_ativo', label: 'Rastreia leads dos anúncios?' },
      { key: 'p14d_ativo', label: 'Satisfação com o retorno do tráfego' },
      { key: 'p14e_ativo', label: 'Gargalo principal (gerar vs. converter)' },
      { key: 'p14a_parou', label: 'Por que parou o tráfego' },
      { key: 'p14b_parou', label: 'Pretende retomar o tráfego?' },
      { key: 'p14a_nunca', label: 'Por que nunca investiu em tráfego' },
      { key: 'p14b_nunca', label: 'Interesse em começar com tráfego pago' },
      { key: 'p15',       label: 'Perfil predominante dos pacientes' },
      { key: 'p16',       label: 'Pacientes chegam decididos?' },
      { key: 'p17',       label: 'Preço é a principal objeção?' },
      { key: 'p18',       label: '% da receita de pacientes recorrentes/indicações' },
      { key: 'p19',       label: 'Maior desafio na geração de demanda' },
    ],
  },
  {
    id: 3, titulo: 'Faturamento e oferta', descricao: 'Receita, ticket médio e estrutura de produtos',
    perguntas: [
      { key: 'p20', label: 'Faturamento médio mensal' },
      { key: 'p21', label: 'Ticket médio por procedimento' },
      { key: 'p22', label: 'Procedimento que mais gera receita' },
      { key: 'p23', label: 'Vende avulsos ou protocolos/pacotes?' },
      { key: 'p24', label: 'Tem protocolos com nome e narrativa próprios?' },
      { key: 'p25', label: 'Oferece recorrência?' },
      { key: 'p26', label: 'Clareza sobre margem de lucro?' },
      { key: 'p27', label: 'Maior custo operacional' },
    ],
  },
  {
    id: 4, titulo: 'Conversão e atendimento', descricao: 'Como os leads se tornam pacientes',
    perguntas: [
      { key: 'p28', label: 'Leads novos por mês' },
      { key: 'p29', label: 'Tempo para responder um lead novo' },
      { key: 'p30', label: 'Quem faz o primeiro atendimento?' },
      { key: 'p31', label: 'Tem processo definido de atendimento?' },
      { key: 'p32', label: 'Taxa de conversão estimada (lead → fechamento)' },
      { key: 'p33', label: 'Tempo entre primeiro contato e fechamento' },
      { key: 'p34', label: 'Faz follow-up com leads que não fecharam?' },
      { key: 'p35', label: 'Reativa pacientes inativos?' },
      { key: 'p36', label: 'Já tentou estruturar processo de atendimento?' },
      { key: 'p37', label: 'Maior dificuldade no atendimento hoje' },
    ],
  },
  {
    id: 5, titulo: 'Estrutura operacional', descricao: 'Equipe, tempo e dependência da sua presença',
    perguntas: [
      { key: 'p38',        label: 'Tem equipe de atendimento ou recepção?' },
      { key: 'p38a_equipe', label: 'Equipe treinada para converter leads?' },
      { key: 'p38b_equipe', label: 'Consegue acompanhar o que a equipe faz?' },
      { key: 'p38c_equipe', label: 'Já teve lead mal atendido pela equipe?' },
      { key: 'p38a_solo',   label: 'Trabalhar sozinho limita o crescimento?' },
      { key: 'p38b_solo',   label: 'Pretende contratar nos próximos 3 meses?' },
      { key: 'p39', label: 'Horas/semana em atividades comerciais' },
      { key: 'p40', label: 'O comercial depende da sua presença direta?' },
      { key: 'p41', label: 'Já teve equipe comercial treinada para vender?' },
      { key: 'p42', label: 'Objetivo: sair da operação ou continuar como fechador?' },
    ],
  },
  {
    id: 6, titulo: 'Gestão do negócio', descricao: 'CRM, métricas e processos documentados',
    perguntas: [
      { key: 'p43', label: 'Usa CRM ou sistema para gerenciar leads?' },
      { key: 'p44', label: 'Acompanha métricas comerciais regularmente?' },
      { key: 'p45', label: 'Tem processos e rotinas documentados?' },
    ],
  },
  {
    id: 7, titulo: 'Objetivos e ambições', descricao: 'Para onde você quer levar a clínica',
    perguntas: [
      { key: 'p46', label: 'Objetivo de faturamento nos próximos 3 meses' },
      { key: 'p47', label: 'Área em que está mais travado hoje' },
      { key: 'p48', label: 'Situação atual da agenda' },
      { key: 'p49', label: 'O que já tentou que não funcionou' },
      { key: 'p50', label: 'Maior obstáculo para crescer hoje' },
      { key: 'p51', label: 'Maior ambição nos próximos 12 meses' },
    ],
  },
];

type MainTab = 'documentos' | 'templates' | 'diagnostico';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Materiais() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: materiais = [], isLoading } = useMeusMateriais();
  const { data: templates = [], isLoading: templatesLoading } = useAllArsenalTemplates();
  const createDoc = useCreateDocumento();
  const deleteDoc = useDeleteDocumento();

  const { data: diagnostico, isLoading: diagLoading } = useQuery({
    queryKey: ['diagnostico-respostas', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('onboarding_diagnosticos' as any)
        .select('respostas, concluido, concluido_em')
        .eq('user_id', user.id)
        .maybeSingle();
      return data as { respostas: Record<string, any>; concluido: boolean; concluido_em: string | null } | null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const [mainTab, setMainTab] = useState<MainTab>('documentos');
  const [modalOpen, setModalOpen] = useState(false);
  const [docFilter, setDocFilter] = useState('todos');
  const [templateFilter, setTemplateFilter] = useState('todos');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── Documentos ───────────────────────────────────────────────────────────

  // Diagnóstico é sempre separado — fixo no topo, não deletável
  const diagnosticoDoc = materiais.find(m => m.categoria === 'diagnostico') ?? null;
  const materiaisRegulares = materiais.filter(m => m.categoria !== 'diagnostico');

  const docCategorias = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of materiaisRegulares) {
      if (m.arsenal_categorias) seen.set(m.arsenal_categorias.slug, m.arsenal_categorias.nome);
    }
    return Array.from(seen.entries()).map(([slug, nome]) => ({ slug, nome }));
  }, [materiaisRegulares]);

  const filteredDocs = materiaisRegulares.filter(m => {
    if (docFilter === 'todos') return true;
    return m.arsenal_categorias?.slug === docFilter;
  });

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteDoc.mutateAsync(id);
      toast.success('Documento excluído.');
    } catch {
      toast.error('Erro ao excluir.');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Templates ────────────────────────────────────────────────────────────

  const templateCategorias = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of templates) {
      if (t.arsenal_categorias) seen.set(t.arsenal_categorias.slug, t.arsenal_categorias.nome);
    }
    return Array.from(seen.entries()).map(([slug, nome]) => ({ slug, nome }));
  }, [templates]);

  const filteredTemplates = templates.filter(t => {
    if (templateFilter === 'todos') return true;
    return t.arsenal_categorias?.slug === templateFilter;
  });

  const handleUseTemplate = async (t: ArsenalTemplateComJoins) => {
    const existing = materiais.find(m => m.ferramenta_id === t.ferramenta_id);
    if (existing) {
      navigate(`/plataforma/materiais/${existing.id}`);
      toast.info('Você já tem um documento para esta ferramenta. Abrindo...');
      return;
    }
    try {
      const id = await createDoc.mutateAsync({
        titulo: t.titulo,
        conteudo: t.conteudo,
        ferramenta_id: t.ferramenta_id,
        categoria_arsenal_id: t.categoria_arsenal_id,
      });
      navigate(`/plataforma/materiais/${id}`);
    } catch {
      toast.error('Erro ao criar documento a partir do template.');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ─── Hero ─── */}
      <div data-tutorial="materiais-header" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0e06] via-[#1f1208] to-[#1a0e06] px-8 py-9 sm:px-10">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full opacity-55 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #ea580c, transparent 65%)' }} />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-35 blur-[80px]"
          style={{ background: 'radial-gradient(circle, #d97706, transparent 65%)' }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/[0.07] border border-white/[0.08]">
                <BookMarked className="h-5 w-5 text-white/80" />
              </div>
              <div className="h-px w-16 bg-gradient-to-r from-white/20 to-transparent" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
              Meus Materiais
            </h1>
            <p className="text-[13px] text-white/40 max-w-md leading-relaxed">
              Seus processos, scripts e estruturas — prontos para usar e evoluir.
            </p>
          </div>

          <Button
            onClick={() => setModalOpen(true)}
            className="h-10 rounded-xl text-[13px] font-semibold bg-white text-slate-900 hover:bg-white/90 px-5 gap-2 shadow-lg flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            Novo Documento
          </Button>
        </div>
      </div>

      {/* ─── Tab switcher ─── */}
      <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {([
          { id: 'documentos', label: `Documentos${materiais.length > 0 ? ` (${materiais.length})` : ''}`, icon: <FileText className="h-3.5 w-3.5" /> },
          { id: 'templates',  label: `Templates${templates.length > 0 ? ` (${templates.length})` : ''}`,   icon: <LayoutTemplate className="h-3.5 w-3.5" /> },
          { id: 'diagnostico', label: 'Diagnóstico', icon: <ClipboardList className="h-3.5 w-3.5" /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
              mainTab === tab.id
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Documentos ─── */}
      {mainTab === 'documentos' && (
        <>
          {/* Filtros */}
          {materiais.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {(['todos', ...docCategorias.map(c => c.slug)]).map(key => {
                const label = key === 'todos' ? 'Todos' : docCategorias.find(c => c.slug === key)?.nome ?? key;
                return (
                  <button
                    key={key}
                    onClick={() => setDocFilter(key)}
                    className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 border ${
                      docFilter === key
                        ? 'bg-foreground text-background border-transparent shadow-sm'
                        : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Lista */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : materiaisRegulares.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/60">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <FolderOpen className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Você ainda não tem documentos salvos.</p>
              <p className="text-[12px] text-muted-foreground/50 mt-1 max-w-xs">
                Crie um novo documento ou acesse uma ferramenta do Arsenal para construir o primeiro.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <Button
                  onClick={() => setModalOpen(true)}
                  className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo Documento
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/plataforma/arsenal')}
                  className="h-9 rounded-lg text-[12px] font-medium px-4 gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Swords className="h-3.5 w-3.5" />
                  Ver Arsenal
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum documento nesta categoria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocs.map(m => {
                const c = m.arsenal_categorias
                  ? (SLUG_COLORS[m.arsenal_categorias.slug] ?? DEFAULT_COLOR_DARK)
                  : DEFAULT_COLOR_DARK;
                const preview = stripHtml(m.conteudo).slice(0, 110);

                return (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/plataforma/materiais/${m.id}`)}
                    className="group relative w-full text-left overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-border hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-5 flex flex-col h-full min-h-[160px]">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {m.arsenal_categorias && (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                              {m.arsenal_categorias.nome.split(' ')[0]}
                            </span>
                          )}
                          {m.arsenal_ferramentas && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-medium bg-muted/60 text-muted-foreground">
                              {m.arsenal_ferramentas.nome}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/plataforma/materiais/${m.id}`); }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={e => handleDeleteClick(e, m.id)}
                            disabled={deletingId === m.id}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                            title="Excluir"
                          >
                            {deletingId === m.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              : <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />}
                          </button>
                        </div>
                      </div>

                      <h3 className="text-[14px] font-semibold text-foreground leading-snug mb-2 line-clamp-2 font-display">
                        {m.titulo || 'Sem título'}
                      </h3>
                      <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                        {preview || 'Documento vazio...'}
                      </p>
                      <div className="flex items-center gap-1 mt-4 text-[11px] text-muted-foreground/50">
                        <Clock className="h-3 w-3" />
                        {format(new Date(m.updated_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Templates ─── */}
      {mainTab === 'templates' && (
        <>
          {/* Filtros */}
          {templates.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {(['todos', ...templateCategorias.map(c => c.slug)]).map(key => {
                const label = key === 'todos' ? 'Todos' : templateCategorias.find(c => c.slug === key)?.nome ?? key;
                return (
                  <button
                    key={key}
                    onClick={() => setTemplateFilter(key)}
                    className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 border ${
                      templateFilter === key
                        ? 'bg-foreground text-background border-transparent shadow-sm'
                        : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Lista de templates */}
          {templatesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/60">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <LayoutTemplate className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Nenhum template disponível ainda.</p>
              <p className="text-[12px] text-muted-foreground/50 mt-1 max-w-xs">
                Os templates são criados pela equipe Descompliquei e estarão disponíveis em breve.
              </p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum template nesta categoria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(t => {
                const slug = t.arsenal_categorias?.slug ?? '';
                const c = SLUG_COLORS_LIGHT[slug] ?? DEFAULT_COLOR_LIGHT;
                const hasDoc = materiais.some(m => m.ferramenta_id === t.ferramenta_id);

                return (
                  <div
                    key={t.id}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-border hover:shadow-md transition-all duration-200"
                  >
                    {/* Accent bar */}
                    <div className={`h-1 w-full ${c.dot}`} />

                    <div className="p-5 flex flex-col flex-1">
                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        {t.arsenal_categorias && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text} border ${c.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                            {t.arsenal_categorias.nome.split(' ')[0]}
                          </span>
                        )}
                        {t.arsenal_ferramentas && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/40">
                            {t.arsenal_ferramentas.nome}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-[14px] font-semibold text-foreground leading-snug mb-1.5 font-display">
                        {t.titulo}
                      </h3>

                      {/* Description */}
                      {t.descricao && (
                        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                          {t.descricao}
                        </p>
                      )}

                      {/* CTA */}
                      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                        {hasDoc && (
                          <span className="text-[11px] text-muted-foreground/50">Já tem documento</span>
                        )}
                        <Button
                          onClick={() => handleUseTemplate(t)}
                          disabled={createDoc.isPending}
                          className={`h-8 rounded-lg text-[11px] font-semibold gap-1.5 px-3 ${
                            hasDoc
                              ? 'bg-muted text-muted-foreground hover:bg-muted/80 ml-auto'
                              : 'bg-foreground text-background hover:bg-foreground/90 ml-auto'
                          }`}
                        >
                          {createDoc.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <LayoutTemplate className="h-3 w-3" />
                          )}
                          {hasDoc ? 'Ver Documento' : 'Usar Template'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Diagnóstico ─── */}
      {mainTab === 'diagnostico' && (
        <>
          {diagLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !diagnostico?.respostas || Object.keys(diagnostico.respostas).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/60">
              <div className="p-3 rounded-xl bg-muted/40 mb-3">
                <ClipboardList className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Diagnóstico ainda não preenchido.</p>
              <p className="text-[12px] text-muted-foreground/50 mt-1 max-w-xs">
                Complete o onboarding para ver suas respostas aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Badge de status */}
              {diagnostico.concluido && (
                <div className="flex items-center gap-2 text-[12px] text-emerald-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Diagnóstico concluído
                  {diagnostico.concluido_em && (
                    <span className="text-muted-foreground/50 font-normal">
                      — {format(new Date(diagnostico.concluido_em), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </span>
                  )}
                </div>
              )}

              {BLOCOS_DIAGNOSTICO.map(bloco => {
                const respostas = diagnostico.respostas ?? {};
                const perguntasRespondidas = bloco.perguntas.filter(p => {
                  const v = respostas[p.key];
                  return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
                });
                if (perguntasRespondidas.length === 0) return null;

                return (
                  <div key={bloco.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    {/* Header do bloco */}
                    <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-muted text-[12px] font-bold text-muted-foreground font-mono">
                          {bloco.id}
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-foreground">{bloco.titulo}</p>
                          <p className="text-[11px] text-muted-foreground/50 mt-0.5">{bloco.descricao}</p>
                        </div>
                        <span className="ml-auto text-[10px] font-medium text-muted-foreground/40">
                          {perguntasRespondidas.length}/{bloco.perguntas.length} respondidas
                        </span>
                      </div>
                    </div>

                    {/* Campos */}
                    <div className="divide-y divide-border/30">
                      {perguntasRespondidas.map(p => {
                        const valor = respostas[p.key];
                        const isArray = Array.isArray(valor);
                        return (
                          <div key={p.key} className="px-5 py-3.5 flex items-start gap-4">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 w-52 shrink-0 pt-0.5 leading-relaxed">
                              {p.label}
                            </p>
                            <div className="flex-1 min-w-0">
                              {isArray ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {(valor as string[]).map((v, i) => (
                                    <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-muted text-[12px] font-medium text-foreground border border-border/60">
                                      {v}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[13px] text-foreground leading-relaxed">{String(valor)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Confirmar exclusão ─── */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O documento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Modal Novo Documento ─── */}
      <NovoMaterialModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={id => navigate(`/plataforma/materiais/${id}`)}
        existingMateriais={materiais}
      />
    </div>
  );
}
