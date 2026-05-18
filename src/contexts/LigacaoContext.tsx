import { createContext, useContext, useState, ReactNode } from 'react';
import { OutboundProspecto } from '@/hooks/useOutboundProspectos';

interface LigacaoContextType {
  isModalOpen: boolean;
  prospecto: OutboundProspecto | null;
  openRegistrarLigacao: (prospecto?: OutboundProspecto | null) => void;
  closeModal: () => void;
  onLigacaoSaved: (() => void) | null;
  setOnLigacaoSaved: (cb: (() => void) | null) => void;
}

const LigacaoContext = createContext<LigacaoContextType | null>(null);

export function LigacaoProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prospecto, setProspecto] = useState<OutboundProspecto | null>(null);
  const [onLigacaoSaved, setOnLigacaoSaved] = useState<(() => void) | null>(null);

  const openRegistrarLigacao = (p?: OutboundProspecto | null) => {
    setProspecto(p || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setProspecto(null);
    setOnLigacaoSaved(null);
  };

  return (
    <LigacaoContext.Provider value={{ isModalOpen, prospecto, openRegistrarLigacao, closeModal, onLigacaoSaved, setOnLigacaoSaved }}>
      {children}
    </LigacaoContext.Provider>
  );
}

export function useLigacaoModal() {
  const ctx = useContext(LigacaoContext);
  if (!ctx) throw new Error('useLigacaoModal must be used within LigacaoProvider');
  return ctx;
}
