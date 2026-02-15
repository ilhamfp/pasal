"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import PasalLogo from "./PasalLogo";

const NAV_LINKS = [
  { href: "/jelajahi", label: "Jelajahi" },
  { href: "/api", label: "API" },
] as const;

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Close on Escape
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
        aria-label="Buka menu navigasi"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={close}
          />
          {/* Panel — right side */}
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-background border-l overflow-y-auto p-4 animate-in slide-in-from-right duration-200 motion-reduce:animate-none">
            <div className="flex items-center justify-between mb-6">
              <Link
                href="/"
                onClick={close}
                className="flex items-center gap-2 text-xl font-heading"
              >
                <PasalLogo size={24} />
                <span>Pasal<span className="text-muted-foreground">.id</span></span>
              </Link>
              <button
                onClick={close}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className="rounded-lg px-3 py-2.5 text-base text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                >
                  {label}
                </Link>
              ))}

              <Link
                href="/connect"
                onClick={close}
                className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-sans font-semibold text-primary-foreground text-center transition-colors hover:bg-primary/90"
              >
                Hubungkan Claude
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
