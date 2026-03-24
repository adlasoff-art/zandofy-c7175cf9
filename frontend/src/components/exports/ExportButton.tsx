import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface ExportButtonProps {
  /** Array of objects to export */
  data: Record<string, any>[];
  /** Column definitions: key = object key, label = CSV header */
  columns: { key: string; label: string }[];
  /** Filename prefix */
  filename: string;
  /** Optional label for the button */
  label?: string;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
}

export function ExportButton({
  data,
  columns,
  filename,
  label = "CSV",
  variant = "outline",
  size = "sm",
}: ExportButtonProps) {
  const handleExport = () => {
    if (data.length === 0) return;

    const header = columns.map(c => `"${c.label}"`).join(",");
    const rows = data.map(row =>
      columns.map(c => {
        const val = row[c.key];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(",")
    );

    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant={variant} size={size} onClick={handleExport} disabled={data.length === 0}>
      <Download size={14} className="mr-1" /> {label}
    </Button>
  );
}
