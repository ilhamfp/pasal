import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";
import { FileText, MessageSquare, History } from "lucide-react";
import Link from "next/link";
import RevalidateButton from "@/components/admin/RevalidateButton";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const sb = createServiceClient();

  // Fetch stats
  const [worksRes, suggestionsRes, pendingRes, revisionsRes] = await Promise.all([
    sb.from("works").select("id", { count: "exact", head: true }),
    sb.from("suggestions").select("id", { count: "exact", head: true }),
    sb.from("suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("revisions").select("id", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Total Peraturan", value: worksRes.count || 0, icon: FileText, href: "/jelajahi" },
    { label: "Total Saran", value: suggestionsRes.count || 0, icon: MessageSquare, href: "/admin/suggestions" },
    { label: "Saran Pending", value: pendingRes.count || 0, icon: MessageSquare, href: "/admin/suggestions" },
    { label: "Total Revisi", value: revisionsRes.count || 0, icon: History },
  ];

  // Recent suggestions
  const { data: recentSuggestions } = await sb
    .from("suggestions")
    .select("id, node_number, status, created_at, submitter_email")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Dashboard</h1>
        <RevalidateButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 sm:mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {stat.href && (
                <Link href={stat.href} className="text-xs text-primary hover:text-primary/80">
                  Lihat
                </Link>
              )}
            </div>
            <p className="font-heading text-2xl">{stat.value.toLocaleString("id-ID")}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-heading text-lg">Saran Terbaru</h2>
          <Link href="/admin/suggestions" className="text-sm text-primary hover:text-primary/80">
            Lihat Semua
          </Link>
        </div>
        <div className="divide-y">
          {(recentSuggestions || []).map((s) => (
            <div key={s.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Pasal {s.node_number || "?"}</p>
                <p className="text-xs text-muted-foreground">
                  {s.submitter_email || "Anonim"} &middot;{" "}
                  {new Date(s.created_at).toLocaleDateString("id-ID")}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                s.status === "pending" ? "bg-amber-50 text-amber-700" :
                s.status === "approved" ? "bg-green-50 text-green-700" :
                "bg-red-50 text-red-700"
              }`}>
                {s.status}
              </span>
            </div>
          ))}
          {(!recentSuggestions || recentSuggestions.length === 0) && (
            <div className="p-4 sm:p-8 text-center text-muted-foreground text-sm">
              Belum ada saran.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
