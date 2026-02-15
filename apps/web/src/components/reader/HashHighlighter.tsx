"use client";

import { useEffect, useRef } from "react";
import { animate, type AnimationPlaybackControls } from "framer-motion";

const BG_COLOR = "oklch(0.450 0.065 170 / 0.06)";

function clearStyles(el: HTMLElement) {
  el.style.backgroundColor = "";
  el.style.borderRadius = "";
  el.style.padding = "";
  el.style.margin = "";
}

export default function HashHighlighter() {
  const animRef = useRef<AnimationPlaybackControls | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    function cancel() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
      if (activeElRef.current) {
        clearStyles(activeElRef.current);
        activeElRef.current = null;
      }
    }

    function highlight(hash: string) {
      if (!hash) return;
      const id = hash.replace("#", "");
      const el = document.getElementById(id);
      if (!el) return;

      cancel();

      activeElRef.current = el;
      el.style.backgroundColor = BG_COLOR;
      el.style.borderRadius = "12px";
      el.style.padding = "12px 16px";
      el.style.margin = "-12px -16px";

      if (prefersReducedMotion) {
        timerRef.current = setTimeout(() => {
          clearStyles(el);
          activeElRef.current = null;
          timerRef.current = null;
        }, 400);
        return;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        animRef.current = animate(
          el,
          {
            backgroundColor: "oklch(0.450 0.065 170 / 0)",
          },
          {
            duration: 0.6,
            ease: [0.4, 0, 0.2, 1],
            onComplete: () => {
              clearStyles(el);
              activeElRef.current = null;
              animRef.current = null;
            },
          },
        );
      }, 800);
    }

    if (window.location.hash) {
      highlight(window.location.hash);
    }

    function onHashChange() {
      highlight(window.location.hash);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      cancel();
    };
  }, []);

  return null;
}
