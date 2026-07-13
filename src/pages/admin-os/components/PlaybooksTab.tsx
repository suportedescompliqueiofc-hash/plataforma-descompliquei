import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2, Circle, Copy, AlertTriangle, Plus, Zap,
  ChevronDown, Info, Clock, FileText, Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { type CSClient, clientName } from '../types/cs';
import { TemplatesTab } from './TemplatesTab';

// ── Tipos ─────────────────────────────────────────────────────────────────

interface Protocol {
  id: string;
  client_id: string;
  tipo: string;
  status: string;
  passo_atual: string | null;
  passos_concluidos: string[];
  tipo_risco: string | null;
  notas: string | null;
  iniciado_em: string;
}

interface CSTemplate {
  id: string;
  nome: string;
  categoria: string;
  fase: string | null;
  conteudo: string;
  variaveis: string[];
  ativo: boolean;
}

interface PlaybookStep {
  key: string;
  label: string;
  titulo: string;
  descricao?: string;
  auto?: boolean;
  templateFase?: string;
  urgente?: boolean;
}

// ── Definições dos playbooks ───────────────────────────────────────────────

const ONBOARDING_STEPS: PlaybookStep[] = [
  { key: 'd0_kickoff', label: 'D0', titulo: 'Kickoff realizado', descricao: 'Primeira reunião de onboarding — apresentar a plataforma, confirmar diagnóstico e definir primeiros passos.' },
  { key: 'd3_whatsapp', label: 'D3', titulo: 'WhatsApp de acompanhamento enviado', templateFase: 'd3' },
  { key: 'd3_diagnostico', label: 'D3', titulo: 'Diagnóstico verificado na plataforma', auto: true, descricao: 'Verificar se o cliente concluiu o formulário de diagnóstico.' },
  { key: 'd7_jornada', label: 'D7', titulo: 'Jornada ativa + primeiro passo iniciado', auto: true, templateFase: 'd7', descricao: 'Confirmar que o cliente tem uma jornada com pelo menos 1 passo concluído.' },
  { key: 'd14_ferramenta', label: 'D14', titulo: 'Primeira ferramenta do Arsenal construída', templateFase: 'd14', descricao: 'Confirmar que o cliente acessou e construiu ao menos 1 ferramenta do Arsenal.' },
  { key: 'd21_crm', label: 'D21', titulo: 'CRM com ao menos 1 lead ativo', templateFase: 'd21', descricao: 'Verificar no CRM do cliente se há leads cadastrados. Se não, incentivar com template.' },
  { key: 'd30_reuniao', label: 'D30', titulo: 'Reunião de balanço do mês 1 realizada', urgente: true, descricao: 'Reunião de 45 min com pauta: resultados do mês, dificuldades e próximos 30 dias. Coletar NPS.' },
];

const RISCO_STEPS: PlaybookStep[] = [
  { key: 'passo1_diagnostico', label: 'Passo 1', titulo: 'Diagnóstico do tipo de risco identificado', auto: true, descricao: 'Tipos: Inatividade, Reclamação recorrente, Ghosting, Menção a concorrente, Pedido de cancelamento.' },
  { key: 'passo2_d1', label: 'D+1', titulo: 'Contato informal via WhatsApp (D+1)', templateFase: 'ghosting_d1', descricao: 'Mensagem curta e sem pressão. Objetivo: abrir canal, não resolver ainda.' },
  { key: 'passo3_d3', label: 'D+3', titulo: 'Mensagem direta (se sem resposta em 24h)', templateFase: 'ghosting_d3', descricao: 'Se não respondeu, enviar mensagem mais direta perguntando o que está travando.' },
  { key: 'passo4_plano', label: 'D+7', titulo: 'Plano de recuperação acordado', descricao: 'Reunião para entender a raiz do problema e definir um plano de 30 dias ajustado ao contexto do cliente.' },
  { key: 'passo5_review', label: 'D+30', titulo: 'Review do plano de recuperação', urgente: true, descricao: 'Avaliar se o cliente retomou o ritmo. Se não houver melhora, escalar para líder de CS.' },
];

