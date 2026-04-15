import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, X } from "lucide-react";
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
        toast.error(data?.error || "Erreur lors de la génération des étiquettes");
        setLoading(false);
        return;
      }
      setLabels(data.labels);
      setFetched(true);
    } catch {
      toast.error("Erreur réseau");
    }
    setLoading(false);
  };

  const handleOpen = () => {
    if (open && !fetched) fetchLabels();
  };

  // Trigger fetch when dialog opens
  if (open && !fetched && !loading) {
    fetchLabels();
  }

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup bloquée. Autorisez les popups pour imprimer.");
      return;
    }

    // Collect QR code data URLs
    const qrCanvases = content.querySelectorAll("canvas");
    const qrDataUrls: string[] = [];
    qrCanvases.forEach((canvas) => {
      qrDataUrls.push(canvas.toDataURL("image/png"));
    });

    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Étiquettes d'expédition</title>
<style>
  @page { size: 100mm 150mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; }
  .label { width: 100mm; height: 150mm; padding: 4mm; border: 1px solid #000; page-break-after: always; position: relative; overflow: hidden; }
  .label:last-child { page-break-after: auto; }
  .logo-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2mm; height: 14mm; }
  .logo-text { font-size: 18pt; font-weight: 900; letter-spacing: 2px; }
  .vs-text { font-size: 8pt; font-weight: 700; text-align: right; }
  .powered { text-align: center; font-size: 6pt; margin-bottom: 2mm; }
  hr { border: none; border-top: 1.5px solid #000; margin: 2mm 0; }
  .section-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1mm; }
  .recipient-name { font-size: 12pt; font-weight: 900; margin-bottom: 1mm; }
  .detail { font-size: 8pt; line-height: 1.4; }
  .detail-row { display: flex; gap: 2mm; margin-bottom: 0.5mm; }
  .detail-label { font-weight: 700; min-width: 20mm; font-size: 7pt; }
  .detail-value { font-weight: 900; font-size: 8pt; }
  .qr-section { text-align: center; margin-top: 2mm; }
  .qr-section img { width: 26mm; height: 26mm; }
  .qr-ref { font-size: 7pt; font-weight: 900; margin-top: 1mm; }
  .scan-hint { font-size: 5pt; color: #333; }
</style></head><body>`);

    labels.forEach((label, i) => {
      const qrUrl = qrDataUrls[i] || "";
      const mode = label.deliveryChoice === "home_delivery" ? "Domicile" : label.deliveryChoice === "hub_pickup" ? "Retrait Hub" : label.deliveryChoice || "—";
      printWindow.document.write(`
<div class="label">
  <div class="logo-row">
    <div class="logo-text">ZANDOFY</div>
    <div class="vs-text">VerySpeed<br/>Logistics</div>
  </div>
  <div class="powered">Powered by VerySpeed</div>
  <hr/>
  <div class="section-label">DE (FROM):</div>
  <div class="detail">${label.storeName}</div>
  <div class="detail">${[label.storeCity, label.storeCountry].filter(Boolean).join(", ") || "—"}</div>
  <hr/>
  <div class="section-label">À (SHIP TO):</div>
  <div class="recipient-name">${label.recipientName}</div>
  <div class="detail">${label.recipientAddress || "—"}</div>
  <div class="detail">${[label.recipientCity, label.recipientCountry].filter(Boolean).join(", ")}</div>
  <div class="detail">☎ ${label.recipientPhone || "—"}</div>
  <hr/>
  <div class="detail-row"><span class="detail-label">REF:</span><span class="detail-value">${label.orderRef}</span></div>
  ${label.trackingNumber ? `<div class="detail-row"><span class="detail-label">SUIVI:</span><span class="detail-value">${label.trackingNumber}</span></div>` : ""}
  <div class="detail-row"><span class="detail-label">MODE:</span><span class="detail-value">${mode} · ${label.itemsCount} article(s)</span></div>
  <div class="detail-row"><span class="detail-label">EXPÉDITION:</span><span class="detail-value">$${label.shippingCost}</span></div>
  <hr/>
  <div class="qr-section">
    ${qrUrl ? `<img src="${qrUrl}" alt="QR"/>` : ""}
    <div class="qr-ref">${label.orderRef}</div>
    <div class="scan-hint">Scannez pour suivre votre colis</div>
  </div>
</div>`);
    });

    printWindow.document.write("</body></html>");
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer size={18} />
            Étiquettes d'expédition ({orderIds.length})
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : labels.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">
            Aucune étiquette à afficher.
          </p>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <Button onClick={handlePrint} className="gap-2">
                <Printer size={14} /> Imprimer ({labels.length} étiquette{labels.length > 1 ? "s" : ""})
              </Button>
            </div>

            <div ref={printRef} className="space-y-4">
              {labels.map((label, i) => (
                <div
                  key={i}
                  className="border-2 border-foreground rounded-lg p-4 bg-background"
                  style={{ width: "100%", maxWidth: "380px", margin: "0 auto", fontFamily: "'Courier New', monospace" }}
                >
                  {/* Header */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xl font-black tracking-wider">ZANDOFY</span>
                    <span className="text-[10px] font-bold text-right leading-tight">
                      VerySpeed<br />Logistics
                    </span>
                  </div>
                  <p className="text-center text-[9px] text-muted-foreground mb-2">Powered by VerySpeed</p>
                  <hr className="border-foreground mb-2" />

                  {/* From */}
                  <p className="text-[9px] font-bold uppercase tracking-wide mb-0.5">DE (FROM):</p>
                  <p className="text-xs">{label.storeName}</p>
                  <p className="text-xs mb-2">{[label.storeCity, label.storeCountry].filter(Boolean).join(", ")}</p>
                  <hr className="border-foreground mb-2" />

                  {/* To */}
                  <p className="text-[9px] font-bold uppercase tracking-wide mb-0.5">À (SHIP TO):</p>
                  <p className="text-sm font-black mb-0.5">{label.recipientName}</p>
                  <p className="text-xs">{label.recipientAddress || "—"}</p>
                  <p className="text-xs">{[label.recipientCity, label.recipientCountry].filter(Boolean).join(", ")}</p>
                  <p className="text-xs mb-2">☎ {label.recipientPhone || "—"}</p>
                  <hr className="border-foreground mb-2" />

                  {/* Details */}
                  <div className="space-y-0.5 text-xs mb-2">
                    <div className="flex gap-2">
                      <span className="font-bold w-20 shrink-0">REF:</span>
                      <span className="font-black">{label.orderRef}</span>
                    </div>
                    {label.trackingNumber && (
                      <div className="flex gap-2">
                        <span className="font-bold w-20 shrink-0">SUIVI:</span>
                        <span className="font-black">{label.trackingNumber}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="font-bold w-20 shrink-0">ARTICLES:</span>
                      <span>{label.itemsCount}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold w-20 shrink-0">EXPÉDITION:</span>
                      <span className="font-black">${label.shippingCost}</span>
                    </div>
                  </div>
                  <hr className="border-foreground mb-2" />

                  {/* QR Code */}
                  <div className="flex flex-col items-center">
                    <QRCodeCanvas
                      value={`https://zandofy.com/tracking/${label.orderRef}`}
                      size={100}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                      includeMargin={false}
                    />
                    <p className="text-[10px] font-black mt-1">{label.orderRef}</p>
                    <p className="text-[8px] text-muted-foreground">Scannez pour suivre votre colis</p>
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
