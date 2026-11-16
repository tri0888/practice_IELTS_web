import type { Context } from 'hono'

/**
 * HTTP error with a FastAPI-compatible body: `{ "detail": ... }`.
 * The frontend reads `data.detail`, so every API error keeps that shape.
 */
export class HttpError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === 'string' ? detail : `HTTP ${status}`)
  }
}

export const httpError = (status: number, detail: unknown) => new HttpError(status, detail)

/** FastAPI answers 422 when a path/query/body value fails validation. */
export const validationError = (loc: string[], msg: string) =>
  new HttpError(422, [{ type: 'value_error', loc, msg }])

const INT_RE = /^\s*[+-]?\d+\s*$/

/** Python-style int(): accepts "12", " 12 ", "+12"; rejects "12a", "1.5". */
export function toInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null
  if (typeof value === 'string' && INT_RE.test(value)) return Number.parseInt(value, 10)
  return null
}

export function intParam(c: Context, name: string): number {
  const n = toInt(c.req.param(name))
  if (n === null) throw validationError(['path', name], 'Input should be a valid integer')
  return n
}

export function intQuery(
  c: Context,
  name: string,
  fallback: number,
  range: { min?: number; max?: number } = {},
): number {
  const raw = c.req.query(name)
  if (raw === undefined || raw === '') return fallback
  const n = toInt(raw)
  if (n === null) throw validationError(['query', name], 'Input should be a valid integer')
  if (range.min !== undefined && n < range.min) throw validationError(['query', name], `Input should be greater than or equal to ${range.min}`)
  if (range.max !== undefined && n > range.max) throw validationError(['query', name], `Input should be less than or equal to ${range.max}`)
  return n
}

/** Parse a JSON body; malformed JSON is a 422 like FastAPI. */
export async function jsonBody<T = Record<string, unknown>>(c: Context): Promise<T> {
  try {
    const body = await c.req.json()
    if (body === null || typeof body !== 'object') throw new Error('not an object')
    return body as T
  } catch {
    throw validationError(['body'], 'Input should be a valid JSON object')
  }
}

export function requireString(body: Record<string, unknown>, field: string): string {
  const v = body[field]
  if (typeof v !== 'string') throw validationError(['body', field], 'Field required (string)')
  return v
}

export const nowIso = () => new Date().toISOString().replace('Z', '')
