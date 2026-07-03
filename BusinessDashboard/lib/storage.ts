"use client";

import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "business-assets";

/**
 * Compress an image client-side (WebP, ≤100KB, ≤800px) and upload it to
 * Supabase Storage. Returns the public URL (cache-busted).
 *
 * Paths are always `<businessId>/...` — the storage RLS policies only let
 * owners write inside their own business folder (supabase/storage.sql).
 */
export async function compressAndUpload(
  file: File,
  path: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Please choose an image file." };
  }

  let compressed: Blob;
  try {
    compressed = await imageCompression(file, {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 800,
      fileType: "image/webp",
      useWebWorker: true,
    });
  } catch {
    return { ok: false, error: "Could not process this image. Try another one." };
  }

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, { upsert: true, contentType: "image/webp" });

  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust: logo re-uploads reuse the same path.
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}
