import { apiFetch } from "@/lib/api";

const MAX_EDGE = 600;
const JPEG_QUALITY = 0.82;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 || "");
    };
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

/** Resize & compress before upload (keeps free-tier payloads small). */
export async function resizeImageFile(
  file: File,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY
): Promise<{ blob: Blob; contentType: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Image must be under 12MB.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image.");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode image."))),
        "image/jpeg",
        quality
      );
    });
    return { blob, contentType: "image/jpeg" };
  } finally {
    bitmap.close();
  }
}

export async function uploadAuctionImage(
  file: File,
  kind: "player" | "team"
): Promise<string> {
  const { blob, contentType } = await resizeImageFile(file);
  const data = await blobToBase64(blob);
  const res = await apiFetch("/uploads/image", {
    method: "POST",
    body: JSON.stringify({ kind, contentType, data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Image upload failed");
  }
  const json = await res.json();
  if (!json.url) throw new Error("Upload succeeded but no URL returned");
  return json.url as string;
}

export function isHttpImageUrl(value?: string | null): boolean {
  return !!value && /^https?:\/\//i.test(String(value).trim());
}

/** Warm the browser cache for the next player's photo. */
export function prefetchImageUrl(url?: string | null) {
  if (!isHttpImageUrl(url)) return;
  const img = new Image();
  img.decoding = "async";
  img.src = url!;
}

export function sanitizeCsvMediaUrl(value: unknown): string {
  const v = String(value ?? "").trim();
  if (!v || v.startsWith("data:")) return "";
  if (/^https?:\/\//i.test(v)) return v;
  // Allow short emoji/text logos in CSV
  if (v.length <= 12) return v;
  return "";
}
