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

async function resolveVintedUser(input: string, token: string) {
  const headers = makeHeaders(token);
  const trimmed = input.trim().replace(/^@/, "");

  // ── Strategy 1: numeric ID in URL e.g. vinted.co.uk/member/241437643 ──────
  const numericId = trimmed.match(/\/member\/(\d+)/)?.[1] || (trimmed.match(/^\d+$/) ? trimmed : null);
  if (numericId) {
    const res = await fetch(`https://www.vinted.co.uk/api/v2/users/${numericId}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.user) return data.user;
    }
  }

  // ── Strategy 2: username in URL e.g. vinted.co.uk/member/belindawhite123 ──
  const usernameFromUrl = trimmed.match(/\/member\/([^/?#\d][^/?#]*)/)?.[1];
  const username = usernameFromUrl || trimmed;

  // Try direct user lookup by username via the member page endpoint
  const directRes = await fetch(
    `https://www.vinted.co.uk/api/v2/users?login=${encodeURIComponent(username)}&per_page=1`,
    { headers }
  );
  if (directRes.ok) {
    const data = await directRes.json();
    const users = data.users || [];
    const exact = users.find((u: any) => u.login?.toLowerCase() === username.toLowerCase());
    if (exact) return exact;
    if (users[0]) return users[0];
  }

  // ── Strategy 3: search query ──────────────────────────────────────────────
  const searchRes = await fetch(
    `https://www.vinted.co.uk/api/v2/users?query=${encodeURIComponent(username)}&per_page=10`,
    { headers }
  );
  if (searchRes.ok) {
    const data = await searchRes.json();
    const users = data.users || [];
    const exact = users.find((u: any) => u.login?.toLowerCase() === username.toLowerCase());
    if (exact) return exact;
    // If only one result, return it
    if (users.length === 1) return users[0];
  }

  // ── Strategy 4: try fetching the member page directly ────────────────────
  // Some Vinted accounts can be looked up via /api/v2/profiles/{username}
  const profileRes = await fetch(
    `https://www.vinted.co.uk/api/v2/profiles?username=${encodeURIComponent(username)}`,
    { headers }
  );
  if (profileRes.ok) {
    const data = await profileRes.json();
    if (data.user) return data.user;
    if (data.profile) return data.profile;
  }

  return null;
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
    return NextResponse.json({
      error: "No Vinted account connected. Connect your Vinted account in AIO Tracker → Vinted tab first.",
    }, { status: 400 });
  }

  const vintedUser = await resolveVintedUser(input, conn.access_token);

  if (!vintedUser) {
    return NextResponse.json({
      error: "Could not find that Vinted user. Try pasting the full profile URL e.g. vinted.co.uk/member/belindawhite123",
    }, { status: 404 });
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
