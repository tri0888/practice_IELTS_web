import { httpError, intParam, intQuery, queryString, type ApiRequest } from '../../shared/http'
import * as practiceService from './practice.services'

export async function getLayout(req: ApiRequest) {
  const book = intParam(req, 'book')
  const test = intParam(req, 'test')
  const layout = await practiceService.getPracticeLayout(book, test)
  if (!layout) throw httpError(404, `Practice layout not mapped for Book ${book} Test ${test}`)
  return layout
}

export async function getAnswers(req: ApiRequest) {
  const book = intParam(req, 'book')
  const test = intParam(req, 'test')
  const answers = await practiceService.getTestAnswers(book, test, queryString(req, 'skill'))
  if (!Object.keys(answers).length) throw httpError(404, 'Answers not found')
  return { book, test, answers }
}

export const getPdfPart = (req: ApiRequest) =>
  practiceService.getPdfPart(intParam(req, 'book'), req.params.pdf_type, intParam(req, 'test'), req.params.part_key)

export const getPdfPage = (req: ApiRequest) =>
  practiceService.getPdfPage(intParam(req, 'book'), intParam(req, 'page_number'), req.params.pdf_type, intQuery(req, 'test', 1))
