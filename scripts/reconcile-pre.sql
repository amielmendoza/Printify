-- Remove the obsolete Supabase-Auth link so Prisma can introspect/manage the
-- profiles table, and clear the 2 dead profile rows (backed up; recreated on login).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
DELETE FROM public.profiles;
