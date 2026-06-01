import { createContext, useContext, ReactNode } from 'react';
import { useTutorial } from '@/hooks/useTutorial';

type TutorialContextType = ReturnType<typeof useTutorial>;

const TutorialContext = createContext<TutorialContextType | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const tutorial = useTutorial();

  return (
    <TutorialContext.Provider value={tutorial}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorialContext() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorialContext must be used within TutorialProvider');
  return ctx;
}
