import * as auth from '../modules/auth/auth.controllers'
import type { Route } from '../shared/http'

export const authRoutes: Route[] = [
  { method: 'POST', path: '/auth/register', handler: auth.register },
  { method: 'POST', path: '/auth/login', handler: auth.login },
  { method: 'GET', path: '/auth/me', guard: 'auth', handler: auth.me },
]
