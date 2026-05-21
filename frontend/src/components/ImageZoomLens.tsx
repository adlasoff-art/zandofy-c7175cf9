import { useState, useRef, useCallback, memo } from "react";

interface ImageZoomLensProps {
  src: string;
  alt: string;
  srcSet?: string;
  sizes?: string;
  className?: string;
  zoomFactor?: number;
}

/**
 * Magnifying-glass zoom on hover.
 * On desktop: moving the mouse shows a zoomed-in lens following the cursor.
 * On mobile: no zoom (just the image).
 */
export const ImageZoomLens = memo(function ImageZoomLens({
  src,
  alt,
  srcSet,
  sizes,
  className = "",
  zoomFactor = 2.5,
}: ImageZoomLensProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setLens({ x, y, active: true });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setLens((prev) => ({ ...prev, active: false }));
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden cursor-crosshair ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Base image — object-contain to avoid blur/crop */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        className="w-full h-full object-contain"
        draggable={false}
        decoding="async"
      />

      {/* Zoomed overlay on hover */}
      {lens.active && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: `${zoomFactor * 100}%`,
            backgroundPosition: `${lens.x}% ${lens.y}%`,
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
    </div>
  );
});
