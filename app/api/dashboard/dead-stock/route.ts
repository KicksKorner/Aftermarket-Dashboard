import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type InventoryItem = {
  id: string;
  item_name?: string | null;
  product_name?: string | null;
  created_at: string;
  status?: string | null;
};

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, item_name, product_name, created_at, status")
      .eq("user_id", user.id)
      .neq("status", "sold")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Dead stock query error:", error);
      return NextResponse.json(
        { error: "Failed to load dead stock data" },
        { status: 500 }
      );
    }

    const safeData: InventoryItem[] = Array.isArray(data) ? data : [];
    const now = new Date();

    const deadStock = safeData
      .map((item) => {
        const createdAt = new Date(item.created_at);
        const daysInStock = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: item.id,
          product_name:
            item.item_name?.trim() ||
            item.product_name?.trim() ||
            "Unnamed item",
          days: Number.isFinite(daysInStock) ? daysInStock : 0,
        };
      })
      .filter((item) => item.days > 60)
      .sort((a, b) => b.days - a.days);

    return NextResponse.json(deadStock);
  } catch (error) {
    console.error("Dead stock API error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}