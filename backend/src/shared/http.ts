import type { IncomingHttpHeaders } from 'node:http'
import type { PublicUser } from '../modules/auth/auth.services'

export class HttpError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail)
  }
}

export const httpError = (status: number, detail: string) => new HttpError(status, detail)

export const validationError = (field: string, msg: string) => new HttpError(422, `${field}: ${msg}`)

export type ApiRequest = {
  method: string
  path: string
  params: Record<string, string>
  query: URLSearchParams
  headers: IncomingHttpHeaders
  body: string
  user?: PublicUser
}

export class Reply {
  constructor(
    public status: number,
    public body: unknown,
    public headers: Record<string, string> = {},
  ) {}
}

export const json = (body: unknown, status = 200) => new Reply(status, body, { 'Content-Type': 'application/json' })
export const text = (body: string, status = 200) => new Reply(status, body, { 'Content-Type': 'text/plain; charset=utf-8' })
export const redirect = (location: string) => new Reply(302, undefined, { Location: location })

export type Guard = 'auth'
export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  guard?: Guard
  handler: (req: ApiRequest) => unknown
}

const INT_RE = /^\s*[+-]?\d+\s*$/

export function toInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null
  if (typeof value === 'string' && INT_RE.test(value)) return Number.parseInt(value, 10)
  return null
}

export function intParam(req: ApiRequest, name: string): number {
  const n = toInt(req.params[name])
  if (n === null) throw validationError(name, 'must be an integer')
  return n
}

export function intQuery(req: ApiRequest, name: string, fallback: number, range: { min?: number; max?: number } = {}): number {
  const raw = req.query.get(name)
  if (raw === null || raw === '') return fallback
  const n = toInt(raw)
  if (n === null) throw validationError(name, 'must be an integer')
  if (range.min !== undefined && n < range.min) throw validationError(name, `must be greater than or equal to ${range.min}`)
  if (range.max !== undefined && n > range.max) throw validationError(name, `must be less than or equal to ${range.max}`)
  return n
}

export const queryString = (req: ApiRequest, name: string) => req.query.get(name) || undefined

export function jsonBody(req: ApiRequest): Record<string, unknown> {
  try {
    const body = JSON.parse(req.body)
    if (body === null || typeof body !== 'object') throw new Error('not an object')
    return body
  } catch {
    throw validationError('body', 'must be a valid JSON object')
  }
}

export function requireString(body: Record<string, unknown>, field: string): string {
  const v = body[field]
  if (typeof v !== 'string') throw validationError(field, 'field required (string)')
  return v
}

export const nowIso = () => new Date().toISOString().replace('Z', '')
