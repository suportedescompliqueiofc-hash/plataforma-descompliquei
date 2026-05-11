import { useEffect, useRef, useCallback, useState } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ExcalidrawWrapperProps {
  boardId: string;
  initialElements: any[];
  initialAppState: any;
  initialFiles: any;
  onSaveStatusChange?: (status: SaveStatus) => void;
  autoSaveInterval?: number; // debounce ms after last change (default 3s)
  /** Ref populated with an imperative save function — call before unmounting */
  saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

// ━━━ Hash for change detection ━━━
function computeHash(elements: any[]): string {
  if (!elements || elements.length === 0) return "empty";
  return elements.map((el: any) => `${el.id}:${el.version}`).join("|");
}

export default function ExcalidrawWrapper({
  boardId,
  initialElements,
  initialAppState,
  initialFiles,
  onSaveStatusChange,
  autoSaveInterval = 3000, // 3 seconds debounce
  saveRef,
}: ExcalidrawWrapperProps) {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const userId = profile?.id;

  const [mounted, setMounted] = useState(false);

  // All mutable state in refs to avoid stale closures with Excalidraw
  const excalidrawAPIRef = useRef<any>(null);
  const currentElementsRef = useRef<any[]>(initialElements || []);
  const currentAppStateRef = useRef<any>(initialAppState || {});
  const currentFilesRef = useRef<any>(initialFiles || {});
  // Initialize hash with initial elements so first onChange (mount) doesn't trigger save
  const previousHashRef = useRef<string>(computeHash(initialElements || []));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const hasUnsavedRef = useRef(false);
  const lastVersionTimeRef = useRef<number>(Date.now());
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep parent callback in ref so we never go stale
  const onSaveStatusChangeRef = useRef(onSaveStatusChange);
  onSaveStatusChangeRef.current = onSaveStatusChange;

  const setSaveStatus = useCallback((status: SaveStatus) => {
    // Clear any pending "idle" timer
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    onSaveStatusChangeRef.current?.(status);
    // Auto-reset to idle after "saved"
    if (status === "saved") {
      statusTimerRef.current = setTimeout(() => {
        onSaveStatusChangeRef.current?.("idle");
      }, 3000);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  // ━━━ Thumbnail generation ━━━
  const gerarThumbnail = async (): Promise<string | null> => {
    const api = excalidrawAPIRef.current;
    if (!api) return null;
    try {
      const elements = api.getSceneElements();
      if (!elements || elements.length === 0) return null;

      const blob = await exportToBlob({
        elements,
        appState: {
          ...api.getAppState(),
          exportBackground: true,
        },
        files: api.getFiles(),
        maxWidthOrHeight: 400,
      });

      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn("[Canvas] Erro ao gerar thumbnail:", err);
      return null;
    }
  };

  // ━━━ Core save function (reads everything from refs, no stale closures) ━━━
  const salvarBoard = useCallback(
    async (options?: { saveVersion?: boolean }) => {
      if (!boardId || !orgId || isSavingRef.current) return;

      const elements = currentElementsRef.current;
      const appState = currentAppStateRef.current;
      const files = currentFilesRef.current;

      // Hash-based change detection
      const currentHash = computeHash(elements);
      if (currentHash === previousHashRef.current) {
        return; // Nothing changed
      }

      isSavingRef.current = true;
      setSaveStatus("saving");

      try {
        // Generate thumbnail
        const thumbnail = await gerarThumbnail();

        // Only keep serializable app_state keys
        const safeAppState = {
          viewBackgroundColor: appState?.viewBackgroundColor,
          gridSize: appState?.gridSize,
          zenModeEnabled: appState?.zenModeEnabled,
          theme: appState?.theme,
        };

        // Ensure files are JSON-serializable
        let safeFiles: any = {};
        try {
          safeFiles = JSON.parse(JSON.stringify(files || {}));
        } catch {
          safeFiles = {};
        }

        // Save board to Supabase
        const { error } = await (supabase.from("canvas_boards") as any)
          .update({
            elements,
            app_state: safeAppState,
            files: safeFiles,
            ...(thumbnail ? { thumbnail } : {}),
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", boardId);

        if (error) throw error;

        // Save version history only on manual save or every 5 minutes
        const now = Date.now();
        const shouldSaveVersion =
          options?.saveVersion ||
          now - lastVersionTimeRef.current > 5 * 60 * 1000;

        if (shouldSaveVersion) {
          lastVersionTimeRef.current = now;
          (supabase.from("canvas_versoes") as any)
            .insert({
              board_id: boardId,
              organization_id: orgId,
              usuario_id: userId,
              elements,
              app_state: safeAppState,
            })
            .then(({ error: vErr }: any) => {
              if (vErr) console.warn("[Canvas] Erro ao salvar versao:", vErr);
            });
        }

        previousHashRef.current = currentHash;
        hasUnsavedRef.current = false;
        setSaveStatus("saved");
      } catch (err) {
        console.error("[Canvas] Erro ao salvar:", err);
        setSaveStatus("error");
        toast.error("Erro ao salvar canvas");
      } finally {
        isSavingRef.current = false;
      }
    },
    // boardId, orgId, userId are stable for the component's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardId, orgId, userId, setSaveStatus]
  );

  // Ref always points to latest salvarBoard
  const salvarBoardRef = useRef(salvarBoard);
  salvarBoardRef.current = salvarBoard;

  // Expose imperative save to parent via ref
  useEffect(() => {
    if (saveRef) {
      saveRef.current = () => salvarBoardRef.current({ saveVersion: true });
    }
    return () => {
      if (saveRef) saveRef.current = null;
    };
  }, [saveRef]);

  // ━━━ Stable onChange handler — never changes reference ━━━
  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      currentElementsRef.current = [...elements];
      currentAppStateRef.current = appState;
      currentFilesRef.current = files || {};

      // Only mark dirty if hash actually changed
      const newHash = computeHash([...elements]);
      if (newHash === previousHashRef.current) return;

      hasUnsavedRef.current = true;

      // Debounce: save N ms after last change
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        salvarBoardRef.current();
      }, autoSaveInterval);
    },
    [autoSaveInterval]
  );

  // ━━━ Ctrl+S manual save (also creates a version snapshot) ━━━
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        salvarBoardRef.current({ saveVersion: true });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ━━━ Periodic fallback: save every 30s if there are unsaved changes ━━━
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedRef.current && !isSavingRef.current) {
        salvarBoardRef.current();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ━━━ Warn before browser close with unsaved changes ━━━
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ━━━ Save on unmount ━━━
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (hasUnsavedRef.current) {
        salvarBoardRef.current({ saveVersion: true });
      }
    };
  }, []);

  if (!mounted) return null;

  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div className="w-full h-full" style={{ position: "absolute", inset: 0 }}>
      <Excalidraw
        excalidrawAPI={(api: any) => {
          excalidrawAPIRef.current = api;
        }}
        initialData={{
          elements: initialElements || [],
          appState: {
            ...(initialAppState || {}),
            viewBackgroundColor:
              initialAppState?.viewBackgroundColor ||
              (isDark ? "#1e1e1e" : "#ffffff"),
            theme: isDark ? "dark" : "light",
          },
          files: initialFiles || undefined,
        }}
        onChange={handleChange}
        langCode="pt-BR"
        theme={isDark ? "dark" : "light"}
        UIOptions={{
          canvasActions: {
            saveToActiveFile: false,
            saveAsImage: true,
            loadScene: false,
            export: { saveFileToDisk: true },
          },
        }}
      />
    </div>
  );
}
