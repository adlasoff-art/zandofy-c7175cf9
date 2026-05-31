import { useState } from "react";
import { Ruler } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VariantImageLightbox } from "@/components/product/VariantImageLightbox";
import {
  collectVariantLightboxUrls,
  resolveColorDisplayMode,
  SIZE_REGIONS,
  type ColorOption,
  type GalleryItem,
} from "@/lib/product-pdp";

type DynamicVariant = {
  typeId: string;
  typeName: string;
  unit?: string;
  icon?: string;
  options: Array<{ id: string; label: string }>;
};

type Props = {
  colorOptions: ColorOption[];
  gallery: GalleryItem[];
  selectedColor: number;
  onColorSelect: (index: number) => void;
  onOpenVariantDrawer: () => void;
  sizes: string[];
  sizeRegion: string;
  onSizeRegionChange: (region: string) => void;
  selectedSize: string | null;
  onSizeSelect: (size: string) => void;
  dynamicVariants: DynamicVariant[];
  selectedDynamic: Record<string, string>;
  onDynamicSelect: (typeId: string, label: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProductVariantSelectors({
  colorOptions,
  gallery,
  selectedColor,
  onColorSelect,
  onOpenVariantDrawer,
  sizes,
  sizeRegion,
  onSizeRegionChange,
  selectedSize,
  onSizeSelect,
  dynamicVariants,
  selectedDynamic,
  onDynamicSelect,
  t,
}: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const displayMode = resolveColorDisplayMode(colorOptions);
  const lightboxUrls = collectVariantLightboxUrls(colorOptions, gallery);

  const handleColor = (index: number) => {
    onColorSelect(index);
    onOpenVariantDrawer();
  };

  const handleSize = (size: string) => {
    onSizeSelect(size);
    onOpenVariantDrawer();
  };

  const handleDynamic = (typeId: string, label: string) => {
    onDynamicSelect(typeId, label);
    onOpenVariantDrawer();
  };

  return (
    <div className="space-y-4">
      {colorOptions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {t("product.colorWithCount", { count: colorOptions.length })}
            </span>
            {lightboxUrls.length > 0 && (
              <button
                type="button"
                className="text-xs text-primary underline min-h-[44px] flex items-center"
                onClick={() => setLightboxOpen(true)}
              >
                {t("product.viewLarge")}
              </button>
            )}
          </div>

          {displayMode === "image" ? (
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((color, i) => (
                <button
                  key={`${color.hex}-img-${i}`}
                  type="button"
                  onClick={() => handleColor(i)}
                  className={`w-12 h-12 md:w-14 md:h-14 rounded-sm border-2 overflow-hidden bg-muted shrink-0 transition-colors min-h-[44px] min-w-[44px] ${selectedColor === i ? "border-primary ring-2 ring-primary/30" : "border-border/40"}`}
                  aria-label={color.name || t("product.colorAria", { index: i + 1 })}
                >
                  {color.imageUrl ? (
                    <OptimizedImage
                      src={color.imageUrl}
                      alt={color.name}
                      widths={[96, 128]}
                      sizes="56px"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: color.hex }} />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((color, i) => (
                <button
                  key={`${color.hex}-swatch-${i}`}
                  type="button"
                  onClick={() => handleColor(i)}
                  className={`w-11 h-11 rounded-full border-2 overflow-hidden transition-all shrink-0 min-h-[44px] min-w-[44px] ${selectedColor === i ? "border-primary ring-2 ring-primary/30 scale-105" : "border-border"}`}
                  style={color.imageUrl ? undefined : { backgroundColor: color.hex }}
                  aria-label={color.name || t("product.colorAria", { index: i + 1 })}
                >
                  {color.imageUrl && (
                    <OptimizedImage
                      src={color.imageUrl}
                      alt={color.name}
                      widths={[64, 96]}
                      sizes="44px"
                      className="w-full h-full object-contain"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <VariantImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrls={lightboxUrls}
        initialIndex={selectedColor}
        emptyLabel={t("product.noVariantImages")}
      />

      {sizes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{t("product.sizeLabel")}</span>
            <div className="flex items-center gap-2">
              <Select value={sizeRegion} onValueChange={onSizeRegionChange}>
                <SelectTrigger className="h-9 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SIZE_REGIONS).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="text-xs text-primary underline inline-flex items-center gap-1 min-h-[44px]"
                  >
                    <Ruler size={12} /> {t("product.sizeGuide")}
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("product.sizeGuide")}</DialogTitle>
                  </DialogHeader>
                  <div className="overflow-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted">
                          <th className="p-2 text-left text-muted-foreground">{t("product.sizeCol")}</th>
                          <th className="p-2 text-left text-muted-foreground">{t("product.bust")} (cm)</th>
                          <th className="p-2 text-left text-muted-foreground">{t("product.waist")} (cm)</th>
                          <th className="p-2 text-left text-muted-foreground">{t("product.hips")} (cm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {["XS", "S", "M", "L", "XL", "XXL"].map((s, i) => (
                          <tr key={s} className="border-b border-border">
                            <td className="p-2 font-medium">{s}</td>
                            <td className="p-2">
                              {78 + i * 4}–{82 + i * 4}
                            </td>
                            <td className="p-2">
                              {60 + i * 4}–{64 + i * 4}
                            </td>
                            <td className="p-2">
                              {84 + i * 4}–{88 + i * 4}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handleSize(size)}
                className={`min-w-[44px] h-11 px-3 rounded-sm border text-sm font-medium transition-all ${selectedSize === size ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary"}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {dynamicVariants.map((dv) => (
        <div key={dv.typeId} className="space-y-2">
          <span className="text-sm font-medium text-foreground">
            {dv.icon ? `${dv.icon} ` : ""}
            {dv.typeName}
            {dv.unit ? ` (${dv.unit})` : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            {dv.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleDynamic(dv.typeId, opt.label)}
                className={`min-w-[44px] h-11 px-3 rounded-sm border text-sm font-medium transition-all ${
                  selectedDynamic[dv.typeId] === opt.label
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:border-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
