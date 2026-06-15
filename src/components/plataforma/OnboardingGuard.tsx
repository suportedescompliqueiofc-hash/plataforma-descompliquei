import { Navigate, Outlet } from "react-router-dom";
import { usePlataforma } from "@/contexts/PlataformaContext";

export function OnboardingGuard() {
  const { plataformaUser, isContextLoading, isMember } = usePlataforma();

  // Aguarda o contexto carregar antes de decidir
  if (isContextLoading) return null;

  // Só aplica o guard para novos donos de conta que precisam completar o onboarding diagnóstico
  // platform_onboarding_enabled=true indica que é um novo usuário; usuários antigos ficam false
  if (
    !isMember &&
    plataformaUser?.platform_onboarding_enabled === true &&
    plataformaUser?.onboarding_concluido === false
  ) {
    return <Navigate to="/plataforma/onboarding" replace />;
  }

  return <Outlet />;
}
