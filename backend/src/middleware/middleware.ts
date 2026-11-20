import { getUserFromToken } from '../modules/auth/auth.services'
import { httpError, type ApiRequest, type Guard } from '../shared/http'

function readToken(req: ApiRequest): string | null {
  const fromQuery = req.query.get('token')
  if (fromQuery) return fromQuery
  const authorization = req.headers.authorization
  if (authorization && authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim()
  return null
}

export async function requireAuth(req: ApiRequest): Promise<void> {
  const token = readToken(req)
  if (!token) throw httpError(401, 'Authentication required')
  req.user = await getUserFromToken(token)
}

export const guards: Record<Guard, (req: ApiRequest) => Promise<void>> = {
  auth: requireAuth,
}
