import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Clock, User, Users, UserCheck, MessageSquare, Calendar, FileText, History, ExternalLink, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OutboundProspecto } from "@/hooks/useOutboundProspectos";
import { useOutboundLigacoes, useDeleteLigacao, OutboundLigacao } from "@/hooks/useOutboundLigacoes";
import { EditLigacaoModal } from "./EditLigacaoModal";
import { useOutboundHistorico } from "@/hooks/useOutboundHistorico";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAgendamentos } from "@/hooks/useAgendamentos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospecto: OutboundProspecto | null;
  onEdit: () => void;
}

const SCORING_COLORS: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  B: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  C: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  D: "bg-red-500/20 text-red-500 border-red-500/30",
};

const ESPECIALIDADE_LABELS: Record<string, string> = {
  HOF: "HOF (Harmonização Orofacial)",
  odonto_estetica: "Odontologia Estética",
  med_estetica: "Medicina Estética",
  cirurgia_plastica: "Cirurgia Plástica",
  outro: "Outro",
};

const FATURAMENTO_LABELS: Record<string, string> = {
  abaixo_30k: "Abaixo de R$30k",
  "30_60k": "R$30k – R$60k",
  "60_100k": "R$60k – R$100k",
  acima_100k: "Acima de R$100k",
};

const TEMPO_LABELS: Record<string, string> = {
  menos_1ano: "Menos de 1 ano",
  "1_3anos": "1–3 anos",
  "3_5anos": "3–5 anos",
  mais_5anos: "Mais de 5 anos",
};

const CANAL_LABELS: Record<string, string> = {
  google_maps: "Google Maps",
  instagram: "Instagram",
  base_comprada: "Base comprada",
  indicacao: "Indicação",
  evento: "Evento",
  outro: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  atendeu: "Atendeu",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  caixa_postal: "Caixa postal",
  numero_errado: "Número errado",
  recusou: "Recusou",
};

const RESULTADO_LABELS: Record<string, string> = {
  sem_interesse: "Sem interesse",
  qualificado: "Qualificado",
  agendou_call: "Agendou call",
  quer_mais_info: "Quer mais info",
  ligar_depois: "Ligar depois",
  nao_e_icp: "Não é ICP",
  ja_tem_solucao: "Já tem solução",
};

