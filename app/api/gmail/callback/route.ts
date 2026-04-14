import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/dashboard/gmail-sync?gmail=error`);
  }

  let userId: string;
  try {
    userId = Buffer.from(state, "base64").toString("utf-8");
  } catch {
    return NextResponse.redirect(`${siteUrl}/dashboard/gmail-sync?gmail=error`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${siteUrl}/dashboard/gmail-sync?gmail=error`);
  }

  const tokenData = await tokenRes.json();

  // Get the connected Gmail address
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userInfo = userInfoRes.ok ? await userInfoRes.json() : null;

  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("gmail_connections").upsert(
    {
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      gmail_address: userInfo?.email ?? null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to save Gmail connection:", error);
    return NextResponse.redirect(`${siteUrl}/dashboard/gmail-sync?gmail=error`);
  }

  return NextResponse.redirect(`${siteUrl}/dashboard/gmail-sync?gmail=connected`);
}
