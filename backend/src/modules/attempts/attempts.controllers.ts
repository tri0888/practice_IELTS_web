import { jsonBody, type ApiRequest } from '../../shared/http'
import * as attemptsService from './attempts.services'

export const start = (req: ApiRequest) => attemptsService.startAttempt(req.user!.id, jsonBody(req))

export const submit = (req: ApiRequest) => attemptsService.submitAttempt(req.user!.id, req.params.attempt_id, jsonBody(req))

export const result = (req: ApiRequest) => attemptsService.getResult(req.user!.id, req.params.attempt_id)

export const list = (req: ApiRequest) => attemptsService.listAttempts(req.user!.id)

export const remove = (req: ApiRequest) => attemptsService.deleteAttempt(req.user!.id, req.params.attempt_id)
