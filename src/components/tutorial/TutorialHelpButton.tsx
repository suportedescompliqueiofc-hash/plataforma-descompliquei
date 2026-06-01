import { GraduationCap } from 'lucide-react';
import { useTutorialContext } from './TutorialProvider';
import { tutorials } from './tutorialData';
import { cn } from '@/lib/utils';

export function TutorialHelpButton({ collapsed }: { collapsed?: boolean }) {
  const { setHelpCenterOpen, isTutorialCompleted } = useTutorialContext();

  const completedCount = tutorials.filter(t => isTutorialCompleted(t.id)).length;
  const totalCount = tutorials.length;
  const allDone = completedCount === totalCount;
  const hasPending = completedCount < totalCount && completedCount > 0;

  return (
    <button
      onClick={() => setHelpCenterOpen(true)}
      className={cn(
        "flex items-center gap-2.5 w-full rounded-lg px-3 py-2 transition-all duration-200",
        "bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.14]",
        "group",
        collapsed && "justify-center px-2"
      )}
    >
      <div className={cn(
        "p-1.5 rounded-md transition-colors relative flex-shrink-0",
        allDone ? "bg-emerald-500/20" : "bg-white/[0.10]"
      )}>
        <GraduationCap className={cn(
          "h-3.5 w-3.5",
          allDone ? "text-emerald-400" : "text-white/70"
        )} />
        {hasPending && (
          <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 border border-sidebar" />
        )}
        {!allDone && completedCount === 0 && (
          <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500 border border-sidebar animate-pulse" />
        )}
      </div>

      {!collapsed && (
        <div className="flex-1 text-left min-w-0">
          <p className="text-[11px] font-medium text-white/70 group-hover:text-white/90 transition-colors leading-tight">
            Tutoriais
          </p>
          <p className="text-[9px] text-white/35 leading-tight mt-0.5">
            {allDone ? 'Todos completos' : `${completedCount}/${totalCount} concluídos`}
          </p>
        </div>
      )}

      {!collapsed && !allDone && (
        <div className="w-8 h-1 rounded-full bg-white/[0.08] overflow-hidden flex-shrink-0">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              allDone ? "bg-emerald-400" : "bg-white/40"
            )}
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      )}
    </button>
  );
}
