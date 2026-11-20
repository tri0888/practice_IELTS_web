import * as practice from '../modules/practice/practice.controllers'
import type { Route } from '../shared/http'

export const practiceRoutes: Route[] = [
  { method: 'GET', path: '/tests/:book/:test/practice', guard: 'auth', handler: practice.getLayout },
  { method: 'GET', path: '/tests/:book/:test/answers', guard: 'auth', handler: practice.getAnswers },
  { method: 'GET', path: '/tests/:book/pdf-parts/:pdf_type/:test/:part_key', guard: 'auth', handler: practice.getPdfPart },
  { method: 'GET', path: '/tests/:book/pdf-pages/:pdf_type/:page_number', guard: 'auth', handler: practice.getPdfPage },
]
