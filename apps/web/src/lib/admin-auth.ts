import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Hardcoded admin emails — hackathon MVP, no roles table needed
const ADMIN_EMAILS = [
  "ilhamfp31@gmail.com",
  "admin@pasal.id",
];

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
