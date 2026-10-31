import { createClient } from "@supabase/supabase-js";
import { readRequestBytes } from "./request-body";

export const CLOUD_PREFIX = "supabase/";
export const cloudStorageEnabled = () => process.env.FILE_STORAGE === "supabase";

export function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || new URL(url).protocol !== "https:") throw new Error("Private storage is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export function storageBucket(staging = false) {
  const name = staging ? process.env.SUPABASE_UPLOAD_BUCKET : process.env.SUPABASE_STORAGE_BUCKET;
  if (!name || !/^[a-z0-9-]+$/.test(name)) throw new Error("Private storage bucket is not configured");
  return storageClient().storage.from(name);
}

export function cloudKey(filepath: string) {
  const key = filepath.slice(CLOUD_PREFIX.length);
  if (!filepath.startsWith(CLOUD_PREFIX) || !/^[a-zA-Z0-9_/-]+\.[a-z0-9]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
}

export async function signedDownload(filepath: string, filename?: string) {
  const { data, error } = await storageBucket().createSignedUrl(cloudKey(filepath), 300, filename ? { download: filename } : undefined);
  if (error || !data) throw new Error("Could not open private file");
  return data.signedUrl;
}

export async function downloadStagedFile(key: string, maximum: number) {
  const { data, error } = await storageBucket(true).createSignedUrl(key, 60);
  if (error || !data) throw new Error("Could not read uploaded file");
  const response = await fetch(data.signedUrl, { cache: "no-store", signal: AbortSignal.timeout(60000), redirect: "error" });
  if (!response.ok) throw new Error("Could not read uploaded file");
  return readRequestBytes(response, maximum);
}
