import { useState, useMemo } from "react";
import { ShoppingCart, DollarSign, TrendingUp, Percent, Search, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { VendaModal } from "@/components/vendas/VendaModal";
import { useVendas, Venda } from "@/hooks/useVendas";
import { useOutboundProspectos } from "@/hooks/useOutboundProspectos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export default function OutboundVendas() {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(today),
    to: endOfMonth(today),
  });
  const { vendas, isLoading } = useVendas(dateRange);
  const { prospectos } = useOutboundProspectos();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  const [search, setSearch] = useState("");
  const [isVendaModalOpen, setIsVendaModalOpen] = useState(false);

  const { data: outboundLeadIds = new Set<string>() } = useQuery({
    queryKey: ['outbound_lead_ids', orgId],
    queryFn: async () => {
      if (!orgId) return new Set<string>();
      const { data, error } = await supabase
        .from('leads')
        .select('id')
        .eq('organization_id', orgId)
        .eq('origem', 'outbound');
      if (error) throw error;
      return new Set((data || []).map((l: any) => l.id));
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const prospectoByLeadId = useMemo(() => {
    const map = new Map<string, any>();
    prospectos.forEach(p => {
      if (p.whatsapp_lead_id) map.set(p.whatsapp_lead_id, p);
    });
    return map;
  }, [prospectos]);

  const outboundVendas = useMemo(() => {
    return vendas.filter(v => {
      if (!outboundLeadIds.has(v.lead_id)) return false;

      if (search) {
        const s = search.toLowerCase();
        const leadNome = (v.leads?.nome || '').toLowerCase();
        const prosp = prospectoByLeadId.get(v.lead_id);
        const prospNome = (prosp?.nome || '').toLowerCase();
        const prospClinica = (prosp?.clinica || '').toLowerCase();
        const produto = (v.produto_servico || '').toLowerCase();
        if (!leadNome.includes(s) && !prospNome.includes(s) && !prospClinica.includes(s) && !produto.includes(s)) return false;
      }

      return true;
    });
  }, [vendas, outboundLeadIds, prospectoByLeadId, search]);

  const metrics = useMemo(() => {
    const total = outboundVendas.length;
    const faturamento = outboundVendas.reduce((s, v) => s + v.valor_fechado, 0);
    const ticket = total > 0 ? faturamento / total : 0;
    return { total, faturamento, ticket };
  }, [outboundVendas]);

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E85D24]/10 flex items-center justify-center">
            <ShoppingCart className="h-5 w-5 text-[#E85D24]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Vendas Outbound</h1>
            <p className="text-sm text-muted-foreground">Fechamentos da prospecção ativa</p>
          </div>
        </div>
        <DateRangePicker date={dateRange} setDate={setDateRange} />
        <Button onClick={() => setIsVendaModalOpen(true)} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
          <Plus className="h-4 w-4 mr-2" /> Registrar Venda
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)
        ) : (
          <>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E85D24]/10 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-[#E85D24]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.total}</p>
                  <p className="text-xs text-muted-foreground">Vendas no período</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(metrics.faturamento)}</p>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(metrics.ticket)}</p>
                  <p className="text-xs text-muted-foreground">Ticket médio</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por prospecto, produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : outboundVendas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma venda outbound no período</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Lead</TableHead>
                    <TableHead className="text-xs">Prospecto Outbound</TableHead>
                    <TableHead className="text-xs">Produto/Serviço</TableHead>
                    <TableHead className="text-xs text-right">Valor Orçado</TableHead>
                    <TableHead className="text-xs text-right">Valor Fechado</TableHead>
                    <TableHead className="text-xs">Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outboundVendas.map(v => {
                    const prosp = prospectoByLeadId.get(v.lead_id);
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(parseISO(v.data_fechamento), "dd/MM/yy")}
                        </TableCell>
                        <TableCell className="text-sm">{v.leads?.nome || '—'}</TableCell>
                        <TableCell>
                          {prosp ? (
                            <div>
                              <p className="text-sm font-medium">{prosp.nome}</p>
                              {prosp.clinica && <p className="text-xs text-muted-foreground">{prosp.clinica}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{v.produto_servico || '—'}</TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground">
                          {v.valor_orcado ? formatCurrency(v.valor_orcado) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium text-emerald-400">
                          {formatCurrency(v.valor_fechado)}
                        </TableCell>
                        <TableCell className="text-xs capitalize">{v.forma_pagamento || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <VendaModal open={isVendaModalOpen} onOpenChange={setIsVendaModalOpen} />
    </div>
  );
}
