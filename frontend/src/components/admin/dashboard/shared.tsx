export const PIE_COLORS = [
  "hsl(var(--primary))", "hsl(210, 70%, 50%)", "hsl(40, 80%, 50%)",
  "hsl(280, 60%, 50%)", "hsl(0, 70%, 55%)", "hsl(160, 60%, 40%)",
  "hsl(330, 60%, 50%)", "hsl(30, 80%, 50%)",
];

export const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export const statusColor: Record<string, string> = {
  delivered: "bg-primary/10 text-primary",
  in_transit: "bg-blue-100 text-blue-700",
  shipped: "bg-blue-100 text-blue-700",
  processing: "bg-amber-100 text-amber-700",
  pending: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-yellow-100 text-yellow-700",
  in_shipping: "bg-indigo-100 text-indigo-700",
  returned: "bg-rose-100 text-rose-700",
};

export const statusLabels: Record<string, string> = {
  pending: "En attente", processing: "En préparation", shipped: "Arrivée au hub",
  in_transit: "En transit", delivered: "Livrée", cancelled: "Annulée",
  confirmed: "Confirmée", preparing: "En préparation", in_shipping: "En expédition",
  assigning_rider: "Assignation livreur", rider_assigned: "Livreur assigné",
  out_for_delivery: "En livraison", returned: "Retournée",
};

export function KpiCard({ icon: Icon, label, value, color = "text-primary", sub }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={18} className={color} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function KpiCardRow({ icon: Icon, label, value, color = "text-primary" }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Icon size={20} className={color} />
      </div>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
