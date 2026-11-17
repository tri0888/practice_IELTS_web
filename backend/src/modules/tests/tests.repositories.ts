import { COLLECTIONS, getCollection } from '../../shared/database'

export type Exam = 'ielts' | 'toeic'
export type LayoutDoc = { book: number; test: number; layout?: Record<string, unknown> }
type AudioAssetDoc = { book: number; test_number: number; file_name?: string; relative_path?: string; [k: string]: unknown }

export async function findAllLayouts(exam: Exam): Promise<LayoutDoc[]> {
  const coll = await getCollection<LayoutDoc>(exam === 'toeic' ? COLLECTIONS.toeicLayouts : COLLECTIONS.ieltsLayouts)
  if (!coll) return []
  return coll.find({}, { projection: { book: 1, test: 1, layout: 1, _id: 0 } }).toArray()
}

export async function findIeltsLayout(book: number, test: number) {
  const coll = await getCollection<LayoutDoc>(COLLECTIONS.ieltsLayouts)
  return coll ? coll.findOne({ book, test }, { projection: { _id: 0 } }) : null
}

export async function findIeltsAudio(book: number, test: number): Promise<AudioAssetDoc[]> {
  const coll = await getCollection<AudioAssetDoc>(COLLECTIONS.ieltsAudio)
  if (!coll) return []
  return coll.find({ book, test_number: test }, { projection: { _id: 0 } }).toArray()
}

export async function findToeicAudioFileNames(year: number, test: number): Promise<string[]> {
  const coll = await getCollection<AudioAssetDoc>(COLLECTIONS.toeicAudio)
  if (!coll) return []
  const docs = await coll.find({ book: year, test_number: test }, { projection: { file_name: 1, _id: 0 } }).toArray()
  return docs.map(d => d.file_name as string)
}

export async function findToeicAudioFile(year: number, test: number, fileName: string) {
  const coll = await getCollection<AudioAssetDoc>(COLLECTIONS.toeicAudio)
  return coll ? coll.findOne({ book: year, test_number: test, file_name: fileName }) : null
}

export async function findToeicAnswers(year: number, test: number) {
  const coll = await getCollection(COLLECTIONS.toeicAnswers)
  return coll ? coll.findOne({ book: year, test }) : null
}
