import { type TouchEvent, useRef } from "react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { ImageZoomLens } from "@/components/ImageZoomLens";
import { PdpThumbImage } from "@/components/product/PdpThumbImage";
import { imgUrl, imgSrcSet } from "@/lib/image-url";
import { PDP_THUMB_FRAME_CLASS } from "@/lib/product-image-fit";
import {
  PDP_MAIN_WIDTHS,
  PDP_THUMB_WIDTHS,
  SWIPE_THRESHOLD_PX,
  type GalleryItem,
} from "@/lib/product-pdp";

function ThumbButton({
  item,
  index,
  selected,
  onSelect,
  className = "",
}: {
  item: GalleryItem;
  index: number;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${PDP_THUMB_FRAME_CLASS} w-14 md:w-16 shrink-0 rounded-sm ${selected ? "border-primary" : "border-border/40"} ${className}`}
      aria-label={`Vue ${index + 1}`}
    >
      {item.type === "video" ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Camera size={14} className="text-muted-foreground" />
        </span>
      ) : (
        <PdpThumbImage
          src={item.url}
          alt={`Vue ${index + 1}`}
          widths={[...PDP_THUMB_WIDTHS]}
          sizes="64px"
          fitHeight={64}
        />
      )}
    </button>
  );
}

type Props = {
  gallery: GalleryItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  productName: string;
  fallbackImage: string;
  isSale?: boolean;
  discount?: number | null;
  onPrev: () => void;
  onNext: () => void;
};

export function ProductGallery({
  gallery,
  selectedIndex,
  onSelectIndex,
  productName,
  fallbackImage,
  isSale,
  discount,
  onPrev,
  onNext,
}: Props) {
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null || gallery.length < 2) {
      touchStartX.current = null;
      return;
    }
    const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) onNext();
    else onPrev();
  };

  const current = gallery[selectedIndex];

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <div className="hidden md:flex flex-col gap-2 w-16 shrink-0">
          {gallery.map((item, i) => (
            <ThumbButton
              key={i}
              item={item}
              index={i}
              selected={selectedIndex === i}
              onSelect={() => onSelectIndex(i)}
            />
          ))}
        </div>

        <div
          className="relative flex-1 aspect-[3/4] max-h-[520px] rounded-sm overflow-hidden bg-muted touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {current?.type === "video" ? (
            <video
              key={current.url}
              src={current.url}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <ImageZoomLens
              src={imgUrl(current?.url || fallbackImage, { width: 1200, quality: 80 })}
              srcSet={imgSrcSet(current?.url || fallbackImage, [...PDP_MAIN_WIDTHS], { quality: 80 })}
              sizes="(max-width: 1024px) 100vw, 50vw"
              alt={productName}
              className="w-full h-full"
              zoomFactor={2.5}
            />
          )}
          {isSale && discount != null && (
            <span className="absolute top-3 left-3 px-3 py-1.5 text-sm font-bold bg-sale text-sale-foreground rounded-sm">
              -{discount}%
            </span>
          )}
          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={onPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/80 flex items-center justify-center hover:bg-card transition-colors"
                aria-label="Image précédente"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={onNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/80 flex items-center justify-center hover:bg-card transition-colors"
                aria-label="Image suivante"
              >
                <ChevronRight size={18} />
              </button>
              <span className="absolute bottom-3 right-3 text-xs bg-card/80 text-foreground px-2 py-1 rounded">
                {selectedIndex + 1}/{gallery.length}
              </span>
            </>
          )}
        </div>
      </div>

      {gallery.length > 1 && (
        <div className="flex md:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
          {gallery.map((item, i) => (
            <ThumbButton
              key={`m-${i}`}
              item={item}
              index={i}
              selected={selectedIndex === i}
              onSelect={() => onSelectIndex(i)}
              className="snap-start"
            />
          ))}
        </div>
      )}
    </div>
  );
}
