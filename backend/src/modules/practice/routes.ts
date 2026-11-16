import { Hono } from 'hono'
import { httpError, intParam, intQuery } from '../../http'
import type { AuthEnv } from '../auth/middleware'
import * as s from './services'

/** Mounted at /api/tests before the tests router (FastAPI router order). */
export const practiceRoutes = new Hono<AuthEnv>()
  .get('/:book/:test/practice', async c => {
    const book = intParam(c, 'book')
    const test = intParam(c, 'test')
    const layout = await s.getPracticeLayout(book, test)
    if (!layout) throw httpError(404, `Practice layout not mapped for Book ${book} Test ${test}`)
    return c.json(layout)
  })
  .get('/:book/:test/answers', async c => {
    const book = intParam(c, 'book')
    const test = intParam(c, 'test')
    const answers = await s.getTestAnswers(book, test, c.req.query('skill') || undefined)
    if (!Object.keys(answers).length) throw httpError(404, 'Answers not found')
    return c.json({ book, test, answers })
  })
  .get('/:book/pdf-parts/:pdf_type/:test/:part_key', async c =>
    s.getPdfPartResponse(intParam(c, 'book'), c.req.param('pdf_type'), intParam(c, 'test'), c.req.param('part_key')))
  .get('/:book/pdf-pages/:pdf_type/:page_number', async c =>
    s.getPdfPageResponse(intParam(c, 'book'), intParam(c, 'page_number'), c.req.param('pdf_type'), intQuery(c, 'test', 1)))
