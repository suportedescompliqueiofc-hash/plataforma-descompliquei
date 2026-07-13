import React, { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import '@excalidraw/excalidraw/index.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiagramaEditorProps {
  data?: Record<string, unknown> | null;
  height?: number | string;
  onChange?: (data: Record<string, unknown>) => void;
}

const ExcalidrawLazy = React.lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw }))
);

interface DiagramaViewerProps {
  data: Record<string, unknown>;
  height?: number | string;
}

function ExcalidrawWithFit({ data }: { data: Record<string, unknown> }) {
  const [api, setApi] = useState<any>(null);

  // Fit all content into viewport after mount
  useEffect(() => {
    if (!api) return;
    const t = setTimeout(() => {
      api.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.88 });
    }, 80);
    return () => clearTimeout(t);
  }, [api]);

  const initialData = useMemo(() => ({
    elements: data.elements ?? [],
    appState: { viewBackgroundColor: '#ffffff' },
  }), [data]);

  return (
    <ExcalidrawLazy
      excalidrawAPI={(a: any) => setApi(a)}
      initialData={initialData}
      viewModeEnabled={true}
      zenModeEnabled={true}
      gridModeEnabled={false}
    />
  );
}

// ─── Editor (modo edição completo, sem viewModeEnabled) ──────────────────────

function ExcalidrawEditable({
  data,
  onChange,
}: {
  data: Record<string, unknown> | null;
  onChange?: (d: Record<string, unknown>) => void;
}) {
  const initialData = useMemo(() => ({
    elements: (data?.elements ?? []) as any[],
    appState: { viewBackgroundColor: '#ffffff' },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps — intentional: only use on mount

  return (
    <ExcalidrawLazy
      initialData={initialData}
      onChange={(elements, appState) => {
        onChange?.({
          elements: elements as any[],
          appState: { viewBackgroundColor: (appState as any).viewBackgroundColor ?? '#ffffff' },
        });
      }}
    />
  );
}

export function DiagramaEditor({ data, height = 500, onChange }: DiagramaEditorProps) {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [focused]);

  return (
    <div ref={containerRef} style={{ height }} className="w-full rounded-xl overflow-hidden border border-border/60 relative">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center bg-muted/10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        </div>
      }>
        <ExcalidrawEditable data={data ?? null} onChange={onChange} />
      </Suspense>
      {!focused && (
        <div className="absolute inset-0 z-20 cursor-default" onClick={() => setFocused(true)} />
      )}
    </div>
  );
}

// ─── Viewer (read-only com fit automático) ────────────────────────────────────

export function DiagramaViewer({ data, height = 480 }: DiagramaViewerProps) {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [focused]);

  return (
    <div ref={containerRef} style={{ height }} className="w-full rounded-b-2xl overflow-hidden relative [&_.App-bottom-bar]:hidden [&_.footer-center]:hidden">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center bg-muted/20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        </div>
      }>
        <ExcalidrawWithFit data={data} />
      </Suspense>

      {/* Overlay que bloqueia scroll/zoom até o usuário clicar dentro */}
      {!focused && (
        <div className="absolute inset-0 z-20 cursor-default" onClick={() => setFocused(true)} />
      )}

      {/* Gradient scroll indicators — pointer-events-none so não interferem com pan/zoom */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/70 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white/70 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white/70 to-transparent" />
      </div>
    </div>
  );
}
