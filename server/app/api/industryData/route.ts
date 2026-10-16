import { NextRequest, NextResponse } from 'next/server'
import { classifyIndustryOccupation, findOccupations } from '@/lib/ai'
import { badRequest, UpstreamError, withRoute } from '@/lib/http'

// embeddings + vector search + a nano classifier: quicker than the reasoning
// layers, but still past a 60s platform default on a cold Mongo connection
export const maxDuration = 120;

export const POST = withRoute('industryData', async (req: NextRequest) => {
  const { orgDescription, userRole } = await req.json()
  if (!orgDescription || !userRole) {
    return badRequest('Please type in the org description and your role.')
  }

  // vector search over SOC/CPS, then the classifier picks the codes
  const { soc: SOCCandidates, cps: CPSCandidates } = await findOccupations(userRole)
  const res = await classifyIndustryOccupation(
    orgDescription, userRole, SOCCandidates, CPSCandidates.le, CPSCandidates.lu_wages
  )

  try {
    return NextResponse.json(JSON.parse(res))
  } catch {
    // the model returned something that is not JSON — a fresh sample usually is
    throw new UpstreamError('The classifier returned malformed output.', 502, true)
  }
})
