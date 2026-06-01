import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlataforma } from '@/contexts/PlataformaContext';
import { useProfile } from '@/hooks/useProfile';
import { getRedirectDestino } from '@/utils/redirectUtils';

/**
 * PlataformaGuard pode ser usado de duas formas:
 * 1. Como layout route (sem children) — renderiza <Outlet />
 * 2. Como wrapper (com children) — renderiza children
 */
export function PlataformaGuard({ children }: { children?: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { tenant, diasRestantes, isContextLoading, acesso, isMember } = usePlataforma();
  const { role } = useProfile();
  const isSuperAdmin = role === 'superadmin';

  // Enquanto auth carrega, mostra spinner mínimo
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Membros da equipe não acessam a plataforma — vão direto para o CRM
  if (isMember && !isContextLoading) {
    return <Navigate to="/crm" replace />;
  }

  // Superadmin acessa a plataforma livremente para visualização — nunca redireciona
  if (!isSuperAdmin && !isContextLoading) {
    // Acesso bloqueado (só verifica se tenant existe)
    if (tenant?.status === 'bloqueado') {
      return <Navigate to="/login?msg=bloqueado" replace />;
    }

    // Trial expirado (só verifica se tenant existe)
    if (tenant && diasRestantes !== null && diasRestantes < 0) {
      return <Navigate to="/login?msg=expirado" replace />;
    }

    // Produto somente CRM — redireciona em vez de mostrar erro
    if (getRedirectDestino(acesso) === '/crm') {
      return <Navigate to="/crm" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
}
