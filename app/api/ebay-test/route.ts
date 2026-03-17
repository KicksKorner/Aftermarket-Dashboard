import { NextResponse } from "next/server";
import { getEbayAccessToken } from "@/lib/ebay";

export async function GET() {
  try {
    const token = await getEbayAccessToken();
    return NextResponse.json({
      ok: true,
      tokenPreview: `${token.slice(0, 12)}...`,
    });
  } catch (error) {
    console.error("eBay test error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}