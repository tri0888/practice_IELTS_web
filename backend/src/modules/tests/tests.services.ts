import { PDFDocument } from 'pdf-lib'
import { httpError } from '../../shared/http'
import { fileResponse, getFileBytesCached } from '../../shared/storage'
import * as repo from './tests.repositories'

const IELTS_SKILLS = ['listening', 'reading', 'writing', 'speaking'] as const
const TOEIC_SKILLS = ['listening', 'reading'] as const

export function findBookPdfPath(book: number, pdfType = 'academic'): string {
  const suffix = pdfType === 'solution' ? ' Solution' : ''
  return `Cambridge IELTS 11-20/Cam ${book}/Cambridge ${book}${suffix}.pdf`
}

export function getEtsPdfPath(pdfType: string, testNumber: number, year = '2026'): string {
  return `ETS 24-26/ETS ${year}/ETS-${year}-${pdfType.toUpperCase()}/TEST_${String(testNumber).padStart(2, '0')}.pdf`
}

const sectionsOf = (layout: Record<string, unknown> | undefined, skills: readonly string[]) =>
  skills.filter(s => s in (layout ?? {})).map(name => ({ name }))

async function listFromLayouts(exam: repo.Exam, skills: readonly string[]) {
  const docs = await repo.findAllLayouts(exam)
  return docs.map(doc => ({ book: doc.book, test_number: doc.test, sections: sectionsOf(doc.layout, skills) }))
}

export const listTests = () => listFromLayouts('ielts', IELTS_SKILLS)
export const listToeicTests = () => listFromLayouts('toeic', TOEIC_SKILLS)

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

export const getBookPdf = (book: number, pdfType = 'academic') =>
  fileResponse(findBookPdfPath(book, pdfType), 'application/pdf', undefined, `Cambridge IELTS ${book} PDF not found`)

export async function getTest(book: number, test: number) {
  const doc = await repo.findIeltsLayout(book, test)
  if (!doc) throw httpError(404, 'test not found')
  return { book, test_number: test, sections: sectionsOf(doc.layout, IELTS_SKILLS) }
}

export async function getTestAudio(book: number, test: number) {
  const results = await repo.findIeltsAudio(book, test)
  for (const doc of results) {
    const rel = doc.relative_path || ''
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

export const getEtsPdf = (pdfType: string, testNumber: number, year = '2026') =>
  fileResponse(getEtsPdfPath(pdfType, testNumber, year), 'application/pdf', undefined,
    `ETS ${year} ${pdfType.toUpperCase()} Test ${testNumber} PDF not found`)

export async function getEtsAudioList(testNumber: number, year = '2026'): Promise<string[]> {
  return (await repo.findToeicAudioFileNames(Number(year), testNumber)).sort(naturalCompare)
}

export async function getEtsAudioFilePath(testNumber: number, fileName: string, year = '2026'): Promise<string> {
  const doc = await repo.findToeicAudioFile(Number(year), testNumber, fileName)
  if (doc?.relative_path) return doc.relative_path
  throw httpError(404, `ETS ${year} Audio Test ${testNumber} File ${fileName} not found`)
}

export async function getEtsAudioFile(testNumber: number, fileName: string, year = '2026') {
  const key = await getEtsAudioFilePath(testNumber, fileName, year)
  return fileResponse(key, 'audio/mpeg', fileName, `ETS ${year} Audio Test ${testNumber} File ${fileName} not found`)
}

export async function getEtsAnswers(pdfType: string, testNumber: number, year = '2026') {
  const doc = await repo.findToeicAnswers(Number(year), testNumber)
  const answers: Record<string, string> = {}
  if (doc) {
    const field = ['lc', 'listening'].includes(pdfType.toLowerCase()) ? 'listening' : 'reading'
    for (const [q, v] of Object.entries((doc[field] as Record<string, unknown>) ?? {})) {
      answers[q] = v && typeof v === 'object' ? String((v as { answer?: unknown }).answer ?? '') : String(v)
    }
  }
  return { test: testNumber, type: pdfType, answers }
}
