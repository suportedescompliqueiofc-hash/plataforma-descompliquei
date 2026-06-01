import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PlayCircle, ArrowLeft } from "lucide-react";

type PillarView = {
  num: number;
  title: string;
  badgeText: string;
  badgeColor: string;
};

export default function Pilar() {
  const { pilarId } = useParams();
  const navigate = useNavigate();
  const { progress, acesso } = usePlataforma();

  const [modules, setModules] = useState<any[]>([]);
  const [allModules, setAllModules] = useState<{ id: string; pillar: number }[]>([]);
  const [progressDetails, setProgressDetails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pilaresDB, setPilaresDB] = useState<{ id: string; ordem_index: number }[]>([]);

  // Pilares liberados pelo admin, ordenados
  const pilaresLiberadosOrdenados = useMemo(() => {
    if (!acesso.pilares_liberados?.length) return [];
    return pilaresDB
      .filter(p => acesso.pilares_liberados.includes(p.id))
      .map(p => p.ordem_index)
      .sort((a, b) => a - b);
  }, [acesso.pilares_liberados, pilaresDB]);

  const pilaresLiberadosNums = useMemo(
    () => new Set(pilaresLiberadosOrdenados),
    [pilaresLiberadosOrdenados]
  );

  // Contagem de módulos e concluídos por pilar (para checar conclusão sequencial)
  const moduleCountByPillar = useMemo(() => {
    return allModules.reduce<Record<number, number>>((acc, m) => {
      acc[m.pillar] = (acc[m.pillar] || 0) + 1;
      return acc;
    }, {});
  }, [allModules]);

  const completedByPillar = useMemo(() => {
    return allModules.reduce<Record<number, number>>((acc, m) => {
      if (progress.some(p => p.module_id === m.id && p.completed)) {
        acc[m.pillar] = (acc[m.pillar] || 0) + 1;
      }
      return acc;
    }, {});
  }, [allModules, progress]);

  const isPilarCompleted = (num: number) => {
    const total = moduleCountByPillar[num] || 0;
    return total > 0 && (completedByPillar[num] || 0) >= total;
  };

  // Pilares sequencialmente acessíveis
  const pilaresAcessiveis = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < pilaresLiberadosOrdenados.length; i++) {
      const num = pilaresLiberadosOrdenados[i];
      if (i === 0) { set.add(num); }
      else if (isPilarCompleted(pilaresLiberadosOrdenados[i - 1])) { set.add(num); }
      else break;
    }
    return set;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilaresLiberadosOrdenados, completedByPillar, moduleCountByPillar]);

  const pilaresData: PillarView[] = [
    {
      num: 1,
      title: "FUNDAÇÃO CLÍNICA",
      badgeText: "Liberado",
      badgeColor: "bg-emerald-500/10 text-emerald-500 border-transparent",
    },
    {
      num: 2,
      title: "MOTOR DE DEMANDA",
      badgeText: "Liberado",
      badgeColor: "bg-emerald-500/10 text-emerald-500 border-transparent",
    },
    {
      num: 3,
      title: "MOTOR COMERCIAL",
      badgeText: "Liberado",
      badgeColor: "bg-emerald-500/10 text-emerald-500 border-transparent",
    },
  ];

  const pilar = pilaresData.find((item) => item.num === Number(pilarId));

  useEffect(() => {
    async function load() {
      const [{ data: pils }, { data: allMods }] = await Promise.all([
        supabase.from("platform_pilares").select("id, ordem_index").order("ordem_index", { ascending: true }),
        supabase.from("platform_modules").select("id, pillar").eq("active", true),
      ]);

      if (pils) setPilaresDB(pils as any);
      if (allMods) setAllModules(allMods.map(m => ({ id: m.id, pillar: Number(m.pillar) })));

      if (!pilar) {
        setIsLoading(false);
        return;
      }

      const [{ data: mods }, { data: details }] = await Promise.all([
        supabase.from("platform_modules").select("*").eq("active", true).eq("pillar", pilar.num).order("order_index", { ascending: true }),
        supabase.from("platform_module_progress_detail").select("*"),
      ]);

      if (mods) setModules(mods);
      if (details) setProgressDetails(details);

      setIsLoading(false);
    }

    void load();
  }, [pilar]);

  // Redirect se pilar não está admin-liberado ou não está sequencialmente acessível
  useEffect(() => {
    if (!isLoading && pilaresDB.length > 0 && allModules.length > 0 && pilar) {
      const adminLiberado = pilaresLiberadosNums.has(pilar.num);
      const sequencialmenteAcessivel = pilaresAcessiveis.has(pilar.num);
      if (!adminLiberado || !sequencialmenteAcessivel) {
        navigate("/plataforma/trilha", { replace: true });
      }
    }
  }, [isLoading, pilaresDB, allModules, pilar, pilaresLiberadosNums, pilaresAcessiveis, navigate]);

  const completedModules = useMemo(() => {
    return modules.filter((module) => progress.some((item) => item.module_id === module.id && item.completed)).length;
  }, [modules, progress]);

  const pillarProgressPercent = modules.length > 0 ? Math.round((completedModules / modules.length) * 100) : 0;

  if (!pilar) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold font-display">Pilar não encontrado</h1>
        <Button onClick={() => navigate("/plataforma/trilha")} variant="outline">
          Voltar para a Trilha
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <Button
        variant="ghost"
        onClick={() => navigate("/plataforma/trilha")}
        className="text-muted-foreground hover:text-foreground mb-4 pl-0"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para a Trilha
      </Button>

      <div className="space-y-4 border-b border-border pb-6">
        <div className="flex items-center gap-3 mb-2">
          <Badge variant="outline" className={pilar.badgeColor}>
            {pilar.badgeText}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground font-display">
          {pilar.title}
        </h1>
        <p className="text-muted-foreground text-lg">
          {modules.length} {modules.length === 1 ? "módulo" : "módulos"}
        </p>

        {modules.length > 0 && (
          <div className="mt-8 space-y-2 pt-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground font-medium">
              <span>Progresso do Pilar: {pillarProgressPercent}% concluído</span>
              <span>
                {completedModules} de {modules.length} módulos
              </span>
            </div>
            <Progress value={pillarProgressPercent} className="h-2 bg-muted" />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground font-display">Módulos</h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-card">
            {modules.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum módulo encontrado neste pilar.</div>
            ) : (
              modules.map((mod) => {
                const isCompleted = progress.some((item) => item.module_id === mod.id && item.completed);
                const completedSteps = progressDetails.filter((detail) => detail.module_id === mod.id).length;
                const moduleProgressPercent = isCompleted ? 100 : Math.round((completedSteps / 4) * 100);
                const isInProgress = !isCompleted && completedSteps > 0;

                return (
                  <div
                    key={mod.id}
                    onClick={() => navigate(`/plataforma/trilha/${mod.id}`)}
                    className="flex items-center justify-between p-5 border-b border-border last:border-0 transition-colors cursor-pointer group hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-4">
                      {isCompleted ? (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                      ) : isInProgress ? (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E85D24]/10">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#E85D24] animate-pulse" />
                        </div>
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted group-hover:bg-[#E85D24]/10 transition-colors">
                          <PlayCircle className="w-4 h-4 text-muted-foreground group-hover:text-[#E85D24] transition-colors" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium transition-colors text-foreground group-hover:text-foreground">
                          <span className="text-muted-foreground mr-2 text-xs font-mono">{mod.id}</span>
                          {mod.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{mod.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      <div className="flex flex-col items-end gap-1.5 w-16">
                        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{moduleProgressPercent}%</span>
                        <Progress value={moduleProgressPercent} className="h-1 w-full bg-muted" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
