"use client";

import { useState } from "react";
import {
  Link as LinkIcon,
  PoundSterling,
  ImageIcon,
  Send,
  BadgePoundSterling,
} from "lucide-react";

export default function DealPostPage() {
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/post-discord", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
          price,
          link,
          imageUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Failed to post deal.");
        setLoading(false);
        return;
      }

      setMessage("Deal posted successfully.");
      setDescription("");
      setPrice("");
      setLink("");
      setImageUrl("");
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <Send size={24} />
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Deal Poster
            </h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Quickly create a clean Discord deal post with a link, price,
              description and optional image.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Short Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: Fever-Tree Premium Ginger Beer 24 Cans just £3.50 (List: £16.20)"
                rows={4}
                required
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Price
                </label>
                <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                  <PoundSterling size={18} className="text-slate-500" />
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="3.50"
                    required
                    className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Deal Link
                </label>
                <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                  <LinkIcon size={18} className="text-slate-500" />
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://..."
                    required
                    className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Image URL <span className="text-slate-500">(optional)</span>
              </label>
              <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                <ImageIcon size={18} className="text-slate-500" />
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-blue-600 px-4 py-4 text-base font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Posting..." : "Post to Discord"}
            </button>

            {message ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {message}
              </div>
            ) : null}
          </form>
        </div>

        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
          <div className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <BadgePoundSterling size={20} className="text-blue-300" />
            Live Preview
          </div>

          <div className="rounded-2xl border-l-4 border-blue-500 bg-[#2b2d31] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
            <p className="text-sm font-semibold text-white">STEAL! 🚨</p>

            <div className="mt-3 whitespace-pre-line text-[15px] leading-7 text-slate-200">
              {description || "Your deal description will appear here."}
            </div>

            <div className="mt-4 inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-300">
              £{price || "0.00"}
            </div>

            <div className="mt-4">
              <a
                href={link || "#"}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm text-blue-400 underline underline-offset-2"
              >
                {link || "Your deal link will appear here"}
              </a>
            </div>

            {imageUrl ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <img
                  src={imageUrl}
                  alt="Deal preview"
                  className="h-auto max-h-[320px] w-full object-cover"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-slate-500">
                Optional image preview will appear here
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}