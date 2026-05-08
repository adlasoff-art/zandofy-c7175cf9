import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isRecoveringPassword, clearRecoveryFlag, session, loading: authLoading } = useAuth();

  useEffect(() => {
    // Accept the page if:
    //  - URL hash contains type=recovery (fresh click from email), OR
    //  - AuthContext flagged a PASSWORD_RECOVERY event, OR
    //  - URL contains a recovery code (?code=...) from PKCE flow.
    const hash = window.location.hash;
    const search = window.location.search;
    const hasRecoveryHint =
      hash.includes("type=recovery") ||
      search.includes("code=") ||
      isRecoveringPassword;
    if (authLoading) return;
    if (!hasRecoveryHint && !session) {
      navigate("/auth", { replace: true });
    }
  }, [navigate, isRecoveringPassword, session, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Mot de passe trop court", description: "8 caractères minimum.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    clearRecoveryFlag();
    // Sign out the temporary recovery session so the user logs in fresh with the new password.
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    toast({ title: "Mot de passe mis à jour !", description: "Connectez-vous avec votre nouveau mot de passe." });
    navigate("/auth", { replace: true });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <a href="/" className="text-2xl font-bold tracking-[0.18em] uppercase text-foreground" style={{ fontWeight: 800 }}>ZANDOFY</a>
          <h1 className="text-xl font-bold text-foreground">Nouveau mot de passe</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Nouveau mot de passe</Label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="pl-9 pr-10 h-11" required minLength={8} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs">Confirmer le mot de passe</Label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pl-9 pr-10 h-11" required minLength={8} />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
            {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
          </Button>
        </form>
      </div>
    </div>
  );
}
