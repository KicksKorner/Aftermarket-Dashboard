import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_MAP: Record<string, string | undefined> = {
  flips_update:        process.env.FLIPS_UPDATE_DISCORD_WEBHOOK_URL,
  flips:               process.env.FLIPS_DISCORD_WEBHOOK_URL,
  kicks_flips:         process.env.KICKS_FLIPS_DISCORD_WEBHOOK_URL,
  member_flips:        process.env.MEMBER_FLIPS_DISCORD_WEBHOOK_URL,
  pokemon_flips:       process.env.POKEMON_FLIPS_DISCORD_WEBHOOK_URL,
  sneaker_streetwear:  process.env.SNEAKERS_CLOTHING_DISCORD_WEBHOOK_URL,
  pokemon_investments: process.env.POKEMON_INVESTMENTS_DISCORD_WEBHOOK_URL,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { payload, channel, imageUrl } = await req.json();
  if (!payload) return NextResponse.json({ error: "No payload" }, { status: 400 });

  const webhookUrl = WEBHOOK_MAP[channel];
  if (!webhookUrl) {
    return NextResponse.json({
      error: `No webhook configured for "${channel}". Add the env var and redeploy.`,
    }, { status: 400 });
  }

  // If we have an image, fetch it from Supabase and send as multipart
  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const imgBuffer = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : contentType.includes("webp") ? "webp" : "jpg";
        const filename = `image.${ext}`;

        // Set embed image to use attachment reference
        const payloadWithImage = JSON.parse(JSON.stringify(payload));
        if (payloadWithImage.embeds?.[0]) {
          payloadWithImage.embeds[0].image = { url: `attachment://${filename}` };
        }

        const form = new FormData();
        form.append("payload_json", JSON.stringify(payloadWithImage));
        form.append("files[0]", new Blob([imgBuffer], { type: contentType }), filename);

        const discordRes = await fetch(webhookUrl, { method: "POST", body: form });

        if (discordRes.ok) return NextResponse.json({ ok: true });

        const errText = await discordRes.text();
        console.error("Discord multipart error:", discordRes.status, errText);
        // Fall through to JSON send without image
      }
    } catch (e) {
      console.error("Image fetch/send error:", e);
    }
  }

  // Send as plain JSON (no image or fallback)
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Discord JSON error:", res.status, err);
    return NextResponse.json({ error: `Discord error ${res.status}: ${err}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
