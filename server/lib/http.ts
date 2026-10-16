import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * One error shape for every route, because the client decides whether to offer
 * a retry from it:
 *
 *   { error: { code, message, retryable } }
 *
 * `retryable` is the contract. A rejected payload is the caller's problem and
 * will fail identically forever; an upstream BLS hiccup or an OpenAI rate limit
 * will not. Returning 400 for an upstream failure — which several of these
 * routes used to do — tells the client to give up on something that would have
 * worked on the next try.
 */
export type ErrorCode =
  | 'invalid_request'
  | 'no_series'
  | 'upstream_unavailable'
  | 'upstream_error'
  | 'rate_limited'
  | 'internal_error'

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  retryable: boolean,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: { code, message, retryable, ...extra } }, { status })
}

/** The caller sent something we cannot work with. Retrying will not help. */
export function badRequest(message: string, extra?: Record<string, unknown>) {
  return errorResponse(400, 'invalid_request', message, false, extra)
}

/** A zod guard rejected the body. */
export function invalidBody(error: z.ZodError) {
  return errorResponse(400, 'invalid_request', 'The request body did not match what this route expects.', false, {
    detail: z.treeifyError(error),
  })
}

/** Codes returned by fetch/undici for a connection that never completed. */
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET',
])

function isTransient(err: any): boolean {
  if (err instanceof UpstreamError) return err.retryable
  const code = err?.code ?? err?.cause?.code
  if (code && TRANSIENT_NETWORK_CODES.has(String(code))) return true
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') return true
  // the OpenAI SDK surfaces HTTP status on the error object
  const status = err?.status ?? err?.response?.status
  if (typeof status === 'number') return status === 408 || status === 429 || status >= 500
  return false
}

/** An upstream (BLS, OpenAI, Mongo) call failed. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryable = true,
  ) {
    super(message)
    this.name = 'UpstreamError'
  }
}

/**
 * Wrap a route handler so nothing escapes as an opaque 500 with an HTML body —
 * the client cannot classify those, so it cannot decide whether to retry.
 */
export function withRoute<T extends any[]>(
  name: string,
  handler: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (err: any) {
      const retryable = isTransient(err)
      const status = err instanceof UpstreamError ? err.status : err?.status === 429 ? 429 : retryable ? 502 : 500

      console.error(`[${name}] failed${retryable ? ' (retryable)' : ''}:`, err?.message ?? err)
      if (err?.cause) console.error(`[${name}] cause:`, err.cause)
      if (err?.stack) console.error(err.stack)

      if (status === 429) {
        return errorResponse(429, 'rate_limited', 'The service this step depends on is rate limiting us.', true)
      }
      // UpstreamError messages are ours and safe to show; anything else is an
      // unexpected throw, so keep it generic and leave the detail in the log.
      if (err instanceof UpstreamError) {
        return errorResponse(status, retryable ? 'upstream_unavailable' : 'upstream_error', err.message, retryable)
      }
      return errorResponse(
        status,
        retryable ? 'upstream_unavailable' : 'internal_error',
        retryable
          ? 'A service this step depends on is temporarily unavailable.'
          : `This step failed: ${err?.message ?? 'unknown error'}`,
        retryable,
      )
    }
  }
}

const RETRY_BASE_MS = 500
const MAX_RETRY_WAIT_MS = 4_000
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * fetch + retry for upstream calls. BLS returns transient 5xx and occasionally
 * drops connections under load; a retry here costs one round trip instead of
 * making the phone re-run the whole step.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit & { next?: { revalidate: number } },
  { retries = 2, timeoutMs = 45_000, label = 'upstream' } = {},
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      if (res.status === 429 || res.status >= 500) {
        throw new UpstreamError(`${label} returned ${res.status}`, res.status === 429 ? 429 : 502, true)
      }
      return res
    } catch (err: any) {
      if (!isTransient(err) || attempt > retries) {
        if (err instanceof UpstreamError) throw err
        throw new UpstreamError(`${label} request failed: ${err?.message ?? err}`, 502, isTransient(err))
      }
      const wait = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), MAX_RETRY_WAIT_MS)
      console.warn(`[${label}] attempt ${attempt} failed (${err?.message ?? err}) — retrying in ${wait}ms`)
      await sleep(wait)
    }
  }
}

/**
 * BLS answers 200 with a status field, so a failed request looks like a success
 * to fetch. REQUEST_NOT_PROCESSED and the daily-threshold message are worth
 * retrying; a malformed-series complaint is not.
 */
export function assertBlsOk(payload: any, label = 'BLS'): void {
  if (payload?.status === 'REQUEST_SUCCEEDED') return
  const status = String(payload?.status ?? 'unknown')
  const messages: string[] = Array.isArray(payload?.message) ? payload.message : []
  const text = messages.join('; ')
  const threshold = /threshold|daily limit|too many requests/i.test(text)
  const retryable = threshold || status === 'REQUEST_NOT_PROCESSED'
  throw new UpstreamError(
    `${label} error: ${status}${text ? ` — ${text}` : ''}`,
    threshold ? 429 : retryable ? 502 : 400,
    retryable,
  )
}
