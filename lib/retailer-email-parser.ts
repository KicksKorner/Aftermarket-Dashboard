export type ParsedRetailerItem = {
  item_name: string;
  quantity: number;
  unit_price_gbp: number | null;
  line_total_gbp: number | null;
};

export type ParsedRetailerEmail = {
  isRetailerEmail: boolean;
  retailer: string | null;
  orderNumber: string | null;
  orderTotalGbp: number | null;
  parsedItems: ParsedRetailerItem[];
};

function cleanText(value: string) {
  return value.replace(/\r/g, "").trim();
}

function parseMoney(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return null;

  const amount = Number(normalized);
  return Number.isNaN(amount) ? null : amount;
}

function uniqueItems(items: ParsedRetailerItem[]) {
  const map = new Map<string, ParsedRetailerItem>();

  for (const item of items) {
    const key = `${item.item_name}|${item.quantity}|${item.unit_price_gbp}|${item.line_total_gbp}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

function detectRetailer(senderEmail: string, subject: string, text: string) {
  const haystack = `${senderEmail}\n${subject}\n${text}`.toLowerCase();

  if (
    haystack.includes("amazon.co.uk") ||
    haystack.includes("@amazon") ||
    haystack.includes("your amazon")
  ) {
    return "Amazon";
  }

  if (
    haystack.includes("smyths") ||
    haystack.includes("smythstoys") ||
    haystack.includes("smyths toys")
  ) {
    return "Smyths Toys";
  }

  if (
    haystack.includes("pokemon center") ||
    haystack.includes("pokemoncenter") ||
    haystack.includes("noreply@pokemoncenter")
  ) {
    return "Pokemon Center";
  }

  if (
    haystack.includes("costco") ||
    haystack.includes("@costco") ||
    haystack.includes("costco wholesale")
  ) {
    return "Costco";
  }

  if (
    haystack.includes("argos") ||
    haystack.includes("@argos") ||
    haystack.includes("your argos")
  ) {
    return "Argos";
  }

  if (
    haystack.includes("very.co.uk") ||
    haystack.includes("@very") ||
    haystack.includes("your very order")
  ) {
    return "Very";
  }

  return null;
}

function parseOrderNumber(text: string) {
  const patterns = [
    /order(?: number| no\.?| #| reference)?[:\s]+([A-Z0-9-]{5,})/i,
    /order id[:\s]+([A-Z0-9-]{5,})/i,
    /reference[:\s]+([A-Z0-9-]{5,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function parseOrderTotal(text: string) {
  const patterns = [
    /order total[:\s]*£\s?([0-9]+(?:\.[0-9]{2})?)/i,
    /total[:\s]*£\s?([0-9]+(?:\.[0-9]{2})?)/i,
    /grand total[:\s]*£\s?([0-9]+(?:\.[0-9]{2})?)/i,
    /amount paid[:\s]*£\s?([0-9]+(?:\.[0-9]{2})?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseMoney(match[1]);
    }
  }

  return null;
}

function parseAmazonItems(subject: string, text: string): ParsedRetailerItem[] {
  const items: ParsedRetailerItem[] = [];

  const quotedSubjectMatches = [...subject.matchAll(/"([^"]+)"/g)];
  for (const match of quotedSubjectMatches) {
    const itemName = match[1]?.trim();
    if (itemName) {
      items.push({
        item_name: itemName,
        quantity: 1,
        unit_price_gbp: null,
        line_total_gbp: null,
      });
    }
  }

  const lineRegex =
    /(?:^|\n)(.+?)\s+(?:Qty|Quantity)[:\s]+(\d+)\s+(?:£\s?([0-9]+(?:\.[0-9]{2})?))?/gi;

  for (const match of text.matchAll(lineRegex)) {
    const itemName = cleanText(match[1] || "");
    const qty = Number(match[2] || 1);
    const amount = parseMoney(match[3]);

    if (itemName && itemName.length > 2) {
      items.push({
        item_name: itemName,
        quantity: Number.isNaN(qty) ? 1 : qty,
        unit_price_gbp: amount,
        line_total_gbp: amount,
      });
    }
  }

  return uniqueItems(items);
}

function parseGenericItems(text: string): ParsedRetailerItem[] {
  const items: ParsedRetailerItem[] = [];
  const lines = cleanText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const patterns = [
    /^(.+?)\s+[x×]\s*(\d+)\s+£\s?([0-9]+(?:\.[0-9]{2})?)$/i,
    /^(.+?)\s+Qty[:\s]+(\d+)\s+£\s?([0-9]+(?:\.[0-9]{2})?)$/i,
    /^(.+?)\s+£\s?([0-9]+(?:\.[0-9]{2})?)$/i,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;

      if (pattern === patterns[0] || pattern === patterns[1]) {
        const itemName = cleanText(match[1] || "");
        const quantity = Number(match[2] || 1);
        const total = parseMoney(match[3]);

        if (itemName && itemName.length > 2) {
          items.push({
            item_name: itemName,
            quantity: Number.isNaN(quantity) ? 1 : quantity,
            unit_price_gbp:
              total != null && quantity > 0 ? total / quantity : null,
            line_total_gbp: total,
          });
        }
      } else {
        const itemName = cleanText(match[1] || "");
        const total = parseMoney(match[2]);

        if (itemName && itemName.length > 2) {
          items.push({
            item_name: itemName,
            quantity: 1,
            unit_price_gbp: total,
            line_total_gbp: total,
          });
        }
      }
    }
  }

  return uniqueItems(items);
}

function fallbackItemFromSubject(subject: string): ParsedRetailerItem[] {
  const cleaned = subject
    .replace(/your amazon\.co\.uk order of/gi, "")
    .replace(/order confirmation/gi, "")
    .replace(/dispatch confirmation/gi, "")
    .replace(/shipped/gi, "")
    .replace(/delivered/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 4) return [];

  return [
    {
      item_name: cleaned,
      quantity: 1,
      unit_price_gbp: null,
      line_total_gbp: null,
    },
  ];
}

export function parseRetailerEmail(input: {
  senderEmail: string;
  subject: string;
  text: string;
}) {
  const senderEmail = input.senderEmail || "";
  const subject = input.subject || "";
  const text = input.text || "";

  const retailer = detectRetailer(senderEmail, subject, text);
  const loweredSubject = subject.toLowerCase();
  const loweredText = text.toLowerCase();

  const isLikelyOrder =
    retailer !== null &&
    (
      loweredSubject.includes("order") ||
      loweredSubject.includes("confirmation") ||
      loweredSubject.includes("dispatched") ||
      loweredSubject.includes("shipped") ||
      loweredText.includes("order total") ||
      loweredText.includes("thanks for your order") ||
      loweredText.includes("thank you for your order")
    );

  if (!isLikelyOrder) {
    return {
      isRetailerEmail: false,
      retailer,
      orderNumber: null,
      orderTotalGbp: null,
      parsedItems: [],
    } satisfies ParsedRetailerEmail;
  }

  let parsedItems: ParsedRetailerItem[] = [];

  if (retailer === "Amazon") {
    parsedItems = parseAmazonItems(subject, text);
  }

  if (parsedItems.length === 0) {
    parsedItems = parseGenericItems(text);
  }

  if (parsedItems.length === 0) {
    parsedItems = fallbackItemFromSubject(subject);
  }

  return {
    isRetailerEmail: true,
    retailer,
    orderNumber: parseOrderNumber(text),
    orderTotalGbp: parseOrderTotal(text),
    parsedItems: uniqueItems(parsedItems),
  } satisfies ParsedRetailerEmail;
}