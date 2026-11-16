import { PDFDocument } from 'pdf-lib'
import { COLLECTIONS, getCollection } from '../../db'
import { httpError } from '../../http'
import { getFileBytesCached } from '../../r2'

const IELTS_SKILLS = ['listening', 'reading', 'writing', 'speaking'] as const
const TOEIC_SKILLS = ['listening', 'reading'] as const

type LayoutDoc = { book: number; test: number; layout?: Record<string, unknown> }

/** R2 key of a Cambridge book PDF (academic or solution). */
export function findBookPdfPath(book: number, pdfType = 'academic'): string {
  const suffix = pdfType === 'solution' ? ' Solution' : ''
  return `Cambridge IELTS 11-20/Cam ${book}/Cambridge ${book}${suffix}.pdf`
}

/** R2 key of an ETS TOEIC test PDF (lc/rc). */
export function getEtsPdfPath(pdfType: string, testNumber: number, year = '2026'): string {
  return `ETS 24-26/ETS ${year}/ETS-${year}-${pdfType.toUpperCase()}/TEST_${String(testNumber).padStart(2, '0')}.pdf`
}

async function listFromLayouts(collection: typeof COLLECTIONS.ieltsLayouts | typeof COLLECTIONS.toeicLayouts, skills: readonly string[]) {
  const coll = await getCollection<LayoutDoc>(collection)
  if (!coll) return []
  const docs = await coll.find({}, { projection: { book: 1, test: 1, layout: 1, _id: 0 } }).toArray()
  return docs.map(doc => ({
    book: doc.book,
    test_number: doc.test,
    sections: skills.filter(s => s in (doc.layout ?? {})).map(name => ({ name })),
  }))
}

export const listTests = () => listFromLayouts(COLLECTIONS.ieltsLayouts, IELTS_SKILLS)
export const listToeicTests = () => listFromLayouts(COLLECTIONS.toeicLayouts, TOEIC_SKILLS)

export async function getPdfPageCount(book: number, pdfType = 'academic') {
  try {
    const bytes = await getFileBytesCached(findBookPdfPath(book, pdfType))
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
    return { book, pdf_type: pdfType, page_count: doc.getPageCount() }
  } catch (err) {
    if ((err as { status?: number }).status && (err as { status: number }).status !== 404) throw err
    throw httpError(404, `Cambridge IELTS ${book} PDF not found`)
  }
}

export async function getTest(book: number, test: number) {
  const coll = await getCollection<LayoutDoc>(COLLECTIONS.ieltsLayouts)
  const doc = coll ? await coll.findOne({ book, test }, { projection: { _id: 0 } }) : null
  if (!doc) throw httpError(404, 'test not found')
  return {
    book,
    test_number: test,
    sections: IELTS_SKILLS.filter(s => s in (doc.layout ?? {})).map(name => ({ name })),
  }
}

export async function getTestAudio(book: number, test: number) {
  const coll = await getCollection(COLLECTIONS.ieltsAudio)
  if (!coll) return []
  const results = await coll.find({ book, test_number: test }, { projection: { _id: 0 } }).toArray()
  for (const doc of results) {
    const rel = (doc.relative_path as string) || ''
    if (rel.startsWith('Books/')) doc.file_name = rel.slice('Books/'.length)
    else if (rel) doc.file_name = rel
  }
  return results
}

export async function getSkill(book: number, test: number, skill: string) {
  const t = await getTest(book, test)
  const found = t.sections.find(s => s.name.toLowerCase().startsWith(skill.toLowerCase().slice(0, 7)))
  if (!found) throw httpError(404, 'skill not found')
  return found
}

const naturalKey = (s: string) => s.split(/(\d+)/).map(part => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()))

function naturalCompare(a: string, b: string): number {
  const ka = naturalKey(a)
  const kb = naturalKey(b)
  for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
    if (ka[i] === kb[i]) continue
    if (typeof ka[i] === typeof kb[i]) return ka[i] < kb[i] ? -1 : 1
    return typeof ka[i] === 'number' ? -1 : 1
  }
  return ka.length - kb.length
}

export async function getEtsAudioList(testNumber: number, year = '2026'): Promise<string[]> {
  const coll = await getCollection(COLLECTIONS.toeicAudio)
  if (!coll) return []
  const docs = await coll.find({ book: Number(year), test_number: testNumber }, { projection: { file_name: 1, _id: 0 } }).toArray()
  return docs.map(d => d.file_name as string).sort(naturalCompare)
}

export async function getEtsAudioFilePath(testNumber: number, fileName: string, year = '2026'): Promise<string> {
  const coll = await getCollection(COLLECTIONS.toeicAudio)
  const doc = coll ? await coll.findOne({ book: Number(year), test_number: testNumber, file_name: fileName }) : null
  if (doc?.relative_path) return doc.relative_path as string
  throw httpError(404, `ETS ${year} Audio Test ${testNumber} File ${fileName} not found`)
}

export async function getEtsAnswers(pdfType: string, testNumber: number, year = '2026') {
  const empty = { test: testNumber, type: pdfType, answers: {} as Record<string, string> }
  const coll = await getCollection(COLLECTIONS.toeicAnswers)
  if (!coll) return empty
  const doc = await coll.findOne({ book: Number(year), test: testNumber })
  if (!doc) return empty
  const field = ['lc', 'listening'].includes(pdfType.toLowerCase()) ? 'listening' : 'reading'
  const answers: Record<string, string> = {}
  for (const [q, v] of Object.entries((doc[field] as Record<string, unknown>) ?? {})) {
    answers[q] = v && typeof v === 'object' ? String((v as { answer?: unknown }).answer ?? '') : String(v)
  }
  return { test: testNumber, type: pdfType, answers }
}
