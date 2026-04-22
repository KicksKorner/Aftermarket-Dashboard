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

  const clientId = process.env.EBAY_CLIENT_ID!;
  const clientSecret = process.env.EBAY_CLIENT_SECRET!;
  const ruName = process.env.EBAY_RUNAME!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  // Exchange code for tokens
  const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ruName,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("eBay token exchange failed:", errText);
    return NextResponse.redirect(`${siteUrl}/dashboard/inventory?ebay=error`);
  }

  const tokenData = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  // Fetch eBay username
  let ebayUsername = "";
  try {
    const userRes = await fetch("https://apiz.ebay.com/commerce/identity/v1/user/", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      ebayUsername = userData.username || "";
    }
  } catch {}

  const supabase = await createClient();
  const { error } = await supabase.from("ebay_connections").upsert(
    {
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      ebay_username: ebayUsername,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to save eBay connection:", error);
    return NextResponse.redirect(`${siteUrl}/dashboard/inventory?ebay=error`);
  }

  return NextResponse.redirect(`${siteUrl}/dashboard/inventory?ebay=connected`);
}
