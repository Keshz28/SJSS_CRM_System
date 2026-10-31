-- Dedicated CRM project only. Run after Prisma migrations as the migration owner.
-- NextAuth authorizes people in the server; no Supabase browser-role access.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'crm_runtime') THEN
    CREATE ROLE crm_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO crm_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, crm_runtime;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','notifications','companies','customers','quotations',
    'quotation_items','attachments','site_visits','projects','project_preferences',
    'work_groups','work_group_members','work_group_messages','quotation_sequences',
    'login_buckets','email_login_challenges','invoice_sequences','_prisma_migrations']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_server ON public.%I', t);
    IF t = '_prisma_migrations' THEN
      EXECUTE format('GRANT SELECT ON public.%I TO crm_runtime', t);
      EXECUTE format('CREATE POLICY crm_server ON public.%I FOR SELECT TO crm_runtime USING (true)', t);
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO crm_runtime', t);
      EXECUTE format('CREATE POLICY crm_server ON public.%I TO crm_runtime USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;
-- Prevent the migration owner's future tables inheriting browser grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;
