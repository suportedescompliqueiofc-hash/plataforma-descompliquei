import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const MENSAGENS: Record<string, string> = {
  'acesso-nao-encontrado': 'Acesso não encontrado. Entre em contato com o administrador.',
  'bloqueado': 'Seu acesso foi suspenso. Entre em contato com o suporte.',
  'expirado': 'Seu período de acesso expirou. Entre em contato para renovar.',
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

  // Se já está logado (sessão restaurada) e sem msg de erro, redireciona
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
          : error.message || 'Email ou senha incorretos';
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
    <div className="min-h-screen flex bg-background">
      {/* Left side */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden" style={{ background: '#0f0f0f' }}>
        <div className="absolute top-0 right-0 w-96 h-96 opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" style={{ background: '#E85D24' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 opacity-5 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" style={{ background: '#E85D24' }} />
        <div className="max-w-md text-center relative z-10 text-white">
          <div className="mb-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(232,93,36,0.15)', border: '1px solid rgba(232,93,36,0.3)' }}>
              <ShieldAlert className="h-10 w-10" style={{ color: '#E85D24' }} />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Descompliquei</div>
            <div className="text-2xl font-bold uppercase tracking-[0.2em]" style={{ color: '#E85D24' }}>MARKETING</div>
          </div>
          <p className="text-xl font-semibold leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Acesse sua área de<br />
            <span style={{ color: '#E85D24' }}>treinamento e estratégia</span>
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight">Acesse sua conta</h2>
            <p className="text-muted-foreground mt-2">Acesse com seu email e senha</p>
          </div>

          {errorMsg && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@empresa.com"
                className="h-12"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-bold text-white"
              style={{ background: '#E85D24' }}
              size="lg"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Para solicitar acesso, entre em contato com o administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
