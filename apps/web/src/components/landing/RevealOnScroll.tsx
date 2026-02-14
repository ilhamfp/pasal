"use client";

import { useRef, type ReactNode } from "react";
import { m, useInView } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

export default function RevealOnScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <m.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </m.div>
  );
}
