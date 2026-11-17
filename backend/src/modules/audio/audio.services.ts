import { httpError } from '../../shared/http'
import { fileResponse, isR2Enabled } from '../../shared/storage'
import * as repo from './audio.repositories'

const examOf = (name: string): repo.Exam => (/ets|toeic/i.test(name) ? 'toeic' : 'ielts')

export async function resolveAudioKey(fileName: string): Promise<string> {
  let relativePath: string | null

  if (fileName.includes('/') || fileName.includes('\\')) {
    const clean = fileName.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const doc = await repo.findAudioByPath(examOf(clean), clean)
    relativePath = doc?.relative_path || clean
  } else {
    const doc = await repo.findAudioByFileName(examOf(fileName), fileName)
    relativePath = doc?.relative_path || (isR2Enabled() ? fileName : null)
  }

  if (!relativePath) throw httpError(404, `Audio file ${fileName} not found`)
  return relativePath.startsWith('Books/') ? relativePath.slice('Books/'.length) : relativePath
}

export async function getAudioFile(fileName: string) {
  const key = await resolveAudioKey(fileName)
  const filenameOnly = fileName.split(/[\\/]/).pop() || fileName
  return fileResponse(key, 'audio/mpeg', filenameOnly, `Audio file ${fileName} not found`)
}
