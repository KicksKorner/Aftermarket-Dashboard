import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profileId } = await req.json();
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  // Snapshots cascade delete via FK, just delete the profile
  const { error } = await supabase
    .from("vinted_tracked_profiles")
    .delete()
    .eq("id", profileId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
