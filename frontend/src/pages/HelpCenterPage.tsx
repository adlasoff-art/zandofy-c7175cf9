import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabase-helpers";
import {
  parseTicketReference,
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_PRIORITY_CREATE_OPTIONS,
  supportCategoryLabel,
  supportPriorityLabel,
  SUPPORT_STATUS_OPTIONS,
  supportStatusLabel,
  toTicketReference,
  type SupportMessage,
  type SupportTicket,
} from "@/lib/support";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2, Headphones, MessageSquare, ShieldAlert, RefreshCw, Send, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FaqCategory {
  title: string;
  items: { q: string; a: string }[];
}

const fallbackFaqFr: FaqCategory[] = [
  {
    title: "Procédures clients",
    items: [
      { q: "Je n'arrive pas à payer", a: "Vérifiez votre moyen de paiement, puis réessayez. Si l'erreur persiste, ouvrez un ticket catégorie Paiement avec la référence commande." },
      { q: "Ma commande tarde", a: "Contrôlez d'abord la page Suivi. Ensuite, ouvrez un ticket catégorie Livraison pour accélérer la prise en charge." },
      { q: "Je ne peux plus me connecter", a: "Utilisez le formulaire invité du Centre d'aide avec votre email pour joindre l'équipe support même sans connexion." },
    ],
  },
  {
    title: "Procédures vendeurs",
    items: [
      { q: "Un client signale un problème", a: "Répondez depuis votre espace, puis ouvrez/alimentez un ticket support si arbitrage nécessaire." },
      { q: "Retrait ou paiement bloqué", a: "Créez un ticket catégorie Paiement en priorité Haute ou Urgente en ajoutant la référence de transaction." },
      { q: "Produit refusé en modération", a: "Vérifiez les exigences de contenu, corrigez la fiche et contactez le support si le blocage persiste." },
    ],
  },
];

const fallbackFaqEn: FaqCategory[] = [
  {
    title: "Customer procedures",
    items: [
      { q: "I cannot complete payment", a: "Check your payment method first, then retry. If it still fails, open a Payment ticket with your order reference." },
      { q: "My order is delayed", a: "Check Tracking first. Then open a Delivery ticket so support can investigate faster." },
      { q: "I can’t log in anymore", a: "Use the guest form in Help Center with your email to contact support without signing in." },
    ],
  },
  {
    title: "Vendor procedures",
    items: [
      { q: "A customer reports an issue", a: "Reply from your dashboard, then open/update a support ticket if escalation is needed." },
      { q: "Payout or payment blocked", a: "Create a Payment ticket with High/Urgent priority and include the transaction reference." },
      { q: "Product rejected by moderation", a: "Review listing requirements, fix your data, then contact support if the issue persists." },
    ],
  },
];

const statusTone: Record<string, string> = {
  open: "bg-secondary text-secondary-foreground border-transparent",
  in_progress: "bg-accent text-accent-foreground border-transparent",
  resolved: "bg-primary/15 text-primary border-primary/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const priorityTone: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  normal: "bg-secondary text-secondary-foreground border-transparent",
  medium: "bg-secondary text-secondary-foreground border-transparent",
  high: "bg-primary/15 text-primary border-primary/30",
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
};

function TicketStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", statusTone[status] || statusTone.open)}>
      {supportStatusLabel(status)}
    </Badge>
  );
}

function TicketPriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", priorityTone[priority] || priorityTone.medium)}>
      {supportPriorityLabel(priority)}
    </Badge>
  );
}

