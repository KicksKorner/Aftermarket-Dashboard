import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL!));

  const clientId = process.env.EBAY_CLIENT_ID!;
  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_SITE_URL}/api/ebay/callback`);
  const scopes = encodeURIComponent([
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.finances",
    "https://api.ebay.com/oauth/api_scope/sell.feedback",
    "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
  ].join(" "));

  const state = Buffer.from(user.id).toString("base64");

  const ebayAuthUrl =
    `https://auth.ebay.com/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${scopes}` +
    `&state=${state}`;

  return NextResponse.redirect(ebayAuthUrl);
}
