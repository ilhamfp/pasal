"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("verification");

  if (verified) {
    return (
      <Badge
        className="bg-status-berlaku-bg text-status-berlaku border-status-berlaku/20"
        variant="outline"
      >
        ✓ {t("verified")}
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
            ⚠ {t("unverified")}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" side="bottom" align="start">
        <div className="space-y-2">
          <p className="font-medium">{t("unverifiedTitle")}</p>
          <ul className="space-y-1.5 text-muted-foreground text-xs">
            <li>{t("unverifiedReason1")}</li>
            <li>{t("unverifiedReason2")}</li>
            <li>{t("unverifiedReason3")}</li>
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
