import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conn } = await supabase
    .from("ebay_connections")
    .select("access_token, refresh_token, token_expires_at, ebay_username")
    .eq("user_id", user.id)
    .single();

  if (!conn?.access_token) return NextResponse.json({ error: "No eBay connection" }, { status: 404 });

  let token = conn.access_token;
  let username = conn.ebay_username;

  // Refresh token if near expiry
  const expiresAt = new Date(conn.token_expires_at);
  if (expiresAt <= new Date(Date.now() + 60000)) {
    const credentials = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
    });
    if (res.ok) {
      const data = await res.json();
      token = data.access_token;
      await supabase.from("ebay_connections").update({
        access_token: token,
        token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      }).eq("user_id", user.id);
    }
  }

  // If we don't have username yet, fetch it via identity API
  if (!username) {
    try {
      const idRes = await fetch("https://apiz.ebay.com/commerce/identity/v1/user/", {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (idRes.ok) {
        const idData = await idRes.json();
        username = idData.username || "";
        if (username) {
          await supabase.from("ebay_connections").update({ ebay_username: username }).eq("user_id", user.id);
        }
      }
    } catch {}
  }

  if (!username) return NextResponse.json({ error: "Could not get eBay username" }, { status: 404 });

  // Shopping API - public, no user token needed, just App ID
  const appId = process.env.EBAY_CLIENT_ID!;
  const shopRes = await fetch(
    `https://open.api.ebay.com/shopping?callname=GetUserProfile&version=967&siteid=3&appid=${appId}&UserID=${encodeURIComponent(username)}&IncludeSelector=FeedbackHistory&responseencoding=JSON`
  );

  if (!shopRes.ok) {
    console.error("eBay Shopping API error:", shopRes.status);
    return NextResponse.json({ error: "eBay Shopping API error" }, { status: 500 });
  }

  const shopData = await shopRes.json();
  const userInfo = shopData.User;

  if (!userInfo) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    score: userInfo.FeedbackScore ?? 0,
    percentage: userInfo.PositiveFeedbackPercent ?? 0,
    username,
  });
}
