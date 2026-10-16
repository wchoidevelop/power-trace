import { NextRequest, NextResponse } from 'next/server'
import coverageIndex from '@/constants/lu_coverage_series_index.json'
import unionWagesIndex from '@/constants/lu_wages_series_index.json'
import nonunionWagesIndex from '@/constants/lu_nonunion_wages_series_index.json'
import { assertBlsOk, badRequest, errorResponse, fetchWithRetry, withRoute } from '@/lib/http'

const BLS_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data'

type FieldKey = 'coverage' | 'union_wages' | 'nonunion_wages'
type TypeKey = 'occupation' | 'industry'
type SeriesEntry = { series_id: string; series_title?: string }
type LuFile = Record<TypeKey, Record<string, SeriesEntry>>

const sources: Record<FieldKey, LuFile> = {
  coverage: coverageIndex as LuFile,
  union_wages: unionWagesIndex as LuFile,
  nonunion_wages: nonunionWagesIndex as LuFile,
}

export const GET = withRoute('LU', async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams
  const industry = searchParams.get('industry')
  const occupation = searchParams.get('occupation')

  if (!industry && !occupation) {
    return badRequest('Please provide an industry or occupation code.')
  }

  const thisyear = new Date().getFullYear()

  const reverseMap = new Map<string, { type: TypeKey; code: string; field: FieldKey }>()
  const seriesid: string[] = []

  const collect = (type: TypeKey, codes: string[]) => {
    for (const code of codes) {
      const c = code.trim()
      if (!c) continue
      for (const field of ['coverage', 'union_wages', 'nonunion_wages'] as FieldKey[]) {
        const entry = sources[field][type]?.[c]
        if (entry?.series_id) {
          seriesid.push(entry.series_id)
          reverseMap.set(entry.series_id, { type, code: c, field })
        }
      }
    }
  }

  if (industry) collect('industry', industry.split(','))
  if (occupation) collect('occupation', occupation.split(','))

  if (seriesid.length === 0) {
    return errorResponse(400, 'no_series', 'No valid LU series found for the provided codes.', false)
  }

  const res = await fetchWithRetry(BLS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seriesid,
      startyear: thisyear - 1,
      endyear: thisyear,
      registrationKey: process.env.BLS_API_KEY,
    }),
  }, { label: 'BLS LU' })

  const data = await res.json()
  assertBlsOk(data, 'BLS LU')

  const organized: Partial<Record<TypeKey, Record<string, Partial<Record<FieldKey, unknown>>>>> = {}

  for (const series of data.Results.series) {
    const meta = reverseMap.get(series.seriesID)
    if (!meta) continue
    const { type, code, field } = meta
    organized[type] ??= {}
    organized[type]![code] ??= {}
    organized[type]![code][field] = series.data
  }

  return NextResponse.json(organized)
})
