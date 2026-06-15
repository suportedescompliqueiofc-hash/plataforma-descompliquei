import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { upsertDiagnostico } from "@/hooks/useMeusMateriais";

export type Respostas = Record<string, any>;
export type EtapaOnboarding = "diagnostico" | "documento" | "athos" | "concluido";

export function useOnboardingDiagnostico() {
  const { user } = useAuth();
  const [respostas, setRespostasState] = useState<Respostas>({});
  const [blocoAtual, setBlocoAtualState] = useState(0);
  const [etapa, setEtapa] = useState<EtapaOnboarding>("diagnostico");
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [diagRes, progRes] = await Promise.all([
        supabase
          .from("onboarding_diagnosticos" as any)
          .select("respostas, concluido")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("onboarding_progresso" as any)
          .select("bloco_atual, etapa")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if ((diagRes.data as any)?.respostas) {
        setRespostasState((diagRes.data as any).respostas as Respostas);
      }
      if (progRes.data) {
        setBlocoAtualState((progRes.data as any).bloco_atual ?? 0);
        setEtapa(((progRes.data as any).etapa ?? "diagnostico") as EtapaOnboarding);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const saveRespostas = useCallback(
    (next: Respostas) => {
      if (!user) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await supabase.from("onboarding_diagnosticos" as any).upsert(
          { user_id: user.id, respostas: next },
          { onConflict: "user_id" }
        );
      }, 800);
    },
    [user?.id]
  );

  const setResposta = useCallback(
    (key: string, value: any) => {
      setRespostasState((prev) => {
        const next = { ...prev, [key]: value };
        saveRespostas(next);
        return next;
      });
    },
    [saveRespostas]
  );

  const setBlocoAtual = useCallback(
    async (bloco: number) => {
      setBlocoAtualState(bloco);
      if (!user) return;
      await supabase.from("onboarding_progresso" as any).upsert(
        { user_id: user.id, bloco_atual: bloco, etapa: "diagnostico" },
        { onConflict: "user_id" }
      );
    },
    [user?.id]
  );

  const marcarIniciado = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("platform_users" as any)
      .update({ onboarding_iniciado_em: new Date().toISOString() })
      .eq("id", user.id);
  }, [user?.id]);

  const salvarDocumento = useCallback(
    async (markdown: string, nomeClinica: string) => {
      if (!user) return;
      const titulo = `Diagnóstico Estratégico — ${nomeClinica || "Minha Clínica"}`;
      await upsertDiagnostico({ userId: user.id, titulo, conteudo: markdown });
    },
    [user?.id]
  );

  const concluirDiagnostico = useCallback(async () => {
    if (!user) return;
    await Promise.all([
      supabase.from("onboarding_diagnosticos" as any).upsert(
        {
          user_id: user.id,
          respostas,
          concluido: true,
          concluido_em: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      ),
      supabase.from("onboarding_progresso" as any).upsert(
        { user_id: user.id, bloco_atual: 8, etapa: "athos" },
        { onConflict: "user_id" }
      ),
    ]);
    setEtapa("athos");
  }, [user?.id, respostas]);

  const concluirOnboarding = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("platform_users" as any)
      .update({
        onboarding_concluido: true,
        onboarding_concluido_em: new Date().toISOString(),
      })
      .eq("id", user.id);
  }, [user?.id]);

  return {
    respostas,
    setResposta,
    blocoAtual,
    setBlocoAtual,
    etapa,
    loading,
    marcarIniciado,
    salvarDocumento,
    concluirDiagnostico,
    concluirOnboarding,
  };
}
