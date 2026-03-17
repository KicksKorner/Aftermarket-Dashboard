type EbayAccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type EbayItemSummary = {
  title?: string;
  price?: {
    value?: string;
    currency?: string;
  };
  condition?: string;
  itemWebUrl?: string;
};

export type EbaySearchResponse = {
  itemSummaries?: EbayItemSummary[];
  total?: number;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function getBasicAuth() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET");
  }

  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function getEbayAccessToken() {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get eBay token: ${text}`);
  }

  const data = (await response.json()) as EbayAccessTokenResponse;

  cachedToken = {
    value: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

export async function searchEbayListings(params: {
  query: string;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
}) {
  const token = await getEbayAccessToken();
  const marketplaceId = process.env.EBAY_MARKETPLACE_ID || "EBAY_GB";

  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", params.query);
  url.searchParams.set("limit", String(params.limit ?? 25));

  const filterParts = ["buyingOptions:{FIXED_PRICE}", "conditionIds:{1000|1500}"];

  if (params.minPrice != null && params.maxPrice != null) {
    filterParts.push(`price:[${params.minPrice}..${params.maxPrice}]`);
  }

  url.searchParams.set("filter", filterParts.join(","));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay search failed: ${text}`);
  }

  return (await response.json()) as EbaySearchResponse;
}

export async function searchEbayBySku(query: string) {
  return searchEbayListings({
    query: `${query} Nike Dunk`,
    limit: 25,
    minPrice: 30,
    maxPrice: 300,
  });
}

export function extractPricesFromSearch(
  response: EbaySearchResponse,
  sku: string
) {
  const items = response.itemSummaries ?? [];

  return items
    .filter((item) => {
      const title = item.title?.toLowerCase() || "";
      const normalisedSku = sku.toLowerCase();

      const hasSku = title.includes(normalisedSku);
      const hasNikeKeywords =
        title.includes("nike") ||
        title.includes("dunk") ||
        title.includes("panda");

      if (!hasSku && !hasNikeKeywords) {
        return false;
      }

      if (
        title.includes("gs") ||
        title.includes("grade school") ||
        title.includes("junior") ||
        title.includes("youth") ||
        title.includes("kids") ||
        title.includes("td") ||
        title.includes("toddler") ||
        title.includes("infant")
      ) {
        return false;
      }

      if (
        title.includes("damaged") ||
        title.includes("no box") ||
        title.includes("defect") ||
        title.includes("spares") ||
        title.includes("replacement box") ||
        title.includes("empty box")
      ) {
        return false;
      }

      return true;
    })
    .map((item) => Number(item.price?.value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function summarisePrices(prices: number[]) {
  if (prices.length === 0) return null;

  const sorted = [...prices].sort((a, b) => a - b);

  let trimmed = sorted;

  if (sorted.length >= 10) {
    const trimCount = Math.floor(sorted.length * 0.1);
    trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  } else if (sorted.length >= 6) {
    trimmed = sorted.slice(1, sorted.length - 1);
  }

  if (trimmed.length === 0) {
    trimmed = sorted;
  }

  const total = trimmed.reduce((sum, value) => sum + value, 0);
  const avg = total / trimmed.length;

  return {
    avgSold: Number(avg.toFixed(2)),
    lowestSold: Number(trimmed[0].toFixed(2)),
    highestSold: Number(trimmed[trimmed.length - 1].toFixed(2)),
    salesCount: trimmed.length,
  };
}