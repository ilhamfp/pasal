"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
  const t = useTranslations("search");
  const navT = useTranslations("navigation");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(defaultValue);

  useEffect(() => {
    if (autoFocus && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [autoFocus]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      const params = new URLSearchParams(preserveParams);
      params.set("q", query.trim());
      router.push(`/search?${params.toString()}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-2xl gap-2"
    >
      <Input
        type="search"
        name="q"
        aria-label={t("placeholder")}
        placeholder={t("placeholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-12 text-base"
        ref={inputRef}
      />
      <Button type="submit" size="lg" className="h-12 px-6">
        {navT("search")}
      </Button>
    </form>
  );
}
