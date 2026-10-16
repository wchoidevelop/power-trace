import { NextRequest, NextResponse } from 'next/server'
import { isLegalSlug, LEGAL_DOCS, LEGAL_SLUGS, OPERATOR, renderLegalText } from '@/lib/legal'
import { badRequest, withRoute } from '@/lib/http'

/**
 * The legal documents, for the app to render natively.
 *
 *   GET /api/legal                 → both documents
 *   GET /api/legal?doc=privacy     → one
 *   GET /api/legal?doc=terms&format=text → plain text
 *
 * Static text, so it is cached rather than recomputed per request. Revalidating
 * daily means a corrected policy reaches the app within a day without a deploy
 * of the app itself.
 */
export const revalidate = 86_400;

export const GET = withRoute('legal', async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const slug = sp.get('doc')
  const format = sp.get('format')

  if (slug !== null && !isLegalSlug(slug)) {
    return badRequest(`Unknown document "${slug}". Expected one of: ${LEGAL_SLUGS.join(', ')}.`)
  }

  if (format === 'text') {
    const body = slug
      ? renderLegalText(LEGAL_DOCS[slug])
      : LEGAL_SLUGS.map((s) => renderLegalText(LEGAL_DOCS[s])).join('\n\n———\n\n')
    return new NextResponse(body, {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  return NextResponse.json({
    app: OPERATOR.appName,
    // where the canonical web copies live, for "open in browser" and for the
    // app-store listing that has to point at a public URL
    web: {
      privacy: `${OPERATOR.siteUrl}/privacy`,
      terms: `${OPERATOR.siteUrl}/terms`,
    },
    docs: slug ? [LEGAL_DOCS[slug]] : LEGAL_SLUGS.map((s) => LEGAL_DOCS[s]),
  })
})
