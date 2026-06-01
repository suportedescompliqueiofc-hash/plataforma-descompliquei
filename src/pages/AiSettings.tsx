import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Check,
  History,
  Loader2,
  Maximize2,
  MessageSquare,
  Plus,
  Power,
  Save,
  Sparkles,
  Trash2,
  RefreshCw,
  Undo2,
  Wrench,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AiFollowupTab } from "@/components/ai/AiFollowupTab";
import { AiExecutionLogsTab } from "@/components/ai/AiExecutionLogsTab";
import { useAiPrompt } from "@/hooks/useAiPrompt";

type ProcedureItem = {
  id: string;
  name: string;
  description: string;
};

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

type AgentPromptFormData = {
  agentName: string;
  clinicName: string;
  professionalName: string;
  specialty: string;
  useEmojis: boolean;
  emojis: string;
  useCallName: boolean;
  callTarget: "equipe" | "secretaria" | "doutor" | "";
  callPersonName: string;
  voiceTone: string;
  procedures: ProcedureItem[];
  faqs: FaqItem[];
  instagram: string;
  address: string;
  instructions: string;
};

type ParsedPromptResult =
  | { ok: true; data: AgentPromptFormData }
  | { ok: false };

type FormErrors = {
  agentName?: string;
  clinicName?: string;
  procedures?: string;
  instagram?: string;
};

const AI_TOOLS = [
  {
    icon: Database,
    name: "crm",
    label: "Ferramenta CRM",
    description:
      "Atualiza automaticamente o nome do lead, procedimento de interesse, resumo da conversa e move a fase no pipeline.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Bell,
    name: "notificacao",
    label: "Ferramenta Notificação",
    description:
      "Notifica a equipe humana quando o lead está qualificado. A IA é desativada e o atendimento passa para um humano.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
];

const MODEL_SUGGESTIONS = [
  {
    label: "OpenAI",
    items: ["gpt-4.1-mini", "gpt-4o-mini"],
  },
  {
    label: "OpenRouter",
    items: [
      "openrouter/openai/gpt-4.1-mini",
      "openrouter/anthropic/claude-haiku-4-5-20251001",
      "openrouter/google/gemini-2.5-flash-preview",
      "openrouter/deepseek/deepseek-v4-flash",
      "openrouter/meta-llama/llama-4-scout",
      "openrouter/x-ai/grok-4-1-fast",
    ],
  },
  {
    label: "xAI",
    items: ["grok-4-1-fast-non-reasoning"],
  },
];

const PARSE_WARNING_MESSAGE =
  "Encontramos um prompt salvo fora do formato padrão do formulário. Para continuar usando este editor estruturado, resete o conteúdo para o modelo padrão.";
function createProcedureItem(
  overrides?: Partial<Omit<ProcedureItem, "id">>,
): ProcedureItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides?.name ?? "",
    description: overrides?.description ?? "",
  };
}

function createFaqItem(
  overrides?: Partial<Omit<FaqItem, "id">>,
): FaqItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: overrides?.question ?? "",
    answer: overrides?.answer ?? "",
  };
}

function createEmptyFormData(): AgentPromptFormData {
  return {
    agentName: "",
    clinicName: "",
    professionalName: "",
    specialty: "",
    useEmojis: false,
    emojis: "",
    useCallName: true,
    callTarget: "equipe",
    callPersonName: "",
    voiceTone: "",
    procedures: [createProcedureItem()],
    faqs: [createFaqItem()],
    instagram: "",
    address: "",
    instructions: "",
  };
}

function cloneFormData(data: AgentPromptFormData): AgentPromptFormData {
  return {
    ...data,
    procedures: data.procedures.map((procedure) => ({ ...procedure })),
    faqs: data.faqs.map((faq) => ({ ...faq })),
  };
}

function normalizeSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseYesNo(value: string | null): boolean {
  return /^(sim|yes|true|1)$/i.test((value ?? "").trim());
}

function buildFaqBlock(faq: FaqItem): string | null {
  const question = normalizeSingleLine(faq.question);
  const answer = normalizeSingleLine(faq.answer);

  if (!question && !answer) {
    return null;
  }

  return `- Pergunta: ${question}\n  Resposta: ${answer}`;
}

function parseFaqSection(section: string): FaqItem[] {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const faqs: FaqItem[] = [];
  let currentFaq: FaqItem | null = null;

  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (currentFaq && (currentFaq.question || currentFaq.answer)) {
        faqs.push(currentFaq);
      }

      currentFaq = createFaqItem();
      const questionMatch = line.match(/^- Pergunta:\s*(.*)$/i);
      currentFaq.question = questionMatch
        ? questionMatch[1].trim()
        : line.replace(/^- /, "").trim();
      continue;
    }

    const questionMatch = line.match(/^Pergunta:\s*(.*)$/i);
    if (questionMatch) {
      if (!currentFaq) {
        currentFaq = createFaqItem();
      }
      currentFaq.question = questionMatch[1].trim();
      continue;
    }

    const answerMatch = line.match(/^Resposta:\s*(.*)$/i);
    if (answerMatch) {
      if (!currentFaq) {
        currentFaq = createFaqItem();
      }
      currentFaq.answer = answerMatch[1].trim();
      continue;
    }

    if (currentFaq) {
      currentFaq.answer = currentFaq.answer ? `${currentFaq.answer} ${line}` : line;
    }
  }

  if (currentFaq && (currentFaq.question || currentFaq.answer)) {
    faqs.push(currentFaq);
  }

  return faqs;
}

