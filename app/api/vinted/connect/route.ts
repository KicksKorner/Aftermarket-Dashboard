import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accessToken, refreshToken } = await req.json();
  if (!accessToken?.trim()) {
    return NextResponse.json({ error: "Access token is required" }, { status: 400 });
  }

  // Validate token by calling Vinted API
  const res = await fetch("https://www.vinted.co.uk/api/v2/users/current", {
    headers: {
      "Authorization": `Bearer ${accessToken.trim()}`,
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    return NextResponse.json({
      error: "Invalid token. Please check you copied the correct value and try again.",
    }, { status: 400 });
  }

  const data = await res.json();
  const vintedUserId = String(data.user?.id || "");
  const username = data.user?.login || "";

  const { error } = await supabase.from("vinted_connections").upsert({
    user_id: user.id,
    access_token: accessToken.trim(),
    vinted_user_id: vintedUserId,
    ...(refreshToken ? { refresh_token: refreshToken.trim() } : {}),
  }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, username, vintedUserId });
}
