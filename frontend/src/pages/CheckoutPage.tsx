import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { CheckoutShippingCalculator } from "@/components/CheckoutShippingCalculator";
import type { ForwarderChoice } from "@/components/checkout/ForwarderSelector";
import type { ConsolidationChoice } from "@/components/checkout/FreightSelector";
import {
  lockFreightQuote,
  consumeFreightQuote,
  type EligibleFreightOffer,
} from "@/services/freightQuoteCheckout";
import { calculateLastMileFee, type LastMileFeeResult } from "@/lib/last-mile-fee";
import { OperatorSelector } from "@/components/checkout/OperatorSelector";
import { useOperatorQuotes, type OperatorQuote } from "@/hooks/useOperatorQuotes";
import { RequestCoverageButton } from "@/components/checkout/RequestCoverageButton";
import { CountryCombobox, getCountryName } from "@/components/vendor/CountryCombobox";
import { CascadingAddressFields } from "@/components/address/CascadingAddressFields";
import { useI18n } from "@/contexts/I18nContext";
import {
  CreditCard, Smartphone, Truck, ChevronRight, Check, ShieldCheck,
  ArrowLeft, Package, MapPin, Banknote, Tag, Plus, Trash2, Home, Briefcase, X, Loader2, Coins, Upload
} from "lucide-react";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useKycStatus } from "@/hooks/use-kyc";
import { KycBanner } from "@/components/kyc/KycBanner";
import { getColorDisplay } from "@/utils/colorName";
import { useStorePaymentNumbers } from "@/hooks/use-store-payment-numbers";
import { PaymentWaitingPanel } from "@/components/payments/PaymentWaitingPanel";

type Step = "shipping" | "payment" | "confirmation";
type PaymentMethod = "stripe" | "card" | "paypal" | "mobile_money" | "cod" | "off_platform";

interface ShippingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  quartier: string;
  commune: string;
  city: string;
  province: string;
  province_id: string;
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
  quartier: string | null;
  commune: string | null;
  city: string;
  province: string | null;
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

