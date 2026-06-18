import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';
import { eachDayOfInterval, startOfDay, endOfDay, format } from 'date-fns';
import { DateRange } from 'react-day-picker';

export function useReports(dateRange: DateRange | undefined, filters: any) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data, isLoading, isPending, error } = useQuery({
    queryKey: ['reports', orgId, dateRange, filters],
    queryFn: async () => {
      if (!user || !orgId || !dateRange?.from) return null;

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = dateRange.to ? endOfDay(dateRange.to).toISOString() : endOfDay(dateRange.from).toISOString();
      const daysInInterval = eachDayOfInterval({ start: dateRange.from, end: dateRange.to || dateRange.from });

      const [ { data: leadsData }, { data: vendasData } ] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .eq('organization_id', orgId)
          .or(`and(criado_em.gte.${startDate},criado_em.lte.${endDate}),and(atualizado_em.gte.${startDate},atualizado_em.lte.${endDate})`),
        supabase.from('vendas').select('*, leads(*)').eq('organization_id', orgId).gte('data_fechamento', format(dateRange.from, 'yyyy-MM-dd')).lte('data_fechamento', format(dateRange.to || dateRange.from, 'yyyy-MM-dd'))
      ]);

      const leads = leadsData || [];
      const closedLeads = leads.filter(l => l.is_closed);

      const totalFaturado = (vendasData || []).reduce((sum, v) => sum + Number(v.valor_fechado), 0);

      return {
        kpis: {
          totalLeads: leads.filter(l => l.criado_em >= startDate && l.criado_em <= endDate).length,
          totalContatos: leads.length,
          conversionRate: leads.length > 0 ? ((closedLeads.length / leads.length) * 100).toFixed(1) : "0",
          ticketMedio: vendasData && vendasData.length > 0 ? totalFaturado / vendasData.length : 0,
        },
        charts: {
          leadsCapturedData: daysInInterval.map(d => {
            const dayStr = format(d, 'yyyy-MM-dd');
            return {
              day: format(d, 'dd/MM'),
              captados: leads.filter(l => l.criado_em.startsWith(dayStr)).length,
            };
          }),
          sourceData: Object.entries(leads.reduce((a, l) => { const k = l.fonte || l.origem || 'Outros'; a[k] = (a[k] || 0) + 1; return a; }, {} as any)).map(([source, leads]) => ({ source, leads }))
        },
        funnel: { funnelData: [], overallConversion: "0", detailedSteps: [] },
        financial: { totalFaturado, ticketMedio: (vendasData?.length || 0) > 0 ? totalFaturado / (vendasData?.length || 1) : 0, totalVendas: vendasData?.length || 0, faturamentoPorDia: daysInInterval.map(d => ({ day: format(d, 'dd/MM'), valor: (vendasData || []).filter(v => v.data_fechamento === format(d, 'yyyy-MM-dd')).reduce((s, v) => s + Number(v.valor_fechado), 0) })) }
      };
    },
    enabled: !!orgId && !!dateRange?.from,
  });

  return {
    reports: data,
    isLoading: isLoading || isPending,
    error
  };
}
