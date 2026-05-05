import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ScoreOutput } from "@/hooks/useMarketingScore";

export interface CriativoScoreProps {
  scoreOutput: ScoreOutput;
  ctr: number;
  cpl: number;
  leads: number;
  diasAtivos: number;
}

const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CriativoScoreCard({ scoreOutput, ctr, cpl, leads, diasAtivos }: CriativoScoreProps) {
  const { score, tag, cor, breakdown } = scoreOutput;
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-1 cursor-default">
            <svg width="68" height="68" viewBox="0 0 68 68">
              <circle
                cx="34"
                cy="34"
                r={RADIUS}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="5"
              />
              <circle
                cx="34"
                cy="34"
                r={RADIUS}
                fill="none"
                stroke={cor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
                transform="rotate(-90 34 34)"
                className="transition-all duration-500"
              />
              <text
                x="34"
                y="34"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground"
                fontSize="16"
                fontWeight="700"
              >
                {score}
              </text>
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: cor }}>
              {tag}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[220px] text-xs space-y-1 p-3">
          <p className="font-semibold mb-1.5">Score de Performance: {score}/100</p>
          <div className="space-y-0.5">
            <p>CTR ({ctr.toFixed(2)}%): <strong>{breakdown.ctr_pts} pts</strong></p>
            <p>CPL (R${cpl.toFixed(2)}): <strong>{breakdown.cpl_pts} pts</strong></p>
            <p>Volume ({leads} leads): <strong>{breakdown.leads_pts} pts</strong></p>
            <p>Consistência ({diasAtivos}d): <strong>{breakdown.consistencia_pts} pts</strong></p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CriativoScoreBadge({ scoreOutput }: { scoreOutput: ScoreOutput }) {
  const { score, tag, cor } = scoreOutput;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-default"
      style={{ backgroundColor: `${cor}15`, color: cor }}
    >
      {score}
      <span className="text-[10px] font-medium opacity-80">{tag}</span>
    </span>
  );
}
