"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import PasalLogo from "./PasalLogo";

interface TocNode {
  id: number;
  number: string;
  heading: string | null;
  node_type: string;
  parent_id: number | null;
}

function TocContent({
  babs,
  pasals,
  activeId,
  onNavigate,
  pasalPrefix,
  moreArticlesLabel,
}: {
  babs: TocNode[];
  pasals: TocNode[];
  activeId?: string | null;
  onNavigate?: () => void;
  pasalPrefix: string;
  moreArticlesLabel: (count: number) => string;
}) {
  // When there are no BABs, show pasals directly
  if (babs.length === 0) {
    if (pasals.length === 0) return null;
    return (
      <ul className="space-y-1 text-sm">
        {pasals.map((pasal) => {
          const anchorId = `pasal-${pasal.number}`;
          const isActive = activeId === anchorId;
          return (
            <li key={pasal.id}>
              <a
                href={`#${anchorId}`}
                onClick={onNavigate}
                data-toc-id={anchorId}
                className={`block py-1 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  isActive
                    ? "text-foreground border-l-2 border-primary pl-2"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {pasalPrefix} {pasal.number}
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-1 text-sm">
      {babs.map((bab) => {
        const babPasals = pasals.filter((p) => p.parent_id === bab.id);
        const babAnchorId = `bab-${bab.number}`;
        const isBabActive = activeId === babAnchorId;

        return (
          <li key={bab.id}>
            <a
              href={`#${babAnchorId}`}
              onClick={onNavigate}
              data-toc-id={babAnchorId}
              className={`block py-1 font-medium rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                isBabActive
                  ? "text-foreground border-l-2 border-primary pl-2"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {bab.node_type === "aturan" ? bab.number : bab.node_type === "lampiran" ? "LAMPIRAN" : `BAB ${bab.number}`}
              {bab.heading && bab.node_type !== "aturan" && bab.node_type !== "lampiran" && (
                <span className="block text-xs font-normal truncate">
                  {bab.heading}
                </span>
              )}
            </a>
            {babPasals.length > 0 && (
              <ul className="ml-3 space-y-0.5">
                {babPasals.slice(0, 10).map((pasal) => {
                  const pasalAnchorId = `pasal-${pasal.number}`;
                  const isPasalActive = activeId === pasalAnchorId;
                  return (
                    <li key={pasal.id}>
                      <a
                        href={`#${pasalAnchorId}`}
                        onClick={onNavigate}
                        data-toc-id={pasalAnchorId}
                        className={`block py-0.5 text-xs rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                          isPasalActive
                            ? "text-foreground border-l-2 border-primary pl-2"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {pasalPrefix} {pasal.number}
                      </a>
                    </li>
                  );
                })}
                {babPasals.length > 10 && (
                  <li className="text-xs text-muted-foreground py-0.5">
                    {moreArticlesLabel(babPasals.length - 10)}
                  </li>
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function TableOfContents({
  babs,
  pasals,
}: {
  babs: TocNode[];
  pasals: TocNode[];
}) {
  const t = useTranslations("toc");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  const pasalPrefix = t("pasalPrefix");
  const moreArticlesLabel = (count: number) => t("moreArticles", { count });

  const scrollActiveIntoView = useCallback((id: string) => {
    const nav = navRef.current;
    if (!nav) return;
    const activeEl = nav.querySelector(`[data-toc-id="${id}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    // Only run scroll-spy on desktop
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    const targets = document.querySelectorAll<HTMLElement>(
      '[id^="bab-"], [id^="pasal-"]'
    );
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting entry
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length > 0) {
          const id = intersecting[0].target.id;
          setActiveId(id);
          scrollActiveIntoView(id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollActiveIntoView]);

  useEffect(() => setMounted(true), []);

  // Scroll lock + focus trap for mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = mobilePanelRef.current;
    if (panel) {
      const closeBtn = panel.querySelector<HTMLElement>("button");
      closeBtn?.focus();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        mobileTriggerRef.current?.focus();
        return;
      }

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
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <nav ref={navRef} className="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain">
        <h2 className="text-sm font-heading mb-3">{t("title")}</h2>
        <TocContent
          babs={babs}
          pasals={pasals}
          activeId={activeId}
          pasalPrefix={pasalPrefix}
          moreArticlesLabel={moreArticlesLabel}
        />
      </nav>

      {/* Mobile: floating button + slide-out overlay — portaled to body to escape hidden aside + stacking contexts */}
      {mounted && createPortal(
        <>
          <button
            ref={mobileTriggerRef}
            onClick={() => setMobileOpen(true)}
            className="lg:hidden fixed bottom-8 left-6 z-40 flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full px-4 py-2.5 shadow-sm text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
            aria-label={t("openToc")}
          >
            <PasalLogo size={18} />
            {t("title")}
          </button>

          {mobileOpen && (
            <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="toc-title">
              {/* Backdrop */}
              <button
                className="absolute inset-0 bg-black/50"
                onClick={() => setMobileOpen(false)}
                aria-label={t("closeToc")}
              />
              {/* Panel */}
              <div ref={mobilePanelRef} className="absolute left-0 top-0 bottom-0 w-[min(18rem,85vw)] bg-background border-r overflow-y-auto overscroll-contain p-4 animate-in slide-in-from-left duration-200 motion-reduce:animate-none">
                <div className="flex items-center justify-between mb-4">
                  <h2 id="toc-title" className="flex items-center gap-1.5 text-sm font-heading">
                    <PasalLogo size={18} className="text-primary" />
                    {t("title")}
                  </h2>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="text-muted-foreground hover:text-foreground p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label={t("closeToc")}
                  >
                    &times;
                  </button>
                </div>
                <TocContent
                  babs={babs}
                  pasals={pasals}
                  onNavigate={() => setMobileOpen(false)}
                  pasalPrefix={pasalPrefix}
                  moreArticlesLabel={moreArticlesLabel}
                />
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}
