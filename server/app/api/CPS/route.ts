import { NextRequest, NextResponse } from 'next/server'
import IOMapping from '@/constants/le_series_index.json'
import { assertBlsOk, badRequest, errorResponse, fetchWithRetry, withRoute } from '@/lib/http'

const CPS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data"

type FieldKey = 'men' | 'women' | 'women_pct_of_men'
type TypeKey = 'occupation' | 'industry'
type SeriesMap = Record<string, { men?: string; women?: string; women_pct_of_men?: string }>

export const GET = withRoute('CPS', async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams
  const industry = searchParams.get('industry')
  const occupation = searchParams.get('occupation')

  if (!industry && !occupation) {
    return badRequest('Please provide an industry or occupation code.')
  }

  const thisyear = new Date().getFullYear()

  // seriesId -> { code, field } for reassembly after the flat BLS response
  const reverseMap = new Map<string, { type: TypeKey, code: string; field: FieldKey }>()
  const seriesid: string[] = []

  const collectSeries = (mapping: SeriesMap, codes: string[], type: TypeKey) => {
    for (const code of codes) {
      const entry = mapping[code]
      if (!entry) continue
      for (const field of ['men', 'women', 'women_pct_of_men'] as FieldKey[]) {
        const id = entry[field]
        if (id) {
          seriesid.push(id)
          reverseMap.set(id, { type, code, field })
        }
      }
    }
  }

  if (industry) collectSeries(IOMapping['by_industry'] as SeriesMap, industry.split(','), 'industry')
  if (occupation) collectSeries(IOMapping['by_occupation'] as SeriesMap, occupation.split(','), 'occupation')

  if (seriesid.length === 0) {
    return errorResponse(400, 'no_series', 'No valid series found for the provided codes.', false)
  }

  const res = await fetchWithRetry(CPS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seriesid,
      startyear: thisyear - 1,
      endyear: thisyear,
      registrationKey: process.env.BLS_API_KEY,
    }),
  }, { label: 'BLS CPS' })

  const data = await res.json()
  assertBlsOk(data, 'BLS CPS')

  // Reassemble flat series array into { [code]: { men?, women?, women_pct_of_men? } }
  const organized: Partial<Record<TypeKey, Partial<Record<string, Partial<Record<FieldKey, unknown>>>>>> = {}

  for (const series of data.Results.series) {
    const meta = reverseMap.get(series.seriesID)
    if (!meta) continue
    const { type, code, field } = meta
    organized[type] ??= {}
    organized[type][code] ??= {}
    organized[type][code][field] = series.data
  }

  return NextResponse.json(organized)
})