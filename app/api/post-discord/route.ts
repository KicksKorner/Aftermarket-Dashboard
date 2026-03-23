import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { TwitterApi } from "twitter-api-v2";

function formatPrice(price: string | number) {
  const num = Number(price || 0);
  return `£${num.toFixed(2)}`;
}

function makeXText(description: string, price: string, link: string) {
  let text = `🚨 ${description}\n£${price}\n${link}`;

  if (text.length > 280) {
    text = text.slice(0, 277) + "...";
  }

  return text;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      destination = "amazon",
      description,
      price,
      link,
      imageUrl,
      postToDiscord = true,
      postToX = true,
      postToFacebook = false,
    } = body;

    if (!description || !price || !link) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const results: Record<string, unknown> = {};
    const errors: Record<string, unknown> = {};

    if (postToDiscord) {
      try {
        const webhook =
          destination === "sneakers"
            ? process.env.DISCORD_WEBHOOK_SNEAKERS
            : process.env.DISCORD_WEBHOOK_AMAZON;

        if (!webhook) {
          throw new Error("Missing Discord webhook");
        }

        await axios.post(webhook, {
          embeds: [
            {
              title:
                destination === "sneakers"
                  ? "Percy Bargains Alert 🚨"
                  : "Amazon STEAL! Alert 🚨",
              description,
              color: destination === "sneakers" ? 5763719 : 3447003,
              fields: [
                {
                  name: "Price",
                  value: formatPrice(price),
                  inline: false,
                },
                {
                  name: "Deal Link",
                  value: `[View Deal](${link})`,
                  inline: false,
                },
              ],
              image: imageUrl ? { url: imageUrl } : undefined,
              footer: {
                text:
                  destination === "sneakers"
                    ? "Bargain Sniper UK • Sneakers"
                    : "Bargain Sniper UK • Deals",
              },
            },
          ],
        });

        results.discord = true;
      } catch (err: any) {
        errors.discord =
          err?.response?.data || err?.message || "Discord post failed";
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

        const tweet = await client.v2.tweet(
          makeXText(description, String(price), link)
        );

        results.x = tweet.data;
      } catch (err: any) {
        errors.x = err?.data || err?.message || "X post failed";
      }
    }

    if (postToFacebook) {
      errors.facebook =
        "Facebook posting is not supported for this Page in New Pages experience.";
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