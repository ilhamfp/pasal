"use client";

import { m } from "framer-motion";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { Children } from "react";

export default function StaggeredList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
    >
      {Children.map(children, (child) => (
        <m.div variants={fadeUp}>{child}</m.div>
      ))}
    </m.div>
  );
}
