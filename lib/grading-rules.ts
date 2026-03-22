export type GradeBand = 10 | 9 | 8 | 7

export type CompanyRules = {
  [grade in GradeBand]: {
    front: number
    back: number
  }
}

export const PSA_RULES: CompanyRules = {
  10: { front: 55, back: 75 },
  9: { front: 60, back: 90 },
  8: { front: 65, back: 90 },
  7: { front: 70, back: 90 },
}

// ACE publishes:
// 10: "less than a 60/40 split"
// 9: > 65/35 front, 70/30 rear
// 8: > 70/30 front, 75/25 rear
// 7: > 75/25 front, 80/20 rear
//
// For app logic, we treat ACE 10 as <= 60 on largest opposite pair.
// If you want to be stricter, use 55 instead.
export const ACE_RULES: CompanyRules = {
  10: { front: 60, back: 60 },
  9: { front: 65, back: 70 },
  8: { front: 70, back: 75 },
  7: { front: 75, back: 80 },
}

export function getEstimatedGrade(
  frontWorstRatio: number,
  backWorstRatio: number,
  rules: CompanyRules
): GradeBand | "Below 7" {
  const grades: GradeBand[] = [10, 9, 8, 7]

  for (const grade of grades) {
    if (
      frontWorstRatio <= rules[grade].front &&
      backWorstRatio <= rules[grade].back
    ) {
      return grade
    }
  }

  return "Below 7"
}