import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { affiliatePayload, type PostPayload } from "@/lib/amazon-affiliate";

// Channel IDs keep their old names: kicks_flips is shown as "flips", pokemon_flips as "pokemon-info".
const WEBHOOK_MAP: Record<string, string | undefined> = {
  kicks_flips:         process.env.KICKS_FLIPS_DISCORD_WEBHOOK_URL,
  sneaker_streetwear:  process.env.SNEAKERS_CLOTHING_DISCORD_WEBHOOK_URL,
  pokemon_flips:       process.env.POKEMON_FLIPS_DISCORD_WEBHOOK_URL,
  brick_flips:         process.env.BRICK_FLIPS_DISCORD_WEBHOOK_URL,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, discord_username").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { payload: sentPayload, channel, style, imageUrl } = await req.json();
  if (!sentPayload) return NextResponse.json({ error: "No payload" }, { status: 400 });

  const webhookUrl = WEBHOOK_MAP[channel];
  if (!webhookUrl) {
    return NextResponse.json({
      error: `No webhook configured for "${channel}". Add the env var and redeploy.`,
    }, { status: 400 });
  }

  // Tagged again here, whatever the browser sent, so no Amazon link reaches
  // members without Lewis's tag.
  const { payload, products } = await affiliatePayload(sentPayload as PostPayload);

  const sent = await postToDiscord(webhookUrl, payload, imageUrl);
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 500 });

  // One row per post that reached Discord: the Lead Tracker counts these.
  const logged = await logPost({
    user_id: user.id,
    email: user.email ?? null,
    discord_username: profile?.discord_username ?? null,
    channel,
    style: typeof style === "string" ? style : null,
    title: payload.embeds?.[0]?.title ?? null,
    products,
  });

  return NextResponse.json({ ok: true, logged });
}

async function postToDiscord(webhookUrl: string, payload: PostPayload, imageUrl?: string): Promise<{ ok: true } | { ok: false; error: string }> {
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

        if (discordRes.ok) return { ok: true };

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
    return { ok: false, error: `Discord error ${res.status}: ${err}` };
  }

  return { ok: true };
}

// deal_posts has row level security on and no policies, so only the service
// role reads or writes it. A failed insert never blocks the post itself.
async function logPost(row: Record<string, unknown>): Promise<boolean> {
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await admin.from("deal_posts").insert(row);
  if (error) {
    console.error("deal_posts insert failed:", error.message);
    return false;
  }
  return true;
}
