import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("inventory")
      .select("buy_price, estimated_value, status");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const inStock = data.filter((item) => item.status !== "sold");

    const totalCost = inStock.reduce(
      (sum, item) => sum + Number(item.buy_price || 0),
      0
    );

    const inventoryValue = inStock.reduce(
      (sum, item) => sum + Number(item.estimated_value || 0),
      0
    );

    const potentialProfit = inventoryValue - totalCost;

    return NextResponse.json({
      itemsInStock: inStock.length,
      totalCost,
      inventoryValue,
      potentialProfit,
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}