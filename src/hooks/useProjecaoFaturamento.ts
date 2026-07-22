import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { useAgendamentos } from "./useAgendamentos";
import { useProcedimentos } from "./useProcedimentos";
import {
  JANELA_TAXAS_DIAS,
  MINIMO_PARA_PONDERAR,
  STATUS_COMPARECEU,
  STATUS_EM_ABERTO,
  STATUS_NAO_COMPARECEU,
  isProcedimentoDeInteresse,
} from "@/lib/agendamentos";

/**
 * Projeção de faturamento a partir dos agendamentos ainda não realizados.
 *
 * Decisão de produto (2026-07-20): **todo número aqui é projeção, nunca receita confirmada** —
 * nem um procedimento agendado é garantido. Por isso os dois blocos são ponderados pelas
 * taxas históricas reais da própria clínica, e o valor bruto é exposto ao lado como teto.
 *
 * Regra de valor:
 * - `tipo = 'procedimento'` → o serviço agendado É o procedimento: `valor_orcado` manda,
 *   com `procedimentos.valor_base` como fallback.
 * - `tipo = 'consulta' | 'avaliacao'` → o procedimento é apenas *interesse*: o valor vem
 *   SEMPRE do catálogo, porque `valor_orcado` ali é o valor da consulta, não do procedimento.
 */

export interface BlocoProjecao {
  /** Soma sem ponderar — o teto, se tudo acontecesse e todo mundo fechasse. */
  bruto: number;
  /** Soma ponderada pelas taxas reais — o número que a tela destaca. */
  ponderado: number;
  /** Quantos agendamentos entraram na conta. */
  quantidade: number;
  /** Taxas aplicadas, para exibir a memória de cálculo. */
  taxas: { label: string; valor: number }[];
}

export interface ProjecaoFaturamento {
  procedimentos: BlocoProjecao;
  consultas: BlocoProjecao;
  totalPonderado: number;
  totalBruto: number;
  /** Meta de receita do mês, quando houver meta ativa. */
  metaReceita: number | null;
  /** Receita JÁ fechada no mês corrente (vendas). Não é projeção — é dinheiro feito. */
  receitaRealizada: number;
  /** Quanto falta para bater a meta: meta − já faturado − projeção ponderada. */
  gap: number | null;
  /** Agendamentos em aberto que ficaram sem valor — não entraram na projeção. */
  semValor: number;
  /** Agendamentos em aberto com data já vencida (equipe não atualizou o status). */
  vencidosEmAberto: number;
  /** `false` quando não há histórico suficiente: a tela mostra bruto e avisa. */
  podePonderar: boolean;
  isLoading: boolean;
}

