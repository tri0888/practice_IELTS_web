import { intQuery, jsonBody, queryString, requireString, validationError, type ApiRequest } from '../../shared/http'
import * as vocabularyService from './vocabulary.services'

const optionalString = (v: unknown, field: string) => {
  if (v === undefined || v === null) return v as undefined | null
  if (typeof v !== 'string') throw validationError(field, 'must be a string')
  return v
}

export const list = (req: ApiRequest) =>
  vocabularyService.getVocabularyList(req.user!.id, {
    search: queryString(req, 'search'),
    pos: queryString(req, 'pos'),
    status: queryString(req, 'status'),
    page: intQuery(req, 'page', 1, { min: 1 }),
    limit: intQuery(req, 'limit', 50, { min: 1, max: 100 }),
  })

export const stats = (req: ApiRequest) => vocabularyService.getStats(req.user!.id)

export const practice = (req: ApiRequest) =>
  vocabularyService.getPracticeWords(
    req.user!.id,
    queryString(req, 'mode') || 'random',
    queryString(req, 'pos'),
    intQuery(req, 'limit', 15, { min: 5, max: 50 }),
  )

export function updateProgress(req: ApiRequest) {
  const body = jsonBody(req)
  const isCorrect = body.is_correct
  if (isCorrect !== undefined && isCorrect !== null && typeof isCorrect !== 'boolean') {
    throw validationError('is_correct', 'must be a boolean')
  }
  return vocabularyService.updateProgress(
    req.user!.id,
    requireString(body, 'vocab'),
    optionalString(body.status, 'status'),
    isCorrect as boolean | null | undefined,
  )
}

export function bulkUpdateProgress(req: ApiRequest) {
  const body = jsonBody(req)
  if (!Array.isArray(body.vocabs) || body.vocabs.some(v => typeof v !== 'string')) {
    throw validationError('vocabs', 'must be a list of strings')
  }
  return vocabularyService.bulkUpdateProgress(req.user!.id, body.vocabs as string[], requireString(body, 'status'))
}
