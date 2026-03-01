"use client";

import { m } from "framer-motion";
import { useTranslations } from "next-intl";
import SearchBar from "@/components/SearchBar";
import PasalLogo from "@/components/PasalLogo";
import { fadeUp, staggerContainer } from "@/lib/motion";
import SearchSuggestions from "./SearchSuggestions";

export default function HeroSection() {
  const t = useTranslations("hero");

  return (
    <m.section
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center justify-center px-4 pb-12 sm:pb-24 md:pb-32 pt-16 sm:pt-28 md:pt-36"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <m.div variants={fadeUp}>
          <PasalLogo size={64} className="text-foreground" />
        </m.div>
        <m.h1
          variants={fadeUp}
          className="font-heading text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl md:text-7xl"
        >
          {t("heading")}
        </m.h1>
        <m.p variants={fadeUp} className="text-muted-foreground">
          <em className="font-heading text-xl sm:text-2xl md:text-3xl">
            {t("subheading")}
          </em>
        </m.p>
        <m.div variants={fadeUp} className="mt-2 w-full max-w-2xl">
          <SearchBar autoFocus />
        </m.div>
        <m.div variants={fadeUp}>
          <SearchSuggestions />
        </m.div>
      </div>
    </m.section>
  );
}
