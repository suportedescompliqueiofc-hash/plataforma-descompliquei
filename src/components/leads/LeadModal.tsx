import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLeads } from "@/hooks/useLeads";
import { useStages, Stage } from "@/hooks/useStages";
import MaskedInput, { PhoneInput, CpfInput } from "@/components/MaskedInput";
import { User, Mail, Phone, DollarSign, MapPin, Tag, Clock, MessageSquare, Pencil, MessageCircle, Briefcase, Globe, ImageOff, Megaphone, Calendar, Hash, UserCheck, ChevronRight, Plus, ArrowRight, Sparkles, Target, Activity, Zap, Copy, ExternalLink, CalendarDays, Shield, UserCog } from "lucide-react";
import { parse, format, differenceInYears, isValid, startOfDay, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { CreatableSelect } from "@/components/ui/CreatableSelect";
import { useLeadSources } from "@/hooks/useLeadSources";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { VendaModal } from "@/components/vendas/VendaModal";
import { FormattedText } from "@/components/FormattedText";
import { TagManager } from "@/components/tags/TagManager";
import { CardCriativoOrigem } from "@/components/leads/CardCriativoOrigem";
import LeadNotas from "@/components/leads/LeadNotas";
import { cn } from "@/lib/utils";
import { useTeamMembersForSelect, MemberSelectOption } from "@/hooks/useTeamMembersForSelect";

// --- Funções Auxiliares (mantidas) ---
const calculateAge = (dobString: string | undefined): number | '' => {
  if (!dobString || dobString.length !== 10) return '';
  const dob = parse(dobString, 'dd/MM/yyyy', new Date());
  if (!isValid(dob)) return '';
  const age = differenceInYears(new Date(), dob);
  return age >= 0 ? age : '';
};

const toSupabaseDate = (displayDate: string): string | undefined => {
  if (!displayDate || displayDate.length !== 10) return undefined;
  const date = parse(displayDate, 'dd/MM/yyyy', new Date());
  return isValid(date) ? format(date, 'yyyy-MM-dd') : undefined;
};

const toDisplayDate = (supabaseDate: string | undefined): string => {
  if (!supabaseDate) return '';
  try {
    const date = parse(supabaseDate, 'yyyy-MM-dd', new Date());
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '';
  } catch {
    return '';
  }
};

const toDisplayDateFromTimestamp = (supabaseTimestamp: string | undefined): string => {
  if (!supabaseTimestamp) return '';
  try {
    const date = parseISO(supabaseTimestamp);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '';
  } catch {
    return '';
  }
};

const toSupabaseTimestamp = (displayDate: string): string | undefined => {
  if (!displayDate || displayDate.length !== 10) return undefined;
  const date = parse(displayDate, 'dd/MM/yyyy', new Date());
  return isValid(date) ? startOfDay(date).toISOString() : undefined;
};

const cleanPhoneNumber = (phone: string): string => phone.replace(/\D/g, '');

const initialFormData = {
  nome: "", telefone: "", resumo: "",
  origem: "organico", // Default agora é organico
  fonte: "",          // Novo campo para o detalhe (antiga origem)
  posicao_pipeline: 1,
  status: "Ativo", email: "", cpf: "", idade: "",
  genero: "", endereco: "",
  procedimento_interesse: "",
  criativo_id: "none",
  data_nascimento_display: "",
  criado_em_display: "",
  is_qualified: false,
  responsavel_id: "" as string,
};

// --- Componentes de UI ---

const formatPhoneDisplay = (phone: string) => {
  if (!phone) return '-';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length >= 12) cleaned = cleaned.slice(2);
  if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  if (cleaned.length === 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return phone;
};

const InfoItem = ({ icon: Icon, label, value, className }: { icon: any, label: string, value: string | React.ReactNode, className?: string }) => (
  <div className={cn("flex items-start gap-3 py-2.5", className)}>
    <div className="p-1.5 rounded-lg bg-muted/50 shrink-0 mt-0.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
    </div>
    <div className="min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 block">{label}</span>
      <div className="text-[13px] text-foreground mt-0.5">{value}</div>
    </div>
  </div>
);

const ViewContent = ({
  lead, stages, creativeName, creativeAd,
  isEditing = false, formData, handleInputChange, handleSourceChange, allSources,
  teamMembers = [],
}: {
  lead: any; stages: Stage[]; creativeName?: string; creativeAd?: any;
  isEditing?: boolean; formData?: any;
  handleInputChange?: (field: string, value: any) => void;
  handleSourceChange?: (value: string) => void;
  allSources?: string[];
  teamMembers?: MemberSelectOption[];
}) => {
  /* helpers */
  const onEdit = (field: string, value: any) => { if (isEditing && handleInputChange) handleInputChange(field, value); };
  const pipelinePos = isEditing && formData ? formData.posicao_pipeline : lead.posicao_pipeline;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "Ativo": return { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "Ativo" };
      case "Inativo": return { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", label: "Inativo" };
      case "Convertido": return { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", label: "Convertido" };
      case "Perdido": return { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200", label: "Perdido" };
      default: return { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", label: status };
    }
  };

  const getScoreConfig = (score: string | null) => {
    switch (score) {
      case "A": return { label: "A", color: "#10B981", text: "Lead dos Sonhos" };
      case "B": return { label: "B", color: "#3B82F6", text: "Qualificado" };
      case "C": return { label: "C", color: "#F59E0B", text: "Em Desenvolvimento" };
      case "D": return { label: "D", color: "#EF4444", text: "Fora do ICP" };
      default: return null;
    }
  };

  const displayStatus = isEditing && formData ? formData.status : lead.status;
  const statusConfig = getStatusConfig(displayStatus);
  const scoreConfig = getScoreConfig(lead.lead_scoring);

  const displayName = isEditing && formData ? formData.nome : lead.nome;
  const initials = (displayName || "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  const lastContactTime = lead.ultimo_contato
    ? formatDistanceToNow(new Date(lead.ultimo_contato), { addSuffix: true, locale: ptBR })
    : null;
  const createdDate = lead.criado_em
    ? formatDistanceToNow(new Date(lead.criado_em), { addSuffix: true, locale: ptBR })
    : null;

  const sortedStages = [...stages].sort((a, b) => a.posicao_ordem - b.posicao_ordem);
  const activeStageIdx = sortedStages.findIndex(s => s.posicao_ordem === pipelinePos);

  const darkInput = "bg-white/10 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/25 rounded-lg";

  return (
    <div className="max-h-[80vh] overflow-y-auto">

      {/* ═══════════════ DARK HERO HEADER ═══════════════ */}
      <div className="bg-[#1a1a1a] px-6 pt-7 pb-6 -mt-[1px]">
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <div className="h-[72px] w-[72px] rounded-2xl bg-[#2a2a2a] flex items-center justify-center ring-2 ring-white/10">
              <span className="text-2xl font-extrabold text-white/80 select-none font-display tracking-tight">{initials}</span>
            </div>
            <div className={cn("absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-[3px] border-[#1a1a1a]", statusConfig.dot)} />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            {isEditing ? (
              /* ── Edit mode hero ── */
              <div className="space-y-2.5">
                <Input
                  value={formData.nome}
                  onChange={(e) => onEdit('nome', e.target.value)}
                  placeholder="Nome do lead"
                  className={cn(darkInput, "h-10 text-lg font-bold tracking-tight")}
                />
                <PhoneInput
                  value={formData.telefone}
                  onChange={(e: any) => onEdit('telefone', e.target.value)}
                  className={cn(darkInput, "h-8 text-[12px]")}
                  required
                />
                <div className="flex items-center gap-2.5">
                  <Switch
                    checked={formData.is_qualified}
                    onCheckedChange={(checked) => onEdit('is_qualified', checked)}
                    className="data-[state=checked]:bg-emerald-500 scale-[0.8]"
                  />
                  <span className="text-[11px] font-medium text-white/50">Lead Qualificado (MQL)</span>
                </div>
              </div>
            ) : (
              /* ── View mode hero ── */
              <>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-[22px] font-extrabold tracking-tight text-white font-display leading-tight">{lead.nome || 'Lead sem nome'}</h3>
                  {lead.is_qualified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <UserCheck className="h-3 w-3" />
                      MQL
                    </span>
                  )}
                  {scoreConfig && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-white px-2 py-0.5 rounded-md" style={{ backgroundColor: scoreConfig.color }}>
                      <Target className="h-3 w-3" />
                      Score {scoreConfig.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[12px] text-white/50">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    <span className="font-mono tabular-nums">{formatPhoneDisplay(lead.telefone)}</span>
                  </span>
                  {lead.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      {lead.email}
                    </span>
                  )}
                  {createdDate && (
                    <span className="flex items-center gap-1.5 ml-auto">
                      <CalendarDays className="h-3 w-3" />
                      {createdDate}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ═══════════════ PIPELINE PROGRESS TRACKER ═══════════════ */}
        {sortedStages.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-1">
              {sortedStages.map((stage, idx) => {
                const isPast = idx < activeStageIdx;
                const isCurrent = idx === activeStageIdx;
                return (
                  <div
                    key={stage.id}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 group relative",
                      isEditing && "cursor-pointer"
                    )}
                    onClick={() => isEditing && onEdit('posicao_pipeline', stage.posicao_ordem)}
                  >
                    <div className={cn(
                      "w-full h-1.5 rounded-full overflow-hidden bg-white/8 transition-all",
                      isEditing && "hover:bg-white/15"
                    )}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: isPast || isCurrent ? '100%' : '0%',
                          backgroundColor: isCurrent ? (stage.cor || '#E85D24') : isPast ? `${stage.cor || '#E85D24'}99` : 'transparent',
                        }}
                      />
                    </div>
                    {isCurrent && (
                      <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: stage.cor || '#E85D24' }}>
                        {stage.nome}
                      </span>
                    )}
                    {/* Tooltip on hover in edit mode */}
                    {isEditing && !isCurrent && (
                      <span className="absolute -bottom-5 text-[8px] font-medium text-white/30 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {stage.nome}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ QUICK STATS ROW ═══════════════ */}
      <div className="px-6 -mt-4 relative z-10">
        <div className="grid grid-cols-4 gap-3">
          {/* Status */}
          <div className={cn("rounded-xl border p-3.5 bg-white dark:bg-[#1f1f1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]", statusConfig.border)}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className={cn("h-2.5 w-2.5 rounded-full", statusConfig.dot)} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
            </div>
            <span className={cn("text-sm font-bold", statusConfig.text)}>{statusConfig.label}</span>
          </div>

          {/* Origem */}
          <div className="rounded-xl border border-border/60 p-3.5 bg-white dark:bg-[#1f1f1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-1.5">
              <Megaphone className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Origem</span>
            </div>
            {isEditing ? (
              <Select value={formData.origem} onValueChange={(v) => onEdit('origem', v)}>
                <SelectTrigger className="h-8 text-sm font-bold rounded-lg border-border/60 bg-background w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="marketing"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-500" />Marketing</div></SelectItem>
                  <SelectItem value="organico"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" />Orgânico</div></SelectItem>
                  <SelectItem value="reativacao"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-cyan-500" />Reativação</div></SelectItem>
                  <SelectItem value="paciente"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-teal-500" />Paciente</div></SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span className={cn("text-sm font-bold", {
                'text-amber-600': lead.origem === 'marketing',
                'text-emerald-600': lead.origem === 'organico' || lead.origem === 'indicacao',
                'text-cyan-600': lead.origem === 'reativacao',
                'text-teal-600': lead.origem === 'paciente',
                'text-muted-foreground': !['marketing','organico','indicacao','reativacao','paciente'].includes(lead.origem),
              })}>
                {{ marketing: 'Marketing', organico: 'Orgânico', indicacao: 'Orgânico', reativacao: 'Reativação', paciente: 'Paciente' }[lead.origem as string] ?? lead.origem ?? '—'}
              </span>
            )}
          </div>

          {/* Cadastro */}
          <div className="rounded-xl border border-border/60 p-3.5 bg-white dark:bg-[#1f1f1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarDays className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Cadastro</span>
            </div>
            <span className="text-sm font-bold text-foreground truncate block">{createdDate || '—'}</span>
          </div>

          {/* Último contato */}
          <div className="rounded-xl border border-border/60 p-3.5 bg-white dark:bg-[#1f1f1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Últ. contato</span>
            </div>
            <span className={cn("text-sm font-bold truncate block", lastContactTime ? "text-foreground" : "text-muted-foreground/50")}>{lastContactTime || 'Sem contato'}</span>
          </div>
        </div>
      </div>

      {/* ═══════════════ RESPONSÁVEL ═══════════════ */}
      {(isEditing || lead.responsavel_id) && (
        <div className="px-6 pt-4">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/20">
              <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Responsável</span>
            </div>
            <div className="px-4 py-3">
              {isEditing ? (
                <Select
                  value={formData?.responsavel_id || 'none'}
                  onValueChange={(v) => handleInputChange && handleInputChange('responsavel_id', v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg border-border/60 bg-background w-full">
                    <SelectValue placeholder="Sem responsável" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Sem responsável</span>
                    </SelectItem>
                    {teamMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            {m.url_avatar
                              ? <img src={m.url_avatar} className="h-full w-full object-cover" />
                              : <span className="text-[9px] font-bold text-muted-foreground">{(m.nome || m.email).charAt(0).toUpperCase()}</span>
                            }
                          </div>
                          <span>{m.nome}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (() => {
                const resp = teamMembers.find(m => m.id === lead.responsavel_id);
                if (!resp) return <span className="text-[13px] text-muted-foreground">—</span>;
                return (
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border">
                      {resp.url_avatar
                        ? <img src={resp.url_avatar} className="h-full w-full object-cover" />
                        : <span className="text-[10px] font-bold text-muted-foreground">{resp.nome.charAt(0).toUpperCase()}</span>
                      }
                    </div>
                    <div>
                      <span className="text-[13px] font-semibold text-foreground">{resp.nome}</span>
                      <span className="text-[11px] text-muted-foreground block">{resp.email}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ BODY CONTENT ═══════════════ */}
      <div className="px-6 pt-5 pb-2 space-y-4">

        {/* Tags */}
        <div>
          <TagManager leadId={lead.id} />
        </div>

        {/* ═══════════════ TWO-COLUMN DETAIL GRID ═══════════════ */}
        <div className="grid grid-cols-5 gap-4">

          {/* LEFT COLUMN — 3/5 */}
          <div className="col-span-3 space-y-4">

            {/* ── Informações pessoais ── */}
            {(isEditing || lead.data_nascimento || lead.genero || lead.cpf || lead.endereco || lead.fonte || lead.criado_em) && (
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Informações</span>
                </div>

                {isEditing ? (
                  /* ── Edit mode: only Fonte + Data de Cadastro ── */
                  <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Fonte</label>
                      <CreatableSelect
                        options={allSources || []}
                        value={formData.fonte}
                        onChange={handleSourceChange || (() => {})}
                        placeholder="Ex: Instagram"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Data de Cadastro</label>
                      <MaskedInput
                        mask="99/99/9999"
                        placeholder="DD/MM/AAAA"
                        value={formData.criado_em_display}
                        onChange={(e: any) => onEdit('criado_em_display', e.target.value)}
                        className="h-9 text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/40"
                      />
                    </div>
                  </div>
                ) : (
                  /* ── View mode: display values ── */
                  <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
                    {lead.fonte && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Fonte</span>
                        <span className="text-[13px] font-semibold text-foreground">{lead.fonte}</span>
                      </div>
                    )}
                    {lead.data_nascimento && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Nascimento</span>
                        <span className="text-[13px] font-semibold text-foreground tabular-nums">
                          {toDisplayDate(lead.data_nascimento)}
                          {lead.idade ? <span className="text-muted-foreground font-normal ml-1">({lead.idade}a)</span> : ''}
                        </span>
                      </div>
                    )}
                    {lead.genero && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Gênero</span>
                        <span className="text-[13px] font-semibold text-foreground">{lead.genero === 'M' ? 'Masculino' : lead.genero === 'F' ? 'Feminino' : lead.genero}</span>
                      </div>
                    )}
                    {lead.cpf && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">CPF</span>
                        <span className="text-[13px] font-semibold text-foreground font-mono tabular-nums">{lead.cpf}</span>
                      </div>
                    )}
                    {lead.endereco && (
                      <div className="col-span-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Endereço</span>
                        <span className="text-[13px] font-medium text-foreground">{lead.endereco}</span>
                      </div>
                    )}
                    {lead.criado_em && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">Cadastro</span>
                        <span className="text-[13px] font-semibold text-foreground tabular-nums">{toDisplayDateFromTimestamp(lead.criado_em)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Resumo IA — SOMENTE em view mode */}
            {!isEditing && lead.resumo && (
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-amber-50/60 dark:bg-amber-950/20">
                  <div className="p-1 rounded-md bg-amber-100 dark:bg-amber-900/40">
                    <Sparkles className="h-3 w-3 text-amber-700 dark:text-amber-400" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-amber-800 dark:text-amber-400">Resumo IA</span>
                </div>
                <div className="p-4 text-[13px] text-foreground leading-relaxed">
                  <FormattedText content={lead.resumo} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — 2/5 */}
          <div className="col-span-2 space-y-4">

            {/* Lead Score Card */}
            {scoreConfig && (
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="p-5 flex items-center gap-4">
                  <div className="relative shrink-0">
                    <svg width="64" height="64" viewBox="0 0 64 64" className="transform -rotate-90">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/60" />
                      <circle
                        cx="32" cy="32" r="28" fill="none" stroke={scoreConfig.color} strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - (scoreConfig.label === 'A' ? 0.95 : scoreConfig.label === 'B' ? 0.75 : scoreConfig.label === 'C' ? 0.50 : 0.25))}`}
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-extrabold font-display" style={{ color: scoreConfig.color }}>{scoreConfig.label}</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">Lead Score</span>
                    <span className="text-sm font-bold text-foreground block mt-0.5">{scoreConfig.text}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Criativo de Origem */}
            {creativeName && (
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
                  <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Criativo</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    {creativeAd?.url_thumbnail ? (
                      <img src={creativeAd.url_thumbnail} className="w-11 h-11 rounded-lg object-cover shrink-0 ring-1 ring-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Megaphone className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[12px] font-semibold text-foreground truncate block">{creativeName}</span>
                      {creativeAd?.meta_ad_id && <span className="text-[10px] text-muted-foreground font-mono">#{creativeAd.meta_ad_id.slice(-6)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <CardCriativoOrigem leadId={lead.id} />

            {/* Activity Summary */}
            {!isEditing && lastContactTime && (
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Atividade</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[12px] text-foreground">Último contato <span className="font-semibold">{lastContactTime}</span></span>
                  </div>
                  {lead.criado_em && (
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-[12px] text-foreground">Cadastrado <span className="font-semibold">{createdDate}</span></span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const FormField = ({ label, required, children }: { label: string, required?: boolean, children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground flex items-center gap-1">
      {label}
      {required && <span className="text-red-500 text-[10px]">*</span>}
    </label>
    {children}
  </div>
);

const FormContent = ({ formData, handleInputChange, handleSubmit, stages, handleClose, isEdit, handleSourceChange, teamMembers = [] }: any) => {
  const { allSources } = useLeadSources();
  const { profile: formProfile } = useProfile();
  const formOrgId = formProfile?.organization_id;
  const { data: metaAdsOptions = [] } = useQuery({
    queryKey: ['meta_ads_select', formOrgId],
    queryFn: async () => {
      const { data } = await (supabase
        .from('meta_ads') as any)
        .select('id, nome, meta_ad_id, url_thumbnail, status')
        .eq('organization_id', formOrgId!)
        .order('criado_em', { ascending: false });
      return data || [];
    },
    enabled: !!formOrgId,
  });

  const initials = (formData.nome || "?").split(" ").slice(0, 2).map((w: string) => w[0] || "").join("").toUpperCase();

  return (
    <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto">
      {/* Header visual com avatar */}
      <div className="flex items-center gap-4 px-6 pb-5 border-b border-border/50">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-muted-foreground select-none">
            {formData.nome ? initials : <User className="h-5 w-5 text-muted-foreground" />}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{formData.nome || 'Novo lead'}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formData.telefone ? formData.telefone : 'Preencha os dados abaixo'}
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Seção: Identificação */}
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <div className="p-1.5 rounded-lg bg-muted">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Identificação</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div data-tutorial="lead-field-nome">
              <FormField label="Nome">
                <Input
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  placeholder="Nome completo"
                  className="h-9 text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20 focus-visible:border-foreground/30"
                />
              </FormField>
            </div>
            <div data-tutorial="lead-field-telefone">
              <FormField label="Telefone" required>
                <PhoneInput
                  value={formData.telefone}
                  onChange={(e) => handleInputChange('telefone', e.target.value)}
                  required
                  className="h-9 text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20 focus-visible:border-foreground/30"
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Seção: Origem & Funil */}
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <div className="p-1.5 rounded-lg bg-muted">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Origem & Funil</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div data-tutorial="lead-field-origem">
              <FormField label="Origem">
                <Select value={formData.origem} onValueChange={(value) => handleInputChange('origem', value)}>
                  <SelectTrigger className="h-9 text-sm rounded-lg border-border/60 bg-background">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="marketing">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-500" />Marketing</div>
                    </SelectItem>
                    <SelectItem value="organico">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" />Orgânico</div>
                    </SelectItem>
                    <SelectItem value="reativacao">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-cyan-500" />Reativação</div>
                    </SelectItem>
                    <SelectItem value="paciente">
                      <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-teal-500" />Paciente</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div data-tutorial="lead-field-fonte">
              <FormField label="Fonte">
                <CreatableSelect
                  options={allSources}
                  value={formData.fonte}
                  onChange={handleSourceChange}
                  placeholder="Ex: Facebook, Instagram"
                />
              </FormField>
            </div>
            <div data-tutorial="lead-field-etapa">
              <FormField label="Etapa do Funil">
                <Select value={formData.posicao_pipeline.toString()} onValueChange={(value) => handleInputChange('posicao_pipeline', parseInt(value))}>
                  <SelectTrigger className="h-9 text-sm rounded-lg border-border/60 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {stages.map((stage: Stage) => (
                      <SelectItem key={stage.id} value={stage.posicao_ordem.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.cor }} />
                          {stage.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div data-tutorial="lead-field-data">
              <FormField label="Data de Cadastro">
                <MaskedInput
                  mask="99/99/9999"
                  placeholder="DD/MM/AAAA"
                  value={formData.criado_em_display}
                  onChange={(e) => handleInputChange('criado_em_display', e.target.value)}
                  className="h-9 text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20 focus-visible:border-foreground/30"
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Seção: Responsável */}
        {teamMembers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3.5">
              <div className="p-1.5 rounded-lg bg-muted">
                <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Responsável</span>
            </div>
            <Select
              value={formData.responsavel_id || 'none'}
              onValueChange={(v) => handleInputChange('responsavel_id', v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-9 text-sm rounded-lg border-border/60 bg-background w-full">
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">
                  <span className="text-muted-foreground">Sem responsável</span>
                </SelectItem>
                {teamMembers.map((m: MemberSelectOption) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {m.url_avatar
                          ? <img src={m.url_avatar} className="h-full w-full object-cover" />
                          : <span className="text-[9px] font-bold text-muted-foreground">{(m.nome || m.email).charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <span>{m.nome}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Seção: Resumo IA */}
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <div className="p-1.5 rounded-lg bg-amber-50">
              <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Resumo do Atendimento (IA)</span>
          </div>
          <Textarea
            value={formData.resumo}
            onChange={(e) => handleInputChange('resumo', e.target.value)}
            placeholder="Resumo gerado pela IA sobre o atendimento..."
            className="min-h-[80px] text-sm rounded-lg border-border/60 bg-background placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-foreground/20 focus-visible:border-foreground/30 resize-none"
          />
        </div>
      </div>

      {/* Footer com ações */}
      <div className="flex items-center gap-2 px-6 py-4 border-t border-border/40 bg-muted/20 rounded-b-2xl">
        <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={handleClose}>
          {isEdit ? "Cancelar" : "Fechar"}
        </Button>
        <div className="flex-1" />
        <Button
          type="submit"
          size="sm"
          data-tutorial="lead-submit"
          className="h-8 rounded-lg text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 px-5"
        >
          {isEdit ? (
            <>
              <Pencil className="h-3 w-3" />
              Salvar Alterações
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Criar Lead
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

// --- Componente Principal ---

interface LeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: any;
  mode?: 'view' | 'edit' | 'create';
}

export function LeadModal({ open, onOpenChange, lead, mode = 'create' }: LeadModalProps) {
  const { createLead, updateLead } = useLeads();
  const { stages } = useStages();
  const { allSources, createSource } = useLeadSources();
  const { profile: currentProfile } = useProfile();
  const { members: teamMembers } = useTeamMembersForSelect();
  const currentOrgId = currentProfile?.organization_id;
  const { data: metaAdsData = [] } = useQuery({
    queryKey: ['meta_ads_select', currentOrgId],
    queryFn: async () => {
      const { data } = await (supabase
        .from('meta_ads') as any)
        .select('id, nome, meta_ad_id, url_thumbnail')
        .eq('organization_id', currentOrgId!)
        .order('criado_em', { ascending: false });
      return data || [];
    },
    enabled: !!currentOrgId,
  });
  const [formData, setFormData] = useState(initialFormData);
  const [currentMode, setCurrentMode] = useState(mode);
  const [isVendaModalOpen, setIsVendaModalOpen] = useState(false);
  const navigate = useNavigate();

  const isView = currentMode === 'view';
  const isEdit = currentMode === 'edit' && !!lead;

  useEffect(() => {
    if (open) {
      setCurrentMode(mode);
      if (lead) {
        // Strip country code "55" for PhoneInput display (expects 10-11 digits)
        let telForForm = lead.telefone || "";
        const rawTel = telForForm.replace(/\D/g, '');
        if (rawTel.startsWith('55') && rawTel.length >= 12) {
          telForForm = rawTel.slice(2);
        }
        setFormData({
          nome: lead.nome || "", telefone: telForForm,
          resumo: lead.resumo || "",
          origem: lead.origem || "organico",
          fonte: lead.fonte || "",

          posicao_pipeline: lead.posicao_pipeline || 1,
          status: lead.status || "Ativo", email: lead.email || "", cpf: lead.cpf || "",
          idade: lead.idade?.toString() || "", genero: lead.genero || "", endereco: lead.endereco || "",
          procedimento_interesse: lead.procedimento_interesse || "",
          criativo_id: lead.criativo_id || "none",
          data_nascimento_display: toDisplayDate(lead.data_nascimento),
          criado_em_display: toDisplayDateFromTimestamp(lead.criado_em),
          is_qualified: lead.is_qualified || false,
          responsavel_id: lead.responsavel_id || "",
        });
      } else {
        setFormData({
            ...initialFormData,
            criado_em_display: format(new Date(), 'dd/MM/yyyy'),
        });
      }
    }
  }, [open, lead, mode]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => {
      const newState = { ...prev, [field]: value };
      if (field === 'data_nascimento_display') {
        newState.idade = String(calculateAge(value as string));
      }
      return newState;
    });
  };

  const handleSourceChange = (value: string) => {
    handleInputChange('fonte', value);
    if (value && !allSources.includes(value)) {
      createSource({ name: value });
    }
  };

  const doSubmit = () => {
    let cleanedPhone = cleanPhoneNumber(formData.telefone);
    if (!cleanedPhone || cleanedPhone.length < 10) {
      alert("O campo Telefone é obrigatório e deve ser válido.");
      return;
    }
    // Re-add country code "55" if it was stripped for display
    if (!cleanedPhone.startsWith('55') && (cleanedPhone.length === 10 || cleanedPhone.length === 11)) {
      cleanedPhone = '55' + cleanedPhone;
    }

    const data = {
      ...formData,
      telefone: cleanedPhone,
      idade: formData.idade ? parseInt(formData.idade) : undefined,
      data_nascimento: toSupabaseDate(formData.data_nascimento_display),
      criado_em: toSupabaseTimestamp(formData.criado_em_display),
      nome: formData.nome || undefined,
      origem: formData.origem || undefined,
      fonte: formData.fonte || undefined,
      resumo: formData.resumo || undefined,
      email: formData.email || undefined,
      cpf: formData.cpf || undefined,
      genero: formData.genero || undefined,
      endereco: formData.endereco || undefined,
      procedimento_interesse: formData.procedimento_interesse || undefined,
      criativo_id: formData.criativo_id === "none" ? null : formData.criativo_id,
      is_qualified: formData.is_qualified,
      responsavel_id: formData.responsavel_id || null,
    };

    delete (data as any).data_nascimento_display;
    delete (data as any).criado_em_display;

    if (isEdit) {
      updateLead({ id: lead.id, ...data });
    } else {
      createLead(data as any);
    }
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const handleClose = () => onOpenChange(false);
  const handleEditClient = () => setCurrentMode('edit');
  
  const handleOpenConversation = () => {
    if (lead?.id) {
      navigate(`/crm/conversas/${lead.id}`);
      onOpenChange(false);
    }
  };

  const currentStage = stages.find(s => s.posicao_ordem === lead?.posicao_pipeline); 
  const isContratoFechado = currentStage?.nome === 'Contrato Fechado' || currentStage?.nome === 'Procedimento Fechado';
  
  const creativeAd = lead?.criativo_id
    ? metaAdsData.find((a: any) => a.id === lead.criativo_id)
    : null;
  const creativeName = creativeAd?.nome || (lead?.criativo_id ? `Criativo #${lead.criativo_id.slice(-6)}` : undefined);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent data-tutorial="lead-modal" className={cn(
          "max-h-[90vh] rounded-2xl p-0 gap-0 overflow-hidden",
          (isView || isEdit)
            ? "max-w-3xl overflow-y-auto bg-[#fafaf8] dark:bg-[#141414]"
            : "max-w-2xl bg-white dark:bg-[#1a1a1a]"
        )}>
          {/* Header */}
          {(isView || isEdit) ? (
            /* View/Edit mode — hero takes over, sr-only for accessibility */
            <DialogHeader className="sr-only">
              <DialogTitle>{isEdit ? 'Editar Lead' : 'Detalhes do Lead'}</DialogTitle>
            </DialogHeader>
          ) : (
            /* Create mode — separate header */
            <div className="px-6 pt-6 pb-4 border-b border-border/40">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50">
                    <Plus className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <DialogTitle className="font-display font-bold tracking-tight text-lg">
                      Novo Lead
                    </DialogTitle>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      Preencha os dados para adicionar um novo lead
                    </p>
                  </div>
                </div>
              </DialogHeader>
            </div>
          )}

          {(isView || isEdit) && lead ? (
            <div className="pb-0">
              <ViewContent
                lead={lead}
                stages={stages}
                creativeName={creativeName}
                creativeAd={creativeAd}
                isEditing={isEdit}
                formData={isEdit ? formData : undefined}
                handleInputChange={isEdit ? handleInputChange : undefined}
                handleSourceChange={isEdit ? handleSourceChange : undefined}
                allSources={isEdit ? allSources : undefined}
                teamMembers={teamMembers}
              />
            </div>
          ) : (
            <FormContent
              formData={formData}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              stages={stages}
              handleClose={handleClose}
              isEdit={false}
              handleSourceChange={handleSourceChange}
              teamMembers={teamMembers}
            />
          )}

          {/* Notas do lead */}
          {lead?.id && lead?.organization_id && (
            <div className={cn(
              "border-t border-border/40 pt-5 pb-3",
              isView ? "px-6 bg-[#fafaf8] dark:bg-[#141414]" : "px-6"
            )}>
              <LeadNotas leadId={lead.id} organizationId={lead.organization_id} />
            </div>
          )}

          {isView && (
            <div className="flex items-center gap-2 px-6 py-4 border-t border-border/40 bg-white dark:bg-[#1a1a1a] sticky bottom-0">
              <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={handleClose}>Fechar</Button>
              <div className="flex-1" />
              {isContratoFechado && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsVendaModalOpen(true)}
                  className="h-8 rounded-lg text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Registrar Venda
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { navigate(`/crm/leads/${lead?.id}`); onOpenChange(false); }}
                className="h-8 rounded-lg text-xs font-semibold gap-1.5 border-border/60 hover:bg-muted/50"
              >
                <Activity className="h-3.5 w-3.5" />
                Jornada
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleOpenConversation} className="h-8 rounded-lg text-xs font-semibold gap-1.5 border-border/60 hover:bg-muted/50">
                <MessageCircle className="h-3.5 w-3.5" />
                Conversa
              </Button>
              <Button type="button" size="sm" onClick={handleEditClient} className="h-8 rounded-lg text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 shadow-sm">
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
            </div>
          )}

          {isEdit && (
            <div className="flex items-center gap-2 px-6 py-4 border-t border-border/40 bg-white dark:bg-[#1a1a1a] sticky bottom-0">
              <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setCurrentMode('view')}>
                Cancelar
              </Button>
              <div className="flex-1" />
              <Button
                type="button"
                size="sm"
                onClick={doSubmit}
                className="h-8 rounded-lg text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 shadow-sm px-5"
              >
                <Pencil className="h-3 w-3" />
                Salvar Alterações
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <VendaModal
        open={isVendaModalOpen}
        onOpenChange={setIsVendaModalOpen}
        lead={lead}
      />
    </>
  );
}