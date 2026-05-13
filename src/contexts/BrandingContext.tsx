import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useProfile } from '@/hooks/useProfile';

export interface OrgBranding {
  id: string;
  organization_id: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  color_primary: string;
  color_primary_dark: string;
  color_secondary: string;
  color_accent: string;
  color_sidebar_bg: string;
  color_background: string;
  color_foreground: string;
  brand_name: string | null;
  tagline: string | null;
  support_email: string | null;
  support_whatsapp: string | null;
}

const DEFAULT_BRANDING: Partial<OrgBranding> = {
  color_primary: '38 45% 55%',
  color_accent: '38 45% 94%',
  color_sidebar_bg: '220 10% 10%',
};

interface BrandingContextType {
  branding: OrgBranding | null;
  isLoading: boolean;
  refetch: () => void;
  updateBranding: (updates: Partial<OrgBranding>) => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

function applyBrandingToDOM(branding: Partial<OrgBranding> | null) {
  const root = document.documentElement;
  const b = { ...DEFAULT_BRANDING, ...(branding || {}) };

  root.style.setProperty('--primary', b.color_primary || '38 45% 55%');
  root.style.setProperty('--ring', b.color_primary || '38 45% 55%');
  root.style.setProperty('--sidebar-primary', b.color_primary || '38 45% 55%');
  root.style.setProperty('--sidebar-ring', b.color_primary || '38 45% 55%');
  root.style.setProperty('--accent', b.color_accent || '38 45% 94%');
  root.style.setProperty('--sidebar-background', b.color_sidebar_bg || '220 10% 10%');
  
  // Limpa possíveis resquícios no inline style para não quebrar o Dark Mode
  root.style.removeProperty('--background');
  root.style.removeProperty('--foreground');
  root.style.removeProperty('--secondary');

  document.title = branding?.brand_name || 'Descompliquei CRM';
 
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = branding?.favicon_url || branding?.logo_url || '/img/logo.jpeg';
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    if (!user || !profile?.organization_id) {
      applyBrandingToDOM(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('organization_branding')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (!error && data) {
        setBranding(data as OrgBranding);
        applyBrandingToDOM(data as OrgBranding);
      } else {
        applyBrandingToDOM(null);
      }
    } catch (e) {
      console.error('[BrandingContext] Erro ao carregar branding:', e);
      applyBrandingToDOM(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, profile?.organization_id]);

  const updateBranding = useCallback(async (updates: Partial<OrgBranding>) => {
    const orgId = branding?.organization_id || profile?.organization_id;
    console.log('[BrandingContext] Updating branding for orgId:', orgId);
    if (!orgId) {
      console.error('[BrandingContext] No orgId found to update branding');
      return;
    }

    const { data, error } = await supabase
      .from('organization_branding')
      .upsert(
        { ...updates, organization_id: orgId, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[BrandingContext] Supabase upsert error:', error);
      throw error;
    }

    if (data) {
      console.log('[BrandingContext] Branding updated successfully:', data);
      setBranding(data as OrgBranding);
      applyBrandingToDOM(data as OrgBranding);
    }
  }, [branding, profile]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return (
    <BrandingContext.Provider value={{ branding, isLoading, refetch: fetchBranding, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
