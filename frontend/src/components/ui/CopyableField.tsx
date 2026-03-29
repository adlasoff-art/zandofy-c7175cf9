import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

interface CopyableFieldProps {
  value: string;
  label?: string;
  className?: string;
}

export function CopyableField({ value, label, className = "" }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {label && <span className="text-muted-foreground">{label}</span>}
      <span className="font-mono font-bold text-foreground">{value}</span>
      <button
        onClick={handleCopy}
        className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
        title="Copier"
        type="button"
      >
        {copied ? (
          <Check size={12} className="text-primary" />
        ) : (
          <Copy size={12} className="text-muted-foreground hover:text-foreground" />
        )}
      </button>
    </span>
  );
}
