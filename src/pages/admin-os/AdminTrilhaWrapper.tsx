import AdminMateriaisComplementares from '@/components/admin/AdminMateriaisComplementares';
import { toast } from 'sonner';

export default function AdminTrilhaWrapper() {
  return (
    <AdminMateriaisComplementares
      toast={(opts: any) =>
        opts.variant === 'destructive'
          ? toast.error(opts.description || opts.title)
          : toast.success(opts.description || opts.title)
      }
    />
  );
}
