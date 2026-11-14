// Shapes of the JSON written by `python -m pipeline.build`.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.

export type Num = number | null

export interface RegionMeta {
  id: string
  name: string
  short: string
  kind: 'country' | 'composite' | 'province' | 'custom'
  bbox: [number, number, number, number]
  detections: { raw: number; kept: number }
  ratio?: number
  pearson?: Num
  peakMonth?: number
}

export interface LoyoRow {
  year: number
  months: number
  actual: number
  naive: number
  overall: number
  monthly: number
  maeMonthly: number
  maeOverall: number
  maeNaive: number
}

export interface YearRow {
  year: number
  modis: Num
  viirs: Num
  viirsH: Num
  harmonized: Num
  partial: boolean
  terraOnly: boolean
}

export interface CalendarData extends Omit<RegionMeta, 'ratio' | 'pearson' | 'peakMonth'> {
  months: string[]
  modis: Num[]
  viirs: Num[]
  viirsH: Num[]
  harmonized: Num[]
  raw: Num[]
  z: Num[]
  anomaly: number[]
  partial: Record<string, string>
  ratio: {
    overall: number
    byMonth: number[]
    rawByMonth: Num[]
    modisByMonth: number[]
    viirsByMonth: number[]
    shrinkK: number
  }
  validation: {
    overlapMonths: number
    overlapStart: string | null
    pearsonMonthly: Num
    pearsonMonthlyLog: Num
    loyo: LoyoRow[]
    loyoSummary: {
      medianAnnualAPE: { naive: Num; overall: Num; monthly: Num }
      meanMonthlyMAE: { naive: Num; overall: Num; monthly: Num }
    }
  }
  climatology: { median: Num[]; p25: Num[]; p75: Num[]; mean: Num[] }
  years: YearRow[]
  summary: {
    topYears: { year: number; harmonized: number }[]
    peakMonth: number
    lastCompleteMonth: string
    lastCompleteValue: Num
    lastCompleteMedian: Num
    lastCompleteZ: Num
    totalHarmonized: number
    anomalyCount: number
  }
}

export interface IndexData {
  generatedAt: string
  months: [string, string]
  coverage: Record<'MODIS' | 'VIIRS', { first: string; last: string; fullFrom: string; fullTo: string; satellites: string[] }>
  partial: Record<string, string>
  mask: {
    inputDetections: number
    removedTypeOrStatic: number
    kept: number
    removedByLayer: Record<string, number>
    removedByFamily: Record<string, number>
    typeCells: number
    persistenceCells: number
    nightCoarseCells: number
    gihsPolygons: number
    rules: Record<string, string | number>
    gihs: string
  }
  regions: RegionMeta[]
  defaultRegion: string
}

export type ViewId = 'overview' | 'calendar' | 'method' | 'operations' | 'about'
export type Mode = 'harmonized' | 'raw'

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
