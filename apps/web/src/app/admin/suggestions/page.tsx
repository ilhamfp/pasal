export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin-auth";
import SuggestionReviewClient from "./SuggestionReviewClient";

export default async function SuggestionReviewPage() {
  await requireAdmin();
  return <SuggestionReviewClient />;
}
