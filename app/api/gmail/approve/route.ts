import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { importId, items } = body;

  if (!importId) return NextResponse.json({ error: "Missing importId" }, { status: 400 });

  const { data: imp } = await supabase
    .from("gmail_imports")
    .select("*")
    .eq("id", importId)
    .eq("user_id", user.id)
    .single();

  if (!imp) return NextResponse.json({ error: "Import not found" }, { status: 404 });

  const itemsToImport: { item_name: string; quantity: number; unit_price_gbp: number | null }[] =
    items ?? imp.parsed_items ?? [];

  const purchaseDate = imp.order_date ?? new Date().toISOString().split("T")[0];

  // Build inventory inserts — only use columns that exist in inventory_items
  const inventoryInserts = itemsToImport
    .filter((item) => item.item_name && item.item_name.trim().length > 0)
    .map((item) => ({
      user_id: user.id,
      item_name: item.item_name.trim(),
      buy_price: item.unit_price_gbp ?? imp.order_total_gbp ?? 0,
      quantity: item.quantity ?? 1,
      quantity_sold: 0,
      quantity_remaining: item.quantity ?? 1,
      fees: 0,
      shipping: 0,
      status: "in_stock",
      purchase_date: purchaseDate,
    }));

  // If no usable items, create one from the order itself
  if (inventoryInserts.length === 0) {
    inventoryInserts.push({
      user_id: user.id,
      item_name: imp.order_number
        ? `${imp.retailer} — Order #${imp.order_number}`
        : `${imp.retailer} Order`,
      buy_price: imp.order_total_gbp ?? 0,
      quantity: 1,
      quantity_sold: 0,
      quantity_remaining: 1,
      fees: 0,
      shipping: 0,
      status: "in_stock",
      purchase_date: purchaseDate,
    });
  }

  const { error: insertError } = await supabase
    .from("inventory_items")
    .insert(inventoryInserts);

  if (insertError) {
    console.error("Failed to insert inventory items:", insertError);
    return NextResponse.json({ error: `Failed to add to inventory: ${insertError.message}` }, { status: 500 });
  }

  await supabase.from("gmail_imports").update({
    status: "approved",
    approved_at: new Date().toISOString(),
  }).eq("id", importId);

  return NextResponse.json({ success: true, itemsCreated: inventoryInserts.length });
}
