import { usePlataforma } from '@/contexts/PlataformaContext';
import { useProfile } from '@/hooks/useProfile';
import { SemAcesso } from './SemAcesso';
import type { AcessoProduto } from '@/contexts/PlataformaContext';

interface AcessoGuardProps {
  children: React.ReactNode;
  accessKey?: keyof Pick<AcessoProduto,
    'acesso_cerebro' | 'acesso_crm' | 'acesso_sessoes_taticas' | 'acesso_materiais' | 'acesso_ia_comercial' | 'acesso_os'
  >;
  /** Checa se o array (pilares_liberados ou ias_liberadas) tem pelo menos 1 item */
  arrayKey?: keyof Pick<AcessoProduto, 'pilares_liberados' | 'ias_liberadas'>;
}

export function AcessoGuard({ children, accessKey, arrayKey }: AcessoGuardProps) {
  const { acesso } = usePlataforma();
  const { role } = useProfile();

  if (role === 'superadmin') return <>{children}</>;

  // Se tem accessKey, checa o boolean
  if (accessKey && !acesso[accessKey]) {
    // Exceção: para IAs, se ias_liberadas tem itens, libera mesmo com acesso_ia_comercial = false
    if (accessKey === 'acesso_ia_comercial' && (acesso.ias_liberadas?.length ?? 0) > 0) {
      return <>{children}</>;
    }
    return <SemAcesso />;
  }

  // Se tem arrayKey, checa se o array tem pelo menos 1 item
  if (arrayKey) {
    const arr = acesso[arrayKey];
    if (!arr || arr.length === 0) return <SemAcesso />;
  }

  return <>{children}</>;
}
