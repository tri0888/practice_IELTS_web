import type { Route } from '../shared/http'
import { r2Status } from '../shared/storage'

export const healthRoutes: Route[] = [
  { method: 'GET', path: '/r2/status', handler: () => r2Status() },
  { method: 'GET', path: '/', handler: () => ({ service: 'IELTS Backend', status: 'ok', tests_endpoint: '/api/tests' }) },
]
