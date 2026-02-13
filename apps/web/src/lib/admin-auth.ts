import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Admin emails from env var (comma-separated) — safe for open source
// Set ADMIN_EMAILS in .env.local: ADMIN_EMAILS=user@example.com,admin@pasal.id
function getAdminEmails(): string[] {
  const envEmails = process.env.ADMIN_EMAILS;
  if (envEmails) {
    return envEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

export const ADMIN_EMAILS = getAdminEmails();

export async function requireAdmin(): Promise<{ email: string; userId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/admin/login?error=unauthorized");
  }

  return { email: user.email, userId: user.id };
}

export function isAdminEmail(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