function preciseRound(v: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

type DeliveryOption = "none" | "home_delivery" | "hub_pickup";
type LastMilePayment = "pay_with_shipping" | "pay_cash_on_delivery";

const emptyShipping: ShippingInfo = {
  firstName: "", lastName: "", email: "", phone: "",
  address: "", quartier: "", commune: "", city: "", province: "", province_id: "", country: "CD", postalCode: "",
};

export default function CheckoutPage() {
  const { selectedItems: items, selectedSubtotal: subtotal, removeSelectedItems } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: paymentConfig } = usePaymentMethods();
  const { isVerified: isKycVerified, isOrderBlocked, needsKyc, kycStatus } = useKycStatus();

  // Enable real geo-IP detection only on checkout (perf: avoid blocking home rendering).
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("zandofy_geo_needed", "1");
    }
  }, []);
  

  const [step, setStep] = useState<Step>("shipping");
  const goToStep = (next: Step) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [processing, setProcessing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Deferred shipping payment
  const [shippingPaymentChoice, setShippingPaymentChoice] = useState<"pay_now" | "pay_on_arrival">("pay_now");

  // Delivery option (home vs hub)
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>("none");
  const [lastMilePayment, setLastMilePayment] = useState<LastMilePayment>("pay_with_shipping");
  const [lastMileResult, setLastMileResult] = useState<LastMileFeeResult | null>(null);
  const [lastMileLoading, setLastMileLoading] = useState(false);

  // Lot 11B Phase B4 — Sélection d'opérateur de livraison (entreprise tierce ou plateforme)
  const [selectedOperator, setSelectedOperator] = useState<OperatorQuote | null>(null);

  // Deferred payment retry state
  const [retryPhone, setRetryPhone] = useState("");
  const [retryProvider, setRetryProvider] = useState("orange_money");
  const [showRetryForm, setShowRetryForm] = useState(false);

  // Mobile Money KelPay state
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState("");
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState("orange_money");
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentOrderIds, setPaymentOrderIds] = useState<string[]>([]);
   const [vendorCodAllowed, setVendorCodAllowed] = useState(false);
   const [vendorOffPlatformAllowed, setVendorOffPlatformAllowed] = useState(false);
   const [vendorMobileMoneyAllowed, setVendorMobileMoneyAllowed] = useState(true);
   const [vendorCardAllowed, setVendorCardAllowed] = useState(true);
   const [cartStoreIds, setCartStoreIds] = useState<string[]>([]);
  const paymentChannelRef = useRef<any>(null);
  const { data: paymentNumbers = [] } = useStorePaymentNumbers(cartStoreIds);

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

  // Forwarder selection (Lot 3)
  const [selectedForwarder, setSelectedForwarder] = useState<ForwarderChoice | null>(null);
  const [forwarderUnassigned, setForwarderUnassigned] = useState(false);

  // Lot 11B Phase B8 — Vérifier la couverture opérateur pour activer "Livraison à domicile"
  const { data: operatorQuotesForCoverage, isLoading: operatorCoverageLoading } = useOperatorQuotes({
    city: shipping.city,
    countryCode: shipping.country,
    commune: shipping.commune,
    quartier: shipping.quartier,
    enabled: !!shipping.city && !!shipping.country,
  });
  const hasOperatorCoverage = (operatorQuotesForCoverage?.length ?? 0) > 0;

  // Auto-fallback : si la zone perd sa couverture opérateur et que home_delivery était choisi,
  // basculer en "none" et désélectionner l'opérateur précédent.
  useEffect(() => {
    if (deliveryOption === "home_delivery" && !operatorCoverageLoading && !hasOperatorCoverage) {
      setDeliveryOption("none");
      setSelectedOperator(null);
      toast({
        title: "Livraison à domicile indisponible",
        description: "Aucun livreur partenaire ne dessert votre nouvelle zone. Choisissez le retrait au Hub.",
        variant: "destructive",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOperatorCoverage, operatorCoverageLoading]);

  const handleForwarderChange = useCallback((choice: ForwarderChoice | null, unassigned: boolean) => {
    setSelectedForwarder(choice);
    setForwarderUnassigned(unassigned);
  }, []);

  // Lot 4D — Nouveau moteur freight (offre Lot 3A si profil éligible)
  const [selectedFreightOffer, setSelectedFreightOffer] = useState<EligibleFreightOffer | null>(null);
  const [freightChoice, setFreightChoice] = useState<ConsolidationChoice>("split");
  const [freightOffersAvailable, setFreightOffersAvailable] = useState(0);
  const handleFreightOfferChange = useCallback(
    (offer: EligibleFreightOffer | null, choice?: ConsolidationChoice) => {
      setSelectedFreightOffer(offer);
      setFreightChoice(choice ?? "split");
    },
    [],
  );
  const handleFreightAvailabilityChange = useCallback((count: number) => {
    setFreightOffersAvailable(count);
  }, []);

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
  const [pointsPerDollar, setPointsPerDollar] = useState(50);

  // Discount caps
  const [maxTotalDiscountPct, setMaxTotalDiscountPct] = useState(20);
  const [maxPointsDiscountPct, setMaxPointsDiscountPct] = useState(10);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Country/city eligibility state
  const [countryBlocked, setCountryBlocked] = useState(false);
  const [countryBlockMessage, setCountryBlockMessage] = useState("");

  // Validate country+city against active_countries
  const validateCountryCity = useCallback(async (country: string, city: string) => {
    if (!country) { setCountryBlocked(false); return; }
    const { data } = await supabase.from("platform_settings").select("value").eq("key", "active_countries").maybeSingle();
    if (!data?.value) { setCountryBlocked(false); return; }
    const v = data.value as any;
    const disabled = Array.isArray(v.disabled) ? v.disabled : [];
    const cities = v.cities || {};
    if (disabled.includes(country)) {
      setCountryBlocked(true);
      setCountryBlockMessage("Ce pays n'est pas encore desservi. Nous travaillons à étendre notre couverture.");
      return;
    }
    const allowedCities = cities[country];
    if (allowedCities && Array.isArray(allowedCities) && allowedCities.length > 0 && city) {
      const cityNorm = city.toLowerCase().trim();
      if (!allowedCities.some((c: string) => c.toLowerCase().trim() === cityNorm)) {
        setCountryBlocked(true);
        setCountryBlockMessage(`La ville "${city}" n'est pas encore desservie dans ce pays. Nous travaillons à étendre notre couverture.`);
        return;
      }
    }
    setCountryBlocked(false);
  }, []);

  useEffect(() => {
    validateCountryCity(shipping.country, shipping.city);
  }, [shipping.country, shipping.city, validateCountryCity]);

  const { data: clientDeliverySub } = useQuery({
    queryKey: ["client-delivery-sub-checkout", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await fromTable("store_package_subscriptions")
        .select("*, service_packages(name)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gt("paid_until", new Date().toISOString())
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const hasActiveDeliverySub = !!clientDeliverySub;
  const deliverySubName = (clientDeliverySub as any)?.service_packages?.name || "Livraison";
  const deliverySubExpiry = clientDeliverySub?.paid_until
    ? new Date(clientDeliverySub.paid_until as string).toLocaleDateString("fr-FR")
    : "";

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
    // Fetch points_per_dollar rate
    supabase.from("platform_settings").select("value").eq("key", "referral_settings").maybeSingle().then(({ data }) => {
      if (data?.value) {
        const v = data.value as any;
        setPointsPerDollar(Number(v.points_per_dollar) || 50);
      }
    });
    // Fetch discount caps
    supabase.from("platform_settings").select("value").eq("key", "max_discount_settings").maybeSingle().then(({ data }) => {
      if (data?.value) {
        const v = data.value as any;
        setMaxTotalDiscountPct(Number(v.max_total_discount_pct) || 20);
        setMaxPointsDiscountPct(Number(v.max_points_discount_pct) || 10);
      }
    });
  }, [user]);

  useEffect(() => {
    const loadVendorCodEligibility = async () => {
      const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
      if (productIds.length === 0) {
        setVendorCodAllowed(false);
        return;
      }

      const { data: products } = await supabase.from("products").select("id, store_id").in("id", productIds);
      const storeIds = [...new Set((products || []).map((product: any) => product.store_id).filter(Boolean))];
      setCartStoreIds(storeIds);
      if (storeIds.length === 0) {
        setVendorCodAllowed(false);
        return;
      }

      const { data: overrides } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .select("store_id, vendor_cod_enabled, vendor_off_platform_enabled, vendor_mobile_money_enabled, vendor_card_enabled")
        .in("store_id", storeIds);

      const codMap = new Map((overrides || []).map((override: any) => [override.store_id, !!override.vendor_cod_enabled]));
      setVendorCodAllowed(storeIds.every((storeId) => codMap.get(storeId) === true));

      const offPlatformMap = new Map((overrides || []).map((override: any) => [override.store_id, !!override.vendor_off_platform_enabled]));
      setVendorOffPlatformAllowed(storeIds.every((storeId) => offPlatformMap.get(storeId) === true));

      const mobileMoneyMap = new Map((overrides || []).map((override: any) => [override.store_id, override.vendor_mobile_money_enabled !== false]));
      setVendorMobileMoneyAllowed(storeIds.every((storeId) => mobileMoneyMap.get(storeId) !== false));

      const cardMap = new Map((overrides || []).map((override: any) => [override.store_id, override.vendor_card_enabled !== false]));
      setVendorCardAllowed(storeIds.every((storeId) => cardMap.get(storeId) !== false));
    };

    void loadVendorCodEligibility();
  }, [items]);

  // Cleanup realtime subscription on unmount
  useEffect(() => {
    return () => {
      if (paymentChannelRef.current) {
        supabase.removeChannel(paymentChannelRef.current);
      }
    };
  }, []);

  // Filet de sécurité : abandon propre si l'utilisateur ferme la page pendant
  // un paiement en attente (sendBeacon survit à la fermeture de l'onglet).
  useEffect(() => {
    if (!paymentPending || paymentOrderIds.length === 0) return;
    const beaconAbandon = () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mark-payment-abandoned`;
        const payload = JSON.stringify({
          order_ids: paymentOrderIds,
          reference: paymentReference,
        });
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon?.(url, blob);
      } catch {
        // best-effort
      }
    };
    window.addEventListener("beforeunload", beaconAbandon);
    return () => window.removeEventListener("beforeunload", beaconAbandon);
  }, [paymentPending, paymentOrderIds, paymentReference]);

  const handleShippingCostChange = useCallback((cost: number, mode: string) => {
    setDynamicShippingCost(cost > 0 ? cost : null);
    setShippingMode(mode);
  }, []);

  // Lot Very Speed — Priorité absolue à l'offre transitaire sélectionnée par le client.
  // Tant qu'aucune offre n'est sélectionnée, le shippingCost reste 0 (et le bouton
  // "Payer maintenant" affichera "—" pour forcer le choix). Plus de fallback 5.99.
  const shippingCost = selectedFreightOffer
    ? Number(selectedFreightOffer.quote.total) || 0
    : (dynamicShippingCost !== null
        ? dynamicShippingCost
        : (freeShippingEnabled && subtotal >= freeShippingThreshold ? 0 : 0));

  // Raw discount calculations
  const rawCouponPct = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? appliedCoupon.discount_value
      : subtotal > 0 ? (Math.min(appliedCoupon.discount_value, subtotal) / subtotal) * 100 : 0
    : 0;
  const rawLoyaltyPct = loyaltyPct;
  const rawTotalDiscountPct = rawCouponPct + rawLoyaltyPct;

  // Apply global discount cap (proportional reduction if over cap)
  let effectiveCouponPct = rawCouponPct;
  let effectiveLoyaltyPct = rawLoyaltyPct;
  const discountCapped = rawTotalDiscountPct > maxTotalDiscountPct;
  if (discountCapped && rawTotalDiscountPct > 0) {
    const ratio = maxTotalDiscountPct / rawTotalDiscountPct;
    effectiveCouponPct = rawCouponPct * ratio;
    effectiveLoyaltyPct = rawLoyaltyPct * ratio;
  }

  const couponDiscount = subtotal * effectiveCouponPct / 100;
  const loyaltyDiscount = subtotal * effectiveLoyaltyPct / 100;
  const discountAmount = couponDiscount + loyaltyDiscount;

  // Points discount capped separately
  const maxPointsValue = subtotal * maxPointsDiscountPct / 100;
  const rawPointsDiscount = usePoints ? Math.min(pointsToUse, pointsBalance) / pointsPerDollar : 0;
  const pointsDiscount = Math.min(rawPointsDiscount, maxPointsValue);

  const effectiveShipping = shippingPaymentChoice === "pay_on_arrival" ? 0 : shippingCost;
  
  // Last-mile fee calculation — waived if client has active delivery subscription
  // Si un opérateur tiers est sélectionné, son tarif prime sur le calcul commune/quartier.
  const operatorFee =
    deliveryOption === "home_delivery" && selectedOperator ? selectedOperator.fee : 0;
  const fallbackLastMileFee =
    deliveryOption === "home_delivery" && lastMileResult ? lastMileResult.fee : 0;
  const rawLastMileFee = selectedOperator ? operatorFee : fallbackLastMileFee;
  const lastMileFee = hasActiveDeliverySub ? 0 : rawLastMileFee;
  const effectiveLastMile = deliveryOption === "home_delivery" && lastMilePayment === "pay_with_shipping" ? lastMileFee : 0;
  
  const total = Math.max(0, subtotal - discountAmount - pointsDiscount + effectiveShipping + effectiveLastMile);

  // Recalculate last-mile fee when address or delivery option changes
  useEffect(() => {
    if (deliveryOption !== "home_delivery" || !shipping.commune || !shipping.city) {
      setLastMileResult(null);
      return;
    }
    setLastMileLoading(true);
    calculateLastMileFee(shipping.commune, shipping.quartier, shipping.city, shipping.country)
      .then(result => {
        setLastMileResult(result);
        setLastMileLoading(false);
      })
      .catch(() => setLastMileLoading(false));
  }, [deliveryOption, shipping.commune, shipping.quartier, shipping.city, shipping.country]);

  // Reset operator selection lorsque l'option de livraison ou l'adresse change
  useEffect(() => {
    setSelectedOperator(null);
  }, [deliveryOption, shipping.city, shipping.commune, shipping.quartier, shipping.country]);

  // Load saved addresses
  useEffect(() => {
    if (!user) return;
    supabase.from("saved_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).then(({ data }) => {
      if (data) {
        setSavedAddresses(data as unknown as SavedAddress[]);
        const def = data.find((a: any) => a.is_default);
        if (def) {
          setSelectedAddressId(def.id);
          applyAddress(def as unknown as SavedAddress);
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
      quartier: addr.quartier || "",
      commune: addr.commune || "",
      city: addr.city,
      province: addr.province || "",
      province_id: "",
      country: addr.country,
      postalCode: addr.postal_code || "",
    });
  };

  const handleSelectAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    applyAddress(addr);
  };

  const handleDeleteAddress = async (id: string) => {
    const addr = savedAddresses.find(a => a.id === id);
    if (addr && (addr as any).is_first_address) return;
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

    // 1. Try global coupons first (via RPC sécurisée — la table n'est plus listable)
    type CouponRow = {
      code: string;
      discount_type: string;
      discount_value: number;
      min_order_amount: number | null;
      max_uses: number | null;
      current_uses: number;
      expires_at: string | null;
    };
    const { data: globalRows } = await (supabase.rpc as any)("validate_coupon", { p_code: code });
    const globalData: CouponRow | null =
      Array.isArray(globalRows) && globalRows.length > 0 ? (globalRows[0] as CouponRow) : null;

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

  if (isOrderBlocked) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center space-y-4">
          <Package size={48} className="mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">Vérification requise</h1>
          <p className="text-muted-foreground">Vous avez atteint la limite de commandes sans vérification d'identité. Complétez votre KYC pour continuer.</p>
          <Link to="/dashboard"><Button>Compléter la vérification</Button></Link>
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

    if (countryBlocked) {
      toast({ title: "Zone non desservie", description: countryBlockMessage, variant: "destructive" });
      return;
    }

    // Lot 4G — Si des transitaires sont disponibles, le client doit en choisir un.
    if (freightOffersAvailable > 0 && !selectedFreightOffer) {
      toast({
        title: "Transitaire requis",
        description: "Veuillez sélectionner un transitaire avant de continuer.",
        variant: "destructive",
      });
      return;
    }

    // Lot 11B Phase B8 — Le client doit choisir un mode de livraison
    if (deliveryOption === "none") {
      toast({
        title: "Mode de livraison requis",
        description: "Veuillez choisir entre la livraison à domicile ou le retrait au Hub.",
        variant: "destructive",
      });
      return;
    }

    // Si livraison à domicile : un livreur doit être sélectionné (sauf abonnement actif)
    if (
      deliveryOption === "home_delivery" &&
      !hasActiveDeliverySub &&
      hasOperatorCoverage &&
      !selectedOperator
    ) {
      toast({
        title: "Livreur requis",
        description: "Veuillez sélectionner un livreur pour finaliser votre livraison à domicile.",
        variant: "destructive",
      });
      return;
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
        quartier: shipping.quartier || null,
        commune: shipping.commune || null,
        city: shipping.city,
        province: shipping.province || null,
        country: shipping.country,
        postal_code: shipping.postalCode,
        is_default: savedAddresses.length === 0,
      } as any);
      if (!error) {
        const { data } = await supabase.from("saved_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false });
        if (data) setSavedAddresses(data as unknown as SavedAddress[]);
        setSaveAddress(false);
      }
    }

    goToStep("payment");
  };
  



  const createOrderForPayment = async () => {
    const baseRef = `ZND-${Date.now().toString(36).toUpperCase()}`;

    const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
    const { data: prods } = productIds.length > 0
      ? await supabase.from("products").select("id, store_id, origin_country").in("id", productIds)
      : { data: [] };
    const storeMap = new Map((prods || []).map((p) => [p.id, p.store_id]));
    // Lot 11C — Map productId → pays d'origine (ISO2). Sert à persister
    // orders.origin_country pour la segmentation multi-origines (Phase 2).
    const originMap = new Map(
      (prods || []).map((p: any) => [p.id, (p.origin_country || "").toUpperCase() || null]),
    );

    const storeGroups = new Map<string, typeof items>();
    items.forEach((item) => {
      const sid = storeMap.get(item.productId) || "default";
      const arr = storeGroups.get(sid) || [];
      arr.push(item);
      storeGroups.set(sid, arr);
    });

    const createdOrderIds: string[] = [];
    const storeEntries = [...storeGroups.entries()];
    const needsSuffix = storeEntries.length > 1;

    // Lot 4D — Lock le devis freight (nouveau moteur) AVANT création de l'order.
    // Si pas d'offre éligible (legacy ForwarderSelector utilisé), on saute silencieusement.
    let lockedFreightQuoteId: string | null = null;
    let lockedFreightTotal: number | null = null;
    if (selectedFreightOffer && user) {
      try {
        lockedFreightQuoteId = await lockFreightQuote({
          userId: user.id,
          offer: selectedFreightOffer,
          items: selectedFreightOffer.quote.lines.map((l: any) => ({
            quantity: l.quantity ?? 1,
          })),
          consolidationChoice: freightChoice,
        });
        // Lot 11A — Source unique de vérité : si le devis est verrouillé,
        // re-lire son quoted_price persisté pour aligner orders.shipping_cost.
        // Évite la désynchro UI ($15.50) vs DB ($0.00) observée sur ZND-MOFRHBGT.
        if (lockedFreightQuoteId) {
          const { data: lockedQ } = await (supabase as any)
            .from("freight_quotes")
            .select("quoted_price")
            .eq("id", lockedFreightQuoteId)
            .maybeSingle();
          const persisted = Number((lockedQ as any)?.quoted_price);
          if (Number.isFinite(persisted) && persisted > 0) {
            lockedFreightTotal = persisted;
          }
        }
      } catch (err) {
        console.warn("[CheckoutPage] lockFreightQuote failed (non-blocking)", err);
      }
    }

    for (let idx = 0; idx < storeEntries.length; idx++) {
      const [storeId, storeItems] = storeEntries[idx];
      const orderSubtotal = storeItems.reduce((s, i) => s + i.price * i.quantity, 0);
      // Lot 11C — Origine effective de la sous-commande : si tous les produits
      // partagent la même origine, on la persiste ; sinon NULL (multi-origines).
      const orderOrigins = [
        ...new Set(
          storeItems
            .map((i: any) => originMap.get(i.productId))
            .filter((c: any): c is string => !!c),
        ),
      ];
      const orderOriginCountry = orderOrigins.length === 1 ? orderOrigins[0] : null;
      
      // Proportional shipping & discount distribution
      const ratio = subtotal > 0 ? orderSubtotal / subtotal : 0;
      // Lot 11A — Préférer le total persisté du devis verrouillé (source unique
      // de vérité côté DB). Fallback sur shippingCost local si pas de devis.
      const baseShippingCost = lockedFreightTotal ?? shippingCost;
      const orderShippingCost = preciseRound(baseShippingCost * ratio, 2);
      const orderDiscount = preciseRound(discountAmount * ratio, 2);
      const orderPointsDiscount = preciseRound(pointsDiscount * ratio, 2);
      
      // Off-platform: ONLY product amount is charged. Shipping & delivery are always deferred.
      const isOffPlatform = paymentMethod === "off_platform";
      const effectiveShip = (shippingPaymentChoice === "pay_on_arrival" || isOffPlatform) ? 0 : orderShippingCost;
      const orderTotal = Math.max(0, preciseRound(orderSubtotal - orderDiscount - orderPointsDiscount + effectiveShip, 2));
      
      // Unique order_ref per sub-order (suffix A, B, C...)
      const orderRef = needsSuffix ? `${baseRef}-${String.fromCharCode(65 + idx)}` : baseRef;

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user!.id,
          store_id: storeId !== "default" ? storeId : null,
          origin_country: orderOriginCountry,
          status: (paymentMethod === "mobile_money" || paymentMethod === "off_platform") ? "awaiting_payment" : "pending",
          payment_method: paymentMethod,
          shipping_first_name: shipping.firstName,
          shipping_last_name: shipping.lastName,
          shipping_email: shipping.email || user?.email || "",
          shipping_phone: shipping.phone,
           shipping_address: shipping.address,
           shipping_quartier: shipping.quartier || null,
           shipping_commune: shipping.commune || null,
           shipping_city: shipping.city,
           shipping_province: shipping.province || null,
           shipping_country: shipping.country,
           shipping_postal_code: shipping.postalCode,
          subtotal: orderSubtotal,
          shipping_cost: orderShippingCost,
          total: orderTotal,
          order_ref: orderRef,
          coupon_code: appliedCoupon?.code || null,
          discount_amount: orderDiscount,
          // Off-platform: force all logistics payments to deferred.
          // "Paid" est attribué SEULEMENT après confirmation du paiement (webhook KelPay / retour Keccel).
          // En attendant : "unpaid" pour les paiements asynchrones, "paid" pour COD/cash où la commande
          // n'attend pas de webhook (la livraison est facturée à l'arrivée).
          shipping_payment_status:
            (shippingPaymentChoice === "pay_on_arrival" || isOffPlatform)
              ? "deferred"
              : (paymentMethod === "mobile_money" || paymentMethod === "card" || paymentMethod === "paypal" || paymentMethod === "stripe")
                ? "unpaid"
                : "paid",
          delivery_choice: deliveryOption !== "none" ? deliveryOption : null,
          last_mile_fee: deliveryOption === "home_delivery" ? lastMileFee : 0,
          // Lot 11B Phase B4 — opérateur de livraison sélectionné (NULL = flotte plateforme par défaut)
          delivery_operator_id:
            deliveryOption === "home_delivery" && selectedOperator
              ? selectedOperator.operator_id
              : null,
          // Lot 11B Phase B7 — workflow d'acceptation opérateur (30 min pour répondre)
          operator_acceptance_status:
            deliveryOption === "home_delivery" && selectedOperator
              ? "pending"
              : "not_applicable",
          operator_assigned_at:
            deliveryOption === "home_delivery" && selectedOperator
              ? new Date().toISOString()
              : null,
          operator_response_deadline:
            deliveryOption === "home_delivery" && selectedOperator
              ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
              : null,
          last_mile_payment_method: deliveryOption === "home_delivery" && lastMileFee > 0 ? (isOffPlatform ? null : (lastMilePayment === "pay_with_shipping" ? paymentMethod : "cod")) : null,
          last_mile_payment_status:
            deliveryOption === "home_delivery" && lastMileFee > 0
              ? (isOffPlatform
                  ? "deferred"
                  : (lastMilePayment === "pay_with_shipping"
                      ? ((paymentMethod === "mobile_money" || paymentMethod === "card" || paymentMethod === "paypal" || paymentMethod === "stripe")
                          ? "unpaid"
                          : "paid")
                      : "deferred"))
              : null,
          // Lot 3 — Forwarder assignment (silent fallback when no eligible forwarder)
          forwarder_id: selectedForwarder?.forwarder_id ?? null,
          forwarder_tier: selectedForwarder?.tier ?? null,
          forwarder_quoted_price: selectedForwarder ? preciseRound(selectedForwarder.quoted_price * ratio, 2) : null,
          forwarder_unassigned: !selectedForwarder && forwarderUnassigned,
          // Lot 4D — Devis freight verrouillé (nouveau moteur Lot 3A)
          freight_quote_id: lockedFreightQuoteId,
        } as any)
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

        // Lot 11B Phase B4 — Notification opérateur (non-bloquant)
        if (selectedOperator?.operator_id) {
          try {
            await supabase.functions.invoke("notify-operator-new-order", {
              body: { order_id: order.id },
            });
          } catch (e) {
            console.warn("[notify-operator-new-order] non-blocking error:", e);
          }
        }

        // Lot 3 — Create shipment_assignments row when a forwarder was selected
        if (selectedForwarder?.forwarder_id) {
          // shipment_assignments: mode NOT NULL, status IN ('assigned', ...).
          // Forwarders only handle air/sea; coerce other modes to 'air' as a safe default.
          const assignmentMode =
            shippingMode === "sea" || shippingMode === "air" ? shippingMode : "air";
          await (supabase as any).from("shipment_assignments").insert({
            order_id: order.id,
            forwarder_id: selectedForwarder.forwarder_id,
            tier: selectedForwarder.tier,
            mode: assignmentMode,
            quoted_price: preciseRound(selectedForwarder.quoted_price * ratio, 2),
            status: "assigned",
          });
        }

        // Lot 4D — Marquer le devis freight comme consumé et le lier à l'order
        // (sur la 1re sous-order uniquement : un devis = une expédition logique)
        if (lockedFreightQuoteId && idx === 0) {
          try {
            await consumeFreightQuote(lockedFreightQuoteId, order.id);
            // Lot 4I — Notifier le transitaire par email (non-bloquant).
            // Le handoff + notif in-app sont déjà créés par le trigger DB
            // (trg_create_forwarder_handoff sur freight_quotes.status='consumed').
            try {
              await supabase.functions.invoke("notify-forwarder-handoff", {
                body: { orderId: order.id },
              });
            } catch (notifErr) {
              console.warn("[CheckoutPage] notify-forwarder-handoff failed (non-blocking)", notifErr);
            }
          } catch (err) {
            console.warn("[CheckoutPage] consumeFreightQuote failed (non-blocking)", err);
          }
        }
      }
    }

    // Deduct ZandoPoints if used
    if (pointsDiscount > 0 && pointsToUse > 0) {
      await (supabase.rpc as any)("deduct_points", { p_user_id: user!.id, p_amount: pointsToUse });
    }

    // Increment coupon uses
    if (appliedCoupon) {
      const couponTable = appliedCoupon.source === "store" ? "store_coupons" : "coupons";
      // Find coupon ID by code
      const { data: couponRow } = await (supabase as any)
        .from(couponTable)
        .select("id")
        .eq("code", appliedCoupon.code)
        .maybeSingle();
      if (couponRow?.id) {
        await (supabase.rpc as any)("increment_coupon_uses", { p_coupon_id: couponRow.id, p_table: couponTable });
      }
    }

    return { orderRef: baseRef, orderIds: createdOrderIds };
  };

  const handlePayment = async () => {
    setProcessing(true);

    if (paymentMethod === "mobile_money") {
      let createdOrderIds: string[] = [];
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
        createdOrderIds = orderIds;
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
        setPaymentOrderIds(orderIds);
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
            async (payload: any) => {
              const newStatus = payload.new?.status;
              if (newStatus === "success") {
                await supabase.from("orders").update({ status: "pending" } as any).in("id", orderIds).eq("status", "awaiting_payment");
                // Logistique payée avec la commande : marquer "paid" maintenant
                await (supabase as any).from("orders")
                  .update({ shipping_payment_status: "paid" } as any)
                  .in("id", orderIds)
                  .eq("shipping_payment_status", "unpaid");
                await (supabase as any).from("orders")
                  .update({ last_mile_payment_status: "paid" } as any)
                  .in("id", orderIds)
                  .eq("last_mile_payment_status", "unpaid");
                setPaymentPending(false);
                removeSelectedItems();
                goToStep("confirmation");
                toast({ title: t("checkout.orderConfirmed"), description: `N° ${orderRef}` });
                supabase.removeChannel(channel);
              } else if (newStatus === "failed") {
                await supabase.from("orders").update({ status: "payment_failed" } as any).in("id", orderIds);
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

        // Auto-timeout after 3 minutes
        const paymentTimeoutId = setTimeout(async () => {
          if (!paymentChannelRef.current) return;
          try {
            const { data: checkData } = await supabase.functions.invoke("kelpay-check", {
              body: { transaction_id: data.transaction_id, reference: data.reference },
            });
            if (checkData?.status === "success") {
              await supabase.from("orders").update({ status: "pending" } as any).in("id", orderIds).eq("status", "awaiting_payment");
              await (supabase as any).from("orders").update({ shipping_payment_status: "paid" }).in("id", orderIds).eq("shipping_payment_status", "unpaid");
              await (supabase as any).from("orders").update({ last_mile_payment_status: "paid" }).in("id", orderIds).eq("last_mile_payment_status", "unpaid");
              setPaymentPending(false);
              await removeSelectedItems();
              goToStep("confirmation");
              toast({ title: t("checkout.orderConfirmed"), description: `N° ${orderRef}` });
            } else {
              // Timeout reached — mark as failed
              await supabase.from("orders").update({ status: "payment_failed" } as any).in("id", orderIds).eq("status", "awaiting_payment");
              setPaymentPending(false);
              toast({ title: "Délai expiré", description: "Le paiement n'a pas été confirmé dans les 3 minutes. Veuillez réessayer.", variant: "destructive" });
            }
          } catch {
            setPaymentPending(false);
            toast({ title: "Délai expiré", description: "Impossible de vérifier le paiement. Veuillez réessayer.", variant: "destructive" });
          }
          if (paymentChannelRef.current) { supabase.removeChannel(paymentChannelRef.current); paymentChannelRef.current = null; }
        }, 180000); // 3 minutes

        // Store timeout for cleanup
        (paymentChannelRef as any)._timeoutId = paymentTimeoutId;

      } catch (err: any) {
        toast({ title: "Erreur", description: err.message || "Erreur inattendue.", variant: "destructive" });
        if (createdOrderIds.length > 0) {
          await supabase.from("orders").update({ status: "payment_failed" } as any).in("id", createdOrderIds);
        }
        setProcessing(false);
      }
    } else if (paymentMethod === "card" || paymentMethod === "paypal" || paymentMethod === "stripe") {
      // Card/PayPal via Keccel — redirect flow
      try {
        setProcessing(true);
        const { orderRef, orderIds } = await createOrderForPayment();
        if (orderIds.length === 0) throw new Error("Impossible de créer la commande");
        const { data, error } = await supabase.functions.invoke("keccel-cardpay", {
          body: {
            order_id: orderIds[0],
            payment_method: paymentMethod === "stripe" ? "card" : paymentMethod,
            payment_type: "order",
          },
        });
        if (error) {
          console.error("keccel-cardpay SDK error:", error);
          throw new Error(error.message || "Erreur lors de l'initiation du paiement");
        }
        if (!data) throw new Error("Pas de réponse de la passerelle de paiement");
        if (data.success === false) {
          console.error("keccel-cardpay API error:", data);
          throw new Error(data.error || "Erreur de la passerelle de paiement");
        }
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
          return;
        } else if (data.fallback_terminal_url) {
          window.location.href = data.fallback_terminal_url;
          return;
        } else {
          // No redirect URL — show confirmation page
          setOrderId(orderRef);
          await removeSelectedItems();
          goToStep("confirmation");
          setProcessing(false);
        }
      } catch (err: any) {
        // Mark any created orders as payment_failed so they don't appear as active
        try {
          const { data: pendingOrders } = await supabase
            .from("orders")
            .select("id")
            .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
            .eq("status", "awaiting_payment")
            .order("created_at", { ascending: false })
            .limit(1);
          if (pendingOrders && pendingOrders.length > 0) {
            await supabase
              .from("orders")
              .update({ status: "payment_failed" })
              .eq("id", pendingOrders[0].id)
              .eq("status", "awaiting_payment");
          }
        } catch (cleanupErr) {
          console.error("Failed to clean up order:", cleanupErr);
        }
        toast({ title: "Erreur paiement", description: err.message || "Impossible d'initier le paiement par carte.", variant: "destructive" });
        setProcessing(false);
      }
    } else {
      // COD, off_platform
      await new Promise(r => setTimeout(r, 1500));
      const { orderRef } = await createOrderForPayment();
      setOrderId(orderRef);
      await removeSelectedItems();
      goToStep("confirmation");
      setProcessing(false);
      if (paymentMethod === "off_platform") {
        toast({ title: "Commande enregistrée", description: `N° ${orderRef} — Uploadez votre preuve de paiement depuis votre espace client.` });
      } else {
        toast({ title: t("checkout.orderConfirmed"), description: `N° ${orderRef}` });
      }
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!paymentTransactionId && !paymentReference) return;
    try {
      const { data } = await supabase.functions.invoke("kelpay-check", {
        body: { transaction_id: paymentTransactionId, reference: paymentReference },
      });
      if (data?.status === "success") {
        if (paymentChannelRef.current) { supabase.removeChannel(paymentChannelRef.current); paymentChannelRef.current = null; }
        if (paymentOrderIds.length > 0) {
          await supabase.from("orders").update({ status: "pending" } as any).in("id", paymentOrderIds).eq("status", "awaiting_payment");
          await (supabase as any).from("orders").update({ shipping_payment_status: "paid" }).in("id", paymentOrderIds).eq("shipping_payment_status", "unpaid");
          await (supabase as any).from("orders").update({ last_mile_payment_status: "paid" }).in("id", paymentOrderIds).eq("last_mile_payment_status", "unpaid");
        }
        setPaymentPending(false);
        await removeSelectedItems();
        goToStep("confirmation");
        toast({ title: t("checkout.orderConfirmed"), description: `N° ${orderId}` });
      } else if (data?.status === "failed") {
        if (paymentChannelRef.current) { supabase.removeChannel(paymentChannelRef.current); paymentChannelRef.current = null; }
        if (paymentOrderIds.length > 0) {
          await supabase.from("orders").update({ status: "payment_failed" } as any).in("id", paymentOrderIds);
        }
        setPaymentPending(false);
        toast({ title: "Paiement échoué", description: "Le paiement n'a pas abouti.", variant: "destructive" });
      } else {
        toast({ title: "En attente", description: "Le paiement est toujours en cours de traitement." });
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de vérifier le statut.", variant: "destructive" });
    }
  };

  const handleCancelPaymentWait = async () => {
    if (paymentChannelRef.current) { supabase.removeChannel(paymentChannelRef.current); paymentChannelRef.current = null; }
    if (paymentOrderIds.length > 0) {
      await supabase.from("orders").update({ status: "payment_failed" } as any).in("id", paymentOrderIds).eq("status", "awaiting_payment");
    }
    setPaymentPending(false);
    setPaymentTransactionId(null);
    setPaymentReference(null);
    toast({ title: "Paiement annulé", description: "Vous pouvez réessayer avec un autre moyen de paiement.", variant: "destructive" });
  };

  /**
   * Auto-abandon : compte à rebours expiré + 60s sans action OU fermeture de page.
   * Vérifie une dernière fois auprès de KelPay puis bascule en payment_failed.
   */
  const handleAutoAbandonPayment = async () => {
    if (paymentOrderIds.length === 0) return;
    try {
      await supabase.functions.invoke("mark-payment-abandoned", {
        body: { order_ids: paymentOrderIds, reference: paymentReference },
      });
    } catch (e) {
      console.warn("auto-abandon failed:", e);
    }
    if (paymentChannelRef.current) { supabase.removeChannel(paymentChannelRef.current); paymentChannelRef.current = null; }
    setPaymentPending(false);
    setPaymentTransactionId(null);
    setPaymentReference(null);
    toast({
      title: "Paiement non confirmé",
      description: "Le paiement n'a pas été validé à temps. Vous pouvez relancer depuis votre tableau de bord.",
      variant: "destructive",
    });
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
                          <p className="text-xs text-muted-foreground">{addr.phone}</p>
                          {!(addr as any).is_first_address && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteAddress(addr.id); }}
                              className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </button>
                      ))}
                    </div>
                    {/* When an address is selected, show summary + option to edit */}
                    {selectedAddressId && (
                      <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Check size={14} className="text-primary" /> Adresse sélectionnée</p>
                          <button type="button" onClick={() => { setSelectedAddressId(null); setShipping({ ...emptyShipping, email: user?.email || "" }); }} className="text-xs text-primary hover:underline">Modifier manuellement</button>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>{shipping.firstName} {shipping.lastName} · {shipping.phone}</p>
                          <p>{shipping.address}{shipping.quartier ? `, Q. ${shipping.quartier}` : ""}{shipping.commune ? `, C. ${shipping.commune}` : ""}</p>
                          <p>{shipping.city}{shipping.province ? `, ${shipping.province}` : ""}, {getCountryName(shipping.country)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleShippingSubmit} className="bg-card rounded-lg p-6 shadow-card space-y-4">
                  {/* If saved address selected, hide the form fields */}
                  {!selectedAddressId ? (
                    <>
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
                          <Input id="phone" type="tel" value={shipping.phone} onChange={e => updateField("phone", e.target.value)} placeholder="+243 XXX XXX XXX" />
                        </div>
                      </div>
                      <CascadingAddressFields
                        data={{
                          country: shipping.country,
                          province: shipping.province,
                          province_id: shipping.province_id,
                          city: shipping.city,
                          commune: shipping.commune,
                          quartier: shipping.quartier,
                          address: shipping.address,
                          postal_code: shipping.postalCode,
                        }}
                        onChange={(field, value) => {
                          if (field === "postal_code") {
                            updateField("postalCode", value);
                          } else {
                            updateField(field as keyof ShippingInfo, value);
                          }
                        }}
                      />

                      {/* Country/city blocked warning */}
                      {countryBlocked && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                          <p className="font-medium">⚠️ Zone non desservie</p>
                          <p className="text-xs mt-1">{countryBlockMessage}</p>
                        </div>
                      )}

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
                          <Input
                            value={addressLabel}
                            onChange={e => setAddressLabel(e.target.value)}
                            className="w-32 h-8 text-sm"
                            placeholder="Ex: Domicile 1, Bureau..."
                          />
                        )}
                      </div>
                    </>
                  ) : null}

                  {/* Deferred shipping payment option */}
                  {shippingCost > 0 && (() => {
                    // Lot Very Speed — Si un transitaire est requis (offres dispos) mais aucun
                    // n'est sélectionné, ne pas afficher de montant fantôme : afficher "—".
                    const awaitingForwarderChoice =
                      freightOffersAvailable > 0 && !selectedFreightOffer;
                    const amountLabel = awaitingForwarderChoice
                      ? "—"
                      : `$${shippingCost.toFixed(2)}`;
                    return (
                    <div className="pt-3 border-t border-border space-y-2">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Truck size={14} className="text-primary" /> Paiement des frais d'expédition
                      </p>
                      {awaitingForwarderChoice && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          Sélectionnez un transitaire ci-dessus pour voir le montant exact.
                        </p>
                      )}
                      <div className="space-y-2">
                        {[
                          { key: "pay_now" as const, label: "Payer maintenant", desc: `Inclure ${amountLabel} dans le total` },
                          { key: "pay_on_arrival" as const, label: "Payer à l'arrivée au Hub", desc: `Régler ${amountLabel} quand le colis arrive au hub (avant livraison)` },
                        ].map(opt => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setShippingPaymentChoice(opt.key)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                              shippingPaymentChoice === opt.key
                                ? "border-primary bg-secondary"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              shippingPaymentChoice === opt.key ? "border-primary" : "border-border"
                            }`}>
                              {shippingPaymentChoice === opt.key && <div className="w-2 h-2 rounded-full bg-primary" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{opt.label}</p>
                              <p className="text-xs text-muted-foreground">{opt.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    );
                  })()}

                  {/* Delivery option: home vs hub */}
                   <div className="pt-3 border-t border-border space-y-2">
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Home size={14} className="text-primary" /> Option de livraison
                    </p>
                    <div className="space-y-2">
                      {[
                        {
                          key: "home_delivery" as DeliveryOption,
                          label: "🚚 Livraison à domicile",
                          desc: operatorCoverageLoading || lastMileLoading
                            ? "Recherche des livreurs..."
                            : !hasOperatorCoverage
                              ? "Aucun livreur ne dessert encore votre quartier"
                              : lastMileResult && lastMileResult.fee > 0
                                ? `Frais estimés : $${lastMileResult.fee.toFixed(2)}`
                                : "Recevez votre colis directement chez vous",
                          disabled: (lastMileResult ? !lastMileResult.deliverable : false) || (!operatorCoverageLoading && !hasOperatorCoverage),
                        },
                        { key: "hub_pickup" as DeliveryOption, label: "🏪 Retrait au Hub", desc: "Récupérez votre colis au point de collecte (gratuit)", disabled: false },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => !opt.disabled && setDeliveryOption(opt.key)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                            opt.disabled
                              ? "border-border bg-muted/40 opacity-60 cursor-not-allowed"
                              : deliveryOption === opt.key
                                ? "border-primary bg-secondary"
                                : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            deliveryOption === opt.key ? "border-primary" : "border-border"
                          }`}>
                            {deliveryOption === opt.key && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Zone not deliverable warning */}
                    {lastMileResult && !lastMileResult.deliverable && deliveryOption === "home_delivery" && (
                      <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded">
                        ⚠️ Livraison non disponible dans votre zone{lastMileResult.restrictionReason ? ` : ${lastMileResult.restrictionReason}` : ""}. Veuillez choisir le retrait au Hub.
                      </p>
                    )}

                    {/* No operator coverage — proposer demande couverture + hub */}
                    {!operatorCoverageLoading && !hasOperatorCoverage && shipping.city && shipping.country && (
                      <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-foreground">
                          Aucun livreur ne dessert encore {shipping.quartier ? `${shipping.quartier}, ` : ""}
                          {shipping.commune ? `${shipping.commune}, ` : ""}{shipping.city}.
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Vous pouvez choisir le retrait au Hub ou nous demander d'étendre la couverture.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="default" onClick={() => setDeliveryOption("hub_pickup")}>
                            🏪 Choisir le retrait au Hub
                          </Button>
                          <RequestCoverageButton
                            countryCode={shipping.country}
                            city={shipping.city}
                            commune={shipping.commune}
                            quartier={shipping.quartier}
                          />
                        </div>
                      </div>
                    )}

                    {/* Active delivery subscription banner */}
                    {deliveryOption === "home_delivery" && hasActiveDeliverySub && lastMileResult?.deliverable && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                        <p className="text-xs font-medium text-primary">
                          ✅ Votre forfait <strong>{deliverySubName}</strong> est actif jusqu'au {deliverySubExpiry}. Livraison à domicile sans frais supplémentaires.
                        </p>
                      </div>
                    )}

                    {/* Lot 11B Phase B4 — Sélection d'un opérateur de livraison tiers */}
                    {deliveryOption === "home_delivery" && !hasActiveDeliverySub && (
                      <OperatorSelector
                        city={shipping.city}
                        countryCode={shipping.country}
                        commune={shipping.commune}
                        quartier={shipping.quartier}
                        selectedOperatorId={selectedOperator?.operator_id ?? null}
                        onSelect={setSelectedOperator}
                      />
                    )}

                    {/* Last-mile payment choice */}
                    {deliveryOption === "home_delivery" && lastMileResult?.deliverable && lastMileFee > 0 && !hasActiveDeliverySub && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2 mt-2">
                        <p className="text-xs font-medium text-foreground">Paiement de la livraison locale : ${lastMileFee.toFixed(2)}</p>
                        <div className="space-y-1.5">
                          {[
                            { key: "pay_with_shipping" as LastMilePayment, label: "Inclure dans le total", desc: `Ajouter $${lastMileFee.toFixed(2)} au paiement` },
                            { key: "pay_cash_on_delivery" as LastMilePayment, label: "Payer à la réception", desc: "Régler au livreur à la livraison" },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setLastMilePayment(opt.key)}
                              className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                                lastMilePayment === opt.key
                                  ? "border-primary bg-secondary"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                lastMilePayment === opt.key ? "border-primary" : "border-border"
                              }`}>
                                {lastMilePayment === opt.key && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-foreground">{opt.label}</p>
                                <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

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
                  <button onClick={() => goToStep("shipping")} className="text-sm text-primary hover:underline flex items-center gap-1">
                    <ArrowLeft size={14} /> {t("vendor.back")}
                  </button>
                </div>

                {/* Shipping summary */}
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium text-foreground flex items-center gap-1.5"><MapPin size={14} /> {t("checkout.shipping")} :</p>
                  <p className="text-muted-foreground">{shipping.firstName} {shipping.lastName}</p>
                  <p className="text-muted-foreground">{shipping.address}{shipping.quartier ? `, ${shipping.quartier}` : ""}{shipping.commune ? `, ${shipping.commune}` : ""}, {shipping.city}, {shipping.country}</p>
                  <p className="text-muted-foreground">{shipping.phone}</p>
                </div>

                <div className="space-y-3">
                  {([
                    { id: "card" as const, label: "Carte bancaire (Visa/Mastercard)", sub: "Paiement sécurisé via Keccel", icon: <CreditCard size={20} />, configKey: "stripe" as const },
                    { id: "paypal" as const, label: "PayPal", sub: "Paiement via votre compte PayPal", icon: <CreditCard size={20} />, configKey: "paypal" as const },
                    { id: "mobile_money" as const, label: t("checkout.mobileMoney"), sub: "Orange Money, M-Pesa, Airtel Money, AfriMoney", icon: <Smartphone size={20} />, configKey: "mobile_money" as const },
                    { id: "cod" as const, label: t("checkout.cashOnDelivery"), sub: isKycVerified ? "Cash on Delivery" : "KYC requis", icon: <Banknote size={20} />, configKey: "cod" as const },
                    { id: "off_platform" as const, label: "Paiement hors plateforme", sub: "Transfert direct, puis envoyez la preuve", icon: <Banknote size={20} />, configKey: "off_platform" as const },
                  ]).filter(m => (m.id === "card" ? paymentConfig?.stripe !== false : m.id === "paypal" ? (paymentConfig as any)?.paypal !== false : m.id === "off_platform" ? (paymentConfig as any)?.off_platform !== false : paymentConfig?.[m.configKey] !== false)).filter(m => m.id !== "cod" || (isKycVerified && vendorCodAllowed)).filter(m => m.id !== "off_platform" || vendorOffPlatformAllowed).filter(m => m.id !== "mobile_money" || vendorMobileMoneyAllowed).filter(m => m.id !== "card" || vendorCardAllowed).map(method => (
                    <button
                      key={method.id}
                      disabled={method.id === "card" && paymentConfig?.stripe === false}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                        method.id === "card" && paymentConfig?.stripe === false
                          ? "border-border bg-muted/40 opacity-60 cursor-not-allowed"
                          :
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
                          <p className="text-xs text-muted-foreground">{method.id === "card" && paymentConfig?.stripe === false ? (paymentConfig?.stripe_notice_text || "Pour l'instant, ce moyen de paiement n'est pas actif.") : method.sub}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === method.id ? "border-primary" : "border-border"
                      }`}>
                        {paymentMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                    </button>
                  ))}
                </div>

                {(paymentMethod === "card" || paymentMethod === "stripe") && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><ShieldCheck size={14} /> Paiement sécurisé via Keccel / Mastercard</p>
                    <p className="text-xs text-muted-foreground">Vous serez redirigé vers la page de paiement sécurisé Visa/Mastercard pour finaliser votre transaction.</p>
                  </div>
                )}

                {paymentMethod === "paypal" && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><ShieldCheck size={14} /> Paiement sécurisé via PayPal</p>
                    <p className="text-xs text-muted-foreground">Vous serez redirigé vers PayPal pour finaliser votre paiement en toute sécurité.</p>
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
                  <div className="space-y-4 pt-2 border-t border-border">
                    <PaymentWaitingPanel
                      durationSeconds={180}
                      providerLabel={
                        mobileMoneyProvider === "orange_money" ? "Orange Money" :
                        mobileMoneyProvider === "mpesa" ? "M-Pesa" :
                        mobileMoneyProvider === "airtel_money" ? "Airtel Money" : "AfriMoney"
                      }
                      reference={paymentReference}
                      checking={processing}
                      onCheck={handleCheckPaymentStatus}
                      onCancel={handleCancelPaymentWait}
                      onAutoAbandon={handleAutoAbandonPayment}
                    />

                    {/* Retry with different number */}
                    {!showRetryForm ? (
                      <button
                        onClick={() => { setShowRetryForm(true); setRetryPhone(""); }}
                        className="w-full text-xs text-primary hover:underline py-1"
                      >
                        Le paiement ne fonctionne pas ? Essayer avec un autre numéro
                      </button>
                    ) : (
                      <div className="space-y-3 bg-muted/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-foreground">Réessayer avec un autre numéro</p>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Opérateur</Label>
                          <select
                            value={retryProvider}
                            onChange={e => setRetryProvider(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground"
                          >
                            <option value="orange_money">Orange Money</option>
                            <option value="mpesa">M-Pesa</option>
                            <option value="airtel_money">Airtel Money</option>
                            <option value="afrimoney">AfriMoney</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nouveau numéro</Label>
                          <Input
                            type="tel"
                            placeholder="243 XXX XXX XXX"
                            value={retryPhone}
                            onChange={e => setRetryPhone(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowRetryForm(false)} className="flex-1 text-xs">
                            Annuler
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 text-xs"
                            disabled={!retryPhone.replace(/[\s\-\+]/g, "") || retryPhone.replace(/[\s\-\+]/g, "").length < 9 || processing}
                            onClick={async () => {
                              setProcessing(true);
                              // Remove old channel
                              if (paymentChannelRef.current) {
                                supabase.removeChannel(paymentChannelRef.current);
                                paymentChannelRef.current = null;
                              }
                              try {
                                const cleanPhone = retryPhone.replace(/[\s\-\+]/g, "");
                                 const { data, error } = await supabase.functions.invoke("kelpay-payment", {
                                  body: {
                                     order_id: paymentOrderIds[0],
                                    phone_number: cleanPhone,
                                    amount: total,
                                    currency: "USD",
                                    provider: retryProvider,
                                  },
                                });
                                if (error || !data?.success) {
                                  toast({ title: "Paiement refusé", description: data?.error || error?.message || "Réessayez.", variant: "destructive" });
                                } else {
                                  setPaymentTransactionId(data.transaction_id);
                                  setPaymentReference(data.reference);
                                  setMobileMoneyPhone(cleanPhone);
                                  setMobileMoneyProvider(retryProvider);
                                  setShowRetryForm(false);
                                  toast({ title: "Nouvelle demande envoyée", description: "Validez sur votre téléphone." });
                                  // Re-subscribe
                                  const channel = supabase
                                    .channel(`payment-retry-${data.reference}`)
                                    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payment_transactions", filter: `reference=eq.${data.reference}` },
                                      (payload: any) => {
                                        const ns = payload.new?.status;
                                        if (ns === "success") {
                                          supabase.from("orders").update({ status: "pending" } as any).in("id", paymentOrderIds).eq("status", "awaiting_payment");
                                          (supabase as any).from("orders").update({ shipping_payment_status: "paid" }).in("id", paymentOrderIds).eq("shipping_payment_status", "unpaid");
                                          (supabase as any).from("orders").update({ last_mile_payment_status: "paid" }).in("id", paymentOrderIds).eq("last_mile_payment_status", "unpaid");
                                          setPaymentPending(false); removeSelectedItems(); goToStep("confirmation"); toast({ title: t("checkout.orderConfirmed") }); supabase.removeChannel(channel);
                                        }
                                        else if (ns === "failed") { supabase.from("orders").update({ status: "payment_failed" } as any).in("id", paymentOrderIds); setPaymentPending(false); toast({ title: "Paiement échoué", variant: "destructive" }); supabase.removeChannel(channel); }
                                      }
                                    ).subscribe();
                                  paymentChannelRef.current = channel;
                                }
                              } catch (err: any) {
                                toast({ title: "Erreur", description: err.message, variant: "destructive" });
                              }
                              setProcessing(false);
                            }}
                          >
                            {processing ? <Loader2 size={12} className="animate-spin mr-1" /> : <Smartphone size={12} className="mr-1" />}
                            Réessayer
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === "cod" && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Montant à payer à la livraison : <strong className="text-foreground">${total.toFixed(2)}</strong>
                    </p>
                  </div>
                )}

                {paymentMethod === "off_platform" && (
                  <div className="pt-2 border-t border-border space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Montant à payer : <strong className="text-foreground">${total.toFixed(2)}</strong>
                    </p>

                    {/* Payment numbers */}
                    {paymentNumbers.length > 0 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-foreground">📱 Numéros de paiement du vendeur :</p>
                        <div className="grid gap-2">
                          {paymentNumbers.map((pn) => (
                            <div key={pn.operator} className="flex items-center gap-3 bg-card border border-border rounded-md px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground">{pn.operator_label}</p>
                                <p className="text-sm font-semibold text-primary tracking-wide">{pn.phone_number}</p>
                                {pn.display_name && (
                                  <p className="text-[11px] text-muted-foreground">Nom affiché : <span className="font-medium text-foreground">{pn.display_name}</span></p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                      <p className="font-semibold">📋 Comment ça marche :</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Effectuez le paiement directement au vendeur (Mobile Money, virement ou paiement en espèces, etc.)</li>
                        <li>Après la commande, uploadez la preuve de paiement depuis votre espace client. Pour un paiement Mobile Money, assurez-vous que le <strong>numéro de transaction</strong>, le <strong>nom du destinataire</strong>, le <strong>numéro de téléphone utilisé</strong> et la <strong>date</strong> soient clairement visibles sur la capture.</li>
                        <li>Le vendeur valide la preuve et votre commande est confirmée pour la suite du processus.</li>
                      </ol>
                    </div>
                  </div>
                )}

                {!paymentPending && (
                  <div className="space-y-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={e => setTermsAccepted(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-primary rounded"
                      />
                      <span className="text-xs text-muted-foreground leading-tight">
                        J'accepte les{" "}
                        <Link to="/terms" target="_blank" className="text-primary underline hover:text-primary/80">
                          Conditions Générales de Vente
                        </Link>{" "}
                        et la{" "}
                        <Link to="/privacy" target="_blank" className="text-primary underline hover:text-primary/80">
                          Politique de confidentialité
                        </Link>.
                      </span>
                    </label>
                    <Button onClick={handlePayment} disabled={processing || !termsAccepted} className="w-full h-12 font-bold">
                      {processing ? (
                        <><Loader2 size={16} className="animate-spin mr-2" /> {t("checkout.processing")}</>
                      ) : (
                        `${t("checkout.placeOrder")} — $${total.toFixed(2)}`
                      )}
                    </Button>
                    {!termsAccepted && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        Veuillez accepter les conditions pour continuer.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === "confirmation" && (
              <div className="bg-card rounded-lg p-8 shadow-card text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Check size={32} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {paymentMethod === "off_platform" ? "Commande enregistrée" : t("checkout.orderConfirmed")}
                </h2>
                <p className="text-muted-foreground">
                  {t("checkout.orderRef")} : <span className="font-bold text-foreground">{orderId}</span>
                </p>
                {paymentMethod === "off_platform" && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 text-left space-y-2">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">⏳ Paiement en attente</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Votre commande est enregistrée mais en attente de preuve de paiement. 
                      Rendez-vous dans votre espace client pour uploader la preuve de paiement du produit.
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>Note :</strong> Les frais d'expédition et de livraison seront à régler séparément depuis votre espace commande.
                    </p>
                  </div>
                )}
                {appliedCoupon && (
                  <p className="text-sm text-primary font-medium">
                    {t("checkout.promoCode")} {appliedCoupon.code} — -${discountAmount.toFixed(2)}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  {paymentMethod === "off_platform" ? (
                    <Link to="/dashboard"><Button className="gap-2"><Upload size={14} /> Terminer ma commande</Button></Link>
                  ) : (
                    <Link to="/"><Button>{t("checkout.backHome")}</Button></Link>
                  )}
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
                          {item.color && (() => {
                            const cd = getColorDisplay(item.color);
                            return cd ? (
                              <span className="inline-flex items-center gap-1">
                                {cd.hex && <span className="w-3 h-3 rounded-full border border-border inline-block" style={{ backgroundColor: cd.hex }} />}
                                <span>{cd.name}</span>
                              </span>
                            ) : null;
                          })()}
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
                    cartSubtotal={subtotal}
                    onShippingCostChange={handleShippingCostChange}
                    onForwarderChange={handleForwarderChange}
                    onFreightOfferChange={handleFreightOfferChange}
                    onFreightAvailabilityChange={handleFreightAvailabilityChange}
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
                        <span className="text-sm font-bold text-primary w-24 text-right">{pointsToUse} pts (${(pointsToUse / pointsPerDollar).toFixed(2)})</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Discount cap notice */}
                {discountCapped && (
                  <div className="border-t border-border pt-3">
                    <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 rounded">
                      ⚠️ Le cumul des réductions a été plafonné à {maxTotalDiscountPct}% du sous-total.
                    </p>
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
                    <span className="text-muted-foreground">Expédition ({shippingMode})</span>
                    {shippingPaymentChoice === "pay_on_arrival" && shippingCost > 0 ? (
                      <span className="text-amber-600 font-medium text-xs">
                        ${shippingCost.toFixed(2)} — à l'arrivée
                      </span>
                    ) : (
                      <span className={shippingCost === 0 ? "text-primary font-medium" : "text-foreground"}>
                        {shippingCost === 0 ? t("cart.free") : `$${shippingCost.toFixed(2)}`}
                      </span>
                    )}
                  </div>
                  {deliveryOption === "home_delivery" && hasActiveDeliverySub && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Livraison locale</span>
                      <span className="text-primary font-medium text-xs">Incluse (forfait {deliverySubName})</span>
                    </div>
                  )}
                  {deliveryOption === "home_delivery" && lastMileFee > 0 && !hasActiveDeliverySub && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Livraison locale</span>
                      {lastMilePayment === "pay_cash_on_delivery" ? (
                        <span className="text-amber-600 font-medium text-xs">${lastMileFee.toFixed(2)} — à la réception</span>
                      ) : (
                        <span className="text-foreground">${lastMileFee.toFixed(2)}</span>
                      )}
                    </div>
                  )}
                  {deliveryOption === "hub_pickup" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Livraison</span>
                      <span className="text-primary font-medium">Retrait Hub (gratuit)</span>
                    </div>
                  )}
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
