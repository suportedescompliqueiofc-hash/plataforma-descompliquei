import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FolderOpen, FileText, Search, Layout, MessageSquare, PlusCircle, PenTool, Copy, Check, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatMaterialContent, getMaterialPreviewText } from "@/utils/materialFormatting";
import { FormattedText } from "@/components/FormattedText";

interface Material {
  id: string;
  created_at: string;
  title: string;
  category: string;
  type: string;
  module_id: string | null;
  content: string;
}

export default function Materiais() {
  const { user } = useAuth();
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");

  // Modal
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const selectedMaterialContent = selectedMaterial ? formatMaterialContent(selectedMaterial.content) : "";

  useEffect(() => {
    async function fetchMateriais() {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('platform_materiais')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Erro ao puxar materiais:", error);
      } else {
        setMateriais(data || []);
      }
      setLoading(false);
    }
    fetchMateriais();
  }, [user]);

  const handleDelete = async (e: any, id: string) => {
     e.stopPropagation();
     if (!confirm("Tem certeza que deseja excluir este material?")) return;
     
     const { error } = await supabase.from('platform_materiais').delete().eq('id', id);
     if (error) {
       toast.error("Erro ao excluir.");
     } else {
       toast.success("Material excluído.");
       setMateriais(prev => prev.filter(m => m.id !== id));
       if (selectedMaterial?.id === id) setSelectedMaterial(null);
     }
  };

  const currentModules = Array.from(new Set(materiais.filter(m => m.module_id).map(m => m.module_id)));

  // Filter Logic
  const filteredMateriais = materiais.filter(m => {
     const matchSearch = String(m.title).toLowerCase().includes(searchTerm.toLowerCase());
     const matchCat = categoryFilter === 'all' || m.category === categoryFilter;
     const matchType = typeFilter === 'all' || m.type === typeFilter;
     const matchMod = moduleFilter === 'all' || m.module_id === moduleFilter;
     return matchSearch && matchCat && matchType && matchMod;
  });

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'document': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'script': return <MessageSquare className="w-5 h-5 text-green-500" />;
      case 'template': return <Layout className="w-5 h-5 text-orange-500" />;
      case 'analysis': return <Search className="w-5 h-5 text-purple-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCategoryColor = (cat: string) => {
     switch (cat?.toLowerCase()) {
       case 'icp': return 'bg-blue-100 text-blue-700 border-blue-200';
       case 'oferta': return 'bg-amber-100 text-amber-700 border-amber-200';
       case 'script': return 'bg-green-100 text-green-700 border-green-200';
       case 'campanha': return 'bg-purple-100 text-purple-700 border-purple-200';
       case 'criativo': return 'bg-pink-100 text-pink-700 border-pink-200';
       default: return 'bg-gray-100 text-gray-700 border-gray-200';
     }
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
      
      {/* HEADER */}
      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight font-display">
          Meus Materiais
        </h1>
        <p className="text-muted-foreground text-[15px]">
          {materiais.length} {materiais.length === 1 ? 'material salvo' : 'materiais salvos'} da Trilha de Aprendizado
        </p>
      </div>

      {/* FILTROS */}
      {materiais.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-card rounded-xl border border-border shadow-card">
          <Input 
            placeholder="Buscar por título..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full bg-background border-border"
          />
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
             <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Categoria" /></SelectTrigger>
             <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                <SelectItem value="icp">ICP</SelectItem>
                <SelectItem value="oferta">Oferta</SelectItem>
                <SelectItem value="script">Script</SelectItem>
                <SelectItem value="campanha">Campanha</SelectItem>
                <SelectItem value="criativo">Criativo</SelectItem>
                <SelectItem value="analise">Análise</SelectItem>
                <SelectItem value="posicionamento">Posicionamento</SelectItem>
                <SelectItem value="outro">Outros</SelectItem>
             </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
             <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Tipo" /></SelectTrigger>
             <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
                <SelectItem value="script">Script (Texto)</SelectItem>
                <SelectItem value="template">Template</SelectItem>
                <SelectItem value="analysis">Análise IA</SelectItem>
             </SelectContent>
          </Select>

          <Select value={moduleFilter} onValueChange={setModuleFilter}>
             <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Módulo Original" /></SelectTrigger>
             <SelectContent>
                <SelectItem value="all">Qualquer Módulo</SelectItem>
                {currentModules.map(mod => (
                  <SelectItem key={String(mod)} value={String(mod)}>Módulo {mod}</SelectItem>
                ))}
             </SelectContent>
          </Select>
        </div>
      )}

      {/* RENDER GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {[1,2,3,4].map(k => <Skeleton key={k} className="h-[200px] w-full rounded-xl" />)}
        </div>
      ) : materiais.length === 0 ? (
         <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border border-dashed border-border text-center space-y-5">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="max-w-md space-y-1.5">
               <h3 className="text-base font-semibold text-foreground font-display">Nenhum material salvo</h3>
               <p className="text-sm text-muted-foreground">
                 Complete os módulos da Trilha para construir sua biblioteca clínica.
               </p>
            </div>
            <Link to="/plataforma/trilha">
               <Button className="bg-[#E85D24] hover:bg-[#D04E1A] text-white font-medium h-10 px-6 text-sm">
                 Ir para a Trilha <ArrowRight className="w-4 h-4 ml-1.5" />
               </Button>
            </Link>
         </div>
      ) : filteredMateriais.length === 0 ? (
         <div className="text-center p-12 text-muted-foreground font-medium bg-card/50 rounded-xl border border-border">
           Nenhum material encontrou os filtros selecionados.
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
           {filteredMateriais.map(m => (
             <Card key={m.id} className="group cursor-pointer hover:shadow-md transition-all bg-card shadow-card border-border overflow-hidden" onClick={() => setSelectedMaterial(m)}>
               <CardContent className="p-5 flex flex-col h-full">
                 <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-muted rounded-lg">
                          {getTypeIcon(m.type)}
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            {m.created_at ? format(new Date(m.created_at), 'dd MMM yyyy', {locale: ptBR}) : ''}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                             <Badge variant="outline" className={`text-[10px] py-0 border ${getCategoryColor(m.category)}`}>
                               {m.category || 'Módulo'}
                             </Badge>
                             {m.module_id && (
                                <Badge variant="outline" className="text-[10px] py-0 bg-muted text-muted-foreground border-transparent">Módulo {m.module_id}</Badge>
                             )}
                          </div>
                       </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDelete(e, m.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                 </div>

                 <h3 className="text-foreground font-semibold line-clamp-1 mb-1.5 text-sm">{m.title}</h3>

                 <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-5 flex-1">
                   {getMaterialPreviewText(m.content) || 'Sem conteúdo visualizável...'}
                 </p>

                 <div className="flex items-center text-xs font-medium text-[#E85D24] group-hover:translate-x-0.5 transition-transform mt-auto">
                    Ver Documento <ArrowRight className="h-3.5 w-3.5 ml-1" />
                 </div>
               </CardContent>
             </Card>
           ))}
        </div>
      )}

      {/* MODAL VIEW */}
      <Dialog open={!!selectedMaterial} onOpenChange={() => setSelectedMaterial(null)}>
        <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col p-0 border-border overflow-hidden gap-0 bg-card">
          {selectedMaterial && (
            <>
              <DialogHeader className="p-6 border-b border-border bg-muted/30 shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  {getTypeIcon(selectedMaterial.type)}
                  <DialogTitle className="text-xl text-foreground font-bold">{selectedMaterial.title}</DialogTitle>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                   <Badge variant="outline" className={getCategoryColor(selectedMaterial.category)}>{selectedMaterial.category || 'Geral'}</Badge>
                   {selectedMaterial.module_id && <Badge variant="outline">Originado do Módulo {selectedMaterial.module_id}</Badge>}
                   <span>• {format(new Date(selectedMaterial.created_at), "dd 'de' MMM, yyyy", {locale: ptBR})}</span>
                </div>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border bg-background">
                <FormattedText
                  content={selectedMaterialContent}
                  className="text-sm md:text-[14px]"
                />
              </div>

              <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3 shrink-0">
                 <Button variant="outline" className="font-bold border-border" onClick={() => setSelectedMaterial(null)}>
                   Fechar
                 </Button>
                 <Button 
                   onClick={() => {
                     navigator.clipboard.writeText(selectedMaterialContent);
                     toast.success("Documento copiado!");
                   }}
                   className="bg-[#E85D24] text-white hover:bg-[#E85D24]/90 font-bold"
                 >
                   <Copy className="w-4 h-4 mr-2" /> Copiar Conteúdo
                 </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
