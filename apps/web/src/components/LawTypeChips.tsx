"use client";

import { useRouter } from "@/i18n/routing";

const LAW_TYPES = [
  { code: "UU", label: "Undang-Undang" },
  { code: "PP", label: "Peraturan Pemerintah" },
  { code: "PERPRES", label: "Perpres" },
  { code: "PERMEN", label: "Permen" },
];

export default function LawTypeChips() {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      {LAW_TYPES.map((type) => (
        <button
          key={type.code}
          type="button"
          className="inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => router.push(`/search?type=${type.code}`)}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}
