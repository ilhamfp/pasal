import PasalLogo from "./PasalLogo";

interface DisclaimerBannerProps {
  className?: string;
}

export default function DisclaimerBanner({ className }: DisclaimerBannerProps) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border border-[#C47F17]/20 bg-[#FFF6E5] p-3 text-xs text-[#C47F17] ${className ?? ""}`}
    >
      <PasalLogo size={18} className="mt-px shrink-0 opacity-60" />
      <p>
        Konten ini bukan nasihat hukum. Selalu rujuk sumber resmi di{" "}
        <a
          href="https://peraturan.go.id"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          peraturan.go.id
        </a>{" "}
        untuk kepastian hukum.
      </p>
    </div>
  );
}
