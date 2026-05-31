import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PdpThumbImage } from "@/components/product/PdpThumbImage";
import { OptimizedImage } from "@/components/OptimizedImage";
import { PDP_THUMB_FRAME_CLASS, PDP_THUMB_OPTIMIZED } from "@/lib/product-image-fit";
import { PDP_THUMB_WIDTHS } from "@/lib/product-pdp";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrls: string[];
  initialIndex?: number;
  emptyLabel: string;
};

export function VariantImageLightbox({
  open,
  onOpenChange,
  imageUrls,
  initialIndex = 0,
  emptyLabel,
}: Props) {
  const [index, setIndex] = useState(initialIndex);

  if (imageUrls.length === 0) {
    return null;
  }

  const go = (dir: -1 | 1) => {
    setIndex((i) => {
      const next = i + dir;
      if (next < 0) return imageUrls.length - 1;
      if (next >= imageUrls.length) return 0;
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-0 gap-0 overflow-hidden bg-background">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium text-foreground">
            {imageUrls.length > 1 ? `${index + 1} / ${imageUrls.length}` : emptyLabel}
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="relative aspect-square max-h-[70vh] bg-muted flex items-center justify-center">
          <OptimizedImage
            src={imageUrls[index]}
            alt=""
            widths={[...PDP_THUMB_WIDTHS, 600, 900]}
            sizes="95vw"
            className="w-full h-full object-contain object-center"
            {...PDP_THUMB_OPTIMIZED}
          />
          {imageUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/90 flex items-center justify-center"
                aria-label="Précédent"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/90 flex items-center justify-center"
                aria-label="Suivant"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
        {imageUrls.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto">
            {imageUrls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setIndex(i)}
                className={`${PDP_THUMB_FRAME_CLASS} w-14 h-14 shrink-0 rounded-sm ${i === index ? "border-primary" : "border-border/40"}`}
              >
                <PdpThumbImage
                  src={url}
                  alt=""
                  widths={[...PDP_THUMB_WIDTHS]}
                  sizes="56px"
                  fitHeight={56}
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
