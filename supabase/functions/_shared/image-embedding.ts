const CLIP_MODEL = "openai/clip-vit-base-patch32";
const EMBEDDING_DIM = 512;

export const IMAGE_EMBEDDING_MODEL = CLIP_MODEL;

function getApiKey(): string {
  return (
    Deno.env.get("EMBEDDING_API_KEY") ||
    Deno.env.get("HUGGINGFACE_API_KEY") ||
    ""
  );
}

function getModelUrl(): string {
  const override = Deno.env.get("EMBEDDING_API_URL");
  if (override) return override;
  return `https://router.huggingface.co/hf-inference/models/${CLIP_MODEL}`;
}

/** Normalize CLIP embedding to unit length for cosine similarity via pgvector. */
function normalizeVector(values: number[]): number[] {
  const slice = values.slice(0, EMBEDDING_DIM);
  while (slice.length < EMBEDDING_DIM) slice.push(0);
  let norm = 0;
  for (const v of slice) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return slice.map((v) => v / norm);
}

export function embeddingToPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function fetchImageBytes(imageUrl: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const mime = res.headers.get("content-type") || "image/jpeg";
  const buf = await res.arrayBuffer();
  return { bytes: new Uint8Array(buf), mime };
}

export async function embedImageBytes(bytes: Uint8Array, mime = "image/jpeg"): Promise<number[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("EMBEDDING_API_KEY not configured");

  const modelUrl = getModelUrl();
  const authHeaders = { Authorization: `Bearer ${apiKey}` };

  // Router API: try raw bytes (legacy inference shape), then JSON base64 fallback.
  let res = await fetch(modelUrl, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": mime,
    },
    body: bytes,
  });

  if (!res.ok) {
    const errText = await res.text();
    const needsJson =
      res.status === 404 ||
      errText.includes("no longer supported") ||
      errText.includes("router.huggingface.co");

    if (needsJson) {
      const base64 = uint8ToBase64(bytes);
      const dataUrl = `data:${mime};base64,${base64}`;

      res = await fetch(modelUrl, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: dataUrl }),
      });
    }

    if (!res.ok) {
      const retryErr = await res.text();
      throw new Error(`Embedding API error ${res.status}: ${retryErr.slice(0, 300)}`);
    }
  }

  const data = await res.json();
  let vector: number[] | null = null;

  if (Array.isArray(data)) {
    if (Array.isArray(data[0])) vector = data[0] as number[];
    else if (typeof data[0] === "number") vector = data as number[];
  } else if (data && Array.isArray(data.embedding)) {
    vector = data.embedding;
  }

  if (!vector?.length) throw new Error("Invalid embedding response");
  return normalizeVector(vector);
}

export async function embedImageFromUrl(imageUrl: string): Promise<number[]> {
  const { bytes, mime } = await fetchImageBytes(imageUrl);
  return embedImageBytes(bytes, mime);
}

export async function embedImageFromBase64(imageBase64: string): Promise<number[]> {
  let raw = imageBase64;
  let mime = "image/jpeg";
  if (raw.startsWith("data:")) {
    const match = raw.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/s);
    if (match) {
      mime = match[1];
      raw = match[2];
    } else {
      raw = raw.replace(/^data:[^;]+;base64,/, "");
    }
  }
  raw = raw.replace(/\s/g, "");
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return embedImageBytes(bytes, mime);
}