function buildPromptMarkdown(data: AgentPromptFormData): string {
  const procedures = data.procedures
    .map((procedure) => ({
      name: normalizeSingleLine(procedure.name),
      description: normalizeSingleLine(procedure.description),
    }))
    .filter((procedure) => procedure.name || procedure.description)
    .map((procedure) =>
      procedure.description
        ? `- ${procedure.name}: ${procedure.description}`
        : `- ${procedure.name}`,
    );

  const faqs = data.faqs
    .map((faq) => buildFaqBlock(faq))
    .filter((faq): faq is string => Boolean(faq));

  const sections = [
    "## IDENTIDADE DO AGENTE",
    `Nome do agente: ${data.agentName.trim()}`,
    `Nome da clínica: ${data.clinicName.trim()}`,
    `Nome do profissional: ${data.professionalName.trim()}`,
    `Especialidade: ${data.specialty.trim()}`,
    "",
    "## EMOJIS",
    `A IA deve usar emojis?: ${data.useEmojis ? "Sim" : "NÃ£o"}`,
    `Emojis permitidos: ${data.useEmojis ? data.emojis.trim() : ""}`,
    "",
    "## FORMA DE CHAMADA",
    `Quem a IA deve chamar?: ${data.callTarget}`,
    `Nome da pessoa: ${data.callTarget && data.callTarget !== "equipe" ? data.callPersonName.trim() : ""}`,
    "",
    "## TOM DE VOZ E PERSONALIDADE",
    data.voiceTone.trim(),
    "",
    "## PROCEDIMENTOS OFERECIDOS",
    procedures.join("\n"),
    "",
    "## FAQ",
    faqs.join("\n"),
    "",
    "## REDES SOCIAIS E CONTATO",
    `Instagram: ${data.instagram.trim()}`,
    `Endereço: ${data.address.trim()}`,
    "",
    "## INSTRUÇÕES PONTUAIS",
    data.instructions.trim(),
  ];

  return sections.join("\n").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(markdown: string, title: string): string | null {
  const regex = new RegExp(
    `##\\s+${escapeRegex(title)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`,
    "i",
  );
  const match = markdown.match(regex);
  return match ? match[1].trim() : null;
}

function extractLabeledValue(section: string, label: string): string | null {
  const regex = new RegExp(`^${escapeRegex(label)}:\\s*(.*)$`, "im");
  const match = section.match(regex);
  return match ? match[1].trim() : null;
}

function parsePromptMarkdown(markdown: string): ParsedPromptResult {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { ok: true, data: createEmptyFormData() };
  }

  const identitySection = extractSection(normalized, "IDENTIDADE DO AGENTE");
  const proceduresSection = extractSection(normalized, "PROCEDIMENTOS OFERECIDOS");
  const contactSection = extractSection(normalized, "REDES SOCIAIS E CONTATO");
  const instructionsSection = extractSection(normalized, "INSTRUÇÕES PONTUAIS");

  if (identitySection === null || proceduresSection === null || contactSection === null) {
    return { ok: false };
  }

  const agentName = extractLabeledValue(identitySection, "Nome do agente");
  const clinicName = extractLabeledValue(identitySection, "Nome da clínica");
  const professionalName = extractLabeledValue(
    identitySection,
    "Nome do profissional",
  );
  const specialty = extractLabeledValue(identitySection, "Especialidade");
  const instagram = extractLabeledValue(contactSection, "Instagram") ?? "";
  const addressLine = contactSection
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith("endere"));
  const address = addressLine ? addressLine.split(":").slice(1).join(":").trim() : "";
  const emojisSection = extractSection(normalized, "EMOJIS");
  const callNameSection = extractSection(normalized, "FORMA DE CHAMADA");
  const voiceToneSection = extractSection(normalized, "TOM DE VOZ E PERSONALIDADE");
  const faqsSection = extractSection(normalized, "FAQ");
  const useEmojis = parseYesNo(
    emojisSection ? extractLabeledValue(emojisSection, "A IA deve usar emojis?") : null,
  );
  const emojis = emojisSection
    ? extractLabeledValue(emojisSection, "Emojis permitidos") ?? ""
    : "";
  const callTargetRaw = callNameSection
    ? extractLabeledValue(callNameSection, "Quem a IA deve chamar?") ?? ""
    : "";
  const callTarget = /equipe/i.test(callTargetRaw)
    ? "equipe"
    : /secret/i.test(callTargetRaw)
      ? "secretaria"
      : /doutor/i.test(callTargetRaw)
        ? "doutor"
        : "";
  const callPersonName = callNameSection
    ? extractLabeledValue(callNameSection, "Nome da pessoa") ?? ""
    : "";
  const voiceTone = voiceToneSection ? voiceToneSection.trim() : "";
  const faqs = faqsSection ? parseFaqSection(faqsSection) : [];

  if (
    agentName === null ||
    clinicName === null ||
    professionalName === null ||
    specialty === null
  ) {
    return { ok: false };
  }

  const rawProcedureLines = proceduresSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (
    rawProcedureLines.some(
      (line) => !line.startsWith("- ") && line.replace(/-/g, "").trim() !== "",
    )
  ) {
    return { ok: false };
  }

  const procedures = rawProcedureLines
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        return createProcedureItem({ name: line, description: "" });
      }

      return createProcedureItem({
        name: line.slice(0, separatorIndex).trim(),
        description: line.slice(separatorIndex + 1).trim(),
      });
    });

  return {
    ok: true,
    data: {
      agentName,
      clinicName,
      professionalName,
      specialty,
      useEmojis,
      emojis,
      useCallName: true,
      callTarget,
      callPersonName,
      voiceTone,
      procedures: procedures.length > 0 ? procedures : [createProcedureItem()],
      faqs: faqs.length > 0 ? faqs : [createFaqItem()],
      instagram,
      address,
      instructions: instructionsSection ?? "",
    },
  };
}

