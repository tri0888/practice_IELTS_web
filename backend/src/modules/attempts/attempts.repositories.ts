import type { Collection } from 'mongodb'
import { COLLECTIONS, getCollection } from '../../shared/database'
import { httpError, nowIso } from '../../shared/http'

export type AttemptResponse = { question_number: unknown; answer?: unknown }
export type AttemptResult = { total: number; correct: number } | { note: string }

export type AttemptDoc = {
  id: string
  user_id: string
  book: number
  test: number
  skill: string
  started_at: string
  submitted_at: string | null
  responses: AttemptResponse[]
  result: AttemptResult | null
  draft_expires_at?: Date
}

const g = globalThis as typeof globalThis & { __practiceHubHistoryIndexes?: Promise<unknown> }

async function histories(): Promise<Collection<AttemptDoc>> {
  const coll = await getCollection<AttemptDoc>(COLLECTIONS.histories)
  if (!coll) throw httpError(503, 'Database is not available')
  g.__practiceHubHistoryIndexes ??= Promise.all([
    coll.createIndex({ draft_expires_at: 1 }, { expireAfterSeconds: 0 }),
    coll.createIndex({ user_id: 1, started_at: -1 }),
    coll.createIndex({ id: 1 }),
  ]).catch(err => {
    g.__practiceHubHistoryIndexes = undefined
    console.error('Failed to create histories indexes', err)
  })
  return coll
}

export async function insertAttempt(attempt: AttemptDoc) {
  await (await histories()).insertOne({ ...attempt })
}

export async function findAttempt(userId: string, attemptId: string) {
  return (await histories()).findOne({ id: attemptId, user_id: userId }, { projection: { _id: 0 } })
}

export async function saveSubmission(userId: string, attemptId: string, responses: AttemptResponse[], result: AttemptResult) {
  await (await histories()).updateOne(
    { id: attemptId, user_id: userId },
    { $set: { responses, result, submitted_at: nowIso() }, $unset: { draft_expires_at: '' } },
  )
}

export async function findSubmittedAttempts(userId: string) {
  return (await histories())
    .find({ user_id: userId, result: { $ne: null } }, { projection: { _id: 0, draft_expires_at: 0 } })
    .sort({ started_at: -1 })
    .toArray()
}

export async function deleteAttempt(userId: string, attemptId: string): Promise<number> {
  const res = await (await histories()).deleteOne({ id: attemptId, user_id: userId })
  return res.deletedCount
}
