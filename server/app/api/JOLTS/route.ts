import { NextRequest, NextResponse } from 'next/server'
import { assertBlsOk, badRequest, fetchWithRetry, withRoute } from '@/lib/http'

const BLS_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'

// Unemployment level, seasonally adjusted (CPS) — needed for V/U ratio.
const UNEMPLOYMENT_SERIES = 'LNS13000000'

// Total nonfarm job openings LEVEL, national. Industry code 000000.
// V/U is only meaningful against national unemployment, so this is always
// fetched regardless of which industry the caller asked for.
const NATIONAL_OPENINGS_SERIES = 'JTS000000000000000JOL'

const RATE_ELEMENTS = {
  JOR: 'job_openings',
  HIR: 'hires',
  TSR: 'total_separations',
  QUR: 'quits',
  LDR: 'layoffs',
} as const

const LEVEL_ELEMENTS = {
  JOL: 'job_openings',
  HIL: 'hires',
  TSL: 'total_separations',
  QUL: 'quits',
  LDL: 'layoffs',
} as const

type MetricName = (typeof RATE_ELEMENTS)[keyof typeof RATE_ELEMENTS]

// Baseline window: the last stretch of "normal" labor market before COVID.
// Everything is scored relative to this, not to an absolute threshold.
const BASELINE_START = 2015
const BASELINE_END = 2019

// JOLTS begins Dec 2000. BLS caps a single request at 20 years.
const HISTORY_YEARS = 19

type Point = {
  date: string // 'YYYY-MM'
  year: number
  month: number
  value: number
  preliminary: boolean
}

type Series = {
  code: string
  metric: MetricName
  kind: 'rate' | 'level'
  data: Point[] // ascending by date
}

// JOLTS series id layout:
// JT + S(seasonal) + industry(6) + state(2) + area(5) + sizeclass(2) + element(2) + rate|level(1)
function buildSeriesId(industry: string, element: string) {
  return `JTS${industry}000000000${element}`
}

function parseSeries(raw: any): Point[] {
  return (raw.data ?? [])
    .filter((d: any) => d.period !== 'M13') // M13 is the annual average, not a month
    .map((d: any) => {
      const year = Number(d.year)
      const month = Number(d.period.slice(1))
      return {
        date: `${year}-${String(month).padStart(2, '0')}`,
        year,
        month,
        value: Number(d.value),
        preliminary: (d.footnotes ?? []).some((f: any) => f?.code === 'P'),
      }
    })
    .filter((p: Point) => Number.isFinite(p.value))
    .sort((a: Point, b: Point) => a.date.localeCompare(b.date)) // BLS returns newest-first
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN
}

function stdev(xs: number[]) {
  if (xs.length < 2) return NaN
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}

function percentileRank(history: number[], v: number) {
  if (!history.length) return NaN
  const below = history.filter((x) => x < v).length
  const equal = history.filter((x) => x === v).length
  return (below + equal / 2) / history.length
}

