import { useState, useEffect, useCallback, useRef } from "react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { CheckoutShippingCalculator } from "@/components/CheckoutShippingCalculator";
import { CountryCombobox, getCountryName } from "@/components/vendor/CountryCombobox";
import { useI18n } from "@/contexts/I18nContext";
import {
  CreditCard, Smartphone, Truck, ChevronRight, Check, ShieldCheck,
  ArrowLeft, Package, MapPin, Banknote, Tag, Plus, Trash2, Home, Briefcase, X, Loader2, Coins
} from "lucide-react";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useKycStatus } from "@/hooks/use-kyc";
import { KycBanner } from "@/components/kyc/KycBanner";

type Step = "shipping" | "payment" | "confirmation";
type PaymentMethod = "stripe" | "mobile_money" | "cod";

interface ShippingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
}

interface SavedAddress {
  id: string;
  label: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postal_code: string;
  is_default: boolean;
}

interface CouponData {
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
  source: "global" | "store";
  store_id?: string;
}

const FALLBACK_SHIPPING_COST = 5.99;

const emptyShipping: ShippingInfo = {
  firstName: "", lastName: "", email: "", phone: "",
  address: "", city: "", country: "CD", postalCode: "",
};

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: paymentConfig } = usePaymentMethods();

  const [step, setStep] = useState<Step>("shipping");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [processing, setProcessing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Mobile Money KelPay state
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState("");
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState("orange_money");
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const paymentChannelRef = useRef<any>(null);

  const [shipping, setShipping] = useState<ShippingInfo>({ ...emptyShipping, email: user?.email || "" });

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [addressLabel, setAddressLabel] = useState("Domicile");

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponData | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // Dynamic shipping
  const [dynamicShippingCost, setDynamicShippingCost] = useState<number | null>(null);
  const [shippingMode, setShippingMode] = useState<string>("air");

  // Free shipping threshold from platform settings
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(50);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(true);

  // Loyalty discount
  const [loyaltyPct, setLoyaltyPct] = useState(0);
  const [loyaltyBadge, setLoyaltyBadge] = useState("");

  // ZandoPoints
  const [pointsBalance, setPointsBalance] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Fetch loyalty tier
    supabase.from("profiles").select("customer_tier").eq("id", user.id).single().then(({ data }) => {
      if (data?.customer_tier && data.customer_tier !== "client") {
        supabase.from("customer_tiers").select("discount_pct, badge_label").eq("tier_name", data.customer_tier).single().then(({ data: t }) => {
          if (t) { setLoyaltyPct(Number(t.discount_pct)); setLoyaltyBadge(t.badge_label); }
        });
      }
    });
    // Fetch free shipping threshold
    supabase.from("platform_settings").select("value").eq("key", "free_shipping_threshold").maybeSingle().then(({ data }) => {
      if (data?.value) {
        const v = data.value as any;
        setFreeShippingEnabled(!!v.enabled);
        setFreeShippingThreshold(Number(v.amount) || 50);
      }
    });
    // Fetch ZandoPoints balance
    supabase.from("zando_points").select("balance").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setPointsBalance(Number(data.balance));
    });
  }, [user]);

  // Cleanup realtime subscription on unmount
  useEffect(() => {
    return () => {
      if (paymentChannelRef.current) {
        supabase.removeChannel(paymentChannelRef.current);
      }
    };
  }, []);

  const handleShippingCostChange = useCallback((cost: number, mode: string) => {
    setDynamicShippingCost(cost > 0 ? cost : null);
    setShippingMode(mode);
  }, []);

  const shippingCost = dynamicShippingCost !== null
    ? dynamicShippingCost
    : (freeShippingEnabled && subtotal >= freeShippingThreshold ? 0 : FALLBACK_SHIPPING_COST);

  const couponDiscount = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? (subtotal * appliedCoupon.discount_value) / 100
      : Math.min(appliedCoupon.discount_value, subtotal)
    : 0;

  const loyaltyDiscount = loyaltyPct > 0 ? (subtotal * loyaltyPct) / 100 : 0;
  const discountAmount = couponDiscount + loyaltyDiscount;
  const pointsDiscount = usePoints ? Math.min(pointsToUse, pointsBalance) : 0;

  const total = Math.max(0, subtotal - discountAmount - pointsDiscount + shippingCost);

  // Load saved addresses
  useEffect(() => {
    if (!user) return;
    supabase.from("saved_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).then(({ data }) => {
      if (data) {
        setSavedAddresses(data as SavedAddress[]);
        const def = data.find((a: any) => a.is_default);
        if (def) {
          setSelectedAddressId(def.id);
          applyAddress(def as SavedAddress);
        }
      }
    });
  }, [user]);

  const applyAddress = (addr: SavedAddress) => {
    setShipping({
      firstName: addr.first_name,
      lastName: addr.last_name,
      email: user?.email || "",
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      country: addr.country,
      postalCode: addr.postal_code || "",
    });
  };

  const handleSelectAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    applyAddress(addr);
  };

  const handleDeleteAddress = async (id: string) => {
    await supabase.from("saved_addresses").delete().eq("id", id);
    setSavedAddresses(prev => prev.filter(a => a.id !== id));
    if (selectedAddressId === id) {
      setSelectedAddressId(null);
      setShipping({ ...emptyShipping, email: user?.email || "" });
    }
  };

  // Coupon logic
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    const code = couponCode.trim().toUpperCase();

    // 1. Try global coupons first
    const { data: globalData } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, min_order_amount, max_uses, current_uses, expires_at")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    // 2. Try store coupons
    const { data: storeData } = await supabase
      .from("store_coupons")
      .select("code, discount_type, discount_value, min_order_amount, max_uses, current_uses, expires_at, store_id")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    const coupon = globalData || storeData;

    if (!coupon) {
      toast({ title: t("checkout.invalidCode"), description: t("checkout.invalidCodeDesc"), variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      toast({ title: t("checkout.expiredCode"), description: t("checkout.expiredCodeDesc"), variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      toast({ title: t("checkout.usedCode"), description: t("checkout.usedCodeDesc"), variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    // For store coupons, verify at least one cart item belongs to that store
    const isStoreCoupon = !!storeData && !globalData;
    if (isStoreCoupon) {
      const productIds = items.map((i) => i.productId).filter(Boolean);
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, store_id")
          .in("id", productIds)
          .eq("store_id", storeData.store_id);
        if (!prods || prods.length === 0) {
          toast({ title: t("checkout.invalidCode"), description: t("checkout.storeCouponMismatch"), variant: "destructive" });
          setCouponLoading(false);
          return;
        }
      }
    }

    if (subtotal < (coupon.min_order_amount || 0)) {
      toast({ title: t("checkout.minAmount"), description: `Minimum $${coupon.min_order_amount}`, variant: "destructive" });
      setCouponLoading(false);
      return;
    }

    setAppliedCoupon({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      min_order_amount: Number(coupon.min_order_amount || 0),
      source: isStoreCoupon ? "store" : "global",
      store_id: isStoreCoupon ? storeData.store_id : undefined,
    });
    toast({ title: t("checkout.codeApplied"), description: `${coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `$${coupon.discount_value}`}` });
    setCouponLoading(false);
  };

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: "shipping", label: t("checkout.shipping"), icon: <Truck size={16} /> },
    { key: "payment", label: t("checkout.payment"), icon: <CreditCard size={16} /> },
    { key: "confirmation", label: t("checkout.confirmation"), icon: <Check size={16} /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center space-y-4">
          <Package size={48} className="mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">{t("checkout.loginRequired")}</h1>
          <p className="text-muted-foreground">{t("checkout.loginRequiredDesc")}</p>
          <Link to="/auth"><Button>{t("checkout.loginButton")}</Button></Link>
        </main>
      </div>
    );
  }

  if (items.length === 0 && step !== "confirmation") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center space-y-4">
          <Package size={48} className="mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">{t("checkout.emptyCart")}</h1>
          <p className="text-muted-foreground">{t("checkout.emptyCartDesc")}</p>
          <Link to="/"><Button variant="outline">{t("checkout.backToShop")}</Button></Link>
        </main>
      </div>
    );
  }

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required = ["firstName", "lastName", "phone", "address", "city", "country"] as const;
    for (const field of required) {
      if (!shipping[field].trim()) {
        toast({ title: t("checkout.requiredField"), description: t("checkout.fillRequired"), variant: "destructive" });
        return;
      }
    }

    // Save address if checked
    if (saveAddress && user) {
      const { error } = await supabase.from("saved_addresses").insert({
        user_id: user.id,
        label: addressLabel,
        first_name: shipping.firstName,
        last_name: shipping.lastName,
        phone: shipping.phone,
        address: shipping.address,
        city: shipping.city,
        country: shipping.country,
        postal_code: shipping.postalCode,
        is_default: savedAddresses.length === 0,
      });
      if (!error) {
        const { data } = await supabase.from("saved_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false });
        if (data) setSavedAddresses(data as SavedAddress[]);
        setSaveAddress(false);
      }
    }

    setStep("payment");
  };




  const createOrderForPayment = async () => {
    const mockOrderRef = `ZND-${Date.now().toString(36).toUpperCase()}`;

    const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
    const { data: prods } = productIds.length > 0
      ? await supabase.from("products").select("id, store_id").in("id", productIds)
      : { data: [] };
    const storeMap = new Map((prods || []).map((p) => [p.id, p.store_id]));

    const storeGroups = new Map<string, typeof items>();
    items.forEach((item) => {
      const sid = storeMap.get(item.productId) || "default";
      const arr = storeGroups.get(sid) || [];
      arr.push(item);
      storeGroups.set(sid, arr);
    });

    const createdOrderIds: string[] = [];

    for (const [storeId, storeItems] of storeGroups) {
      const orderSubtotal = storeItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user!.id,
          store_id: storeId !== "default" ? storeId : null,
          status: "pending",
          payment_method: paymentMethod,
          shipping_first_name: shipping.firstName,
          shipping_last_name: shipping.lastName,
          shipping_email: shipping.email || user?.email || "",
          shipping_phone: shipping.phone,
          shipping_address: shipping.address,
          shipping_city: shipping.city,
          shipping_country: shipping.country,
          shipping_postal_code: shipping.postalCode,
          subtotal: orderSubtotal,
          shipping_cost: shippingCost,
          total: Math.max(0, orderSubtotal - discountAmount + shippingCost),
          order_ref: mockOrderRef,
          coupon_code: appliedCoupon?.code || null,
          discount_amount: discountAmount,
        })
        .select("id")
        .single();

      if (!orderErr && order) {
        createdOrderIds.push(order.id);
        await supabase.from("order_items").insert(
          storeItems.map((item) => ({
            order_id: order.id,
            product_id: item.productId || null,
            product_name: item.nameFr,
            product_image: item.image,
            price: item.price,
            quantity: item.quantity,
            color: item.color || null,
            size: item.size || null,
          }))
        );
      }
    }

    return { orderRef: mockOrderRef, orderIds: createdOrderIds };
  };

  const handlePayment = async () => {
    setProcessing(true);

    if (paymentMethod === "mobile_money") {
      // Validate phone
      const cleanPhone = mobileMoneyPhone.replace(/[\s\-\+]/g, "");
      if (!cleanPhone || cleanPhone.length < 9) {
        toast({ title: "Numéro invalide", description: "Veuillez entrer un numéro Mobile Money valide.", variant: "destructive" });
        setProcessing(false);
        return;
      }

      try {
        // Create order first
        const { orderRef, orderIds } = await createOrderForPayment();
        if (orderIds.length === 0) {
          toast({ title: "Erreur", description: "Impossible de créer la commande.", variant: "destructive" });
          setProcessing(false);
          return;
        }

        // Call KelPay payment edge function
        const { data, error } = await supabase.functions.invoke("kelpay-payment", {
          body: {
            order_id: orderIds[0],
            phone_number: cleanPhone,
            amount: total,
            currency: "USD",
            provider: mobileMoneyProvider,
          },
        });

        if (error || !data?.success) {
          toast({
            title: "Paiement refusé",
            description: data?.error || error?.message || "La requête de paiement a été refusée.",
            variant: "destructive",
          });
          setProcessing(false);
          return;
        }

        // Payment request accepted - wait for PIN validation
        setPaymentTransactionId(data.transaction_id);
        setPaymentReference(data.reference);
        setPaymentPending(true);
        setOrderId(orderRef);
        setProcessing(false);

        // Subscribe to realtime updates on payment_transactions
        const channel = supabase
          .channel(`payment-${data.reference}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "payment_transactions",
              filter: `reference=eq.${data.reference}`,
            },
            (payload: any) => {
              const newStatus = payload.new?.status;
              if (newStatus === "success") {
                setPaymentPending(false);
                clearCart();
                setStep("confirmation");
                toast({ title: t("checkout.orderConfirmed"), description: `N° ${orderRef}` });
                supabase.removeChannel(channel);
              } else if (newStatus === "failed") {
                setPaymentPending(false);
                toast({
                  title: "Paiement échoué",
                  description: "Le paiement n'a pas pu être complété. Veuillez réessayer.",
                  variant: "destructive",
                });
                supabase.removeChannel(channel);
              }
            }
          )
          .subscribe();

        paymentChannelRef.current = channel;

        // Auto-check after 60 seconds if callback hasn't arrived
        setTimeout(async () => {
          if (paymentChannelRef.current) {
            try {
              await supabase.functions.invoke("kelpay-check", {
                body: { transaction_id: data.transaction_id },
              });
            } catch (e) {
              console.error("Auto-check failed:", e);
            }
          }
        }, 60000);

      } catch (err: any) {
        toast({ title: "Erreur", description: err.message || "Erreur inattendue.", variant: "destructive" });
        setProcessing(false);
      }
    } else {
      // COD or Stripe (existing mock flow)
      await new Promise(r => setTimeout(r, 1500));
      const { orderRef } = await createOrderForPayment();
      setOrderId(orderRef);
      await clearCart();
      setStep("confirmation");
      setProcessing(false);
      toast({ title: t("checkout.orderConfirmed"), description: `N° ${orderRef}` });
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!paymentTransactionId) return;
    try {
      const { data } = await supabase.functions.invoke("kelpay-check", {
        body: { transaction_id: paymentTransactionId },
      });
      if (data?.transactionstatus === "SUCCESS") {
        setPaymentPending(false);
        await clearCart();
        setStep("confirmation");
        toast({ title: t("checkout.orderConfirmed"), description: `N° ${orderId}` });
      } else if (data?.transactionstatus === "FAILED") {
        setPaymentPending(false);
        toast({ title: "Paiement échoué", description: "Le paiement n'a pas abouti.", variant: "destructive" });
      } else {
        toast({ title: "En attente", description: "Le paiement est toujours en cours de traitement." });
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de vérifier le statut.", variant: "destructive" });
    }
  };

  const updateField = (field: keyof ShippingInfo, value: string) =>
    setShipping(prev => ({ ...prev, [field]: value }));

  const labelIcons: Record<string, React.ReactNode> = {
    "Domicile": <Home size={14} />,
    "Bureau": <Briefcase size={14} />,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 md:py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">{t("checkout.home")}</Link>
          <ChevronRight size={14} />
          <span className="text-foreground font-medium">{t("checkout.title")}</span>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i <= currentStepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {i < currentStepIndex ? <Check size={14} /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < currentStepIndex ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Main content */}
          <div className="lg:col-span-3 space-y-6">
            {step === "shipping" && (
              <>
                {/* Saved addresses */}
                {savedAddresses.length > 0 && (
                  <div className="bg-card rounded-lg p-5 shadow-card space-y-3">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <MapPin size={16} /> {t("checkout.savedAddresses")}
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {savedAddresses.map(addr => (
                        <button
                          key={addr.id}
                          onClick={() => handleSelectAddress(addr)}
                          className={`relative text-left p-3 rounded-lg border-2 transition-all ${
                            selectedAddressId === addr.id
                              ? "border-primary bg-secondary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            {labelIcons[addr.label] || <MapPin size={14} />}
                            <span className="text-sm font-semibold text-foreground">{addr.label}</span>
                            {addr.is_default && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t("checkout.default")}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{addr.first_name} {addr.last_name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{addr.address}, {addr.city}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteAddress(addr.id); }}
                            className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                          >
                            <X size={14} />
                          </button>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleShippingSubmit} className="bg-card rounded-lg p-6 shadow-card space-y-4">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <MapPin size={18} /> {savedAddresses.length > 0 ? t("checkout.editAddress") : t("checkout.shippingAddress")}
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fn">{t("checkout.firstName")} *</Label>
                      <Input id="fn" value={shipping.firstName} onChange={e => updateField("firstName", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ln">{t("checkout.lastName")} *</Label>
                      <Input id="ln" value={shipping.lastName} onChange={e => updateField("lastName", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">{t("auth.email")}</Label>
                      <Input id="email" type="email" value={shipping.email} onChange={e => updateField("email", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">{t("checkout.phone")} *</Label>
                      <Input id="phone" type="tel" value={shipping.phone} onChange={e => updateField("phone", e.target.value)} placeholder="+221 7X XXX XX XX" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="addr">{t("checkout.address")} *</Label>
                    <Input id="addr" value={shipping.address} onChange={e => updateField("address", e.target.value)} />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">{t("checkout.city")} *</Label>
                      <Input id="city" value={shipping.city} onChange={e => updateField("city", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("checkout.country")} *</Label>
                      <CountryCombobox
                        value={shipping.country}
                        onChange={(v) => updateField("country", v)}
                        label=""
                        placeholder="Sélectionner un pays..."
                        showNone={false}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="zip">{t("checkout.postalCode")}</Label>
                      <Input id="zip" value={shipping.postalCode} onChange={e => updateField("postalCode", e.target.value)} />
                    </div>
                  </div>

                  {/* Save address checkbox */}
                  {!selectedAddressId && (
                    <div className="flex items-center gap-3 pt-2 border-t border-border">
                      <input
                        type="checkbox"
                        id="save-addr"
                        checked={saveAddress}
                        onChange={e => setSaveAddress(e.target.checked)}
                        className="rounded border-border"
                      />
                      <Label htmlFor="save-addr" className="text-sm cursor-pointer">{t("checkout.saveAddress")}</Label>
                      {saveAddress && (
                        <select
                          value={addressLabel}
                          onChange={e => setAddressLabel(e.target.value)}
                          className="text-sm border border-border rounded px-2 py-1 bg-background text-foreground"
                        >
                          <option>Domicile</option>
                          <option>Bureau</option>
                          <option>Autre</option>
                        </select>
                      )}
                    </div>
                  )}

                  <Button type="submit" className="w-full h-12 font-bold mt-2">
                    {t("checkout.continueToPayment")} <ChevronRight size={16} />
                  </Button>
                </form>
              </>
            )}

            {step === "payment" && (
              <div className="bg-card rounded-lg p-6 shadow-card space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <CreditCard size={18} /> {t("checkout.paymentMethod")}
                  </h2>
                  <button onClick={() => setStep("shipping")} className="text-sm text-primary hover:underline flex items-center gap-1">
                    <ArrowLeft size={14} /> {t("vendor.back")}
                  </button>
                </div>

                {/* Shipping summary */}
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium text-foreground flex items-center gap-1.5"><MapPin size={14} /> {t("checkout.shipping")} :</p>
                  <p className="text-muted-foreground">{shipping.firstName} {shipping.lastName}</p>
                  <p className="text-muted-foreground">{shipping.address}, {shipping.city}, {shipping.country}</p>
                  <p className="text-muted-foreground">{shipping.phone}</p>
                </div>

                <div className="space-y-3">
                  {([
                    { id: "stripe" as const, label: t("checkout.creditCard"), sub: "Visa, Mastercard, AMEX", icon: <CreditCard size={20} />, configKey: "stripe" as const },
                    { id: "mobile_money" as const, label: t("checkout.mobileMoney"), sub: "Orange Money, Wave, MTN", icon: <Smartphone size={20} />, configKey: "mobile_money" as const },
                    { id: "cod" as const, label: t("checkout.cashOnDelivery"), sub: "Cash on Delivery", icon: <Banknote size={20} />, configKey: "cod" as const },
                  ]).filter(m => paymentConfig?.[m.configKey] !== false).map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                        paymentMethod === method.id
                          ? "border-primary bg-secondary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${paymentMethod === method.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {method.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.sub}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === method.id ? "border-primary" : "border-border"
                      }`}>
                        {paymentMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                    </button>
                  ))}
                </div>

                {paymentMethod === "stripe" && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><ShieldCheck size={14} /> Paiement sécurisé (mode test)</p>
                    <div className="space-y-1.5">
                      <Label>Numéro de carte</Label>
                      <Input placeholder="4242 4242 4242 4242" disabled className="bg-muted" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Expiration</Label>
                        <Input placeholder="12/28" disabled className="bg-muted" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>CVC</Label>
                        <Input placeholder="123" disabled className="bg-muted" />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === "mobile_money" && !paymentPending && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Vous recevrez une demande de paiement sur votre téléphone. Validez avec votre PIN.
                    </p>
                    <div className="space-y-1.5">
                      <Label>Opérateur</Label>
                      <select
                        value={mobileMoneyProvider}
                        onChange={e => setMobileMoneyProvider(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground"
                      >
                        <option value="orange_money">Orange Money</option>
                        <option value="mpesa">M-Pesa</option>
                        <option value="airtel_money">Airtel Money</option>
                        <option value="afrimoney">AfriMoney</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Numéro Mobile Money</Label>
                      <Input
                        type="tel"
                        placeholder="243 XXX XXX XXX"
                        value={mobileMoneyPhone}
                        onChange={e => setMobileMoneyPhone(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">Format : indicatif pays + numéro (ex: 243812345678)</p>
                    </div>
                  </div>
                )}

                {paymentMethod === "mobile_money" && paymentPending && (
                  <div className="space-y-4 pt-2 border-t border-border text-center">
                    <div className="flex flex-col items-center gap-3 py-4">
                      <Loader2 size={32} className="animate-spin text-primary" />
                      <p className="text-sm font-medium text-foreground">En attente de validation...</p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        Ouvrez l'application {mobileMoneyProvider === "orange_money" ? "Orange Money" : mobileMoneyProvider === "mpesa" ? "M-Pesa" : mobileMoneyProvider === "airtel_money" ? "Airtel Money" : "AfriMoney"} sur votre téléphone et validez le paiement avec votre PIN.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleCheckPaymentStatus}
                      className="w-full"
                    >
                      <ShieldCheck size={14} className="mr-2" />
                      Vérifier le statut du paiement
                    </Button>
                  </div>
                )}

                {paymentMethod === "cod" && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Montant à payer à la livraison : <strong className="text-foreground">${total.toFixed(2)}</strong>
                    </p>
                  </div>
                )}

                {!paymentPending && (
                  <Button onClick={handlePayment} disabled={processing} className="w-full h-12 font-bold">
                    {processing ? (
                      <><Loader2 size={16} className="animate-spin mr-2" /> {t("checkout.processing")}</>
                    ) : (
                      `${t("checkout.placeOrder")} — $${total.toFixed(2)}`
                    )}
                  </Button>
                )}
              </div>
            )}

            {step === "confirmation" && (
              <div className="bg-card rounded-lg p-8 shadow-card text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Check size={32} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">{t("checkout.orderConfirmed")}</h2>
                <p className="text-muted-foreground">
                  {t("checkout.orderRef")} : <span className="font-bold text-foreground">{orderId}</span>
                </p>
                {appliedCoupon && (
                  <p className="text-sm text-primary font-medium">
                    {t("checkout.promoCode")} {appliedCoupon.code} — -${discountAmount.toFixed(2)}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <Link to="/"><Button>{t("checkout.backHome")}</Button></Link>
                  <Link to="/dashboard"><Button variant="outline">{t("checkout.trackOrder")}</Button></Link>
                </div>
              </div>
            )}
          </div>

          {/* Order summary sidebar */}
          {step !== "confirmation" && (
            <div className="lg:col-span-2">
              <div className="bg-card rounded-lg p-5 shadow-card sticky top-24 space-y-4">
                <h3 className="font-bold text-foreground">{t("checkout.orderSummary")} ({items.length})</h3>

                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.id} className="flex gap-3">
                      <img src={item.image} alt={item.nameFr} className="w-14 h-16 object-cover rounded-sm shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-1">{item.nameFr}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.color && <span className="w-3 h-3 rounded-full border border-border inline-block" style={{ backgroundColor: item.color }} />}
                          {item.size && <span>{item.size}</span>}
                          <span>× {item.quantity}</span>
                        </div>
                        <p className="text-sm font-bold text-foreground">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coupon */}
                <div className="border-t border-border pt-3">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-primary/5 p-2 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <Tag size={14} className="text-primary" />
                        <span className="font-medium text-primary">{appliedCoupon.code}</span>
                        <span className="text-muted-foreground">
                          (-{appliedCoupon.discount_type === "percentage" ? `${appliedCoupon.discount_value}%` : `$${appliedCoupon.discount_value}`})
                        </span>
                      </div>
                      <button onClick={() => { setAppliedCoupon(null); setCouponCode(""); }} className="text-muted-foreground hover:text-destructive">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("checkout.promoCode")}
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        className="text-sm h-9"
                        onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading}
                        className="shrink-0 h-9"
                      >
                        {couponLoading ? <Loader2 size={14} className="animate-spin" /> : t("checkout.apply")}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Dynamic Shipping Calculator */}
                <div className="border-t border-border pt-3">
                  <CheckoutShippingCalculator
                    shippingCity={shipping.city}
                    cartItems={items.map(i => ({ productId: i.productId, quantity: i.quantity }))}
                    onShippingCostChange={handleShippingCostChange}
                  />
                </div>

                {/* ZandoPoints */}
                {pointsBalance > 0 && (
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Coins size={14} className="text-primary" />
                        <span className="font-medium text-foreground">ZandoPoints</span>
                        <span className="text-xs text-muted-foreground">({pointsBalance} pts)</span>
                      </div>
                      <button
                        onClick={() => { setUsePoints(!usePoints); if (!usePoints) setPointsToUse(Math.min(pointsBalance, Math.floor(subtotal - discountAmount))); }}
                        className={`text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                          usePoints ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {usePoints ? "Activé" : "Utiliser"}
                      </button>
                    </div>
                    {usePoints && (
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={Math.min(pointsBalance, Math.floor(subtotal - discountAmount + shippingCost))}
                          value={pointsToUse}
                          onChange={e => setPointsToUse(Number(e.target.value))}
                          className="flex-1 accent-primary"
                        />
                        <span className="text-sm font-bold text-primary w-14 text-right">{pointsToUse} pts</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-border pt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                    <span className="text-foreground">${subtotal.toFixed(2)}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>{t("checkout.promoCode")}</span>
                      <span>-${couponDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>{loyaltyBadge} (-{loyaltyPct}%)</span>
                      <span>-${loyaltyDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {pointsDiscount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>ZandoPoints</span>
                      <span>-${pointsDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("cart.shipping")} ({shippingMode})</span>
                    <span className={shippingCost === 0 ? "text-primary font-medium" : "text-foreground"}>
                      {shippingCost === 0 ? t("cart.free") : `$${shippingCost.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground pt-2 border-t border-border text-base">
                    <span>{t("cart.total")}</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck size={14} className="text-primary shrink-0" />
                  <span>Paiement 100% sécurisé · Données chiffrées</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
