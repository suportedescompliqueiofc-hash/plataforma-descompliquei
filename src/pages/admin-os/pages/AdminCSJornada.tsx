import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Route as RouteIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type CSClient, clientName } from '../types/cs';
import { CsJornadaSection } from '../components/CsJornadaSection';

// Mesma fonte da lista de CS (RPC get_cs_clients, SECURITY DEFINER) — nome
// correto da clínica + crm_user_id + org, sem depender de RLS cross-org.
function useCSClientById(clientId: string) {
  return useQuery({
    queryKey: ['cs-clients'],
    select: (data: CSClient[]) => data.find(c => c.id === clientId) ?? null,
    queryFn: async (): Promise<CSClient[]> => {
      const { data: rows, error } = await supabase.rpc('get_cs_clients');
      if (error) throw error;
      return (rows || []).map((r: any) => ({
        id: r.id,
        crm_user_id: r.crm_user_id ?? null,
        organization_id: r.organization_id,
        clinic_name: r.clinic_name ?? null,
        nome_completo: r.nome_completo ?? null,
        product_name: r.product_name ?? null,
        cs_fase: r.cs_fase ?? null,
        cs_fase_desde: r.cs_fase_desde ?? null,
        cs_health_status: r.cs_health_status ?? null,
        cs_ultimo_touchpoint: r.cs_ultimo_touchpoint ?? null,
        cs_proximo_touchpoint: r.cs_proximo_touchpoint ?? null,
        onboarding_concluido: r.onboarding_concluido ?? null,
        onboarding_complete: r.onboarding_complete ?? null,
        joined_at: r.joined_at ?? null,
        latest_health: null,
      } as CSClient));
    },
  });
}

export default function AdminCSJornada() {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading } = useCSClientById(clientId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!client) {
    return (
      <div className="p-6 max-w-4xl mx-auto py-24 flex flex-col items-center text-center">
        <div className="mb-6 p-4 rounded-2xl bg-muted/40"><RouteIcon className="h-8 w-8 text-muted-foreground/30" /></div>
        <h2 className="text-xl font-bold text-foreground font-display mb-2">Cliente não encontrado</h2>
        <p className="text-[13px] text-muted-foreground max-w-sm leading-relaxed mb-6">Esse cliente pode ter saído da base de CS.</p>
        <Button onClick={() => navigate('/admin/cs')} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5 px-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para CS
        </Button>
      </div>
    );
  }

  const name = clientName(client);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Voltar */}
      <button onClick={() => navigate('/admin/cs')}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para CS
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted"><RouteIcon className="h-4 w-4 text-muted-foreground" /></div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Jornada — {name}</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">
          Monte, edite e publique a consultoria mensal desta clínica. Converse com o Athos CS ou edite manualmente.
        </p>
      </div>

      {/* Gestão da jornada (lista + editor + Athos) */}
      <CsJornadaSection crmUserId={client.crm_user_id} clientOrgId={client.organization_id} clientName={name} />

      {/* Atalho para a ficha completa do cliente */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate(`/admin/cs/cliente/${client.id}`)}
          className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3">
          Ver ficha completa do cliente
        </Button>
      </div>
    </div>
  );
}
