"use client";

import { useState } from "react";
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
  onNavigate,
}: {
  babs: TocNode[];
  pasals: TocNode[];
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1 text-sm">
      {babs.map((bab) => {
        const babPasals = pasals.filter((p) => p.parent_id === bab.id);

        return (
          <li key={bab.id}>
            <a
              href={`#bab-${bab.number}`}
              onClick={onNavigate}
              className="block py-1 text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              BAB {bab.number}
              {bab.heading && (
                <span className="block text-xs font-normal truncate">
                  {bab.heading}
                </span>
              )}
            </a>
            {babPasals.length > 0 && (
              <ul className="ml-3 space-y-0.5">
                {babPasals.slice(0, 10).map((pasal) => (
                  <li key={pasal.id}>
                    <a
                      href={`#pasal-${pasal.number}`}
                      onClick={onNavigate}
                      className="block py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Pasal {pasal.number}
                    </a>
                  </li>
                ))}
                {babPasals.length > 10 && (
                  <li className="text-xs text-muted-foreground py-0.5">
                    +{babPasals.length - 10} pasal lainnya
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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <nav className="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <h2 className="text-sm font-heading mb-3">Daftar Isi</h2>
        <TocContent babs={babs} pasals={pasals} />
      </nav>

      {/* Mobile: floating button + slide-out overlay */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-6 left-6 z-40 flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full px-4 py-2.5 shadow-sm text-sm font-medium hover:bg-primary/90 transition-colors"
        aria-label="Buka daftar isi"
      >
        <PasalLogo size={18} />
        Daftar Isi
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          {/* Panel */}
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r overflow-y-auto p-4 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-1.5 text-sm font-heading">
                <PasalLogo size={18} className="text-primary" />
                Daftar Isi
              </h2>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Tutup"
              >
                &times;
              </button>
            </div>
            <TocContent
              babs={babs}
              pasals={pasals}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
