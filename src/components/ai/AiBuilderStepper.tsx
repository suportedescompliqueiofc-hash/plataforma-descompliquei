import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type ProcedureItem = { id: string; name: string; description: string };
type FaqItem = { id: string; question: string; answer: string };
type FormErrors = {
  agentName?: string;
  clinicName?: string;
  procedures?: string;
  instagram?: string;
};
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
type CrmProcedure = { nome: string };

type AiBuilderStepperProps = {
  data: AgentPromptFormData;
  disabled: boolean;
  errors: FormErrors;
  warningMessage: string | null;
  previewMarkdown: string;
  previewOpen: boolean;
  horarioAtendimento: HorarioAtendimento;
  formasPagamento: FormasPagamento;
  contraindicacoes: string;
  palavrasProibidas: string[];
  crmProcedimentos: CrmProcedure[];
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
    field: "name" | "description",
    value: string,
  ) => void;
  onAddProcedure: () => void;
  onRemoveProcedure: (id: string) => void;
  onFaqChange: (
    id: string,
    field: "question" | "answer",
    value: string,
  ) => void;
  onAddFaq: () => void;
  onRemoveFaq: (id: string) => void;
  onResetToStructuredForm: () => void;
  onPreviewOpenChange: (open: boolean) => void;
};

const STEPS = [
  {
    key: "identidade",
    label: "Identidade",
    icon: User,
    title: "IDENTIDADE DA CLÍNICA",
    desc: "Informações básicas que a IA usará para se apresentar",
  },
  {
    key: "personalidade",
    label: "Personalidade",
    icon: MessageSquare,
    title: "PERSONALIDADE DO AGENTE",
    desc: "Como a IA fala, se comporta e interage com os leads",
  },
  {
    key: "conhecimento",
    label: "Conhecimento",
    icon: BookOpen,
    title: "CONHECIMENTO DA CLÍNICA",
    desc: "Procedimentos, perguntas frequentes e informações operacionais",
  },
  {
    key: "fluxo",
    label: "Fluxo",
    icon: Sparkles,
    title: "FLUXO DE ATENDIMENTO",
    desc: "Personalize como a IA conduz cada etapa da conversa",
  },
  {
    key: "ajustes",
    label: "Ajustes",
    icon: Wrench,
    title: "AJUSTES FINAIS",
    desc: "Instruções extras e palavras que a IA nunca deve usar",
  },
];

const IC =
  "h-10 text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/40 focus-visible:border-foreground/30 focus-visible:ring-foreground/10";
const TC =
  "text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/40 focus-visible:border-foreground/30 focus-visible:ring-foreground/10";

