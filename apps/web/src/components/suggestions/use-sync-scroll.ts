"use client";

import { useRef, useCallback } from "react";

/**
 * Proportional scroll sync between two scrollable elements.
 * Returns refs for left and right panels, plus a handler to attach via onScroll.
 */
export function useSyncScroll() {
  const leftRef = useRef<HTMLDivElement | HTMLTextAreaElement>(null);
  const rightRef = useRef<HTMLDivElement | HTMLTextAreaElement>(null);
  const isSyncing = useRef(false);

  const handleScroll = useCallback((source: "left" | "right") => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    requestAnimationFrame(() => {
      const from = source === "left" ? leftRef.current : rightRef.current;
      const to = source === "left" ? rightRef.current : leftRef.current;
      if (from && to) {
        const maxFrom = from.scrollHeight - from.clientHeight;
        const ratio = maxFrom > 0 ? from.scrollTop / maxFrom : 0;
        const maxTo = to.scrollHeight - to.clientHeight;
        to.scrollTop = ratio * maxTo;
      }
      isSyncing.current = false;
    });
  }, []);

  return { leftRef, rightRef, handleScroll };
}
