import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Brain,
  Calculator,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Compass,
  Copy,
  Edit3,
  FileVideo,
  FileText,
  Film,
  Flag,
  GripVertical,
  LayoutList,
  Loader2,
  MessageSquare,
  MoreVertical,
  Package,
  Plus,
  Save,
  Search,
  Table,
  Target,
  Trash,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';

type PlanType = string;

interface PlatformPillar {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  cor: string | null;
  fase_claro: string | null;
  plano_minimo: PlanType;
  ordem_index: number;
  ativo: boolean;
}

interface PlatformModule {
  id: string;
  pillar: number;
  pilar_id: string | null;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  duracao_minutos: number | null;
  min_plan: PlanType;
  order_index: number;
  active: boolean;
  aprender_content: string | null;
  construa_fields: Array<Record<string, unknown>>;
  valide_checklist: Array<Record<string, unknown>>;
  valide_items: string[];
  finalize_content: string | null;
  thumbnail_url: string | null;
  finalize_success_message: string | null;
  finalize_badge_name: string | null;
  finalize_next_action: string | null;
  icone: string | null;
  cor_badge: string | null;
  prerequisite_module_id: string | null;
  tags: Array<Record<string, unknown> | string>;
}

interface PlatformModuleBlock {
  id: string;
  module_id: string;
  tipo: string;
  titulo: string;
  instrucao: string | null;
  config: Record<string, any> | null;
  ordem_index: number;
  salvar_no_cerebro: boolean;
  cerebro_chave: string | null;
  gera_material: boolean;
  material_categoria: string | null;
}

interface DeleteTarget {
  id: string;
  title: string;
}

interface PillarFormState {
  id?: string;
  nome: string;
  descricao: string;
  fase_claro: string;
  plano_minimo: PlanType;
  ativo: boolean;
}

interface ModuleFormState {
  id?: string;
  title: string;
  description: string;
  pilar_id: string;
  min_plan: PlanType;
  duracao_minutos: number;
  active: boolean;
}

type BlockType =
  | 'texto_guiado'
  | 'matriz_tabela'
  | 'script_atendimento'
  | 'selecao_estrategica'
  | 'calculadora'
  | 'criacao_oferta'
  | 'mapa_icp'
  | 'checklist_acao';

interface BlockTypeDefinition {
  type: BlockType;
  label: string;
  description: string;
  example: string;
  colorClass: string;
  badgeClass: string;
  icon: typeof FileText;
}

interface BlockFormState {
  id?: string;
  module_id: string;
  tipo: BlockType;
  titulo: string;
  instrucao: string;
  config: Record<string, any>;
  ordem_index: number;
  salvar_no_cerebro: boolean;
  cerebro_chave: string;
  gera_material: boolean;
  material_categoria: string;
}

interface SortablePillarHeaderProps {
  pillar: PlatformPillar;
  expanded: boolean;
  moduleCount: number;
  onHeaderClick: () => void;
  onChevronToggle: () => void;
  onEdit: () => void;
  onAddModule: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

interface SortableModuleItemProps {
  module: PlatformModule;
  displayId: string;
  completions: number;
  selected: boolean;
  searchActive: boolean;
  hasVideo: boolean;
  hasConstrua: boolean;
  hasValide: boolean;
  hasFinalize: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  moveTargets: Array<{ id: string; nome: string }>;
  onMoveToPillar: (pillarId: string) => void;
}

function SortableBlockListItem({
  block,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  block: PlatformModuleBlock;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `block:${block.id}`,
    data: { type: 'block', blockId: block.id },
  });
  const definition = BLOCK_TYPE_MAP[block.tipo as BlockType];
  const Icon = definition?.icon || FileText;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-xl border bg-background px-3 py-3 transition-all',
        selected ? 'border-[#E85D24]/40 bg-[#FFF0E8]' : 'border-border hover:bg-muted/20',
        isDragging && 'opacity-60 shadow-lg',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <Icon className={cn('h-4 w-4 shrink-0', definition?.colorClass)} />
            <p className="truncate text-sm font-semibold text-foreground">{block.titulo}</p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className={cn('h-5 rounded-full px-2 text-[10px] font-semibold', definition?.badgeClass)}>
              {definition?.label || block.tipo}
            </Badge>
            {block.salvar_no_cerebro && <Brain className="h-3.5 w-3.5 text-sky-600" />}
            {block.gera_material && <Package className="h-3.5 w-3.5 text-amber-600" />}
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={onDuplicate}>Duplicar bloco</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function SortableValideListItem({
  item,
  index,
  total,
  onTextChange,
  onDescriptionChange,
  onRemove,
}: {
  item: { id?: string; text?: string; description?: string };
  index: number;
  total: number;
  onTextChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onRemove: () => void;
}) {
  const sortableId = item.id || `valide_${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-border bg-muted/10 p-3',
        isDragging && 'opacity-70 shadow-lg',
      )}
    >
      <button
        type="button"
        className="mt-2 cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar item ${index + 1} de ${total}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1 space-y-2">
        <Input
          value={item.text || ''}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={`Item ${index + 1}`}
          className="font-medium"
        />
        <Input
          value={item.description || ''}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Descrição opcional"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
        onClick={onRemove}
      >
        <Trash className="h-4 w-4" />
      </Button>
    </div>
  );
}

const EMPTY_PILLAR_FORM: PillarFormState = {
  nome: '',
  descricao: '',
  fase_claro: '',
  plano_minimo: '',
  ativo: true,
};

const EMPTY_MODULE_FORM: ModuleFormState = {
  title: '',
  description: '',
  pilar_id: '',
  min_plan: '',
  duracao_minutos: 0,
  active: true,
};

const CEREBRO_FIELD_OPTIONS = [
  'posicionamento',
  'posicionamento_frase',
  'icp',
  'icp_demografico',
  'icp_psicografico',
  'icp_comportamento',
  'icp_canais',
  'icp_objecoes',
  'diferencial',
  'diferencial_competitivo',
  'proposta_de_valor',
  'estrategia_audiencia',
  'icp_principal',
  'icp_dores',
  'icp_desejos',
  'oferta_principal',
  'script_atendimento',
  'script_comercial',
  'campanha_estrategia',
  'metricas_trafego',
  'metricas_comercial',
  'metricas_comerciais',
  'metricas_precificacao',
  'ticket_minimo',
  'ticket_com_margem',
  'cpl_referencia',
  'metrica_financeira',
  'checklist_implantacao',
];

function normalizeValideChecklist(
  checklist: Array<Record<string, unknown>> | null | undefined,
  items: string[] | null | undefined,
) {
  if (Array.isArray(checklist) && checklist.length > 0) {
    return checklist.map((item, index) => ({
      id: String(item.id || `valide_${index + 1}`),
      text: String(item.text || ''),
      description: String(item.description || ''),
      required: item.required !== false,
    }));
  }

  if (Array.isArray(items) && items.length > 0) {
    return items.map((text, index) => ({
      id: `valide_${index + 1}`,
      text: String(text || ''),
      description: '',
      required: true,
    }));
  }

  return [];
}

const MATERIAL_CATEGORY_OPTIONS = [
  'Posicionamento',
  'ICP',
  'Oferta',
  'Criativo',
  'Script',
  'Campanha',
  'Diagnóstico',
  'Precificação',
  'Operação',
];

const BLOCK_TYPE_DEFINITIONS: BlockTypeDefinition[] = [
  {
    type: 'texto_guiado',
    label: 'Texto Guiado',
    description: 'Reflexões abertas, análises e diagnósticos livres.',
    example: 'Pergunta aberta com resposta longa e orientada.',
    colorClass: 'text-sky-600',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    icon: FileText,
  },
  {
    type: 'matriz_tabela',
    label: 'Matriz / Tabela',
    description: 'Procedimentos, concorrentes, calendário e análises comparativas.',
    example: 'Colunas configuráveis com linhas dinâmicas.',
    colorClass: 'text-emerald-600',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: Table,
  },
  {
    type: 'script_atendimento',
    label: 'Script de Atendimento',
    description: 'Scripts de vendas, WhatsApp, recepção e objeções.',
    example: 'Etapas com nome, descrição e exemplo guiado.',
    colorClass: 'text-violet-600',
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    icon: MessageSquare,
  },
  {
    type: 'selecao_estrategica',
    label: 'Seleção Estratégica',
    description: 'Posicionamento, nicho e decisões estratégicas.',
    example: 'Lista de opções únicas ou múltiplas com contexto.',
    colorClass: 'text-orange-600',
    badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    icon: Compass,
  },
  {
    type: 'calculadora',
    label: 'Calculadora',
    description: 'Ticket médio, ROI, metas e faturamento potencial.',
    example: 'Entradas numéricas com fórmulas de resultado.',
    colorClass: 'text-amber-600',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Calculator,
  },
  {
    type: 'criacao_oferta',
    label: 'Criação de Oferta',
    description: 'Precificação, estruturação de oferta e cardápio.',
    example: 'Campos padrão editáveis e campos personalizados.',
    colorClass: 'text-rose-600',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: Package,
  },
  {
    type: 'mapa_icp',
    label: 'Mapa de ICP',
    description: 'Estruturação do paciente ideal por seções.',
    example: 'Seções visíveis com campos por perfil.',
    colorClass: 'text-teal-600',
    badgeClass: 'border-teal-200 bg-teal-50 text-teal-700',
    icon: Target,
  },
  {
    type: 'checklist_acao',
    label: 'Checklist de Ação',
    description: 'Implementação prática e configuração de ferramentas.',
    example: 'Itens acionáveis com resposta opcional.',
    colorClass: 'text-green-700',
    badgeClass: 'border-green-200 bg-green-50 text-green-700',
    icon: CheckSquare,
  },
];

const BLOCK_TYPE_MAP = BLOCK_TYPE_DEFINITIONS.reduce<Record<BlockType, BlockTypeDefinition>>((accumulator, item) => {
  accumulator[item.type] = item;
  return accumulator;
}, {} as Record<BlockType, BlockTypeDefinition>);

const db = supabase as any;

function planLabel(plan: string | null | undefined) {
  if (!plan) return '—';
  return plan.toUpperCase();
}

function getModuleDuration(moduleLike: Partial<PlatformModule>) {
  return Number(moduleLike.duracao_minutos ?? moduleLike.duration_minutes ?? 0);
}

function createTempModuleId() {
  return `tmp_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function createDefaultBlockConfig(type: BlockType) {
  switch (type) {
    case 'texto_guiado':
      return { label: '', placeholder: '', min_chars: 0, max_chars: 500 };
    case 'matriz_tabela':
      return {
        colunas: [{ label: 'Coluna 1', tipo: 'texto' }],
        linhas_iniciais: 3,
        pode_adicionar_linhas: true,
        pode_remover_linhas: true,
      };
    case 'script_atendimento':
      return {
        etapas: [{ nome: 'Abertura', descricao: '', exemplo: '' }],
        mostrar_exemplos_cliente: true,
      };
    case 'selecao_estrategica':
      return {
        multipla: false,
        opcoes: [{ label: 'Opção 1', valor: 'opcao_1', contexto_adicional: '' }],
      };
    case 'calculadora':
      return {
        campos_entrada: [{ label: 'Campo 1', nome: 'campo_1', tipo: 'numero', valor_padrao: 0 }],
        campos_resultado: [{ label: 'Resultado', formula: 'campo_1', resultado_label: 'Resultado final' }],
      };
    case 'criacao_oferta':
      return {
        campos: [
          { label: 'Nome do procedimento', obrigatorio: true, personalizado: false },
          { label: 'Resultado prometido', obrigatorio: true, personalizado: false },
          { label: 'Público-alvo', obrigatorio: true, personalizado: false },
          { label: 'Diferenciais', obrigatorio: true, personalizado: false },
          { label: 'Preço', obrigatorio: true, personalizado: false },
          { label: 'Condições', obrigatorio: false, personalizado: false },
          { label: 'CTA', obrigatorio: true, personalizado: false },
          { label: 'O que está incluído', obrigatorio: true, personalizado: false },
        ],
      };
    case 'mapa_icp':
      return {
        secoes: [
          { nome: 'Perfil Demográfico', visivel: true, campos: [{ label: 'Faixa etária', tipo: 'texto' }] },
          { nome: 'Perfil Psicográfico', visivel: true, campos: [{ label: 'Desejos centrais', tipo: 'texto' }] },
          { nome: 'Comportamento de Compra', visivel: true, campos: [{ label: 'Momento de decisão', tipo: 'texto' }] },
          { nome: 'Canais de Chegada', visivel: true, campos: [{ label: 'Canal principal', tipo: 'texto' }] },
          { nome: 'Objeções Frequentes', visivel: true, campos: [{ label: 'Objeção principal', tipo: 'texto' }] },
        ],
      };
    case 'checklist_acao':
      return {
        itens: [{ texto: 'Novo item', descricao: '', tem_campo_resposta: false }],
      };
    default:
      return {};
  }
}

function createBlockForm(type: BlockType, moduleId: string, orderIndex: number): BlockFormState {
  return {
    module_id: moduleId,
    tipo: type,
    titulo: BLOCK_TYPE_MAP[type].label,
    instrucao: '',
    config: createDefaultBlockConfig(type),
    ordem_index: orderIndex,
    salvar_no_cerebro: false,
    cerebro_chave: '',
    gera_material: false,
    material_categoria: '',
  };
}

function normalizeBlock(block: PlatformModuleBlock): BlockFormState {
  return {
    id: block.id,
    module_id: block.module_id,
    tipo: block.tipo as BlockType,
    titulo: block.titulo,
    instrucao: block.instrucao || '',
    config: block.config || createDefaultBlockConfig(block.tipo as BlockType),
    ordem_index: block.ordem_index || 0,
    salvar_no_cerebro: !!block.salvar_no_cerebro,
    cerebro_chave: block.cerebro_chave || '',
    gera_material: !!block.gera_material,
    material_categoria: block.material_categoria || '',
  };
}

function SortablePillarHeader({
  pillar,
  expanded,
  moduleCount,
  onHeaderClick,
  onChevronToggle,
  onEdit,
  onAddModule,
  onDuplicate,
  onToggleActive,
  onDelete,
  children,
}: SortablePillarHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `pillar:${pillar.id}`,
    data: { type: 'pillar', pillarId: pillar.id },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-b border-border bg-background',
        isDragging && 'rounded-xl border border-[#E85D24]/30 shadow-lg',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          className="cursor-grab rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onHeaderClick}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="truncate text-sm font-semibold text-foreground">{pillar.nome}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {moduleCount} {moduleCount === 1 ? 'módulo' : 'módulos'}
          </span>
        </button>

        <button
          type="button"
          onClick={onChevronToggle}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onEdit}>Editar pilar</DropdownMenuItem>
            <DropdownMenuItem onSelect={onAddModule}>Adicionar módulo</DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>Duplicar pilar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onToggleActive}>
              {pillar.ativo ? 'Desativar pilar' : 'Ativar pilar'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
              Excluir pilar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {children}
    </div>
  );
}

