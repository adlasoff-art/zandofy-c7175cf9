/**
 * Client-side image compression using Canvas API.
 * Resizes to max dimensions, converts to WebP (fallback JPEG).
 * Does NOT touch video files.
 */

function supportsWebP(): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

export async function compressImage(
  file: File,
  maxSize = 2000,
  quality = 0.92
): Promise<File> {
  // Skip non-image files (e.g. videos)
  if (!file.type.startsWith("image/")) return file;

  // Skip SVGs — they're already optimized vectors
  if (file.type === "image/svg+xml") return file;

  // Skip GIFs — compression would lose animation
  if (file.type === "image/gif") return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only resize if larger than maxSize
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // fallback: return original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const useWebP = supportsWebP();
      const mimeType = useWebP ? "image/webp" : "image/jpeg";
      const ext = useWebP ? "webp" : "jpg";

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // If compressed is larger than original, keep original
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          const baseName = file.name.replace(/\.[^.]+$/, "");
          const compressed = new File([blob], `${baseName}.${ext}`, {
            type: mimeType,
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback: return original on error
    };

    img.src = url;
  });
}
