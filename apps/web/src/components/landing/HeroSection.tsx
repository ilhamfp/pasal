"use client";

import { motion } from "framer-motion";
import SearchBar from "@/components/SearchBar";
import PasalLogo from "@/components/PasalLogo";
import { fadeUp, staggerContainer } from "@/lib/motion";
import SearchSuggestions from "./SearchSuggestions";

export default function HeroSection() {
  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center justify-center px-4 pb-24 pt-28 sm:pb-32 sm:pt-36"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <motion.div variants={fadeUp}>
          <PasalLogo size={64} className="text-foreground" />
        </motion.div>
        <motion.h1
          variants={fadeUp}
          className="font-heading text-5xl leading-[1.1] tracking-tight sm:text-7xl"
        >
          Temukan pasal yang Anda butuhkan
        </motion.h1>
        <motion.p variants={fadeUp} className="text-muted-foreground">
          <em className="font-heading text-2xl sm:text-3xl">
            Hukum Indonesia, terbuka untuk semua
          </em>
        </motion.p>
        <motion.div variants={fadeUp} className="mt-2 w-full max-w-2xl">
          <SearchBar autoFocus />
        </motion.div>
        <motion.div variants={fadeUp}>
          <SearchSuggestions />
        </motion.div>
      </div>
    </motion.section>
  );
}
