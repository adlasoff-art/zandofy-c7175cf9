import { OptimizedImage } from "@/components/OptimizedImage";
import { PDP_THUMB_IMAGE_CLASS, PDP_THUMB_OPTIMIZED } from "@/lib/product-image-fit";

type Props = {
  src: string;
  alt: string;
  widths: number[];
  sizes: string;
  fitHeight: number;
};

export function PdpThumbImage({ src, alt, widths, sizes, fitHeight }: Props) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      widths={widths}
      sizes={sizes}
      fitHeight={fitHeight}
      className={PDP_THUMB_IMAGE_CLASS}
      {...PDP_THUMB_OPTIMIZED}
    />
  );
}
