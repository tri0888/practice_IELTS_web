import { COLLECTIONS, getCollection } from '../../shared/database'
import { httpError } from '../../shared/http'

export type UserDoc = {
  id: string
  email: string
  name: string
  password_hash: string
  created_at?: string
  updated_at?: string
}

async function users() {
  const coll = await getCollection<UserDoc>(COLLECTIONS.users)
  if (!coll) throw httpError(503, 'Database is not available')
  return coll
}

export async function findUserById(id: string) {
  const coll = await getCollection<UserDoc>(COLLECTIONS.users)
  if (!coll) return null
  return coll.findOne({ id }, { projection: { _id: 0, password_hash: 0 } })
}

export async function findUserByEmail(email: string) {
  return (await users()).findOne({ email })
}

export async function insertUser(user: UserDoc) {
  await (await users()).insertOne({ ...user })
}
