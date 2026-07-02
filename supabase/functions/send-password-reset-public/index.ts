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

  // Sempre retorna sucesso para evitar enumeração de e-mails
  const ok = new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') return ok;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Gerar link de recuperação via Admin API
    const platformUrl = Deno.env.get('PLATFORM_URL') || 'https://plataforma.descompliqueiofc.com';
    const redirectTo = `${platformUrl}/crm/settings?section=security&recovery=true`;

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase().trim(),
      options: { redirectTo },
    });

    // Se o e-mail não existe, generateLink retorna erro — retornamos ok mesmo assim
    if (linkErr || !(linkData as any)?.properties?.action_link) {
      console.log(`[send-password-reset-public] generateLink skipped: ${linkErr?.message}`);
      return ok;
    }

    const resetLink: string = (linkData as any).properties.action_link;

    // Enviar via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY') || 're_DXMBEgHd_Cz3HntziNJPtTT6gQ3SY8maq';
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
      console.error(`[send-password-reset-public] Resend ${resendRes.status}: ${errBody}`);
    } else {
      console.log(`[send-password-reset-public] OK email=${email}`);
    }

    return ok;

  } catch (err: any) {
    console.error(`[send-password-reset-public] UNCAUGHT: ${err.message}`);
    return ok; // sempre ok para não vazar informações
  }
});
