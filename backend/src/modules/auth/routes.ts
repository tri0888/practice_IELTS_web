import { Hono } from 'hono'
import { jsonBody, requireString } from '../../http'
import { requireAuth, type AuthEnv } from './middleware'
import { loginUser, registerUser } from './services'

export const authRoutes = new Hono<AuthEnv>()
  .post('/register', async c => {
    const body = await jsonBody(c)
    const user = await registerUser(requireString(body, 'email'), requireString(body, 'password'), requireString(body, 'name'))
    return c.json({ user })
  })
  .post('/login', async c => {
    const body = await jsonBody(c)
    return c.json(await loginUser(requireString(body, 'email'), requireString(body, 'password')))
  })
  .get('/me', requireAuth, c => c.json({ user: c.get('user') }))
