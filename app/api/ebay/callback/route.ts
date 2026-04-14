import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/dashboard/inventory?ebay=error`);
  }

  let userId: string;
  try {
    userId = Buffer.from(state, "base64").toString("utf-8");
  } catch {
    return NextResponse.redirect(`${siteUrl}/dashboard/inventory?ebay=error`);
  }

  // Exchange code for tokens
  const clientId = process.env.EBAY_CLIENT_ID!;
  const clientSecret = process.env.EBAY_CLIENT_SECRET!;
  const redirectUri = `${siteUrl}/api/ebay/callback`;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    console.error("eBay token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${siteUrl}/dashboard/inventory?ebay=error`);
  }

  const tokenData = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("ebay_connections").upsert(
    {
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to save eBay connection:", error);
    return NextResponse.redirect(`${siteUrl}/dashboard/inventory?ebay=error`);
  }

  return NextResponse.redirect(`${siteUrl}/dashboard/inventory?ebay=connected`);
}
