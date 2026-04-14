import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isOrderEmail, parseEmail } from "@/lib/gmail/email-parser";

async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBody(payload: Record<string, unknown>): string {
  // Try plain text first, then HTML
  const mimeType = payload.mimeType as string;
  const body = payload.body as Record<string, unknown>;
  const parts = payload.parts as Record<string, unknown>[] | undefined;

  if (mimeType === "text/plain" && body?.data) {
    return decodeBase64Url(body.data as string);
  }

  if (parts) {
    for (const part of parts) {
      const partMime = part.mimeType as string;
      const partBody = part.body as Record<string, unknown>;
      const subParts = part.parts as Record<string, unknown>[] | undefined;

      if (partMime === "text/plain" && partBody?.data) {
        return decodeBase64Url(partBody.data as string);
      }
      // Recurse into multipart
      if (subParts) {
        for (const sub of subParts) {
          const subMime = sub.mimeType as string;
          const subBody = sub.body as Record<string, unknown>;
          if (subMime === "text/plain" && subBody?.data) {
            return decodeBase64Url(subBody.data as string);
          }
        }
      }
    }
    // Fall back to HTML
    for (const part of parts) {
      const partMime = part.mimeType as string;
      const partBody = part.body as Record<string, unknown>;
      if (partMime === "text/html" && partBody?.data) {
        const html = decodeBase64Url(partBody.data as string);
        return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      }
    }
  }

  if (mimeType === "text/html" && body?.data) {
    const html = decodeBase64Url(body.data as string);
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }

  return "";
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get Gmail connection
  const { data: conn } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!conn) return NextResponse.json({ error: "No Gmail account connected" }, { status: 400 });

  let accessToken = conn.access_token;

  // Refresh if expired
  if (new Date(conn.token_expires_at) <= new Date()) {
    const refreshed = await refreshGoogleToken(conn.refresh_token);
    if (!refreshed) return NextResponse.json({ error: "Token refresh failed. Please reconnect Gmail." }, { status: 401 });

    accessToken = refreshed.access_token;
    await supabase.from("gmail_connections").update({
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
    }).eq("user_id", user.id);
  }

  // Search Gmail for order confirmation emails (last 90 days)
  const after = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
  const query = encodeURIComponent(`subject:(order OR confirmation OR purchase OR receipt) after:${after}`);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    return NextResponse.json({ error: "Failed to fetch Gmail messages" }, { status: 500 });
  }

  const listData = await listRes.json();
  const messages = listData.messages ?? [];

  let synced = 0;
  let skipped = 0;

  for (const msg of messages) {
    // Check if already imported
    const { data: existing } = await supabase
      .from("gmail_imports")
      .select("id")
      .eq("user_id", user.id)
      .eq("message_id", msg.id)
      .single();

    if (existing) { skipped++; continue; }

    // Fetch full message
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!msgRes.ok) continue;

    const msgData = await msgRes.json();
    const headers = msgData.payload?.headers ?? [];
    const subject = getHeader(headers, "subject");
    const from = getHeader(headers, "from");
    const date = getHeader(headers, "date");
    const body = extractBody(msgData.payload ?? {});

    // Only process order confirmation emails
    if (!isOrderEmail(subject, from, body)) { skipped++; continue; }

    const parsed = parseEmail({ subject, from, body, receivedDate: date });

    await supabase.from("gmail_imports").insert({
      user_id: user.id,
      message_id: msg.id,
      thread_id: msgData.threadId ?? null,
      retailer: parsed.retailer,
      sender_email: from,
      subject,
      order_number: parsed.order_number,
      order_date: parsed.order_date,
      order_total_gbp: parsed.order_total_gbp,
      parsed_items: parsed.items,
      raw_email_text: body.slice(0, 5000),
      raw_payload: null,
      status: "pending",
    });

    synced++;
  }

  return NextResponse.json({ synced, skipped, message: `${synced} new orders found, ${skipped} already imported or skipped` });
}
