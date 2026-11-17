import { jsonBody, requireString, type ApiRequest } from '../../shared/http'
import * as authService from './auth.services'

export async function register(req: ApiRequest) {
  const body = jsonBody(req)
  const user = await authService.register(requireString(body, 'email'), requireString(body, 'password'), requireString(body, 'name'))
  return { user }
}

export async function login(req: ApiRequest) {
  const body = jsonBody(req)
  return authService.login(requireString(body, 'email'), requireString(body, 'password'))
}

export function me(req: ApiRequest) {
  return { user: req.user }
}
