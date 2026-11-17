import * as attempts from '../modules/attempts/attempts.controllers'
import type { Route } from '../shared/http'

export const attemptsRoutes: Route[] = [
  { method: 'POST', path: '/histories', guard: 'approved', handler: attempts.start },
  { method: 'PUT', path: '/histories/:attempt_id/submit', guard: 'approved', handler: attempts.submit },
  { method: 'GET', path: '/histories/:attempt_id/result', guard: 'approved', handler: attempts.result },
  { method: 'GET', path: '/histories', guard: 'approved', handler: attempts.list },
  { method: 'DELETE', path: '/histories/:attempt_id', guard: 'approved', handler: attempts.remove },
]
