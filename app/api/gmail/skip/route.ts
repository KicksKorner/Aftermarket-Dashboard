import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { importId } = await req.json();
  if (!importId) return NextResponse.json({ error: "Missing importId" }, { status: 400 });

  await supabase.from("gmail_imports").update({
    status: "skipped",
    skipped_at: new Date().toISOString(),
  }).eq("id", importId).eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
