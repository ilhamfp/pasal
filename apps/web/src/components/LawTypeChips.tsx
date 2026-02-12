"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

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
        <Badge
          key={type.code}
          variant="outline"
          className="cursor-pointer px-3 py-1 text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
          onClick={() => router.push(`/search?type=${type.code}`)}
        >
          {type.label}
        </Badge>
      ))}
    </div>
  );
}
