-- Apply ONLY to the admin-test.ccpun.com (UAT) Supabase project, after the
-- migrations in db/supabase/migrations/. Admin UAT refuses any project whose
-- lane row is missing or different.
INSERT INTO public.ops_lane_identity (singleton, lane) VALUES (true, 'admin-uat')
ON CONFLICT (singleton) DO NOTHING;
SELECT 1 / CASE WHEN (SELECT lane FROM public.ops_lane_identity WHERE singleton) = 'admin-uat' THEN 1 ELSE 0 END AS lane_guard;
