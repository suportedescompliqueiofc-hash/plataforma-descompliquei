import type { AcessoProduto } from '@/contexts/PlataformaContext';

// Produto que só libera o CRM, sem nenhuma feature de aprendizado/plataforma.
// Usado pelo PlataformaGuard para bloquear /plataforma/* de quem não tem nada lá.
export function isSomenteCRM(acesso: AcessoProduto | null): boolean {
  if (!acesso) return false;
  return (
    acesso.acesso_crm === true &&
    acesso.acesso_cerebro === false &&
    acesso.acesso_sessoes_taticas === false &&
    acesso.acesso_materiais === false &&
    acesso.acesso_ia_comercial === false &&
    (!acesso.pilares_liberados || acesso.pilares_liberados.length === 0) &&
    (!acesso.ias_liberadas || acesso.ias_liberadas.length === 0)
  );
}

export function getRedirectDestino(acesso: AcessoProduto | null): string {
  if (!acesso) return '/plataforma';

  // Quem tem acesso ao CRM entra direto no Painel — o Hub da plataforma
  // só é o destino de quem não tem CRM (só aprendizado/plataforma).
  if (acesso.acesso_crm === true) return '/crm';
  return '/plataforma';
}
