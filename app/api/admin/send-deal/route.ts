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

  const body = await req.json();
  const { payload, channel, imageUrl } = body;
  if (!payload) return NextResponse.json({ error: "No payload" }, { status: 400 });

  const webhookUrl = WEBHOOK_MAP[channel];
  if (!webhookUrl) {
    return NextResponse.json({
      error: `No webhook configured for "${channel}". Add the env var and redeploy.`,
    }, { status: 400 });
  }



  // If we have an image URL from Supabase, fetch it and send as attachment
  // This ensures Discord renders it properly
  if (imageUrl && imageUrl.startsWith("http")) {
    try {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const imgBuffer = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const ext = contentType.split("/")[1]?.split("+")[0] || "jpg";
        const filename = `deal-image.${ext}`;

        // Update embed to reference the attachment
        if (payload.embeds?.[0]) {
          payload.embeds[0].image = { url: `attachment://${filename}` };
        }

        const formData = new FormData();
        formData.append("payload_json", JSON.stringify(payload));
        formData.append("files[0]", new Blob([imgBuffer], { type: contentType }), filename);

        const res = await fetch(webhookUrl, { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.text();
          console.error("Discord error with attachment:", err);
          // Fall through to try without attachment
        } else {
          return NextResponse.json({ ok: true });
        }
      }
    } catch (e) {
      console.error("Image attachment failed, sending without:", e);
    }
  }

  // Send without image attachment (or as fallback)
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
