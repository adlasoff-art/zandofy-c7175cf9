import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, ShieldCheck, Globe } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useGeoDetection } from "@/hooks/use-geo-detection";
import { LegalModal } from "@/components/auth/LegalModal";
import {
  signInWithGoogle,
  checkRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  getPasswordStrength,
} from "@/lib/auth-helpers";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockoutMsg, setLockoutMsg] = useState<string | null>(null);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | "cookies" | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const geo = useGeoDetection();

  const searchParams = new URLSearchParams(window.location.search);
  const refCode = searchParams.get("ref") || "";

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const pwStrength = mode === "signup" ? getPasswordStrength(password) : null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    const rl = checkRateLimit();
    if (!rl.allowed) {
      const mins = Math.ceil(rl.remainingSeconds / 60);
      setLockoutMsg(`Trop de tentatives. Réessayez dans ${mins} minute(s).`);
      return;
    }
    setLockoutMsg(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        if (getPasswordStrength(password).score < 3) {
          toast({
            title: "Mot de passe trop faible",
            description: "Utilisez au moins 8 caractères avec majuscules, chiffres et symboles.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              first_name: firstName,
              last_name: lastName,
              referral_code: refCode,
              detected_country: geo.country_code,
              detected_city: geo.city,
            },
          },
        });
        if (error) throw error;

        if (refCode && signUpData.user) {
          const { data: referrer } = await supabase
            .from("profiles")
            .select("id")
            .eq("referral_code", refCode)
            .maybeSingle();

          if (referrer) {
            const { data: settings } = await supabase
              .from("platform_settings")
              .select("value")
              .eq("key", "referral_settings")
              .maybeSingle();

            const cfg = settings?.value as any;
            const commissionPct = cfg?.commission_pct || 5;
            const maxOrders = cfg?.max_rewarded_orders || 5;

            await supabase.from("referrals").insert({
              referrer_id: referrer.id,
              referee_id: signUpData.user.id,
              commission_pct: commissionPct,
              max_rewarded_orders: maxOrders,
            });
            await supabase.from("zando_points").insert({ user_id: signUpData.user.id });
          }
        }
        resetLoginAttempts();
        toast({ title: t("auth.signupSuccess"), description: t("auth.signupSuccessDesc") });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: t("auth.emailSent"), description: t("auth.emailSentDesc") });
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const result = recordFailedLogin();
          if (result.locked) {
            setLockoutMsg(`Compte temporairement verrouillé. Réessayez dans ${Math.ceil(result.remainingSeconds / 60)} minutes.`);
          }
          throw error;
        }
        resetLoginAttempts();
      }
    } catch (err: any) {
      toast({
        title: t("auth.error"),
        description: err.message || t("auth.genericError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const rl = checkRateLimit();
    if (!rl.allowed) {
      const mins = Math.ceil(rl.remainingSeconds / 60);
      setLockoutMsg(`Trop de tentatives. Réessayez dans ${mins} minute(s).`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({ title: t("auth.error"), description: error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: t("auth.error"), description: err.message || t("auth.genericError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center h-14">
          <a href="/" className="text-xl font-bold tracking-[0.18em] uppercase text-foreground" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800 }}>
            ZANDOFY
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {mode === "login" && t("auth.login")}
              {mode === "signup" && t("auth.signup")}
              {mode === "forgot" && t("auth.forgotPassword")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login" && t("auth.loginDesc")}
              {mode === "signup" && t("auth.signupDesc")}
              {mode === "forgot" && t("auth.forgotDesc")}
            </p>
            {/* Geo-detection badge */}
            {!geo.loading && geo.country_name && mode === "signup" && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                <Globe size={12} />
                <span>{geo.country_name}{geo.city ? ` · ${geo.city}` : ""}</span>
              </div>
            )}
          </div>

          {lockoutMsg && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldCheck size={16} />
              {lockoutMsg}
            </div>
          )}

          {mode !== "forgot" && (
            <>
              <Button
                variant="outline"
                className="w-full h-12 gap-3 text-sm font-medium"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {t("auth.continueGoogle")}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">{t("auth.or")}</span></div>
              </div>
            </>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs">{t("auth.firstName")}</Label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="firstName" placeholder="Jean" value={firstName} onChange={e => setFirstName(e.target.value)} className="pl-9 h-11" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs">{t("auth.lastName")}</Label>
                  <Input id="lastName" placeholder="Dupont" value={lastName} onChange={e => setLastName(e.target.value)} className="h-11" required />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">{t("auth.email")}</Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" placeholder="vous@exemple.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-9 h-11" required />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">{t("auth.password")}</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-9 pr-10 h-11" required minLength={8} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === "signup" && password.length > 0 && pwStrength && (
                  <div className="space-y-1">
                    <div className="flex gap-1 h-1.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`flex-1 rounded-full transition-colors ${i <= pwStrength.score ? pwStrength.color : "bg-muted"}`} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Force : {pwStrength.label}</p>
                  </div>
                )}
              </div>
            )}

            {mode === "login" && (
              <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                {t("auth.forgotLink")}
              </button>
            )}

            {/* Legal consent for signup */}
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                En créant un compte, vous acceptez nos{" "}
                <button type="button" onClick={() => setLegalModal("terms")} className="text-primary hover:underline font-medium">
                  Conditions d'utilisation
                </button>
                , notre{" "}
                <button type="button" onClick={() => setLegalModal("privacy")} className="text-primary hover:underline font-medium">
                  Politique de confidentialité
                </button>
                {" "}et notre{" "}
                <button type="button" onClick={() => setLegalModal("cookies")} className="text-primary hover:underline font-medium">
                  Politique de cookies
                </button>
                .
              </p>
            )}

            <Button type="submit" className="w-full h-12 font-bold" disabled={loading || !!lockoutMsg}>
              {loading ? t("auth.loading") : mode === "login" ? t("auth.loginButton") : mode === "signup" ? t("auth.signupButton") : t("auth.sendLink")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>{t("auth.noAccount")} <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">{t("auth.signupButton")}</button></>
            ) : mode === "signup" ? (
              <>{t("auth.hasAccount")} <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">{t("auth.loginButton")}</button></>
            ) : (
              <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline inline-flex items-center gap-1"><ArrowLeft size={14} /> {t("auth.backToLogin")}</button>
            )}
          </p>

          {/* Security notice */}
          <p className="text-center text-[11px] text-muted-foreground/60 flex items-center justify-center gap-1">
            <ShieldCheck size={12} />
            Connexion sécurisée · Données chiffrées
          </p>
        </div>
      </main>

      {/* Legal modals */}
      <LegalModal
        open={legalModal !== null}
        onOpenChange={(open) => !open && setLegalModal(null)}
        type={legalModal || "privacy"}
      />
    </div>
  );
}
