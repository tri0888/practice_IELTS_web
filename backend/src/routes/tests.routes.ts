import * as tests from '../modules/tests/tests.controllers'
import type { Route } from '../shared/http'

export const testsRoutes: Route[] = [
  { method: 'GET', path: '/tests', guard: 'auth', handler: tests.listTests },
  { method: 'GET', path: '/tests/toeic', guard: 'auth', handler: tests.listToeicTests },

  { method: 'GET', path: '/tests/toeic/:year/pdf/:pdf_type/:test_number', guard: 'auth', handler: tests.getEtsPdf },
  { method: 'GET', path: '/tests/toeic/:year/audio/:test_number', guard: 'auth', handler: tests.getEtsAudioList },
  { method: 'GET', path: '/tests/toeic/:year/audio-file/:test_number/:file_name', guard: 'auth', handler: tests.getEtsAudioFile },
  { method: 'GET', path: '/tests/toeic/:year/answers/:pdf_type/:test_number', guard: 'auth', handler: tests.getEtsAnswers },
  { method: 'GET', path: '/tests/toeic/pdf/:pdf_type/:test_number', guard: 'auth', handler: tests.getEtsPdf },
  { method: 'GET', path: '/tests/toeic/audio/:test_number', guard: 'auth', handler: tests.getEtsAudioList },
  { method: 'GET', path: '/tests/toeic/audio-file/:test_number/:file_name', guard: 'auth', handler: tests.getEtsAudioFile },
  { method: 'GET', path: '/tests/toeic/answers/:pdf_type/:test_number', guard: 'auth', handler: tests.getEtsAnswers },

  { method: 'GET', path: '/tests/:book/page-count', guard: 'auth', handler: tests.getPageCount },
  { method: 'GET', path: '/tests/:book/pdf', guard: 'auth', handler: tests.getBookPdf },
  { method: 'GET', path: '/tests/:book/:test', guard: 'auth', handler: tests.getTest },
  { method: 'GET', path: '/tests/:book/:test/audio', guard: 'auth', handler: tests.getTestAudio },
  { method: 'GET', path: '/tests/:book/:test/:skill', guard: 'auth', handler: tests.getSkill },
]
