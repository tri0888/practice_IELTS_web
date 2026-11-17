import { intParam, queryString, type ApiRequest } from '../../shared/http'
import * as testsService from './tests.services'

const year = (req: ApiRequest) => req.params.year ?? '2026'

export const listTests = () => testsService.listTests()

export const getPageCount = (req: ApiRequest) =>
  testsService.getPdfPageCount(intParam(req, 'book'), queryString(req, 'pdf_type') || 'academic')

export const getBookPdf = (req: ApiRequest) =>
  testsService.getBookPdf(intParam(req, 'book'), queryString(req, 'pdf_type') || 'academic')

export const getTest = (req: ApiRequest) => testsService.getTest(intParam(req, 'book'), intParam(req, 'test'))

export const getTestAudio = (req: ApiRequest) => testsService.getTestAudio(intParam(req, 'book'), intParam(req, 'test'))

export const getSkill = (req: ApiRequest) =>
  testsService.getSkill(intParam(req, 'book'), intParam(req, 'test'), req.params.skill)

export const listToeicTests = () => testsService.listToeicTests()

export const getEtsPdf = (req: ApiRequest) =>
  testsService.getEtsPdf(req.params.pdf_type, intParam(req, 'test_number'), year(req))

export const getEtsAudioList = (req: ApiRequest) =>
  testsService.getEtsAudioList(intParam(req, 'test_number'), year(req))

export const getEtsAudioFile = (req: ApiRequest) =>
  testsService.getEtsAudioFile(intParam(req, 'test_number'), req.params.file_name, year(req))

export const getEtsAnswers = (req: ApiRequest) =>
  testsService.getEtsAnswers(req.params.pdf_type, intParam(req, 'test_number'), year(req))