const HISTORICO_ICONS: Record<string, any> = {
  stage_alterado: FileText,
  scoring_alterado: User,
  ligacao_registrada: Phone,
  mensagem_enviada: MessageSquare,
  agendamento_criado: Calendar,
  script_associado: FileText,
  nota_adicionada: FileText,
  prospecto_criado: User,
  campo_alterado: Pencil,
  venda_registrada: ExternalLink,
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2 border-b border-border/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function ProspectoDetalheModal({ open, onOpenChange, prospecto, onEdit }: Props) {
  const [tab, setTab] = useState("resumo");
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [editLigacao, setEditLigacao] = useState<OutboundLigacao | null>(null);
  const [editLigacaoOpen, setEditLigacaoOpen] = useState(false);
  const [deleteLigacaoId, setDeleteLigacaoId] = useState<string | null>(null);
  const deleteLigacaoMutation = useDeleteLigacao();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const { ligacoes, isLoading: ligacoesLoading } = useOutboundLigacoes(prospecto?.id || null);
  const { historico, isLoading: historicoLoading } = useOutboundHistorico(prospecto?.id || null);
  const { agendamentos } = useAgendamentos();

  const whatsappLeadId = prospecto?.whatsapp_lead_id || null;

  const { data: lastMessages = [] } = useQuery({
    queryKey: ['outbound_last_messages', whatsappLeadId],
    queryFn: async () => {
      if (!whatsappLeadId) return [];
      const { data, error } = await supabase
        .from('mensagens')
        .select('id, conteudo, remetente, criado_em, tipo_conteudo')
        .eq('lead_id', whatsappLeadId)
        .order('criado_em', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: !!whatsappLeadId,
  });

  const prospectoAgendamentos = useMemo(() => {
    if (!whatsappLeadId) return [];
    return agendamentos.filter((a: any) => a.lead_id === whatsappLeadId);
  }, [agendamentos, whatsappLeadId]);

  if (!prospecto) return null;

  const initials = prospecto.nome.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  const handleIniciarWhatsApp = async () => {
    if (!profile?.organization_id || !user?.id || isCreatingLead) return;
    setIsCreatingLead(true);
    try {
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('telefone', prospecto.telefone)
        .limit(1)
        .maybeSingle();

      let leadId: string;

      if (existing) {
        leadId = existing.id;
      } else {
        const { data: lead, error } = await supabase
          .from('leads')
          .insert({
            organization_id: profile.organization_id,
            usuario_id: user.id,
            nome: prospecto.nome,
            telefone: prospecto.telefone,
            email: prospecto.email,
            origem: 'outbound',
            fonte: 'prospecao_ativa',
            status: 'Ativo',
            posicao_pipeline: 0,
            ia_ativa: false,
          } as any)
          .select()
          .single();
        if (error) throw error;
        leadId = lead.id;
      }

      await (supabase as any)
        .from('outbound_prospectos')
        .update({ whatsapp_lead_id: leadId })
        .eq('id', prospecto.id);

      await (supabase as any)
        .from('outbound_historico')
        .insert({
          organization_id: profile.organization_id,
          prospecto_id: prospecto.id,
          usuario_id: user.id,
          tipo: 'mensagem_enviada',
          descricao: 'Conversa WhatsApp iniciada',
          metadados: { lead_id: leadId },
        });

      queryClient.invalidateQueries({ queryKey: ['outbound_prospectos'] });
      queryClient.invalidateQueries({ queryKey: ['outbound_prospecto', prospecto.id] });
      toast.success('Lead criado — abrindo conversa...');
      onOpenChange(false);
      navigate(`/outbound/conversas/${leadId}`);
    } catch (err: any) {
      toast.error('Erro ao iniciar WhatsApp: ' + err.message);
    } finally {
      setIsCreatingLead(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-[#E85D24]/10 text-[#E85D24] font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-lg">{prospecto.nome}</DialogTitle>
              <p className="text-sm text-muted-foreground">{prospecto.clinica} {prospecto.cidade ? `• ${prospecto.cidade}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              {prospecto.lead_scoring && (
                <Badge variant="outline" className={SCORING_COLORS[prospecto.lead_scoring]}>{prospecto.lead_scoring}</Badge>
              )}
              {prospecto.stage_nome && (
                <Badge style={{ backgroundColor: `${prospecto.stage_cor}20`, color: prospecto.stage_cor, borderColor: `${prospecto.stage_cor}40` }} variant="outline">{prospecto.stage_nome}</Badge>
              )}
              <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="w-full grid grid-cols-7">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="ligacoes">Ligações</TabsTrigger>
            <TabsTrigger value="nomes">Nomes</TabsTrigger>
            <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          </TabsList>

          {/* RESUMO */}
          <TabsContent value="resumo" className="space-y-1 mt-4">
            <InfoRow label="Telefone" value={prospecto.telefone} />
            <InfoRow label="Email" value={prospecto.email} />
            <InfoRow label="Especialidade" value={prospecto.especialidade ? ESPECIALIDADE_LABELS[prospecto.especialidade] || prospecto.especialidade : null} />
            <InfoRow label="Faturamento" value={prospecto.faturamento_estimado ? FATURAMENTO_LABELS[prospecto.faturamento_estimado] || prospecto.faturamento_estimado : null} />
            <InfoRow label="Equipe" value={prospecto.tamanho_equipe ? `${prospecto.tamanho_equipe} pessoas` : null} />
            <InfoRow label="Tempo de Mercado" value={prospecto.tempo_mercado ? TEMPO_LABELS[prospecto.tempo_mercado] || prospecto.tempo_mercado : null} />
            <InfoRow label="Canal de Origem" value={prospecto.canal_origem ? CANAL_LABELS[prospecto.canal_origem] || prospecto.canal_origem : null} />
            <InfoRow label="SDR Responsável" value={prospecto.perfil_nome} />
            <InfoRow label="Total de Tentativas" value={prospecto.total_tentativas.toString()} />
            <InfoRow label="Último Contato" value={prospecto.ultimo_contato ? format(new Date(prospecto.ultimo_contato), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null} />
            <InfoRow label="Próxima Ação" value={prospecto.proxima_acao} />
            <InfoRow label="Data Próxima Ação" value={prospecto.proxima_acao_data ? format(new Date(prospecto.proxima_acao_data), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null} />
            {prospecto.observacoes && (
              <div className="pt-3">
                <p className="text-sm text-muted-foreground mb-1">Observações</p>
                <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-line">{prospecto.observacoes}</p>
              </div>
            )}
            {prospecto.motivo_perda && (
              <div className="pt-3">
                <p className="text-sm text-muted-foreground mb-1">Motivo da Perda</p>
                <p className="text-sm bg-red-500/10 text-red-500 rounded-lg p-3">{prospecto.motivo_perda}</p>
              </div>
            )}
          </TabsContent>

          {/* LIGAÇÕES */}
          <TabsContent value="ligacoes" className="mt-4">
            {ligacoesLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : ligacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ligação registrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>#</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>SDR</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ligacoes.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{format(new Date(l.data_hora), "dd/MM/yy HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">{l.numero_tentativa}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{STATUS_LABELS[l.status] || l.status}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {l.resultado ? (
                          <div className="flex flex-wrap gap-1">
                            {l.resultado.split(',').map((r: string) => (
                              <span key={r}>{RESULTADO_LABELS[r.trim()] || r.trim()}</span>
                            ))}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{l.perfil_nome || "—"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditLigacao(l); setEditLigacaoOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => setDeleteLigacaoId(l.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* ANOTAÇÕES */}
          <TabsContent value="anotacoes" className="mt-4">
            {ligacoesLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : (() => {
              const ligacoesComAnotacao = ligacoes.filter(l => l.anotacao && l.anotacao.trim());
              return ligacoesComAnotacao.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma anotação registrada nas ligações</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ligacoesComAnotacao.map(l => (
                    <div key={l.id} className="rounded-lg border bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">
                            Ligação #{l.numero_tentativa} — {STATUS_LABELS[l.status] || l.status}
                            {l.resultado ? ` → ${l.resultado.split(',').map((r: string) => RESULTADO_LABELS[r.trim()] || r.trim()).join(', ')}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{l.perfil_nome || "—"}</span>
                          <span>•</span>
                          <span>{format(new Date(l.data_hora), "dd/MM/yyyy HH:mm")}</span>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-line bg-muted/40 rounded-md p-3 leading-relaxed">{l.anotacao}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico" className="mt-4">
            {historicoLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : historico.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro</p>
            ) : (
              <div className="space-y-3">
                {historico.map(h => {
                  const Icon = HISTORICO_ICONS[h.tipo] || History;
                  return (
                    <div key={h.id} className="flex gap-3 items-start p-3 rounded-lg bg-muted/30">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{h.descricao || h.tipo}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {h.perfil_nome || "Sistema"} • {formatDistanceToNow(new Date(h.criado_em), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* WHATSAPP */}
          <TabsContent value="whatsapp" className="mt-4">
            {prospecto.whatsapp_lead_id ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-medium">Conversa WhatsApp ativa</span>
                  </div>
                  <Button size="sm" onClick={() => { onOpenChange(false); navigate(`/outbound/conversas/${prospecto.whatsapp_lead_id}`); }} className="bg-emerald-600 hover:bg-emerald-700">
                    <ExternalLink className="h-4 w-4 mr-1" /> Abrir conversa
                  </Button>
                </div>
                {lastMessages.length > 0 ? (
                  <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
                    <p className="text-xs text-muted-foreground font-medium">Últimas mensagens</p>
                    {lastMessages.map((m: any) => (
                      <div key={m.id} className={`flex ${m.remetente === 'lead' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${m.remetente === 'lead' ? 'bg-muted' : 'bg-[#E85D24]/10 text-foreground'}`}>
                          <p>{m.tipo_conteudo !== 'texto' ? `[${m.tipo_conteudo}]` : m.conteudo}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(m.criado_em), "dd/MM HH:mm")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem ainda</p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <Phone className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa WhatsApp vinculada</p>
                <Button onClick={handleIniciarWhatsApp} disabled={isCreatingLead} className="bg-[#E85D24] hover:bg-[#E85D24]/90">
                  <MessageSquare className="h-4 w-4 mr-2" /> {isCreatingLead ? 'Criando...' : 'Iniciar Conversa no WhatsApp'}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* AGENDAMENTOS */}
          {/* NOMES */}
          <TabsContent value="nomes" className="mt-4">
            {(() => {
              const nomesData = ligacoes
                .filter((l: any) => l.nome_secretaria || l.nome_decisor)
                .map((l: any) => ({
                  id: l.id,
                  tentativa: l.numero_tentativa,
                  data: l.data_hora,
                  secretaria: l.nome_secretaria || null,
                  decisor: l.nome_decisor || null,
                  contatoSecretaria: l.contato_secretaria || false,
                  contatoDecisor: l.contato_decisor || false,
                }));
              // Also collect unique names
              const secretarias = [...new Set(ligacoes.filter((l: any) => l.nome_secretaria).map((l: any) => l.nome_secretaria as string))];
              const decisores = [...new Set(ligacoes.filter((l: any) => l.nome_decisor).map((l: any) => l.nome_decisor as string))];
              // Fallback to prospecto-level names
              if (secretarias.length === 0 && (prospecto as any).nome_secretaria) secretarias.push((prospecto as any).nome_secretaria);
              if (decisores.length === 0 && (prospecto as any).nome_decisor) decisores.push((prospecto as any).nome_decisor);

              if (secretarias.length === 0 && decisores.length === 0) {
                return (
                  <div className="text-center py-8">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum nome de secretária ou decisor registrado</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {decisores.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-emerald-500" />
                        </div>
                        <p className="text-sm font-semibold">Decisores</p>
                      </div>
                      {decisores.map((nome, i) => (
                        <div key={i} className="ml-9 px-3 py-2 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                          <p className="text-sm font-medium">{nome}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {secretarias.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-blue-500" />
                        </div>
                        <p className="text-sm font-semibold">Secretárias</p>
                      </div>
                      {secretarias.map((nome, i) => (
                        <div key={i} className="ml-9 px-3 py-2 rounded-lg border bg-blue-500/5 border-blue-500/20">
                          <p className="text-sm font-medium">{nome}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {nomesData.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico por ligação</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Ligação</TableHead>
                            <TableHead className="text-xs">Data</TableHead>
                            <TableHead className="text-xs">Secretária</TableHead>
                            <TableHead className="text-xs">Decisor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {nomesData.map((n: any) => (
                            <TableRow key={n.id}>
                              <TableCell className="text-xs font-medium">#{n.tentativa}</TableCell>
                              <TableCell className="text-xs">{format(new Date(n.data), "dd/MM/yy HH:mm")}</TableCell>
                              <TableCell className="text-sm">{n.secretaria || "—"}</TableCell>
                              <TableCell className="text-sm">{n.decisor || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="agendamentos" className="mt-4">
            {prospectoAgendamentos.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  {prospecto.whatsapp_lead_id ? 'Nenhum agendamento vinculado' : 'Inicie uma conversa no WhatsApp para vincular agendamentos.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Título</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospectoAgendamentos.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{format(new Date(a.data_hora_inicio), "dd/MM/yy HH:mm")}</TableCell>
                      <TableCell className="text-sm">{a.titulo}</TableCell>
                      <TableCell className="text-xs capitalize">{a.tipo}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{a.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Edit Ligação Modal */}
      <EditLigacaoModal
        open={editLigacaoOpen}
        onOpenChange={(v) => { setEditLigacaoOpen(v); if (!v) setEditLigacao(null); }}
        ligacao={editLigacao}
      />

      {/* Delete Ligação Confirmation */}
      <AlertDialog open={!!deleteLigacaoId} onOpenChange={(v) => { if (!v) setDeleteLigacaoId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ligação?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O registro da ligação será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={async () => {
                if (deleteLigacaoId && prospecto) {
                  await deleteLigacaoMutation.mutateAsync({ id: deleteLigacaoId, prospecto_id: prospecto.id });
                  setDeleteLigacaoId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