/** Shift a 'YYYY-MM' key back by n months. */
function monthsBefore(date: string, n: number) {
  const [y, m] = date.split('-').map(Number)
  const idx = y * 12 + (m - 1) - n
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/**
 * Look back by DATE, not by array position. BLS suppresses cells and JOLTS has
 * gaps in the thinner industry series; indexing points[len-1-12] there compares
 * the wrong two months and reports it as a 12-month change.
 */
function lookback(points: Point[], monthsBack: number) {
  const from = points[points.length - 1]
  if (!from) return null
  const target = monthsBefore(from.date, monthsBack)
  return points.find((p) => p.date === target)?.value ?? null
}

/**
 * Position a current reading against its own history.
 * z is vs the 2015-19 baseline; percentile is vs everything we pulled.
 */
function score(points: Point[]) {
  if (!points.length) return null
  const latest = points[points.length - 1]
  const baseline = points
    .filter((p) => p.year >= BASELINE_START && p.year <= BASELINE_END)
    .map((p) => p.value)
  const all = points.map((p) => p.value)

  const bMean = mean(baseline)
  const bSd = stdev(baseline)

  const delta = (monthsBack: number) => {
    const prior = lookback(points, monthsBack)
    return prior === null ? null : Number((latest.value - prior).toFixed(2))
  }

  return {
    latest: latest.value,
    date: latest.date,
    preliminary: latest.preliminary,
    baselineMean: Number(bMean.toFixed(2)),
    z: Number.isFinite(bSd) && bSd > 0 ? Number(((latest.value - bMean) / bSd).toFixed(2)) : null,
    percentile: Number((percentileRank(all, latest.value) * 100).toFixed(0)),
    change3m: delta(3),
    change12m: delta(12),
  }
}

/**
 * Divide two series month-by-month on matching dates.
 *
 * Do NOT just divide the last point of each. CPS (unemployment) publishes for
 * month M in the first week of M+1; JOLTS publishes for month M about four
 * weeks later. So at any given moment the unemployment series runs one month
 * ahead of the openings series, and taking latest/latest silently pairs
 * mismatched months.
 */
function alignedRatio(numerator: Point[], denominator: Point[]) {
  const d = new Map(denominator.map((p) => [p.date, p.value]))
  return numerator
    .filter((p) => {
      const v = d.get(p.date)
      return v !== undefined && v > 0
    })
    .map((p) => ({ date: p.date, value: p.value / d.get(p.date)! }))
}

/**
 * The classification. Read hiring and separations jointly — neither means
 * anything alone. Low hires + low quits + low layoffs is a frozen market,
 * which looks nothing like low hires + high layoffs even though both are "weak".
 */
function classify(hiresZ: number | null, quitsZ: number | null, layoffsZ: number | null) {
  if (hiresZ === null || quitsZ === null || layoffsZ === null) {
    return { state: 'unknown', description: 'Insufficient baseline data.' }
  }

  if (layoffsZ > 1.0) {
    return hiresZ > 0
      ? {
          state: 'reallocating',
          description:
            'Elevated layoffs alongside strong hiring. Labor is moving between sectors rather than exiting.',
        }
      : {
          state: 'contracting',
          description:
            'Elevated layoffs with weak hiring. Involuntary separations dominate; worker leverage is minimal.',
        }
  }

  if (quitsZ > 0.5 && hiresZ > 0.5) {
    return {
      state: 'tight',
      description:
        'High churn with voluntary separations leading. Workers hold a credible exit threat.',
    }
  }

  if (hiresZ < -0.5 && quitsZ < -0.5) {
    return {
      state: 'frozen',
      description:
        'Low-hire, low-fire. Employers are hoarding labor: unwilling to cut staff they may need, unwilling to commit to new headcount. Openings can look healthy while almost nobody moves.',
    }
  }

  return { state: 'balanced', description: 'Flows are near their pre-pandemic norms.' }
}

/**
 * Composite 0-100. Quits is weighted heaviest because it is revealed
 * preference — people only quit when they believe something better exists.
 */
function workerPowerIndex(quitsZ: number | null, openingsZ: number | null, layoffsZ: number | null) {
  if (quitsZ === null || openingsZ === null || layoffsZ === null) return null
  const composite = 0.5 * quitsZ + 0.3 * openingsZ - 0.2 * layoffsZ
  // squash to 0-100, with the baseline mean landing at 50
  return Number((100 / (1 + Math.exp(-composite))).toFixed(1))
}

export const GET = withRoute('JOLTS', async (req: NextRequest) => {
  const industryParam = req.nextUrl.searchParams.get('industry')
  if (!industryParam) {
    return badRequest('Please provide an industry code.')
  }

  const industries = industryParam.split(',').map((s) => s.trim()).filter(Boolean)

  // 10 series per industry + 1 unemployment series, against a 50-series cap.
  if (industries.length > 4) {
    return badRequest('Maximum 4 industries per request (BLS caps a request at 50 series).')
  }

  const thisYear = new Date().getFullYear()

  const rateIds = industries.flatMap((i) =>
    Object.keys(RATE_ELEMENTS).map((e) => buildSeriesId(i, e))
  )
  const levelIds = industries.flatMap((i) =>
    Object.keys(LEVEL_ELEMENTS).map((e) => buildSeriesId(i, e))
  )
  // Set-dedupe: if the caller asked for 000000 (total nonfarm) we would
  // otherwise request the national openings series twice.
  const seriesid = Array.from(
    new Set([...rateIds, ...levelIds, UNEMPLOYMENT_SERIES, NATIONAL_OPENINGS_SERIES])
  )

  // Transport failures and BLS's own status field are both handled by the
  // helpers: transient ones are retried here, then re-thrown for withRoute to
  // label so the client knows whether retrying is worth anything.
  const res = await fetchWithRetry(BLS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seriesid,
      startyear: String(thisYear - HISTORY_YEARS),
      endyear: String(thisYear),
      registrationKey: process.env.BLS_API_KEY,
      catalog: false,
    }),
    // JOLTS publishes monthly; there is no reason to hit BLS on every request.
    next: { revalidate: 60 * 60 * 12 },
  }, { label: 'BLS JOLTS' })

  const payload: any = await res.json()
  assertBlsOk(payload, 'BLS JOLTS')

  const parsed: Record<string, Point[]> = {}
  for (const s of payload.Results?.series ?? []) {
    parsed[s.seriesID] = parseSeries(s)
  }

  const unemployment = parsed[UNEMPLOYMENT_SERIES] ?? []
  const nationalOpenings = parsed[NATIONAL_OPENINGS_SERIES] ?? []

  // National V/U — the Beveridge-curve input. ~2.0 at the 2022 peak,
  // compressing toward 1.0. Industry-agnostic by construction.
  const vuSeries = alignedRatio(nationalOpenings, unemployment).map((p) => ({
    date: p.date,
    value: Number(p.value.toFixed(2)),
  }))
  const vuLatest = vuSeries[vuSeries.length - 1] ?? null
  const vuYearAgo = vuLatest
    ? vuSeries.find((p) => p.date === monthsBefore(vuLatest.date, 12)) ?? null
    : null

  const results = industries.map((industry) => {
    const rates: Partial<Record<MetricName, ReturnType<typeof score>>> = {}
    const series: Series[] = []

    for (const [element, metric] of Object.entries(RATE_ELEMENTS)) {
      const id = buildSeriesId(industry, element)
      const pts = parsed[id] ?? []
      rates[metric] = score(pts)
      series.push({ code: id, metric, kind: 'rate', data: pts })
    }

    const levelLatest: Partial<Record<MetricName, number | null>> = {}
    for (const [element, metric] of Object.entries(LEVEL_ELEMENTS)) {
      const id = buildSeriesId(industry, element)
      const pts = parsed[id] ?? []
      levelLatest[metric] = pts[pts.length - 1]?.value ?? null
      series.push({ code: id, metric, kind: 'level', data: pts })
    }

    const quits = rates.quits?.latest
    const layoffs = rates.layoffs?.latest
    const seps = rates.total_separations?.latest
    const hires = rates.hires?.latest

    const openingsLevel = levelLatest.job_openings
    const hiresLevel = levelLatest.hires

    // `!= null` throughout, not truthiness: a legitimate 0 is data, not a gap.
    // Denominators are still checked for 0 separately.
    const derived = {
      // Above ~2.0 means voluntary exits dominate — leverage sits with labor.
      quitsToLayoffs: quits != null && layoffs ? Number((quits / layoffs).toFixed(2)) : null,
      // Share of separations that are voluntary. Fell from ~65% at the 2022 peak.
      quitsShareOfSeparations: quits != null && seps ? Number(((quits / seps) * 100).toFixed(1)) : null,
      // Hires produced per open posting per month. Falling yield with flat
      // openings means postings are stale or speculative.
      vacancyYield:
        hiresLevel != null && openingsLevel ? Number((hiresLevel / openingsLevel).toFixed(3)) : null,
      // Thin or negative means employment is barely growing.
      netFlowRate: hires != null && seps != null ? Number((hires - seps).toFixed(2)) : null,
      // NOTE: V/U deliberately lives at the top level of the response, not here.
      // CPS unemployment has no industry dimension, so an industry openings
      // level over national unemployment is not a ratio of anything.
    }

    const classification = classify(
      rates.hires?.z ?? null,
      rates.quits?.z ?? null,
      rates.layoffs?.z ?? null
    )

    return {
      industry,
      asOf: rates.quits?.date ?? null,
      preliminary: rates.quits?.preliminary ?? false,
      rates,
      derived,
      classification,
      workerPowerIndex: workerPowerIndex(
        rates.quits?.z ?? null,
        rates.job_openings?.z ?? null,
        rates.layoffs?.z ?? null
      ),
      series,
    }
  })

  return NextResponse.json({
    baseline: `${BASELINE_START}-${BASELINE_END} mean`,
    national: {
      vacanciesPerUnemployed: vuLatest?.value ?? null,
      asOf: vuLatest?.date ?? null,
      change12m:
        vuLatest && vuYearAgo ? Number((vuLatest.value - vuYearAgo.value).toFixed(2)) : null,
      series: vuSeries,
    },
    industries: results,
  })
})