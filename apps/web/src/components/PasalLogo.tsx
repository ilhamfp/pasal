/**
 * Inline SVG logo mark for Pasal.id — the § seal (section sign in a ring).
 * Renders at the given size with currentColor so it inherits text color.
 */

interface PasalLogoProps {
  size?: number;
  className?: string;
}

export default function PasalLogo({ size = 32, className }: PasalLogoProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <circle cx="100" cy="100" r="72" stroke="currentColor" strokeWidth="8" />
      <line x1="100" y1="56" x2="100" y2="144" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M100,72 C112,66 126,74 126,84 C126,94 112,100 100,96" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M100,96 C88,92 74,98 74,108 C74,118 88,126 100,120" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
