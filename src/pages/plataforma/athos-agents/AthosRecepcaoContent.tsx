import { useEffect, useDeferredValue, useRef, useState } from "react";
import { Activity, Loader2, Power, Save, Undo2, Wrench } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AiExecutionLogsTab } from "@/components/ai/AiExecutionLogsTab";
import { AiBuilderStepper } from "@/components/ai/AiBuilderStepper";
import { useAiPrompt } from "@/hooks/useAiPrompt";
import { useProcedimentos } from "@/hooks/useProcedimentos";
import { useBranding } from "@/contexts/BrandingContext";

type ProcedureItem = { id: string; name: string; description: string };
type FaqItem = { id: string; question: string; answer: string };

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
  customGreeting: string;
  diagnosticQuestions: number;
  customQuestions: string[];
  sendInstagram: boolean;
  presentationTone: "emocional" | "equilibrado" | "direto";
  customHandoff: string;
};

type ParsedPromptResult = { ok: true; data: AgentPromptFormData } | { ok: false };

type FormErrors = {
  agentName?: string;
  clinicName?: string;
  procedures?: string;
  instagram?: string;
};

const PARSE_WARNING_MESSAGE =
  "Encontramos um prompt salvo fora do formato padrão do formulário. Para continuar usando este editor estruturado, resete o conteúdo para o modelo padrão.";

function createProcedureItem(overrides?: Partial<Omit<ProcedureItem, "id">>): ProcedureItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides?.name ?? "",
    description: overrides?.description ?? "",
  };
}

function createFaqItem(overrides?: Partial<Omit<FaqItem, "id">>): FaqItem {
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
    customGreeting: "",
    diagnosticQuestions: 3,
    customQuestions: ["", "", ""],
    sendInstagram: true,
    presentationTone: "equilibrado",
    customHandoff: "",
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
  if (!question && !answer) return null;
  return `- Pergunta: ${question}\n  Resposta: ${answer}`;
}

function parseFaqSection(section: string): FaqItem[] {
  const lines = section.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  const faqs: FaqItem[] = [];
  let currentFaq: FaqItem | null = null;

  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (currentFaq && (currentFaq.question || currentFaq.answer)) faqs.push(currentFaq);
      currentFaq = createFaqItem();
      const questionMatch = line.match(/^- Pergunta:\s*(.*)$/i);
      currentFaq.question = questionMatch ? questionMatch[1].trim() : line.replace(/^- /, "").trim();
      continue;
    }
    const questionMatch = line.match(/^Pergunta:\s*(.*)$/i);
    if (questionMatch) {
      if (!currentFaq) currentFaq = createFaqItem();
      currentFaq.question = questionMatch[1].trim();
      continue;
    }
    const answerMatch = line.match(/^Resposta:\s*(.*)$/i);
    if (answerMatch) {
      if (!currentFaq) currentFaq = createFaqItem();
      currentFaq.answer = answerMatch[1].trim();
      continue;
    }
    if (currentFaq) currentFaq.answer = currentFaq.answer ? `${currentFaq.answer} ${line}` : line;
  }
  if (currentFaq && (currentFaq.question || currentFaq.answer)) faqs.push(currentFaq);
  return faqs;
}

