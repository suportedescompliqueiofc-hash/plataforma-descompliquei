import { useState } from 'react';
import { useParams } from 'react-router-dom';
import AdminTrilha from './pages/AdminTrilha';
import AdminMateriaisComplementares from '@/components/admin/AdminMateriaisComplementares';
import { toast } from 'sonner';
import { BookOpen, FolderOpen } from 'lucide-react';

export default function AdminTrilhaWrapper() {
  const { moduleId, pillarId } = useParams<{ moduleId?: string; pillarId?: string }>();
  const isSubPage = !!moduleId || !!pillarId;

  const [activeTab, setActiveTab] = useState<'modulos' | 'materiais'>('modulos');

  return (
    <div className="flex flex-col gap-4">
      {/* Tab nav — esconde em sub-páginas (módulo / pilar) */}
      {!isSubPage && (
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('modulos')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'modulos'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Módulos
          </button>
          <button
            onClick={() => setActiveTab('materiais')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'materiais'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Materiais Complementares
          </button>
        </div>
      )}

      {(activeTab === 'modulos' || isSubPage) && <AdminTrilha />}

      {activeTab === 'materiais' && !isSubPage && (
        <AdminMateriaisComplementares toast={(opts: any) => opts.variant === 'destructive' ? toast.error(opts.description || opts.title) : toast.success(opts.description || opts.title)} />
      )}
    </div>
  );
}
