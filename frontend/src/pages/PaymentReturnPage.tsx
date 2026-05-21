import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, ArrowLeft, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

type PaymentStatus = "success" | "failed" | "cancelled" | "pending" | "loading";

const MAX_POLL_ATTEMPTS = 60; // 5 minutes at 5s intervals
const POLL_INTERVAL_MS = 5000;

export default function PaymentReturnPage() {
  const [params] = useSearchParams();
  const ref = params.get("ref");
  const statusParam = params.get("status");
  const orderId = params.get("order_id");

  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [pollCount, setPollCount] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    async function fetchTransaction() {
      if (!ref && !orderId) {
        // Sécurité : sans transaction identifiable, on ne peut JAMAIS afficher
        // "Paiement confirmé" sur la seule foi d'un paramètre d'URL.
        setStatus(statusParam === "failed" ? "failed" : statusParam === "cancelled" ? "cancelled" : "pending");
        return;
      }

      let query = supabase
        .from("payment_transactions")
        .select("id, status, amount, currency, order_id, reference");

      if (ref) {
        query = query.eq("reference", ref);
      } else if (orderId) {
        query = query.eq("order_id", orderId).order("created_at", { ascending: false }).limit(1);
      }

      const { data } = await query.maybeSingle();

      if (data) {
        setAmount(Number(data.amount));
        setCurrency(data.currency || "USD");

        if (data.status === "success") setStatus("success");
        else if (data.status === "failed") setStatus("failed");
        else setStatus("pending");

        if (data.order_id) {
          const { data: order } = await supabase
            .from("orders")
            .select("order_ref")
            .eq("id", data.order_id)
            .maybeSingle();
          if (order) setOrderRef(order.order_ref);
        }
      } else {
        // Aucune transaction trouvée : ne jamais confirmer un succès via URL seule.
        setStatus(statusParam === "failed" ? "failed" : "pending");
      }
    }

    fetchTransaction();
  }, [ref, orderId, statusParam]);

  // Polling kelpay-check when status is pending
  useEffect(() => {
    if (status !== "pending" || (!ref && !orderId)) {
      stopPolling();
      return;
    }

    let attempts = 0;

    const poll = async () => {
      attempts++;
      setPollCount(attempts);

      if (attempts > MAX_POLL_ATTEMPTS) {
        stopPolling();
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;

        const body: Record<string, string> = {};
        if (ref) body.reference = ref;
        else if (orderId) body.transaction_id = orderId;

        const { data, error } = await supabase.functions.invoke("kelpay-check", { body });

        if (error) {
          console.error("kelpay-check poll error:", error);
          return;
        }

        if (data?.status === "success") {
          setStatus("success");
          if (data.kelpay?.amount) setAmount(Number(data.kelpay.amount));
          stopPolling();
        } else if (data?.status === "failed") {
          setStatus("failed");
          stopPolling();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    // First poll immediately
    poll();

    pollTimer.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [status, ref, orderId, stopPolling]);

  // Realtime as secondary channel
  useEffect(() => {
    if (!ref && !orderId) return;

    const channel = supabase
      .channel("payment-return")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payment_transactions",
          ...(ref ? { filter: `reference=eq.${ref}` } : {}),
        },
        (payload: any) => {
          const newRow = payload.new;
          if (newRow) {
            if (newRow.status === "success") setStatus("success");
            else if (newRow.status === "failed") setStatus("failed");
            setAmount(Number(newRow.amount));
            setCurrency(newRow.currency || "USD");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ref, orderId]);

  const renderContent = () => {
    if (status === "loading") {
      return (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground">Vérification du paiement...</p>
        </div>
      );
    }

    if (status === "success") {
      return (
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Paiement confirmé !</h1>
            <p className="text-muted-foreground mt-2">Votre paiement a été traité avec succès.</p>
          </div>
          {orderRef && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="text-muted-foreground">N° de commande</p>
              <p className="text-lg font-bold text-foreground">{orderRef}</p>
            </div>
          )}
          {amount !== null && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="text-muted-foreground">Montant payé</p>
              <p className="text-lg font-bold text-foreground">{amount.toFixed(2)} {currency}</p>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button asChild>
              <Link to="/dashboard"><ShoppingBag size={16} className="mr-2" /> Mes commandes</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/"><ArrowLeft size={16} className="mr-2" /> Continuer mes achats</Link>
            </Button>
          </div>
        </div>
      );
    }

    if (status === "failed" || status === "cancelled") {
      return (
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {status === "cancelled" ? "Paiement annulé" : "Paiement échoué"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {status === "cancelled"
                ? "Vous avez annulé le paiement. Aucun montant n'a été débité."
                : "Le paiement n'a pas pu être traité. Veuillez réessayer."}
            </p>
          </div>
          {orderRef && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="text-muted-foreground">N° de commande</p>
              <p className="text-lg font-bold text-foreground">{orderRef}</p>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button asChild>
              <Link to="/dashboard">Réessayer depuis mes commandes</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/"><ArrowLeft size={16} className="mr-2" /> Retour à l'accueil</Link>
            </Button>
          </div>
        </div>
      );
    }

    // Pending with polling info
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
          <Clock className="w-10 h-10 text-yellow-600 dark:text-yellow-400 animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paiement en cours de traitement</h1>
          <p className="text-muted-foreground mt-2">
            {pollCount >= MAX_POLL_ATTEMPTS
              ? "La vérification prend plus de temps que prévu. Vérifiez le statut dans vos commandes."
              : "Votre paiement est en cours de vérification. Cette page se mettra à jour automatiquement."}
          </p>
        </div>
        {orderRef && (
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="text-muted-foreground">N° de commande</p>
            <p className="text-lg font-bold text-foreground">{orderRef}</p>
          </div>
        )}
        <div className="flex gap-3 mt-4">
          <Button variant="outline" asChild>
            <Link to="/dashboard"><ShoppingBag size={16} className="mr-2" /> Mes commandes</Link>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container max-w-lg mx-auto px-4 py-8">
        {renderContent()}
      </main>
      <Footer />
    </div>
  );
}
