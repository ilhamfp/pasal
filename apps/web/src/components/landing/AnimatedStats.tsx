"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

type Stat = {
  numericValue?: number;
  displayValue?: string;
  label: string;
  detail: string;
};

export default function AnimatedStats({ stats }: { stats: Stat[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div ref={ref} className="grid gap-4 sm:gap-8 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <p className="font-heading text-4xl">
            {stat.numericValue != null ? (
              <CountUp target={stat.numericValue} active={isInView} />
            ) : (
              stat.displayValue
            )}
          </p>
          <p className="mt-1 text-base font-medium">{stat.label}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{stat.detail}</p>
        </div>
      ))}
    </div>
  );
}

function CountUp({ target, active }: { target: number; active: boolean }) {
  const [count, setCount] = useState(0);
  const hasRun = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || hasRun.current) return;
    hasRun.current = true;

    // Skip animation if user prefers reduced motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setCount(target);
      return;
    }

    const duration = 1400;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCount(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target]);

  return <>{count.toLocaleString("id-ID")}</>;
}
