"use client";

export default function MonthlyProfitChart({
  data,
}: {
  data: { key: string; label: string; profit: number }[];
}) {
  const maxValue = Math.max(...data.map((item) => Math.abs(item.profit)), 1);

  return (
    <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
      <div className="mb-5 flex items-center gap-2">
        <span className="text-lg">📈</span>
        <h2 className="text-xl font-semibold">Monthly Profit</h2>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-sm text-slate-400">
          No sold items yet.
        </div>
      ) : (
        <div className="rounded-[18px] border border-white/10 bg-[#081120]/70 p-5">
          <div className="flex h-[260px] items-end gap-4">
            {data.map((item) => {
              const height = Math.max(
                (Math.abs(item.profit) / maxValue) * 180,
                12
              );

              const positive = item.profit >= 0;

              return (
                <div
                  key={item.key}
                  className="flex flex-1 flex-col items-center justify-end"
                >
                  <div className="mb-3 text-xs text-slate-400">
                    £{item.profit.toFixed(2)}
                  </div>

                  <div
                    className={`w-full max-w-[54px] rounded-t-2xl transition ${
                      positive
                        ? "bg-emerald-400/90 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        : "bg-red-400/80"
                    }`}
                    style={{ height: `${height}px` }}
                  />

                  <div className="mt-3 text-xs font-medium text-slate-300">
                    {item.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}