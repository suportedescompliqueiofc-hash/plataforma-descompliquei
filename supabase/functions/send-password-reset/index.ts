import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateResetEmailHtml(opts: { email: string; resetLink: string }): string {
  const { email, resetLink } = opts;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinir senha</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f1f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f1f3;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#0d0d10 0%,#1c1c28 100%);border-radius:16px 16px 0 0;padding:40px 40px 32px;">
              <div style="display:inline-block;background:#E85D24;border-radius:8px;padding:6px 18px;margin-bottom:24px;">
                <span style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">DESCOMPLIQUEI</span>
              </div>
              <h1 style="color:#ffffff;font-size:26px;font-weight:700;margin:0 0 8px;line-height:1.3;">Redefinir senha</h1>
              <p style="color:rgba(255,255,255,0.45);font-size:14px;margin:0;">Solicitação de nova senha recebida</p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:36px 40px 32px;">

              <p style="color:#111827;font-size:15px;line-height:1.65;margin:0 0 16px;">
                Recebemos uma solicitação para redefinir a senha da sua conta.
              </p>
              <p style="color:#6b7280;font-size:13px;line-height:1.65;margin:0 0 32px;">
                Clique no botão abaixo para criar uma nova senha. O link é de uso único e expira em
                <strong style="color:#374151;">1 hora</strong>.<br/>
                Se você não solicitou isso, pode ignorar este e-mail com segurança.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <a href="${resetLink}"
                       style="display:inline-block;background:#E85D24;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 44px;border-radius:12px;letter-spacing:0.2px;line-height:1;">
                      Redefinir senha &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="border-top:1px solid #f3f4f6;margin-bottom:28px;"></div>

              <!-- Dica -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#fafafa;border-radius:10px;border-left:3px solid #E85D24;padding:16px 20px;">
                    <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 6px;">Dica de segurança</p>
                    <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.6;">
                      Use ao menos 8 caracteres combinando letras maiúsculas, minúsculas, números e símbolos para uma senha forte.
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
                <a href="${resetLink}" style="color:#E85D24;font-size:12px;word-break:break-all;text-decoration:none;">${resetLink}</a>
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const respond = (body: Record<string, any>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // 1. Validar sessão do caller — e-mail vem do token, não do body (evita spoofing)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return respond({ error: 'Não autorizado' }, 401);

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user?.email) return respond({ error: 'Sessão inválida' }, 401);

    const email = user.email;
    console.log(`[send-password-reset] user=${user.id} email=${email}`);

    // 2. Gerar link de recuperação via Admin API
    const platformUrl = Deno.env.get('PLATFORM_URL') || 'https://plataforma.descompliqueiofc.com';
    // &recovery=true persiste na query string após o Supabase limpar o hash
    const redirectTo = `${platformUrl}/crm/settings?section=security&recovery=true`;

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (linkErr || !(linkData as any)?.properties?.action_link) {
      console.error(`[send-password-reset] generateLink error: ${linkErr?.message}`);
      return respond({ error: 'Erro ao gerar link de recuperação.' }, 500);
    }

    const resetLink: string = (linkData as any).properties.action_link;

    // 3. Enviar via Resend com template customizado
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('[send-password-reset] RESEND_API_KEY ausente — e-mail NÃO enviado');
      return respond({ error: 'Serviço de e-mail não configurado' }, 500);
    }
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Descompliquei <boas-vindas@descompliqueiofc.com>';

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Redefinir senha — Descompliquei',
        html: generateResetEmailHtml({ email, resetLink }),
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error(`[send-password-reset] Resend ${resendRes.status}: ${errBody}`);
      return respond({ error: 'Erro ao enviar e-mail.' }, 500);
    }

    console.log(`[send-password-reset] OK email=${email}`);
    return respond({ ok: true, email });

  } catch (err: any) {
    console.error(`[send-password-reset] UNCAUGHT: ${err.message}`);
    return respond({ error: err.message }, 500);
  }
});
