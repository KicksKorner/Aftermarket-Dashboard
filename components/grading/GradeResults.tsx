import type { ScanAnalysis } from "@/lib/types";

export default function GradeResults({ result }: { result: ScanAnalysis }) {
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
      <h3 className="text-xl font-semibold text-white">
        Estimated Grading Guide
      </h3>

      <div className="rounded-xl border border-white/10 p-4">
        <h4 className="mb-2 font-medium text-white">Front Centering</h4>
        <p className="text-slate-300">
          Horizontal: {result.front.horizontal.ratio}
        </p>
        <p className="text-slate-300">
          Vertical: {result.front.vertical.ratio}
        </p>
        <p className="text-slate-300">
          Worst pair: {result.front.worstPairPercent}/100
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-slate-100 p-4 text-slate-900">
          <p className="text-sm text-slate-500">PSA rough guide</p>
          <p className="text-2xl font-bold">
            {typeof result.psa === "number" ? `PSA ${result.psa}` : result.psa}
          </p>
        </div>

        <div className="rounded-xl bg-slate-100 p-4 text-slate-900">
          <p className="text-sm text-slate-500">ACE rough guide</p>
          <p className="text-2xl font-bold">
            {typeof result.ace === "number" ? `ACE ${result.ace}` : result.ace}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-white">Notes</p>
        <ul className="list-disc pl-5 text-sm text-slate-300">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-slate-400">
        This is a rough front-centering estimate only. Corners, edges, surface,
        print lines, scratches, dents, whitening, gloss, stains, and grader
        discretion still affect final grades.
      </p>
    </div>
  );
}