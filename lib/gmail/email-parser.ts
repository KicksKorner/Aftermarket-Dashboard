export type ParsedItem = {
  item_name: string;
  quantity: number;
  unit_price_gbp: number | null;
};

export type ParsedOrder = {
  retailer: string;
  order_number: string | null;
  order_date: string | null;
  order_total_gbp: number | null;
  items: ParsedItem[];
};

// Retailer detection patterns
const RETAILER_PATTERNS: { name: string; patterns: RegExp[] }[] = [
  { name: "Nike", patterns: [/nike\.com/i, /from.*nike/i, /order.*nike/i, /nike.*order/i] },
  { name: "ASOS", patterns: [/asos\.com/i, /from.*asos/i, /asos.*order/i] },
  { name: "JD Sports", patterns: [/jdsports\.co\.uk/i, /jd sports/i, /from.*jd sports/i] },
  { name: "Footasylum", patterns: [/footasylum\.com/i, /from.*footasylum/i] },
  { name: "Size?", patterns: [/size\.co\.uk/i, /from.*size\?/i, /size\? order/i] },
  { name: "End Clothing", patterns: [/endclothing\.com/i, /from.*end clothing/i, /end\. order/i] },
  { name: "Pokémon Center", patterns: [/pokemoncenter\.com/i, /pokemon.*center/i, /pokemon.*centre/i] },
  { name: "Amazon", patterns: [/amazon\.co\.uk/i, /amazon\.com/i, /from.*amazon/i] },
  { name: "eBay", patterns: [/ebay\.co\.uk/i, /ebay\.com/i, /from.*ebay/i] },
  { name: "GOAT", patterns: [/goat\.com/i, /from.*goat/i] },
  { name: "StockX", patterns: [/stockx\.com/i, /from.*stockx/i] },
  { name: "Footlocker", patterns: [/footlocker\.co\.uk/i, /foot locker/i] },
  { name: "Sports Direct", patterns: [/sportsdirect\.com/i, /sports direct/i] },
  { name: "Zalando", patterns: [/zalando\.co\.uk/i, /from.*zalando/i] },
  { name: "Depop", patterns: [/depop\.com/i, /from.*depop/i] },
  { name: "Vinted", patterns: [/vinted\.co\.uk/i, /vinted\.com/i, /from.*vinted/i] },
  { name: "Farfetch", patterns: [/farfetch\.com/i, /from.*farfetch/i] },
  { name: "SSENSE", patterns: [/ssense\.com/i, /from.*ssense/i] },
  { name: "Solebox", patterns: [/solebox\.com/i, /from.*solebox/i] },
  { name: "Sneakersnstuff", patterns: [/sneakersnstuff\.com/i, /sns\.com/i] },
  { name: "HBX", patterns: [/hbx\.com/i, /from.*hbx/i] },
  { name: "Offspring", patterns: [/offspring\.co\.uk/i, /from.*offspring/i] },
  { name: "Flannels", patterns: [/flannels\.com/i, /from.*flannels/i] },
  { name: "Harvey Nichols", patterns: [/harveynichols\.com/i] },
  { name: "Selfridges", patterns: [/selfridges\.com/i] },
  { name: "John Lewis", patterns: [/johnlewis\.com/i] },
  { name: "Next", patterns: [/next\.co\.uk/i, /from.*next\.co/i] },
  { name: "Very", patterns: [/very\.co\.uk/i] },
  { name: "Argos", patterns: [/argos\.co\.uk/i] },
  { name: "Currys", patterns: [/currys\.co\.uk/i] },
  { name: "Game", patterns: [/game\.co\.uk/i, /from.*game stores/i] },
];

// Patterns to detect order confirmation emails
const ORDER_SUBJECT_PATTERNS = [
  /order.*confirm/i,
  /confirm.*order/i,
  /your order/i,
  /order.*placed/i,
  /order.*received/i,
  /purchase.*confirm/i,
  /thank.*for.*order/i,
  /order.*thank/i,
  /order.*success/i,
  /order #/i,
  /order number/i,
];

