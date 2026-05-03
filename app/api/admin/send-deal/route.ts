import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_MAP: Record<string, string | undefined> = {
  flips_update:        process.env.FLIPS_UPDATE_DISCORD_WEBHOOK_URL,
  flips:               process.env.FLIPS_DISCORD_WEBHOOK_URL,
  kicks_flips:         process.env.KICKS_FLIPS_DISCORD_WEBHOOK_URL,
  member_flips:        process.env.MEMBER_FLIPS_DISCORD_WEBHOOK_URL,
  pokemon_flips:       process.env.POKEMON_FLIPS_DISCORD_WEBHOOK_URL,
  sneaker_streetwear:  process.env.SNEAKERS_CLOTHING_DISCORD_WEBHOOK_URL,
  pokemon_investments: process.env.DISCORD_WEBHOOK_AMAZON, // reuse your existing pokemon investments webhook
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { payload, channel } = await req.json();
  if (!payload) return NextResponse.json({ error: "No payload" }, { status: 400 });

  const webhookUrl = WEBHOOK_MAP[channel];
  if (!webhookUrl) {
    return NextResponse.json({
      error: `No webhook configured for "${channel}". Add the env var and redeploy.`,
    }, { status: 400 });
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Discord error:", err);
    return NextResponse.json({ error: "Discord rejected the message: " + err }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
