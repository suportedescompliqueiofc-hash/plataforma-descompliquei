import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Send, ChevronRight, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingDiagnostico } from "@/hooks/useOnboardingDiagnostico";
import { toast } from "sonner";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface MensagemUI {
  id: string;
  role: "user" | "athos";
  content: string;
  hidden?: boolean;         // diagnóstico inicial — não exibir como bubble user
}

interface HistoricoItem {
  role: "user" | "assistant";
  content: string;
  hidden?: boolean;
}

interface JornadaJSON {
  titulo: string;
  estagios: Array<{
    titulo: string;
    descricao: string;
    ordem: number;
    prazo_dias: number;
    passos: Array<{
      titulo: string;
      descricao: string;
      ordem: number;
      tipo: "acao_livre" | "ferramenta_arsenal";
      ferramenta_slug?: string | null;
      prazo_dias?: number;
      obrigatorio: boolean;
    }>;
  }>;
}

// ── SSE helper ─────────────────────────────────────────────────────────────────

async function callAthos(
  systemPrompt: string,
  message: string,
  history: HistoricoItem[],
  onDelta: (delta: string) => void
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/descompliquei-os`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        history: history.map(({ role, content }) => ({ role, content })),
        system_prompt_override: systemPrompt,
        model: "deepseek/deepseek-v4-pro",
      }),
    }
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error("Sem resposta");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === "text_delta" && data.delta) {
          fullText += data.delta;
          onDelta(data.delta);
        }
      } catch { /* ignore parse errors */ }
    }
  }

  return fullText;
}

// ── Extração de JSON da jornada ───────────────────────────────────────────────

function extrairJornada(text: string): JornadaJSON | null {
  // Bloco ```json ... ```
  const bloco = text.match(/```json\s*([\s\S]+?)\s*```/);
  if (bloco) {
    try {
      const j = JSON.parse(bloco[1]);
      if (j?.titulo && Array.isArray(j?.estagios)) return j;
    } catch { /* continue */ }
  }
  // JSON bruto com titulo + estagios
  const bruto = text.match(/\{\s*"titulo"\s*:[\s\S]*?"estagios"\s*:\s*\[[\s\S]*?\]\s*\}/);
  if (bruto) {
    try {
      const j = JSON.parse(bruto[0]);
      if (j?.titulo && Array.isArray(j?.estagios)) return j;
    } catch { /* continue */ }
  }
  return null;
}

// ── Salvar jornada no banco ───────────────────────────────────────────────────

async function salvarJornada(json: JornadaJSON, userId: string): Promise<boolean> {
  try {
    // 1. Buscar slugs de ferramentas para mapear slug → id
    const { data: ferramentas } = await (supabase as any)
      .from("arsenal_ferramentas")
      .select("id, slug")
      .eq("ativo", true);

    const slugMap = new Map<string, string>(
      (ferramentas ?? []).map((f: any) => [f.slug, f.id])
    );

    // 2. Inserir jornada
    const { data: jornada, error: errJ } = await (supabase as any)
      .from("jornadas")
      .insert({ user_id: userId, titulo: json.titulo, status: "ativa", gerada_por: "ia" })
      .select("id")
      .single();

    if (errJ || !jornada) return false;

    // 3. Inserir estágios + passos
    const hoje = new Date();
    let cursorDias = 0;

    for (const est of json.estagios) {
      const dataInicio = new Date(hoje);
      dataInicio.setDate(dataInicio.getDate() + cursorDias);
      cursorDias += (est.prazo_dias ?? 7) + 1;

      const { data: estagio, error: errE } = await (supabase as any)
        .from("jornada_estagios")
        .insert({
          jornada_id: jornada.id,
          titulo: est.titulo,
          descricao: est.descricao ?? null,
          ordem: est.ordem ?? 0,
          prazo_dias: est.prazo_dias ?? 7,
          data_inicio: dataInicio.toISOString().slice(0, 10),
        })
        .select("id")
        .single();

      if (errE || !estagio) continue;

      for (const passo of est.passos) {
        const ferramentaId =
          passo.tipo === "ferramenta_arsenal" && passo.ferramenta_slug
            ? (slugMap.get(passo.ferramenta_slug) ?? null)
            : null;

        await (supabase as any).from("jornada_passos").insert({
          estagio_id: estagio.id,
          titulo: passo.titulo,
          descricao: passo.descricao ?? null,
          ordem: passo.ordem ?? 0,
          tipo: passo.tipo ?? "acao_livre",
          ferramenta_id: ferramentaId,
          prazo_dias: passo.prazo_dias ?? null,
          obrigatorio: passo.obrigatorio ?? true,
        });
      }
    }

    return true;
  } catch {
    return false;
  }
}

// ── Salvar histórico de conversa ──────────────────────────────────────────────

async function salvarHistorico(userId: string, historico: HistoricoItem[]) {
  await (supabase as any)
    .from("onboarding_progresso")
    .upsert(
      { user_id: userId, historico_conversa: historico },
      { onConflict: "user_id" }
    );
}

// ── Componentes de UI ─────────────────────────────────────────────────────────

function AvatarAthos({ size = 7 }: { size?: number }) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-foreground flex items-center justify-center",
        size === 7 ? "w-7 h-7" : "w-6 h-6"
      )}
    >
      <span className="text-background text-[11px] font-bold">A</span>
    </div>
  );
}

function BubbleAthos({ content, streaming, loadingLabel }: { content: string; streaming?: boolean; loadingLabel?: string }) {
  const isEmpty = content === "" && streaming;
  return (
    <div className="flex gap-3 items-start">
      <AvatarAthos />
      <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-white border border-border/40 px-4 py-3 shadow-sm">
        {isEmpty ? (
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground/70 italic">{loadingLabel ?? "Pensando..."}</p>
            <div className="flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
            {content}
            {streaming && <span className="inline-block w-0.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-middle" />}
          </p>
        )}
      </div>
    </div>
  );
}

function BubbleUser({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-foreground px-4 py-3">
        <p className="text-[14px] text-background leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-3 items-start">
      <AvatarAthos />
      <div className="rounded-2xl rounded-tl-sm bg-white border border-border/40 px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function JornadaPronta({ nomeClinica, onClick, loading }: { nomeClinica: string; onClick: () => void; loading: boolean }) {
  return (
    <div className="flex gap-3 items-start">
      <AvatarAthos />
      <div className="max-w-[82%] space-y-3">
        <div className="rounded-2xl rounded-tl-sm bg-white border border-border/40 px-4 py-3 shadow-sm">
          <p className="text-[14px] text-foreground leading-relaxed">
            Sua jornada está pronta, <strong>{nomeClinica || "você"}</strong>. A partir de agora você sabe exatamente o que fazer, em qual ordem e em qual prazo. Estou aqui sempre que precisar.
          </p>
        </div>
        <button
          onClick={onClick}
          disabled={loading}
          className="flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-[13px] font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60"
        >
          {loading ? "Abrindo..." : "Ir para o Athos"}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ErroJornada() {
  return (
    <div className="flex gap-3 items-start">
      <AvatarAthos />
      <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-red-50 border border-red-200 px-4 py-3">
        <p className="text-[14px] text-red-700 leading-relaxed">
          Ocorreu um erro ao gerar sua jornada. Nossa equipe foi notificada e entrará em contato em breve.
        </p>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function OnboardingAthos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { respostas, concluirOnboarding, loading: diagLoading } = useOnboardingDiagnostico();

  const [mensagens, setMensagens] = useState<MensagemUI[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [input, setInput] = useState("");

  // Estado da sessão
  const [inicializando, setInicializando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [jornadaSalva, setJornadaSalva] = useState(false);
  const [erroJornada, setErroJornada] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [nomeClinica, setNomeClinica] = useState("");

  // Dados carregados
  const [systemPromptFinal, setSystemPromptFinal] = useState<string | null>(null);
  const tentativasJSON = useRef(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll automático
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando, inicializando]);

  // ── Inicialização ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (diagLoading || !user) return;
    inicializar();
  }, [diagLoading, user?.id]);

  const inicializar = async () => {
    if (!user) return;
    setInicializando(true);

    try {
      const [agentRes, diagnosticoRes, ferramentasRes, progressoRes] = await Promise.all([
        (supabase as any).from("athos_agentes").select("system_prompt").eq("slug", "onboarding").single(),
        (supabase as any).from("meus_materiais").select("conteudo, titulo").eq("user_id", user.id).ilike("titulo", "Diagnóstico Estratégico%").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from("arsenal_ferramentas").select("nome, slug").eq("ativo", true).order("ordem"),
        (supabase as any).from("onboarding_progresso").select("historico_conversa").eq("user_id", user.id).maybeSingle(),
      ]);

      const agentPrompt = agentRes.data?.system_prompt ?? "";
      const diagnosticoConteudo = diagnosticoRes.data?.conteudo ?? "";
      const ferramentas: Array<{ nome: string; slug: string }> = ferramentasRes.data ?? [];

      // Nome da clínica extraído das respostas ou do documento
      setNomeClinica(respostas?.p1 ?? "");

      // Compor system prompt final
      const ferramentasTexto = ferramentas.length > 0
        ? `\n\n---\n\nFERRAMENTAS DISPONÍVEIS NO ARSENAL (use os slugs ao montar a jornada):\n${ferramentas.map((f) => `- ${f.nome} (slug: ${f.slug})`).join("\n")}`
        : "";

      const diagnosticoTexto = diagnosticoConteudo
        ? `\n\n---\n\nDIAGNÓSTICO DO CLIENTE:\n${diagnosticoConteudo}`
        : "";

      const spFinal = agentPrompt + diagnosticoTexto + ferramentasTexto;
      setSystemPromptFinal(spFinal);

      // Restaurar histórico salvo
      const historicoSalvo: HistoricoItem[] = progressoRes.data?.historico_conversa ?? [];

      if (historicoSalvo.length > 0) {
        // Restaurar conversa
        setHistorico(historicoSalvo);
        const msgsRestauradas: MensagemUI[] = historicoSalvo
          .filter((h) => !h.hidden)
          .map((h) => ({
            id: crypto.randomUUID(),
            role: h.role === "assistant" ? "athos" : "user",
            content: h.content,
          }));
        setMensagens(msgsRestauradas);
        setInicializando(false);
      } else {
        // Conversa nova — enviar diagnóstico e aguardar abertura do Athos
        setInicializando(true);
        await enviarMensagemInterna(
          spFinal,
          diagnosticoConteudo
            ? `Aqui está o meu diagnóstico estratégico completo:\n\n${diagnosticoConteudo}`
            : "Olá, Athos. Pode começar a análise com base no que você já sabe sobre mim.",
          [],
          true // hidden — não exibir como bubble user
        );
        setInicializando(false);
      }
    } catch (err) {
      console.error("[OnboardingAthos] Erro na inicialização:", err);
      toast.error("Erro ao carregar o Athos. Recarregue a página.");
      setInicializando(false);
    }
  };

  // ── Envio de mensagem (interno + externo) ─────────────────────────────────────

  const enviarMensagemInterna = useCallback(async (
    sp: string,
    texto: string,
    historicoAtual: HistoricoItem[],
    hidden = false
  ) => {
    if (!user) return;

    // Adicionar mensagem do usuário ao histórico e UI (exceto se hidden)
    const novoHistorico: HistoricoItem[] = [
      ...historicoAtual,
      { role: "user", content: texto, hidden },
    ];

    if (!hidden) {
      setMensagens((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: texto }]);
    }

    // Criar bubble do Athos em streaming
    const athosId = crypto.randomUUID();
    setMensagens((prev) => [...prev, { id: athosId, role: "athos", content: "" }]);
    setStreamingId(athosId);

    let resposta = "";

    try {
      resposta = await callAthos(sp, texto, historicoAtual, (delta) => {
        setMensagens((prev) =>
          prev.map((m) => m.id === athosId ? { ...m, content: m.content + delta } : m)
        );
      });
    } catch {
      setMensagens((prev) => prev.filter((m) => m.id !== athosId));
      throw new Error("callAthos falhou");
    }

    setStreamingId(null);

    // Atualizar histórico com resposta
    const historicoFinal: HistoricoItem[] = [
      ...novoHistorico,
      { role: "assistant", content: resposta },
    ];
    setHistorico(historicoFinal);

    // Persistir histórico
    await salvarHistorico(user.id, historicoFinal);

    // Verificar se há JSON de jornada na resposta
    await verificarJSON(resposta, sp, historicoFinal);

    return resposta;
  }, [user?.id]);

  const enviar = async () => {
    const texto = input.trim();
    if (!texto || enviando || !systemPromptFinal || jornadaSalva) return;

    setInput("");
    setEnviando(true);

    try {
      await enviarMensagemInterna(systemPromptFinal, texto, historico);
    } catch {
      toast.error("Erro ao conectar com o Athos. Tente novamente.");
    }

    setEnviando(false);
  };

  // ── Detecção e salvamento de jornada ─────────────────────────────────────────

  const verificarJSON = async (
    texto: string,
    sp: string,
    historicoAtual: HistoricoItem[]
  ) => {
    if (jornadaSalva || erroJornada) return;

    const jornada = extrairJornada(texto);
    if (!jornada) return;

    // JSON encontrado — salvar
    tentativasJSON.current++;
    const ok = await salvarJornada(jornada, user!.id);

    if (ok) {
      setJornadaSalva(true);
      return;
    }

    // Falha — tentar novamente (só uma vez)
    if (tentativasJSON.current < 2) {
      try {
        await enviarMensagemInterna(
          sp,
          "Por favor, retorne novamente o JSON completo da jornada para que eu possa salvá-la.",
          historicoAtual
        );
      } catch { /* silencioso */ }
    } else {
      setErroJornada(true);
      console.error("[OnboardingAthos] Falha ao salvar jornada após 2 tentativas");
    }
  };

  // ── Conclusão ─────────────────────────────────────────────────────────────────

  const handleConcluir = async () => {
    if (!user) return;
    setConcluindo(true);
    try {
      await Promise.all([
        concluirOnboarding(),
        (supabase as any).from("onboarding_progresso").upsert(
          { user_id: user.id, etapa: "concluido" },
          { onConflict: "user_id" }
        ),
      ]);
      navigate("/plataforma/descompliquei-os", { replace: true });
    } catch {
      toast.error("Erro ao finalizar. Tente novamente.");
      setConcluindo(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const inputBloqueado = inicializando || enviando || jornadaSalva || erroJornada;

  return (
    <div className="fixed inset-0 bg-[#F2F1EE] flex flex-col z-50">

      {/* Header */}
      <header className="shrink-0 h-14 flex items-center justify-between px-6 border-b border-border/30 bg-[#F2F1EE]/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
            <span className="text-background text-[12px] font-bold">A</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-bold text-foreground leading-none">Athos GS</p>
              <span className="px-2 py-0.5 rounded-full bg-foreground/8 border border-border/50 text-[10px] font-semibold text-muted-foreground">
                Inteligência Descompliquei
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={cn(
                  "w-5 h-1 rounded-full transition-colors",
                  n <= 3 ? "bg-foreground" : "bg-border"
                )}
              />
            ))}
          </div>
          <span className="font-medium">Etapa 3 de 3 — Montando sua jornada</span>
        </div>
      </header>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 py-8 space-y-5">

          {/* Estado inicial — antes da primeira bolha ser criada */}
          {inicializando && mensagens.length === 0 && (
            <div className="flex gap-3 items-start">
              <AvatarAthos />
              <div className="rounded-2xl rounded-tl-sm bg-white border border-border/40 px-4 py-3 shadow-sm">
                <p className="text-[13px] text-muted-foreground/70 italic mb-2">Analisando seu diagnóstico...</p>
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mensagens */}
          {mensagens
            .filter((m) => !m.hidden)
            .map((m, idx) =>
              m.role === "athos" ? (
                <BubbleAthos
                  key={m.id}
                  content={m.content}
                  streaming={streamingId === m.id}
                  loadingLabel={idx === 0 ? "Analisando seu diagnóstico..." : "Pensando..."}
                />
              ) : (
                <BubbleUser key={m.id} content={m.content} />
              )
            )}

          {/* Typing indicator enquanto aguarda resposta (após user enviar) */}
          {enviando && !streamingId && <TypingDots />}

          {/* Jornada pronta */}
          {jornadaSalva && !erroJornada && (
            <JornadaPronta
              nomeClinica={nomeClinica}
              onClick={handleConcluir}
              loading={concluindo}
            />
          )}

          {/* Erro na jornada */}
          {erroJornada && <ErroJornada />}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/30 bg-[#F2F1EE]/95 backdrop-blur-sm px-5 py-4">
        <div className="max-w-2xl mx-auto">
          <div
            className={cn(
              "flex gap-3 items-end rounded-2xl border bg-white px-4 py-3 shadow-sm transition-all",
              inputBloqueado
                ? "border-border/30 opacity-60"
                : "border-border/60 focus-within:ring-1 focus-within:ring-foreground/20 focus-within:border-foreground/40"
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                jornadaSalva
                  ? "Jornada gerada — clique em 'Ver minha jornada' acima"
                  : inicializando
                  ? "Aguarde, Athos está analisando..."
                  : "Responda ao Athos..."
              }
              rows={1}
              disabled={inputBloqueado}
              className="flex-1 resize-none text-[14px] text-foreground placeholder:text-muted-foreground/40 bg-transparent focus:outline-none leading-relaxed max-h-32 overflow-y-auto disabled:cursor-not-allowed"
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
              }}
            />
            <button
              onClick={enviar}
              disabled={inputBloqueado || !input.trim()}
              className={cn(
                "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                !inputBloqueado && input.trim()
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>

          {!jornadaSalva && !erroJornada && (
            <p className="text-center text-[11px] text-muted-foreground/40 mt-2">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
