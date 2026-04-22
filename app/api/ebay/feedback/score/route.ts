import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conn } = await supabase
    .from("ebay_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", user.id)
    .single();

  if (!conn?.access_token) return NextResponse.json({ error: "No eBay connection" }, { status: 404 });

  let token = conn.access_token;

  // Refresh if needed
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

  // Use sell.reputation.readonly to get feedback score
  const res = await fetch(
    "https://api.ebay.com/sell/reputation/v1/seller_standards_profile",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
      },
    }
  );

  console.log("Reputation API status:", res.status);

  if (res.ok) {
    const data = await res.json();
    console.log("Reputation data:", JSON.stringify(data).substring(0, 300));
    // Try to extract feedback score from reputation data
    const score = data.feedbackScore ?? data.overall_performance ?? 0;
    const percentage = data.positiveFeedbackPercent ?? 100;
    return NextResponse.json({ score, percentage });
  }

  // Fallback: use Trading API GetMyeBaySelling to get feedback
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <ebl:IAFToken xmlns:ebl="urn:ebay:apis:eBLBaseComponents">${token}</ebl:IAFToken>
  </RequesterCredentials>
</GetUserRequest>`;

  const tradingRes = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": "GetUser",
      "Content-Type": "text/xml",
    },
    body: xmlBody,
  });

  console.log("Trading API status:", tradingRes.status);

  if (tradingRes.ok) {
    const xml = await tradingRes.text();
    console.log("Trading API response:", xml.substring(0, 500));
    const score = parseInt(xml.match(/<FeedbackScore>(\d+)<\/FeedbackScore>/)?.[1] || "0");
    const percentage = parseFloat(xml.match(/<PositiveFeedbackPercent>([\d.]+)<\/PositiveFeedbackPercent>/)?.[1] || "0");
    if (score > 0 || percentage > 0) {
      return NextResponse.json({ score, percentage });
    }
  }

  return NextResponse.json({ error: "Could not fetch feedback score" }, { status: 500 });
}
