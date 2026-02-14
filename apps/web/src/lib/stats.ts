import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const getLandingStats = unstable_cache(
  async () => {
    const [totalWorksResult, pasalResult, minYearResult, maxYearResult] =
      await Promise.all([
        supabase.from("works").select("id", { count: "exact", head: true }),
        supabase
          .from("document_nodes")
          .select("id", { count: "exact", head: true })
          .eq("node_type", "pasal"),
        supabase
          .from("works")
          .select("year")
          .order("year", { ascending: true })
          .limit(1)
          .single(),
        supabase
          .from("works")
          .select("year")
          .order("year", { ascending: false })
          .limit(1)
          .single(),
      ]);

    return {
      totalWorks: totalWorksResult.count ?? 0,
      pasalCount: pasalResult.count ?? 0,
      minYear: minYearResult.data?.year ?? 1974,
      maxYear: maxYearResult.data?.year ?? 2023,
    };
  },
  ["landing-stats"],
  { tags: ["landing-stats"], revalidate: 86400 }
);
