import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generatePassword(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

function generateInviteEmailHtml(opts: {
  memberName: string;
  clinicName: string;
  roleName: string;
  magicLink: string;
  email: string;
}): string {
  const { memberName, clinicName, roleName, magicLink, email } = opts;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Convite para a equipe</title></head>
<body style="margin:0;padding:0;background-color:#f1f1f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f1f3;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#0d0d10 0%,#1c1c28 100%);border-radius:16px 16px 0 0;padding:40px 40px 32px;">
            <div style="display:inline-block;background:#E85D24;border-radius:8px;padding:6px 18px;margin-bottom:24px;">
              <span style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">DESCOMPLIQUEI</span>
            </div>
            <h1 style="color:#ffffff;font-size:26px;font-weight:700;margin:0 0 8px;line-height:1.3;">Você foi convidado(a)!</h1>
            <p style="color:rgba(255,255,255,0.45);font-size:14px;margin:0;">${clinicName}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fff8f5;border-left:1px solid #fde5d4;border-right:1px solid #fde5d4;padding:14px 40px;">
            <span style="display:inline-block;background:#E85D24;color:#ffffff;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 14px;border-radius:20px;">${roleName}</span>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:36px 40px 32px;">
            <p style="color:#111827;font-size:15px;line-height:1.65;margin:0 0 16px;">
              Olá${memberName ? `, <strong>${memberName}</strong>` : ''}! Você foi adicionado(a) à equipe de <strong>${clinicName}</strong> na plataforma Descompliquei.
            </p>
            <p style="color:#6b7280;font-size:13px;line-height:1.65;margin:0 0 32px;">
              Clique no botão abaixo para acessar a plataforma. No primeiro acesso, você poderá <strong>criar sua senha</strong> de forma segura.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td align="center" style="padding-bottom:36px;">
                <a href="${magicLink}" style="display:inline-block;background:#E85D24;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 44px;border-radius:12px;letter-spacing:0.2px;line-height:1;">
                  Acessar a Plataforma &rarr;
                </a>
              </td></tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;margin-bottom:28px;"></div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#fafafa;border-radius:10px;border-left:3px solid #E85D24;padding:16px 20px;">
                <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 6px;">O que você terá acesso</p>
                <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.6;">
                  CRM completo com Conversas, Leads, Pipeline, Agendamentos e mais &mdash; conforme as permissões definidas pelo administrador.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:20px 40px;">
            <p style="color:#9ca3af;font-size:12px;margin:0 0 8px;line-height:1.5;">Se o botão não abrir, copie e cole este link:</p>
            <p style="margin:0;"><a href="${magicLink}" style="color:#E85D24;font-size:12px;word-break:break-all;text-decoration:none;">${magicLink}</a></p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 0 0;">
            <p style="color:#9ca3af;font-size:11px;margin:0;">Descompliquei Marketing &middot; Enviado para ${email}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const DEFAULT_PAGES: Record<string, Record<string, boolean>> = {
  admin: {
    painel: true, performance: true, conversas: true, notificacoes: true, leads: true,
    agendamentos: true, vendas: true, procedimentos: true, metas: true, equipe: true,
    evolucao: true, ia: true, athos_gs: false, arsenal: false, jornada: false, notas: false,
    sessoes_taticas: false, cadencias: true, atualizacoes: true, configuracoes: false,
  },
  comercial: {
    painel: true, performance: true, conversas: true, notificacoes: true, leads: true,
    agendamentos: true, vendas: true, procedimentos: false, metas: true, equipe: false,
    evolucao: true, ia: false, athos_gs: false, arsenal: false, jornada: false, notas: false,
    sessoes_taticas: false, cadencias: false, atualizacoes: true, configuracoes: false,
  },
  atendente: {
    painel: false, performance: false, conversas: true, notificacoes: true, leads: false,
    agendamentos: false, vendas: false, procedimentos: false, metas: false, equipe: false,
    evolucao: false, ia: false, athos_gs: false, arsenal: false, jornada: false, notas: false,
    sessoes_taticas: false, cadencias: false, atualizacoes: true, configuracoes: false,
  },
  custom: {
    painel: false, performance: false, conversas: true, notificacoes: true, leads: false,
    agendamentos: false, vendas: false, procedimentos: false, metas: false, equipe: false,
    evolucao: false, ia: false, athos_gs: false, arsenal: false, jornada: false, notas: false,
    sessoes_taticas: false, cadencias: false, atualizacoes: true, configuracoes: false,
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verificar autenticação do chamador
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Não autenticado' }, 401);

    // Buscar org do chamador
    const { data: callerProfile } = await supabaseAdmin
      .from('perfis')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!callerProfile) return jsonResponse({ error: 'Perfil não encontrado' }, 404);

    const orgId = callerProfile.organization_id;

    // Verificar se chamador tem permissão de gerenciar equipe
    // (dono da org = não tem entrada em team_member_permissions, OU tem role 'admin')
    const { data: callerPerm } = await supabaseAdmin
      .from('team_member_permissions')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (callerPerm && callerPerm.role !== 'admin') {
      return jsonResponse({ error: 'Sem permissão para gerenciar equipe' }, 403);
    }

    const body = await req.json();
    const { action } = body;

    // ── CRIAR MEMBRO ─────────────────────────────────────────────
    if (action === 'create_member') {
      const { email, password, nome, role = 'atendente', pages, read_only = {} } = body;

      if (!email) {
        return jsonResponse({ error: 'E-mail é obrigatório' }, 400);
      }

      // Gerar senha temporária internamente (o membro criará a própria via onboarding)
      const tempPassword = password || generatePassword(12);

      // Verificar se já existe usuário com esse email
      const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const existingUser = existingList?.users?.find((u: any) => u.email === email);

      let newUserId: string;

      if (existingUser) {
        // Checar se já está nessa org
        const { data: existingProfile } = await supabaseAdmin
          .from('perfis')
          .select('organization_id')
          .eq('id', existingUser.id)
          .maybeSingle();

        if (existingProfile?.organization_id === orgId) {
          return jsonResponse({ error: 'Este e-mail já está cadastrado nesta organização.' }, 400);
        }
        if (existingProfile) {
          return jsonResponse({ error: 'Este e-mail já está em uso em outra organização.' }, 400);
        }
        newUserId = existingUser.id;
        // Atualizar senha do usuário existente
        await supabaseAdmin.auth.admin.updateUserById(newUserId, { password: tempPassword });
      } else {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: nome || email.split('@')[0] },
        });

        if (createError || !newUser?.user) {
          return jsonResponse({ error: createError?.message || 'Erro ao criar usuário' }, 400);
        }

        newUserId = newUser.user.id;
      }

      // Criar/atualizar perfil na mesma org
      const { error: profileError } = await supabaseAdmin.from('perfis').upsert({
        id: newUserId,
        organization_id: orgId,
        nome_completo: nome || email.split('@')[0],
        email: email.toLowerCase(),
      }, { onConflict: 'id' });

      if (profileError) {
        return jsonResponse({ error: `Erro no perfil: ${profileError.message}` }, 400);
      }

      // Criar entrada de permissões
      const resolvedPages = pages || DEFAULT_PAGES[role] || DEFAULT_PAGES.atendente;
      const { error: permError } = await supabaseAdmin.from('team_member_permissions').insert({
        organization_id: orgId,
        user_id: newUserId,
        email,
        nome: nome || email.split('@')[0],
        role,
        pages: resolvedPages,
        read_only,
      });

      if (permError) {
        return jsonResponse({ error: `Erro nas permissões: ${permError.message}` }, 400);
      }

      // Criar platform_users para o membro (habilita onboarding de senha)
      await supabaseAdmin.from('platform_users').upsert({
        id: newUserId,
        plan: 'pca',
        crm_user_id: newUserId,
        onboarding_complete: false,
        platform_onboarding_enabled: true,
      }, { onConflict: 'id' });

      // Buscar nome da clínica (org do chamador)
      const { data: orgData } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .maybeSingle();
      const clinicName = orgData?.name || 'sua clínica';

      // Gerar magic link para o convite
      const appUrl = Deno.env.get('PLATFORM_URL') || 'https://plataforma.descompliqueiofc.com';
      let magicLink: string | null = null;
      let emailSent = false;

      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: appUrl },
      });

      if (linkErr) {
        console.error(`[manage-team:create_member] generateLink error: ${linkErr.message}`);
      } else {
        magicLink = (linkData as any)?.properties?.action_link ?? null;
      }

      // Enviar e-mail de convite via Resend
      if (magicLink) {
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (!resendKey) {
          console.error('[manage-team] RESEND_API_KEY ausente — convite NÃO enviado');
        }
        const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Descompliquei <boas-vindas@descompliqueiofc.com>';

        const ROLE_NAMES: Record<string, string> = {
          admin: 'Administrador', comercial: 'Comercial', atendente: 'Atendente', custom: 'Personalizado',
        };

        const emailHtml = generateInviteEmailHtml({
          memberName: nome || '',
          clinicName,
          roleName: ROLE_NAMES[role] || role,
          magicLink,
          email,
        });

        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: `Você foi convidado(a) para a equipe de ${clinicName}`,
              html: emailHtml,
            }),
          });

          if (resendRes.ok) {
            emailSent = true;
            console.log(`[manage-team:create_member] Invite email sent to ${email}`);
          } else {
            const errBody = await resendRes.text();
            console.error(`[manage-team:create_member] Resend error: ${resendRes.status} ${errBody}`);
          }
        } catch (emailErr: any) {
          console.error(`[manage-team:create_member] Email send error: ${emailErr.message}`);
        }
      }

      return jsonResponse({ success: true, user_id: newUserId, email_sent: emailSent });
    }

    // ── ATUALIZAR PERMISSÕES ──────────────────────────────────────
    if (action === 'update_member') {
      const { user_id, nome, role, pages, read_only } = body;

      if (!user_id) return jsonResponse({ error: 'user_id obrigatório' }, 400);

      const updateData: any = {};
      if (nome !== undefined) updateData.nome = nome;
      if (role !== undefined) updateData.role = role;
      if (pages !== undefined) updateData.pages = pages;
      if (read_only !== undefined) updateData.read_only = read_only;

      const { error } = await supabaseAdmin
        .from('team_member_permissions')
        .update(updateData)
        .eq('organization_id', orgId)
        .eq('user_id', user_id);

      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ success: true });
    }

    // ── REDEFINIR SENHA ───────────────────────────────────────────
    if (action === 'reset_password') {
      const { user_id, new_password } = body;

      if (!user_id || !new_password) {
        return jsonResponse({ error: 'user_id e new_password obrigatórios' }, 400);
      }

      // Garantir que o user_id pertence à org
      const { data: memberCheck } = await supabaseAdmin
        .from('team_member_permissions')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', user_id)
        .maybeSingle();

      if (!memberCheck) return jsonResponse({ error: 'Membro não encontrado nesta organização' }, 404);

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: new_password,
      });

      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ success: true });
    }

    // ── REMOVER MEMBRO ────────────────────────────────────────────
    if (action === 'delete_member') {
      const { user_id } = body;
      if (!user_id) return jsonResponse({ error: 'user_id obrigatório' }, 400);

      // Verificar que pertence à org
      const { data: memberCheck } = await supabaseAdmin
        .from('team_member_permissions')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', user_id)
        .maybeSingle();

      if (!memberCheck) return jsonResponse({ error: 'Membro não encontrado' }, 404);

      // Remover permissões
      await supabaseAdmin
        .from('team_member_permissions')
        .delete()
        .eq('organization_id', orgId)
        .eq('user_id', user_id);

      // Deletar usuário do Auth
      await supabaseAdmin.auth.admin.deleteUser(user_id);

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Ação inválida' }, 400);

  } catch (err: any) {
    console.error('[manage-team] Erro:', err);
    return jsonResponse({ error: err.message || 'Erro interno' }, 500);
  }
});
