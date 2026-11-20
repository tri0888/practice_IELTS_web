import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { httpError, nowIso } from '../../shared/http'
import * as repo from './auth.repositories'
import type { UserDoc } from './auth.repositories'

export type PublicUser = { id: string; email: string; name: string }

const jwtSecret = () => process.env.JWT_SECRET || 'change-this-secret-in-production'
const TOKEN_EXPIRES_IN = '7d'
const BCRYPT_ROUNDS = 12

export function publicUser(user: Partial<UserDoc>): PublicUser {
  return { id: user.id!, email: user.email!, name: user.name! }
}

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS)

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash || '')
  } catch {
    return false
  }
}

export function signToken(user: Pick<UserDoc, 'id' | 'email'>): string {
  return jwt.sign({ email: user.email }, jwtSecret(), {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: TOKEN_EXPIRES_IN,
  })
}

export function verifyToken(token: string): jwt.JwtPayload {
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] })
    if (typeof payload === 'string') throw new Error('unexpected payload')
    return payload
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw httpError(401, 'Authentication token expired')
    throw httpError(401, 'Invalid authentication token')
  }
}

export async function getUserFromToken(token: string): Promise<PublicUser> {
  const { sub } = verifyToken(token)
  const user = sub ? await repo.findUserById(sub) : null
  if (!user) throw httpError(401, 'Invalid authentication token')
  return publicUser(user)
}

type CredentialsResult = { ok: true; user: UserDoc } | { ok: false; reason: 'not_found' | 'wrong_password' }

export async function checkCredentials(email: string, password: string): Promise<CredentialsResult> {
  const user = await repo.findUserByEmail(email.trim().toLowerCase())
  if (!user) return { ok: false, reason: 'not_found' }
  if (!(await verifyPassword(password, user.password_hash))) return { ok: false, reason: 'wrong_password' }
  return { ok: true, user }
}

export async function register(emailRaw: string, password: string, nameRaw: string): Promise<PublicUser> {
  const email = emailRaw.trim().toLowerCase()
  const name = nameRaw.trim()
  if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters')
  if (!email || !email.includes('@')) throw httpError(400, 'A valid email is required')
  if (!name) throw httpError(400, 'Name is required')
  if (await repo.findUserByEmail(email)) throw httpError(409, 'Email is already registered')

  const now = nowIso()
  const user: UserDoc = {
    id: randomUUID(),
    email,
    name,
    password_hash: await hashPassword(password),
    created_at: now,
    updated_at: now,
  }
  await repo.insertUser(user)
  return publicUser(user)
}

export async function login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
  const result = await checkCredentials(email, password)
  if ('reason' in result) throw httpError(401, 'Invalid email or password')
  return { token: signToken(result.user), user: publicUser(result.user) }
}
