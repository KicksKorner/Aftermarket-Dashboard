import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conn } = await supabase
    .from("ebay_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .single();

  if (!conn?.access_token) {
    return NextResponse.json({ error: "No eBay connection" }, { status: 404 });
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetFeedbackRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${conn.access_token}</eBayAuthToken>
  </RequesterCredentials>
</GetFeedbackRequest>`;

  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": "GetFeedback",
      "Content-Type": "text/xml",
    },
    body: xml,
  });

  if (!res.ok) return NextResponse.json({ error: "eBay API error" }, { status: 500 });

  const text = await res.text();
  const score = parseInt(text.match(/<FeedbackScore>(\d+)<\/FeedbackScore>/)?.[1] || "0");
  const percentage = parseFloat(text.match(/<PositiveFeedbackPercent>([\d.]+)<\/PositiveFeedbackPercent>/)?.[1] || "0");

  return NextResponse.json({ score, percentage });
}
