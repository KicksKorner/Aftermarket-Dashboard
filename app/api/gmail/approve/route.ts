import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { importId, items } = body;

  if (!importId) return NextResponse.json({ error: "Missing importId" }, { status: 400 });

  // Get the import record
  const { data: imp } = await supabase
    .from("gmail_imports")
    .select("*")
    .eq("id", importId)
    .eq("user_id", user.id)
    .single();

  if (!imp) return NextResponse.json({ error: "Import not found" }, { status: 404 });

  // Use provided items or fall back to parsed_items
  const itemsToImport = items ?? imp.parsed_items ?? [];

  // Create inventory items for each line item
  const inventoryInserts = itemsToImport
    .filter((item: { item_name: string; quantity: number; unit_price_gbp: number | null }) =>
      item.item_name && item.item_name !== "Order Item"
    )
    .map((item: { item_name: string; quantity: number; unit_price_gbp: number | null }) => ({
      user_id: user.id,
      item_name: item.item_name,
      buy_price: item.unit_price_gbp ?? 0,
      quantity: item.quantity ?? 1,
      quantity_sold: 0,
      quantity_remaining: item.quantity ?? 1,
      fees: 0,
      shipping: 0,
      status: "in_stock",
      purchase_date: imp.order_date ?? new Date().toISOString().split("T")[0],
      source: `Gmail — ${imp.retailer}`,
    }));

  // If all items are generic, create one item from the order
  if (inventoryInserts.length === 0) {
    inventoryInserts.push({
      user_id: user.id,
      item_name: `${imp.retailer} Order${imp.order_number ? ` #${imp.order_number}` : ""}`,
      buy_price: imp.order_total_gbp ?? 0,
      quantity: 1,
      quantity_sold: 0,
      quantity_remaining: 1,
      fees: 0,
      shipping: 0,
      status: "in_stock",
      purchase_date: imp.order_date ?? new Date().toISOString().split("T")[0],
      source: `Gmail — ${imp.retailer}`,
    });
  }

  if (inventoryInserts.length > 0) {
    await supabase.from("inventory_items").insert(inventoryInserts);
  }

  // Mark import as approved
  await supabase.from("gmail_imports").update({
    status: "approved",
    approved_at: new Date().toISOString(),
  }).eq("id", importId);

  return NextResponse.json({ success: true, itemsCreated: inventoryInserts.length });
}
