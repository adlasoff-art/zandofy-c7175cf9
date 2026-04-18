import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import Barcode from "react-barcode";
import { useI18n } from "@/contexts/I18nContext";

interface LabelData {
  orderRef: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  recipientAddress: string;
  recipientCity: string;
  recipientCountry: string;
  shippingCost: string;
  itemsCount: number;
  deliveryChoice: string;
  storeName: string;
  storeCity: string;
  storeCountry: string;
  originCountry: string;
  carrierLogoUrl: string;
  shippingMode: string;
  totalWeightKg: number;
  totalVolumeCBM: number;
  estimatedDimensions: string;
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
  const { t } = useI18n();

  const fetchLabels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-shipping-labels", {
        body: { orderIds },
      });

      if (error) {
        console.error("[ShippingLabels] network/invoke error:", error);
        toast.error("Erreur réseau. Vérifiez votre connexion.");
        setLoading(false);
        return;
      }

      if (!data?.ok) {
        console.error("[ShippingLabels] server error:", data);
        toast.error(data?.error || "Erreur lors de la génération");
        setLoading(false);
        return;
      }

      if (!Array.isArray(data.labels) || data.labels.length === 0) {
        toast.error("Aucune étiquette générée pour ces commandes");
        setLoading(false);
        return;
      }

      setLabels(data.labels);
      setFetched(true);
    } catch (e) {
      console.error("[ShippingLabels] unexpected:", e);
      toast.error("Erreur inattendue");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && !fetched && !loading) {
      fetchLabels();
    }
    if (!open) {
      setFetched(false);
      setLabels([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const getModeLabel = (choice: string) => {
    if (choice === "home_delivery") return t("label.homeDelivery");
    if (choice === "hub_pickup") return t("label.hubPickup");
    return choice || "—";
  };

  const getShippingModeLabel = (mode: string) => {
    if (mode === "air") return t("label.air");
    if (mode === "sea") return t("label.sea");
    return mode || "";
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked. Allow popups to print.");
      return;
    }

    const qrCanvases = content.querySelectorAll("canvas[data-qr]");
    const qrDataUrls: string[] = [];
    qrCanvases.forEach((canvas) => {
      qrDataUrls.push((canvas as HTMLCanvasElement).toDataURL("image/png"));
    });

    const barcodeSvgs = content.querySelectorAll("[data-barcode] svg");
    const barcodeDataUrls: string[] = [];
    barcodeSvgs.forEach((svg) => {
      const svgData = new XMLSerializer().serializeToString(svg);
      const encoded = btoa(unescape(encodeURIComponent(svgData)));
      barcodeDataUrls.push(`data:image/svg+xml;base64,${encoded}`);
    });

    const carrierLogoUrl = labels[0]?.carrierLogoUrl || "";

    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${t("label.shippingLabels")}</title>
<style>
  @page { size: 100mm 150mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; background: #fff; }
  .label { width: 100mm; height: 150mm; padding: 4mm; border: 2.5px solid #000; page-break-after: always; position: relative; overflow: hidden; }
  .label:last-child { page-break-after: auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6mm; padding-bottom: 2mm; }
  .carrier-logo { max-height: 18mm; max-width: 35mm; object-fit: contain; }
  .carrier-brand { font-size: 16pt; font-weight: 900; letter-spacing: 1px; }
  .carrier-sub { font-size: 6pt; font-weight: 600; color: #333; }
  .qr-top { width: 22mm; height: 22mm; }
  .sep-double { border: none; border-top: 2.5px solid #000; margin: 2mm 0 0.5mm 0; }
  .sep-double-2 { border: none; border-top: 1.5px solid #000; margin: 0 0 2mm 0; }
  .sep { border: none; border-top: 1px solid #000; margin: 2mm 0; }
  .section-lbl { font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #333; margin-bottom: 1mm; }
  .store-name { font-size: 12pt; font-weight: 900; margin: 0.5mm 0; }
  .recipient { font-size: 13pt; font-weight: 900; margin: 1mm 0; }
  .info { font-size: 8.5pt; line-height: 1.5; }
  .detail-grid { display: grid; grid-template-columns: 22mm 1fr; gap: 1mm 2mm; }
  .detail-key { font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #333; }
  .detail-val { font-size: 8.5pt; font-weight: 700; }
  .barcode-area { text-align: center; margin-top: 2mm; }
  .barcode-img { max-width: 70mm; height: auto; }
  .barcode-ref { font-family: 'Courier New', monospace; font-size: 9pt; font-weight: 900; margin-top: 1mm; }
  .scan-hint { font-size: 6pt; color: #555; margin-top: 0.5mm; }
</style></head><body>`);

    labels.forEach((label, i) => {
      const qrUrl = qrDataUrls[i] || "";
      const barcodeUrl = barcodeDataUrls[i] || "";
      const fromLine = [label.storeCity, label.storeCountry].filter(Boolean).join(", ");
      const originLine = label.originCountry ? `${t("label.origin")}: ${label.originCountry}` : "";
      const shippingModeStr = getShippingModeLabel(label.shippingMode);

      printWindow.document.write(`
<div class="label">
  <div class="header">
    <div>
      ${carrierLogoUrl
        ? `<img src="${carrierLogoUrl}" class="carrier-logo" alt="Carrier" crossorigin="anonymous"/>`
        : `<div class="carrier-brand">VERYSPEED</div><div class="carrier-sub">LOGISTICS</div>`
      }
    </div>
    ${qrUrl ? `<img src="${qrUrl}" class="qr-top" alt="QR"/>` : ""}
  </div>
  <hr class="sep-double"/><hr class="sep-double-2"/>
  <div class="section-lbl">${t("label.from")}</div>
  <div class="store-name">${label.storeName}</div>
  <div class="info">${fromLine || "—"}</div>
  ${originLine ? `<div class="info">${originLine}</div>` : ""}
  <hr class="sep"/>
  <div class="section-lbl">${t("label.shipTo")}</div>
  <div class="recipient">${label.recipientName}</div>
  <div class="info">${label.recipientAddress || "—"}</div>
  <div class="info">${[label.recipientCity, label.recipientCountry].filter(Boolean).join(", ")}</div>
  <div class="info">☎ ${label.recipientPhone || "—"}</div>
  ${label.recipientEmail ? `<div class="info">✉ ${label.recipientEmail}</div>` : ""}
  <hr class="sep-double"/><hr class="sep-double-2"/>
  <div class="detail-grid">
    <span class="detail-key">${t("label.order")}</span><span class="detail-val">${label.orderRef}</span>
    <span class="detail-key">${t("label.track")}</span><span class="detail-val">${label.trackingNumber || "—"}</span>
    <span class="detail-key">${t("label.mode")}</span><span class="detail-val">${getModeLabel(label.deliveryChoice)} · ${label.itemsCount} ${t("label.items")}</span>
    <span class="detail-key">${t("label.shipCost")}</span><span class="detail-val">$${label.shippingCost}</span>
    ${shippingModeStr ? `<span class="detail-key">${t("label.shippingMode")}</span><span class="detail-val">${shippingModeStr}</span>` : ""}
    ${label.totalWeightKg > 0 ? `<span class="detail-key">${t("label.weight")}</span><span class="detail-val">${label.totalWeightKg} kg</span>` : ""}
    ${label.estimatedDimensions ? `<span class="detail-key">${t("label.dimensions")}</span><span class="detail-val">${label.estimatedDimensions}</span>` : ""}
    ${label.totalVolumeCBM > 0 ? `<span class="detail-key">${t("label.volumeCbm")}</span><span class="detail-val">${label.totalVolumeCBM} m³</span>` : ""}
  </div>
  <hr class="sep-double"/><hr class="sep-double-2"/>
  <div class="barcode-area">
    ${barcodeUrl ? `<img src="${barcodeUrl}" class="barcode-img" alt="Barcode"/>` : ""}
    <div class="barcode-ref">${label.orderRef}</div>
    <div class="scan-hint">${t("label.scanQr")}</div>
  </div>
</div>`);
    });

    printWindow.document.write("</body></html>");
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer size={18} />
            {t("label.shippingLabels")} ({orderIds.length})
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : labels.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">
            {t("label.noLabels")}
          </p>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <Button onClick={handlePrint} className="gap-2">
                <Printer size={14} /> {t("label.print")} ({labels.length})
              </Button>
            </div>

            <div ref={printRef} className="space-y-4">
              {labels.map((label, i) => {
                const shippingModeStr = getShippingModeLabel(label.shippingMode);
                return (
                <div
                  key={i}
                  className="border-[3px] border-foreground rounded-lg p-4 bg-background"
                  style={{ width: "100%", maxWidth: "380px", margin: "0 auto" }}
                >
                  {/* Header: Logo/Brand + QR */}
                  <div className="flex justify-between items-start mb-6 pb-2">
                    <div>
                      {label.carrierLogoUrl ? (
                        <img
                          src={label.carrierLogoUrl}
                          alt="Carrier"
                          className="max-h-16 max-w-[120px] object-contain"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <>
                          <p className="text-lg font-black tracking-wider leading-none">VERYSPEED</p>
                          <p className="text-[9px] font-semibold text-muted-foreground tracking-widest">LOGISTICS</p>
                        </>
                      )}
                    </div>
                    <QRCodeCanvas
                      data-qr
                      value={`https://zandofy.com/tracking/${label.orderRef}`}
                      size={80}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                      includeMargin={true}
                    />
                  </div>

                  <div className="border-t-[3px] border-foreground mb-0.5" />
                  <div className="border-t-[1.5px] border-foreground mb-2" />

                  {/* FROM */}
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground mb-0.5">{t("label.from")}</p>
                  <p className="text-sm font-black mb-0.5">{label.storeName}</p>
                  <p className="text-xs">{[label.storeCity, label.storeCountry].filter(Boolean).join(", ") || "—"}</p>
                  {label.originCountry && (
                    <p className="text-xs text-muted-foreground">{t("label.origin")}: {label.originCountry}</p>
                  )}

                  <hr className="border-foreground my-2" />

                  {/* SHIP TO */}
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground mb-0.5">{t("label.shipTo")}</p>
                  <p className="text-sm font-black mb-0.5">{label.recipientName}</p>
                  <p className="text-xs">{label.recipientAddress || "—"}</p>
                  <p className="text-xs">{[label.recipientCity, label.recipientCountry].filter(Boolean).join(", ")}</p>
                  <p className="text-xs">☎ {label.recipientPhone || "—"}</p>
                  {label.recipientEmail && (
                    <p className="text-xs">✉ {label.recipientEmail}</p>
                  )}

                  <div className="border-t-[3px] border-foreground mt-2 mb-0.5" />
                  <div className="border-t-[1.5px] border-foreground mb-2" />

                  {/* Details grid */}
                  <div className="grid grid-cols-[80px_1fr] gap-y-0.5 gap-x-2 text-xs mb-2">
                    <span className="font-extrabold text-[10px] text-muted-foreground">{t("label.order")}</span>
                    <span className="font-bold">{label.orderRef}</span>
                    <span className="font-extrabold text-[10px] text-muted-foreground">{t("label.track")}</span>
                    <span className="font-bold">{label.trackingNumber || "—"}</span>
                    <span className="font-extrabold text-[10px] text-muted-foreground">{t("label.mode")}</span>
                    <span>{getModeLabel(label.deliveryChoice)} · {label.itemsCount} {t("label.items")}</span>
                    <span className="font-extrabold text-[10px] text-muted-foreground">{t("label.shipCost")}</span>
                    <span className="font-bold">${label.shippingCost}</span>
                    {shippingModeStr && (
                      <>
                        <span className="font-extrabold text-[10px] text-muted-foreground">{t("label.shippingMode")}</span>
                        <span className="font-bold">{shippingModeStr}</span>
                      </>
                    )}
                    {label.totalWeightKg > 0 && (
                      <>
                        <span className="font-extrabold text-[10px] text-muted-foreground">{t("label.weight")}</span>
                        <span className="font-bold">{label.totalWeightKg} kg</span>
                      </>
                    )}
                    {label.estimatedDimensions && (
                      <>
                        <span className="font-extrabold text-[10px] text-muted-foreground">{t("label.dimensions")}</span>
                        <span className="font-bold">{label.estimatedDimensions}</span>
                      </>
                    )}
                    {label.totalVolumeCBM > 0 && (
                      <>
                        <span className="font-extrabold text-[10px] text-muted-foreground">{t("label.volumeCbm")}</span>
                        <span className="font-bold">{label.totalVolumeCBM} m³</span>
                      </>
                    )}
                  </div>

                  <div className="border-t-[3px] border-foreground mb-0.5" />
                  <div className="border-t-[1.5px] border-foreground mb-2" />

                  {/* Barcode + ref */}
                  <div className="text-center" data-barcode>
                    <Barcode
                      value={label.orderRef || "N/A"}
                      format="CODE128"
                      width={1.5}
                      height={40}
                      displayValue={false}
                      margin={0}
                    />
                    <p className="font-mono text-[10px] font-black mt-1">{label.orderRef}</p>
                    <p className="text-[8px] text-muted-foreground">{t("label.scanQr")}</p>
                  </div>
                </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
