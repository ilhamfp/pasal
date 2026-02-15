import PasalLogo from "./PasalLogo";

interface DisclaimerBannerProps {
  className?: string;
}

export default function DisclaimerBanner({ className }: DisclaimerBannerProps) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border border-status-diubah/20 bg-status-diubah-bg p-3 text-xs text-status-diubah ${className ?? ""}`}
    >
      <PasalLogo size={18} className="mt-px shrink-0 opacity-60" />
      <p>
        Konten ini bukan nasihat hukum. Selalu rujuk sumber resmi untuk
        kepastian hukum.
      </p>
    </div>
  );
}
