export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/service";
import SuggestionReviewClient from "./SuggestionReviewClient";

export default async function SuggestionReviewPage() {
  await requireAdmin();

  const sb = createServiceClient();
  const { data } = await sb
    .from("suggestions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return <SuggestionReviewClient initialSuggestions={data || []} />;
}
