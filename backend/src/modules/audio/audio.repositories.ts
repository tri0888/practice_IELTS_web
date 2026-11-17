import { COLLECTIONS, getCollection } from '../../shared/database'

export type Exam = 'ielts' | 'toeic'
type AudioAssetDoc = { book?: number; test_number?: number; file_name?: string; relative_path?: string }

const audioCollection = (exam: Exam) =>
  getCollection<AudioAssetDoc>(exam === 'toeic' ? COLLECTIONS.toeicAudio : COLLECTIONS.ieltsAudio)

export async function findAudioByPath(exam: Exam, path: string) {
  const coll = await audioCollection(exam)
  return coll ? coll.findOne({ $or: [{ relative_path: `Books/${path}` }, { relative_path: path }] }) : null
}

export async function findAudioByFileName(exam: Exam, fileName: string) {
  const coll = await audioCollection(exam)
  return coll ? coll.findOne({ file_name: fileName }) : null
}
