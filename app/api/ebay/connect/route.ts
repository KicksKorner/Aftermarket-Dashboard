import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL!));

  const clientId = process.env.EBAY_CLIENT_ID!;

  // eBay requires the RuName as the redirect_uri — NOT the actual callback URL.
  // RuName is found in eBay Developer Portal → your Production app → User Tokens.
  const ruName = process.env.EBAY_RUNAME!;

  const scopes = encodeURIComponent([
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.finances",
  ].join(" "));

  const state = Buffer.from(user.id).toString("base64");

  const ebayAuthUrl =
    `https://auth.ebay.com/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(ruName)}` +
    `&scope=${scopes}` +
    `&state=${state}`;

  return NextResponse.redirect(ebayAuthUrl);
}
