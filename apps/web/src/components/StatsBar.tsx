import { createClient } from "@/lib/supabase/server";

export default async function StatsBar() {
  const supabase = await createClient();

  const [worksResult, chunksResult] = await Promise.all([
    supabase.from("works").select("id", { count: "exact", head: true }),
    supabase.from("legal_chunks").select("id", { count: "exact", head: true }),
  ]);

  const works = worksResult.count ?? 0;
  const chunks = chunksResult.count ?? 0;

  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <span>{works} undang-undang</span>
      <span aria-hidden="true">·</span>
      <span>{chunks} pasal tersedia</span>
      <span aria-hidden="true">·</span>
      <span>Gratis &amp; terbuka</span>
    </div>
  );
}
