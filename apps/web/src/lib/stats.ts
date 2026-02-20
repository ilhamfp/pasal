import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

export const getLandingStats = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .rpc("get_landing_stats")
      .single<{
        total_works: number;
        pasal_count: number;
        min_year: number;
        max_year: number;
      }>();

    if (error) {
      console.error("Landing stats query failed:", error);
      return { totalWorks: 0, pasalCount: 0, minYear: 1945, maxYear: 2024 };
    }

    return {
      totalWorks: data.total_works ?? 0,
      pasalCount: data.pasal_count ?? 0,
      minYear: data.min_year ?? 1945,
      maxYear: data.max_year ?? 2024,
    };
  },
  ["landing-stats"],
  { tags: ["landing-stats"], revalidate: 86400 }
);
