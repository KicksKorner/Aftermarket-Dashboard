import { NextRequest, NextResponse } from "next/server";
import {
  postToDiscord,
  postToFacebook,
  postToX,
  type DealPayload,
} from "@/lib/social-posters";

export async function POST(req: NextRequest) {
  try {
    const body: DealPayload = await req.json();

    const {
      destination = "amazon",
      destinationLabel = "Amazon",
      description,
      price,
      dealLink,
      imageUrl,
      postToDiscord: sendDiscord = true,
      postToX: sendX = true,
      postToFacebook: sendFacebook = false,
    } = body;

    if (!description || !price || !dealLink) {
      return NextResponse.json(
        {
          ok: false,
          error: "description, price and dealLink are required",
        },
        { status: 400 }
      );
    }

    const deal: DealPayload = {
      destination,
      destinationLabel,
      description,
      price,
      dealLink,
      imageUrl,
    };

    const results: Record<string, unknown> = {
      discord: null,
      x: null,
      facebook: null,
    };

    const errors: Record<string, unknown> = {};

    if (sendDiscord) {
      try {
        results.discord = await postToDiscord(deal);
      } catch (error: any) {
        errors.discord =
          error?.response?.data || error?.message || "Discord post failed";
      }
    }

    if (sendX) {
      try {
        results.x = await postToX(deal);
      } catch (error: any) {
        errors.x = error?.response?.data || error?.message || "X post failed";
      }
    }

    if (sendFacebook) {
      try {
        results.facebook = await postToFacebook(deal);
      } catch (error: any) {
        errors.facebook =
          error?.response?.data || error?.message || "Facebook post failed";
      }
    }

    return NextResponse.json({
      ok: Object.keys(errors).length === 0,
      results,
      errors,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Server error",
      },
      { status: 500 }
    );
  }
}