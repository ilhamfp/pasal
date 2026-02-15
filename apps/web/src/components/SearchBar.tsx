"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { m } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SearchBar({
  defaultValue = "",
  autoFocus = false,
  preserveParams,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  preserveParams?: Record<string, string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      const params = new URLSearchParams(preserveParams);
      params.set("q", query.trim());
      router.push(`/search?${params.toString()}`);
    }
  }

  return (
    <m.form
      onSubmit={handleSubmit}
      className="flex w-full max-w-2xl gap-2"
      animate={{ scale: isFocused ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Input
        type="search"
        name="q"
        aria-label="Cari hukum Indonesia"
        placeholder={'Cari hukum Indonesia\u2026 (cth: "ketenagakerjaan", "uud 1945")'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-12 text-base"
        autoFocus={autoFocus}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      <Button type="submit" size="lg" className="h-12 px-6">
        Cari
      </Button>
    </m.form>
  );
}
