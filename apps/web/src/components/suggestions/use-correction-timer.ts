"use client";

import { useRef, useCallback } from "react";

/**
 * Tracks correction UX metadata: duration and PDF pages viewed.
 */
export function useCorrectionTimer() {
  const startTime = useRef(Date.now());
  const pagesViewed = useRef<Set<number>>(new Set());

  const trackPageView = useCallback((page: number) => {
    pagesViewed.current.add(page);
  }, []);

  const getMetadata = useCallback(() => {
    return {
      correction_duration_ms: Date.now() - startTime.current,
      pdf_pages_viewed: Array.from(pagesViewed.current).sort((a, b) => a - b),
    };
  }, []);

  return { trackPageView, getMetadata };
}
