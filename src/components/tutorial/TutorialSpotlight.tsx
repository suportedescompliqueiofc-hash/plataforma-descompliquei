import { useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTutorialContext } from './TutorialProvider';
import { tutorials } from './tutorialData';

/**
 * Renders tutorial description with rich formatting:
 * - **bold** → <strong>
 * - \n → line breaks / paragraph splits
 * - Lines starting with • → bullet list items
 */
function renderDescription(text: string): ReactNode[] {
  const paragraphs = text.split('\n');
  const elements: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="space-y-1 pl-0.5">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex gap-1.5 items-start">
            <span className="text-foreground/40 mt-px select-none">•</span>
            <span>{formatInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  for (const line of paragraphs) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      continue;
    }
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
      bulletBuffer.push(trimmed.replace(/^[•\-]\s*/, ''));
    } else {
      flushBullets();
      elements.push(<p key={`p-${elements.length}`}>{formatInline(trimmed)}</p>);
    }
  }
  flushBullets();
  return elements;
}

/** Converts **bold** markers to <strong> tags */
function formatInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TutorialSpotlight() {
  const {
    activeTutorialId,
    activeStep,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
  } = useTutorialContext();

  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const tutorial = tutorials.find(t => t.id === activeTutorialId);
  const step = tutorial?.steps[activeStep];
  const totalSteps = tutorial?.steps.length || 0;
  const isLastStep = activeStep >= totalSteps - 1;

  const findTarget = useCallback(() => {
    if (!step?.target) return null;
    const el = document.querySelector(`[data-tutorial="${step.target}"]`);
    return el as HTMLElement | null;
  }, [step?.target]);

  const updatePosition = useCallback(() => {
    const el = findTarget();
    if (!el) {
      setTargetRect(null);
      // Center tooltip in viewport when target doesn't exist
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tw = Math.min(340, vw - 40);
      const estH = tooltipRef.current?.offsetHeight || 280;
      setTooltipStyle({
        maxWidth: tw,
        width: tw,
        top: Math.max(20, (vh - estH) / 2),
        left: Math.max(20, (vw - tw) / 2),
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 8;
    setTargetRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate tooltip position — smart placement that NEVER covers the target
    const position = step?.position || 'bottom';
    const tooltipGap = 16;
    const vpMargin = 20;
    const tooltipEstHeight = tooltipRef.current?.offsetHeight || 280;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Dynamically shrink tooltip width on narrow viewports so it always fits
    const maxTooltipWidth = 340;
    const tooltipWidth = Math.min(maxTooltipWidth, vw - vpMargin * 2);

    let style: React.CSSProperties = { maxWidth: tooltipWidth, width: tooltipWidth };

    // Helper: clamp value within viewport (ensures tooltip never clips edges)
    const clampTop = (v: number) => Math.max(vpMargin, Math.min(v, vh - tooltipEstHeight - vpMargin));
    const clampLeft = (v: number) => Math.max(vpMargin, Math.min(v, vw - tooltipWidth - vpMargin));

    // Helper: check if tooltip rect would overlap target rect
    const overlaps = (tTop: number, tLeft: number) => {
      const tRight = tLeft + tooltipWidth;
      const tBottom = tTop + tooltipEstHeight;
      const rTop = rect.top - padding;
      const rLeft = rect.left - padding;
      const rRight = rect.right + padding;
      const rBottom = rect.bottom + padding;
      return !(tRight < rLeft || tLeft > rRight || tBottom < rTop || tTop > rBottom);
    };

    // Helper: find best horizontal position that avoids overlap and stays in viewport
    const bestHorizontal = (top: number, defaultLeft: number) => {
      const clamped = clampLeft(defaultLeft);
      if (!overlaps(top, clamped)) return clamped;

      // Try right-aligned to viewport (tooltip on the right side of screen)
      const rightAligned = clampLeft(vw - tooltipWidth - vpMargin);
      if (!overlaps(top, rightAligned)) return rightAligned;

      // Try left-aligned to viewport (tooltip on the left side of screen)
      if (!overlaps(top, vpMargin)) return vpMargin;

      // Try placing to the right of the target
      const rightOfTarget = clampLeft(rect.right + tooltipGap);
      if (!overlaps(top, rightOfTarget)) return rightOfTarget;

      // Try placing to the left of the target
      const leftOfTarget = clampLeft(rect.left - tooltipWidth - tooltipGap);
      if (!overlaps(top, leftOfTarget)) return leftOfTarget;

      // Last resort: center in viewport
      return clampLeft((vw - tooltipWidth) / 2);
    };

    switch (position) {
      case 'bottom': {
        const idealTop = rect.bottom + tooltipGap;
        const centeredLeft = rect.left + rect.width / 2 - tooltipWidth / 2;

        if (idealTop + tooltipEstHeight <= vh - vpMargin) {
          style.top = idealTop;
          style.left = bestHorizontal(idealTop, centeredLeft);
        } else if (rect.top - tooltipGap - tooltipEstHeight >= vpMargin) {
          // Flip to top
          const topPos = rect.top - tooltipGap - tooltipEstHeight;
          style.top = topPos;
          style.left = bestHorizontal(topPos, centeredLeft);
        } else {
          // No room above or below — place to the side
          style.top = clampTop(rect.top);
          const rightOfTarget = clampLeft(rect.right + tooltipGap);
          const leftOfTarget = clampLeft(rect.left - tooltipWidth - tooltipGap);
          style.left = (rect.right + tooltipGap + tooltipWidth <= vw - vpMargin) ? rightOfTarget : leftOfTarget;
        }
        break;
      }
      case 'top': {
        const idealTop = rect.top - tooltipGap - tooltipEstHeight;
        const centeredLeft = rect.left + rect.width / 2 - tooltipWidth / 2;

        if (idealTop >= vpMargin) {
          style.top = idealTop;
          style.left = bestHorizontal(idealTop, centeredLeft);
        } else if (rect.bottom + tooltipGap + tooltipEstHeight <= vh - vpMargin) {
          const belowPos = rect.bottom + tooltipGap;
          style.top = belowPos;
          style.left = bestHorizontal(belowPos, centeredLeft);
        } else {
          style.top = clampTop(rect.top);
          const rightOfTarget = clampLeft(rect.right + tooltipGap);
          const leftOfTarget = clampLeft(rect.left - tooltipWidth - tooltipGap);
          style.left = (rect.right + tooltipGap + tooltipWidth <= vw - vpMargin) ? rightOfTarget : leftOfTarget;
        }
        break;
      }
      case 'right': {
        const idealLeft = rect.right + tooltipGap;
        const vertCenter = clampTop(rect.top + rect.height / 2 - tooltipEstHeight / 2);

        if (idealLeft + tooltipWidth <= vw - vpMargin) {
          style.top = vertCenter;
          style.left = idealLeft;
        } else {
          // Flip to left, or if no room, place below
          const leftPos = rect.left - tooltipGap - tooltipWidth;
          if (leftPos >= vpMargin) {
            style.top = vertCenter;
            style.left = leftPos;
          } else {
            // No horizontal room — place below/above
            const belowTop = rect.bottom + tooltipGap;
            if (belowTop + tooltipEstHeight <= vh - vpMargin) {
              style.top = belowTop;
              style.left = bestHorizontal(belowTop, rect.left);
            } else {
              style.top = clampTop(rect.top - tooltipGap - tooltipEstHeight);
              style.left = bestHorizontal(style.top as number, rect.left);
            }
          }
        }
        break;
      }
      case 'left': {
        const idealLeft = rect.left - tooltipGap - tooltipWidth;
        const vertCenter = clampTop(rect.top + rect.height / 2 - tooltipEstHeight / 2);

        if (idealLeft >= vpMargin) {
          style.top = vertCenter;
          style.left = idealLeft;
        } else {
          // Flip to right, or if no room, place below
          const rightPos = rect.right + tooltipGap;
          if (rightPos + tooltipWidth <= vw - vpMargin) {
            style.top = vertCenter;
            style.left = rightPos;
          } else {
            // No horizontal room — place below/above
            const belowTop = rect.bottom + tooltipGap;
            if (belowTop + tooltipEstHeight <= vh - vpMargin) {
              style.top = belowTop;
              style.left = bestHorizontal(belowTop, rect.left);
            } else {
              style.top = clampTop(rect.top - tooltipGap - tooltipEstHeight);
              style.left = bestHorizontal(style.top as number, rect.left);
            }
          }
        }
        break;
      }
    }

    // Final safety clamp — guarantee tooltip is ALWAYS fully within viewport
    const finalLeft = Math.max(vpMargin, Math.min(style.left as number || vpMargin, vw - tooltipWidth - vpMargin));
    const finalTop = Math.max(vpMargin, Math.min(style.top as number || vpMargin, vh - tooltipEstHeight - vpMargin));
    style.left = finalLeft;
    style.top = finalTop;

    setTooltipStyle(style);
  }, [findTarget, step?.position]);

  // Execute step action (click tabs, expand filters, etc.) then scroll target into view
  useEffect(() => {
    if (!step?.target || !activeTutorialId) {
      setIsVisible(false);
      return;
    }

    let cancelled = false;

    const executeStep = async () => {
      // 1. Execute pre-action if defined (e.g., click a tab, expand a panel, dismiss a modal)
      if (step.action) {
        const { type, selector, delay = 400 } = step.action;
        if (type === 'click' && selector) {
          const actionEl = selector.startsWith('tutorial:')
            ? document.querySelector(`[data-tutorial="${selector.replace('tutorial:', '')}"]`)
            : document.querySelector(selector);
          if (actionEl instanceof HTMLElement) {
            // Dispatch pointer events first (needed for Radix UI DropdownMenu/Popover)
            actionEl.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, cancelable: true, isPrimary: true }));
            actionEl.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, cancelable: true, isPrimary: true }));
            actionEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, isPrimary: true }));
            actionEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, isPrimary: true }));
            actionEl.click();
            await new Promise(r => setTimeout(r, delay));
          }
        } else if (type === 'dismiss') {
          // Close any open modal/dialog by pressing Escape
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          await new Promise(r => setTimeout(r, delay));
        }
      }

      if (cancelled) return;

      // 2. Small delay to allow page render
      await new Promise(r => setTimeout(r, 200));
      if (cancelled) return;

      // 3. Find target and scroll into view
      const el = findTarget();
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(r => setTimeout(r, 300));
        if (cancelled) return;
        updatePosition();
        setIsVisible(true);
      } else {
        // Target not found — show tooltip centered
        setTargetRect(null);
        setIsVisible(true);
        updatePosition();
      }
    };

    executeStep();

    return () => { cancelled = true; };
  }, [step?.target, step?.action, activeTutorialId, activeStep, findTarget, updatePosition]);

  // Observe window resize & scroll — update position with rAF for smoothness
  useEffect(() => {
    if (!isVisible) return;
    let rafId: number | null = null;
    const handleUpdate = () => {
      if (rafId) return; // skip if already scheduled
      rafId = requestAnimationFrame(() => {
        updatePosition();
        rafId = null;
      });
    };
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isVisible, updatePosition]);

  // Prevent Radix Dialog from closing when clicking tutorial tooltip
  // Must be registered BEFORE Radix adds its own capture listener (i.e., before any modal opens)
  useEffect(() => {
    if (!activeTutorialId) return;

    const preventDialogDismiss = (e: Event) => {
      const target = e.target as Node;
      // If the click is inside the tutorial tooltip, stop Radix from seeing it as "outside" the dialog
      if (tooltipRef.current?.contains(target)) {
        e.stopImmediatePropagation();
      }
    };

    // Capture phase on document — fires before Radix's own capture listener
    document.addEventListener('pointerdown', preventDialogDismiss, { capture: true });
    return () => document.removeEventListener('pointerdown', preventDialogDismiss, { capture: true });
  }, [activeTutorialId]);

  // Cleanup resize observer
  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  if (!activeTutorialId || !tutorial || !step || !isVisible) return null;

  const handleNext = () => {
    if (isLastStep) {
      completeTutorial(tutorial.id);
    } else {
      nextStep();
    }
  };

  const overlay = (
    <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: 'auto' }}>
      {/* SVG overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tutorial-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tutorial-spotlight-mask)"
          style={{ pointerEvents: 'auto' }}
        />
      </svg>

      {/* Spotlight border ring */}
      {targetRect && (
        <div
          className="absolute rounded-xl border-2 border-white/30 pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={{ ...tooltipStyle, maxHeight: 'calc(100vh - 40px)', pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 'inherit' }}>
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-foreground">
                  <GraduationCap className="h-3.5 w-3.5 text-background" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {tutorial.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50">
                    Passo {activeStep + 1} de {totalSteps}
                  </p>
                </div>
              </div>
              <button
                onClick={skipTutorial}
                className="p-1 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground/50 hover:text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Progress bar */}
            <div className="mt-2.5 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-500 ease-out"
                style={{ width: `${((activeStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Content — scrollable when tooltip is too tall for viewport */}
          <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <h3 className="text-sm font-bold text-foreground font-display mb-2">
              {step.title}
            </h3>
            <div className="text-[12px] leading-[1.7] text-muted-foreground space-y-1.5">
              {renderDescription(step.description)}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/20 shrink-0">
            <button
              onClick={skipTutorial}
              className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Pular tutorial
            </button>
            <div className="flex items-center gap-2">
              {activeStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  className="h-7 px-2.5 text-[11px] rounded-lg border-border/60"
                >
                  <ChevronLeft className="h-3 w-3 mr-0.5" />
                  Anterior
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="h-7 px-3 text-[11px] font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90"
              >
                {isLastStep ? 'Concluir' : 'Próximo'}
                {!isLastStep && <ChevronRight className="h-3 w-3 ml-0.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
