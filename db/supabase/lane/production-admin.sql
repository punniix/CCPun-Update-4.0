-- Apply ONLY to the admin.ccpun.com (Production) Supabase project, after the
-- migrations in db/supabase/migrations/. Admin Production refuses any project
-- whose lane row is missing or different.
INSERT INTO public.ops_lane_identity (singleton, lane) VALUES (true, 'production-admin')
ON CONFLICT (singleton) DO NOTHING;
SELECT 1 / CASE WHEN (SELECT lane FROM public.ops_lane_identity WHERE singleton) = 'production-admin' THEN 1 ELSE 0 END AS lane_guard;
