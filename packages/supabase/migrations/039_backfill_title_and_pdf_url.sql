-- Migration 039: Backfill title_id from tentang and source_pdf_url from crawl_jobs
--
-- Fixes two bugs in the scraper pipeline:
-- 1. title_id subject was taken from listing page link text, which can be wrong
-- 2. source_pdf_url was never propagated from crawl_jobs to works

-- Fix title_id using authoritative tentang from detail page metadata
UPDATE works
SET title_id = CONCAT(
  SUBSTRING(title_id FROM 1 FOR POSITION('tentang' IN title_id) + 7),
  tentang
)
WHERE tentang IS NOT NULL
  AND tentang != ''
  AND title_id LIKE '% tentang %';

-- Backfill source_pdf_url from crawl_jobs for works missing it
UPDATE works w
SET source_pdf_url = cj.pdf_url
FROM crawl_jobs cj
WHERE cj.work_id = w.id
  AND cj.pdf_url IS NOT NULL
  AND (w.source_pdf_url IS NULL OR w.source_pdf_url = '');
