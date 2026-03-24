import { useCompare } from "@/contexts/CompareContext";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export function CompareBar() {
  const { items, removeFromCompare, clearCompare } = useCompare();
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-xl rounded-lg px-4 py-3 flex items-center gap-3"
      >
        <div className="flex items-center gap-2">
          {items.map((item) => (
            <div key={item.id} className="relative w-12 h-12 rounded-sm overflow-hidden border border-border">
              <img src={item.image} alt={item.nameFr} className="w-full h-full object-cover" />
              <button
                onClick={() => removeFromCompare(item.id)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          {Array.from({ length: 4 - items.length }).map((_, i) => (
            <div key={`empty-${i}`} className="w-12 h-12 rounded-sm border-2 border-dashed border-border" />
          ))}
        </div>

        <span className="text-xs text-muted-foreground whitespace-nowrap">{items.length}/4</span>

        <Button
          size="sm"
          disabled={items.length < 2}
          onClick={() => navigate("/compare")}
          className="whitespace-nowrap"
        >
          Comparer <ArrowRight size={14} className="ml-1" />
        </Button>

        <button onClick={clearCompare} className="text-xs text-muted-foreground hover:text-foreground">
          Vider
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
