import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

function formatPrice(price: string | number) {
  const num = Number(price || 0);
  return `£${num.toFixed(2)}`;
}

function cleanTag(tag: string) {
  return tag.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function makeHashtags(destination: string, description: string) {
  const tags = new Set<string>();

  if (destination === "amazon") {
    tags.add("amazon");
    tags.add("deals");
    tags.add("bargain");
  }

  if (destination === "sneakers") {
    tags.add("sneakers");
    tags.add("trainers");
    tags.add("deals");
  }

  const words = description.split(/\s+/).map(cleanTag).filter(Boolean);

  for (const word of words) {
    if (
      word.length >= 4 &&
      !["womens", "mens", "huge", "savings", "with", "from", "just", "only"].includes(word)
    ) {
      tags.add(word);
    }
    if (tags.size >= 6) break;
  }

  return Array.from(tags).slice(0, 6).map((tag) => `#${tag}`).join(" ");
}

function makeXText(destination: string, description: string, price: string, link: string) {
  const title = destination === "sneakers" ? "👟 DEAL ALERT" : "📦 DEAL ALERT";
  const hashtags = makeHashtags(destination, description);

  let text = `${title}\n\n${description}\n\n💷 £${price}\n\n👉 ${link}\n\n${hashtags}`.trim();

  if (text.length > 280) {
    const reserved = `\n\n💷 £${price}\n\n👉 ${link}\n\n${hashtags}`.length + title.length + 4;
    const maxDescriptionLength = Math.max(20, 280 - reserved);
    const shortDescription =
      description.length > maxDescriptionLength
        ? `${description.slice(0, maxDescriptionLength - 1).trim()}…`
        : description;
    text = `${title}\n\n${shortDescription}\n\n💷 £${price}\n\n👉 ${link}\n\n${hashtags}`.trim();
  }

  if (text.length > 280) text = text.slice(0, 279);
  return text;
}

async function saveDealToSupabase(
  description: string,
  price: string,
  link: string,
  imageUrl: string,
  destination: string
) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const id = "d_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

  const { error } = await supabase.from("deals").insert({
    id,
    title: description,
    description: "",
    link,
    image: imageUrl || "",
    price,
    was: "",
    category: destination === "sneakers" ? "Sneakers" : "Amazon",
    badge: "",
    expiry: "",
    dotd: false,
    expired: false,
    votes: 0,
    added_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const destination = String(formData.get("destination") || "amazon");
    const description = String(formData.get("description") || "");
    const price = String(formData.get("price") || "");
    const link = String(formData.get("link") || "");
    const imageUrl = String(formData.get("imageUrl") || "");
    const postToDiscord = String(formData.get("postToDiscord")) === "true";
    const postToX = String(formData.get("postToX")) === "true";
    const postToFacebook = String(formData.get("postToFacebook")) === "true";
    const postToWebsite = String(formData.get("postToWebsite")) === "true";
    const imageFile = formData.get("imageFile") as File | null;

    if (!description || !price || !link) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    let uploadedBuffer: Buffer | null = null;
    let uploadedMimeType = "";
    let uploadedFilename = "";

    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      uploadedBuffer = Buffer.from(bytes);
      uploadedMimeType = imageFile.type || "image/jpeg";
      uploadedFilename = imageFile.name || "deal-image.jpg";
    }

    const results: Record<string, unknown> = {};
    const errors: Record<string, unknown> = {};

    if (postToDiscord) {
      try {
        const webhook =
          destination === "sneakers"
            ? process.env.DISCORD_WEBHOOK_SNEAKERS
            : process.env.DISCORD_WEBHOOK_AMAZON;

        if (!webhook) throw new Error("Missing Discord webhook");

        const title =
          destination === "sneakers"
            ? "Percy Bargains Alert 🚨"
            : "Amazon STEAL! Alert 🚨";

        const footer =
          destination === "sneakers"
            ? "Bargain Sniper UK • Sneakers"
            : "Bargain Sniper UK • Deals";

        const embed: Record<string, unknown> = {
          title,
          description,
          color: destination === "sneakers" ? 5763719 : 3447003,
          fields: [
            { name: "Price", value: formatPrice(price), inline: false },
            { name: "Deal Link", value: `[View Deal](${link})`, inline: false },
          ],
          footer: { text: footer },
        };

        if (uploadedBuffer) {
          embed.image = { url: `attachment://${uploadedFilename}` };
          const discordForm = new FormData();
          discordForm.append("payload_json", JSON.stringify({ embeds: [embed] }));
          discordForm.append(
            "files[0]",
            new Blob([new Uint8Array(uploadedBuffer)], { type: uploadedMimeType }),
            uploadedFilename
          );
          const discordResponse = await fetch(webhook, { method: "POST", body: discordForm });
          if (!discordResponse.ok) {
            const text = await discordResponse.text();
            throw new Error(text || "Discord upload failed");
          }
        } else {
          if (imageUrl) embed.image = { url: imageUrl };
          const discordResponse = await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ embeds: [embed] }),
          });
          if (!discordResponse.ok) {
            const text = await discordResponse.text();
            throw new Error(text || "Discord post failed");
          }
        }

        results.discord = true;
      } catch (err: any) {
        errors.discord = err?.message || "Discord post failed";
      }
    }

    if (postToX) {
      try {
        if (
          !process.env.X_APP_KEY ||
          !process.env.X_APP_SECRET ||
          !process.env.X_ACCESS_TOKEN ||
          !process.env.X_ACCESS_SECRET
        ) {
          throw new Error("Missing X credentials");
        }

        const client = new TwitterApi({
          appKey: process.env.X_APP_KEY,
          appSecret: process.env.X_APP_SECRET,
          accessToken: process.env.X_ACCESS_TOKEN,
          accessSecret: process.env.X_ACCESS_SECRET,
        });

        const tweetText = makeXText(destination, description, price, link);

        if (uploadedBuffer) {
          const mediaId = await client.v1.uploadMedia(uploadedBuffer, {
            mimeType: uploadedMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          });
          const tweet = await client.v2.tweet({ text: tweetText, media: { media_ids: [mediaId] } });
          results.x = tweet.data;
        } else {
          const tweet = await client.v2.tweet({ text: tweetText });
          results.x = tweet.data;
        }
      } catch (err: any) {
        errors.x = err?.data || err?.message || err?.detail || "X post failed";
      }
    }

    if (postToFacebook) {
      errors.facebook = "Facebook posting is not supported for this Page in New Pages experience.";
    }

    // ── Save to website (Supabase) ──
    if (postToWebsite) {
      try {
        results.website = await saveDealToSupabase(description, price, link, imageUrl, destination);
      } catch (err: any) {
        errors.website = err?.message || "Website post failed";
      }
    }

    return NextResponse.json({
      ok: Object.keys(errors).length === 0,
      results,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
