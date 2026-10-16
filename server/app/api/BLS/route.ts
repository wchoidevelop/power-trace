import { NextRequest, NextResponse } from 'next/server'
import IOMapping from '@/constants/le_series_index.json'
import coverageIndex from '@/constants/lu_coverage_series_index.json'
import unionWagesIndex from '@/constants/lu_wages_series_index.json'
import nonunionWagesIndex from '@/constants/lu_nonunion_wages_series_index.json'
import { assertBlsOk, badRequest, errorResponse, fetchWithRetry, withRoute } from '@/lib/http'

const BLS_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data'
const BLS_CHUNK_SIZE = 50

// ── JOLTS ─────────────────────────────────────────────────────────────────────
type JoltsMetric = 'HIR' | 'JOR' | 'LDR' | 'QUR' | 'TSR'
type JoltsType = 'hires' | 'job_openings' | 'layoffs' | 'quits' | 'total_separations'
const JOLTS_METRICS: JoltsMetric[] = ['HIR', 'JOR', 'LDR', 'QUR', 'TSR']

// ── LE (CPS earnings by sex) ──────────────────────────────────────────────────
type LeField = 'men' | 'women' | 'women_pct_of_men'
type LeSeriesMap = Record<string, { men?: string; women?: string; women_pct_of_men?: string }>

// ── LU (union coverage / wages) ───────────────────────────────────────────────
type LuField = 'coverage' | 'union_wages' | 'nonunion_wages'
type LuSeriesEntry = { series_id: string; series_title?: string }
type LuFile = Record<Dimension, Record<string, LuSeriesEntry>>

// ── Shared ────────────────────────────────────────────────────────────────────
type Dimension = 'industry' | 'occupation'

type ReverseMeta =
  | { source: 'jolts' }
  | { source: 'le'; dim: Dimension; code: string; field: LeField }
  | { source: 'lu'; dim: Dimension; code: string; field: LuField }

const luSources: Record<LuField, LuFile> = {
  coverage:      coverageIndex   as LuFile,
  union_wages:   unionWagesIndex as LuFile,
  nonunion_wages: nonunionWagesIndex as LuFile,
}

// ── BLS fetch with 50-series chunking ─────────────────────────────────────────
async function fetchBLS(seriesid: string[], startyear: number, endyear: number) {
  const chunks: string[][] = []
  for (let i = 0; i < seriesid.length; i += BLS_CHUNK_SIZE) {
    chunks.push(seriesid.slice(i, i + BLS_CHUNK_SIZE))
  }

  const responses = await Promise.all(
    chunks.map(chunk =>
      fetchWithRetry(BLS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesid: chunk,
          startyear,
          endyear,
          registrationKey: process.env.BLS_API_KEY,
        }),
      }, { label: 'BLS' }).then(r => r.json())
    )
  )

  // BLS answers 200 with a status field, so a failure looks like a success to
  // fetch — this is where a bad pull actually surfaces
  for (const data of responses) assertBlsOk(data)

  return responses.flatMap((data: any) => data.Results.series as any[])
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildJoltsId(supersector: string, metric: JoltsMetric) {
  return `JTS${supersector}000000000${metric}`
}

function getJoltsType(id: string): JoltsType {
  if (id.endsWith('HIR')) return 'hires'
  if (id.endsWith('JOR')) return 'job_openings'
  if (id.endsWith('LDR')) return 'layoffs'
  if (id.endsWith('QUR')) return 'quits'
  return 'total_separations'
}

function splitCodes(param: string) {
  return param.split(',').map(s => s.trim()).filter(Boolean)
}

function collectLe(dim: Dimension, codes: string[], push: PushFn) {
  const key = dim === 'industry' ? 'by_industry' : 'by_occupation'
  const mapping = IOMapping[key] as LeSeriesMap
  for (const code of codes) {
    const entry = mapping[code]
    if (!entry) continue
    for (const field of ['men', 'women', 'women_pct_of_men'] as LeField[]) {
      const id = entry[field]
      if (id) push(id, { source: 'le', dim, code, field })
    }
  }
}

