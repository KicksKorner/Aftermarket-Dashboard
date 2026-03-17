export type ParsedPurchaseItem = {
  item_name: string;
  quantity: number;
  unit_price_gbp: number | null;
  line_total_gbp: number | null;
};

export type PurchaseEmailImport = {
  id: string;
  user_id: string;
  message_id: string;
  thread_id: string | null;
  retailer: string | null;
  sender_email: string | null;
  subject: string | null;
  order_number: string | null;
  order_date: string | null;
  order_total_gbp: number | null;
  parsed_items: ParsedPurchaseItem[] | null;
  raw_email_text: string | null;
  raw_payload: unknown;
  status: "pending" | "approved" | "skipped" | "error";
  approved_at: string | null;
  skipped_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function parsePurchaseItems(value: unknown): ParsedPurchaseItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;

      return {
        item_name:
          typeof record.item_name === "string"
            ? record.item_name
            : "Unknown Item",
        quantity:
          typeof record.quantity === "number"
            ? record.quantity
            : Number(record.quantity ?? 1),
        unit_price_gbp:
          record.unit_price_gbp == null ? null : Number(record.unit_price_gbp),
        line_total_gbp:
          record.line_total_gbp == null ? null : Number(record.line_total_gbp),
      };
    })
    .filter((item): item is ParsedPurchaseItem => item !== null);
}

export function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `£${Number(value).toFixed(2)}`;
}

export function getParsedUnitPrice(item: ParsedPurchaseItem) {
  if (item.unit_price_gbp != null) return Number(item.unit_price_gbp);

  if (
    item.line_total_gbp != null &&
    item.quantity &&
    Number(item.quantity) > 0
  ) {
    return Number(item.line_total_gbp) / Number(item.quantity);
  }

  return 0;
}