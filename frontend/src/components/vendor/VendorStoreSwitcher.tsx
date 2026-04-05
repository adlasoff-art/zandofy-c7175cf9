import { Store, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StoreOption {
  id: string;
  name: string;
  logo_url: string | null;
}

interface VendorStoreSwitcherProps {
  stores: StoreOption[];
  activeStoreId: string;
  onSwitch: (storeId: string) => void;
}

export function VendorStoreSwitcher({ stores, activeStoreId, onSwitch }: VendorStoreSwitcherProps) {
  if (stores.length <= 1) return null;

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-2">
      <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">
        Boutique active
      </label>
      <Select value={activeStoreId} onValueChange={onSwitch}>
        <SelectTrigger className="h-8 text-xs bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {stores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <div className="flex items-center gap-2">
                {s.logo_url ? (
                  <img src={s.logo_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <Store size={12} className="text-muted-foreground" />
                )}
                <span className="truncate">{s.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