function validateFormData(data: AgentPromptFormData): FormErrors {
  const errors: FormErrors = {};
  const validProcedures = data.procedures.filter(
    (procedure) => procedure.name.trim().length > 0,
  );

  if (!data.agentName.trim()) {
    errors.agentName = "Informe o nome do agente.";
  }

  if (!data.clinicName.trim()) {
    errors.clinicName = "Informe o nome da clínica.";
  }

  if (validProcedures.length === 0) {
    errors.procedures = "Cadastre pelo menos 1 procedimento.";
  }

  if (data.instagram.trim() && !data.instagram.trim().startsWith("http")) {
    errors.instagram = "O link do Instagram deve começar com http.";
  }

  return errors;
}

type HorarioAtendimento = {
  weekday_open: string;
  weekday_close: string;
  saturday_open: string;
  saturday_close: string;
  saturday_closed: boolean;
  sunday_closed: boolean;
};

type FormasPagamento = {
  pix: boolean;
  dinheiro: boolean;
  credito: boolean;
  debito: boolean;
  parcelamento: string;
  observacoes: string;
};

type AgentPromptFormFieldsProps = {
  data: AgentPromptFormData;
  disabled: boolean;
  warningMessage: string | null;
  errors: FormErrors;
  previewMarkdown: string;
  previewOpen: boolean;
  horarioAtendimento: HorarioAtendimento;
  formasPagamento: FormasPagamento;
  contraindicacoes: string;
  palavrasProibidas: string[];
  onFieldChange: <K extends keyof AgentPromptFormData>(
    field: K,
    value: AgentPromptFormData[K],
  ) => void;
  onHorarioChange: (horario: HorarioAtendimento) => void;
  onFormasChange: (formas: FormasPagamento) => void;
  onContraindicacoesChange: (value: string) => void;
  onPalavrasProibidasChange: (value: string[]) => void;
  onProcedureChange: (
    id: string,
    field: keyof Omit<ProcedureItem, "id">,
    value: string,
  ) => void;
  onAddProcedure: () => void;
  onRemoveProcedure: (id: string) => void;
  onFaqChange: (
    id: string,
    field: keyof Omit<FaqItem, "id">,
    value: string,
  ) => void;
  onAddFaq: () => void;
  onRemoveFaq: (id: string) => void;
  onResetToStructuredForm: () => void;
  onPreviewOpenChange: (open: boolean) => void;
};