export default function HelpCenterPage() {
  const { user } = useAuth();
  const { locale } = useI18n();

  const [cmsFaq, setCmsFaq] = useState<{ fr: FaqCategory[]; en: FaqCategory[] } | null>(null);

  const [authTickets, setAuthTickets] = useState<SupportTicket[]>([]);
  const [authTicketsLoading, setAuthTicketsLoading] = useState(false);
  const [selectedAuthTicket, setSelectedAuthTicket] = useState<SupportTicket | null>(null);
  const [authMessages, setAuthMessages] = useState<SupportMessage[]>([]);
  const [authMessagesLoading, setAuthMessagesLoading] = useState(false);
  const [authReply, setAuthReply] = useState("");
  const [sendingAuthReply, setSendingAuthReply] = useState(false);
  const authEndRef = useRef<HTMLDivElement>(null);

  const [authSubject, setAuthSubject] = useState("");
  const [authCategory, setAuthCategory] = useState("other");
  const [authPriority, setAuthPriority] = useState("medium");
  const [authMessage, setAuthMessage] = useState("");
  const [creatingAuthTicket, setCreatingAuthTicket] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestSubject, setGuestSubject] = useState("");
  const [guestCategory, setGuestCategory] = useState("other");
  const [guestPriority, setGuestPriority] = useState("medium");
  const [guestMessage, setGuestMessage] = useState("");
  const [creatingGuestTicket, setCreatingGuestTicket] = useState(false);

  const [guestLookupRef, setGuestLookupRef] = useState("");
  const [guestLookupEmail, setGuestLookupEmail] = useState("");
  const [guestThread, setGuestThread] = useState<{ ticket: SupportTicket; messages: SupportMessage[] } | null>(null);
  const [guestThreadLoading, setGuestThreadLoading] = useState(false);
  const [guestReply, setGuestReply] = useState("");
  const [sendingGuestReply, setSendingGuestReply] = useState(false);
  const guestEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "cms_faq")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          setCmsFaq(data.value as unknown as { fr: FaqCategory[]; en: FaqCategory[] });
        }
      });
  }, []);

  const faqCategories = useMemo(() => {
    if (cmsFaq) {
      return locale === "en" ? cmsFaq.en : cmsFaq.fr;
    }
    return locale === "en" ? fallbackFaqEn : fallbackFaqFr;
  }, [cmsFaq, locale]);

  const fetchAuthTickets = useCallback(async () => {
    if (!user) return;
    setAuthTicketsLoading(true);
    try {
      const { data, error } = await fromTable("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setAuthTickets((data || []) as SupportTicket[]);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de charger vos tickets");
    } finally {
      setAuthTicketsLoading(false);
    }
  }, [user]);

  const fetchAuthMessages = useCallback(async (ticketId: string) => {
    setAuthMessagesLoading(true);
    try {
      const { data, error } = await fromTable("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setAuthMessages((data || []) as SupportMessage[]);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de charger ce ticket");
    } finally {
      setAuthMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchAuthTickets();
    } else {
      setAuthTickets([]);
      setSelectedAuthTicket(null);
      setAuthMessages([]);
    }
  }, [user, fetchAuthTickets]);

  useEffect(() => {
    if (!selectedAuthTicket) return;

    fetchAuthMessages(selectedAuthTicket.id);

    const channel = supabase
      .channel(`help-center-${selectedAuthTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${selectedAuthTicket.id}`,
        },
        (payload) => {
          const next = payload.new as SupportMessage;
          setAuthMessages((prev) => (prev.some((m) => m.id === next.id) ? prev : [...prev, next]));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedAuthTicket, fetchAuthMessages]);

  useEffect(() => {
    authEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [authMessages]);

  useEffect(() => {
    guestEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [guestThread?.messages]);

  const createAuthTicket = async () => {
    if (!user || !authSubject.trim() || !authMessage.trim()) return;
    setCreatingAuthTicket(true);
    try {
      const { data: ticket, error: ticketError } = await fromTable("support_tickets")
        .insert({
          user_id: user.id,
          subject: authSubject.trim(),
          category: authCategory,
          priority: authPriority,
          status: "open",
        })
        .select("*")
        .single();
      if (ticketError || !ticket) throw ticketError;

      const { error: messageError } = await fromTable("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        content: authMessage.trim(),
        is_staff: false,
      });
      if (messageError) throw messageError;

      setAuthSubject("");
      setAuthCategory("other");
      setAuthPriority("medium");
      setAuthMessage("");
      toast.success("Ticket créé avec succès");
      await fetchAuthTickets();
      setSelectedAuthTicket(ticket as SupportTicket);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de créer le ticket");
    } finally {
      setCreatingAuthTicket(false);
    }
  };

  const sendAuthReply = async () => {
    if (!user || !selectedAuthTicket || !authReply.trim() || sendingAuthReply) return;
    setSendingAuthReply(true);
    try {
      const { error } = await fromTable("support_messages").insert({
        ticket_id: selectedAuthTicket.id,
        sender_id: user.id,
        content: authReply.trim(),
        is_staff: false,
      });
      if (error) throw error;

      const nextStatus = selectedAuthTicket.status === "resolved" ? "in_progress" : selectedAuthTicket.status;
      await fromTable("support_tickets")
        .update({ updated_at: new Date().toISOString(), status: nextStatus })
        .eq("id", selectedAuthTicket.id);

      setSelectedAuthTicket((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      setAuthTickets((prev) => prev.map((ticket) => (ticket.id === selectedAuthTicket.id ? { ...ticket, status: nextStatus } : ticket)));
      setAuthReply("");
    } catch (error) {
      console.error(error);
      toast.error("Impossible d'envoyer le message");
    } finally {
      setSendingAuthReply(false);
    }
  };

  const loadGuestThread = useCallback(async (referenceValue: string, emailValue: string) => {
    const ticketId = parseTicketReference(referenceValue);
    if (!ticketId) {
      toast.error("Référence de ticket invalide");
      return;
    }

    if (!emailValue.trim()) {
      toast.error("Email requis pour retrouver le ticket");
      return;
    }

    setGuestThreadLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_guest_support_ticket", {
        p_ticket_id: ticketId,
        p_requester_email: emailValue.trim().toLowerCase(),
      });
      if (error) throw error;

      const payload = data as unknown as { ticket: SupportTicket; messages: SupportMessage[] };
      setGuestThread({
        ticket: payload.ticket,
        messages: payload.messages || [],
      });
      setGuestLookupRef(ticketId);
      setGuestLookupEmail(emailValue.trim().toLowerCase());
    } catch (error) {
      console.error(error);
      toast.error("Ticket introuvable, vérifiez la référence et l'email");
      setGuestThread(null);
    } finally {
      setGuestThreadLoading(false);
    }
  }, []);

  const createGuestTicket = async () => {
    if (!guestEmail.trim() || !guestSubject.trim() || !guestMessage.trim()) return;
    setCreatingGuestTicket(true);
    try {
      const { data, error } = await (supabase as any).rpc("create_guest_support_ticket", {
        p_subject: guestSubject.trim(),
        p_category: guestCategory,
        p_priority: guestPriority,
        p_message: guestMessage.trim(),
        p_requester_email: guestEmail.trim().toLowerCase(),
        p_requester_name: guestName.trim() || null,
      });
      if (error) throw error;

      const created = (Array.isArray(data) ? data[0] : data) as { ticket_id?: string; ticket_reference?: string } | null;
      const ticketId = created?.ticket_id || "";
      const ticketReference = created?.ticket_reference || toTicketReference(ticketId);

      setGuestLookupRef(ticketId);
      setGuestLookupEmail(guestEmail.trim().toLowerCase());
      toast.success(`Ticket créé: ${ticketReference}`);

      setGuestSubject("");
      setGuestCategory("other");
      setGuestPriority("medium");
      setGuestMessage("");

      await loadGuestThread(ticketId, guestEmail.trim().toLowerCase());
    } catch (error) {
      console.error(error);
      toast.error("Impossible de créer le ticket invité");
    } finally {
      setCreatingGuestTicket(false);
    }
  };

  const sendGuestReply = async () => {
    const ticketId = parseTicketReference(guestLookupRef);
    if (!ticketId || !guestLookupEmail.trim() || !guestReply.trim()) return;

    setSendingGuestReply(true);
    try {
      const { error } = await supabase.rpc("add_guest_support_message", {
        p_ticket_id: ticketId,
        p_requester_email: guestLookupEmail.trim().toLowerCase(),
        p_content: guestReply.trim(),
      });
      if (error) throw error;

      setGuestReply("");
      await loadGuestThread(ticketId, guestLookupEmail.trim().toLowerCase());
    } catch (error) {
      console.error(error);
      toast.error("Impossible d'envoyer votre réponse");
    } finally {
      setSendingGuestReply(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Centre d'aide | Zandofy"
        description="Obtenez de l’aide rapidement : procédures clients/vendeurs, création de ticket support et suivi en temps réel."
        canonical="/help-center"
      />

      <Header />

      <main className="container py-8 md:py-12">
        <section className="mb-8">
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-full bg-primary/10 p-2">
                <LifeBuoy size={20} className="text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Centre d'aide</h1>
                <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-3xl">
                  Trouvez les procédures clés pour clients et vendeurs, puis créez ou suivez vos tickets support en un seul endroit.
                </p>
              </div>
            </div>
          </div>
        </section>

        <Tabs defaultValue="guides" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="guides">Procédures</TabsTrigger>
            <TabsTrigger value="tickets">Tickets support</TabsTrigger>
          </TabsList>

          <TabsContent value="guides" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Parcours client</CardTitle>
                  <CardDescription>Résoudre rapidement les cas les plus fréquents côté acheteur.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>1. Vérifier d'abord le suivi de commande et les notifications.</p>
                  <p>2. Consulter la FAQ pour paiement, livraison, retour et compte.</p>
                  <p>3. Ouvrir un ticket avec priorité adaptée si le problème persiste.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Parcours vendeur</CardTitle>
                  <CardDescription>Escalader correctement les incidents opérationnels.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>1. Documenter la référence (commande, transaction, retrait).</p>
                  <p>2. Choisir la bonne catégorie et le bon niveau de priorité.</p>
                  <p>3. Suivre le ticket jusqu'à résolution avec réponses horodatées.</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">FAQ opérationnelle</CardTitle>
                <CardDescription>Questions fréquentes modifiables depuis le CMS.</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="space-y-2">
                  {faqCategories.map((category) => (
                    <section key={category.title} className="space-y-2">
                      <h2 className="text-sm font-semibold text-foreground">{category.title}</h2>
                      {category.items.map((item, index) => (
                        <AccordionItem
                          key={`${category.title}-${index}`}
                          value={`${category.title}-${index}`}
                          className="rounded-lg border border-border px-4"
                        >
                          <AccordionTrigger className="text-sm text-foreground hover:no-underline">
                            {item.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground">
                            {item.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </section>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets" className="space-y-4">
            {user ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Créer un ticket</CardTitle>
                    <CardDescription>Décrivez le problème pour une prise en charge plus rapide.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="auth-subject">Sujet</Label>
                      <Input
                        id="auth-subject"
                        value={authSubject}
                        onChange={(e) => setAuthSubject(e.target.value)}
                        placeholder="Ex: Paiement validé mais commande absente"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="auth-category">Catégorie</Label>
                      <select
                        id="auth-category"
                        value={authCategory}
                        onChange={(e) => setAuthCategory(e.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {SUPPORT_CATEGORY_OPTIONS.filter((c) => c.value !== "all").map((category) => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="auth-priority">Priorité</Label>
                      <select
                        id="auth-priority"
                        value={authPriority}
                        onChange={(e) => setAuthPriority(e.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {SUPPORT_PRIORITY_CREATE_OPTIONS.map((priority) => (
                          <option key={priority.value} value={priority.value}>
                            {priority.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="auth-message">Message</Label>
                      <Textarea
                        id="auth-message"
                        value={authMessage}
                        onChange={(e) => setAuthMessage(e.target.value)}
                        className="min-h-[120px]"
                        placeholder="Expliquez clairement les étapes déjà testées et l’impact du problème."
                      />
                    </div>

                    <Button
                      onClick={createAuthTicket}
                      disabled={creatingAuthTicket || !authSubject.trim() || !authMessage.trim()}
                      className="w-full"
                    >
                      {creatingAuthTicket ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Headphones size={16} className="mr-2" />}
                      Ouvrir le ticket
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mes tickets</CardTitle>
                    <CardDescription>Suivez vos demandes en cours et leur priorité.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {authTicketsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-muted-foreground" />
                      </div>
                    ) : authTickets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun ticket pour le moment.</p>
                    ) : (
                      <div className="space-y-2">
                        {authTickets.map((ticket) => (
                          <button
                            key={ticket.id}
                            onClick={() => setSelectedAuthTicket(ticket)}
                            className={cn(
                              "w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/40",
                              selectedAuthTicket?.id === ticket.id && "bg-muted/40",
                            )}
                          >
                            <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <TicketStatusBadge status={ticket.status} />
                              <TicketPriorityBadge priority={ticket.priority} />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Discussion ticket</CardTitle>
                    <CardDescription>
                      {selectedAuthTicket ? `${selectedAuthTicket.subject} (${toTicketReference(selectedAuthTicket.id)})` : "Sélectionnez un ticket pour lire/répondre"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedAuthTicket ? (
                      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        <MessageSquare size={18} className="mx-auto mb-2" />
                        Choisissez un ticket dans la liste pour afficher le fil des messages.
                      </div>
                    ) : (
                      <>
                        <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-[320px] overflow-y-auto space-y-2">
                          {authMessagesLoading ? (
                            <div className="flex justify-center py-6">
                              <Loader2 className="animate-spin text-muted-foreground" />
                            </div>
                          ) : authMessages.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucun message sur ce ticket.</p>
                          ) : (
                            authMessages.map((message) => (
                              <div key={message.id} className={`flex ${message.is_staff ? "justify-start" : "justify-end"}`}>
                                <div
                                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                                    message.is_staff
                                      ? "bg-card border border-border text-foreground"
                                      : "bg-primary text-primary-foreground"
                                  }`}
                                >
                                  <p className="text-[11px] opacity-80 mb-1">
                                    {message.is_staff ? "Support" : "Vous"}
                                  </p>
                                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                </div>
                              </div>
                            ))
                          )}
                          <div ref={authEndRef} />
                        </div>

                        <div className="flex gap-2">
                          <Input
                            value={authReply}
                            onChange={(e) => setAuthReply(e.target.value)}
                            placeholder="Votre réponse..."
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendAuthReply()}
                          />
                          <Button size="icon" onClick={sendAuthReply} disabled={sendingAuthReply || !authReply.trim()}>
                            {sendingAuthReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Créer un ticket (invité)</CardTitle>
                    <CardDescription>
                      Accessible sans connexion, utile pour comptes bloqués, bannis ou perte d'accès.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="guest-name">Nom (optionnel)</Label>
                      <Input
                        id="guest-name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Votre nom"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guest-email">Email</Label>
                      <Input
                        id="guest-email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="email@exemple.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guest-subject">Sujet</Label>
                      <Input
                        id="guest-subject"
                        value={guestSubject}
                        onChange={(e) => setGuestSubject(e.target.value)}
                        placeholder="Ex: Je ne peux plus me connecter"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="guest-category">Catégorie</Label>
                        <select
                          id="guest-category"
                          value={guestCategory}
                          onChange={(e) => setGuestCategory(e.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {SUPPORT_CATEGORY_OPTIONS.filter((c) => c.value !== "all").map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="guest-priority">Priorité</Label>
                        <select
                          id="guest-priority"
                          value={guestPriority}
                          onChange={(e) => setGuestPriority(e.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {SUPPORT_PRIORITY_CREATE_OPTIONS.map((priority) => (
                            <option key={priority.value} value={priority.value}>
                              {priority.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guest-message">Message</Label>
                      <Textarea
                        id="guest-message"
                        value={guestMessage}
                        onChange={(e) => setGuestMessage(e.target.value)}
                        className="min-h-[120px]"
                        placeholder="Décrivez le souci et les actions déjà tentées."
                      />
                    </div>

                    <Button
                      onClick={createGuestTicket}
                      disabled={creatingGuestTicket || !guestEmail.trim() || !guestSubject.trim() || !guestMessage.trim()}
                      className="w-full"
                    >
                      {creatingGuestTicket ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Headphones size={16} className="mr-2" />}
                      Envoyer la demande
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Suivre un ticket invité</CardTitle>
                    <CardDescription>Utilisez votre référence ticket (UUID ou format ZD-...) et votre email.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="lookup-ref">Référence ticket</Label>
                      <Input
                        id="lookup-ref"
                        value={guestLookupRef}
                        onChange={(e) => setGuestLookupRef(e.target.value)}
                        placeholder="ZD-XXXXXXXX... ou UUID"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lookup-email">Email utilisé lors de la création</Label>
                      <Input
                        id="lookup-email"
                        type="email"
                        value={guestLookupEmail}
                        onChange={(e) => setGuestLookupEmail(e.target.value)}
                        placeholder="email@exemple.com"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => loadGuestThread(guestLookupRef, guestLookupEmail)}
                        disabled={guestThreadLoading || !guestLookupRef.trim() || !guestLookupEmail.trim()}
                        className="flex-1"
                      >
                        {guestThreadLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <MessageSquare size={16} className="mr-2" />}
                        Charger le ticket
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => loadGuestThread(guestLookupRef, guestLookupEmail)}
                        disabled={guestThreadLoading || !guestThread}
                      >
                        <RefreshCw size={16} />
                      </Button>
                    </div>

                    {!guestThread ? (
                      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        <ShieldAlert size={18} className="mx-auto mb-2" />
                        Aucun ticket chargé pour le moment.
                      </div>
                    ) : (
                      <>
                        <div className="rounded-lg border border-border p-3 bg-muted/30">
                          <p className="text-sm font-medium text-foreground">{guestThread.ticket.subject}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <TicketStatusBadge status={guestThread.ticket.status} />
                            <TicketPriorityBadge priority={guestThread.ticket.priority} />
                            <Badge variant="outline">{supportCategoryLabel(guestThread.ticket.category)}</Badge>
                          </div>
                        </div>

                        <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-[260px] overflow-y-auto space-y-2">
                          {guestThread.messages.map((message) => (
                            <div key={message.id} className={`flex ${message.is_staff ? "justify-start" : "justify-end"}`}>
                              <div
                                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                                  message.is_staff
                                    ? "bg-card border border-border text-foreground"
                                    : "bg-primary text-primary-foreground"
                                }`}
                              >
                                <p className="text-[11px] opacity-80 mb-1">{message.is_staff ? "Support" : "Vous"}</p>
                                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                              </div>
                            </div>
                          ))}
                          <div ref={guestEndRef} />
                        </div>

                        <div className="flex gap-2">
                          <Input
                            value={guestReply}
                            onChange={(e) => setGuestReply(e.target.value)}
                            placeholder="Ajouter une réponse..."
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendGuestReply()}
                          />
                          <Button size="icon" onClick={sendGuestReply} disabled={sendingGuestReply || !guestReply.trim()}>
                            {sendingGuestReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
