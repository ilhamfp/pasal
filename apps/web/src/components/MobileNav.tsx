"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Menu, X } from "lucide-react";
import PasalLogo from "./PasalLogo";
import LanguageSwitcher from "./LanguageSwitcher";

export default function MobileNav() {
  const t = useTranslations("navigation");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const NAV_LINKS = [
    { href: "/search" as const, label: t("search") },
    { href: "/jelajahi" as const, label: t("browse") },
    { href: "/api" as const, label: t("api") },
  ];

  useEffect(() => {
    if (!open) return;

    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the close button when drawer opens
    const panel = panelRef.current;
    if (panel) {
      const closeBtn = panel.querySelector<HTMLElement>("button[data-close]");
      closeBtn?.focus();
    }

    function onKey(e: KeyboardEvent) {
      // Close on Escape
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && panel) {
        const focusable = panel.querySelectorAll<HTMLElement>(
          "a[href], button, [tabindex]:not([tabindex='-1'])"
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
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
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
        aria-label={t("openMenu")}
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && createPortal(
        <div className="lg:hidden fixed inset-0 z-[100]" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={close}
          />
          {/* Panel — right side */}
          <div ref={panelRef} className="absolute right-0 top-0 bottom-0 w-[min(18rem,85vw)] bg-background border-l overflow-y-auto overscroll-contain p-4 animate-in slide-in-from-right duration-200 motion-reduce:animate-none">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <Link
                href="/"
                onClick={close}
                className="flex items-center gap-2 text-xl font-heading"
              >
                <PasalLogo size={24} />
                <span>Pasal<span className="text-muted-foreground">.id</span></span>
              </Link>
              <button
                data-close
                onClick={close}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("closeMenu")}
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
                {t("connect")}
              </Link>

              <div className="mt-4 px-3">
                <LanguageSwitcher />
              </div>
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
