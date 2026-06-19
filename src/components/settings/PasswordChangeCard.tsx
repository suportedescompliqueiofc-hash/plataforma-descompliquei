import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyRound, Eye, EyeOff, Loader2, Save, ShieldCheck, Sparkles } from 'lucide-react';

function PasswordInput({
  id, label, value, onChange, show, onToggle, placeholder, autoComplete,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder: string; autoComplete: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-10 text-sm rounded-lg border-border/60 pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export default function PasswordChangeCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFirstAccess, setIsFirstAccess] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsFirstAccess(!user?.user_metadata?.password_set);
    });
  }, []);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const passwordStrength = (pw: string) => {
    if (!pw) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 2) return { level: score, label: 'Fraca', color: 'bg-red-400' };
    if (score <= 3) return { level: score, label: 'Razoável', color: 'bg-amber-400' };
    if (score <= 4) return { level: score, label: 'Boa', color: 'bg-blue-400' };
    return { level: score, label: 'Forte', color: 'bg-emerald-500' };
  };

  const strength = passwordStrength(newPassword);

  const handleChangePassword = async () => {
    if (isFirstAccess) {
      if (!newPassword || !confirmPassword) {
        toast.error('Preencha todos os campos.');
        return;
      }
      if (newPassword.length < 8) {
        toast.error('A senha precisa ter no mínimo 8 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('A confirmação da senha não confere.');
        return;
      }

      setIsSaving(true);
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
          data: { password_set: true },
        });
        if (error) throw error;
        setIsFirstAccess(false);
        toast.success('Senha definida com sucesso!');
        reset();
      } catch (err: any) {
        toast.error(err.message || 'Erro ao definir senha.');
      } finally {
        setIsSaving(false);
      }
    } else {
      if (!currentPassword || !newPassword || !confirmPassword) {
        toast.error('Preencha todos os campos.');
        return;
      }
      if (newPassword.length < 8) {
        toast.error('A nova senha precisa ter no mínimo 8 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('A confirmação da nova senha não confere.');
        return;
      }
      if (newPassword === currentPassword) {
        toast.error('A nova senha deve ser diferente da atual.');
        return;
      }

      setIsSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) throw new Error('Sessão inválida. Faça login novamente.');

        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (signInErr) throw new Error('Senha atual incorreta.');

        const { error: updateErr } = await supabase.auth.updateUser({
          password: newPassword,
          data: { password_set: true },
        });
        if (updateErr) throw updateErr;

        toast.success('Senha alterada com sucesso!');
        reset();
      } catch (err: any) {
        toast.error(err.message || 'Erro ao alterar senha.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {isFirstAccess ? 'Definir Senha' : 'Alterar Senha'}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Proteja sua conta com uma senha forte</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {isFirstAccess ? (
          /* Banner primeiro acesso */
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50/60 border border-blue-200/50">
            <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Este é seu primeiro acesso. Crie uma senha para entrar sem precisar de link por e-mail.
            </p>
          </div>
        ) : (
          /* Dica de segurança */
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/30">
            <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Use ao menos 8 caracteres, combinando letras maiúsculas, minúsculas, números e símbolos para maior segurança.
            </p>
          </div>
        )}

        {/* Campo senha atual — só aparece quando não é primeiro acesso */}
        {!isFirstAccess && (
          <PasswordInput
            id="current-password"
            label="Senha Atual"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent(v => !v)}
            placeholder="Digite sua senha atual"
            autoComplete="current-password"
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <PasswordInput
              id="new-password"
              label={isFirstAccess ? 'Nova Senha' : 'Nova Senha'}
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew(v => !v)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
            {/* Strength bar */}
            {newPassword && (
              <div className="space-y-1 pt-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= strength.level ? strength.color : 'bg-border/60'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">{strength.label}</p>
              </div>
            )}
          </div>

          <PasswordInput
            id="confirm-password"
            label="Confirmar Nova Senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm(v => !v)}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/40 bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={isSaving}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Limpar campos
        </Button>
        <Button
          onClick={handleChangePassword}
          disabled={isSaving || isFirstAccess === null}
          className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
        >
          {isSaving ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
          ) : isFirstAccess ? (
            <><Save className="h-3.5 w-3.5" /> Definir Senha</>
          ) : (
            <><Save className="h-3.5 w-3.5" /> Alterar Senha</>
          )}
        </Button>
      </div>
    </div>
  );
}
