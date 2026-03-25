/**
 * Image optimization utilities for upload-time compression
 * and display-time URL optimization via Supabase Storage transforms.
 */

/**
 * Compress an image file before upload.
 * - Resizes to maxWidth/maxHeight while maintaining aspect ratio
 * - Converts to WebP for smaller file sizes (falls back to JPEG)
 * - Returns a new File ready for upload
 */
export async function compressImageForUpload(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<File> {
  const { maxWidth = 1600, maxHeight = 2000, quality = 0.88 } = options;

  // Skip compression for small files (< 200KB) or non-images
  if (file.size < 200 * 1024 || !file.type.startsWith("image/")) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Only resize if larger than max dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      // Use high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first, fallback to JPEG
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          const ext = blob.type === "image/webp" ? "webp" : "jpg";
          const newName = file.name.replace(/\.[^.]+$/, `.${ext}`);
          resolve(new File([blob], newName, { type: blob.type }));
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Build an optimized image URL using Supabase Storage render transforms.
 * Appends width/height/quality params to the storage URL.
 * 
 * Note: This works with Supabase Storage public URLs that support
 * the /render/image/public/ endpoint.
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    resize?: "cover" | "contain" | "fill";
  } = {}
): string {
  if (!originalUrl || originalUrl === "/placeholder.svg") return originalUrl;

  // Only optimize Supabase storage URLs
  const isSupabaseStorage = originalUrl.includes("/storage/v1/object/public/");
  if (!isSupabaseStorage) return originalUrl;

  // Convert object URL to render URL for transforms
  const renderUrl = originalUrl.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );

  const params = new URLSearchParams();
  if (options.width) params.set("width", String(options.width));
  if (options.height) params.set("height", String(options.height));
  if (options.quality) params.set("quality", String(options.quality));
  if (options.resize) params.set("resize", options.resize);

  const separator = renderUrl.includes("?") ? "&" : "?";
  return `${renderUrl}${separator}${params.toString()}`;
}

/**
 * Pre-defined image size presets for common use cases.
 */
export const IMAGE_PRESETS = {
  /** Product card thumbnail (grid view) */
  cardThumbnail: (url: string) =>
    getOptimizedImageUrl(url, { width: 400, height: 533, quality: 80, resize: "cover" }),
  
  /** Product detail main image */
  detailMain: (url: string) =>
    getOptimizedImageUrl(url, { width: 800, quality: 85, resize: "contain" }),

  /** Product detail zoom (high quality) */
  detailZoom: (url: string) =>
    getOptimizedImageUrl(url, { width: 1600, quality: 90, resize: "contain" }),

  /** Gallery thumbnail */
  galleryThumb: (url: string) =>
    getOptimizedImageUrl(url, { width: 120, height: 120, quality: 75, resize: "cover" }),

  /** Store logo */
  logo: (url: string) =>
    getOptimizedImageUrl(url, { width: 200, height: 200, quality: 80, resize: "cover" }),

  /** Banner image */
  banner: (url: string) =>
    getOptimizedImageUrl(url, { width: 1200, quality: 82, resize: "cover" }),

  /** Full quality — no transforms, just the original */
  full: (url: string) => url,
} as const;
