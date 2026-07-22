export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_client_health: {
        Row: {
          avaliado_por: string | null
          client_id: string
          created_at: string | null
          engajamento: string | null
          id: string
          observacao: string | null
          risco_churn: string | null
          satisfacao: string | null
          score: number | null
        }
        Insert: {
          avaliado_por?: string | null
          client_id: string
          created_at?: string | null
          engajamento?: string | null
          id?: string
          observacao?: string | null
          risco_churn?: string | null
          satisfacao?: string | null
          score?: number | null
        }
        Update: {
          avaliado_por?: string | null
          client_id?: string
          created_at?: string | null
          engajamento?: string | null
          id?: string
          observacao?: string | null
          risco_churn?: string | null
          satisfacao?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_client_health_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_client_notes: {
        Row: {
          client_id: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          type: string | null
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          type?: string | null
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_events: {
        Row: {
          all_day: boolean | null
          client_id: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_at: string | null
          id: string
          meet_link: string | null
          start_at: string
          title: string
          type: string | null
        }
        Insert: {
          all_day?: boolean | null
          client_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          meet_link?: string | null
          start_at: string
          title: string
          type?: string | null
        }
        Update: {
          all_day?: boolean | null
          client_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          meet_link?: string | null
          start_at?: string
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_system_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      admin_tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          status: string | null
          subtasks: Json | null
          tags: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          subtasks?: Json | null
          tags?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          subtasks?: Json | null
          tags?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_config_notificacoes: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string
          lembretes: Json | null
          mensagem_confirmacao: string | null
          mensagem_lembrete: string | null
          notif_1_antecedencia_minutos: number | null
          notif_1_ativa: boolean | null
          notif_1_canal: string | null
          notif_1_destinatario: string | null
          notif_1_template: string | null
          notif_2_antecedencia_minutos: number | null
          notif_2_ativa: boolean | null
          notif_2_canal: string | null
          notif_2_destinatario: string | null
          notif_2_template: string | null
          notif_3_antecedencia_minutos: number | null
          notif_3_ativa: boolean | null
          notif_3_canal: string | null
          notif_3_destinatario: string | null
          notif_3_template: string | null
          notif_atendente_antecedencia_minutos: number | null
          notif_atendente_ativa: boolean | null
          notif_atendente_canal: string | null
          notif_ativa: boolean | null
          notif_confirmacao_ativa: boolean | null
          notif_interna_ativa: boolean | null
          notif_interna_minutos_antes: number | null
          organization_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          lembretes?: Json | null
          mensagem_confirmacao?: string | null
          mensagem_lembrete?: string | null
          notif_1_antecedencia_minutos?: number | null
          notif_1_ativa?: boolean | null
          notif_1_canal?: string | null
          notif_1_destinatario?: string | null
          notif_1_template?: string | null
          notif_2_antecedencia_minutos?: number | null
          notif_2_ativa?: boolean | null
          notif_2_canal?: string | null
          notif_2_destinatario?: string | null
          notif_2_template?: string | null
          notif_3_antecedencia_minutos?: number | null
          notif_3_ativa?: boolean | null
          notif_3_canal?: string | null
          notif_3_destinatario?: string | null
          notif_3_template?: string | null
          notif_atendente_antecedencia_minutos?: number | null
          notif_atendente_ativa?: boolean | null
          notif_atendente_canal?: string | null
          notif_ativa?: boolean | null
          notif_confirmacao_ativa?: boolean | null
          notif_interna_ativa?: boolean | null
          notif_interna_minutos_antes?: number | null
          organization_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          lembretes?: Json | null
          mensagem_confirmacao?: string | null
          mensagem_lembrete?: string | null
          notif_1_antecedencia_minutos?: number | null
          notif_1_ativa?: boolean | null
          notif_1_canal?: string | null
          notif_1_destinatario?: string | null
          notif_1_template?: string | null
          notif_2_antecedencia_minutos?: number | null
          notif_2_ativa?: boolean | null
          notif_2_canal?: string | null
          notif_2_destinatario?: string | null
          notif_2_template?: string | null
          notif_3_antecedencia_minutos?: number | null
          notif_3_ativa?: boolean | null
          notif_3_canal?: string | null
          notif_3_destinatario?: string | null
          notif_3_template?: string | null
          notif_atendente_antecedencia_minutos?: number | null
          notif_atendente_ativa?: boolean | null
          notif_atendente_canal?: string | null
          notif_ativa?: boolean | null
          notif_confirmacao_ativa?: boolean | null
          notif_interna_ativa?: boolean | null
          notif_interna_minutos_antes?: number | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_config_notificacoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_notif_log: {
        Row: {
          agendamento_id: string | null
          canal: string | null
          criado_em: string | null
          enviado_em: string | null
          erro: string | null
          id: string
          lead_id: string | null
          organization_id: string | null
          status: string | null
          tipo: string
        }
        Insert: {
          agendamento_id?: string | null
          canal?: string | null
          criado_em?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          status?: string | null
          tipo: string
        }
        Update: {
          agendamento_id?: string | null
          canal?: string | null
          criado_em?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_notif_log_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_notif_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_notif_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_notificacoes: {
        Row: {
          agendamento_id: string | null
          antecedencia_minutos: number
          canal: string | null
          criado_em: string | null
          data_hora_envio: string
          enviado_em: string | null
          erro: string | null
          id: string
          mensagem_template: string | null
          organization_id: string | null
          status: string | null
          tipo_destinatario: string | null
        }
        Insert: {
          agendamento_id?: string | null
          antecedencia_minutos: number
          canal?: string | null
          criado_em?: string | null
          data_hora_envio: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          mensagem_template?: string | null
          organization_id?: string | null
          status?: string | null
          tipo_destinatario?: string | null
        }
        Update: {
          agendamento_id?: string | null
          antecedencia_minutos?: number
          canal?: string | null
          criado_em?: string | null
          data_hora_envio?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          mensagem_template?: string | null
          organization_id?: string | null
          status?: string | null
          tipo_destinatario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_notificacoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_notificacoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_status_history: {
        Row: {
          agendamento_id: string
          alterado_em: string
          id: string
          organization_id: string
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          agendamento_id: string
          alterado_em?: string
          id?: string
          organization_id: string
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          agendamento_id?: string
          alterado_em?: string
          id?: string
          organization_id?: string
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_status_history_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          atualizado_em: string | null
          cor: string | null
          criado_em: string | null
          criado_por: string | null
          data_hora_fim: string
          data_hora_inicio: string
          descricao: string | null
          duracao_minutos: number | null
          id: string
          lead_id: string | null
          link_reuniao: string | null
          local: string | null
          observacoes_pos: string | null
          organization_id: string
          procedimento_id: string | null
          procedimento_interesse: string | null
          resultado: string | null
          status: string | null
          tipo: string | null
          titulo: string
          usuario_id: string | null
          valor_orcado: number | null
        }
        Insert: {
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_hora_fim: string
          data_hora_inicio: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          lead_id?: string | null
          link_reuniao?: string | null
          local?: string | null
          observacoes_pos?: string | null
          organization_id: string
          procedimento_id?: string | null
          procedimento_interesse?: string | null
          resultado?: string | null
          status?: string | null
          tipo?: string | null
          titulo: string
          usuario_id?: string | null
          valor_orcado?: number | null
        }
        Update: {
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_hora_fim?: string
          data_hora_inicio?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          lead_id?: string | null
          link_reuniao?: string | null
          local?: string | null
          observacoes_pos?: string | null
          organization_id?: string
          procedimento_id?: string | null
          procedimento_interesse?: string | null
          resultado?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string
          usuario_id?: string | null
          valor_orcado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos_analise: {
        Row: {
          criado_em: string
          data_slot: string
          email: string
          especialidade: string | null
          faturamento_mensal: string | null
          horario_slot: string
          id: string
          label_slot: string
          nome: string
          origem: string
          whatsapp: string
        }
        Insert: {
          criado_em?: string
          data_slot: string
          email: string
          especialidade?: string | null
          faturamento_mensal?: string | null
          horario_slot: string
          id?: string
          label_slot: string
          nome: string
          origem?: string
          whatsapp: string
        }
        Update: {
          criado_em?: string
          data_slot?: string
          email?: string
          especialidade?: string | null
          faturamento_mensal?: string | null
          horario_slot?: string
          id?: string
          label_slot?: string
          nome?: string
          origem?: string
          whatsapp?: string
        }
        Relationships: []
      }
      agentes: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          dados_formulario: Json | null
          etapa_atual: number | null
          id: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          dados_formulario?: Json | null
          etapa_atual?: number | null
          id?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          dados_formulario?: Json | null
          etapa_atual?: number | null
          id?: string
          usuario_id?: string
        }
        Relationships: []
      }
      ai_execution_logs: {
        Row: {
          atualizado_em: string
          criado_em: string
          detalhe: string | null
          duracao_ms: number | null
          erro_detalhe: string | null
          etapa: string
          id: string
          lead_id: string | null
          model: string | null
          organization_id: string
          partes_enviadas: number | null
          session_id: string | null
          status: string
          tool_calls: Json | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          detalhe?: string | null
          duracao_ms?: number | null
          erro_detalhe?: string | null
          etapa: string
          id?: string
          lead_id?: string | null
          model?: string | null
          organization_id: string
          partes_enviadas?: number | null
          session_id?: string | null
          status?: string
          tool_calls?: Json | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          detalhe?: string | null
          duracao_ms?: number | null
          erro_detalhe?: string | null
          etapa?: string
          id?: string
          lead_id?: string | null
          model?: string | null
          organization_id?: string
          partes_enviadas?: number | null
          session_id?: string | null
          status?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_execution_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_execution_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analise_ia_logs: {
        Row: {
          confianca: string | null
          criado_em: string
          id: string
          lead_id: string | null
          lead_nome: string | null
          motivo: string | null
          organization_id: string
          veredito: string
        }
        Insert: {
          confianca?: string | null
          criado_em?: string
          id?: string
          lead_id?: string | null
          lead_nome?: string | null
          motivo?: string | null
          organization_id: string
          veredito: string
        }
        Update: {
          confianca?: string | null
          criado_em?: string
          id?: string
          lead_id?: string | null
          lead_nome?: string | null
          motivo?: string | null
          organization_id?: string
          veredito?: string
        }
        Relationships: []
      }
      arsenal_aulas: {
        Row: {
          ativo: boolean | null
          bloco_id: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number
          slug: string
          texto_aprenda: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          ativo?: boolean | null
          bloco_id?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem: number
          slug: string
          texto_aprenda?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          ativo?: boolean | null
          bloco_id?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          texto_aprenda?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arsenal_aulas_bloco_id_fkey"
            columns: ["bloco_id"]
            isOneToOne: false
            referencedRelation: "arsenal_blocos"
            referencedColumns: ["id"]
          },
        ]
      }
      arsenal_aulas_progresso: {
        Row: {
          anotacoes: string | null
          aula_id: string | null
          id: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          anotacoes?: string | null
          aula_id?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          anotacoes?: string | null
          aula_id?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arsenal_aulas_progresso_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "arsenal_aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      arsenal_blocos: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number
          slug: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem: number
          slug: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          tipo?: string
        }
        Relationships: []
      }
      arsenal_categorias: {
        Row: {
          cor: string | null
          descricao: string | null
          frase_ancora: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          cor?: string | null
          descricao?: string | null
          frase_ancora?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          cor?: string | null
          descricao?: string | null
          frase_ancora?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      arsenal_construcoes: {
        Row: {
          conteudo: string
          ferramenta_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conteudo?: string
          ferramenta_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conteudo?: string
          ferramenta_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arsenal_construcoes_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "arsenal_ferramentas"
            referencedColumns: ["id"]
          },
        ]
      }
      arsenal_ferramentas: {
        Row: {
          ativo: boolean
          categoria_id: string
          descricao: string | null
          diagrama_json: Json | null
          id: string
          nome: string
          ordem: number
          slug: string
          template_construa: string | null
          texto_aprenda: string | null
          video_url: string | null
        }
        Insert: {
          ativo?: boolean
          categoria_id: string
          descricao?: string | null
          diagrama_json?: Json | null
          id?: string
          nome: string
          ordem?: number
          slug: string
          template_construa?: string | null
          texto_aprenda?: string | null
          video_url?: string | null
        }
        Update: {
          ativo?: boolean
          categoria_id?: string
          descricao?: string | null
          diagrama_json?: Json | null
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          template_construa?: string | null
          texto_aprenda?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arsenal_ferramentas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "arsenal_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      arsenal_materiais: {
        Row: {
          ativo: boolean
          conteudo_html: string | null
          created_at: string
          ferramenta_id: string
          id: string
          ordem: number
          pdf_url: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          conteudo_html?: string | null
          created_at?: string
          ferramenta_id: string
          id?: string
          ordem?: number
          pdf_url?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          conteudo_html?: string | null
          created_at?: string
          ferramenta_id?: string
          id?: string
          ordem?: number
          pdf_url?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "arsenal_materiais_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "arsenal_ferramentas"
            referencedColumns: ["id"]
          },
        ]
      }
      arsenal_progresso: {
        Row: {
          ferramenta_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ferramenta_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ferramenta_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arsenal_progresso_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "arsenal_ferramentas"
            referencedColumns: ["id"]
          },
        ]
      }
      arsenal_templates: {
        Row: {
          ativo: boolean
          categoria_arsenal_id: string
          conteudo: string
          created_at: string
          descricao: string | null
          ferramenta_id: string
          id: string
          ordem: number
          titulo: string
        }
        Insert: {
          ativo?: boolean
          categoria_arsenal_id: string
          conteudo?: string
          created_at?: string
          descricao?: string | null
          ferramenta_id: string
          id?: string
          ordem?: number
          titulo: string
        }
        Update: {
          ativo?: boolean
          categoria_arsenal_id?: string
          conteudo?: string
          created_at?: string
          descricao?: string | null
          ferramenta_id?: string
          id?: string
          ordem?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "arsenal_templates_categoria_arsenal_id_fkey"
            columns: ["categoria_arsenal_id"]
            isOneToOne: false
            referencedRelation: "arsenal_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arsenal_templates_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "arsenal_ferramentas"
            referencedColumns: ["id"]
          },
        ]
      }
      athos_agentes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          slug: string
          system_prompt: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          slug: string
          system_prompt?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
          system_prompt?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      athos_agentes_org: {
        Row: {
          agente_slug: string
          ativo: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          agente_slug: string
          ativo?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          agente_slug?: string
          ativo?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      athos_config: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          id: string
          modelo_padrao: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          modelo_padrao?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          modelo_padrao?: string
        }
        Relationships: []
      }
      atividades: {
        Row: {
          campanha_id: string | null
          criado_em: string | null
          descricao: string
          id: string
          lead_id: string | null
          metadados: Json | null
          organization_id: string | null
          tipo: string
          usuario_id: string
        }
        Insert: {
          campanha_id?: string | null
          criado_em?: string | null
          descricao: string
          id?: string
          lead_id?: string | null
          metadados?: Json | null
          organization_id?: string | null
          tipo: string
          usuario_id: string
        }
        Update: {
          campanha_id?: string | null
          criado_em?: string | null
          descricao?: string
          id?: string
          lead_id?: string | null
          metadados?: Json | null
          organization_id?: string | null
          tipo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      atualizacoes: {
        Row: {
          areas: string[]
          atualizado_em: string
          categoria: string
          criado_em: string
          criado_por: string | null
          descricao: string
          id: string
          publicado: boolean
          publicado_em: string
          rota_destino: string | null
          titulo: string
          tutorial_alvo: string | null
        }
        Insert: {
          areas?: string[]
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          criado_por?: string | null
          descricao: string
          id?: string
          publicado?: boolean
          publicado_em?: string
          rota_destino?: string | null
          titulo: string
          tutorial_alvo?: string | null
        }
        Update: {
          areas?: string[]
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          publicado?: boolean
          publicado_em?: string
          rota_destino?: string | null
          titulo?: string
          tutorial_alvo?: string | null
        }
        Relationships: []
      }
      cadence_dispatches: {
        Row: {
          cadencia_id: string
          criado_em: string | null
          criado_por: string | null
          id: string
          organization_id: string
          total_leads: number
        }
        Insert: {
          cadencia_id: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          organization_id: string
          total_leads?: number
        }
        Update: {
          cadencia_id?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          organization_id?: string
          total_leads?: number
        }
        Relationships: [
          {
            foreignKeyName: "cadence_dispatches_cadencia_id_fkey"
            columns: ["cadencia_id"]
            isOneToOne: false
            referencedRelation: "cadencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_dispatches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cadencia_logs: {
        Row: {
          cadencia_id: string
          enviado_em: string | null
          id: string
          lead_id: string
          mensagem_erro: string | null
          organization_id: string
          passo_ordem: number
          status: string
        }
        Insert: {
          cadencia_id: string
          enviado_em?: string | null
          id?: string
          lead_id: string
          mensagem_erro?: string | null
          organization_id: string
          passo_ordem: number
          status: string
        }
        Update: {
          cadencia_id?: string
          enviado_em?: string | null
          id?: string
          lead_id?: string
          mensagem_erro?: string | null
          organization_id?: string
          passo_ordem?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadencia_logs_cadencia_id_fkey"
            columns: ["cadencia_id"]
            isOneToOne: false
            referencedRelation: "cadencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadencia_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadencia_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cadencia_passos: {
        Row: {
          arquivo_path: string | null
          cadencia_id: string
          conteudo: string | null
          criado_em: string | null
          id: string
          posicao_ordem: number
          tempo_espera: number
          tipo_mensagem: string
          unidade_tempo: string
        }
        Insert: {
          arquivo_path?: string | null
          cadencia_id: string
          conteudo?: string | null
          criado_em?: string | null
          id?: string
          posicao_ordem: number
          tempo_espera?: number
          tipo_mensagem?: string
          unidade_tempo?: string
        }
        Update: {
          arquivo_path?: string | null
          cadencia_id?: string
          conteudo?: string | null
          criado_em?: string | null
          id?: string
          posicao_ordem?: number
          tempo_espera?: number
          tipo_mensagem?: string
          unidade_tempo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadencia_passos_cadencia_id_fkey"
            columns: ["cadencia_id"]
            isOneToOne: false
            referencedRelation: "cadencias"
            referencedColumns: ["id"]
          },
        ]
      }
      cadencias: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
          organization_id: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
          organization_id: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadencias_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          atualizado_em: string | null
          contagem_conversoes: number | null
          contagem_destinatarios: number | null
          contagem_enviados: number | null
          contagem_respostas: number | null
          contagem_visualizados: number | null
          criado_em: string | null
          data_agendamento: string | null
          descricao: string | null
          id: string
          intervalo_segundos: number | null
          media_url: string | null
          nome: string
          organization_id: string | null
          segmento: string | null
          segmento_config: Json | null
          status: Database["public"]["Enums"]["campaign_status"] | null
          targeted_lead_ids: Json | null
          template_mensagem: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string | null
          contagem_conversoes?: number | null
          contagem_destinatarios?: number | null
          contagem_enviados?: number | null
          contagem_respostas?: number | null
          contagem_visualizados?: number | null
          criado_em?: string | null
          data_agendamento?: string | null
          descricao?: string | null
          id?: string
          intervalo_segundos?: number | null
          media_url?: string | null
          nome: string
          organization_id?: string | null
          segmento?: string | null
          segmento_config?: Json | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          targeted_lead_ids?: Json | null
          template_mensagem: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string | null
          contagem_conversoes?: number | null
          contagem_destinatarios?: number | null
          contagem_enviados?: number | null
          contagem_respostas?: number | null
          contagem_visualizados?: number | null
          criado_em?: string | null
          data_agendamento?: string | null
          descricao?: string | null
          id?: string
          intervalo_segundos?: number | null
          media_url?: string | null
          nome?: string
          organization_id?: string | null
          segmento?: string | null
          segmento_config?: Json | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          targeted_lead_ids?: Json | null
          template_mensagem?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_boards: {
        Row: {
          app_state: Json | null
          atualizado_em: string | null
          cor: string | null
          criado_em: string | null
          descricao: string | null
          elements: Json | null
          files: Json | null
          fixado: boolean | null
          id: string
          organization_id: string
          pasta_id: string | null
          thumbnail: string | null
          titulo: string
          ultima_edicao_por: string | null
          usuario_id: string | null
        }
        Insert: {
          app_state?: Json | null
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          elements?: Json | null
          files?: Json | null
          fixado?: boolean | null
          id?: string
          organization_id: string
          pasta_id?: string | null
          thumbnail?: string | null
          titulo?: string
          ultima_edicao_por?: string | null
          usuario_id?: string | null
        }
        Update: {
          app_state?: Json | null
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          elements?: Json | null
          files?: Json | null
          fixado?: boolean | null
          id?: string
          organization_id?: string
          pasta_id?: string | null
          thumbnail?: string | null
          titulo?: string
          ultima_edicao_por?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canvas_boards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_boards_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "canvas_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_pastas: {
        Row: {
          atualizado_em: string | null
          cor: string | null
          criado_em: string | null
          descricao: string | null
          fixado: boolean | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          organization_id: string
          pasta_pai_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          fixado?: boolean | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          organization_id: string
          pasta_pai_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          fixado?: boolean | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          organization_id?: string
          pasta_pai_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canvas_pastas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_pastas_pasta_pai_id_fkey"
            columns: ["pasta_pai_id"]
            isOneToOne: false
            referencedRelation: "canvas_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_versoes: {
        Row: {
          app_state: Json | null
          board_id: string | null
          criado_em: string | null
          elements: Json
          id: string
          organization_id: string | null
          usuario_id: string | null
        }
        Insert: {
          app_state?: Json | null
          board_id?: string | null
          criado_em?: string | null
          elements: Json
          id?: string
          organization_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          app_state?: Json | null
          board_id?: string | null
          criado_em?: string | null
          elements?: Json
          id?: string
          organization_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canvas_versoes_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "canvas_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_versoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          atualizado_em: string | null
          avatar_url: string | null
          cep: string | null
          cidade: string | null
          criado_em: string | null
          criado_por: string | null
          customer_success_id: string | null
          data_inicio: string | null
          deletado_em: string | null
          dev_id: string | null
          documento: string | null
          duracao_meses: number | null
          email: string | null
          endereco_completo: string | null
          estado: string | null
          gestor_trafego_id: string | null
          id: string
          instagram: string | null
          mes_atual: number | null
          nome: string | null
          observacoes: string | null
          particularidades: string | null
          segmento: string | null
          squad_id: string | null
          status: string | null
          telefone: string | null
          tem_bonus: boolean | null
          tipo: string | null
          whatsapp: string | null
        }
        Insert: {
          atualizado_em?: string | null
          avatar_url?: string | null
          cep?: string | null
          cidade?: string | null
          criado_em?: string | null
          criado_por?: string | null
          customer_success_id?: string | null
          data_inicio?: string | null
          deletado_em?: string | null
          dev_id?: string | null
          documento?: string | null
          duracao_meses?: number | null
          email?: string | null
          endereco_completo?: string | null
          estado?: string | null
          gestor_trafego_id?: string | null
          id?: string
          instagram?: string | null
          mes_atual?: number | null
          nome?: string | null
          observacoes?: string | null
          particularidades?: string | null
          segmento?: string | null
          squad_id?: string | null
          status?: string | null
          telefone?: string | null
          tem_bonus?: boolean | null
          tipo?: string | null
          whatsapp?: string | null
        }
        Update: {
          atualizado_em?: string | null
          avatar_url?: string | null
          cep?: string | null
          cidade?: string | null
          criado_em?: string | null
          criado_por?: string | null
          customer_success_id?: string | null
          data_inicio?: string | null
          deletado_em?: string | null
          dev_id?: string | null
          documento?: string | null
          duracao_meses?: number | null
          email?: string | null
          endereco_completo?: string | null
          estado?: string | null
          gestor_trafego_id?: string | null
          id?: string
          instagram?: string | null
          mes_atual?: number | null
          nome?: string | null
          observacoes?: string | null
          particularidades?: string | null
          segmento?: string | null
          squad_id?: string | null
          status?: string | null
          telefone?: string | null
          tem_bonus?: boolean | null
          tipo?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_clinica: {
        Row: {
          atualizado_em: string | null
          cnpj: string | null
          criado_em: string | null
          email: string | null
          endereco: Json | null
          formato_data: string | null
          fuso_horario: string | null
          horario_funcionamento: Json | null
          id: string
          mensagem_ausencia: string | null
          moeda: string | null
          nome: string
          organization_id: string | null
          telefone: string | null
          url_logo: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string | null
          cnpj?: string | null
          criado_em?: string | null
          email?: string | null
          endereco?: Json | null
          formato_data?: string | null
          fuso_horario?: string | null
          horario_funcionamento?: Json | null
          id?: string
          mensagem_ausencia?: string | null
          moeda?: string | null
          nome: string
          organization_id?: string | null
          telefone?: string | null
          url_logo?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string | null
          cnpj?: string | null
          criado_em?: string | null
          email?: string | null
          endereco?: Json | null
          formato_data?: string | null
          fuso_horario?: string | null
          horario_funcionamento?: Json | null
          id?: string
          mensagem_ausencia?: string | null
          moeda?: string | null
          nome?: string
          organization_id?: string | null
          telefone?: string | null
          url_logo?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_clinica_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      criativo_biblioteca: {
        Row: {
          altura: number | null
          atualizado_em: string | null
          criado_em: string | null
          data_fim_veiculacao: string | null
          data_inicio_veiculacao: string | null
          descricao: string | null
          duracao_segundos: number | null
          fixado: boolean | null
          id: string
          largura: number | null
          meta_ad_id: string | null
          nome: string
          notas: string | null
          ordem: number | null
          organization_id: string
          pasta_id: string | null
          status: string | null
          storage_path: string | null
          tags: string[] | null
          tamanho_bytes: number | null
          tipo: string | null
          url_arquivo: string
          url_thumbnail: string | null
        }
        Insert: {
          altura?: number | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_fim_veiculacao?: string | null
          data_inicio_veiculacao?: string | null
          descricao?: string | null
          duracao_segundos?: number | null
          fixado?: boolean | null
          id?: string
          largura?: number | null
          meta_ad_id?: string | null
          nome: string
          notas?: string | null
          ordem?: number | null
          organization_id: string
          pasta_id?: string | null
          status?: string | null
          storage_path?: string | null
          tags?: string[] | null
          tamanho_bytes?: number | null
          tipo?: string | null
          url_arquivo: string
          url_thumbnail?: string | null
        }
        Update: {
          altura?: number | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_fim_veiculacao?: string | null
          data_inicio_veiculacao?: string | null
          descricao?: string | null
          duracao_segundos?: number | null
          fixado?: boolean | null
          id?: string
          largura?: number | null
          meta_ad_id?: string | null
          nome?: string
          notas?: string | null
          ordem?: number | null
          organization_id?: string
          pasta_id?: string | null
          status?: string | null
          storage_path?: string | null
          tags?: string[] | null
          tamanho_bytes?: number | null
          tipo?: string | null
          url_arquivo?: string
          url_thumbnail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criativo_biblioteca_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criativo_biblioteca_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "criativo_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      criativo_notas: {
        Row: {
          atualizado_em: string | null
          conteudo: string
          criado_em: string | null
          criativo_id: string | null
          id: string
          organization_id: string | null
          usuario_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          conteudo: string
          criado_em?: string | null
          criativo_id?: string | null
          id?: string
          organization_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          conteudo?: string
          criado_em?: string | null
          criativo_id?: string | null
          id?: string
          organization_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criativo_notas_criativo_id_fkey"
            columns: ["criativo_id"]
            isOneToOne: false
            referencedRelation: "criativo_biblioteca"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criativo_notas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      criativo_pastas: {
        Row: {
          atualizado_em: string | null
          cor: string | null
          criado_em: string | null
          data_fim_veiculacao: string | null
          data_inicio_veiculacao: string | null
          descricao: string | null
          fixado: boolean | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          organization_id: string
          pasta_pai_id: string | null
          status: string | null
        }
        Insert: {
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          data_fim_veiculacao?: string | null
          data_inicio_veiculacao?: string | null
          descricao?: string | null
          fixado?: boolean | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          organization_id: string
          pasta_pai_id?: string | null
          status?: string | null
        }
        Update: {
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          data_fim_veiculacao?: string | null
          data_inicio_veiculacao?: string | null
          descricao?: string | null
          fixado?: boolean | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          organization_id?: string
          pasta_pai_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criativo_pastas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criativo_pastas_pasta_pai_id_fkey"
            columns: ["pasta_pai_id"]
            isOneToOne: false
            referencedRelation: "criativo_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      criativos: {
        Row: {
          aplicativo: string | null
          atualizado_em: string | null
          conteudo: string | null
          criado_em: string | null
          id: string
          id_externo: string | null
          nome: string | null
          organization_id: string
          plataforma: string | null
          platform_metrics: Json | null
          titulo: string | null
          url_midia: string | null
          url_thumbnail: string | null
        }
        Insert: {
          aplicativo?: string | null
          atualizado_em?: string | null
          conteudo?: string | null
          criado_em?: string | null
          id?: string
          id_externo?: string | null
          nome?: string | null
          organization_id: string
          plataforma?: string | null
          platform_metrics?: Json | null
          titulo?: string | null
          url_midia?: string | null
          url_thumbnail?: string | null
        }
        Update: {
          aplicativo?: string | null
          atualizado_em?: string | null
          conteudo?: string | null
          criado_em?: string | null
          id?: string
          id_externo?: string | null
          nome?: string | null
          organization_id?: string
          plataforma?: string | null
          platform_metrics?: Json | null
          titulo?: string | null
          url_midia?: string | null
          url_thumbnail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criativos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_athos_conversations: {
        Row: {
          client_org_id: string | null
          created_at: string
          csm_id: string
          id: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          client_org_id?: string | null
          created_at?: string
          csm_id: string
          id?: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          client_org_id?: string | null
          created_at?: string
          csm_id?: string
          id?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cs_athos_memories: {
        Row: {
          atualizado_em: string
          client_org_id: string | null
          conteudo: string
          criado_em: string
          csm_id: string
          fonte_conversation_id: string | null
          id: string
          tags: string[]
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          client_org_id?: string | null
          conteudo: string
          criado_em?: string
          csm_id: string
          fonte_conversation_id?: string | null
          id?: string
          tags?: string[]
          tipo?: string
        }
        Update: {
          atualizado_em?: string
          client_org_id?: string | null
          conteudo?: string
          criado_em?: string
          csm_id?: string
          fonte_conversation_id?: string | null
          id?: string
          tags?: string[]
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_athos_memories_fonte_conversation_id_fkey"
            columns: ["fonte_conversation_id"]
            isOneToOne: false
            referencedRelation: "cs_athos_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_athos_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          role: string
          tool_calls: Json | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_athos_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "cs_athos_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_client_protocols: {
        Row: {
          client_id: string
          id: string
          iniciado_em: string
          notas: string | null
          passo_atual: string | null
          passos_concluidos: Json
          status: string
          tipo: string
          tipo_risco: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          id?: string
          iniciado_em?: string
          notas?: string | null
          passo_atual?: string | null
          passos_concluidos?: Json
          status?: string
          tipo: string
          tipo_risco?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          id?: string
          iniciado_em?: string
          notas?: string | null
          passo_atual?: string | null
          passos_concluidos?: Json
          status?: string
          tipo?: string
          tipo_risco?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_client_protocols_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_crm_snapshots: {
        Row: {
          created_at: string
          fat_30d: number | null
          fat_growth_pct: number | null
          fech_30d: number | null
          id: string
          organization_id: string
          resultado_score: number | null
          snapshot_date: string
          tempo_1o_min: number | null
          tx_fech: number | null
        }
        Insert: {
          created_at?: string
          fat_30d?: number | null
          fat_growth_pct?: number | null
          fech_30d?: number | null
          id?: string
          organization_id: string
          resultado_score?: number | null
          snapshot_date?: string
          tempo_1o_min?: number | null
          tx_fech?: number | null
        }
        Update: {
          created_at?: string
          fat_30d?: number | null
          fat_growth_pct?: number | null
          fech_30d?: number | null
          id?: string
          organization_id?: string
          resultado_score?: number | null
          snapshot_date?: string
          tempo_1o_min?: number | null
          tx_fech?: number | null
        }
        Relationships: []
      }
      cs_depoimentos: {
        Row: {
          client_id: string
          coletado_em: string
          coletado_por: string | null
          conteudo: string | null
          created_at: string
          formato: string
          id: string
          link_externo: string | null
          notas: string | null
        }
        Insert: {
          client_id: string
          coletado_em?: string
          coletado_por?: string | null
          conteudo?: string | null
          created_at?: string
          formato: string
          id?: string
          link_externo?: string | null
          notas?: string | null
        }
        Update: {
          client_id?: string
          coletado_em?: string
          coletado_por?: string | null
          conteudo?: string | null
          created_at?: string
          formato?: string
          id?: string
          link_externo?: string | null
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_depoimentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_health_scores: {
        Row: {
          avaliado_em: string
          avaliado_por: string | null
          client_id: string
          created_at: string
          dim_arsenal: number
          dim_ativacao: number
          dim_crm: number
          dim_crm_label: string | null
          dim_jornada: number
          dim_responsividade: number
          id: string
          notas_csm: string | null
          score_total: number | null
          status_calculado: string | null
        }
        Insert: {
          avaliado_em?: string
          avaliado_por?: string | null
          client_id: string
          created_at?: string
          dim_arsenal?: number
          dim_ativacao?: number
          dim_crm?: number
          dim_crm_label?: string | null
          dim_jornada?: number
          dim_responsividade?: number
          id?: string
          notas_csm?: string | null
          score_total?: number | null
          status_calculado?: string | null
        }
        Update: {
          avaliado_em?: string
          avaliado_por?: string | null
          client_id?: string
          created_at?: string
          dim_arsenal?: number
          dim_ativacao?: number
          dim_crm?: number
          dim_crm_label?: string | null
          dim_jornada?: number
          dim_responsividade?: number
          id?: string
          notas_csm?: string | null
          score_total?: number | null
          status_calculado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_health_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_marcos: {
        Row: {
          atingido: boolean
          atingido_em: string | null
          automatico: boolean
          client_id: string
          created_at: string
          id: string
          marco: string
          notas: string | null
        }
        Insert: {
          atingido?: boolean
          atingido_em?: string | null
          automatico?: boolean
          client_id: string
          created_at?: string
          id?: string
          marco: string
          notas?: string | null
        }
        Update: {
          atingido?: boolean
          atingido_em?: string | null
          automatico?: boolean
          client_id?: string
          created_at?: string
          id?: string
          marco?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_marcos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_nps_campanhas: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          client_id: string
          created_at: string
          disparado_em: string
          disparado_por: string | null
          id: string
          respondido_em: string | null
          snooze_count: number
          snoozed_until: string | null
          status: string
          template_id: string
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          client_id: string
          created_at?: string
          disparado_em?: string
          disparado_por?: string | null
          id?: string
          respondido_em?: string | null
          snooze_count?: number
          snoozed_until?: string | null
          status?: string
          template_id: string
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          client_id?: string
          created_at?: string
          disparado_em?: string
          disparado_por?: string | null
          id?: string
          respondido_em?: string | null
          snooze_count?: number
          snoozed_until?: string | null
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_nps_campanhas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_nps_campanhas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cs_nps_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_nps_perguntas: {
        Row: {
          created_at: string
          dimensao: string
          id: string
          obrigatoria: boolean
          ordem: number
          template_id: string
          texto: string
          tipo: string
          variaveis: string[] | null
        }
        Insert: {
          created_at?: string
          dimensao: string
          id?: string
          obrigatoria?: boolean
          ordem?: number
          template_id: string
          texto: string
          tipo: string
          variaveis?: string[] | null
        }
        Update: {
          created_at?: string
          dimensao?: string
          id?: string
          obrigatoria?: boolean
          ordem?: number
          template_id?: string
          texto?: string
          tipo?: string
          variaveis?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_nps_perguntas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cs_nps_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_nps_responses: {
        Row: {
          campanha_id: string | null
          client_id: string
          coletado_por: string | null
          comentario: string | null
          created_at: string
          id: string
          respondido_em: string
          score: number
        }
        Insert: {
          campanha_id?: string | null
          client_id: string
          coletado_por?: string | null
          comentario?: string | null
          created_at?: string
          id?: string
          respondido_em?: string
          score: number
        }
        Update: {
          campanha_id?: string | null
          client_id?: string
          coletado_por?: string | null
          comentario?: string | null
          created_at?: string
          id?: string
          respondido_em?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "cs_nps_responses_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "cs_nps_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_nps_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_nps_respostas_detalhe: {
        Row: {
          campanha_id: string
          created_at: string
          dimensao: string
          id: string
          pergunta_id: string | null
          texto_pergunta: string
          valor_numero: number | null
          valor_texto: string | null
        }
        Insert: {
          campanha_id: string
          created_at?: string
          dimensao: string
          id?: string
          pergunta_id?: string | null
          texto_pergunta: string
          valor_numero?: number | null
          valor_texto?: string | null
        }
        Update: {
          campanha_id?: string
          created_at?: string
          dimensao?: string
          id?: string
          pergunta_id?: string | null
          texto_pergunta?: string
          valor_numero?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_nps_respostas_detalhe_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "cs_nps_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_nps_respostas_detalhe_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "cs_nps_perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_nps_templates: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      cs_renovacoes: {
        Row: {
          client_id: string
          created_at: string
          data_vencimento: string
          id: string
          notas: string | null
          status: string
          updated_at: string
          valor_contrato: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          data_vencimento: string
          id?: string
          notas?: string | null
          status?: string
          updated_at?: string
          valor_contrato?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          data_vencimento?: string
          id?: string
          notas?: string | null
          status?: string
          updated_at?: string
          valor_contrato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_renovacoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_templates: {
        Row: {
          ativo: boolean
          categoria: string
          conteudo: string
          created_at: string
          fase: string | null
          id: string
          nome: string
          variaveis: string[] | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          conteudo: string
          created_at?: string
          fase?: string | null
          id?: string
          nome: string
          variaveis?: string[] | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          conteudo?: string
          created_at?: string
          fase?: string | null
          id?: string
          nome?: string
          variaveis?: string[] | null
        }
        Relationships: []
      }
      cs_touchpoints: {
        Row: {
          client_id: string
          cliente_faltou: boolean | null
          created_at: string
          csm_id: string | null
          data_contato: string
          duracao_minutos: number | null
          id: string
          notas: string | null
          playbook_passo: string | null
          playbook_tipo: string | null
          proximo_contato: string | null
          resultado: string
          sinal_risco: number | null
          tipo: string
        }
        Insert: {
          client_id: string
          cliente_faltou?: boolean | null
          created_at?: string
          csm_id?: string | null
          data_contato?: string
          duracao_minutos?: number | null
          id?: string
          notas?: string | null
          playbook_passo?: string | null
          playbook_tipo?: string | null
          proximo_contato?: string | null
          resultado: string
          sinal_risco?: number | null
          tipo: string
        }
        Update: {
          client_id?: string
          cliente_faltou?: boolean | null
          created_at?: string
          csm_id?: string | null
          data_contato?: string
          duracao_minutos?: number | null
          id?: string
          notas?: string | null
          playbook_passo?: string | null
          playbook_tipo?: string | null
          proximo_contato?: string | null
          resultado?: string
          sinal_risco?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_touchpoints_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_payloads: {
        Row: {
          created_at: string
          id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      documentos: {
        Row: {
          atualizado_em: string | null
          conteudo: string | null
          criado_em: string | null
          id: string
          nome_pasta: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string | null
          conteudo?: string | null
          criado_em?: string | null
          id?: string
          nome_pasta?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string | null
          conteudo?: string | null
          criado_em?: string | null
          id?: string
          nome_pasta?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      entregaveis: {
        Row: {
          atualizado_em: string | null
          categoria: string | null
          checklist: Json | null
          cliente_id: string | null
          criado_em: string | null
          criado_por: string | null
          data_conclusao: string | null
          data_inicio: string | null
          data_prevista: string | null
          deletado_em: string | null
          descricao: string | null
          id: string
          mes_relacionado: number | null
          metadados: Json | null
          observacoes: string | null
          pilar: string | null
          prioridade: string | null
          progresso: number | null
          responsavel_id: string | null
          status: string | null
          subcategoria: string | null
          titulo: string
        }
        Insert: {
          atualizado_em?: string | null
          categoria?: string | null
          checklist?: Json | null
          cliente_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_prevista?: string | null
          deletado_em?: string | null
          descricao?: string | null
          id?: string
          mes_relacionado?: number | null
          metadados?: Json | null
          observacoes?: string | null
          pilar?: string | null
          prioridade?: string | null
          progresso?: number | null
          responsavel_id?: string | null
          status?: string | null
          subcategoria?: string | null
          titulo: string
        }
        Update: {
          atualizado_em?: string | null
          categoria?: string | null
          checklist?: Json | null
          cliente_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_prevista?: string | null
          deletado_em?: string | null
          descricao?: string | null
          id?: string
          mes_relacionado?: number | null
          metadados?: Json | null
          observacoes?: string | null
          pilar?: string | null
          prioridade?: string | null
          progresso?: number | null
          responsavel_id?: string | null
          status?: string | null
          subcategoria?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregaveis_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas: {
        Row: {
          cor: string
          criado_em: string | null
          em_funil: boolean | null
          id: number
          nome: string
          organization_id: string | null
          posicao_ordem: number | null
        }
        Insert: {
          cor: string
          criado_em?: string | null
          em_funil?: boolean | null
          id?: number
          nome: string
          organization_id?: string | null
          posicao_ordem?: number | null
        }
        Update: {
          cor?: string
          criado_em?: string | null
          em_funil?: boolean | null
          id?: number
          nome?: string
          organization_id?: string | null
          posicao_ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "etapas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fontes: {
        Row: {
          criado_em: string | null
          id: string
          nome: string
          organization_id: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          nome: string
          organization_id: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          nome?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fontes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_followup_config: {
        Row: {
          apenas_marketing: boolean | null
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          id: string
          organization_id: string
          respeitar_horario_atendimento: boolean | null
          sequencia: Json | null
        }
        Insert: {
          apenas_marketing?: boolean | null
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          organization_id: string
          respeitar_horario_atendimento?: boolean | null
          sequencia?: Json | null
        }
        Update: {
          apenas_marketing?: boolean | null
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          organization_id?: string
          respeitar_horario_atendimento?: boolean | null
          sequencia?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_followup_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_followup_log: {
        Row: {
          enviado_em: string | null
          id: string
          lead_id: string | null
          mensagem_enviada: string | null
          motivo_ia: string | null
          organization_id: string | null
          status: string | null
          tentativa: number
          tipo: string
        }
        Insert: {
          enviado_em?: string | null
          id?: string
          lead_id?: string | null
          mensagem_enviada?: string | null
          motivo_ia?: string | null
          organization_id?: string | null
          status?: string | null
          tentativa: number
          tipo?: string
        }
        Update: {
          enviado_em?: string | null
          id?: string
          lead_id?: string | null
          mensagem_enviada?: string | null
          motivo_ia?: string | null
          organization_id?: string | null
          status?: string | null
          tentativa?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_followup_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_followup_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes: {
        Row: {
          atualizado_em: string | null
          configuracoes: Json | null
          credenciais: Json | null
          criado_em: string | null
          id: string
          nome: string
          organization_id: string | null
          status: string | null
          tipo: string
          ultima_sincronizacao: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string | null
          configuracoes?: Json | null
          credenciais?: Json | null
          criado_em?: string | null
          id?: string
          nome: string
          organization_id?: string | null
          status?: string | null
          tipo: string
          ultima_sincronizacao?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string | null
          configuracoes?: Json | null
          credenciais?: Json | null
          criado_em?: string | null
          id?: string
          nome?: string
          organization_id?: string | null
          status?: string | null
          tipo?: string
          ultima_sincronizacao?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_ai_chat_messages: {
        Row: {
          cadencia_gerada_id: string | null
          content: string
          criado_em: string | null
          id: string
          lead_id: string | null
          organization_id: string | null
          role: string
          usuario_id: string | null
        }
        Insert: {
          cadencia_gerada_id?: string | null
          content: string
          criado_em?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          role: string
          usuario_id?: string | null
        }
        Update: {
          cadencia_gerada_id?: string | null
          content?: string
          criado_em?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          role?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_ai_chat_messages_cadencia_gerada_id_fkey"
            columns: ["cadencia_gerada_id"]
            isOneToOne: false
            referencedRelation: "cadencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_ai_chat_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_ai_chat_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_estagios: {
        Row: {
          created_at: string
          data_inicio: string | null
          descricao: string | null
          id: string
          jornada_id: string
          ordem: number
          prazo_dias: number
          titulo: string
        }
        Insert: {
          created_at?: string
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          jornada_id: string
          ordem?: number
          prazo_dias?: number
          titulo: string
        }
        Update: {
          created_at?: string
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          jornada_id?: string
          ordem?: number
          prazo_dias?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_estagios_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_passos: {
        Row: {
          aula_id: string | null
          categoria_id: string | null
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          conteudo_md: string | null
          created_at: string
          descricao: string | null
          estagio_id: string
          ferramenta_id: string | null
          id: string
          material_brief: string | null
          material_categoria: string | null
          material_id: string | null
          obrigatorio: boolean
          ordem: number
          origem_passo_id: string | null
          prazo_dias: number | null
          tipo: string
          titulo: string
        }
        Insert: {
          aula_id?: string | null
          categoria_id?: string | null
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          conteudo_md?: string | null
          created_at?: string
          descricao?: string | null
          estagio_id: string
          ferramenta_id?: string | null
          id?: string
          material_brief?: string | null
          material_categoria?: string | null
          material_id?: string | null
          obrigatorio?: boolean
          ordem?: number
          origem_passo_id?: string | null
          prazo_dias?: number | null
          tipo?: string
          titulo: string
        }
        Update: {
          aula_id?: string | null
          categoria_id?: string | null
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          conteudo_md?: string | null
          created_at?: string
          descricao?: string | null
          estagio_id?: string
          ferramenta_id?: string | null
          id?: string
          material_brief?: string | null
          material_categoria?: string | null
          material_id?: string | null
          obrigatorio?: boolean
          ordem?: number
          origem_passo_id?: string | null
          prazo_dias?: number | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_passos_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "arsenal_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_passos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "arsenal_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_passos_estagio_id_fkey"
            columns: ["estagio_id"]
            isOneToOne: false
            referencedRelation: "jornada_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_passos_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "arsenal_ferramentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_passos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "meus_materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_passos_origem_passo_id_fkey"
            columns: ["origem_passo_id"]
            isOneToOne: false
            referencedRelation: "jornada_passos"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_subtarefas: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          id: string
          ordem: number
          passo_id: string
          titulo: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          id?: string
          ordem?: number
          passo_id: string
          titulo: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          id?: string
          ordem?: number
          passo_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_subtarefas_passo_id_fkey"
            columns: ["passo_id"]
            isOneToOne: false
            referencedRelation: "jornada_passos"
            referencedColumns: ["id"]
          },
        ]
      }
      jornadas: {
        Row: {
          created_at: string
          gerada_por: string
          id: string
          organization_id: string | null
          periodo_ref: string | null
          status: string
          tipo: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gerada_por?: string
          id?: string
          organization_id?: string | null
          periodo_ref?: string | null
          status?: string
          tipo?: string | null
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gerada_por?: string
          id?: string
          organization_id?: string | null
          periodo_ref?: string | null
          status?: string
          tipo?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_jornadas_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_artigos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          conteudo: string
          created_at: string | null
          id: string
          tags: string[] | null
          titulo: string
          updated_at: string | null
          visualizacoes: number
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          conteudo: string
          created_at?: string | null
          id?: string
          tags?: string[] | null
          titulo: string
          updated_at?: string | null
          visualizacoes?: number
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          conteudo?: string
          created_at?: string | null
          id?: string
          tags?: string[] | null
          titulo?: string
          updated_at?: string | null
          visualizacoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_artigos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "kb_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categorias: {
        Row: {
          ativo: boolean
          created_at: string | null
          descricao: string | null
          icone: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          descricao?: string | null
          icone?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          descricao?: string | null
          icone?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      lead_atividades: {
        Row: {
          criado_em: string
          descricao: string
          id: string
          lead_id: string
          metadados: Json
          organization_id: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          criado_em?: string
          descricao: string
          id?: string
          lead_id: string
          metadados?: Json
          organization_id: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          criado_em?: string
          descricao?: string
          id?: string
          lead_id?: string
          metadados?: Json
          organization_id?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_atividades_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_blacklist: {
        Row: {
          blocked_by: string | null
          created_at: string
          id: string
          motivo: string | null
          organization_id: string
          telefone: string
          telefone_normalizado: string
          updated_at: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          organization_id: string
          telefone: string
          telefone_normalizado: string
          updated_at?: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          organization_id?: string
          telefone?: string
          telefone_normalizado?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_blacklist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_cadencias: {
        Row: {
          cadencia_id: string
          criado_em: string | null
          dispatch_id: string | null
          erro_log: string | null
          id: string
          lead_id: string
          organization_id: string
          passo_atual_ordem: number | null
          proxima_execucao: string | null
          status: string | null
          status_ultima_execucao: string | null
          ultima_execucao: string | null
        }
        Insert: {
          cadencia_id: string
          criado_em?: string | null
          dispatch_id?: string | null
          erro_log?: string | null
          id?: string
          lead_id: string
          organization_id: string
          passo_atual_ordem?: number | null
          proxima_execucao?: string | null
          status?: string | null
          status_ultima_execucao?: string | null
          ultima_execucao?: string | null
        }
        Update: {
          cadencia_id?: string
          criado_em?: string | null
          dispatch_id?: string | null
          erro_log?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          passo_atual_ordem?: number | null
          proxima_execucao?: string | null
          status?: string | null
          status_ultima_execucao?: string | null
          ultima_execucao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_cadencias_cadencia_id_fkey"
            columns: ["cadencia_id"]
            isOneToOne: false
            referencedRelation: "cadencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cadencias_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "cadence_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cadencias_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cadencias_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_documento_pastas: {
        Row: {
          criado_em: string
          criado_por: string | null
          id: string
          lead_id: string
          nome: string
          organization_id: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          lead_id: string
          nome: string
          organization_id: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          lead_id?: string
          nome?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_documento_pastas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_documentos: {
        Row: {
          criado_em: string
          criado_por: string | null
          id: string
          lead_id: string
          nome_arquivo: string
          organization_id: string
          pasta_id: string | null
          storage_path: string
          tamanho_bytes: number | null
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          lead_id: string
          nome_arquivo: string
          organization_id: string
          pasta_id?: string | null
          storage_path: string
          tamanho_bytes?: number | null
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          lead_id?: string
          nome_arquivo?: string
          organization_id?: string
          pasta_id?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_documentos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_documentos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "lead_documento_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_fotos: {
        Row: {
          criado_em: string
          criado_por: string | null
          data_procedimento: string | null
          descricao: string | null
          id: string
          lead_id: string
          organization_id: string
          procedimento: string | null
          storage_path: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          data_procedimento?: string | null
          descricao?: string | null
          id?: string
          lead_id: string
          organization_id: string
          procedimento?: string | null
          storage_path: string
          tipo: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          data_procedimento?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          procedimento?: string | null
          storage_path?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_fotos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notas: {
        Row: {
          atualizado_em: string | null
          conteudo: string
          criado_em: string | null
          editado: boolean | null
          id: string
          lead_id: string
          metadados: Json | null
          organization_id: string
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          conteudo: string
          criado_em?: string | null
          editado?: boolean | null
          id?: string
          lead_id: string
          metadados?: Json | null
          organization_id: string
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          conteudo?: string
          criado_em?: string | null
          editado?: boolean | null
          id?: string
          lead_id?: string
          metadados?: Json | null
          organization_id?: string
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          entered_at: string | null
          from_stage_position: number | null
          id: string
          lead_id: string
          organization_id: string
          stage_position: number
          user_id: string | null
        }
        Insert: {
          entered_at?: string | null
          from_stage_position?: number | null
          id?: string
          lead_id: string
          organization_id: string
          stage_position: number
          user_id?: string | null
        }
        Update: {
          entered_at?: string | null
          from_stage_position?: number | null
          id?: string
          lead_id?: string
          organization_id?: string
          stage_position?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agendamento: string | null
          ai_pending_since: string | null
          atualizado_em: string | null
          cpf: string | null
          criado_em: string | null
          criativo_id: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          enriquecido_em: string | null
          excluir_metricas: boolean
          followup_gap: string | null
          followup_gap_analisado_em: string | null
          followup_gap_motivo: string | null
          followup_manual: boolean | null
          followup_pausado: boolean | null
          followup_tentativas: number | null
          followup_ultima_tentativa: string | null
          fonte: string | null
          genero: string | null
          ia_ativa: boolean | null
          ia_ja_ativada: boolean | null
          ia_paused_until: string | null
          id: string
          idade: number | null
          is_closed: boolean | null
          is_qualified: boolean
          is_scheduled: boolean | null
          lead_scoring: string | null
          meta_ad_platform: string | null
          meta_ad_source_id: string | null
          meta_ad_thumbnail: string | null
          meta_ad_title: string | null
          nome: string | null
          objecao: string | null
          objetivo: string | null
          organization_id: string | null
          origem: string | null
          posicao_pipeline: number | null
          precisa_enriquecer: boolean
          procedimento_interesse: string | null
          queixa_principal: string | null
          responsavel_id: string | null
          resumo: string | null
          status: string | null
          telefone: string
          ultimo_contato: string | null
          usuario_id: string
        }
        Insert: {
          agendamento?: string | null
          ai_pending_since?: string | null
          atualizado_em?: string | null
          cpf?: string | null
          criado_em?: string | null
          criativo_id?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          enriquecido_em?: string | null
          excluir_metricas?: boolean
          followup_gap?: string | null
          followup_gap_analisado_em?: string | null
          followup_gap_motivo?: string | null
          followup_manual?: boolean | null
          followup_pausado?: boolean | null
          followup_tentativas?: number | null
          followup_ultima_tentativa?: string | null
          fonte?: string | null
          genero?: string | null
          ia_ativa?: boolean | null
          ia_ja_ativada?: boolean | null
          ia_paused_until?: string | null
          id?: string
          idade?: number | null
          is_closed?: boolean | null
          is_qualified?: boolean
          is_scheduled?: boolean | null
          lead_scoring?: string | null
          meta_ad_platform?: string | null
          meta_ad_source_id?: string | null
          meta_ad_thumbnail?: string | null
          meta_ad_title?: string | null
          nome?: string | null
          objecao?: string | null
          objetivo?: string | null
          organization_id?: string | null
          origem?: string | null
          posicao_pipeline?: number | null
          precisa_enriquecer?: boolean
          procedimento_interesse?: string | null
          queixa_principal?: string | null
          responsavel_id?: string | null
          resumo?: string | null
          status?: string | null
          telefone: string
          ultimo_contato?: string | null
          usuario_id: string
        }
        Update: {
          agendamento?: string | null
          ai_pending_since?: string | null
          atualizado_em?: string | null
          cpf?: string | null
          criado_em?: string | null
          criativo_id?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          enriquecido_em?: string | null
          excluir_metricas?: boolean
          followup_gap?: string | null
          followup_gap_analisado_em?: string | null
          followup_gap_motivo?: string | null
          followup_manual?: boolean | null
          followup_pausado?: boolean | null
          followup_tentativas?: number | null
          followup_ultima_tentativa?: string | null
          fonte?: string | null
          genero?: string | null
          ia_ativa?: boolean | null
          ia_ja_ativada?: boolean | null
          ia_paused_until?: string | null
          id?: string
          idade?: number | null
          is_closed?: boolean | null
          is_qualified?: boolean
          is_scheduled?: boolean | null
          lead_scoring?: string | null
          meta_ad_platform?: string | null
          meta_ad_source_id?: string | null
          meta_ad_thumbnail?: string | null
          meta_ad_title?: string | null
          nome?: string | null
          objecao?: string | null
          objetivo?: string | null
          organization_id?: string | null
          origem?: string | null
          posicao_pipeline?: number | null
          precisa_enriquecer?: boolean
          procedimento_interesse?: string | null
          queixa_principal?: string | null
          responsavel_id?: string | null
          resumo?: string | null
          status?: string | null
          telefone?: string
          ultimo_contato?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_criativo_id_fkey"
            columns: ["criativo_id"]
            isOneToOne: false
            referencedRelation: "criativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_tags: {
        Row: {
          assigned_at: string | null
          lead_id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string | null
          lead_id: string
          tag_id: string
        }
        Update: {
          assigned_at?: string | null
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_expenses: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          expense_date: string
          id: string
          organization_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          organization_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_score_config: {
        Row: {
          agendamento_aceitavel: number | null
          agendamento_bom: number | null
          agendamento_otimo: number | null
          atualizado_em: string | null
          cor_escalar: string | null
          cor_manter: string | null
          cor_monitorar: string | null
          cor_pausar: string | null
          cpl_aceitavel: number | null
          cpl_bom: number | null
          cpl_otimo: number | null
          cpmql_a_aceitavel: number | null
          cpmql_a_bom: number | null
          cpmql_a_otimo: number | null
          cpmql_b_aceitavel: number | null
          cpmql_b_bom: number | null
          cpmql_b_otimo: number | null
          criado_em: string | null
          ctr_aceitavel: number | null
          ctr_bom: number | null
          ctr_otimo: number | null
          fechamento_aceitavel: number | null
          fechamento_bom: number | null
          fechamento_otimo: number | null
          gasto_alerta_sem_leads: number | null
          id: string
          leads_minimo: number | null
          organization_id: string | null
          peso_agendamento: number | null
          peso_consistencia: number | null
          peso_cpl: number | null
          peso_cpmql_a: number | null
          peso_cpmql_b: number | null
          peso_ctr: number | null
          peso_fechamento: number | null
          peso_leads: number | null
          tag_escalar: string | null
          tag_manter: string | null
          tag_monitorar: string | null
          tag_pausar: string | null
        }
        Insert: {
          agendamento_aceitavel?: number | null
          agendamento_bom?: number | null
          agendamento_otimo?: number | null
          atualizado_em?: string | null
          cor_escalar?: string | null
          cor_manter?: string | null
          cor_monitorar?: string | null
          cor_pausar?: string | null
          cpl_aceitavel?: number | null
          cpl_bom?: number | null
          cpl_otimo?: number | null
          cpmql_a_aceitavel?: number | null
          cpmql_a_bom?: number | null
          cpmql_a_otimo?: number | null
          cpmql_b_aceitavel?: number | null
          cpmql_b_bom?: number | null
          cpmql_b_otimo?: number | null
          criado_em?: string | null
          ctr_aceitavel?: number | null
          ctr_bom?: number | null
          ctr_otimo?: number | null
          fechamento_aceitavel?: number | null
          fechamento_bom?: number | null
          fechamento_otimo?: number | null
          gasto_alerta_sem_leads?: number | null
          id?: string
          leads_minimo?: number | null
          organization_id?: string | null
          peso_agendamento?: number | null
          peso_consistencia?: number | null
          peso_cpl?: number | null
          peso_cpmql_a?: number | null
          peso_cpmql_b?: number | null
          peso_ctr?: number | null
          peso_fechamento?: number | null
          peso_leads?: number | null
          tag_escalar?: string | null
          tag_manter?: string | null
          tag_monitorar?: string | null
          tag_pausar?: string | null
        }
        Update: {
          agendamento_aceitavel?: number | null
          agendamento_bom?: number | null
          agendamento_otimo?: number | null
          atualizado_em?: string | null
          cor_escalar?: string | null
          cor_manter?: string | null
          cor_monitorar?: string | null
          cor_pausar?: string | null
          cpl_aceitavel?: number | null
          cpl_bom?: number | null
          cpl_otimo?: number | null
          cpmql_a_aceitavel?: number | null
          cpmql_a_bom?: number | null
          cpmql_a_otimo?: number | null
          cpmql_b_aceitavel?: number | null
          cpmql_b_bom?: number | null
          cpmql_b_otimo?: number | null
          criado_em?: string | null
          ctr_aceitavel?: number | null
          ctr_bom?: number | null
          ctr_otimo?: number | null
          fechamento_aceitavel?: number | null
          fechamento_bom?: number | null
          fechamento_otimo?: number | null
          gasto_alerta_sem_leads?: number | null
          id?: string
          leads_minimo?: number | null
          organization_id?: string | null
          peso_agendamento?: number | null
          peso_consistencia?: number | null
          peso_cpl?: number | null
          peso_cpmql_a?: number | null
          peso_cpmql_b?: number | null
          peso_ctr?: number | null
          peso_fechamento?: number | null
          peso_leads?: number | null
          tag_escalar?: string | null
          tag_manter?: string | null
          tag_monitorar?: string | null
          tag_pausar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_score_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memoria_agente: {
        Row: {
          id: number
          message: Json
          organization_id: string | null
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          organization_id?: string | null
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          organization_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memoria_agente_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          automatica: boolean
          conteudo: string | null
          criado_em: string | null
          direcao: string
          edited_at: string | null
          id: string
          id_mensagem: string | null
          is_edited: boolean | null
          lead_id: string | null
          media_path: string | null
          organization_id: string | null
          original_content: string | null
          quoted_message_id: string | null
          remetente: string
          tipo_conteudo: string | null
          user_id: string | null
        }
        Insert: {
          automatica?: boolean
          conteudo?: string | null
          criado_em?: string | null
          direcao: string
          edited_at?: string | null
          id?: string
          id_mensagem?: string | null
          is_edited?: boolean | null
          lead_id?: string | null
          media_path?: string | null
          organization_id?: string | null
          original_content?: string | null
          quoted_message_id?: string | null
          remetente: string
          tipo_conteudo?: string | null
          user_id?: string | null
        }
        Update: {
          automatica?: boolean
          conteudo?: string | null
          criado_em?: string | null
          direcao?: string
          edited_at?: string | null
          id?: string
          id_mensagem?: string | null
          is_edited?: boolean | null
          lead_id?: string | null
          media_path?: string | null
          organization_id?: string | null
          original_content?: string | null
          quoted_message_id?: string | null
          remetente?: string
          tipo_conteudo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_chat: {
        Row: {
          conteudo: string | null
          criado_em: string | null
          dados_prompts: Json | null
          id: string
          tipo: string
          usuario_id: string
        }
        Insert: {
          conteudo?: string | null
          criado_em?: string | null
          dados_prompts?: Json | null
          id?: string
          tipo: string
          usuario_id: string
        }
        Update: {
          conteudo?: string | null
          criado_em?: string | null
          dados_prompts?: Json | null
          id?: string
          tipo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          created_at: string | null
          file_path: string
          file_type: string
          id: string
          message_id: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_path: string
          file_type: string
          id?: string
          message_id: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_path?: string
          file_type?: string
          id?: string
          message_id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          criativo_id: string | null
          id: string
          meta_ad_id: string
          meta_adset_id: string | null
          meta_campaign_id: string | null
          nome: string | null
          organization_id: string | null
          status: string | null
          url_thumbnail: string | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          criativo_id?: string | null
          id?: string
          meta_ad_id: string
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          nome?: string | null
          organization_id?: string | null
          status?: string | null
          url_thumbnail?: string | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          criativo_id?: string | null
          id?: string
          meta_ad_id?: string
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          nome?: string | null
          organization_id?: string | null
          status?: string | null
          url_thumbnail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_criativo_id_fkey"
            columns: ["criativo_id"]
            isOneToOne: false
            referencedRelation: "criativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_meta_adset_id_fkey"
            columns: ["meta_adset_id"]
            isOneToOne: false
            referencedRelation: "meta_adsets"
            referencedColumns: ["meta_adset_id"]
          },
          {
            foreignKeyName: "meta_ads_meta_campaign_id_fkey"
            columns: ["meta_campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["meta_campaign_id"]
          },
          {
            foreignKeyName: "meta_ads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_adsets: {
        Row: {
          atualizado_em: string | null
          billing_event: string | null
          budget_diario: number | null
          budget_total: number | null
          criado_em: string | null
          id: string
          meta_adset_id: string
          meta_campaign_id: string | null
          nome: string | null
          optimization_goal: string | null
          organization_id: string | null
          status: string | null
          targeting: Json | null
        }
        Insert: {
          atualizado_em?: string | null
          billing_event?: string | null
          budget_diario?: number | null
          budget_total?: number | null
          criado_em?: string | null
          id?: string
          meta_adset_id: string
          meta_campaign_id?: string | null
          nome?: string | null
          optimization_goal?: string | null
          organization_id?: string | null
          status?: string | null
          targeting?: Json | null
        }
        Update: {
          atualizado_em?: string | null
          billing_event?: string | null
          budget_diario?: number | null
          budget_total?: number | null
          criado_em?: string | null
          id?: string
          meta_adset_id?: string
          meta_campaign_id?: string | null
          nome?: string | null
          optimization_goal?: string | null
          organization_id?: string | null
          status?: string | null
          targeting?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_adsets_meta_campaign_id_fkey"
            columns: ["meta_campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["meta_campaign_id"]
          },
          {
            foreignKeyName: "meta_adsets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          data_fim: string | null
          data_inicio: string | null
          gasto_total: number | null
          id: string
          limite_gasto: number | null
          meta_campaign_id: string
          nome: string | null
          objetivo: string | null
          organization_id: string | null
          status: string | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          gasto_total?: number | null
          id?: string
          limite_gasto?: number | null
          meta_campaign_id: string
          nome?: string | null
          objetivo?: string | null
          organization_id?: string | null
          status?: string | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          gasto_total?: number | null
          id?: string
          limite_gasto?: number | null
          meta_campaign_id?: string
          nome?: string | null
          objetivo?: string | null
          organization_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_insights: {
        Row: {
          alcance: number | null
          cliques: number | null
          conversion_ranking: string | null
          cpc: number | null
          cpm: number | null
          cpp: number | null
          criado_em: string | null
          ctr: number | null
          data_ref: string
          engagement_ranking: string | null
          frequencia: number | null
          gasto: number | null
          id: string
          impressoes: number | null
          leads: number | null
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          nivel: string | null
          organization_id: string | null
          quality_ranking: string | null
          unique_clicks: number | null
          unique_ctr: number | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          video_views: number | null
        }
        Insert: {
          alcance?: number | null
          cliques?: number | null
          conversion_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          cpp?: number | null
          criado_em?: string | null
          ctr?: number | null
          data_ref: string
          engagement_ranking?: string | null
          frequencia?: number | null
          gasto?: number | null
          id?: string
          impressoes?: number | null
          leads?: number | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          nivel?: string | null
          organization_id?: string | null
          quality_ranking?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          video_views?: number | null
        }
        Update: {
          alcance?: number | null
          cliques?: number | null
          conversion_ranking?: string | null
          cpc?: number | null
          cpm?: number | null
          cpp?: number | null
          criado_em?: string | null
          ctr?: number | null
          data_ref?: string
          engagement_ranking?: string | null
          frequencia?: number | null
          gasto?: number | null
          id?: string
          impressoes?: number | null
          leads?: number | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          nivel?: string | null
          organization_id?: string | null
          quality_ranking?: string | null
          unique_clicks?: number | null
          unique_ctr?: number | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          video_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_lead_form_log: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          campaign_id: string | null
          dados_brutos: Json | null
          erro_msg: string | null
          form_id: string | null
          id: string
          lead_id: string | null
          meta_lead_id: string | null
          organization_id: string | null
          recebido_em: string | null
          status: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          campaign_id?: string | null
          dados_brutos?: Json | null
          erro_msg?: string | null
          form_id?: string | null
          id?: string
          lead_id?: string | null
          meta_lead_id?: string | null
          organization_id?: string | null
          recebido_em?: string | null
          status?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          campaign_id?: string | null
          dados_brutos?: Json | null
          erro_msg?: string | null
          form_id?: string | null
          id?: string
          lead_id?: string | null
          meta_lead_id?: string | null
          organization_id?: string | null
          recebido_em?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_form_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_lead_form_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          cpl_meta: number
          criado_em: string | null
          data_fim: string
          data_inicio: string
          id: string
          meta_bucket: number | null
          meta_fechamentos: number | null
          meta_leads: number | null
          meta_mqls: number | null
          meta_receita: number
          meta_receita_piso: number | null
          meta_receita_super: number | null
          meta_reunioes: number | null
          nome: string
          organization_id: string
          periodo_tipo: string
          ticket_medio: number
          tipo_meta: string | null
          tx_agendamento: number
          tx_conversao: number
          tx_mql: number
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          cpl_meta?: number
          criado_em?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          meta_bucket?: number | null
          meta_fechamentos?: number | null
          meta_leads?: number | null
          meta_mqls?: number | null
          meta_receita: number
          meta_receita_piso?: number | null
          meta_receita_super?: number | null
          meta_reunioes?: number | null
          nome: string
          organization_id: string
          periodo_tipo: string
          ticket_medio: number
          tipo_meta?: string | null
          tx_agendamento?: number
          tx_conversao?: number
          tx_mql?: number
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          cpl_meta?: number
          criado_em?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          meta_bucket?: number | null
          meta_fechamentos?: number | null
          meta_leads?: number | null
          meta_mqls?: number | null
          meta_receita?: number
          meta_receita_piso?: number | null
          meta_receita_super?: number | null
          meta_reunioes?: number | null
          nome?: string
          organization_id?: string
          periodo_tipo?: string
          ticket_medio?: number
          tipo_meta?: string | null
          tx_agendamento?: number
          tx_conversao?: number
          tx_mql?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_progresso_diario: {
        Row: {
          bucket_acumulado: number | null
          bucket_dia: number | null
          criado_em: string | null
          data_ref: string
          fechamentos_acumulado: number | null
          fechamentos_dia: number | null
          id: string
          leads_acumulado: number | null
          leads_dia: number | null
          meta_id: string | null
          mqls_acumulado: number | null
          mqls_dia: number | null
          organization_id: string | null
          receita_acumulada: number | null
          receita_dia: number | null
          reunioes_acumulado: number | null
          reunioes_dia: number | null
        }
        Insert: {
          bucket_acumulado?: number | null
          bucket_dia?: number | null
          criado_em?: string | null
          data_ref: string
          fechamentos_acumulado?: number | null
          fechamentos_dia?: number | null
          id?: string
          leads_acumulado?: number | null
          leads_dia?: number | null
          meta_id?: string | null
          mqls_acumulado?: number | null
          mqls_dia?: number | null
          organization_id?: string | null
          receita_acumulada?: number | null
          receita_dia?: number | null
          reunioes_acumulado?: number | null
          reunioes_dia?: number | null
        }
        Update: {
          bucket_acumulado?: number | null
          bucket_dia?: number | null
          criado_em?: string | null
          data_ref?: string
          fechamentos_acumulado?: number | null
          fechamentos_dia?: number | null
          id?: string
          leads_acumulado?: number | null
          leads_dia?: number | null
          meta_id?: string | null
          mqls_acumulado?: number | null
          mqls_dia?: number | null
          organization_id?: string | null
          receita_acumulada?: number | null
          receita_dia?: number | null
          reunioes_acumulado?: number | null
          reunioes_dia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_progresso_diario_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_progresso_diario_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "vw_meta_acompanhamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_progresso_diario_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meus_materiais: {
        Row: {
          categoria: string | null
          categoria_arsenal_id: string | null
          conteudo: string
          created_at: string
          criado_manualmente: boolean
          ferramenta_id: string | null
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string | null
          categoria_arsenal_id?: string | null
          conteudo?: string
          created_at?: string
          criado_manualmente?: boolean
          ferramenta_id?: string | null
          id?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string | null
          categoria_arsenal_id?: string | null
          conteudo?: string
          created_at?: string
          criado_manualmente?: boolean
          ferramenta_id?: string | null
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meus_materiais_categoria_arsenal_id_fkey"
            columns: ["categoria_arsenal_id"]
            isOneToOne: false
            referencedRelation: "arsenal_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meus_materiais_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "arsenal_ferramentas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          criado_em: string | null
          dados: Json | null
          id: string
          lead_id: string | null
          mensagem: string
          organization_id: string | null
          status: string | null
          tipo: string | null
          titulo: string | null
          user_id: string | null
        }
        Insert: {
          criado_em?: string | null
          dados?: Json | null
          id?: string
          lead_id?: string | null
          mensagem: string
          organization_id?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string | null
          user_id?: string | null
        }
        Update: {
          criado_em?: string | null
          dados?: Json | null
          id?: string
          lead_id?: string | null
          mensagem?: string
          organization_id?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_diagnosticos: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          created_at: string
          id: string
          respostas: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          id?: string
          respostas?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          id?: string
          respostas?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_progresso: {
        Row: {
          bloco_atual: number
          etapa: string
          historico_conversa: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bloco_atual?: number
          etapa?: string
          historico_conversa?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bloco_atual?: number
          etapa?: string
          historico_conversa?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_ai_prompts: {
        Row: {
          acumulo_mensagens: number | null
          contraindicacoes: string | null
          created_at: string | null
          delay_entre_mensagens: number | null
          formas_pagamento: Json | null
          horario_atendimento: Json | null
          ia_ativa: boolean | null
          id: string
          modelo_ia: string | null
          numeros_teste: string[] | null
          organization_id: string
          origens_permitidas: string[] | null
          palavras_proibidas: string[] | null
          prompt: string | null
          prompt_base: string | null
          prompt_crm: string | null
          updated_at: string | null
        }
        Insert: {
          acumulo_mensagens?: number | null
          contraindicacoes?: string | null
          created_at?: string | null
          delay_entre_mensagens?: number | null
          formas_pagamento?: Json | null
          horario_atendimento?: Json | null
          ia_ativa?: boolean | null
          id?: string
          modelo_ia?: string | null
          numeros_teste?: string[] | null
          organization_id: string
          origens_permitidas?: string[] | null
          palavras_proibidas?: string[] | null
          prompt?: string | null
          prompt_base?: string | null
          prompt_crm?: string | null
          updated_at?: string | null
        }
        Update: {
          acumulo_mensagens?: number | null
          contraindicacoes?: string | null
          created_at?: string | null
          delay_entre_mensagens?: number | null
          formas_pagamento?: Json | null
          horario_atendimento?: Json | null
          ia_ativa?: boolean | null
          id?: string
          modelo_ia?: string | null
          numeros_teste?: string[] | null
          organization_id?: string
          origens_permitidas?: string[] | null
          palavras_proibidas?: string[] | null
          prompt?: string | null
          prompt_base?: string | null
          prompt_crm?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_ai_prompts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_branding: {
        Row: {
          brand_name: string | null
          color_accent: string | null
          color_background: string | null
          color_foreground: string | null
          color_primary: string | null
          color_primary_dark: string | null
          color_secondary: string | null
          color_sidebar_bg: string | null
          created_at: string | null
          favicon_url: string | null
          id: string
          logo_dark_url: string | null
          logo_url: string | null
          organization_id: string
          support_email: string | null
          support_whatsapp: string | null
          tagline: string | null
          updated_at: string | null
        }
        Insert: {
          brand_name?: string | null
          color_accent?: string | null
          color_background?: string | null
          color_foreground?: string | null
          color_primary?: string | null
          color_primary_dark?: string | null
          color_secondary?: string | null
          color_sidebar_bg?: string | null
          created_at?: string | null
          favicon_url?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_url?: string | null
          organization_id: string
          support_email?: string | null
          support_whatsapp?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_name?: string | null
          color_accent?: string | null
          color_background?: string | null
          color_foreground?: string | null
          color_primary?: string | null
          color_primary_dark?: string | null
          color_secondary?: string | null
          color_sidebar_bg?: string | null
          created_at?: string | null
          favicon_url?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_url?: string | null
          organization_id?: string
          support_email?: string | null
          support_whatsapp?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          consulta_abatimento_ativo: boolean | null
          consulta_abatimento_tipo: string | null
          consulta_abatimento_valor: number | null
          consulta_valor_padrao: number | null
          created_at: string | null
          id: string
          name: string
          onboarding_completed_steps: string[]
          onboarding_enabled: boolean
          triagem_regras_extras: string | null
          tutorial_progress: Json
        }
        Insert: {
          consulta_abatimento_ativo?: boolean | null
          consulta_abatimento_tipo?: string | null
          consulta_abatimento_valor?: number | null
          consulta_valor_padrao?: number | null
          created_at?: string | null
          id?: string
          name: string
          onboarding_completed_steps?: string[]
          onboarding_enabled?: boolean
          triagem_regras_extras?: string | null
          tutorial_progress?: Json
        }
        Update: {
          consulta_abatimento_ativo?: boolean | null
          consulta_abatimento_tipo?: string | null
          consulta_abatimento_valor?: number | null
          consulta_valor_padrao?: number | null
          created_at?: string | null
          id?: string
          name?: string
          onboarding_completed_steps?: string[]
          onboarding_enabled?: boolean
          triagem_regras_extras?: string | null
          tutorial_progress?: Json
        }
        Relationships: []
      }
      os_conversations: {
        Row: {
          agente_slug: string | null
          atualizado_em: string
          criado_em: string
          id: string
          organization_id: string
          titulo: string
          user_id: string
        }
        Insert: {
          agente_slug?: string | null
          atualizado_em?: string
          criado_em?: string
          id?: string
          organization_id: string
          titulo?: string
          user_id: string
        }
        Update: {
          agente_slug?: string | null
          atualizado_em?: string
          criado_em?: string
          id?: string
          organization_id?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      os_memories: {
        Row: {
          atualizado_em: string | null
          conteudo: string
          criado_em: string | null
          fonte_conversation_id: string | null
          id: string
          organization_id: string
          tags: string[] | null
          tipo: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string | null
          conteudo: string
          criado_em?: string | null
          fonte_conversation_id?: string | null
          id?: string
          organization_id: string
          tags?: string[] | null
          tipo: string
          user_id: string
        }
        Update: {
          atualizado_em?: string | null
          conteudo?: string
          criado_em?: string | null
          fonte_conversation_id?: string | null
          id?: string
          organization_id?: string
          tags?: string[] | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_memories_fonte_conversation_id_fkey"
            columns: ["fonte_conversation_id"]
            isOneToOne: false
            referencedRelation: "os_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_memories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      os_messages: {
        Row: {
          content: string
          conversation_id: string
          criado_em: string
          id: string
          role: string
          tool_calls: Json | null
        }
        Insert: {
          content?: string
          conversation_id: string
          criado_em?: string
          id?: string
          role: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          criado_em?: string
          id?: string
          role?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "os_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "os_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_historico: {
        Row: {
          campo_alterado: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          metadados: Json | null
          organization_id: string
          prospecto_id: string
          tipo: string
          usuario_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo_alterado?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          metadados?: Json | null
          organization_id: string
          prospecto_id: string
          tipo: string
          usuario_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo_alterado?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          metadados?: Json | null
          organization_id?: string
          prospecto_id?: string
          tipo?: string
          usuario_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_historico_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_historico_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "outbound_prospectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_ligacoes: {
        Row: {
          anotacao: string | null
          contato_decisor: boolean | null
          contato_secretaria: boolean | null
          criado_em: string | null
          data_hora: string | null
          duracao_segundos: number | null
          id: string
          nome_decisor: string | null
          nome_secretaria: string | null
          numero_tentativa: number
          organization_id: string
          prospecto_id: string
          proxima_acao: string | null
          proxima_acao_data: string | null
          resultado: string | null
          script_id: string | null
          status: string
          usuario_id: string | null
        }
        Insert: {
          anotacao?: string | null
          contato_decisor?: boolean | null
          contato_secretaria?: boolean | null
          criado_em?: string | null
          data_hora?: string | null
          duracao_segundos?: number | null
          id?: string
          nome_decisor?: string | null
          nome_secretaria?: string | null
          numero_tentativa?: number
          organization_id: string
          prospecto_id: string
          proxima_acao?: string | null
          proxima_acao_data?: string | null
          resultado?: string | null
          script_id?: string | null
          status: string
          usuario_id?: string | null
        }
        Update: {
          anotacao?: string | null
          contato_decisor?: boolean | null
          contato_secretaria?: boolean | null
          criado_em?: string | null
          data_hora?: string | null
          duracao_segundos?: number | null
          id?: string
          nome_decisor?: string | null
          nome_secretaria?: string | null
          numero_tentativa?: number
          organization_id?: string
          prospecto_id?: string
          proxima_acao?: string | null
          proxima_acao_data?: string | null
          resultado?: string | null
          script_id?: string | null
          status?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_ligacoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_ligacoes_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "outbound_prospectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_ligacoes_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "outbound_scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_ligacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_metas: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          data_fim: string
          data_inicio: string
          id: string
          meta_calls_agendadas: number | null
          meta_conexoes: number | null
          meta_fechamentos: number | null
          meta_leads_contatados: number | null
          meta_ligacoes: number | null
          meta_qualificados: number | null
          meta_receita: number | null
          meta_show_rate: number | null
          nome: string
          organization_id: string
          periodo_tipo: string
          usuario_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          meta_calls_agendadas?: number | null
          meta_conexoes?: number | null
          meta_fechamentos?: number | null
          meta_leads_contatados?: number | null
          meta_ligacoes?: number | null
          meta_qualificados?: number | null
          meta_receita?: number | null
          meta_show_rate?: number | null
          nome: string
          organization_id: string
          periodo_tipo: string
          usuario_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          meta_calls_agendadas?: number | null
          meta_conexoes?: number | null
          meta_fechamentos?: number | null
          meta_leads_contatados?: number | null
          meta_ligacoes?: number | null
          meta_qualificados?: number | null
          meta_receita?: number | null
          meta_show_rate?: number | null
          nome?: string
          organization_id?: string
          periodo_tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_metas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_metas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_prospectos: {
        Row: {
          atualizado_em: string | null
          canal_origem: string | null
          cargo: string | null
          cidade: string | null
          clinica: string | null
          criado_em: string | null
          email: string | null
          especialidade: string | null
          faturamento_estimado: string | null
          id: string
          lead_scoring: string | null
          motivo_perda: string | null
          nome: string
          nome_decisor: string | null
          nome_secretaria: string | null
          observacoes: string | null
          organization_id: string
          proxima_acao: string | null
          proxima_acao_data: string | null
          script_id: string | null
          stage_id: string | null
          tamanho_equipe: number | null
          telefone: string
          tempo_mercado: string | null
          total_tentativas: number | null
          ultimo_contato: string | null
          ultimo_resultado: string | null
          ultimo_status: string | null
          usuario_id: string | null
          whatsapp_lead_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          canal_origem?: string | null
          cargo?: string | null
          cidade?: string | null
          clinica?: string | null
          criado_em?: string | null
          email?: string | null
          especialidade?: string | null
          faturamento_estimado?: string | null
          id?: string
          lead_scoring?: string | null
          motivo_perda?: string | null
          nome: string
          nome_decisor?: string | null
          nome_secretaria?: string | null
          observacoes?: string | null
          organization_id: string
          proxima_acao?: string | null
          proxima_acao_data?: string | null
          script_id?: string | null
          stage_id?: string | null
          tamanho_equipe?: number | null
          telefone: string
          tempo_mercado?: string | null
          total_tentativas?: number | null
          ultimo_contato?: string | null
          ultimo_resultado?: string | null
          ultimo_status?: string | null
          usuario_id?: string | null
          whatsapp_lead_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          canal_origem?: string | null
          cargo?: string | null
          cidade?: string | null
          clinica?: string | null
          criado_em?: string | null
          email?: string | null
          especialidade?: string | null
          faturamento_estimado?: string | null
          id?: string
          lead_scoring?: string | null
          motivo_perda?: string | null
          nome?: string
          nome_decisor?: string | null
          nome_secretaria?: string | null
          observacoes?: string | null
          organization_id?: string
          proxima_acao?: string | null
          proxima_acao_data?: string | null
          script_id?: string | null
          stage_id?: string | null
          tamanho_equipe?: number | null
          telefone?: string
          tempo_mercado?: string | null
          total_tentativas?: number | null
          ultimo_contato?: string | null
          ultimo_resultado?: string | null
          ultimo_status?: string | null
          usuario_id?: string | null
          whatsapp_lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_prospectos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_prospectos_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "outbound_scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_prospectos_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "outbound_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_prospectos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_prospectos_whatsapp_lead_id_fkey"
            columns: ["whatsapp_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_script_prospectos: {
        Row: {
          associado_em: string | null
          id: string
          organization_id: string
          prospecto_id: string
          script_id: string
          usuario_id: string | null
        }
        Insert: {
          associado_em?: string | null
          id?: string
          organization_id: string
          prospecto_id: string
          script_id: string
          usuario_id?: string | null
        }
        Update: {
          associado_em?: string | null
          id?: string
          organization_id?: string
          prospecto_id?: string
          script_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_script_prospectos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_script_prospectos_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "outbound_prospectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_script_prospectos_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "outbound_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_scripts: {
        Row: {
          atualizado_em: string | null
          conteudo: string
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
          objetivo: string
          organization_id: string
          status: string
          usuario_id: string | null
          versao: number
        }
        Insert: {
          atualizado_em?: string | null
          conteudo: string
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
          objetivo: string
          organization_id: string
          status?: string
          usuario_id?: string | null
          versao?: number
        }
        Update: {
          atualizado_em?: string | null
          conteudo?: string
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          objetivo?: string
          organization_id?: string
          status?: string
          usuario_id?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "outbound_scripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_scripts_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_stages: {
        Row: {
          atualizado_em: string | null
          cor: string
          criado_em: string | null
          id: string
          nome: string
          organization_id: string
          posicao_ordem: number
          tipo: string
        }
        Insert: {
          atualizado_em?: string | null
          cor?: string
          criado_em?: string | null
          id?: string
          nome: string
          organization_id: string
          posicao_ordem?: number
          tipo?: string
        }
        Update: {
          atualizado_em?: string | null
          cor?: string
          criado_em?: string | null
          id?: string
          nome?: string
          organization_id?: string
          posicao_ordem?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pagina_compartilhamentos: {
        Row: {
          criado_em: string
          id: string
          pagina_id: string
          permissao: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          pagina_id: string
          permissao?: string
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          pagina_id?: string
          permissao?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagina_compartilhamentos_pagina_id_fkey"
            columns: ["pagina_id"]
            isOneToOne: false
            referencedRelation: "paginas"
            referencedColumns: ["id"]
          },
        ]
      }
      paginas: {
        Row: {
          atualizado_em: string
          categoria: string | null
          conteudo: Json
          criado_em: string
          criado_por: string
          descricao: string | null
          disponivel_atendimento: boolean
          icone: string | null
          id: string
          ordem_index: number
          organization_id: string
          parent_id: string | null
          tipo: string
          titulo: string
          visibilidade: string
        }
        Insert: {
          atualizado_em?: string
          categoria?: string | null
          conteudo?: Json
          criado_em?: string
          criado_por: string
          descricao?: string | null
          disponivel_atendimento?: boolean
          icone?: string | null
          id?: string
          ordem_index?: number
          organization_id: string
          parent_id?: string | null
          tipo?: string
          titulo?: string
          visibilidade?: string
        }
        Update: {
          atualizado_em?: string
          categoria?: string | null
          conteudo?: Json
          criado_em?: string
          criado_por?: string
          descricao?: string | null
          disponivel_atendimento?: boolean
          icone?: string | null
          id?: string
          ordem_index?: number
          organization_id?: string
          parent_id?: string | null
          tipo?: string
          titulo?: string
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "paginas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paginas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "paginas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          atualizado_em: string | null
          avatar_url: string | null
          criado_em: string | null
          email: string | null
          id: string
          last_seen_atualizacao_em: string
          nome_completo: string | null
          organization_id: string | null
          telefone: string | null
          url_avatar: string | null
        }
        Insert: {
          atualizado_em?: string | null
          avatar_url?: string | null
          criado_em?: string | null
          email?: string | null
          id: string
          last_seen_atualizacao_em?: string
          nome_completo?: string | null
          organization_id?: string | null
          telefone?: string | null
          url_avatar?: string | null
        }
        Update: {
          atualizado_em?: string | null
          avatar_url?: string | null
          criado_em?: string | null
          email?: string | null
          id?: string
          last_seen_atualizacao_em?: string
          nome_completo?: string | null
          organization_id?: string | null
          telefone?: string | null
          url_avatar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_checkins: {
        Row: {
          completed_at: string | null
          id: string
          organization_id: string
          period_key: string
          task_id: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          organization_id: string
          period_key: string
          task_id: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          organization_id?: string
          period_key?: string
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_checkins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_checkins_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "performance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_tasks: {
        Row: {
          created_at: string | null
          description: string | null
          frequency: string
          id: string
          is_active: boolean | null
          order_index: number | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          title?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_block_responses: {
        Row: {
          block_id: string
          completed: boolean | null
          id: string
          module_id: string
          response: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          block_id: string
          completed?: boolean | null
          id?: string
          module_id: string
          response?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          block_id?: string
          completed?: boolean | null
          id?: string
          module_id?: string
          response?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_block_responses_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "platform_module_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_block_responses_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_block_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_complementary_folders: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem_index: number
          parent_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem_index?: number
          parent_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem_index?: number
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_complementary_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "platform_complementary_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_complementary_materials: {
        Row: {
          ativo: boolean
          conteudo_html: string | null
          created_at: string
          folder_id: string
          id: string
          ordem_index: number
          pdf_url: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          conteudo_html?: string | null
          created_at?: string
          folder_id: string
          id?: string
          ordem_index?: number
          pdf_url?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          conteudo_html?: string | null
          created_at?: string
          folder_id?: string
          id?: string
          ordem_index?: number
          pdf_url?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_complementary_materials_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "platform_complementary_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_ia_config: {
        Row: {
          active: boolean | null
          description: string | null
          id: string
          min_plan: string | null
          model: string | null
          name: string
          system_prompt: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          description?: string | null
          id: string
          min_plan?: string | null
          model?: string | null
          name: string
          system_prompt: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          description?: string | null
          id?: string
          min_plan?: string | null
          model?: string | null
          name?: string
          system_prompt?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_ia_history: {
        Row: {
          created_at: string | null
          ia_type: string
          id: string
          input_text: string | null
          output_text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          ia_type: string
          id?: string
          input_text?: string | null
          output_text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          ia_type?: string
          id?: string
          input_text?: string | null
          output_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_ia_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_materiais: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          id: string
          module_id: string | null
          title: string
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          module_id?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          module_id?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_materiais_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_materiais_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_module_blocks: {
        Row: {
          cerebro_chave: string | null
          config: Json | null
          created_at: string | null
          gera_material: boolean | null
          id: string
          instrucao: string | null
          material_categoria: string | null
          module_id: string
          ordem_index: number | null
          salvar_no_cerebro: boolean | null
          tipo: string
          titulo: string
        }
        Insert: {
          cerebro_chave?: string | null
          config?: Json | null
          created_at?: string | null
          gera_material?: boolean | null
          id?: string
          instrucao?: string | null
          material_categoria?: string | null
          module_id: string
          ordem_index?: number | null
          salvar_no_cerebro?: boolean | null
          tipo: string
          titulo: string
        }
        Update: {
          cerebro_chave?: string | null
          config?: Json | null
          created_at?: string | null
          gera_material?: boolean | null
          id?: string
          instrucao?: string | null
          material_categoria?: string | null
          module_id?: string
          ordem_index?: number | null
          salvar_no_cerebro?: boolean | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_module_blocks_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_module_progress_detail: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          module_id: string | null
          step: string | null
          user_id: string | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          module_id?: string | null
          step?: string | null
          user_id?: string | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          module_id?: string | null
          step?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_module_progress_detail_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_module_progress_detail_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_modules: {
        Row: {
          active: boolean | null
          aprender_content: string | null
          construa_fields: Json | null
          cor_badge: string | null
          description: string | null
          duracao_minutos: number | null
          duration_minutes: number | null
          finalize_badge_name: string | null
          finalize_content: string | null
          finalize_next_action: string | null
          finalize_success_message: string | null
          icone: string | null
          id: string
          min_plan: string | null
          order_index: number
          pilar_id: string | null
          pillar: number
          prerequisite_module_id: string | null
          tags: Json | null
          thumbnail_url: string | null
          title: string
          valide_checklist: Json | null
          valide_items: Json | null
          video_url: string | null
        }
        Insert: {
          active?: boolean | null
          aprender_content?: string | null
          construa_fields?: Json | null
          cor_badge?: string | null
          description?: string | null
          duracao_minutos?: number | null
          duration_minutes?: number | null
          finalize_badge_name?: string | null
          finalize_content?: string | null
          finalize_next_action?: string | null
          finalize_success_message?: string | null
          icone?: string | null
          id: string
          min_plan?: string | null
          order_index: number
          pilar_id?: string | null
          pillar: number
          prerequisite_module_id?: string | null
          tags?: Json | null
          thumbnail_url?: string | null
          title: string
          valide_checklist?: Json | null
          valide_items?: Json | null
          video_url?: string | null
        }
        Update: {
          active?: boolean | null
          aprender_content?: string | null
          construa_fields?: Json | null
          cor_badge?: string | null
          description?: string | null
          duracao_minutos?: number | null
          duration_minutes?: number | null
          finalize_badge_name?: string | null
          finalize_content?: string | null
          finalize_next_action?: string | null
          finalize_success_message?: string | null
          icone?: string | null
          id?: string
          min_plan?: string | null
          order_index?: number
          pilar_id?: string | null
          pillar?: number
          prerequisite_module_id?: string | null
          tags?: Json | null
          thumbnail_url?: string | null
          title?: string
          valide_checklist?: Json | null
          valide_items?: Json | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_modules_pilar_id_fkey"
            columns: ["pilar_id"]
            isOneToOne: false
            referencedRelation: "platform_pilares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_modules_prerequisite_module_id_fkey"
            columns: ["prerequisite_module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_pilares: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          fase_claro: string | null
          icone: string | null
          id: string
          nome: string
          ordem_index: number | null
          plano_minimo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          fase_claro?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem_index?: number | null
          plano_minimo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          fase_claro?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem_index?: number | null
          plano_minimo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_products: {
        Row: {
          acesso_arsenal: boolean
          acesso_cerebro: boolean | null
          acesso_crm: boolean | null
          acesso_ia_comercial: boolean | null
          acesso_materiais: boolean | null
          acesso_os: boolean | null
          acesso_sessoes_taticas: boolean | null
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          duracao_dias: number | null
          ias_liberadas: string[] | null
          id: string
          max_leads: number | null
          max_usuarios_crm: number | null
          nome: string
          ordem_index: number | null
          pilares_liberados: string[] | null
          preco_mensal: number | null
          updated_at: string | null
        }
        Insert: {
          acesso_arsenal?: boolean
          acesso_cerebro?: boolean | null
          acesso_crm?: boolean | null
          acesso_ia_comercial?: boolean | null
          acesso_materiais?: boolean | null
          acesso_os?: boolean | null
          acesso_sessoes_taticas?: boolean | null
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          duracao_dias?: number | null
          ias_liberadas?: string[] | null
          id?: string
          max_leads?: number | null
          max_usuarios_crm?: number | null
          nome: string
          ordem_index?: number | null
          pilares_liberados?: string[] | null
          preco_mensal?: number | null
          updated_at?: string | null
        }
        Update: {
          acesso_arsenal?: boolean
          acesso_cerebro?: boolean | null
          acesso_crm?: boolean | null
          acesso_ia_comercial?: boolean | null
          acesso_materiais?: boolean | null
          acesso_os?: boolean | null
          acesso_sessoes_taticas?: boolean | null
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          duracao_dias?: number | null
          ias_liberadas?: string[] | null
          id?: string
          max_leads?: number | null
          max_usuarios_crm?: number | null
          nome?: string
          ordem_index?: number | null
          pilares_liberados?: string[] | null
          preco_mensal?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_sessoes_recorrentes: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          description: string | null
          id: string
          meet_link: string | null
          time_of_day: string
          title: string
          weeks_ahead: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          description?: string | null
          id?: string
          meet_link?: string | null
          time_of_day: string
          title: string
          weeks_ahead?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          description?: string | null
          id?: string
          meet_link?: string | null
          time_of_day?: string
          title?: string
          weeks_ahead?: number
        }
        Relationships: []
      }
      platform_sessoes_taticas: {
        Row: {
          active: boolean | null
          description: string | null
          id: string
          meet_link: string | null
          recording_url: string | null
          recorrencia_id: string | null
          scheduled_at: string | null
          title: string
          type: string | null
        }
        Insert: {
          active?: boolean | null
          description?: string | null
          id?: string
          meet_link?: string | null
          recording_url?: string | null
          recorrencia_id?: string | null
          scheduled_at?: string | null
          title: string
          type?: string | null
        }
        Update: {
          active?: boolean | null
          description?: string | null
          id?: string
          meet_link?: string | null
          recording_url?: string | null
          recorrencia_id?: string | null
          scheduled_at?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_sessoes_taticas_recorrencia_id_fkey"
            columns: ["recorrencia_id"]
            isOneToOne: false
            referencedRelation: "platform_sessoes_recorrentes"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_tenants: {
        Row: {
          access_starts_at: string | null
          acesso_arsenal: boolean | null
          acesso_cerebro: boolean | null
          acesso_crm: boolean | null
          acesso_ia_comercial: boolean | null
          acesso_materiais: boolean | null
          acesso_os: boolean | null
          acesso_sessoes_taticas: boolean | null
          created_at: string | null
          ias_liberadas: string[] | null
          id: string
          max_leads: number | null
          max_users: number | null
          monthly_fee: number | null
          n8n_tag: string | null
          notes: string | null
          organization_id: string
          pilares_liberados: string[] | null
          plan: string | null
          product_id: string | null
          status: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_starts_at?: string | null
          acesso_arsenal?: boolean | null
          acesso_cerebro?: boolean | null
          acesso_crm?: boolean | null
          acesso_ia_comercial?: boolean | null
          acesso_materiais?: boolean | null
          acesso_os?: boolean | null
          acesso_sessoes_taticas?: boolean | null
          created_at?: string | null
          ias_liberadas?: string[] | null
          id?: string
          max_leads?: number | null
          max_users?: number | null
          monthly_fee?: number | null
          n8n_tag?: string | null
          notes?: string | null
          organization_id: string
          pilares_liberados?: string[] | null
          plan?: string | null
          product_id?: string | null
          status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_starts_at?: string | null
          acesso_arsenal?: boolean | null
          acesso_cerebro?: boolean | null
          acesso_crm?: boolean | null
          acesso_ia_comercial?: boolean | null
          acesso_materiais?: boolean | null
          acesso_os?: boolean | null
          acesso_sessoes_taticas?: boolean | null
          created_at?: string | null
          ias_liberadas?: string[] | null
          id?: string
          max_leads?: number | null
          max_users?: number | null
          monthly_fee?: number | null
          n8n_tag?: string | null
          notes?: string | null
          organization_id?: string
          pilares_liberados?: string[] | null
          plan?: string | null
          product_id?: string | null
          status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_tenants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_tenants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "platform_products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_uploads: {
        Row: {
          file_name: string | null
          id: string
          module_id: string | null
          public_url: string | null
          size_bytes: number | null
          storage_path: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          file_name?: string | null
          id?: string
          module_id?: string | null
          public_url?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string | null
          id?: string
          module_id?: string | null
          public_url?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_uploads_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_users: {
        Row: {
          cerebro_complete: boolean | null
          city_state: string | null
          clinic_name: string | null
          created_at: string | null
          crm_user_id: string | null
          cs_csm_id: string | null
          cs_fase: string | null
          cs_fase_desde: string | null
          cs_health_status: string | null
          cs_proximo_touchpoint: string | null
          cs_renovacao_status: string | null
          cs_resultado_declarado: boolean | null
          cs_resultado_declarado_em: string | null
          cs_ultimo_touchpoint: string | null
          email_notifications: boolean | null
          id: string
          onboarding_complete: boolean | null
          onboarding_concluido: boolean
          onboarding_concluido_em: string | null
          onboarding_iniciado_em: string | null
          plan: string
          platform_onboarding_enabled: boolean | null
          platform_onboarding_steps: string[] | null
          specialty: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          cerebro_complete?: boolean | null
          city_state?: string | null
          clinic_name?: string | null
          created_at?: string | null
          crm_user_id?: string | null
          cs_csm_id?: string | null
          cs_fase?: string | null
          cs_fase_desde?: string | null
          cs_health_status?: string | null
          cs_proximo_touchpoint?: string | null
          cs_renovacao_status?: string | null
          cs_resultado_declarado?: boolean | null
          cs_resultado_declarado_em?: string | null
          cs_ultimo_touchpoint?: string | null
          email_notifications?: boolean | null
          id: string
          onboarding_complete?: boolean | null
          onboarding_concluido?: boolean
          onboarding_concluido_em?: string | null
          onboarding_iniciado_em?: string | null
          plan: string
          platform_onboarding_enabled?: boolean | null
          platform_onboarding_steps?: string[] | null
          specialty?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          cerebro_complete?: boolean | null
          city_state?: string | null
          clinic_name?: string | null
          created_at?: string | null
          crm_user_id?: string | null
          cs_csm_id?: string | null
          cs_fase?: string | null
          cs_fase_desde?: string | null
          cs_health_status?: string | null
          cs_proximo_touchpoint?: string | null
          cs_renovacao_status?: string | null
          cs_resultado_declarado?: boolean | null
          cs_resultado_declarado_em?: string | null
          cs_ultimo_touchpoint?: string | null
          email_notifications?: boolean | null
          id?: string
          onboarding_complete?: boolean | null
          onboarding_concluido?: boolean
          onboarding_concluido_em?: string | null
          onboarding_iniciado_em?: string | null
          plan?: string
          platform_onboarding_enabled?: boolean | null
          platform_onboarding_steps?: string[] | null
          specialty?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      procedimentos: {
        Row: {
          ativo: boolean
          categoria: string | null
          criado_em: string
          descricao: string | null
          duracao_minutos: number | null
          id: string
          nome: string
          organization_id: string
          valor_base: number | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          criado_em?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          nome: string
          organization_id: string
          valor_base?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          criado_em?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          nome?: string
          organization_id?: string
          valor_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "procedimentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      suporte_ticket_mensagens: {
        Row: {
          autor_id: string
          autor_nome: string
          autor_tipo: string
          conteudo: string
          created_at: string
          id: string
          organization_id: string
          ticket_id: string
        }
        Insert: {
          autor_id: string
          autor_nome: string
          autor_tipo: string
          conteudo: string
          created_at?: string
          id?: string
          organization_id: string
          ticket_id: string
        }
        Update: {
          autor_id?: string
          autor_nome?: string
          autor_tipo?: string
          conteudo?: string
          created_at?: string
          id?: string
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suporte_ticket_mensagens_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "suporte_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      suporte_ticket_midias: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          nome_arquivo: string
          organization_id: string
          storage_path: string
          tamanho_bytes: number | null
          ticket_id: string
          tipo: string
          url_publica: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          nome_arquivo: string
          organization_id: string
          storage_path: string
          tamanho_bytes?: number | null
          ticket_id: string
          tipo: string
          url_publica: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          nome_arquivo?: string
          organization_id?: string
          storage_path?: string
          tamanho_bytes?: number | null
          ticket_id?: string
          tipo?: string
          url_publica?: string
        }
        Relationships: [
          {
            foreignKeyName: "suporte_ticket_midias_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "suporte_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      suporte_tickets: {
        Row: {
          categoria: string
          created_at: string
          criado_por: string
          descricao: string
          id: string
          numero_ticket: number
          organization_id: string
          prioridade: string
          status: string
          titulo: string
          updated_at: string
          visualizado_admin: boolean
        }
        Insert: {
          categoria: string
          created_at?: string
          criado_por: string
          descricao: string
          id?: string
          numero_ticket?: number
          organization_id: string
          prioridade?: string
          status?: string
          titulo: string
          updated_at?: string
          visualizado_admin?: boolean
        }
        Update: {
          categoria?: string
          created_at?: string
          criado_por?: string
          descricao?: string
          id?: string
          numero_ticket?: number
          organization_id?: string
          prioridade?: string
          status?: string
          titulo?: string
          updated_at?: string
          visualizado_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "suporte_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_ai_config: {
        Row: {
          atualizado_em: string | null
          chave: string
          criado_em: string | null
          descricao: string | null
          id: string
          organization_id: string | null
          valor: string
        }
        Insert: {
          atualizado_em?: string | null
          chave: string
          criado_em?: string | null
          descricao?: string | null
          id?: string
          organization_id?: string | null
          valor: string
        }
        Update: {
          atualizado_em?: string | null
          chave?: string
          criado_em?: string | null
          descricao?: string | null
          id?: string
          organization_id?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_ai_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          label_lid: string | null
          name: string
          organization_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          label_lid?: string | null
          name: string
          organization_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          label_lid?: string | null
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_member_permissions: {
        Row: {
          criado_em: string | null
          email: string
          id: string
          nome: string | null
          organization_id: string
          pages: Json
          read_only: Json
          role: string
          user_id: string
        }
        Insert: {
          criado_em?: string | null
          email: string
          id?: string
          nome?: string | null
          organization_id: string
          pages?: Json
          read_only?: Json
          role?: string
          user_id: string
        }
        Update: {
          criado_em?: string | null
          email?: string
          id?: string
          nome?: string | null
          organization_id?: string
          pages?: Json
          read_only?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_mensagem: {
        Row: {
          atualizado_em: string | null
          categoria: string
          contagem_uso: number | null
          conteudo: string
          criado_em: string | null
          esta_ativo: boolean | null
          id: string
          nome: string
          organization_id: string | null
          usuario_id: string
          variaveis: Json | null
        }
        Insert: {
          atualizado_em?: string | null
          categoria: string
          contagem_uso?: number | null
          conteudo: string
          criado_em?: string | null
          esta_ativo?: boolean | null
          id?: string
          nome: string
          organization_id?: string | null
          usuario_id: string
          variaveis?: Json | null
        }
        Update: {
          atualizado_em?: string | null
          categoria?: string
          contagem_uso?: number | null
          conteudo?: string
          criado_em?: string | null
          esta_ativo?: boolean | null
          id?: string
          nome?: string
          organization_id?: string | null
          usuario_id?: string
          variaveis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_mensagem_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      triage_ia_logs: {
        Row: {
          created_at: string
          decisao: boolean
          duracao_ms: number | null
          id: string
          lead_id: string | null
          lead_nome: string | null
          mensagem: string | null
          modelo: string | null
          motivo: string | null
          organization_id: string
          origem_lead: string | null
          resposta_raw: string | null
          tipo_mensagem: string | null
        }
        Insert: {
          created_at?: string
          decisao: boolean
          duracao_ms?: number | null
          id?: string
          lead_id?: string | null
          lead_nome?: string | null
          mensagem?: string | null
          modelo?: string | null
          motivo?: string | null
          organization_id: string
          origem_lead?: string | null
          resposta_raw?: string | null
          tipo_mensagem?: string | null
        }
        Update: {
          created_at?: string
          decisao?: boolean
          duracao_ms?: number | null
          id?: string
          lead_id?: string | null
          lead_nome?: string | null
          mensagem?: string | null
          modelo?: string | null
          motivo?: string | null
          organization_id?: string
          origem_lead?: string | null
          resposta_raw?: string | null
          tipo_mensagem?: string | null
        }
        Relationships: []
      }
      usuarios_papeis: {
        Row: {
          criado_em: string | null
          id: string
          papel: Database["public"]["Enums"]["app_role"]
          usuario_id: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          papel: Database["public"]["Enums"]["app_role"]
          usuario_id: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          papel?: Database["public"]["Enums"]["app_role"]
          usuario_id?: string
        }
        Relationships: []
      }
      vendas: {
        Row: {
          agendamento_id: string | null
          criado_em: string | null
          data_fechamento: string | null
          data_orcamento: string | null
          forma_pagamento: string | null
          id: string
          lead_id: string
          organization_id: string
          produto_servico: string | null
          tipo_venda: string | null
          usuario_id: string | null
          valor_fechado: number
          valor_orcado: number | null
        }
        Insert: {
          agendamento_id?: string | null
          criado_em?: string | null
          data_fechamento?: string | null
          data_orcamento?: string | null
          forma_pagamento?: string | null
          id?: string
          lead_id: string
          organization_id: string
          produto_servico?: string | null
          tipo_venda?: string | null
          usuario_id?: string | null
          valor_fechado: number
          valor_orcado?: number | null
        }
        Update: {
          agendamento_id?: string | null
          criado_em?: string | null
          data_fechamento?: string | null
          data_orcamento?: string | null
          forma_pagamento?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          produto_servico?: string | null
          tipo_venda?: string | null
          usuario_id?: string | null
          valor_fechado?: number
          valor_orcado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_debug_log: {
        Row: {
          id: number
          payload: Json | null
          received_at: string | null
        }
        Insert: {
          id?: number
          payload?: Json | null
          received_at?: string | null
        }
        Update: {
          id?: number
          payload?: Json | null
          received_at?: string | null
        }
        Relationships: []
      }
      webinar_agendamentos: {
        Row: {
          criado_em: string | null
          dia_label: string | null
          horario: string | null
          id: string
          nome: string | null
          slot_key: string
          whatsapp: string | null
        }
        Insert: {
          criado_em?: string | null
          dia_label?: string | null
          horario?: string | null
          id?: string
          nome?: string | null
          slot_key: string
          whatsapp?: string | null
        }
        Update: {
          criado_em?: string | null
          dia_label?: string | null
          horario?: string | null
          id?: string
          nome?: string | null
          slot_key?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      webinar_agendamentos_v2: {
        Row: {
          criado_em: string | null
          dia_label: string | null
          horario: string | null
          id: string
          nome: string | null
          slot_key: string
          whatsapp: string | null
        }
        Insert: {
          criado_em?: string | null
          dia_label?: string | null
          horario?: string | null
          id?: string
          nome?: string | null
          slot_key: string
          whatsapp?: string | null
        }
        Update: {
          criado_em?: string | null
          dia_label?: string | null
          horario?: string | null
          id?: string
          nome?: string | null
          slot_key?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      whatsapp_connections: {
        Row: {
          created_at: string | null
          id: string
          instance_name: string
          last_connected_at: string | null
          n8n_webhook_url: string | null
          organization_id: string
          phone_number: string | null
          qr_code: string | null
          status: string | null
          uazapi_instance_id: string | null
          uazapi_token: string | null
          uazapi_url: string
          updated_at: string | null
          usuario_id_default: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_name: string
          last_connected_at?: string | null
          n8n_webhook_url?: string | null
          organization_id: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          uazapi_instance_id?: string | null
          uazapi_token?: string | null
          uazapi_url: string
          updated_at?: string | null
          usuario_id_default?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_name?: string
          last_connected_at?: string | null
          n8n_webhook_url?: string | null
          organization_id?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          uazapi_instance_id?: string | null
          uazapi_token?: string | null
          uazapi_url?: string
          updated_at?: string | null
          usuario_id_default?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connections_usuario_id_default_fkey"
            columns: ["usuario_id_default"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_agendamentos_metricas: {
        Row: {
          agendados: number | null
          cancelados: number | null
          confirmados: number | null
          no_show: number | null
          organization_id: string | null
          proximos: number | null
          realizados: number | null
          remarcados: number | null
          taxa_comparecimento: number | null
          taxa_no_show: number | null
          total_agendamentos: number | null
          valor_orcado_realizados: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_criativo_performance: {
        Row: {
          campanha_nome: string | null
          cpa_real: number | null
          cpc_medio: number | null
          cpl_real: number | null
          cpm_medio: number | null
          cpv_real: number | null
          criativo_nome: string | null
          criativo_status: string | null
          criativo_uuid: string | null
          ctr_medio: number | null
          leads_agendados: number | null
          leads_crm_total: number | null
          leads_fechados: number | null
          leads_qualificados: number | null
          meta_ad_id: string | null
          meta_campaign_id: string | null
          organization_id: string | null
          receita_gerada: number | null
          roas_real: number | null
          scoring_a: number | null
          scoring_b: number | null
          scoring_c: number | null
          scoring_d: number | null
          taxa_agendamento: number | null
          taxa_fechamento: number | null
          taxa_qualificacao: number | null
          total_cliques: number | null
          total_gasto: number | null
          total_impressoes: number | null
          url_thumbnail: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_meta_campaign_id_fkey"
            columns: ["meta_campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["meta_campaign_id"]
          },
          {
            foreignKeyName: "meta_ads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_marketing_eficiencia: {
        Row: {
          agendados: number | null
          cpa_real: number | null
          cpl_real: number | null
          cpv_real: number | null
          fechados: number | null
          leads_marketing: number | null
          organization_id: string | null
          qualificados: number | null
          receita_marketing: number | null
          roas_real: number | null
          taxa_agendamento: number | null
          taxa_fechamento: number | null
          taxa_qualificacao: number | null
          total_investido: number | null
          total_leads: number | null
        }
        Relationships: []
      }
      vw_meta_acompanhamento: {
        Row: {
          ativo: boolean | null
          bucket_total: number | null
          cpl_meta: number | null
          criado_em: string | null
          data_fim: string | null
          data_inicio: string | null
          dias_decorridos: number | null
          dias_restantes: number | null
          fechamentos_total: number | null
          id: string | null
          leads_hoje: number | null
          leads_necessarios_por_dia: number | null
          leads_semana: number | null
          leads_total: number | null
          meta_bucket: number | null
          meta_fechamentos: number | null
          meta_leads: number | null
          meta_leads_dia: number | null
          meta_leads_semana: number | null
          meta_mqls: number | null
          meta_mqls_dia: number | null
          meta_mqls_semana: number | null
          meta_receita: number | null
          meta_receita_dia: number | null
          meta_receita_piso: number | null
          meta_receita_semana: number | null
          meta_receita_super: number | null
          meta_reunioes: number | null
          meta_reunioes_dia: number | null
          meta_reunioes_semana: number | null
          mqls_hoje: number | null
          mqls_semana: number | null
          mqls_total: number | null
          nome: string | null
          organization_id: string | null
          pct_fechamentos: number | null
          pct_leads: number | null
          pct_mqls: number | null
          pct_receita: number | null
          pct_reunioes: number | null
          periodo_tipo: string | null
          receita_necessaria_por_dia: number | null
          receita_total: number | null
          reunioes_total: number | null
          ticket_medio: number | null
          tipo_meta: string | null
          total_dias: number | null
          tx_agendamento: number | null
          tx_conversao: number | null
          tx_mql: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_pasta_hierarquia: {
        Row: {
          ancestrais: string[] | null
          caminho: string | null
          cor: string | null
          criativos_ativos: number | null
          data_fim_veiculacao: string | null
          data_inicio_veiculacao: string | null
          id: string | null
          nivel: number | null
          nome: string | null
          organization_id: string | null
          pasta_pai_id: string | null
          status: string | null
          total_criativos: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cs_resultado_score: {
        Args: {
          p_fat: number
          p_fech: number
          p_growth: number
          p_has_meta: boolean
          p_meta_pct: number
          p_tempo: number
          p_txfech: number
        }
        Returns: number
      }
      aa_total_dia: { Args: { dia: string }; Returns: number }
      aa_vagas_por_slot: {
        Args: never
        Returns: {
          data_slot: string
          horario_slot: string
          total: number
        }[]
      }
      admin_ensure_platform_user: {
        Args: { p_user_id: string }
        Returns: {
          cerebro_complete: boolean | null
          city_state: string | null
          clinic_name: string | null
          created_at: string | null
          crm_user_id: string | null
          cs_csm_id: string | null
          cs_fase: string | null
          cs_fase_desde: string | null
          cs_health_status: string | null
          cs_proximo_touchpoint: string | null
          cs_renovacao_status: string | null
          cs_resultado_declarado: boolean | null
          cs_resultado_declarado_em: string | null
          cs_ultimo_touchpoint: string | null
          email_notifications: boolean | null
          id: string
          onboarding_complete: boolean | null
          onboarding_concluido: boolean
          onboarding_concluido_em: string | null
          onboarding_iniciado_em: string | null
          plan: string
          platform_onboarding_enabled: boolean | null
          platform_onboarding_steps: string[] | null
          specialty: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        SetofOptions: {
          from: "*"
          to: "platform_users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_resend_atualizacoes: { Args: never; Returns: number }
      admin_reset_onboarding_to_athos: {
        Args: { p_auth_user_id: string; p_platform_user_id: string }
        Returns: undefined
      }
      admin_reset_platform_onboarding: {
        Args: { p_auth_user_id: string; p_platform_user_id: string }
        Returns: undefined
      }
      athos_agente_ativo: {
        Args: { p_org: string; p_slug: string }
        Returns: boolean
      }
      blacklist_lead_permanently: {
        Args: { p_lead_id: string; p_reason?: string }
        Returns: undefined
      }
      cs_set_client_meta: {
        Args: { p_meta_receita: number; p_org_id: string }
        Returns: undefined
      }
      cs_snapshot_crm: { Args: never; Returns: number }
      get_athos_eventos: {
        Args: { p_agente_slug?: string; p_limit?: number }
        Returns: {
          agente_nome: string
          agente_slug: string
          criado_em: string
          lead_id: string
          resumo: string
          status: string
        }[]
      }
      get_cs_client_crm_detail: { Args: { p_org_id: string }; Returns: Json }
      get_cs_client_crm_period: {
        Args: { p_from: string; p_org_id: string; p_to: string }
        Returns: Json
      }
      get_cs_client_crm_trend: { Args: { p_org_id: string }; Returns: Json }
      get_cs_client_raio_x: {
        Args: { p_from?: string; p_org_id: string; p_to?: string }
        Returns: Json
      }
      get_cs_clients: {
        Args: never
        Returns: {
          clinic_name: string
          crm_user_id: string
          cs_fase: string
          cs_fase_desde: string
          cs_health_status: string
          cs_proximo_touchpoint: string
          cs_ultimo_touchpoint: string
          id: string
          joined_at: string
          nome_completo: string
          onboarding_complete: boolean
          onboarding_concluido: boolean
          organization_id: string
          product_name: string
        }[]
      }
      get_cs_crm_metrics: {
        Args: never
        Returns: {
          agend_30d: number
          fat_30d: number
          fat_30d_prev: number
          fat_growth_pct: number
          fat_total_lifetime: number
          fech_30d: number
          fechamentos_30d: number
          leads_30d: number
          meta_pct: number
          meta_realizado: number
          meta_receita_ativa: number
          mql_30d: number
          msgs_30d: number
          organization_id: string
          registra_vendas: boolean
          tem_meta: boolean
          tempo_1o_contato_med_min: number
          ticket_medio_30d: number
          tx_agend: number
          tx_fech: number
          tx_mql: number
          ultima_atividade: string
          usa_agenda: boolean
          usa_followup: boolean
          usa_ia: boolean
        }[]
      }
      get_cs_month_fat: {
        Args: never
        Returns: {
          fat_mes: number
          org_id: string
        }[]
      }
      get_my_org_id: { Args: never; Returns: string }
      get_my_organization_id: { Args: never; Returns: string }
      get_my_platform_access: { Args: never; Returns: Json }
      get_old_storage_objects: {
        Args: {
          p_bucket: string
          p_cutoff: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          obj_name: string
          size_bytes: number
        }[]
      }
      get_org_painel: {
        Args: { p_from: string; p_org_id: string; p_to: string }
        Returns: Json
      }
      get_pending_nps_survey: {
        Args: never
        Returns: {
          campanha_id: string
          dimensao: string
          obrigatoria: boolean
          ordem: number
          pergunta_id: string
          template_id: string
          texto: string
          tipo: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      normalize_crm_phone: { Args: { phone_input: string }; Returns: string }
      pagina_criado_por: { Args: { p_pagina_id: string }; Returns: string }
      platform_admin_renumber_modules: { Args: never; Returns: undefined }
      snooze_nps_survey: {
        Args: { p_campanha_id: string; p_dias?: number }
        Returns: undefined
      }
      submit_nps_response: {
        Args: { p_campanha_id: string; p_respostas: Json }
        Returns: undefined
      }
      update_stages_order: { Args: { stages_data: Json }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "atendente"
        | "dentista"
        | "visualizador"
        | "superadmin"
      campaign_status: "draft" | "active" | "scheduled" | "completed" | "paused"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "atendente",
        "dentista",
        "visualizador",
        "superadmin",
      ],
      campaign_status: ["draft", "active", "scheduled", "completed", "paused"],
    },
  },
} as const
