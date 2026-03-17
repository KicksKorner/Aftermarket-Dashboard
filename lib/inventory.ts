export type InventoryItem = {
  id: string;
  user_id: string;
  item_name: string;
  buy_price: number;
  sold_price: number | null;
  fees: number;
  shipping: number;
  status: "in_stock" | "sold";
  purchase_date: string | null;
  sold_date: string | null;
  quantity: number;
  quantity_sold: number;
  quantity_remaining: number;
  return_window_days: number | null;
  return_deadline: string | null;
  created_at?: string;
  updated_at?: string;
};

export type InventorySale = {
  id: string;
  user_id: string;
  inventory_item_id: string;
  item_name: string;
  quantity_sold: number;
  sold_price: number;
  fees: number;
  shipping: number;
  sold_date: string;
  created_at?: string;
};

export function calculateProfit(item: {
  buy_price: number;
  sold_price: number | null;
  fees: number;
  shipping: number;
}) {
  if (item.sold_price == null) return null;

  return (
    Number(item.sold_price) -
    Number(item.buy_price) -
    Number(item.fees) -
    Number(item.shipping)
  );
}

export function calculateSaleProfit(sale: {
  quantity_sold: number;
  sold_price: number;
  fees: number;
  shipping: number;
  buy_price_per_unit: number;
}) {
  return (
    Number(sale.quantity_sold) * Number(sale.sold_price) -
    Number(sale.quantity_sold) * Number(sale.buy_price_per_unit) -
    Number(sale.fees) -
    Number(sale.shipping)
  );
}

export function calculateROI(item: {
  buy_price: number;
  sold_price: number | null;
  fees: number;
  shipping: number;
}) {
  const profit = calculateProfit(item);
  if (profit == null || Number(item.buy_price) <= 0) return null;
  return (profit / Number(item.buy_price)) * 100;
}

export function getInventoryStats(items: InventoryItem[]) {
  const inStockItems = items.filter(
    (item) => Number(item.quantity_remaining) > 0
  );
  const soldOutItems = items.filter(
    (item) => Number(item.quantity_remaining) === 0
  );

  const capitalLocked = inStockItems.reduce(
    (sum, item) =>
      sum + Number(item.buy_price) * Number(item.quantity_remaining),
    0
  );

  const soldItemsForProfit = items.filter((item) => item.sold_price != null);

  const totalProfit = soldItemsForProfit.reduce((sum, item) => {
    const profit = calculateProfit(item);
    return sum + (profit ?? 0);
  }, 0);

  const roiValues = soldItemsForProfit
    .map((item) => calculateROI(item))
    .filter((value): value is number => value !== null);

  const avgROI =
    roiValues.length > 0
      ? roiValues.reduce((sum, value) => sum + value, 0) / roiValues.length
      : 0;

  return {
    inStockCount: inStockItems.length,
    soldCount: soldOutItems.length,
    capitalLocked,
    totalProfit,
    avgROI,
  };
}

export function getMonthlyProfitData(items: InventoryItem[]) {
  const monthlyMap = new Map<string, number>();

  items.forEach((item) => {
    if (!item.sold_date || item.sold_price == null) return;

    const profit = calculateProfit(item);
    if (profit == null) return;

    const date = new Date(item.sold_date);
    if (Number.isNaN(date.getTime())) return;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    monthlyMap.set(key, (monthlyMap.get(key) || 0) + profit);
  });

  const sortedEntries = Array.from(monthlyMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return sortedEntries.map(([key, profit]) => {
    const [year, month] = key.split("-");
    const label = new Date(Number(year), Number(month) - 1).toLocaleString(
      "en-GB",
      { month: "short" }
    );

    return {
      key,
      label,
      profit,
    };
  });
}

export function getYearToDateStats(items: InventoryItem[]) {
  const currentYear = new Date().getFullYear();

  const filtered = items.filter((item) => {
    if (!item.sold_date || item.sold_price == null) return false;

    const soldDate = new Date(item.sold_date);
    if (Number.isNaN(soldDate.getTime())) return false;

    return soldDate.getFullYear() === currentYear;
  });

  const ytdSales = filtered.reduce(
    (sum, item) => sum + Number(item.sold_price ?? 0),
    0
  );

  const ytdProfit = filtered.reduce((sum, item) => {
    const profit = calculateProfit(item);
    return sum + (profit ?? 0);
  }, 0);

  return {
    year: currentYear,
    ytdSales,
    ytdProfit,
  };
}

export function getSalesSummary(
  sales: Array<InventorySale & { buy_price_per_unit: number }>
) {
  const totalSales = sales.reduce(
    (sum, sale) => sum + Number(sale.sold_price) * Number(sale.quantity_sold),
    0
  );

  const totalProfit = sales.reduce(
    (sum, sale) => sum + calculateSaleProfit(sale),
    0
  );

  return {
    totalSales,
    totalProfit,
  };
}

export function getMonthlyProfitDataFromSales(
  sales: Array<InventorySale & { buy_price_per_unit: number }>
) {
  const monthlyMap = new Map<string, number>();

  sales.forEach((sale) => {
    const date = new Date(sale.sold_date);
    if (Number.isNaN(date.getTime())) return;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    const profit = calculateSaleProfit(sale);
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + profit);
  });

  const sortedEntries = Array.from(monthlyMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return sortedEntries.map(([key, profit]) => {
    const [year, month] = key.split("-");
    const label = new Date(Number(year), Number(month) - 1).toLocaleString(
      "en-GB",
      { month: "short" }
    );

    return {
      key,
      label,
      profit,
    };
  });
}

export function getYearToDateStatsFromSales(
  sales: Array<InventorySale & { buy_price_per_unit: number }>
) {
  const currentYear = new Date().getFullYear();

  const filtered = sales.filter((sale) => {
    const soldDate = new Date(sale.sold_date);
    if (Number.isNaN(soldDate.getTime())) return false;
    return soldDate.getFullYear() === currentYear;
  });

  const ytdSales = filtered.reduce(
    (sum, sale) => sum + Number(sale.sold_price) * Number(sale.quantity_sold),
    0
  );

  const ytdProfit = filtered.reduce(
    (sum, sale) => sum + calculateSaleProfit(sale),
    0
  );

  return {
    year: currentYear,
    ytdSales,
    ytdProfit,
  };
}

export function getReturnCountdown(returnDeadline: string | null) {
  if (!returnDeadline) return null;

  const now = new Date().getTime();
  const deadline = new Date(returnDeadline).getTime();

  if (Number.isNaN(deadline)) return null;

  const diff = deadline - now;

  if (diff <= 0) {
    return {
      expired: true,
      label: "Expired",
    };
  }

  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return {
    expired: false,
    label: `${days}d ${hours}h left`,
  };
}