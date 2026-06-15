const CLIP_MODEL_HF = "openai/clip-vit-base-patch32";
const JINA_MODEL = "jina-clip-v2";
const JINA_API_URL = "https://api.jina.ai/v1/embeddings";
const EMBEDDING_DIM = 512;

export const IMAGE_EMBEDDING_MODEL = CLIP_MODEL_HF;

type EmbeddingTask = "retrieval.passage" | "retrieval.query";

function getApiKey(): string {
  return (
    Deno.env.get("EMBEDDING_API_KEY") ||
    Deno.env.get("JINA_API_KEY") ||
    Deno.env.get("HUGGINGFACE_API_KEY") ||
    ""
  );
}

function getProvider(): "jina" | "huggingface" {
  const explicit = Deno.env.get("EMBEDDING_PROVIDER")?.toLowerCase();
  if (explicit === "jina") return "jina";
  if (explicit === "huggingface" || explicit === "hf") return "huggingface";

  const url = Deno.env.get("EMBEDDING_API_URL") || "";
  if (url.includes("jina.ai")) return "jina";

  const key = getApiKey();
  if (key.startsWith("jina_")) return "jina";

  return "huggingface";
}

function getHfModelUrl(): string {
  const override = Deno.env.get("EMBEDDING_API_URL");
  if (override && !override.includes("jina.ai")) return override;
  return `https://router.huggingface.co/hf-inference/models/${CLIP_MODEL_HF}`;
}

function getStoredModelName(): string {
  const provider = getProvider();
  if (provider === "jina") {
    return Deno.env.get("EMBEDDING_MODEL") || JINA_MODEL;
  }
  return Deno.env.get("EMBEDDING_MODEL") || CLIP_MODEL_HF;
}

export function embeddingModelForStorage(): string {
  return getStoredModelName();
}

/** Normalize embedding to unit length for cosine similarity via pgvector. */
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

function parseEmbeddingVector(data: unknown): number[] | null {
  if (!data) return null;

  if (Array.isArray(data)) {
    if (Array.isArray(data[0])) return data[0] as number[];
    if (typeof data[0] === "number") return data as number[];
    if (data[0] && typeof data[0] === "object") {
      const row = data[0] as { embedding?: number[] };
      if (Array.isArray(row.embedding)) return row.embedding;
    }
  }

  if (typeof data === "object") {
    const obj = data as { embedding?: number[]; data?: Array<{ embedding?: number[] }> };
    if (Array.isArray(obj.embedding)) return obj.embedding;
    if (Array.isArray(obj.data?.[0]?.embedding)) return obj.data![0].embedding!;
  }

  return null;
}

async function embedViaJina(
  imageRef: string,
  task: EmbeddingTask = "retrieval.passage",
): Promise<number[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("EMBEDDING_API_KEY not configured");

  const apiUrl = Deno.env.get("EMBEDDING_API_URL") || JINA_API_URL;
  const model = Deno.env.get("EMBEDDING_MODEL") || JINA_MODEL;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      dimensions: EMBEDDING_DIM,
      task,
      normalized: true,
      embedding_type: "float",
      input: [{ image: imageRef }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Jina embedding error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const payload = await res.json();
  const vector = parseEmbeddingVector(payload?.data) ?? parseEmbeddingVector(payload);
  if (!vector?.length) throw new Error("Invalid Jina embedding response");
  return normalizeVector(vector);
}

async function embedViaHuggingface(bytes: Uint8Array, mime = "image/jpeg"): Promise<number[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("EMBEDDING_API_KEY not configured");

  const modelUrl = getHfModelUrl();
  const authHeaders = { Authorization: `Bearer ${apiKey}` };

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
      errText.includes("router.huggingface.co") ||
      errText.includes("not deployed") ||
      errText.includes("Inference Provider");

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
      const hint =
        retryErr.includes("not deployed") || retryErr.includes("Inference Provider") || res.status === 404
          ? " Le modèle CLIP n'est pas disponible sur HF serverless. Utilisez EMBEDDING_PROVIDER=jina + clé Jina (api.jina.ai) ou un Inference Endpoint HF (EMBEDDING_API_URL)."
          : "";
      throw new Error(`Embedding API error ${res.status}: ${retryErr.slice(0, 280)}${hint}`);
    }
  }

  const data = await res.json();
  const vector = parseEmbeddingVector(data);
  if (!vector?.length) throw new Error("Invalid Hugging Face embedding response");
  return normalizeVector(vector);
}

export async function fetchImageBytes(imageUrl: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const mime = res.headers.get("content-type") || "image/jpeg";
  const buf = await res.arrayBuffer();
  return { bytes: new Uint8Array(buf), mime };
}

export async function embedImageBytes(
  bytes: Uint8Array,
  mime = "image/jpeg",
  task: EmbeddingTask = "retrieval.passage",
): Promise<number[]> {
  if (getProvider() === "jina") {
    const base64 = uint8ToBase64(bytes);
    return embedViaJina(`data:${mime};base64,${base64}`, task);
  }
  return embedViaHuggingface(bytes, mime);
}

export async function embedImageFromUrl(
  imageUrl: string,
  task: EmbeddingTask = "retrieval.passage",
): Promise<number[]> {
  if (getProvider() === "jina") {
    return embedViaJina(imageUrl, task);
  }
  const { bytes, mime } = await fetchImageBytes(imageUrl);
  return embedViaHuggingface(bytes, mime);
}

export async function embedImageFromBase64(
  imageBase64: string,
  task: EmbeddingTask = "retrieval.query",
): Promise<number[]> {
  if (getProvider() === "jina") {
    let ref = imageBase64;
    if (!ref.startsWith("data:") && !ref.startsWith("http")) {
      ref = `data:image/jpeg;base64,${ref.replace(/\s/g, "")}`;
    }
    return embedViaJina(ref, task);
  }

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
  return embedViaHuggingface(bytes, mime);
}
