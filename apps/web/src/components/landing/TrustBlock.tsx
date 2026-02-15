"use client";

import { useRef } from "react";
import { m, useInView } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import PasalLogo from "@/components/PasalLogo";

const ITEMS = [
  {
    title: "Data dari sumber resmi pemerintah",
    detail:
      "Dikumpulkan dari publikasi resmi lembaga negara dan jaringan dokumentasi hukum nasional.",
  },
  {
    title: "Terstruktur, bukan PDF",
    detail:
      "Bab, pasal, dan ayat bisa dicari secara individual. Tidak perlu membaca dokumen utuh.",
  },
  {
    title: "Open source & dapat diverifikasi",
    detail:
      "Kode sumber terbuka dan dapat diverifikasi. Bandingkan langsung dengan sumber resmi.",
  },
];

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
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <m.p
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground"
        >
          Mengapa Mempercayai Data Ini
        </m.p>
        <m.h2
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.05 }}
          className="font-heading text-center text-4xl tracking-tight sm:text-5xl"
        >
          Sumber &amp; Transparansi
        </m.h2>

        <m.div
          variants={container}
          initial="hidden"
          animate={isInView ? "show" : "hidden"}
          className="mt-10 grid gap-4 sm:grid-cols-3"
        >
          {ITEMS.map((item) => (
            <m.div
              key={item.title}
              variants={slideIn}
              className="rounded-lg border bg-card p-6"
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
