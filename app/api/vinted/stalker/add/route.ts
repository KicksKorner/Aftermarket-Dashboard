import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const APIFY_API_KEY = process.env.APIFY_API_KEY!;
const ACTOR_ID = "louisdeconinck~vinted-scraper";

function extractNumericId(input: string): string | null {
  // /member/241437643 or /member/241437643-username
  const match = input.match(/\/member\/(\d+)/) || input.match(/^(\d+)$/);
  return match ? match[1] : null;
}

function extractUsername(input: string): string | null {
  // /member/241437643-belindawhite123 → belindawhite123
  const withId = input.match(/\/member\/\d+-([^/?#]+)/);
  if (withId) return withId[1];
  // /member/belindawhite123 → belindawhite123
  const withoutId = input.match(/\/member\/([^/?#\d][^/?#]*)/);
  if (withoutId) return withoutId[1];
  // plain username
  const plain = input.trim().replace(/^@/, "");
  if (!plain.includes("/") && !/^\d+$/.test(plain)) return plain;
  return null;
}

function buildProfileUrl(input: string): string {
  const trimmed = input.trim();
  // Already a full URL
  if (trimmed.startsWith("http")) return trimmed;
  // Has /member/ path
  if (trimmed.includes("/member/")) return `https://www.vinted.co.uk/${trimmed.replace(/^\//, "")}`;
  // Numeric ID
  const numId = extractNumericId(trimmed);
  if (numId) return `https://www.vinted.co.uk/member/${numId}`;
  // Username
  const username = extractUsername(trimmed);
  if (username) return `https://www.vinted.co.uk/member/${username}`;
  return `https://www.vinted.co.uk/member/${trimmed}`;
}

async function scrapeProfileForUserInfo(profileUrl: string): Promise<any | null> {
  // Run actor, get just 1 item to extract seller info
  const runUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_KEY}&timeout=60&memory=256`;

  const input = {
    startUrls: [{ url: profileUrl }],
    maxItems: 1,
    country: "UK",
  };

  console.log(`Apify add: resolving ${profileUrl}`);
  const res = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  console.log(`Apify add response: ${res.status}`);
  if (!res.ok) return null;

  const items = await res.json();
  if (!Array.isArray(items) || !items.length) return null;

  // Extract seller info from first item
  const firstItem = items[0];
  const seller = firstItem.seller || firstItem.user || firstItem.author || null;
  return seller;
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
  const profileUrl = buildProfileUrl(trimmed);
  const numericId = extractNumericId(trimmed);
  const username = extractUsername(trimmed) || trimmed;

  console.log(`Profile stalker add: input="${trimmed}" → url="${profileUrl}"`);

  // Check not already tracking (by URL pattern match)
  // We use the numeric ID if we have it, otherwise we'll get it after scraping
  if (numericId) {
    const { data: existing } = await supabase
      .from("vinted_tracked_profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("vinted_user_id", numericId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "You're already tracking this profile." }, { status: 409 });
    }
  }

  // Try to get seller info from Apify scrape
  let vintedUserId = numericId || "";
  let resolvedUsername = username;
  let displayName = username;
  let avatarUrl: string | null = null;
  let totalItems = 0;

  try {
    const seller = await scrapeProfileForUserInfo(profileUrl);
    if (seller) {
      vintedUserId = String(seller.id || seller.userId || numericId || "");
      resolvedUsername = seller.login || seller.username || username;
      displayName = seller.real_name || seller.realName || resolvedUsername;
      avatarUrl = seller.photo?.thumbnails?.find((t: any) => t.type === "thumb150")?.url
        || seller.photo?.url || seller.avatar || null;
      totalItems = seller.item_count || seller.itemCount || 0;
    } else if (!vintedUserId && !resolvedUsername) {
      return NextResponse.json({
        error: "Could not find that Vinted profile. Check the URL or username and try again.",
      }, { status: 404 });
    }
  } catch (err) {
    console.error("Apify add scrape failed:", err);
    // If scrape fails but we have enough info from the URL, continue anyway
    if (!vintedUserId && !resolvedUsername) {
      return NextResponse.json({
        error: "Could not resolve that Vinted profile. Please use the full profile URL.",
      }, { status: 404 });
    }
  }

  const finalProfileUrl = vintedUserId
    ? `https://www.vinted.co.uk/member/${vintedUserId}-${resolvedUsername}`
    : profileUrl;

  // Final duplicate check with resolved ID
  if (vintedUserId) {
    const { data: existing } = await supabase
      .from("vinted_tracked_profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("vinted_user_id", vintedUserId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "You're already tracking this profile." }, { status: 409 });
    }
  }

  const { data: profile, error } = await supabase
    .from("vinted_tracked_profiles")
    .insert({
      user_id: user.id,
      vinted_user_id: vintedUserId || resolvedUsername,
      username: resolvedUsername,
      display_name: displayName,
      profile_url: finalProfileUrl,
      avatar_url: avatarUrl,
      total_items: totalItems,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, profile });
}
