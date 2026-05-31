import { useState } from 'react';
import TabTrilhaModulos from '../../super-admin/tabs/TabTrilhaModulos';
import AdminMateriaisComplementares from '@/components/admin/AdminMateriaisComplementares';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, FolderOpen } from 'lucide-react';

type SubTab = 'modulos' | 'materiais';

export default function TabTrilha() {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>('modulos');

  return (
    <div className="text-white bg-[#0A0A0A] space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit border border-white/10">
        <button
          onClick={() => setSubTab('modulos')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            subTab === 'modulos'
              ? 'bg-white text-[#0A0A0A] shadow-sm'
              : 'text-white/50 hover:text-white'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Módulos
        </button>
        <button
          onClick={() => setSubTab('materiais')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            subTab === 'materiais'
              ? 'bg-white text-[#0A0A0A] shadow-sm'
              : 'text-white/50 hover:text-white'
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Materiais Complementares
        </button>
      </div>

      {subTab === 'modulos' && <TabTrilhaModulos toast={toast} />}
      {subTab === 'materiais' && <AdminMateriaisComplementares toast={toast} />}
    </div>
  );
}
