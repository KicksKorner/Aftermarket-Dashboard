import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const webhookUrl = process.env.SUCCESS_DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

  const body = await req.json();
  const { itemName, buyPrice, sellPrice, saleId } = body;

  if (!itemName || buyPrice == null || sellPrice == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Get member's Discord username
  const { data: profile } = await supabase
    .from("profiles")
    .select("discord_username, email")
    .eq("id", user.id)
    .single();

  const displayName = profile?.discord_username || profile?.email?.split("@")[0] || "A member";
  const profit = Number(sellPrice) - Number(buyPrice);
  const roi = Number(buyPrice) > 0 ? ((profit / Number(buyPrice)) * 100).toFixed(0) : "0";
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const embed = {
    author: {
      name: "Aftermarket Arbitrage · Success Channel",
    },
    title: `🏆 Win — ${itemName}`,
    description: `**${displayName}** just posted a sale to the success channel!`,
    color: 0x22c55e,
    fields: [
      { name: "Buy Price", value: `£${Number(buyPrice).toFixed(2)}`, inline: true },
      { name: "Sell Price", value: `£${Number(sellPrice).toFixed(2)}`, inline: true },
      { name: "Profit", value: `+£${profit.toFixed(2)}`, inline: true },
      { name: "ROI", value: `${roi}%`, inline: true },
    ],
    footer: {
      text: `Aftermarket Arbitrage · Members Dashboard · ${date}`,
    },
    thumbnail: {
      url: "https://i.imgur.com/your-logo.png",
    },
  };

  const payload = {
    username: "Aftermarket Arbitrage",
    embeds: [embed],
  };

  const discordRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!discordRes.ok) {
    const err = await discordRes.text();
    console.error("Discord webhook error:", err);
    return NextResponse.json({ error: "Failed to send to Discord" }, { status: 500 });
  }

  // Mark sale as shared if saleId provided
  if (saleId) {
    await supabase.from("inventory_sales").update({ shared_to_success: true }).eq("id", saleId);
  }

  return NextResponse.json({ success: true });
}
