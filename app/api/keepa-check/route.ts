import { NextRequest, NextResponse } from "next/server";

type KeepaVerdict = "genuine_low" | "good_deal" | "not_a_deal" | "unknown";

type KeepaCheckResult = {
  verdict: KeepaVerdict;
  message: string;
  allTimeLowPence: number | null;
  currentPence: number | null;
};

// Keepa domain id for amazon.co.uk. See https://discuss.keepa.com/t/request-products/109
const KEEPA_DOMAIN_UK = 2;

// CSV history array indices used by Keepa's product object.
const CSV_AMAZON = 0;
const CSV_NEW = 1;

function allTimeLowFromCsv(csv: (number[] | null)[]): number | null {
  let low: number | null = null;
  for (const idx of [CSV_AMAZON, CSV_NEW]) {
    const series = csv[idx];
    if (!series) continue;
    for (let i = 1; i < series.length; i += 2) {
      const price = series[i];
      if (price == null || price < 0) continue;
      if (low === null || price < low) low = price;
    }
  }
  return low;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const asin = (body?.asin as string) || "";
    const currentPrice = Number(body?.currentPrice);

    if (!asin) {
      return NextResponse.json({ ok: false, error: "Missing ASIN." }, { status: 400 });
    }
    if (!currentPrice || Number.isNaN(currentPrice)) {
      return NextResponse.json({ ok: false, error: "Missing or invalid current price." }, { status: 400 });
    }

    const apiKey = process.env.KEEPA_API_KEY;
    if (!apiKey) {
      const result: KeepaCheckResult = {
        verdict: "unknown",
        message: "Keepa API key not configured — price history not checked.",
        allTimeLowPence: null,
        currentPence: null,
      };
      return NextResponse.json({ ok: true, ...result });
    }

    const keepaUrl = `https://api.keepa.com/product?key=${apiKey}&domain=${KEEPA_DOMAIN_UK}&asin=${asin}&stats=1&history=1`;
    const res = await fetch(keepaUrl);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Keepa API error (${res.status}).` }, { status: 502 });
    }

    const data = await res.json();
    const product = data?.products?.[0];
    if (!product || !product.csv) {
      const result: KeepaCheckResult = {
        verdict: "unknown",
        message: "No price history found on Keepa for this product yet.",
        allTimeLowPence: null,
        currentPence: null,
      };
      return NextResponse.json({ ok: true, ...result });
    }

    const allTimeLow = allTimeLowFromCsv(product.csv);
    const currentPence = Math.round(currentPrice * 100);

    if (allTimeLow === null) {
      const result: KeepaCheckResult = {
        verdict: "unknown",
        message: "Not enough price history on Keepa to verify this deal.",
        allTimeLowPence: null,
        currentPence,
      };
      return NextResponse.json({ ok: true, ...result });
    }

    let verdict: KeepaVerdict;
    let message: string;
    if (currentPence <= allTimeLow + 1) {
      verdict = "genuine_low";
      message = "This is a genuine all-time low price on Keepa.";
    } else if (currentPence <= allTimeLow * 1.15) {
      verdict = "good_deal";
      message = `Close to the all-time low (£${(allTimeLow / 100).toFixed(2)}) but not quite it.`;
    } else {
      verdict = "not_a_deal";
      message = `Price has been lower before — all-time low is £${(allTimeLow / 100).toFixed(2)}.`;
    }

    const result: KeepaCheckResult = { verdict, message, allTimeLowPence: allTimeLow, currentPence };
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Server error while checking Keepa." }, { status: 500 });
  }
}
