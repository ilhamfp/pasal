export default function DisclaimerBanner({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3 text-xs text-amber-800 dark:text-amber-200 ${className ?? ""}`}
    >
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
    </div>
  );
}
