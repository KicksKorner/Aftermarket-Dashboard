import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  let query = supabase
    .from("inventory_sales")
    .select("*, inventory_items!inner(buy_price, item_name)")
    .eq("user_id", user.id)
    .order("sold_date", { ascending: true });

  const { data: sales } = await query;

  if (!sales || sales.length === 0) {
    return new NextResponse("No sales found", { status: 404 });
  }

  let filtered = sales;

  if (year) {
    filtered = filtered.filter((s) => {
      if (!s.sold_date) return false;
      const d = new Date(s.sold_date);
      if (month) return d.getFullYear() === Number(year) && d.getMonth() + 1 === Number(month);
      return d.getFullYear() === Number(year);
    });
  }

  if (filtered.length === 0) {
    return new NextResponse("No sales found for period", { status: 404 });
  }

  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const headers = [
    "Transaction Date",
    "Item Name",
    "Quantity Sold",
    "Buy Price Per Unit (£)",
    "Sell Price Per Unit (£)",
    "Gross Revenue (£)",
    "Fees (£)",
    "Shipping (£)",
    "Net Amount excl. VAT (£)",
    "VAT Rate (%)",
    "VAT Amount (£)",
    "Gross Amount incl. VAT (£)",
    "Profit (£)",
  ];

  const rows = filtered.map((sale) => {
    const qty = Number(sale.quantity_sold) || 1;
    const buyPrice = Number(sale.inventory_items?.buy_price ?? 0);
    const sellPrice = Number(sale.sold_price) || 0;
    const fees = Number(sale.fees) || 0;
    const shipping = Number(sale.shipping) || 0;
    const grossRevenue = sellPrice * qty;
    const totalCost = buyPrice * qty + fees + shipping;
    const profit = grossRevenue - totalCost;

    // MTD fields — treat gross revenue as inc. VAT at 20%
    const netExVat = +(grossRevenue / 1.2).toFixed(2);
    const vatAmount = +(grossRevenue - netExVat).toFixed(2);
    const vatRate = 20;

    return [
      escape(sale.sold_date),
      escape(sale.item_name),
      escape(qty),
      escape(buyPrice.toFixed(2)),
      escape(sellPrice.toFixed(2)),
      escape(grossRevenue.toFixed(2)),
      escape(fees.toFixed(2)),
      escape(shipping.toFixed(2)),
      escape(netExVat.toFixed(2)),
      escape(vatRate),
      escape(vatAmount.toFixed(2)),
      escape(grossRevenue.toFixed(2)),
      escape(profit.toFixed(2)),
    ].join(",");
  });

  const totalGross = filtered.reduce((s, sale) => s + (Number(sale.sold_price) || 0) * (Number(sale.quantity_sold) || 1), 0);
  const totalNet = +(totalGross / 1.2).toFixed(2);
  const totalVat = +(totalGross - totalNet).toFixed(2);
  const totalProfit = filtered.reduce((s, sale) => {
    const qty = Number(sale.quantity_sold) || 1;
    const buy = Number(sale.inventory_items?.buy_price ?? 0);
    const sell = Number(sale.sold_price) || 0;
    const fees = Number(sale.fees) || 0;
    const ship = Number(sale.shipping) || 0;
    return s + (sell * qty) - (buy * qty) - fees - ship;
  }, 0);

  const date = new Date().toISOString();
  const periodLabel = month && year
    ? `${year}-${String(month).padStart(2, "0")}`
    : year || "all";

  const summaryRows = [
    "",
    `"MTD SALES SUMMARY — Making Tax Digital (HMRC) Compliant Export"`,
    `"Period","${periodLabel}"`,
    `"Generated","${date}"`,
    `"Total Sales","${filtered.length}"`,
    `"Total Gross Revenue","£${totalGross.toFixed(2)}"`,
    `"Total Net (excl. VAT 20%)","£${totalNet.toFixed(2)}"`,
    `"Total VAT (20%)","£${totalVat.toFixed(2)}"`,
    `"Total Profit","£${totalProfit.toFixed(2)}"`,
    `"","Retain for minimum 6 years — HMRC MTD requirement"`,
    `"","VAT at 20% standard rate — adjust manually for exempt/zero-rated items"`,
  ];

  const csv = ["\uFEFF" + headers.join(","), ...rows, ...summaryRows].join("\n");
  const filename = `mtd-sales-${periodLabel}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
