import type { CardCenteringResult, CenteringPair } from "./types"
import { ACE_RULES, PSA_RULES, getEstimatedGrade } from "./grading-rules"

function makePair(x: number, y: number): CenteringPair {
  const total = x + y
  const larger = Math.max(x, y)
  const smaller = Math.min(x, y)

  const left = Math.round((larger / total) * 100)
  const right = 100 - left

  return {
    a: x,
    b: y,
    ratio: `${left}/${right}`,
    worstSidePercent: left,
  }
}

export function calculateCentering(
  left: number,
  right: number,
  top: number,
  bottom: number
): CardCenteringResult {
  const horizontal = makePair(left, right)
  const vertical = makePair(top, bottom)

  return {
    horizontal,
    vertical,
    worstPairPercent: Math.max(
      horizontal.worstSidePercent,
      vertical.worstSidePercent
    ),
  }
}

export function buildGradeGuide(params: {
  front: { left: number; right: number; top: number; bottom: number }
  back: { left: number; right: number; top: number; bottom: number }
}) {
  const front = calculateCentering(
    params.front.left,
    params.front.right,
    params.front.top,
    params.front.bottom
  )

  const back = calculateCentering(
    params.back.left,
    params.back.right,
    params.back.top,
    params.back.bottom
  )

  const frontWorst = front.worstPairPercent
  const backWorst = back.worstPairPercent

  const psa = getEstimatedGrade(frontWorst, backWorst, PSA_RULES)
  const ace = getEstimatedGrade(frontWorst, backWorst, ACE_RULES)

  const notes: string[] = []

  if (frontWorst <= 55) {
    notes.push("Front centering appears strong.")
  } else if (frontWorst <= 60) {
    notes.push("Front centering is good but not perfect.")
  } else {
    notes.push("Front centering may limit top-end grading.")
  }

  if (backWorst > 75) {
    notes.push("Back centering may reduce PSA/ACE ceiling.")
  }

  return {
    front,
    back,
    psa,
    ace,
    notes,
    confidence: "Medium" as const,
  }
}