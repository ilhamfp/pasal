"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SearchBar({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl gap-2">
      <Input
        type="search"
        placeholder='Cari hukum Indonesia... (cth: "ketenagakerjaan", "perkawinan")'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-12 text-base"
        autoFocus={autoFocus}
      />
      <Button type="submit" size="lg" className="h-12 px-6">
        Cari
      </Button>
    </form>
  );
}
