import { cn } from '@/lib/utils';

interface PageHeroProps {
  /** Ícone Lucide exibido no pill translúcido. */
  icon: React.ElementType;
  /** Título principal (linha 1). Pode ser string ou ReactNode. */
  title: React.ReactNode;
  /** Segunda linha do título, renderizada em branco/50 (ex: "Comercial"). */
  titleAccent?: string;
  /** Subtítulo descritivo abaixo do título. */
  subtitle?: string;
  /** Slot opcional à direita (stats, botões de ação). Estilizar com tons white/translúcido. */
  right?: React.ReactNode;
  /** Valor do atributo data-tutorial no container do hero. */
  dataTutorial?: string;
  className?: string;
}

/**
 * Hero padrão da plataforma — fundo escuro quente com glow laranja.
 * Fonte única de verdade do cabeçalho premium. Mexeu aqui, muda em toda a plataforma.
 * Botões no slot `right` devem usar tons translúcidos brancos p/ contrastar com o fundo escuro.
 */
export function PageHero({
  icon: Icon,
  title,
  titleAccent,
  subtitle,
  right,
  dataTutorial,
  className,
}: PageHeroProps) {
  return (
    <div
      data-tutorial={dataTutorial}
      className={cn(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0e06] via-[#1f1208] to-[#1a0e06] px-8 py-10 sm:px-12 sm:py-12',
        className,
      )}
    >
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Accent glows */}
      <div
        className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full opacity-55 blur-[100px]"
        style={{ background: 'radial-gradient(circle, #ea580c, transparent 65%)' }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-35 blur-[80px]"
        style={{ background: 'radial-gradient(circle, #d97706, transparent 65%)' }}
      />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08]">
              <Icon className="h-5 w-5 text-white/80" />
            </div>
            <div className="h-px flex-1 max-w-[100px] bg-gradient-to-r from-white/20 to-transparent" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display leading-[1.15]">
              {title}
              {titleAccent && (
                <>
                  <br />
                  <span className="text-white/50">{titleAccent}</span>
                </>
              )}
            </h1>
            {subtitle && (
              <p className="text-[13px] text-white/40 mt-2 max-w-md leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}
