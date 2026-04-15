import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";

interface LabelData {
  orderRef: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity: string;
  recipientCountry: string;
  shippingCost: string;
  itemsCount: number;
  deliveryChoice: string;
  storeName: string;
  storeCity: string;
  storeCountry: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  orderIds: string[];
}

export function ShippingLabelPreview({ open, onClose, orderIds }: Props) {
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchLabels = async () => {
    if (fetched && labels.length > 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-shipping-labels", {
        body: { orderIds },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Error generating labels");
        setLoading(false);
        return;
      }
      setLabels(data.labels);
      setFetched(true);
    } catch {
      toast.error("Network error");
    }
    setLoading(false);
  };

  if (open && !fetched && !loading) {
    fetchLabels();
  }

  const getModeLabel = (choice: string) => {
    if (choice === "home_delivery") return "Home Delivery";
    if (choice === "hub_pickup") return "Hub Pickup";
    return choice || "—";
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked. Allow popups to print.");
      return;
    }

    const qrCanvases = content.querySelectorAll("canvas");
    const qrDataUrls: string[] = [];
    qrCanvases.forEach((canvas) => {
      qrDataUrls.push(canvas.toDataURL("image/png"));
    });

    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Shipping Labels</title>
<style>
  @page { size: 100mm 150mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; background: #fff; }
  .label { width: 100mm; height: 150mm; padding: 4mm; border: 2.5px solid #000; page-break-after: always; position: relative; overflow: hidden; }
  .label:last-child { page-break-after: auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5mm; padding-bottom: 1mm; }
  .carrier-brand { font-size: 16pt; font-weight: 900; letter-spacing: 1px; }
  .carrier-sub { font-size: 6pt; font-weight: 600; color: #333; }
  .qr-top { width: 22mm; height: 22mm; }
  .sep-double { border: none; border-top: 2.5px solid #000; margin: 2mm 0 1mm 0; }
  .sep-double + .sep-double-2 { border: none; border-top: 1.5px solid #000; margin: 0 0 2mm 0; }
  .sep { border: none; border-top: 1px solid #000; margin: 2mm 0; }
  .section-lbl { font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #333; margin-bottom: 1mm; }
  .recipient { font-size: 13pt; font-weight: 900; margin: 1mm 0; }
  .info { font-size: 8.5pt; line-height: 1.5; }
  .detail-grid { display: grid; grid-template-columns: 22mm 1fr; gap: 1mm 2mm; }
  .detail-key { font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #333; }
  .detail-val { font-size: 8.5pt; font-weight: 700; }
  .barcode-area { text-align: center; margin-top: 2mm; }
  .barcode-ref { font-family: 'Courier New', monospace; font-size: 9pt; font-weight: 900; margin-top: 1mm; }
  .scan-hint { font-size: 6pt; color: #555; margin-top: 0.5mm; }
</style></head><body>`);

    labels.forEach((label, i) => {
      const qrUrl = qrDataUrls[i] || "";
      printWindow.document.write(`
<div class="label">
  <div class="header">
    <div>
      <div class="carrier-brand">VERYSPEED</div>
      <div class="carrier-sub">LOGISTICS</div>
    </div>
    ${qrUrl ? `<img src="${qrUrl}" class="qr-top" alt="QR"/>` : ""}
  </div>
  <hr class="sep-double"/><hr class="sep-double-2"/>
  <div class="section-lbl">FROM:</div>
  <div class="info">${label.storeName}</div>
  <div class="info">${[label.storeCity, label.storeCountry].filter(Boolean).join(", ") || "—"}</div>
  <hr class="sep"/>
  <div class="section-lbl">SHIP TO:</div>
  <div class="recipient">${label.recipientName}</div>
  <div class="info">${label.recipientAddress || "—"}</div>
  <div class="info">${[label.recipientCity, label.recipientCountry].filter(Boolean).join(", ")}</div>
  <div class="info">☎ ${label.recipientPhone || "—"}</div>
  <hr class="sep-double"/><hr class="sep-double-2"/>
  <div class="detail-grid">
    <span class="detail-key">ORDER:</span><span class="detail-val">${label.orderRef}</span>
    ${label.trackingNumber ? `<span class="detail-key">TRACK:</span><span class="detail-val">${label.trackingNumber}</span>` : ""}
    <span class="detail-key">MODE:</span><span class="detail-val">${getModeLabel(label.deliveryChoice)} · ${label.itemsCount} item(s)</span>
    <span class="detail-key">SHIP:</span><span class="detail-val">$${label.shippingCost}</span>
    <span class="detail-key">CARRIER:</span><span class="detail-val">VerySpeed Logistics</span>
  </div>
  <hr class="sep-double"/><hr class="sep-double-2"/>
  <div class="barcode-area">
    <div class="barcode-ref">${label.orderRef}</div>
    <div class="scan-hint">Scan QR to track your parcel</div>
  </div>
</div>`);
    });

    printWindow.document.write("</body></html>");
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const getModeText = (choice: string) => getModeLabel(choice);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer size={18} />
            Shipping Labels ({orderIds.length})
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : labels.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">
            No labels to display.
          </p>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <Button onClick={handlePrint} className="gap-2">
                <Printer size={14} /> Print ({labels.length} label{labels.length > 1 ? "s" : ""})
              </Button>
            </div>

            <div ref={printRef} className="space-y-4">
              {labels.map((label, i) => (
                <div
                  key={i}
                  className="border-[3px] border-foreground rounded-lg p-4 bg-background"
                  style={{ width: "100%", maxWidth: "380px", margin: "0 auto" }}
                >
                  {/* Header: Brand + QR */}
                  <div className="flex justify-between items-start mb-5 pb-1">
                    <div>
                      <p className="text-lg font-black tracking-wider leading-none">VERYSPEED</p>
                      <p className="text-[9px] font-semibold text-muted-foreground tracking-widest">LOGISTICS</p>
                    </div>
                    <QRCodeCanvas
                      value={`https://zandofy.com/tracking/${label.orderRef}`}
                      size={80}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                      includeMargin={true}
                    />
                  </div>

                  {/* Double separator */}
                  <div className="border-t-[3px] border-foreground mb-0.5" />
                  <div className="border-t-[1.5px] border-foreground mb-2" />

                  {/* FROM */}
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground mb-0.5">FROM:</p>
                  <p className="text-xs font-medium">{label.storeName}</p>
                  <p className="text-xs mb-2">{[label.storeCity, label.storeCountry].filter(Boolean).join(", ")}</p>

                  <hr className="border-foreground mb-2" />

                  {/* SHIP TO */}
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground mb-0.5">SHIP TO:</p>
                  <p className="text-sm font-black mb-0.5">{label.recipientName}</p>
                  <p className="text-xs">{label.recipientAddress || "—"}</p>
                  <p className="text-xs">{[label.recipientCity, label.recipientCountry].filter(Boolean).join(", ")}</p>
                  <p className="text-xs mb-2">☎ {label.recipientPhone || "—"}</p>

                  {/* Double separator */}
                  <div className="border-t-[3px] border-foreground mb-0.5" />
                  <div className="border-t-[1.5px] border-foreground mb-2" />

                  {/* Details grid */}
                  <div className="grid grid-cols-[80px_1fr] gap-y-0.5 gap-x-2 text-xs mb-2">
                    <span className="font-extrabold text-[10px] text-muted-foreground">ORDER:</span>
                    <span className="font-bold">{label.orderRef}</span>
                    {label.trackingNumber && (
                      <>
                        <span className="font-extrabold text-[10px] text-muted-foreground">TRACK:</span>
                        <span className="font-bold">{label.trackingNumber}</span>
                      </>
                    )}
                    <span className="font-extrabold text-[10px] text-muted-foreground">MODE:</span>
                    <span>{getModeText(label.deliveryChoice)} · {label.itemsCount} item(s)</span>
                    <span className="font-extrabold text-[10px] text-muted-foreground">SHIP:</span>
                    <span className="font-bold">${label.shippingCost}</span>
                    <span className="font-extrabold text-[10px] text-muted-foreground">CARRIER:</span>
                    <span className="font-semibold">VerySpeed Logistics</span>
                  </div>

                  {/* Double separator */}
                  <div className="border-t-[3px] border-foreground mb-0.5" />
                  <div className="border-t-[1.5px] border-foreground mb-2" />

                  {/* Bottom ref */}
                  <div className="text-center">
                    <p className="font-mono text-[10px] font-black">{label.orderRef}</p>
                    <p className="text-[8px] text-muted-foreground">Scan QR to track your parcel</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
