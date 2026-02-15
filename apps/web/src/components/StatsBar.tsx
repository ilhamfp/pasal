import { createClient } from "@/lib/supabase/server";

export default async function StatsBar() {
  const supabase = await createClient();

  const [uuResult, totalWorksResult, pasalResult] = await Promise.all([
    supabase
      .from("works")
      .select("id, regulation_types!inner(code)", { count: "exact", head: true })
      .eq("regulation_types.code", "UU"),
    supabase.from("works").select("id", { count: "exact", head: true }),
    supabase
      .from("document_nodes")
      .select("id", { count: "exact", head: true })
      .eq("node_type", "pasal"),
  ]);

  const uuCount = uuResult.count ?? 0;
  const totalWorks = totalWorksResult.count ?? 0;
  const pasalCount = pasalResult.count ?? 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="font-heading text-lg text-foreground tabular-nums">{uuCount}</span>
        Undang-Undang
      </span>
      <span aria-hidden="true" className="hidden sm:inline">·</span>
      <span className="flex items-center gap-1.5">
        <span className="font-heading text-lg text-foreground tabular-nums">{totalWorks}</span>
        Peraturan
      </span>
      <span aria-hidden="true" className="hidden sm:inline">·</span>
      <span className="flex items-center gap-1.5">
        <span className="font-heading text-lg text-foreground tabular-nums">{pasalCount}</span>
        Pasal
      </span>
      <span aria-hidden="true" className="hidden sm:inline">·</span>
      <span>100% Gratis &amp; Open Source</span>
    </div>
  );
}
