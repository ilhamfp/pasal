"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CopyButton({
  text,
  label,
  icon,
}: {
  text: string;
  label?: string;
  icon?: React.ReactNode;
}) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs h-7"
      onClick={handleCopy}
    >
      <span aria-live="polite" className="flex items-center gap-1">
        {copied ? (
          <>
            <Check aria-hidden="true" className="h-3 w-3 text-primary animate-in zoom-in-75 duration-150" />
            <span className="hidden sm:inline">{t("copied")}</span>
          </>
        ) : (
          <>
            {icon || <Copy aria-hidden="true" className="h-3 w-3" />}
            <span className="hidden sm:inline">{label || t("copy")}</span>
          </>
        )}
      </span>
    </Button>
  );
}
