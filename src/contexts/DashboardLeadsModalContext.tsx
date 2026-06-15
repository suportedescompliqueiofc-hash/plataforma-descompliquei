import { createContext, useContext, useState, ReactNode } from 'react';

interface ModalState {
  title: string;
  leads: any[];
  stages: any[];
}

interface DashboardLeadsModalContextValue {
  openModal: (title: string, leads: any[], stages?: any[]) => void;
  closeModal: () => void;
  modal: ModalState | null;
}

const DashboardLeadsModalContext = createContext<DashboardLeadsModalContextValue | null>(null);

export function DashboardLeadsModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);

  const openModal = (title: string, leads: any[], stages: any[] = []) => {
    setModal({ title, leads, stages });
  };

  const closeModal = () => setModal(null);

  return (
    <DashboardLeadsModalContext.Provider value={{ openModal, closeModal, modal }}>
      {children}
    </DashboardLeadsModalContext.Provider>
  );
}

export function useDashboardLeadsModal() {
  const ctx = useContext(DashboardLeadsModalContext);
  if (!ctx) throw new Error('useDashboardLeadsModal must be used within DashboardLeadsModalProvider');
  return ctx;
}
