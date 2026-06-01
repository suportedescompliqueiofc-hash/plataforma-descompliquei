import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Upload, Palette, Loader2, Brush, Image } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const COLOR_FIELDS = [
  { key: 'color_primary', label: 'Cor Primária', hint: 'Botões, links e destaques principais' },
  { key: 'color_accent', label: 'Cor Accent', hint: 'Fundos suaves e destaques leves' },
  { key: 'color_sidebar_bg', label: 'Fundo do Menu', hint: 'Background da sidebar lateral' },
] as const;

function hslStringToHex(hsl: string): string {
  try {
    const parts = hsl.trim().split(/\s+/);
    if (parts.length !== 3) return '#6b7280';
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch {
    return '#6b7280';
  }
}

function hexToHsl(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch {
    return '220 10% 50%';
  }
}

export function BrandingSettings() {
  const { branding, updateBranding, refetch } = useBranding();
  const { profile } = useProfile();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [form, setForm] = useState({
    brand_name: '',
    tagline: '',
    color_primary: '38 45% 55%',
    color_accent: '38 45% 94%',
    color_sidebar_bg: '220 10% 10%',
  });

  useEffect(() => {
    if (branding) {
      setForm({
        brand_name: branding.brand_name || '',
        tagline: branding.tagline || '',
        color_primary: branding.color_primary || '38 45% 55%',
        color_accent: branding.color_accent || '38 45% 94%',
        color_sidebar_bg: branding.color_sidebar_bg || '220 10% 10%',
      });
    }
  }, [branding]);

  const extractColorsFromImage = (imageUrl: string): Promise<{ primary: string, accent: string, sidebar: string }> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve({ primary: '220 15% 20%', accent: '220 10% 97%', sidebar: '220 15% 8%' });
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        try {
          const imageData = ctx.getImageData(0, 0, 50, 50).data;
          let colors: { h: number, s: number, l: number, weight: number }[] = [];
          let grayscaleColors: { h: number, s: number, l: number, weight: number }[] = [];
          for (let i = 0; i < imageData.length; i += 4) {
            const r = imageData[i], g = imageData[i+1], b = imageData[i+2], a = imageData[i+3];
            if (a < 128) continue;
            const r_norm = r / 255, g_norm = g / 255, b_norm = b / 255;
            const max = Math.max(r_norm, g_norm, b_norm), min = Math.min(r_norm, g_norm, b_norm);
            let h = 0, s = 0, l = (max + min) / 2;
            if (max !== min) {
              const d = max - min;
              s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
              if (max === r_norm) h = (g_norm - b_norm) / d + (g_norm < b_norm ? 6 : 0);
              else if (max === g_norm) h = (b_norm - r_norm) / d + 2;
              else h = (r_norm - g_norm) / d + 4;
              h *= 60;
            }
            const sat = s * 100;
            const lum = l * 100;
            if (sat > 12 && lum > 15 && lum < 85) {
              colors.push({ h, s: sat, l: lum, weight: sat * (1 - Math.abs(2 * l - 1)) });
            } else if (lum > 5 && lum < 95) {
              grayscaleColors.push({ h, s: sat, l: lum, weight: 1 - Math.abs(2 * l - 1) });
            }
          }
          const candidatePool = colors.length > 0 ? colors : grayscaleColors;
          if (candidatePool.length === 0) return resolve({ primary: '220 15% 20%', accent: '220 10% 97%', sidebar: '220 15% 8%' });
          candidatePool.sort((a, b) => b.weight - a.weight);
          const top = candidatePool[0];
          const isGrayscale = colors.length === 0;
          const primaryH = Math.round(top.h);
          const primaryS = isGrayscale ? 15 : Math.min(Math.max(top.s, 40), 90);
          const primaryL = isGrayscale ? 20 : Math.min(Math.max(top.l, 40), 55);
          const accentS = isGrayscale ? 5 : Math.min(top.s, 20);
          const sidebarS = isGrayscale ? 10 : Math.min(top.s, 15);
          resolve({
            primary: `${primaryH} ${primaryS}% ${primaryL}%`,
            accent: `${primaryH} ${accentS}% 97%`,
            sidebar: `${primaryH} ${sidebarS}% 8%`
          });
        } catch (e) {
          resolve({ primary: '220 15% 20%', accent: '220 10% 97%', sidebar: '220 15% 8%' });
        }
      };
      img.src = imageUrl;
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const orgId = branding?.organization_id || profile?.organization_id;
    if (!file || !orgId) return;
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${orgId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from('organization-logos').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('organization-logos').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      const colors = await extractColorsFromImage(publicUrl);
      const newBranding = { logo_url: publicUrl, color_primary: colors.primary, color_accent: colors.accent, color_sidebar_bg: colors.sidebar };
      await updateBranding(newBranding);
      setForm(prev => ({ ...prev, color_primary: colors.primary, color_accent: colors.accent, color_sidebar_bg: colors.sidebar }));
      toast({ title: 'Identidade visual extraída!', description: 'As cores foram ajustadas com base na sua logo.' });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateBranding(form);
      toast({ title: 'Marca salva!', description: 'As cores e identidade foram aplicadas.' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Logo Upload */}
      <div data-tutorial="branding-logo" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Image className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Logo da Marca</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">O sistema extrai as cores automaticamente</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4">
            {branding?.logo_url ? (
              <div className="h-20 w-20 rounded-xl border-2 border-border/40 overflow-hidden bg-muted/30 flex items-center justify-center">
                <img src={branding.logo_url} alt="Logo" className="h-full w-full object-contain p-2" />
              </div>
            ) : (
              <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border/40 flex items-center justify-center bg-muted/20">
                <Palette className="h-8 w-8 text-muted-foreground/30" />
              </div>
            )}
            <div className="space-y-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
              >
                {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {isUploading ? 'Enviando...' : 'Escolher Logo'}
              </Button>
              <p className="text-[10px] text-muted-foreground/50">PNG, JPG, SVG</p>
            </div>
          </div>
        </div>
      </div>

      {/* Identidade */}
      <div data-tutorial="branding-identity" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Brush className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Identidade da Marca</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Nome e tagline exibidos no sistema</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome do Sistema</Label>
              <Input
                value={form.brand_name}
                onChange={e => setForm({ ...form, brand_name: e.target.value })}
                placeholder="Ex: CRM Odontonova"
                className="h-10 text-sm rounded-lg border-border/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tagline (opcional)</Label>
              <Input
                value={form.tagline}
                onChange={e => setForm({ ...form, tagline: e.target.value })}
                placeholder="Ex: Gestão inteligente"
                className="h-10 text-sm rounded-lg border-border/60"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Paleta de Cores */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Paleta de Cores</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Formato HSL: H S% L% (ex: 220 80% 50%)</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {COLOR_FIELDS.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{field.label}</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={hslStringToHex(form[field.key as keyof typeof form])}
                    onChange={e => setForm({ ...form, [field.key]: hexToHsl(e.target.value) })}
                    className="h-10 w-11 rounded-lg border border-border/60 cursor-pointer bg-transparent p-0.5"
                  />
                  <Input
                    value={form[field.key as keyof typeof form]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    className="h-10 text-xs rounded-lg border-border/60 font-mono"
                    placeholder="H S% L%"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/50">{field.hint}</p>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Preview</p>
            <div className="flex gap-2 flex-wrap">
              <div className="px-4 py-2 rounded-lg text-white text-xs font-semibold" style={{ backgroundColor: `hsl(${form.color_primary})` }}>
                Botão Primário
              </div>
              <div className="px-4 py-2 rounded-lg text-xs font-medium border border-border/30" style={{ backgroundColor: `hsl(${form.color_accent})` }}>
                Accent
              </div>
            </div>
            <div className="h-10 rounded-lg flex items-center px-4" style={{ backgroundColor: `hsl(${form.color_sidebar_bg})` }}>
              <span className="text-xs font-medium" style={{ color: `hsl(${form.color_primary})` }}>Sidebar</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-border/40 bg-muted/20">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
          >
            {isSaving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="h-3.5 w-3.5" /> Salvar Marca</>
            )}
          </Button>
          <span data-tutorial="branding-save" />
        </div>
      </div>
    </div>
  );
}
