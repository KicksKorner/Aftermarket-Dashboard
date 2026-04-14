"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, FileText, Image, Trash2, DollarSign, Camera } from "lucide-react";

const supabase = createClient();

type Receipt = {
  id: string;
  file_name: string;
  file_url: string;
  description: string | null;
  amount: number | null;
  uploaded_at: string;
};

export default function ReceiptHubTab() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchReceipts(); }, []);

  async function fetchReceipts() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("receipts")
      .select("*")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false });

    setReceipts((data || []) as Receipt[]);
    setLoading(false);
  }

  function handleFileSelect(file: File) {
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext = selectedFile.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, selectedFile, { upsert: false });

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(fileName);
    const fileUrl = urlData.publicUrl;

    await supabase.from("receipts").insert({
      user_id: user.id,
      file_name: selectedFile.name,
      file_url: fileUrl,
      description: description.trim() || null,
      amount: amount ? Number(amount) : null,
    });

    setSelectedFile(null);
    setPreview(null);
    setDescription("");
    setAmount("");
    setUploading(false);
    fetchReceipts();
  }

  async function handleDelete(receipt: Receipt) {
    if (!window.confirm(`Delete "${receipt.file_name}"?`)) return;
    const path = receipt.file_url.split("/receipts/")[1];
    if (path) await supabase.storage.from("receipts").remove([path]);
    await supabase.from("receipts").delete().eq("id", receipt.id);
    fetchReceipts();
  }

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Receipt Hub</h3>
            <p className="text-sm text-slate-400">Upload and store receipts, invoices, and expense documents.</p>
          </div>
          {/* Camera button for mobile */}
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 transition hover:bg-blue-500/20 sm:hidden"
          >
            <Camera size={15} />
            Camera
          </button>
        </div>

        {/* Hidden camera input - capture from camera on mobile */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
        />

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed p-10 transition ${
            dragOver
              ? "border-blue-400/50 bg-blue-500/10"
              : selectedFile
              ? "border-emerald-500/30 bg-emerald-500/8"
              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
          />

          {selectedFile ? (
            <>
              {preview ? (
                <img src={preview} alt="Preview" className="mb-3 h-24 w-24 rounded-xl object-cover" />
              ) : (
                <FileText size={32} className="mb-3 text-emerald-400" />
              )}
              <p className="text-sm font-medium text-white">{selectedFile.name}</p>
              <p className="mt-1 text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(0)} KB — click to change</p>
            </>
          ) : (
            <>
              <Upload size={28} className="mb-3 text-slate-500" />
              <p className="text-sm font-medium text-white">Drop files here or click to browse</p>
              <p className="mt-1 text-xs text-slate-500">Supports images (JPG, PNG), PDFs, and documents — up to 20MB</p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}
                  className="hidden items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 sm:flex"
                >
                  <Camera size={12} />
                  Use Camera
                </button>
              </div>
            </>
          )}
        </div>

        {/* Metadata + upload button */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
          />
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 sm:w-40">
            <DollarSign size={13} className="text-slate-500 flex-shrink-0" />
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount £"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
          >
            <Upload size={14} />
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        </div>
      </div>

      {/* Receipts grid */}
      {loading ? (
        <p className="text-center text-sm text-slate-500">Loading receipts...</p>
      ) : receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <FileText size={32} className="mb-3 text-slate-700" />
          <p className="text-sm font-medium text-slate-400">No receipts yet.</p>
          <p className="mt-1 text-xs text-slate-600">Upload your first receipt above.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {receipts.map((r) => (
            <div key={r.id} className="group rounded-[20px] border border-blue-500/10 bg-[#081120] overflow-hidden">
              {isImage(r.file_url) ? (
                <a href={r.file_url} target="_blank" rel="noopener noreferrer">
                  <img src={r.file_url} alt={r.file_name} className="h-40 w-full object-cover transition group-hover:opacity-90" />
                </a>
              ) : (
                <a href={r.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex h-40 items-center justify-center bg-white/5 transition hover:bg-white/10">
                  <FileText size={36} className="text-slate-500" />
                </a>
              )}
              <div className="p-4">
                <p className="truncate text-sm font-medium text-white">{r.file_name}</p>
                {r.description && <p className="mt-1 truncate text-xs text-slate-400">{r.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    {r.amount && <p className="text-sm font-semibold text-emerald-400">£{Number(r.amount).toFixed(2)}</p>}
                    <p className="text-xs text-slate-600">
                      {new Date(r.uploaded_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(r)}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
