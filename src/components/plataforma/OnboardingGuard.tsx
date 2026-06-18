import { Navigate, Outlet } from "react-router-dom";
import { usePlataforma } from "@/contexts/PlataformaContext";

export function OnboardingGuard() {
  const { plataformaUser, isContextLoading, isMember, hasPlataformaAccess } = usePlataforma();

  // Enquanto carrega, mostra o conteúdo (evita flash em branco)
  if (isContextLoading) return <Outlet />;

  // Onboarding completo (diagnóstico → Athos → Jornada) só para produtos com acesso à plataforma
  // Produto CRM isolado (sem Arsenal, Athos, Sessões ou Materiais) não passa por este fluxo
  if (
    !isMember &&
    hasPlataformaAccess &&
    plataformaUser?.platform_onboarding_enabled === true &&
    plataformaUser?.onboarding_concluido === false
  ) {
    return <Navigate to="/plataforma/onboarding" replace />;
  }

  return <Outlet />;
}
