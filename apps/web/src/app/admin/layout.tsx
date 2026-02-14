export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin-auth";
import PasalLogo from "@/components/PasalLogo";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Soft auth check — don't redirect here so /admin/login is accessible.
  // Each protected page calls requireAdmin() itself, or is behind the admin chrome.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = user?.email && isAdminEmail(user.email) ? { email: user.email } : null;

  // If not admin, render children without admin chrome (login page renders here)
  if (!admin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between py-3 px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2 font-heading text-lg">
              <PasalLogo size={24} />
              Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/admin/suggestions" className="text-muted-foreground hover:text-foreground">
                Saran
              </Link>
              <Link href="/admin/scraper" className="text-muted-foreground hover:text-foreground">
                Scraper
              </Link>
            </nav>
          </div>
          <span className="text-xs text-muted-foreground">{admin.email}</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