const ENGAJAMENTO_STEPS: PlaybookStep[] = [
  { key: 'e1_preparo', label: 'Antes', titulo: 'Preparar dados da reunião', auto: true, descricao: 'Verificar na plataforma: % jornada concluída, ferramentas construídas, leads no CRM.' },
  { key: 'e2_reuniao', label: 'Reunião', titulo: 'Reunião de acompanhamento (45 min)', urgente: true, descricao: 'Pauta: 5min aquecimento → 10min resultados CRM → 15min progresso jornada → 10min travamentos → 5min comprometimento dos próximos 15 dias.' },
  { key: 'e3_resumo', label: 'Após', titulo: 'Resumo pós-reunião enviado', templateFase: 'pos_reuniao', descricao: 'Enviar um resumo com os próximos passos combinados em até 1h após a reunião.' },
  { key: 'e4_proximo', label: 'Agenda', titulo: 'Próxima reunião agendada', descricao: 'Definir a data da próxima reunião quinzenal/mensal antes de encerrar a conversa atual.' },
];

const ESCALADA_STEPS: PlaybookStep[] = [
  { key: 'e1_nivel', label: 'Passo 1', titulo: 'Nível de escalada definido', descricao: 'N1: CSM adicional na conta · N2: Líder de CS assume · N3: Cofundador envolvido. Escolher conforme gravidade e histórico.' },
  { key: 'e2_briefing', label: 'Passo 2', titulo: 'Briefing do cliente montado', auto: true, descricao: 'Compilar: tempo como cliente, health score atual, progresso na jornada, último contato, o que foi tentado, hipótese da raiz do problema.' },
  { key: 'e3_apresentacao', label: 'Passo 3', titulo: 'Novo responsável apresentado ao cliente', templateFase: 'apresentacao_lider', descricao: 'Introdução calorosa — o cliente não deve sentir que foi "passado adiante".' },
  { key: 'e4_call', label: 'Passo 4', titulo: 'Call de diagnóstico profundo realizada', descricao: 'Novo responsável ouve sem defender. Meta: identificar a raiz real, não os sintomas.' },
  { key: 'e5_plano', label: 'Passo 5', titulo: 'Plano de ação conjunto definido (30 dias)', descricao: 'Plano co-criado com o cliente: metas claras, datas, responsáveis dos dois lados.' },
  { key: 'e6_review', label: 'D+30', titulo: 'Review de 30 dias — cliente recuperado', urgente: true, descricao: 'Avaliar se o cliente reconquistou confiança e engajamento. Documentar resultado.' },
];

const EXPANSAO_STEPS: PlaybookStep[] = [
  { key: 'x1_criterios', label: 'Passo 1', titulo: 'Critérios de prontidão verificados (6/6)', auto: true, descricao: 'Health verde por 60d+ · Jornada ≥ 70% · CRM ativo com conversões · Resultado declarado · Comparece às reuniões · NPS ≥ 8.' },
  { key: 'x2_nps', label: 'Passo 2', titulo: 'NPS coletado (se não coletado recentemente)', descricao: 'Coletar NPS como conversa natural — não como formulário. O score valida a prontidão para indicar.' },
  { key: 'x3_indicacao', label: 'Passo 3', titulo: 'Abordagem de indicação realizada', templateFase: 'indicacao', descricao: 'Conversa leve, não transacional. O cliente indica porque quer ajudar alguém — não por benefício.' },
  { key: 'x4_depoimento', label: 'Passo 4', titulo: 'Depoimento solicitado', templateFase: 'depoimento', descricao: 'Áudio ou vídeo de 1-2 min. Orientar: antes/depois, resultado específico, como foi o processo.' },
  { key: 'x5_beneficios', label: 'Passo 5', titulo: 'Programa de benefícios apresentado', descricao: 'Apresentar o que o cliente ganha por cada indicação convertida: desconto, bônus ou reconhecimento público.' },
];

