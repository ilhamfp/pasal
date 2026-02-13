"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import PasalLogo from "@/components/PasalLogo";

const ITEMS = [
  {
    title: "Data bersumber dari peraturan.go.id",
    detail:
      "Sumber resmi Jaringan Dokumentasi dan Informasi Hukum Nasional (JDIHN).",
  },
  {
    title: "Terstruktur, bukan PDF",
    detail:
      "Bab, pasal, dan ayat bisa dicari secara individual — tidak perlu membaca dokumen utuh.",
  },
  {
    title: "Open source & dapat diverifikasi",
    detail:
      "Kode sumber terbuka di GitHub. Bandingkan langsung dengan sumber resmi.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const slideIn = {
  hidden: { opacity: 0, x: -16 },
  show: {
    opacity: 1,
    x: 0,
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
    <section ref={ref} className="border-t py-16 sm:py-20">
      <div className="mx-auto max-w-2xl px-4">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="font-heading text-center text-3xl tracking-tight sm:text-4xl"
        >
          Sumber &amp; Transparansi
        </motion.h2>

        <motion.div
          variants={container}
          initial="hidden"
          animate={isInView ? "show" : "hidden"}
          className="mt-10 space-y-6"
        >
          {ITEMS.map((item) => (
            <motion.div
              key={item.title}
              variants={slideIn}
              className="flex gap-4"
            >
              <motion.span
                variants={dotPop}
                className="mt-0.5 shrink-0 text-primary"
              >
                <PasalLogo size={18} />
              </motion.span>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-muted-foreground">{item.detail}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