export function useProjecaoFaturamento(): ProjecaoFaturamento {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const { agendamentos, isLoading: loadingAgs } = useAgendamentos();
  const { procedimentos } = useProcedimentos();

  // Vendas da janela, para a taxa consulta → venda.
  const { data: vendasLeadIds = [], isLoading: loadingVendas } = useQuery({
    queryKey: ["projecao-vendas-lead-ids", orgId],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - JANELA_TAXAS_DIAS);
      const { data, error } = await supabase
        .from("vendas")
        .select("lead_id")
        .eq("organization_id", orgId!)
        .gte("criado_em", desde.toISOString())
        .not("lead_id", "is", null);
      if (error) throw error;
      return (data || []).map((v: any) => v.lead_id as string);
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Receita já fechada no mês corrente — o gap da meta precisa descontar isso, senão a
  // tela pede à clínica um faturamento que ela já fez.
  const { data: receitaRealizada = 0, isLoading: loadingRealizada } = useQuery({
    queryKey: ["projecao-receita-realizada", orgId],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("vendas")
        .select("valor_fechado")
        .eq("organization_id", orgId!)
        .gte("criado_em", inicioMes.toISOString());
      if (error) throw error;
      return (data || []).reduce((s: number, v: any) => s + Number(v.valor_fechado || 0), 0);
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Meta de receita vigente no mês corrente.
  const { data: metaReceita = null, isLoading: loadingMeta } = useQuery({
    queryKey: ["projecao-meta-receita", orgId],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("metas")
        .select("meta_receita")
        .eq("organization_id", orgId!)
        .eq("ativo", true)
        .lte("data_inicio", hoje)
        .gte("data_fim", hoje)
        .order("data_inicio", { ascending: false })
        .limit(1);
      if (error) throw error;
      const m = data?.[0]?.meta_receita;
      return m != null ? Number(m) : null;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const isLoading = loadingAgs || loadingVendas || loadingMeta || loadingRealizada;

    const valorBasePorId = new Map<string, number | null>(
      procedimentos.map((p: any) => [p.id, p.valor_base != null ? Number(p.valor_base) : null])
    );

    const agora = new Date();
    const fimDoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
    const inicioJanela = new Date();
    inicioJanela.setDate(inicioJanela.getDate() - JANELA_TAXAS_DIAS);

    const emAberto = (s: string) => STATUS_EM_ABERTO.includes(s as any);
    const compareceu = (s: string) => STATUS_COMPARECEU.includes(s as any);
    const naoCompareceu = (s: string) => STATUS_NAO_COMPARECEU.includes(s as any);

    /** Taxa de comparecimento por família de tipo, na janela histórica. */
    function taxaComparecimento(tipos: string[]) {
      const terminais = agendamentos.filter((a) => {
        const d = new Date(a.data_hora_inicio);
        return tipos.includes(a.tipo)
          && d >= inicioJanela && d <= agora
          && (compareceu(a.status) || naoCompareceu(a.status));
      });
      const realizados = terminais.filter((a) => compareceu(a.status)).length;
      return { taxa: terminais.length ? realizados / terminais.length : 0, base: terminais.length };
    }

    const compProc = taxaComparecimento(["procedimento"]);
    const compConsulta = taxaComparecimento(["consulta", "avaliacao"]);

    // Taxa consulta realizada → venda, por lead distinto.
    const leadsComConsulta = new Set(
      agendamentos
        .filter((a) => {
          const d = new Date(a.data_hora_inicio);
          return ["consulta", "avaliacao"].includes(a.tipo)
            && compareceu(a.status) && d >= inicioJanela && d <= agora && a.lead_id;
        })
        .map((a) => a.lead_id as string)
    );
    const setVendas = new Set(vendasLeadIds);
    const leadsQueFecharam = [...leadsComConsulta].filter((id) => setVendas.has(id)).length;
    const txConversao = leadsComConsulta.size ? leadsQueFecharam / leadsComConsulta.size : 0;

    const podePonderar =
      compProc.base >= MINIMO_PARA_PONDERAR || compConsulta.base >= MINIMO_PARA_PONDERAR;

    // Agendamentos que ainda vão acontecer neste mês.
    const futuros = agendamentos.filter((a) => {
      const d = new Date(a.data_hora_inicio);
      return emAberto(a.status) && d >= agora && d <= fimDoMes;
    });

    const vencidosEmAberto = agendamentos.filter((a) => {
      const d = new Date(a.data_hora_inicio);
      return emAberto(a.status) && d < agora && d >= inicioJanela;
    }).length;

    let semValor = 0;

    /** Valor projetado de um agendamento, conforme a regra de precedência do tipo. */
    function valorDe(a: any): number | null {
      const doCatalogo = a.procedimento_id ? valorBasePorId.get(a.procedimento_id) ?? null : null;
      if (isProcedimentoDeInteresse(a.tipo)) {
        // Consulta: só o catálogo — `valor_orcado` aqui é o valor da consulta.
        return doCatalogo;
      }
      const v = a.valor_orcado != null ? Number(a.valor_orcado) : null;
      return v ?? doCatalogo;
    }

    const agsProc = futuros.filter((a) => a.tipo === "procedimento");
    const agsConsulta = futuros.filter(
      (a) => isProcedimentoDeInteresse(a.tipo) && a.procedimento_id
    );

    function somar(lista: any[]) {
      let total = 0;
      let qtd = 0;
      for (const a of lista) {
        const v = valorDe(a);
        if (v == null || v <= 0) {
          semValor++;
          continue;
        }
        total += v;
        qtd++;
      }
      return { total, qtd };
    }

    const somaProc = somar(agsProc);
    const somaConsulta = somar(agsConsulta);

    const fatorProc = podePonderar ? compProc.taxa : 1;
    const fatorConsulta = podePonderar ? compConsulta.taxa * txConversao : 1;

    const blocoProcedimentos: BlocoProjecao = {
      bruto: somaProc.total,
      ponderado: somaProc.total * fatorProc,
      quantidade: somaProc.qtd,
      taxas: podePonderar ? [{ label: "comparecimento", valor: compProc.taxa }] : [],
    };

    const blocoConsultas: BlocoProjecao = {
      bruto: somaConsulta.total,
      ponderado: somaConsulta.total * fatorConsulta,
      quantidade: somaConsulta.qtd,
      taxas: podePonderar
        ? [
            { label: "comparecimento", valor: compConsulta.taxa },
            { label: "conversão", valor: txConversao },
          ]
        : [],
    };

    const totalPonderado = blocoProcedimentos.ponderado + blocoConsultas.ponderado;
    const totalBruto = blocoProcedimentos.bruto + blocoConsultas.bruto;

    return {
      procedimentos: blocoProcedimentos,
      consultas: blocoConsultas,
      totalPonderado,
      totalBruto,
      metaReceita,
      receitaRealizada,
      // O que falta é o buraco depois de contar o que já foi vendido E o que se projeta.
      gap: metaReceita != null ? metaReceita - receitaRealizada - totalPonderado : null,
      semValor,
      vencidosEmAberto,
      podePonderar,
      isLoading,
    };
  }, [agendamentos, procedimentos, vendasLeadIds, metaReceita, receitaRealizada,
      loadingAgs, loadingVendas, loadingMeta, loadingRealizada]);
}
