import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Lock, BookOpen, FolderOpen } from "lucide-react";
import { SemAcesso } from "@/components/SemAcesso";
import MateriaisComplementares from "@/components/plataforma/MateriaisComplementares";

type PillarCard = {
  num: number;
  title: string;
};

export default function Trilha() {
  const { completedModules, acesso, progress } = usePlataforma();
  const navigate = useNavigate();
  const [modules, setModules] = useState<any[]>([]);
  const [pilaresDB, setPilaresDB] = useState<{ id: string; ordem_index: number }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"aula" | "materiais">("aula");

  const temTrilha = (acesso.pilares_liberados?.length ?? 0) > 0;

  useEffect(() => {
    async function load() {
      const [{ data: mods }, { data: pils }] = await Promise.all([
        supabase
          .from("platform_modules")
          .select("*")
          .eq("active", true)
          .order("order_index", { ascending: true }),
        supabase
          .from("platform_pilares")
          .select("id, ordem_index")
          .order("ordem_index", { ascending: true }),
      ]);

      if (mods) setModules(mods);
      if (pils) setPilaresDB(pils as any);

      setIsLoading(false);
    }

    void load();
  }, []);

  // Mapear UUIDs liberados → números de pilar (ordem_index), ordenados
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

  const moduleCountByPillar = useMemo(() => {
    return modules.reduce<Record<number, number>>((acc, mod) => {
      const n = Number(mod.pillar);
      if (Number.isFinite(n)) acc[n] = (acc[n] || 0) + 1;
      return acc;
    }, {});
  }, [modules]);

  // IDs de módulos concluídos por número de pilar
  const completedModulesByPillar = useMemo(() => {
    const map: Record<number, number> = {};
    for (const mod of modules) {
      const n = Number(mod.pillar);
      if (!Number.isFinite(n)) continue;
      const done = progress.some(p => p.module_id === mod.id && p.completed);
      if (done) map[n] = (map[n] || 0) + 1;
    }
    return map;
  }, [modules, progress]);

  // Um pilar está completo quando todos os seus módulos foram concluídos
  const isPilarCompleted = (num: number) => {
    const total = moduleCountByPillar[num] || 0;
    const completed = completedModulesByPillar[num] || 0;
    return total > 0 && completed >= total;
  };

  // Determina quais pilares são sequencialmente acessíveis
  const pilaresAcessiveis = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < pilaresLiberadosOrdenados.length; i++) {
      const num = pilaresLiberadosOrdenados[i];
      if (i === 0) {
        set.add(num); // primeiro pilar sempre acessível
      } else {
        const prev = pilaresLiberadosOrdenados[i - 1];
        if (isPilarCompleted(prev)) set.add(num);
        else break; // encadeia: se um trava, todos os seguintes também travam
      }
    }
    return set;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilaresLiberadosOrdenados, completedModulesByPillar, moduleCountByPillar]);

  const totalUnlockedModules = useMemo(() => {
    let total = 0;
    pilaresLiberadosNums.forEach(num => { total += moduleCountByPillar[num] || 0; });
    return total;
  }, [pilaresLiberadosNums, moduleCountByPillar]);

  const unlockedProgressPercent = totalUnlockedModules > 0
    ? Math.round((completedModules / totalUnlockedModules) * 100)
    : 0;

  if (!temTrilha) return <SemAcesso />;

  const pilares: PillarCard[] = [
    { num: 1, title: "FUNDAÇÃO CLÍNICA" },
    { num: 2, title: "MOTOR DE DEMANDA" },
    { num: 3, title: "MOTOR COMERCIAL" },
  ];

  const pilaresVisiveis = pilares.filter(p => pilaresLiberadosNums.has(p.num));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-4 border-b border-border pb-6" data-tutorial="trilha-header">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground font-display">
          Trilha de Aprendizado
        </h1>
        {activeTab === "aula" && (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground font-medium">
              <span>Progresso da Trilha: {unlockedProgressPercent}% concluído</span>
              <span>{completedModules} módulos concluídos de {totalUnlockedModules}</span>
            </div>
            <Progress value={unlockedProgressPercent} className="h-2 bg-muted" />
          </>
        )}
      </div>

      {/* Tab pills */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("aula")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "aula"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Aula
        </button>
        <button
          onClick={() => setActiveTab("materiais")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "materiais"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Materiais Complementares
        </button>
      </div>

      {/* Aula tab */}
      {activeTab === "aula" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            pilaresVisiveis.map((pilar) => {
              const moduleCount = moduleCountByPillar[pilar.num] || 0;
              const acessivel = pilaresAcessiveis.has(pilar.num);
              const concluido = isPilarCompleted(pilar.num);

              return (
                <div
                  key={pilar.num}
                  className={`border rounded-xl bg-card overflow-hidden shadow-card transition-all ${
                    acessivel
                      ? "border-border hover:shadow-md group"
                      : "border-border opacity-50"
                  }`}
                >
                  <div
                    onClick={() => acessivel && navigate(`/plataforma/trilha/pilar/${pilar.num}`)}
                    className={`p-5 md:p-6 flex items-center justify-between transition-colors ${
                      acessivel ? "cursor-pointer hover:bg-muted/30" : "cursor-not-allowed"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h2 className={`text-base font-semibold tracking-wide uppercase transition-colors text-foreground font-display ${acessivel ? "group-hover:text-[#E85D24]" : ""}`}>
                          {pilar.title}
                        </h2>
                        {concluido ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[11px]">
                            Concluído
                          </Badge>
                        ) : acessivel ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[11px]">
                            Liberado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-transparent text-[11px]">
                            <Lock className="w-3 h-3 mr-1" />
                            Bloqueado
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {acessivel
                          ? `${moduleCount} ${moduleCount === 1 ? "módulo" : "módulos"}`
                          : "Conclua o pilar anterior para desbloquear"}
                      </p>
                    </div>
                    {acessivel
                      ? <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-[#E85D24] transition-colors" />
                      : <Lock className="w-5 h-5 text-muted-foreground" />
                    }
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Materiais Complementares tab */}
      {activeTab === "materiais" && <MateriaisComplementares />}
    </div>
  );
}
