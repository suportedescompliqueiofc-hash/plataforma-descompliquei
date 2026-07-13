import { useState, useEffect, useCallback } from 'react';
import { useProfile } from './useProfile';
import { supabase } from '@/integrations/supabase/client';
import type { TutorialStep } from '@/components/tutorial/tutorialData';

const STORAGE_KEY = 'crm_tutorial_progress';
const ADHOC_TUTORIAL_ID = '__adhoc__';

interface TutorialProgress {
  completedTutorials: string[];
  dismissedWelcome: boolean;
  lastSeenPage: string;
}

const defaultProgress: TutorialProgress = {
  completedTutorials: [],
  dismissedWelcome: false,
  lastSeenPage: '',
};

// ── Helpers de cache local (carregamento instantâneo) ──────────────────────────

function loadLocalProgress(orgId: string): TutorialProgress {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${orgId}`);
    if (raw) return { ...defaultProgress, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultProgress };
}

function saveLocalProgress(orgId: string, progress: TutorialProgress) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${orgId}`, JSON.stringify(progress));
  } catch {}
}

// ── Helpers de persistência no banco (compartilhado pela org) ─────────────────

async function fetchDbProgress(orgId: string): Promise<TutorialProgress | null> {
  const { data } = await supabase
    .from('organizations')
    .select('tutorial_progress')
    .eq('id', orgId)
    .single();

  if (!data?.tutorial_progress) return null;
  return { ...defaultProgress, ...(data.tutorial_progress as Partial<TutorialProgress>) };
}

async function saveDbProgress(orgId: string, progress: TutorialProgress) {
  await supabase
    .from('organizations')
    .update({ tutorial_progress: progress as any })
    .eq('id', orgId);
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useTutorial() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id || '';

  const [progress, setProgress]             = useState<TutorialProgress>(defaultProgress);
  const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null);
  const [activeStep, setActiveStep]         = useState(0);
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const [adHocStep, setAdHocStep]           = useState<TutorialStep | null>(null);

  // 1. Carrega localStorage imediatamente (sem flash), depois sincroniza com DB
  useEffect(() => {
    if (!orgId) return;

    const local = loadLocalProgress(orgId);
    setProgress(local);

    // Busca o progresso compartilhado da org no banco
    fetchDbProgress(orgId).then(dbProgress => {
      if (dbProgress) {
        setProgress(dbProgress);
        saveLocalProgress(orgId, dbProgress); // atualiza cache local
      }
    });
  }, [orgId]);

  // Helper: aplica update, persiste em localStorage e no banco simultaneamente
  const updateProgress = useCallback(
    (updater: (prev: TutorialProgress) => TutorialProgress) => {
      if (!orgId) return;
      setProgress(prev => {
        const next = updater(prev);
        saveLocalProgress(orgId, next);   // instantâneo
        saveDbProgress(orgId, next);       // compartilhado (fire-and-forget)
        return next;
      });
    },
    [orgId]
  );

  const completeTutorial = useCallback(
    (tutorialId: string) => {
      updateProgress(prev => ({
        ...prev,
        completedTutorials: prev.completedTutorials.includes(tutorialId)
          ? prev.completedTutorials
          : [...prev.completedTutorials, tutorialId],
      }));
      setActiveTutorialId(null);
      setActiveStep(0);
    },
    [updateProgress]
  );

  const dismissWelcome = useCallback(() => {
    updateProgress(prev => ({ ...prev, dismissedWelcome: true }));
  }, [updateProgress]);

  const resetTutorial = useCallback(
    (tutorialId: string) => {
      updateProgress(prev => ({
        ...prev,
        completedTutorials: prev.completedTutorials.filter(id => id !== tutorialId),
      }));
    },
    [updateProgress]
  );

  const resetAllTutorials = useCallback(() => {
    updateProgress(() => ({ ...defaultProgress }));
  }, [updateProgress]);

  const startTutorial = useCallback((tutorialId: string) => {
    setAdHocStep(null);
    setActiveTutorialId(tutorialId);
    setActiveStep(0);
    setHelpCenterOpen(false);
  }, []);

  // Spotlight avulso de 1 passo — usado pelo botão "Ver agora" das Atualizações,
  // que aponta pra um data-tutorial existente na página de destino sem precisar
  // de um tutorial completo cadastrado em tutorialData.ts.
  const startAdHocSpotlight = useCallback((step: TutorialStep) => {
    setAdHocStep(step);
    setActiveTutorialId(ADHOC_TUTORIAL_ID);
    setActiveStep(0);
    setHelpCenterOpen(false);
  }, []);

  const closeAdHocSpotlight = useCallback(() => {
    setActiveTutorialId(null);
    setActiveStep(0);
    setAdHocStep(null);
  }, []);

  const nextStep  = useCallback(() => setActiveStep(prev => prev + 1), []);
  const prevStep  = useCallback(() => setActiveStep(prev => Math.max(0, prev - 1)), []);

  const skipTutorial = useCallback(() => {
    if (activeTutorialId === ADHOC_TUTORIAL_ID) {
      closeAdHocSpotlight();
    } else if (activeTutorialId) {
      completeTutorial(activeTutorialId);
    }
  }, [activeTutorialId, completeTutorial, closeAdHocSpotlight]);

  const isTutorialCompleted = useCallback(
    (tutorialId: string) => progress.completedTutorials.includes(tutorialId),
    [progress.completedTutorials]
  );

  return {
    progress,
    activeTutorialId,
    activeStep,
    adHocStep,
    helpCenterOpen,
    setHelpCenterOpen,
    startTutorial,
    startAdHocSpotlight,
    closeAdHocSpotlight,
    completeTutorial,
    dismissWelcome,
    resetTutorial,
    resetAllTutorials,
    nextStep,
    prevStep,
    skipTutorial,
    isTutorialCompleted,
  };
}
