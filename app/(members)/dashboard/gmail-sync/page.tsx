import Link from "next/link";
import { ArrowLeft, Mail, Wrench } from "lucide-react";

export default function GmailSyncPage() {
  return (
    <div className="space-y-8 p-6 text-white">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
        >
          <ArrowLeft size={18} />
          Return to Dashboard
        </Link>
      </div>

      <section className="rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <Mail size={24} />
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Gmail Sync
            </h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Gmail Sync is temporarily disabled while the import flow is being
              rebuilt for production deployment.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-amber-300">
            <Wrench size={20} />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white">
              Under Maintenance
            </h2>
            <p className="mt-2 text-sm text-amber-100/80">
              The Gmail parsing and import workflow will be re-added after this
              deployment is live. For now, the rest of the dashboard can build
              and deploy safely without IMAP-related errors.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[#071021] p-6">
        <h2 className="text-xl font-semibold">What will come back later</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Inbox Scanning</h3>
            <p className="mt-2 text-sm text-slate-400">
              Pull retailer emails and detect order confirmations.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Approval Queue</h3>
            <p className="mt-2 text-sm text-slate-400">
              Review detected purchases before importing them into inventory.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Inventory Import</h3>
            <p className="mt-2 text-sm text-slate-400">
              Turn approved email orders into inventory entries automatically.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}