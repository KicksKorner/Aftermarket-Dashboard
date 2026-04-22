import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get eBay token
  const { data: conn } = await supabase
    .from("ebay_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .single();

  if (!conn?.access_token) {
    return NextResponse.json({ error: "No eBay account connected" }, { status: 400 });
  }

  // Call eBay Trading API - GetItemsAwaitingFeedback
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<GetItemsAwaitingFeedbackRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${conn.access_token}</eBayAuthToken>
  </RequesterCredentials>
  <SortingOrder>Ascending</SortingOrder>
  <Pagination>
    <EntriesPerPage>100</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
</GetItemsAwaitingFeedbackRequest>`;

  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": "GetItemsAwaitingFeedback",
      "Content-Type": "text/xml",
    },
    body: xmlBody,
  });

  if (!res.ok) {
    return NextResponse.json({ error: "eBay API error" }, { status: 500 });
  }

  const xml = await res.text();

  // Parse XML response
  const orders: {
    orderId: string;
    itemId: string;
    transactionId: string;
    buyerUsername: string;
    itemTitle: string;
    saleDate: string;
  }[] = [];

  // Extract order entries from XML
  const transactionMatches = xml.matchAll(/<TransactionArray>([\s\S]*?)<\/TransactionArray>/g);

  for (const match of transactionMatches) {
    const block = match[1];

    const itemId = block.match(/<ItemID>([^<]+)<\/ItemID>/)?.[1] || "";
    const transactionId = block.match(/<TransactionID>([^<]+)<\/TransactionID>/)?.[1] || "";
    const buyerUsername = block.match(/<UserID>([^<]+)<\/UserID>/)?.[1] || "";
    const itemTitle = block.match(/<Title>([^<]+)<\/Title>/)?.[1] || "eBay Item";
    const saleDate = block.match(/<CreatedDate>([^<]+)<\/CreatedDate>/)?.[1] || new Date().toISOString();
    const orderId = `${itemId}-${transactionId}`;

    if (itemId && transactionId && buyerUsername) {
      orders.push({ orderId, itemId, transactionId, buyerUsername, itemTitle, saleDate });
    }
  }

  return NextResponse.json({ orders, total: orders.length });
}
