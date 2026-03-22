import type { ScanAnalysis } from "@/lib/types"

export default function GradeResults({ result }: { result: ScanAnalysis }) {
  return (
    <div className="rounded-2xl border p-5 shadow-sm space-y-4">
      <h3 className="text-xl font-semibold">Estimated Grading Guide</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h4 className="font-medium mb-2">Front</h4>
          <p>Horizontal: {result.front.horizontal.ratio}</p>
          <p>Vertical: {result.front.vertical.ratio}</p>
          <p>Worst pair: {result.front.worstPairPercent}/100</p>
        </div>

        <div className="rounded-xl border p-4">
          <h4 className="font-medium mb-2">Back</h4>
          <p>Horizontal: {result.back.horizontal.ratio}</p>
          <p>Vertical: {result.back.vertical.ratio}</p>
          <p>Worst pair: {result.back.worstPairPercent}/100</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="text-sm text-gray-500">PSA rough guide</p>
          <p className="text-2xl font-bold">
            {typeof result.psa === "number" ? `PSA ${result.psa}` : result.psa}
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-4">
          <p className="text-sm text-gray-500">ACE rough guide</p>
          <p className="text-2xl font-bold">
            {typeof result.ace === "number" ? `ACE ${result.ace}` : result.ace}
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-1">Notes</p>
        <ul className="list-disc pl-5 text-sm text-gray-700">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-500">
        This is a rough centering-based estimate only. Corners, edges, surface,
        print lines, scratches, dents, whitening, gloss, stains, and grader discretion
        still affect final grades.
      </p>
    </div>
  )
}