import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildMaterialContent } from "@/utils/materialFormatting";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Calculator,
  Check,
  CheckCircle2,
  CheckSquare,
  Compass,
  Copy,
  FileCheck,
  FileText,
  Loader2,
  MessageSquare,
  Package,
  PartyPopper,
  PlayCircle,
  Settings2,
  Table,
  Target,
  Trash2,
  Trophy,
  Video,
} from "lucide-react";
import { toast } from "sonner";

// Converte qualquer URL do YouTube para o formato embed compatível com iframe
function toYoutubeEmbed(url: string): string {
  if (!url) return url;
  // Já é embed
  if (url.includes('youtube.com/embed/')) return url;
  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  // youtube.com/shorts/VIDEO_ID
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  // Retorna original se não reconheceu
  return url;
}

const STEPS = ["aprenda", "construa", "valide", "finalize"] as const;
type Step = typeof STEPS[number];
const STEP_STORAGE_MAP: Record<Step, string> = {
  aprenda: "aprender",
  construa: "construa",
  valide: "valide",
  finalize: "finalize",
};

function normalizeStoredStep(step: string): Step | null {
  if (step === "aprender") return "aprenda";
  if (step === "construa" || step === "valide" || step === "finalize") return step;
  return null;
}

type BlockType =
  | "texto_guiado"
  | "matriz_tabela"
  | "script_atendimento"
  | "selecao_estrategica"
  | "calculadora"
  | "criacao_oferta"
  | "mapa_icp"
  | "checklist_acao";

type SaveState = "idle" | "saving" | "saved" | "error";

interface ModuleData {
  id: string;
  pillar: number | null;
  pilar_id: string | null;
  title: string;
  description: string | null;
  video_url: string | null;
  aprender_content: string | null;
  valide_checklist: Array<{ id?: string; text: string; description?: string }>;
  valide_items?: string[] | null;
  finalize_content: string | null;
  finalize_success_message: string | null;
  finalize_badge_name: string | null;
  finalize_next_action: string | null;
}

interface ModuleBlock {
  id: string;
  module_id: string;
  tipo: BlockType;
  titulo: string;
  instrucao: string | null;
  config: Record<string, any> | null;
  ordem_index: number;
  salvar_no_cerebro: boolean;
  cerebro_chave: string | null;
  gera_material: boolean;
  material_categoria: string | null;
}

interface BlockResponseRow {
  block_id: string;
  response: any;
  completed: boolean | null;
}

interface PendingSyncState {
  block: ModuleBlock;
  columns: Record<string, any>;
  existingFields: string[];
}

interface BlockDefinition {
  label: string;
  description: string;
  colorClass: string;
  icon: typeof FileText;
}

const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  texto_guiado: {
    label: "Texto Guiado",
    description: "Reflexões abertas, análises e diagnósticos livres.",
    colorClass: "text-sky-600",
    icon: FileText,
  },
  matriz_tabela: {
    label: "Matriz / Tabela",
    description: "Procedimentos, comparativos e análises estruturadas.",
    colorClass: "text-emerald-600",
    icon: Table,
  },
  script_atendimento: {
    label: "Script de Atendimento",
    description: "Etapas guiadas para construir scripts comerciais.",
    colorClass: "text-violet-600",
    icon: MessageSquare,
  },
  selecao_estrategica: {
    label: "Seleção Estratégica",
    description: "Escolhas estratégicas com contexto adicional.",
    colorClass: "text-orange-600",
    icon: Compass,
  },
  calculadora: {
    label: "Calculadora",
    description: "Metas, ticket médio, ROI e projeções.",
    colorClass: "text-amber-600",
    icon: Calculator,
  },
  criacao_oferta: {
    label: "Criação de Oferta",
    description: "Formulário estruturado com preview em tempo real.",
    colorClass: "text-rose-600",
    icon: Package,
  },
  mapa_icp: {
    label: "Mapa de ICP",
    description: "Perfil ideal do paciente com progresso por seção.",
    colorClass: "text-teal-600",
    icon: Target,
  },
  checklist_acao: {
    label: "Checklist de Ação",
    description: "Implementação prática com barra de progresso.",
    colorClass: "text-green-700",
    icon: CheckSquare,
  },
};

