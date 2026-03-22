"use client";

import { useMemo, useState } from "react";
import {
  Link as LinkIcon,
  PoundSterling,
  ImageIcon,
  Send,
  BadgePoundSterling,
} from "lucide-react";

type Destination = "amazon" | "sneakers";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  results?: {
    discord?: unknown;
    x?: unknown;
    facebook?: unknown;
  };
  errors?: {
    discord?: unknown;
    x?: unknown;
    facebook?: unknown;
  };
};

export default function DealPostPage() {
  const [destination, setDestination] = useState<Destination>("amazon");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [postToDiscord, setPostToDiscord] = useState(true);
  const [postToX, setPostToX] = useState(true);
  const [postToFacebook, setPostToFacebook] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ApiResponse | null>(null);

  const previewConfig = useMemo(() => {
    if (destination === "amazon") {
      return {
        title: "Amazon STEAL! Alert 🚨",
        colorClass: "border-blue-500",
        priceClass: "border-blue-400/20 bg-blue-500/10 text-blue-300",
        footer: "Bargain Sniper UK • Amazon Deals",
        destinationLabel: "Amazon",
        buttonClass:
          "bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-400/20",
      };
    }

    return {
      title: "Percy Bargains Alert 🚨",
      colorClass: "border-emerald-500",
      priceClass: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
      footer: "Bargain Sniper UK • Sneakers",
      destinationLabel: "Sneakers",
      buttonClass:
        "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-400/20",
    };
  }, [destination]);

  function renderStatus(label: string, success?: unknown, failure?: unknown) {
    const state = success ? "Success" : failure ? "Failed" : "Not sent";

    const stateClass = success
      ? "text-emerald-300 border-emerald-400/20 bg-emerald-500/10"
      : failure
      ? "text-red-300 border-red-400/20 bg-red-500/10"
      : "text-slate-300 border-white/10 bg-white/5";

    return (
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#030814] px-4 py-3">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${stateClass}`}>
          {state}
        </span>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const res = await fetch("/api/post-discord", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination,
          description,
          price,
          link,
          imageUrl,
          postToDiscord,
          postToX,
          postToFacebook,
        }),
      });

      const data: ApiResponse = await res.json();
      setResult(data);

      if (!res.ok || !data.ok) {
        if (data.errors) {
          const failed = Object.keys(data.errors).join(", ");
          setMessage(
            failed
              ? `Some posts failed: ${failed}`
              : data.error || "Failed to post deal."
          );
        } else {
          setMessage(data.error || "Failed to post deal.");
        }

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
              Create a clean deal post, choose the destination, preview the
              final style, and send the same deal to Discord, X, and Facebook.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Send To
              </label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value as Destination)}
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40"
              >
                <option value="amazon">Amazon</option>
                <option value="sneakers">Sneakers</option>
              </select>
            </div>

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

            <div className="rounded-2xl border border-white/10 bg-[#030814] p-4">
              <div className="mb-3 text-sm font-medium text-slate-300">
                Post Destinations
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={postToDiscord}
                    onChange={(e) => setPostToDiscord(e.target.checked)}
                    className="h-4 w-4 accent-blue-500"
                  />
                  <span>Discord</span>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={postToX}
                    onChange={(e) => setPostToX(e.target.checked)}
                    className="h-4 w-4 accent-blue-500"
                  />
                  <span>X / Twitter</span>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={postToFacebook}
                    onChange={(e) => setPostToFacebook(e.target.checked)}
                    className="h-4 w-4 accent-blue-500"
                  />
                  <span>Facebook</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-blue-600 px-4 py-4 text-base font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Posting..." : "Post Deal"}
            </button>

            {message ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {message}
              </div>
            ) : null}

            {result ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 text-sm font-semibold text-white">
                  Post Results
                </div>

                <div className="space-y-3">
                  {renderStatus(
                    "Discord",
                    result.results?.discord,
                    result.errors?.discord
                  )}
                  {renderStatus("X / Twitter", result.results?.x, result.errors?.x)}
                  {renderStatus(
                    "Facebook",
                    result.results?.facebook,
                    result.errors?.facebook
                  )}
                </div>

                {(result.errors?.discord ||
                  result.errors?.x ||
                  result.errors?.facebook) && (
                  <pre className="mt-4 overflow-auto rounded-xl border border-red-400/10 bg-[#030814] p-3 text-xs text-red-200">
{JSON.stringify(result.errors, null, 2)}
                  </pre>
                )}
              </div>
            ) : null}
          </form>
        </div>

        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
          <div className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <BadgePoundSterling size={20} className="text-blue-300" />
            Live Preview
          </div>

          <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
            Sending to: {previewConfig.destinationLabel}
          </div>

          <div
            className={`rounded-2xl border-l-4 ${previewConfig.colorClass} bg-[#2b2d31] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]`}
          >
            <p className="text-sm font-semibold text-white">
              {previewConfig.title}
            </p>

            <div className="mt-3 whitespace-pre-line text-[15px] leading-7 text-slate-200">
              {description || "Your deal description will appear here."}
            </div>

            <div
              className={`mt-4 inline-flex rounded-full border px-3 py-1 text-sm font-medium ${previewConfig.priceClass}`}
            >
              £{price || "0.00"}
            </div>

            <div className="mt-4">
              <a
                href={link || "#"}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex rounded-lg px-3 py-2 text-sm font-medium transition ${previewConfig.buttonClass}`}
              >
                View Deal
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

            <div className="mt-4 text-xs font-medium text-slate-300">
              {previewConfig.footer}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}