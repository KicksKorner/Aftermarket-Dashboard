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

  // Refresh token if needed
  let token = conn.access_token;
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

  // Use commerce.feedback API for score
  const res = await fetch(
    "https://api.ebay.com/commerce/feedback/v1/feedback_summary?user_type=SELLER",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
      },
    }
  );

  if (!res.ok) {
    console.error("eBay feedback summary error:", res.status, await res.text());
    return NextResponse.json({ error: "eBay API error" }, { status: 500 });
  }

  const data = await res.json();
  const score = data.feedbackScore ?? data.feedback_score ?? 0;
  const percentage = data.positiveFeedbackPercent ?? data.positive_feedback_percent ?? 0;

  return NextResponse.json({ score, percentage });
}
