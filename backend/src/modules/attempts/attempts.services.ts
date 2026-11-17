import { randomUUID } from 'node:crypto'
import { httpError, nowIso, toInt } from '../../shared/http'
import { getTestAnswers } from '../practice/practice.services'
import { getEtsAnswers } from '../tests/tests.services'
import * as repo from './attempts.repositories'
import type { AttemptDoc, AttemptResponse, AttemptResult } from './attempts.repositories'

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

export const cleanSpaces = (s: string) => s.replace(/\s+/g, ' ').trim()

export const cleanPunctuation = (s: string) => s.replace(/^[.,;:!?"' ]+|[.,;:!?"' ]+$/g, '')

export function expandParentheses(s: string): string[] {
  const match = /\(([^)]*)\)/.exec(s)
  if (!match) return [cleanSpaces(s)]
  const prefix = s.slice(0, match.index)
  const suffix = s.slice(match.index + match[0].length)
  return [...new Set([...expandParentheses(prefix + suffix), ...expandParentheses(prefix + match[1] + suffix)])]
}

export function expandSlashes(s: string): string[] {
  const tokens = s.split(/\s+/).filter(Boolean)
  if (!tokens.length) return ['']
  const variations = tokens.map(token => {
    if (!token.includes('/')) return [token]
    const parts = token.split('/').filter(Boolean)
    return parts.length ? parts : [token]
  })
  return variations
    .reduce<string[][]>((combos, options) => combos.flatMap(combo => options.map(o => [...combo, o])), [[]])
    .map(combo => combo.join(' '))
}

export function getCorrectAnswersList(correct: string): string[] {
  if (!correct) return []
  const all: string[] = []
  for (const option of correct.split(/\s+\/\s+/)) {
    for (const p of expandParentheses(option)) {
      for (const v of expandSlashes(p)) all.push(cleanPunctuation(v.toLowerCase()))
    }
  }
  all.push(cleanPunctuation(correct.toLowerCase()))
  return [...new Set(all)]
}

export function checkUserAnswer(userAns: string, correct: string): boolean {
  const cleanedUser = cleanPunctuation(cleanSpaces(userAns).toLowerCase())
  if (!cleanedUser) return false
  if (getCorrectAnswersList(correct).includes(cleanedUser)) return true
  const parts = correct.split(/\s*[-–—]\s*/)
  return parts.length > 1 && cleanedUser === cleanPunctuation(cleanSpaces(parts[0]).toLowerCase())
}

const answerOf = (val: unknown) =>
  val && typeof val === 'object' ? String((val as { answer?: unknown }).answer ?? '') : String(val)

export function getCorrectAnswerForQuestion(q: number, correct: Record<string, unknown>): string {
  if (String(q) in correct) return answerOf(correct[String(q)])
  for (const [key, val] of Object.entries(correct)) {
    const parts = key.replace(/[–—]/g, '-').split('-')
    if (parts.length === 2) {
      const from = toInt(parts[0])
      const to = toInt(parts[1])
      if (from !== null && to !== null && from <= q && q <= to) return answerOf(val)
    }
  }
  return ''
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
  await repo.insertAttempt(attempt)
  return { id: attempt.id }
}

async function gradeAttempt(attempt: Pick<AttemptDoc, 'book' | 'test' | 'skill'>, responses: AttemptResponse[]): Promise<AttemptResult> {
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
  const attempt = await repo.findAttempt(userId, attemptId)
  if (!attempt) throw httpError(404, 'attempt not found')

  const result = await gradeAttempt(attempt, responses)
  await repo.saveSubmission(userId, attemptId, responses, result)
  return { id: attemptId, result }
}

export async function getResult(userId: string, attemptId: string) {
  const attempt = await repo.findAttempt(userId, attemptId)
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

export const listAttempts = (userId: string) => repo.findSubmittedAttempts(userId)

export async function deleteAttempt(userId: string, attemptId: string) {
  if (!(await repo.deleteAttempt(userId, attemptId))) throw httpError(404, 'attempt not found')
  return { status: 'ok', deleted: attemptId }
}
