import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const MENSAGENS: Record<string, string> = {
  'acesso-nao-encontrado': 'Acesso não encontrado. Entre em contato com a equipe da Descompliquei.',
  'bloqueado': 'Seu acesso foi suspenso. Entre em contato com o suporte.',
  'expirado': 'Seu período de acesso expirou. Entre em contato para renovar.',
  'link-expirado': 'O link de acesso expirou. Solicite um novo link à equipe da Descompliquei ou entre com e-mail e senha.',
  'acesso-negado': 'O link de acesso é inválido ou já foi utilizado. Entre com e-mail e senha.',
  'link-invalido': 'O link de acesso não é válido. Solicite um novo link ou entre com e-mail e senha.',
};

export default function PlataformaLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const [searchParams] = useSearchParams();

  const msgKey = searchParams.get('msg') ?? '';
  const errorMsg = MENSAGENS[msgKey] ?? null;

  useEffect(() => {
    if (user && !msgKey) {
      window.location.href = '/';
    }
  }, [user, msgKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        const msg = error.message?.includes('fetch')
          ? 'Servidor indisponível. Tente novamente em alguns segundos.'
          : (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid_credentials'))
            ? 'E-mail ou senha incorretos.'
            : error.message || 'E-mail ou senha incorretos.';
        toast.error(msg, { closeButton: true });
      } else {
        window.location.href = '/';
      }
    } catch {
      toast.error('Não foi possível conectar ao servidor. Verifique sua conexão.', { closeButton: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FAFAF8]">
      {/* ═══ LEFT PANEL — Brand showcase ═══ */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden" style={{ background: '#0A0A0A' }}>
        {/* Ambient glow */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-[0.07]" style={{ background: '#E85D24' }} />
        <div className="absolute bottom-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full blur-[100px] opacity-[0.04]" style={{ background: '#E85D24' }} />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full blur-[80px] opacity-[0.03]" style={{ background: '#ffffff' }} />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12">
          {/* Top — Logo mark */}
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(232,93,36,0.12)', border: '1px solid rgba(232,93,36,0.2)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#E85D24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="#E85D24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
                  <path d="M2 12L12 17L22 12" stroke="#E85D24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75"/>
                </svg>
              </div>
              <span className="text-[13px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Descompliquei
              </span>
            </div>
          </div>

          {/* Center — Hero text */}
          <div className="max-w-lg">
            <div className="mb-6">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.25em] mb-4"
                style={{ color: '#E85D24' }}
              >
                Growth Labs
              </p>
              <h1
                className="text-[42px] font-extrabold leading-[1.1] tracking-tight font-display"
                style={{ color: 'rgba(255,255,255,0.95)' }}
              >
                Escale seus
                <br />
                resultados com
                <br />
                <span style={{ color: '#E85D24' }}>inteligência.</span>
              </h1>
            </div>

          </div>

          {/* Bottom — Footer */}
          <div className="flex items-center justify-between">
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
              &copy; {new Date().getFullYear()} Descompliquei Growth Labs
            </p>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: i === 0 ? '#E85D24' : 'rgba(255,255,255,0.1)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL — Login form ═══ */}
      <div className="w-full lg:w-[48%] flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(232,93,36,0.1)', border: '1px solid rgba(232,93,36,0.15)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#E85D24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="#E85D24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
                <path d="M2 12L12 17L22 12" stroke="#E85D24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75"/>
              </svg>
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground">Descompliquei</span>
              <span className="text-[11px] font-bold ml-1" style={{ color: '#E85D24' }}>Growth Labs</span>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">
              Bem-vindo de volta
            </p>
            <h2 className="text-[28px] font-extrabold tracking-tight text-foreground font-display leading-tight">
              Acesse sua conta
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1.5">
              Digite suas credenciais para continuar
            </p>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive font-medium">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@empresa.com"
                className="h-11 text-sm rounded-xl border-border/60 bg-background transition-all duration-200 focus:ring-2 focus:ring-[#E85D24]/10 focus:border-[#E85D24]/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  className="h-11 text-sm rounded-xl border-border/60 bg-background pr-10 transition-all duration-200 focus:ring-2 focus:ring-[#E85D24]/10 focus:border-[#E85D24]/40"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              className="w-full h-11 text-sm font-bold rounded-xl gap-2 transition-all duration-200 hover:translate-y-[-1px] hover:shadow-lg"
              style={{
                background: '#E85D24',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(232,93,36,0.25)',
              }}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</>
              ) : (
                <>Entrar <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid hsl(var(--border) / 0.4)' }}>
            <p className="text-center text-[11px] text-muted-foreground/40">
              Para solicitar acesso, entre em contato com a equipe da Descompliquei.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
