import { useState } from 'react';
import { ShieldCheck, LogIn, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { MASTER_ORG_ID, DESCOMPLIQUEI_ORG_ID } from '@/lib/constants';

import TabClientesCRM from './super-admin/tabs/TabClientesCRM';
import TabIaGlobal from './super-admin/tabs/TabIaGlobal';

export default function SuperAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAccessingCRM, setIsAccessingCRM] = useState(false);

  const handleAccessDescompliqueiCRM = async () => {
    if (!user) return;
    setIsAccessingCRM(true);
    try {
      // Verificar que o usuário está na org MASTER
      const { data: myProfile } = await supabase
        .from('perfis')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      if (myProfile?.organization_id !== MASTER_ORG_ID) {
        toast({ title: 'Acesso negado', description: 'Apenas superadmins da organização master podem acessar o CRM principal.', variant: 'destructive' });
        setIsAccessingCRM(false);
        return;
      }
      // Salvar MASTER_ORG_ID para retorno
      localStorage.setItem('original_master_org_id', MASTER_ORG_ID);
      const { error } = await supabase.from('perfis').update({ organization_id: DESCOMPLIQUEI_ORG_ID as any }).eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Acessando CRM Descompliquei', description: 'Abrindo o CRM principal da Descompliquei...' });
      setTimeout(() => { window.location.href = '/crm'; }, 800);
    } catch (err: any) {
      toast({ title: 'Falha ao acessar CRM', description: err.message, variant: 'destructive' });
      setIsAccessingCRM(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12 w-full px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-xl bg-[#E85D24]/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-6 w-6 text-[#E85D24]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Super Admin CRM</h1>
          <p className="text-sm text-muted-foreground">Gerencie os clientes do seu CRM.</p>
        </div>
      </div>

      {/* Card de acesso ao CRM principal Descompliquei */}
      <Card className="border-[#E85D24]/30 bg-gradient-to-r from-[#E85D24]/5 to-transparent shadow-sm">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#E85D24]/10 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-[#E85D24]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">CRM Principal — Descompliquei</h3>
              <p className="text-sm text-muted-foreground">Acesse o CRM operacional da Descompliquei com leads, conversas e WhatsApp próprios.</p>
            </div>
          </div>
          <Button
            onClick={handleAccessDescompliqueiCRM}
            disabled={isAccessingCRM}
            className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90 shadow-md shrink-0"
          >
            <LogIn className="h-4 w-4 mr-2" />
            {isAccessingCRM ? 'Acessando...' : 'Acessar CRM Principal'}
          </Button>
        </CardContent>
      </Card>

      <div className="w-full">
        <TabClientesCRM toast={toast} user={user} />
      </div>

      <div className="w-full">
        <TabIaGlobal toast={toast} />
      </div>
    </div>
  );
}
