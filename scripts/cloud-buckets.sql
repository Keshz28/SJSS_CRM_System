-- Bucket creation via SQL is supported by Supabase. Object bytes must always
-- be created/deleted via the Storage API, never by editing storage.objects.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT name, name, false, 52428800, ARRAY[
  'image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif',
  'video/mp4','video/quicktime','video/webm','video/3gpp',
  'audio/webm','audio/mp4','audio/aac','audio/mpeg','audio/ogg','audio/wav','audio/x-wav',
  'application/pdf','application/msword','application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
] FROM unnest(ARRAY['crm-files','crm-pending']) AS name;
-- Intentionally no anon/authenticated storage policies: NextAuth server signs
-- access only after checking a live CRM session and the record's permissions.
