import * as vocabulary from '../modules/vocabulary/vocabulary.controllers'
import type { Route } from '../shared/http'

export const vocabularyRoutes: Route[] = [
  { method: 'GET', path: '/vocabulary', guard: 'approved', handler: vocabulary.list },
  { method: 'GET', path: '/vocabulary/stats', guard: 'approved', handler: vocabulary.stats },
  { method: 'GET', path: '/vocabulary/practice', guard: 'approved', handler: vocabulary.practice },
  { method: 'POST', path: '/vocabulary/progress', guard: 'approved', handler: vocabulary.updateProgress },
  { method: 'POST', path: '/vocabulary/progress/bulk', guard: 'approved', handler: vocabulary.bulkUpdateProgress },
]
