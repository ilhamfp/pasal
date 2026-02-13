"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/legal-status";

export type LawData = {
  id: string;
  titleId: string;
  number: string;
  year: number;
  status: string;
  regType: string;
  slug: string;
  tagline: string;
  snippet: string | null;
  pasalNumber: string | null;
};

const CLONES = 2;
const INSTANT = { duration: 0 };
const SPRING = { type: "spring", stiffness: 170, damping: 26 } as const;

export default function LawCarousel({ laws }: { laws: LawData[] }) {
  const n = laws.length;

  // Clone cards at both ends for seamless infinite loop
  // e.g. [D,E, A,B,C,D,E, A,B] -- real range is indices CLONES..CLONES+n-1
  const extended = [
    ...laws.slice(-CLONES),
    ...laws,
    ...laws.slice(0, CLONES),
  ];

  const [extIndex, setExtIndex] = useState(Math.floor(n / 2) + CLONES);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({
    step: 360,
    cardW: 340,
    containerW: 1200,
  });

  // Measure card width + gap and container width for centering
  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    function measure() {
      const children = Array.from(track!.children) as HTMLElement[];
      if (children.length >= 2) {
        setLayout({
          step: children[1].offsetLeft - children[0].offsetLeft,
          cardW: children[0].offsetWidth,
          containerW: container!.offsetWidth,
        });
      }
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Auto-advance every 5 seconds
  const advance = useCallback(() => {
    setExtIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(advance, 5000);
    return () => clearInterval(timer);
  }, [advance, isPaused]);

  // Clean up snap timeout on unmount
  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    };
  }, []);

  // After animation completes, snap back to real range if we landed on a clone
  function handleAnimComplete() {
    const realIdx = extIndex - CLONES;
    if (realIdx >= n || realIdx < 0) {
      const snapped = CLONES + (((realIdx % n) + n) % n);
      setShouldAnimate(false);
      setExtIndex(snapped);
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
      // Use rAF + timeout to ensure the instant snap renders before re-enabling animation
      requestAnimationFrame(() => {
        snapTimeoutRef.current = setTimeout(() => setShouldAnimate(true), 20);
      });
    }
  }

  const realActive = (((extIndex - CLONES) % n) + n) % n;
  const { step, cardW, containerW } = layout;
  const trackX = containerW / 2 - cardW / 2 - extIndex * step;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div ref={containerRef} className="overflow-hidden">
        <motion.div
          ref={trackRef}
          className="flex gap-5"
          animate={{ x: trackX }}
          transition={shouldAnimate ? SPRING : INSTANT}
          onAnimationComplete={handleAnimComplete}
        >
          {extended.map((law, i) => {
            const isActive = i === extIndex;
            return (
              <motion.div
                key={`${law.id}-${i}`}
                className="w-[340px] max-w-[80vw] shrink-0"
                animate={{
                  scale: isActive ? 1 : 0.9,
                  opacity: isActive ? 1 : 0.45,
                }}
                transition={
                  shouldAnimate
                    ? { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
                    : INSTANT
                }
              >
                <Link
                  href={`/peraturan/${law.regType.toLowerCase()}/${law.slug}`}
                  onClick={(e) => {
                    if (!isActive) {
                      e.preventDefault();
                      setExtIndex(i);
                    }
                  }}
                  className={`flex h-full flex-col rounded-lg border bg-card p-5 transition-colors ${
                    isActive
                      ? "border-primary/30"
                      : "hover:border-primary/20"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="secondary">{law.regType}</Badge>
                    <Badge
                      className={STATUS_COLORS[law.status] || ""}
                      variant="outline"
                    >
                      {STATUS_LABELS[law.status] || law.status}
                    </Badge>
                  </div>
                  <h3 className="font-heading text-lg line-clamp-2">
                    {law.titleId}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {law.regType} No. {law.number} Tahun {law.year}
                  </p>
                  <p className="mt-2 font-heading text-sm italic text-muted-foreground">
                    &ldquo;{law.tagline}&rdquo;
                  </p>
                  {law.snippet && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Pasal {law.pasalNumber}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/70">
                        {law.snippet}
                      </p>
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Indicator dots with progress fill */}
      <div className="mt-8 flex justify-center gap-2" role="tablist" aria-label="Carousel navigation">
        {laws.map((law, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === realActive}
            aria-label={`Slide ${i + 1}: ${law.titleId}`}
            onClick={() => setExtIndex(i + CLONES)}
            className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-300 ${
              i === realActive
                ? "w-6 bg-primary/20"
                : "w-1.5 bg-muted-foreground/25"
            }`}
          >
            {i === realActive && (
              <span
                key={extIndex}
                className="absolute inset-0 origin-left rounded-full bg-primary animate-[progress-fill_5s_linear]"
                style={{
                  animationPlayState: isPaused ? "paused" : "running",
                }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