function buildPromptMarkdown(data: AgentPromptFormData): string {
  const procedures = data.procedures
    .map((procedure) => ({
      name: normalizeSingleLine(procedure.name),
      description: normalizeSingleLine(procedure.description),
    }))
    .filter((procedure) => procedure.name || procedure.description)
    .map((procedure) => (procedure.description ? `- ${procedure.name}: ${procedure.description}` : `- ${procedure.name}`));

  const faqs = data.faqs.map((faq) => buildFaqBlock(faq)).filter((faq): faq is string => Boolean(faq));

  const sections = [
    "## IDENTIDADE DO AGENTE",
    `Nome do agente: ${data.agentName.trim()}`,
    `Nome da clínica: ${data.clinicName.trim()}`,
    `Nome do profissional: ${data.professionalName.trim()}`,
    `Especialidade: ${data.specialty.trim()}`,
    "",
    "## EMOJIS",
    `A IA deve usar emojis?: ${data.useEmojis ? "Sim" : "Não"}`,
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
    "",
    "## PERSONALIZAÇÃO DO FLUXO",
    `Mensagem de boas-vindas personalizada: ${data.customGreeting.trim() || "(usar padrão)"}`,
    `Número de perguntas no diagnóstico: ${data.diagnosticQuestions}`,
    ...Array.from({ length: data.diagnosticQuestions }, (_, i) => {
      const v = (data.customQuestions[i] ?? "").trim();
      return `Pergunta ${i + 1} personalizada: ${v || "(usar padrão)"}`;
    }),
    `Enviar Instagram na apresentação: ${data.sendInstagram ? "Sim" : "Não"}`,
    `Tom da apresentação: ${data.presentationTone}`,
    `Frase de handoff personalizada: ${data.customHandoff.trim() || "(usar padrão)"}`,
  ];

  return sections.join("\n").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(markdown: string, title: string): string | null {
  const regex = new RegExp(`##\\s+${escapeRegex(title)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i");
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
  if (!normalized) return { ok: true, data: createEmptyFormData() };

  const identitySection = extractSection(normalized, "IDENTIDADE DO AGENTE");
  const proceduresSection = extractSection(normalized, "PROCEDIMENTOS OFERECIDOS");
  const contactSection = extractSection(normalized, "REDES SOCIAIS E CONTATO");
  const instructionsSection = extractSection(normalized, "INSTRUÇÕES PONTUAIS");
  const flowSection = extractSection(normalized, "PERSONALIZAÇÃO DO FLUXO");

  if (identitySection === null || proceduresSection === null || contactSection === null) return { ok: false };

  const agentName = extractLabeledValue(identitySection, "Nome do agente");
  const clinicName = extractLabeledValue(identitySection, "Nome da clínica");
  const professionalName = extractLabeledValue(identitySection, "Nome do profissional");
  const specialty = extractLabeledValue(identitySection, "Especialidade");
  const instagram = extractLabeledValue(contactSection, "Instagram") ?? "";
  const addressLine = contactSection.split("\n").map((line) => line.trim()).find((line) => line.toLowerCase().startsWith("endere"));
  const address = addressLine ? addressLine.split(":").slice(1).join(":").trim() : "";
  const emojisSection = extractSection(normalized, "EMOJIS");
  const callNameSection = extractSection(normalized, "FORMA DE CHAMADA");
  const voiceToneSection = extractSection(normalized, "TOM DE VOZ E PERSONALIDADE");
  const faqsSection = extractSection(normalized, "FAQ");
  const useEmojis = parseYesNo(emojisSection ? extractLabeledValue(emojisSection, "A IA deve usar emojis?") : null);
  const emojis = emojisSection ? extractLabeledValue(emojisSection, "Emojis permitidos") ?? "" : "";
  const callTargetRaw = callNameSection ? extractLabeledValue(callNameSection, "Quem a IA deve chamar?") ?? "" : "";
  const callTarget = /equipe/i.test(callTargetRaw) ? "equipe" : /secret/i.test(callTargetRaw) ? "secretaria" : /doutor/i.test(callTargetRaw) ? "doutor" : "";
  const callPersonName = callNameSection ? extractLabeledValue(callNameSection, "Nome da pessoa") ?? "" : "";
  const voiceTone = voiceToneSection ? voiceToneSection.trim() : "";
  const faqs = faqsSection ? parseFaqSection(faqsSection) : [];

  if (agentName === null || clinicName === null || professionalName === null || specialty === null) return { ok: false };

  const rawProcedureLines = proceduresSection.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  if (rawProcedureLines.some((line) => !line.startsWith("- ") && line.replace(/-/g, "").trim() !== "")) return { ok: false };

  const procedures = rawProcedureLines
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) return createProcedureItem({ name: line, description: "" });
      return createProcedureItem({ name: line.slice(0, separatorIndex).trim(), description: line.slice(separatorIndex + 1).trim() });
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
      customGreeting: flowSection ? (extractLabeledValue(flowSection, "Mensagem de boas-vindas personalizada") ?? "").replace(/^\(usar padrão\)$/, "") : "",
      diagnosticQuestions: (() => {
        const raw = flowSection ? extractLabeledValue(flowSection, "Número de perguntas no diagnóstico") : null;
        const n = raw ? parseInt(raw, 10) : NaN;
        return Number.isFinite(n) && n > 0 ? n : 3;
      })(),
      customQuestions: (() => {
        if (!flowSection) return ["", "", ""];
        const raw = extractLabeledValue(flowSection, "Número de perguntas no diagnóstico");
        const n = raw ? parseInt(raw, 10) : 3;
        const count = Number.isFinite(n) && n > 0 ? n : 3;
        return Array.from({ length: count }, (_, i) => {
          const v = (extractLabeledValue(flowSection, `Pergunta ${i + 1} personalizada`) ?? "").replace(/^\(usar padrão\)$|^\(desativada\)$/, "");
          return v;
        });
      })(),
      sendInstagram: flowSection ? parseYesNo(extractLabeledValue(flowSection, "Enviar Instagram na apresentação")) : true,
      presentationTone: (flowSection ? extractLabeledValue(flowSection, "Tom da apresentação") ?? "equilibrado" : "equilibrado") as "emocional" | "equilibrado" | "direto",
      customHandoff: flowSection ? (extractLabeledValue(flowSection, "Frase de handoff personalizada") ?? "").replace(/^\(usar padrão\)$/, "") : "",
    },
  };
}

function validateFormData(data: AgentPromptFormData): FormErrors {
  const errors: FormErrors = {};
  const validProcedures = data.procedures.filter((procedure) => procedure.name.trim().length > 0);
  if (!data.agentName.trim()) errors.agentName = "Informe o nome do agente.";
  if (!data.clinicName.trim()) errors.clinicName = "Informe o nome da clínica.";
  if (validProcedures.length === 0) errors.procedures = "Cadastre pelo menos 1 procedimento.";
  if (data.instagram.trim() && !data.instagram.trim().startsWith("http")) errors.instagram = "O link do Instagram deve começar com http.";
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

/**
 * Conteúdo central do agente Athos Pré-Atendimento (`whatsapp-ai-agent`).
 * Porte 1:1 da antiga `/crm/ia` (removida) — builder de prompt em 5 etapas, status/toggle
 * (`organization_ai_prompts.ia_ativa` — distinto do on/off do Console Athos, que já fica no
 * hero da página) e logs de execução. Duas abas internas: Configurações e Logs.
 */
export function AthosRecepcaoContent() {
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
    toggleIa,
    isTogglingIa,
    isSaving,
    isSavingModel,
  } = useAiPrompt();

  const { procedimentos } = useProcedimentos();
  const { branding } = useBranding();

  const [subTab, setSubTab] = useState<"config" | "logs">("config");
  const [localForm, setLocalForm] = useState<AgentPromptFormData>(createEmptyFormData());
  const [originalForm, setOriginalForm] = useState<AgentPromptFormData>(createEmptyFormData());
  const [localAcumulo, setLocalAcumulo] = useState(45);
  const [originalAcumulo, setOriginalAcumulo] = useState(45);
  const [localModelo, setLocalModelo] = useState("");
  const [originalModelo, setOriginalModelo] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState(buildPromptMarkdown(createEmptyFormData()));
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [originalParseWarning, setOriginalParseWarning] = useState<string | null>(null);
  const [requiresReset, setRequiresReset] = useState(false);
  const [originalRequiresReset, setOriginalRequiresReset] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [previewOpen, setPreviewOpen] = useState(false);

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

  const lastInitPromptRef = useRef<string | undefined>(undefined);
  const formIsDirtyRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    const promptMudou = prompt !== lastInitPromptRef.current;

    if (!promptMudou && formIsDirtyRef.current) {
      const crmAtivos = procedimentos.filter((p) => p.ativo);
      if (crmAtivos.length > 0) {
        setLocalForm((prev) => {
          const mergedProcedures = crmAtivos.map((p) => {
            const existing = prev.procedures.find((ep) => ep.name.toLowerCase().trim() === p.nome.toLowerCase().trim());
            return createProcedureItem({ name: p.nome, description: existing?.description ?? "" });
          });
          return { ...prev, procedures: mergedProcedures };
        });
      }
      return;
    }

    lastInitPromptRef.current = prompt;
    formIsDirtyRef.current = false;

    const fallbackForm = createEmptyFormData();
    const parsed = prompt ? parsePromptMarkdown(prompt) : ({ ok: true, data: fallbackForm } as const);

    if (parsed.ok) {
      const crmAtivos = procedimentos.filter((p) => p.ativo);
      const existingProcs = parsed.data.procedures;
      const mergedProcedures =
        crmAtivos.length > 0
          ? crmAtivos.map((p) => {
              const existing = existingProcs.find((ep) => ep.name.toLowerCase().trim() === p.nome.toLowerCase().trim());
              return createProcedureItem({ name: p.nome, description: existing?.description ?? "" });
            })
          : existingProcs.length > 0
            ? existingProcs
            : [createProcedureItem()];
      const mergedData: AgentPromptFormData = {
        ...parsed.data,
        procedures: mergedProcedures,
        clinicName: parsed.data.clinicName || branding?.brand_name || "",
      };
      const normalizedPrompt = buildPromptMarkdown(mergedData);
      const cloned = cloneFormData(mergedData);
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
  }, [prompt, acumuloMensagens, isLoading, modeloIaBanco, JSON.stringify(horarioAtendimentoBanco), JSON.stringify(formasPagamentoBanco), contraindicacoesBanco, JSON.stringify(palavrasProibidasBanco), JSON.stringify(procedimentos), branding?.brand_name ?? ""]);

  const deferredForm = useDeferredValue(localForm);
  const currentPrompt = buildPromptMarkdown(deferredForm);
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

  const handleFieldChange = <K extends keyof AgentPromptFormData>(field: K, value: AgentPromptFormData[K]) => {
    formIsDirtyRef.current = true;
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setLocalForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleProcedureChange = (id: string, field: keyof Omit<ProcedureItem, "id">, value: string) => {
    formIsDirtyRef.current = true;
    setErrors((previous) => ({ ...previous, procedures: undefined }));
    setLocalForm((previous) => ({
      ...previous,
      procedures: previous.procedures.map((procedure) => (procedure.id === id ? { ...procedure, [field]: value } : procedure)),
    }));
  };

  const handleAddProcedure = () => {
    formIsDirtyRef.current = true;
    setErrors((previous) => ({ ...previous, procedures: undefined }));
    setLocalForm((previous) => ({ ...previous, procedures: [...previous.procedures, createProcedureItem()] }));
  };

  const handleRemoveProcedure = (id: string) => {
    formIsDirtyRef.current = true;
    setErrors((previous) => ({ ...previous, procedures: undefined }));
    setLocalForm((previous) => {
      const nextProcedures = previous.procedures.filter((procedure) => procedure.id !== id);
      return { ...previous, procedures: nextProcedures.length > 0 ? nextProcedures : [createProcedureItem()] };
    });
  };

  const handleFaqChange = (id: string, field: keyof Omit<FaqItem, "id">, value: string) => {
    setLocalForm((previous) => ({ ...previous, faqs: previous.faqs.map((faq) => (faq.id === id ? { ...faq, [field]: value } : faq)) }));
  };

  const handleAddFaq = () => {
    setLocalForm((previous) => ({ ...previous, faqs: [...previous.faqs, createFaqItem()] }));
  };

  const handleRemoveFaq = (id: string) => {
    setLocalForm((previous) => {
      const nextFaqs = previous.faqs.filter((faq) => faq.id !== id);
      return { ...previous, faqs: nextFaqs.length > 0 ? nextFaqs : [createFaqItem()] };
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

    savePrompt(
      currentPrompt,
      undefined,
      localAcumulo,
      {
        onSuccess: () => {
          formIsDirtyRef.current = false;
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
      },
      localModelo,
      localHorario as unknown as Record<string, unknown>,
      localFormas as unknown as Record<string, unknown>,
      localContraindicacoes,
      localPalavras,
    );
  };

  const handleRevert = () => {
    formIsDirtyRef.current = false;
    setLocalForm(cloneFormData(originalForm));
    setLocalAcumulo(originalAcumulo);
    setLocalModelo(originalModelo);
    setParseWarning(originalParseWarning);
    setRequiresReset(originalRequiresReset);
    setErrors({});
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
    toast.info("Formulário padrão restaurado. Agora você já pode preencher e salvar.");
  };

  const builderContent = (
    <AiBuilderStepper
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
      onHorarioChange={(v) => { formIsDirtyRef.current = true; setLocalHorario(v); }}
      onFormasChange={(v) => { formIsDirtyRef.current = true; setLocalFormas(v); }}
      crmProcedimentos={procedimentos.filter((p) => p.ativo)}
      onContraindicacoesChange={(v) => { formIsDirtyRef.current = true; setLocalContraindicacoes(v); }}
      onPalavrasProibidasChange={(v) => { formIsDirtyRef.current = true; setLocalPalavras(v); }}
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
    <div className="space-y-4">
      {/* Sub-abas + controles de salvar — sempre visíveis, independente da aba ativa */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div data-tutorial="ia-tabs" className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setSubTab("config")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              subTab === "config" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" /> Configurações
          </button>
          <button
            type="button"
            onClick={() => setSubTab("logs")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              subTab === "logs" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <Activity className="h-3.5 w-3.5" /> Logs
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && !hasChanges && (
            <span className="hidden items-center gap-1 text-[11px] font-display tabular-nums text-muted-foreground/60 md:flex mr-1">
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
            {isSaving ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>) : (<><Save className="h-3.5 w-3.5" /> Salvar</>)}
            {hasChanges && (
              <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
            )}
          </Button>
        </div>
      </div>

      {subTab === "logs" && <div data-tutorial="ia-logs"><AiExecutionLogsTab /></div>}

      {subTab === "config" && (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex h-60 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
              </div>
            ) : (
              builderContent
            )}
          </div>

          <div className="flex w-72 flex-shrink-0 flex-col gap-3 pb-4 pr-1">
            {/* Status da IA — flag organization_ai_prompts.ia_ativa, distinto do on/off do Console Athos */}
            <div data-tutorial="ia-status" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${iaAtiva ? "bg-emerald-50" : "bg-muted"}`}>
                    <Power className={`h-3.5 w-3.5 ${iaAtiva ? "text-emerald-600" : "text-muted-foreground"}`} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Motor de resposta</span>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                  iaAtiva ? "bg-emerald-50 text-emerald-600 border-emerald-200/60" : "bg-muted text-muted-foreground border-border/60"
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
                <Switch checked={iaAtiva} onCheckedChange={toggleIa} disabled={isTogglingIa || isLoading} id="toggle-ia" />
                <Label htmlFor="toggle-ia" className="cursor-pointer text-xs font-medium text-muted-foreground">
                  {iaAtiva ? "Desativar IA" : "Ativar IA"}
                </Label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
