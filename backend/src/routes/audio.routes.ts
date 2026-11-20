import * as audio from '../modules/audio/audio.controllers'
import type { Route } from '../shared/http'

export const audioRoutes: Route[] = [
  { method: 'GET', path: '/audio/:file_name*', guard: 'auth', handler: audio.getFile },
]
