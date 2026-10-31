// Run daily from a trusted scheduler. Deletes ONLY abandoned staging objects
// older than 24 hours, well beyond both the 15-minute ticket and 2-hour URL.
import { cloudEnvironment, cloudClient } from "./cloud-env.mjs";
try {
  const env = await cloudEnvironment(), client = cloudClient(env);
  if (!env.SUPABASE_UPLOAD_BUCKET || env.SUPABASE_UPLOAD_BUCKET === env.SUPABASE_STORAGE_BUCKET) throw new Error("Separate staging bucket required.");
  const bucket = client.storage.from(env.SUPABASE_UPLOAD_BUCKET);
  const { data: config, error: configError } = await client.storage.getBucket(env.SUPABASE_UPLOAD_BUCKET);
  if (configError || config.public) throw new Error("Private bucket required.");
  let offset = 0, removed = 0;
  while (true) {
    const { data, error } = await bucket.list("pending", { limit: 100, offset, sortBy: { column: "created_at", order: "asc" } });
    if (error) throw error;
    const expired = data.filter((item) => item.id && Date.parse(item.created_at) < Date.now() - 86400000).map((item) => `pending/${item.name}`);
    if (expired.length) { const { error } = await bucket.remove(expired); if (error) throw error; removed += expired.length; }
    offset += data.length - expired.length;
    if (data.length < 100) break;
  }
  console.log(`Removed ${removed} abandoned staging objects.`);
} catch { console.error("Staging cleanup failed. Check private cloud settings and Storage availability."); process.exitCode = 1; }
