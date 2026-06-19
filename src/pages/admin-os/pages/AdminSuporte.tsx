import { useState } from 'react';
import { LifeBuoy, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import TabSuporte from '../tabs/TabSuporte';
import TabKnowledgeBase from '../tabs/TabKnowledgeBase';

type Tab = 'solicitacoes' | 'base_conhecimento';

export default function AdminSuporte() {
  const [tab, setTab] = useState<Tab>('solicitacoes');

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {([
          { id: 'solicitacoes', label: 'Solicitações', icon: LifeBuoy },
          { id: 'base_conhecimento', label: 'Base de Conhecimento', icon: BookOpen },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold transition-all',
              tab === t.id
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {tab === 'solicitacoes' ? <TabSuporte /> : <TabKnowledgeBase />}
    </div>
  );
}