function PillarDropZone({
  pillarId,
  active,
  children,
}: {
  pillarId: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `pillar-drop:${pillarId}`,
    data: { type: 'pillar-drop', pillarId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'space-y-1 px-2 pb-2 transition-colors',
        active && 'opacity-60',
        isOver && 'rounded-xl bg-[#FFF4EE] ring-1 ring-[#E85D24]/30',
      )}
    >
      {children}
    </div>
  );
}

function SortableModuleItem({
  module,
  displayId,
  completions,
  selected,
  searchActive,
  hasVideo,
  hasConstrua,
  hasValide,
  hasFinalize,
  onSelect,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
  moveTargets,
  onMoveToPillar,
}: SortableModuleItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `module:${module.id}`,
    disabled: searchActive,
    data: { type: 'module', moduleId: module.id, pillarId: module.pilar_id },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-xl border bg-background px-3 py-3 transition-all',
        selected
          ? 'border-[#E85D24]/40 bg-[#FFF0E8] shadow-sm'
          : 'border-border/70 hover:border-[#E85D24]/20 hover:bg-muted/20',
        !module.active && 'opacity-70',
        isDragging && 'shadow-lg ring-1 ring-[#E85D24]/30',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className={cn(
            'mt-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            searchActive ? 'cursor-not-allowed opacity-40' : 'cursor-grab',
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-bold text-[#E85D24]">{displayId}</span>
            <p className={cn('truncate text-sm font-semibold', module.active ? 'text-foreground' : 'text-muted-foreground')}>
              {module.title}
            </p>
            {!module.active && (
              <Badge variant="destructive" className="h-5 rounded-full px-2 text-[10px] uppercase">
                Inativo
              </Badge>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {hasVideo && <Film className="h-4 w-4 text-sky-500" />}
              {hasConstrua && <Edit3 className="h-4 w-4 text-emerald-500" />}
              {hasValide && <CheckCircle2 className="h-4 w-4 text-amber-500" />}
              {hasFinalize && <Flag className="h-4 w-4 text-violet-500" />}
            </div>
            <Badge variant="outline" className="h-6 rounded-full border-border bg-background px-2.5 text-[10px] font-medium text-muted-foreground">
              {completions} alunos
            </Badge>
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>Duplicar</DropdownMenuItem>
            {moveTargets.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Mover para pilar</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  {moveTargets.map((target) => (
                    <DropdownMenuItem key={target.id} onSelect={() => onMoveToPillar(target.id)}>
                      {target.nome}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem onSelect={onToggleActive}>
              {module.active ? 'Desativar' : 'Ativar'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function AdminTrilha() {
  const navigate = useNavigate();
  const { moduleId: routeModuleId, pillarId: routePillarId } = useParams<{ moduleId?: string; pillarId?: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pillars, setPillars] = useState<PlatformPillar[]>([]);
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [blocksByModule, setBlocksByModule] = useState<Record<string, PlatformModuleBlock[]>>({});
  const [completions, setCompletions] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState((sessionStorage.getItem('admin_trilha_tab') as string) || 'info');
  const [savingTab, setSavingTab] = useState<string | null>(null);
  const [savingBlock, setSavingBlock] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPillars, setExpandedPillars] = useState<string[]>([]);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletePillarTarget, setDeletePillarTarget] = useState<DeleteTarget | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<'pillar' | 'module' | null>(null);
  const [editMod, setEditMod] = useState<Partial<PlatformModule>>({});
  const [pillarModalOpen, setPillarModalOpen] = useState(false);
  const [pillarForm, setPillarForm] = useState<PillarFormState>(EMPTY_PILLAR_FORM);
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [moduleForm, setModuleForm] = useState<ModuleFormState>(EMPTY_MODULE_FORM);
  const [blockTypeModalOpen, setBlockTypeModalOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState<BlockFormState | null>(null);
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [deleteBlockTarget, setDeleteBlockTarget] = useState<PlatformModuleBlock | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [showValideModal, setShowValideModal] = useState(false);
  const [newValide, setNewValide] = useState({ text: '', description: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [produtos, setProdutos] = useState<{ id: string; nome: string }[]>([]);
  const isModulePage = !!routeModuleId;
  const isPillarPage = !!routePillarId && !isModulePage;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    document.title = 'Trilha de Aprendizado · Admin OS | Descompliquei';
    void loadData();
  }, []);

  useEffect(() => {
    if (routeModuleId) {
      setSelectedId(routeModuleId);
    } else {
      setSelectedId(null);
    }
  }, [routeModuleId]);

  useEffect(() => {
    sessionStorage.setItem('admin_trilha_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!selectedId) {
      setEditMod({});
      return;
    }

    const current = modules.find((module) => module.id === selectedId);
    if (!current) {
      setSelectedId(null);
      setEditMod({});
      return;
    }

    setEditMod({ ...current, duracao_minutos: getModuleDuration(current) });
  }, [selectedId, modules]);

  useEffect(() => {
    const currentBlocks = selectedId ? (blocksByModule[selectedId] || []).slice().sort((a, b) => a.ordem_index - b.ordem_index) : [];

    if (isCreatingBlock && blockForm && !blockForm.id) {
      return;
    }

    if (!selectedId || currentBlocks.length === 0) {
      setSelectedBlockId(null);
      setBlockForm(null);
      setIsCreatingBlock(false);
      return;
    }

    const nextSelectedId = currentBlocks.some((block) => block.id === selectedBlockId)
      ? selectedBlockId
      : currentBlocks[0].id;

    setSelectedBlockId(nextSelectedId);
    const currentBlock = currentBlocks.find((block) => block.id === nextSelectedId);
    setBlockForm(currentBlock ? normalizeBlock(currentBlock) : null);
    setIsCreatingBlock(false);
  }, [blocksByModule, isCreatingBlock, selectedBlockId, selectedId]);

  const orderedPillars = useMemo(
    () => [...pillars].sort((a, b) => a.ordem_index - b.ordem_index || a.nome.localeCompare(b.nome)),
    [pillars],
  );

  const pillarOrderMap = useMemo(
    () =>
      orderedPillars.reduce<Record<string, number>>((accumulator, pillar, index) => {
        accumulator[pillar.id] = index + 1;
        return accumulator;
      }, {}),
    [orderedPillars],
  );

  const pillarLookup = useMemo(
    () =>
      orderedPillars.reduce<Record<string, PlatformPillar>>((accumulator, pillar) => {
        accumulator[pillar.id] = pillar;
        return accumulator;
      }, {}),
    [orderedPillars],
  );

  const searchValue = searchTerm.trim().toLowerCase();

  const getLegacyPillarId = (legacyPillar: number | null | undefined) =>
    orderedPillars.find((pillar, index) => index + 1 === legacyPillar)?.id ?? null;

  const getModulePillarId = (module: Partial<PlatformModule>) => module.pilar_id ?? getLegacyPillarId(module.pillar);

  const getPillarModules = (pillarId: string) =>
    modules
      .filter((module) => getModulePillarId(module) === pillarId)
      .sort((a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title));

  const isModuleVisible = (module: PlatformModule) =>
    !searchValue || module.title.toLowerCase().includes(searchValue);

  const getVisiblePillarModules = (pillarId: string) => getPillarModules(pillarId).filter((module) => module.active && isModuleVisible(module));

  const inactiveModules = useMemo(
    () =>
      modules
        .filter((module) => !module.active && isModuleVisible(module))
        .sort((a, b) => {
          const pillarDiff = (pillarOrderMap[getModulePillarId(a) || ''] || 999) - (pillarOrderMap[getModulePillarId(b) || ''] || 999);
          if (pillarDiff !== 0) return pillarDiff;
          return a.order_index - b.order_index;
        }),
    [modules, pillarOrderMap, searchValue],
  );

  const totalVideoModules = useMemo(() => modules.filter((module) => !!module.video_url).length, [modules]);
  const totalConstruaModules = useMemo(
    () =>
      modules.filter((module) => {
        const legacyFields = Array.isArray(module.construa_fields) ? module.construa_fields.length : 0;
        const dynamicBlocks = blocksByModule[module.id]?.length || 0;
        return legacyFields > 0 || dynamicBlocks > 0;
      }).length,
    [blocksByModule, modules],
  );

  async function loadData(
    preferredSelection?: string | null,
    fallbackMatcher?: (items: PlatformModule[]) => string | null,
  ) {
    setLoading(true);
    try {
      const [{ data: pillarsData, error: pillarsError }, { data: modulesData, error: modulesError }, { data: blocksData, error: blocksError }, { data: progressData, error: progressError }, { data: prodsData }] =
        await Promise.all([
          db.from('platform_pilares').select('*').order('ordem_index', { ascending: true }),
          db.from('platform_modules').select('*').order('order_index', { ascending: true }),
          db.from('platform_module_blocks').select('*').order('ordem_index', { ascending: true }),
          db.from('platform_progress').select('module_id, completed').eq('completed', true),
          supabase.from('platform_products').select('id, nome').eq('ativo', true).order('ordem_index'),
        ]);
      setProdutos((prodsData || []) as { id: string; nome: string }[]);

      if (pillarsError) throw pillarsError;
      if (modulesError) throw modulesError;
      if (blocksError) throw blocksError;
      if (progressError) throw progressError;

      const nextPillars = (pillarsData || []) as PlatformPillar[];
      const nextModules = ((modulesData || []) as PlatformModule[]).map((module) => ({
        ...module,
        construa_fields: Array.isArray(module.construa_fields) ? module.construa_fields : [],
        valide_items: Array.isArray(module.valide_items) ? module.valide_items : [],
        valide_checklist: normalizeValideChecklist(module.valide_checklist, module.valide_items),
        tags: Array.isArray(module.tags) ? module.tags : [],
      }));

      const nextBlocks = (blocksData || []) as PlatformModuleBlock[];
      const nextBlocksByModule = nextBlocks.reduce<Record<string, PlatformModuleBlock[]>>((accumulator, block) => {
        accumulator[block.module_id] = [...(accumulator[block.module_id] || []), block];
        return accumulator;
      }, {});

      const nextCompletions = (progressData || []).reduce<Record<string, number>>((accumulator, item: { module_id: string }) => {
        accumulator[item.module_id] = (accumulator[item.module_id] || 0) + 1;
        return accumulator;
      }, {});

      setPillars(nextPillars);
      setModules(nextModules);
      setBlocksByModule(nextBlocksByModule);
      setCompletions(nextCompletions);

      if (!isModulePage) {
        setSelectedId(null);
      } else if (preferredSelection && nextModules.some((module) => module.id === preferredSelection)) {
        setSelectedId(preferredSelection);
      } else if (fallbackMatcher) {
        const fallbackId = fallbackMatcher(nextModules);
        if (fallbackId) {
          setSelectedId(fallbackId);
        } else if (selectedId && nextModules.some((module) => module.id === selectedId)) {
          setSelectedId(selectedId);
        } else {
          setSelectedId(nextModules.find((module) => module.active)?.id || nextModules[0]?.id || null);
        }
      } else if (selectedId && nextModules.some((module) => module.id === selectedId)) {
        setSelectedId(selectedId);
      } else {
        setSelectedId(nextModules.find((module) => module.active)?.id || nextModules[0]?.id || null);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar trilha',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function moduleHasVideo(module: PlatformModule) {
    return !!module.video_url;
  }

  function moduleHasConstrua(module: PlatformModule) {
    const legacyFields = Array.isArray(module.construa_fields) ? module.construa_fields.length : 0;
    const dynamicBlocks = blocksByModule[module.id]?.length || 0;
    return legacyFields > 0 || dynamicBlocks > 0;
  }

  function moduleHasValide(module: PlatformModule) {
    return (
      (Array.isArray(module.valide_items) && module.valide_items.length > 0) ||
      (Array.isArray(module.valide_checklist) && module.valide_checklist.length > 0)
    );
  }

  function moduleHasFinalize(module: PlatformModule) {
    return !!module.finalize_success_message;
  }

  function getModuleDisplayId(module: PlatformModule) {
    const pillarId = getModulePillarId(module);
    if (!pillarId) return module.id;

    const pillarNumber = pillarOrderMap[pillarId] || module.pillar || 0;
    const moduleIndex = getPillarModules(pillarId).findIndex((item) => item.id === module.id);
    return `${pillarNumber}.${moduleIndex + 1}`;
  }

  async function renumberModules() {
    const { error } = await db.rpc('platform_admin_renumber_modules');
    if (error) throw error;
  }

  async function updatePillarOrder(nextPillars: PlatformPillar[]) {
    await Promise.all(
      nextPillars.map((pillar, index) =>
        db.from('platform_pilares').update({ ordem_index: index + 1 }).eq('id', pillar.id),
      ),
    );
    await renumberModules();
    setPillars(nextPillars.map((pillar, index) => ({ ...pillar, ordem_index: index + 1 })));
  }

  async function persistModulesForPillars(nextModules: PlatformModule[], affectedPillarIds: string[]) {
    const uniquePillars = Array.from(new Set(affectedPillarIds.filter(Boolean)));

    await Promise.all(
      uniquePillars.flatMap((pillarId) => {
        const pillarNumber = pillarOrderMap[pillarId] || orderedPillars.findIndex((pillar) => pillar.id === pillarId) + 1;
        return nextModules
          .filter((module) => getModulePillarId(module) === pillarId)
          .sort((a, b) => a.order_index - b.order_index)
          .map((module, index) =>
            db
              .from('platform_modules')
              .update({
                pilar_id: pillarId,
                pillar: pillarNumber,
                order_index: index + 1,
              })
              .eq('id', module.id),
          );
      }),
    );

    await renumberModules();
  }

  function togglePillarExpanded(pillarId: string) {
    setExpandedPillars((current) =>
      current.includes(pillarId) ? current.filter((id) => id !== pillarId) : [...current, pillarId],
    );
  }

  function expandPillar(pillarId: string) {
    setExpandedPillars((current) => (current.includes(pillarId) ? current : [...current, pillarId]));
  }

  function openModule(moduleId: string) {
    navigate(`/admin/trilha/modulo/${moduleId}`);
  }

  function openPillar(pillarId: string) {
    navigate(`/admin/trilha/pilar/${pillarId}`);
  }

  function openCreatePillarModal() {
    setPillarForm(EMPTY_PILLAR_FORM);
    setPillarModalOpen(true);
  }

  function openEditPillarModal(pillar: PlatformPillar) {
    setPillarForm({
      id: pillar.id,
      nome: pillar.nome,
      descricao: pillar.descricao || '',
      fase_claro: pillar.fase_claro || '',
      plano_minimo: pillar.plano_minimo || 'pca',
      ativo: pillar.ativo,
    });
    setPillarModalOpen(true);
  }

  async function handleSavePillar() {
    if (!pillarForm.nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Preencha o nome do pilar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (pillarForm.id) {
        const { error } = await db
          .from('platform_pilares')
          .update({
            nome: pillarForm.nome.trim(),
            descricao: pillarForm.descricao.trim() || null,
            fase_claro: pillarForm.fase_claro.trim() || null,
            plano_minimo: pillarForm.plano_minimo,
            ativo: pillarForm.ativo,
          })
          .eq('id', pillarForm.id);

        if (error) throw error;

        toast({ title: 'Pilar atualizado com sucesso' });
      } else {
        const nextOrder = orderedPillars.length + 1;
        const { data, error } = await db
          .from('platform_pilares')
          .insert({
            nome: pillarForm.nome.trim(),
            descricao: pillarForm.descricao.trim() || null,
            fase_claro: pillarForm.fase_claro.trim() || null,
            plano_minimo: pillarForm.plano_minimo,
            ativo: pillarForm.ativo,
            ordem_index: nextOrder,
          })
          .select('*')
          .single();

        if (error) throw error;

        const created = data as PlatformPillar;
        setExpandedPillars((current) => Array.from(new Set([...current, created.id])));
        toast({ title: 'Pilar criado com sucesso' });
      }

      setPillarModalOpen(false);
      await loadData(selectedId);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar pilar',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  function openCreateModuleModal(pillarId?: string) {
    setModuleForm({
      ...EMPTY_MODULE_FORM,
      pilar_id: pillarId || orderedPillars.find((pillar) => pillar.ativo)?.id || orderedPillars[0]?.id || '',
    });
    setModuleModalOpen(true);
  }

  function openEditModuleModal(module: PlatformModule) {
    setModuleForm({
      id: module.id,
      title: module.title,
      description: module.description || '',
      pilar_id: getModulePillarId(module) || '',
      min_plan: module.min_plan || 'pca',
      duracao_minutos: getModuleDuration(module),
      active: module.active,
    });
    setModuleModalOpen(true);
  }

  async function handleSaveModule() {
    if (!moduleForm.title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Preencha o título do módulo.',
        variant: 'destructive',
      });
      return;
    }

    if (!moduleForm.pilar_id) {
      toast({
        title: 'Pilar obrigatório',
        description: 'Escolha um pilar para o módulo.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const targetPillarId = moduleForm.pilar_id;
      const targetPillarNumber = pillarOrderMap[targetPillarId] || 1;

      if (moduleForm.id) {
        const original = modules.find((module) => module.id === moduleForm.id);
        const movedPillar = original && getModulePillarId(original) !== targetPillarId;
        const nextOrder = movedPillar ? getPillarModules(targetPillarId).length + 1 : original?.order_index || 1;

        const { error } = await db
          .from('platform_modules')
          .update({
            title: moduleForm.title.trim(),
            description: moduleForm.description.trim() || null,
            pilar_id: targetPillarId,
            pillar: targetPillarNumber,
            min_plan: moduleForm.min_plan,
            duracao_minutos: moduleForm.duracao_minutos,
            duration_minutes: moduleForm.duracao_minutos,
            active: moduleForm.active,
            ...(movedPillar ? { order_index: nextOrder } : {}),
          })
          .eq('id', moduleForm.id);

        if (error) throw error;

        if (movedPillar) {
          await renumberModules();
          await loadData(null, (items) => {
            const matches = items
              .filter((item) => item.title === moduleForm.title.trim() && getModulePillarId(item) === targetPillarId)
              .sort((a, b) => b.order_index - a.order_index);
            return matches[0]?.id || null;
          });
        } else {
          await loadData(moduleForm.id);
        }

        toast({ title: 'Módulo atualizado com sucesso' });
      } else {
        const nextOrder = getPillarModules(targetPillarId).length + 1;
        const tempId = createTempModuleId();
        const { error } = await db.from('platform_modules').insert({
          id: tempId,
          title: moduleForm.title.trim(),
          description: moduleForm.description.trim() || null,
          pilar_id: targetPillarId,
          pillar: targetPillarNumber,
          min_plan: moduleForm.min_plan,
          duracao_minutos: moduleForm.duracao_minutos,
          duration_minutes: moduleForm.duracao_minutos,
          order_index: nextOrder,
          active: moduleForm.active,
          construa_fields: [],
          valide_checklist: [],
          valide_items: [],
        });

        if (error) throw error;

        await renumberModules();
        await loadData(null, (items) => {
          const matches = items
            .filter((item) => item.title === moduleForm.title.trim() && getModulePillarId(item) === targetPillarId)
            .sort((a, b) => b.order_index - a.order_index);
          return matches[0]?.id || null;
        });

        setExpandedPillars((current) => Array.from(new Set([...current, targetPillarId])));
        toast({ title: 'Módulo criado com sucesso' });
      }

      setModuleModalOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar módulo',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function duplicateModule(module: PlatformModule) {
    try {
      const targetPillarId = getModulePillarId(module);
      if (!targetPillarId) throw new Error('Pilar do módulo não encontrado.');

      const nextOrder = getPillarModules(targetPillarId).length + 1;
      const tempId = createTempModuleId();
      const modulePayload = {
        ...module,
        id: tempId,
        title: `${module.title} (cópia)`,
        order_index: nextOrder,
      };

      const { error } = await db.from('platform_modules').insert(modulePayload);
      if (error) throw error;

      const sourceBlocks = blocksByModule[module.id] || [];
      if (sourceBlocks.length > 0) {
        const { data: fullBlocks, error: fullBlocksError } = await db
          .from('platform_module_blocks')
          .select('*')
          .eq('module_id', module.id)
          .order('ordem_index', { ascending: true });

        if (fullBlocksError) throw fullBlocksError;

        const clonedBlocks = (fullBlocks || []).map((block: any) => ({
          ...block,
          id: undefined,
          module_id: tempId,
        }));

        const { error: insertBlocksError } = await db.from('platform_module_blocks').insert(clonedBlocks);
        if (insertBlocksError) throw insertBlocksError;
      }

      await renumberModules();
      await loadData(null, (items) => {
        const matches = items
          .filter((item) => item.title === `${module.title} (cópia)` && getModulePillarId(item) === targetPillarId)
          .sort((a, b) => b.order_index - a.order_index);
        return matches[0]?.id || null;
      });

      toast({ title: 'Módulo duplicado com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao duplicar módulo',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function duplicatePillar(pillar: PlatformPillar) {
    try {
      const nextOrder = orderedPillars.length + 1;
      const { data: createdPillar, error: pillarError } = await db
        .from('platform_pilares')
        .insert({
          nome: `${pillar.nome} (cópia)`,
          descricao: pillar.descricao,
          fase_claro: pillar.fase_claro,
          plano_minimo: pillar.plano_minimo,
          ativo: pillar.ativo,
          ordem_index: nextOrder,
          icone: pillar.icone,
          cor: pillar.cor,
        })
        .select('*')
        .single();

      if (pillarError) throw pillarError;

      const newPillar = createdPillar as PlatformPillar;
      const sourceModules = getPillarModules(pillar.id);

      for (const module of sourceModules) {
        const tempId = createTempModuleId();
        const { error: moduleError } = await db.from('platform_modules').insert({
          ...module,
          id: tempId,
          pilar_id: newPillar.id,
          pillar: nextOrder,
        });

        if (moduleError) throw moduleError;

        const { data: fullBlocks, error: blocksError } = await db
          .from('platform_module_blocks')
          .select('*')
          .eq('module_id', module.id)
          .order('ordem_index', { ascending: true });

        if (blocksError) throw blocksError;

        if ((fullBlocks || []).length > 0) {
          const clonedBlocks = (fullBlocks || []).map((block: any) => ({
            ...block,
            id: undefined,
            module_id: tempId,
          }));

          const { error: insertBlocksError } = await db.from('platform_module_blocks').insert(clonedBlocks);
          if (insertBlocksError) throw insertBlocksError;
        }
      }

      await renumberModules();
      setExpandedPillars((current) => Array.from(new Set([...current, newPillar.id])));
      await loadData(null, (items) => {
        const firstModule = items.find((item) => getModulePillarId(item) === newPillar.id);
        return firstModule?.id || null;
      });

      toast({ title: 'Pilar duplicado com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao duplicar pilar',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function togglePillarActive(pillar: PlatformPillar) {
    try {
      const { error } = await db
        .from('platform_pilares')
        .update({ ativo: !pillar.ativo })
        .eq('id', pillar.id);

      if (error) throw error;

      await loadData(selectedId);
      toast({ title: pillar.ativo ? 'Pilar desativado' : 'Pilar ativado' });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar pilar',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function toggleModuleActive(module: PlatformModule) {
    try {
      const { error } = await db
        .from('platform_modules')
        .update({ active: !module.active })
        .eq('id', module.id);

      if (error) throw error;

      await loadData(module.id);
      toast({ title: module.active ? 'Módulo desativado' : 'Módulo ativado' });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar módulo',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function moveModuleToPillar(module: PlatformModule, targetPillarId: string) {
    try {
      const currentPillarId = getModulePillarId(module);
      if (!currentPillarId || currentPillarId === targetPillarId) return;

      const nextOrder = getPillarModules(targetPillarId).length + 1;
      const { error } = await db
        .from('platform_modules')
        .update({
          pilar_id: targetPillarId,
          pillar: pillarOrderMap[targetPillarId] || 1,
          order_index: nextOrder,
        })
        .eq('id', module.id);

      if (error) throw error;

      await renumberModules();
      await loadData(null, (items) => {
        const matches = items
          .filter((item) => item.title === module.title && getModulePillarId(item) === targetPillarId)
          .sort((a, b) => b.order_index - a.order_index);
        return matches[0]?.id || null;
      });

      setExpandedPillars((current) => Array.from(new Set([...current, targetPillarId])));
      toast({ title: 'Módulo movido com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao mover módulo',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function deletePillar(pillarId: string) {
    try {
      // Busca o ordem_index do pilar (platform_modules.pillar é inteiro)
      const { data: pilarData, error: pilarFetchError } = await db
        .from('platform_pilares')
        .select('ordem_index')
        .eq('id', pillarId)
        .maybeSingle();
      if (pilarFetchError) throw pilarFetchError;

      // Deleta todos os módulos do pilar usando o número inteiro
      if (pilarData?.ordem_index != null) {
        const { error: modError } = await db
          .from('platform_modules')
          .delete()
          .eq('pillar', pilarData.ordem_index);
        if (modError) throw modError;
      }

      const { error } = await db.from('platform_pilares').delete().eq('id', pillarId);
      if (error) throw error;

      setDeletePillarTarget(null);
      await loadData();
      toast({ title: 'Pilar excluído com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir pilar',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function deleteModule(moduleId: string) {
    try {
      const { error } = await db.from('platform_modules').delete().eq('id', moduleId);
      if (error) throw error;

      await renumberModules();
      setDeleteTarget(null);
      await loadData();
      toast({ title: 'Módulo excluído com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir módulo',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function handleSave(tabName: string) {
    if (!editMod.id) return;

    setSavingTab(tabName);
    try {
      if (tabName === 'Info') {
        const selected = modules.find((module) => module.id === editMod.id);
        if (!selected) return;

        const targetPillarId = getModulePillarId(editMod);
        if (!targetPillarId) throw new Error('Selecione um pilar válido.');

        const movedPillar = getModulePillarId(selected) !== targetPillarId;
        const nextOrder = movedPillar ? getPillarModules(targetPillarId).length + 1 : selected.order_index;

        const payload = {
          title: editMod.title?.trim() || '',
          description: editMod.description?.trim() || null,
          pilar_id: targetPillarId,
          pillar: pillarOrderMap[targetPillarId] || 1,
          min_plan: (editMod.min_plan || 'pca') as PlanType,
          duracao_minutos: getModuleDuration(editMod),
          duration_minutes: getModuleDuration(editMod),
          active: !!editMod.active,
          ...(movedPillar ? { order_index: nextOrder } : {}),
        };

        const { error } = await db.from('platform_modules').update(payload).eq('id', editMod.id);
        if (error) throw error;

        if (movedPillar) {
          await renumberModules();
          await loadData(null, (items) => {
            const matches = items
              .filter((item) => item.title === payload.title && getModulePillarId(item) === targetPillarId)
              .sort((a, b) => b.order_index - a.order_index);
            return matches[0]?.id || null;
          });
        } else {
          await loadData(editMod.id);
        }
      } else {
        const { error } = await db
          .from('platform_modules')
          .update({
            aprender_content: editMod.aprender_content || null,
            video_url: editMod.video_url || null,
            construa_fields: editMod.construa_fields || [],
            valide_checklist: editMod.valide_checklist || [],
            valide_items: (editMod.valide_checklist || [])
              .map((item: any) => String(item?.text || '').trim())
              .filter(Boolean),
            finalize_success_message: editMod.finalize_success_message || null,
            finalize_badge_name: editMod.finalize_badge_name || null,
            finalize_next_action: editMod.finalize_next_action || null,
          })
          .eq('id', editMod.id);

        if (error) throw error;

        await loadData(editMod.id);
      }

      toast({ title: 'Sucesso', description: `Aba ${tabName} salva com sucesso.` });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingTab(null);
    }
  }

  function openCreateBlock(type: BlockType) {
    if (!selectedModule) return;
    setIsCreatingBlock(true);
    setBlockForm(createBlockForm(type, selectedModule.id, currentBlocks.length + 1));
    setSelectedBlockId(null);
    setBlockTypeModalOpen(false);
  }

  function updateBlockConfig(updater: (config: Record<string, any>) => Record<string, any>) {
    setBlockForm((current) => {
      if (!current) return current;
      return { ...current, config: updater(current.config || {}) };
    });
  }

  async function handleSaveBlock() {
    if (!selectedModule || !blockForm) return;
    if (!blockForm.titulo.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Preencha o título do bloco.',
        variant: 'destructive',
      });
      return;
    }

    setSavingBlock(true);
    try {
      const payload = {
        module_id: selectedModule.id,
        tipo: blockForm.tipo,
        titulo: blockForm.titulo.trim(),
        instrucao: blockForm.instrucao.trim() || null,
        config: blockForm.config || {},
        ordem_index: blockForm.ordem_index,
        salvar_no_cerebro: blockForm.salvar_no_cerebro,
        cerebro_chave: blockForm.salvar_no_cerebro ? blockForm.cerebro_chave || null : null,
        gera_material: blockForm.gera_material,
        material_categoria: blockForm.gera_material ? blockForm.material_categoria || null : null,
      };

      if (blockForm.id) {
        const { error } = await db.from('platform_module_blocks').update(payload).eq('id', blockForm.id);
        if (error) throw error;
        setIsCreatingBlock(false);
        await loadData(selectedId, () => blockForm.id || null);
      } else {
        const { data, error } = await db.from('platform_module_blocks').insert(payload).select('*').single();
        if (error) throw error;
        setIsCreatingBlock(false);
        setSelectedBlockId((data?.id as string) || null);
        await loadData(selectedId);
      }

      toast({ title: 'Bloco salvo com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar bloco',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingBlock(false);
    }
  }

  async function duplicateBlock(block: PlatformModuleBlock) {
    try {
      const { data, error } = await db.from('platform_module_blocks').insert({
        module_id: block.module_id,
        tipo: block.tipo,
        titulo: `${block.titulo} (cópia)`,
        instrucao: block.instrucao,
        config: block.config || {},
        ordem_index: currentBlocks.length + 1,
        salvar_no_cerebro: block.salvar_no_cerebro,
        cerebro_chave: block.cerebro_chave,
        gera_material: block.gera_material,
        material_categoria: block.material_categoria,
      }).select('*').single();
      if (error) throw error;

      setIsCreatingBlock(false);
      setSelectedBlockId((data?.id as string) || null);
      await loadData(selectedId);
      toast({ title: 'Bloco duplicado com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao duplicar bloco',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function deleteBlock(blockId: string) {
    try {
      const { error } = await db.from('platform_module_blocks').delete().eq('id', blockId);
      if (error) throw error;

      const nextBlocks = currentBlocks.filter((block) => block.id !== blockId);
      await Promise.all(
        nextBlocks.map((block, index) =>
          db.from('platform_module_blocks').update({ ordem_index: index + 1 }).eq('id', block.id),
        ),
      );

      setDeleteBlockTarget(null);
      await loadData(selectedId);
      toast({ title: 'Bloco excluído com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir bloco',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  function handleBlockDragStart(event: DragStartEvent) {
    setDraggingBlockId(String(event.active.id).replace('block:', ''));
  }

  async function handleBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingBlockId(null);
    if (!over || active.id === over.id || !selectedModule) return;

    const activeBlockId = String(active.id).replace('block:', '');
    const overBlockId = String(over.id).replace('block:', '');
    const oldIndex = currentBlocks.findIndex((block) => block.id === activeBlockId);
    const newIndex = currentBlocks.findIndex((block) => block.id === overBlockId);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextBlocks = arrayMove(currentBlocks, oldIndex, newIndex);
    setBlocksByModule((current) => ({
      ...current,
      [selectedModule.id]: nextBlocks.map((block, index) => ({ ...block, ordem_index: index + 1 })),
    }));

    try {
      await Promise.all(
        nextBlocks.map((block, index) =>
          db.from('platform_module_blocks').update({ ordem_index: index + 1 }).eq('id', block.id),
        ),
      );
      await loadData(selectedId);
    } catch (error: any) {
      toast({
        title: 'Erro ao reordenar blocos',
        description: error.message,
        variant: 'destructive',
      });
      await loadData(selectedId);
    }
  }

  function renderTextoGuiadoEditor() {
    const config = blockForm?.config || {};
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Pergunta / Label</Label>
          <Input value={config.label || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, label: event.target.value }))} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Placeholder</Label>
          <Textarea rows={3} value={config.placeholder || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, placeholder: event.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Mínimo de caracteres</Label>
          <Input type="number" value={config.min_chars ?? 0} onChange={(event) => updateBlockConfig((current) => ({ ...current, min_chars: Number(event.target.value || 0) }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Máximo de caracteres</Label>
          <Input type="number" value={config.max_chars ?? 500} onChange={(event) => updateBlockConfig((current) => ({ ...current, max_chars: Number(event.target.value || 0) }))} />
        </div>
      </div>
    );
  }

  function renderMatrizEditor() {
    const config = blockForm?.config || {};
    const columns = Array.isArray(config.colunas) ? config.colunas : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Colunas</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => updateBlockConfig((current) => ({ ...current, colunas: [...(current.colunas || []), { label: `Coluna ${(current.colunas || []).length + 1}`, tipo: 'texto' }] }))}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Coluna
          </Button>
        </div>
        <div className="space-y-3">
          {columns.map((column: any, index: number) => (
            <div key={`column-${index}`} className="grid grid-cols-[1fr,140px,40px] gap-2">
              <Input value={column.label || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, colunas: (current.colunas || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} placeholder="Nome da coluna" />
              <Select value={column.tipo || 'texto'} onValueChange={(value) => updateBlockConfig((current) => ({ ...current, colunas: (current.colunas || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, tipo: value } : item) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="numero">Número</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" onClick={() => updateBlockConfig((current) => ({ ...current, colunas: (current.colunas || []).filter((_: any, itemIndex: number) => itemIndex !== index) }))}>
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Linhas iniciais</Label>
            <Input type="number" value={config.linhas_iniciais ?? 3} onChange={(event) => updateBlockConfig((current) => ({ ...current, linhas_iniciais: Number(event.target.value || 0) }))} />
          </div>
          <div className="flex items-center gap-2 pt-7">
            <Switch checked={config.pode_adicionar_linhas ?? true} onCheckedChange={(checked) => updateBlockConfig((current) => ({ ...current, pode_adicionar_linhas: checked }))} />
            <Label>Adicionar linhas</Label>
          </div>
          <div className="flex items-center gap-2 pt-7">
            <Switch checked={config.pode_remover_linhas ?? true} onCheckedChange={(checked) => updateBlockConfig((current) => ({ ...current, pode_remover_linhas: checked }))} />
            <Label>Remover linhas</Label>
          </div>
        </div>
      </div>
    );
  }

  function renderScriptEditor() {
    const config = blockForm?.config || {};
    const etapas = Array.isArray(config.etapas) ? config.etapas : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Etapas do Script</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => updateBlockConfig((current) => ({ ...current, etapas: [...(current.etapas || []), { nome: `Etapa ${(current.etapas || []).length + 1}`, descricao: '', exemplo: '' }] }))}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Etapa do Script
          </Button>
        </div>
        <div className="space-y-3">
          {etapas.map((etapa: any, index: number) => (
            <div key={`etapa-${index}`} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex gap-2">
                <Input value={etapa.nome || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, etapas: (current.etapas || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, nome: event.target.value } : item) }))} placeholder="Nome da etapa" />
                <Button type="button" variant="ghost" size="icon" onClick={() => updateBlockConfig((current) => ({ ...current, etapas: (current.etapas || []).filter((_: any, itemIndex: number) => itemIndex !== index) }))}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
              <Textarea rows={2} value={etapa.descricao || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, etapas: (current.etapas || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, descricao: event.target.value } : item) }))} placeholder="Descrição da etapa" />
              <Textarea rows={2} value={etapa.exemplo || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, etapas: (current.etapas || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, exemplo: event.target.value } : item) }))} placeholder="Exemplo do que o cliente deve escrever" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={config.mostrar_exemplos_cliente ?? true} onCheckedChange={(checked) => updateBlockConfig((current) => ({ ...current, mostrar_exemplos_cliente: checked }))} />
          <Label>Mostrar exemplos para o cliente</Label>
        </div>
      </div>
    );
  }

  function renderSelecaoEditor() {
    const config = blockForm?.config || {};
    const options = Array.isArray(config.opcoes) ? config.opcoes : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Switch checked={config.multipla ?? false} onCheckedChange={(checked) => updateBlockConfig((current) => ({ ...current, multipla: checked }))} />
          <Label>Seleção múltipla</Label>
        </div>
        <div className="flex items-center justify-between">
          <Label>Opções</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => updateBlockConfig((current) => ({ ...current, opcoes: [...(current.opcoes || []), { label: `Opção ${(current.opcoes || []).length + 1}`, valor: `opcao_${(current.opcoes || []).length + 1}`, contexto_adicional: '' }] }))}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Opção
          </Button>
        </div>
        <div className="space-y-3">
          {options.map((option: any, index: number) => (
            <div key={`option-${index}`} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex gap-2">
                <Input value={option.label || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, opcoes: (current.opcoes || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} placeholder="Label" />
                <Input value={option.valor || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, opcoes: (current.opcoes || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, valor: event.target.value } : item) }))} placeholder="Valor interno" />
                <Button type="button" variant="ghost" size="icon" onClick={() => updateBlockConfig((current) => ({ ...current, opcoes: (current.opcoes || []).filter((_: any, itemIndex: number) => itemIndex !== index) }))}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
              <Textarea rows={2} value={option.contexto_adicional || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, opcoes: (current.opcoes || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, contexto_adicional: event.target.value } : item) }))} placeholder="Contexto adicional para aparecer ao selecionar" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderCalculadoraEditor() {
    const config = blockForm?.config || {};
    const inputs = Array.isArray(config.campos_entrada) ? config.campos_entrada : [];
    const results = Array.isArray(config.campos_resultado) ? config.campos_resultado : [];
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Campos de Entrada</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => updateBlockConfig((current) => ({ ...current, campos_entrada: [...(current.campos_entrada || []), { label: `Campo ${(current.campos_entrada || []).length + 1}`, nome: `campo_${(current.campos_entrada || []).length + 1}`, tipo: 'numero', valor_padrao: 0 }] }))}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Campo de Entrada
            </Button>
          </div>
          {inputs.map((field: any, index: number) => (
            <div key={`calc-input-${index}`} className="grid grid-cols-[1fr,1fr,140px,40px] gap-2">
              <Input value={field.label || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, campos_entrada: (current.campos_entrada || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} placeholder="Label" />
              <Input value={field.nome || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, campos_entrada: (current.campos_entrada || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, nome: event.target.value } : item) }))} placeholder="nome_formula" />
              <Select value={field.tipo || 'numero'} onValueChange={(value) => updateBlockConfig((current) => ({ ...current, campos_entrada: (current.campos_entrada || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, tipo: value } : item) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="numero">Número</SelectItem>
                  <SelectItem value="moeda">Moeda</SelectItem>
                  <SelectItem value="percentual">%</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" onClick={() => updateBlockConfig((current) => ({ ...current, campos_entrada: (current.campos_entrada || []).filter((_: any, itemIndex: number) => itemIndex !== index) }))}>
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Campos de Resultado</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => updateBlockConfig((current) => ({ ...current, campos_resultado: [...(current.campos_resultado || []), { label: `Resultado ${(current.campos_resultado || []).length + 1}`, formula: '', resultado_label: '' }] }))}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Campo de Resultado
            </Button>
          </div>
          {results.map((result: any, index: number) => (
            <div key={`calc-result-${index}`} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex gap-2">
                <Input value={result.label || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, campos_resultado: (current.campos_resultado || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} placeholder="Label interno" />
                <Button type="button" variant="ghost" size="icon" onClick={() => updateBlockConfig((current) => ({ ...current, campos_resultado: (current.campos_resultado || []).filter((_: any, itemIndex: number) => itemIndex !== index) }))}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
              <Input value={result.formula || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, campos_resultado: (current.campos_resultado || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, formula: event.target.value } : item) }))} placeholder="ticket_medio * volume_mensal * taxa_conversao / 100" />
              <Input value={result.resultado_label || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, campos_resultado: (current.campos_resultado || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, resultado_label: event.target.value } : item) }))} placeholder="Label do resultado" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderCriacaoOfertaEditor() {
    const config = blockForm?.config || {};
    const fields = Array.isArray(config.campos) ? config.campos : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Campos da oferta</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => updateBlockConfig((current) => ({ ...current, campos: [...(current.campos || []), { label: `Campo ${(current.campos || []).length + 1}`, obrigatorio: false, personalizado: true }] }))}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Campo personalizado
          </Button>
        </div>
        <div className="space-y-3">
          {fields.map((field: any, index: number) => (
            <div key={`offer-${index}`} className="grid grid-cols-[1fr,120px,40px] items-center gap-2 rounded-xl border border-border p-3">
              <Input value={field.label || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, campos: (current.campos || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} />
              <div className="flex items-center gap-2">
                <Switch checked={field.obrigatorio ?? false} onCheckedChange={(checked) => updateBlockConfig((current) => ({ ...current, campos: (current.campos || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, obrigatorio: checked } : item) }))} />
                <Label>Obrig.</Label>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => updateBlockConfig((current) => ({ ...current, campos: (current.campos || []).filter((_: any, itemIndex: number) => itemIndex !== index) }))}>
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderMapaIcpEditor() {
    const config = blockForm?.config || {};
    const sections = Array.isArray(config.secoes) ? config.secoes : [];
    return (
      <div className="space-y-4">
        {sections.map((section: any, index: number) => (
          <div key={`section-${index}`} className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Input value={section.nome || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, secoes: (current.secoes || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, nome: event.target.value } : item) }))} />
              <div className="flex items-center gap-2">
                <Switch checked={section.visivel ?? true} onCheckedChange={(checked) => updateBlockConfig((current) => ({ ...current, secoes: (current.secoes || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, visivel: checked } : item) }))} />
                <Label>Visível</Label>
              </div>
            </div>
            <div className="space-y-2">
              {(section.campos || []).map((field: any, fieldIndex: number) => (
                <div key={`section-field-${index}-${fieldIndex}`} className="grid grid-cols-[1fr,140px,40px] gap-2">
                  <Input value={field.label || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, secoes: (current.secoes || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, campos: (item.campos || []).map((inner: any, innerIndex: number) => innerIndex === fieldIndex ? { ...inner, label: event.target.value } : inner) } : item) }))} />
                  <Select value={field.tipo || 'texto'} onValueChange={(value) => updateBlockConfig((current) => ({ ...current, secoes: (current.secoes || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, campos: (item.campos || []).map((inner: any, innerIndex: number) => innerIndex === fieldIndex ? { ...inner, tipo: value } : inner) } : item) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="texto">Texto</SelectItem>
                      <SelectItem value="textarea">Texto longo</SelectItem>
                      <SelectItem value="numero">Número</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => updateBlockConfig((current) => ({ ...current, secoes: (current.secoes || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, campos: (item.campos || []).filter((_: any, innerIndex: number) => innerIndex !== fieldIndex) } : item) }))}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => updateBlockConfig((current) => ({ ...current, secoes: (current.secoes || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, campos: [...(item.campos || []), { label: `Campo ${(item.campos || []).length + 1}`, tipo: 'texto' }] } : item) }))}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Campo da seção
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderChecklistEditor() {
    const config = blockForm?.config || {};
    const items = Array.isArray(config.itens) ? config.itens : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Itens do checklist</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => updateBlockConfig((current) => ({ ...current, itens: [...(current.itens || []), { texto: `Item ${(current.itens || []).length + 1}`, descricao: '', tem_campo_resposta: false }] }))}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Item
          </Button>
        </div>
        <div className="space-y-3">
          {items.map((item: any, index: number) => (
            <div key={`check-${index}`} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex gap-2">
                <Input value={item.texto || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, itens: (current.itens || []).map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, texto: event.target.value } : entry) }))} placeholder="Texto do item" />
                <Button type="button" variant="ghost" size="icon" onClick={() => updateBlockConfig((current) => ({ ...current, itens: (current.itens || []).filter((_: any, entryIndex: number) => entryIndex !== index) }))}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
              <Textarea rows={2} value={item.descricao || ''} onChange={(event) => updateBlockConfig((current) => ({ ...current, itens: (current.itens || []).map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, descricao: event.target.value } : entry) }))} placeholder="Descrição auxiliar" />
              <div className="flex items-center gap-2">
                <Switch checked={item.tem_campo_resposta ?? false} onCheckedChange={(checked) => updateBlockConfig((current) => ({ ...current, itens: (current.itens || []).map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, tem_campo_resposta: checked } : entry) }))} />
                <Label>Tem campo de resposta</Label>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderBlockSpecificEditor() {
    if (!blockForm) return null;
    switch (blockForm.tipo) {
      case 'texto_guiado':
        return renderTextoGuiadoEditor();
      case 'matriz_tabela':
        return renderMatrizEditor();
      case 'script_atendimento':
        return renderScriptEditor();
      case 'selecao_estrategica':
        return renderSelecaoEditor();
      case 'calculadora':
        return renderCalculadoraEditor();
      case 'criacao_oferta':
        return renderCriacaoOfertaEditor();
      case 'mapa_icp':
        return renderMapaIcpEditor();
      case 'checklist_acao':
        return renderChecklistEditor();
      default:
        return null;
    }
  }

  const addValideItem = () => {
    if (!newValide.text.trim()) {
      toast({
        title: 'Erro',
        description: 'Texto obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    const current = Array.isArray(editMod.valide_checklist) ? [...editMod.valide_checklist] : [];
    current.push({ ...newValide, id: Math.random().toString(36).slice(2, 9) });
    setEditMod({ ...editMod, valide_checklist: current });
    setShowValideModal(false);
    setNewValide({ text: '', description: '' });
  };

  const removeValideItem = (index: number) => {
    const current = [...(editMod.valide_checklist || [])];
    current.splice(index, 1);
    setEditMod({ ...editMod, valide_checklist: current });
  };

  const moveValideItem = (index: number, direction: -1 | 1) => {
    const current = [...(editMod.valide_checklist || [])];
    if (index + direction < 0 || index + direction >= current.length) return;
    const temp = current[index];
    current[index] = current[index + direction];
    current[index + direction] = temp;
    setEditMod({ ...editMod, valide_checklist: current });
  };

  const handleValideDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = [...(editMod.valide_checklist || [])];
    const oldIndex = current.findIndex((item: any, index: number) => (item.id || `valide_${index}`) === active.id);
    const newIndex = current.findIndex((item: any, index: number) => (item.id || `valide_${index}`) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    setEditMod({ ...editMod, valide_checklist: arrayMove(current, oldIndex, newIndex) });
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editMod.id) return;

    if (!file.type.match(/(video\/mp4|video\/webm|video\/ogg)/)) {
      toast({
        title: 'Erro',
        description: 'Apenas arquivos MP4, WebM ou OGG.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'Arquivo muito grande. Máximo permitido: 500MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const extension = file.name.split('.').pop();
      const fileName = `${editMod.id}_${Date.now()}.${extension}`;

      const interval = setInterval(() => {
        setUploadProgress((current) => (current < 90 ? current + 5 : current));
      }, 500);

      const { error } = await supabase.storage.from('platform_videos').upload(fileName, file, { upsert: true });
      clearInterval(interval);

      if (error) throw error;

      setUploadProgress(100);
      const { data } = supabase.storage.from('platform_videos').getPublicUrl(fileName);

      setEditMod({ ...editMod, video_url: data.publicUrl });
      toast({ title: 'Upload concluído com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Falha no upload',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 800);
    }
  };

  function handleDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type as 'pillar' | 'module' | undefined;
    if (type === 'pillar') {
      setDraggingType('pillar');
      setDraggingId(String(event.active.id).replace('pillar:', ''));
    } else if (type === 'module') {
      setDraggingType('module');
      setDraggingId(String(event.active.id).replace('module:', ''));
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingId(null);
    setDraggingType(null);

    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type as 'pillar' | 'module' | undefined;
    const overType = over.data.current?.type as 'pillar' | 'module' | 'pillar-drop' | undefined;

    if (activeType === 'pillar' && overType === 'pillar') {
      const activeId = String(active.id).replace('pillar:', '');
      const overId = String(over.id).replace('pillar:', '');
      const oldIndex = orderedPillars.findIndex((pillar) => pillar.id === activeId);
      const newIndex = orderedPillars.findIndex((pillar) => pillar.id === overId);

      if (oldIndex === -1 || newIndex === -1) return;

      const nextPillars = arrayMove(orderedPillars, oldIndex, newIndex).map((pillar, index) => ({
        ...pillar,
        ordem_index: index + 1,
      }));

      setPillars(nextPillars);

      try {
        await updatePillarOrder(nextPillars);
        await loadData(selectedId);
      } catch (error: any) {
        toast({
          title: 'Erro ao reordenar pilares',
          description: error.message,
          variant: 'destructive',
        });
        await loadData(selectedId);
      }

      return;
    }

    if (activeType !== 'module') return;

    const activeModuleId = String(active.id).replace('module:', '');
    const draggedModule = modules.find((module) => module.id === activeModuleId);
    const sourcePillarId = draggedModule ? getModulePillarId(draggedModule) : null;
    if (!draggedModule || !sourcePillarId) return;

    let targetPillarId: string | null = null;
    let targetIndex = 0;

    if (overType === 'module') {
      const overModuleId = String(over.id).replace('module:', '');
      const overModule = modules.find((module) => module.id === overModuleId);
      targetPillarId = overModule ? getModulePillarId(overModule) : null;
      targetIndex = targetPillarId ? getPillarModules(targetPillarId).findIndex((module) => module.id === overModuleId) : 0;
    } else if (overType === 'pillar-drop') {
      targetPillarId = over.data.current?.pillarId as string;
      targetIndex = getPillarModules(targetPillarId).length;
    }

    if (!targetPillarId) return;

    const nextModules = [...modules];
    const draggedIndex = nextModules.findIndex((module) => module.id === activeModuleId);
    const [dragged] = nextModules.splice(draggedIndex, 1);

    if (sourcePillarId === targetPillarId) {
      const pillarModules = getPillarModules(targetPillarId).map((module) => module.id).filter((id) => id !== activeModuleId);
      const insertIndex = Math.max(0, Math.min(targetIndex, pillarModules.length));
      pillarModules.splice(insertIndex, 0, activeModuleId);

      pillarModules.forEach((moduleId, index) => {
        const module = nextModules.find((item) => item.id === moduleId);
        if (module) module.order_index = index + 1;
      });
    } else {
      dragged.pilar_id = targetPillarId;
      dragged.pillar = pillarOrderMap[targetPillarId] || dragged.pillar;

      const targetModules = getPillarModules(targetPillarId).map((module) => module.id);
      const insertIndex = Math.max(0, Math.min(targetIndex, targetModules.length));
      targetModules.splice(insertIndex, 0, activeModuleId);

      const sourceModules = getPillarModules(sourcePillarId).map((module) => module.id).filter((id) => id !== activeModuleId);

      sourceModules.forEach((moduleId, index) => {
        const module = nextModules.find((item) => item.id === moduleId);
        if (module) {
          module.pilar_id = sourcePillarId;
          module.pillar = pillarOrderMap[sourcePillarId] || module.pillar;
          module.order_index = index + 1;
        }
      });

      targetModules.forEach((moduleId, index) => {
        const module = nextModules.find((item) => item.id === moduleId);
        if (module) {
          module.pilar_id = targetPillarId;
          module.pillar = pillarOrderMap[targetPillarId] || module.pillar;
          module.order_index = index + 1;
        }
      });
    }

    setModules(nextModules);

    try {
      await persistModulesForPillars(nextModules, [sourcePillarId, targetPillarId]);
      await loadData(selectedId);
    } catch (error: any) {
      toast({
        title: 'Erro ao reordenar módulos',
        description: error.message,
        variant: 'destructive',
      });
      await loadData(selectedId);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-[#E85D24]" />
      </div>
    );
  }

  if (isModulePage && routeModuleId && !modules.some((module) => module.id === routeModuleId)) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/admin/trilha')}>
          Voltar para Trilha & Conteúdo
        </Button>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Módulo não encontrado. Verifique se ele ainda existe.</p>
        </Card>
      </div>
    );
  }

  const selectedPillar = routePillarId ? orderedPillars.find((pillar) => pillar.id === routePillarId) || null : null;
  if (isPillarPage && routePillarId && !selectedPillar) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/admin/trilha')}>
          Voltar para Trilha & Conteúdo
        </Button>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Pilar não encontrado. Verifique se ele ainda existe.</p>
        </Card>
      </div>
    );
  }

  const activePillars = isPillarPage && selectedPillar ? [selectedPillar] : orderedPillars;
  const selectedModule = modules.find((module) => module.id === selectedId) || null;
  const currentBlocks = selectedModule ? (blocksByModule[selectedModule.id] || []).slice().sort((a, b) => a.ordem_index - b.ordem_index) : [];
  const availablePillarsForSelect = orderedPillars.filter((pillar) => pillar.ativo);

  return (
    <div className={cn('h-[calc(100vh-6rem)] min-w-0 gap-6', isModulePage ? 'flex flex-col' : 'flex')}>
      {!isModulePage && (
      <Card className="flex h-full w-full min-w-0 flex-col overflow-hidden">
        <CardHeader className="space-y-4 border-b border-border bg-muted/10 p-4">
          {isPillarPage && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/trilha')}>
                Voltar para todos os pilares
              </Button>
              <p className="text-xs text-muted-foreground">Visualizando pilar {selectedPillar?.nome || ''}</p>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-lg font-bold text-foreground">Trilha de Aprendizado</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {pillars.length} pilares · {modules.length} módulos · {totalVideoModules} com vídeo · {totalConstruaModules} com Construa
              </p>
            </div>
            <Button onClick={openCreatePillarModal} className="h-9 shrink-0 bg-[#E85D24] text-white hover:bg-[#E85D24]/90">
              <Plus className="mr-1 h-4 w-4" />
              Novo Pilar
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar módulo..."
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={(event) => void handleDragEnd(event)}
          >
            <SortableContext items={activePillars.map((pillar) => `pillar:${pillar.id}`)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border/60">
                {activePillars.map((pillar) => {
                  const visibleModules = getVisiblePillarModules(pillar.id);
                  const allModulesInPillar = getPillarModules(pillar.id);
                  const expanded = isPillarPage ? true : expandedPillars.includes(pillar.id);

                  return (
                    <SortablePillarHeader
                      key={pillar.id}
                      pillar={pillar}
                      expanded={expanded}
                      moduleCount={allModulesInPillar.filter((module) => module.active).length}
                      onHeaderClick={() => (isPillarPage ? expandPillar(pillar.id) : openPillar(pillar.id))}
                      onChevronToggle={() => togglePillarExpanded(pillar.id)}
                      onEdit={() => openEditPillarModal(pillar)}
                      onAddModule={() => openCreateModuleModal(pillar.id)}
                      onDuplicate={() => void duplicatePillar(pillar)}
                      onToggleActive={() => void togglePillarActive(pillar)}
                      onDelete={() => setDeletePillarTarget({ id: pillar.id, title: pillar.nome })}
                    >
                      {expanded && (
                        <PillarDropZone pillarId={pillar.id} active={draggingType === 'module'}>
                          <SortableContext items={visibleModules.map((module) => `module:${module.id}`)} strategy={verticalListSortingStrategy}>
                            {visibleModules.map((module) => (
                              <SortableModuleItem
                                key={module.id}
                                module={module}
                                displayId={getModuleDisplayId(module)}
                                completions={completions[module.id] || 0}
                                selected={selectedId === module.id}
                                searchActive={!!searchValue}
                                hasVideo={moduleHasVideo(module)}
                                hasConstrua={moduleHasConstrua(module)}
                                hasValide={moduleHasValide(module)}
                                hasFinalize={moduleHasFinalize(module)}
                                onSelect={() => openModule(module.id)}
                                onEdit={() => openEditModuleModal(module)}
                                onDuplicate={() => void duplicateModule(module)}
                                onToggleActive={() => void toggleModuleActive(module)}
                                onDelete={() => setDeleteTarget({ id: module.id, title: module.title })}
                                moveTargets={orderedPillars.filter((item) => item.id !== pillar.id).map((item) => ({ id: item.id, nome: item.nome }))}
                                onMoveToPillar={(targetId) => void moveModuleToPillar(module, targetId)}
                              />
                            ))}
                          </SortableContext>

                          {visibleModules.length === 0 && (
                            <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-4 text-xs text-muted-foreground">
                              {searchValue ? 'Nenhum módulo encontrado neste pilar.' : 'Nenhum módulo ativo neste pilar.'}
                            </div>
                          )}
                        </PillarDropZone>
                      )}
                    </SortablePillarHeader>
                  );
                })}
              </div>
            </SortableContext>

            <div className="border-t border-border/60 p-2">
              <button
                type="button"
                onClick={() => setInactiveOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Módulos Inativos</span>
                  <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
                    {inactiveModules.length}
                  </Badge>
                </div>
                {inactiveOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>

              {inactiveOpen && (
                <div className="mt-2 space-y-2">
                  {inactiveModules.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-4 text-xs text-muted-foreground">
                      Nenhum módulo inativo encontrado.
                    </div>
                  ) : (
                    inactiveModules.map((module) => {
                      const pillarId = getModulePillarId(module);
                      const pillar = pillarId ? pillarLookup[pillarId] : null;
                      return (
                        <div
                          key={module.id}
                          className="rounded-xl border border-border/70 bg-background px-3 py-3"
                        >
                          <button type="button" className="w-full text-left" onClick={() => openModule(module.id)}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#E85D24]">{getModuleDisplayId(module)}</span>
                              <p className="truncate text-sm font-medium text-muted-foreground">{module.title}</p>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {pillar?.nome || 'Sem pilar'}
                            </p>
                          </button>

                          <div className="mt-3 flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => void toggleModuleActive(module)}>
                              Reativar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget({ id: module.id, title: module.title })}
                            >
                              Excluir definitivamente
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <DragOverlay>
              {draggingType === 'pillar' && draggingId ? (
                <div className="w-[288px] rounded-xl border border-[#E85D24]/30 bg-white px-4 py-3 shadow-2xl">
                  <p className="text-sm font-semibold text-foreground">{pillarLookup[draggingId]?.nome || 'Pilar'}</p>
                </div>
              ) : null}

              {draggingType === 'module' && draggingId ? (
                <div className="w-[288px] rounded-xl border border-[#E85D24]/30 bg-white px-4 py-3 shadow-2xl">
                  <p className="text-xs font-bold text-[#E85D24]">{modules.find((module) => module.id === draggingId) ? getModuleDisplayId(modules.find((module) => module.id === draggingId) as PlatformModule) : ''}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {modules.find((module) => module.id === draggingId)?.title || 'Módulo'}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>
      )}

      {isModulePage && (
      <Card className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {isModulePage && (
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/10 px-4 py-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/trilha')}>
              Voltar para Trilha
            </Button>
            <p className="text-xs text-muted-foreground">Editando módulo {selectedModule?.title || ''}</p>
          </div>
        )}
        {!selectedModule ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <LayoutList className="h-10 w-10 opacity-20" />
            <p className="text-sm">Selecione um módulo à esquerda para editar o conteúdo.</p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/10 p-2">
              {['info', 'aprenda', 'construa', 'valide', 'finalize'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'whitespace-nowrap rounded px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
                    activeTab === tab ? 'bg-[#E85D24] text-white' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative flex-1 overflow-y-auto p-6">
              {activeTab === 'info' && (
                <div className="max-w-2xl space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1.5">
                        <Label>Título do Módulo</Label>
                        <Input value={editMod.title || ''} onChange={(event) => setEditMod({ ...editMod, title: event.target.value })} />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label>Descrição</Label>
                        <Textarea rows={3} value={editMod.description || ''} onChange={(event) => setEditMod({ ...editMod, description: event.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Pilar</Label>
                        <Select
                          value={getModulePillarId(editMod) || ''}
                          onValueChange={(value) =>
                            setEditMod({
                              ...editMod,
                              pilar_id: value,
                              pillar: pillarOrderMap[value] || editMod.pillar,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um pilar" />
                          </SelectTrigger>
                          <SelectContent>
                            {availablePillarsForSelect.map((pillar) => (
                              <SelectItem key={pillar.id} value={pillar.id}>
                                {pillarOrderMap[pillar.id]}. {pillar.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Duração Estimada (min)</Label>
                        <Input
                          type="number"
                          value={getModuleDuration(editMod)}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value || 0);
                            setEditMod({
                              ...editMod,
                              duracao_minutos: nextValue,
                              duration_minutes: nextValue,
                            });
                          }}
                        />
                      </div>
                      <div className="flex flex-col justify-end space-y-1.5">
                        <div className="mb-2 flex items-center gap-2">
                          <Switch checked={!!editMod.active} onCheckedChange={(checked) => setEditMod({ ...editMod, active: checked })} />
                          <Label>Módulo Ativo na Plataforma</Label>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-border pt-4">
                      <p className="mb-3 text-sm font-bold text-foreground">Estatísticas do Módulo</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-[10px] uppercase text-muted-foreground">Concluíram</p>
                          <p className="text-xl font-bold">{completions[selectedModule.id] || 0} alunos</p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-[10px] uppercase text-muted-foreground">Status</p>
                          <p className="text-xl font-bold">{selectedModule.active ? 'Ativo' : 'Inativo'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button onClick={() => void handleSave('Info')} disabled={savingTab === 'Info'} className="w-full bg-[#E85D24] text-white hover:bg-[#E85D24]/90 sm:w-auto">
                    {savingTab === 'Info' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Info
                  </Button>
                </div>
              )}

              {activeTab === 'aprenda' && (
                <div className="max-w-3xl space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Texto Introdutório</Label>
                      <Textarea rows={4} placeholder="Texto que aparece antes do vídeo..." value={editMod.aprender_content || ''} onChange={(event) => setEditMod({ ...editMod, aprender_content: event.target.value })} />
                    </div>

                    <div className="space-y-3 border-t border-border pt-4">
                      <Label>Vídeo da Aula</Label>
                      <div className="flex items-center gap-2">
                        <Input placeholder="URL do YouTube ou Supabase..." className="flex-1" value={editMod.video_url || ''} onChange={(event) => setEditMod({ ...editMod, video_url: event.target.value })} />
                        <div className="relative">
                          <input type="file" id="upload-video" className="hidden" accept="video/mp4,video/webm,video/ogg" onChange={handleFileUpload} disabled={uploading} />
                          <Button asChild variant="outline" className="shrink-0" disabled={uploading}>
                            <label htmlFor="upload-video" className="cursor-pointer">
                              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileVideo className="mr-2 h-4 w-4" />}
                              Upload
                            </label>
                          </Button>
                        </div>
                        {editMod.video_url && (
                          <Button variant="ghost" className="px-2 text-red-500" onClick={() => setEditMod({ ...editMod, video_url: '' })} title="Remover vídeo">
                            <Trash className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {uploading && (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Enviando arquivo...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-[#E85D24] transition-all" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      )}

                      {editMod.video_url && editMod.video_url.includes('youtu') && (
                        <div className="mt-4 aspect-video overflow-hidden rounded-lg border border-border">
                          <iframe
                            className="h-full w-full"
                            src={editMod.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                            title="Video Preview"
                            allowFullScreen
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <Button onClick={() => void handleSave('Aprenda')} disabled={savingTab === 'Aprenda'} className="w-full bg-[#E85D24] text-white hover:bg-[#E85D24]/90 sm:w-auto">
                    {savingTab === 'Aprenda' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Aprenda
                  </Button>
                </div>
              )}

              {activeTab === 'construa' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Blocos do Construa</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{currentBlocks.length} blocos configurados</p>
                    </div>
                    <Button size="sm" onClick={() => setBlockTypeModalOpen(true)} className="h-8 bg-[#E85D24] text-white hover:bg-[#E85D24]/90">
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Adicionar Bloco
                    </Button>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[260px,minmax(0,1fr)]">
                    <div className="rounded-2xl border border-border bg-muted/10 p-3">
                      <DndContext collisionDetection={closestCenter} onDragStart={handleBlockDragStart} onDragEnd={(event) => void handleBlockDragEnd(event)}>
                        <SortableContext items={currentBlocks.map((block) => `block:${block.id}`)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-3">
                            {currentBlocks.map((block) => (
                              <SortableBlockListItem
                                key={block.id}
                                block={block}
                                selected={selectedBlockId === block.id}
                                onSelect={() => {
                                  setSelectedBlockId(block.id);
                                  setBlockForm(normalizeBlock(block));
                                }}
                                onDuplicate={() => void duplicateBlock(block)}
                                onDelete={() => setDeleteBlockTarget(block)}
                              />
                            ))}
                            {currentBlocks.length === 0 && (
                              <div className="rounded-xl border border-dashed border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
                                Nenhum bloco criado para este módulo.
                              </div>
                            )}
                          </div>
                        </SortableContext>
                        <DragOverlay>
                          {draggingBlockId ? (
                            <div className="w-[230px] rounded-xl border border-[#E85D24]/30 bg-white px-4 py-3 shadow-2xl">
                              <p className="text-sm font-semibold text-foreground">{currentBlocks.find((block) => block.id === draggingBlockId)?.titulo || 'Bloco'}</p>
                            </div>
                          ) : null}
                        </DragOverlay>
                      </DndContext>

                      <Button variant="outline" className="mt-3 w-full" onClick={() => setBlockTypeModalOpen(true)}>
                        <Plus className="mr-1 h-4 w-4" />
                        Adicionar Bloco
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-5">
                      {!blockForm ? (
                        <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                          <Edit3 className="h-10 w-10 opacity-20" />
                          <p className="text-sm">Selecione um bloco na lista para editar ou crie um novo tipo.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {(() => {
                                const def = BLOCK_TYPE_MAP[blockForm.tipo];
                                const Icon = def.icon;
                                return <Icon className={cn('h-5 w-5', def.colorClass)} />;
                              })()}
                              <Badge variant="outline" className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', BLOCK_TYPE_MAP[blockForm.tipo].badgeClass)}>
                                {BLOCK_TYPE_MAP[blockForm.tipo].label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{BLOCK_TYPE_MAP[blockForm.tipo].description}</p>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <Label>Título do bloco</Label>
                              <Input value={blockForm.titulo} onChange={(event) => setBlockForm({ ...blockForm, titulo: event.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Instrução / contexto</Label>
                              <Textarea rows={4} value={blockForm.instrucao} onChange={(event) => setBlockForm({ ...blockForm, instrucao: event.target.value })} />
                            </div>
                          </div>

                          <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4">
                            <h4 className="text-sm font-semibold text-foreground">Configuração específica</h4>
                            {renderBlockSpecificEditor()}
                          </div>

                          <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4">
                            <h4 className="text-sm font-semibold text-foreground">Saída dos dados</h4>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Switch checked={blockForm.salvar_no_cerebro} onCheckedChange={(checked) => setBlockForm({ ...blockForm, salvar_no_cerebro: checked, cerebro_chave: checked ? blockForm.cerebro_chave : '' })} />
                                <Label>Salvar no Cérebro Central</Label>
                              </div>
                              {blockForm.salvar_no_cerebro && (
                                <div className="space-y-1.5">
                                  <Label>Qual campo do Cérebro?</Label>
                                  <Select value={blockForm.cerebro_chave} onValueChange={(value) => setBlockForm({ ...blockForm, cerebro_chave: value })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione um campo" /></SelectTrigger>
                                    <SelectContent>
                                      {CEREBRO_FIELD_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Switch checked={blockForm.gera_material} onCheckedChange={(checked) => setBlockForm({ ...blockForm, gera_material: checked, material_categoria: checked ? blockForm.material_categoria : '' })} />
                                <Label>Gerar material</Label>
                              </div>
                              {blockForm.gera_material && (
                                <div className="space-y-1.5">
                                  <Label>Categoria</Label>
                                  <Select value={blockForm.material_categoria} onValueChange={(value) => setBlockForm({ ...blockForm, material_categoria: value })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                                    <SelectContent>
                                      {MATERIAL_CATEGORY_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <Button onClick={() => void handleSaveBlock()} disabled={savingBlock} className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90">
                              {savingBlock ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                              Salvar Bloco
                            </Button>
                            {blockForm.id && (
                              <>
                                <Button variant="outline" onClick={() => {
                                  const source = currentBlocks.find((block) => block.id === blockForm.id);
                                  if (source) void duplicateBlock(source);
                                }}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicar Bloco
                                </Button>
                                <Button variant="destructive" onClick={() => {
                                  const source = currentBlocks.find((block) => block.id === blockForm.id);
                                  if (source) setDeleteBlockTarget(source);
                                }}>
                                  <Trash className="mr-2 h-4 w-4" />
                                  Excluir Bloco
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'valide' && (
                <div className="max-w-3xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Checklist (Valide)</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Itens que o aluno deve confirmar que fez.</p>
                    </div>
                    <Button size="sm" onClick={() => setShowValideModal(true)} className="h-8 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(!editMod.valide_checklist || editMod.valide_checklist.length === 0) ? (
                      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
                        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Nenhum item no checklist.</p>
                      </div>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleValideDragEnd}>
                        <SortableContext
                          items={editMod.valide_checklist.map((item: any, index: number) => item.id || `valide_${index}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-3">
                            {editMod.valide_checklist.map((item: any, index: number) => (
                              <SortableValideListItem
                                key={item.id || index}
                                item={item}
                                index={index}
                                total={editMod.valide_checklist!.length}
                                onTextChange={(value) => {
                                  const current = [...(editMod.valide_checklist || [])];
                                  current[index] = { ...current[index], text: value };
                                  setEditMod({ ...editMod, valide_checklist: current });
                                }}
                                onDescriptionChange={(value) => {
                                  const current = [...(editMod.valide_checklist || [])];
                                  current[index] = { ...current[index], description: value };
                                  setEditMod({ ...editMod, valide_checklist: current });
                                }}
                                onRemove={() => removeValideItem(index)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>

                  <Button onClick={() => void handleSave('Valide')} disabled={savingTab === 'Valide'} className="mt-4 w-full bg-[#E85D24] text-white hover:bg-[#E85D24]/90 sm:w-auto">
                    {savingTab === 'Valide' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Valide
                  </Button>
                </div>
              )}

              {activeTab === 'finalize' && (
                <div className="max-w-2xl space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Mensagem de Conclusão</Label>
                      <Textarea rows={4} placeholder="Parabéns por concluir esta etapa..." value={editMod.finalize_success_message || ''} onChange={(event) => setEditMod({ ...editMod, finalize_success_message: event.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nome do Selo/Badge</Label>
                      <Input placeholder="Ex: Clínica Estruturada" value={editMod.finalize_badge_name || ''} onChange={(event) => setEditMod({ ...editMod, finalize_badge_name: event.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Próxima Ação Sugerida</Label>
                      <Input placeholder="Ex: Acesse o próximo módulo para continuar" value={editMod.finalize_next_action || ''} onChange={(event) => setEditMod({ ...editMod, finalize_next_action: event.target.value })} />
                    </div>
                  </div>

                  <Button onClick={() => void handleSave('Finalize')} disabled={savingTab === 'Finalize'} className="w-full bg-[#E85D24] text-white hover:bg-[#E85D24]/90 sm:w-auto">
                    {savingTab === 'Finalize' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Finalize
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
      )}

      <Dialog open={pillarModalOpen} onOpenChange={setPillarModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{pillarForm.id ? 'Editar Pilar' : 'Novo Pilar'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do pilar</Label>
              <Input value={pillarForm.nome} onChange={(event) => setPillarForm({ ...pillarForm, nome: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={3} value={pillarForm.descricao} onChange={(event) => setPillarForm({ ...pillarForm, descricao: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fase / Categoria</Label>
              <Input value={pillarForm.fase_claro} onChange={(event) => setPillarForm({ ...pillarForm, fase_claro: event.target.value })} placeholder="Ex: Fase C" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={pillarForm.ativo} onCheckedChange={(checked) => setPillarForm({ ...pillarForm, ativo: checked })} />
              <Label>Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPillarModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSavePillar()} className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90">
              Salvar pilar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moduleModalOpen} onOpenChange={setModuleModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{moduleForm.id ? 'Editar Módulo' : 'Novo Módulo'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título do módulo</Label>
              <Input value={moduleForm.title} onChange={(event) => setModuleForm({ ...moduleForm, title: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição curta</Label>
              <Input value={moduleForm.description} onChange={(event) => setModuleForm({ ...moduleForm, description: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Pilar</Label>
              <Select value={moduleForm.pilar_id} onValueChange={(value) => setModuleForm({ ...moduleForm, pilar_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pilar" />
                </SelectTrigger>
                <SelectContent>
                  {availablePillarsForSelect.map((pillar) => (
                    <SelectItem key={pillar.id} value={pillar.id}>
                      {pillarOrderMap[pillar.id]}. {pillar.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duração estimada em minutos</Label>
              <Input
                type="number"
                value={moduleForm.duracao_minutos}
                onChange={(event) => setModuleForm({ ...moduleForm, duracao_minutos: Number(event.target.value || 0) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={moduleForm.active} onCheckedChange={(checked) => setModuleForm({ ...moduleForm, active: checked })} />
              <Label>Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveModule()} className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90">
              {moduleForm.id ? 'Salvar módulo' : 'Criar módulo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockTypeModalOpen} onOpenChange={setBlockTypeModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Adicionar Bloco</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            {BLOCK_TYPE_DEFINITIONS.map((definition) => {
              const Icon = definition.icon;
              return (
                <button
                  key={definition.type}
                  type="button"
                  onClick={() => openCreateBlock(definition.type)}
                  className="rounded-2xl border border-border bg-background p-4 text-left transition-all hover:border-[#E85D24]/40 hover:bg-[#FFF9F5]"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-muted/50 p-3">
                      <Icon className={cn('h-10 w-10', definition.colorClass)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{definition.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{definition.description}</p>
                      <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                        {definition.example}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showValideModal} onOpenChange={setShowValideModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Item de Checklist (Valide)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Texto Principal</Label>
              <Input value={newValide.text} onChange={(event) => setNewValide({ ...newValide, text: event.target.value })} placeholder="Ex: Configurei meu Instagram profissional" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição Auxiliar (opcional)</Label>
              <Textarea rows={2} value={newValide.description} onChange={(event) => setNewValide({ ...newValide, description: event.target.value })} placeholder="Dica extra para ajudar o aluno..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValideModal(false)}>Cancelar</Button>
            <Button onClick={addValideItem} className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90">
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePillarTarget} onOpenChange={(open) => !open && setDeletePillarTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pilar?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá permanentemente o pilar <strong>"{deletePillarTarget?.title}"</strong> e todos os módulos e blocos vinculados a ele. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletePillarTarget && void deletePillar(deletePillarTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá o módulo e todos os blocos vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && void deleteModule(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteBlockTarget} onOpenChange={(open) => !open && setDeleteBlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bloco?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente o bloco do módulo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteBlockTarget && void deleteBlock(deleteBlockTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