function collectLu(dim: Dimension, codes: string[], push: PushFn) {
  for (const code of codes) {
    for (const field of ['coverage', 'union_wages', 'nonunion_wages'] as LuField[]) {
      const entry = luSources[field][dim]?.[code]
      if (entry?.series_id) push(entry.series_id, { source: 'lu', dim, code, field })
    }
  }
}

type PushFn = (id: string, meta: ReverseMeta) => void

// ── Handler ───────────────────────────────────────────────────────────────────
// Query params:
//   jolts_industry  – JOLTS supersector codes       (e.g. "000000", "31000000")
//   industry        – shared CPS/LU industry codes  (e.g. "507", "1012")
//   le_occupation   – CPS LE occupation codes
//   lu_occupation   – LU occupation codes
export const GET = withRoute('BLS', async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const joltsIndustry = sp.get('jolts_industry')
  const industry      = sp.get('industry')
  const leOccupation  = sp.get('le_occupation')
  const luOccupation  = sp.get('lu_occupation')

  if (!joltsIndustry && !industry && !leOccupation && !luOccupation) {
    return badRequest('Provide at least one of: jolts_industry, industry, le_occupation, lu_occupation.')
  }

  const thisyear = new Date().getFullYear()
  const reverseMap = new Map<string, ReverseMeta>()
  const seriesid: string[] = []

  const push = (id: string, meta: ReverseMeta) => {
    seriesid.push(id)
    reverseMap.set(id, meta)
  }

  // JOLTS
  if (joltsIndustry) {
    for (const code of splitCodes(joltsIndustry)) {
      for (const metric of JOLTS_METRICS) {
        push(buildJoltsId(code, metric), { source: 'jolts' })
      }
    }
  }

  // LE
  if (industry)     collectLe('industry',    splitCodes(industry),     push)
  if (leOccupation) collectLe('occupation',  splitCodes(leOccupation), push)

  // LU
  if (industry)     collectLu('industry',    splitCodes(industry),     push)
  if (luOccupation) collectLu('occupation',  splitCodes(luOccupation), push)

   if (seriesid.length === 0) {
    return errorResponse(400, 'no_series', 'No valid BLS series found for the provided codes.', false)
  }

  // upstream failures propagate to withRoute, which decides retryability —
  // catching them here as a 400 told the client to give up on a hiccup
  const allSeries = await fetchBLS(seriesid, thisyear - 1, thisyear)

  // ── Assemble response ──────────────────────────────────────────────────────
  const jolts: Array<{ code: string; type: JoltsType; data: unknown }> = []
  const le: Partial<Record<Dimension, Record<string, Partial<Record<LeField, unknown>>>>> = {}
  const lu: Partial<Record<Dimension, Record<string, Partial<Record<LuField, unknown>>>>> = {}

  for (const series of allSeries) {
    const meta = reverseMap.get(series.seriesID)
    if (!meta) continue

    switch (meta.source) {
      case 'jolts':
        jolts.push({ code: series.seriesID, type: getJoltsType(series.seriesID), data: series.data })
        break
      case 'le': {
        const dimMap = (le[meta.dim] ??= {})
        const codeMap = (dimMap[meta.code] ??= {})
        codeMap[meta.field] = series.data
        break
      }
      case 'lu': {
        const dimMap = (lu[meta.dim] ??= {})
        const codeMap = (dimMap[meta.code] ??= {})
        codeMap[meta.field] = series.data
        break
      }
    }
  }

  return NextResponse.json({
    ...(joltsIndustry != null          ? { jolts } : {}),
    ...(industry != null || leOccupation != null ? { le } : {}),
    ...(industry != null || leOccupation != null ? { lu } : {}),
  })
})