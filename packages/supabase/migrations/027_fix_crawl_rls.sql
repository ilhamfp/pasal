-- Fix: add authenticated role to crawl_jobs and scraper_runs read policies
-- Without this, logged-in admin users (role=authenticated) get 0 rows
DROP POLICY IF EXISTS "Public read crawl_jobs" ON crawl_jobs;
CREATE POLICY "Public read crawl_jobs" ON crawl_jobs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read scraper_runs" ON scraper_runs;
CREATE POLICY "Public read scraper_runs" ON scraper_runs FOR SELECT TO anon, authenticated USING (true);
