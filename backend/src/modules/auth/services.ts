import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { SignJWT, errors as joseErrors, jwtVerify, type JWTPayload } from 'jose'
import { COLLECTIONS, getCollection } from '../../db'
import { httpError, nowIso } from '../../http'

export type UserRole = 'approved' | 'pending' | string
export type PublicUser = { id: string; email: string; name: string; role: UserRole }
export type UserDoc = PublicUser & { password_hash: string; created_at?: string; updated_at?: string }

// Same default as the Python backend so tokens it issued stay valid. Set JWT_SECRET in production.
const JWT_SECRET = () => new TextEncoder().encode(process.env.JWT_SECRET || 'change-this-secret-in-production')
const TOKEN_EXPIRE_DAYS = 7
const BCRYPT_ROUNDS = 12 // Python bcrypt.gensalt() default

async function usersCollection() {
  const coll = await getCollection<UserDoc>(COLLECTIONS.users)
  if (!coll) throw httpError(503, 'Database is not available')
  return coll
}

export function publicUser(user: Partial<UserDoc>): PublicUser {
  return { id: user.id!, email: user.email!, name: user.name!, role: user.role ?? 'pending' }
}

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS)

/** Compatible with hashes written by Python bcrypt (`$2b$`). */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash || '')
  } catch {
    return false
  }
}

export async function createAccessToken(user: Pick<UserDoc, 'id' | 'email' | 'role'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ email: user.email, role: user.role ?? 'pending' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_EXPIRE_DAYS * 24 * 60 * 60)
    .sign(JWT_SECRET())
}

export async function decodeToken(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET(), { algorithms: ['HS256'] })
    return payload
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) throw httpError(401, 'Authentication token expired')
    throw httpError(401, 'Invalid authentication token')
  }
}

export async function findUserById(userId: string | undefined): Promise<PublicUser | null> {
  if (!userId) return null
  const coll = await getCollection<UserDoc>(COLLECTIONS.users)
  if (!coll) return null
  return (await coll.findOne({ id: userId }, { projection: { _id: 0, password_hash: 0 } })) as PublicUser | null
}

export async function registerUser(emailRaw: string, password: string, nameRaw: string): Promise<PublicUser> {
  const email = emailRaw.trim().toLowerCase()
  const name = nameRaw.trim()
  if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters')
  if (!email || !email.includes('@')) throw httpError(400, 'A valid email is required')
  if (!name) throw httpError(400, 'Name is required')

  const coll = await usersCollection()
  if (await coll.findOne({ email })) throw httpError(409, 'Email is already registered')

  const now = nowIso()
  const user: UserDoc = {
    id: randomUUID(),
    email,
    name,
    password_hash: await hashPassword(password),
    role: 'pending',
    created_at: now,
    updated_at: now,
  }
  await coll.insertOne({ ...user })
  return publicUser(user)
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
  const coll = await usersCollection()
  const user = await coll.findOne({ email: email.trim().toLowerCase() })
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw httpError(401, 'Invalid email or password')
  }
  return { token: await createAccessToken(user), user: publicUser(user) }
}