function AgentPromptFormFields({
  data,
  disabled,
  warningMessage,
  errors,
  previewMarkdown,
  previewOpen,
  horarioAtendimento,
  formasPagamento,
  contraindicacoes,
  palavrasProibidas,
  onFieldChange,
  onHorarioChange,
  onFormasChange,
  onContraindicacoesChange,
  onPalavrasProibidasChange,
  onProcedureChange,
  onAddProcedure,
  onRemoveProcedure,
  onFaqChange,
  onAddFaq,
  onRemoveFaq,
  onResetToStructuredForm,
  onPreviewOpenChange,
}: AgentPromptFormFieldsProps) {
  const [palavraInput, setPalavraInput] = useState("");
  const fieldInputClass =
    "h-10 text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/40 focus-visible:border-foreground/30 focus-visible:ring-foreground/10";
  const fieldTextareaClass =
    "text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/40 focus-visible:border-foreground/30 focus-visible:ring-foreground/10";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {warningMessage && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">
                    Prompt fora do padrão do formulário
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-amber-700">
                    {warningMessage}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                    onClick={onResetToStructuredForm}
                  >
                    Resetar para formulário padrão
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div data-tutorial="ia-field-identity" className="space-y-2">
            <Label htmlFor="agent-name">Como seu agente vai se chamar?</Label>
            <Input
              id="agent-name"
              value={data.agentName}
              onChange={(event) => onFieldChange("agentName", event.target.value)}
              disabled={disabled}
              className={`${fieldInputClass} ${
                errors.agentName ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
            {errors.agentName && (
              <p className="text-xs text-destructive">{errors.agentName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinic-name">Qual o nome da sua clínica?</Label>
            <Input
              id="clinic-name"
              value={data.clinicName}
              onChange={(event) => onFieldChange("clinicName", event.target.value)}
              disabled={disabled}
              className={
                `${fieldInputClass} ${
                  errors.clinicName
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }`
              }
            />
            {errors.clinicName && (
              <p className="text-xs text-destructive">{errors.clinicName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="professional-name">
              Qual o nome do profissional responsável?
            </Label>
            <Input
              id="professional-name"
              value={data.professionalName}
              onChange={(event) =>
                onFieldChange("professionalName", event.target.value)
              }
              disabled={disabled}
              className={fieldInputClass}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialty">Qual a especialidade da clínica?</Label>
            <Input
              id="specialty"
              value={data.specialty}
              onChange={(event) => onFieldChange("specialty", event.target.value)}
              disabled={disabled}
              className={fieldInputClass}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="use-emojis">A IA deve usar emojis?</Label>
              <Switch
                id="use-emojis"
                checked={data.useEmojis}
                onCheckedChange={(checked) => onFieldChange("useEmojis", checked === true)}
                disabled={disabled}
              />
            </div>
            {data.useEmojis && (
              <div className="space-y-2">
                <Label htmlFor="emojis">Quais emojis a IA pode usar?</Label>
                <Textarea
                  id="emojis"
                  value={data.emojis}
                  onChange={(event) => onFieldChange("emojis", event.target.value)}
                  className={`${fieldTextareaClass} min-h-[90px] resize-y`}
                  disabled={disabled}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="call-target">Quem a IA deve chamar?</Label>
            <Select
              value={data.callTarget}
              onValueChange={(value) =>
                onFieldChange("callTarget", value as "equipe" | "secretaria" | "doutor")
              }
              disabled={disabled}
            >
              <SelectTrigger id="call-target" className={fieldInputClass}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equipe">Equipe</SelectItem>
                <SelectItem value="secretaria">Secretária</SelectItem>
                <SelectItem value="doutor">Doutor(a)</SelectItem>
              </SelectContent>
            </Select>
            {(data.callTarget === "secretaria" || data.callTarget === "doutor") && (
              <div className="space-y-2">
                <Label htmlFor="call-person-name">
                  Nome da {data.callTarget === "secretaria" ? "secretária" : "doutor(a)"}
                </Label>
                <Input
                  id="call-person-name"
                  value={data.callPersonName}
                  onChange={(event) => onFieldChange("callPersonName", event.target.value)}
                  disabled={disabled}
                  className={fieldInputClass}
                />
              </div>
            )}
          </div>

          <div data-tutorial="ia-field-voice" className="space-y-2">
            <Label htmlFor="voice-tone">Tom de voz e personalidade do agente</Label>
            <Textarea
              id="voice-tone"
              value={data.voiceTone}
              onChange={(event) => onFieldChange("voiceTone", event.target.value)}
              className={`${fieldTextareaClass} min-h-[120px] resize-y`}
              disabled={disabled}
            />
          </div>

          <div data-tutorial="ia-field-procedures" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Quais procedimentos você oferece?</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={onAddProcedure}
                disabled={disabled}
              >
                <Plus className="h-4 w-4" />
                Adicionar procedimento
              </Button>
            </div>

            <div className="space-y-3">
              {data.procedures.map((procedure, index) => (
                <div
                  key={procedure.id}
                  className="rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      Procedimento {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveProcedure(procedure.id)}
                      disabled={disabled || data.procedures.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={procedure.name}
                      onChange={(event) =>
                        onProcedureChange(procedure.id, "name", event.target.value)
                      }
                      disabled={disabled}
                      className={fieldInputClass}
                    />
                    <div className="space-y-2">
                      <Textarea
                        value={procedure.description}
                        onChange={(event) =>
                          onProcedureChange(
                            procedure.id,
                            "description",
                            event.target.value,
                          )
                        }
                        className={`${fieldTextareaClass} min-h-[90px] resize-y`}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {errors.procedures && (
              <p className="text-xs text-destructive">{errors.procedures}</p>
            )}
          </div>

          <div data-tutorial="ia-field-faq" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>FAQ da clínica</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={onAddFaq}
                disabled={disabled}
              >
                <Plus className="h-4 w-4" />
                Adicionar FAQ
              </Button>
            </div>

            <div className="space-y-3">
              {data.faqs.map((faq, index) => (
                <div
                  key={faq.id}
                  className="rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      FAQ {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveFaq(faq.id)}
                      disabled={disabled || data.faqs.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <Input
                      value={faq.question}
                      onChange={(event) =>
                        onFaqChange(faq.id, "question", event.target.value)
                      }
                      disabled={disabled}
                      className={fieldInputClass}
                    />
                    <Textarea
                      value={faq.answer}
                      onChange={(event) =>
                        onFaqChange(faq.id, "answer", event.target.value)
                      }
                      className={`${fieldTextareaClass} min-h-[100px] resize-y`}
                      disabled={disabled}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instagram">Qual o link do seu Instagram?</Label>
            <Input
              id="instagram"
              value={data.instagram}
              onChange={(event) => onFieldChange("instagram", event.target.value)}
              disabled={disabled}
              className={`${fieldInputClass} ${
                errors.instagram ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
            {errors.instagram && (
              <p className="text-xs text-destructive">{errors.instagram}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Qual o endereço da clínica?</Label>
            <Input
              id="address"
              value={data.address}
              onChange={(event) => onFieldChange("address", event.target.value)}
              disabled={disabled}
              className={fieldInputClass}
            />
          </div>

          {/* HORÁRIO DE ATENDIMENTO HUMANO */}
          <div data-tutorial="ia-field-horario" className="space-y-3">
            <div className="space-y-1">
              <Label>Horário de atendimento humano</Label>
              <p className="text-xs text-muted-foreground">
                A IA usa para informar ao lead quando a equipe humana estará disponível.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm font-medium text-foreground">Segunda a Sexta</span>
                <Input
                  type="time"
                  value={horarioAtendimento.weekday_open}
                  onChange={(e) => onHorarioChange({ ...horarioAtendimento, weekday_open: e.target.value })}
                  disabled={disabled}
                  className={`${fieldInputClass} w-32`}
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="time"
                  value={horarioAtendimento.weekday_close}
                  onChange={(e) => onHorarioChange({ ...horarioAtendimento, weekday_close: e.target.value })}
                  disabled={disabled}
                  className={`${fieldInputClass} w-32`}
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm font-medium text-foreground">Sábado</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={horarioAtendimento.saturday_closed}
                    onCheckedChange={(checked) => onHorarioChange({ ...horarioAtendimento, saturday_closed: checked === true })}
                    disabled={disabled}
                  />
                  <span className="text-xs text-muted-foreground">Fechado</span>
                </div>
                {!horarioAtendimento.saturday_closed && (
                  <>
                    <Input
                      type="time"
                      value={horarioAtendimento.saturday_open}
                      onChange={(e) => onHorarioChange({ ...horarioAtendimento, saturday_open: e.target.value })}
                      disabled={disabled}
                      className={`${fieldInputClass} w-32`}
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={horarioAtendimento.saturday_close}
                      onChange={(e) => onHorarioChange({ ...horarioAtendimento, saturday_close: e.target.value })}
                      disabled={disabled}
                      className={`${fieldInputClass} w-32`}
                    />
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm font-medium text-foreground">Domingo</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={horarioAtendimento.sunday_closed}
                    onCheckedChange={(checked) => onHorarioChange({ ...horarioAtendimento, sunday_closed: checked === true })}
                    disabled={disabled}
                  />
                  <span className="text-xs text-muted-foreground">Fechado</span>
                </div>
              </div>
            </div>
          </div>

          {/* FORMAS DE PAGAMENTO */}
          <div data-tutorial="ia-field-pagamento" className="space-y-3">
            <Label>Quais formas de pagamento a clínica aceita?</Label>

            <div className="flex flex-wrap items-center gap-4">
              {(["pix", "dinheiro", "credito", "debito"] as const).map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`pagamento-${key}`}
                    checked={formasPagamento[key]}
                    onCheckedChange={(checked) => onFormasChange({ ...formasPagamento, [key]: checked === true })}
                    disabled={disabled}
                  />
                  <Label htmlFor={`pagamento-${key}`} className="cursor-pointer text-sm font-normal">
                    {key === "pix" ? "Pix" : key === "dinheiro" ? "Dinheiro" : key === "credito" ? "Crédito" : "Débito"}
                  </Label>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="parcelamento" className="text-xs font-normal text-muted-foreground">
                Condições de parcelamento (opcional)
              </Label>
              <Input
                id="parcelamento"
                value={formasPagamento.parcelamento}
                onChange={(e) => onFormasChange({ ...formasPagamento, parcelamento: e.target.value })}
                placeholder="Ex: Até 10x com juros no cartão"
                disabled={disabled}
                className={fieldInputClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs-pagamento" className="text-xs font-normal text-muted-foreground">
                Observações sobre pagamento (opcional)
              </Label>
              <Input
                id="obs-pagamento"
                value={formasPagamento.observacoes}
                onChange={(e) => onFormasChange({ ...formasPagamento, observacoes: e.target.value })}
                placeholder="Ex: 5% desconto para pagamento à vista"
                disabled={disabled}
                className={fieldInputClass}
              />
            </div>
          </div>

          {/* CONTRAINDICAÇÕES */}
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="contraindicacoes">
                Contraindicações ou situações em que a IA não deve prosseguir
              </Label>
              <p className="text-xs text-muted-foreground">
                A IA passará para a equipe humana.
              </p>
            </div>
            <Textarea
              id="contraindicacoes"
              value={contraindicacoes}
              onChange={(e) => onContraindicacoesChange(e.target.value)}
              className={`${fieldTextareaClass} min-h-[80px] resize-y`}
              disabled={disabled}
              rows={3}
              placeholder="Ex: Gestantes, lactantes, menores sem responsável, doenças autoimunes descompensadas"
            />
          </div>

          {/* PALAVRAS PROIBIDAS */}
          <div className="space-y-2">
            <div className="space-y-1">
              <Label>Palavras ou expressões que a IA nunca deve usar</Label>
              <p className="text-xs text-muted-foreground">
                Digite e pressione Enter para adicionar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {palavrasProibidas.map((palavra, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="gap-1 pl-2.5 pr-1 py-1 text-xs"
                >
                  {palavra}
                  <button
                    type="button"
                    onClick={() => onPalavrasProibidasChange(palavrasProibidas.filter((_, i) => i !== idx))}
                    disabled={disabled}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value={palavraInput}
              onChange={(e) => setPalavraInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const trimmed = palavraInput.trim();
                  if (trimmed && !palavrasProibidas.includes(trimmed)) {
                    onPalavrasProibidasChange([...palavrasProibidas, trimmed]);
                  }
                  setPalavraInput("");
                }
              }}
              placeholder="Ex: baratinho, desconto, amiga"
              disabled={disabled}
              className={fieldInputClass}
            />
          </div>

          <div data-tutorial="ia-field-instructions" className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="instructions">
                Tem alguma instrução específica para o agente?
              </Label>
              <p className="text-xs text-muted-foreground">
                Use este campo para regras específicas da sua clínica. Não adicione
                regras de comportamento geral — elas já estão configuradas no
                sistema.
              </p>
            </div>
            <Textarea
              id="instructions"
              value={data.instructions}
              onChange={(event) => onFieldChange("instructions", event.target.value)}
              className={`${fieldTextareaClass} min-h-[140px] resize-y`}
              disabled={disabled}
            />
          </div>

          <Collapsible open={previewOpen} onOpenChange={onPreviewOpenChange}>
            <div className="rounded-lg border border-border bg-muted/10">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="text-sm font-medium text-foreground">
                    Ver como o agente vai receber essas informações
                  </span>
                  {previewOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border px-4 py-3">
                  <pre className="whitespace-pre-wrap break-words rounded-md bg-background p-4 font-mono text-xs leading-6 text-foreground">
                    {previewMarkdown}
                  </pre>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}

export default function AiSettings() {
  const {
    prompt,
    modeloIa: modeloIaBanco,
    iaAtiva,
    acumuloMensagens,
    horarioAtendimento: horarioAtendimentoBanco,
    formasPagamento: formasPagamentoBanco,
    contraindicacoes: contraindicacoesBanco,
    palavrasProibidas: palavrasProibidasBanco,
    lastUpdated,
    isLoading,
    savePrompt,
    saveModel,
    toggleIa,
    isTogglingIa,
    isSaving,
    isSavingModel,
  } = useAiPrompt();

  const [localForm, setLocalForm] = useState<AgentPromptFormData>(
    createEmptyFormData(),
  );
  const [originalForm, setOriginalForm] = useState<AgentPromptFormData>(
    createEmptyFormData(),
  );
  const [localAcumulo, setLocalAcumulo] = useState(45);
  const [originalAcumulo, setOriginalAcumulo] = useState(45);
  const [localModelo, setLocalModelo] = useState("");
  const [originalModelo, setOriginalModelo] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState(
    buildPromptMarkdown(createEmptyFormData()),
  );
  const [pageTab, setPageTab] = useState("config");
  const [activeTab, setActiveTab] = useState("base");
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [originalParseWarning, setOriginalParseWarning] = useState<string | null>(
    null,
  );
  const [requiresReset, setRequiresReset] = useState(false);
  const [originalRequiresReset, setOriginalRequiresReset] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [modeloSaveSuccess, setModeloSaveSuccess] = useState(false);
  const [modeloSaveError, setModeloSaveError] = useState<string | null>(null);
  const [modeloSuggestionsOpen, setModeloSuggestionsOpen] = useState(false);

  const defaultHorario: HorarioAtendimento = { weekday_open: "09:00", weekday_close: "18:00", saturday_open: "", saturday_close: "", saturday_closed: true, sunday_closed: true };
  const defaultFormas: FormasPagamento = { pix: false, dinheiro: false, credito: false, debito: false, parcelamento: "", observacoes: "" };

  const [localHorario, setLocalHorario] = useState<HorarioAtendimento>(defaultHorario);
  const [originalHorario, setOriginalHorario] = useState<HorarioAtendimento>(defaultHorario);
  const [localFormas, setLocalFormas] = useState<FormasPagamento>(defaultFormas);
  const [originalFormas, setOriginalFormas] = useState<FormasPagamento>(defaultFormas);
  const [localContraindicacoes, setLocalContraindicacoes] = useState("");
  const [originalContraindicacoes, setOriginalContraindicacoes] = useState("");
  const [localPalavras, setLocalPalavras] = useState<string[]>([]);
  const [originalPalavras, setOriginalPalavras] = useState<string[]>([]);

  useEffect(() => {
    if (isLoading) return;

    const fallbackForm = createEmptyFormData();
    const parsed = prompt
      ? parsePromptMarkdown(prompt)
      : ({ ok: true, data: fallbackForm } as const);

    if (parsed.ok) {
      const normalizedPrompt = buildPromptMarkdown(parsed.data);
      const cloned = cloneFormData(parsed.data);
      setLocalForm(cloned);
      setOriginalForm(cloneFormData(cloned));
      setOriginalPrompt(normalizedPrompt);
      setParseWarning(null);
      setOriginalParseWarning(null);
      setRequiresReset(false);
      setOriginalRequiresReset(false);
    } else {
      setLocalForm(cloneFormData(fallbackForm));
      setOriginalForm(cloneFormData(fallbackForm));
      setOriginalPrompt(prompt);
      setParseWarning(PARSE_WARNING_MESSAGE);
      setOriginalParseWarning(PARSE_WARNING_MESSAGE);
      setRequiresReset(true);
      setOriginalRequiresReset(true);
    }

    setErrors({});
    setPreviewOpen(false);
    setLocalAcumulo(acumuloMensagens || 45);
    setOriginalAcumulo(acumuloMensagens || 45);
    setLocalModelo(modeloIaBanco || "");
    setOriginalModelo(modeloIaBanco || "");
    setModeloSaveSuccess(false);
    setModeloSaveError(null);
    setModeloSuggestionsOpen(false);

    const h = { ...defaultHorario, ...horarioAtendimentoBanco };
    setLocalHorario(h);
    setOriginalHorario(h);
    const f = { ...defaultFormas, ...formasPagamentoBanco };
    setLocalFormas(f);
    setOriginalFormas(f);
    setLocalContraindicacoes(contraindicacoesBanco || "");
    setOriginalContraindicacoes(contraindicacoesBanco || "");
    setLocalPalavras(palavrasProibidasBanco || []);
    setOriginalPalavras(palavrasProibidasBanco || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, acumuloMensagens, isLoading, modeloIaBanco, JSON.stringify(horarioAtendimentoBanco), JSON.stringify(formasPagamentoBanco), contraindicacoesBanco, JSON.stringify(palavrasProibidasBanco)]);

  const currentPrompt = buildPromptMarkdown(localForm);
  const hasChanges =
    !requiresReset &&
    (currentPrompt !== originalPrompt ||
      localAcumulo !== originalAcumulo ||
      localModelo !== originalModelo ||
      JSON.stringify(localHorario) !== JSON.stringify(originalHorario) ||
      JSON.stringify(localFormas) !== JSON.stringify(originalFormas) ||
      localContraindicacoes !== originalContraindicacoes ||
      JSON.stringify(localPalavras) !== JSON.stringify(originalPalavras));
  const formDisabled = isLoading || isSaving || isSavingModel || requiresReset;

  const handleFieldChange = <K extends keyof AgentPromptFormData>(
    field: K,
    value: AgentPromptFormData[K],
  ) => {
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setLocalForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleProcedureChange = (
    id: string,
    field: keyof Omit<ProcedureItem, "id">,
    value: string,
  ) => {
    setErrors((previous) => ({ ...previous, procedures: undefined }));
    setLocalForm((previous) => ({
      ...previous,
      procedures: previous.procedures.map((procedure) =>
        procedure.id === id ? { ...procedure, [field]: value } : procedure,
      ),
    }));
  };

  const handleAddProcedure = () => {
    setErrors((previous) => ({ ...previous, procedures: undefined }));
    setLocalForm((previous) => ({
      ...previous,
      procedures: [...previous.procedures, createProcedureItem()],
    }));
  };

  const handleRemoveProcedure = (id: string) => {
    setErrors((previous) => ({ ...previous, procedures: undefined }));
    setLocalForm((previous) => {
      const nextProcedures = previous.procedures.filter(
        (procedure) => procedure.id !== id,
      );

      return {
        ...previous,
        procedures:
          nextProcedures.length > 0 ? nextProcedures : [createProcedureItem()],
      };
    });
  };

  const handleFaqChange = (
    id: string,
    field: keyof Omit<FaqItem, "id">,
    value: string,
  ) => {
    setLocalForm((previous) => ({
      ...previous,
      faqs: previous.faqs.map((faq) =>
        faq.id === id ? { ...faq, [field]: value } : faq,
      ),
    }));
  };

  const handleAddFaq = () => {
    setLocalForm((previous) => ({
      ...previous,
      faqs: [...previous.faqs, createFaqItem()],
    }));
  };

  const handleRemoveFaq = (id: string) => {
    setLocalForm((previous) => {
      const nextFaqs = previous.faqs.filter((faq) => faq.id !== id);

      return {
        ...previous,
        faqs: nextFaqs.length > 0 ? nextFaqs : [createFaqItem()],
      };
    });
  };

  const handleAcumuloChange = (value: string) => {
    setLocalAcumulo(Number(value));
  };

  const handleSaveModel = () => {
    const nextModel = localModelo.trim();
    if (!nextModel) {
      setModeloSaveError("Informe um modelo antes de salvar.");
      return;
    }

    setModeloSaveError(null);
    saveModel(nextModel, {
      onSuccess: () => {
        setOriginalModelo(nextModel);
        setModeloSaveSuccess(true);
        window.setTimeout(() => setModeloSaveSuccess(false), 2000);
      },
      onError: (error: any) => {
        setModeloSaveError(error?.message || "Erro ao salvar modelo.");
      },
    });
  };

  const handleSave = () => {
    if (requiresReset) return;

    const validationErrors = validateFormData(localForm);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Preencha os campos obrigatórios antes de salvar.");
      return;
    }

    savePrompt(currentPrompt, undefined, localAcumulo, {
      onSuccess: () => {
        setOriginalForm(cloneFormData(localForm));
        setOriginalPrompt(currentPrompt);
        setOriginalAcumulo(localAcumulo);
        setOriginalModelo(localModelo.trim());
        setParseWarning(null);
        setOriginalParseWarning(null);
        setRequiresReset(false);
        setOriginalRequiresReset(false);
        setErrors({});
        setOriginalHorario(localHorario);
        setOriginalFormas(localFormas);
        setOriginalContraindicacoes(localContraindicacoes);
        setOriginalPalavras(localPalavras);
      },
    }, localModelo, localHorario as unknown as Record<string, unknown>, localFormas as unknown as Record<string, unknown>, localContraindicacoes, localPalavras);
  };

  const handleRevert = () => {
    setLocalForm(cloneFormData(originalForm));
    setLocalAcumulo(originalAcumulo);
    setLocalModelo(originalModelo);
    setParseWarning(originalParseWarning);
    setRequiresReset(originalRequiresReset);
    setErrors({});
    setModeloSaveError(null);
    setModeloSaveSuccess(false);
    setLocalHorario(originalHorario);
    setLocalFormas(originalFormas);
    setLocalContraindicacoes(originalContraindicacoes);
    setLocalPalavras(originalPalavras);
    toast.info("Alterações descartadas.");
  };
  const handleResetToStructuredForm = () => {
    setLocalForm(createEmptyFormData());
    setParseWarning(null);
    setRequiresReset(false);
    setErrors({});
    toast.info(
      "Formulário padrão restaurado. Agora você já pode preencher e salvar.",
    );
  };

  const formContent = (
    <AgentPromptFormFields
      data={localForm}
      disabled={formDisabled}
      warningMessage={parseWarning}
      errors={errors}
      previewMarkdown={currentPrompt}
      previewOpen={previewOpen}
      horarioAtendimento={localHorario}
      formasPagamento={localFormas}
      contraindicacoes={localContraindicacoes}
      palavrasProibidas={localPalavras}
      onFieldChange={handleFieldChange}
      onHorarioChange={setLocalHorario}
      onFormasChange={setLocalFormas}
      onContraindicacoesChange={setLocalContraindicacoes}
      onPalavrasProibidasChange={setLocalPalavras}
      onProcedureChange={handleProcedureChange}
      onAddProcedure={handleAddProcedure}
      onRemoveProcedure={handleRemoveProcedure}
      onFaqChange={handleFaqChange}
      onAddFaq={handleAddFaq}
      onRemoveFaq={handleRemoveFaq}
      onResetToStructuredForm={handleResetToStructuredForm}
      onPreviewOpenChange={setPreviewOpen}
    />
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-6 overflow-y-auto pb-10 pr-1 scrollbar-hide">
      {/* ═══ PAGE HEADER ═══ */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Inteligencia Artificial</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Configure o comportamento e as regras da sua assistente virtual
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastUpdated && !hasChanges && (
              <span className="hidden items-center gap-1 text-[11px] text-muted-foreground/60 md:flex mr-1">
                <History className="h-3 w-3" />
                {format(new Date(lastUpdated), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
            {hasChanges && (
              <Button variant="outline" onClick={handleRevert} className="h-9 gap-1.5 rounded-lg text-xs font-medium px-3">
                <Undo2 className="h-3.5 w-3.5" /> Descartar
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isLoading || isSaving || isSavingModel || !hasChanges}
              className="h-9 gap-1.5 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 relative"
              data-tutorial="ia-save"
            >
              {isSaving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="h-3.5 w-3.5" /> Salvar</>
              )}
              {hasChanges && (
                <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Page-level tabs */}
        <div data-tutorial="ia-tabs" className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl w-fit">
          {[
            { key: "config", label: "Configurações", icon: Wrench },
            { key: "followup", label: "Follow-up", icon: RefreshCw },
            { key: "logs", label: "Logs", icon: Activity },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                pageTab === tab.key
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              onClick={() => setPageTab(tab.key)}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Follow-up */}
      {pageTab === "followup" && <div data-tutorial="ia-followup"><AiFollowupTab /></div>}

      {/* Tab: Logs */}
      {pageTab === "logs" && <div data-tutorial="ia-logs"><AiExecutionLogsTab /></div>}

      {/* Tab: Configurações — existing content */}
      {pageTab === "config" && (
      <>
      <div className="flex gap-4" style={{ minHeight: "520px" }}>
        <div className="flex flex-1 flex-col" style={{ minHeight: "520px" }}>
          <Tabs
            defaultValue="base"
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 flex-col"
          >
            <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl w-fit mb-3">
              <button
                type="button"
                onClick={() => setActiveTab("base")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  activeTab === "base"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Prompt Agente Base
              </button>
            </div>

            <div className="flex-1" style={{ minHeight: "460px" }}>
              {activeTab === "base" && (
                <div
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                  style={{ height: "460px" }}
                  data-tutorial="ia-prompt"
                >
                  {/* Info banner */}
                  <div className="mx-4 mt-4 rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3">
                    <p className="text-[11px] font-semibold text-amber-700">
                      Como funciona o Agente
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-amber-600/80">
                      Comportamento e regras já estão configurados automaticamente. Preencha apenas as informações específicas da clínica.
                    </p>
                  </div>
                  {/* Sub-header */}
                  <div className="flex flex-row items-center justify-between border-b border-border/40 bg-muted/[0.03] px-4 py-2.5 mt-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Dados da Clinica
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-medium text-muted-foreground/40 bg-muted/50 px-2 py-0.5 rounded-md font-mono">
                        system.prompt.md
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground/40 hover:text-foreground rounded-md"
                          >
                            <Maximize2 className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="flex h-[85vh] w-[95vw] max-w-5xl flex-col overflow-hidden bg-background p-0 rounded-2xl border-border/60">
                          <div className="flex flex-row items-center justify-between border-b border-border/40 px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-lg bg-muted">
                                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <span className="text-sm font-semibold text-foreground">
                                Dados da Clinica — Tela Cheia
                              </span>
                            </div>
                            <span className="text-[9px] font-medium text-muted-foreground/40 bg-muted/50 px-2 py-0.5 rounded-md font-mono">
                              system.prompt.md
                            </span>
                          </div>
                          <div className="min-h-0 flex-1 overflow-hidden bg-background">
                            {isLoading ? (
                              <div className="flex h-full items-center justify-center">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
                              </div>
                            ) : (
                              formContent
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    {isLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
                      </div>
                    ) : (
                      formContent
                    )}
                  </div>
                </div>
              )}
            </div>
          </Tabs>
        </div>

        <div className="flex w-72 flex-shrink-0 flex-col gap-3 pb-4 pr-1">
          {/* Status da IA */}
          <div data-tutorial="ia-status" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${iaAtiva ? "bg-emerald-50" : "bg-muted"}`}>
                  <Power className={`h-3.5 w-3.5 ${iaAtiva ? "text-emerald-600" : "text-muted-foreground"}`} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                iaAtiva
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200/60"
                  : "bg-muted text-muted-foreground border-border/60"
              }`}>
                {iaAtiva ? "Ativa" : "Inativa"}
              </span>
            </div>
            <p className="mb-4 text-[11px] text-muted-foreground/60 leading-relaxed">
              {iaAtiva
                ? "A IA responde automaticamente às mensagens dos leads."
                : "A IA está desativada. Mensagens não serão respondidas."}
            </p>
            <div className="flex items-center gap-3" data-tutorial="ia-toggle">
              <Switch
                checked={iaAtiva}
                onCheckedChange={toggleIa}
                disabled={isTogglingIa || isLoading}
                id="toggle-ia"
              />
              <Label htmlFor="toggle-ia" className="cursor-pointer text-xs font-medium text-muted-foreground">
                {iaAtiva ? "Desativar IA" : "Ativar IA"}
              </Label>
            </div>
          </div>


        </div>
      </div>
      </>
      )}
    </div>
  );
}
