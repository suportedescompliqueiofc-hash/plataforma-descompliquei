import type { LucideIcon } from "lucide-react";
import {
  // Geral
  FileText,
  StickyNote,
  File,
  Bookmark,
  Star,
  MapPin,
  Flag,
  Hash,
  Paperclip,
  Tag,
  // Saúde
  Stethoscope,
  HeartPulse,
  Activity,
  Pill,
  Syringe,
  Cross,
  Brain,
  Bandage,
  Thermometer,
  HeartHandshake,
  // Comercial
  TrendingUp,
  DollarSign,
  Target,
  ShoppingCart,
  Briefcase,
  Receipt,
  Handshake,
  Percent,
  CreditCard,
  BadgeDollarSign,
  // Comunicação
  MessageCircle,
  Phone,
  Mail,
  Send,
  Megaphone,
  Users,
  Headset,
  MessageSquare,
  PhoneCall,
  AtSign,
  // Organização
  Folder,
  Calendar,
  ClipboardList,
  SquareCheck,
  Layers,
  Archive,
  Tags,
  ListChecks,
  FolderOpen,
  Clock,
  // Marketing
  Rocket,
  Sparkles,
  Lightbulb,
  Camera,
  Image,
  Video,
  PenTool,
  Palette,
  Share2,
  // Objetivos
  Trophy,
  Award,
  CircleCheck,
  Zap,
  Compass,
  Medal,
  Goal,
} from "lucide-react";

/**
 * Categoria lógica de ícones usada pelo seletor de "ícone" das Notas/páginas.
 * `icones` guarda os nomes (chaves de ICONES_MAP) exibidos nessa categoria.
 */
export interface IconeCategoria {
  id: string; // kebab-case
  label: string; // PT-BR com acento
  icones: string[]; // nomes de ícones (chaves de ICONES_MAP)
}

/**
 * Mapa nome -> componente Lucide.
 * Contém TODOS os nomes usados em ICONE_CATEGORIAS.
 * IMPORTANTE: o design system proíbe emoji na UI — o campo `icone` das páginas
 * agora guarda o nome de um ícone Lucide (ex: "Stethoscope") em vez de um emoji.
 */
export const ICONES_MAP: Record<string, LucideIcon> = {
  // Geral
  FileText,
  StickyNote,
  File,
  Bookmark,
  Star,
  MapPin,
  Flag,
  Hash,
  Paperclip,
  Tag,
  // Saúde
  Stethoscope,
  HeartPulse,
  Activity,
  Pill,
  Syringe,
  Cross,
  Brain,
  Bandage,
  Thermometer,
  HeartHandshake,
  // Comercial
  TrendingUp,
  DollarSign,
  Target,
  ShoppingCart,
  Briefcase,
  Receipt,
  Handshake,
  Percent,
  CreditCard,
  BadgeDollarSign,
  // Comunicação
  MessageCircle,
  Phone,
  Mail,
  Send,
  Megaphone,
  Users,
  Headset,
  MessageSquare,
  PhoneCall,
  AtSign,
  // Organização
  Folder,
  Calendar,
  ClipboardList,
  SquareCheck,
  Layers,
  Archive,
  Tags,
  ListChecks,
  FolderOpen,
  Clock,
  // Marketing
  Rocket,
  Sparkles,
  Lightbulb,
  Camera,
  Image,
  Video,
  PenTool,
  Palette,
  Share2,
  // Objetivos
  Trophy,
  Award,
  CircleCheck,
  Zap,
  Compass,
  Medal,
  Goal,
};

/**
 * Categorias exibidas no seletor de ícones das Notas.
 * Cada `icones[i]` deve existir como chave em ICONES_MAP.
 */
export const ICONE_CATEGORIAS: IconeCategoria[] = [
  {
    id: "geral",
    label: "Geral",
    icones: [
      "FileText",
      "StickyNote",
      "File",
      "Bookmark",
      "Star",
      "MapPin",
      "Flag",
      "Hash",
      "Paperclip",
      "Tag",
    ],
  },
  {
    id: "saude",
    label: "Saúde",
    icones: [
      "Stethoscope",
      "HeartPulse",
      "Activity",
      "Pill",
      "Syringe",
      "Cross",
      "Brain",
      "Bandage",
      "Thermometer",
      "HeartHandshake",
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    icones: [
      "TrendingUp",
      "DollarSign",
      "Target",
      "ShoppingCart",
      "Briefcase",
      "Receipt",
      "Handshake",
      "Percent",
      "CreditCard",
      "BadgeDollarSign",
    ],
  },
  {
    id: "comunicacao",
    label: "Comunicação",
    icones: [
      "MessageCircle",
      "Phone",
      "Mail",
      "Send",
      "Megaphone",
      "Users",
      "Headset",
      "MessageSquare",
      "PhoneCall",
      "AtSign",
    ],
  },
  {
    id: "organizacao",
    label: "Organização",
    icones: [
      "Folder",
      "Calendar",
      "ClipboardList",
      "SquareCheck",
      "Layers",
      "Archive",
      "Tags",
      "ListChecks",
      "FolderOpen",
      "Clock",
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icones: [
      "Rocket",
      "Sparkles",
      "Lightbulb",
      "Camera",
      "Image",
      "Video",
      "PenTool",
      "Palette",
      "Share2",
    ],
  },
  {
    id: "objetivos",
    label: "Objetivos",
    icones: [
      "Target",
      "Trophy",
      "Award",
      "Flag",
      "CircleCheck",
      "Zap",
      "Compass",
      "Medal",
      "Goal",
    ],
  },
];

/**
 * Renderer do ícone salvo em `icone`.
 * - Se `nome` existe em ICONES_MAP -> renderiza o ícone Lucide correspondente.
 * - Se `nome` é uma string não-vazia mas desconhecida (ex: emoji legado) ->
 *   renderiza como texto simples (span), preservando o valor antigo salvo.
 * - Se `nome` é null/vazio -> renderiza `fallback` (se informado) ou o ícone
 *   FileText como padrão.
 */
export function NotaIcone({
  nome,
  className,
  fallback,
}: {
  nome: string | null;
  className?: string;
  fallback?: React.ReactNode;
}): JSX.Element {
  if (!nome) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }
    return <FileText className={className} />;
  }

  const IconeComponente = ICONES_MAP[nome];
  if (IconeComponente) {
    return <IconeComponente className={className} />;
  }

  // Valor legado desconhecido (ex: emoji salvo antes da migração para ícones).
  return <span className={className}>{nome}</span>;
}
