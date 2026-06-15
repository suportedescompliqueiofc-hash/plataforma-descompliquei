import { Navigate, Outlet } from "react-router-dom";
import { usePlataforma } from "@/contexts/PlataformaContext";

export function OnboardingGuard() {
  const { plataformaUser, isContextLoading, isMember } = usePlataforma();

  // Aguarda o contexto carregar antes de decidir
  if (isContextLoading) return null;

  // Só aplica o guard para o dono da conta (não para membros da equipe)
  if (!isMember && plataformaUser && plataformaUser.onboarding_concluido === false) {
    return <Navigate to="/plataforma/onboarding" replace />;
  }

  return <Outlet />;
}