export function AiBuilderStepper({
  data,
  disabled,
  errors,
  warningMessage,
  previewMarkdown,
  previewOpen,
  horarioAtendimento,
  formasPagamento,
  contraindicacoes,
  palavrasProibidas,
  crmProcedimentos,
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
}: AiBuilderStepperProps) {
  const [step, setStep] = useState(0);
  const [palavraInput, setPalavraInput] = useState("");
  const [customQs, setCustomQs] = useState<boolean[]>(() => (data.customQuestions ?? []).map((q) => !!q));
  const [customGreeting, setCustomGreeting] = useState(() => !!data.customGreeting);
  const [customHandoff, setCustomHandoff] = useState(() => !!data.customHandoff);

  const DEFAULT_QUESTIONS = [
    { label: "O que incomoda", text: "Me conta, o que você quer melhorar?" },
    { label: "Há quanto tempo", text: "Há quanto tempo você está com essa situação?" },
    { label: "Resultado desejado", text: "Qual seria o resultado ideal pra você?" },
  ];
  const getQDefault = (i: number) =>
    DEFAULT_QUESTIONS[i] ?? { label: `Pergunta ${i + 1}`, text: "(defina o texto desta pergunta)" };

  const setQuestionCount = (n: number) => {
    const clamped = Math.max(1, Math.min(10, n));
    onFieldChange("diagnosticQuestions", clamped);
    const arr = [...(data.customQuestions ?? [])];
    while (arr.length < clamped) arr.push("");
    arr.length = clamped;
    onFieldChange("customQuestions", arr);
    setCustomQs((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push(false);
      next.length = clamped;
      return next;
    });
  };

  const updateQuestionAt = (i: number, value: string) => {
    const arr = [...(data.customQuestions ?? [])];
    while (arr.length <= i) arr.push("");
    arr[i] = value;
    onFieldChange("customQuestions", arr);
  };

  const toggleCustomQ = (i: number) => {
    setCustomQs((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push(false);
      next[i] = !next[i];
      if (!next[i]) updateQuestionAt(i, "");
      return next;
    });
  };
  const cur = STEPS[step];
  const StepIcon = cur.icon;

  return (
    <div className="space-y-4">
      {warningMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Prompt fora do padrão</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-700">{warningMessage}</p>
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

      {/* Stepper pills */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl overflow-x-auto">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            data-tutorial={`ia-subtab-${s.key}`}
            onClick={() => setStep(i)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              step === i
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Step content card */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" data-tutorial="ia-prompt">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <StepIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{cur.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cur.desc}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* ── Step 0: Identidade ── */}
          {step === 0 && (
            <div data-tutorial="ia-field-identity" className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Como seu agente vai se chamar?</Label>
                <Input id="agent-name" value={data.agentName} onChange={(e) => onFieldChange("agentName", e.target.value)} disabled={disabled} placeholder="Ex: Isa, Ana, Sofia..." className={`${IC} ${errors.agentName ? "border-destructive" : ""}`} />
                {errors.agentName && <p className="text-xs text-destructive">{errors.agentName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-name">Qual o nome da sua clínica?</Label>
                <Input id="clinic-name" value={data.clinicName} onChange={(e) => onFieldChange("clinicName", e.target.value)} disabled={disabled} className={`${IC} ${errors.clinicName ? "border-destructive" : ""}`} />
                {errors.clinicName && <p className="text-xs text-destructive">{errors.clinicName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="professional-name">Qual o nome do profissional responsável?</Label>
                <Input id="professional-name" value={data.professionalName} onChange={(e) => onFieldChange("professionalName", e.target.value)} disabled={disabled} className={IC} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Qual a especialidade da clínica?</Label>
                <Input id="specialty" value={data.specialty} onChange={(e) => onFieldChange("specialty", e.target.value)} disabled={disabled} className={IC} />
              </div>
            </div>
          )}

          {/* ── Step 1: Personalidade ── */}
          {step === 1 && (
            <>
              <div data-tutorial="ia-field-voice" className="space-y-2">
                <Label htmlFor="voice-tone">Tom de voz e personalidade do agente</Label>
                <p className="text-sm text-muted-foreground">Descreva como a IA deve se comunicar. Ex: "Acolhedora, empática, usa linguagem simples"</p>
                <Textarea id="voice-tone" value={data.voiceTone} onChange={(e) => onFieldChange("voiceTone", e.target.value)} className={`${TC} min-h-[100px] resize-y`} disabled={disabled} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="use-emojis">A IA deve usar emojis?</Label>
                  <Switch id="use-emojis" checked={data.useEmojis} onCheckedChange={(c) => onFieldChange("useEmojis", c === true)} disabled={disabled} />
                </div>
                {data.useEmojis && (
                  <div className="space-y-2">
                    <Label htmlFor="emojis" className="text-sm font-normal text-muted-foreground">Quais emojis a IA pode usar?</Label>
                    <Textarea id="emojis" value={data.emojis} onChange={(e) => onFieldChange("emojis", e.target.value)} className={`${TC} min-h-[80px] resize-y`} disabled={disabled} placeholder="Cole aqui os emojis permitidos" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="call-target">Quem a IA deve chamar no handoff?</Label>
                <Select value={data.callTarget} onValueChange={(v) => onFieldChange("callTarget", v as "equipe" | "secretaria" | "doutor")} disabled={disabled}>
                  <SelectTrigger id="call-target" className={IC}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipe">Equipe</SelectItem>
                    <SelectItem value="secretaria">Secretária</SelectItem>
                    <SelectItem value="doutor">Doutor(a)</SelectItem>
                  </SelectContent>
                </Select>
                {(data.callTarget === "secretaria" || data.callTarget === "doutor") && (
                  <div className="space-y-2">
                    <Label htmlFor="call-person-name" className="text-sm font-normal text-muted-foreground">Nome da {data.callTarget === "secretaria" ? "secretária" : "doutor(a)"}</Label>
                    <Input id="call-person-name" value={data.callPersonName} onChange={(e) => onFieldChange("callPersonName", e.target.value)} disabled={disabled} className={IC} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Step 2: Conhecimento ── */}
          {step === 2 && (
            <>
              {/* Procedimentos */}
              <div data-tutorial="ia-field-procedures" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Procedimentos da clínica</Label>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onAddProcedure} disabled={disabled}>
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {crmProcedimentos.length > 0 ? "Nomes importados automaticamente. Você pode adicionar extras." : "Cadastre os procedimentos na página de Procedimentos para sincronização automática."}
                </p>
                {data.procedures.every((p) => !p.name) ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed border-border/60">
                    <p className="text-sm text-muted-foreground">Nenhum procedimento cadastrado</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Acesse Procedimentos no menu lateral</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.procedures.map((proc, idx) => {
                      const isFromCrm = crmProcedimentos.some((p) => p.nome.toLowerCase().trim() === proc.name.toLowerCase().trim());
                      return (
                        <div key={proc.id} className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            {isFromCrm ? (
                              <span className="text-sm font-medium text-foreground">{proc.name}</span>
                            ) : (
                              <Input value={proc.name} onChange={(e) => onProcedureChange(proc.id, "name", e.target.value)} placeholder={`Procedimento ${idx + 1}`} disabled={disabled} className={`${IC} flex-1`} />
                            )}
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onRemoveProcedure(proc.id)} disabled={disabled || data.procedures.length === 1}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Textarea placeholder="Descrição para a IA (opcional)" value={proc.description} onChange={(e) => onProcedureChange(proc.id, "description", e.target.value)} className={`${TC} min-h-[70px] resize-y`} disabled={disabled} />
                        </div>
                      );
                    })}
                  </div>
                )}
                {errors.procedures && <p className="text-xs text-destructive">{errors.procedures}</p>}
              </div>

              {/* FAQ */}
              <div data-tutorial="ia-field-faq" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>FAQ da clínica</Label>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onAddFaq} disabled={disabled}>
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>
                <div className="space-y-3">
                  {data.faqs.map((faq, idx) => (
                    <div key={faq.id} className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">FAQ {idx + 1}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onRemoveFaq(faq.id)} disabled={disabled || data.faqs.length === 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <Input value={faq.question} onChange={(e) => onFaqChange(faq.id, "question", e.target.value)} disabled={disabled} placeholder="Pergunta" className={IC} />
                        <Textarea value={faq.answer} onChange={(e) => onFaqChange(faq.id, "answer", e.target.value)} className={`${TC} min-h-[80px] resize-y`} disabled={disabled} placeholder="Resposta" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contraindicações */}
              <div className="space-y-2">
                <Label htmlFor="contraindicacoes">Contraindicações</Label>
                <p className="text-sm text-muted-foreground">Situações em que a IA deve passar para a equipe humana.</p>
                <Textarea id="contraindicacoes" value={contraindicacoes} onChange={(e) => onContraindicacoesChange(e.target.value)} className={`${TC} min-h-[70px] resize-y`} disabled={disabled} placeholder="Ex: Gestantes, lactantes, menores sem responsável" />
              </div>

              {/* Instagram + Endereço */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Link do Instagram</Label>
                  <Input id="instagram" value={data.instagram} onChange={(e) => onFieldChange("instagram", e.target.value)} disabled={disabled} placeholder="https://instagram.com/..." className={`${IC} ${errors.instagram ? "border-destructive" : ""}`} />
                  {errors.instagram && <p className="text-xs text-destructive">{errors.instagram}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço da clínica</Label>
                  <Input id="address" value={data.address} onChange={(e) => onFieldChange("address", e.target.value)} disabled={disabled} className={IC} />
                </div>
              </div>

              {/* Horário */}
              <div data-tutorial="ia-field-horario" className="space-y-3">
                <div className="space-y-1">
                  <Label>Horário de atendimento humano</Label>
                  <p className="text-sm text-muted-foreground">A IA usa para informar quando a equipe estará disponível.</p>
                </div>
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm font-medium">Seg a Sex</span>
                    <Input type="time" value={horarioAtendimento.weekday_open} onChange={(e) => onHorarioChange({ ...horarioAtendimento, weekday_open: e.target.value })} disabled={disabled} className={`${IC} w-32`} />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input type="time" value={horarioAtendimento.weekday_close} onChange={(e) => onHorarioChange({ ...horarioAtendimento, weekday_close: e.target.value })} disabled={disabled} className={`${IC} w-32`} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm font-medium">Sábado</span>
                    <Switch checked={horarioAtendimento.saturday_closed} onCheckedChange={(c) => onHorarioChange({ ...horarioAtendimento, saturday_closed: c === true })} disabled={disabled} />
                    <span className="text-xs text-muted-foreground">Fechado</span>
                    {!horarioAtendimento.saturday_closed && (
                      <>
                        <Input type="time" value={horarioAtendimento.saturday_open} onChange={(e) => onHorarioChange({ ...horarioAtendimento, saturday_open: e.target.value })} disabled={disabled} className={`${IC} w-32`} />
                        <span className="text-xs text-muted-foreground">até</span>
                        <Input type="time" value={horarioAtendimento.saturday_close} onChange={(e) => onHorarioChange({ ...horarioAtendimento, saturday_close: e.target.value })} disabled={disabled} className={`${IC} w-32`} />
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm font-medium">Domingo</span>
                    <Switch checked={horarioAtendimento.sunday_closed} onCheckedChange={(c) => onHorarioChange({ ...horarioAtendimento, sunday_closed: c === true })} disabled={disabled} />
                    <span className="text-xs text-muted-foreground">Fechado</span>
                  </div>
                </div>
              </div>

              {/* Formas de Pagamento */}
              <div data-tutorial="ia-field-pagamento" className="space-y-3">
                <Label>Formas de pagamento</Label>
                <div className="flex flex-wrap items-center gap-4">
                  {(["pix", "dinheiro", "credito", "debito"] as const).map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox id={`pag-${key}`} checked={formasPagamento[key]} onCheckedChange={(c) => onFormasChange({ ...formasPagamento, [key]: c === true })} disabled={disabled} />
                      <Label htmlFor={`pag-${key}`} className="cursor-pointer text-sm font-normal">
                        {key === "pix" ? "Pix" : key === "dinheiro" ? "Dinheiro" : key === "credito" ? "Crédito" : "Débito"}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input value={formasPagamento.parcelamento} onChange={(e) => onFormasChange({ ...formasPagamento, parcelamento: e.target.value })} placeholder="Condições de parcelamento" disabled={disabled} className={IC} />
                  <Input value={formasPagamento.observacoes} onChange={(e) => onFormasChange({ ...formasPagamento, observacoes: e.target.value })} placeholder="Observações sobre pagamento" disabled={disabled} className={IC} />
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Fluxo de Atendimento ── */}
          {step === 3 && (
            <div data-tutorial="ia-field-fluxo">
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3">
                <p className="text-sm leading-relaxed text-amber-600/80">
                  A metodologia de atendimento (4 passos) já está configurada. Aqui você personaliza detalhes de cada etapa sem alterar o processo.
                </p>
              </div>

              {/* Passo 1 — Abertura */}
              <div className="rounded-2xl border border-border/60 bg-muted/[0.15] overflow-hidden">
                <div className="flex items-start gap-3 px-5 py-4 bg-background border-b border-border/60">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold tabular-nums">1</span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-foreground">Abertura</p>
                    <p className="text-sm text-muted-foreground mt-0.5">O lead chega e a IA dá boas-vindas, coletando o nome.</p>
                  </div>
                </div>
                <div className="p-5">
                <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">Mensagem de boas-vindas</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Padrão: <span className="italic">"Bom dia! Seja bem-vinda à [Clínica]. Me diz: qual é o seu nome?"</span></p>
                    </div>
                    <Button type="button" variant={customGreeting ? "secondary" : "outline"} size="sm" className="h-8 rounded-lg text-xs font-medium shrink-0 gap-1.5" onClick={() => { const next = !customGreeting; setCustomGreeting(next); if (!next) onFieldChange("customGreeting", ""); }} disabled={disabled}>
                      {customGreeting ? (<><X className="h-3.5 w-3.5" /> Voltar ao padrão</>) : (<><Sparkles className="h-3.5 w-3.5" /> Personalizar</>)}
                    </Button>
                  </div>
                  {customGreeting && (
                    <div className="px-4 pb-3 pt-2 border-t border-border/40">
                      <Textarea value={data.customGreeting} onChange={(e) => onFieldChange("customGreeting", e.target.value)} className={`${TC} min-h-[70px] resize-y`} disabled={disabled} placeholder="Digite sua mensagem de boas-vindas..." />
                    </div>
                  )}
                </div>
                </div>
              </div>

              {/* Passo 2 — Diagnóstico */}
              <div className="rounded-2xl border border-border/60 bg-muted/[0.15] overflow-hidden">
                <div className="flex items-start gap-3 px-5 py-4 bg-background border-b border-border/60">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold tabular-nums">2</span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-foreground">Diagnóstico</p>
                    <p className="text-sm text-muted-foreground mt-0.5">A IA entende a dor real do lead antes de apresentar qualquer solução.</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">

                <div className="space-y-2">
                  <Label>Quantas perguntas no diagnóstico?</Label>
                  <p className="text-sm text-muted-foreground">Recomendamos 3 perguntas para uma qualificação profunda. Você pode adicionar quantas precisar.</p>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background p-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setQuestionCount(data.diagnosticQuestions - 1)} disabled={disabled || data.diagnosticQuestions <= 1}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-10 text-center text-lg font-bold tabular-nums font-mono">{data.diagnosticQuestions}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setQuestionCount(data.diagnosticQuestions + 1)} disabled={disabled || data.diagnosticQuestions >= 10}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-sm text-muted-foreground">perguntas</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Perguntas do diagnóstico</Label>
                  <p className="text-sm text-muted-foreground">Cada pergunta já tem um texto padrão testado. Você pode mantê-lo ou escrever o seu.</p>
                  <div className="space-y-3 pt-1">
                    {Array.from({ length: data.diagnosticQuestions }, (_, i) => {
                      const def = getQDefault(i);
                      const isCustom = !!customQs[i];
                      return (
                        <div key={i} className="rounded-lg border border-border/60 bg-background overflow-hidden">
                          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/20">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">Pergunta {i + 1} — {def.label}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">Padrão: <span className="italic">"{def.text}"</span></p>
                            </div>
                            <Button type="button" variant={isCustom ? "secondary" : "outline"} size="sm" className="h-8 rounded-lg text-xs font-medium shrink-0 gap-1.5" onClick={() => toggleCustomQ(i)} disabled={disabled}>
                              {isCustom ? (<><X className="h-3.5 w-3.5" /> Voltar ao padrão</>) : (<><Sparkles className="h-3.5 w-3.5" /> Personalizar</>)}
                            </Button>
                          </div>
                          {isCustom && (
                            <div className="px-4 pb-3 pt-2 border-t border-border/40">
                              <Textarea value={data.customQuestions[i] ?? ""} onChange={(e) => updateQuestionAt(i, e.target.value)} className={`${TC} min-h-[60px] resize-y`} disabled={disabled} placeholder="Digite sua versão da pergunta..." />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>
              </div>

              {/* Passo 3 — Apresentação */}
              <div className="rounded-2xl border border-border/60 bg-muted/[0.15] overflow-hidden">
                <div className="flex items-start gap-3 px-5 py-4 bg-background border-b border-border/60">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold tabular-nums">3</span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-foreground">Apresentação</p>
                    <p className="text-sm text-muted-foreground mt-0.5">A IA apresenta a solução conectada à dor do lead.</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">

                <div className="space-y-2">
                  <Label>Tom da apresentação</Label>
                  <div className="flex gap-2">
                    {([
                      { value: "emocional" as const, label: "Emocional", desc: "Mais acolhedor e empático" },
                      { value: "equilibrado" as const, label: "Equilibrado", desc: "Empatia + objetividade (recomendado)" },
                      { value: "direto" as const, label: "Direto", desc: "Mais objetivo e profissional" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onFieldChange("presentationTone", opt.value)}
                        disabled={disabled}
                        className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-all ${
                          data.presentationTone === opt.value
                            ? "border-foreground/30 bg-foreground/[0.03]"
                            : "border-border/60 hover:border-foreground/20"
                        }`}
                      >
                        <p className="text-xs font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 bg-muted/20">
                  <div>
                    <p className="text-sm font-medium">Enviar Instagram como prova social</p>
                    <p className="text-sm text-muted-foreground">A IA envia o link do Instagram ao apresentar a solução.</p>
                  </div>
                  <Switch checked={data.sendInstagram} onCheckedChange={(c) => onFieldChange("sendInstagram", c === true)} disabled={disabled} />
                </div>
                </div>
              </div>

              {/* Passo 4 — Handoff */}
              <div className="rounded-2xl border border-border/60 bg-muted/[0.15] overflow-hidden">
                <div className="flex items-start gap-3 px-5 py-4 bg-background border-b border-border/60">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold tabular-nums">4</span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-semibold text-foreground">Handoff</p>
                    <p className="text-sm text-muted-foreground mt-0.5">A IA passa o atendimento para a equipe humana.</p>
                  </div>
                </div>
                <div className="p-5">
                <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">Frase de handoff</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Padrão: <span className="italic">"Que bom, [Nome]! A [equipe] já vai dar continuidade por aqui."</span></p>
                    </div>
                    <Button type="button" variant={customHandoff ? "secondary" : "outline"} size="sm" className="h-8 rounded-lg text-xs font-medium shrink-0 gap-1.5" onClick={() => { const next = !customHandoff; setCustomHandoff(next); if (!next) onFieldChange("customHandoff", ""); }} disabled={disabled}>
                      {customHandoff ? (<><X className="h-3.5 w-3.5" /> Voltar ao padrão</>) : (<><Sparkles className="h-3.5 w-3.5" /> Personalizar</>)}
                    </Button>
                  </div>
                  {customHandoff && (
                    <div className="px-4 pb-3 pt-2 border-t border-border/40">
                      <Textarea value={data.customHandoff} onChange={(e) => onFieldChange("customHandoff", e.target.value)} className={`${TC} min-h-[70px] resize-y`} disabled={disabled} placeholder="Digite sua frase de handoff..." />
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Ajustes ── */}
          {step === 4 && (
            <>
              <div data-tutorial="ia-field-instructions" className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="instructions">Instruções específicas para o agente</Label>
                  <p className="text-sm text-muted-foreground">Regras específicas da sua clínica. Não adicione regras gerais — já estão configuradas.</p>
                </div>
                <Textarea id="instructions" value={data.instructions} onChange={(e) => onFieldChange("instructions", e.target.value)} className={`${TC} min-h-[120px] resize-y`} disabled={disabled} />
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <Label>Palavras ou expressões proibidas</Label>
                  <p className="text-sm text-muted-foreground">Digite e pressione Enter para adicionar.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {palavrasProibidas.map((p, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1 pl-2.5 pr-1 py-1 text-xs">
                      {p}
                      <button type="button" onClick={() => onPalavrasProibidasChange(palavrasProibidas.filter((_, i) => i !== idx))} disabled={disabled} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20">
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
                      const t = palavraInput.trim();
                      if (t && !palavrasProibidas.includes(t)) onPalavrasProibidasChange([...palavrasProibidas, t]);
                      setPalavraInput("");
                    }
                  }}
                  placeholder="Ex: baratinho, desconto, amiga"
                  disabled={disabled}
                  className={IC}
                />
              </div>
            </>
          )}
        </div>

        {/* Navigation footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/40 bg-muted/20">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || disabled} className="h-8 rounded-lg text-sm font-medium border-border/60 gap-1.5 px-3">
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </Button>
          <span className="text-xs font-bold text-muted-foreground/40 tabular-nums">{step + 1} de {STEPS.length}</span>
          <Button variant="outline" onClick={() => setStep((s) => s + 1)} disabled={step === STEPS.length - 1 || disabled} className="h-8 rounded-lg text-sm font-medium border-border/60 gap-1.5 px-3">
            Próximo <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Preview markdown */}
      <Collapsible open={previewOpen} onOpenChange={onPreviewOpenChange}>
        <div className="rounded-lg border border-border bg-muted/10">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <span className="text-sm font-medium text-foreground">Ver como o agente vai receber essas informações</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${previewOpen ? "" : "-rotate-90"}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border px-4 py-3">
              <pre className="whitespace-pre-wrap break-words rounded-md bg-background p-4 font-mono text-xs leading-6 text-foreground">{previewMarkdown}</pre>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
