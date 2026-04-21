import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, clientSecret, refreshToken } = await req.json();

  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // Test the credentials by getting an access token
  const tokenData = await getAccessToken(clientId, clientSecret, refreshToken);
  if (!tokenData?.access_token) {
    return NextResponse.json({
      error: "Invalid credentials. Please check your Client ID, Client Secret and Refresh Token.",
    }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  const { error } = await supabase.from("amazon_connections").upsert({
    user_id: user.id,
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    access_token: tokenData.access_token,
    token_expires_at: expiresAt,
    marketplace_id: "A1F83G8C2ARO7P", // UK marketplace
  }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
