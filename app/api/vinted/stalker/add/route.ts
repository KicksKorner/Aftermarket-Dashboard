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

function extractNumericId(input: string): string | null {
  const match = input.match(/\/member\/(\d+)/) || input.match(/^(\d+)$/);
  return match ? match[1] : null;
}

function extractUsername(input: string): string | null {
  const withId = input.match(/\/member\/\d+-([^/?#]+)/);
  if (withId) return withId[1];
  const withoutId = input.match(/\/member\/([^/?#\d][^/?#]*)/);
  if (withoutId) return withoutId[1];
  const plain = input.trim().replace(/^@/, "");
  if (!plain.includes("/") && !/^\d+$/.test(plain)) return plain;
  return null;
}

async function tryRefreshToken(supabase: any, userId: string, refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.vinted.co.uk/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: "android",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data.access_token;
    if (newToken) {
      await supabase.from("vinted_connections").update({
        access_token: newToken,
        ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
      }).eq("user_id", userId);
      return newToken;
    }
  } catch { return null; }
  return null;
}

async function getValidToken(supabase: any, userId: string): Promise<string | null> {
  const { data: conn } = await supabase
    .from("vinted_connections")
    .select("access_token, refresh_token")
    .eq("user_id", userId)
    .single();

  if (!conn?.access_token) return null;

  // Test if token is valid
  const testRes = await fetch("https://www.vinted.co.uk/api/v2/users/current", {
    headers: makeHeaders(conn.access_token),
  });

  if (testRes.ok) return conn.access_token;

  // Token expired — try refresh
  if (conn.refresh_token) {
    console.log("Vinted stalker: token expired, attempting refresh");
    const refreshed = await tryRefreshToken(supabase, userId, conn.refresh_token);
    if (refreshed) {
      console.log("Vinted stalker: token refreshed successfully");
      return refreshed;
    }
  }

  console.log("Vinted stalker: token invalid and refresh failed");
  return null;
}

async function resolveVintedUser(input: string, token: string) {
  const headers = makeHeaders(token);
  const trimmed = input.trim().replace(/^@/, "");

  // Strategy 1: numeric ID → direct fetch
  const numericId = extractNumericId(trimmed);
  if (numericId) {
    console.log(`Vinted stalker: direct ID lookup for ${numericId}`);
    const res = await fetch(`https://www.vinted.co.uk/api/v2/users/${numericId}`, { headers });
    console.log(`Vinted stalker: direct ID status ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      if (data.user) return data.user;
    }
  }

  // Strategy 2: username search
  const username = extractUsername(trimmed);
  if (username) {
    console.log(`Vinted stalker: username search for ${username}`);
    const loginRes = await fetch(
      `https://www.vinted.co.uk/api/v2/users?login=${encodeURIComponent(username)}&per_page=5`,
      { headers }
    );
    console.log(`Vinted stalker: login search status ${loginRes.status}`);
    if (loginRes.ok) {
      const data = await loginRes.json();
      const users = data.users || [];
      const exact = users.find((u: any) => u.login?.toLowerCase() === username.toLowerCase());
      if (exact) return exact;
    }

    const queryRes = await fetch(
      `https://www.vinted.co.uk/api/v2/users?query=${encodeURIComponent(username)}&per_page=10`,
      { headers }
    );
    console.log(`Vinted stalker: query search status ${queryRes.status}`);
    if (queryRes.ok) {
      const data = await queryRes.json();
      const users = data.users || [];
      const exact = users.find((u: any) => u.login?.toLowerCase() === username.toLowerCase());
      if (exact) return exact;
      if (users.length === 1) return users[0];
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { input } = await req.json();
  if (!input?.trim()) return NextResponse.json({ error: "Username or URL required" }, { status: 400 });

  // Get a valid (possibly refreshed) token
  const token = await getValidToken(supabase, user.id);

  if (!token) {
    return NextResponse.json({
      error: "Your Vinted token has expired. Please reconnect your Vinted account in AIO Tracker → Vinted tab with a fresh token.",
    }, { status: 401 });
  }

  const vintedUser = await resolveVintedUser(input.trim(), token);

  if (!vintedUser) {
    return NextResponse.json({
      error: "Could not find that Vinted user. Try the full profile URL e.g. https://www.vinted.co.uk/member/241437643-belindawhite123",
    }, { status: 404 });
  }

  const vintedUserId = String(vintedUser.id);
  const username = vintedUser.login || "";
  const displayName = vintedUser.real_name || vintedUser.login || "";
  const avatarUrl =
    vintedUser.photo?.thumbnails?.find((t: any) => t.type === "thumb150")?.url ||
    vintedUser.photo?.url ||
    null;
  const profileUrl = vintedUser.profile_url || `https://www.vinted.co.uk/member/${vintedUserId}-${username}`;
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
