"use client";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function VerificationBadge({
  verified,
}: {
  verified: boolean;
}) {
  if (verified) {
    return (
      <Badge
        className="bg-status-berlaku-bg text-status-berlaku border-status-berlaku/20"
        variant="outline"
      >
        ✓ Terverifikasi
      </Badge>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button">
          <Badge
            className="bg-status-diubah-bg text-status-diubah border-status-diubah/20 cursor-pointer hover:bg-status-diubah-bg/80 transition-colors"
            variant="outline"
          >
            ⚠ Belum Diverifikasi
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" side="bottom" align="start">
        <div className="space-y-2">
          <p className="font-medium">Apa artinya?</p>
          <ul className="space-y-1.5 text-muted-foreground text-xs">
            <li>
              Data ini diproses secara otomatis oleh parser kami berdasarkan PDF
              resmi.
            </li>
            <li>
              Belum ditinjau oleh manusia untuk memastikan akurasi 100%.
            </li>
            <li>Kami sedang memverifikasi data secara bertahap.</li>
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
