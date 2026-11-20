import * as attempts from '../modules/attempts/attempts.controllers'
import type { Route } from '../shared/http'

export const attemptsRoutes: Route[] = [
  { method: 'POST', path: '/histories', guard: 'auth', handler: attempts.start },
  { method: 'PUT', path: '/histories/:attempt_id/submit', guard: 'auth', handler: attempts.submit },
  { method: 'GET', path: '/histories/:attempt_id/result', guard: 'auth', handler: attempts.result },
  { method: 'GET', path: '/histories', guard: 'auth', handler: attempts.list },
  { method: 'DELETE', path: '/histories/:attempt_id', guard: 'auth', handler: attempts.remove },
]
