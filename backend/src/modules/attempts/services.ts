import { randomUUID } from 'node:crypto'
import type { Collection } from 'mongodb'
import { COLLECTIONS, getCollection } from '../../db'
import { httpError, nowIso, toInt } from '../../http'
import { getTestAnswers } from '../practice/services'
import { getEtsAnswers } from '../tests/services'
import { checkUserAnswer, getCorrectAnswerForQuestion } from './grading'

export type AttemptResponse = { question_number: unknown; answer?: unknown }
type Result = { total: number; correct: number } | { note: string }

export type AttemptDoc = {
  id: string
  user_id: string
  book: number
  test: number
  skill: string
  started_at: string
  submitted_at: string | null
  responses: AttemptResponse[]
  result: Result | null
  /** Drafts expire automatically (TTL index); cleared on submit. */
  draft_expires_at?: Date
}

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const g = globalThis as typeof globalThis & { __practiceHubHistoryIndexes?: Promise<unknown> }

/**
 * Drafts live in MongoDB (not process memory) so start/submit may run on
 * different serverless instances. Every query is scoped to the signed-in user.
 */
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

const skillKind = (skill: string) => {
  const s = (skill || '').toLowerCase()
  if (s.startsWith('passage') || s === 'reading') return { kind: 'ielts' as const, key: 'reading' }
  if (s === 'listening') return { kind: 'ielts' as const, key: 'listening' }
  if (s === 'toeic_lc' || s === 'toeic_rc') return { kind: 'toeic' as const, key: s === 'toeic_lc' ? 'lc' : 'rc' }
  return { kind: 'other' as const, key: '' }
}

export async function startAttempt(userId: string, body: Record<string, unknown>) {
  const test = toInt(body.test)
  const skill = body.skill
  if (test === null || typeof skill !== 'string') throw httpError(422, 'Fields "test" (int) and "skill" (string) are required')
  const book = body.book === undefined ? 11 : toInt(body.book)
  if (book === null) throw httpError(422, 'Field "book" must be an integer')

  const attempt: AttemptDoc = {
    id: randomUUID(),
    user_id: userId,
    book,
    test,
    skill,
    started_at: nowIso(),
    submitted_at: null,
    responses: [],
    result: null,
    draft_expires_at: new Date(Date.now() + DRAFT_TTL_MS),
  }
  await (await histories()).insertOne({ ...attempt })
  return { id: attempt.id }
}

async function gradeAttempt(attempt: Pick<AttemptDoc, 'book' | 'test' | 'skill'>, responses: AttemptResponse[]): Promise<Result> {
  const { kind, key } = skillKind(attempt.skill)
  if (kind === 'other') return { note: 'auto-grading not implemented for this skill' }

  let total = 0
  let right = 0
  if (kind === 'ielts') {
    const correct = await getTestAnswers(attempt.book ?? 11, attempt.test, key)
    for (const r of responses) {
      const q = toInt(r?.question_number)
      if (q === null) continue
      total++
      if (checkUserAnswer(String(r.answer ?? '').trim(), getCorrectAnswerForQuestion(q, correct))) right++
    }
  } else {
    const { answers } = await getEtsAnswers(key, attempt.test ?? 1, String(attempt.book ?? '2026'))
    for (const r of responses) {
      const q = toInt(r?.question_number)
      if (q === null) continue
      total++
      const ans = String(r.answer ?? '').trim().toUpperCase()
      const correct = (answers[String(q)] ?? '').trim().toUpperCase()
      if (ans && correct && ans === correct) right++
    }
  }
  return { total, correct: right }
}

export async function submitAttempt(userId: string, attemptId: string, body: Record<string, unknown>) {
  if (!Array.isArray(body.responses)) throw httpError(422, 'Field "responses" (list) is required')
  const responses = body.responses as AttemptResponse[]
  const coll = await histories()
  const attempt = await coll.findOne({ id: attemptId, user_id: userId })
  if (!attempt) throw httpError(404, 'attempt not found')

  const result = await gradeAttempt(attempt, responses)
  await coll.updateOne(
    { id: attemptId, user_id: userId },
    { $set: { responses, result, submitted_at: nowIso() }, $unset: { draft_expires_at: '' } },
  )
  return { id: attemptId, result }
}

export async function getResult(userId: string, attemptId: string) {
  const attempt = await (await histories()).findOne({ id: attemptId, user_id: userId }, { projection: { _id: 0 } })
  if (!attempt) throw httpError(404, 'attempt not found')

  const { kind, key } = skillKind(attempt.skill)
  const correctAnswers: Record<string, string> = {}
  if (kind === 'ielts') {
    const correct = await getTestAnswers(attempt.book ?? 11, attempt.test, key)
    for (let q = 1; q <= 40; q++) correctAnswers[String(q)] = getCorrectAnswerForQuestion(q, correct)
  } else if (kind === 'toeic') {
    Object.assign(correctAnswers, (await getEtsAnswers(key, attempt.test ?? 1, String(attempt.book ?? '2026'))).answers)
  }

  return {
    id: attemptId,
    book: attempt.book,
    test: attempt.test,
    skill: attempt.skill,
    started_at: attempt.started_at,
    submitted_at: attempt.submitted_at,
    responses: attempt.responses ?? [],
    result: attempt.result,
    correct_answers: correctAnswers,
  }
}

/** The signed-in user's submitted attempts, newest first. */
export async function listAttempts(userId: string) {
  return (await histories())
    .find({ user_id: userId, result: { $ne: null } }, { projection: { _id: 0, draft_expires_at: 0 } })
    .sort({ started_at: -1 })
    .toArray()
}

export async function deleteAttempt(userId: string, attemptId: string) {
  const res = await (await histories()).deleteOne({ id: attemptId, user_id: userId })
  if (!res.deletedCount) throw httpError(404, 'attempt not found')
  return { status: 'ok', deleted: attemptId }
}
