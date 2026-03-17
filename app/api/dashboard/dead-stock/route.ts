import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("inventory")
    .select("id, product_name, created_at")
    .eq("status", "in_stock");

  const now = new Date();

  const deadStock = data
    .map((item) => {
      const days =
        (now.getTime() - new Date(item.created_at).getTime()) /
        (1000 * 60 * 60 * 24);

      return {
        ...item,
        days: Math.floor(days),
      };
    })
    .filter((item) => item.days > 60);

  return NextResponse.json(deadStock);
}