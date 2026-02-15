import { useTranslations } from "next-intl";
import PasalLogo from "./PasalLogo";

interface DisclaimerBannerProps {
  className?: string;
}

export default function DisclaimerBanner({ className }: DisclaimerBannerProps) {
  const t = useTranslations("disclaimer");
  return (
    <div
      className={`flex items-start gap-2 sm:gap-2.5 rounded-lg border border-status-diubah/20 bg-status-diubah-bg p-2 sm:p-3 text-xs sm:text-sm text-status-diubah ${className ?? ""}`}
    >
      <PasalLogo size={16} className="mt-px shrink-0 opacity-60 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
      <p>{t("text")}</p>
    </div>
  );
}
