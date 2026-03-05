import { useRef, useState } from "react";
import { Camera, X, ImageIcon } from "lucide-react";

interface PhotoCaptureProps {
  onPhotoReady: (file: File | null) => void;
}

export function PhotoCapture({ onPhotoReady }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onPhotoReady(file);
  };

  const clear = () => {
    setPreview(null);
    onPhotoReady(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground font-medium">Photo preuve de livraison</label>
      <div className="mt-1">
        {preview ? (
          <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border">
            <img src={preview} alt="Preuve" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={clear}
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full h-28 rounded-lg border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors active:scale-[0.98] touch-manipulation"
          >
            <Camera size={24} />
            <span className="text-xs">Prendre une photo</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
    </div>
  );
}
