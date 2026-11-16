import { createMiddleware } from 'hono/factory'
import { httpError } from '../../http'
import { decodeToken, findUserById, type PublicUser } from './services'

export type AuthEnv = { Variables: { user: PublicUser } }

/** Token from `?token=` (used by <audio>/<iframe> URLs) or `Authorization: Bearer`. */
function readToken(query: string | undefined, authorization: string | undefined): string | null {
  if (query) return query
  if (authorization && authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim()
  return null
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = readToken(c.req.query('token'), c.req.header('authorization'))
  if (!token) throw httpError(401, 'Authentication required')
  const payload = await decodeToken(token)
  const user = await findUserById(payload.sub)
  if (!user) throw httpError(401, 'Invalid authentication token')
  c.set('user', user)
  await next()
})

export const requireApproved = createMiddleware<AuthEnv>(async (c, next) => {
  await requireAuth(c, async () => {
    if (c.get('user').role !== 'approved') throw httpError(403, 'Account is pending approval')
    await next()
  })
})
