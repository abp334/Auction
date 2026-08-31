import { randomUUID } from "crypto";
import { logger } from "./logger.js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "auction-media";
const MAX_BYTES = 800_000; // ~800KB after client resize

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "").replace(/\/rest\/v1$/, "");
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  return { url, key };
}

export function isSupabaseStorageConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key);
}

async function ensureBucket(url: string, key: string): Promise<void> {
  const listRes = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
  });
  if (listRes.ok) return;

  const createRes = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    // Race: another request created it
    if (!errText.toLowerCase().includes("already")) {
      throw new Error(`Could not create storage bucket: ${errText}`);
    }
  }
}

export async function uploadAuctionMedia(opts: {
  kind: "player" | "team";
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    throw new Error("Supabase Storage is not configured on the server.");
  }
  if (opts.buffer.length > MAX_BYTES) {
    throw new Error("Image is too large. Max ~800KB after resize.");
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const contentType = allowed.includes(opts.contentType)
    ? opts.contentType
    : "image/jpeg";

  await ensureBucket(url, key);

  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : contentType === "image/gif"
          ? "gif"
          : "jpg";

  const folder = opts.kind === "team" ? "teams" : "players";
  const path = `${folder}/${randomUUID()}.${ext}`;

  const uploadRes = await fetch(
    `${url}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: new Uint8Array(opts.buffer),
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    logger.error({ status: uploadRes.status, errText, path }, "Supabase upload failed");
    throw new Error("Failed to upload image to storage.");
  }

  const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
  logger.info({ path, kind: opts.kind }, "Uploaded auction media");
  return publicUrl;
}

/** Player photos: only https URLs. Rejects base64 data URLs. */
export function sanitizePlayerPhoto(value?: string | null): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (v.startsWith("data:")) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return null;
}

/**
 * Team logos: https image URL, or short emoji/text (legacy).
 * Rejects base64 data URLs.
 */
export function sanitizeTeamLogo(value?: string | null): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (v.startsWith("data:")) return null;
  if (/^https?:\/\//i.test(v)) return v;
  // Keep short emoji / text marks
  if (v.length <= 12) return v;
  return null;
}

export function isHttpImageUrl(value?: string | null): boolean {
  return !!value && /^https?:\/\//i.test(value.trim());
}
