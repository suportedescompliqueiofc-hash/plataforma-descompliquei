import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generatePassword(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

function respond(body: Record<string, any>, _status = 200) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Email HTML ────────────────────────────────────────────────────────────────
function generateWelcomeEmailHtml(opts: {
  clinicName: string;
  planName: string;
  magicLink: string;
  email: string;
  isExisting: boolean;
  isCrmOnly: boolean;
}): string {
  const { clinicName, planName, magicLink, email, isExisting, isCrmOnly } = opts;
  const productLabel = isCrmOnly ? 'CRM Descompliquei' : 'Plataforma Descompliquei';
  const headline = isExisting ? 'Seu acesso foi atualizado' : isCrmOnly ? 'Bem-vindo(a) ao CRM!' : 'Bem-vindo(a) à plataforma';
  const bodyText = isExisting
    ? `Seu plano no ${productLabel} foi atualizado para <strong>${planName}</strong>. Acesse com o link abaixo para continuar de onde parou.`
    : isCrmOnly
      ? `Seu acesso ao CRM Descompliquei está pronto. Clique no botão abaixo para entrar — não é necessária senha no primeiro acesso.`
      : `Seu acesso à Plataforma Descompliquei está pronto. Clique no botão abaixo para entrar — não é necessária senha no primeiro acesso.`;
  const ctaLabel = isCrmOnly ? 'Acessar o CRM &rarr;' : 'Acessar a Plataforma &rarr;';
  const infoTitle = isCrmOnly ? 'O que você encontrará no CRM' : 'O que você encontrará na plataforma';
  const infoBody = isCrmOnly
    ? 'Gestão de leads &middot; Conversas WhatsApp &middot; Agendamentos &middot; Vendas e métricas comerciais.'
    : 'Trilha de Aprendizado &middot; Cérebro Central &middot; IAs Comerciais &middot; Sessões Táticas e ferramentas para atrair, atender e fechar mais pacientes.';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f1f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f1f3;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#0d0d10 0%,#1c1c28 100%);border-radius:16px 16px 0 0;padding:40px 40px 32px;">
              <!-- Brand pill -->
              <div style="display:inline-block;background:#E85D24;border-radius:8px;padding:6px 18px;margin-bottom:24px;">
                <span style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">DESCOMPLIQUEI</span>
              </div>
              <h1 style="color:#ffffff;font-size:26px;font-weight:700;margin:0 0 8px;line-height:1.3;">${headline}</h1>
              <p style="color:rgba(255,255,255,0.45);font-size:14px;margin:0;">${clinicName}</p>
            </td>
          </tr>

          <!-- Plan badge strip -->
          <tr>
            <td style="background:#fff8f5;border-left:1px solid #fde5d4;border-right:1px solid #fde5d4;padding:14px 40px;">
              <span style="display:inline-block;background:#E85D24;color:#ffffff;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 14px;border-radius:20px;">${planName}</span>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:36px 40px 32px;">

              <p style="color:#111827;font-size:15px;line-height:1.65;margin:0 0 16px;">${bodyText}</p>
              <p style="color:#6b7280;font-size:13px;line-height:1.65;margin:0 0 32px;">
                O link é de uso único e expira em <strong style="color:#374151;">24 horas</strong>. Após o primeiro acesso você poderá definir uma senha se preferir.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <a href="${magicLink}"
                       style="display:inline-block;background:#E85D24;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 44px;border-radius:12px;letter-spacing:0.2px;line-height:1;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="border-top:1px solid #f3f4f6;margin-bottom:28px;"></div>

              <!-- Info block -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#fafafa;border-radius:10px;border-left:3px solid #E85D24;padding:16px 20px;">
                    <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 6px;">${infoTitle}</p>
                    <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.6;">
                      ${infoBody}
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px;padding:20px 40px;">
              <p style="color:#9ca3af;font-size:12px;margin:0 0 8px;line-height:1.5;">
                Se o botão não abrir, copie e cole este link no navegador:
              </p>
              <p style="margin:0;">
                <a href="${magicLink}" style="color:#E85D24;font-size:12px;word-break:break-all;text-decoration:none;">${magicLink}</a>
              </p>
            </td>
          </tr>

          <!-- Bottom note -->
          <tr>
            <td align="center" style="padding:20px 0 0;">
              <p style="color:#9ca3af;font-size:11px;margin:0;">
                Descompliquei Marketing &middot; Enviado para ${email}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let step = 'init';

  try {
    // 1. Validar JWT do caller
    step = 'validate-jwt';
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return respond({ error: 'Não autorizado' }, 401);

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return respond({ error: 'Token inválido' }, 401);
    console.log(`[step:validate-jwt] OK caller=${caller.id}`);

    // 2. Verificar se caller é superadmin
    step = 'check-superadmin';
    const { data: adminRole, error: adminRoleErr } = await supabaseAdmin
      .from('usuarios_papeis')
      .select('id')
      .eq('usuario_id', caller.id)
      .eq('papel', 'superadmin')
      .maybeSingle();

    if (adminRoleErr) {
      console.error(`[step:check-superadmin] ERROR: ${adminRoleErr.message}`);
      return respond({ error: `Erro ao verificar papel: ${adminRoleErr.message}` }, 500);
    }
    if (!adminRole) return respond({ error: 'Acesso negado: não é superadmin' }, 403);
    console.log(`[step:check-superadmin] OK`);

    // 3. Validar body
    step = 'parse-body';
    const body = await req.json();
    const { email, clinic_name, product_id, trial_ends_at, monthly_fee, send_welcome, site_url, responsible_name } = body;
    console.log(`[step:parse-body] email=${email} clinic=${clinic_name} product_id=${product_id}`);

    if (!email || !clinic_name) {
      return respond({ error: 'email e clinic_name são obrigatórios' }, 400);
    }

    // 4. Buscar produto (se fornecido)
    step = 'fetch-product';
    let productName: string | null = null;
    let productPlan: string = 'pca';
    let hasPlataformaAccess = true; // default: assume plataforma completa
    if (product_id) {
      const { data: prod, error: prodErr } = await supabaseAdmin
        .from('platform_products')
        .select('nome, plano, acesso_arsenal, acesso_os, acesso_sessoes_taticas, acesso_materiais')
        .eq('id', product_id)
        .maybeSingle();
      if (prodErr) console.error(`[step:fetch-product] ERROR: ${prodErr.message}`);
      productName = prod?.nome ?? null;
      productPlan = prod?.plano ?? 'pca';
      hasPlataformaAccess = !!(prod?.acesso_arsenal || prod?.acesso_os || prod?.acesso_sessoes_taticas || prod?.acesso_materiais);
    }
    console.log(`[step:fetch-product] productName=${productName} plan=${productPlan} hasPlataformaAccess=${hasPlataformaAccess}`);

    // 5. Gerar senha temporária
    const senha_temporaria = generatePassword(12);

    // 6. Criar ou encontrar usuário Auth
    step = 'create-auth-user';
    let isExisting = false;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha_temporaria,
      email_confirm: true,
      user_metadata: { full_name: responsible_name || clinic_name },
    });

    let userIdResolved: string | null = null;

    if (authError) {
      console.log(`[step:create-auth-user] createUser failed: ${authError.message} (status=${authError.status})`);
      const isDup = authError.message?.toLowerCase()?.includes('already') ||
                    authError.message?.toLowerCase()?.includes('exist') ||
                    authError.message?.toLowerCase()?.includes('registered') ||
                    authError.status === 422 ||
                    authError.code === 'email_exists';

      if (isDup) {
        step = 'find-existing-user';
        let page = 1;
        const perPage = 1000;
        while (page <= 10 && !userIdResolved) {
          const { data: authUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
          if (listErr) {
            console.error(`[step:find-existing-user] listUsers page=${page} error: ${listErr.message}`);
            break;
          }
          const found = authUsers?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
          if (found) {
            userIdResolved = found.id;
            console.log(`[step:find-existing-user] found via auth listUsers page=${page}: ${userIdResolved}`);
            break;
          }
          if (!authUsers?.users || authUsers.users.length < perPage) break;
          page++;
        }

        if (!userIdResolved) {
          const { data: perfilExistente } = await supabaseAdmin
            .from('perfis')
            .select('id')
            .eq('email', email.toLowerCase())
            .maybeSingle();
          if (perfilExistente) {
            userIdResolved = perfilExistente.id;
            console.log(`[step:find-existing-user] found via perfis: ${userIdResolved}`);
          }
        }

        if (!userIdResolved) {
          return respond({ error: `Usuário ${email} existe no Auth mas não foi encontrado. Verifique no painel.` });
        }

        isExisting = true;
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUser(userIdResolved, { password: senha_temporaria });
        if (updateErr) {
          console.error(`[step:find-existing-user] updateUser error: ${updateErr.message}`);
          return respond({ error: `Erro ao atualizar senha do usuário existente: ${updateErr.message}` });
        }
        console.log(`[step:find-existing-user] password updated OK`);
      } else {
        return respond({ error: `Erro ao criar usuário Auth: ${authError.message}` });
      }
    } else {
      userIdResolved = authData.user.id;
      console.log(`[step:create-auth-user] NEW user created: ${userIdResolved}`);
    }

    if (!userIdResolved) {
      return respond({ error: 'Falha ao resolver userId após criação/busca de usuário' });
    }
    const userId: string = userIdResolved;

    // 7. Buscar ou criar organization
    step = 'find-or-create-org';
    let orgId: string;
    const { data: existingOrg, error: orgFindErr } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .ilike('name', clinic_name.trim())
      .maybeSingle();

    if (orgFindErr) console.error(`[step:find-or-create-org] find error: ${orgFindErr.message}`);

    if (existingOrg) {
      orgId = existingOrg.id;
      console.log(`[step:find-or-create-org] existing org: ${orgId}`);
    } else {
      const { data: newOrg, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({ name: clinic_name.trim(), onboarding_enabled: true })
        .select('id')
        .single();
      if (orgError) {
        console.error(`[step:find-or-create-org] insert error: ${orgError.message}`);
        return respond({ error: `Erro ao criar organização: ${orgError.message}` }, 500);
      }
      orgId = newOrg.id;
      console.log(`[step:find-or-create-org] NEW org: ${orgId}`);
    }

    // 8. Criar/atualizar perfil
    step = 'upsert-perfil';
    const { error: perfilError } = await supabaseAdmin
      .from('perfis')
      .upsert({
        id: userId,
        organization_id: orgId,
        nome_completo: responsible_name || clinic_name,
        email: email.toLowerCase(),
      }, { onConflict: 'id' });
    if (perfilError) {
      console.error(`[step:upsert-perfil] ERROR: ${perfilError.message}`);
      return respond({ error: `Erro ao criar perfil: ${perfilError.message}` }, 500);
    }
    console.log(`[step:upsert-perfil] OK`);

    // 9. Dar papel de admin
    step = 'insert-role';
    const { data: existingRole } = await supabaseAdmin
      .from('usuarios_papeis')
      .select('id')
      .eq('usuario_id', userId)
      .eq('papel', 'admin')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleInsertErr } = await supabaseAdmin
        .from('usuarios_papeis')
        .insert({ usuario_id: userId, papel: 'admin' });
      if (roleInsertErr) {
        console.error(`[step:insert-role] insert ERROR: ${roleInsertErr.message}`);
        return respond({ error: `Erro ao inserir papel: ${roleInsertErr.message}` }, 500);
      }
    }
    console.log(`[step:insert-role] OK`);

    // 10. Criar platform_users
    step = 'upsert-platform-user';
    const { error: puError } = await supabaseAdmin
      .from('platform_users')
      .upsert({
        id: userId,
        plan: productPlan,
        clinic_name,
        crm_user_id: userId,
        onboarding_complete: false,
        cerebro_complete: false,
        // Só habilita o onboarding da plataforma para produtos com features além do CRM
        platform_onboarding_enabled: hasPlataformaAccess,
      }, { onConflict: 'id' });
    if (puError) {
      console.error(`[step:upsert-platform-user] ERROR: ${puError.message}`);
      return respond({ error: `Erro ao criar platform_users: ${puError.message}` }, 500);
    }
    console.log(`[step:upsert-platform-user] OK`);

    // 11. Criar/atualizar platform_tenants
    step = 'upsert-tenant';
    const { data: existingTenant } = await supabaseAdmin
      .from('platform_tenants')
      .select('id')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (existingTenant) {
      await supabaseAdmin
        .from('platform_tenants')
        .update({
          product_id: product_id || null,
          status: 'ativo',
          trial_ends_at: trial_ends_at || null,
          monthly_fee: monthly_fee ?? 0,
        })
        .eq('id', existingTenant.id);
    } else {
      const { error: tenantInsertErr } = await supabaseAdmin
        .from('platform_tenants')
        .insert({
          organization_id: orgId,
          product_id: product_id || null,
          status: 'ativo',
          trial_ends_at: trial_ends_at || null,
          monthly_fee: monthly_fee ?? 0,
        });
      if (tenantInsertErr) {
        console.error(`[step:upsert-tenant] insert ERROR: ${tenantInsertErr.message}`);
        return respond({ error: `Erro ao criar tenant: ${tenantInsertErr.message}` }, 500);
      }
    }
    console.log(`[step:upsert-tenant] OK`);

    // 12. Gerar magic link
    step = 'generate-magic-link';
    let magicLink: string | null = null;
    // Redireciona para o produto correto — plataforma completa ou CRM isolado
    const platformUrl = Deno.env.get('PLATFORM_URL') || 'https://plataforma.descompliqueiofc.com';
    const crmUrl = Deno.env.get('CRM_URL') || `${platformUrl}/crm`;
    const appUrl = hasPlataformaAccess ? platformUrl : crmUrl;

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: appUrl },
    });

    if (linkErr) {
      console.error(`[step:generate-magic-link] ERROR: ${linkErr.message}`);
    } else {
      magicLink = (linkData as any)?.properties?.action_link ?? null;
      console.log(`[step:generate-magic-link] OK link=${magicLink ? 'gerado' : 'null'}`);
    }

    // 13. Enviar email de boas-vindas via Resend
    let emailSent = false;
    let resendError: string | null = null;

    if (send_welcome === false) {
      console.log(`[step:send-welcome-email] SKIPPED (send_welcome=false)`);
    } else if (!magicLink) {
      resendError = 'Magic link não gerado — email não enviado.';
      console.warn(`[step:send-welcome-email] SKIPPED: magicLink is null`);
    } else {
      step = 'send-welcome-email';
      const resendKey = Deno.env.get('RESEND_API_KEY') || 're_DXMBEgHd_Cz3HntziNJPtTT6gQ3SY8maq';
      // Domínio verificado no Resend: descompliqueiofc.com
      // Para alterar o remetente, setar RESEND_FROM_EMAIL nos secrets do Supabase
      const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Descompliquei <boas-vindas@descompliqueiofc.com>';
      const displayPlan = productName || productPlan.toUpperCase();

      console.log(`[step:send-welcome-email] Sending via Resend from="${fromEmail}" to="${email}"`);

      const emailHtml = generateWelcomeEmailHtml({
        clinicName: clinic_name,
        planName: displayPlan,
        magicLink,
        email,
        isExisting,
        isCrmOnly: !hasPlataformaAccess,
      });

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: isExisting
            ? `Seu acesso foi atualizado — ${displayPlan}`
            : `Bem-vindo(a) à Plataforma Descompliquei — ${displayPlan}`,
          html: emailHtml,
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        resendError = `Resend ${resendRes.status}: ${errBody}`;
        console.error(`[step:send-welcome-email] FAILED ${resendRes.status}: ${errBody}`);
      } else {
        const resendData = await resendRes.json();
        emailSent = true;
        console.log(`[step:send-welcome-email] OK id=${resendData?.id}`);
      }
    }

    console.log(`[create-platform-user] SUCCESS: ${email} → user=${userId} org=${orgId} existing=${isExisting} emailSent=${emailSent} magicLinkGenerated=${!!magicLink}`);

    return respond({
      ok: true,
      user_id: userId,
      org_id: orgId,
      product_name: productName,
      is_existing: isExisting,
      email_sent: emailSent,
      magic_link_generated: !!magicLink,
      resend_error: resendError,
    });

  } catch (err: any) {
    console.error(`[create-platform-user] UNCAUGHT at step="${step}": ${err.message}\n${err.stack}`);
    return respond({ error: `Erro no passo "${step}": ${err.message}` }, 500);
  }
});
