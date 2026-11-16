/**
 * Vercel entry point (Node.js runtime). vercel.json rewrites every path to this
 * function; the original URL is preserved, so Hono routes `/api/*` as usual.
 */
import { handle } from 'hono/vercel'
import app from '../src/app'

const handler = handle(app)

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
