"use client";

export type LeadRow = {
  postedAt: string;
  who: string;
  email: string;
  channel: string;
  style: string;
  title: string;
  products: number;
};

// Quote every cell, and stop a cell starting with = + - @ being run as a
// spreadsheet formula.
function cell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export default function LeadCsvButton({ rows, filename }: { rows: LeadRow[]; filename: string }) {
  function download() {
    const header = ["Posted (UK time)", "Staff", "Email", "Channel", "Style", "Post title", "Amazon products"];
    const lines = rows.map((r) => [
      new Date(r.postedAt).toLocaleString("en-GB", { timeZone: "Europe/London" }),
      r.who, r.email, r.channel, r.style, r.title, r.products,
    ].map(cell).join(","));
    const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-40"
    >
      Download CSV
    </button>
  );
}
