"use client";

import { useRef } from "react";
import { m, useInView } from "framer-motion";
import { useTranslations } from "next-intl";
import { EASE_OUT } from "@/lib/motion";
import PasalLogo from "@/components/PasalLogo";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const slideIn = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT },
  },
};

const dotPop = {
  hidden: { scale: 0 },
  show: {
    scale: 1,
    transition: { type: "spring" as const, stiffness: 500, damping: 15 },
  },
};

export default function TrustBlock() {
  const t = useTranslations("trust");
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const ITEMS = [
    { title: t("item1Title"), detail: t("item1Detail") },
    { title: t("item2Title"), detail: t("item2Detail") },
    { title: t("item3Title"), detail: t("item3Detail") },
  ];

  return (
    <section ref={ref} className="py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <m.p
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground"
        >
          {t("sectionLabel")}
        </m.p>
        <m.h2
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.05 }}
          className="font-heading text-center text-3xl tracking-tight sm:text-4xl md:text-5xl"
        >
          {t("sectionTitle")}
        </m.h2>

        <m.div
          variants={container}
          initial="hidden"
          animate={isInView ? "show" : "hidden"}
          className="mt-6 sm:mt-10 grid gap-4 sm:grid-cols-3"
        >
          {ITEMS.map((item) => (
            <m.div
              key={item.title}
              variants={slideIn}
              className="rounded-lg border bg-card p-4 sm:p-6"
            >
              <m.span
                variants={dotPop}
                className="mb-3 inline-block text-primary"
              >
                <PasalLogo size={18} />
              </m.span>
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </m.div>
          ))}
        </m.div>
      </div>
    </section>
  );
}
