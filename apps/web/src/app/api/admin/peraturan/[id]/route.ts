import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const workId = parseInt(id);
  if (isNaN(workId)) {
    return NextResponse.json({ error: "Invalid work ID" }, { status: 400 });
  }

  const body = await request.json();

  // Whitelist updatable fields
  const allowedFields = [
    "source_url",
    "source_pdf_url",
    "title_id",
    "title_en",
    "status",
  ];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (updates.status !== undefined) {
    const VALID_STATUSES = ["berlaku", "diubah", "dicabut", "tidak_berlaku"];
    if (!VALID_STATUSES.includes(updates.status as string)) {
      return NextResponse.json(
        { error: "Invalid status. Must be one of: berlaku, diubah, dicabut, tidak_berlaku" },
        { status: 400 }
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const sb = createServiceClient();
  const { error } = await sb.from("works").update(updates).eq("id", workId);

  if (error) {
    return NextResponse.json(
      { error: "Gagal menyimpan perubahan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Metadata berhasil diperbarui" });
}
