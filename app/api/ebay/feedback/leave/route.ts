import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type FeedbackOrder = {
  orderId: string;
  itemId: string;
  transactionId: string;
  buyerUsername: string;
  itemTitle: string;
  saleDate: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orders, message } = await req.json() as { orders: FeedbackOrder[]; message: string };

  if (!orders?.length) {
    return NextResponse.json({ error: "No orders provided" }, { status: 400 });
  }

  // Get eBay token
  const { data: conn } = await supabase
    .from("ebay_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .single();

  if (!conn?.access_token) {
    return NextResponse.json({ error: "No eBay account connected" }, { status: 400 });
  }

  const safeMessage = (message || "Great buyer, fast payment. Highly recommended! A++")
    .replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c] || c));

  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const order of orders) {
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<LeaveFeedbackRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${conn.access_token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${order.itemId}</ItemID>
  <TransactionID>${order.transactionId}</TransactionID>
  <TargetUser>${order.buyerUsername}</TargetUser>
  <CommentType>Positive</CommentType>
  <CommentText>${safeMessage}</CommentText>
</LeaveFeedbackRequest>`;

    try {
      const res = await fetch("https://api.ebay.com/ws/api.dll", {
        method: "POST",
        headers: {
          "X-EBAY-API-SITEID": "3",
          "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
          "X-EBAY-API-CALL-NAME": "LeaveFeedback",
          "Content-Type": "text/xml",
        },
        body: xmlBody,
      });

      const xml = await res.text();
      const ack = xml.match(/<Ack>([^<]+)<\/Ack>/)?.[1];

      if (ack === "Success" || ack === "Warning") {
        successful++;
      } else {
        failed++;
        const errMsg = xml.match(/<ShortMessage>([^<]+)<\/ShortMessage>/)?.[1] || "Unknown error";
        errors.push(`${order.buyerUsername}: ${errMsg}`);
      }
    } catch (e) {
      failed++;
      errors.push(`${order.buyerUsername}: network error`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  return NextResponse.json({
    successful,
    failed,
    errors: errors.slice(0, 5),
  });
}