export function isOrderEmail(subject: string, from: string, body: string): boolean {
  const text = `${subject} ${from} ${body}`.toLowerCase();
  return ORDER_SUBJECT_PATTERNS.some((p) => p.test(subject));
}

export function detectRetailer(subject: string, from: string, body: string): string {
  const text = `${subject} ${from} ${body}`;
  for (const retailer of RETAILER_PATTERNS) {
    if (retailer.patterns.some((p) => p.test(text))) {
      return retailer.name;
    }
  }
  // Try to extract domain from from address
  const domainMatch = from.match(/@([a-zA-Z0-9.-]+)/);
  if (domainMatch) {
    const domain = domainMatch[1].replace(/^(mail\.|email\.|noreply\.|orders\.)/, "").replace(/\.(com|co\.uk|net|org)$/, "");
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return "Unknown Retailer";
}

export function extractOrderNumber(subject: string, body: string): string | null {
  const patterns = [
    /order\s*(?:#|number|no\.?|num\.?)\s*:?\s*([A-Z0-9-]{4,20})/i,
    /#\s*([A-Z0-9-]{4,20})/i,
    /order\s+([A-Z0-9-]{6,20})/i,
  ];
  for (const p of patterns) {
    const m = `${subject} ${body}`.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

export function extractOrderTotal(body: string): number | null {
  const patterns = [
    /(?:order total|total|amount charged|grand total|you paid)[:\s]*£\s*(\d+\.?\d*)/i,
    /£\s*(\d+\.\d{2})\s*(?:total|charged|paid)/i,
    /total[:\s]+£(\d+\.?\d*)/i,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

export function extractOrderDate(body: string, receivedDate: string): string {
  const patterns = [
    /(?:placed on|order date|date)[:\s]+(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{2,4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) {
      try {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
      } catch { /* continue */ }
    }
  }
  // Fall back to email received date
  try {
    return new Date(receivedDate).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export function extractItems(body: string, orderTotal: number | null): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Try to find item lines — look for price patterns near text
  const lines = body.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip navigation/footer lines
    if (line.length < 5 || line.length > 200) continue;
    if (/unsubscribe|privacy|terms|copyright|contact us|follow us/i.test(line)) continue;

    const priceMatch = line.match(/£\s*(\d+\.?\d*)/);
    if (!priceMatch) continue;

    const price = parseFloat(priceMatch[1]);
    if (price <= 0 || price > 5000) continue;

    // Extract item name — text before the price
    let name = line.replace(/£\s*\d+\.?\d*/g, "").replace(/\s+/g, " ").trim();
    name = name.replace(/^[-•*x\d]+\s*/, "").trim();
    if (name.length < 3) continue;

    // Skip if line looks like a total/shipping line
    if (/^(total|subtotal|shipping|delivery|discount|vat|tax|postage)/i.test(name)) continue;

    // Extract quantity
    const qtyMatch = name.match(/^(\d+)\s*x\s*/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    if (qtyMatch) name = name.replace(qtyMatch[0], "").trim();

    if (name.length >= 3) {
      items.push({ item_name: name, quantity: qty, unit_price_gbp: price });
    }
  }

  // If no items found but we have a total, create a single generic item
  if (items.length === 0 && orderTotal && orderTotal > 0) {
    return [{ item_name: "Order Item", quantity: 1, unit_price_gbp: orderTotal }];
  }

  return items.slice(0, 20); // Max 20 items per order
}

export function parseEmail(params: {
  subject: string;
  from: string;
  body: string;
  receivedDate: string;
}): ParsedOrder {
  const { subject, from, body, receivedDate } = params;
  const retailer = detectRetailer(subject, from, body);
  const orderNumber = extractOrderNumber(subject, body);
  const orderTotal = extractOrderTotal(body);
  const orderDate = extractOrderDate(body, receivedDate);
  const items = extractItems(body, orderTotal);

  return { retailer, order_number: orderNumber, order_date: orderDate, order_total_gbp: orderTotal, items };
}