const DEFAULT_OFFER_FIELDS = [
  { label: "Nome do procedimento", obrigatorio: true },
  { label: "Resultado prometido", obrigatorio: true },
  { label: "Público-alvo", obrigatorio: true },
  { label: "Diferenciais", obrigatorio: true },
  { label: "Preço", obrigatorio: true },
  { label: "Condições", obrigatorio: false },
  { label: "CTA", obrigatorio: true },
  { label: "O que está incluído", obrigatorio: true },
];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)}%`;
}

function normalizeNumber(value: any) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function countFilledValues(value: any): number {
  if (Array.isArray(value)) {
    return value.reduce((acc, item) => acc + countFilledValues(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.values(value).reduce((acc, item) => acc + countFilledValues(item), 0);
  }
  if (typeof value === "string") return value.trim() ? 1 : 0;
  if (typeof value === "number") return Number.isFinite(value) ? 1 : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  return 0;
}

function hasFilledRow(row: Record<string, any>) {
  return Object.values(row || {}).some((value) => {
    if (typeof value === "string") return value.trim().length > 0;
    return value !== null && value !== undefined && value !== "";
  });
}

function formatResponseForMaterial(value: any, depth = 0): string {
  const indent = "  ".repeat(depth);
  if (Array.isArray(value)) {
    return value
      .map((item, index) => `${indent}- ${typeof item === "object" ? `Item ${index + 1}\n${formatResponseForMaterial(item, depth + 1)}` : String(item)}`)
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => {
        const label = key.replace(/_/g, " ");
        if (typeof item === "object" && item !== null) {
          return `${indent}${label}:\n${formatResponseForMaterial(item, depth + 1)}`;
        }
        return `${indent}${label}: ${String(item ?? "")}`;
      })
      .join("\n");
  }

  return `${indent}${String(value ?? "")}`;
}

function evaluateFormula(formula: string, values: Record<string, number>) {
  if (!formula?.trim()) return 0;

  try {
    const keys = Object.keys(values);
    const args = keys.map((key) => values[key] ?? 0);
    const safeFormula = formula.replace(/[^0-9a-zA-Z_+\-*/().,\s%]/g, "");
    const result = new Function(...keys, `return (${safeFormula});`)(...args);
    return Number.isFinite(result) ? Number(result) : 0;
  } catch {
    return 0;
  }
}

function formatCalculatedValue(value: number, type?: string) {
  if (type === "moeda") return formatCurrency(value);
  if (type === "%" || type === "percentual") return formatPercent(value);
  return new Intl.NumberFormat("pt-BR").format(value);
}

function buildEmptyTableRow(columns: Array<{ label?: string }>) {
  return columns.reduce<Record<string, string>>((acc, column, index) => {
    const key = slugify(column.label || `coluna_${index + 1}`) || `coluna_${index + 1}`;
    acc[key] = "";
    return acc;
  }, {});
}

function getOfferFields(config: Record<string, any> | null | undefined) {
  if (Array.isArray(config?.campos) && config.campos.length > 0) {
    return config.campos.map((field: any, index: number) => ({
      id: field.id || `${slugify(field.label || `campo_${index + 1}`) || `campo_${index + 1}`}_${index}`,
      label: field.label || `Campo ${index + 1}`,
      obrigatorio: !!field.obrigatorio,
    }));
  }

  return DEFAULT_OFFER_FIELDS.map((field, index) => ({
    id: `${slugify(field.label) || `campo_${index + 1}`}_${index}`,
    label: field.label,
    obrigatorio: field.obrigatorio,
  }));
}

function splitTextList(value: any) {
  return String(value || "")
    .split(/\n|,|;/)
    .map((item) => item.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

function hasMeaningfulValue(value: any): boolean {
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => hasMeaningfulValue(item));
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  return value !== null && value !== undefined;
}

function getValidateStorageKey(userId: string, moduleId: string) {
  return `trilha_valide_${userId}_${moduleId}`;
}

function normalizeValideItems(moduleData: ModuleData | null) {
  if (!moduleData) return [];

  if (Array.isArray(moduleData.valide_items) && moduleData.valide_items.length > 0) {
    return moduleData.valide_items.map((text, index) => ({
      id: `valide_item_${index + 1}`,
      text: String(text || ""),
    }));
  }

  if (Array.isArray(moduleData.valide_checklist) && moduleData.valide_checklist.length > 0) {
    return moduleData.valide_checklist.map((item, index) => ({
      id: item.id || `valide_item_${index + 1}`,
      text: item.text,
      description: item.description,
    }));
  }

  return [];
}

function getBlockDefaultResponse(block: ModuleBlock) {
  const config = block.config || {};

  switch (block.tipo) {
    case "texto_guiado":
      return { texto: "" };
    case "matriz_tabela": {
      const columns = Array.isArray(config.colunas) ? config.colunas : [];
      const initialRows = Math.max(1, Number(config.linhas_iniciais ?? 3));
      return {
        rows: Array.from({ length: initialRows }, () => buildEmptyTableRow(columns)),
      };
    }
    case "script_atendimento": {
      const stages = Array.isArray(config.etapas) ? config.etapas : [];
      return {
        answers: stages.reduce<Record<string, string>>((acc, stage: any, index: number) => {
          const key = stage.id || `${slugify(stage.nome || `etapa_${index + 1}`) || `etapa_${index + 1}`}_${index}`;
          acc[key] = "";
          return acc;
        }, {}),
      };
    }
    case "selecao_estrategica":
      return {
        selected: config.multipla ? [] : "",
      };
    case "calculadora": {
      const inputs = Array.isArray(config.campos_entrada) ? config.campos_entrada : [];
      return {
        inputs: inputs.reduce<Record<string, number>>((acc, field: any, index: number) => {
          const key = field.nome || slugify(field.label || `campo_${index + 1}`) || `campo_${index + 1}`;
          acc[key] = Number(field.valor_padrao ?? 0);
          return acc;
        }, {}),
      };
    }
    case "criacao_oferta": {
      const fields = getOfferFields(config);
      return {
        values: fields.reduce<Record<string, string>>((acc, field) => {
          acc[field.id] = "";
          return acc;
        }, {}),
      };
    }
    case "mapa_icp": {
      const sections = Array.isArray(config.secoes) ? config.secoes : [];
      return {
        sections: sections.reduce<Record<string, Record<string, string>>>((acc, section: any, sectionIndex: number) => {
          const sectionKey = section.id || `${slugify(section.nome || `secao_${sectionIndex + 1}`) || `secao_${sectionIndex + 1}`}_${sectionIndex}`;
          const fields = Array.isArray(section.campos) ? section.campos : [];
          acc[sectionKey] = fields.reduce<Record<string, string>>((fieldAcc, field: any, fieldIndex: number) => {
            const fieldKey = field.id || `${slugify(field.label || `campo_${fieldIndex + 1}`) || `campo_${fieldIndex + 1}`}_${fieldIndex}`;
            fieldAcc[fieldKey] = "";
            return fieldAcc;
          }, {});
          return acc;
        }, {}),
      };
    }
    case "checklist_acao": {
      const items = Array.isArray(config.itens) ? config.itens : [];
      return {
        items: items.reduce<Record<string, { checked: boolean; resposta: string }>>((acc, item: any, index: number) => {
          const key = item.id || `${slugify(item.texto || `item_${index + 1}`) || `item_${index + 1}`}_${index}`;
          acc[key] = { checked: false, resposta: "" };
          return acc;
        }, {}),
      };
    }
    default:
      return {};
  }
}

function getBlockCompletion(block: ModuleBlock, response: any) {
  const config = block.config || {};

  switch (block.tipo) {
    case "texto_guiado": {
      const minChars = Number(config.min_chars ?? 0);
      const text = String(response?.texto || "");
      return text.trim().length >= minChars && text.trim().length > 0;
    }
    case "matriz_tabela": {
      const rows = Array.isArray(response?.rows) ? response.rows : [];
      return rows.some((row: Record<string, any>) => hasFilledRow(row));
    }
    case "script_atendimento": {
      const stages = Array.isArray(config.etapas) ? config.etapas : [];
      const answers = response?.answers || {};
      if (stages.length === 0) return false;
      return stages.every((stage: any, index: number) => {
        const key = stage.id || `${slugify(stage.nome || `etapa_${index + 1}`) || `etapa_${index + 1}`}_${index}`;
        return String(answers[key] || "").trim().length > 0;
      });
    }
    case "selecao_estrategica": {
      const selected = response?.selected;
      return Array.isArray(selected) ? selected.length > 0 : String(selected || "").trim().length > 0;
    }
    case "calculadora": {
      const inputs = Array.isArray(config.campos_entrada) ? config.campos_entrada : [];
      const values = response?.inputs || {};
      return inputs.length > 0 && inputs.every((field: any, index: number) => {
        const key = field.nome || slugify(field.label || `campo_${index + 1}`) || `campo_${index + 1}`;
        return values[key] !== "" && values[key] !== null && values[key] !== undefined;
      });
    }
    case "criacao_oferta": {
      const fields = getOfferFields(config).filter((field) => field.obrigatorio);
      const values = response?.values || {};
      return fields.length > 0 && fields.every((field) => String(values[field.id] || "").trim().length > 0);
    }
    case "mapa_icp": {
      const sections = Array.isArray(config.secoes) ? config.secoes.filter((section: any) => section.visivel !== false) : [];
      const totalFields = sections.reduce((acc: number, section: any) => acc + (Array.isArray(section.campos) ? section.campos.length : 0), 0);
      const filled = countFilledValues(response?.sections || {});
      if (totalFields === 0) return false;
      return filled / totalFields >= 0.5;
    }
    case "checklist_acao": {
      const items = Array.isArray(config.itens) ? config.itens : [];
      const values = response?.items || {};
      if (items.length === 0) return false;
      const checkedCount = items.filter((item: any, index: number) => {
        const key = item.id || `${slugify(item.texto || `item_${index + 1}`) || `item_${index + 1}`}_${index}`;
        return values[key]?.checked === true;
      }).length;
      return checkedCount / items.length >= 0.8;
    }
    default:
      return false;
  }
}

export default function Modulo() {
  const { moduloId } = useParams();
  const navigate = useNavigate();
  const { progress, markModuleComplete, isMember } = usePlataforma();
  const { user } = useAuth();

  const [moduleData, setModuleData] = useState<ModuleData | null>(null);
  const [pillarModules, setPillarModules] = useState<ModuleData[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>("aprenda");
  const activeSteps = isMember ? (STEPS.slice(0, 1) as readonly Step[]) : STEPS;
  const [isLoading, setIsLoading] = useState(true);
  const [checkedItens, setCheckedItens] = useState<Record<string, boolean>>({});
  const [isValideCompleted, setIsValideCompleted] = useState(false);
  const [showMilestone, setShowMilestone] = useState<{ title: string; desc: string } | null>(null);
  const [moduleBlocks, setModuleBlocks] = useState<ModuleBlock[]>([]);
  const [blockResponses, setBlockResponses] = useState<Record<string, any>>({});
  const [blockCompleted, setBlockCompleted] = useState<Record<string, boolean>>({});
  const [blockSaveStates, setBlockSaveStates] = useState<Record<string, SaveState>>({});
  const [cerebroRecord, setCerebroRecord] = useState<Record<string, any> | null>(null);
  const [syncedBlocks, setSyncedBlocks] = useState<Record<string, string>>({});
  const [pendingSyncState, setPendingSyncState] = useState<PendingSyncState | null>(null);

  const debounceTimersRef = useRef<Record<string, NodeJS.Timeout | null>>({});
  const pendingPayloadsRef = useRef<Record<string, any>>({});
  const valideItems = useMemo(() => normalizeValideItems(moduleData), [moduleData]);

  useEffect(() => {
    async function init() {
      if (!moduloId || !user) return;
      setIsLoading(true);

      const { data: mod, error: modError } = await supabase
        .from("platform_modules")
        .select("*")
        .eq("id", moduloId)
        .single();

      if (modError || !mod) {
        setIsLoading(false);
        return;
      }

      setModuleData(mod as ModuleData);

      let siblingsQuery = supabase.from("platform_modules").select("*").order("order_index", { ascending: true });
      siblingsQuery = mod.pilar_id ? siblingsQuery.eq("pilar_id", mod.pilar_id) : siblingsQuery.eq("pillar", mod.pillar);

      const [
        siblingsResult,
        progressResult,
        blocksResult,
        responsesResult,
        cerebroResult,
      ] = await Promise.all([
        siblingsQuery,
        supabase
          .from("platform_module_progress_detail")
          .select("module_id, step, completed")
          .eq("user_id", user.id)
          .eq("completed", true),
        supabase.from("platform_module_blocks").select("*").eq("module_id", moduloId).order("ordem_index", { ascending: true }),
        supabase.from("platform_block_responses").select("block_id, response, completed").eq("user_id", user.id).eq("module_id", moduloId),
        supabase.from("platform_cerebro").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      if (siblingsResult.data) setPillarModules(siblingsResult.data as ModuleData[]);

      const allProgDetails = progressResult.data || [];
      const doneSteps = allProgDetails
        .filter((item) => item.module_id === moduloId)
        .map((item) => normalizeStoredStep(item.step))
        .filter((item): item is Step => item !== null);
      const validateDone = doneSteps.includes("valide") || doneSteps.includes("finalize");
      setIsValideCompleted(validateDone);

      if (doneSteps.includes("finalize")) {
        setCurrentStep("finalize");
      } else if (doneSteps.includes("valide")) {
        setCurrentStep("finalize");
      } else if (doneSteps.includes("construa")) {
        setCurrentStep("valide");
      } else if (doneSteps.includes("aprenda")) {
        setCurrentStep("construa");
      } else {
        setCurrentStep("aprenda");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).inProgressModulesCache = [...new Set(allProgDetails.map((item) => item.module_id))];

      const blocks = ((blocksResult.data || []) as ModuleBlock[]).sort((a, b) => a.ordem_index - b.ordem_index);
      setModuleBlocks(blocks);

      const responses = (responsesResult.data || []) as BlockResponseRow[];
      const responseMap = responses.reduce<Record<string, any>>((acc, item) => {
        acc[item.block_id] = item.response ?? {};
        return acc;
      }, {});
      const completedMap = blocks.reduce<Record<string, boolean>>((acc, block) => {
        const existing = responses.find((item) => item.block_id === block.id);
        const payload = responseMap[block.id] ?? getBlockDefaultResponse(block);
        acc[block.id] = existing?.completed ?? getBlockCompletion(block, payload);
        return acc;
      }, {});

      setBlockResponses(responseMap);
      setBlockCompleted(completedMap);
      setBlockSaveStates({});
      setCerebroRecord((cerebroResult.data as Record<string, any> | null) || null);
      setSyncedBlocks({});
      setIsLoading(false);
    }

    void init();

    return () => {
      Object.entries(pendingPayloadsRef.current).forEach(([blockId, payload]) => {
        const timer = debounceTimersRef.current[blockId];
        if (timer) clearTimeout(timer);
        const block = blocks.find((item) => item.id === blockId);
        if (block) {
          void saveBlockResponse(block, payload);
        }
      });

      Object.values(debounceTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [moduloId, user]);

  useEffect(() => {
    if (!user || !moduloId) return;

    if (valideItems.length === 0) {
      setCheckedItens({});
      return;
    }

    const allCheckedState = valideItems.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.id] = true;
      return acc;
    }, {});

    if (isValideCompleted) {
      setCheckedItens(allCheckedState);
      try {
        localStorage.setItem(getValidateStorageKey(user.id, moduloId), JSON.stringify(allCheckedState));
      } catch {
        // Ignora falhas de storage sem afetar o fluxo da tela.
      }
      return;
    }

    try {
      const stored = localStorage.getItem(getValidateStorageKey(user.id, moduloId));
      if (!stored) {
        setCheckedItens(
          valideItems.reduce<Record<string, boolean>>((acc, item) => {
            acc[item.id] = false;
            return acc;
          }, {}),
        );
        return;
      }

      const parsed = JSON.parse(stored) as Record<string, boolean>;
      setCheckedItens(
        valideItems.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.id] = parsed[item.id] === true;
          return acc;
        }, {}),
      );
    } catch {
      setCheckedItens(
        valideItems.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.id] = false;
          return acc;
        }, {}),
      );
    }
  }, [isValideCompleted, moduloId, user, valideItems]);

  useEffect(() => {
    if (!user || !moduloId || valideItems.length === 0 || isValideCompleted) return;

    try {
      localStorage.setItem(getValidateStorageKey(user.id, moduloId), JSON.stringify(checkedItens));
    } catch {
      // Sem impacto funcional caso o navegador negue acesso ao storage.
    }
  }, [checkedItens, isValideCompleted, moduloId, user, valideItems]);

  const currentIndex = pillarModules.findIndex((moduleItem) => moduleItem.id === moduloId);
  const nextModule = currentIndex < pillarModules.length - 1 ? pillarModules[currentIndex + 1] : null;

  const currentBlockProgress = useMemo(() => {
    const total = moduleBlocks.length;
    const completed = moduleBlocks.filter((block) => blockCompleted[block.id]).length;
    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      allCompleted: total > 0 ? completed === total : false,
    };
  }, [moduleBlocks, blockCompleted]);

  const globalSaving = useMemo(
    () => Object.values(blockSaveStates).some((state) => state === "saving"),
    [blockSaveStates],
  );

  const getOfferFieldValue = (block: ModuleBlock, response: any, matcher: (label: string) => boolean) => {
    const field = getOfferFields(block.config || {}).find((item) => matcher(item.label));
    if (!field) return "";
    return String(response?.values?.[field.id] || "").trim();
  };

  const getCalculatedResultsMap = (block: ModuleBlock, response: any) => {
    if (block.tipo !== "calculadora") return {} as Record<string, number>;

    const config = block.config || {};
    const inputFields = Array.isArray(config.campos_entrada) ? config.campos_entrada : [];
    const resultFields = Array.isArray(config.campos_resultado) ? config.campos_resultado : [];

    const numericValues = inputFields.reduce<Record<string, number>>((acc, field: any, index: number) => {
      const key = field.nome || slugify(field.label || `campo_${index + 1}`) || `campo_${index + 1}`;
      acc[key] = normalizeNumber(response?.inputs?.[key]);
      return acc;
    }, {});

    return resultFields.reduce<Record<string, number>>((acc, field: any, index: number) => {
      const resultKey =
        field.label ||
        field.nome ||
        field.id ||
        slugify(field.resultado_label || `resultado_${index + 1}`) ||
        `resultado_${index + 1}`;
      acc[resultKey] = evaluateFormula(field.formula || "", { ...numericValues, ...acc });
      return acc;
    }, {});
  };

  const normalizeFilledRows = (block: ModuleBlock, response: any) => {
    const config = block.config || {};
    const columns = Array.isArray(config.colunas) ? config.colunas : [];
    const rows = Array.isArray(response?.rows) ? response.rows : [];

    return rows
      .filter((row: Record<string, any>) => hasFilledRow(row))
      .map((row: Record<string, any>) =>
        columns.reduce<Record<string, any>>((acc, column: any, index: number) => {
          const key = slugify(column.label || `coluna_${index + 1}`) || `coluna_${index + 1}`;
          const value = row[key];
          if (value !== null && value !== undefined && String(value).trim() !== "") {
            acc[column.label || `Coluna ${index + 1}`] = value;
          }
          return acc;
        }, {}),
      );
  };

  const buildCerebroSyncPayload = (block: ModuleBlock, response: any) => {
    const moduleId = moduloId || block.module_id;
    const currentModuleData = (cerebroRecord?.module_data as Record<string, any>) || {};

    switch (moduleId) {
      case "1.2": {
        return {
          columns: {
            posicionamento_frase: getOfferFieldValue(block, response, (label) => label.toLowerCase().includes("frase completa")),
          },
          moduleData: {
            ...currentModuleData,
            [moduleId]: {
              ...(currentModuleData[moduleId] || {}),
              posicionamento_frase: getOfferFieldValue(block, response, (label) => label.toLowerCase().includes("frase completa")),
            },
          },
        };
      }
      case "1.3": {
        const sections = Array.isArray(block.config?.secoes) ? block.config?.secoes : [];
        const getSectionValues = (sectionName: string) => {
          const index = sections.findIndex((section: any) => section.nome === sectionName);
          if (index < 0) return {};
          const sectionKey =
            sections[index].id ||
            `${slugify(sections[index].nome || `secao_${index + 1}`) || `secao_${index + 1}`}_${index}`;
          return response?.sections?.[sectionKey] || {};
        };

        const demografico = getSectionValues("Perfil Demográfico");
        const psicografico = getSectionValues("Perfil Psicográfico");
        const comportamento = getSectionValues("Comportamento de Compra");
        const canais = Object.values(getSectionValues("Canais de Chegada")).flatMap(splitTextList);
        const objecoes = Object.values(getSectionValues("Objeções Frequentes")).flatMap(splitTextList);

        return {
          columns: {
            icp_demografico: demografico,
            icp_psicografico: psicografico,
            icp_comportamento: comportamento,
            icp_canais: canais,
            icp_objecoes: objecoes,
          },
          moduleData: {
            ...currentModuleData,
            [moduleId]: {
              ...(currentModuleData[moduleId] || {}),
              icp_demografico: demografico,
              icp_psicografico: psicografico,
              icp_comportamento: comportamento,
              icp_canais: canais,
              icp_objecoes: objecoes,
            },
          },
        };
      }
      case "1.5": {
        if (block.tipo === "texto_guiado") {
          const diferencial = String(response?.texto || "").trim();
          return {
            columns: { diferencial_competitivo: diferencial },
            moduleData: {
              ...currentModuleData,
              [moduleId]: { ...(currentModuleData[moduleId] || {}), diferencial_competitivo: diferencial },
            },
          };
        }

        const proposta = getOfferFieldValue(block, response, (label) => label.toLowerCase().includes("proposta completa"));
        return {
          columns: { proposta_de_valor: proposta },
          moduleData: {
            ...currentModuleData,
            [moduleId]: { ...(currentModuleData[moduleId] || {}), proposta_de_valor: proposta },
          },
        };
      }
      case "1.6": {
        const results = getCalculatedResultsMap(block, response);
        return {
          columns: {
            ticket_minimo: results.ticket_minimo ?? 0,
            ticket_com_margem: results.ticket_com_margem ?? 0,
          },
          moduleData: {
            ...currentModuleData,
            [moduleId]: {
              ...(currentModuleData[moduleId] || {}),
              ticket_minimo: results.ticket_minimo ?? 0,
              ticket_com_margem: results.ticket_com_margem ?? 0,
            },
          },
        };
      }
      case "1.7": {
        const ofertaPrincipal = {
          nome: getOfferFieldValue(block, response, (label) => label.toLowerCase().includes("nome da oferta")),
          resultado: getOfferFieldValue(block, response, (label) => label.toLowerCase().includes("resultado prometido")),
          processo: getOfferFieldValue(block, response, (label) => label.toLowerCase().includes("o que está incluído")),
          diferencial: getOfferFieldValue(block, response, (label) => label.toLowerCase().includes("diferencial desta oferta")),
          investimento: getOfferFieldValue(block, response, (label) => label.toLowerCase().includes("investimento")),
        };

        return {
          columns: { oferta_principal: ofertaPrincipal },
          moduleData: {
            ...currentModuleData,
            [moduleId]: { ...(currentModuleData[moduleId] || {}), oferta_principal: ofertaPrincipal },
          },
        };
      }
      case "2.3": {
        const estrategia = normalizeFilledRows(block, response);
        return {
          columns: { estrategia_audiencia: estrategia },
          moduleData: {
            ...currentModuleData,
            [moduleId]: { ...(currentModuleData[moduleId] || {}), estrategia_audiencia: estrategia },
          },
        };
      }
      case "2.6": {
        const rows = normalizeFilledRows(block, response);
        const cplValues = rows
          .map((row) => normalizeNumber(row["CPL (Custo por Lead em R$)"]))
          .filter((value) => Number.isFinite(value) && value > 0);
        const cplReferencia = cplValues.length > 0 ? cplValues.reduce((sum, value) => sum + value, 0) / cplValues.length : 0;

        return {
          columns: { cpl_referencia: cplReferencia },
          moduleData: {
            ...currentModuleData,
            [moduleId]: { ...(currentModuleData[moduleId] || {}), cpl_referencia: cplReferencia },
          },
        };
      }
      case "3.5": {
        const stages = Array.isArray(block.config?.etapas) ? block.config.etapas : [];
        const scriptAtendimento = stages.reduce<Record<string, string>>((acc, stage: any, index: number) => {
          const key = stage.id || `${slugify(stage.nome || `etapa_${index + 1}`) || `etapa_${index + 1}`}_${index}`;
          const answer = String(response?.answers?.[key] || "").trim();
          if (answer) acc[stage.nome || `Etapa ${index + 1}`] = answer;
          return acc;
        }, {});

        return {
          columns: { script_atendimento: scriptAtendimento },
          moduleData: {
            ...currentModuleData,
            [moduleId]: { ...(currentModuleData[moduleId] || {}), script_atendimento: scriptAtendimento },
          },
        };
      }
      case "3.10": {
        const calculatorBlock = moduleBlocks.find((item) => item.module_id === moduleId && item.tipo === "calculadora");
        const calculatorResponse = calculatorBlock ? getBlockResponse(calculatorBlock) : {};
        const calculatorResults = calculatorBlock ? getCalculatedResultsMap(calculatorBlock, calculatorResponse) : {};
        const metricasComerciais = {
          meta_faturamento: normalizeNumber(calculatorResponse?.inputs?.faturamento),
          leads_necessarios: calculatorResults.leads_necessarios ?? 0,
          taxa_fechamento: normalizeNumber(calculatorResponse?.inputs?.taxa_fechamento),
          ticket_medio: normalizeNumber(calculatorResponse?.inputs?.ticket_medio),
          cpl_atual: normalizeNumber(calculatorResponse?.inputs?.cpl_atual),
        };

        return {
          columns: { metricas_comerciais: metricasComerciais },
          moduleData: {
            ...currentModuleData,
            [moduleId]: { ...(currentModuleData[moduleId] || {}), metricas_comerciais: metricasComerciais },
          },
        };
      }
      default:
        return null;
    }
  };

  const getCategoryFromModuleId = (id: string) => {
    if (id === "1.1") return "Posicionamento";
    if (id === "1.2") return "ICP";
    if (id === "1.3") return "Procedimentos";
    if (id === "1.4") return "Precificação";
    if (id === "1.5") return "Oferta";
    if (id === "1.6") return "Métricas";
    if (id?.startsWith("2.")) return "Campanha";
    if (id === "3.1") return "Funil";
    if (id === "3.2") return "Script";
    if (id === "3.3") return "Follow-up";
    if (id === "3.4") return "Objeções";
    if (id === "3.5") return "Análise";
    if (id === "3.6") return "Gestão";
    return "Geral";
  };

  const getBlockResponse = (block: ModuleBlock) => blockResponses[block.id] ?? getBlockDefaultResponse(block);

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Não foi possível copiar agora.");
    }
  };

  const saveStepProgress = async (stepName: Step) => {
    if (!user || !moduloId) return;
    const storedStep = STEP_STORAGE_MAP[stepName];

    const { error } = await supabase
      .from("platform_module_progress_detail")
      .upsert(
        {
          user_id: user.id,
          module_id: moduloId,
          step: storedStep,
          completed: true,
        },
        { onConflict: "user_id,module_id,step" },
      );

    if (error) {
      throw error;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inProgressModulesCache = new Set<string>(((window as any).inProgressModulesCache || []) as string[]);
    inProgressModulesCache.add(moduloId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).inProgressModulesCache = Array.from(inProgressModulesCache);
  };

  const persistMaterial = async (block: ModuleBlock, response: any, forcedCategory?: string) => {
    if (!user || !moduloId || !moduleData || countFilledValues(response) === 0) return false;

    const materialCategory = forcedCategory || block.material_categoria || getCategoryFromModuleId(moduloId);
    const content = buildMaterialContent(block.titulo, response);
    const clinicName = user.user_metadata?.name || "Clínica";
    const title =
      block.tipo === "criacao_oferta"
        ? `Oferta: ${response?.values?.nome_do_procedimento_0 || response?.values?.nome_do_procedimento || moduleData.title}`
        : `${block.titulo} - ${clinicName}`;

    const { data: existing } = await supabase
      .from("platform_materiais")
      .select("id")
      .eq("user_id", user.id)
      .eq("module_id", moduloId)
      .eq("title", title)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("platform_materiais")
        .update({
          content,
          category: materialCategory,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) {
        toast.error(`Não foi possível salvar o material "${block.titulo}".`);
        return false;
      }
    } else {
      const { error } = await supabase.from("platform_materiais").insert({
        user_id: user.id,
        title,
        content,
        category: materialCategory,
        type: "document",
        module_id: moduloId,
        created_at: new Date().toISOString(),
      });
      if (error) {
        toast.error(`Não foi possível salvar o material "${block.titulo}".`);
        return false;
      }
    }

    return true;
  };

  const saveBlockResponse = async (block: ModuleBlock, response: any) => {
    if (!user || !moduloId) return;

    const completed = getBlockCompletion(block, response);

    setBlockSaveStates((prev) => ({ ...prev, [block.id]: "saving" }));

    const { error } = await supabase.from("platform_block_responses").upsert(
      {
        user_id: user.id,
        block_id: block.id,
        module_id: moduloId,
        response,
        completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,block_id" },
    );

    if (error) {
      setBlockSaveStates((prev) => ({ ...prev, [block.id]: "error" }));
      toast.error(`Não foi possível salvar "${block.titulo}".`);
      return;
    }

    setBlockCompleted((prev) => ({ ...prev, [block.id]: completed }));
    setBlockSaveStates((prev) => ({ ...prev, [block.id]: "saved" }));
  };

  const flushPendingBlockSaves = async () => {
    const entries = Object.entries(pendingPayloadsRef.current);

    for (const [blockId, payload] of entries) {
      const block = moduleBlocks.find((item) => item.id === blockId);
      const timer = debounceTimersRef.current[blockId];
      if (timer) {
        clearTimeout(timer);
        debounceTimersRef.current[blockId] = null;
      }
      if (block) {
        await saveBlockResponse(block, payload);
      }
      delete pendingPayloadsRef.current[blockId];
    }
  };

  const scheduleBlockSave = (block: ModuleBlock, response: any) => {
    const existingTimer = debounceTimersRef.current[block.id];
    if (existingTimer) clearTimeout(existingTimer);

    pendingPayloadsRef.current[block.id] = response;
    setBlockSaveStates((prev) => ({ ...prev, [block.id]: "saving" }));

    debounceTimersRef.current[block.id] = setTimeout(() => {
      void saveBlockResponse(block, response);
      delete pendingPayloadsRef.current[block.id];
      debounceTimersRef.current[block.id] = null;
    }, 1500);
  };

  const updateBlockResponse = (block: ModuleBlock, updater: any) => {
    setBlockResponses((prev) => {
      const previousResponse = prev[block.id] ?? getBlockDefaultResponse(block);
      const nextResponse = typeof updater === "function" ? updater(previousResponse) : updater;
      const nextMap = { ...prev, [block.id]: nextResponse };
      setBlockCompleted((current) => ({ ...current, [block.id]: getBlockCompletion(block, nextResponse) }));
      setSyncedBlocks((current) => {
        if (!current[block.id]) return current;
        const next = { ...current };
        delete next[block.id];
        return next;
      });
      scheduleBlockSave(block, nextResponse);
      return nextMap;
    });
  };

  const persistCerebroSync = async (block: ModuleBlock, response: any, allowOverwrite = false) => {
    if (!user) return false;
    const syncPayload = buildCerebroSyncPayload(block, response);
    if (!syncPayload) return false;

    const existingFields = Object.keys(syncPayload.columns).filter((key) => hasMeaningfulValue(cerebroRecord?.[key]));
    if (existingFields.length > 0 && !allowOverwrite) {
      setPendingSyncState({ block, columns: syncPayload.columns, existingFields });
      return false;
    }

    const payload = {
      user_id: user.id,
      ...syncPayload.columns,
      module_data: syncPayload.moduleData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("platform_cerebro")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      toast.error("Não foi possível salvar. Tente novamente.");
      return false;
    }

    setCerebroRecord(data as Record<string, any>);
    setSyncedBlocks((prev) => ({ ...prev, [block.id]: new Date().toISOString() }));
    return true;
  };

  const syncBlockToCerebro = async (block: ModuleBlock, response: any) => {
    const saved = await persistCerebroSync(block, response, false);
    if (saved) {
      toast.success("🧠 Cérebro atualizado! Suas IAs agora têm acesso a este conteúdo.", { duration: 3000 });
    }
  };

  const handleConfirmCerebroReplacement = async () => {
    if (!pendingSyncState || !user) return;

    const saved = await persistCerebroSync(pendingSyncState.block, getBlockResponse(pendingSyncState.block), true);
    if (!saved) {
      return;
    }

    setPendingSyncState(null);
    toast.success("🧠 Cérebro atualizado! Suas IAs agora têm acesso a este conteúdo.", { duration: 3000 });
  };

  const createDynamicMaterials = async () => {
    const candidates = moduleBlocks.filter((block) => countFilledValues(getBlockResponse(block)) > 0);
    let allSaved = true;
    for (const block of candidates) {
      const response = getBlockResponse(block);
      if (countFilledValues(response) > 0) {
        const saved = await persistMaterial(block, response);
        if (!saved) allSaved = false;
      }
    }
    return allSaved;
  };

  const syncDynamicCerebro = async () => {
    const candidates = moduleBlocks.filter((block) => block.salvar_no_cerebro && countFilledValues(getBlockResponse(block)) > 0);
    let allSaved = true;
    for (const block of candidates) {
      const response = getBlockResponse(block);
      const saved = await persistCerebroSync(block, response, true);
      if (!saved) allSaved = false;
    }
    return allSaved;
  };

  const checkMilestoneCompletion = (id: string) => {
    if (id === "1.6") {
      setShowMilestone({
        title: "CLINICA ESTRUTURADA",
        desc: "Sua fundacao comercial esta pronta. Voce concluiu a fase C do metodo C.L.A.R.O. e fortaleceu o seu Cerebro Central.",
      });
    } else if (id === "2.1") {
      setShowMilestone({
        title: "OPERACAO 24H ATIVA",
        desc: "Voce ativou a inteligencia de pre-atendimento. Sua clinica agora responde e qualifica com muito mais consistencia.",
      });
    } else if (id === "2.6") {
      setShowMilestone({
        title: "MAQUINA DE LEADS LIGADA",
        desc: "As campanhas foram estruturadas. Agora a operacao esta pronta para ganhar volume e previsibilidade.",
      });
    } else if (id === "3.6") {
      setShowMilestone({
        title: "FUNIL COMERCIAL OPERANDO",
        desc: "Voce concluiu a trilha e estruturou uma maquina comercial mais forte, previsivel e inteligente.",
      });
    }
  };

  const persistStepCompletion = async (stepName: Step) => {
    try {
      await saveStepProgress(stepName);
      return true;
    } catch {
      toast.error("Não foi possível registrar seu progresso agora.");
      return false;
    }
  };

  const advanceStep = async (step: Step) => {
    if (step === "aprenda") {
      const saved = await persistStepCompletion("aprenda");
      if (!saved) return;
      if (isMember) {
        await markModuleComplete(moduloId!);
        toast.success("Aula concluída!", { duration: 3000 });
        navigate(-1);
        return;
      }
      toast.success("Aula concluída. Agora vamos aplicar isso na sua clínica.");
      setCurrentStep("construa");
      return;
    }

    if (step === "construa") {
      await flushPendingBlockSaves();
      const saved = await persistStepCompletion("construa");
      if (!saved) return;
      const cerebroSaved = await syncDynamicCerebro();
      const materialsSaved = await createDynamicMaterials();
      if (!cerebroSaved || !materialsSaved) {
        toast.error("Parte do conteúdo não foi salva corretamente. Tente novamente.");
        return;
      }
      toast.success("Construa concluído. Tudo salvo para você seguir.");
      setCurrentStep("valide");
      return;
    }

    if (step === "valide") {
      const saved = await persistStepCompletion("valide");
      if (!saved) return;
      toast.success("Checklist completo. Agora você pode finalizar o módulo.");
      setCurrentStep("finalize");
      return;
    }

    if (step === "finalize") {
      const saved = await persistStepCompletion("finalize");
      if (!saved) return;
      await markModuleComplete(moduloId!);
      toast.success(`Módulo ${moduleData?.title} concluído!`, { duration: 4000 });
      checkMilestoneCompletion(moduloId!);
    }
  };

  if (isLoading || !moduleData) {
    return (
      <div className="mt-20 flex justify-center p-8 text-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-[#E85D24]" />
      </div>
    );
  }

  const renderAprenda = () => (
    <div className="animate-in slide-in-from-right-4 space-y-6 duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Video className="h-4.5 w-4.5 text-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground font-display">Aprenda a estratégia</h3>
          <p className="text-[13px] text-muted-foreground">Assista ao conteúdo antes de aplicarmos isso na sua clínica.</p>
        </div>
      </div>

      {moduleData.aprender_content && (
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground xl:prose-base dark:prose-invert">
          {moduleData.aprender_content}
        </div>
      )}

      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-background shadow-card">
        {moduleData.video_url ? (
          <iframe
            src={toYoutubeEmbed(moduleData.video_url)}
            className="absolute inset-0 h-full w-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-muted p-4">
              <PlayCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Vídeo em breve</p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={() => void advanceStep("aprenda")}
          className="bg-[#E85D24] text-white hover:bg-[#D04E1A] font-semibold h-10 px-6"
        >
          Concluí a aula <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderTextoGuiado = (block: ModuleBlock) => {
    const response = getBlockResponse(block);
    const config = block.config || {};
    const maxChars = Number(config.max_chars || 0);
    const text = String(response.texto || "");

    return (
      <div className="space-y-3">
        {config.label && <p className="text-sm font-semibold text-foreground">{config.label}</p>}
        <Textarea
          value={text}
          placeholder={config.placeholder || "Escreva sua resposta aqui..."}
          onChange={(event) => updateBlockResponse(block, { ...response, texto: event.target.value })}
          className="min-h-[180px] border-border bg-background focus-visible:border-[#E85D24] focus-visible:ring-[#E85D24]/20"
        />
        {maxChars > 0 && (
          <p className="text-right text-xs text-muted-foreground">
            {text.length} / {maxChars} caracteres
          </p>
        )}
      </div>
    );
  };

  const renderMatrizTabela = (block: ModuleBlock) => {
    const response = getBlockResponse(block);
    const config = block.config || {};
    const columns = Array.isArray(config.colunas) ? config.colunas : [];
    const rows = Array.isArray(response.rows) ? response.rows : [];
    const canAddRows = config.pode_adicionar_linhas !== false;
    const canRemoveRows = config.pode_remover_linhas !== false;

    const updateCell = (rowIndex: number, columnKey: string, value: string) => {
      updateBlockResponse(block, {
        ...response,
        rows: rows.map((row: Record<string, string>, index: number) =>
          index === rowIndex ? { ...row, [columnKey]: value } : row,
        ),
      });
    };

    const addRow = () => {
      updateBlockResponse(block, {
        ...response,
        rows: [...rows, buildEmptyTableRow(columns)],
      });
    };

    const removeRow = (rowIndex: number) => {
      updateBlockResponse(block, {
        ...response,
        rows: rows.filter((_: unknown, index: number) => index !== rowIndex),
      });
    };

    return (
      <div className="space-y-4">
        <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40">
              <tr>
                {columns.map((column: any, index: number) => (
                  <th key={`${column.label || index}`} className="px-4 py-3 text-left font-semibold text-foreground">
                    {column.label || `Coluna ${index + 1}`}
                  </th>
                ))}
                {canRemoveRows && <th className="w-16 px-4 py-3 text-right text-xs uppercase text-muted-foreground">Ação</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row: Record<string, string>, rowIndex: number) => (
                <tr key={`row_${rowIndex}`}>
                  {columns.map((column: any, columnIndex: number) => {
                    const key = slugify(column.label || `coluna_${columnIndex + 1}`) || `coluna_${columnIndex + 1}`;
                    const type = column.tipo || "texto";
                    const options = Array.isArray(column.opcoes) ? column.opcoes : [];

                    return (
                      <td key={`${rowIndex}_${key}`} className="px-4 py-3">
                        {type === "select" && options.length > 0 ? (
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={row[key] || ""}
                            onChange={(event) => updateCell(rowIndex, key, event.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {options.map((option: string) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type={type === "numero" ? "number" : type === "link" ? "url" : "text"}
                            value={row[key] || ""}
                            onChange={(event) => updateCell(rowIndex, key, event.target.value)}
                          />
                        )}
                      </td>
                    );
                  })}
                  {canRemoveRows && (
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeRow(rowIndex)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {rows.map((row: Record<string, string>, rowIndex: number) => (
            <div key={`mobile_row_${rowIndex}`} className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="space-y-3">
                {columns.map((column: any, columnIndex: number) => {
                  const key = slugify(column.label || `coluna_${columnIndex + 1}`) || `coluna_${columnIndex + 1}`;
                  return (
                    <div key={`${rowIndex}_${key}`} className="space-y-1.5">
                      <Label>{column.label || `Coluna ${columnIndex + 1}`}</Label>
                      <Input value={row[key] || ""} onChange={(event) => updateCell(rowIndex, key, event.target.value)} />
                    </div>
                  );
                })}
              </div>
              {canRemoveRows && (
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => removeRow(rowIndex)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover linha
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {canAddRows && (
          <Button variant="outline" onClick={addRow}>
            + Adicionar linha
          </Button>
        )}
      </div>
    );
  };

  const renderScriptAtendimento = (block: ModuleBlock) => {
    const response = getBlockResponse(block);
    const config = block.config || {};
    const stages = Array.isArray(config.etapas) ? config.etapas : [];
    const showExamples = config.mostrar_exemplos_cliente !== false;

    const scriptPreview = stages
      .map((stage: any, index: number) => {
        const key = stage.id || `${slugify(stage.nome || `etapa_${index + 1}`) || `etapa_${index + 1}`}_${index}`;
        const answer = String(response.answers?.[key] || "").trim();
        if (!answer) return null;
        return `${stage.nome || `Etapa ${index + 1}`}\n${answer}`;
      })
      .filter(Boolean)
      .join("\n\n");

    return (
      <div className="space-y-6">
        {stages.map((stage: any, index: number) => {
          const key = stage.id || `${slugify(stage.nome || `etapa_${index + 1}`) || `etapa_${index + 1}`}_${index}`;
          return (
            <div key={key} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
                  {stage.nome || `Etapa ${index + 1}`}
                </Badge>
                <span className="text-xs text-muted-foreground">Etapa do script</span>
              </div>
              {stage.descricao && <p className="text-sm text-muted-foreground">{stage.descricao}</p>}
              {showExamples && stage.exemplo && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-700">
                  Exemplo: {stage.exemplo}
                </div>
              )}
              <Textarea
                value={response.answers?.[key] || ""}
                onChange={(event) =>
                  updateBlockResponse(block, {
                    ...response,
                    answers: {
                      ...(response.answers || {}),
                      [key]: event.target.value,
                    },
                  })
                }
                placeholder="Escreva sua resposta para esta etapa"
                className="min-h-[140px]"
              />
              {index < stages.length - 1 && <Separator />}
            </div>
          );
        })}

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Preview do script completo</h4>
              <p className="text-xs text-muted-foreground">Tudo o que você escreveu consolidado em uma sequência única.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyToClipboard(scriptPreview || "", "Script completo copiado.")}
              disabled={!scriptPreview}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar script completo
            </Button>
          </div>
          <div className="whitespace-pre-wrap rounded-xl border border-border bg-background p-4 text-sm text-foreground">
            {scriptPreview || "Preencha as etapas acima para visualizar o script consolidado."}
          </div>
        </div>
      </div>
    );
  };

  const renderSelecaoEstrategica = (block: ModuleBlock) => {
    const response = getBlockResponse(block);
    const config = block.config || {};
    const options = Array.isArray(config.opcoes) ? config.opcoes : [];
    const isMultiple = !!config.multipla;
    const selectedValues = Array.isArray(response.selected)
      ? response.selected
      : response.selected
        ? [response.selected]
        : [];

    const toggleValue = (value: string) => {
      if (isMultiple) {
        const nextValues = selectedValues.includes(value)
          ? selectedValues.filter((item: string) => item !== value)
          : [...selectedValues, value];
        updateBlockResponse(block, { ...response, selected: nextValues });
      } else {
        updateBlockResponse(block, { ...response, selected: response.selected === value ? "" : value });
      }
    };

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {options.map((option: any, index: number) => {
            const value = option.valor || `opcao_${index + 1}`;
            const isSelected = selectedValues.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleValue(value)}
                className={`relative rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-[#E85D24] bg-[#E85D24]/[0.04]"
                    : "border-border bg-background hover:border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{option.label || `Opção ${index + 1}`}</p>
                    {option.contexto_adicional && isSelected && (
                      <div className="mt-3 rounded-xl border border-[#E85D24]/20 bg-white/70 p-3 text-sm text-muted-foreground">
                        {option.contexto_adicional}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <span className="rounded-full bg-[#E85D24] p-1 text-white">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCalculadora = (block: ModuleBlock) => {
    const response = getBlockResponse(block);
    const config = block.config || {};
    const inputFields = Array.isArray(config.campos_entrada) ? config.campos_entrada : [];
    const resultFields = Array.isArray(config.campos_resultado) ? config.campos_resultado : [];

    const numericValues = inputFields.reduce<Record<string, number>>((acc, field: any, index: number) => {
      const key = field.nome || slugify(field.label || `campo_${index + 1}`) || `campo_${index + 1}`;
      acc[key] = normalizeNumber(response.inputs?.[key]);
      return acc;
    }, {});

    const calculationState = resultFields.reduce<{
      values: Record<string, number>;
      results: Array<{ id: string; label: string; tipo: string; value: number }>;
    }>(
      (accumulator, field: any, index: number) => {
        const resultKey =
          field.nome ||
          field.id ||
          slugify(field.label || field.resultado_label || `resultado_${index + 1}`) ||
          `resultado_${index + 1}`;
        const value = evaluateFormula(field.formula || "", accumulator.values);
        accumulator.values[resultKey] = value;
        accumulator.results.push({
          id: field.id || `${resultKey}_${index}`,
          label: field.resultado_label || field.label || `Resultado ${index + 1}`,
          tipo: field.tipo || "numero",
          value,
        });
        return accumulator;
      },
      { values: { ...numericValues }, results: [] },
    );

    const results = calculationState.results;

    const resultText = results
      .map((item) => `${item.label}: ${formatCalculatedValue(item.value, item.tipo)}`)
      .join("\n");

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {inputFields.map((field: any, index: number) => {
            const key = field.nome || slugify(field.label || `campo_${index + 1}`) || `campo_${index + 1}`;
            const type = field.tipo || "numero";
            const value = response.inputs?.[key] ?? "";

            return (
              <div key={key} className="space-y-1.5">
                <Label>{field.label || `Campo ${index + 1}`}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={value}
                  onChange={(event) =>
                    updateBlockResponse(block, {
                      ...response,
                      inputs: {
                        ...(response.inputs || {}),
                        [key]: event.target.value,
                      },
                    })
                  }
                  placeholder={type === "moeda" ? "0,00" : "0"}
                />
                <p className="text-xs text-muted-foreground">
                  {type === "moeda" ? "Valor em reais" : type === "%" ? "Percentual" : "Número"}
                </p>
              </div>
            );
          })}
        </div>

        <div className={`grid gap-4 ${results.length > 1 ? "md:grid-cols-2" : ""}`}>
          {results.map((result) => (
            <div key={result.id} className="rounded-xl bg-secondary p-5 text-secondary-foreground shadow-md">
              <p className="text-2xl font-bold tracking-tight font-display">{formatCalculatedValue(result.value, result.tipo)}</p>
              <p className="mt-2 text-sm opacity-70">{result.label}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => void copyToClipboard(resultText || "", "Resultado copiado.")}
            disabled={!resultText}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copiar resultado
          </Button>
        </div>
      </div>
    );
  };

  const renderCriacaoOferta = (block: ModuleBlock) => {
    const response = getBlockResponse(block);
    const fields = getOfferFields(block.config || {});
    const shortFields = fields.filter((field) => field.label.length < 24);
    const longFields = fields.filter((field) => field.label.length >= 24);

    const renderOfferField = (field: { id: string; label: string; obrigatorio: boolean }) => {
      const value = response.values?.[field.id] || "";
      const isLong = field.label.length >= 24;
      return (
        <div key={field.id} className="space-y-1.5">
          <Label>
            {field.label}
            {field.obrigatorio ? " *" : ""}
          </Label>
          {isLong ? (
            <Textarea
              value={value}
              onChange={(event) =>
                updateBlockResponse(block, {
                  ...response,
                  values: {
                    ...(response.values || {}),
                    [field.id]: event.target.value,
                  },
                })
              }
              className="min-h-[110px]"
            />
          ) : (
            <Input
              value={value}
              onChange={(event) =>
                updateBlockResponse(block, {
                  ...response,
                  values: {
                    ...(response.values || {}),
                    [field.id]: event.target.value,
                  },
                })
              }
            />
          )}
        </div>
      );
    };

    const offerPreview = fields
      .map((field) => {
        const value = response.values?.[field.id];
        return value ? `${field.label}\n${value}` : null;
      })
      .filter(Boolean)
      .join("\n\n");

    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),340px]">
        <div className="space-y-6">
          {shortFields.length > 0 && <div className="grid gap-4 md:grid-cols-2">{shortFields.map(renderOfferField)}</div>}
          {longFields.length > 0 && <div className="grid gap-4">{longFields.map(renderOfferField)}</div>}
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-muted/50"
              onClick={() => void persistMaterial(block, response, "Oferta")}
            >
              <Package className="mr-2 h-4 w-4" />
              Salvar como material
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-5">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-foreground font-display">Assim fica sua oferta</h4>
            <p className="text-xs text-muted-foreground">Preview atualizado em tempo real conforme você preenche.</p>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-background p-4 shadow-card">
            {fields.map((field) => {
              const value = response.values?.[field.id];
              if (!value) return null;
              return (
                <div key={field.id} className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{field.label}</p>
                  <p className="text-sm text-foreground">{value}</p>
                </div>
              );
            })}
            {!offerPreview && <p className="text-sm text-muted-foreground">Preencha os campos para visualizar a oferta.</p>}
          </div>
        </div>
      </div>
    );
  };

  const renderMapaIcp = (block: ModuleBlock) => {
    const response = getBlockResponse(block);
    const config = block.config || {};
    const sections = Array.isArray(config.secoes) ? config.secoes.filter((section: any) => section.visivel !== false) : [];

    const totalFields = sections.reduce((acc: number, section: any) => acc + (Array.isArray(section.campos) ? section.campos.length : 0), 0);
    const filledFields = countFilledValues(response.sections || {});
    const progressPercent = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Progresso do mapa</p>
              <p className="text-xs text-muted-foreground">
                {filledFields} de {totalFields} campos preenchidos
              </p>
            </div>
            <Badge variant="outline">{progressPercent}%</Badge>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <Accordion type="multiple" defaultValue={sections.map((section: any, index: number) => section.id || `section_${index}`)} className="space-y-3">
          {sections.map((section: any, sectionIndex: number) => {
            const sectionKey = section.id || `${slugify(section.nome || `secao_${sectionIndex + 1}`) || `secao_${sectionIndex + 1}`}_${sectionIndex}`;
            const fields = Array.isArray(section.campos) ? section.campos : [];
            return (
              <AccordionItem key={sectionKey} value={sectionKey} className="rounded-xl border border-border bg-background px-4">
                <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:no-underline">
                  {section.nome || `Seção ${sectionIndex + 1}`}
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  {fields.map((field: any, fieldIndex: number) => {
                    const fieldKey = field.id || `${slugify(field.label || `campo_${fieldIndex + 1}`) || `campo_${fieldIndex + 1}`}_${fieldIndex}`;
                    const value = response.sections?.[sectionKey]?.[fieldKey] || "";

                    return (
                      <div key={fieldKey} className="space-y-1.5">
                        <Label>{field.label || `Campo ${fieldIndex + 1}`}</Label>
                        {field.tipo === "textarea" ? (
                          <Textarea
                            value={value}
                            onChange={(event) =>
                              updateBlockResponse(block, {
                                ...response,
                                sections: {
                                  ...(response.sections || {}),
                                  [sectionKey]: {
                                    ...(response.sections?.[sectionKey] || {}),
                                    [fieldKey]: event.target.value,
                                  },
                                },
                              })
                            }
                          />
                        ) : (
                          <Input
                            value={value}
                            onChange={(event) =>
                              updateBlockResponse(block, {
                                ...response,
                                sections: {
                                  ...(response.sections || {}),
                                  [sectionKey]: {
                                    ...(response.sections?.[sectionKey] || {}),
                                    [fieldKey]: event.target.value,
                                  },
                                },
                              })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <div className="rounded-xl border border-border bg-background p-5 shadow-card">
          <h4 className="mb-3 text-sm font-semibold text-foreground">Preview do ICP</h4>
          <div className="space-y-4">
            {sections.map((section: any, sectionIndex: number) => {
              const sectionKey = section.id || `${slugify(section.nome || `secao_${sectionIndex + 1}`) || `secao_${sectionIndex + 1}`}_${sectionIndex}`;
              const values = response.sections?.[sectionKey] || {};
              const visibleEntries = Object.entries(values).filter(([, value]) => String(value || "").trim().length > 0);
              if (visibleEntries.length === 0) return null;

              return (
                <div key={sectionKey} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{section.nome}</p>
                  <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-foreground">
                    {visibleEntries.map(([key, value]) => (
                      <p key={key}>
                        <span className="font-medium">{key.replace(/_/g, " ")}:</span> {String(value)}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
            {filledFields === 0 && <p className="text-sm text-muted-foreground">Preencha o mapa para visualizar o resumo do ICP.</p>}
          </div>
        </div>
      </div>
    );
  };

  const renderChecklistAcao = (block: ModuleBlock) => {
    const response = getBlockResponse(block);
    const config = block.config || {};
    const items = Array.isArray(config.itens) ? config.itens : [];
    const checkedCount = items.filter((item: any, index: number) => {
      const key = item.id || `${slugify(item.texto || `item_${index + 1}`) || `item_${index + 1}`}_${index}`;
      return response.items?.[key]?.checked === true;
    }).length;
    const progressPercent = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

    return (
      <div className="space-y-5">
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Progresso da implementação</p>
              <p className="text-xs text-muted-foreground">
                {checkedCount} de {items.length} itens concluídos
              </p>
            </div>
            <Badge variant="outline">{progressPercent}%</Badge>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <div className="space-y-3">
          {items.map((item: any, index: number) => {
            const key = item.id || `${slugify(item.texto || `item_${index + 1}`) || `item_${index + 1}`}_${index}`;
            const state = response.items?.[key] || { checked: false, resposta: "" };

            return (
              <div
                key={key}
                className={`rounded-xl border p-4 transition-all ${
                  state.checked ? "border-emerald-200 bg-emerald-50" : "border-border bg-background"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={state.checked}
                    onCheckedChange={(checked) =>
                      updateBlockResponse(block, {
                        ...response,
                        items: {
                          ...(response.items || {}),
                          [key]: {
                            ...(response.items?.[key] || {}),
                            checked: checked === true,
                          },
                        },
                      })
                    }
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className={`font-medium ${state.checked ? "text-emerald-800 line-through" : "text-foreground"}`}>
                      {item.texto || `Item ${index + 1}`}
                    </p>
                    {item.descricao && <p className="text-sm text-muted-foreground">{item.descricao}</p>}
                    {item.tem_campo_resposta && state.checked && (
                      <Textarea
                        value={state.resposta || ""}
                        onChange={(event) =>
                          updateBlockResponse(block, {
                            ...response,
                            items: {
                              ...(response.items || {}),
                              [key]: {
                                ...(response.items?.[key] || {}),
                                resposta: event.target.value,
                              },
                            },
                          })
                        }
                        placeholder="Cole o link ou descreva a ação executada"
                        className="min-h-[110px] bg-white"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBlockBody = (block: ModuleBlock) => {
    switch (block.tipo) {
      case "texto_guiado":
        return renderTextoGuiado(block);
      case "matriz_tabela":
        return renderMatrizTabela(block);
      case "script_atendimento":
        return renderScriptAtendimento(block);
      case "selecao_estrategica":
        return renderSelecaoEstrategica(block);
      case "calculadora":
        return renderCalculadora(block);
      case "criacao_oferta":
        return renderCriacaoOferta(block);
      case "mapa_icp":
        return renderMapaIcp(block);
      case "checklist_acao":
        return renderChecklistAcao(block);
      default:
        return (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Tipo de bloco ainda não suportado.
          </div>
        );
    }
  };

  const renderConstrua = () => {
    if (moduleBlocks.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground font-display">Nenhuma atividade prática configurada</h3>
              <p className="text-[13px] text-muted-foreground">Continue para a etapa de Validação.</p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4">
            <Button variant="ghost" onClick={() => setCurrentStep("aprenda")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Rever aula
            </Button>
            <Button onClick={() => void advanceStep("construa")} className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90" size="lg">
              Ir para validação <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="animate-in slide-in-from-right-8 space-y-6 duration-300">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Settings2 className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground font-display">Construa na prática</h3>
                <p className="text-[13px] text-muted-foreground">
                  {currentBlockProgress.completed} de {currentBlockProgress.total} blocos preenchidos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-medium">
              {globalSaving ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Tudo salvo
                </span>
              )}
            </div>
          </div>
          <Progress value={currentBlockProgress.percentage} className="mt-4 h-1.5 bg-muted" />
        </div>

        <div className="space-y-8 rounded-xl border border-border bg-card p-6 shadow-card">
          {moduleBlocks.map((block, index) => {
            const definition = BLOCK_DEFINITIONS[block.tipo];
            const Icon = definition.icon;
            const response = getBlockResponse(block);
            const canSyncCerebro = block.salvar_no_cerebro && block.cerebro_chave && countFilledValues(response) > 0;
            const syncedAt = syncedBlocks[block.id];

            return (
              <div key={block.id} className="space-y-5">
                {index > 0 && <Separator className="mb-8" />}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${definition.colorClass}`} />
                        <h3 className="text-base font-semibold text-foreground font-display">{block.titulo}</h3>
                      </div>
                      <Badge variant="outline">{definition.label}</Badge>
                      {blockCompleted[block.id] && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Preenchido</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {blockSaveStates[block.id] === "saving" && (
                        <span className="flex items-center text-amber-700">
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Salvando...
                        </span>
                      )}
                      {blockSaveStates[block.id] === "saved" && (
                        <span className="flex items-center font-semibold text-emerald-600">
                          Salvo ✓
                        </span>
                      )}
                      {blockSaveStates[block.id] === "error" && (
                        <span className="font-semibold text-destructive">Erro ao salvar</span>
                      )}
                    </div>
                    {block.instrucao && <p className="max-w-3xl text-sm text-muted-foreground">{block.instrucao}</p>}
                  </div>
                </div>

                {renderBlockBody(block)}

                {canSyncCerebro && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
                          <Brain className="h-3.5 w-3.5 text-foreground" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[13px] font-semibold text-foreground">Alimenta o Cérebro Central</p>
                          <p className="text-xs text-muted-foreground">Clique para atualizar as IAs com estes dados.</p>
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="outline"
                                className={syncedAt ? "border-emerald-500 text-emerald-600" : "border-[#E85D24] text-[#E85D24] hover:bg-[#E85D24]/10"}
                                disabled={!!syncedAt}
                                onClick={() => void syncBlockToCerebro(block, response)}
                              >
                                {syncedAt ? "✓ Salvo no Cérebro" : "Salvar no Cérebro Central"}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {syncedAt && <TooltipContent>Atualizado agora mesmo</TooltipContent>}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" onClick={() => setCurrentStep("aprenda")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Rever aula
          </Button>
          <Button
            onClick={() => void advanceStep("construa")}
            className="bg-[#E85D24] text-white hover:bg-[#D04E1A] font-semibold h-10 px-6"
            disabled={globalSaving || !currentBlockProgress.allCompleted}
          >
            Concluir Construa <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderValide = () => {
    const checklist = valideItems;

    if (checklist.length === 0) {
      return (
        <div className="space-y-4 rounded-xl border bg-card p-12 text-center">
          <FileCheck className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
          <div>
            <h3 className="font-bold">Nenhum checklist de validação</h3>
            <p className="mt-1 text-sm text-muted-foreground">Avance direto para finalizar o módulo.</p>
          </div>
          <Button onClick={() => void advanceStep("valide")} className="mt-4 bg-[#E85D24]">
            Finalizar módulo <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    }

    const checkedCount = checklist.filter((item) => checkedItens[item.id] === true).length;
    const allChecked = checkedCount === checklist.length;
    const validateProgress = checklist.length > 0 ? Math.round((checkedCount / checklist.length) * 100) : 0;

    return (
      <div className="animate-in slide-in-from-right-8 space-y-6 duration-300">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileCheck className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground font-display">Valide seu aprendizado</h3>
            <p className="text-[13px] text-muted-foreground">Confirme que você aprendeu e aplicou o conteúdo deste módulo.</p>
          </div>
        </div>

        <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Progresso da validação</p>
                <p className="text-xs text-muted-foreground">
                  {checkedCount} de {checklist.length} itens confirmados
                </p>
              </div>
              <Badge variant="outline">{validateProgress}%</Badge>
            </div>
            <Progress value={validateProgress} className="h-2.5" />
          </div>

          <div className="space-y-4">
            {checklist.map((item) => {
              const key = item.id;
              return (
                <label
                  key={key}
                  className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all duration-150 ${
                    checkedItens[key]
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-border bg-background hover:bg-muted/30"
                  }`}
                >
                  <Checkbox
                    className="mt-0.5 h-5 w-5 rounded-md"
                    checked={!!checkedItens[key]}
                    onCheckedChange={(value) => setCheckedItens((prev) => ({ ...prev, [key]: value === true }))}
                  />
                  <span className={`text-sm font-medium ${checkedItens[key] ? "text-emerald-700" : "text-muted-foreground"}`}>
                    {item.text}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" onClick={() => setCurrentStep("construa")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Construa
          </Button>
          <Button
            onClick={() => void advanceStep("valide")}
            disabled={!allChecked}
            className={!allChecked ? "bg-muted text-muted-foreground" : "bg-[#E85D24] text-white hover:bg-[#D04E1A] font-semibold h-10 px-6"}
          >
            Concluir e Avançar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderFinalize = () => (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center shadow-card animate-in fade-in duration-500 space-y-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
        <Trophy className="h-8 w-8 text-emerald-500" strokeWidth={1.5} />
      </div>

      <div className="max-w-md space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground font-display">Módulo {moduleData.id} concluído!</h2>
        <p className="text-base text-muted-foreground">{moduleData.title}</p>

        <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground leading-relaxed">
          {moduleData.finalize_content || "Excelente trabalho. Você evoluiu o seu Cérebro Central e ficou mais perto de dominar sua demanda."}
        </div>
      </div>

      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        {nextModule ? (
          <Button
            className="bg-[#E85D24] px-6 text-white hover:bg-[#D04E1A] font-semibold h-10"
            onClick={() => {
              void advanceStep("finalize");
              navigate(`/plataforma/trilha/${nextModule.id}`);
            }}
          >
            Próximo módulo <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            className="bg-[#E85D24] px-6 text-white hover:bg-[#D04E1A] font-semibold h-10"
            onClick={() => {
              void advanceStep("finalize");
              navigate("/plataforma/trilha");
            }}
          >
            Concluir etapa <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        <Button variant="outline" size="lg" onClick={() => navigate("/plataforma/materiais")}>
          <FileText className="mr-2 h-4 w-4" /> Meus materiais
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="mx-auto mt-4 flex min-h-[calc(100vh-100px)] max-w-[1400px] flex-col gap-6 px-4 pb-6 lg:h-[calc(100vh-100px)] lg:flex-row lg:px-8">
        <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card lg:h-[calc(100vh-120px)] lg:w-[320px]">
          <div className="border-b border-border p-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/plataforma/trilha")}
              className="mb-4 h-auto px-0 py-1 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Voltar para Trilha
            </Button>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pilar {moduleData.pillar}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/60">Módulos da fase</p>
          </div>

          <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border flex-1 space-y-1 overflow-y-auto p-3">
            {pillarModules.map((moduleItem) => {
              const isCurrent = moduleItem.id === moduloId;
              const isCompleted = progress.some((item) => item.module_id === moduleItem.id && item.completed);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const inProgressSet = ((window as any).inProgressModulesCache || []) as string[];
              const isInProgress = !isCompleted && inProgressSet.includes(moduleItem.id);

              return (
                <div
                  key={moduleItem.id}
                  onClick={() => navigate(`/plataforma/trilha/${moduleItem.id}`)}
                  className={`relative flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors ${
                    isCurrent ? "bg-muted/60" : "hover:bg-muted/30"
                  }`}
                >
                  {isCurrent && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#E85D24]" />}
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : isInProgress ? (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E85D24]/10">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#E85D24] animate-pulse" />
                      </div>
                    ) : (
                      <PlayCircle className={`h-4 w-4 ${isCurrent ? "text-foreground" : "text-muted-foreground/50"}`} />
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-[13px] font-medium leading-snug ${
                        isCurrent ? "text-foreground" : isCompleted ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span className="mr-1 font-mono text-[11px] text-muted-foreground/50">{moduleItem.id}</span>
                      {moduleItem.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border flex w-full flex-1 flex-col pb-10 pr-1 lg:overflow-y-auto">
          <div className="mb-8 space-y-4">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => navigate("/plataforma/trilha")}>Trilha</span>
              <span>/</span>
              <span>Pilar {moduleData.pillar}</span>
              <span>/</span>
              <span className="text-foreground">Módulo {moduleData.id}</span>
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground font-display">{moduleData.title}</h1>
          </div>

          <div className="relative mb-8 flex w-full items-center">
            <div className="absolute left-0 top-[14px] hidden h-[2px] w-full bg-border sm:block" />
            {activeSteps.map((step, index) => {
              const stepIndex = activeSteps.indexOf(step);
              const activeIndex = activeSteps.indexOf(currentStep);
              const isPast = stepIndex < activeIndex;
              const isActive = stepIndex === activeIndex;
              const labels = {
                aprenda: "APRENDA",
                construa: "CONSTRUA",
                valide: "VALIDE",
                finalize: "FINALIZE",
              };

              return (
                <div
                  key={step}
                  className="group relative flex flex-1 flex-col items-center"
                  onClick={() => {
                    if (isPast) setCurrentStep(step);
                  }}
                >
                  <div
                    className={`mb-2.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
                      isPast
                        ? "cursor-pointer bg-emerald-500 text-white"
                        : isActive
                          ? "bg-[#E85D24] text-white ring-[3px] ring-[#E85D24]/15"
                          : "border border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {isPast ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
                  </div>
                  <span
                    className={`text-[11px] font-semibold tracking-wider ${
                      isActive ? "text-foreground" : isPast ? "text-emerald-600" : "text-muted-foreground"
                    }`}
                  >
                    {labels[step]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex-1">
            {currentStep === "aprenda" && renderAprenda()}
            {currentStep === "construa" && renderConstrua()}
            {currentStep === "valide" && renderValide()}
            {currentStep === "finalize" && renderFinalize()}
          </div>
        </div>
      </div>

      <Dialog open={!!showMilestone} onOpenChange={(open) => !open && setShowMilestone(null)}>
        <DialogContent className="border-border bg-card p-8 text-center sm:max-w-md">
          <div className="flex flex-col items-center">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <PartyPopper className="h-7 w-7 text-emerald-500" />
            </div>
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-center text-lg font-bold tracking-wide text-foreground font-display">
                {showMilestone?.title}
              </DialogTitle>
              <DialogDescription className="text-center text-sm leading-relaxed text-muted-foreground">
                {showMilestone?.desc}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 w-full space-y-3 border-t border-border pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#E85D24]">Próxima fase desbloqueada</p>
              <Button
                className="w-full bg-[#E85D24] text-white hover:bg-[#D04E1A] font-semibold h-10"
                onClick={() => {
                  setShowMilestone(null);
                  if (nextModule) navigate(`/plataforma/trilha/${nextModule.id}`);
                  else navigate("/plataforma/trilha");
                }}
              >
                Continuar para próxima etapa <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingSyncState} onOpenChange={(open) => !open && setPendingSyncState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir dados do Cérebro Central?</AlertDialogTitle>
            <AlertDialogDescription>
              Você já tem dados em {pendingSyncState?.existingFields.join(", ")}. Deseja substituir pelos dados deste exercício?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter os dados atuais</AlertDialogCancel>
            <AlertDialogAction className="bg-[#E85D24] hover:bg-[#E85D24]/90" onClick={() => void handleConfirmCerebroReplacement()}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
