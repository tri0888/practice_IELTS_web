import { COLLECTIONS, getCollection } from '../../shared/database'
import { httpError } from '../../shared/http'
import vocabularyJson from '../../data/vocabulary.json'

export type Word = { vocab: string; pronunciation: string; POS: string; definition: string; [k: string]: unknown }
export type Progress = {
  user_id: string
  vocab: string
  status?: string
  correct_count?: number
  wrong_count?: number
  updated_at?: string
}

export async function findAllWords(): Promise<Word[]> {
  const coll = await getCollection<Word>(COLLECTIONS.vocabulary)
  return coll ? coll.find({}, { projection: { _id: 0 } }).toArray() : []
}

export const readBundledWords = () => vocabularyJson as Partial<Word>[]

const progressCollection = () => getCollection<Progress>(COLLECTIONS.vocabularyProgress)

async function requireProgressCollection() {
  const coll = await progressCollection()
  if (!coll) throw httpError(503, 'Database not available')
  return coll
}

export async function findUserProgress(userId: string): Promise<Progress[] | null> {
  const coll = await progressCollection()
  return coll ? coll.find({ user_id: userId }).toArray() : null
}

export async function findProgress(userId: string, vocab: string) {
  return (await requireProgressCollection()).findOne({ user_id: userId, vocab }, { projection: { _id: 0 } })
}

export async function upsertProgress(
  userId: string,
  vocab: string,
  set: Partial<Progress>,
  inc: Partial<Record<'correct_count' | 'wrong_count', number>>,
) {
  await (await requireProgressCollection()).updateOne(
    { user_id: userId, vocab },
    Object.keys(inc).length ? { $set: set, $inc: inc } : { $set: set },
    { upsert: true },
  )
}

export async function setStatusForWords(userId: string, vocabs: string[], status: string, updatedAt: string): Promise<number> {
  const res = await (await requireProgressCollection()).updateMany(
    { user_id: userId, vocab: { $in: vocabs } },
    { $set: { status, updated_at: updatedAt } },
  )
  return res.modifiedCount
}