const PLAYBOOK_CONFIGS = {
  onboarding: { label: 'Onboarding', steps: ONBOARDING_STEPS, color: 'text-blue-700 bg-blue-50 border-blue-200', dotColor: 'bg-blue-500', desc: 'Protocolo D0–D30 de ativação do cliente' },
  risco: { label: 'Risco de Churn', steps: RISCO_STEPS, color: 'text-red-700 bg-red-50 border-red-200', dotColor: 'bg-red-500', desc: 'Protocolo de resgate em 5 passos' },
  engajamento: { label: 'Engajamento', steps: ENGAJAMENTO_STEPS, color: 'text-violet-700 bg-violet-50 border-violet-200', dotColor: 'bg-violet-500', desc: 'Reunião quinzenal de acompanhamento' },
  escalada: { label: 'Escalada', steps: ESCALADA_STEPS, color: 'text-orange-700 bg-orange-50 border-orange-200', dotColor: 'bg-orange-500', desc: 'Protocolo de escalada para líder ou cofundador' },
  expansao: { label: 'Expansão', steps: EXPANSAO_STEPS, color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500', desc: 'Advocacy, indicações e depoimentos' },
} as const;

type PlaybookTipo = keyof typeof PLAYBOOK_CONFIGS;

const TIPO_RISCO_LABELS: Record<string, string> = {
  inatividade: 'Inatividade na plataforma',
  reclamacao: 'Reclamações recorrentes',
  ghosting: 'Ghosting / sem resposta',
  concorrente: 'Menção a concorrente',
  cancelamento: 'Pedido de cancelamento',
};

// ── Hooks ─────────────────────────────────────────────────────────────────

function useProtocols() {
  return useQuery({
    queryKey: ['cs-protocols'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_client_protocols')
        .select('*')
        .eq('status', 'ativo');
      if (error) throw error;
      return (data || []) as Protocol[];
    },
    staleTime: 60 * 1000,
  });
}

function useTemplates() {
  return useQuery({
    queryKey: ['cs-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_templates')
        .select('*')
        .eq('ativo', true);
      if (error) throw error;
      return (data || []) as CSTemplate[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── TemplateInlineModal ────────────────────────────────────────────────────

function TemplateInlineModal({ template, clientName: name, onClose }: {
  template: CSTemplate;
  clientName: string;
  onClose: () => void;
}) {
  const resolved = template.conteudo.replace(/\[nome\]/gi, name);

  const handleCopy = () => {
    navigator.clipboard.writeText(resolved);
    toast.success('Template copiado');
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{template.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{resolved}</pre>
          </div>
          {template.variaveis.filter(v => v.toLowerCase() !== 'nome').length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] text-muted-foreground/60 font-medium">Variáveis a substituir:</span>
              {template.variaveis.filter(v => v.toLowerCase() !== 'nome').map(v => (
                <span key={v} className="text-[10px] font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">[{v}]</span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs" onClick={onClose}>Fechar</Button>
            <Button className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5" />Copiar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── BriefingEscaladaModal ─────────────────────────────────────────────────

function useBriefingData(client: CSClient) {
  return useQuery({
    queryKey: ['cs-briefing-data', client.id, client.crm_user_id],
    queryFn: async () => {
      const [tpRes, tenantRes, jornadaRes, matRes] = await Promise.allSettled([
        supabase.from('cs_touchpoints')
          .select('resultado, data_contato')
          .eq('client_id', client.id)
          .order('data_contato', { ascending: false })
          .limit(5),
        supabase.from('platform_tenants')
          .select('created_at')
          .eq('organization_id', client.organization_id)
          .limit(1)
          .maybeSingle(),
        client.crm_user_id
          ? supabase.from('jornadas')
              .select('id, jornada_estagios(jornada_passos(concluido))')
              .eq('user_id', client.crm_user_id)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        client.crm_user_id
          ? supabase.from('meus_materiais')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', client.crm_user_id)
          : Promise.resolve({ count: 0 }),
      ]);

      const touchpoints = tpRes.status === 'fulfilled' ? ((tpRes.value as any).data || []) : [];
      const diasNaPlataforma = (tenantRes.status === 'fulfilled' && (tenantRes.value as any).data?.created_at)
        ? differenceInDays(new Date(), new Date((tenantRes.value as any).data.created_at))
        : null;

      let jornadaPct: number | null = null;
      if (jornadaRes.status === 'fulfilled' && (jornadaRes.value as any).data) {
        const j = (jornadaRes.value as any).data;
        const estagios = j.jornada_estagios || [];
        const allPassos = estagios.flatMap((e: any) => e.jornada_passos || []);
        const total = allPassos.length;
        const concluidos = allPassos.filter((p: any) => p.concluido).length;
        jornadaPct = total > 0 ? Math.round(concluidos / total * 100) : 0;
      }

      const ferramentas = matRes.status === 'fulfilled' ? ((matRes.value as any).count ?? 0) : 0;
      return { touchpoints, diasNaPlataforma, jornadaPct, ferramentas };
    },
    staleTime: 2 * 60 * 1000,
  });
}

function BriefingEscaladaModal({ client, protocol, onClose }: {
  client: CSClient;
  protocol: Protocol;
  onClose: () => void;
}) {
  const { data, isLoading } = useBriefingData(client);
  const [oQueAconteceu, setOQueAconteceu] = useState('');
  const [oQueFoiTentado, setOQueFoiTentado] = useState('');
  const [hipotese, setHipotese] = useState('');
  const [copied, setCopied] = useState(false);

  const hs = client.latest_health;
  const lastDias = client.cs_ultimo_touchpoint
    ? differenceInDays(new Date(), new Date(client.cs_ultimo_touchpoint))
    : null;
  const nivelStr = protocol.notas ? protocol.notas.split('\n')[0] : 'Não definido';

  const generateBriefing = () => [
    `BRIEFING DE ESCALADA — ${clientName(client)}`,
    `Gerado em ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `DADOS DO CLIENTE`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ...(client.product_name ? [`Produto: ${client.product_name}`] : []),
    ...(data?.diasNaPlataforma != null ? [`Tempo como cliente: ${data.diasNaPlataforma} dias`] : []),
    ...(client.cs_fase ? [`Fase atual: ${client.cs_fase}`] : []),
    `Nível de escalada: ${nivelStr}`,
    ``,
    `SAÚDE DO CLIENTE`,
    hs ? `Health Score: ${hs.score_total} — ${hs.status_calculado ?? '—'}` : `Health Score: Sem avaliação registrada`,
    ...(hs ? [`  • Ativação: ${hs.dim_ativacao}`, `  • Jornada: ${hs.dim_jornada}`, `  • Arsenal: ${hs.dim_arsenal}`, `  • Responsividade: ${hs.dim_responsividade}`] : []),
    ``,
    `PROGRESSO NA PLATAFORMA`,
    `  • Jornada: ${data?.jornadaPct != null ? `${data.jornadaPct}% concluída` : 'Não iniciada'}`,
    `  • Ferramentas do Arsenal: ${data?.ferramentas ?? 0} construída(s)`,
    ``,
    `HISTÓRICO DE CONTATOS`,
    lastDias != null ? `  • Último contato: há ${lastDias} dias` : `  • Sem contato registrado`,
    ...(data?.touchpoints?.[0]?.resultado ? [`  • Último resultado: ${data.touchpoints[0].resultado}`] : []),
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `ANÁLISE DO CSM`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `O que aconteceu:`,
    oQueAconteceu || `[preencher]`,
    ``,
    `O que já foi tentado:`,
    oQueFoiTentado || `[preencher]`,
    ``,
    `Hipótese da raiz do problema:`,
    hipotese || `[preencher]`,
  ].join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(generateBriefing());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Briefing copiado');
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Briefing de Escalada — {clientName(client)}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Info className="h-4 w-4 animate-pulse text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pt-2">
            <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
              <pre className="text-[11px] text-orange-900/80 whitespace-pre-wrap font-mono leading-relaxed">
                {[
                  `${clientName(client)} · ${nivelStr}`,
                  data?.diasNaPlataforma != null ? `Dia ${data.diasNaPlataforma} na plataforma` : '',
                  ``,
                  hs ? `Health: ${hs.score_total} (${hs.status_calculado})` : `Health: sem avaliação`,
                  data?.jornadaPct != null ? `Jornada: ${data.jornadaPct}%` : `Jornada: não iniciada`,
                  `Arsenal: ${data?.ferramentas ?? 0} ferramenta(s)`,
                  lastDias != null ? `Último contato: há ${lastDias} dias` : `Sem contato registrado`,
                ].filter(Boolean).join('\n')}
              </pre>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">O que aconteceu</Label>
                <Textarea value={oQueAconteceu} onChange={e => setOQueAconteceu(e.target.value)} placeholder="Descreva a situação que gerou a escalada..." rows={2} className="text-sm rounded-lg border-border/60 resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">O que já foi tentado</Label>
                <Textarea value={oQueFoiTentado} onChange={e => setOQueFoiTentado(e.target.value)} placeholder="Abordagens já realizadas pelo CSM..." rows={2} className="text-sm rounded-lg border-border/60 resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hipótese da raiz do problema</Label>
                <Textarea value={hipotese} onChange={e => setHipotese(e.target.value)} placeholder="Qual é a causa-raiz provável?" rows={2} className="text-sm rounded-lg border-border/60 resize-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs" onClick={onClose}>Fechar</Button>
              <Button className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copiado!' : 'Copiar briefing completo'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── DepoimentoModal ────────────────────────────────────────────────────────

function DepoimentoModal({ client, onClose }: {
  client: CSClient;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formato, setFormato] = useState('audio');
  const [conteudo, setConteudo] = useState('');
  const [link, setLink] = useState('');
  const [notas, setNotas] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cs_depoimentos').insert({
        client_id: client.id,
        formato,
        conteudo: conteudo || null,
        link_externo: link || null,
        coletado_por: user?.id ?? null,
        notas: notas || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Depoimento registrado');
      qc.invalidateQueries({ queryKey: ['cs-depoimentos', client.id] });
      onClose();
    },
    onError: () => toast.error('Erro ao registrar depoimento'),
  });

  const FORMATO_LABELS: Record<string, string> = {
    audio: 'Áudio (WhatsApp / gravação)',
    video: 'Vídeo',
    texto: 'Texto escrito',
    case: 'Case completo',
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Registrar Depoimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-[11px] text-muted-foreground/70 -mt-1">{clientName(client)}</p>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Formato</Label>
            <Select value={formato} onValueChange={setFormato}>
              <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FORMATO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Link (opcional)</Label>
            <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." className="h-10 text-sm rounded-lg border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conteúdo / Transcrição (opcional)</Label>
            <Textarea value={conteudo} onChange={e => setConteudo(e.target.value)} placeholder="Resumo ou transcrição do depoimento..." rows={3} className="text-sm rounded-lg border-border/60 resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notas internas (opcional)</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Contexto, onde usar, formatos disponíveis..." rows={2} className="text-sm rounded-lg border-border/60 resize-none" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Salvando...' : 'Registrar depoimento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── PlaybookChecklist ──────────────────────────────────────────────────────

function PlaybookChecklist({ protocol, client, steps, templates, onToggleStep, onComplete, onCancel }: {
  protocol: Protocol | null;
  client: CSClient;
  steps: PlaybookStep[];
  templates: CSTemplate[];
  onToggleStep: (stepKey: string, done: boolean) => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [openTemplate, setOpenTemplate] = useState<CSTemplate | null>(null);
  const [notasExpanded, setNotasExpanded] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showDepoimento, setShowDepoimento] = useState(false);

  const completed = new Set<string>(protocol?.passos_concluidos ?? []);
  const diasAtivos = protocol ? differenceInDays(new Date(), parseISO(protocol.iniciado_em)) : 0;
  const totalDone = steps.filter(s => completed.has(s.key)).length;
  const pct = Math.round((totalDone / steps.length) * 100);

  const getTemplate = (fase: string) => templates.find(t => t.fase === fase);

  const tipo = (protocol?.tipo ?? 'onboarding') as PlaybookTipo;
  const config = PLAYBOOK_CONFIGS[tipo];

  return (
    <div className="space-y-4">
      {/* ── Header do protocolo ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-6 pt-5 pb-5">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              {/* Type badge + day counter */}
              <div className="flex items-center gap-2 flex-wrap mb-2.5">
                <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border', config.color)}>
                  <div className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
                  {config.label}
                </span>
                <span className="text-[10px] text-muted-foreground/40 tabular-nums">· Dia {diasAtivos} do protocolo</span>
              </div>
              <p className="text-lg font-bold tracking-tight font-display">{clientName(client)}</p>
            </div>

            {/* Progress box */}
            <div className={cn(
              'flex flex-col items-center justify-center min-w-[68px] h-[68px] rounded-2xl border-2 flex-shrink-0',
              pct === 100 ? 'border-emerald-300 bg-emerald-50' : 'border-border/40 bg-muted/20'
            )}>
              <span className={cn('text-xl font-bold tabular-nums font-display leading-none', pct === 100 && 'text-emerald-600')}>{pct}%</span>
              <span className="text-[9px] font-bold uppercase tracking-widest mt-1.5 text-muted-foreground/50">{totalDone}/{steps.length}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500', config.dotColor)} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Risk type banner */}
        {protocol?.tipo === 'risco' && protocol.tipo_risco && (
          <div className="px-5 py-2.5 border-t border-red-100 bg-red-50/60 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            <p className="text-[11px] font-semibold text-red-700">{TIPO_RISCO_LABELS[protocol.tipo_risco]}</p>
          </div>
        )}

        {/* Footer actions */}
        {protocol && (
          <div className="px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center gap-2">
            {totalDone === steps.length && (
              <Button size="sm" className="h-8 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5 px-3" onClick={onComplete}>
                <CheckCircle2 className="h-3.5 w-3.5" />Concluir protocolo
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 rounded-lg text-[11px] border-border/60 px-3 text-muted-foreground hover:text-foreground" onClick={onCancel}>
              Cancelar protocolo
            </Button>
          </div>
        )}
      </div>

      {/* ── Checklist — estilo timeline ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-6">
          <div className="relative">
            {/* Linha conectora vertical */}
            <div className="absolute left-[13px] top-5 bottom-4 w-px bg-border/40" />

            <div className="space-y-0">
              {steps.map((step, i) => {
                const done = completed.has(step.key);
                const isNext = !done && steps.slice(0, i).every(s => completed.has(s.key));
                const tpl = step.templateFase ? getTemplate(step.templateFase) : null;
                const isLast = i === steps.length - 1;

                return (
                  <div key={step.key} className={cn('relative flex items-start gap-4', !isLast && 'pb-5')}>
                    {/* Indicador circular */}
                    <button
                      onClick={() => onToggleStep(step.key, !done)}
                      className="relative z-10 flex-shrink-0 mt-0.5 transition-transform active:scale-95"
                    >
                      {done ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        </div>
                      ) : isNext ? (
                        <div className="w-7 h-7 rounded-full border-2 border-foreground bg-card flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-border/40 bg-muted/20 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
                        </div>
                      )}
                    </button>

                    {/* Conteúdo */}
                    <div className={cn('flex-1 min-w-0', done && 'opacity-40')}>
                      {/* Badges de contexto */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={cn(
                          'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded tabular-nums',
                          done    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          isNext  ? 'bg-foreground text-background' :
                                    'bg-muted text-muted-foreground/50'
                        )}>{step.label}</span>
                        {step.urgente && isNext && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />Prioridade
                          </span>
                        )}
                        {step.auto && !done && (
                          <span className="text-[9px] font-medium text-muted-foreground/40 bg-muted/60 px-1.5 py-0.5 rounded">Auto</span>
                        )}
                      </div>

                      {/* Título */}
                      <p className={cn(
                        'text-sm font-semibold leading-snug',
                        done    ? 'line-through text-muted-foreground/40' :
                        isNext  ? 'text-foreground' : 'text-muted-foreground/70'
                      )}>{step.titulo}</p>

                      {/* Descrição — sempre visível para o passo corrente */}
                      {!done && step.descricao && (
                        <p className={cn(
                          'text-[11px] mt-1.5 leading-relaxed',
                          isNext ? 'text-muted-foreground/70' : 'text-muted-foreground/40'
                        )}>{step.descricao}</p>
                      )}

                      {/* Action buttons */}
                      {!done && (
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {tpl && (
                            <button
                              onClick={() => setOpenTemplate(tpl)}
                              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border/60 bg-card text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                            >
                              <Copy className="h-3 w-3" />{tpl.nome}
                            </button>
                          )}
                          {protocol?.tipo === 'escalada' && step.key === 'e2_briefing' && (
                            <button
                              onClick={() => setShowBriefing(true)}
                              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-orange-200 bg-orange-50/60 text-[11px] font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
                            >
                              <FileText className="h-3 w-3" />Compilar briefing
                            </button>
                          )}
                          {protocol?.tipo === 'expansao' && step.key === 'x4_depoimento' && (
                            <button
                              onClick={() => setShowDepoimento(true)}
                              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <Award className="h-3 w-3" />Registrar depoimento
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Notas ── */}
      <button
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        onClick={() => setNotasExpanded(e => !e)}
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', notasExpanded && 'rotate-180')} />
        {notasExpanded ? 'Ocultar notas internas' : 'Ver notas internas do protocolo'}
      </button>
      {notasExpanded && (
        <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2">Notas internas</p>
          <p className="text-xs text-muted-foreground/60 leading-relaxed">{protocol?.notas || 'Nenhuma nota registrada.'}</p>
        </div>
      )}

      {openTemplate && (
        <TemplateInlineModal template={openTemplate} clientName={clientName(client)} onClose={() => setOpenTemplate(null)} />
      )}
      {showBriefing && protocol && (
        <BriefingEscaladaModal client={client} protocol={protocol} onClose={() => setShowBriefing(false)} />
      )}
      {showDepoimento && (
        <DepoimentoModal client={client} onClose={() => setShowDepoimento(false)} />
      )}
    </div>
  );
}

// ── StartProtocolModal ─────────────────────────────────────────────────────

function StartProtocolModal({ open, onClose, client, tipo, onStarted }: {
  open: boolean;
  onClose: () => void;
  client: CSClient;
  tipo: PlaybookTipo;
  onStarted: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tipoRisco, setTipoRisco] = useState('inatividade');
  const [nivelEscalada, setNivelEscalada] = useState('2');
  const [notas, setNotas] = useState('');
  const config = PLAYBOOK_CONFIGS[tipo];

  const mutation = useMutation({
    mutationFn: async () => {
      const notasComNivel = tipo === 'escalada'
        ? `Nível ${nivelEscalada}${notas ? `\n\n${notas}` : ''}`
        : notas || null;
      const { error } = await supabase.from('cs_client_protocols').insert({
        client_id: client.id,
        tipo,
        status: 'ativo',
        passos_concluidos: [],
        tipo_risco: tipo === 'risco' ? tipoRisco : null,
        notas: notasComNivel,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Playbook de ${config.label} iniciado`);
      qc.invalidateQueries({ queryKey: ['cs-protocols'] });
      onStarted();
      onClose();
      setNotas('');
    },
    onError: () => toast.error('Erro ao iniciar protocolo'),
  });

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Iniciar Playbook — {config.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className={cn('rounded-xl border px-4 py-3', config.color)}>
            <p className="text-xs font-semibold">{clientName(client)}</p>
            <p className="text-[10px] mt-0.5 opacity-70">{config.desc}</p>
          </div>
          {tipo === 'risco' && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo de risco identificado</Label>
              <Select value={tipoRisco} onValueChange={setTipoRisco}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_RISCO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {tipo === 'escalada' && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nível de escalada</Label>
              <Select value={nivelEscalada} onValueChange={setNivelEscalada}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">N1 — CSM adicional na conta</SelectItem>
                  <SelectItem value="2">N2 — Líder de CS assume</SelectItem>
                  <SelectItem value="3">N3 — Cofundador envolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notas iniciais (opcional)</Label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Contexto, observações..." rows={2} className="text-sm rounded-lg border-border/60 resize-none" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Iniciando...' : 'Iniciar protocolo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function PlaybooksTab({ clients }: { clients: CSClient[] }) {
  const qc = useQueryClient();
  const [view, setView] = useState<'protocolos' | 'templates'>('protocolos');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedTipo, setSelectedTipo] = useState<PlaybookTipo>('onboarding');
  const [startModal, setStartModal] = useState(false);

  const { data: protocols = [] } = useProtocols();
  const { data: templates = [] } = useTemplates();

  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null;
  const activeProtocol = protocols.find(p => p.client_id === selectedClientId && p.tipo === selectedTipo) ?? null;
  const config = PLAYBOOK_CONFIGS[selectedTipo];

  // Toggle step mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ stepKey, done }: { stepKey: string; done: boolean }) => {
      if (!activeProtocol) return;
      const current: string[] = activeProtocol.passos_concluidos ?? [];
      const updated = done ? [...current.filter(k => k !== stepKey), stepKey] : current.filter(k => k !== stepKey);
      const { error } = await supabase
        .from('cs_client_protocols')
        .update({ passos_concluidos: updated, updated_at: new Date().toISOString() })
        .eq('id', activeProtocol.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cs-protocols'] }),
    onError: () => toast.error('Erro ao atualizar passo'),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!activeProtocol) return;
      const { error } = await supabase
        .from('cs_client_protocols')
        .update({ status: 'concluido', updated_at: new Date().toISOString() })
        .eq('id', activeProtocol.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Protocolo concluído');
      qc.invalidateQueries({ queryKey: ['cs-protocols'] });
    },
    onError: () => toast.error('Erro ao concluir protocolo'),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!activeProtocol) return;
      const { error } = await supabase
        .from('cs_client_protocols')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('id', activeProtocol.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Protocolo cancelado');
      qc.invalidateQueries({ queryKey: ['cs-protocols'] });
    },
    onError: () => toast.error('Erro ao cancelar protocolo'),
  });

  // Clients with any active protocol — for quick overview
  const clientsWithProtocols = clients.filter(c => protocols.some(p => p.client_id === c.id));

  return (
    <div className="space-y-5">
      {/* Toggle: Protocolos / Biblioteca de Templates */}
      <div className="bg-muted/40 rounded-xl p-1 flex gap-0.5 w-fit">
        <button
          onClick={() => setView('protocolos')}
          className={cn('px-4 py-2 rounded-lg text-xs font-semibold transition-all', view === 'protocolos' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          Protocolos
        </button>
        <button
          onClick={() => setView('templates')}
          className={cn('px-4 py-2 rounded-lg text-xs font-semibold transition-all', view === 'templates' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          Biblioteca de Templates
        </button>
      </div>

      {view === 'templates' ? (
        <TemplatesTab />
      ) : (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">

      {/* ── Sidebar esquerda ── */}
      <div className="space-y-4">

        {/* Seleção de cliente */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border/40 bg-muted/[0.03]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Selecionar Cliente</p>
          </div>
          <div className="p-3">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="h-10 text-sm rounded-xl border-border/60">
                <SelectValue placeholder="Escolher cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{clientName(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tipos de playbook */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border/40 bg-muted/[0.03]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Playbook</p>
          </div>
          <div className="p-2 space-y-0.5">
            {(Object.entries(PLAYBOOK_CONFIGS) as [PlaybookTipo, typeof PLAYBOOK_CONFIGS[PlaybookTipo]][]).map(([tipo, cfg]) => {
              const hasActive = selectedClientId && protocols.some(p => p.client_id === selectedClientId && p.tipo === tipo);
              const isSelected = selectedTipo === tipo;
              return (
                <button
                  key={tipo}
                  onClick={() => setSelectedTipo(tipo)}
                  className={cn(
                    'w-full text-left px-3.5 py-3 rounded-xl transition-all',
                    isSelected ? 'bg-foreground text-background' : 'hover:bg-muted/20 text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-0.5', cfg.dotColor)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{cfg.label}</span>
                        {hasActive && (
                          <span className={cn(
                            'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                            isSelected ? 'bg-white/20 text-white' : 'bg-foreground text-background'
                          )}>ATIVO</span>
                        )}
                      </div>
                      <p className={cn('text-[10px] mt-0.5 truncate', isSelected ? 'text-background/60' : 'text-muted-foreground/50')}>{cfg.desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Protocolos ativos */}
        {clientsWithProtocols.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Protocolos Ativos</p>
              <span className="text-[10px] font-bold tabular-nums text-muted-foreground/40">{clientsWithProtocols.length}</span>
            </div>
            <div className="divide-y divide-border/40">
              {clientsWithProtocols.slice(0, 6).map(c => {
                const ps = protocols.filter(p => p.client_id === c.id);
                const isSelected = c.id === selectedClientId;
                return (
                  <button
                    key={c.id}
                    className={cn('w-full text-left px-4 py-3 transition-colors', isSelected ? 'bg-muted/10' : 'hover:bg-muted/[0.03]')}
                    onClick={() => setSelectedClientId(c.id)}
                  >
                    <p className="text-xs font-semibold truncate mb-1.5">{clientName(c)}</p>
                    <div className="flex gap-1 flex-wrap">
                      {ps.map(p => {
                        const pcfg = PLAYBOOK_CONFIGS[p.tipo as PlaybookTipo];
                        return (
                          <span key={p.id} className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border', pcfg?.color)}>
                            {pcfg?.label}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Painel direito ── */}
      <div>
        {!selectedClient ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="p-4 rounded-2xl bg-muted/40 mb-4">
              <Zap className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Selecione um cliente</p>
            <p className="text-[11px] text-muted-foreground/50 mt-1 max-w-[200px]">Escolha um cliente à esquerda para ver e executar o playbook</p>
          </div>
        ) : activeProtocol ? (
          <PlaybookChecklist
            protocol={activeProtocol}
            client={selectedClient}
            steps={config.steps}
            templates={templates}
            onToggleStep={(key, done) => toggleMutation.mutate({ stepKey: key, done })}
            onComplete={() => completeMutation.mutate()}
            onCancel={() => cancelMutation.mutate()}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex flex-col items-center justify-center py-14 text-center px-6">
              <div className={cn('p-4 rounded-2xl mb-4 border', config.color)}>
                <Zap className="h-7 w-7" />
              </div>
              <p className="text-base font-bold font-display">{config.label}</p>
              <p className="text-[11px] text-muted-foreground/50 mt-1.5 mb-6 max-w-[260px] leading-relaxed">{config.desc}</p>
              <Button
                className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
                onClick={() => setStartModal(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Iniciar para {clientName(selectedClient)}
              </Button>
            </div>

            {/* Preview dos passos */}
            <div className="border-t border-border/40 px-5 py-4 bg-muted/[0.02]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-3">{config.steps.length} passos do protocolo</p>
              <div className="space-y-2">
                {config.steps.map((step, i) => (
                  <div key={step.key} className="flex items-center gap-2.5 opacity-50">
                    <div className="w-5 h-5 rounded-full border-2 border-border/40 bg-muted/20 flex-shrink-0" />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[9px] font-bold text-muted-foreground/50 tabular-nums">{step.label}</span>
                      <span className="text-[11px] text-muted-foreground/60 truncate">{step.titulo}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedClient && startModal && (
        <StartProtocolModal
          open={startModal}
          onClose={() => setStartModal(false)}
          client={selectedClient}
          tipo={selectedTipo}
          onStarted={() => { }}
        />
      )}
    </div>
      )}
    </div>
  );
}
