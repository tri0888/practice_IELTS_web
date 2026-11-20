import * as vocabulary from '../modules/vocabulary/vocabulary.controllers'
import type { Route } from '../shared/http'

export const vocabularyRoutes: Route[] = [
  { method: 'GET', path: '/vocabulary', guard: 'auth', handler: vocabulary.list },
  { method: 'GET', path: '/vocabulary/stats', guard: 'auth', handler: vocabulary.stats },
  { method: 'GET', path: '/vocabulary/practice', guard: 'auth', handler: vocabulary.practice },
  { method: 'POST', path: '/vocabulary/progress', guard: 'auth', handler: vocabulary.updateProgress },
  { method: 'POST', path: '/vocabulary/progress/bulk', guard: 'auth', handler: vocabulary.bulkUpdateProgress },
]
