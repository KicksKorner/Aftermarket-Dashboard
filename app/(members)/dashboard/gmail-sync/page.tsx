import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  Mail,
  CheckCircle2,
  SkipForward,
  Inbox,
  RefreshCcw,
  PlugZap,
} from "lucide-react";
import { ImapFlow } from "imapflow";
import { createClient } from "@/lib/supabase/server";
import {
  PurchaseEmailImport,
  parsePurchaseItems,
  formatCurrency,
  getParsedUnitPrice,
} from "@/lib/gmail-imports";
import { parseRetailerEmail } from "@/lib/retailer-email-parser";

async function requireUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export default async function GmailSyncPage() {
  const { supabase, user } = await requireUser();

  async function saveConnection(formData: FormData) {
    "use server";

    const { supabase, user } = await requireUser();

    const email = String(formData.get("email") || "").trim();
    const imap_username = String(formData.get("imap_username") || "").trim();
    const app_password = String(formData.get("app_password") || "").trim();
    const imap_host = String(formData.get("imap_host") || "imap.gmail.com").trim();
    const imap_port = Number(formData.get("imap_port") || 993);

    if (!email || !imap_username || !app_password || !imap_host || !imap_port) {
      return;
    }

    const { data: existing } = await supabase
      .from("gmail_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "gmail")
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("gmail_connections")
        .update({
          email,
          imap_username,
          app_password,
          imap_host,
          imap_port,
          is_active: true,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("gmail_connections").insert({
        user_id: user.id,
        email,
        provider: "gmail",
        imap_host,
        imap_port,
        imap_username,
        app_password,
        is_active: true,
      });
    }

    revalidatePath("/dashboard/gmail-sync");
  }

  async function syncInbox() {
    "use server";

    const { supabase, user } = await requireUser();

    const { data: connection, error: connectionError } = await supabase
      .from("gmail_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "gmail")
      .eq("is_active", true)
      .maybeSingle();

    if (connectionError || !connection) {
      console.error("No Gmail connection found:", connectionError);
      revalidatePath("/dashboard/gmail-sync");
      return;
    }

    const client = new ImapFlow({
      host: connection.imap_host,
      port: Number(connection.imap_port),
      secure: true,
      auth: {
        user: connection.imap_username,
        pass: connection.app_password,
      },
      logger: false,
    });

    try {
      await client.connect();

      const lock = await client.getMailboxLock("INBOX");

      try {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 14);

        const uids = await client.search(
          { since: sinceDate },
          { uid: true }
        );

        if (!uids.length) {
          await supabase
            .from("gmail_connections")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", connection.id);

          revalidatePath("/dashboard/gmail-sync");
          return;
        }

        const recentUids = uids.slice(-30);

        const messages = await client.fetchAll(
          recentUids,
          {
            uid: true,
            envelope: true,
            source: true,
          },
          { uid: true }
        );

        for (const message of messages) {
          const subject = message.envelope?.subject || "";
          const senderEmail =
            message.envelope?.from?.[0]?.address ||
            message.envelope?.sender?.[0]?.address ||
            "";
          const messageId =
            message.envelope?.messageId || `uid-${String(message.uid)}`;
          const rawText = message.source
            ? Buffer.from(message.source).toString("utf8")
            : "";

          const parsed = parseRetailerEmail({
            senderEmail,
            subject,
            text: rawText,
          });

          if (!parsed.isRetailerEmail) {
            continue;
          }

          await supabase.from("purchase_email_imports").upsert(
            {
              user_id: user.id,
              message_id: messageId,
              thread_id: null,
              retailer: parsed.retailer,
              sender_email: senderEmail || null,
              subject: subject || null,
              order_number: parsed.orderNumber,
              order_date: message.envelope?.date
                ? new Date(message.envelope.date).toISOString()
                : null,
              order_total_gbp: parsed.orderTotalGbp,
              parsed_items: parsed.parsedItems,
              raw_email_text: rawText,
              raw_payload: {
                envelope: message.envelope ?? null,
                uid: message.uid ?? null,
              },
              status: "pending",
            },
            {
              onConflict: "user_id,message_id",
              ignoreDuplicates: true,
            }
          );
        }
      } finally {
        lock.release();
      }

      await client.logout();

      await supabase
        .from("gmail_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", connection.id);
    } catch (error) {
      console.error("Gmail IMAP sync error:", error);
    }

    revalidatePath("/dashboard/gmail-sync");
  }

  async function approveImport(formData: FormData) {
    "use server";

    const { supabase, user } = await requireUser();

    const importId = String(formData.get("import_id") || "");
    if (!importId) return;

    const { data: importRow, error: importError } = await supabase
      .from("purchase_email_imports")
      .select("*")
      .eq("id", importId)
      .eq("user_id", user.id)
      .single();

    if (importError || !importRow) {
      console.error("Approve import fetch error:", importError);
      return;
    }

    const parsedItems = parsePurchaseItems(importRow.parsed_items);

    if (parsedItems.length === 0) {
      await supabase
        .from("purchase_email_imports")
        .update({
          status: "error",
          notes: "No parsed items found to import.",
        })
        .eq("id", importId)
        .eq("user_id", user.id);

      revalidatePath("/dashboard/gmail-sync");
      return;
    }

    const purchaseDate = importRow.order_date
      ? new Date(importRow.order_date)
      : new Date();

    const returnWindowDays = 14;
    const deadline = new Date(purchaseDate);
    deadline.setDate(deadline.getDate() + returnWindowDays);

    const inventoryRows = parsedItems.map((item) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = getParsedUnitPrice(item);

      return {
        user_id: user.id,
        item_name: item.item_name,
        buy_price: unitPrice,
        purchase_date: purchaseDate.toISOString().split("T")[0],
        status: "in_stock",
        quantity,
        quantity_sold: 0,
        quantity_remaining: quantity,
        sold_price: null,
        fees: 0,
        shipping: 0,
        sold_date: null,
        return_window_days: returnWindowDays,
        return_deadline: deadline.toISOString(),
      };
    });

    const { error: inventoryError } = await supabase
      .from("inventory_items")
      .insert(inventoryRows);

    if (inventoryError) {
      console.error("Inventory insert error:", inventoryError);

      await supabase
        .from("purchase_email_imports")
        .update({
          status: "error",
          notes: "Failed to create inventory items.",
        })
        .eq("id", importId)
        .eq("user_id", user.id);

      revalidatePath("/dashboard/gmail-sync");
      return;
    }

    await supabase
      .from("purchase_email_imports")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        notes: "Imported to inventory.",
      })
      .eq("id", importId)
      .eq("user_id", user.id);

    revalidatePath("/dashboard/gmail-sync");
    revalidatePath("/dashboard/inventory");
  }

  async function skipImport(formData: FormData) {
    "use server";

    const { supabase, user } = await requireUser();

    const importId = String(formData.get("import_id") || "");
    if (!importId) return;

    await supabase
      .from("purchase_email_imports")
      .update({
        status: "skipped",
        skipped_at: new Date().toISOString(),
        notes: "Skipped by user.",
      })
      .eq("id", importId)
      .eq("user_id", user.id);

    revalidatePath("/dashboard/gmail-sync");
  }

  const { data: gmailConnection } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "gmail")
    .eq("is_active", true)
    .maybeSingle();

  const { data: pendingImports } = await supabase
    .from("purchase_email_imports")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const imports = ((pendingImports || []) as PurchaseEmailImport[]).map(
    (row) => ({
      ...row,
      parsed_items: parsePurchaseItems(row.parsed_items),
    })
  );

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-5 flex items-center gap-2">
          <span className="text-blue-400">📧</span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Gmail Sync
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Connect your Gmail inbox, sync recent retailer order emails, and
              keep everything as pending imports until approved.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <PlugZap size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Connect Gmail</h2>
                <p className="text-sm text-slate-400">
                  Save your inbox details for manual sync.
                </p>
              </div>
            </div>

            <form action={saveConnection} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Gmail Address
                </label>
                <input
                  name="email"
                  type="email"
                  defaultValue={gmailConnection?.email ?? ""}
                  placeholder="yourname@gmail.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  IMAP Username
                </label>
                <input
                  name="imap_username"
                  defaultValue={gmailConnection?.imap_username ?? ""}
                  placeholder="yourname@gmail.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  App Password
                </label>
                <input
                  name="app_password"
                  type="password"
                  defaultValue={gmailConnection?.app_password ?? ""}
                  placeholder="16-digit app password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    IMAP Host
                  </label>
                  <input
                    name="imap_host"
                    defaultValue={gmailConnection?.imap_host ?? "imap.gmail.com"}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    IMAP Port
                  </label>
                  <input
                    name="imap_port"
                    type="number"
                    defaultValue={gmailConnection?.imap_port ?? 993}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Save Gmail Connection
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <Inbox size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">How To Use It</h2>
                <p className="text-sm text-slate-400">
                  Nothing enters inventory until approved.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-[16px] border border-white/10 bg-white/5 p-3">
                1. Save your Gmail connection details
              </div>
              <div className="rounded-[16px] border border-white/10 bg-white/5 p-3">
                2. Click Sync Inbox to scan recent retailer emails
              </div>
              <div className="rounded-[16px] border border-white/10 bg-white/5 p-3">
                3. Review items in Pending Imports
              </div>
              <div className="rounded-[16px] border border-white/10 bg-white/5 p-3">
                4. Approve into inventory or skip
              </div>
            </div>

            <div className="mt-5 rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <div>
                <span className="font-medium text-white">Connected inbox:</span>{" "}
                {gmailConnection?.email ?? "Not connected"}
              </div>
              <div className="mt-2">
                <span className="font-medium text-white">Last synced:</span>{" "}
                {gmailConnection?.last_synced_at
                  ? new Date(gmailConnection.last_synced_at).toLocaleString(
                      "en-GB"
                    )
                  : "-"}
              </div>

              <form action={syncInbox} className="mt-4">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <RefreshCcw size={16} />
                  Sync Inbox Now
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Pending Imports</h2>
            <p className="mt-1 text-sm text-slate-400">
              Review parsed order emails before approving them into inventory.
            </p>
          </div>

          <div className="rounded-full border border-pink-500/20 bg-pink-500/10 px-4 py-2 text-sm font-medium text-pink-300">
            {imports.length} Pending
          </div>
        </div>

        {imports.length === 0 ? (
          <div className="rounded-[20px] border border-white/10 bg-[#081120]/80 px-6 py-10 text-center text-slate-400">
            No pending imports yet.
          </div>
        ) : (
          <div className="space-y-4">
            {imports.map((importItem) => {
              const items = parsePurchaseItems(importItem.parsed_items);

              return (
                <div
                  key={importItem.id}
                  className="rounded-[24px] border border-white/10 bg-[#081120]/80 p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {importItem.subject || "Untitled Import"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {importItem.sender_email || "Unknown sender"}
                          {importItem.retailer
                            ? ` • ${importItem.retailer}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 text-sm">
                        {importItem.order_total_gbp != null && (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-300">
                            {formatCurrency(importItem.order_total_gbp)}
                          </span>
                        )}

                        {importItem.order_number && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                            Order: {importItem.order_number}
                          </span>
                        )}

                        {importItem.order_date && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                            {new Date(importItem.order_date).toLocaleDateString(
                              "en-GB"
                            )}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {items.length === 0 ? (
                          <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            No parsed items found in this import.
                          </div>
                        ) : (
                          items.map((item, index) => (
                            <div
                              key={`${importItem.id}-${index}`}
                              className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3"
                            >
                              <div className="font-medium text-white">
                                {item.item_name}
                              </div>
                              <div className="mt-1 text-sm text-slate-400">
                                Qty: {item.quantity} • Unit:{" "}
                                {formatCurrency(item.unit_price_gbp)} • Line:{" "}
                                {formatCurrency(item.line_total_gbp)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 xl:min-w-[240px] xl:justify-end">
                      <form action={approveImport}>
                        <input
                          type="hidden"
                          name="import_id"
                          value={importItem.id}
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                        >
                          <CheckCircle2 size={16} />
                          Import to Inventory
                        </button>
                      </form>

                      <form action={skipImport}>
                        <input
                          type="hidden"
                          name="import_id"
                          value={importItem.id}
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                        >
                          <SkipForward size={16} />
                          Skip
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}