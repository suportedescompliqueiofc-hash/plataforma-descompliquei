import { Outlet } from "react-router-dom";

// Onboarding de primeiro acesso (diagnóstico com "monte de perguntas") DESATIVADO
// em 2026-07-16 a pedido do dono: o usuário entra direto na plataforma, sem ser
// forçado ao fluxo /plataforma/onboarding. A jornada de implementação passa a ser
// montada exclusivamente pelo CS. A rota /plataforma/onboarding continua existindo,
// mas ninguém é mais redirecionado para ela automaticamente.
export function OnboardingGuard() {
  return <Outlet />;
}
