export type CenteringPair = {
  a: number
  b: number
  ratio: string
  worstSidePercent: number
}

export type CardCenteringResult = {
  horizontal: CenteringPair
  vertical: CenteringPair
  worstPairPercent: number
}

export type ScanAnalysis = {
  front: CardCenteringResult
  back: CardCenteringResult
  psa: number | "Below 7"
  ace: number | "Below 7"
  notes: string[]
  confidence: "Low" | "Medium" | "High"
}