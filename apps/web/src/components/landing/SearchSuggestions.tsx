"use client";

import Link from "next/link";

const suggestions = [
  "hak pekerja kontrak",
  "perlindungan konsumen",
  "pidana korupsi",
];

export default function SearchSuggestions() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-sm text-muted-foreground">Coba cari:</span>
      {suggestions.map((q) => (
        <Link
          key={q}
          href={`/search?q=${encodeURIComponent(q)}`}
          className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {q}
        </Link>
      ))}
    </div>
  );
}
