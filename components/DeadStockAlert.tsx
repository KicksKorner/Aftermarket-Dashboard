"use client";

import { useEffect, useState } from "react";

function DeadStockAlert() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/dead-stock")
      .then((res) => res.json())
      .then(setItems);
  }, []);

  if (!items.length) return null;

  return (
    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
      <h2 className="text-lg font-semibold mb-3">⚠ Dead Stock</h2>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between">
            <span>{item.product_name}</span>
            <span>{item.days} days</span>
          </div>
        ))}
      </div>
    </div>
  );
}