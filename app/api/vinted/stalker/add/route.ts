import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function makeHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9",
    "X-Client-Id": "web",
    Referer: "https://www.vinted.co.uk/",
    Origin: "https://www.vinted.co.uk",
  };
}

// Resolve username or URL to a Vinted user object
async function resolveVintedUser(input: string, token: string) {
  // Extract username from URL if needed
  let username = input.trim();
  const urlMatch = username.match(/vinted\.co\.uk\/(?:member\/)?([^/?#]+)/i);
  if (urlMatch) username = urlMatch[1];
  // Remove leading @ if present
  username = username.replace(/^@/, "");

  const res = await fetch(
    `https://www.vinted.co.uk/api/v2/users?query=${encodeURIComponent(username)}&per_page=5`,
    { headers: makeHeaders(token) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const users = data.users || [];
  // Find exact match first, then fallback to first result
  const exact = users.find((u: any) =>
    u.login?.toLowerCase() === username.toLowerCase()
  );
  return exact || users[0] || null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { input } = await req.json();
  if (!input?.trim()) return NextResponse.json({ error: "Username or URL required" }, { status: 400 });

  // Get Vinted token
  const { data: conn } = await supabase
    .from("vinted_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .single();

  if (!conn?.access_token) {
    return NextResponse.json({ error: "No Vinted account connected. Connect your Vinted account first." }, { status: 400 });
  }

  const vintedUser = await resolveVintedUser(input, conn.access_token);
  if (!vintedUser) {
    return NextResponse.json({ error: "Could not find that Vinted user. Check the username or URL and try again." }, { status: 404 });
  }

  const vintedUserId = String(vintedUser.id);
  const username = vintedUser.login || "";
  const displayName = vintedUser.real_name || vintedUser.login || "";
  const avatarUrl = vintedUser.photo?.url || vintedUser.photo?.thumbnails?.[0]?.url || null;
  const profileUrl = `https://www.vinted.co.uk/member/${username}`;
  const totalItems = vintedUser.item_count || 0;

  // Check not already tracking
  const { data: existing } = await supabase
    .from("vinted_tracked_profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("vinted_user_id", vintedUserId)
    .single();

  if (existing) {
    return NextResponse.json({ error: "You're already tracking this profile." }, { status: 409 });
  }

  const { data: profile, error } = await supabase
    .from("vinted_tracked_profiles")
    .insert({
      user_id: user.id,
      vinted_user_id: vintedUserId,
      username,
      display_name: displayName,
      profile_url: profileUrl,
      avatar_url: avatarUrl,
      total_items: totalItems,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, profile });
}
