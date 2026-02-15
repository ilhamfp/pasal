"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "connect-shimmer-shown";

export default function ShimmerLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [showShimmer, setShowShimmer] = useState(false);

  useEffect(() => {
    // Skip if reduced motion preferred
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Only shimmer on /peraturan/ reader pages
    if (!pathname.startsWith("/peraturan/")) return;

    // Only shimmer once per session
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    sessionStorage.setItem(STORAGE_KEY, "1");
    setShowShimmer(true);
  }, [pathname]);

  return (
    <Link href={href} className={`relative overflow-hidden ${className ?? ""}`}>
      {children}
      {showShimmer && (
        <span
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          style={{ animation: "shimmer-once 0.8s ease-in-out forwards" }}
          onAnimationEnd={() => setShowShimmer(false)}
          aria-hidden="true"
        />
      )}
    </Link>
  );
}
