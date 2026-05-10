import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const APIFY_API_KEY = process.env.APIFY_API_KEY!;
const ACTOR_ID = "bebity~vinted-premium-actor";

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

async function getUserInfoViaApify(userId: string): Promise<any | null> {
  const runUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_KEY}&timeout=60&memory=256`;

  const input = {
    action: "user",
    userId,
    country: "uk",
  };

  console.log(`Apify add: getting user info for ${userId}`);
  const res = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  console.log(`Apify add response: ${res.status}`);
  if (!res.ok) return null;

  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) return data[0];
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { input } = await req.json();
  if (!input?.trim()) return NextResponse.json({ error: "Username or URL required" }, { status: 400 });

  if (!APIFY_API_KEY) {
    return NextResponse.json({ error: "Apify API key not configured." }, { status: 500 });
  }

  const trimmed = input.trim().replace(/^@/, "");
  const numericId = extractNumericId(trimmed);
  const username = extractUsername(trimmed) || trimmed;

  if (!numericId) {
    return NextResponse.json({
      error: "Please paste the full Vinted profile URL e.g. https://www.vinted.co.uk/member/241437643-belindawhite123 — we need the numeric ID from the URL.",
    }, { status: 400 });
  }

  // Check not already tracking
  const { data: existing } = await supabase
    .from("vinted_tracked_profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("vinted_user_id", numericId)
    .single();

  if (existing) {
    return NextResponse.json({ error: "You're already tracking this profile." }, { status: 409 });
  }

  // Try to get user details via Apify
  let resolvedUsername = username;
  let displayName = username;
  let avatarUrl: string | null = null;
  let totalItems = 0;
  let profileUrl = `https://www.vinted.co.uk/member/${numericId}`;

  try {
    const userInfo = await getUserInfoViaApify(numericId);
    if (userInfo) {
      resolvedUsername = userInfo.login || userInfo.username || username;
      displayName = userInfo.real_name || userInfo.realName || resolvedUsername;
      avatarUrl = userInfo.photo?.thumbnails?.find((t: any) => t.type === "thumb150")?.url
        || userInfo.photo?.url || userInfo.avatar || null;
      totalItems = userInfo.item_count || userInfo.itemCount || 0;
      profileUrl = `https://www.vinted.co.uk/member/${numericId}`;
    }
  } catch (err) {
    console.error("Apify user info failed, proceeding with URL data:", err);
    // Continue with what we have from the URL
  }

  const { data: profile, error } = await supabase
    .from("vinted_tracked_profiles")
    .insert({
      user_id: user.id,
      vinted_user_id: numericId,
      username: resolvedUsername,
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
