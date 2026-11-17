import * as telegram from '../modules/telegram/telegram.controllers'
import type { Route } from '../shared/http'

export const telegramRoutes: Route[] = [
  { method: 'POST', path: '/telegram/webhook', handler: telegram.webhook },
]
