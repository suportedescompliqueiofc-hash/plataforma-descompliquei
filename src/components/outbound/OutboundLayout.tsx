import { Outlet } from "react-router-dom";
import { LigacaoProvider } from "@/contexts/LigacaoContext";
import { LigacaoRegistroModal } from "./LigacaoRegistroModal";

export function OutboundLayout() {
  return (
    <LigacaoProvider>
      <Outlet />
      <LigacaoRegistroModal />
    </LigacaoProvider>
  );
}
